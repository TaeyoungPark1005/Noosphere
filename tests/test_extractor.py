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
        from backend.extractor import extract_concepts
        result = await extract_concepts("A SaaS productivity app", provider="openai")
    assert "concepts" in result
    assert isinstance(result["concepts"], list)
