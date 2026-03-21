# Multi-Provider LLM Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add GPT / Claude / Gemini provider selection to Noosphere, routing all LLM calls through a new `backend/llm.py` abstraction layer.

**Architecture:** A single `backend/llm.py` module exposes `complete()` and `check_provider_key()`. All five backend modules that make LLM calls are refactored to call `llm.complete()` instead of provider SDKs directly. The frontend adds a 3-button provider selector on the home page.

**Tech Stack:** Python 3.11, OpenAI SDK, Anthropic SDK, google-genai SDK, React/TypeScript, pytest-asyncio

**Spec:** `docs/superpowers/specs/2026-03-21-multi-provider-llm-design.md`

---

## File Map

**Create:**
- `backend/llm.py` — LLMResponse, LLMToolRequired, LLMRateLimitError, check_provider_key, complete()
- `tests/test_llm.py` — unit tests for llm.py

**Modify:**
- `pyproject.toml` — add `google-genai>=1.0`
- `.env.example` — add ANTHROPIC_API_KEY, GEMINI_API_KEY
- `backend/main.py` — add `provider` field to SimConfig
- `backend/tasks.py` — add check_provider_key pre-flight, thread provider
- `backend/extractor.py` — remove _client singleton, add provider param to extract_concepts
- `backend/context_builder.py` — remove _client singleton, add provider param to both functions
- `backend/reporter.py` — remove _client + fallback loop, add provider param
- `backend/simulation/persona_generator.py` — remove _client/_api_sem, add provider param
- `backend/simulation/social_rounds.py` — remove _create_message()/_client/_api_sem, add provider param to all functions
- `backend/simulation/social_runner.py` — add provider param to run_simulation, thread through closures
- `frontend/src/types.ts` — add Provider type, update SimConfig
- `frontend/src/pages/HomePage.tsx` — add provider selector UI

**Update tests:**
- `tests/test_context_builder.py` — update mocks from `_get_client` to `llm.complete`

---

## Task 1: Add google-genai dependency

**Files:**
- Modify: `pyproject.toml`
- Modify: `.env.example`

- [ ] **Step 1: Add google-genai to pyproject.toml**

In `pyproject.toml`, add to the `dependencies` list:
```
"google-genai>=1.0",
```

- [ ] **Step 2: Add API keys to .env.example**

Append to `.env.example`:
```
ANTHROPIC_API_KEY=your_anthropic_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
```

- [ ] **Step 3: Install new dependency**

```bash
pip install google-genai
```

Expected: installs without error.

- [ ] **Step 4: Verify import works**

```bash
python -c "from google import genai; print('ok')"
```

Expected: prints `ok`.

- [ ] **Step 5: Commit**

```bash
git add pyproject.toml .env.example
git commit -m "deps: add google-genai for Gemini provider support"
```

---

## Task 2: Create backend/llm.py — core structures and key validation

**Files:**
- Create: `backend/llm.py`
- Create: `tests/test_llm.py`

- [ ] **Step 1: Write failing test for check_provider_key**

Create `tests/test_llm.py`:
```python
import os
import pytest
from unittest.mock import patch


def test_check_provider_key_openai_missing():
    from backend.llm import check_provider_key
    with patch.dict(os.environ, {}, clear=True):
        # Remove OPENAI_API_KEY if set
        env = {k: v for k, v in os.environ.items() if k != "OPENAI_API_KEY"}
        with patch.dict(os.environ, env, clear=True):
            with pytest.raises(ValueError, match="OPENAI_API_KEY"):
                check_provider_key("openai")


def test_check_provider_key_openai_present():
    from backend.llm import check_provider_key
    with patch.dict(os.environ, {"OPENAI_API_KEY": "sk-test"}):
        check_provider_key("openai")  # should not raise


def test_check_provider_key_anthropic_missing():
    from backend.llm import check_provider_key
    with patch.dict(os.environ, {}, clear=True):
        env = {k: v for k, v in os.environ.items() if k != "ANTHROPIC_API_KEY"}
        with patch.dict(os.environ, env, clear=True):
            with pytest.raises(ValueError, match="ANTHROPIC_API_KEY"):
                check_provider_key("anthropic")


def test_check_provider_key_gemini_missing():
    from backend.llm import check_provider_key
    with patch.dict(os.environ, {}, clear=True):
        env = {k: v for k, v in os.environ.items() if k != "GEMINI_API_KEY"}
        with patch.dict(os.environ, env, clear=True):
            with pytest.raises(ValueError, match="GEMINI_API_KEY"):
                check_provider_key("gemini")


def test_check_provider_key_unknown_provider():
    from backend.llm import check_provider_key
    with pytest.raises(ValueError, match="Unknown provider"):
        check_provider_key("unknown")
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/taeyoungpark/Desktop/noosphere && python -m pytest tests/test_llm.py -v
```
Expected: ImportError or ModuleNotFoundError (file doesn't exist yet).

- [ ] **Step 3: Create backend/llm.py with core structures**

Create `backend/llm.py`:
```python
from __future__ import annotations
import asyncio
import json
import logging
import os
from dataclasses import dataclass
from typing import Literal

logger = logging.getLogger(__name__)

LLMTier = Literal["high", "mid", "low"]

_MODELS: dict[str, dict[str, str]] = {
    "openai":    {"high": "gpt-5.4",          "mid": "gpt-5.4-mini",       "low": "gpt-5.4-nano"},
    "anthropic": {"high": "claude-opus-4-6",   "mid": "claude-sonnet-4-6",  "low": "claude-haiku-4-5-20251001"},
    "gemini":    {"high": "gemini-2.5-pro",    "mid": "gemini-2.0-flash",   "low": "gemini-2.0-flash-lite"},
}

_API_KEY_NAMES: dict[str, str] = {
    "openai":    "OPENAI_API_KEY",
    "anthropic": "ANTHROPIC_API_KEY",
    "gemini":    "GEMINI_API_KEY",
}


@dataclass
class LLMResponse:
    content: str | None        # normalized text response
    tool_name: str | None      # name of tool called, if any
    tool_args: dict | None     # parsed tool arguments (plain dict)


class LLMToolRequired(Exception):
    """Raised when tool_choice named a specific tool but provider returned no tool call."""


class LLMRateLimitError(Exception):
    """Wraps each provider's rate limit exception."""


def check_provider_key(provider: str) -> None:
    """Raises ValueError if the required API key env var is not set."""
    key_name = _API_KEY_NAMES.get(provider)
    if key_name is None:
        raise ValueError(f"Unknown provider: {provider!r}")
    if not os.environ.get(key_name):
        raise ValueError(f"{key_name} not set")
```

- [ ] **Step 4: Run tests**

```bash
python -m pytest tests/test_llm.py -v
```
Expected: all 5 key-validation tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/llm.py tests/test_llm.py
git commit -m "feat: add backend/llm.py with core types and key validation"
```

---

## Task 3: llm.py — OpenAI provider

**Files:**
- Modify: `backend/llm.py`
- Modify: `tests/test_llm.py`

- [ ] **Step 1: Write failing tests for OpenAI text and tool call**

Append to `tests/test_llm.py`:
```python
from unittest.mock import AsyncMock, MagicMock, patch


async def test_complete_openai_text():
    """complete() returns LLMResponse with content for a text response."""
    from backend.llm import complete, LLMResponse

    mock_message = MagicMock()
    mock_message.content = "Hello world"
    mock_message.tool_calls = None

    mock_choice = MagicMock()
    mock_choice.message = mock_message

    mock_response = MagicMock()
    mock_response.choices = [mock_choice]

    mock_client = AsyncMock()
    mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

    with patch("backend.llm._get_openai_client", return_value=mock_client), \
         patch("backend.llm.acquire_api_slot", new_callable=AsyncMock), \
         patch.dict(os.environ, {"OPENAI_API_KEY": "sk-test"}):
        result = await complete(
            messages=[{"role": "user", "content": "hi"}],
            tier="low",
            provider="openai",
            max_tokens=50,
        )
    assert isinstance(result, LLMResponse)
    assert result.content == "Hello world"
    assert result.tool_args is None


async def test_complete_openai_tool_call():
    """complete() returns tool_args when a tool call is present."""
    from backend.llm import complete

    mock_function = MagicMock()
    mock_function.name = "create_persona"
    mock_function.arguments = '{"name": "Alice", "role": "engineer"}'

    mock_tool_call = MagicMock()
    mock_tool_call.function = mock_function

    mock_message = MagicMock()
    mock_message.content = None
    mock_message.tool_calls = [mock_tool_call]

    mock_response = MagicMock()
    mock_response.choices = [MagicMock(message=mock_message)]

    mock_client = AsyncMock()
    mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

    tool = {"type": "function", "function": {"name": "create_persona", "description": "...", "parameters": {"type": "object", "properties": {}}}}

    with patch("backend.llm._get_openai_client", return_value=mock_client), \
         patch("backend.llm.acquire_api_slot", new_callable=AsyncMock), \
         patch.dict(os.environ, {"OPENAI_API_KEY": "sk-test"}):
        result = await complete(
            messages=[{"role": "user", "content": "gen persona"}],
            tier="mid",
            provider="openai",
            max_tokens=256,
            tools=[tool],
            tool_choice="create_persona",
        )
    assert result.tool_name == "create_persona"
    assert result.tool_args == {"name": "Alice", "role": "engineer"}


async def test_complete_openai_tool_required_raises():
    """complete() raises LLMToolRequired when forced tool is not returned."""
    from backend.llm import complete, LLMToolRequired

    mock_message = MagicMock()
    mock_message.content = "I can't do that"
    mock_message.tool_calls = None

    mock_response = MagicMock()
    mock_response.choices = [MagicMock(message=mock_message)]

    mock_client = AsyncMock()
    mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

    tool = {"type": "function", "function": {"name": "create_persona", "description": "", "parameters": {}}}

    with patch("backend.llm._get_openai_client", return_value=mock_client), \
         patch("backend.llm.acquire_api_slot", new_callable=AsyncMock), \
         patch.dict(os.environ, {"OPENAI_API_KEY": "sk-test"}):
        with pytest.raises(LLMToolRequired):
            await complete(
                messages=[{"role": "user", "content": "gen persona"}],
                tier="mid",
                provider="openai",
                max_tokens=256,
                tools=[tool],
                tool_choice="create_persona",
            )
```

- [ ] **Step 2: Run to verify failure**

```bash
python -m pytest tests/test_llm.py::test_complete_openai_text -v
```
Expected: FAIL (complete() not implemented yet).

- [ ] **Step 3: Implement OpenAI path in complete()**

Add to `backend/llm.py` (imports section at top):
```python
import openai
from backend.simulation.rate_limiter import acquire_api_slot
```

Add helper and complete() after the existing code:
```python
_openai_client: openai.AsyncOpenAI | None = None

def _get_openai_client() -> openai.AsyncOpenAI:
    global _openai_client
    if _openai_client is None:
        api_key = os.environ.get("OPENAI_API_KEY", "")
        _openai_client = openai.AsyncOpenAI(api_key=api_key, timeout=60.0)
    return _openai_client


def _tool_choice_openai(tool_choice: str | None) -> str | dict:
    if tool_choice is None:
        return "auto"
    return {"type": "function", "function": {"name": tool_choice}}


def _extract_openai_response(response, tool_choice: str | None) -> LLMResponse:
    message = response.choices[0].message
    tool_calls = getattr(message, "tool_calls", None) or []
    if tool_calls:
        tc = tool_calls[0]
        return LLMResponse(
            content=message.content,
            tool_name=tc.function.name,
            tool_args=json.loads(tc.function.arguments),
        )
    if tool_choice is not None:
        raise LLMToolRequired(f"Expected tool call '{tool_choice}' but got none")
    return LLMResponse(content=message.content, tool_name=None, tool_args=None)


async def _complete_openai(
    messages: list[dict],
    model: str,
    max_tokens: int,
    timeout: float,
    tools: list[dict] | None,
    tool_choice: str | None,
) -> LLMResponse:
    client = _get_openai_client()
    kwargs: dict = {"model": model, "max_tokens": max_tokens, "messages": messages}
    if tools:
        kwargs["tools"] = tools
        kwargs["tool_choice"] = _tool_choice_openai(tool_choice)

    for attempt in range(4):
        await acquire_api_slot()
        try:
            response = await client.chat.completions.create(**kwargs)
            return _extract_openai_response(response, tool_choice)
        except LLMToolRequired:
            raise
        except openai.RateLimitError:
            if attempt == 3:
                raise LLMRateLimitError("OpenAI rate limit exceeded")
            wait = 5 * (2 ** attempt)
            logger.warning("OpenAI rate limit, retrying in %ds", wait)
            await asyncio.sleep(wait)
    raise RuntimeError("Unreachable")


async def complete(
    messages: list[dict],
    tier: LLMTier,
    provider: str,
    max_tokens: int,
    timeout: float = 120.0,
    tools: list[dict] | None = None,
    tool_choice: str | None = None,
) -> LLMResponse:
    """Route LLM call to the appropriate provider."""
    check_provider_key(provider)
    model = _MODELS[provider][tier]

    if provider == "openai":
        return await _complete_openai(messages, model, max_tokens, timeout, tools, tool_choice)
    # anthropic and gemini added in next tasks
    raise NotImplementedError(f"Provider {provider!r} not yet implemented")
```

- [ ] **Step 4: Run tests**

```bash
python -m pytest tests/test_llm.py -k "openai" -v
```
Expected: all 3 OpenAI tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/llm.py tests/test_llm.py
git commit -m "feat: llm.py OpenAI provider implementation"
```

---

## Task 4: llm.py — Anthropic provider

**Files:**
- Modify: `backend/llm.py`
- Modify: `tests/test_llm.py`

Anthropic uses a `system=` parameter (not a system message in the messages list). `complete()` extracts messages with `role="system"`, joins their content, and passes as `system=`. Tool definitions use `input_schema` instead of `parameters`.

- [ ] **Step 1: Write failing tests for Anthropic**

Append to `tests/test_llm.py`:
```python
async def test_complete_anthropic_text():
    """complete() returns content for Anthropic text response."""
    from backend.llm import complete
    import anthropic

    mock_text_block = MagicMock()
    mock_text_block.__class__ = anthropic.types.TextBlock
    mock_text_block.text = "Anthropic says hi"

    mock_response = MagicMock()
    mock_response.content = [mock_text_block]

    mock_client = AsyncMock()
    mock_client.messages.create = AsyncMock(return_value=mock_response)

    with patch("backend.llm._get_anthropic_client", return_value=mock_client), \
         patch.dict(os.environ, {"ANTHROPIC_API_KEY": "sk-ant-test"}):
        result = await complete(
            messages=[{"role": "user", "content": "hi"}],
            tier="low",
            provider="anthropic",
            max_tokens=50,
        )
    assert result.content == "Anthropic says hi"
    assert result.tool_args is None


async def test_complete_anthropic_tool_call():
    """complete() extracts tool_args from Anthropic ToolUseBlock."""
    from backend.llm import complete
    import anthropic

    mock_tool_block = MagicMock()
    mock_tool_block.__class__ = anthropic.types.ToolUseBlock
    mock_tool_block.name = "create_persona"
    mock_tool_block.input = {"name": "Bob", "role": "designer"}

    mock_response = MagicMock()
    mock_response.content = [mock_tool_block]

    mock_client = AsyncMock()
    mock_client.messages.create = AsyncMock(return_value=mock_response)

    tool = {"type": "function", "function": {"name": "create_persona", "description": "", "parameters": {"type": "object", "properties": {}}}}

    with patch("backend.llm._get_anthropic_client", return_value=mock_client), \
         patch.dict(os.environ, {"ANTHROPIC_API_KEY": "sk-ant-test"}):
        result = await complete(
            messages=[{"role": "user", "content": "gen persona"}],
            tier="mid",
            provider="anthropic",
            max_tokens=256,
            tools=[tool],
            tool_choice="create_persona",
        )
    assert result.tool_name == "create_persona"
    assert result.tool_args == {"name": "Bob", "role": "designer"}
```

- [ ] **Step 2: Run to verify failure**

```bash
python -m pytest tests/test_llm.py -k "anthropic" -v
```
Expected: FAIL (NotImplementedError).

- [ ] **Step 3: Implement Anthropic path**

Add to imports at top of `backend/llm.py`:
```python
import anthropic as _anthropic
```

Add after OpenAI helpers:
```python
_anthropic_client: _anthropic.AsyncAnthropic | None = None

def _get_anthropic_client() -> _anthropic.AsyncAnthropic:
    global _anthropic_client
    if _anthropic_client is None:
        api_key = os.environ.get("ANTHROPIC_API_KEY", "")
        _anthropic_client = _anthropic.AsyncAnthropic(api_key=api_key, timeout=60.0)
    return _anthropic_client


def _to_anthropic_tools(tools: list[dict]) -> list[dict]:
    """Convert OpenAI-format tools to Anthropic format."""
    result = []
    for t in tools:
        fn = t["function"]
        result.append({
            "name": fn["name"],
            "description": fn.get("description", ""),
            "input_schema": fn["parameters"],
        })
    return result


def _tool_choice_anthropic(tool_choice: str | None) -> dict:
    if tool_choice is None:
        return {"type": "auto"}
    return {"type": "tool", "name": tool_choice}


def _extract_anthropic_response(response, tool_choice: str | None) -> LLMResponse:
    tool_block = next(
        (b for b in response.content if isinstance(b, _anthropic.types.ToolUseBlock)),
        None
    )
    if tool_block is not None:
        return LLMResponse(
            content=None,
            tool_name=tool_block.name,
            tool_args=dict(tool_block.input),
        )
    if tool_choice is not None:
        raise LLMToolRequired(f"Expected tool call '{tool_choice}' but got none")
    text_block = next(
        (b for b in response.content if isinstance(b, _anthropic.types.TextBlock)),
        None
    )
    return LLMResponse(
        content=text_block.text if text_block else None,
        tool_name=None,
        tool_args=None,
    )


async def _complete_anthropic(
    messages: list[dict],
    model: str,
    max_tokens: int,
    timeout: float,
    tools: list[dict] | None,
    tool_choice: str | None,
) -> LLMResponse:
    client = _get_anthropic_client()

    # Extract system messages; Anthropic uses a separate `system` param
    system_parts = [m["content"] for m in messages if m.get("role") == "system"]
    user_messages = [m for m in messages if m.get("role") != "system"]
    system_str = "\n\n".join(system_parts) if system_parts else _anthropic.NOT_GIVEN

    kwargs: dict = {
        "model": model,
        "max_tokens": max_tokens,
        "system": system_str,
        "messages": user_messages,
    }
    if tools:
        kwargs["tools"] = _to_anthropic_tools(tools)
        kwargs["tool_choice"] = _tool_choice_anthropic(tool_choice)

    for attempt in range(4):
        try:
            response = await client.messages.create(**kwargs)
            return _extract_anthropic_response(response, tool_choice)
        except LLMToolRequired:
            raise
        except _anthropic.RateLimitError:
            if attempt == 3:
                raise LLMRateLimitError("Anthropic rate limit exceeded")
            wait = 5 * (2 ** attempt)
            logger.warning("Anthropic rate limit, retrying in %ds", wait)
            await asyncio.sleep(wait)
    raise RuntimeError("Unreachable")
```

Update `complete()` to handle anthropic:
```python
    if provider == "openai":
        return await _complete_openai(messages, model, max_tokens, timeout, tools, tool_choice)
    if provider == "anthropic":
        return await _complete_anthropic(messages, model, max_tokens, timeout, tools, tool_choice)
    raise NotImplementedError(f"Provider {provider!r} not yet implemented")
```

- [ ] **Step 4: Run tests**

```bash
python -m pytest tests/test_llm.py -k "anthropic" -v
```
Expected: both Anthropic tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/llm.py tests/test_llm.py
git commit -m "feat: llm.py Anthropic provider implementation"
```

---

## Task 5: llm.py — Gemini provider

**Files:**
- Modify: `backend/llm.py`
- Modify: `tests/test_llm.py`

Gemini does not support `role="system"`. `complete()` rewrites system messages as user+model pairs. Tool schemas must have `additionalProperties` and `$schema` stripped recursively (Gemini rejects unknown schema keywords). The SDK response uses `response.text` for plain text and `part.function_call` for tool calls.

- [ ] **Step 1: Write failing tests for Gemini**

Append to `tests/test_llm.py`:
```python
async def test_complete_gemini_text():
    """complete() returns content for Gemini text response."""
    from backend.llm import complete

    mock_response = MagicMock()
    mock_response.text = "Gemini says hi"
    # No function_call in parts
    mock_part = MagicMock(spec=[])  # no function_call attribute
    mock_response.candidates = [MagicMock(content=MagicMock(parts=[mock_part]))]

    mock_aio = AsyncMock()
    mock_aio.models.generate_content = AsyncMock(return_value=mock_response)
    mock_client = MagicMock()
    mock_client.aio = mock_aio

    with patch("backend.llm._get_gemini_client", return_value=mock_client), \
         patch.dict(os.environ, {"GEMINI_API_KEY": "gemini-test"}):
        result = await complete(
            messages=[{"role": "user", "content": "hi"}],
            tier="low",
            provider="gemini",
            max_tokens=50,
        )
    assert result.content == "Gemini says hi"
    assert result.tool_args is None


def test_deep_strip_schema_keys():
    """_deep_strip_schema_keys removes additionalProperties and $schema at all levels."""
    from backend.llm import _deep_strip_schema_keys
    schema = {
        "type": "object",
        "$schema": "http://json-schema.org/draft-07/schema#",
        "additionalProperties": False,
        "properties": {
            "nested": {
                "type": "object",
                "additionalProperties": True,
                "$schema": "ignored",
                "properties": {}
            }
        }
    }
    result = _deep_strip_schema_keys(schema)
    assert "$schema" not in result
    assert "additionalProperties" not in result
    assert "$schema" not in result["properties"]["nested"]
    assert "additionalProperties" not in result["properties"]["nested"]
    assert result["type"] == "object"
```

- [ ] **Step 2: Run to verify failure**

```bash
python -m pytest tests/test_llm.py -k "gemini or strip" -v
```
Expected: FAIL.

- [ ] **Step 3: Implement Gemini path**

Add to imports:
```python
from google import genai as _genai
from google.api_core import exceptions as _google_exceptions
```

Add after Anthropic helpers:
```python
_gemini_client = None

def _get_gemini_client():
    global _gemini_client
    if _gemini_client is None:
        api_key = os.environ.get("GEMINI_API_KEY", "")
        _gemini_client = _genai.Client(api_key=api_key)
    return _gemini_client


def _deep_strip_schema_keys(schema: dict) -> dict:
    """Recursively remove additionalProperties and $schema from a JSON schema."""
    _STRIP = {"additionalProperties", "$schema"}
    result = {k: v for k, v in schema.items() if k not in _STRIP}
    if "properties" in result and isinstance(result["properties"], dict):
        result["properties"] = {
            k: _deep_strip_schema_keys(v) if isinstance(v, dict) else v
            for k, v in result["properties"].items()
        }
    if "items" in result and isinstance(result["items"], dict):
        result["items"] = _deep_strip_schema_keys(result["items"])
    return result


def _to_gemini_tools(tools: list[dict]) -> list:
    """Convert OpenAI-format tools to Gemini FunctionDeclarations."""
    declarations = []
    for t in tools:
        fn = t["function"]
        declarations.append(
            _genai.types.FunctionDeclaration(
                name=fn["name"],
                description=fn.get("description", ""),
                parameters=_deep_strip_schema_keys(fn["parameters"]),
            )
        )
    return [_genai.types.Tool(function_declarations=declarations)]


def _rewrite_system_for_gemini(messages: list[dict]) -> list[dict]:
    """Convert role='system' messages to user+model pairs for Gemini."""
    result = []
    for m in messages:
        if m.get("role") == "system":
            result.append({"role": "user", "content": m["content"]})
            result.append({"role": "model", "content": "Understood."})
        else:
            # Gemini uses 'model' not 'assistant'
            role = "model" if m.get("role") == "assistant" else m.get("role", "user")
            result.append({"role": role, "content": m["content"]})
    return result


def _to_gemini_contents(messages: list[dict]) -> list:
    """Convert message dicts to Gemini Content objects."""
    contents = []
    for m in _rewrite_system_for_gemini(messages):
        contents.append(_genai.types.Content(
            role=m["role"],
            parts=[_genai.types.Part.from_text(m["content"])],
        ))
    return contents


def _extract_gemini_response(response, tool_choice: str | None) -> LLMResponse:
    # Look for function_call in parts
    try:
        parts = response.candidates[0].content.parts
        for part in parts:
            fc = getattr(part, "function_call", None)
            if fc is not None:
                return LLMResponse(
                    content=None,
                    tool_name=fc.name,
                    tool_args=dict(fc.args),
                )
    except (IndexError, AttributeError):
        pass
    if tool_choice is not None:
        raise LLMToolRequired(f"Expected tool call '{tool_choice}' but got none")
    return LLMResponse(content=response.text, tool_name=None, tool_args=None)


async def _complete_gemini(
    messages: list[dict],
    model: str,
    max_tokens: int,
    timeout: float,
    tools: list | None,
    tool_choice: str | None,
) -> LLMResponse:
    client = _get_gemini_client()
    contents = _to_gemini_contents(messages)

    gemini_tools = _to_gemini_tools(tools) if tools else None
    tool_config = None
    if tools:
        mode = "ANY" if tool_choice else "AUTO"
        tool_config = _genai.types.ToolConfig(
            function_calling_config=_genai.types.FunctionCallingConfig(
                mode=mode,
                allowed_function_names=[tool_choice] if tool_choice else None,
            )
        )
    config = _genai.types.GenerateContentConfig(
        max_output_tokens=max_tokens,
        tools=gemini_tools,
        tool_config=tool_config,
    )

    for attempt in range(4):
        try:
            response = await client.aio.models.generate_content(
                model=model,
                contents=contents,
                config=config,
            )
            return _extract_gemini_response(response, tool_choice)
        except LLMToolRequired:
            raise
        except _google_exceptions.ResourceExhausted:
            if attempt == 3:
                raise LLMRateLimitError("Gemini rate limit exceeded")
            wait = 5 * (2 ** attempt)
            logger.warning("Gemini rate limit, retrying in %ds", wait)
            await asyncio.sleep(wait)
    raise RuntimeError("Unreachable")
```

Update `complete()`:
```python
    if provider == "openai":
        return await _complete_openai(messages, model, max_tokens, timeout, tools, tool_choice)
    if provider == "anthropic":
        return await _complete_anthropic(messages, model, max_tokens, timeout, tools, tool_choice)
    if provider == "gemini":
        return await _complete_gemini(messages, model, max_tokens, timeout, tools, tool_choice)
    raise ValueError(f"Unknown provider: {provider!r}")
```

- [ ] **Step 4: Run tests**

```bash
python -m pytest tests/test_llm.py -v
```
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/llm.py tests/test_llm.py
git commit -m "feat: llm.py Gemini provider implementation"
```

---

## Task 6: SimConfig — add provider field

**Files:**
- Modify: `backend/main.py`
- Modify: `tests/test_db.py` (or create `tests/test_main_config.py`)

- [ ] **Step 1: Write failing test for provider validation**

Create `tests/test_main_config.py`:
```python
import pytest
from pydantic import ValidationError


def test_simconfig_default_provider():
    from backend.main import SimConfig
    cfg = SimConfig(input_text="hello")
    assert cfg.provider == "openai"


def test_simconfig_valid_providers():
    from backend.main import SimConfig
    for p in ("openai", "anthropic", "gemini"):
        cfg = SimConfig(input_text="hello", provider=p)
        assert cfg.provider == p


def test_simconfig_invalid_provider():
    from backend.main import SimConfig
    with pytest.raises(ValidationError):
        SimConfig(input_text="hello", provider="cohere")
```

- [ ] **Step 2: Run to verify failure**

```bash
python -m pytest tests/test_main_config.py -v
```
Expected: FAIL (no `provider` field).

- [ ] **Step 3: Add provider field to SimConfig in main.py**

In `backend/main.py`, add to `SimConfig` class (after `source_limits` field):
```python
    provider: str = "openai"

    @field_validator("provider")
    @classmethod
    def provider_valid(cls, v: str) -> str:
        if v not in {"openai", "anthropic", "gemini"}:
            raise ValueError("provider must be openai, anthropic, or gemini")
        return v
```

- [ ] **Step 4: Run tests**

```bash
python -m pytest tests/test_main_config.py -v
```
Expected: all 3 pass.

- [ ] **Step 5: Commit**

```bash
git add backend/main.py tests/test_main_config.py
git commit -m "feat: add provider field to SimConfig"
```

---

## Task 7: Migrate extractor.py

**Files:**
- Modify: `backend/extractor.py`

The function to migrate is `extract_concepts()` (not `extract_items`). Remove `_client`, `_get_client()`, SDK imports. Add `provider: str` param. Call `await llm.complete()` with `tier="mid"`.

- [ ] **Step 1: Write test**

Create `tests/test_extractor.py`:
```python
from unittest.mock import AsyncMock, patch
from backend.llm import LLMResponse


async def test_extract_concepts_with_provider():
    """extract_concepts accepts provider param and uses llm.complete."""
    mock_response = LLMResponse(
        content='{"concepts": ["SaaS", "productivity"], "domain": "tech", "domain_type": "tech", "search_queries": ["saas app"], "query_bundles": {"code": [], "academic": [], "discussion": [], "product": []}}',
        tool_name=None,
        tool_args=None,
    )
    with patch("backend.extractor.llm") as mock_llm:
        mock_llm.complete = AsyncMock(return_value=mock_response)
        mock_llm.check_provider_key = lambda p: None
        from backend.extractor import extract_concepts
        result = await extract_concepts("A SaaS productivity app", provider="openai")
    assert "concepts" in result
    assert isinstance(result["concepts"], list)
```

- [ ] **Step 2: Run to verify failure**

```bash
python -m pytest tests/test_extractor.py -v
```
Expected: FAIL (extract_concepts doesn't accept provider yet).

- [ ] **Step 3: Rewrite extractor.py**

In `backend/extractor.py`:
- Remove `import openai` and `_client`, `_get_client()`, `_message_text()` helpers
- Add `from backend import llm`
- Change `async def extract_concepts(input_text: str) -> dict[str, Any]:` to `async def extract_concepts(input_text: str, provider: str = "openai") -> dict[str, Any]:`
- Replace the `client.chat.completions.create(...)` call with:
  ```python
  response = await llm.complete(
      messages=[{"role": "user", "content": prompt}],
      tier="mid",
      provider=provider,
      max_tokens=1024,
  )
  raw = response.content or ""
  ```
- Keep existing JSON parsing logic that follows.

- [ ] **Step 4: Run test**

```bash
python -m pytest tests/test_extractor.py -v
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/extractor.py tests/test_extractor.py
git commit -m "refactor: migrate extractor.py to llm.complete()"
```

---

## Task 8: Migrate context_builder.py

**Files:**
- Modify: `backend/context_builder.py`
- Modify: `tests/test_context_builder.py`

Functions: `extract_concepts_from_text(text, provider)` and `detect_domain(text, provider)`. Both use `tier="low"`, no tools.

- [ ] **Step 1: Update existing tests**

In `tests/test_context_builder.py`, replace `patch("backend.context_builder._get_client")` mocks:
```python
from unittest.mock import AsyncMock, patch
from backend.llm import LLMResponse


async def test_extract_concepts_returns_list():
    mock_response = LLMResponse(content='["task management", "SaaS", "productivity"]', tool_name=None, tool_args=None)
    with patch("backend.context_builder.llm") as mock_llm:
        mock_llm.complete = AsyncMock(return_value=mock_response)
        from backend.context_builder import extract_concepts_from_text
        result = await extract_concepts_from_text("A SaaS app for task management", provider="openai")
    assert isinstance(result, list)
    assert len(result) > 0
```

- [ ] **Step 2: Run to verify old tests now fail**

```bash
python -m pytest tests/test_context_builder.py -v
```
Expected: FAIL (still using `_get_client` mock).

- [ ] **Step 3: Rewrite context_builder.py**

In `backend/context_builder.py`:
- Remove `import anthropic` (or openai), `_client`, `_get_client()`
- Add `from backend import llm`
- `extract_concepts_from_text(text: str, provider: str = "openai") -> list[str]`: call `await llm.complete(messages=[...], tier="low", provider=provider, max_tokens=512)`, use `response.content`
- `detect_domain(text: str, provider: str = "openai") -> str`: same pattern

- [ ] **Step 4: Run tests**

```bash
python -m pytest tests/test_context_builder.py -v
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/context_builder.py tests/test_context_builder.py
git commit -m "refactor: migrate context_builder.py to llm.complete()"
```

---

## Task 9: Migrate reporter.py

**Files:**
- Modify: `backend/reporter.py`

Function: `generate_analysis_report(raw_items, domain, input_text, language, provider)`. Tier `high`, no tools. The existing two-model fallback loop (`_MODELS`) is dropped intentionally — single call with no retry.

- [ ] **Step 1: Write test**

Create `tests/test_reporter.py`:
```python
from unittest.mock import AsyncMock, patch
from backend.llm import LLMResponse


async def test_generate_analysis_report_returns_string():
    mock_response = LLMResponse(content="## Analysis\n\nThis is the report.", tool_name=None, tool_args=None)
    with patch("backend.reporter.llm") as mock_llm:
        mock_llm.complete = AsyncMock(return_value=mock_response)
        from backend.reporter import generate_analysis_report
        result = await generate_analysis_report(
            raw_items=[],
            domain="tech",
            input_text="A SaaS app",
            language="English",
            provider="openai",
        )
    assert isinstance(result, str)
    assert len(result) > 0
```

- [ ] **Step 2: Run to verify failure**

```bash
python -m pytest tests/test_reporter.py -v
```
Expected: FAIL.

- [ ] **Step 3: Rewrite reporter.py**

- Remove `_MODELS`, `_client`, `_get_client()` singleton
- Remove the model fallback loop
- Add `from backend import llm`
- `generate_analysis_report(raw_items, domain, input_text, language, provider: str = "openai") -> str`
- Single call: `response = await llm.complete(messages=[...], tier="high", provider=provider, max_tokens=8192)`
- Return `response.content or ""`

- [ ] **Step 4: Run test**

```bash
python -m pytest tests/test_reporter.py -v
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/reporter.py tests/test_reporter.py
git commit -m "refactor: migrate reporter.py to llm.complete()"
```

---

## Task 10: Migrate persona_generator.py

**Files:**
- Modify: `backend/simulation/persona_generator.py`

Remove `_client`, `_get_client()`, `_parse_tool_arguments()`, `import openai`, `_api_sem` import. Add `provider: str` param to `generate_persona()`. Use `tool_choice="create_persona"`. Re-raise `LLMToolRequired` before broad except.

- [ ] **Step 1: Write test**

Create `tests/test_persona_generator.py`:
```python
from unittest.mock import AsyncMock, patch
from backend.llm import LLMResponse
from backend.simulation.models import Persona


async def test_generate_persona_returns_persona():
    tool_args = {
        "name": "Alice Chen", "role": "Software Engineer", "age": 28,
        "generation": "Millennial", "seniority": "mid", "affiliation": "employee",
        "company": "TechCorp", "mbti": "INTJ", "bias": "tech_optimist",
        "interests": ["AI", "SaaS"], "skepticism": 3, "commercial_focus": 5,
        "innovation_openness": 8,
    }
    mock_response = LLMResponse(content=None, tool_name="create_persona", tool_args=tool_args)
    with patch("backend.simulation.persona_generator.llm") as mock_llm:
        mock_llm.complete = AsyncMock(return_value=mock_response)
        from backend.simulation.persona_generator import generate_persona
        node = {"id": "node1", "title": "AI SaaS", "source": "arxiv", "abstract": "..."}
        persona = await generate_persona(node, idea_text="AI SaaS", platform_name="hackernews", provider="openai")
    assert isinstance(persona, Persona)
    assert persona.name == "Alice Chen"
```

- [ ] **Step 2: Run to verify failure**

```bash
python -m pytest tests/test_persona_generator.py -v
```
Expected: FAIL.

- [ ] **Step 3: Rewrite persona_generator.py**

- Remove `import openai`, `_client`, `_get_client()`, `_parse_tool_arguments()`
- Remove `from backend.simulation.rate_limiter import api_sem as _api_sem`
- Add `from backend import llm`
- In `generate_persona(node, idea_text, ..., provider: str = "openai")`:
  ```python
  try:
      from backend.llm import LLMToolRequired
      response = await llm.complete(
          messages=[...],
          tier="mid",
          provider=provider,
          max_tokens=1024,
          tools=[_PERSONA_TOOL],  # already in OpenAI format
          tool_choice="create_persona",
      )
      data = response.tool_args
  except LLMToolRequired:
      raise
  except Exception as exc:
      logger.warning("generate_persona failed: %s", exc)
      return _fallback_persona(node, platform_name)
  ```
  Use `data` directly (already a dict, no json.loads needed).

Note: `_PERSONA_TOOL` is already in OpenAI format in persona_generator.py — verify this and leave as-is.

- [ ] **Step 4: Run test**

```bash
python -m pytest tests/test_persona_generator.py -v
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/simulation/persona_generator.py tests/test_persona_generator.py
git commit -m "refactor: migrate persona_generator.py to llm.complete()"
```

---

## Task 11: Migrate social_rounds.py

**Files:**
- Modify: `backend/simulation/social_rounds.py`

This is the largest change. Remove `_create_message()`, `_client`, `_get_client()`, `_parse_tool_arguments()`, `_api_sem` import, `import openai`. Keep `_to_openai_tool()`. Add `provider: str` to all 5 functions. Replace `_create_message(...)` calls with `await llm.complete(...)`.

- [ ] **Step 1: Write tests for generate_seed_post**

Create `tests/test_social_rounds.py`:
```python
from unittest.mock import AsyncMock, patch, MagicMock
from backend.llm import LLMResponse


async def test_generate_seed_post_with_provider():
    tool_args = {"title": "Test Product", "text": "A great SaaS app", "url": "https://example.com", "tags": ["saas"]}
    mock_response = LLMResponse(content=None, tool_name="create_hn_post", tool_args=tool_args)

    with patch("backend.simulation.social_rounds.llm") as mock_llm:
        mock_llm.complete = AsyncMock(return_value=mock_response)
        from backend.simulation.social_rounds import generate_seed_post
        from backend.simulation.platforms.hackernews import HackerNews
        platform = HackerNews()
        post = await generate_seed_post(platform, "A great SaaS app", "English", provider="openai")
    assert post.platform == "hackernews"
    assert post.author_node_id == "__seed__"


async def test_decide_action_with_provider():
    from backend.simulation.models import Persona
    from backend.simulation.platforms.hackernews import HackerNews

    tool_args = {"action_type": "post", "target_post_id": None}
    mock_response = LLMResponse(content=None, tool_name="decide_action", tool_args=tool_args)

    with patch("backend.simulation.social_rounds.llm") as mock_llm:
        mock_llm.complete = AsyncMock(return_value=mock_response)
        from backend.simulation.social_rounds import decide_action
        persona = Persona(
            node_id="n1", name="Alice", role="engineer", age=30, generation="Millennial",
            seniority="mid", affiliation="employee", company="Corp", mbti="INTJ",
            bias="tech_optimist", interests=["AI"], skepticism=3,
            commercial_focus=5, innovation_openness=7,
        )
        action = await decide_action(persona, HackerNews(), "feed text", "English", provider="openai")
    assert action.action_type == "post"
```

- [ ] **Step 2: Run to verify failure**

```bash
python -m pytest tests/test_social_rounds.py -v
```
Expected: FAIL.

- [ ] **Step 3: Rewrite social_rounds.py**

- Remove `import openai`, `_client`, `_get_client()`, `_parse_tool_arguments()`, `_create_message()`
- Remove `from backend.simulation.rate_limiter import api_sem as _api_sem`
- Add `from backend import llm` and `from backend.llm import LLMToolRequired`
- Keep `_to_openai_tool()` as-is

For each function, replace `await _create_message(model=..., max_tokens=..., messages=[...], tools=[...], tool_choice={...})` with:
```python
response = await llm.complete(
    messages=[...],
    tier=<tier>,
    provider=provider,
    max_tokens=<max_tokens>,
    tools=[<tool>],  # in OpenAI format (use _to_openai_tool() for platform tools)
    tool_choice=<tool_name_str>,
)
```

Then use `response.tool_args` directly instead of `_parse_tool_arguments(msg.choices[0].message, expected_name=...)`.

Re-raise `LLMToolRequired` before broad except blocks in each function.

Tier and tool_choice mapping per function:
- `generate_seed_post`: `tier="mid"`, `tool_choice=_to_openai_tool(platform.seed_tool())["function"]["name"]` (dynamic, e.g. `"create_hn_post"`)
- `decide_action`: `tier="low"`, `tool_choice="decide_action"` (hardcoded — `_DECIDE_ACTION_TOOL["function"]["name"]` is `"decide_action"`)
- `generate_content`: `tier="low"`, `tool_choice=_to_openai_tool(platform.content_tool(action.action_type))["function"]["name"]` (dynamic, usually `"create_content"`)
- `generate_report`: `tier="high"`, `tool_choice="create_report"`, `timeout=300.0`

For `generate_report`, the inline client creation is removed; use `llm.complete()`.

Function signatures (add `provider: str = "openai"` to each):
- `generate_seed_post(platform, idea_text, language="English", provider="openai")`
- `decide_action(persona, platform, feed_text, language="English", provider="openai")`
- `generate_content(persona, action, platform, feed_text, idea_text, language="English", provider="openai")`
- `generate_report(platform_states, idea_text, domain, language, provider="openai")`
- `round_personas(nodes, idea_text, concurrency=4, adjacency=None, id_to_node=None, platform_name="", provider="openai")` — passes `provider` to `generate_persona()`
- `platform_round(platform, state, personas, degree, idea_text, round_num, language="English", activation_rate=0.25, provider="openai")` — passes `provider` to `decide_action()` and `generate_content()`

- [ ] **Step 4: Run tests**

```bash
python -m pytest tests/test_social_rounds.py -v
```
Expected: PASS.

- [ ] **Step 5: Run full test suite**

```bash
python -m pytest tests/ -v
```
Expected: all pass (fix any breakage from removing `_api_sem` references).

- [ ] **Step 6: Commit**

```bash
git add backend/simulation/social_rounds.py tests/test_social_rounds.py
git commit -m "refactor: migrate social_rounds.py to llm.complete()"
```

---

## Task 12: Update social_runner.py and tasks.py

**Files:**
- Modify: `backend/simulation/social_runner.py`
- Modify: `backend/tasks.py`

- [ ] **Step 1: Update social_runner.py**

In `backend/simulation/social_runner.py`, update `run_simulation` signature:
```python
async def run_simulation(
    input_text: str,
    context_nodes: list[dict],
    domain: str,
    max_agents: int = 50,
    num_rounds: int = 12,
    platforms: list[str] | None = None,
    language: str = "English",
    edges: list[dict] | None = None,
    activation_rate: float = 0.25,
    provider: str = "openai",   # ← add this
) -> AsyncGenerator[dict, None]:
```

Thread `provider` to all call sites (closures capture it from outer scope automatically):
- `round_personas(..., provider=provider)` in `collect_personas_for_platform`
- `generate_seed_post(..., provider=provider)` in seed_tasks
- `platform_round(..., provider=provider)` in `run_platform_round`
- `generate_report(..., provider=provider)` in final report block

- [ ] **Step 2: Update tasks.py**

In `backend/tasks.py`, inside `_run()`:

After `mark_simulation_started()` succeeds, add:
```python
provider = config.get("provider", "openai")
from backend import llm as _llm
try:
    _llm.check_provider_key(provider)
except ValueError as e:
    publish({"type": "sim_error", "message": str(e)})
    return
```

Thread `provider` to all calls:
- `analyze(config["input_text"], ..., provider=provider)` — if `analyze()` accepts it (check below)
- `detect_domain(config["input_text"], provider=provider)`
- `generate_analysis_report(..., provider=provider)`
- `run_simulation(..., provider=provider)`

Note: `analyze()` in `analyzer.py` calls `extract_concepts()` which now needs `provider`. Check `analyzer.py` and add `provider` param if needed (see Task 13).

- [ ] **Step 3: Run existing tests**

```bash
python -m pytest tests/ -v
```
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add backend/simulation/social_runner.py backend/tasks.py
git commit -m "refactor: thread provider param through social_runner and tasks"
```

---

## Task 13: Update analyzer.py (if needed)

**Files:**
- Modify: `backend/analyzer.py` (if it calls extract_concepts)

- [ ] **Step 1: Check if analyzer.py calls extract_concepts**

```bash
grep -n "extract_concepts\|from backend.extractor" backend/analyzer.py
```

- [ ] **Step 2: If it does, add provider param**

Add `provider: str = "openai"` to `analyze()` signature and thread it to `extract_concepts(..., provider=provider)`.

- [ ] **Step 3: Update tasks.py call to analyze()**

```python
raw_items = await analyze(
    config["input_text"],
    limits=config.get("source_limits") or None,
    on_source_done=on_source_done,
    provider=provider,
)
```

- [ ] **Step 4: Run tests**

```bash
python -m pytest tests/ -v
```
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add backend/analyzer.py backend/tasks.py
git commit -m "refactor: thread provider through analyzer.py"
```

---

## Task 14: Frontend — Provider type and SimConfig

**Files:**
- Modify: `frontend/src/types.ts`

- [ ] **Step 1: Add Provider type and update SimConfig**

In `frontend/src/types.ts`, add after the `Platform` type:
```ts
export type Provider = 'openai' | 'anthropic' | 'gemini'
```

In `SimConfig`, add:
```ts
  provider: Provider
```

In `HistoryItem`, update the config type to handle old records:
```ts
  config: Omit<SimConfig, 'provider'> & { provider?: Provider }
```

- [ ] **Step 2: Fix any TypeScript errors**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```

Fix any errors that reference `provider` (e.g., in `HomePage.tsx` `DEFAULT_CONFIG` missing `provider`).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types.ts
git commit -m "feat: add Provider type to frontend types"
```

---

## Task 15: Frontend — Provider selector UI

**Files:**
- Modify: `frontend/src/pages/HomePage.tsx`

- [ ] **Step 1: Add PROVIDER_OPTIONS and provider state**

In `frontend/src/pages/HomePage.tsx`:

After the `LANGUAGE_OPTIONS` const, add:
```ts
const PROVIDER_OPTIONS: Array<{ id: Provider; label: string; icon: string; description: string }> = [
  { id: 'openai',    label: 'GPT',    icon: '🟢', description: 'OpenAI GPT-5.4 family' },
  { id: 'anthropic', label: 'Claude', icon: '🟠', description: 'Anthropic Claude family' },
  { id: 'gemini',    label: 'Gemini', icon: '🔵', description: 'Google Gemini family' },
]
```

In `DEFAULT_CONFIG`, add `provider: 'openai' as Provider`.

Add `provider` to the type import: `import type { Platform, Provider, SimConfig } from '../types'`.

- [ ] **Step 2: Add provider selector JSX**

In the `return` of `HomePage`, add a provider selector section **between the platform buttons and the "Advanced options" toggle**:

```tsx
{/* Provider */}
<div style={{ marginTop: 20, animation: 'fadeInUp 0.52s ease both' }}>
  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: 10 }}>
    AI Provider
  </div>
  <div style={{ display: 'flex', gap: 8 }}>
    {PROVIDER_OPTIONS.map(p => {
      const active = config.provider === p.id
      return (
        <button
          key={p.id}
          onClick={() => setConfig(c => ({ ...c, provider: p.id }))}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
            padding: '10px 16px', fontSize: 13, borderRadius: 10, cursor: 'pointer',
            border: '1.5px solid',
            background: active ? '#1e293b' : '#fff',
            color: active ? '#fff' : '#475569',
            borderColor: active ? '#1e293b' : '#e2e8f0',
            fontWeight: active ? 600 : 400,
            boxShadow: active ? '0 2px 8px rgba(30,41,59,0.25)' : 'none',
            minWidth: 100,
            transition: 'all 0.15s',
          }}
        >
          <span style={{ fontSize: 18, marginBottom: 4 }}>{p.icon}</span>
          <span style={{ fontWeight: 700 }}>{p.label}</span>
          <span style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{p.description}</span>
        </button>
      )
    })}
  </div>
</div>
```

- [ ] **Step 3: Pass provider in handleRun**

`handleRun` already passes all of `config` to `startSimulation`. Since `provider` is now in `config`, it will be included automatically. Verify `startSimulation` in `api.ts` passes the full config — no changes needed.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/HomePage.tsx
git commit -m "feat: add provider selector UI to home page"
```

---

## Task 16: Smoke test and Docker rebuild

- [ ] **Step 1: Run full test suite**

```bash
cd /Users/taeyoungpark/Desktop/noosphere && python -m pytest tests/ -v
```
Expected: all tests pass.

- [ ] **Step 2: Verify no remaining direct SDK imports in migrated files**

```bash
grep -rn "^import openai\|^import anthropic" backend/extractor.py backend/context_builder.py backend/reporter.py backend/simulation/persona_generator.py backend/simulation/social_rounds.py
```
Expected: no output (all removed).

- [ ] **Step 3: Verify _create_message is gone**

```bash
grep -n "_create_message\|_get_client\|_api_sem" backend/simulation/social_rounds.py backend/simulation/persona_generator.py
```
Expected: no output.

- [ ] **Step 4: Add ANTHROPIC_API_KEY and GEMINI_API_KEY to .env**

The user must add these keys to their local `.env` file. Remind them.

- [ ] **Step 5: Rebuild and restart Docker**

```bash
docker compose build && docker compose up -d
```

- [ ] **Step 6: Manual smoke test**

Open the app at http://localhost:5173. Verify:
- 3 provider buttons appear on the home page
- Selecting "Claude" is reflected in the UI
- Starting a simulation with GPT selected works (requires `OPENAI_API_KEY`)

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "feat: multi-provider LLM support (GPT, Claude, Gemini)"
```
