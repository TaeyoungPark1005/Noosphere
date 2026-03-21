"""
Redis-based global rate limiter for LLM API calls.

Enforces a sliding-window RPM limit shared across ALL Celery workers,
preventing 429 errors. Supports all three providers independently.

Override via env:
  OPENAI_RPM=500          # OpenAI tier's actual limit (default 500)
  ANTHROPIC_RPM=50        # Anthropic tier's actual limit (default 50)
  GEMINI_RPM=60           # Gemini tier's actual limit (default 60)
  RPM_SAFETY=0.80         # fraction to actually use (default 0.80)
"""
from __future__ import annotations
import asyncio
import os
import time
import uuid

# ── 설정 ──────────────────────────────────────────────────────────────────
_SAFETY = float(os.getenv("RPM_SAFETY", "0.80"))

_PROVIDER_RPM: dict[str, int] = {
    "openai":    max(1, int(int(os.getenv("OPENAI_RPM",    "500")) * _SAFETY)),
    "anthropic": max(1, int(int(os.getenv("ANTHROPIC_RPM",  "50")) * _SAFETY)),
    "gemini":    max(1, int(int(os.getenv("GEMINI_RPM",     "60")) * _SAFETY)),
}

_REDIS_KEYS: dict[str, str] = {
    "openai":    "noosphere:openai:rpm",
    "anthropic": "noosphere:anthropic:rpm",
    "gemini":    "noosphere:gemini:rpm",
}

# ── Redis 클라이언트 (지연 초기화) ─────────────────────────────────────────
_redis_client = None

def _get_redis():
    global _redis_client
    if _redis_client is None:
        import redis.asyncio as _aioredis
        url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        _redis_client = _aioredis.from_url(url, decode_responses=True)
    return _redis_client


# ── Lua 스크립트: 슬라이딩 윈도우 (atomic) ──────────────────────────────────
_ACQUIRE_SCRIPT = """
local key        = KEYS[1]
local now        = tonumber(ARGV[1])
local window_start = tonumber(ARGV[2])
local limit      = tonumber(ARGV[3])
local entry_id   = ARGV[4]

-- 만료된 항목 제거
redis.call('ZREMRANGEBYSCORE', key, 0, window_start)

local count = redis.call('ZCARD', key)
if count < limit then
    redis.call('ZADD', key, now, entry_id)
    redis.call('EXPIRE', key, 70)
    return {'ok', '0'}
else
    -- 가장 오래된 항목의 timestamp 반환 → 언제 슬롯이 열리는지 계산
    local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
    if #oldest > 0 then
        return {'wait', oldest[2]}
    end
    return {'wait', tostring(now)}
end
"""


async def acquire_api_slot(provider: str = "openai") -> None:
    """
    Rate-limit gate: LLM API를 호출하기 전에 이 함수를 await.
    Redis 슬라이딩 윈도우로 전체 워커에 걸쳐 프로바이더별 RPM을 제한.
    슬롯이 없으면 열릴 때까지 정밀하게 대기.
    """
    r = _get_redis()
    redis_key = _REDIS_KEYS.get(provider, f"noosphere:{provider}:rpm")
    limit = _PROVIDER_RPM.get(provider, 40)

    while True:
        now = time.time()
        window_start = now - 60.0
        entry_id = str(uuid.uuid4())

        result = await r.eval(
            _ACQUIRE_SCRIPT,
            1,
            redis_key,
            str(now),
            str(window_start),
            str(limit),
            entry_id,
        )

        if result[0] == "ok":
            return

        # 가장 오래된 슬롯이 윈도우 밖으로 나가는 시점까지 대기
        oldest_ts = float(result[1])
        sleep_for = (oldest_ts + 60.0) - time.time() + 0.05
        await asyncio.sleep(max(0.05, sleep_for))


# ── persona_generator.py의 `async with _api_sem:` 과 호환 ─────────────────
class _RateLimitedSlot:
    """async context manager — acquire_api_slot() 을 래핑."""
    def __init__(self, provider: str = "openai"):
        self._provider = provider

    async def __aenter__(self) -> "_RateLimitedSlot":
        await acquire_api_slot(self._provider)
        return self

    async def __aexit__(self, *_) -> None:
        pass


api_sem = _RateLimitedSlot("openai")
