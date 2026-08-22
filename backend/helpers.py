"""Small helpers with no FastAPI/DB imports — safe for unit tests."""
from datetime import date, datetime


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
