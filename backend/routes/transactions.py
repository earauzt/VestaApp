from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from typing import List, Optional
import uuid
import re

from database import db
from models import (
    TransactionCreate, TransactionResponse, TransactionSplitRequest,
    TransactionStatus, SourceType, SRI_CATEGORIES, INTERNATIONAL_COUNTRIES,
    CategorizationRule, DEFAULT_CATEGORIZATION_RULES, apply_categorization_rules
)
from utils import get_current_user, find_potential_duplicates

router = APIRouter()


@router.post("/transactions", response_model=TransactionResponse)
async def create_transaction(transaction: TransactionCreate, user: dict = Depends(get_current_user)):
    transaction_id = str(uuid.uuid4())
    duplicates = await find_potential_duplicates(user["id"], transaction.amount, transaction.date, transaction.establishment, transaction.description)

    initial_status = transaction.status
    duplicate_of = None
    match_confidence = None
    if duplicates:
        initial_status = TransactionStatus.DUPLICATE_SUSPECT
        duplicate_of = duplicates[0]["transaction"]["id"]
        match_confidence = duplicates[0]["confidence"]

    is_international = transaction.is_international
    if transaction.country:
        is_international = any(c.lower() in transaction.country.lower() for c in INTERNATIONAL_COUNTRIES)

    category = transaction.category
    if is_international and transaction.transaction_type == "expense":
        category = "viajes_internacionales"

    is_deductible = SRI_CATEGORIES.get(category, {}).get("deductible", False) and not is_international

    doc = {
        "id": transaction_id,
        "user_id": user["id"],
        **transaction.model_dump(),
        "category": category,
        "is_international": is_international,
        "is_deductible": is_deductible,
        "status": initial_status,
        "duplicate_of": duplicate_of,
        "match_confidence": match_confidence,
        "ai_classified": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.transactions.insert_one(doc)
    try:
        from routes.sri_match import try_sri_match, retry_pending_matches
        if transaction.transaction_type == "expense":
            await try_sri_match(user["id"], transaction_id)
            await retry_pending_matches(user["id"])
    except Exception:
        pass
    response_doc = {k: v for k, v in doc.items() if k != "_id"}
    if duplicates:
        response_doc["_duplicate_warning"] = {"message": "Posible duplicado detectado", "potential_match": duplicates[0]["transaction"]["id"], "confidence": match_confidence}
    return TransactionResponse(**response_doc)


@router.get("/transactions", response_model=List[TransactionResponse])
async def get_transactions(start_date: Optional[str] = None, end_date: Optional[str] = None, category: Optional[str] = None, transaction_type: Optional[str] = None, user: dict = Depends(get_current_user)):
    query = {"user_id": user["id"]}
    if start_date:
        query["date"] = {"$gte": start_date}
    if end_date:
        query.setdefault("date", {})["$lte"] = end_date
    if category:
        query["category"] = category
    if transaction_type:
        query["transaction_type"] = transaction_type
    transactions = await db.transactions.find(query, {"_id": 0}).sort("date", -1).to_list(1000)
    return [TransactionResponse(**t) for t in transactions]


@router.delete("/transactions/{transaction_id}")
async def delete_transaction(transaction_id: str, user: dict = Depends(get_current_user)):
    result = await db.transactions.delete_one({"id": transaction_id, "user_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Transaccion no encontrada")
    return {"message": "Transaccion eliminada"}


@router.put("/transactions/{transaction_id}", response_model=TransactionResponse)
async def update_transaction(transaction_id: str, transaction: TransactionCreate, user: dict = Depends(get_current_user)):
    existing = await db.transactions.find_one({"id": transaction_id, "user_id": user["id"]}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Transaccion no encontrada")
    update_data = transaction.model_dump()
    if update_data.get("uso_empresarial"):
        update_data["is_deductible"] = False
    await db.transactions.update_one({"id": transaction_id}, {"$set": update_data})
    # Propagar aprendizaje a known_vendors si la categoría cambió (SESIÓN 13 Task 1)
    old_cat = existing.get("category") or existing.get("personal_category")
    new_cat = update_data.get("category") or update_data.get("personal_category")
    establishment = (update_data.get("establishment") or existing.get("establishment") or "").strip()
    if new_cat and new_cat != old_cat and establishment:
        normalized = establishment.lower()
        existing_vendor = await db.known_vendors.find_one({
            "user_id": user["id"],
            "establishment": {"$regex": f"^{re.escape(normalized)}$", "$options": "i"}
        })
        now_iso = datetime.now(timezone.utc).isoformat()
        vendor_set = {
            "personal_category": new_cat,
            "sri_category": update_data.get("sri_category"),
            "subcategory": update_data.get("subcategory") or "General",
            "is_deductible": bool(update_data.get("is_deductible")),
            "last_used": now_iso,
        }
        if existing_vendor:
            await db.known_vendors.update_one(
                {"id": existing_vendor["id"]},
                {"$set": vendor_set, "$inc": {"times_used": 1}}
            )
        else:
            await db.known_vendors.insert_one({
                "id": str(uuid.uuid4()), "user_id": user["id"], "establishment": establishment,
                **vendor_set, "times_used": 1, "created_at": now_iso
            })
    updated = await db.transactions.find_one({"id": transaction_id}, {"_id": 0})
    return TransactionResponse(**updated)


@router.post("/transactions/fix-null-types")
async def fix_null_transaction_types(user: dict = Depends(get_current_user)):
    """Itera transacciones con transaction_type None/missing y las infiere por el signo del amount."""
    cursor = db.transactions.find(
        {"user_id": user["id"], "$or": [{"transaction_type": None}, {"transaction_type": {"$exists": False}}]},
        {"_id": 0, "id": 1, "amount": 1},
    )
    fixed_expense = 0
    fixed_income = 0
    unchanged = 0
    async for tx in cursor:
        amount = tx.get("amount")
        if amount is None:
            unchanged += 1
            continue
        try:
            a = float(amount)
        except (TypeError, ValueError):
            unchanged += 1
            continue
        if a < 0:
            new_type = "expense"
            fixed_expense += 1
        elif a > 0:
            new_type = "income"
            fixed_income += 1
        else:
            unchanged += 1
            continue
        await db.transactions.update_one({"id": tx["id"]}, {"$set": {"transaction_type": new_type}})
    return {"fixed_expense": fixed_expense, "fixed_income": fixed_income, "unchanged": unchanged}


@router.post("/transactions/bulk-categorize")
async def bulk_categorize_transactions(payload: dict, user: dict = Depends(get_current_user)):
    """Actualiza categoría/subcategoría de varias transacciones en una sola llamada.
    Body: {ids: [str], category: str, subcategory?: str}.
    Adicionalmente upsert de known_vendors para cada establecimiento único."""
    ids = payload.get("ids") or []
    category = (payload.get("category") or "").strip()
    subcategory = (payload.get("subcategory") or "").strip()
    if not ids or not category:
        raise HTTPException(status_code=400, detail="ids y category son requeridos")

    update_set = {"category": category}
    if subcategory:
        update_set["subcategory"] = subcategory
    result = await db.transactions.update_many(
        {"id": {"$in": ids}, "user_id": user["id"]},
        {"$set": update_set},
    )

    # Upsert known_vendors para cada establecimiento único de las tx seleccionadas.
    txs = await db.transactions.find(
        {"id": {"$in": ids}, "user_id": user["id"]},
        {"_id": 0, "establishment": 1},
    ).to_list(len(ids))
    establishments = {(t.get("establishment") or "").strip() for t in txs}
    establishments.discard("")
    now_iso = datetime.now(timezone.utc).isoformat()
    vendors_upserted = 0
    for est in establishments:
        normalized = est.lower()
        vendor_set = {
            "personal_category": category,
            "subcategory": subcategory or "General",
            "last_used": now_iso,
        }
        existing_vendor = await db.known_vendors.find_one({
            "user_id": user["id"],
            "establishment": {"$regex": f"^{re.escape(normalized)}$", "$options": "i"},
        })
        if existing_vendor:
            await db.known_vendors.update_one(
                {"id": existing_vendor["id"]},
                {"$set": vendor_set, "$inc": {"times_used": 1}},
            )
        else:
            await db.known_vendors.insert_one({
                "id": str(uuid.uuid4()), "user_id": user["id"], "establishment": est,
                **vendor_set, "times_used": 1, "created_at": now_iso,
            })
        vendors_upserted += 1

    return {
        "updated": result.modified_count,
        "matched": result.matched_count,
        "vendors_upserted": vendors_upserted,
    }


@router.get("/transactions/international")
async def get_international_transactions(user: dict = Depends(get_current_user)):
    transactions = await db.transactions.find({"user_id": user["id"], "is_international": True}, {"_id": 0}).sort("date", -1).to_list(1000)
    return {"transactions": transactions}


@router.get("/transactions/by-payment-source")
async def get_transactions_by_payment_source(payment_source: str = "internacional", user: dict = Depends(get_current_user)):
    transactions = await db.transactions.find({"user_id": user["id"], "payment_source": payment_source}, {"_id": 0}).sort("date", -1).to_list(1000)
    return {"transactions": transactions, "payment_source": payment_source}


@router.get("/transactions/grouped")
async def get_transactions_grouped(start_date: Optional[str] = None, end_date: Optional[str] = None, user: dict = Depends(get_current_user)):
    query = {"user_id": user["id"], "transaction_type": "expense"}
    if start_date:
        query["date"] = {"$gte": start_date}
    if end_date:
        query.setdefault("date", {})["$lte"] = end_date
    transactions = await db.transactions.find(query, {"_id": 0}).sort("date", -1).to_list(10000)

    groups = {}
    for t in transactions:
        establishment = t.get("establishment") or t.get("description", "Sin establecimiento")
        date = t.get("date", "")
        group_key = f"{establishment}|{date}"
        if group_key not in groups:
            groups[group_key] = {"establishment": establishment, "date": date, "total": 0, "items": [], "category": t.get("category"), "payment_method": t.get("payment_method"), "attachments": []}
        groups[group_key]["total"] += t.get("amount", 0)
        groups[group_key]["items"].append({"id": t.get("id"), "description": t.get("description"), "amount": t.get("amount"), "category": t.get("category"), "subcategory": t.get("subcategory")})
        if t.get("attachments"):
            groups[group_key]["attachments"].extend(t["attachments"])

    result = list(groups.values())
    result.sort(key=lambda x: x["date"], reverse=True)
    return result


@router.post("/transactions/split")
async def split_transaction(split_request: TransactionSplitRequest, user: dict = Depends(get_current_user)):
    original = await db.transactions.find_one({"id": split_request.transaction_id, "user_id": user["id"]}, {"_id": 0})
    if not original:
        raise HTTPException(status_code=404, detail="Transaccion no encontrada")

    total_split = sum(s.amount for s in split_request.splits)
    if abs(total_split - original["amount"]) > 0.01:
        raise HTTPException(status_code=400, detail=f"La suma de los splits (${total_split:.2f}) debe ser igual al monto original (${original['amount']:.2f})")

    created_splits = []
    for i, split in enumerate(split_request.splits):
        split_id = str(uuid.uuid4())
        split_doc = {
            **original,
            "id": split_id,
            "amount": split.amount,
            "category": split.category,
            "subcategory": split.subcategory,
            "description": split.description or f"{original['description']} (Split {i+1})",
            "is_split": True,
            "parent_transaction_id": split_request.transaction_id,
            "is_deductible": SRI_CATEGORIES.get(split.category, {}).get("deductible", False),
            "status": TransactionStatus.PENDING_REVIEW,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.transactions.insert_one(split_doc)
        created_splits.append({k: v for k, v in split_doc.items() if k != "_id"})

    await db.transactions.update_one(
        {"id": split_request.transaction_id},
        {"$set": {"status": TransactionStatus.REJECTED, "notes": f"Dividido en {len(split_request.splits)} transacciones"}}
    )
    return {"message": f"Transaccion dividida en {len(created_splits)} partes", "splits": created_splits}


@router.post("/transactions/auto-categorize")
async def auto_categorize_transaction(description: str, establishment: Optional[str] = None, user: dict = Depends(get_current_user)):
    custom_rules = await db.categorization_rules.find({"user_id": user["id"], "is_active": True}, {"_id": 0}).to_list(100)
    text = f"{description} {establishment or ''}".lower()
    for rule in custom_rules:
        for keyword in rule.get("keywords", []):
            if keyword.lower() in text:
                return {"category": rule["category"], "subcategory": rule["subcategory"], "auto_categorized": True, "matched_keyword": keyword, "rule_type": "custom"}
    result = apply_categorization_rules(description, establishment or "")
    if result["auto_categorized"]:
        result["rule_type"] = "default"
        return result
    return {"category": None, "subcategory": None, "auto_categorized": False, "message": "No se encontro regla de categorizacion"}


# ================= CATEGORIZATION RULES =================

@router.get("/categorization-rules")
async def get_categorization_rules(user: dict = Depends(get_current_user)):
    custom_rules = await db.categorization_rules.find({"user_id": user["id"]}, {"_id": 0}).to_list(100)
    return {"default_rules": DEFAULT_CATEGORIZATION_RULES, "custom_rules": custom_rules}


@router.post("/categorization-rules")
async def create_categorization_rule(rule: CategorizationRule, user: dict = Depends(get_current_user)):
    rule_id = str(uuid.uuid4())
    rule_doc = {"id": rule_id, "user_id": user["id"], **rule.model_dump(), "created_at": datetime.now(timezone.utc).isoformat()}
    await db.categorization_rules.insert_one(rule_doc)
    return {"message": "Regla creada", "rule": {k: v for k, v in rule_doc.items() if k != "_id"}}


@router.delete("/categorization-rules/{rule_id}")
async def delete_categorization_rule(rule_id: str, user: dict = Depends(get_current_user)):
    result = await db.categorization_rules.delete_one({"id": rule_id, "user_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Regla no encontrada")
    return {"message": "Regla eliminada"}
