# backend/simulation/persona_generator.py
from __future__ import annotations
import json
import logging
import os
import re
import anthropic
from backend.simulation.models import Persona
from backend.simulation.graph_utils import sanitize_neighbor_titles
from backend.simulation.rate_limiter import api_sem as _api_sem

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

_BIAS_BY_SOURCE = {
    "arxiv": "academic", "s2": "academic",
    "github": None,   # determined by LLM
    "hackernews": None,
    "hn": None,       # alias used by some ingestion paths
    "reddit": None,
    "index": None,
}

_PLATFORM_AUDIENCE = {
    "hackernews": (
        "Hacker News — audience: software engineers, systems programmers, technical founders, "
        "open-source contributors, security researchers. They value technical depth, contrarianism, "
        "and dislike hype. Generate a persona typical of this community."
    ),
    "producthunt": (
        "Product Hunt — audience: early adopters, product managers, UX/UI designers, growth hackers, "
        "startup enthusiasts who love discovering new tools. They care about polish, novelty, and "
        "user experience. Generate a persona typical of this community."
    ),
    "indiehackers": (
        "Indie Hackers — audience: bootstrapped solo founders, micro-SaaS builders, freelancers turning "
        "products, people optimising for MRR and independence over VC funding. "
        "Generate a persona typical of this community."
    ),
    "reddit_startups": (
        "Reddit r/startups — audience: early-stage founders, first-time entrepreneurs, angel investors, "
        "startup employees at seed/Series-A companies. Mix of optimism and hard-won scepticism. "
        "Generate a persona typical of this community."
    ),
    "linkedin": (
        "LinkedIn — audience: enterprise executives, VPs, corporate managers, B2B sales professionals, "
        "HR leaders, investors looking at market trends. They think in terms of ROI, risk, and "
        "organisational impact. Generate a persona typical of this community."
    ),
}

_SYSTEM_TMPL = """\
You are generating a realistic persona for a knowledge node in the context of a specific idea being evaluated.
Given a node (title, source, abstract), the idea being analyzed, and the target platform, create a realistic person who would have a meaningful perspective on that idea ON THAT PLATFORM.

Platform context: {platform_context}

The persona does NOT have to be someone who created or published the node. They should be the kind of person who would encounter this topic on the specified platform.

Use the platform context above to determine the appropriate role and background. Personas across platforms should differ significantly in job title, background, and priorities.

Respond ONLY with valid JSON:
{{
  "name": "Full Name",
  "role": "Job Title or Role",
  "mbti": "4-letter type",
  "interests": ["topic1", "topic2", "topic3"],
  "bias": "academic|commercial|skeptic|evangelist"
}}"""

async def generate_persona(
    node: dict,
    idea_text: str = "",
    neighbor_titles: list[str] | None = None,
    platform_name: str = "",
) -> Persona:
    # Validate required fields before making any API call
    node_id = node.get("id")
    if not node_id:
        raise ValueError(f"Node missing required 'id' field: {node!r}")

    # Sanitize and truncate fields to prevent prompt injection via external node data
    source = node.get("source", "")[:50].replace("\n", " ").replace("\r", " ")
    title = node.get("title", "")[:200].replace("\n", " ").replace("\r", " ")
    abstract = node.get("abstract", "")[:300].replace("\n", " ").replace("\r", " ")

    idea_snippet = idea_text.replace("\n", " ").replace("\r", " ") if idea_text else ""
    prompt = (
        f"Idea being evaluated: {idea_snippet}\n\n"
        f"Node — Title: {title}\n"
        f"Source: {source}\n"
        f"Abstract: {abstract}"
    )
    sanitized_neighbors = sanitize_neighbor_titles(neighbor_titles)
    if sanitized_neighbors:
        neighbor_str = ", ".join(sanitized_neighbors)
        prompt += f"\nNeighboring technologies (related nodes): {neighbor_str}"

    platform_context = _PLATFORM_AUDIENCE.get(
        platform_name,
        "A general online tech community. Generate a diverse persona appropriate to the idea's domain.",
    )
    system = _SYSTEM_TMPL.format(platform_context=platform_context)

    for attempt in range(4):
        try:
            async with _api_sem:
                message = await _get_client().messages.create(
                    model="claude-haiku-4-5-20251001",
                    max_tokens=8192,
                    system=system,
                    messages=[{"role": "user", "content": prompt}],
                )
            break
        except anthropic.RateLimitError as exc:
            if attempt == 3:
                raise
            import asyncio as _asyncio
            wait = 5 * (2 ** attempt)
            logger.warning("Persona rate limit (attempt %d/4), retrying in %ds: %s", attempt + 1, wait, exc)
            await _asyncio.sleep(wait)
        except Exception as exc:
            if attempt == 1:
                raise
            logger.warning("Persona API call failed (attempt %d): %s — retrying", attempt + 1, exc)
            await __import__("asyncio").sleep(1.0)
    try:

        if not message.content:
            raise ValueError("Empty response from API")
        raw = message.content[0].text.strip()
        raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw, flags=re.DOTALL).strip()
        if not raw:
            raise ValueError("Persona generation returned empty response")
        try:
            data = json.loads(raw)
        except json.JSONDecodeError as e:
            raise ValueError(f"Persona generation returned invalid JSON: {e}. Raw: {raw[:100]}")

        # Override bias for academic sources; None in dict means LLM decides
        if source not in _BIAS_BY_SOURCE:
            logger.warning("Unknown source %r; bias will be LLM-determined", source)
        forced_bias = _BIAS_BY_SOURCE.get(source)
        bias = forced_bias if forced_bias is not None else data.get("bias", "skeptic")

        # Validate interests is a list (LLMs sometimes return a string)
        interests_raw = data.get("interests", [])
        if isinstance(interests_raw, str):
            interests = [t.strip() for t in interests_raw.split(",") if t.strip()]
        elif isinstance(interests_raw, list):
            interests = [str(i) for i in interests_raw]
        else:
            interests = []
        interests = (interests[:10] or ["general"])  # cap length; ensure non-empty for prompt

        return Persona(
            node_id=node_id,
            name=data.get("name", "Unknown"),
            role=data.get("role", "Professional"),
            mbti=data.get("mbti", "INTJ"),
            interests=interests,
            bias=bias,
            source_title=node.get("title", ""),
        )
    except Exception as exc:
        logger.warning("generate_persona() failed for node %s: %s", node.get("id", "?"), exc)
        raise
