from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from typing import Optional
import uuid

from database import db
from models import (
    DashboardStats, SRI_CATEGORIES, CANASTA_BASICA, FRACCION_BASICA_EXENTA,
    CARGAS_FAMILIARES_CBF, PORCENTAJE_REBAJA_IR, CONTRIBUYENTE_INFO,
    INCOME_SOURCES, PAYMENT_SOURCES, INTERNATIONAL_COUNTRIES
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


@router.get("/sri/deduction-limits")
async def get_sri_deduction_limits(cargas_familiares: int = 0, user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    start_of_year = f"{now.year}-01-01"
    transactions = await db.transactions.find({"user_id": user["id"], "date": {"$gte": start_of_year}, "transaction_type": "expense"}, {"_id": 0}).to_list(10000)

    spent_by_category = {}
    total_deductible = 0
    total_non_deductible = 0
    for t in transactions:
        cat = t.get("category", "otros")
        amount = t.get("amount", 0)
        if cat not in spent_by_category:
            spent_by_category[cat] = 0
        spent_by_category[cat] += amount
        if SRI_CATEGORIES.get(cat, {}).get("deductible", False):
            total_deductible += amount
        else:
            total_non_deductible += amount

    cargas = min(cargas_familiares, 5)
    num_cbf = CARGAS_FAMILIARES_CBF.get(cargas, 7)
    limite_global = num_cbf * CANASTA_BASICA

    category_progress = []
    for cat_key, cat_info in SRI_CATEGORIES.items():
        if cat_info.get("deductible", False):
            spent = spent_by_category.get(cat_key, 0)
            limit = cat_info.get("limit_usd", 0)
            percentage = (spent / limit * 100) if limit > 0 else 0
            category_progress.append({"category": cat_key, "name": cat_info["name"], "spent": round(spent, 2), "limit": limit, "percentage": round(min(percentage, 100), 1), "remaining": round(max(0, limit - spent), 2), "over_limit": spent > limit, "description": cat_info.get("description", "")})
    category_progress.sort(key=lambda x: x["percentage"], reverse=True)

    gastos_aplicables = min(total_deductible, limite_global)
    rebaja_ir = gastos_aplicables * PORCENTAJE_REBAJA_IR

    return {
        "year": now.year, "contribuyente": CONTRIBUYENTE_INFO, "cargas_familiares": cargas_familiares,
        "canasta_basica": CANASTA_BASICA, "fraccion_basica_exenta": FRACCION_BASICA_EXENTA,
        "limite_global": round(limite_global, 2), "total_deductible_spent": round(total_deductible, 2),
        "total_non_deductible_spent": round(total_non_deductible, 2), "gastos_aplicables": round(gastos_aplicables, 2),
        "rebaja_ir_estimada": round(rebaja_ir, 2), "porcentaje_rebaja": PORCENTAJE_REBAJA_IR * 100,
        "percentage_used": round((total_deductible / limite_global * 100) if limite_global > 0 else 0, 1),
        "remaining_global": round(max(0, limite_global - total_deductible), 2),
        "category_progress": category_progress,
        "alerts": generate_sri_alerts(category_progress, total_deductible, limite_global)
    }
