from __future__ import annotations
import logging
import math

from backend import llm

logger = logging.getLogger(__name__)

_SYSTEM = """\
You are an expert at analysing competitive landscapes for technology ideas.
Given a list of real-world items gathered from GitHub, academic papers, HN, Reddit, Product Hunt, and other sources,
write a concise structured landscape report in markdown."""


def _coerce_score(value: object) -> float:
    """Normalize score-like values for display and sorting."""
    try:
        score = float(value or 0)
    except (TypeError, ValueError):
        return 0.0
    return score if math.isfinite(score) else 0.0


def _fmt_items(items: list[dict], limit: int = 10) -> str:
    lines = []
    for it in items[:limit]:
        title = it.get("title", "?")
        url = it.get("url", "")
        source = it.get("source", "")
        score = _coerce_score(it.get("score"))
        text = (it.get("text") or "")[:120].replace("\n", " ")
        lines.append(f"- [{title}]({url}) (source={source}, score={score:.1f}) — {text}")
    return "\n".join(lines) if lines else "_없음_"


async def generate_analysis_report(
    raw_items: list[dict],
    domain: str,
    input_text: str,
    language: str = "English",
    provider: str = "openai",
) -> str:
    """
    RawItem 리스트로 경쟁 환경 분석 보고서를 생성합니다.
    """
    if not raw_items:
        return "## Analysis Report\n\n수집된 데이터가 없습니다."

    by_source: dict[str, list[dict]] = {}
    for item in raw_items:
        src = item.get("source", "unknown")
        by_source.setdefault(src, []).append(item)

    top_items = sorted(raw_items, key=lambda x: -_coerce_score(x.get("score")))

    source_summary = "\n".join(
        f"- {src}: {len(items)}개" for src, items in sorted(by_source.items())
    )

    prompt = f"""Domain: {domain}
Idea: {input_text}

Collected {len(raw_items)} items from: {', '.join(sorted(by_source.keys()))}

Source breakdown:
{source_summary}

Top items by relevance/score:
{_fmt_items(top_items, limit=15)}

Write a landscape report in this exact structure:
## Summary
## Existing Solutions (Top 5 most relevant)
## Market Gaps / Blue Ocean Opportunities
## Key Players & Communities
## Recommended Positioning

Respond entirely in {language}."""

    response = await llm.complete(
        messages=[
            {"role": "system", "content": _SYSTEM},
            {"role": "user", "content": prompt},
        ],
        tier="high",
        provider=provider,
        max_tokens=32768,
    )
    return response.content or ""


_GTM_SYSTEM = """\
You are a go-to-market strategist specializing in early-stage product launches.
Given simulation results showing how different communities reacted to a product idea,
generate a concrete, actionable launch strategy.
Focus on: where to launch, who to target first, how to message, and what risks to pre-empt."""


async def generate_gtm_report(
    report_json: dict,
    analysis_md: str,
    input_text: str,
    language: str = "English",
    provider: str = "openai",
) -> str:
    """
    시뮬레이션 결과(report_json)와 경쟁 분석(analysis_md)을 기반으로
    Go-to-Market 전략 보고서를 생성합니다.
    """
    if not report_json:
        return "## Launch Strategy\n\n_No simulation data available._"

    verdict = report_json.get("verdict", "mixed")
    segments = report_json.get("segments", [])
    criticisms = report_json.get("criticism_clusters", [])
    improvements = report_json.get("improvements", [])

    # Build segment sentiment summary
    seg_lines = []
    for seg in segments:
        seg_lines.append(f"- {seg.get('name', '')}: {seg.get('sentiment', 'neutral')} — {seg.get('summary', '')[:150]}")
    seg_summary = "\n".join(seg_lines) if seg_lines else "No segment data"

    # Build criticism summary
    crit_lines = []
    for c in criticisms:
        crit_lines.append(f"- {c.get('theme', '')} ({c.get('count', 0)} mentions)")
    crit_summary = "\n".join(crit_lines) if crit_lines else "No criticisms recorded"

    # Build improvements summary
    imp_lines = []
    for imp in improvements:
        imp_lines.append(f"- {imp.get('suggestion', '')} (×{imp.get('frequency', 1)})")
    imp_summary = "\n".join(imp_lines) if imp_lines else "No improvements recorded"

    prompt = f"""Product idea: {input_text}

Overall verdict: {verdict}

Segment reactions:
{seg_summary}

Top criticisms:
{crit_summary}

Top improvement suggestions:
{imp_summary}

Competitive context (summary):
{analysis_md[:1500]}

---
Generate a Go-to-Market strategy report with this EXACT structure:

## Platform Priority
Rank the 5 platforms (Hacker News, Product Hunt, Indie Hackers, Reddit r/startups, LinkedIn) by launch priority based on which segments responded most positively. For each, explain WHY and HOW to approach it specifically.

## Ideal Customer Profile (ICP)
Based on the segments with positive/neutral sentiment, define the primary ICP: who they are, what job they're trying to do, what triggers them to seek a solution.

## Messaging Strategy
For each top criticism cluster, write a specific counter-message or positioning adjustment. How should the product be framed to pre-empt the objection?

## Product Priorities Before Launch
From the improvement suggestions, identify the top 2-3 things to fix or add BEFORE the first public launch to maximize reception.

## Risk Assessment
Apply inversion thinking: what are the 2-3 most likely ways this launch could fail, and what would prevent each?

Respond entirely in {language}. Be specific and actionable, not generic."""

    response = await llm.complete(
        messages=[
            {"role": "system", "content": _GTM_SYSTEM},
            {"role": "user", "content": prompt},
        ],
        tier="high",
        provider=provider,
        max_tokens=8192,
    )
    return response.content or "## Launch Strategy\n\n_Generation failed._"


_FINAL_REPORT_SYSTEM = """\
You are a senior product analyst. You are given two inputs:
1. A competitive landscape analysis (from real-world sources)
2. A simulation report (from AI agent reactions to the idea)

Synthesize these into a final executive report with clear, actionable conclusions."""


def _fmt_report_json(report: dict) -> str:
    if not report:
        return "_No simulation data_"
    verdict = report.get("verdict", "unknown")
    evidence = report.get("evidence_count", 0)
    lines = [f"**Verdict:** {verdict} (based on {evidence} interactions)"]
    for seg in report.get("segments", []):
        lines.append(f"- Segment '{seg.get('name','')}': {seg.get('sentiment','')} — {seg.get('summary','')}")
    lines.append("\n**Top Criticisms:**")
    for c in report.get("criticism_clusters", [])[:3]:
        lines.append(f"- {c.get('theme','')} ({c.get('count',0)} mentions)")
    lines.append("\n**Top Improvements:**")
    for imp in report.get("improvements", [])[:3]:
        lines.append(f"- {imp.get('suggestion','')} (×{imp.get('frequency',1)})")
    return "\n".join(lines)


async def generate_final_report(
    analysis_md: str,
    report_json: dict,
    input_text: str,
    language: str = "English",
    provider: str = "openai",
    gtm_md: str = "",
) -> str:
    """
    analysis_md(소스 분석)와 report_json(시뮬레이션 결과)를 종합한
    최종 경영진 보고서를 생성합니다.
    """
    if not analysis_md and not report_json:
        return "## Final Report\n\n_No data available to generate final report._"

    sim_summary = _fmt_report_json(report_json)

    gtm_section = ""
    if gtm_md:
        gtm_section = f"""
---
## 3. Go-to-Market Strategy
{gtm_md[:3000]}
"""

    prompt = f"""Idea: {input_text}

---
## 1. Competitive Landscape Analysis
{analysis_md[:3000]}

---
## 2. Simulation Results Summary
{sim_summary}
{gtm_section}
---
Write the final report in this exact structure:
## Executive Summary
## Key Findings
## Risk Assessment
## Strategic Recommendations
## Conclusion

Be direct and actionable. Synthesize all available inputs. Respond entirely in {language}."""

    response = await llm.complete(
        messages=[
            {"role": "system", "content": _FINAL_REPORT_SYSTEM},
            {"role": "user", "content": prompt},
        ],
        tier="high",
        provider=provider,
        max_tokens=8192,
    )
    return response.content or "## Final Report\n\n_Generation failed._"
