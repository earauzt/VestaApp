"""
Test SESSION 6 - Travel Goals (Metas y Ahorro) CRUD
- POST /api/travel-goals (create with tipo)
- GET /api/travel-goals (list with monthly_needed/days_remaining/progress_percent/total_spent)
- PUT /api/travel-goals/{id}
- POST /api/travel-goals/{id}/add-savings
- POST /api/travel-goals/{id}/link-transaction
- GET /api/travel-goals/{id}/transactions
- DELETE /api/travel-goals/{id}
"""
import os
import pytest
import requests
from datetime import datetime, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://objetivo-financiero.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "earauzt@gmail.com"
ADMIN_PASSWORD = "Realmadrid2011"


@pytest.fixture(scope="module")
def auth_headers():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    token = r.json()["access_token"]
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def created_goal(auth_headers):
    """Create a goal once for the suite, return its data."""
    target_date = (datetime.utcnow() + timedelta(days=180)).strftime("%Y-%m-%dT%H:%M:%S")
    payload = {
        "destination": "TEST_Educacion Hijo",
        "target_amount": 6000.0,
        "target_date": target_date,
        "tipo": "educacion",
        "notes": "TEST_Meta de prueba SESION 6",
    }
    r = requests.post(f"{BASE_URL}/api/travel-goals", headers=auth_headers, json=payload, timeout=30)
    assert r.status_code == 200, f"Create failed: {r.status_code} {r.text}"
    data = r.json()
    assert data["destination"] == payload["destination"]
    assert data["target_amount"] == payload["target_amount"]
    assert data["tipo"] == "educacion", f"tipo not persisted, got {data.get('tipo')}"
    assert data["saved_amount"] == 0
    assert data["status"] == "active"
    assert "id" in data
    yield data
    # Cleanup
    requests.delete(f"{BASE_URL}/api/travel-goals/{data['id']}", headers=auth_headers, timeout=30)


def test_create_goal_persists_tipo(created_goal):
    assert created_goal["tipo"] == "educacion"


def test_list_goals_includes_calculated_fields(auth_headers, created_goal):
    r = requests.get(f"{BASE_URL}/api/travel-goals", headers=auth_headers, timeout=30)
    assert r.status_code == 200
    body = r.json()
    assert "goals" in body and "count" in body
    assert isinstance(body["goals"], list)
    found = next((g for g in body["goals"] if g["id"] == created_goal["id"]), None)
    assert found is not None, "Created goal not found in list"
    # Calculated fields
    for k in ("monthly_needed", "days_remaining", "progress_percent", "total_spent"):
        assert k in found, f"Missing calculated field: {k}"
    assert found["days_remaining"] > 0
    assert found["monthly_needed"] > 0
    assert found["progress_percent"] == 0
    assert found["total_spent"] == 0


def test_update_goal(auth_headers, created_goal):
    updates = {"notes": "TEST_Notas actualizadas"}
    r = requests.put(f"{BASE_URL}/api/travel-goals/{created_goal['id']}", headers=auth_headers, json=updates, timeout=30)
    assert r.status_code == 200
    # verify
    r2 = requests.get(f"{BASE_URL}/api/travel-goals", headers=auth_headers, timeout=30)
    found = next((g for g in r2.json()["goals"] if g["id"] == created_goal["id"]), None)
    assert found is not None
    assert found["notes"] == "TEST_Notas actualizadas"


def test_add_savings(auth_headers, created_goal):
    r = requests.post(f"{BASE_URL}/api/travel-goals/{created_goal['id']}/add-savings", headers=auth_headers, json={"amount": 250.0}, timeout=30)
    assert r.status_code == 200
    body = r.json()
    assert body["new_saved"] >= 250.0
    assert body["status"] in ("active", "completed")


def test_add_savings_invalid_amount(auth_headers, created_goal):
    r = requests.post(f"{BASE_URL}/api/travel-goals/{created_goal['id']}/add-savings", headers=auth_headers, json={"amount": 0}, timeout=30)
    assert r.status_code == 400


def test_link_transaction_and_get_linked(auth_headers, created_goal):
    # Find an existing transaction to link
    r = requests.get(f"{BASE_URL}/api/transactions", headers=auth_headers, timeout=30)
    assert r.status_code == 200
    txs = r.json()
    # API may return a list or dict
    if isinstance(txs, dict):
        txs = txs.get("transactions") or txs.get("items") or []
    if not txs:
        pytest.skip("No transactions in account to link")
    tx_id = txs[0]["id"]

    # Link
    r2 = requests.post(
        f"{BASE_URL}/api/travel-goals/{created_goal['id']}/link-transaction",
        headers=auth_headers, json={"transaction_id": tx_id}, timeout=30,
    )
    assert r2.status_code == 200, r2.text
    assert tx_id in r2.json()["linked_transactions"]

    # GET linked transactions
    r3 = requests.get(f"{BASE_URL}/api/travel-goals/{created_goal['id']}/transactions", headers=auth_headers, timeout=30)
    assert r3.status_code == 200
    body = r3.json()
    assert "transactions" in body and "total" in body
    assert any(t["id"] == tx_id for t in body["transactions"])

    # Verify list endpoint shows total_spent updated
    r4 = requests.get(f"{BASE_URL}/api/travel-goals", headers=auth_headers, timeout=30)
    found = next((g for g in r4.json()["goals"] if g["id"] == created_goal["id"]), None)
    assert found["total_spent"] == body["total"]


def test_link_transaction_missing_id(auth_headers, created_goal):
    r = requests.post(
        f"{BASE_URL}/api/travel-goals/{created_goal['id']}/link-transaction",
        headers=auth_headers, json={}, timeout=30,
    )
    assert r.status_code == 400


def test_link_transaction_not_found(auth_headers, created_goal):
    r = requests.post(
        f"{BASE_URL}/api/travel-goals/{created_goal['id']}/link-transaction",
        headers=auth_headers, json={"transaction_id": "non-existent-id-xyz"}, timeout=30,
    )
    assert r.status_code == 404


def test_delete_goal(auth_headers):
    """Independent delete test (separate goal)."""
    target_date = (datetime.utcnow() + timedelta(days=90)).strftime("%Y-%m-%dT%H:%M:%S")
    r = requests.post(f"{BASE_URL}/api/travel-goals", headers=auth_headers, json={
        "destination": "TEST_DeleteMe", "target_amount": 1000, "target_date": target_date, "tipo": "otro",
    }, timeout=30)
    assert r.status_code == 200
    gid = r.json()["id"]
    rd = requests.delete(f"{BASE_URL}/api/travel-goals/{gid}", headers=auth_headers, timeout=30)
    assert rd.status_code == 200
    # verify gone
    r2 = requests.get(f"{BASE_URL}/api/travel-goals", headers=auth_headers, timeout=30)
    assert not any(g["id"] == gid for g in r2.json()["goals"])


def test_delete_nonexistent_returns_404(auth_headers):
    r = requests.delete(f"{BASE_URL}/api/travel-goals/non-existent-xyz", headers=auth_headers, timeout=30)
    assert r.status_code == 404
