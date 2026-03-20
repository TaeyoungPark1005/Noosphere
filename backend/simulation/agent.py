# backend/simulation/agent.py
from __future__ import annotations
import json
import logging
import os
import re
import anthropic
from backend.simulation.models import Persona
from backend.simulation.graph_utils import sanitize_neighbor_titles

logger = logging.getLogger(__name__)

_client: anthropic.AsyncAnthropic | None = None


def _get_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        api_key = os.environ.get("ANTHROPIC_API_KEY", "")
        if not api_key:
            raise RuntimeError(
                "ANTHROPIC_API_KEY environment variable is not set."
            )
        _client = anthropic.AsyncAnthropic(api_key=api_key, timeout=30.0)
    return _client

_SYSTEM = """\
You are roleplaying as a specific professional persona evaluating a new idea.
Stay strictly in character. Respond ONLY with valid JSON:
{ "score": <float from -1.0 to 1.0>, "text": "<one sentence reaction>" }"""

async def react(
    persona: Persona,
    idea_text: str,
    language: str = "English",
    neighbor_titles: list[str] | None = None,
) -> tuple[float, str]:
    # Normalise interests to list in case Persona was constructed with a raw string
    interests = persona.interests
    if isinstance(interests, str):
        interests = [t.strip() for t in interests.split(",") if t.strip()] or ["general"]
    prompt = (
        f"You are {persona.name}, {persona.role} (MBTI: {persona.mbti}).\n"
        f"Your interests: {', '.join(interests)}.\n"
        f"Your general stance: {persona.bias}.\n\n"
        f"Idea to evaluate:\n{idea_text}\n\n"
    )
    sanitized_neighbors = sanitize_neighbor_titles(neighbor_titles)
    if sanitized_neighbors:
        neighbor_str = ", ".join(sanitized_neighbors)
        prompt += f"Related technologies in this space: {neighbor_str}\n\n"
    prompt += (
        f"React in one sentence and give a score from -1.0 (very negative) to 1.0 (very positive).\n"
        f"Your reaction text must be written in {language}."
    )

    try:
        message = await _get_client().messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=8192,
            system=_SYSTEM,
            messages=[{"role": "user", "content": prompt}],
        )

        if not message.content:
            raise ValueError("Empty response from API")
        raw = message.content[0].text.strip()
        raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw, flags=re.DOTALL).strip()
        try:
            data = json.loads(raw)
        except json.JSONDecodeError as e:
            raise ValueError(f"Agent reaction returned invalid JSON: {e}")

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
