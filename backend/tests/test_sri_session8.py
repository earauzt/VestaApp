"""SESIÓN 8 — SRI deduction limits, sri_categorias, beneficiario & IVA logic."""
import os
import time
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
DEMO_EMAIL = "demo@fintrack.ec"
DEMO_PASS = "demo2026"
ADMIN_EMAIL = "earauzt@gmail.com"
ADMIN_PASS = "Realmadrid2011"


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login failed {r.status_code} {r.text}"
    tok = r.json().get("access_token")
    assert tok
    return tok


@pytest.fixture(scope="module")
def demo_token():
    return _login(DEMO_EMAIL, DEMO_PASS)


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PASS)


def _h(t):
    return {"Authorization": f"Bearer {t}", "Content-Type": "application/json"}


# ---------- 1. /sri/categorias ----------
def test_get_sri_categorias_returns_six_rules(demo_token):
    r = requests.get(f"{BASE_URL}/api/sri/categorias", headers=_h(demo_token), timeout=10)
    assert r.status_code == 200
    cats = r.json().get("categorias", [])
    keys = {c.get("categoria") for c in cats}
    expected = {"salud", "educacion", "alimentacion", "vestimenta", "turismo", "vivienda"}
    assert expected.issubset(keys), f"missing categorias: {expected - keys}"
    by = {c["categoria"]: c for c in cats}
    assert by["salud"]["porcentaje_deducible"] == 1.0 and by["salud"].get("tope_anual") in (None, 0) or by["salud"].get("tope_anual") is None
    assert by["educacion"]["porcentaje_deducible"] == 1.0
    assert by["alimentacion"]["porcentaje_deducible"] == 0.0
    assert by["vestimenta"]["tope_anual"] == 850
    for c in cats:
        for f in ("categoria", "nombre", "porcentaje_deducible", "descripcion"):
            assert f in c, f"missing field {f} in {c}"


# ---------- 2. /sri/deduction-limits new fields ----------
def test_deduction_limits_demo_user_42k(demo_token):
    r = requests.get(f"{BASE_URL}/api/sri/deduction-limits", headers=_h(demo_token), timeout=15)
    assert r.status_code == 200
    d = r.json()
    for f in ("ingresos_gravados_anual", "limite_20pct", "limite_legal", "limite_efectivo"):
        assert f in d, f"missing {f}"
    assert d["limite_legal"] == 2784.0
    # demo income 42000 → limite_20pct=8400, limite_efectivo=2784 (min)
    assert abs(d["ingresos_gravados_anual"] - 42000) < 0.01, d["ingresos_gravados_anual"]
    assert abs(d["limite_20pct"] - 8400) < 0.01
    assert abs(d["limite_efectivo"] - 2784) < 0.01


def test_deduction_limits_admin_user_150k(admin_token):
    r = requests.get(f"{BASE_URL}/api/sri/deduction-limits", headers=_h(admin_token), timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert abs(d["ingresos_gravados_anual"] - 150000) < 0.01
    assert abs(d["limite_20pct"] - 30000) < 0.01
    assert abs(d["limite_efectivo"] - 2784) < 0.01


# ---------- 3. category_progress respects sri_categorias rules ----------
def test_category_progress_excludes_alimentacion_and_includes_sin_tope(demo_token):
    r = requests.get(f"{BASE_URL}/api/sri/deduction-limits", headers=_h(demo_token), timeout=15)
    assert r.status_code == 200
    cp = r.json().get("category_progress", [])
    keys = {c["category"] for c in cp}
    assert "alimentacion" not in keys, "alimentacion (pct=0) should NOT appear in category_progress"
    by = {c["category"]: c for c in cp}
    if "salud" in by:
        assert by["salud"].get("sin_tope") is True
        assert by["salud"].get("limit") is None
    if "educacion" in by:
        assert by["educacion"].get("sin_tope") is True
    if "vestimenta" in by:
        assert by["vestimenta"].get("limit") == 850
    # turismo/vivienda tope 3868.15 (when present)
    for k in ("turismo", "vivienda"):
        if k in by and by[k].get("limit") is not None:
            assert abs(by[k]["limit"] - 3868.15) < 0.5


# ---------- 4 & 5. POST /transactions IVA logic ----------
def _today():
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _delete(token, txid):
    try:
        requests.delete(f"{BASE_URL}/api/transactions/{txid}", headers=_h(token), timeout=10)
    except Exception:
        pass


def _fetch_tx(token, txid):
    """No GET-by-id endpoint; fetch via list and find."""
    r = requests.get(f"{BASE_URL}/api/transactions?limit=2000", headers=_h(token), timeout=15)
    if r.status_code != 200:
        return None
    items = r.json() if isinstance(r.json(), list) else r.json().get("transactions", [])
    for t in items:
        if t.get("id") == txid:
            return t
    return None


def test_post_tx_aplica_iva_false_uses_subtotal(admin_token):
    # baseline
    r0 = requests.get(f"{BASE_URL}/api/sri/deduction-limits", headers=_h(admin_token), timeout=15)
    base = r0.json().get("total_deductible_spent", 0)

    payload = {
        "amount": 112.0,
        "description": "TEST_S8_IVA_FALSE",
        "category": "salud",
        "subcategory": "Medicina",
        "date": _today(),
        "transaction_type": "expense",
        "is_deductible": True,
        "aplica_iva": False,
        "subtotal_sin_iva": 100.0,
        "beneficiario": "yo",
    }
    r = requests.post(f"{BASE_URL}/api/transactions", headers=_h(admin_token), json=payload, timeout=15)
    assert r.status_code in (200, 201), r.text
    txid = r.json().get("id")
    assert txid
    try:
        time.sleep(0.5)
        # verify GET roundtrip via list
        t = _fetch_tx(admin_token, txid)
        if t:
            assert t.get("aplica_iva") is False
            assert abs(float(t.get("subtotal_sin_iva") or 0) - 100.0) < 0.01
            assert t.get("beneficiario") == "yo"

        r1 = requests.get(f"{BASE_URL}/api/sri/deduction-limits", headers=_h(admin_token), timeout=15)
        new_total = r1.json().get("total_deductible_spent", 0)
        delta = new_total - base
        # Should add 100 (subtotal) not 112 (full amount)
        assert abs(delta - 100.0) < 0.5, f"expected delta ~100, got {delta} (base={base}, new={new_total})"
    finally:
        _delete(admin_token, txid)


def test_post_tx_aplica_iva_true_uses_full_amount(admin_token):
    r0 = requests.get(f"{BASE_URL}/api/sri/deduction-limits", headers=_h(admin_token), timeout=15)
    base = r0.json().get("total_deductible_spent", 0)
    payload = {
        "amount": 112.0,
        "description": "TEST_S8_IVA_TRUE",
        "category": "salud",
        "subcategory": "Medicina",
        "date": _today(),
        "transaction_type": "expense",
        "is_deductible": True,
        "aplica_iva": True,
        "beneficiario": "conyuge",
    }
    r = requests.post(f"{BASE_URL}/api/transactions", headers=_h(admin_token), json=payload, timeout=15)
    assert r.status_code in (200, 201), r.text
    txid = r.json().get("id")
    try:
        time.sleep(0.5)
        r1 = requests.get(f"{BASE_URL}/api/sri/deduction-limits", headers=_h(admin_token), timeout=15)
        delta = r1.json().get("total_deductible_spent", 0) - base
        assert abs(delta - 112.0) < 0.5, f"expected delta ~112, got {delta}"
    finally:
        _delete(admin_token, txid)


# ---------- 6. beneficiario field persistence ----------
@pytest.mark.parametrize("benef", ["yo", "conyuge", "hijo", "padre_madre"])
def test_post_tx_beneficiario_persists(admin_token, benef):
    payload = {
        "amount": 25.0, "description": f"TEST_S8_BEN_{benef}",
        "category": "vestimenta", "subcategory": "Ropa",
        "date": _today(), "transaction_type": "expense",
        "beneficiario": benef,
    }
    r = requests.post(f"{BASE_URL}/api/transactions", headers=_h(admin_token), json=payload, timeout=15)
    assert r.status_code in (200, 201), r.text
    txid = r.json().get("id")
    try:
        rg_t = _fetch_tx(admin_token, txid)
        assert rg_t is not None, "tx not found in list"
        assert rg_t.get("beneficiario") == benef
    finally:
        _delete(admin_token, txid)


# ---------- 7. PUT /transactions/{id} updates beneficiario, aplica_iva, subtotal ----------
def test_put_tx_updates_session8_fields(admin_token):
    payload = {
        "amount": 50.0, "description": "TEST_S8_PUT",
        "category": "vivienda", "subcategory": "Servicios basicos",
        "date": _today(), "transaction_type": "expense",
        "beneficiario": "yo", "aplica_iva": True,
    }
    r = requests.post(f"{BASE_URL}/api/transactions", headers=_h(admin_token), json=payload, timeout=15)
    assert r.status_code in (200, 201)
    txid = r.json().get("id")
    try:
        upd = {**payload, "beneficiario": "hijo", "aplica_iva": False, "subtotal_sin_iva": 44.64}
        ru = requests.put(f"{BASE_URL}/api/transactions/{txid}", headers=_h(admin_token), json=upd, timeout=15)
        assert ru.status_code == 200, ru.text
        t = _fetch_tx(admin_token, txid)
        assert t is not None
        assert t.get("beneficiario") == "hijo"
        assert t.get("aplica_iva") is False
        assert abs(float(t.get("subtotal_sin_iva") or 0) - 44.64) < 0.01
    finally:
        _delete(admin_token, txid)


# ---------- 8. uso_empresarial regression (excluded from SRI) ----------
def test_uso_empresarial_excluded_from_sri(admin_token):
    r0 = requests.get(f"{BASE_URL}/api/sri/deduction-limits", headers=_h(admin_token), timeout=15)
    base = r0.json().get("total_deductible_spent", 0)
    payload = {
        "amount": 200.0, "description": "TEST_S8_CORP",
        "category": "salud", "subcategory": "Medicina",
        "date": _today(), "transaction_type": "expense",
        "uso_empresarial": True,
    }
    r = requests.post(f"{BASE_URL}/api/transactions", headers=_h(admin_token), json=payload, timeout=15)
    assert r.status_code in (200, 201)
    txid = r.json().get("id")
    try:
        time.sleep(0.5)
        r1 = requests.get(f"{BASE_URL}/api/sri/deduction-limits", headers=_h(admin_token), timeout=15)
        delta = r1.json().get("total_deductible_spent", 0) - base
        assert abs(delta) < 0.5, f"uso_empresarial tx leaked into SRI total (delta={delta})"
    finally:
        _delete(admin_token, txid)


# ---------- 9. SESIÓN 7 regression: /sri/counters works ----------
def test_sri_counters_regression(admin_token):
    r = requests.get(f"{BASE_URL}/api/sri/counters", headers=_h(admin_token), timeout=10)
    assert r.status_code == 200
    d = r.json()
    for f in ("con_respaldo", "match_aproximado", "pendiente_match", "sin_vincular"):
        assert f in d, f"missing counter {f}"
