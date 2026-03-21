import pytest
from unittest.mock import AsyncMock, patch
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

    platform = HackerNews()
    persona = Persona(
        node_id="n1", name="Alice", role="engineer", age=30,
        seniority="mid", affiliation="individual", company="Corp", mbti="INTJ",
        interests=["AI"], skepticism=3, commercial_focus=5, innovation_openness=7,
        source_title="AI SaaS",
    )
    allowed = platform.get_allowed_actions(persona)
    tool_args = {"action_type": allowed[0], "target_post_id": None}
    mock_response = LLMResponse(content=None, tool_name="decide_action", tool_args=tool_args)

    with patch("backend.simulation.social_rounds.llm") as mock_llm:
        mock_llm.complete = AsyncMock(return_value=mock_response)
        from backend.simulation.social_rounds import decide_action
        action = await decide_action(persona, platform, "feed text", "English", provider="openai")
    assert action.action_type == allowed[0]


FAKE_ONTOLOGY = {
    "domain_summary": "SaaS tools",
    "entities": [{"id": "e0", "name": "SaaS", "type": "concept", "source_node_ids": []}],
    "relationships": [],
    "market_tensions": ["build vs buy"],
    "key_trends": [],
}

@pytest.mark.asyncio
async def test_decide_action_accepts_ontology():
    """decide_action should accept ontology kwarg."""
    import inspect
    from backend.simulation.social_rounds import decide_action
    sig = inspect.signature(decide_action)
    assert 'ontology' in sig.parameters

@pytest.mark.asyncio
async def test_generate_content_accepts_ontology():
    """generate_content should accept ontology kwarg."""
    import inspect
    from backend.simulation.social_rounds import generate_content
    sig = inspect.signature(generate_content)
    assert 'ontology' in sig.parameters
