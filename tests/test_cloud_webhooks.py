"""
Webhook handler tests — Stripe & Clerk.
Uses mocks to bypass signature verification so we can test the business logic.
"""
import os
import sqlite3
import sys
import tempfile
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, "/Users/taeyoungpark/Desktop/noosphere-cloud/overrides")

# Set env vars before importing billing (billing reads DB_PATH at import time)
if "DB_PATH" not in os.environ:
    _tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    _tmp.close()
    os.environ["DB_PATH"] = _tmp.name

os.environ.setdefault("STRIPE_SECRET_KEY", "sk_test_dummy")
os.environ.setdefault("STRIPE_WEBHOOK_SECRET", "whsec_dummy")
os.environ.setdefault("STRIPE_PRICE_65CR", "price_65cr")
os.environ.setdefault("STRIPE_PRICE_260CR", "price_260cr")
os.environ.setdefault("STRIPE_PRICE_650CR", "price_650cr")
os.environ.setdefault("FRONTEND_URL", "http://localhost:5173")
os.environ.setdefault("CLERK_JWT_JWKS_URL", "https://example.clerk.accounts.dev/.well-known/jwks.json")
os.environ.setdefault("CLERK_WEBHOOK_SECRET", "whsec_clerk_dummy")

from backend.cloud.billing import DB_PATH as _BILLING_DB_PATH  # noqa: E402
from backend.cloud.billing import _ensure_tables, get_user_credits, upsert_user  # noqa: E402
from backend.cloud.billing import handle_stripe_webhook  # noqa: E402
from backend.cloud.auth import handle_clerk_webhook  # noqa: E402


@pytest.fixture(autouse=True)
def clean_db():
    # Always clean the same db that billing functions actually use
    con = sqlite3.connect(_BILLING_DB_PATH)
    for t in ("users", "credit_ledger", "_billing_migration_done"):
        con.execute(f"DROP TABLE IF EXISTS {t}")
    con.commit()
    con.close()
    _ensure_tables(_BILLING_DB_PATH)
    yield


# ---------------------------------------------------------------------------
# Stripe webhook
# ---------------------------------------------------------------------------

def _make_stripe_event(event_type: str, session: dict) -> MagicMock:
    event = MagicMock()
    event.__getitem__ = lambda self, key: {
        "type": event_type,
        "data": {"object": session},
    }[key]
    return event


class TestStripeWebhook:
    def test_checkout_completed_grants_credits(self):
        upsert_user("u_stripe_1")
        session = {
            "id": "cs_test_abc",
            "metadata": {"user_id": "u_stripe_1", "price_id": "price_65cr"},
        }
        event = {
            "type": "checkout.session.completed",
            "data": {"object": session},
        }
        with patch("stripe.Webhook.construct_event", return_value=event):
            result = handle_stripe_webhook(b"payload", "sig")
        assert result == {"status": "ok"}
        assert get_user_credits("u_stripe_1") == 65

    def test_checkout_completed_idempotent(self):
        """Same stripe_id twice must not double-grant credits."""
        upsert_user("u_idem")
        session = {
            "id": "cs_test_dup",
            "metadata": {"user_id": "u_idem", "price_id": "price_65cr"},
        }
        event = {
            "type": "checkout.session.completed",
            "data": {"object": session},
        }
        with patch("stripe.Webhook.construct_event", return_value=event):
            handle_stripe_webhook(b"payload", "sig")
            handle_stripe_webhook(b"payload", "sig")
        assert get_user_credits("u_idem") == 65  # not 130

    def test_invalid_signature_raises(self):
        import stripe
        with patch(
            "stripe.Webhook.construct_event",
            side_effect=stripe.error.SignatureVerificationError("bad sig", "sig"),
        ):
            with pytest.raises(ValueError, match="Invalid Stripe signature"):
                handle_stripe_webhook(b"bad", "bad_sig")

    def test_unknown_event_type_is_noop(self):
        event = {
            "type": "payment_intent.created",
            "data": {"object": {}},
        }
        with patch("stripe.Webhook.construct_event", return_value=event):
            result = handle_stripe_webhook(b"payload", "sig")
        assert result == {"status": "ok"}

    def test_checkout_expired_is_noop(self):
        event = {
            "type": "checkout.session.expired",
            "data": {"object": {"id": "cs_exp", "metadata": {}}},
        }
        with patch("stripe.Webhook.construct_event", return_value=event):
            result = handle_stripe_webhook(b"payload", "sig")
        assert result == {"status": "ok"}

    def test_checkout_completed_creates_user_if_missing(self):
        """Payment arrived before Clerk user.created webhook."""
        session = {
            "id": "cs_test_new_user",
            "metadata": {"user_id": "u_new_from_stripe", "price_id": "price_260cr"},
        }
        event = {
            "type": "checkout.session.completed",
            "data": {"object": session},
        }
        with patch("stripe.Webhook.construct_event", return_value=event):
            handle_stripe_webhook(b"payload", "sig")
        assert get_user_credits("u_new_from_stripe") == 260

    def test_checkout_completed_restores_soft_deleted_user(self):
        """Soft-deleted user who repurchases must be restored and receive credits."""
        from backend.cloud.billing import soft_delete_user
        upsert_user("u_restored")
        soft_delete_user("u_restored")
        assert get_user_credits("u_restored") == 0  # deleted, credits = 0

        session = {
            "id": "cs_test_restore",
            "metadata": {"user_id": "u_restored", "price_id": "price_65cr"},
        }
        event = {
            "type": "checkout.session.completed",
            "data": {"object": session},
        }
        with patch("stripe.Webhook.construct_event", return_value=event):
            handle_stripe_webhook(b"payload", "sig")
        # User should be undeleted and have 65 credits
        assert get_user_credits("u_restored") == 65


# ---------------------------------------------------------------------------
# Clerk webhook
# ---------------------------------------------------------------------------

class TestClerkWebhook:
    def _headers(self):
        return {
            "svix-id": "msg_test",
            "svix-timestamp": "1234567890",
            "svix-signature": "v1,fakesig",
        }

    def test_user_created_upserts_user(self):
        payload_data = {
            "type": "user.created",
            "data": {
                "id": "user_clerk_1",
                "email_addresses": [{"email_address": "test@example.com"}],
            },
        }
        with patch("svix.webhooks.Webhook.verify", return_value=payload_data):
            result = handle_clerk_webhook(b"payload", self._headers())
        assert result == {"status": "ok"}
        # User should exist with 0 credits
        assert get_user_credits("user_clerk_1") == 0

    def test_user_updated_upserts_user(self):
        upsert_user("user_clerk_2", "old@example.com")
        payload_data = {
            "type": "user.updated",
            "data": {
                "id": "user_clerk_2",
                "email_addresses": [{"email_address": "new@example.com"}],
            },
        }
        with patch("svix.webhooks.Webhook.verify", return_value=payload_data):
            result = handle_clerk_webhook(b"payload", self._headers())
        assert result == {"status": "ok"}

    def test_user_deleted_soft_deletes(self):
        upsert_user("user_clerk_del")
        _add_credits("user_clerk_del", 50)
        payload_data = {
            "type": "user.deleted",
            "data": {"id": "user_clerk_del"},
        }
        with patch("svix.webhooks.Webhook.verify", return_value=payload_data):
            handle_clerk_webhook(b"payload", self._headers())
        # Credits zeroed after deletion
        assert get_user_credits("user_clerk_del") == 0

    def test_invalid_signature_raises(self):
        from svix.webhooks import WebhookVerificationError
        with patch("svix.webhooks.Webhook.verify", side_effect=WebhookVerificationError("bad")):
            with pytest.raises(ValueError, match="Invalid Clerk webhook signature"):
                handle_clerk_webhook(b"bad", self._headers())

    def test_missing_clerk_secret_raises(self):
        # CLERK_WEBHOOK_SECRET is read at module import time — patch the module var directly
        with patch("backend.cloud.auth.CLERK_WEBHOOK_SECRET", ""):
            with pytest.raises(ValueError, match="CLERK_WEBHOOK_SECRET is not configured"):
                handle_clerk_webhook(b"payload", self._headers())

    def test_unknown_event_type_is_noop(self):
        payload_data = {
            "type": "session.created",
            "data": {"id": "sess_123"},
        }
        with patch("svix.webhooks.Webhook.verify", return_value=payload_data):
            result = handle_clerk_webhook(b"payload", self._headers())
        assert result == {"status": "ok"}


# ---------------------------------------------------------------------------
# helper
# ---------------------------------------------------------------------------

def _add_credits(user_id: str, amount: int) -> None:
    con = sqlite3.connect(_BILLING_DB_PATH)
    con.execute("UPDATE users SET credits = credits + ? WHERE user_id = ?", (amount, user_id))
    con.commit()
    con.close()
