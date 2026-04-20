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
    get_income_structure, get_budget_categories
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



# ================= SESIÓN 10: Notificaciones + Esta Semana =================

def _days_until(due_day: int, today: datetime) -> int:
    """Días faltantes hasta el próximo due_day (mismo mes o siguiente)."""
    cm, cy = today.month, today.year
    if today.day > due_day:
        nm = cm + 1 if cm < 12 else 1
        ny = cy if cm < 12 else cy + 1
    else:
        nm, ny = cm, cy
    try:
        due = datetime(ny, nm, min(due_day, 28))
        return (due - today.replace(tzinfo=None)).days
    except Exception:
        return 999


@router.get("/notificaciones")
async def get_notificaciones(user: dict = Depends(get_current_user)):
    """Unifica alertas en 4 tipos: pago_proximo, limite_categoria, sugerir_filtro, gmail_nuevos."""
    now = datetime.now(timezone.utc)
    today = now.replace(tzinfo=None)
    start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).strftime("%Y-%m-%d")
    items = []

    # 1. pago_proximo: tarjetas con saldo + payment_due_day ≤ 7d
    cards = await db.credit_cards.find({"user_id": user["id"]}, {"_id": 0}).to_list(50)
    for c in cards:
        if c.get("current_balance", 0) > 0:
            d = _days_until(c.get("payment_due_day", 15), today)
            if 0 <= d <= 7:
                items.append({
                    "id": f"card-{c.get('id')}",
                    "tipo": "pago_proximo",
                    "icono": "💳",
                    "titulo": f"Pago tarjeta {c.get('name', '')}",
                    "texto": f"Vence en {d} día{'s' if d != 1 else ''} · Mínimo ${c.get('minimum_payment', 0):.2f} / Total ${c.get('current_balance', 0):.2f}",
                    "accion_url": "/deudas",
                    "accion_label": "Pagar",
                    "prioridad": "high" if d <= 2 else "medium",
                    "days_until": d,
                })

    # scheduled_payments
    scheduled = await db.scheduled_payments.find({"user_id": user["id"]}, {"_id": 0}).to_list(50)
    for s in scheduled:
        d = _days_until(s.get("due_day", 1), today)
        if 0 <= d <= (s.get("reminder_days_before", 2) or 2):
            items.append({
                "id": f"sched-{s.get('id')}",
                "tipo": "pago_proximo",
                "icono": "⏰",
                "titulo": f"Pago: {s.get('name', '')}",
                "texto": f"Vence en {d} día{'s' if d != 1 else ''} · ${s.get('amount', 0):.2f}",
                "accion_url": "/flujo",
                "accion_label": "Marcar pagado",
                "prioridad": "high" if d <= 2 else "medium",
                "days_until": d,
            })

    # 2. limite_categoria: categorías ≥90% del presupuesto mensual
    txs = await db.transactions.find(
        {"user_id": user["id"], "date": {"$gte": start_of_month}, "transaction_type": "expense"}, {"_id": 0}
    ).to_list(2000)
    spent_by_cat = {}
    for t in txs:
        cat = t.get("category", "otros")
        spent_by_cat[cat] = spent_by_cat.get(cat, 0) + t.get("amount", 0)
    budget_cats = get_budget_categories(user)
    for key, cfg in budget_cats.items():
        budget = cfg.get("monthly_budget", 0)
        spent = spent_by_cat.get(key, 0)
        if budget > 0 and spent / budget >= 0.90:
            pct = round(spent / budget * 100)
            items.append({
                "id": f"cat-{key}-{start_of_month}",
                "tipo": "limite_categoria",
                "icono": "📊",
                "titulo": f"{cfg.get('name', key)} al {pct}%",
                "texto": f"${spent:.2f} de ${budget:.2f} presupuestado",
                "accion_url": "/budget",
                "accion_label": "Ver",
                "prioridad": "high" if pct >= 100 else "medium",
                "days_until": None,
            })

    # 3. gmail_nuevos: transacciones pendientes en gmail
    gmail_pending = await db.gmail_transactions.count_documents({"user_id": user["id"], "estado": "pendiente"})
    if gmail_pending > 0:
        items.append({
            "id": f"gmail-{today.strftime('%Y-%m-%d')}",
            "tipo": "gmail_nuevos",
            "icono": "📧",
            "titulo": f"{gmail_pending} email{'s' if gmail_pending != 1 else ''} pendiente{'s' if gmail_pending != 1 else ''}",
            "texto": "Revisa y aprueba movimientos detectados desde Gmail",
            "accion_url": "/cargar",
            "accion_label": "Revisar",
            "prioridad": "medium" if gmail_pending >= 5 else "low",
            "days_until": None,
        })

    # 4. sugerir_filtro: vendor repetido ≥3 veces en 30d sin categoría clara
    last30 = (now - timedelta(days=30)).strftime("%Y-%m-%d")
    vendor_counts = {}
    for t in txs:
        est = (t.get("establishment") or "").strip().lower()
        if not est or t.get("date", "") < last30:
            continue
        if t.get("auto_categorized"):
            continue
        vendor_counts[est] = vendor_counts.get(est, 0) + 1
    for est, count in vendor_counts.items():
        if count >= 3:
            items.append({
                "id": f"filter-{est}",
                "tipo": "sugerir_filtro",
                "icono": "🎯",
                "titulo": f"Crear regla para '{est.title()}'",
                "texto": f"Aparece {count} veces este mes — automatiza su categorización",
                "accion_url": "/transactions",
                "accion_label": "Crear regla",
                "prioridad": "low",
                "days_until": None,
                "establishment": est,
            })
            break  # solo la más frecuente para no saturar

    # Orden: prioridad (high, medium, low) + days_until ascendente
    priority_order = {"high": 0, "medium": 1, "low": 2}
    items.sort(key=lambda x: (priority_order.get(x["prioridad"], 2), x["days_until"] if x["days_until"] is not None else 999))
    return {"notificaciones": items, "total": len(items)}


@router.get("/dashboard/esta-semana")
async def esta_semana(user: dict = Depends(get_current_user)):
    """Máx 5 items: pagos tarjeta ≤7d, diferidos del mes, categorías ≥90%."""
    now = datetime.now(timezone.utc)
    today = now.replace(tzinfo=None)
    start_of_month = now.replace(day=1).strftime("%Y-%m-%d")
    items = []

    # Pagos tarjeta ≤7d
    cards = await db.credit_cards.find({"user_id": user["id"]}, {"_id": 0}).to_list(50)
    for c in cards:
        if c.get("current_balance", 0) > 0:
            d = _days_until(c.get("payment_due_day", 15), today)
            if 0 <= d <= 7:
                items.append({
                    "id": f"card-{c.get('id')}",
                    "tipo": "card_payment",
                    "icono": "💳",
                    "titulo": f"Tarjeta {c.get('name', '')}",
                    "texto": f"Mínimo ${c.get('minimum_payment', 0):.2f} · Total ${c.get('current_balance', 0):.2f}",
                    "days_until": d,
                    "badge": "red" if d <= 2 else "yellow",
                    "accion_url": "/deudas",
                })

    # Diferidos activos con cuota este mes
    deferred = await db.deferred_payments.find(
        {"user_id": user["id"], "remaining_installments": {"$gt": 0}}, {"_id": 0}
    ).to_list(50)
    for d_pay in deferred:
        items.append({
            "id": f"def-{d_pay.get('id')}",
            "tipo": "deferred",
            "icono": "🔁",
            "titulo": f"Cuota {d_pay.get('description', '')[:40]}",
            "texto": f"${d_pay.get('monthly_payment', 0):.2f} · {d_pay.get('remaining_installments', 0)} cuota(s) restantes",
            "days_until": 30,  # cuota mensual, baja urgencia
            "badge": "yellow",
            "accion_url": "/deudas",
        })

    # Categorías ≥90%
    txs = await db.transactions.find(
        {"user_id": user["id"], "date": {"$gte": start_of_month}, "transaction_type": "expense"}, {"_id": 0}
    ).to_list(2000)
    spent_by_cat = {}
    for t in txs:
        cat = t.get("category", "otros")
        spent_by_cat[cat] = spent_by_cat.get(cat, 0) + t.get("amount", 0)
    budget_cats = get_budget_categories(user)
    for key, cfg in budget_cats.items():
        budget = cfg.get("monthly_budget", 0)
        spent = spent_by_cat.get(key, 0)
        if budget > 0 and spent / budget >= 0.90:
            pct = round(spent / budget * 100)
            items.append({
                "id": f"cat-{key}",
                "tipo": "category_limit",
                "icono": "📊",
                "titulo": f"{cfg.get('name', key)} al {pct}%",
                "texto": f"${spent:.2f} de ${budget:.2f}",
                "days_until": 999,
                "badge": "red" if pct >= 100 else "yellow",
                "accion_url": "/budget",
            })

    # Orden: badge rojo > amarillo, días ascendente. Máx 5.
    badge_order = {"red": 0, "yellow": 1}
    items.sort(key=lambda x: (badge_order.get(x["badge"], 2), x.get("days_until", 999)))
    return {"items": items[:5], "total": len(items)}
