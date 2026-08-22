"""Local unit tests for the canonical Vesta taxonomy.

These do not hit a remote API. They guard against regressions that leaked
personal names (KP/EA/Ramona/Angélica) or SRI keys into PERSONAL/BUDGET
category fields.
"""
from models import (
    BUDGET_CATEGORIES,
    DEFAULT_CATEGORIZATION_RULES,
    apply_categorization_rules,
)
from seed_data import CREDIT_CARDS, DEFERRED_PAYMENTS


FORBIDDEN_SUBCATEGORY_NAMES = {
    "KP (Esposa)",
    "EA (Emilio)",
    "Ramona",
    "Angélica",
    "IESS",
    "Mamá (Venmo)",
}

PERSONAL_KEYS = set(BUDGET_CATEGORIES.keys())


def _subcategory_names(cat_cfg):
    subs = cat_cfg["subcategories"]
    return set(subs.keys()) if isinstance(subs, dict) else set(subs)


def test_default_rules_emit_only_canonical_keys_and_subs():
    for rule in DEFAULT_CATEGORIZATION_RULES:
        assert rule["category"] in PERSONAL_KEYS, rule
        assert rule["subcategory"] in _subcategory_names(BUDGET_CATEGORIES[rule["category"]]), rule
        assert rule["subcategory"] not in FORBIDDEN_SUBCATEGORY_NAMES, rule


def test_apply_rules_maps_legacy_personal_names_to_generic_subs():
    ramona = apply_categorization_rules("Pago Ramona marzo")
    assert ramona["auto_categorized"] is True
    assert ramona["category"] == "empleados"
    assert ramona["subcategory"] == "Personal doméstico 1"

    angelica = apply_categorization_rules("Transferencia Angélica")
    assert angelica["category"] == "empleados"
    assert angelica["subcategory"] == "Personal doméstico 2"

    iess = apply_categorization_rules("Aporte IESS")
    assert iess["category"] == "empleados"
    assert iess["subcategory"] == "Aportes IESS"

    venmo = apply_categorization_rules("Venmo mamá")
    assert venmo["category"] == "usa"
    assert venmo["subcategory"] == "Remesas familiares"


def test_budget_subcategories_have_no_personal_names():
    leaked = set()
    for key, cfg in BUDGET_CATEGORIES.items():
        leaked |= _subcategory_names(cfg) & FORBIDDEN_SUBCATEGORY_NAMES
    assert not leaked, f"personal names still in BUDGET_CATEGORIES: {leaked}"


def test_seed_deferred_card_names_match_credit_cards():
    card_names = {c["name"] for c in CREDIT_CARDS}
    card_ids = {c["id"] for c in CREDIT_CARDS}
    for deferred in DEFERRED_PAYMENTS:
        assert deferred["card_id"] in card_ids, deferred
        assert deferred["card_name"] in card_names, deferred
