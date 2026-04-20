from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from typing import Optional
import uuid

from database import db
from models import (
    DashboardStats, SRI_CATEGORIES, CANASTA_BASICA, FRACCION_BASICA_EXENTA,
    CARGAS_FAMILIARES_CBF, PORCENTAJE_REBAJA_IR, CONTRIBUYENTE_INFO,
    INCOME_SOURCES, PAYMENT_SOURCES, INTERNATIONAL_COUNTRIES,
    TOPE_LEGAL_SRI, PORCENTAJE_LIMITE_INGRESOS, SRI_CATEGORIAS_REGLAS,
    get_income_structure
)
from utils import get_current_user, generate_sri_alerts

router = APIRouter()


@router.get("/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats(user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    start_of_week = now - timedelta(days=now.weekday())

    transactions = await db.transactions.find(
        {"user_id": user["id"], "date": {"$gte": start_of_month.strftime("%Y-%m-%d")}}, {"_id": 0}
    ).to_list(1000)

    total_income = sum(t["amount"] for t in transactions if t["transaction_type"] == "income")
    total_expenses = sum(t["amount"] for t in transactions if t["transaction_type"] == "expense")

    weekly_transactions = [t for t in transactions if t["date"] >= start_of_week.strftime("%Y-%m-%d")]
    weekly_total = sum(t["amount"] for t in weekly_transactions if t["transaction_type"] == "expense")

    days_in_month = now.day
    daily_average = total_expenses / days_in_month if days_in_month > 0 else 0

    by_category = {}
    for t in transactions:
        if t["transaction_type"] == "expense":
            cat = t["category"]
            by_category[cat] = by_category.get(cat, 0) + t["amount"]

    sri_deductible_cats = ["alimentacion", "salud", "educacion", "vivienda", "vestimenta"]
    sri_deductible = sum(by_category.get(cat, 0) for cat in sri_deductible_cats)

    return DashboardStats(total_income=total_income, total_expenses=total_expenses, balance=total_income - total_expenses, daily_average=round(daily_average, 2), weekly_total=weekly_total, monthly_total=total_expenses, by_category=by_category, sri_deductible=sri_deductible)


@router.get("/dashboard/chart-data")
async def get_chart_data(period: str = "month", user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    if period == "week":
        start_date = (now - timedelta(days=7)).strftime("%Y-%m-%d")
    elif period == "month":
        start_date = now.replace(day=1).strftime("%Y-%m-%d")
    else:
        start_date = now.replace(month=1, day=1).strftime("%Y-%m-%d")

    transactions = await db.transactions.find({"user_id": user["id"], "date": {"$gte": start_date}}, {"_id": 0}).sort("date", 1).to_list(1000)
    daily_data = {}
    for t in transactions:
        date = t["date"]
        if date not in daily_data:
            daily_data[date] = {"date": date, "income": 0, "expenses": 0}
        if t["transaction_type"] == "income":
            daily_data[date]["income"] += t["amount"]
        else:
            daily_data[date]["expenses"] += t["amount"]
    return {"data": list(daily_data.values())}


@router.get("/categories")
async def get_categories():
    return {"categories": SRI_CATEGORIES, "income_sources": INCOME_SOURCES, "payment_sources": PAYMENT_SOURCES, "international_countries": INTERNATIONAL_COUNTRIES, "canasta_basica": CANASTA_BASICA, "fraccion_basica_exenta": FRACCION_BASICA_EXENTA, "contribuyente": CONTRIBUYENTE_INFO}


async def _get_ingresos_gravados_anual(user: dict, year: int) -> float:
    """Lee ingresos anuales proyectados del usuario (presupuesto personal > INCOME_STRUCTURE default)."""
    budget = await db.personal_budgets.find_one({"user_id": user["id"], "year": year}, {"_id": 0, "income_projection": 1})
    income_proj = (budget or {}).get("income_projection") or get_income_structure(user)
    total = 0.0
    if isinstance(income_proj, dict):
        for v in income_proj.values():
            if isinstance(v, dict):
                total += float(v.get("annual", 0) or (v.get("monthly", 0) or 0) * 12)
    return round(total, 2)


def _deductible_amount(tx: dict) -> float:
    """Si aplica_iva=False, el deducible es subtotal_sin_iva; caso contrario, el total."""
    if tx.get("aplica_iva") is False and tx.get("subtotal_sin_iva"):
        return float(tx.get("subtotal_sin_iva") or 0)
    return float(tx.get("amount", 0) or 0)


@router.get("/sri/categorias")
async def get_sri_categorias():
    """Reglas de deducibilidad SRI (desde la colección sri_categorias)."""
    items = await db.sri_categorias.find({}, {"_id": 0}).to_list(50)
    if not items:
        items = [{"categoria": k, **v} for k, v in SRI_CATEGORIAS_REGLAS.items()]
    return {"categorias": items}


@router.get("/sri/deduction-limits")
async def get_sri_deduction_limits(cargas_familiares: int = 0, user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    start_of_year = f"{now.year}-01-01"
    transactions = await db.transactions.find({"user_id": user["id"], "date": {"$gte": start_of_year}, "transaction_type": "expense", "uso_empresarial": {"$ne": True}}, {"_id": 0}).to_list(10000)

    # Cargar reglas SRI (DB > fallback models)
    rules_docs = await db.sri_categorias.find({}, {"_id": 0}).to_list(50)
    rules = {r["categoria"]: r for r in rules_docs} if rules_docs else {
        k: {"categoria": k, **v} for k, v in SRI_CATEGORIAS_REGLAS.items()
    }

    spent_by_category = {}
    total_deductible = 0
    total_non_deductible = 0
    for t in transactions:
        cat = t.get("category", "otros")
        deductible_amt = _deductible_amount(t)
        spent_by_category[cat] = spent_by_category.get(cat, 0) + deductible_amt
        rule = rules.get(cat)
        pct = rule.get("porcentaje_deducible", 0) if rule else (1.0 if SRI_CATEGORIES.get(cat, {}).get("deductible") else 0)
        if pct > 0:
            total_deductible += deductible_amt * pct
        else:
            total_non_deductible += deductible_amt

    # Cálculo límite efectivo: MIN(20% ingresos, tope legal)
    ingresos_gravados = await _get_ingresos_gravados_anual(user, now.year)
    limite_20pct = round(ingresos_gravados * PORCENTAJE_LIMITE_INGRESOS, 2)
    limite_legal = TOPE_LEGAL_SRI
    limite_efectivo = round(min(limite_20pct, limite_legal), 2) if limite_20pct > 0 else limite_legal

    # Cargas familiares legacy (compat)
    cargas = min(cargas_familiares, 5)
    num_cbf = CARGAS_FAMILIARES_CBF.get(cargas, 7)
    limite_global_cargas = num_cbf * CANASTA_BASICA

    category_progress = []
    for cat_key, rule in rules.items():
        pct_ded = rule.get("porcentaje_deducible", 0)
        if pct_ded <= 0:
            continue
        spent = spent_by_category.get(cat_key, 0) * pct_ded
        tope = rule.get("tope_anual")
        # tope None → sin tope: usa limite_efectivo como referencia visual
        limit = tope if tope else limite_efectivo
        percentage = (spent / limit * 100) if limit > 0 else 0
        category_progress.append({
            "category": cat_key, "name": rule.get("nombre", cat_key),
            "spent": round(spent, 2), "limit": round(limit, 2) if tope else None,
            "sin_tope": tope is None,
            "percentage": round(min(percentage, 100), 1),
            "remaining": round(max(0, (tope or limite_efectivo) - spent), 2),
            "over_limit": tope is not None and spent > tope,
            "porcentaje_deducible": pct_ded,
            "descripcion": rule.get("descripcion", ""),
        })
    category_progress.sort(key=lambda x: x["percentage"], reverse=True)

    gastos_aplicables = min(total_deductible, limite_efectivo)
    rebaja_ir = gastos_aplicables * PORCENTAJE_REBAJA_IR

    return {
        "year": now.year, "contribuyente": CONTRIBUYENTE_INFO, "cargas_familiares": cargas_familiares,
        "canasta_basica": CANASTA_BASICA, "fraccion_basica_exenta": FRACCION_BASICA_EXENTA,
        "ingresos_gravados_anual": ingresos_gravados,
        "limite_20pct": limite_20pct,
        "limite_legal": limite_legal,
        "limite_efectivo": limite_efectivo,
        "limite_global": round(limite_global_cargas, 2),  # legacy compat
        "total_deductible_spent": round(total_deductible, 2),
        "total_non_deductible_spent": round(total_non_deductible, 2),
        "gastos_aplicables": round(gastos_aplicables, 2),
        "rebaja_ir_estimada": round(rebaja_ir, 2),
        "porcentaje_rebaja": PORCENTAJE_REBAJA_IR * 100,
        "percentage_used": round((total_deductible / limite_efectivo * 100) if limite_efectivo > 0 else 0, 1),
        "remaining_global": round(max(0, limite_efectivo - total_deductible), 2),
        "category_progress": category_progress,
        "alerts": generate_sri_alerts(category_progress, total_deductible, limite_efectivo)
    }


@router.get("/dashboard/subscription-renewals")
async def get_subscription_renewals(user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    today_str = now.strftime("%Y-%m-%d")
    week_end = (now + timedelta(days=7)).strftime("%Y-%m-%d")

    subs = await db.gmail_transactions.find({
        "user_id": user["id"],
        "es_suscripcion": True,
        "estado": {"$ne": "descartado"},
    }, {"_id": 0}).sort("proxima_renovacion", 1).to_list(50)

    upcoming = []
    for s in subs:
        renewal = s.get("proxima_renovacion")
        if not renewal or renewal < today_str or renewal > week_end:
            continue
        try:
            renewal_date = datetime.strptime(renewal, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            s["days_until_renewal"] = max(0, (renewal_date - now).days)
        except Exception:
            s["days_until_renewal"] = None
        upcoming.append(s)

    return {"subscriptions": subs, "upcoming_this_week": upcoming}
