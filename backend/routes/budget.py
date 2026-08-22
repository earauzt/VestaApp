from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from typing import Optional
import uuid
import json
import re
import logging

from database import db
from models import (
    BudgetResponse, SRI_CATEGORIES, UserRole, IncomeEntry,
    BUDGET_CATEGORIES, INCOME_STRUCTURE, BUDGET_SUMMARY, BUDGET_GOALS,
    PAYMENT_METHODS, INCOME_SOURCES, INCOME_CONCEPTS, ENTITY_TAGS,
    get_budget_categories, get_income_structure, get_budget_summary,
    get_budget_goals
)
from utils import get_current_user
from helpers import income_matches_year
import ai_client

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/budget", response_model=BudgetResponse)
async def get_budget(month: Optional[str] = None, user: dict = Depends(get_current_user)):
    query = {"user_id": user["id"]}
    budget = await db.budgets.find_one(query, {"_id": 0}, sort=[("created_at", -1)])
    if not budget:
        return BudgetResponse(id="", user_id=user["id"], items=[], total_income=0, total_expenses=0, created_at=datetime.now(timezone.utc).isoformat())
    return BudgetResponse(**budget)


@router.get("/budget/vs-actual")
async def get_budget_vs_actual(user: dict = Depends(get_current_user)):
    budget = await db.budgets.find_one({"user_id": user["id"]}, {"_id": 0}, sort=[("created_at", -1)])
    now = datetime.now(timezone.utc)
    start_of_month = now.replace(day=1).strftime("%Y-%m-%d")
    transactions = await db.transactions.find({"user_id": user["id"], "date": {"$gte": start_of_month}, "transaction_type": "expense"}, {"_id": 0}).to_list(1000)
    actual_by_category = {}
    for t in transactions:
        cat = t["category"]
        actual_by_category[cat] = actual_by_category.get(cat, 0) + t["amount"]
    comparison = []
    if budget:
        budget_by_category = {}
        for item in budget.get("items", []):
            cat = item["category"]
            budget_by_category[cat] = budget_by_category.get(cat, 0) + item["planned_amount"]
        for cat in set(list(budget_by_category.keys()) + list(actual_by_category.keys())):
            planned = budget_by_category.get(cat, 0)
            actual = actual_by_category.get(cat, 0)
            comparison.append({"category": cat, "category_name": SRI_CATEGORIES.get(cat, {}).get("name", cat), "planned": planned, "actual": actual, "difference": planned - actual, "percentage": (actual / planned * 100) if planned > 0 else 0})
    return {"comparison": comparison}


@router.get("/budget/suggestions")
async def get_budget_suggestions(user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    six_months_ago = (now - timedelta(days=180)).strftime("%Y-%m-%d")
    transactions = await db.transactions.find({"user_id": user["id"], "date": {"$gte": six_months_ago}, "transaction_type": "expense"}, {"_id": 0}).to_list(5000)
    if len(transactions) < 10:
        return {"suggestions": [], "message": "Necesitas mas transacciones para obtener sugerencias (minimo 10)"}
    monthly_data = {}
    for t in transactions:
        month = t["date"][:7]
        cat = t["category"]
        if month not in monthly_data:
            monthly_data[month] = {}
        if cat not in monthly_data[month]:
            monthly_data[month][cat] = 0
        monthly_data[month][cat] += t["amount"]
    category_stats = {}
    for month, cats in monthly_data.items():
        for cat, amount in cats.items():
            if cat not in category_stats:
                category_stats[cat] = {"amounts": [], "total": 0}
            category_stats[cat]["amounts"].append(amount)
            category_stats[cat]["total"] += amount
    budget = await db.budgets.find_one({"user_id": user["id"]}, {"_id": 0}, sort=[("created_at", -1)])
    budget_by_cat = {}
    if budget:
        for item in budget.get("items", []):
            cat = item["category"]
            budget_by_cat[cat] = budget_by_cat.get(cat, 0) + item["planned_amount"]
    suggestions = []
    for cat, stats in category_stats.items():
        avg = sum(stats["amounts"]) / len(stats["amounts"])
        current_budget = budget_by_cat.get(cat, 0)
        cat_info = SRI_CATEGORIES.get(cat, {"name": cat, "deductible": False})
        if current_budget > 0:
            ratio = avg / current_budget
            if ratio > 1.2:
                suggestions.append({"category": cat, "category_name": cat_info["name"], "type": "increase", "current_budget": current_budget, "suggested_budget": round(avg * 1.1, 2), "average_spending": round(avg, 2), "reason": f"Gastas en promedio ${avg:.2f}/mes, 20% mas que tu presupuesto de ${current_budget:.2f}", "is_deductible": cat_info.get("deductible", False)})
            elif ratio < 0.6:
                suggestions.append({"category": cat, "category_name": cat_info["name"], "type": "decrease", "current_budget": current_budget, "suggested_budget": round(avg * 1.2, 2), "average_spending": round(avg, 2), "reason": f"Gastas en promedio ${avg:.2f}/mes, mucho menos que tu presupuesto de ${current_budget:.2f}", "is_deductible": cat_info.get("deductible", False)})
        elif avg > 50:
            suggestions.append({"category": cat, "category_name": cat_info["name"], "type": "new", "current_budget": 0, "suggested_budget": round(avg * 1.1, 2), "average_spending": round(avg, 2), "reason": f"No tienes presupuesto para {cat_info['name']} pero gastas ${avg:.2f}/mes en promedio", "is_deductible": cat_info.get("deductible", False)})
    suggestions.sort(key=lambda x: abs(x["suggested_budget"] - x["current_budget"]), reverse=True)
    return {"suggestions": suggestions[:10], "months_analyzed": len(monthly_data)}


@router.get("/predictions")
async def get_predictions(user: dict = Depends(get_current_user)):
    if not ai_client.is_configured():
        return {"predictions": [], "advice": ["Configure API key para predicciones AI"], "sri_tips": []}
    now = datetime.now(timezone.utc)
    three_months_ago = (now - timedelta(days=90)).strftime("%Y-%m-%d")
    transactions = await db.transactions.find({"user_id": user["id"], "date": {"$gte": three_months_ago}}, {"_id": 0}).to_list(1000)
    if not transactions:
        return {"predictions": [], "advice": ["Agrega transacciones para obtener predicciones"], "sri_tips": []}
    summary = {}
    for t in transactions:
        cat = t["category"]
        if cat not in summary:
            summary[cat] = {"total": 0, "count": 0, "transactions": []}
        summary[cat]["total"] += t["amount"]
        summary[cat]["count"] += 1
    try:
        response = await ai_client.ask(
            system_message="""Eres un asesor financiero experto en finanzas personales y leyes tributarias de Ecuador.
            Analiza los gastos y proporciona:
            1. Predicciones de gastos para el proximo mes por categoria
            2. Consejos especificos para optimizar recursos
            3. Recomendaciones para maximizar deducciones SRI""",
            user_text=f"Analiza estos gastos de los ultimos 3 meses y proporciona predicciones: {json.dumps(summary)}"
        )
        json_match = re.search(r'\{.*\}', response, re.DOTALL)
        if json_match:
            result = json.loads(json_match.group())
            return result
        return {"predictions": [], "advice": ["No se pudo generar predicciones"], "sri_tips": []}
    except Exception as e:
        logger.error(f"Prediction error: {e}")
        return {"predictions": [], "advice": [f"Error: {str(e)}"], "sri_tips": []}


# ================= INCOME MANAGEMENT =================

@router.get("/income")
async def get_incomes(year: Optional[int] = None, distribution: Optional[str] = None, user: dict = Depends(get_current_user)):
    query = {"user_id": user["id"]}
    if distribution:
        query["distribution"] = distribution
    # No $regex on date: live docs mix ISO strings and datetimes; $regex on a
    # Date field 500s the whole handler and the UI toasts "Error al cargar datos".
    incomes = await db.incomes.find(query, {"_id": 0}).to_list(2000)
    incomes = [i for i in incomes if income_matches_year(i, year)]
    incomes.sort(key=lambda i: str(i.get("date") or ""), reverse=True)
    return incomes


@router.post("/income")
async def create_income(income: IncomeEntry, user: dict = Depends(get_current_user)):
    if user["role"] not in [UserRole.ADMIN, UserRole.SPOUSE]:
        raise HTTPException(status_code=403, detail="No autorizado para crear ingresos")
    income_doc = {"id": str(uuid.uuid4()), "user_id": user["id"], "amount": income.amount, "date": income.date, "distribution": income.distribution, "concept": income.concept, "description": income.description, "is_recurring": income.is_recurring, "payment_method": income.payment_method, "created_at": datetime.now(timezone.utc).isoformat()}
    await db.incomes.insert_one(income_doc)
    del income_doc["_id"]
    return income_doc


@router.put("/income/{income_id}")
async def update_income(income_id: str, income: IncomeEntry, user: dict = Depends(get_current_user)):
    if user["role"] not in [UserRole.ADMIN, UserRole.SPOUSE]:
        raise HTTPException(status_code=403, detail="No autorizado")
    update_data = {"amount": income.amount, "date": income.date, "distribution": income.distribution, "concept": income.concept, "description": income.description, "is_recurring": income.is_recurring, "payment_method": income.payment_method}
    result = await db.incomes.update_one({"id": income_id, "user_id": user["id"]}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Ingreso no encontrado")
    return {"message": "Ingreso actualizado"}


@router.delete("/income/{income_id}")
async def delete_income(income_id: str, user: dict = Depends(get_current_user)):
    if user["role"] not in [UserRole.ADMIN, UserRole.SPOUSE]:
        raise HTTPException(status_code=403, detail="No autorizado")
    result = await db.incomes.delete_one({"id": income_id, "user_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Ingreso no encontrado")
    return {"message": "Ingreso eliminado"}


@router.get("/income/summary")
async def get_income_summary(year: Optional[int] = None, user: dict = Depends(get_current_user)):
    current_year = year or datetime.now().year
    incomes = await db.incomes.find({"user_id": user["id"]}, {"_id": 0}).to_list(2000)
    incomes = [i for i in incomes if income_matches_year(i, current_year)]
    by_distribution = {}
    by_concept = {}
    total = 0
    for income in incomes:
        dist = income.get("distribution", "Personal")
        concept = income.get("concept", "Otros")
        amount = income.get("amount", 0)
        by_distribution[dist] = by_distribution.get(dist, 0) + amount
        by_concept[concept] = by_concept.get(concept, 0) + amount
        total += amount
    return {"total": total, "by_distribution": by_distribution, "by_concept": by_concept, "year": current_year, "count": len(incomes)}


# ================= PERSONAL BUDGET =================

@router.get("/budget/categories")
async def get_budget_categories_endpoint(user: dict = Depends(get_current_user)):
    budget_cats = get_budget_categories(user)
    budget_goals_data = get_budget_goals(user)
    return {"categories": budget_cats, "payment_methods": PAYMENT_METHODS, "goals": budget_goals_data, "income_sources": INCOME_SOURCES, "income_concepts": INCOME_CONCEPTS}


@router.get("/entity-tags")
async def get_entity_tags(user: dict = Depends(get_current_user)):
    """Etiqueta de entidad/dueno (Personal, Pareja, Hogar, etc.) — ortogonal a
    la categoria del gasto. Vive en la tabla vesta_entity_tags (editable sin
    tocar codigo) una vez aplicada migrations/013_vesta_entity_tags.sql; hasta
    entonces cae de vuelta al default en ENTITY_TAGS para no romper nada."""
    defaults = [
        {"key": key, "name": cfg["name"], "sort_order": cfg["sort_order"]}
        for key, cfg in sorted(ENTITY_TAGS.items(), key=lambda kv: kv[1]["sort_order"])
    ]
    try:
        rows = await db.entity_tags.find({"is_active": True}, {"_id": 0}).to_list(100)
        if rows:
            by_key = {r.get("key"): r for r in rows if r.get("key")}
            # Titular vs adicional KP son atribución canónica; si la tabla seed
            # vieja no los tiene, se restauran sin inventar movimientos.
            for key in ("titular", "adicional_kp"):
                if key not in by_key and key in ENTITY_TAGS:
                    by_key[key] = {"key": key, **ENTITY_TAGS[key]}
            merged = list(by_key.values())
            merged.sort(key=lambda r: r.get("sort_order", 0))
            return {"entity_tags": merged}
    except Exception:
        logger.info("vesta_entity_tags no existe todavia (migracion 013 pendiente) — usando default de models.py")
    return {"entity_tags": defaults}


@router.get("/budget/personal")
async def get_personal_budget(year: Optional[int] = None, month: Optional[int] = None, user: dict = Depends(get_current_user)):
    current_year = year or datetime.now().year
    budget_query = {"user_id": user["id"], "year": current_year}
    planned_budget = await db.personal_budgets.find_one(budget_query, {"_id": 0})
    expense_query = {"user_id": user["id"], "date": {"$regex": f"^{current_year}"}}
    if month:
        expense_query["date"] = {"$regex": f"^{current_year}-{str(month).zfill(2)}"}
    transactions = await db.transactions.find(expense_query, {"_id": 0, "amount": 1, "budget_category": 1, "category": 1, "date": 1}).to_list(10000)
    incomes = await db.incomes.find(expense_query, {"_id": 0}).to_list(1000)
    total_income = sum(i.get("amount", 0) for i in incomes)
    actuals = {}
    for t in transactions:
        cat = t.get("budget_category") or t.get("category") or "otros"
        actuals[cat] = actuals.get(cat, 0) + t.get("amount", 0)
    total_expenses = sum(actuals.values())
    budget_goals_data = get_budget_goals(user)
    goal_progress = {
        "gastos_fijos": {"target_percent": budget_goals_data["gastos_fijos_target"], "actual_percent": total_expenses / total_income if total_income > 0 else 0, "status": "on_track" if total_income > 0 and (total_expenses / total_income) <= budget_goals_data["gastos_fijos_target"]["max"] else "over"},
        "gastos_libres": {"target_annual": budget_goals_data["gastos_libres_max_annual"], "actual_annual": actuals.get("gastos_libres", 0), "remaining": budget_goals_data["gastos_libres_max_annual"] - actuals.get("gastos_libres", 0)}
    }
    budget_cats = get_budget_categories(user)
    return {"year": current_year, "month": month, "total_income": total_income, "total_expenses": total_expenses, "balance": total_income - total_expenses, "by_category": actuals, "planned": planned_budget.get("categories", {}) if planned_budget else {}, "goal_progress": goal_progress, "categories_config": budget_cats, "income_sources": (planned_budget or {}).get("income_sources")}


@router.post("/budget/personal")
async def save_personal_budget(budget_data: dict, user: dict = Depends(get_current_user)):
    if user["role"] not in [UserRole.ADMIN, UserRole.SPOUSE, "demo"]:
        raise HTTPException(status_code=403, detail="No autorizado")
    year = budget_data.get("year", datetime.now().year)
    income_struct = get_income_structure(user)
    budget_summ = get_budget_summary(user)
    budget_goals_data = get_budget_goals(user)
    budget_doc = {"user_id": user["id"], "year": year, "categories": budget_data.get("categories", {}), "income_projection": budget_data.get("income_projection", income_struct), "savings_goal": budget_data.get("savings_goal", budget_summ["ahorro_esperado"]), "investment_goal": budget_data.get("investment_goal", budget_summ["inversion_esperada"]), "goals": budget_data.get("goals", budget_goals_data), "updated_at": datetime.now(timezone.utc).isoformat()}
    await db.personal_budgets.update_one({"user_id": user["id"], "year": year}, {"$set": budget_doc}, upsert=True)
    return {"message": "Presupuesto guardado", "year": year}


@router.put("/budget/income-sources")
async def save_income_sources(data: dict, user: dict = Depends(get_current_user)):
    """Guarda custom_name de las fuentes de ingreso (Personal/APX/USA) en el
    documento personal_budgets del usuario. Estructura esperada:
    {income_sources: {Personal: {custom_name: "..."}, APX: {...}, USA: {...}}}"""
    year = data.get("year", datetime.now().year)
    income_sources = data.get("income_sources") or {}
    await db.personal_budgets.update_one(
        {"user_id": user["id"], "year": year},
        {"$set": {"income_sources": income_sources, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"income_sources": income_sources, "year": year}


@router.get("/budget/config")
async def get_budget_config(year: Optional[int] = None, user: dict = Depends(get_current_user)):
    current_year = year or datetime.now().year
    saved = await db.personal_budgets.find_one({"user_id": user["id"], "year": current_year}, {"_id": 0})
    base_budget_cats = get_budget_categories(user)
    merged_categories = dict(base_budget_cats)
    if saved and saved.get("categories"):
        saved_cats = saved["categories"]
        for key, default_cat in base_budget_cats.items():
            if key in saved_cats:
                merged_cat = dict(default_cat)
                saved_cat = saved_cats[key]
                merged_cat["monthly_budget"] = saved_cat.get("monthly_budget", default_cat.get("monthly_budget", 0))
                merged_cat["annual_budget"] = merged_cat["monthly_budget"] * 12
                merged_cat["name"] = saved_cat.get("name", default_cat.get("name", key))
                merged_cat["type"] = saved_cat.get("type", default_cat.get("type", "variable"))
                merged_cat["is_recurring"] = saved_cat.get("is_recurring", default_cat.get("is_recurring", False))
                default_subs = default_cat.get("subcategories", {})
                saved_subs = saved_cat.get("subcategories", {})
                if isinstance(default_subs, dict):
                    merged_subs = dict(default_subs)
                    if isinstance(saved_subs, dict):
                        merged_subs.update(saved_subs)
                    merged_cat["subcategories"] = merged_subs
                else:
                    merged_cat["subcategories"] = saved_subs if saved_subs else {}
                merged_categories[key] = merged_cat
            else:
                merged_categories[key] = default_cat
        for key, cat in saved_cats.items():
            if key not in base_budget_cats:
                merged_categories[key] = cat
    if "viajes_entretenimiento" in merged_categories:
        del merged_categories["viajes_entretenimiento"]
    return {"year": current_year, "categories": merged_categories, "income_projection": saved.get("income_projection", get_income_structure(user)) if saved else get_income_structure(user), "savings_goal": saved.get("savings_goal", get_budget_summary(user)["ahorro_esperado"]) if saved else get_budget_summary(user)["ahorro_esperado"], "investment_goal": saved.get("investment_goal", get_budget_summary(user)["inversion_esperada"]) if saved else get_budget_summary(user)["inversion_esperada"], "is_custom": saved is not None}


@router.put("/budget/category/{category_key}")
async def update_budget_category(category_key: str, category_data: dict, user: dict = Depends(get_current_user)):
    if user["role"] not in [UserRole.ADMIN, UserRole.SPOUSE]:
        raise HTTPException(status_code=403, detail="No autorizado")
    year = datetime.now().year
    budget = await db.personal_budgets.find_one({"user_id": user["id"], "year": year})
    if not budget:
        budget = {"user_id": user["id"], "year": year, "categories": dict(BUDGET_CATEGORIES), "income_projection": dict(INCOME_STRUCTURE), "savings_goal": dict(BUDGET_SUMMARY["ahorro_esperado"]), "investment_goal": dict(BUDGET_SUMMARY["inversion_esperada"])}
    categories = budget.get("categories", {})
    if category_key in categories:
        categories[category_key].update(category_data)
    else:
        categories[category_key] = category_data
    await db.personal_budgets.update_one({"user_id": user["id"], "year": year}, {"$set": {"categories": categories, "updated_at": datetime.now(timezone.utc).isoformat()}}, upsert=True)
    return {"message": f"Categoria {category_key} actualizada"}


@router.put("/budget/financial-goals")
async def update_financial_goals(goals_data: dict, user: dict = Depends(get_current_user)):
    if user["role"] not in [UserRole.ADMIN, UserRole.SPOUSE]:
        raise HTTPException(status_code=403, detail="No autorizado")
    year = datetime.now().year
    update_fields = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if "savings_goal" in goals_data:
        update_fields["savings_goal"] = {"annual": goals_data["savings_goal"], "monthly": round(goals_data["savings_goal"] / 12, 2), "description": "Ahorro para imprevistos"}
    if "investment_goal" in goals_data:
        update_fields["investment_goal"] = {"annual": goals_data["investment_goal"], "monthly": round(goals_data["investment_goal"] / 12, 2), "description": "Meta de inversion anual"}
    if "travel_savings_goal" in goals_data:
        update_fields["travel_savings_goal"] = {"annual": goals_data["travel_savings_goal"], "monthly": round(goals_data["travel_savings_goal"] / 12, 2), "description": "Ahorro mensual para viajes"}
    await db.personal_budgets.update_one({"user_id": user["id"], "year": year}, {"$set": update_fields}, upsert=True)
    return {"message": "Metas financieras actualizadas", "goals": update_fields}


@router.get("/budget/financial-goals")
async def get_financial_goals(user: dict = Depends(get_current_user)):
    year = datetime.now().year
    budget = await db.personal_budgets.find_one({"user_id": user["id"], "year": year}, {"_id": 0, "savings_goal": 1, "investment_goal": 1, "travel_savings_goal": 1})
    travel_fund = await db.travel_funds.find_one({"user_id": user["id"], "year": year}, {"_id": 0, "annual_budget": 1, "total_deposited": 1})
    default_savings = {"annual": 12000, "monthly": 1000, "description": "Ahorro para imprevistos"}
    default_investment = {"annual": 6000, "monthly": 500, "description": "Meta de inversion anual"}
    default_travel = {"annual": travel_fund.get("annual_budget", 16500) if travel_fund else 16500, "monthly": 0, "description": "Ahorro mensual para viajes"}
    if travel_fund:
        default_travel["saved"] = travel_fund.get("total_deposited", 0)
    return {"year": year, "savings_goal": budget.get("savings_goal", default_savings) if budget else default_savings, "investment_goal": budget.get("investment_goal", default_investment) if budget else default_investment, "travel_savings_goal": budget.get("travel_savings_goal", default_travel) if budget else default_travel}


@router.post("/budget/category")
async def add_budget_category(category_data: dict, user: dict = Depends(get_current_user)):
    if user["role"] not in [UserRole.ADMIN, UserRole.SPOUSE]:
        raise HTTPException(status_code=403, detail="No autorizado")
    category_key = category_data.get("key")
    if not category_key:
        raise HTTPException(status_code=400, detail="Se requiere key de categoria")
    year = datetime.now().year
    await db.personal_budgets.update_one({"user_id": user["id"], "year": year}, {"$set": {f"categories.{category_key}": category_data, "updated_at": datetime.now(timezone.utc).isoformat()}}, upsert=True)
    return {"message": f"Categoria {category_key} anadida"}


@router.delete("/budget/category/{category_key}")
async def delete_budget_category(category_key: str, user: dict = Depends(get_current_user)):
    if user["role"] not in [UserRole.ADMIN, UserRole.SPOUSE]:
        raise HTTPException(status_code=403, detail="No autorizado")
    year = datetime.now().year
    await db.personal_budgets.update_one({"user_id": user["id"], "year": year}, {"$unset": {f"categories.{category_key}": ""}})
    return {"message": f"Categoria {category_key} eliminada"}
