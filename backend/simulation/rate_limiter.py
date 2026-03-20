# backend/simulation/rate_limiter.py
from __future__ import annotations
import asyncio

# Global semaphore shared across all simulation LLM calls.
# Caps concurrent Haiku API calls to avoid hitting the 50 RPM org limit.
api_sem = asyncio.Semaphore(6)
