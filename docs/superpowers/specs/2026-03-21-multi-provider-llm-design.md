# Multi-Provider LLM Support Design

**Date:** 2026-03-21
**Status:** Approved

## Overview

Add provider selection (OpenAI GPT, Anthropic Claude, Google Gemini) to Noosphere. Users choose a provider on the home screen before running a simulation. All LLM calls are routed through a single abstraction module (`backend/llm.py`).

---

## `backend/llm.py` — New Module

### Tier → Model mapping

| Tier | OpenAI | Anthropic | Gemini |
|------|--------|-----------|--------|
| high | gpt-5.4 | claude-opus-4-6 | gemini-2.5-pro |
| mid  | gpt-5.4-mini | claude-sonnet-4-6 | gemini-2.0-flash |
| low  | gpt-5.4-nano | claude-haiku-4-5-20251001 | gemini-2.0-flash-lite |

Note: `gpt-5.4` family strings are already used throughout the codebase. They are kept as-is.

### Public interface

```python
LLMTier = Literal["high", "mid", "low"]

@dataclass
class LLMResponse:
    content: str | None      # normalized text (None if only a tool call was returned)
    tool_name: str | None    # name of tool called, if any
    tool_args: dict | None   # plain dict (never proto type)

class LLMToolRequired(Exception):
    """Raised when tool_choice named a specific tool but provider returned no tool call."""

class LLMRateLimitError(Exception):
    """Wraps each provider's rate limit exception."""

def check_provider_key(provider: str) -> None:
    """Raises ValueError if the required API key env var is not set."""

async def complete(
    messages: list[dict],       # OpenAI-format message dicts
    tier: LLMTier,
    provider: str,
    max_tokens: int,
    timeout: float = 120.0,
    tools: list[dict] | None = None,    # OpenAI-format tool definitions
    tool_choice: str | None = None,     # None=auto, str=force named tool
) -> LLMResponse:
```

### API key validation

`check_provider_key(provider)` checks `os.getenv` for `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `GEMINI_API_KEY` and raises `ValueError(f"{key_name} not set")` if missing. It does not rely on SDK behavior.

`complete()` also calls this check internally before constructing the SDK client.

`tasks.py` calls `llm.check_provider_key(provider)` **after `mark_simulation_started()`** and before any other work. If it raises, publish `{"type": "sim_error", "message": str(exc)}` and return early.

### Rate limiting

For **OpenAI** calls: `complete()` calls `await acquire_api_slot()` from `backend.simulation.rate_limiter` before the API call. This replaces the `async with _api_sem:` pattern previously scattered across call sites.

For **Anthropic** and **Gemini**: no rate limiter gate. `LLMRateLimitError` provides backpressure — callers' existing retry loops catch it.

The `_create_message()` wrapper in `social_rounds.py` (which combined `_api_sem`, `_get_client()`, and 429 retry) is **removed**. Its retry logic moves into `complete()`:

```python
for attempt in range(4):
    try:
        # ... call provider SDK ...
    except LLMRateLimitError:
        if attempt == 3:
            raise
        wait = 5 * (2 ** attempt)   # 5s, 10s, 20s
        await asyncio.sleep(wait)
```

### `tool_choice` semantics

- `None` → auto (model may or may not call a tool):
  - OpenAI: `tool_choice="auto"`
  - Anthropic: `tool_choice={"type": "auto"}`
  - Gemini: `tool_config={"function_calling_config": {"mode": "AUTO"}}`
- `str` (tool name) → force that specific tool:
  - OpenAI: `tool_choice={"type": "function", "function": {"name": name}}`
  - Anthropic: `tool_choice={"type": "tool", "name": name}`
  - Gemini: `tool_config={"function_calling_config": {"mode": "ANY", "allowed_function_names": [name]}}`

When `tool_choice` is a specific name and no tool call is in the response → raise `LLMToolRequired`. This applies to Gemini as well: a missing `function_call` part in ANY-mode is treated as an error.

### Gemini: system message rewriting

Gemini does not support `role="system"`. `complete()` performs internal rewriting when `provider == "gemini"`:
1. Scan `messages` for entries with `"role": "system"`.
2. Replace each with two entries: `{"role": "user", "content": <system content>}` followed by `{"role": "model", "content": "Understood."}`.

This is transparent to callers — they always pass OpenAI-format messages.

### Content normalization (no-tools path)

`LLMResponse.content` is always `str | None`:
- OpenAI: `response.choices[0].message.content`
- Anthropic: iterate `response.content`, return first `TextBlock.text`
- Gemini: `response.text`

### Tool definition conversion (OpenAI canonical input format)

Input is OpenAI native: `{"type": "function", "function": {"name": ..., "description": ..., "parameters": {...}}}`.

- **Anthropic**: `{"name": fn["name"], "description": fn["description"], "input_schema": fn["parameters"]}`
- **Gemini**: `genai.types.FunctionDeclaration(name=fn["name"], description=fn["description"], parameters=_deep_strip(fn["parameters"]))` where `_deep_strip` recursively removes `"additionalProperties"` and `"$schema"` at all nesting levels. All declarations wrapped in a single `genai.types.Tool(function_declarations=[...])`.

### Tool response extraction

- **OpenAI**: `tc = response.choices[0].message.tool_calls[0]` → `tool_name=tc.function.name`, `tool_args=json.loads(tc.function.arguments)`
- **Anthropic**: iterate `response.content` for first `ToolUseBlock` → `tool_name=block.name`, `tool_args=dict(block.input)`
- **Gemini**: iterate `response.candidates[0].content.parts` for part where `part.function_call` is set → `tool_name=part.function_call.name`, `tool_args=dict(part.function_call.args)` (explicit `dict()` to convert from proto.MapComposite)

If no tool call found and `tool_choice` was a named tool → raise `LLMToolRequired`.

### Error mapping

- `openai.RateLimitError` → `LLMRateLimitError`
- `anthropic.RateLimitError` → `LLMRateLimitError`
- Gemini HTTP 429 (`google.api_core.exceptions.ResourceExhausted`) → `LLMRateLimitError`
- All other exceptions propagate as-is.

### Gemini SDK

`google-genai>=1.0` (`from google import genai`). Async client: `genai.Client(api_key=...).aio`.

---

## Modified Backend Modules

All five modules:
- Remove module-level `_client` / `_get_client()` singleton
- Remove direct SDK imports (`import openai`, `import anthropic`)
- Remove `async with _api_sem:` (rate limiting moves into `llm.complete()`)
- Add `provider: str` parameter to each function listed below
- Replace all API calls with `await llm.complete(...)`

`LLMRateLimitError` replaces `openai.RateLimitError` in any remaining retry/catch logic.

Functions that use forced `tool_choice` (persona_generator, social_rounds) must re-raise `LLMToolRequired` before broad exception handlers:
```python
except LLMToolRequired:
    raise
except Exception as exc:
    logger.warning(...)
    return fallback
```

### Platform tool format

Platform methods (`seed_tool()`, `content_tool()`, `decide_action_tool()`, etc.) return Anthropic-style dicts with `input_schema`. `_to_openai_tool()` in `social_rounds.py` currently converts these to OpenAI format. This helper is **kept** — it is not removed. Callers continue to call `_to_openai_tool(platform.xxx_tool())` before passing to `llm.complete()`. `llm.complete()` only accepts OpenAI-format tools as input (the canonical format).

`_DECIDE_ACTION_TOOL` is already in OpenAI wire format and passes directly to `llm.complete()` without conversion.

### Function table

| File / Function | Tier | tool_choice |
|---|---|---|
| `reporter.py::generate_analysis_report(provider)` | high | None (no tools). **Fallback model loop dropped** — intentional regression: single `high` tier call, exception propagates on failure. |
| `extractor.py::extract_concepts(provider)` | mid | None |
| `context_builder.py::extract_concepts_from_text(provider)` | low | None |
| `context_builder.py::detect_domain(provider)` | low | None |
| `persona_generator.py::generate_persona(provider)` | mid | `"create_persona"` (forced) |
| `social_rounds.py::generate_seed_post(platform, ..., provider)` | mid | dynamic: `_to_openai_tool(platform.seed_tool())["function"]["name"]` |
| `social_rounds.py::decide_action(persona, ..., provider)` | low | dynamic: action tool name |
| `social_rounds.py::generate_content(persona, ..., provider)` | low | dynamic: `_to_openai_tool(platform.content_tool(...))["function"]["name"]` |
| `social_rounds.py::generate_report(states, ..., provider)` | high | `"create_report"` (forced, kept) |
| `social_rounds.py::round_personas(nodes, ..., provider)` | — | delegates to `generate_persona(provider)` |
| `social_rounds.py::platform_round(plat, ..., provider)` | — | delegates to decide_action/generate_content |

`_create_message()` helper in `social_rounds.py` is **removed** entirely — replaced by `llm.complete()`.

---

## Updated Function Signatures (call chain)

All functions between `tasks.py` and the LLM leaf calls must accept and thread `provider: str`.

**`backend/simulation/social_runner.py`:**
```python
async def run_simulation(..., provider: str = "openai") -> AsyncGenerator[dict, None]:

# closures inside run_simulation:
async def collect_personas_for_platform(platform_name: str) -> ...:
    # calls round_personas(..., provider=provider) — captures from outer scope

async def run_platform_round(plat, rn=round_num) -> ...:
    # calls platform_round(..., provider=provider) — captures from outer scope
```

**`backend/simulation/social_rounds.py`:**
```python
async def round_personas(nodes, idea_text, ..., provider: str) -> AsyncGenerator:
async def generate_seed_post(platform, idea_text, language, provider: str) -> SocialPost:
async def platform_round(plat, state, personas, degree, idea_text, round_num, language, activation_rate, provider: str) -> AsyncGenerator:
async def generate_report(states, idea_text, domain, language, provider: str) -> tuple[dict, str]:
```

**`backend/simulation/persona_generator.py`:**
```python
async def generate_persona(node, idea_text, platform_name, ..., provider: str) -> Persona:
```

**`backend/reporter.py`:**
```python
async def generate_analysis_report(raw_items, domain, input_text, language, provider: str) -> str:
```

**`backend/extractor.py`:**
```python
async def extract_concepts(input_text: str, provider: str = "openai") -> dict[str, Any]:
```

**`backend/context_builder.py`:**
```python
async def extract_concepts_from_text(text, provider: str) -> list[str]:
async def detect_domain(text, provider: str) -> str:
```

---

## Provider Field Propagation

```
SimConfig.provider
  → tasks.py (_run())
      → llm.check_provider_key(provider)              # pre-flight
      → analyze(input_text, ..., provider=provider)   # extractor + context_builder
      → detect_domain(input_text, provider=provider)
      → generate_analysis_report(..., provider=provider)
      → run_simulation(..., provider=provider)
            → round_personas(..., provider=provider)
                  → generate_persona(..., provider=provider)
            → generate_seed_post(..., provider=provider)
            → platform_round(..., provider=provider)
                  → decide_action(..., provider=provider)
                  → generate_content(..., provider=provider)
            → generate_report(..., provider=provider)
```

No global state. `provider` is an explicit parameter at every level.

`tasks.py` accesses provider as `config.get("provider", "openai")` — defensive default handles any queued tasks from before this feature was deployed.

---

## Backend `SimConfig` (main.py)

```python
class SimConfig(BaseModel):
    ...
    provider: str = "openai"

    @field_validator("provider")
    @classmethod
    def provider_valid(cls, v: str) -> str:
        if v not in {"openai", "anthropic", "gemini"}:
            raise ValueError("provider must be openai, anthropic, or gemini")
        return v
```

---

## Frontend

**`frontend/src/types.ts`:**
```ts
export type Provider = 'openai' | 'anthropic' | 'gemini'

export interface SimConfig {
  ...
  provider: Provider
}

// HistoryItem: provider is optional for backward compat with old DB records
// UI renders config.provider ?? 'openai'
```

**`frontend/src/pages/HomePage.tsx`:**
- Add `PROVIDER_OPTIONS`:
  ```ts
  [
    { id: 'openai',    label: 'GPT',    description: 'OpenAI GPT-5.4' },
    { id: 'anthropic', label: 'Claude', description: 'Anthropic Claude' },
    { id: 'gemini',    label: 'Gemini', description: 'Google Gemini' },
  ]
  ```
- Render 3 card-style selector buttons (same visual style as platform buttons), placed above the Run button.
- Default: `provider: 'openai'` in `DEFAULT_CONFIG`.

---

## Dependencies

**`pyproject.toml`:** Add `google-genai>=1.0`. (`anthropic>=0.28` already present — no change.)

**`.env.example`:**
```
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
```

---

## What Does Not Change

- Simulation logic, persona structure, platform code, tool schemas in platform files
- Redis Streams, Celery task flow, DB schema
- Cancel/heartbeat flow
- `rate_limiter.py` module itself (only its `acquire_api_slot()` function is now called from `llm.py`)
