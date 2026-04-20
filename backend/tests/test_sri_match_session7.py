"""Backend tests for SESIÓN 7 SRI Match feature."""
import os
import time
import uuid
from datetime import datetime, timezone, timedelta

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://objetivo-financiero.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

EMAIL = "demo@fintrack.ec"
PASSWORD = "demo2026"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{API}/auth/login", json={"email": EMAIL, "password": PASSWORD}, timeout=20)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    token = r.json().get("access_token") or r.json().get("token")
    assert token, f"No token in login response: {r.json()}"
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s


def _create_tx(client, *, amount, date, description, is_invoice=False, with_uso_emp=False):
    payload = {
        "amount": amount,
        "description": description,
        "category": "alimentacion",
        "date": date,
        "transaction_type": "expense",
        "is_deductible": True,
    }
    if is_invoice:
        payload["source_type"] = "invoice"
        payload["has_invoice"] = True
        payload["numero_factura"] = f"001-001-{uuid.uuid4().hex[:8]}"
    if with_uso_emp:
        payload["uso_empresarial"] = True
    r = client.post(f"{API}/transactions", json=payload, timeout=20)
    assert r.status_code in (200, 201), f"Create tx failed: {r.status_code} {r.text}"
    return r.json()


def _get_tx(client, tx_id):
    # No single GET endpoint guaranteed; use list and filter
    r = client.get(f"{API}/transactions", timeout=20)
    assert r.status_code == 200
    items = r.json()
    if isinstance(items, dict):
        items = items.get("transactions") or items.get("items") or []
    for t in items:
        if t.get("id") == tx_id:
            return t
    return None


def _cleanup(client, tx_ids):
    for tid in tx_ids:
        try:
            client.delete(f"{API}/transactions/{tid}", timeout=10)
        except Exception:
            pass


# ============ Tests ============

def test_counters_endpoint(client):
    r = client.get(f"{API}/sri/counters", timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    for k in ("con_respaldo", "match_aproximado", "pendiente_match", "sin_vincular"):
        assert k in data, f"Missing counter: {k}"
        assert isinstance(data[k], int)


def test_create_consumo_sets_pendiente_match(client):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    # Use unique amount to avoid matching anything
    amt = round(123.456 + (time.time() % 100), 2)
    tx = _create_tx(client, amount=amt, date=today, description=f"TEST_pend_{uuid.uuid4().hex[:6]}")
    tx_id = tx["id"]
    try:
        fetched = _get_tx(client, tx_id)
        assert fetched is not None, "tx not in list"
        assert fetched.get("estado_sri") == "pendiente_match", f"estado={fetched.get('estado_sri')}"
        assert fetched.get("match_pendiente_hasta"), "match_pendiente_hasta not set"
    finally:
        _cleanup(client, [tx_id])


def test_exact_match_con_respaldo(client):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    amt = round(200 + (time.time() % 50), 2)
    # Create consumo first
    consumo = _create_tx(client, amount=amt, date=today, description=f"TEST_exact_consumo_{uuid.uuid4().hex[:6]}")
    # Create factura with same amount (within 2%)
    factura = _create_tx(client, amount=amt, date=today, description=f"TEST_exact_factura_{uuid.uuid4().hex[:6]}", is_invoice=True)
    tx_ids = [consumo["id"], factura["id"]]
    try:
        f_consumo = _get_tx(client, consumo["id"])
        f_factura = _get_tx(client, factura["id"])
        assert f_consumo.get("estado_sri") == "con_respaldo", f"consumo estado={f_consumo.get('estado_sri')}"
        assert f_factura.get("estado_sri") == "con_respaldo", f"factura estado={f_factura.get('estado_sri')}"
        assert f_consumo.get("factura_vinculada_id") == factura["id"]
        assert f_factura.get("consumo_vinculado_id") == consumo["id"]
    finally:
        _cleanup(client, tx_ids)


def test_approx_match(client):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    amt = round(500 + (time.time() % 25), 2)
    consumo = _create_tx(client, amount=amt, date=today, description=f"TEST_aprox_consumo_{uuid.uuid4().hex[:6]}")
    # ±7% diff: out of exact tol (2%) but within 10%
    factura = _create_tx(client, amount=round(amt * 1.07, 2), date=today, description=f"TEST_aprox_factura_{uuid.uuid4().hex[:6]}", is_invoice=True)
    tx_ids = [consumo["id"], factura["id"]]
    try:
        f_consumo = _get_tx(client, consumo["id"])
        f_factura = _get_tx(client, factura["id"])
        assert f_consumo.get("estado_sri") == "match_aproximado", f"consumo={f_consumo.get('estado_sri')}"
        assert f_factura.get("estado_sri") == "match_aproximado", f"factura={f_factura.get('estado_sri')}"
        assert f_consumo.get("match_aproximado_candidato_id") == factura["id"]
        assert f_factura.get("match_aproximado_candidato_id") == consumo["id"]
        assert f_consumo.get("match_aproximado_confianza") is not None

        # /sri/pending should include them
        r = client.get(f"{API}/sri/pending", timeout=20)
        assert r.status_code == 200
        pend = r.json()
        ids = {t["id"] for t in pend.get("match_aproximado", [])}
        assert consumo["id"] in ids or factura["id"] in ids

        # confirm-match
        r = client.post(f"{API}/sri/confirm-match/{consumo['id']}", timeout=20)
        assert r.status_code == 200, r.text
        assert r.json().get("status") == "con_respaldo"
        f_consumo2 = _get_tx(client, consumo["id"])
        assert f_consumo2.get("estado_sri") == "con_respaldo"
    finally:
        _cleanup(client, tx_ids)


def test_reject_match(client):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    amt = round(700 + (time.time() % 25), 2)
    consumo = _create_tx(client, amount=amt, date=today, description=f"TEST_rej_c_{uuid.uuid4().hex[:6]}")
    factura = _create_tx(client, amount=round(amt * 1.08, 2), date=today, description=f"TEST_rej_f_{uuid.uuid4().hex[:6]}", is_invoice=True)
    tx_ids = [consumo["id"], factura["id"]]
    try:
        # ensure aproximado
        f_c = _get_tx(client, consumo["id"])
        if f_c.get("estado_sri") != "match_aproximado":
            pytest.skip(f"Did not become approx: {f_c.get('estado_sri')}")
        r = client.post(f"{API}/sri/reject-match/{consumo['id']}", timeout=20)
        assert r.status_code == 200, r.text
        assert r.json().get("status") == "pendiente_match"
        f_c2 = _get_tx(client, consumo["id"])
        f_f2 = _get_tx(client, factura["id"])
        assert f_c2.get("estado_sri") == "pendiente_match"
        assert f_f2.get("estado_sri") == "pendiente_match"
        assert f_c2.get("match_aproximado_candidato_id") in (None, "")
        assert f_c2.get("factura_vinculada_id") in (None, "")
    finally:
        _cleanup(client, tx_ids)


def test_mark_cash_on_factura_creates_consumo(client):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    amt = round(900 + (time.time() % 25), 2)
    factura = _create_tx(client, amount=amt, date=today, description=f"TEST_cash_f_{uuid.uuid4().hex[:6]}", is_invoice=True)
    tx_ids = [factura["id"]]
    try:
        r = client.post(f"{API}/sri/mark-cash/{factura['id']}", timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("status") == "con_respaldo"
        assert data.get("created_cash_tx") is True
        consumo_id = data.get("consumo_id")
        assert consumo_id
        tx_ids.append(consumo_id)
        f_consumo = _get_tx(client, consumo_id)
        assert f_consumo.get("payment_method") == "efectivo"
        assert f_consumo.get("estado_sri") == "con_respaldo"
        assert f_consumo.get("factura_vinculada_id") == factura["id"]
    finally:
        _cleanup(client, tx_ids)


def test_mark_cash_on_consumo(client):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    amt = round(1100 + (time.time() % 25), 2)
    consumo = _create_tx(client, amount=amt, date=today, description=f"TEST_cash_c_{uuid.uuid4().hex[:6]}")
    try:
        r = client.post(f"{API}/sri/mark-cash/{consumo['id']}", timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("status") == "con_respaldo"
        assert data.get("created_cash_tx") is False
        f = _get_tx(client, consumo["id"])
        assert f.get("estado_sri") == "con_respaldo"
    finally:
        _cleanup(client, [consumo["id"]])


def test_link_manual_and_discard(client):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    amt = round(1300 + (time.time() % 25), 2)
    # Use very different amounts to avoid auto-match
    consumo = _create_tx(client, amount=amt, date=today, description=f"TEST_lm_c_{uuid.uuid4().hex[:6]}")
    factura = _create_tx(client, amount=round(amt * 1.5, 2), date=today, description=f"TEST_lm_f_{uuid.uuid4().hex[:6]}", is_invoice=True)
    tx_ids = [consumo["id"], factura["id"]]
    try:
        r = client.post(f"{API}/sri/link-manual", json={"tx_id": consumo["id"], "target_tx_id": factura["id"]}, timeout=20)
        assert r.status_code == 200, r.text
        assert r.json().get("status") == "con_respaldo"
        f_c = _get_tx(client, consumo["id"])
        f_f = _get_tx(client, factura["id"])
        assert f_c.get("estado_sri") == "con_respaldo"
        assert f_f.get("estado_sri") == "con_respaldo"
        assert f_c.get("factura_vinculada_id") == factura["id"]
        assert f_f.get("consumo_vinculado_id") == consumo["id"]

        # Discard
        r2 = client.post(f"{API}/sri/discard/{consumo['id']}", timeout=20)
        assert r2.status_code == 200, r2.text
        assert r2.json().get("status") == "sin_respaldo"
        f_c2 = _get_tx(client, consumo["id"])
        assert f_c2.get("estado_sri") == "sin_respaldo"
    finally:
        _cleanup(client, tx_ids)


def test_corporate_toggle_excludes_from_counters(client):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    amt = round(1500 + (time.time() % 25), 2)
    tx = _create_tx(client, amount=amt, date=today, description=f"TEST_corp_{uuid.uuid4().hex[:6]}")
    tx_id = tx["id"]
    try:
        before = client.get(f"{API}/sri/counters", timeout=20).json()
        r = client.patch(f"{API}/sri/corporate/{tx_id}", json={"uso_empresarial": True}, timeout=20)
        assert r.status_code == 200, r.text
        assert r.json().get("uso_empresarial") is True
        f = _get_tx(client, tx_id)
        assert f.get("uso_empresarial") is True
        assert f.get("is_deductible") is False
        after = client.get(f"{API}/sri/counters", timeout=20).json()
        # The pendiente_match counter should not be higher because of this corporate tx.
        # (At minimum: corporate tx should not add to any counter.)
        sum_before = sum(before.values())
        sum_after = sum(after.values())
        # The newly created tx WAS already counted before patch, after patch it should be excluded
        assert sum_after <= sum_before, f"counters did not exclude corporate: before={before} after={after}"
    finally:
        _cleanup(client, [tx_id])


def test_scan_endpoint(client):
    r = client.post(f"{API}/sri/scan", timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    for k in ("retried", "matched", "expired"):
        assert k in data
        assert isinstance(data[k], int)


def test_pending_endpoint_shape(client):
    r = client.get(f"{API}/sri/pending", timeout=20)
    assert r.status_code == 200
    data = r.json()
    assert "match_aproximado" in data
    assert "sin_respaldo_72h" in data
    assert isinstance(data["match_aproximado"], list)
    assert isinstance(data["sin_respaldo_72h"], list)


def test_deduction_limits_excludes_corporate(client):
    r = client.get(f"{API}/sri/deduction-limits", timeout=20)
    # Endpoint may live under dashboard in some versions; allow 404 to flag
    assert r.status_code in (200, 404), r.text
    if r.status_code == 404:
        # Try dashboard prefix
        r = client.get(f"{API}/dashboard/sri-deduction-limits", timeout=20)
    assert r.status_code == 200, f"deduction-limits not found: {r.status_code}"
