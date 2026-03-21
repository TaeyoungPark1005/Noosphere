# Ontology Injection + UI Graph Visualization Design

**Date:** 2026-03-21
**Scope:** Shared ontology generation from collected knowledge nodes, injection into all simulation agents, and interactive graph visualization in the UI.

---

## Problem

Currently, each simulation agent only knows about its own assigned context node plus adjacent node titles. The full set of collected knowledge (up to 30 nodes from HN, GitHub, arxiv, etc.) is never shared with agents. This means agents evaluate ideas without awareness of the broader ecosystem — competitors, enabling technologies, known pain points, or market tensions.

---

## Solution Overview

1. **Ontology generation** — one LLM call before simulation starts, converting all context_nodes into a structured knowledge graph (entities + relationships).
2. **Agent injection** — every agent receives a sliced view of this ontology relevant to their task (persona generation, idea reaction, content generation).
3. **UI graph visualization** — the ontology is streamed to the frontend and rendered as an interactive force-directed graph.

---

## Section 1: Backend — Ontology Generation

### New module: `backend/ontology_builder.py`

Called in `tasks.py` after `context_nodes` are built, before `run_simulation()`.

**Input:** `list[dict]` — context_nodes with `id`, `title`, `source`, `abstract`
**Output:** ontology dict

**Output schema:**

```json
{
  "domain_summary": "One sentence describing the domain landscape",
  "entities": [
    {"id": "e1", "name": "LangChain", "type": "framework"},
    {"id": "e2", "name": "Pinecone", "type": "infrastructure"}
  ],
  "relationships": [
    {"from": "e1", "to": "e2", "type": "integrates_with"},
    {"from": "e1", "to": "e3", "type": "competes_with"}
  ],
  "market_tensions": ["open-source vs managed", "cost vs quality"],
  "key_trends": ["LLM adoption rate", "enterprise readiness concerns"]
}
```

**Entity types (10):**
`framework`, `product`, `company`, `technology`, `concept`, `market_segment`, `pain_point`, `research`, `standard`, `regulation`

**Relationship types:**
`competes_with`, `integrates_with`, `built_on`, `targets`, `addresses`, `enables`, `regulated_by`, `part_of`

### Data flow

```
tasks.py
  └─ raw_items → context_nodes (existing)
  └─ build_ontology(context_nodes, input_text, provider) → ontology  ← new
  └─ publish({"type": "sim_ontology", "data": ontology})             ← new
  └─ run_simulation(..., ontology=ontology)                           ← new param
```

---

## Section 2: Agent Injection

Ontology is sliced into three views to avoid token waste. Each view is a compact string injected at the relevant call site.

### Slice functions (in `ontology_builder.py`)

```python
def ontology_for_persona(ontology: dict) -> str:
    # domain_summary + entity name list + market_tensions

def ontology_for_react(ontology: dict) -> str:
    # pain_point entities + competes_with/addresses relationships + key_trends

def ontology_for_content(ontology: dict) -> str:
    # entity name list + relationship summary (one line per rel)
```

### Injection sites

**1. `persona_generator.py:generate_persona()`**
Gives the persona generation LLM context about the ecosystem the persona operates in.

```
Ecosystem context:
- Domain: {domain_summary}
- Key players: LangChain (framework), Pinecone (infrastructure), ...
- Market tensions: open-source vs managed, cost vs quality
```

**2. `agent.py:react()`**
Enables agents to score the idea relative to existing alternatives and known pain points.

```
Ecosystem context:
- Competing solutions: LlamaIndex (framework), Weaviate (infrastructure)
- Known pain points this space addresses: high inference cost, hallucination
- Current trends: LLM adoption rate, enterprise readiness concerns
```

**3. `social_rounds.py:generate_content()`**
Makes posts and comments reference real ecosystem terminology and players rather than generic phrases.

```
Ecosystem context:
- Key players: {entity name list}
- Relationships: LangChain competes with LlamaIndex, RAG enables chatbot products
```

### Call chain changes

`run_simulation()` receives `ontology` and passes it to:
- `round_personas()` → `generate_persona()`
- `platform_round()` → `generate_content()` and (via agent.py) `react()`

---

## Section 3: UI Graph Visualization

### Library: `react-force-graph-2d`

D3-based, React-friendly, interactive node/edge support. Lightweight, no heavy dependencies.

### Display location

During simulation — below the `sim_analysis` section, above the simulation round feed. A collapsible panel titled "Ecosystem Map".

### Streaming event

```json
{
  "type": "sim_ontology",
  "data": {
    "entities": [...],
    "relationships": [...],
    "domain_summary": "..."
  }
}
```

Frontend receives this event and renders the graph. Published before `sim_start`.

### Visual encoding

**Node colors by type:**

| Type | Color |
|------|-------|
| framework | Blue |
| product | Green |
| company | Orange |
| technology | Purple |
| market_segment | Yellow |
| pain_point | Red |
| research | Teal |
| standard | Gray |
| concept | Lavender |
| regulation | Brown |

**Edge styles by relationship:**

| Relationship | Style |
|-------------|-------|
| competes_with | Red dashed |
| integrates_with | Green solid |
| built_on | Blue solid |
| targets | Orange arrow |
| addresses | Teal arrow |
| enables | Purple arrow |

### Interactions

- Node hover → tooltip (name + type)
- Node click → side panel with entity detail + source node link
- Drag to reposition nodes
- Legend toggle (show/hide by type)

---

## What's Out of Scope

- Agent-to-agent influence relationships — separate feature, to be designed independently after this is shipped.
- Zep integration — not needed at Noosphere's scale (max 30 nodes).
- Dynamic ontology updates during simulation rounds — ontology is fixed at simulation start.

---

## Files to Create / Modify

**Create:**
- `backend/ontology_builder.py` — ontology generation + slice functions

**Modify:**
- `backend/tasks.py` — call `build_ontology()`, publish `sim_ontology` event, pass to `run_simulation()`
- `backend/simulation/social_runner.py` — accept and forward `ontology` param
- `backend/simulation/social_rounds.py` — accept and forward `ontology` to agents
- `backend/simulation/persona_generator.py` — accept and inject `ontology_for_persona()`
- `backend/simulation/agent.py` — accept and inject `ontology_for_react()`
- `frontend/src/pages/DemoPage.tsx` — handle `sim_ontology` event, store ontology state
- `frontend/src/components/OntologyGraph.tsx` — new force-graph component (create)
