from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from typing import Optional
import uuid

from database import db
from models import DeferredPaymentModel
from utils import get_current_user

router = APIRouter()


@router.get("/deferred-payments")
async def get_deferred_payments(user: dict = Depends(get_current_user)):
    payments = await db.deferred_payments.find({"user_id": user["id"], "remaining_installments": {"$gt": 0}}, {"_id": 0}).sort("card_name", 1).to_list(100)
    total_remaining = sum(p.get("monthly_payment", 0) * p.get("remaining_installments", 0) for p in payments)
    total_monthly = sum(p.get("monthly_payment", 0) for p in payments)
    return {"payments": payments, "total_remaining": total_remaining, "total_monthly_obligation": total_monthly, "count": len(payments)}


@router.post("/deferred-payments")
async def create_deferred_payment(payment: DeferredPaymentModel, user: dict = Depends(get_current_user)):
    payment_doc = {"id": str(uuid.uuid4()), "user_id": user["id"], **payment.model_dump(), "created_at": datetime.now(timezone.utc).isoformat()}
    await db.deferred_payments.insert_one(payment_doc)
    return {"message": "Diferido creado", "payment": {k: v for k, v in payment_doc.items() if k != "_id"}}


@router.put("/deferred-payments/{payment_id}")
async def update_deferred_payment(payment_id: str, update_data: dict, user: dict = Depends(get_current_user)):
    result = await db.deferred_payments.update_one({"id": payment_id, "user_id": user["id"]}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Diferido no encontrado")
    return {"message": "Diferido actualizado"}


@router.delete("/deferred-payments/{payment_id}")
async def delete_deferred_payment(payment_id: str, user: dict = Depends(get_current_user)):
    result = await db.deferred_payments.delete_one({"id": payment_id, "user_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Diferido no encontrado")
    return {"message": "Diferido eliminado"}


@router.post("/deferred-payments/{payment_id}/register-installment")
async def register_deferred_installment(payment_id: str, amount: Optional[float] = None, user: dict = Depends(get_current_user)):
    payment = await db.deferred_payments.find_one({"id": payment_id, "user_id": user["id"]}, {"_id": 0})
    if not payment:
        raise HTTPException(status_code=404, detail="Diferido no encontrado")
    remaining = payment.get("remaining_installments", 0)
    if remaining <= 0:
        return {"message": "Este diferido ya esta pagado completamente"}
    monthly_payment = payment.get("monthly_payment", 0)
    payment_amount = amount or monthly_payment
    new_remaining = remaining - 1
    new_remaining_amount = new_remaining * monthly_payment
    await db.deferred_payments.update_one({"id": payment_id}, {"$set": {"remaining_installments": new_remaining, "remaining_amount": new_remaining_amount, "last_payment_date": datetime.now(timezone.utc).isoformat(), "paid_installments": payment.get("paid_installments", 0) + 1}})
    return {"message": f"Cuota registrada. Quedan {new_remaining} cuotas", "remaining_installments": new_remaining, "remaining_amount": new_remaining_amount}
