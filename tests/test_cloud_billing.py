"""
Tests for cloud billing module.
Runs against an in-memory SQLite database.
"""
import os
import sqlite3
import sys
import tempfile
import threading
import pytest

# Make the cloud overrides importable
sys.path.insert(0, "/Users/taeyoungpark/Desktop/noosphere-cloud/overrides")

# Override DB_PATH before importing billing
_TMP_DB = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
_TMP_DB.close()
os.environ["DB_PATH"] = _TMP_DB.name
os.environ["STRIPE_SECRET_KEY"] = "sk_test_dummy"
os.environ["STRIPE_WEBHOOK_SECRET"] = "whsec_dummy"
os.environ["STRIPE_PRICE_65CR"] = "price_65cr"
os.environ["STRIPE_PRICE_260CR"] = "price_260cr"
os.environ["STRIPE_PRICE_650CR"] = "price_650cr"
os.environ["FRONTEND_URL"] = "http://localhost:5173"

from backend.cloud.billing import (  # noqa: E402
    InsufficientCreditsError,
    calculate_credit_cost,
    check_credits,
    deduct_credits,
    get_user_credits,
    refund_credits,
    soft_delete_user,
    upsert_user,
    _ensure_tables,
    _fulfill_purchase,
)


@pytest.fixture(autouse=True)
def clean_db():
    """Wipe and re-initialise billing tables before each test."""
    con = sqlite3.connect(_TMP_DB.name)
    con.execute("DROP TABLE IF EXISTS users")
    con.execute("DROP TABLE IF EXISTS credit_ledger")
    con.execute("DROP TABLE IF EXISTS _billing_migration_done")
    con.commit()
    con.close()
    _ensure_tables(_TMP_DB.name)
    yield


# ---------------------------------------------------------------------------
# calculate_credit_cost
# ---------------------------------------------------------------------------

class TestCalculateCreditCost:
    def test_basic(self):
        # ceil(5*10*0.8*0.4)=ceil(16)=16, extra=ceil(0/100)=0 → 16
        assert calculate_credit_cost(5, 10, 0.8) == 16

    def test_minimum_one(self):
        assert calculate_credit_cost(0, 0, 0.0) == 1

    def test_with_source_limits(self):
        # base = ceil(2*5*0.5*0.4)=ceil(2)=2, extra=ceil(300/100)=3 → 5
        assert calculate_credit_cost(2, 5, 0.5, {"google": 200, "reddit": 100}) == 5

    def test_fractional_rounds_up(self):
        # ceil(1*1*0.1*0.4)=ceil(0.04)=1
        assert calculate_credit_cost(1, 1, 0.1) == 1


# ---------------------------------------------------------------------------
# upsert_user / get_user_credits
# ---------------------------------------------------------------------------

class TestUpsertUser:
    def test_creates_user_with_zero_credits(self):
        upsert_user("u_001", "test@example.com")
        assert get_user_credits("u_001") == 0

    def test_idempotent_on_duplicate(self):
        upsert_user("u_001", "a@b.com")
        upsert_user("u_001", "a@b.com")  # should not raise
        assert get_user_credits("u_001") == 0

    def test_unknown_user_returns_zero(self):
        assert get_user_credits("nonexistent") == 0


# ---------------------------------------------------------------------------
# check_credits
# ---------------------------------------------------------------------------

class TestCheckCredits:
    def test_raises_when_no_user_id(self):
        with pytest.raises(InsufficientCreditsError, match="Authentication required"):
            check_credits(None, cost=1)

    def test_raises_when_user_not_found(self):
        with pytest.raises(InsufficientCreditsError, match="User not found"):
            check_credits("ghost", cost=1)

    def test_raises_when_insufficient(self):
        upsert_user("u_poor")
        with pytest.raises(InsufficientCreditsError, match="need 5, have 0"):
            check_credits("u_poor", cost=5)

    def test_passes_when_sufficient(self):
        upsert_user("u_rich")
        _add_credits("u_rich", 10)
        check_credits("u_rich", cost=5)  # should not raise


# ---------------------------------------------------------------------------
# deduct_credits
# ---------------------------------------------------------------------------

class TestDeductCredits:
    def test_deducts_correctly(self):
        upsert_user("u_d1")
        _add_credits("u_d1", 10)
        deduct_credits("u_d1", cost=3)
        assert get_user_credits("u_d1") == 7

    def test_raises_when_insufficient(self):
        upsert_user("u_d2")
        with pytest.raises(InsufficientCreditsError):
            deduct_credits("u_d2", cost=1)

    def test_atomic_under_concurrent_load(self):
        """Two threads cannot both deduct from a balance of 1."""
        upsert_user("u_concurrent")
        _add_credits("u_concurrent", 1)
        errors = []
        successes = []

        def try_deduct():
            try:
                deduct_credits("u_concurrent", cost=1)
                successes.append(1)
            except InsufficientCreditsError:
                errors.append(1)

        t1 = threading.Thread(target=try_deduct)
        t2 = threading.Thread(target=try_deduct)
        t1.start(); t2.start()
        t1.join(); t2.join()

        assert len(successes) == 1
        assert len(errors) == 1
        assert get_user_credits("u_concurrent") == 0

    def test_raises_when_no_user_id(self):
        with pytest.raises(InsufficientCreditsError, match="Authentication required"):
            deduct_credits(None, cost=1)


# ---------------------------------------------------------------------------
# refund_credits
# ---------------------------------------------------------------------------

class TestRefundCredits:
    def test_refunds_correctly(self):
        upsert_user("u_r1")
        _add_credits("u_r1", 5)
        deduct_credits("u_r1", cost=3)
        refund_credits("u_r1", cost=3)
        assert get_user_credits("u_r1") == 5

    def test_noop_when_no_user_id(self):
        refund_credits(None, cost=5)  # should not raise


# ---------------------------------------------------------------------------
# soft_delete_user
# ---------------------------------------------------------------------------

class TestSoftDeleteUser:
    def test_zeroes_credits_and_hides_user(self):
        upsert_user("u_del")
        _add_credits("u_del", 20)
        soft_delete_user("u_del")
        assert get_user_credits("u_del") == 0

    def test_check_credits_fails_after_delete(self):
        upsert_user("u_del2")
        _add_credits("u_del2", 10)
        soft_delete_user("u_del2")
        with pytest.raises(InsufficientCreditsError):
            check_credits("u_del2", cost=1)


# ---------------------------------------------------------------------------
# _fulfill_purchase (webhook fulfillment)
# ---------------------------------------------------------------------------

class TestFulfillPurchase:
    def test_grants_credits(self):
        upsert_user("u_buy")
        session = {
            "id": "cs_test_123",
            "metadata": {"user_id": "u_buy", "price_id": "price_65cr"},
        }
        _fulfill_purchase(session)
        assert get_user_credits("u_buy") == 65

    def test_idempotent_on_duplicate_stripe_id(self):
        upsert_user("u_buy2")
        session = {
            "id": "cs_test_dup",
            "metadata": {"user_id": "u_buy2", "price_id": "price_65cr"},
        }
        _fulfill_purchase(session)
        _fulfill_purchase(session)  # second call must be a no-op
        assert get_user_credits("u_buy2") == 65

    def test_skips_unknown_price(self):
        upsert_user("u_bad")
        session = {
            "id": "cs_test_bad",
            "metadata": {"user_id": "u_bad", "price_id": "price_unknown"},
        }
        _fulfill_purchase(session)
        assert get_user_credits("u_bad") == 0

    def test_creates_user_if_missing(self):
        """User received payment before clerk webhook fired."""
        session = {
            "id": "cs_test_new",
            "metadata": {"user_id": "u_new", "price_id": "price_260cr"},
        }
        _fulfill_purchase(session)
        assert get_user_credits("u_new") == 260


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def _add_credits(user_id: str, amount: int) -> None:
    """Directly add credits to a user for test setup."""
    con = sqlite3.connect(_TMP_DB.name)
    con.execute("UPDATE users SET credits = credits + ? WHERE user_id = ?", (amount, user_id))
    con.commit()
    con.close()
