from datetime import date, datetime

from helpers import (
    VESTA_PROCESSED_LABEL_ID,
    entity_tag_from_card_notice,
    generate_sri_alerts,
    income_matches_year,
    last_pool_gmail_list_kwargs,
    last_pool_tx_from_parsed,
    leave_uncategorized,
    normalize_tx_date,
)
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


def test_last_pool_gmail_list_uses_label_6():
    kw = last_pool_gmail_list_kwargs(newer_than_days=14, now=datetime(2026, 8, 22, 12, 0, 0))
    assert VESTA_PROCESSED_LABEL_ID == "Label_6"
    assert kw["labelIds"] == ["Label_6"]
    assert kw["q"] == "after:2026/08/08"
    assert kw["userId"] == "me"
    assert kw["maxResults"] == 200


def test_entity_tag_from_card_notice_titular_and_adicional():
    assert entity_tag_from_card_notice("Pacificard TITULAR 545178XXXXXXX325") == "titular"
    assert entity_tag_from_card_notice("tarjeta ADICIONAL …766 Sailor Coffee") == "adicional_kp"
    assert entity_tag_from_card_notice("consumo Uber") is None


def test_leave_uncategorized_definitive_149_47():
    assert leave_uncategorized("DEFINITIVE GUAYAQUIL", 149.47) is True
    assert leave_uncategorized("Definitive", "149.47") is True
    assert leave_uncategorized("ITZA HOTEL", 318.07) is False
    assert leave_uncategorized("DEFINITIVE", 10.00) is False
    assert leave_uncategorized("CURSOR AI", 60) is False


def test_normalize_tx_date_iso_datetime_and_header():
    assert normalize_tx_date("2026-08-21") == "2026-08-21"
    assert normalize_tx_date(datetime(2026, 8, 21, 15, 4, 0)) == "2026-08-21"
    assert normalize_tx_date(date(2026, 8, 21)) == "2026-08-21"
    assert normalize_tx_date("21/08/2026") == "2026-08-21"
    assert normalize_tx_date("Thu, 21 Aug 2026 14:32:00 -0500") == "2026-08-21"
    assert normalize_tx_date(None, fallback="2026-08-20") == "2026-08-20"
    assert normalize_tx_date(None) is None


def test_last_pool_tx_pending_review_and_uncategorized():
    tx = last_pool_tx_from_parsed(
        "emilio",
        "gid-cursor",
        {
            "comercio": "CURSOR AI",
            "monto": 60,
            "fecha": "2026-08-21",
            "descripcion_corta": "Consumo Pacificard: CURSOR AI $60",
            "tarjeta_ultimos4": "325",
        },
        "Pacificard TITULAR …325",
    )
    assert tx["status"] == "pending_review"
    assert tx["category"] is None
    assert tx["personal_category"] is None
    assert tx["budget_category"] is None
    assert tx["auto_categorized"] is False
    assert tx["entity_tag_key"] == "titular"
    assert tx["date"] == "2026-08-21"
    assert tx["amount"] == 60
    assert tx["gmail_id"] == "gid-cursor"
    assert leave_uncategorized(tx["establishment"], tx["amount"]) is False


def test_last_pool_tx_definitive_stays_uncategorized():
    tx = last_pool_tx_from_parsed(
        "emilio",
        "gid-definitive",
        {
            "comercio": "DEFINITIVE GUAYAQUIL",
            "monto": 149.47,
            "fecha": datetime(2026, 8, 21, 18, 0, 0),
        },
        "tarjeta ADICIONAL …766",
        fallback_date="2026-08-20",
    )
    assert tx["date"] == "2026-08-21"
    assert tx["status"] == "pending_review"
    assert tx["category"] is None
    assert tx["auto_categorized"] is False
    assert tx["entity_tag_key"] == "adicional_kp"
    assert leave_uncategorized(tx["establishment"], tx["amount"]) is True
