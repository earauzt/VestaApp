"""Iteration 25: Gmail content-based dedup + dedup-cleanup endpoint tests.
Verifies idempotency of POST /api/gmail/dedup-cleanup, state of CASADELI/AMOR ANIMAL/AVIANCA/EL DOBLEZ after cleanup,
and that POST /api/gmail/sync helper signature returns duplicados_omitidos.
"""
import os
import re
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN_EMAIL = "earauzt@gmail.com"
ADMIN_PASSWORD = "Realmadrid2011"


@pytest.fixture(scope="module")
def auth_headers():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    if r.status_code != 200:
        pytest.skip(f"login failed: {r.status_code} {r.text[:200]}")
    data = r.json()
    token = data.get("token") or data.get("access_token")
    if not token:
        # cookie-based auth
        return {"_session": s}
    return {"Authorization": f"Bearer {token}"}


def _get(headers, path, **kw):
    if isinstance(headers, dict) and "_session" in headers:
        return headers["_session"].get(f"{BASE_URL}{path}", timeout=60, **kw)
    return requests.get(f"{BASE_URL}{path}", headers=headers, timeout=60, **kw)


def _post(headers, path, **kw):
    if isinstance(headers, dict) and "_session" in headers:
        return headers["_session"].post(f"{BASE_URL}{path}", timeout=120, **kw)
    return requests.post(f"{BASE_URL}{path}", headers=headers, timeout=120, **kw)


class TestDedupCleanupIdempotent:
    def test_dedup_cleanup_idempotent(self, auth_headers):
        r = _post(auth_headers, "/api/gmail/dedup-cleanup")
        assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
        data = r.json()
        assert "clusters" in data and "eliminated" in data
        # Main agent already cleaned 14 dupes; running again must be a no-op
        assert data["clusters"] == 0, f"expected clusters=0 but got {data['clusters']} (samples={data.get('samples')})"
        assert data["eliminated"] == 0, f"expected eliminated=0 but got {data['eliminated']}"


class TestCommerceCounts:
    """After main-agent cleanup: CASADELI=1, AMOR ANIMAL=1, AVIANCA=1, EL DOBLEZ=2 (legitimate distinct amounts)."""

    @pytest.fixture(scope="class")
    def all_txs(self, auth_headers):
        r = _get(auth_headers, "/api/gmail/transactions", params={"limit": 1000})
        assert r.status_code == 200, r.text[:300]
        return r.json().get("transactions", [])

    def _count(self, txs, name):
        rx = re.compile(re.escape(name), re.IGNORECASE)
        return [t for t in txs if t.get("comercio") and rx.search(t["comercio"]) and t.get("estado") != "descartado"]

    def test_casadeli_one_record(self, all_txs):
        rows = self._count(all_txs, "CASADELI")
        assert len(rows) == 1, f"CASADELI expected=1 got={len(rows)}: {[r.get('comercio') + ' $' + str(r.get('monto')) for r in rows]}"

    def test_amor_animal_one_record(self, all_txs):
        rows = self._count(all_txs, "AMOR ANIMAL")
        assert len(rows) == 1, f"AMOR ANIMAL expected=1 got={len(rows)}: {[r.get('comercio') + ' $' + str(r.get('monto')) for r in rows]}"

    def test_avianca_one_record(self, all_txs):
        rows = self._count(all_txs, "AVIANCA")
        assert len(rows) == 1, f"AVIANCA expected=1 got={len(rows)}: {[r.get('comercio') + ' $' + str(r.get('monto')) for r in rows]}"

    def test_el_doblez_two_legit_records(self, all_txs):
        rows = self._count(all_txs, "DOBLEZ")
        assert len(rows) == 2, f"EL DOBLEZ expected=2 got={len(rows)}: {[r.get('comercio') + ' $' + str(r.get('monto')) for r in rows]}"
        amounts = sorted([float(r.get("monto") or 0) for r in rows])
        # Two distinct amounts (12.69 vs 18.74), beyond ±1% tolerance
        assert amounts[0] != amounts[1], f"DOBLEZ amounts collide: {amounts}"
        diff_pct = abs(amounts[1] - amounts[0]) / max(amounts[1], 0.01)
        assert diff_pct > 0.01, f"DOBLEZ amounts within ±1% — should not be 2 records: {amounts}"


class TestGmailSyncShape:
    def test_sync_returns_duplicados_omitidos(self, auth_headers):
        r = _post(auth_headers, "/api/gmail/sync")
        # Could be 200 (success, possibly 0 emails) or 400 if Gmail not connected
        if r.status_code == 400 and "no conectado" in r.text.lower():
            pytest.skip("Gmail not connected for admin user")
        assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
        data = r.json()
        # If there are no new emails, response is {status, total:0, procesados:0, descartados:0, message}
        if data.get("message") == "No hay emails nuevos":
            # field can be absent in the early-return path; that's ok
            assert data.get("total") == 0
            return
        assert "duplicados_omitidos" in data, f"missing duplicados_omitidos in: {list(data.keys())}"
        assert isinstance(data["duplicados_omitidos"], int)


class TestHelperExists:
    def test_content_duplicate_exists_helper_present(self):
        from routes import gmail as gmail_mod
        assert hasattr(gmail_mod, "_content_duplicate_exists")
        assert hasattr(gmail_mod, "_normalize_comercio")
        assert hasattr(gmail_mod, "_parse_fecha_any")
        # Quick sanity on normalize
        assert gmail_mod._normalize_comercio("  Hola   MUNDO  ") == "hola mundo"
