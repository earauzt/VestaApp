from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from typing import Optional
import uuid
import random

from database import db
from models import (
    ScheduledPayment, ExpectedIncomeCreate, AccountReceivableCreate,
    TravelGoalCreate, UserRole, is_demo_user, get_budget_goals
)
from utils import get_current_user

router = APIRouter()


# ================= SCHEDULED PAYMENTS =================

@router.get("/scheduled-payments")
async def get_scheduled_payments(user: dict = Depends(get_current_user)):
    payments = await db.scheduled_payments.find({"user_id": user["id"]}, {"_id": 0}).to_list(100)
    today = datetime.now(timezone.utc)
    current_month = today.month
    current_year = today.year
    for payment in payments:
        due_day = payment.get("due_day", 1)
        if today.day > due_day:
            next_month = current_month + 1 if current_month < 12 else 1
            next_year = current_year if current_month < 12 else current_year + 1
        else:
            next_month = current_month
            next_year = current_year
        payment["next_due_date"] = f"{next_year}-{str(next_month).zfill(2)}-{str(due_day).zfill(2)}"
        days_until_due = (datetime(next_year, next_month, min(due_day, 28)) - today.replace(tzinfo=None)).days
        payment["is_due_soon"] = days_until_due <= payment.get("reminder_days_before", 2)
        payment["days_until_due"] = days_until_due
    payments.sort(key=lambda x: x.get("next_due_date", ""))
    return payments


@router.post("/scheduled-payments")
async def create_scheduled_payment(payment: ScheduledPayment, user: dict = Depends(get_current_user)):
    if user["role"] not in [UserRole.ADMIN, UserRole.SPOUSE]:
        raise HTTPException(status_code=403, detail="No autorizado")
    payment_doc = {"id": str(uuid.uuid4()), "user_id": user["id"], **payment.model_dump(), "last_paid_date": None, "created_at": datetime.now(timezone.utc).isoformat()}
    await db.scheduled_payments.insert_one(payment_doc)
    del payment_doc["_id"]
    return payment_doc


@router.put("/scheduled-payments/{payment_id}")
async def update_scheduled_payment(payment_id: str, payment: ScheduledPayment, user: dict = Depends(get_current_user)):
    if user["role"] not in [UserRole.ADMIN, UserRole.SPOUSE]:
        raise HTTPException(status_code=403, detail="No autorizado")
    result = await db.scheduled_payments.update_one({"id": payment_id, "user_id": user["id"]}, {"$set": payment.model_dump()})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Pago no encontrado")
    return {"message": "Pago actualizado"}


@router.delete("/scheduled-payments/{payment_id}")
async def delete_scheduled_payment(payment_id: str, user: dict = Depends(get_current_user)):
    if user["role"] not in [UserRole.ADMIN, UserRole.SPOUSE]:
        raise HTTPException(status_code=403, detail="No autorizado")
    result = await db.scheduled_payments.delete_one({"id": payment_id, "user_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Pago no encontrado")
    return {"message": "Pago eliminado"}


@router.post("/scheduled-payments/{payment_id}/mark-paid")
async def mark_payment_paid(payment_id: str, user: dict = Depends(get_current_user)):
    if user["role"] not in [UserRole.ADMIN, UserRole.SPOUSE]:
        raise HTTPException(status_code=403, detail="No autorizado")
    result = await db.scheduled_payments.update_one({"id": payment_id, "user_id": user["id"]}, {"$set": {"last_paid_date": datetime.now(timezone.utc).strftime("%Y-%m-%d")}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Pago no encontrado")
    return {"message": "Marcado como pagado"}


# ================= EXPECTED INCOME =================

@router.get("/expected-income")
async def get_expected_income(user: dict = Depends(get_current_user)):
    items = await db.expected_income.find({"user_id": user["id"]}).sort("expected_date", 1).to_list(100)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    for item in items:
        if item.get("status") == "pending" and item.get("expected_date", "") < today:
            item["status"] = "overdue"
    total_pending = sum(i.get("amount", 0) for i in items if i.get("status") in ["pending", "overdue"])
    return {"items": [{k: v for k, v in item.items() if k != "_id"} for item in items], "total_pending": total_pending, "count": len(items)}


@router.post("/expected-income")
async def create_expected_income(income: ExpectedIncomeCreate, user: dict = Depends(get_current_user)):
    doc = {"id": str(uuid.uuid4()), "user_id": user["id"], **income.model_dump(), "status": "pending", "linked_transaction_id": None, "created_at": datetime.now(timezone.utc).isoformat()}
    await db.expected_income.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@router.put("/expected-income/{income_id}")
async def update_expected_income(income_id: str, updates: dict, user: dict = Depends(get_current_user)):
    result = await db.expected_income.update_one({"id": income_id, "user_id": user["id"]}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Ingreso no encontrado")
    return {"message": "Actualizado"}


@router.put("/expected-income/{income_id}/mark-received")
async def mark_income_received(income_id: str, user: dict = Depends(get_current_user)):
    income = await db.expected_income.find_one({"id": income_id, "user_id": user["id"]})
    if not income:
        raise HTTPException(status_code=404, detail="Ingreso no encontrado")
    transaction_id = str(uuid.uuid4())
    transaction_doc = {"id": transaction_id, "user_id": user["id"], "amount": income["amount"], "description": income["description"], "category": "ingreso", "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"), "transaction_type": "income", "source": income.get("source", "personal"), "status": "approved", "created_at": datetime.now(timezone.utc).isoformat()}
    await db.transactions.insert_one(transaction_doc)
    await db.expected_income.update_one({"id": income_id}, {"$set": {"status": "received", "linked_transaction_id": transaction_id, "received_at": datetime.now(timezone.utc).isoformat()}})
    return {"message": "Ingreso recibido", "transaction_id": transaction_id}


@router.delete("/expected-income/{income_id}")
async def delete_expected_income(income_id: str, user: dict = Depends(get_current_user)):
    result = await db.expected_income.delete_one({"id": income_id, "user_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Ingreso no encontrado")
    return {"message": "Eliminado"}


# ================= ACCOUNTS RECEIVABLE =================

@router.get("/accounts-receivable")
async def get_accounts_receivable(user: dict = Depends(get_current_user)):
    items = await db.accounts_receivable.find({"user_id": user["id"]}).sort("due_date", 1).to_list(100)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    for item in items:
        if item.get("status") == "pending" and item.get("due_date", "") < today:
            item["status"] = "overdue"
    total_pending = sum(i.get("amount", 0) - i.get("amount_paid", 0) for i in items if i.get("status") in ["pending", "overdue", "partial"])
    return {"items": [{k: v for k, v in item.items() if k != "_id"} for item in items], "total_pending": total_pending, "count": len(items)}


@router.post("/accounts-receivable")
async def create_account_receivable(account: AccountReceivableCreate, user: dict = Depends(get_current_user)):
    doc = {"id": str(uuid.uuid4()), "user_id": user["id"], **account.model_dump(), "amount_paid": 0, "status": "pending", "payment_history": [], "created_at": datetime.now(timezone.utc).isoformat()}
    await db.accounts_receivable.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@router.put("/accounts-receivable/{account_id}/payment")
async def record_receivable_payment(account_id: str, payment_data: dict, user: dict = Depends(get_current_user)):
    amount = payment_data.get("amount", 0)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Monto debe ser mayor a 0")
    account = await db.accounts_receivable.find_one({"id": account_id, "user_id": user["id"]})
    if not account:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")
    new_amount_paid = account.get("amount_paid", 0) + amount
    new_status = "paid" if new_amount_paid >= account["amount"] else "partial"
    payment_record = {"amount": amount, "date": datetime.now(timezone.utc).isoformat(), "id": str(uuid.uuid4())}
    await db.accounts_receivable.update_one({"id": account_id}, {"$set": {"amount_paid": new_amount_paid, "status": new_status}, "$push": {"payment_history": payment_record}})
    return {"message": "Pago registrado", "new_status": new_status}


@router.delete("/accounts-receivable/{account_id}")
async def delete_account_receivable(account_id: str, user: dict = Depends(get_current_user)):
    result = await db.accounts_receivable.delete_one({"id": account_id, "user_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")
    return {"message": "Eliminado"}


# ================= TRAVEL GOALS =================

@router.get("/travel-goals")
async def get_travel_goals(user: dict = Depends(get_current_user)):
    goals = await db.travel_goals.find({"user_id": user["id"]}).to_list(50)
    today = datetime.now(timezone.utc)
    result = []
    for goal in goals:
        goal_data = {k: v for k, v in goal.items() if k != "_id"}
        try:
            target = datetime.fromisoformat(goal["target_date"].replace("Z", "+00:00"))
            goal_data["days_remaining"] = max(0, (target - today).days)
        except Exception:
            goal_data["days_remaining"] = 0
        goal_data["progress_percent"] = min(100, round((goal.get("saved_amount", 0) / goal["target_amount"]) * 100))
        if goal_data["days_remaining"] > 0:
            remaining = goal["target_amount"] - goal.get("saved_amount", 0)
            months_remaining = max(1, goal_data["days_remaining"] / 30)
            goal_data["monthly_needed"] = round(remaining / months_remaining, 2)
        else:
            goal_data["monthly_needed"] = 0
        result.append(goal_data)
    return {"goals": result, "count": len(result)}


@router.post("/travel-goals")
async def create_travel_goal(goal: TravelGoalCreate, user: dict = Depends(get_current_user)):
    doc = {"id": str(uuid.uuid4()), "user_id": user["id"], **goal.model_dump(), "saved_amount": 0, "status": "active", "created_at": datetime.now(timezone.utc).isoformat()}
    await db.travel_goals.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@router.put("/travel-goals/{goal_id}")
async def update_travel_goal(goal_id: str, updates: dict, user: dict = Depends(get_current_user)):
    result = await db.travel_goals.update_one({"id": goal_id, "user_id": user["id"]}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Meta no encontrada")
    return {"message": "Actualizado"}


@router.put("/travel-goals/{goal_id}/add-savings")
async def add_travel_savings(goal_id: str, amount: float, user: dict = Depends(get_current_user)):
    goal = await db.travel_goals.find_one({"id": goal_id, "user_id": user["id"]})
    if not goal:
        raise HTTPException(status_code=404, detail="Meta no encontrada")
    new_saved = goal.get("saved_amount", 0) + amount
    new_status = "completed" if new_saved >= goal["target_amount"] else "active"
    await db.travel_goals.update_one({"id": goal_id}, {"$set": {"saved_amount": new_saved, "status": new_status}})
    return {"message": "Ahorro agregado", "new_saved": new_saved, "status": new_status}


@router.delete("/travel-goals/{goal_id}")
async def delete_travel_goal(goal_id: str, user: dict = Depends(get_current_user)):
    result = await db.travel_goals.delete_one({"id": goal_id, "user_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Meta no encontrada")
    return {"message": "Eliminado"}


# ================= TRAVEL FUND =================

@router.get("/travel-fund")
async def get_travel_fund(year: int = None, user: dict = Depends(get_current_user)):
    current_year = year or datetime.now().year
    fund = await db.travel_funds.find_one({"user_id": user["id"], "year": current_year}, {"_id": 0})
    if not fund:
        budget_goals = get_budget_goals(user)
        annual_budget = 16500 if not is_demo_user(user) else 2000
        fund = {"id": str(uuid.uuid4()), "user_id": user["id"], "year": current_year, "annual_budget": annual_budget, "total_deposited": 0, "deposits": [], "created_at": datetime.now(timezone.utc).isoformat()}
        await db.travel_funds.insert_one(fund)
        fund = {k: v for k, v in fund.items() if k != "_id"}

    year_start = f"{current_year}-01-01"
    year_end = f"{current_year}-12-31"
    travel_expenses = await db.transactions.find({"user_id": user["id"], "category": {"$in": ["viajes_entretenimiento", "viajes_internacionales", "turismo"]}, "transaction_type": "expense", "date": {"$gte": year_start, "$lte": year_end}}).to_list(500)
    total_spent = sum(t.get("amount", 0) for t in travel_expenses)

    spending_by_subcategory = {}
    for t in travel_expenses:
        subcat = t.get("subcategory", "Otros") or "Otros"
        spending_by_subcategory[subcat] = spending_by_subcategory.get(subcat, 0) + t.get("amount", 0)
    spending_breakdown = [{"subcategory": k, "amount": v} for k, v in sorted(spending_by_subcategory.items(), key=lambda x: x[1], reverse=True)]

    card_expenses = [t for t in travel_expenses if t.get("payment_method") in ["tarjeta", "credit_card", "apple_card"]]
    total_on_card = sum(t.get("amount", 0) for t in card_expenses)

    travel_deferred = await db.deferred_payments.find({"user_id": user["id"], "remaining_installments": {"$gt": 0}}).to_list(50)
    travel_keywords = ["viaje", "hotel", "vuelo", "avion", "airbnb", "booking", "despegar", "latam", "avianca", "copa"]
    pending_card_payments = sum(d.get("remaining_installments", 0) * d.get("monthly_payment", 0) for d in travel_deferred if any(kw in d.get("description", "").lower() for kw in travel_keywords))

    annual_budget = fund.get("annual_budget", 0)
    total_saved = fund.get("total_deposited", 0)
    available = max(0, total_saved - total_spent)
    pending_to_save = max(0, annual_budget - total_saved)
    savings_progress = round((total_saved / annual_budget * 100), 1) if annual_budget > 0 else 0
    remaining_months = max(1, 12 - datetime.now().month + 1)
    monthly_suggested_saving = round(pending_to_save / remaining_months, 2) if pending_to_save > 0 else 0

    return {"year": current_year, "annual_budget": annual_budget, "total_saved": total_saved, "total_deposited": total_saved, "savings_progress": savings_progress, "pending_to_save": pending_to_save, "total_spent": total_spent, "spending_breakdown": spending_breakdown, "spent_with_card": total_on_card, "pending_card_payments": pending_card_payments, "available": available, "deposits": fund.get("deposits", [])[-10:], "monthly_suggested_saving": monthly_suggested_saving}


@router.put("/travel-fund/settings")
async def update_travel_fund_settings(settings: dict, user: dict = Depends(get_current_user)):
    current_year = datetime.now().year
    annual_budget = settings.get("annual_budget", 16500)
    await db.travel_funds.update_one({"user_id": user["id"], "year": current_year}, {"$set": {"annual_budget": annual_budget}}, upsert=True)
    return {"message": "Configuracion actualizada", "annual_budget": annual_budget}


@router.post("/travel-fund/deposit")
async def add_travel_fund_deposit(deposit_data: dict, user: dict = Depends(get_current_user)):
    amount = deposit_data.get("amount", 0)
    note = deposit_data.get("note", "Deposito al fondo de viajes")
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Monto debe ser mayor a 0")
    current_year = datetime.now().year
    deposit = {"id": str(uuid.uuid4()), "amount": amount, "note": note, "date": datetime.now(timezone.utc).isoformat()}
    await db.travel_funds.update_one({"user_id": user["id"], "year": current_year}, {"$inc": {"total_deposited": amount}, "$push": {"deposits": deposit}}, upsert=True)
    fund = await db.travel_funds.find_one({"user_id": user["id"], "year": current_year}, {"_id": 0})
    return {"message": f"${amount:,.2f} agregado al fondo de viajes", "total_deposited": fund.get("total_deposited", amount), "deposit": deposit}


@router.get("/travel-fund/transactions")
async def get_travel_transactions(user: dict = Depends(get_current_user), year: int = None):
    current_year = year or datetime.now().year
    year_start = f"{current_year}-01-01"
    year_end = f"{current_year}-12-31"
    transactions = await db.transactions.find({"user_id": user["id"], "category": {"$in": ["viajes_entretenimiento", "viajes_internacionales", "turismo"]}, "transaction_type": "expense", "date": {"$gte": year_start, "$lte": year_end}}, {"_id": 0}).sort("date", -1).to_list(500)
    by_subcategory = {}
    for t in transactions:
        subcat = t.get("subcategory", "Otros") or "Otros"
        if subcat not in by_subcategory:
            by_subcategory[subcat] = {"total": 0, "count": 0}
        by_subcategory[subcat]["total"] += t.get("amount", 0)
        by_subcategory[subcat]["count"] += 1
    subcategory_summary = [{"subcategory": k, "total": v["total"], "count": v["count"]} for k, v in sorted(by_subcategory.items(), key=lambda x: x[1]["total"], reverse=True)]
    total = sum(t.get("amount", 0) for t in transactions)
    return {"year": current_year, "transactions": transactions, "total": total, "count": len(transactions), "by_subcategory": subcategory_summary}


# ================= CASH FLOW PROJECTION =================

@router.get("/cashflow/projection")
async def get_cashflow_projection(user: dict = Depends(get_current_user)):
    today = datetime.now(timezone.utc)
    thirty_days = today + timedelta(days=30)
    thirty_str = thirty_days.strftime("%Y-%m-%d")

    expected_income = await db.expected_income.find({"user_id": user["id"], "status": "pending", "expected_date": {"$lte": thirty_str}}).to_list(100)
    total_expected_income = sum(i.get("amount", 0) for i in expected_income)

    receivables = await db.accounts_receivable.find({"user_id": user["id"], "status": {"$in": ["pending", "overdue", "partial"]}, "due_date": {"$lte": thirty_str}}).to_list(100)
    total_receivables = sum(r.get("amount", 0) - r.get("amount_paid", 0) for r in receivables)

    scheduled = await db.scheduled_payments.find({"user_id": user["id"]}).to_list(100)
    total_scheduled = sum(s.get("amount", 0) for s in scheduled)

    cards = await db.credit_cards.find({"user_id": user["id"]}).to_list(10)
    total_card_minimums = sum(c.get("minimum_payment", 0) for c in cards)

    deferred = await db.deferred_payments.find({"user_id": user["id"], "remaining_installments": {"$gt": 0}}).to_list(50)
    total_deferred = sum(d.get("monthly_payment", 0) for d in deferred)

    total_outflow = total_scheduled + total_card_minimums + total_deferred
    total_inflow = total_expected_income + total_receivables
    projected_balance = total_inflow - total_outflow

    if projected_balance < 0:
        status = "critical"
        message = f"Deficit proyectado de ${abs(projected_balance):,.2f} en 30 dias"
    elif projected_balance < total_outflow * 0.2:
        status = "warning"
        message = "Flujo ajustado - considera postergar gastos no esenciales"
    else:
        status = "healthy"
        message = "Flujo de caja saludable para los proximos 30 dias"

    return {"projection": {"expected_income": total_expected_income, "receivables": total_receivables, "total_inflow": total_inflow, "scheduled_payments": total_scheduled, "card_minimums": total_card_minimums, "deferred_payments": total_deferred, "total_outflow": total_outflow, "projected_balance": projected_balance}, "status": status, "message": message, "details": {"expected_income_count": len(expected_income), "receivables_count": len(receivables), "scheduled_count": len(scheduled), "cards_count": len(cards), "deferred_count": len(deferred)}}


# ================= REMINDERS =================

@router.get("/reminders")
async def get_reminders(user: dict = Depends(get_current_user)):
    today = datetime.now(timezone.utc)
    reminders = []

    scheduled = await db.scheduled_payments.find({"user_id": user["id"]}, {"_id": 0}).to_list(100)
    for payment in scheduled:
        due_day = payment.get("due_day", 1)
        current_month = today.month
        current_year = today.year
        if today.day > due_day:
            next_month = current_month + 1 if current_month < 12 else 1
            next_year = current_year if current_month < 12 else current_year + 1
        else:
            next_month = current_month
            next_year = current_year
        try:
            due_date = datetime(next_year, next_month, min(due_day, 28))
            days_until = (due_date - today.replace(tzinfo=None)).days
            if days_until <= payment.get("reminder_days_before", 2) and days_until >= 0:
                reminders.append({"type": "payment_due", "priority": "high" if days_until == 0 else "medium", "title": f"Pago de {payment['name']}", "message": f"Vence {'hoy' if days_until == 0 else f'en {days_until} dias'} - ${payment['amount']:.2f}", "action": f"Pagar con {payment.get('payment_method', 'transferencia')}", "category": payment.get("category"), "amount": payment.get("amount")})
        except Exception:
            pass

    cards = await db.credit_cards.find({"user_id": user["id"]}, {"_id": 0}).to_list(100)
    for card in cards:
        if card.get("current_balance", 0) > 0:
            payment_day = card.get("payment_due_day", 15)
            current_month = today.month
            current_year = today.year
            if today.day > payment_day:
                next_month = current_month + 1 if current_month < 12 else 1
                next_year = current_year if current_month < 12 else current_year + 1
            else:
                next_month = current_month
                next_year = current_year
            try:
                due_date = datetime(next_year, next_month, min(payment_day, 28))
                days_until = (due_date - today.replace(tzinfo=None)).days
                if days_until <= 5 and days_until >= 0:
                    reminders.append({"type": "card_payment", "priority": "high" if days_until <= 2 else "medium", "title": f"Pago tarjeta {card['name']}", "message": f"Minimo: ${card.get('minimum_payment', 0):.2f} | Total: ${card['current_balance']:.2f}", "action": f"Vence {'hoy' if days_until == 0 else f'en {days_until} dias'}", "card_id": card.get("id"), "apr": card.get("apr")})
            except Exception:
                pass

    recurring_expenses = await db.transactions.find({"user_id": user["id"], "is_recurring": True, "transaction_type": "expense"}, {"_id": 0}).to_list(100)
    for expense in recurring_expenses[:3]:
        reminders.append({"type": "subscription_review", "priority": "low", "title": f"Sigues usando {expense.get('description', 'este servicio')}?", "message": f"${expense.get('amount', 0):.2f}/mes - Revisa si lo necesitas", "action": "Revisar"})

    medical_expenses = await db.transactions.find({"user_id": user["id"], "category": "salud", "date": {"$gte": (today - timedelta(days=30)).strftime("%Y-%m-%d")}}, {"_id": 0}).to_list(10)
    for med in medical_expenses[:2]:
        if not med.get("sent_to_insurance"):
            reminders.append({"type": "insurance_reminder", "priority": "medium", "title": "Enviar factura al seguro", "message": f"{med.get('description', 'Gasto medico')} - ${med.get('amount', 0):.2f}", "action": "Enviar para deducible de prima"})

    if not any(r["priority"] == "high" for r in reminders):
        motivational = ["Vas bien! Sigue controlando tus gastos.", "Recuerda tu meta: Gastos fijos 55-65%", "Tip: Revisa tus suscripciones mensualmente", "Excelente! No tienes pagos urgentes pendientes", "Cada dia sin deuda nueva es un paso adelante"]
        reminders.append({"type": "motivation", "priority": "low", "title": random.choice(motivational), "message": "", "action": None})

    priority_order = {"high": 0, "medium": 1, "low": 2}
    reminders.sort(key=lambda x: priority_order.get(x.get("priority", "low"), 2))
    return reminders
