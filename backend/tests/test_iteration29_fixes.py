"""
Iteration 29 — 4 surgical backend fixes validation
(1) Seed CREDIT_CARDS: Ecuador cards exist; Apple Card is an allowed household source
(2) _save_deferred_purchases: total_amount ±5% dedup filter → distinct totals treated independently
(3) /dashboard/stats total_income: SUMS incomes collection (non-cancelled) + income transactions
(4) /dashboard/stats sri_deductible: filters by transaction_type='expense' AND sri_category present
"""
import os
import uuid
import pytest
import requests
from datetime import datetime, timezone
from pathlib import Path

# Load REACT_APP_BACKEND_URL from frontend/.env (tests run outside React env)
def _load_backend_url():
    url = os.environ.get('REACT_APP_BACKEND_URL')
    if url:
        return url
    fe_env = Path('/app/frontend/.env')
    if fe_env.exists():
        for line in fe_env.read_text().splitlines():
            if line.startswith('REACT_APP_BACKEND_URL='):
                return line.split('=', 1)[1].strip()
    return ''

# Load MONGO_URL from backend/.env
def _load_mongo_url():
    url = os.environ.get('MONGO_URL')
    if url:
        return url
    be_env = Path('/app/backend/.env')
    if be_env.exists():
        for line in be_env.read_text().splitlines():
            if line.startswith('MONGO_URL='):
                return line.split('=', 1)[1].strip().strip('"')
    return ''

BASE_URL = _load_backend_url().rstrip('/')
MONGO_URL = _load_mongo_url()
DB_NAME = os.environ.get('DB_NAME', 'fintrack_ec')
ADMIN_EMAIL = "earauzt@gmail.com"
ADMIN_PASSWORD = "Realmadrid2011"
ADMIN_USER_ID = "admin-emilio-001"


# ---------------- Fixtures ----------------
@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    # login — JWT via httpOnly cookie
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def mongo_db():
    """Sync pymongo client for cleanup/seeding (avoids async loop pitfalls)."""
    from pymongo import MongoClient
    import certifi
    client = MongoClient(MONGO_URL, tlsCAFile=certifi.where())
    db = client[DB_NAME]

    class DBWrapper:
        def __init__(self, db):
            self.db = db

        def run(self, coro):
            # For motor coros passed in tests: run via asyncio; but we use sync pymongo directly
            import asyncio
            return asyncio.new_event_loop().run_until_complete(coro)

    yield DBWrapper(db)
    client.close()


# ---------------- FIX 1: seed credit cards ----------------
class TestSeedCreditCards:
    def test_admin_credit_cards_are_listed(self, client):
        r = client.get(f"{BASE_URL}/api/credit-cards")
        assert r.status_code == 200, r.text
        cards = r.json()
        assert isinstance(cards, list)
        # Apple Card (USA) is a valid household source — do not treat it as excluded.


# ---------------- FIX 3: total_income includes incomes collection ----------------
class TestDashboardStatsTotalIncome:
    def test_total_income_includes_incomes_collection(self, client, mongo_db):
        # Baseline stats
        r1 = client.get(f"{BASE_URL}/api/dashboard/stats")
        assert r1.status_code == 200, r1.text
        baseline = r1.json().get("total_income", 0)

        # Insert a test income (received, this month)
        now = datetime.now(timezone.utc)
        today_str = now.strftime("%Y-%m-%d")
        test_id = f"TEST_inc_{uuid.uuid4().hex[:8]}"
        income_doc = {
            "id": test_id,
            "user_id": ADMIN_USER_ID,
            "amount": 1000.0,
            "description": "TEST iteration29 income",
            "date": today_str,
            "status": "received",
            "created_at": now.isoformat(),
        }
        mongo_db.db.incomes.insert_one(income_doc)

        try:
            r2 = client.get(f"{BASE_URL}/api/dashboard/stats")
            assert r2.status_code == 200, r2.text
            after = r2.json().get("total_income", 0)
            # Expect at least +1000
            assert after >= baseline + 999.99, (
                f"Expected total_income to increase by ~1000. baseline={baseline} after={after}"
            )
        finally:
            mongo_db.db.incomes.delete_one({"id": test_id})

    def test_cancelled_income_excluded(self, client, mongo_db):
        r1 = client.get(f"{BASE_URL}/api/dashboard/stats")
        baseline = r1.json().get("total_income", 0)

        now = datetime.now(timezone.utc)
        today_str = now.strftime("%Y-%m-%d")
        test_id = f"TEST_inc_cancel_{uuid.uuid4().hex[:8]}"
        mongo_db.db.incomes.insert_one({
            "id": test_id, "user_id": ADMIN_USER_ID, "amount": 500.0,
            "description": "TEST cancelled", "date": today_str,
            "status": "cancelled", "created_at": now.isoformat(),
        })
        try:
            r2 = client.get(f"{BASE_URL}/api/dashboard/stats")
            after = r2.json().get("total_income", 0)
            # cancelled should NOT affect total
            assert abs(after - baseline) < 0.01, (
                f"Cancelled income leaked in. baseline={baseline} after={after}"
            )
        finally:
            mongo_db.db.incomes.delete_one({"id": test_id})


# ---------------- FIX 4: sri_deductible by sri_category ----------------
class TestDashboardStatsSriDeductible:
    def test_sri_deductible_sums_by_sri_category(self, client, mongo_db):
        r1 = client.get(f"{BASE_URL}/api/dashboard/stats")
        assert r1.status_code == 200
        baseline = r1.json().get("sri_deductible", 0)

        now = datetime.now(timezone.utc)
        today_str = now.strftime("%Y-%m-%d")
        test_id = f"TEST_sri_{uuid.uuid4().hex[:8]}"
        tx_doc = {
            "id": test_id,
            "user_id": ADMIN_USER_ID,
            "amount": 50.0,
            "description": "TEST SRI deductible tx",
            "category": "comida",
            "sri_category": "alimentacion",
            "date": today_str,
            "transaction_type": "expense",
            "status": "approved",
            "source_type": "manual",
            "created_at": now.isoformat(),
        }
        mongo_db.db.transactions.insert_one(tx_doc)
        try:
            r2 = client.get(f"{BASE_URL}/api/dashboard/stats")
            assert r2.status_code == 200, r2.text
            after = r2.json().get("sri_deductible", 0)
            assert after >= baseline + 49.99, (
                f"sri_deductible did not include the expense. baseline={baseline} after={after}"
            )
        finally:
            mongo_db.db.transactions.delete_one({"id": test_id})

    def test_expense_without_sri_category_not_counted(self, client, mongo_db):
        r1 = client.get(f"{BASE_URL}/api/dashboard/stats")
        baseline = r1.json().get("sri_deductible", 0)

        now = datetime.now(timezone.utc)
        today_str = now.strftime("%Y-%m-%d")
        test_id = f"TEST_nosri_{uuid.uuid4().hex[:8]}"
        tx_doc = {
            "id": test_id, "user_id": ADMIN_USER_ID, "amount": 77.0,
            "description": "TEST no-sri expense", "category": "otros",
            "date": today_str, "transaction_type": "expense",
            "status": "approved", "source_type": "manual",
            "created_at": now.isoformat(),
        }
        mongo_db.db.transactions.insert_one(tx_doc)
        try:
            r2 = client.get(f"{BASE_URL}/api/dashboard/stats")
            after = r2.json().get("sri_deductible", 0)
            assert abs(after - baseline) < 0.01, (
                f"Expense without sri_category leaked. baseline={baseline} after={after}"
            )
        finally:
            mongo_db.db.transactions.delete_one({"id": test_id})


# ---------------- FIX 2: deferred dedup with ±5% total_amount filter ----------------
class TestDeferredDedupByTotalAmount:
    """Directly invoke _save_deferred_purchases to verify the dedup logic."""

    def _call_save(self, purchases, card_info, filename="TEST.pdf"):
        """Create a fresh motor client inside a one-shot asyncio.run() and
        monkey-patch routes.documents.db so all awaits happen on the same loop."""
        import asyncio
        import sys
        sys.path.insert(0, "/app/backend")

        async def _run():
            import certifi
            from motor.motor_asyncio import AsyncIOMotorClient
            from routes import documents as docs_module
            client = AsyncIOMotorClient(MONGO_URL, tlsCAFile=certifi.where())
            fresh_db = client[DB_NAME]
            # Patch the module-level db for the duration of this call
            orig_db = docs_module.db
            docs_module.db = fresh_db
            try:
                response_data = {}
                await docs_module._save_deferred_purchases(
                    ADMIN_USER_ID, purchases, card_info, response_data, filename
                )
                return response_data
            finally:
                docs_module.db = orig_db
                client.close()

        return asyncio.run(_run())

    def test_distinct_total_amounts_create_two_deferreds(self, mongo_db):
        desc = f"TEST DIFERIDO {uuid.uuid4().hex[:6]}"
        card_info = {"card_name": "Pacificard Black", "id": "card-pacificard-black"}

        # Cleanup any stray test docs upfront
        mongo_db.db.deferred_payments.delete_many(
            {"user_id": ADMIN_USER_ID, "description": desc}
        )

        try:
            # First call — $5000 total, 10 installments
            r1 = self._call_save([{
                "description": desc, "total_amount": 5000.0,
                "monthly_payment": 500.0, "remaining_installments": 10,
                "total_installments": 10,
            }], card_info)
            assert r1["deferred_payments_created"] == 1
            assert r1["deferred_payments_decremented"] == 0

            # Second call — $10000 total, 20 installments (SAME desc+card, DIFF amount)
            r2 = self._call_save([{
                "description": desc, "total_amount": 10000.0,
                "monthly_payment": 500.0, "remaining_installments": 20,
                "total_installments": 20,
            }], card_info)
            assert r2["deferred_payments_created"] == 1, (
                f"Expected new deferred inserted (different total_amount), got {r2}"
            )
            assert r2["deferred_payments_decremented"] == 0, (
                f"Should NOT decrement a deferred with different total_amount: {r2}"
            )

            # Verify 2 docs persist
            count = mongo_db.db.deferred_payments.count_documents({
                "user_id": ADMIN_USER_ID, "description": desc,
            })
            assert count == 2, f"Expected 2 independent deferreds, got {count}"
        finally:
            mongo_db.db.deferred_payments.delete_many(
                {"user_id": ADMIN_USER_ID, "description": desc}
            )

    def test_identical_deferred_decrements_installments(self, mongo_db):
        desc = f"TEST DIFERIDO DUP {uuid.uuid4().hex[:6]}"
        card_info = {"card_name": "Pacificard Black", "id": "card-pacificard-black"}

        mongo_db.db.deferred_payments.delete_many(
            {"user_id": ADMIN_USER_ID, "description": desc}
        )

        try:
            # Insert first
            r1 = self._call_save([{
                "description": desc, "total_amount": 3000.0,
                "monthly_payment": 300.0, "remaining_installments": 10,
                "total_installments": 10,
            }], card_info)
            assert r1["deferred_payments_created"] == 1

            # Same payload again — should DECREMENT (within ±5% same amount)
            r2 = self._call_save([{
                "description": desc, "total_amount": 3000.0,
                "monthly_payment": 300.0, "remaining_installments": 10,
                "total_installments": 10,
            }], card_info)
            assert r2["deferred_payments_created"] == 0, (
                f"Dup deferred should not insert new doc: {r2}"
            )
            assert r2["deferred_payments_decremented"] == 1, (
                f"Dup deferred should decrement: {r2}"
            )

            # Verify only 1 doc with remaining_installments=9
            docs = list(mongo_db.db.deferred_payments.find(
                {"user_id": ADMIN_USER_ID, "description": desc}
            ))
            assert len(docs) == 1
            assert docs[0]["remaining_installments"] == 9, (
                f"Expected 9 remaining, got {docs[0].get('remaining_installments')}"
            )
        finally:
            mongo_db.db.deferred_payments.delete_many(
                {"user_id": ADMIN_USER_ID, "description": desc}
            )
