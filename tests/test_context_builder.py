from unittest.mock import AsyncMock, patch
from backend.llm import LLMResponse

import pytest


@pytest.mark.asyncio
async def test_detect_domain_returns_trimmed_single_line_string():
    mock_response = LLMResponse(
        content='"developer tools"\nextra explanation',
        tool_name=None,
        tool_args=None,
    )
    with patch("backend.context_builder.llm") as mock_llm:
        mock_llm.complete = AsyncMock(return_value=mock_response)
        from backend.context_builder import detect_domain

        result = await detect_domain("A SaaS app for task management", provider="openai")

    assert result == "developer tools"


@pytest.mark.asyncio
async def test_detect_domain_falls_back_to_technology_on_error():
    with patch("backend.context_builder.llm") as mock_llm:
        mock_llm.complete = AsyncMock(side_effect=RuntimeError("boom"))
        from backend.context_builder import detect_domain

        result = await detect_domain("A SaaS app for task management", provider="openai")

    assert result == "technology"
