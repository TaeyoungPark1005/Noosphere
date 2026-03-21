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
    if provider == "anthropic":
        return await _complete_anthropic(messages, model, max_tokens, timeout, tools, tool_choice)
    if provider == "gemini":
        return await _complete_gemini(messages, model, max_tokens, timeout, tools, tool_choice)
    raise ValueError(f"Unknown provider: {provider!r}")


async def _complete_openai(messages, model, max_tokens, timeout, tools, tool_choice):
    raise NotImplementedError("OpenAI provider not yet implemented")


async def _complete_anthropic(messages, model, max_tokens, timeout, tools, tool_choice):
    raise NotImplementedError("Anthropic provider not yet implemented")


async def _complete_gemini(messages, model, max_tokens, timeout, tools, tool_choice):
    raise NotImplementedError("Gemini provider not yet implemented")
