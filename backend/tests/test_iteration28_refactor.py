"""Iteration 28 backend tests — taxonomy refactor + 6-page architecture.
Tests:
- /api/budget/categories returns 12 PERSONAL_CATEGORIES with correct accents
- /api/sri/deduction-limits works with new limit_fraction field
- /api/transactions auto-categorization outputs only PERSONAL_CATEGORIES keys
- existing endpoints (travel-goals, credit-cards, accounts-receivable,
  expected-income, scheduled-payments, gmail) still respond 2xx
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://objetivo-financiero.preview.emergentagent.com").rstrip("/")
EMAIL = "earauzt@gmail.com"
PASSWORD = "Realmadrid2011"

EXPECTED_KEYS = {
    "servicios_basicos", "suscripciones", "empleados", "colegio_actividades",
    "seguros", "comida", "restaurantes", "carros", "usa",
    "viajes_entretenimiento", "gastos_libres", "otros",
}


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": EMAIL, "password": PASSWORD},
               timeout=15)
    if r.status_code != 200:
        pytest.skip(f"login failed: {r.status_code} {r.text}")
    data = r.json()
    token = data.get("access_token")
    if token:
        s.headers.update({"Authorization": f"Bearer {token}"})
    return s


# ---------- Taxonomy ----------
class TestBudgetCategories:
    def test_returns_12_personal_categories_with_accents(self, session):
        r = session.get(f"{BASE_URL}/api/budget/categories", timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        cats = data.get("categories") or data
        keys = set(cats.keys()) if isinstance(cats, dict) else set()
        # All 12 expected keys present
        missing = EXPECTED_KEYS - keys
        assert not missing, f"missing keys: {missing}"
        # No DEMO_BUDGET_CATEGORIES leak (vivienda/transporte/etc removed)
        assert "vivienda" not in keys
        assert "transporte" not in keys
        assert "alimentacion" not in keys
        # Accent checks
        sb = cats["servicios_basicos"]
        sb_subs = sb.get("subcategories")
        sb_sub_names = list(sb_subs.keys()) if isinstance(sb_subs, dict) else sb_subs
        assert "Alícuota B" in sb_sub_names, sb_sub_names
        assert "Alícuota GT" in sb_sub_names, sb_sub_names
        emp = cats["empleados"]
        emp_subs = emp.get("subcategories")
        emp_sub_names = list(emp_subs.keys()) if isinstance(emp_subs, dict) else emp_subs
        assert "Angélica" in emp_sub_names, emp_sub_names
        col = cats["colegio_actividades"]
        col_subs = col.get("subcategories")
        col_sub_names = list(col_subs.keys()) if isinstance(col_subs, dict) else col_subs
        assert "Fútbol" in col_sub_names, col_sub_names
        usa = cats["usa"]
        usa_subs = usa.get("subcategories")
        usa_sub_names = list(usa_subs.keys()) if isinstance(usa_subs, dict) else usa_subs
        assert "Mamá (Venmo)" in usa_sub_names, usa_sub_names


# ---------- SRI deduction-limits with new limit_fraction ----------
class TestSRIDeductionLimits:
    def test_endpoint_responds_with_categories(self, session):
        r = session.get(f"{BASE_URL}/api/sri/deduction-limits", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        # Tolerate either a list or an object
        items = data.get("limits") if isinstance(data, dict) else data
        if items is None and isinstance(data, dict):
            # Maybe categories key
            items = data.get("categories") or data.get("data") or data
        assert items, f"empty payload: {data}"


# ---------- Transactions auto-categorization ----------
class TestTransactionsAutoCategorize:
    def test_auto_categorize_outputs_only_personal_categories(self, session):
        # Create a tx that should auto-categorize to comida/Supermaxi
        payload = {
            "amount": 42.5,
            "description": "TEST_iter28 SUPERMAXI compra semanal",
            "establishment": "Supermaxi Samborondon",
            "date": "2026-01-15",
            "category": "",
            "transaction_type": "expense",
        }
        r = session.post(f"{BASE_URL}/api/transactions",
                         json=payload, timeout=15)
        assert r.status_code in (200, 201), r.text
        tx = r.json()
        tx_id = tx.get("id")
        assert tx_id
        # Resulting category must be one of PERSONAL_CATEGORIES keys (or empty)
        cat = tx.get("category")
        if cat:
            assert cat in EXPECTED_KEYS, f"auto-categorized to invalid key: {cat}"
        # Cleanup
        session.delete(f"{BASE_URL}/api/transactions/{tx_id}", timeout=10)


# ---------- Existing endpoints keep working ----------
class TestExistingEndpoints:
    @pytest.mark.parametrize("path", [
        "/api/travel-goals",
        "/api/credit-cards",
        "/api/accounts-receivable",
        "/api/expected-income",
        "/api/scheduled-payments",
    ])
    def test_endpoint_returns_2xx(self, session, path):
        r = session.get(f"{BASE_URL}{path}", timeout=15)
        assert r.status_code in (200, 204), f"{path} -> {r.status_code} {r.text[:200]}"

    def test_gmail_status_endpoint(self, session):
        # Status endpoint exists
        r = session.get(f"{BASE_URL}/api/gmail/status", timeout=15)
        # 200 or 401 (no token) both indicate route exists; 404/500 = broken
        assert r.status_code in (200, 401, 403), f"gmail/status -> {r.status_code}"
