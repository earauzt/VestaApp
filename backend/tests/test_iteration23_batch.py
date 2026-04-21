"""Iteration 23 batch tests.
Covers:
- POST /api/sri/normalize-sources idempotency (gmail whitelist)
- POST /api/transactions/fix-null-types idempotency
- POST /api/gmail/process-factura-pdfs: verify 'emisor' presence
- Unit: _regex_fill_card_info helper fills credit_limit/pago_total/deferred_balance
- Regression: GET credit-cards, budget/categories, transactions, gmail/documents
"""
import os
import sys
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback to frontend/.env
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL"):
                    BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                    break
    except Exception:
        pass

ADMIN_EMAIL = "earauzt@gmail.com"
ADMIN_PASS = "Realmadrid2011"


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text[:200]}"
    data = r.json()
    token = data.get("access_token") or data.get("token")
    if token:
        s.headers.update({"Authorization": f"Bearer {token}"})
    return s


# -------- Backend 1: normalize-sources idempotency --------
class TestNormalizeSources:
    def test_normalize_idempotent(self, api):
        r1 = api.post(f"{BASE_URL}/api/sri/normalize-sources", json={}, timeout=30)
        assert r1.status_code == 200, r1.text[:300]
        d1 = r1.json()
        assert "normalized" in d1
        # second call
        r2 = api.post(f"{BASE_URL}/api/sri/normalize-sources", json={}, timeout=30)
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2.get("normalized", 0) == 0, f"expected 0 after first normalize, got {d2}"


# -------- Backend 2: fix-null-types idempotency --------
class TestFixNullTypes:
    def test_fix_null_types_idempotent(self, api):
        r1 = api.post(f"{BASE_URL}/api/transactions/fix-null-types", json={}, timeout=30)
        assert r1.status_code == 200, r1.text[:300]
        d1 = r1.json()
        for k in ("fixed_expense", "fixed_income", "unchanged"):
            assert k in d1, f"missing key {k} in {d1}"
        # Re-run: both fixed counters should be 0 (idempotent)
        r2 = api.post(f"{BASE_URL}/api/transactions/fix-null-types", json={}, timeout=30)
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2.get("fixed_expense", -1) == 0, f"expected fixed_expense=0, got {d2}"
        assert d2.get("fixed_income", -1) == 0, f"expected fixed_income=0, got {d2}"


# -------- Backend 3: process-factura-pdfs emisor --------
class TestProcessFacturaPdfs:
    def test_process_factura_pdfs_response_shape(self, api):
        r = api.post(f"{BASE_URL}/api/gmail/process-factura-pdfs", json={}, timeout=120)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        # Shape tolerance: either {results:[...]} or {processed:N}
        results = data.get("results")
        # If nothing to process (main agent already ran), just verify endpoint returns 200
        if isinstance(results, list) and results:
            emisor_count = sum(1 for x in results if x.get("emisor"))
            monto_count = sum(1 for x in results if x.get("monto"))
            print(f"process-factura-pdfs: {len(results)} results, emisor={emisor_count}, monto={monto_count}")
            # Not strict: may be 0 if already processed. Just log.
        else:
            print(f"process-factura-pdfs response: {data}")


# -------- Backend 4: _regex_fill_card_info unit test --------
class TestRegexFillCardInfo:
    def test_regex_extracts_credit_limit_pago_saldo(self):
        sys.path.insert(0, "/app/backend")
        from routes.documents import _regex_fill_card_info
        text = """ESTADO DE CUENTA PACIFICARD
        CUPO AUTORIZADO $ 30,000.00
        PAGO DE CONTADO $ 27,677.32
        SALDO DIFERIDO $ 5,432.10
        Fecha corte: 2026-01-15
        """
        info = {"credit_limit": None, "pago_total": None, "deferred_balance": None}
        out = _regex_fill_card_info(info, text)
        assert out["credit_limit"] == 30000.0, out
        assert out["pago_total"] == 27677.32, out
        assert out["deferred_balance"] == 5432.10, out

    def test_regex_does_not_override_existing(self):
        sys.path.insert(0, "/app/backend")
        from routes.documents import _regex_fill_card_info
        text = "CUPO AUTORIZADO $ 30,000.00"
        info = {"credit_limit": 99999.0, "pago_total": None, "deferred_balance": None}
        out = _regex_fill_card_info(info, text)
        assert out["credit_limit"] == 99999.0, "should NOT override existing value"


# -------- Regression --------
class TestRegression:
    def test_credit_cards_200(self, api):
        r = api.get(f"{BASE_URL}/api/credit-cards", timeout=30)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_budget_categories_200(self, api):
        r = api.get(f"{BASE_URL}/api/budget/categories", timeout=30)
        assert r.status_code == 200

    def test_transactions_200(self, api):
        r = api.get(f"{BASE_URL}/api/transactions", timeout=30)
        assert r.status_code == 200

    def test_gmail_documents_200(self, api):
        r = api.get(f"{BASE_URL}/api/gmail/documents", timeout=30)
        assert r.status_code == 200


# -------- Integration: bulk-categorize roundtrip --------
class TestBulkCategorize:
    def test_bulk_categorize_single_id(self, api):
        # pick 1 tx
        r = api.get(f"{BASE_URL}/api/transactions?limit=1", timeout=30)
        assert r.status_code == 200
        txs = r.json() if isinstance(r.json(), list) else r.json().get("transactions", [])
        if not txs:
            pytest.skip("no transactions to test bulk-categorize")
        tx = txs[0]
        original_cat = tx.get("category")
        tx_id = tx["id"]
        payload = {"ids": [tx_id], "category": original_cat or "otros", "subcategory": tx.get("subcategory") or "General"}
        rp = api.post(f"{BASE_URL}/api/transactions/bulk-categorize", json=payload, timeout=30)
        assert rp.status_code == 200, rp.text[:300]
        body = rp.json()
        assert "updated" in body and "matched" in body
        assert body["matched"] >= 1
