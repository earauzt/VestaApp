from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from typing import List, Optional
import uuid
import re
import difflib

from database import db
from models import KnownVendorCreate, KnownVendorResponse, TransactionStatus
from utils import get_current_user, lookup_known_vendor

router = APIRouter()


@router.get("/known-vendors", response_model=List[KnownVendorResponse])
async def get_known_vendors(user: dict = Depends(get_current_user)):
    vendors = await db.known_vendors.find({"user_id": user["id"]}, {"_id": 0}).sort("times_used", -1).to_list(500)
    return [KnownVendorResponse(**v) for v in vendors]


@router.post("/known-vendors", response_model=KnownVendorResponse)
async def create_known_vendor(vendor: KnownVendorCreate, user: dict = Depends(get_current_user)):
    normalized_name = vendor.establishment.strip().lower()
    existing = await db.known_vendors.find_one({
        "user_id": user["id"],
        "establishment": {"$regex": f"^{re.escape(normalized_name)}$", "$options": "i"}
    })
    if existing:
        await db.known_vendors.update_one(
            {"id": existing["id"]},
            {"$set": {
                "personal_category": vendor.personal_category,
                "sri_category": vendor.sri_category,
                "subcategory": vendor.subcategory,
                "is_deductible": vendor.is_deductible,
                "last_used": datetime.now(timezone.utc).isoformat(),
                "$inc": {"times_used": 1}
            }}
        )
        updated = await db.known_vendors.find_one({"id": existing["id"]}, {"_id": 0})
        return KnownVendorResponse(**updated)

    vendor_data = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "establishment": vendor.establishment.strip(),
        "personal_category": vendor.personal_category,
        "sri_category": vendor.sri_category,
        "subcategory": vendor.subcategory,
        "is_deductible": vendor.is_deductible,
        "times_used": 1,
        "last_used": datetime.now(timezone.utc).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.known_vendors.insert_one(vendor_data)
    if "_id" in vendor_data:
        del vendor_data["_id"]
    return KnownVendorResponse(**vendor_data)


@router.get("/known-vendors/lookup")
async def lookup_vendor_endpoint(establishment: str, user: dict = Depends(get_current_user)):
    normalized = establishment.strip().lower()
    vendor = await db.known_vendors.find_one({
        "user_id": user["id"],
        "establishment": {"$regex": f"^{re.escape(normalized)}$", "$options": "i"}
    }, {"_id": 0})
    if vendor:
        await db.known_vendors.update_one({"id": vendor["id"]}, {"$set": {"last_used": datetime.now(timezone.utc).isoformat()}, "$inc": {"times_used": 1}})
        return {"found": True, "vendor": KnownVendorResponse(**vendor), "personal_category": vendor["personal_category"], "sri_category": vendor.get("sri_category"), "subcategory": vendor.get("subcategory"), "is_deductible": vendor.get("is_deductible", False)}

    vendor = await db.known_vendors.find_one({
        "user_id": user["id"],
        "aliases": {"$regex": f"^{re.escape(normalized)}$", "$options": "i"}
    }, {"_id": 0})
    if vendor:
        await db.known_vendors.update_one({"id": vendor["id"]}, {"$set": {"last_used": datetime.now(timezone.utc).isoformat()}, "$inc": {"times_used": 1}})
        return {"found": True, "alias_match": True, "vendor": KnownVendorResponse(**vendor), "personal_category": vendor["personal_category"], "sri_category": vendor.get("sri_category"), "subcategory": vendor.get("subcategory"), "is_deductible": vendor.get("is_deductible", False)}

    vendor = await db.known_vendors.find_one({
        "user_id": user["id"],
        "establishment": {"$regex": re.escape(normalized), "$options": "i"}
    }, {"_id": 0})
    if vendor:
        return {"found": True, "partial_match": True, "vendor": KnownVendorResponse(**vendor), "personal_category": vendor["personal_category"], "sri_category": vendor.get("sri_category"), "subcategory": vendor.get("subcategory"), "is_deductible": vendor.get("is_deductible", False)}

    return {"found": False}


@router.put("/known-vendors/{vendor_id}")
async def update_known_vendor(vendor_id: str, vendor: KnownVendorCreate, user: dict = Depends(get_current_user)):
    result = await db.known_vendors.update_one(
        {"id": vendor_id, "user_id": user["id"]},
        {"$set": {"establishment": vendor.establishment.strip(), "personal_category": vendor.personal_category, "sri_category": vendor.sri_category, "subcategory": vendor.subcategory, "is_deductible": vendor.is_deductible, "last_used": datetime.now(timezone.utc).isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Vendor no encontrado")
    updated = await db.known_vendors.find_one({"id": vendor_id}, {"_id": 0})
    return KnownVendorResponse(**updated)


@router.delete("/known-vendors/{vendor_id}")
async def delete_known_vendor(vendor_id: str, user: dict = Depends(get_current_user)):
    result = await db.known_vendors.delete_one({"id": vendor_id, "user_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Vendor no encontrado")
    return {"message": "Vendor eliminado"}


@router.post("/transactions/learn-vendors")
async def learn_vendors_from_history(user: dict = Depends(get_current_user)):
    FUZZY_THRESHOLD = 0.85

    def clean_vendor_name(raw: str) -> str:
        cleaned = re.sub(r'\b\d{2,4}[/-]\d{2}[/-]\d{2,4}\b', '', raw)
        cleaned = re.sub(r'\b[A-Z]{2,4}\d{6,}\b', '', cleaned)
        cleaned = re.sub(r'\b\d{6,}\b', '', cleaned)
        cleaned = re.sub(r'[*#]+\d+', '', cleaned)
        cleaned = re.sub(r'\s+', ' ', cleaned).strip()
        return cleaned[:40].strip()

    def fuzzy_best_match(name: str, existing_names: list) -> tuple:
        name_upper = name.upper().strip()
        best_ratio = 0.0
        best_name = None
        for existing in existing_names:
            existing_upper = existing.upper().strip()
            ratio = difflib.SequenceMatcher(None, name_upper, existing_upper).ratio()
            common_prefix_len = 0
            for c1, c2 in zip(name_upper, existing_upper):
                if c1 == c2:
                    common_prefix_len += 1
                else:
                    break
            shorter_len = min(len(name_upper), len(existing_upper))
            if shorter_len > 0 and common_prefix_len >= 8 and (common_prefix_len / shorter_len) >= 0.50:
                ratio = max(ratio, FUZZY_THRESHOLD)
            if ratio > best_ratio:
                best_ratio = ratio
                best_name = existing
        return best_name, best_ratio

    transactions = await db.transactions.find(
        {"user_id": user["id"], "status": {"$in": ["approved", "Approved", TransactionStatus.APPROVED]}},
        {"_id": 0}
    ).to_list(10000)

    vendor_groups = {}
    for tx in transactions:
        raw_name = (tx.get("vendor") or "").strip()
        if not raw_name:
            raw_name = (tx.get("establishment") or "").strip()
        if not raw_name:
            desc = (tx.get("description") or "").strip()
            if desc:
                raw_name = clean_vendor_name(desc)
        if not raw_name or len(raw_name) < 3:
            continue
        category = tx.get("personal_category") or tx.get("category", "otros")
        sri_category = tx.get("sri_category")
        subcategory = tx.get("subcategory")
        is_deductible = tx.get("is_deductible", False)

        matched_key = None
        if vendor_groups:
            best_name, best_ratio = fuzzy_best_match(raw_name, list(vendor_groups.keys()))
            if best_ratio >= FUZZY_THRESHOLD:
                matched_key = best_name

        if matched_key:
            group = vendor_groups[matched_key]
            group["all_names"].add(raw_name)
            if category:
                group["categories"][category] = group["categories"].get(category, 0) + 1
            if sri_category:
                group["sri_categories"][sri_category] = group["sri_categories"].get(sri_category, 0) + 1
            if subcategory:
                group["subcategories"][subcategory] = group["subcategories"].get(subcategory, 0) + 1
            group["is_deductible"] = group["is_deductible"] or is_deductible
            group["tx_count"] += 1
        else:
            vendor_groups[raw_name] = {
                "all_names": {raw_name},
                "categories": {category: 1} if category else {},
                "sri_categories": {sri_category: 1} if sri_category else {},
                "subcategories": {subcategory: 1} if subcategory else {},
                "is_deductible": is_deductible,
                "tx_count": 1
            }

    existing_vendors = await db.known_vendors.find({"user_id": user["id"]}, {"_id": 0}).to_list(5000)
    existing_by_id = {v["id"]: v for v in existing_vendors}
    existing_names_map = {}
    for v in existing_vendors:
        existing_names_map[v["establishment"].upper()] = v["id"]
        for alias in v.get("aliases", []):
            existing_names_map[alias.upper()] = v["id"]

    vendors_nuevos = 0
    vendors_actualizados = 0

    for canonical_name, data in vendor_groups.items():
        if not data["categories"]:
            continue
        best_category = max(data["categories"].keys(), key=lambda k: data["categories"][k])
        best_sri = max(data["sri_categories"].keys(), key=lambda k: data["sri_categories"][k]) if data["sri_categories"] else None
        best_sub = max(data["subcategories"].keys(), key=lambda k: data["subcategories"][k]) if data["subcategories"] else None
        all_name_variants = list(data["all_names"])

        matched_vendor_id = None
        for name_variant in all_name_variants:
            if name_variant.upper() in existing_names_map:
                matched_vendor_id = existing_names_map[name_variant.upper()]
                break

        if not matched_vendor_id and existing_names_map:
            best_existing, best_ratio = fuzzy_best_match(canonical_name, list(existing_names_map.keys()))
            if best_ratio >= FUZZY_THRESHOLD and best_existing:
                matched_vendor_id = existing_names_map[best_existing]

        if matched_vendor_id:
            existing_v = existing_by_id.get(matched_vendor_id, {})
            current_aliases = set(existing_v.get("aliases", []))
            for variant in all_name_variants:
                if variant.upper() != existing_v.get("establishment", "").upper():
                    current_aliases.add(variant)
            await db.known_vendors.update_one(
                {"id": matched_vendor_id},
                {"$set": {"personal_category": best_category, "sri_category": best_sri, "subcategory": best_sub, "is_deductible": data["is_deductible"], "aliases": list(current_aliases), "last_used": datetime.now(timezone.utc).isoformat()}, "$inc": {"match_count": data["tx_count"], "times_used": data["tx_count"]}}
            )
            vendors_actualizados += 1
            for variant in all_name_variants:
                existing_names_map[variant.upper()] = matched_vendor_id
        else:
            new_id = str(uuid.uuid4())
            primary_name = canonical_name
            aliases = [n for n in all_name_variants if n != primary_name]
            vendor_doc = {
                "id": new_id, "user_id": user["id"], "establishment": primary_name,
                "personal_category": best_category, "sri_category": best_sri, "subcategory": best_sub,
                "is_deductible": data["is_deductible"], "match_count": data["tx_count"], "times_used": data["tx_count"],
                "aliases": aliases, "source": "historical_import",
                "last_used": datetime.now(timezone.utc).isoformat(), "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.known_vendors.insert_one(vendor_doc)
            vendors_nuevos += 1
            existing_names_map[primary_name.upper()] = new_id
            for a in aliases:
                existing_names_map[a.upper()] = new_id
            existing_by_id[new_id] = vendor_doc

    total_en_db = await db.known_vendors.count_documents({"user_id": user["id"]})
    return {"status": "success", "vendors_nuevos": vendors_nuevos, "vendors_actualizados": vendors_actualizados, "total_en_db": total_en_db}
