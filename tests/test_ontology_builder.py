from backend.ontology_builder import ontology_for_persona


SAMPLE_ONTOLOGY = {
    "domain_summary": "AI application development tooling",
    "entities": [
        {"id": "e0", "name": "LangChain", "type": "framework", "source_node_ids": ["n1"]},
        {"id": "e1", "name": "Pinecone", "type": "infrastructure", "source_node_ids": []},
        {"id": "e2", "name": "RAG", "type": "technology", "source_node_ids": []},
    ],
    "relationships": [
        {"from": "e0", "to": "e1", "type": "integrates_with"},
        {"from": "e0", "to": "e2", "type": "competes_with"},
    ],
    "market_tensions": ["open-source vs managed"],
    "key_trends": ["LLM adoption"],
}


def test_ontology_for_persona_under_400_chars():
    result = ontology_for_persona(SAMPLE_ONTOLOGY)

    assert len(result) <= 400
    assert "AI application development tooling" in result
    assert "LangChain" in result
    assert "open-source vs managed" in result


def test_ontology_for_persona_handles_malformed_payload():
    result = ontology_for_persona({
        "domain_summary": None,
        "entities": ["not-a-dict", {"name": "Cursor"}],
        "market_tensions": "not-a-list",
    })

    assert result == "Domain: \nKey players: Cursor ()"
