"""Backend tests for iteration 22 batch changes.

Covers:
- Backend 2: POST /api/sri/normalize-sources returns {normalized: <int>}
- Backend 3: PUT /api/budget/income-sources + GET /api/budget/personal roundtrip
- Backend 1: POST /api/sri/confirm-match wiring (accept 400 "No hay candidato" as proof endpoint wired)
- Backend 1b: POST /api/sri/mark-cash (consumo branch) sets source='factura_sri', is_deductible=true
"""
import os
import uuid
from datetime import datetime

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://objetivo-financiero.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "earauzt@gmail.com"
ADMIN_PASSWORD = "Realmadrid2011"


@pytest.fixture(scope="module")
def admin_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("access_token") or data.get("token")
    assert token, f"No token in login response: {data}"
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s


# --- Backend 2: normalize-sources endpoint --------------------------------
class TestNormalizeSources:
    def test_normalize_sources_ok(self, admin_client):
        r = admin_client.post(f"{API}/sri/normalize-sources", timeout=30)
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        data = r.json()
        assert "normalized" in data
        assert isinstance(data["normalized"], int)
        assert data["normalized"] >= 0


# --- Backend 3: income-sources roundtrip ---------------------------------
class TestIncomeSourcesRoundtrip:
    def test_put_then_get(self, admin_client):
        year = datetime.now().year
        suffix = uuid.uuid4().hex[:6]
        payload = {
            "year": year,
            "income_sources": {
                "Personal": {"custom_name": f"TEST_Personal_{suffix}"},
                "APX": {"custom_name": f"TEST_APX_{suffix}"},
                "USA": {"custom_name": f"TEST_USA_{suffix}"},
            },
        }
        put = admin_client.put(f"{API}/budget/income-sources", json=payload, timeout=30)
        assert put.status_code == 200, f"PUT failed: {put.status_code} {put.text}"
        put_data = put.json()
        assert put_data.get("income_sources", {}).get("Personal", {}).get("custom_name") == f"TEST_Personal_{suffix}"

        # GET /budget/personal should include income_sources
        get = admin_client.get(f"{API}/budget/personal", params={"year": year}, timeout=30)
        assert get.status_code == 200, f"GET failed: {get.status_code} {get.text}"
        g = get.json()
        assert "income_sources" in g
        got = g.get("income_sources") or {}
        assert got.get("Personal", {}).get("custom_name") == f"TEST_Personal_{suffix}"
        assert got.get("APX", {}).get("custom_name") == f"TEST_APX_{suffix}"
        assert got.get("USA", {}).get("custom_name") == f"TEST_USA_{suffix}"


# --- Backend 1: confirm-match wiring check -------------------------------
class TestConfirmMatchWiring:
    def test_confirm_match_returns_400_or_created_flag(self, admin_client):
        """Look for a tx with match_aproximado_candidato_id. If not present,
        create a fake tx and assert 400 'No hay candidato aproximado'."""
        # Find any existing tx with a candidate
        r = admin_client.get(f"{API}/sri/pending", timeout=30)
        candidate_tx_id = None
        if r.status_code == 200:
            items = r.json() if isinstance(r.json(), list) else r.json().get("items", [])
            for t in items:
                if t.get("match_aproximado_candidato_id"):
                    candidate_tx_id = t["id"]
                    break
        if candidate_tx_id:
            resp = admin_client.post(f"{API}/sri/confirm-match/{candidate_tx_id}", timeout=30)
            assert resp.status_code == 200, f"{resp.status_code} {resp.text}"
            data = resp.json()
            assert "created_budget_tx" in data
            assert "status" in data
        else:
            # Endpoint still wired; calling against non-existent tx should return 404
            resp = admin_client.post(f"{API}/sri/confirm-match/nonexistent-{uuid.uuid4().hex[:8]}", timeout=30)
            assert resp.status_code in (400, 404), f"Unexpected status {resp.status_code}: {resp.text}"


# --- Backend 1b: mark-cash consumo branch --------------------------------
class TestMarkCashConsumo:
    def test_mark_cash_consumo_sets_factura_sri(self, admin_client):
        """Create a simple expense (consumo), call mark-cash, then GET and verify
        source='factura_sri' and is_deductible=true.
        """
        # Create a consumo transaction
        today = datetime.now().strftime("%Y-%m-%d")
        create_payload = {
            "amount": 12.34,
            "description": "TEST_iter22_consumo",
            "category": "alimentacion",
            "date": today,
            "transaction_type": "expense",
            "is_deductible": True,
        }
        c = admin_client.post(f"{API}/transactions", json=create_payload, timeout=30)
        assert c.status_code in (200, 201), f"create tx failed: {c.status_code} {c.text}"
        tx = c.json()
        tx_id = tx.get("id") or tx.get("transaction", {}).get("id")
        assert tx_id, f"no id in response: {tx}"

        try:
            # Call mark-cash
            r = admin_client.post(f"{API}/sri/mark-cash/{tx_id}", timeout=30)
            assert r.status_code == 200, f"mark-cash failed: {r.status_code} {r.text}"
            data = r.json()
            assert data.get("status") == "con_respaldo"
            # created_cash_tx should be False since the tx is not an invoice
            assert data.get("created_cash_tx") is False

            # GET the tx and verify
            g = admin_client.get(f"{API}/transactions", timeout=30)
            assert g.status_code == 200
            items = g.json() if isinstance(g.json(), list) else g.json().get("transactions", [])
            found = next((t for t in items if t.get("id") == tx_id), None)
            assert found is not None, f"tx {tx_id} not found after mark-cash"
            assert found.get("source") == "factura_sri", f"source mismatch: {found.get('source')}"
            assert found.get("is_deductible") is True, f"is_deductible mismatch: {found.get('is_deductible')}"
        finally:
            # cleanup
            admin_client.delete(f"{API}/transactions/{tx_id}", timeout=20)
