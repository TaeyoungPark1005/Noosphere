# backend/simulation/agent.py
from __future__ import annotations
import logging
from backend import llm
from backend.simulation.models import Persona
from backend.simulation.graph_utils import sanitize_neighbor_titles

logger = logging.getLogger(__name__)

_SYSTEM = "You are roleplaying as a specific professional persona evaluating a new idea. Stay strictly in character."

_REACT_TOOL = {
    "type": "function",
    "function": {
        "name": "react_to_idea",
        "description": "React to the idea as this persona, providing a score and one-sentence reaction.",
        "parameters": {
            "type": "object",
            "properties": {
                "score": {
                    "type": "number",
                    "description": "Score from -1.0 (very negative) to 1.0 (very positive)",
                    "minimum": -1.0,
                    "maximum": 1.0,
                },
                "text": {
                    "type": "string",
                    "description": "One sentence reaction written in the specified language",
                },
            },
            "required": ["score", "text"],
        },
    },
}


async def react(
    persona: Persona,
    idea_text: str,
    language: str = "English",
    neighbor_titles: list[str] | None = None,
    provider: str = "openai",
) -> tuple[float, str]:
    interests = persona.interests
    if isinstance(interests, str):
        interests = [t.strip() for t in interests.split(",") if t.strip()] or ["general"]

    prompt = (
        f"You are {persona.name}, {persona.role} at {persona.company}.\n"
        f"Age: {persona.age} ({persona.generation}) | Seniority: {persona.seniority} | Affiliation: {persona.affiliation}\n"
        f"MBTI: {persona.mbti}\n"
        f"Interests: {', '.join(interests)}\n"
        f"Bias profile: {persona.bias_description()}\n\n"
        f"Idea to evaluate:\n{idea_text}\n\n"
    )
    sanitized_neighbors = sanitize_neighbor_titles(neighbor_titles)
    if sanitized_neighbors:
        neighbor_str = ", ".join(sanitized_neighbors)
        prompt += f"Related technologies in this space: {neighbor_str}\n\n"
    prompt += f"React in one sentence and give a score from -1.0 to 1.0. Your reaction text must be written in {language}."

    try:
        response = await llm.complete(
            messages=[
                {"role": "system", "content": _SYSTEM},
                {"role": "user", "content": prompt},
            ],
            tier="low",
            provider=provider,
            max_tokens=512,
            tools=[_REACT_TOOL],
            tool_choice="react_to_idea",
        )

        data: dict = response.tool_args or {}
        raw_score = data.get("score", 0.0)
        if raw_score is None:
            raw_score = 0.0
        try:
            score = max(-1.0, min(1.0, float(raw_score)))
        except (TypeError, ValueError):
            score = 0.0
        text = str(data.get("text", "") or "")
        return score, text
    except Exception as exc:
        logger.warning("react() failed for persona %s: %s", persona.node_id, exc)
        raise
