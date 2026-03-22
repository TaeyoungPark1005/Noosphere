from __future__ import annotations

from backend import llm

async def detect_domain(input_text: str, provider: str = "openai") -> str:
    """Detect the product domain (e.g. 'SaaS', 'fintech', 'developer tools')."""
    prompt = (
        f"In 2-4 words, what is the domain of this product? "
        f"Examples: 'developer tools', 'B2B SaaS', 'fintech', 'consumer app'.\n\n"
        f"Reply with only the domain string.\n\n{input_text[:500]}"
    )
    try:
        response = await llm.complete(
            messages=[{"role": "user", "content": prompt}],
            tier="low",
            provider=provider,
            max_tokens=512,
        )
        domain = (response.content or "").strip()
        domain = domain.splitlines()[0].strip().strip('"').strip("'")
        return domain[:50] or "technology"
    except Exception:
        return "technology"
