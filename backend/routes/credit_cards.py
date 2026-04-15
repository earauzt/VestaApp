from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from typing import Optional
import uuid
import copy

from database import db
from models import CreditCard, CreditCardUpdate, DebtPayment, SnowballPlan, UserRole
from utils import get_current_user

router = APIRouter()


@router.get("/credit-cards")
async def get_credit_cards(user: dict = Depends(get_current_user)):
    cards = await db.credit_cards.find({"user_id": user["id"]}, {"_id": 0}).to_list(100)
    for card in cards:
        card["available_credit"] = card.get("credit_limit", 0) - card.get("current_balance", 0)
    return cards


@router.post("/credit-cards")
async def create_credit_card(card: CreditCard, user: dict = Depends(get_current_user)):
    if user["role"] not in [UserRole.ADMIN, UserRole.SPOUSE]:
        raise HTTPException(status_code=403, detail="No autorizado")
    card_doc = {"id": str(uuid.uuid4()), "user_id": user["id"], **card.model_dump(), "available_credit": card.credit_limit - card.current_balance, "created_at": datetime.now(timezone.utc).isoformat(), "updated_at": None}
    await db.credit_cards.insert_one(card_doc)
    del card_doc["_id"]
    return card_doc


@router.put("/credit-cards/{card_id}")
async def update_credit_card(card_id: str, card: CreditCardUpdate, user: dict = Depends(get_current_user)):
    if user["role"] not in [UserRole.ADMIN, UserRole.SPOUSE]:
        raise HTTPException(status_code=403, detail="No autorizado")
    existing_card = await db.credit_cards.find_one({"id": card_id, "user_id": user["id"]}, {"_id": 0})
    if not existing_card:
        raise HTTPException(status_code=404, detail="Tarjeta no encontrada")
    update_data = {}
    card_dict = card.model_dump(exclude_none=True)
    for key, value in card_dict.items():
        if value is not None:
            update_data[key] = value
    new_limit = update_data.get("credit_limit", existing_card.get("credit_limit", 0))
    new_balance = update_data.get("current_balance", existing_card.get("current_balance", 0))
    update_data["available_credit"] = new_limit - new_balance
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.credit_cards.update_one({"id": card_id, "user_id": user["id"]}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Tarjeta no encontrada")
    return {"message": "Tarjeta actualizada"}


@router.delete("/credit-cards/{card_id}")
async def delete_credit_card(card_id: str, user: dict = Depends(get_current_user)):
    if user["role"] not in [UserRole.ADMIN, UserRole.SPOUSE]:
        raise HTTPException(status_code=403, detail="No autorizado")
    result = await db.credit_cards.delete_one({"id": card_id, "user_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Tarjeta no encontrada")
    return {"message": "Tarjeta eliminada"}


@router.get("/debt/summary")
async def get_debt_summary(user: dict = Depends(get_current_user)):
    cards = await db.credit_cards.find({"user_id": user["id"]}, {"_id": 0}).to_list(100)
    total_debt = sum(c.get("current_balance", 0) for c in cards)
    total_limit = sum(c.get("credit_limit", 0) for c in cards)
    total_minimum = sum(c.get("minimum_payment", 0) for c in cards)
    weighted_apr = sum(c.get("current_balance", 0) * c.get("apr", 0) for c in cards) / total_debt if total_debt > 0 else 0
    cards_by_apr = sorted(cards, key=lambda x: x.get("apr", 0), reverse=True)
    return {"total_debt": total_debt, "total_credit_limit": total_limit, "total_available_credit": total_limit - total_debt, "total_minimum_payment": total_minimum, "weighted_average_apr": round(weighted_apr, 2), "utilization_rate": round((total_debt / total_limit * 100) if total_limit > 0 else 0, 1), "cards_count": len(cards), "cards": cards, "highest_apr_card": cards_by_apr[0] if cards_by_apr else None}


@router.post("/debt/snowball-plan")
async def calculate_snowball_plan(plan: SnowballPlan, user: dict = Depends(get_current_user)):
    cards = await db.credit_cards.find({"user_id": user["id"], "current_balance": {"$gt": 0}}, {"_id": 0}).to_list(100)
    if not cards:
        return {"message": "No hay deudas activas", "plan": [], "months_to_payoff": 0}
    if plan.strategy == "avalanche":
        cards = sorted(cards, key=lambda x: x.get("apr", 0), reverse=True)
    else:
        cards = sorted(cards, key=lambda x: x.get("current_balance", 0))

    payoff_plan = []
    months = 0
    max_months = 120
    sim_cards = copy.deepcopy(cards)
    while any(c["current_balance"] > 0 for c in sim_cards) and months < max_months:
        months += 1
        month_plan = {"month": months, "payments": [], "total_payment": 0}
        for card in sim_cards:
            if card["current_balance"] > 0:
                monthly_interest = card["current_balance"] * (card["apr"] / 100 / 12)
                card["current_balance"] += monthly_interest
                min_payment = min(card["minimum_payment"], card["current_balance"])
                card["current_balance"] -= min_payment
                month_plan["payments"].append({"card": card["name"], "payment": min_payment, "remaining": card["current_balance"], "type": "minimum"})
                month_plan["total_payment"] += min_payment
        extra_remaining = plan.extra_payment
        for card in sim_cards:
            if card["current_balance"] > 0 and extra_remaining > 0:
                extra_to_pay = min(extra_remaining, card["current_balance"])
                card["current_balance"] -= extra_to_pay
                extra_remaining -= extra_to_pay
                for p in month_plan["payments"]:
                    if p["card"] == card["name"]:
                        p["payment"] += extra_to_pay
                        p["remaining"] = card["current_balance"]
                        p["type"] = "extra" if extra_to_pay > 0 else p["type"]
                        break
                month_plan["total_payment"] += extra_to_pay
                if card["current_balance"] <= 0:
                    card["current_balance"] = 0
        payoff_plan.append(month_plan)

    total_paid = sum(m["total_payment"] for m in payoff_plan)
    original_debt = sum(c.get("current_balance", 0) for c in cards)
    total_interest = total_paid - original_debt
    return {"strategy": plan.strategy, "strategy_name": "Avalanche (mayor interes primero)" if plan.strategy == "avalanche" else "Snowball (menor saldo primero)", "months_to_payoff": months, "years_to_payoff": round(months / 12, 1), "total_paid": round(total_paid, 2), "total_interest": round(total_interest, 2), "original_debt": round(original_debt, 2), "extra_payment_monthly": plan.extra_payment, "payoff_order": [c["name"] for c in cards], "monthly_plan": payoff_plan[:12], "recommendation": f"Paga primero {cards[0]['name']} ({cards[0]['apr']}% APR) para ahorrar en intereses" if cards else None}


@router.post("/debt/payment")
async def record_debt_payment(payment: DebtPayment, user: dict = Depends(get_current_user)):
    if user["role"] not in [UserRole.ADMIN, UserRole.SPOUSE]:
        raise HTTPException(status_code=403, detail="No autorizado")
    card = await db.credit_cards.find_one({"id": payment.card_id, "user_id": user["id"]})
    if not card:
        raise HTTPException(status_code=404, detail="Tarjeta no encontrada")
    new_balance = max(0, card["current_balance"] - payment.amount)
    await db.credit_cards.update_one({"id": payment.card_id}, {"$set": {"current_balance": new_balance, "updated_at": datetime.now(timezone.utc).isoformat()}})
    payment_doc = {"id": str(uuid.uuid4()), "user_id": user["id"], "card_id": payment.card_id, "card_name": card["name"], "amount": payment.amount, "payment_type": payment.payment_type, "date": payment.date, "balance_after": new_balance, "created_at": datetime.now(timezone.utc).isoformat()}
    await db.debt_payments.insert_one(payment_doc)
    return {"message": "Pago registrado", "new_balance": new_balance}
