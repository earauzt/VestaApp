from helpers import generate_sri_alerts, income_matches_year
from parsers import _clean_comercio, _consumo_desc


def test_sri_alerts_tolerate_none_limit():
    alerts = generate_sri_alerts(
        [{"name": "Salud", "percentage": 140, "spent": 5000, "limit": None, "remaining": None}],
        total_deductible=5000,
        limite_global=2784,
    )
    assert any("LIMITE EXCEDIDO" in a["message"] for a in alerts)
    assert all("None" not in a["message"] for a in alerts)


def test_sri_alerts_skip_when_global_limit_zero():
    alerts = generate_sri_alerts([], total_deductible=100, limite_global=0)
    assert alerts == []


def test_income_year_matches_string_and_datetime():
    from datetime import datetime, timezone
    assert income_matches_year({"date": "2026-04-01"}, 2026)
    assert not income_matches_year({"date": "2025-12-31"}, 2026)
    assert income_matches_year({"date": "2026-01-01T00:00:00+00:00"}, 2026)
    assert income_matches_year({"date": datetime(2026, 4, 1, tzinfo=timezone.utc)}, 2026)
    assert not income_matches_year({"date": datetime(2025, 12, 31)}, 2026)


def test_consumo_desc_omits_question_mark():
    assert "?" not in _consumo_desc("Bolivariano", None, 9.14)
    assert _consumo_desc("Bolivariano", None, 9.14) == "Consumo Bolivariano $9.14"
    assert _clean_comercio("?") is None
    assert "?" not in _consumo_desc("Bolivariano", _clean_comercio("?"), 9.14)


def test_clean_comercio_rejects_email_bodies():
    body = "Estimado cliente " + ("boilerplate anti-phishing www.dinersclub.com.ec " * 20)
    cleaned = _clean_comercio(body)
    assert cleaned is None or len(cleaned) <= 60
    if cleaned:
        assert "phishing" not in cleaned.lower()
