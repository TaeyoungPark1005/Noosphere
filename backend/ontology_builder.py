from __future__ import annotations


# ── Slice functions ────────────────────────────────────────────────────────────

def ontology_for_persona(ontology: dict) -> str:
    """max 400 chars — domain_summary + top 8 entity names + market_tensions."""
    if not isinstance(ontology, dict):
        return ""

    domain = ontology.get("domain_summary", "")
    if not isinstance(domain, str):
        domain = ""

    entities = ontology.get("entities", [])
    if not isinstance(entities, list):
        entities = []

    tensions_list = ontology.get("market_tensions", [])
    if not isinstance(tensions_list, list):
        tensions_list = []

    names = ", ".join(
        f"{e.get('name', '')} ({e.get('type', '')})"
        for e in entities[:8]
        if isinstance(e, dict) and (e.get("name") or e.get("type"))
    )
    tensions = "; ".join(str(t) for t in tensions_list[:3] if t)
    text = f"Domain: {domain}\nKey players: {names}"
    if tensions:
        text += f"\nMarket tensions: {tensions}"
    return text[:400]

