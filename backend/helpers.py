"""Small helpers with no FastAPI/DB imports — safe for unit tests."""
from datetime import date, datetime, timedelta
from email.utils import parsedate_to_datetime


def income_matches_year(income: dict, year) -> bool:
    """True if income.date belongs to year. date may be str or datetime."""
    if not year:
        return True
    raw = income.get("date")
    if raw is None:
        return False
    if isinstance(raw, (datetime, date)):
        return int(raw.year) == int(year)
    return str(raw).startswith(str(year))


def _money_txt(value, fallback):
    return f"${value:,.2f}" if isinstance(value, (int, float)) else fallback


def generate_sri_alerts(category_progress, total_deductible, limite_global):
    alerts = []
    if limite_global and total_deductible >= limite_global * 0.9:
        alerts.append({"type": "warning", "message": f"Has usado el 90% de tu limite global de deducciones (${limite_global:,.2f})"})
    for cat in category_progress or []:
        pct = cat.get("percentage") or 0
        limit_txt = _money_txt(cat.get("limit"), "sin tope")
        remaining_txt = _money_txt(cat.get("remaining"), "—")
        spent = cat.get("spent")
        spent_txt = _money_txt(spent if spent is not None else 0, "$0.00")
        if pct >= 100:
            alerts.append({"type": "error", "message": f"LIMITE EXCEDIDO en {cat.get('name', cat.get('category', ''))}: {spent_txt} de {limit_txt}"})
        elif pct >= 80:
            alerts.append({"type": "warning", "message": f"{cat.get('name', cat.get('category', ''))}: {pct}% del limite usado. Quedan {remaining_txt}"})
    return alerts


# Label_6 in Emilio's Gmail = "Vesta/Procesado". Labeling ≠ Transaction docs.
VESTA_PROCESSED_LABEL_ID = "Label_6"


def last_pool_gmail_list_kwargs(newer_than_days=14, now=None):
    """Gmail users.messages.list kwargs: Label_6 in the last-pool window."""
    ref = now or datetime.now()
    after = (ref - timedelta(days=int(newer_than_days))).strftime("%Y/%m/%d")
    return {
        "userId": "me",
        "labelIds": [VESTA_PROCESSED_LABEL_ID],
        "q": f"after:{after}",
        "maxResults": 200,
    }


def normalize_tx_date(value, fallback=None):
    """YYYY-MM-DD for GET /transactions sort. None if neither value nor fallback parses.

    Datetime objects stored in Mongo are dropped by TransactionResponse (date: str).
    Does not invent a calendar day.
    """
    if value is None or value == "":
        return normalize_tx_date(fallback) if fallback is not None and fallback is not value else None
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    text = str(value).strip()
    if len(text) >= 10 and text[4] == "-" and text[7] == "-":
        return text[:10]
    for fmt in ("%d/%m/%Y", "%d-%m-%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(text[:10], fmt).strftime("%Y-%m-%d")
        except ValueError:
            pass
    try:
        parsed = parsedate_to_datetime(text)
        if parsed:
            return parsed.date().isoformat()
    except (TypeError, ValueError, IndexError):
        pass
    return normalize_tx_date(fallback) if fallback is not None and fallback is not value else None


def entity_tag_from_card_notice(text: str):
    """Titular vs adicional from the bank notice text — not invented."""
    blob = (text or "").lower()
    if "adicional" in blob:
        return "adicional_kp"
    if "titular" in blob:
        return "titular"
    return None


def leave_uncategorized(comercio, amount) -> bool:
    """Emilio skipped Definitive Guayaquil $149.47 KP — do not auto-categorize."""
    name = (comercio or "").lower()
    try:
        amt = float(amount)
    except (TypeError, ValueError):
        return False
    return "definitive" in name and abs(amt - 149.47) < 0.02


def last_pool_tx_from_parsed(user_id: str, gmail_id: str, parsed: dict, raw_text: str = "", fallback_date=None) -> dict:
    """Pending, uncategorized Transaction doc for the last-pool. Approvals stay in chat."""
    comercio = parsed.get("comercio")
    monto = parsed.get("monto")
    # Last-pool docs stay uncategorized until chat approval. Definitive $149.47
    # is the hard skip (Emilio skipped); leave_uncategorized documents that case.
    category = None
    return {
        "user_id": user_id,
        "gmail_id": gmail_id,
        "amount": monto,
        "description": parsed.get("descripcion_corta") or comercio or "",
        "establishment": comercio,
        "vendor": comercio,
        "date": normalize_tx_date(parsed.get("fecha"), fallback=fallback_date),
        "transaction_type": "expense",
        "source": "gmail",
        "source_type": "email",
        "status": "pending_review",
        "category": category,
        "personal_category": category,
        "budget_category": category,
        "auto_categorized": False,
        "entity_tag_key": entity_tag_from_card_notice(raw_text),
        "tarjeta_ultimos4": parsed.get("tarjeta_ultimos4"),
        "card_last_digits": parsed.get("tarjeta_ultimos4"),
    }
