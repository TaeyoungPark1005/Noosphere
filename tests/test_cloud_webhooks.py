"""
Webhook handler tests — Stripe & Clerk.
Uses mocks to bypass signature verification so we can test the business logic.
"""
from unittest.mock import patch

import pytest

from backend.cloud.billing import get_user_credits, upsert_user
from backend.cloud.billing import handle_stripe_webhook
from backend.cloud.auth import handle_clerk_webhook


# ---------------------------------------------------------------------------
# Stripe webhook
# ---------------------------------------------------------------------------

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

    def test_user_deleted_soft_deletes(self, add_credits):
        upsert_user("user_clerk_del")
        add_credits("user_clerk_del", 50)
        payload_data = {
            "type": "user.deleted",
            "data": {"id": "user_clerk_del"},
        }
        with patch("svix.webhooks.Webhook.verify", return_value=payload_data):
            handle_clerk_webhook(b"payload", self._headers())
        assert get_user_credits("user_clerk_del") == 0

    def test_invalid_signature_raises(self):
        from svix.webhooks import WebhookVerificationError
        with patch("svix.webhooks.Webhook.verify", side_effect=WebhookVerificationError("bad")):
            with pytest.raises(ValueError, match="Invalid Clerk webhook signature"):
                handle_clerk_webhook(b"bad", self._headers())

    def test_missing_clerk_secret_raises(self):
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
