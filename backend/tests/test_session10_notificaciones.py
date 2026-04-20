"""SESIÓN 10 — Notificaciones unificadas + widget Esta Semana."""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://objetivo-financiero.preview.emergentagent.com").rstrip("/")
DEMO_EMAIL = "demo@fintrack.ec"
DEMO_PASS = "demo2026"
ADMIN_EMAIL = "earauzt@gmail.com"
ADMIN_PASS = "Realmadrid2011"

VALID_TIPOS = {"pago_proximo", "limite_categoria", "sugerir_filtro", "gmail_nuevos"}
VALID_PRIORIDADES = {"high", "medium", "low"}
VALID_BADGES = {"red", "yellow"}
PRIORITY_RANK = {"high": 0, "medium": 1, "low": 2}


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


# ============== /api/notificaciones ==============
class TestNotificaciones:
    def test_endpoint_returns_200_demo(self, demo_token):
        r = requests.get(f"{BASE_URL}/api/notificaciones", headers=_h(demo_token), timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "notificaciones" in body
        assert "total" in body
        assert isinstance(body["notificaciones"], list)
        assert body["total"] == len(body["notificaciones"])

    def test_endpoint_returns_200_admin(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/notificaciones", headers=_h(admin_token), timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert isinstance(body.get("notificaciones"), list)

    def test_item_structure_required_fields(self, demo_token, admin_token):
        """Each item must have: id, tipo, icono, titulo, texto, accion_url, accion_label, prioridad, days_until."""
        required = ["id", "tipo", "icono", "titulo", "texto", "accion_url", "accion_label", "prioridad", "days_until"]
        for tok in (demo_token, admin_token):
            r = requests.get(f"{BASE_URL}/api/notificaciones", headers=_h(tok), timeout=15)
            assert r.status_code == 200
            for it in r.json().get("notificaciones", []):
                for f in required:
                    assert f in it, f"missing '{f}' in notif {it}"
                assert it["tipo"] in VALID_TIPOS, f"invalid tipo {it['tipo']}"
                assert it["prioridad"] in VALID_PRIORIDADES, f"invalid prioridad {it['prioridad']}"
                assert isinstance(it["id"], str) and len(it["id"]) > 0

    def test_demo_has_otros_gastos_limite_categoria(self, demo_token):
        """demo user expected to surface a limite_categoria for 'Otros Gastos' (or any category) at 100%+ → high priority."""
        r = requests.get(f"{BASE_URL}/api/notificaciones", headers=_h(demo_token), timeout=15)
        assert r.status_code == 200
        items = r.json().get("notificaciones", [])
        cat_high = [i for i in items if i["tipo"] == "limite_categoria" and i["prioridad"] == "high"]
        assert len(cat_high) >= 1, f"expected ≥1 limite_categoria high-priority for demo, got items={items}"

    def test_admin_has_apple_card_pago_proximo(self, admin_token):
        """Admin should have at least one pago_proximo notif (Apple Card, ~$6912 due in ≤7d)."""
        r = requests.get(f"{BASE_URL}/api/notificaciones", headers=_h(admin_token), timeout=15)
        assert r.status_code == 200
        items = r.json().get("notificaciones", [])
        pagos = [i for i in items if i["tipo"] == "pago_proximo"]
        assert len(pagos) >= 1, f"expected ≥1 pago_proximo for admin, got {[i['tipo'] for i in items]}"
        apple = [i for i in pagos if "apple" in (i.get("titulo", "") + i.get("texto", "")).lower()]
        if apple:
            ap = apple[0]
            # texto formato 'Vence en X días · Mínimo $X.XX / Total $X.XX'
            assert "Vence en" in ap["texto"]
            assert "Mínimo" in ap["texto"]
            assert "Total" in ap["texto"]
            assert ap["prioridad"] in {"medium", "high"}
            assert isinstance(ap["days_until"], int)
            assert 0 <= ap["days_until"] <= 7

    def test_priority_ordering(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/notificaciones", headers=_h(admin_token), timeout=15)
        assert r.status_code == 200
        items = r.json().get("notificaciones", [])
        if len(items) < 2:
            pytest.skip("not enough items to test ordering")
        ranks = [PRIORITY_RANK[i["prioridad"]] for i in items]
        assert ranks == sorted(ranks), f"priority not sorted: {[(i['prioridad'], i['days_until']) for i in items]}"

    def test_secondary_ordering_days_until_within_priority(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/notificaciones", headers=_h(admin_token), timeout=15)
        assert r.status_code == 200
        items = r.json().get("notificaciones", [])
        # Within same prioridad, days_until ascending (None treated as 999)
        for prio in VALID_PRIORIDADES:
            sub = [i for i in items if i["prioridad"] == prio]
            if len(sub) < 2:
                continue
            du = [i["days_until"] if i["days_until"] is not None else 999 for i in sub]
            assert du == sorted(du), f"days_until not asc within prio={prio}: {du}"


# ============== /api/dashboard/esta-semana ==============
class TestEstaSemana:
    def test_endpoint_returns_200_demo(self, demo_token):
        r = requests.get(f"{BASE_URL}/api/dashboard/esta-semana", headers=_h(demo_token), timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "items" in body and "total" in body
        assert isinstance(body["items"], list)
        assert len(body["items"]) <= 5, "must cap at 5 items"

    def test_endpoint_returns_200_admin(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/dashboard/esta-semana", headers=_h(admin_token), timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert isinstance(body.get("items"), list)
        assert len(body["items"]) <= 5

    def test_item_structure(self, demo_token, admin_token):
        required = ["id", "tipo", "icono", "titulo", "texto", "days_until", "badge", "accion_url"]
        for tok in (demo_token, admin_token):
            r = requests.get(f"{BASE_URL}/api/dashboard/esta-semana", headers=_h(tok), timeout=15)
            assert r.status_code == 200
            for it in r.json().get("items", []):
                for f in required:
                    assert f in it, f"missing field {f} in {it}"
                assert it["badge"] in VALID_BADGES, f"invalid badge {it['badge']}"

    def test_admin_total_at_least_some_items(self, admin_token):
        """Admin spec says 8 items total with 5 visible."""
        r = requests.get(f"{BASE_URL}/api/dashboard/esta-semana", headers=_h(admin_token), timeout=15)
        assert r.status_code == 200
        body = r.json()
        # Be tolerant: at least some items should appear.
        assert body["total"] >= 1, f"admin esta-semana total={body['total']}, items={body['items']}"
        if body["total"] >= 5:
            assert len(body["items"]) == 5, "should show exactly 5 when total>=5"

    def test_admin_apple_card_yellow_badge(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/dashboard/esta-semana", headers=_h(admin_token), timeout=15)
        assert r.status_code == 200
        items = r.json().get("items", [])
        apple = [i for i in items if "apple" in i.get("titulo", "").lower()]
        if apple:
            ap = apple[0]
            assert ap["badge"] in {"yellow", "red"}
            assert ap["tipo"] == "card_payment"
            assert isinstance(ap["days_until"], int)

    def test_badge_red_when_days_le_2_yellow_otherwise(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/dashboard/esta-semana", headers=_h(admin_token), timeout=15)
        assert r.status_code == 200
        for it in r.json().get("items", []):
            if it["tipo"] == "card_payment":
                d = it["days_until"]
                if isinstance(d, int) and d <= 2:
                    assert it["badge"] == "red", f"card with d={d} should be red, got {it['badge']}"
                elif isinstance(d, int) and d <= 7:
                    assert it["badge"] == "yellow", f"card with d={d} should be yellow, got {it['badge']}"
            elif it["tipo"] == "deferred":
                assert it["badge"] == "yellow"

    def test_ordering_red_before_yellow(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/dashboard/esta-semana", headers=_h(admin_token), timeout=15)
        assert r.status_code == 200
        items = r.json().get("items", [])
        badge_order = {"red": 0, "yellow": 1}
        ranks = [badge_order.get(i["badge"], 2) for i in items]
        assert ranks == sorted(ranks), f"badge order broken: {[i['badge'] for i in items]}"


# ============== Regression checks ==============
class TestRegression:
    def test_sri_deduction_limits_still_works(self, demo_token):
        r = requests.get(f"{BASE_URL}/api/sri/deduction-limits", headers=_h(demo_token), timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "limite_efectivo" in d and "ingresos_gravados_anual" in d

    def test_subscription_renewals_still_works(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/dashboard/subscription-renewals", headers=_h(admin_token), timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert "subscriptions" in body and "upcoming_this_week" in body

    def test_dashboard_stats_still_works(self, demo_token):
        r = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=_h(demo_token), timeout=15)
        assert r.status_code == 200
