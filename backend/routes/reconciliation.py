from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
import uuid
import re
import logging
import tempfile
import os
import aiofiles

from database import db
from models import (
    TransactionStatus, SourceType, SRI_CATEGORIES, SUBSCRIPTION_SERVICES,
    UserRole, INTERNATIONAL_COUNTRIES
)
from utils import (
    get_current_user, check_role, lookup_known_vendor, find_potential_duplicates,
    process_image_with_ai, dedup_or_merge
)

logger = logging.getLogger(__name__)
router = APIRouter()


# ================= RECONCILIATION HELPER FUNCTIONS =================

async def find_matching_transaction(user_id: str, amount: float, date: str, establishment: str, description: str) -> dict:
    try:
        tx_date = datetime.fromisoformat(date.replace("Z", "+00:00"))
    except Exception:
        tx_date = datetime.now(timezone.utc)
    date_start = (tx_date - timedelta(days=3)).strftime("%Y-%m-%d")
    date_end = (tx_date + timedelta(days=3)).strftime("%Y-%m-%d")
    amount_low = amount * 0.99
    amount_high = amount * 1.01

    query = {"user_id": user_id, "date": {"$gte": date_start, "$lte": date_end}, "amount": {"$gte": amount_low, "$lte": amount_high}, "transaction_type": "expense"}
    potential_matches = await db.transactions.find(query, {"_id": 0}).to_list(10)

    if not potential_matches:
        return {"status": "new", "confidence": 0}

    best_match = None
    best_score = 0
    for match in potential_matches:
        score = 0
        if abs(match["amount"] - amount) < 0.01:
            score += 40
        else:
            score += 30
        if match["date"] == date:
            score += 30
        elif abs((datetime.fromisoformat(match["date"]) - tx_date).days) <= 1:
            score += 20
        else:
            score += 10

        match_estab = (match.get("establishment") or match.get("description", "")).lower()
        search_estab = (establishment or description).lower()
        if match_estab and search_estab:
            if match_estab == search_estab:
                score += 30
            elif search_estab in match_estab or match_estab in search_estab:
                score += 20
            match_words = set(match_estab.split())
            search_words = set(search_estab.split())
            common_words = match_words & search_words
            if len(common_words) > 0:
                score += min(len(common_words) * 5, 15)
        if score > best_score:
            best_score = score
            best_match = match

    if best_score >= 70:
        return {"status": "matched", "confidence": best_score / 100, "matched_id": best_match["id"], "matched_transaction": best_match}
    elif best_score >= 50:
        return {"status": "no_match", "confidence": best_score / 100, "matched_id": best_match["id"], "matched_transaction": best_match}
    return {"status": "new", "confidence": 0}


async def update_card_from_statement(user_id: str, bank_name: str, card_info: dict):
    bank_patterns = {"diners": ["diners"], "pichincha": ["pichincha"], "pacificard": ["pacificard", "pacifico"], "banco_pacifico": ["pacifico", "banco pacifico"], "bolivariano": ["bolivariano"]}
    patterns = bank_patterns.get(bank_name, [bank_name])
    existing_card = await db.credit_cards.find_one({"user_id": user_id, "$or": [{"name": {"$regex": p, "$options": "i"}} for p in patterns]})
    if existing_card:
        update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
        if card_info.get("current_balance"):
            update_data["current_balance"] = card_info["current_balance"]
        if card_info.get("minimum_payment"):
            update_data["minimum_payment"] = card_info["minimum_payment"]
        if card_info.get("credit_limit"):
            update_data["credit_limit"] = card_info["credit_limit"]
        if card_info.get("due_date"):
            update_data["due_date"] = card_info["due_date"]
        if card_info.get("statement_date"):
            update_data["statement_date"] = card_info["statement_date"]
        await db.credit_cards.update_one({"id": existing_card["id"]}, {"$set": update_data})
        return existing_card["id"]
    return None


async def find_matching_deferred(user_id: str, card_name: str, amount: float, description: str) -> dict:
    AMOUNT_TOLERANCE = 0.05
    deferred_payments = await db.deferred_payments.find(
        {"user_id": user_id, "$or": [{"remaining_installments": {"$gt": 0}}, {"is_active": True}]}, {"_id": 0}
    ).to_list(200)
    if not deferred_payments:
        return None

    desc_lower = (description or "").lower()
    card_lower = (card_name or "").lower()

    card_matches = []
    for dp in deferred_payments:
        dp_card = (dp.get("card_name") or "").lower()
        if not dp_card or not card_lower:
            card_matches.append(dp)
            continue
        if dp_card in card_lower or card_lower in dp_card or any(w in dp_card for w in card_lower.split() if len(w) > 3):
            card_matches.append(dp)
    if not card_matches:
        card_matches = deferred_payments

    amount_matches = []
    for dp in card_matches:
        monthly = dp.get("monthly_payment", 0)
        if monthly > 0 and abs(amount - monthly) / monthly < AMOUNT_TOLERANCE:
            remaining_bal = dp.get("remaining_amount") or (monthly * dp.get("remaining_installments", 0))
            amount_matches.append((dp, remaining_bal))
    if amount_matches:
        amount_matches.sort(key=lambda x: x[1], reverse=True)
        best = amount_matches[0][0]
        return _format_deferred_match(best, "amount_match")

    desc_words = set(desc_lower.split())
    keyword_matches = []
    for dp in card_matches:
        dp_desc = (dp.get("description") or "").lower()
        dp_words = set(dp_desc.split())
        significant_overlap = sum(1 for w in desc_words if len(w) > 3 and w not in {"cuota", "diferido", "pago"} and w in dp_desc)
        reverse_overlap = sum(1 for w in dp_words if len(w) > 3 and w not in {"cuota", "diferido", "pago"} and w in desc_lower)
        score = significant_overlap + reverse_overlap
        if score > 0:
            remaining_bal = dp.get("remaining_amount") or (dp.get("monthly_payment", 0) * dp.get("remaining_installments", 0))
            keyword_matches.append((dp, score, remaining_bal))
    if keyword_matches:
        keyword_matches.sort(key=lambda x: (x[1], x[2]), reverse=True)
        best = keyword_matches[0][0]
        return _format_deferred_match(best, "keyword_match")
    return None


def _format_deferred_match(dp: dict, match_type: str) -> dict:
    monthly = dp.get("monthly_payment", 0)
    remaining = dp.get("remaining_installments", 0)
    return {"found": True, "deferred_id": dp.get("id"), "description": dp.get("description"), "original_amount": dp.get("original_amount") or dp.get("total_amount"), "monthly_payment": monthly, "remaining_installments": remaining, "remaining_amount": dp.get("remaining_amount") or (monthly * remaining), "total_installments": dp.get("total_installments"), "match_type": match_type, "confidence": 0.95 if match_type == "amount_match" else 0.70}


async def apply_deferred_deduction(deferred_id: str, amount: float, statement_id: str) -> dict:
    dp = await db.deferred_payments.find_one({"id": deferred_id}, {"_id": 0})
    if not dp:
        return {"success": False, "reason": "Diferido no encontrado"}
    monthly = dp.get("monthly_payment", 0)
    remaining_inst = dp.get("remaining_installments", 0)
    current_remaining = dp.get("remaining_amount") or (monthly * remaining_inst)
    new_remaining_amount = max(0, current_remaining - amount)
    new_remaining_inst = max(0, remaining_inst - 1)
    payment_entry = {"date": datetime.now(timezone.utc).isoformat(), "amount": amount, "statement_id": statement_id, "detected_from": "auto"}
    update_fields = {"remaining_installments": new_remaining_inst, "remaining_amount": new_remaining_amount, "last_payment_date": datetime.now(timezone.utc).isoformat(), "paid_installments": dp.get("paid_installments", 0) + 1}
    if new_remaining_amount <= 0 or new_remaining_inst <= 0:
        update_fields["is_active"] = False
        update_fields["completed_at"] = datetime.now(timezone.utc).isoformat()
    await db.deferred_payments.update_one({"id": deferred_id}, {"$set": update_fields, "$push": {"payment_history": payment_entry}})
    return {"success": True, "deferred_id": deferred_id, "amount_deducted": amount, "new_remaining_amount": new_remaining_amount, "new_remaining_installments": new_remaining_inst, "completed": new_remaining_amount <= 0 or new_remaining_inst <= 0}


# ================= RECONCILIATION ENDPOINTS =================

@router.post("/reconciliation/upload-statement")
async def upload_statement_for_reconciliation(file: UploadFile = File(...), bank_name: str = "auto", statement_type: str = "auto", user: dict = Depends(get_current_user)):
    temp_dir = tempfile.mkdtemp()
    file_path = os.path.join(temp_dir, file.filename)
    try:
        async with aiofiles.open(file_path, 'wb') as f:
            content = await file.read()
            await f.write(content)
        result = await process_image_with_ai(file_path, document_type="bank_statement")
        if result is None:
            raise HTTPException(status_code=500, detail="No se pudo procesar el archivo. El servicio de OCR no respondio. Por favor intenta de nuevo.")

        detected_bank = bank_name if bank_name != "auto" else None
        card_info = result.get("card_info", {}) or {}
        if not detected_bank:
            bank_keywords = {"diners": "diners", "pichincha": "pichincha", "pacificard": "pacificard", "pacifico": "banco_pacifico", "bolivariano": "bolivariano"}
            text_to_check = f"{card_info.get('bank_name', '')} {card_info.get('card_name', '')} {file.filename}".lower()
            for keyword, bank_value in bank_keywords.items():
                if keyword in text_to_check:
                    detected_bank = bank_value
                    break
            if not detected_bank:
                detected_bank = "unknown"

        detected_type = statement_type if statement_type != "auto" else None
        if not detected_type:
            if card_info.get("credit_limit") or card_info.get("minimum_payment") or "tarjeta" in file.filename.lower():
                detected_type = "credit_card"
            else:
                detected_type = "bank_account"

        period_start = card_info.get("period_start") or card_info.get("statement_date") or datetime.now().strftime("%Y-%m")
        period = f"{period_start[:7]}" if period_start else datetime.now().strftime("%Y-%m")

        statement_id = str(uuid.uuid4())
        statement_doc = {"id": statement_id, "user_id": user["id"], "bank_name": detected_bank, "statement_type": detected_type, "period": period, "file_name": file.filename, "card_info": card_info, "total_transactions": 0, "matched": 0, "new": 0, "no_match": 0, "status": "processing", "created_at": datetime.now(timezone.utc).isoformat()}

        transactions = result.get("transactions", [])
        logger.info(f"Reconciliation: Processing {len(transactions)} transactions from AI result")
        reconciled_transactions = []
        matched_count = 0
        new_count = 0
        no_match_count = 0

        for t in transactions:
            amount = abs(t.get("amount", 0))
            if amount == 0:
                continue
            description_lower = t.get("description", "").lower()
            is_payment = t.get("amount", 0) < 0 or "pago" in description_lower or "abono" in description_lower
            if is_payment and detected_type == "credit_card":
                continue
            is_fee = t.get("is_fee", False) or any(fee in description_lower for fee in ["interes", "comision", "solca", "contrib"])
            if is_fee:
                continue

            date = t.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d"))
            establishment = t.get("establishment", t.get("description", "")[:50])
            description = t.get("description", "")

            match_result = await find_matching_transaction(user["id"], amount, date, establishment, description)
            vendor_lookup = await lookup_known_vendor(user["id"], establishment, description)

            is_deferred = t.get("is_deferred", False) or "dif" in description.lower() or "cuota" in description.lower() or "diferido" in description.lower()
            deferred_info = None
            deferred_deduction = None
            if is_deferred:
                stmt_card_name = (card_info.get("card_name") or card_info.get("bank_name") or detected_bank or "") if card_info else ""
                deferred_info = await find_matching_deferred(user["id"], stmt_card_name, amount, description)
                if deferred_info and deferred_info.get("found"):
                    deferred_deduction = await apply_deferred_deduction(deferred_info["deferred_id"], amount, statement_id)

            item_status = match_result["status"]
            if is_deferred and not deferred_info:
                item_status = "pending_deferred_match"

            recon_item = {
                "temp_id": str(uuid.uuid4()), "amount": amount, "date": date, "description": description, "establishment": establishment, "original_data": t,
                "status": item_status, "confidence": match_result.get("confidence", 0), "matched_transaction_id": match_result.get("matched_id"), "matched_transaction": match_result.get("matched_transaction"),
                "suggested_category": vendor_lookup.get("personal_category") if vendor_lookup["found"] else (t.get("category") or ("diferido" if is_deferred else "otros")),
                "suggested_sri_category": vendor_lookup.get("sri_category") if vendor_lookup["found"] else t.get("sri_category"),
                "suggested_subcategory": vendor_lookup.get("subcategory") if vendor_lookup["found"] else t.get("subcategory"),
                "is_deductible": vendor_lookup.get("is_deductible", False) if vendor_lookup["found"] else False,
                "auto_categorized": vendor_lookup["found"], "vendor_known": vendor_lookup["found"],
                "vendor_match_type": vendor_lookup.get("match_type") if vendor_lookup["found"] else None,
                "is_deferred": is_deferred, "deferred_info": deferred_info, "deferred_deduction": deferred_deduction
            }

            if match_result["status"] == "matched":
                matched_count += 1
            elif match_result["status"] == "new":
                new_count += 1
            else:
                no_match_count += 1
            reconciled_transactions.append(recon_item)

        statement_doc["total_transactions"] = len(reconciled_transactions)
        statement_doc["matched"] = matched_count
        statement_doc["new"] = new_count
        statement_doc["no_match"] = no_match_count
        statement_doc["status"] = "ready"
        await db.statement_uploads.insert_one(statement_doc)

        if detected_type == "credit_card" and card_info.get("current_balance"):
            await update_card_from_statement(user["id"], detected_bank, card_info)

        return {"statement_id": statement_id, "statement_type": detected_type, "bank_name": detected_bank, "period": period, "card_info": card_info, "summary": {"total": len(reconciled_transactions), "matched": matched_count, "new": new_count, "no_match": no_match_count}, "transactions": reconciled_transactions}
    except Exception as e:
        logger.error(f"Statement reconciliation error: {e}")
        raise HTTPException(status_code=500, detail=f"Error procesando estado de cuenta: {str(e)}")
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)
        if os.path.exists(temp_dir):
            os.rmdir(temp_dir)


@router.post("/reconciliation/confirm-matches")
async def confirm_reconciliation_matches(statement_id: str, confirmed_matches: List[Dict], user: dict = Depends(get_current_user)):
    created = 0
    matched = 0
    skipped = 0
    failed = 0
    errors = []
    for item in confirmed_matches:
        try:
            action = item.get("action", "skip")
            if action == "skip":
                skipped += 1
                continue
            if action == "match":
                matched_id = item.get("matched_id")
                if matched_id:
                    await db.transactions.update_one({"id": matched_id, "user_id": user["id"]}, {"$set": {"reconciled": True, "reconciled_at": datetime.now(timezone.utc).isoformat(), "statement_id": statement_id}})
                    matched += 1
            elif action == "create":
                tx_data = item.get("transaction_data", {})
                vendor_lookup = await lookup_known_vendor(user["id"], tx_data.get("establishment", ""), tx_data.get("description", ""))
                category = item.get("category") or (vendor_lookup.get("personal_category") if vendor_lookup["found"] else tx_data.get("category", "otros"))
                sri_category = item.get("sri_category") or (vendor_lookup.get("sri_category") if vendor_lookup["found"] else None)
                subcategory = item.get("subcategory") or (vendor_lookup.get("subcategory") if vendor_lookup["found"] else tx_data.get("subcategory", "Varios"))
                transaction_doc = {
                    "id": str(uuid.uuid4()), "user_id": user["id"], "amount": tx_data.get("amount", 0), "description": tx_data.get("description", ""), "establishment": tx_data.get("establishment", ""),
                    "date": tx_data.get("date", datetime.now().strftime("%Y-%m-%d")), "category": category, "personal_category": category, "sri_category": sri_category, "subcategory": subcategory,
                    "transaction_type": "expense", "is_deductible": vendor_lookup.get("is_deductible", False) if vendor_lookup["found"] else SRI_CATEGORIES.get(category, {}).get("deductible", False),
                    "status": TransactionStatus.APPROVED, "source_type": SourceType.BANK_STATEMENT, "reconciled": True, "reconciled_at": datetime.now(timezone.utc).isoformat(),
                    "statement_id": statement_id, "auto_categorized_by": "known_vendor" if vendor_lookup["found"] else "user", "created_at": datetime.now(timezone.utc).isoformat()
                }
                result = await dedup_or_merge(user["id"], transaction_doc, "estado_cuenta")
                if not vendor_lookup["found"] and tx_data.get("establishment") and result["action"] == "inserted":
                    vendor_doc = {"id": str(uuid.uuid4()), "user_id": user["id"], "establishment": tx_data["establishment"].strip(), "personal_category": category, "sri_category": sri_category, "subcategory": subcategory, "is_deductible": transaction_doc["is_deductible"], "times_used": 1, "last_used": datetime.now(timezone.utc).isoformat(), "created_at": datetime.now(timezone.utc).isoformat()}
                    await db.known_vendors.insert_one(vendor_doc)
                created += 1
        except Exception as e:
            logger.error(f"confirm-matches: item fallido ({item.get('action')}): {e}")
            failed += 1
            errors.append(str(e))

    await db.statement_uploads.update_one({"id": statement_id, "user_id": user["id"]}, {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc).isoformat(), "final_stats": {"created": created, "matched": matched, "skipped": skipped, "failed": failed}}})
    return {"message": "Reconciliacion completada", "created": created, "matched": matched, "skipped": skipped, "failed": failed, "errors": errors}


@router.get("/reconciliation/history")
async def get_reconciliation_history(user: dict = Depends(get_current_user)):
    statements = await db.statement_uploads.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"statements": statements}


@router.get("/bank-accounts")
async def get_bank_accounts(user: dict = Depends(get_current_user)):
    accounts = await db.bank_accounts.find({"user_id": user["id"]}, {"_id": 0}).to_list(20)
    if not accounts:
        default_accounts = [
            {"id": "default-pacifico", "name": "Banco Pacifico", "bank": "banco_pacifico", "type": "checking", "balance": 0},
            {"id": "default-bolivariano", "name": "Banco Bolivariano", "bank": "bolivariano", "type": "savings", "balance": 0}
        ]
        return {"accounts": default_accounts}
    return {"accounts": accounts}


# ================= RECONCILIATION CONTADORA =================

@router.get("/reconciliation/pending")
async def get_pending_reconciliation(user: dict = Depends(check_role([UserRole.ADMIN, UserRole.ACCOUNTANT]))):
    transactions = await db.transactions.find({"status": {"$in": [TransactionStatus.PENDING_REVIEW, TransactionStatus.DUPLICATE_SUSPECT]}}, {"_id": 0}).sort("created_at", -1).to_list(500)
    pending_review = [t for t in transactions if t.get("status") == TransactionStatus.PENDING_REVIEW]
    duplicate_suspects = [t for t in transactions if t.get("status") == TransactionStatus.DUPLICATE_SUSPECT]
    return {"pending_review": pending_review, "duplicate_suspects": duplicate_suspects, "stats": {"total_pending": len(pending_review), "total_duplicates": len(duplicate_suspects), "pending_amount": sum(t.get("amount", 0) for t in pending_review), "duplicate_amount": sum(t.get("amount", 0) for t in duplicate_suspects)}}


@router.get("/reconciliation/duplicates")
async def get_duplicate_pairs(user: dict = Depends(check_role([UserRole.ADMIN, UserRole.ACCOUNTANT]))):
    duplicates = await db.transactions.find({"status": TransactionStatus.DUPLICATE_SUSPECT, "duplicate_of": {"$ne": None}}, {"_id": 0}).to_list(100)
    pairs = []
    for dup in duplicates:
        original = await db.transactions.find_one({"id": dup.get("duplicate_of")}, {"_id": 0})
        if original:
            pairs.append({"duplicate": dup, "original": original, "confidence": dup.get("match_confidence", 0), "amount_match": dup.get("amount") == original.get("amount"), "date_diff_days": abs((datetime.strptime(dup.get("date", "2000-01-01"), "%Y-%m-%d") - datetime.strptime(original.get("date", "2000-01-01"), "%Y-%m-%d")).days)})
    return {"pairs": pairs}


@router.put("/reconciliation/approve/{transaction_id}")
async def approve_transaction(transaction_id: str, category: Optional[str] = None, subcategory: Optional[str] = None, sri_category: Optional[str] = None, learn_vendor: bool = True, user: dict = Depends(check_role([UserRole.ADMIN, UserRole.ACCOUNTANT]))):
    tx = await db.transactions.find_one({"id": transaction_id}, {"_id": 0})
    if not tx:
        raise HTTPException(status_code=404, detail="Transaccion no encontrada")
    update_data = {"status": TransactionStatus.APPROVED, "reviewed_by": user["id"], "reviewed_at": datetime.now(timezone.utc).isoformat()}
    final_category = category or tx.get("category", "otros")
    final_subcategory = subcategory or tx.get("subcategory")
    final_sri_category = sri_category or tx.get("sri_category")
    if category:
        update_data["category"] = category
        update_data["personal_category"] = category
        update_data["is_deductible"] = SRI_CATEGORIES.get(category, {}).get("deductible", False)
    if subcategory:
        update_data["subcategory"] = subcategory
    if sri_category:
        update_data["sri_category"] = sri_category
    result = await db.transactions.update_one({"id": transaction_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Transaccion no encontrada")

    vendor_learned = False
    establishment = tx.get("establishment") or tx.get("description", "")
    if learn_vendor and establishment and final_category:
        normalized_name = establishment.strip().lower()
        existing_vendor = await db.known_vendors.find_one({"user_id": user["id"], "establishment": {"$regex": f"^{re.escape(normalized_name)}$", "$options": "i"}})
        if existing_vendor:
            await db.known_vendors.update_one({"id": existing_vendor["id"]}, {"$set": {"personal_category": final_category, "sri_category": final_sri_category, "subcategory": final_subcategory, "is_deductible": update_data.get("is_deductible", existing_vendor.get("is_deductible", False)), "last_used": datetime.now(timezone.utc).isoformat()}, "$inc": {"times_used": 1}})
            vendor_learned = True
        else:
            vendor_data = {"id": str(uuid.uuid4()), "user_id": user["id"], "establishment": establishment.strip(), "personal_category": final_category, "sri_category": final_sri_category, "subcategory": final_subcategory, "is_deductible": update_data.get("is_deductible", False), "times_used": 1, "last_used": datetime.now(timezone.utc).isoformat(), "created_at": datetime.now(timezone.utc).isoformat()}
            await db.known_vendors.insert_one(vendor_data)
            vendor_learned = True
    return {"message": "Transaccion aprobada", "status": TransactionStatus.APPROVED, "vendor_learned": vendor_learned}


@router.put("/reconciliation/reject/{transaction_id}")
async def reject_transaction(transaction_id: str, reason: Optional[str] = None, user: dict = Depends(check_role([UserRole.ADMIN, UserRole.ACCOUNTANT]))):
    result = await db.transactions.update_one({"id": transaction_id}, {"$set": {"status": TransactionStatus.REJECTED, "reviewed_by": user["id"], "reviewed_at": datetime.now(timezone.utc).isoformat(), "notes": reason or "Rechazado por contadora"}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Transaccion no encontrada")
    return {"message": "Transaccion rechazada", "status": TransactionStatus.REJECTED}


@router.put("/reconciliation/confirm-duplicate/{transaction_id}")
async def confirm_duplicate(transaction_id: str, keep_original: bool = True, user: dict = Depends(check_role([UserRole.ADMIN, UserRole.ACCOUNTANT]))):
    dup_tx = await db.transactions.find_one({"id": transaction_id}, {"_id": 0})
    if not dup_tx:
        raise HTTPException(status_code=404, detail="Transaccion no encontrada")
    if keep_original:
        await db.transactions.update_one({"id": transaction_id}, {"$set": {"status": TransactionStatus.DUPLICATE_CONFIRMED, "reviewed_by": user["id"], "reviewed_at": datetime.now(timezone.utc).isoformat(), "notes": "Confirmado como duplicado - no se cuenta en totales"}})
        if dup_tx.get("duplicate_of"):
            await db.transactions.update_one({"id": dup_tx["duplicate_of"]}, {"$set": {"has_receipt": dup_tx.get("has_receipt", False) or True, "has_invoice": dup_tx.get("has_invoice", False) or True}})
    else:
        if dup_tx.get("duplicate_of"):
            await db.transactions.update_one({"id": dup_tx["duplicate_of"]}, {"$set": {"status": TransactionStatus.DUPLICATE_CONFIRMED, "reviewed_by": user["id"], "reviewed_at": datetime.now(timezone.utc).isoformat()}})
        await db.transactions.update_one({"id": transaction_id}, {"$set": {"status": TransactionStatus.APPROVED, "duplicate_of": None, "reviewed_by": user["id"], "reviewed_at": datetime.now(timezone.utc).isoformat()}})
    return {"message": "Duplicado procesado", "kept_original": keep_original}


@router.put("/reconciliation/not-duplicate/{transaction_id}")
async def mark_not_duplicate(transaction_id: str, user: dict = Depends(check_role([UserRole.ADMIN, UserRole.ACCOUNTANT]))):
    result = await db.transactions.update_one({"id": transaction_id}, {"$set": {"status": TransactionStatus.APPROVED, "duplicate_of": None, "match_confidence": None, "reviewed_by": user["id"], "reviewed_at": datetime.now(timezone.utc).isoformat(), "notes": "Revisado - no es duplicado"}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Transaccion no encontrada")
    return {"message": "Marcado como no duplicado", "status": TransactionStatus.APPROVED}


@router.put("/reconciliation/bulk-approve")
async def bulk_approve_transactions(body: Dict[str, Any], user: dict = Depends(get_current_user)):
    transaction_ids = body.get("transaction_ids", [])
    if not transaction_ids:
        raise HTTPException(status_code=400, detail="No se proporcionaron IDs de transacciones")
    approved = 0
    failed = 0
    for id_str in transaction_ids:
        try:
            filter_query = {"id": id_str}
            if user["role"] not in ["admin", "accountant"]:
                filter_query["user_id"] = user["id"]
            result = await db.transactions.update_one(filter_query, {"$set": {"status": TransactionStatus.APPROVED, "reviewed_by": user["id"], "reviewed_at": datetime.now(timezone.utc).isoformat()}})
            if result.modified_count > 0:
                approved += 1
                continue
            from bson import ObjectId
            try:
                oid = ObjectId(id_str)
                filter_query_oid = {"_id": oid}
                if user["role"] not in ["admin", "accountant"]:
                    filter_query_oid["user_id"] = user["id"]
                result_oid = await db.transactions.update_one(filter_query_oid, {"$set": {"status": TransactionStatus.APPROVED, "reviewed_by": user["id"], "reviewed_at": datetime.now(timezone.utc).isoformat()}})
                if result_oid.modified_count > 0:
                    approved += 1
                else:
                    failed += 1
            except Exception:
                failed += 1
        except Exception as e:
            logger.warning(f"Bulk approve failed for {id_str}: {e}")
            failed += 1
    return {"approved": approved, "failed": failed, "total": len(transaction_ids)}


@router.get("/reconciliation/stats")
async def get_reconciliation_stats(user: dict = Depends(check_role([UserRole.ADMIN, UserRole.ACCOUNTANT]))):
    # Sin $match a proposito: admin/accountant ven las stats de todas las
    # transacciones de la familia, no solo las propias (mismo alcance que el
    # resto de vistas de contadora).
    pipeline = [{"$group": {"_id": "$status", "count": {"$sum": 1}, "total_amount": {"$sum": "$amount"}}}]
    results = await db.transactions.aggregate(pipeline).to_list(10)
    stats = {"pending_review": 0, "approved": 0, "rejected": 0, "duplicate_suspect": 0, "duplicate_confirmed": 0, "total_pending_amount": 0, "total_approved_amount": 0}
    for r in results:
        status = r["_id"] or "pending_review"
        if status == TransactionStatus.PENDING_REVIEW:
            stats["pending_review"] = r["count"]
            stats["total_pending_amount"] = r["total_amount"]
        elif status == TransactionStatus.APPROVED:
            stats["approved"] = r["count"]
            stats["total_approved_amount"] = r["total_amount"]
        elif status == TransactionStatus.REJECTED:
            stats["rejected"] = r["count"]
        elif status == TransactionStatus.DUPLICATE_SUSPECT:
            stats["duplicate_suspect"] = r["count"]
        elif status == TransactionStatus.DUPLICATE_CONFIRMED:
            stats["duplicate_confirmed"] = r["count"]
    return stats


@router.get("/reconciliation/cross-canal-stats")
async def get_cross_canal_stats(user: dict = Depends(get_current_user)):
    cross_canal = await db.transactions.count_documents({"user_id": user["id"], "is_cross_canal_dup": True})
    multi_source = await db.transactions.find({"user_id": user["id"], "fuentes.1": {"$exists": True}}, {"_id": 0, "id": 1, "establishment": 1, "amount": 1, "date": 1, "fuentes": 1}).to_list(100)
    return {"cross_canal_count": cross_canal, "multi_source_transactions": multi_source}
