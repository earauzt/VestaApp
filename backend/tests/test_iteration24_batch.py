"""Iteration 24 backend tests:
1. POST /api/sri/facturas/{doc_id}/categorize (new endpoint)
2. Validation: missing category → 400; invalid id → 404
3. Regression: GET /api/credit-cards shows Pichincha Platinum with reprocessed values
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://objetivo-financiero.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "earauzt@gmail.com"
ADMIN_PASSWORD = "Realmadrid2011"


@pytest.fixture(scope="session")
def auth_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=20)
    if r.status_code != 200:
        pytest.skip(f"Login failed: {r.status_code} {r.text[:200]}")
    data = r.json()
    token = data.get("token") or data.get("access_token")
    if token:
        s.headers.update({"Authorization": f"Bearer {token}"})
    return s


# ====== regression: credit cards ======
class TestCreditCardsRegression:
    def test_pichincha_platinum_reprocessed(self, auth_session):
        r = auth_session.get(f"{BASE_URL}/api/credit-cards", timeout=20)
        assert r.status_code == 200
        cards = r.json()
        assert isinstance(cards, list) and len(cards) > 0
        # locate Pichincha Platinum
        pichincha = None
        for c in cards:
            name = (c.get("nombre") or c.get("name") or c.get("card_name") or "").lower()
            bank = (c.get("banco") or c.get("bank") or "").lower()
            if "pichincha" in name or "pichincha" in bank or "platinum" in name:
                pichincha = c
                break
        assert pichincha is not None, f"Pichincha card not found. Cards: {[c.get('nombre') or c.get('name') for c in cards]}"
        # Verify reprocessed values
        cl = pichincha.get("credit_limit") or pichincha.get("cupo")
        sd = pichincha.get("saldo_diferido") or pichincha.get("deferred_balance")
        pt = pichincha.get("pago_total") or pichincha.get("total_payment")
        assert cl == 5000 or cl == 5000.0, f"credit_limit expected 5000, got {cl}"
        assert abs((sd or 0) - 850.42) < 0.01, f"saldo_diferido expected 850.42, got {sd}"
        assert abs((pt or 0) - 2009.16) < 0.01, f"pago_total expected 2009.16, got {pt}"


# ====== categorize endpoint: validation ======
class TestCategorizeFacturaValidation:
    def test_404_invalid_id(self, auth_session):
        r = auth_session.post(
            f"{BASE_URL}/api/sri/facturas/non-existent-id-xyz/categorize",
            json={"category": "comida"},
            timeout=20,
        )
        assert r.status_code == 404

    def test_400_missing_category(self, auth_session):
        # need a real doc id to get past 404
        docs = auth_session.get(f"{BASE_URL}/api/gmail/documents", timeout=20).json()
        if isinstance(docs, dict):
            docs = docs.get("documents") or docs.get("items") or []
        # filter facturas
        factura_docs = [d for d in docs if d.get("tipo") == "factura" or d.get("doc_type") == "factura" or d.get("numero_factura")]
        if not factura_docs:
            pytest.skip("No factura docs available to test 400")
        doc_id = factura_docs[0]["id"]
        r = auth_session.post(
            f"{BASE_URL}/api/sri/facturas/{doc_id}/categorize",
            json={},
            timeout=20,
        )
        assert r.status_code == 400


# ====== categorize endpoint: happy path ======
class TestCategorizeFacturaHappy:
    def test_categorize_uncategorized_factura(self, auth_session):
        # find an uncategorized factura via facturas-summary
        r = auth_session.get(f"{BASE_URL}/api/gmail/facturas-summary", timeout=20)
        assert r.status_code == 200
        data = r.json()
        docs = data.get("documents") or []
        uncat = [d for d in docs if not d.get("budget_category")]
        if not uncat:
            pytest.skip("All facturas are already categorized; skipping happy path")
        doc = uncat[0]
        doc_id = doc["id"]
        r2 = auth_session.post(
            f"{BASE_URL}/api/sri/facturas/{doc_id}/categorize",
            json={"category": "comida", "subcategory": "restaurantes", "sri_category": "deducible"},
            timeout=20,
        )
        assert r2.status_code == 200, f"Categorize failed: {r2.status_code} {r2.text}"
        body = r2.json()
        assert "tx_id" in body
        assert "linked" in body
        assert isinstance(body["linked"], bool)
        if body["linked"]:
            assert body.get("linked_tx_id")
        # verify gmail_document was updated
        r3 = auth_session.get(f"{BASE_URL}/api/gmail/facturas-summary", timeout=20)
        docs3 = r3.json().get("documents") or []
        updated = next((d for d in docs3 if d["id"] == doc_id), None)
        assert updated is not None
        assert updated.get("budget_category") == "comida"
