import os
import sqlite3
import sys
import tempfile
from contextlib import closing

import pytest

sys.path.insert(0, "/Users/taeyoungpark/Desktop/noosphere-cloud/overrides")

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

try:
    from backend.cloud.billing import DB_PATH as BILLING_DB_PATH
    from backend.cloud.billing import _ensure_tables
    _cloud_available = True
except ImportError:
    BILLING_DB_PATH = None
    _cloud_available = False


@pytest.fixture
def add_credits():
    def _add(user_id: str, amount: int) -> None:
        with closing(sqlite3.connect(BILLING_DB_PATH)) as con:
            con.execute(
                "UPDATE users SET credits = credits + ? WHERE user_id = ?",
                (amount, user_id),
            )
            con.commit()
    return _add


@pytest.fixture(autouse=True)
def clean_billing_db(request):
    if not _cloud_available:
        yield
        return
    if not any(
        request.fspath.basename.startswith(p)
        for p in ("test_cloud_billing", "test_cloud_webhooks")
    ):
        yield
        return
    with closing(sqlite3.connect(BILLING_DB_PATH)) as con:
        for table in ("users", "credit_ledger", "_billing_migration_done"):
            con.execute(f"DROP TABLE IF EXISTS {table}")
        con.commit()
    _ensure_tables(BILLING_DB_PATH)
    yield
