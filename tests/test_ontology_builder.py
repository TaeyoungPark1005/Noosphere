import pytest
from backend.ontology_builder import (
    _assign_ids,
    _assign_source_node_ids,
    ontology_for_persona,
    ontology_for_action,
    ontology_for_content,
)

SAMPLE_ENTITIES_RAW = [
    {"name": "LangChain", "type": "framework"},
    {"name": "Pinecone", "type": "infrastructure"},
    {"name": "RAG", "type": "technology"},
]

SAMPLE_RELS = [
    {"from": "e0", "to": "e1", "type": "integrates_with"},
    {"from": "e0", "to": "e2", "type": "competes_with"},
]

SAMPLE_ONTOLOGY = {
    "domain_summary": "AI application development tooling",
    "entities": [
        {"id": "e0", "name": "LangChain", "type": "framework", "source_node_ids": ["n1"]},
        {"id": "e1", "name": "Pinecone", "type": "infrastructure", "source_node_ids": []},
        {"id": "e2", "name": "RAG", "type": "technology", "source_node_ids": []},
    ],
    "relationships": SAMPLE_RELS,
    "market_tensions": ["open-source vs managed"],
    "key_trends": ["LLM adoption"],
}


def test_assign_ids():
    entities = _assign_ids(SAMPLE_ENTITIES_RAW)
    assert entities[0]["id"] == "e0"
    assert entities[1]["id"] == "e1"
    assert entities[2]["id"] == "e2"
    # LLM-provided IDs should not be present in raw input
    assert "id" not in SAMPLE_ENTITIES_RAW[0]


def test_assign_source_node_ids_case_insensitive():
    context_nodes = [
        {"id": "n1", "title": "LangChain Python library", "source": "github", "abstract": "..."},
        {"id": "n2", "title": "Pinecone vector DB", "source": "hackernews", "abstract": "..."},
    ]
    entities = _assign_ids(SAMPLE_ENTITIES_RAW)
    entities = _assign_source_node_ids(entities, context_nodes)
    assert "n1" in entities[0]["source_node_ids"]  # LangChain matches
    assert "n2" in entities[1]["source_node_ids"]  # Pinecone matches
    assert entities[2]["source_node_ids"] == []     # RAG no match


def test_ontology_for_persona_under_400_chars():
    result = ontology_for_persona(SAMPLE_ONTOLOGY)
    assert len(result) <= 400
    assert "AI application development tooling" in result
    assert "LangChain" in result
    assert "open-source vs managed" in result


def test_ontology_for_action_under_200_chars():
    result = ontology_for_action(SAMPLE_ONTOLOGY)
    assert len(result) <= 200
    assert "AI application development tooling" in result


def test_ontology_for_content_under_600_chars():
    result = ontology_for_content(SAMPLE_ONTOLOGY)
    assert len(result) <= 600
    assert "LangChain" in result
    assert "integrates_with" in result or "Pinecone" in result


import pytest
from unittest.mock import AsyncMock, patch


@pytest.mark.asyncio
async def test_build_ontology_returns_dict_on_valid_response():
    """build_ontology returns a dict with expected keys on valid LLM response."""
    from backend.ontology_builder import build_ontology
    from backend.llm import LLMResponse

    fake_json = '{"domain_summary": "AI tooling", "entities": [{"name": "LangChain", "type": "framework"}], "relationships": [], "market_tensions": ["cost vs quality"], "key_trends": ["LLM adoption"]}'
    mock_response = LLMResponse(content=fake_json, tool_name=None, tool_args=None)

    with patch("backend.ontology_builder.llm") as mock_llm:
        mock_llm.complete = AsyncMock(return_value=mock_response)
        result = await build_ontology(
            context_nodes=[{"id": "n1", "title": "LangChain Python library", "source": "github", "abstract": "..."}],
            input_text="RAG app",
            provider="openai",
        )

    assert result is not None
    assert result["domain_summary"] == "AI tooling"
    assert len(result["entities"]) == 1
    assert result["entities"][0]["id"] == "e0"
    assert "n1" in result["entities"][0]["source_node_ids"]


@pytest.mark.asyncio
async def test_build_ontology_returns_none_on_malformed_json():
    """build_ontology returns None when LLM response is not valid JSON."""
    from backend.ontology_builder import build_ontology
    from backend.llm import LLMResponse

    mock_response = LLMResponse(content="not json at all {{{", tool_name=None, tool_args=None)

    with patch("backend.ontology_builder.llm") as mock_llm:
        mock_llm.complete = AsyncMock(return_value=mock_response)
        result = await build_ontology(
            context_nodes=[],
            input_text="test",
            provider="openai",
        )

    assert result is None


@pytest.mark.asyncio
async def test_build_ontology_returns_none_when_parsed_is_not_dict():
    """build_ontology returns None when LLM returns a JSON array instead of object."""
    from backend.ontology_builder import build_ontology
    from backend.llm import LLMResponse

    mock_response = LLMResponse(content='[{"name": "oops"}]', tool_name=None, tool_args=None)

    with patch("backend.ontology_builder.llm") as mock_llm:
        mock_llm.complete = AsyncMock(return_value=mock_response)
        result = await build_ontology(
            context_nodes=[],
            input_text="test",
            provider="openai",
        )

    assert result is None


@pytest.mark.asyncio
async def test_build_ontology_resolves_relationship_names_to_ids():
    """build_ontology correctly resolves from_name/to_name to entity IDs."""
    from backend.ontology_builder import build_ontology
    from backend.llm import LLMResponse

    fake_json = '''{
        "domain_summary": "test",
        "entities": [{"name": "Alpha", "type": "framework"}, {"name": "Beta", "type": "product"}],
        "relationships": [{"from_name": "Alpha", "to_name": "Beta", "type": "competes_with"}],
        "market_tensions": [],
        "key_trends": []
    }'''
    mock_response = LLMResponse(content=fake_json, tool_name=None, tool_args=None)

    with patch("backend.ontology_builder.llm") as mock_llm:
        mock_llm.complete = AsyncMock(return_value=mock_response)
        result = await build_ontology(context_nodes=[], input_text="test", provider="openai")

    assert result is not None
    assert len(result["relationships"]) == 1
    assert result["relationships"][0]["from"] == "e0"
    assert result["relationships"][0]["to"] == "e1"
    assert result["relationships"][0]["type"] == "competes_with"
