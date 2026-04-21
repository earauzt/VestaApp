"""SRI Match: vinculación automática entre facturas SRI y consumos de tarjeta/débito.

Estados (transaction.estado_sri):
  - con_respaldo: consumo ↔ factura vinculados (match exacto ≤2%)
  - match_aproximado: candidato ≤10%, requiere confirmación del usuario
  - pendiente_match: sin match, reintenta durante 72h
  - sin_respaldo: descartado por usuario o sin match tras 72h
"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from typing import Optional
import uuid

from database import db
from models import SourceType, TransactionStatus
from utils import get_current_user

router = APIRouter()

# Tolerances
EXACT_AMOUNT_TOL = 0.02   # ±2%
APPROX_AMOUNT_TOL = 0.10  # ±10%
DATE_WINDOW_DAYS = 7
PENDING_WINDOW_HOURS = 72


def _is_invoice(tx: dict) -> bool:
    """True si la transacción representa una factura SRI."""
    return (
        tx.get("source_type") == SourceType.INVOICE
        or tx.get("has_invoice") is True
        or bool(tx.get("numero_factura"))
    )


def _date_range(date_str: str, days: int = DATE_WINDOW_DAYS):
    try:
        d = datetime.strptime(date_str[:10], "%Y-%m-%d")
    except Exception:
        return None, None
    return (d - timedelta(days=days)).strftime("%Y-%m-%d"), (d + timedelta(days=days)).strftime("%Y-%m-%d")


async def _find_candidate(user_id: str, tx: dict):
    """Busca el mejor candidato del tipo opuesto (factura↔consumo).
    Retorna (candidate, diff_pct) o (None, None).
    """
    amount = tx.get("amount", 0) or 0
    date = tx.get("date", "")
    if amount <= 0 or not date:
        return None, None
    start, end = _date_range(date)
    if not start:
        return None, None

    looking_for_invoice = not _is_invoice(tx)  # si soy consumo busco factura
    amt_lo = amount * (1 - APPROX_AMOUNT_TOL)
    amt_hi = amount * (1 + APPROX_AMOUNT_TOL)

    query = {
        "user_id": user_id,
        "transaction_type": "expense",
        "date": {"$gte": start, "$lte": end},
        "amount": {"$gte": amt_lo, "$lte": amt_hi},
        "id": {"$ne": tx.get("id")},
        "estado_sri": {"$nin": ["con_respaldo"]},
    }
    cursor = db.transactions.find(query, {"_id": 0}).limit(20)
    best = None
    best_diff = 999.0
    async for cand in cursor:
        if _is_invoice(cand) != looking_for_invoice:
            continue
        # evitar emparejar algo ya vinculado a otro
        if cand.get("factura_vinculada_id") or cand.get("consumo_vinculado_id"):
            continue
        diff_pct = abs(cand.get("amount", 0) - amount) / amount if amount else 1
        if diff_pct < best_diff:
            best = cand
            best_diff = diff_pct
    if best is None:
        return None, None
    return best, best_diff


async def _link_pair(factura: dict, consumo: dict, estado: str, confidence: Optional[float] = None):
    """Actualiza ambas transacciones con el vínculo mutuo."""
    inv_update = {"estado_sri": estado, "consumo_vinculado_id": consumo["id"]}
    con_update = {"estado_sri": estado, "factura_vinculada_id": factura["id"]}
    if estado == "match_aproximado":
        inv_update["match_aproximado_candidato_id"] = consumo["id"]
        con_update["match_aproximado_candidato_id"] = factura["id"]
        if confidence is not None:
            inv_update["match_aproximado_confianza"] = confidence
            con_update["match_aproximado_confianza"] = confidence
    else:
        inv_update["match_aproximado_candidato_id"] = None
        con_update["match_aproximado_candidato_id"] = None
    await db.transactions.update_one({"id": factura["id"]}, {"$set": inv_update})
    await db.transactions.update_one({"id": consumo["id"]}, {"$set": con_update})


async def try_sri_match(user_id: str, tx_id: str) -> dict:
    """Intenta emparejar una transacción con su contraparte (factura↔consumo).
    Llamada tras insertar una factura o consumo nuevo. Minimal side-effect: sólo
    actualiza estado_sri en el tx + candidato.
    """
    tx = await db.transactions.find_one({"id": tx_id, "user_id": user_id}, {"_id": 0})
    if not tx or tx.get("transaction_type") != "expense":
        return {"status": "skipped"}
    if tx.get("uso_empresarial"):
        return {"status": "corporate"}

    candidate, diff_pct = await _find_candidate(user_id, tx)
    if candidate is None:
        # Sin match: marcar pendiente con ventana 72h
        deadline = (datetime.now(timezone.utc) + timedelta(hours=PENDING_WINDOW_HOURS)).isoformat()
        await db.transactions.update_one(
            {"id": tx_id},
            {"$set": {"estado_sri": "pendiente_match", "match_pendiente_hasta": deadline}},
        )
        return {"status": "pendiente_match"}

    factura = tx if _is_invoice(tx) else candidate
    consumo = candidate if _is_invoice(tx) else tx
    confidence = round(1 - diff_pct, 4)

    if diff_pct <= EXACT_AMOUNT_TOL:
        await _link_pair(factura, consumo, "con_respaldo", confidence)
        return {"status": "con_respaldo", "candidate_id": candidate["id"], "confidence": confidence}
    else:
        await _link_pair(factura, consumo, "match_aproximado", confidence)
        return {"status": "match_aproximado", "candidate_id": candidate["id"], "confidence": confidence}


async def retry_pending_matches(user_id: str) -> dict:
    """Reintenta match para todas las transacciones pendientes del usuario.
    Llamar cuando se inserta un tx nuevo (oportunidad de match) o manualmente.
    También expira transacciones con más de 72h sin match.
    """
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()

    pendings = await db.transactions.find(
        {"user_id": user_id, "estado_sri": "pendiente_match"}, {"_id": 0, "id": 1, "match_pendiente_hasta": 1}
    ).to_list(500)

    retried = matched = expired = 0
    for p in pendings:
        deadline = p.get("match_pendiente_hasta")
        if deadline and deadline < now_iso:
            # 72h vencidas sin match → candidato a "sin vinculación"
            await db.transactions.update_one(
                {"id": p["id"]}, {"$set": {"estado_sri": "sin_respaldo_72h"}}
            )
            expired += 1
            continue
        result = await try_sri_match(user_id, p["id"])
        retried += 1
        if result["status"] in ("con_respaldo", "match_aproximado"):
            matched += 1
    return {"retried": retried, "matched": matched, "expired": expired}


# ================= ENDPOINTS =================

@router.get("/sri/counters")
async def sri_counters(user: dict = Depends(get_current_user)):
    """4 contadores para el Dashboard SRI."""
    base = {"user_id": user["id"], "transaction_type": "expense", "uso_empresarial": {"$ne": True}}
    con_respaldo = await db.transactions.count_documents({**base, "estado_sri": "con_respaldo"})
    aproximado = await db.transactions.count_documents({**base, "estado_sri": "match_aproximado"})
    pendiente = await db.transactions.count_documents({**base, "estado_sri": "pendiente_match"})
    sin_vincular = await db.transactions.count_documents({
        **base,
        "$or": [{"estado_sri": "sin_respaldo_72h"}, {"estado_sri": "sin_respaldo"}],
    })
    return {
        "con_respaldo": con_respaldo,
        "match_aproximado": aproximado,
        "pendiente_match": pendiente,
        "sin_vincular": sin_vincular,
    }


@router.get("/sri/pending")
async def sri_pending(user: dict = Depends(get_current_user)):
    """Lista transacciones que requieren acción del usuario."""
    base = {"user_id": user["id"], "transaction_type": "expense", "uso_empresarial": {"$ne": True}}
    aprox = await db.transactions.find({**base, "estado_sri": "match_aproximado"}, {"_id": 0}).sort("date", -1).to_list(100)
    expirados = await db.transactions.find({**base, "estado_sri": "sin_respaldo_72h"}, {"_id": 0}).sort("date", -1).to_list(100)
    # Enriquecer con datos del candidato
    for lst in (aprox, expirados):
        for t in lst:
            cand_id = t.get("match_aproximado_candidato_id") or t.get("factura_vinculada_id") or t.get("consumo_vinculado_id")
            if cand_id:
                c = await db.transactions.find_one({"id": cand_id, "user_id": user["id"]}, {"_id": 0, "id": 1, "amount": 1, "date": 1, "description": 1, "establishment": 1})
                t["candidato"] = c
    return {"match_aproximado": aprox, "sin_respaldo_72h": expirados}


@router.post("/sri/confirm-match/{tx_id}")
async def confirm_match(tx_id: str, user: dict = Depends(get_current_user)):
    tx = await db.transactions.find_one({"id": tx_id, "user_id": user["id"]}, {"_id": 0})
    if not tx:
        raise HTTPException(404, "Transaccion no encontrada")
    cand_id = tx.get("match_aproximado_candidato_id")
    if not cand_id:
        raise HTTPException(400, "No hay candidato aproximado para confirmar")
    cand = await db.transactions.find_one({"id": cand_id, "user_id": user["id"]}, {"_id": 0})
    if not cand:
        raise HTTPException(404, "Candidato no encontrado")
    factura = tx if _is_invoice(tx) else cand
    consumo = cand if _is_invoice(tx) else tx
    await _link_pair(factura, consumo, "con_respaldo", tx.get("match_aproximado_confianza"))

    # Asegurar que la factura esté representada como transacción de presupuesto
    # (source "factura_sri"). Si ya existe una tx con source que contiene factura/gmail
    # y factura_vinculada_id = factura.id, no duplicar.
    created_budget_tx = False
    existing = await db.transactions.find_one({
        "user_id": user["id"],
        "factura_vinculada_id": factura["id"],
        "source": {"$regex": "factura|gmail", "$options": "i"},
    }, {"_id": 0, "id": 1})
    if not existing:
        nombre_emisor = factura.get("nombre_emisor") or factura.get("establishment") or factura.get("ruc_emisor")
        numero_factura = factura.get("numero_factura")
        monto = factura.get("amount") or factura.get("monto") or 0
        fecha = factura.get("fecha_emision") or factura.get("date")
        new_tx = {
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "transaction_type": "expense",
            "amount": monto,
            "description": nombre_emisor or numero_factura or "Factura SRI",
            "comercio": nombre_emisor,
            "establishment": nombre_emisor,
            "category": consumo.get("budget_category") or consumo.get("category") or "otros",
            "subcategory": consumo.get("subcategory"),
            "sri_category": "deducible",
            "is_deductible": True,
            "source": "factura_sri",
            "status": TransactionStatus.APPROVED,
            "date": fecha,
            "fecha": fecha,
            "numero_factura": numero_factura,
            "ruc_emisor": factura.get("ruc_emisor"),
            "factura_vinculada_id": factura["id"],
            "estado_sri": "con_respaldo",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.transactions.insert_one(new_tx)
        created_budget_tx = True
    return {"status": "con_respaldo", "created_budget_tx": created_budget_tx}


@router.post("/sri/reject-match/{tx_id}")
async def reject_match(tx_id: str, user: dict = Depends(get_current_user)):
    tx = await db.transactions.find_one({"id": tx_id, "user_id": user["id"]}, {"_id": 0})
    if not tx:
        raise HTTPException(404, "Transaccion no encontrada")
    cand_id = tx.get("match_aproximado_candidato_id")
    deadline = (datetime.now(timezone.utc) + timedelta(hours=PENDING_WINDOW_HOURS)).isoformat()
    # Limpiar vínculo en ambas partes
    for target_id in filter(None, [tx_id, cand_id]):
        await db.transactions.update_one(
            {"id": target_id, "user_id": user["id"]},
            {"$set": {
                "estado_sri": "pendiente_match",
                "match_pendiente_hasta": deadline,
                "match_aproximado_candidato_id": None,
                "match_aproximado_confianza": None,
                "factura_vinculada_id": None,
                "consumo_vinculado_id": None,
            }},
        )
    return {"status": "pendiente_match"}


@router.post("/sri/mark-cash/{tx_id}")
async def mark_as_cash(tx_id: str, user: dict = Depends(get_current_user)):
    """El usuario declara que fue pago en efectivo: crear consumo efectivo y vincular."""
    tx = await db.transactions.find_one({"id": tx_id, "user_id": user["id"]}, {"_id": 0})
    if not tx:
        raise HTTPException(404, "Transaccion no encontrada")
    if not _is_invoice(tx):
        # Ya es consumo: simplemente marcar como con respaldo efectivo (sin factura externa)
        await db.transactions.update_one(
            {"id": tx_id},
            {"$set": {
                "estado_sri": "con_respaldo",
                "payment_method": "efectivo",
                "match_pendiente_hasta": None,
                "source": "factura_sri",
                "is_deductible": True,
            }},
        )
        return {"status": "con_respaldo", "created_cash_tx": False}
    # Es factura sin consumo: crear consumo efectivo vinculado
    consumo_id = str(uuid.uuid4())
    consumo_doc = {
        "id": consumo_id,
        "user_id": user["id"],
        "amount": tx.get("amount", 0),
        "description": f"Pago efectivo - {tx.get('description', '')}",
        "category": tx.get("category", "otros"),
        "subcategory": tx.get("subcategory"),
        "date": tx.get("date"),
        "transaction_type": "expense",
        "establishment": tx.get("establishment"),
        "payment_method": "efectivo",
        "source_type": SourceType.MANUAL,
        "source": "factura_sri",
        "status": TransactionStatus.APPROVED,
        "estado_sri": "con_respaldo",
        "factura_vinculada_id": tx["id"],
        "is_deductible": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.transactions.insert_one(consumo_doc)
    await db.transactions.update_one(
        {"id": tx_id},
        {"$set": {"estado_sri": "con_respaldo", "consumo_vinculado_id": consumo_id, "match_pendiente_hasta": None}},
    )
    return {"status": "con_respaldo", "created_cash_tx": True, "consumo_id": consumo_id}


@router.post("/sri/link-manual")
async def link_manual(body: dict, user: dict = Depends(get_current_user)):
    tx_id = body.get("tx_id")
    target_id = body.get("target_tx_id")
    if not tx_id or not target_id:
        raise HTTPException(400, "tx_id y target_tx_id requeridos")
    tx = await db.transactions.find_one({"id": tx_id, "user_id": user["id"]}, {"_id": 0})
    target = await db.transactions.find_one({"id": target_id, "user_id": user["id"]}, {"_id": 0})
    if not tx or not target:
        raise HTTPException(404, "Transaccion no encontrada")
    if _is_invoice(tx) == _is_invoice(target):
        raise HTTPException(400, "Una debe ser factura y la otra consumo")
    factura = tx if _is_invoice(tx) else target
    consumo = target if _is_invoice(tx) else tx
    await _link_pair(factura, consumo, "con_respaldo", 1.0)
    return {"status": "con_respaldo"}


@router.post("/sri/discard/{tx_id}")
async def discard_sri(tx_id: str, user: dict = Depends(get_current_user)):
    result = await db.transactions.update_one(
        {"id": tx_id, "user_id": user["id"]},
        {"$set": {"estado_sri": "sin_respaldo", "match_pendiente_hasta": None}},
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Transaccion no encontrada")
    return {"status": "sin_respaldo"}


@router.patch("/sri/corporate/{tx_id}")
async def toggle_corporate(tx_id: str, body: dict, user: dict = Depends(get_current_user)):
    uso = bool(body.get("uso_empresarial", True))
    update = {"uso_empresarial": uso}
    # si es empresarial, queda fuera del cálculo SRI personal
    if uso:
        update["is_deductible"] = False
    result = await db.transactions.update_one(
        {"id": tx_id, "user_id": user["id"]}, {"$set": update}
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Transaccion no encontrada")
    return {"status": "ok", "uso_empresarial": uso}


@router.post("/sri/scan")
async def scan_pending(user: dict = Depends(get_current_user)):
    """Reintenta match para todas las transacciones pendientes del usuario."""
    return await retry_pending_matches(user["id"])


@router.post("/sri/normalize-sources")
async def normalize_sources(user: dict = Depends(get_current_user)):
    """Migración: unifica el source de facturas vinculadas a 'factura_sri'.
    Aplica a tx del usuario con factura_vinculada_id seteado y source actual en
    ['gmail_pdf','gmail_factura_pdf','sri_xml',''] (o ausente)."""
    legacy_sources = ["gmail_pdf", "gmail_factura_pdf", "sri_xml", ""]
    result = await db.transactions.update_many(
        {
            "user_id": user["id"],
            "factura_vinculada_id": {"$exists": True, "$ne": None},
            "$or": [
                {"source": {"$in": legacy_sources}},
                {"source": {"$exists": False}},
            ],
        },
        {"$set": {"source": "factura_sri"}},
    )
    return {"normalized": result.modified_count}
