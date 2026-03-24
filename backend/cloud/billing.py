"""
Billing stub — used when BILLING_ENABLED=false (self-hosted / open-source mode).

In the hosted cloud version this module is replaced by the private implementation
which handles Stripe, credit ledger, usage tracking, and per-user rate limiting.
"""
from __future__ import annotations


class InsufficientCreditsError(Exception):
    """Raised when a user does not have enough credits to start a simulation."""


def check_credits(user_id: str | None, cost: int = 1) -> None:
    """No-op in self-hosted mode. Raises InsufficientCreditsError in cloud mode."""


def deduct_credits(user_id: str | None, cost: int = 1, sim_id: str | None = None) -> None:
    """No-op in self-hosted mode. Deducts from credit ledger in cloud mode."""


def refund_credits(user_id: str | None, cost: int = 1, sim_id: str | None = None) -> None:
    """No-op in self-hosted mode. Refunds credits on simulation failure in cloud mode."""
