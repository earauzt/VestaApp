from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import HTMLResponse, FileResponse
from datetime import datetime, timezone, timedelta
from typing import Optional
import uuid
import os
import re
import json
import logging
import base64
import secrets as secrets_mod

from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from database import db
from models import GMAIL_SCOPES, BANK_DOMAINS, BANK_SENDERS, DISCARD_SUBJECTS, SERVICE_DOMAINS
from utils import (
    get_current_user, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI, EMERGENT_LLM_KEY, extract_text_from_pdf,
    process_bank_statement_text, lookup_known_vendor
)
from emergentintegrations.llm.chat import LlmChat, UserMessage
from parsers import dispatch as parser_dispatch, extract_html_body, extract_text_body
from utils import dedup_or_merge

logger = logging.getLogger(__name__)
router = APIRouter()


async def _get_gmail_credentials(user_id: str) -> Credentials:
    token_doc = await db.gmail_tokens.find_one({"user_id": user_id})
    if not token_doc:
        raise HTTPException(status_code=400, detail="Gmail no conectado. Conecta tu cuenta primero.")
    creds = Credentials(
        token=token_doc["access_token"],
        refresh_token=token_doc.get("refresh_token"),
        token_uri="https://oauth2.googleapis.com/token",
        client_id=GOOGLE_CLIENT_ID,
        client_secret=GOOGLE_CLIENT_SECRET
    )
    if creds.expired and creds.refresh_token:
        from google.auth.transport.requests import Request
        creds.refresh(Request())
        await db.gmail_tokens.update_one(
            {"user_id": user_id},
            {"$set": {"access_token": creds.token, "expires_at": creds.expiry.isoformat() if creds.expiry else None}}
        )
    return creds


async def _classify_email_with_ai(subject: str, body_snippet: str, force_type: str = None) -> dict:
    system_prompt = (
        'Eres un clasificador financiero de bancos ecuatorianos. '
        'Analiza el subject y body y devuelve SOLO JSON sin texto adicional: '
        '{"tipo": "consumo|estado_de_cuenta|alerta|factura_sri|descarte", '
        '"monto": numero o null, "comercio": string o null, '
        '"fecha": "YYYY-MM-DD" o null, "tarjeta_ultimos4": string o null, '
        '"banco": string, "descripcion_corta": string, '
        '"nivel_urgencia": "alta|media|baja|ninguna", '
        '"numero_factura": string o null, "ruc_emisor": string o null}'
    )
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"gmail_classify_{uuid.uuid4()}",
            system_message=system_prompt
        ).with_model("openai", "gpt-4o")
        response = await chat.send_message(UserMessage(text=f"Subject: {subject}\n\nBody: {body_snippet[:2000]}"))
        json_match = re.search(r'\{[^{}]*\}', response, re.DOTALL)
        if json_match:
            result = json.loads(json_match.group())
            if force_type:
                result["tipo"] = force_type
            return result
    except Exception as e:
        logger.error(f"Gmail AI classification error: {e}")
    return {"tipo": force_type or "descarte", "monto": None, "comercio": None, "fecha": None, "tarjeta_ultimos4": None, "banco": "desconocido", "descripcion_corta": subject[:60], "nivel_urgencia": "ninguna", "numero_factura": None, "ruc_emisor": None}


async def _classify_service_receipt(subject: str, body_snippet: str) -> dict:
    system_prompt = (
        'Eres un clasificador de recibos de servicios digitales. '
        'Analiza el subject y body de un email de un servicio digital (Apple, Netflix, Spotify, Google, Amazon, Adobe) '
        'y devuelve SOLO JSON sin texto adicional: '
        '{"tipo": "recibo_servicio", '
        '"comercio": string (nombre del servicio, ej: "Netflix", "Apple iCloud", "Spotify Premium"), '
        '"monto": numero o null, '
        '"tarjeta_ultimos4": string o null, '
        '"fecha": "YYYY-MM-DD" o null (fecha del cobro), '
        '"descripcion_corta": string (resumen de 1 linea), '
        '"es_suscripcion": boolean (true si es cobro recurrente/subscription), '
        '"proxima_renovacion": "YYYY-MM-DD" o null (siguiente fecha de cobro si se menciona)}'
    )
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"gmail_service_{uuid.uuid4()}",
            system_message=system_prompt
        ).with_model("openai", "gpt-4o")
        response = await chat.send_message(UserMessage(text=f"Subject: {subject}\n\nBody: {body_snippet[:2000]}"))
        json_match = re.search(r'\{[^{}]*\}', response, re.DOTALL)
        if json_match:
            return json.loads(json_match.group())
    except Exception as e:
        logger.error(f"Service receipt classification error: {e}")
    return {"tipo": "recibo_servicio", "comercio": None, "monto": None, "tarjeta_ultimos4": None, "fecha": None, "descripcion_corta": subject[:60], "es_suscripcion": False, "proxima_renovacion": None}


async def _download_gmail_pdf_attachment(service, gmail_id: str, user_id: str, tipo: str, banco: str, fecha: str, numero_factura: str = None) -> dict:
    result = {"filepath": None, "doc_id": None, "extracted_transactions": 0}
    try:
        msg = service.users().messages().get(userId='me', id=gmail_id, format='full').execute()
        payload = msg.get('payload', {})
        parts = payload.get('parts', [])
        all_parts = list(parts)
        for part in parts:
            all_parts.extend(part.get('parts', []))

        for part in all_parts:
            filename = part.get('filename', '')
            if not filename.lower().endswith('.pdf'):
                continue
            attachment_id = part.get('body', {}).get('attachmentId')
            if not attachment_id:
                continue
            att = service.users().messages().attachments().get(userId='me', messageId=gmail_id, id=attachment_id).execute()
            data = att.get('data', '')
            pdf_bytes = base64.urlsafe_b64decode(data)

            upload_dir = "/app/uploads/gmail_pdfs"
            os.makedirs(upload_dir, exist_ok=True)
            safe_banco = re.sub(r'[^\w\-]', '_', (banco or 'desconocido'))
            safe_fecha = re.sub(r'[^\w\-]', '_', (fecha or 'sin_fecha'))
            safe_extra = re.sub(r'[^\w\-]', '_', (numero_factura or ''))
            suffix = f"_{safe_extra}" if safe_extra else ""
            filepath = f"{upload_dir}/{user_id}_{safe_banco}_{safe_fecha}{suffix}.pdf"
            with open(filepath, 'wb') as f:
                f.write(pdf_bytes)

            doc_id = str(uuid.uuid4())
            doc_record = {"id": doc_id, "user_id": user_id, "gmail_id": gmail_id, "filename": filename, "filepath": filepath, "tipo": tipo, "banco": banco, "numero_factura": numero_factura, "ruc_emisor": None, "monto": None, "fecha_email": fecha, "procesado": False, "transactions_count": 0, "created_at": datetime.now(timezone.utc).isoformat()}

            if tipo in ("estado_de_cuenta", "resumen_mensual"):
                try:
                    extracted_text = extract_text_from_pdf(filepath)
                    if extracted_text and len(extracted_text) > 50:
                        ai_result = await process_bank_statement_text(extracted_text)
                        transactions = ai_result.get("transactions", [])
                        card_info = ai_result.get("card_info", {})
                        tx_count = 0
                        for t in transactions:
                            amount = t.get("amount") or t.get("monto", 0)
                            if not amount or amount == 0:
                                continue
                            tx_doc = {"id": str(uuid.uuid4()), "user_id": user_id, "amount": abs(float(amount)), "description": t.get("description") or t.get("descripcion", ""), "establishment": t.get("establishment") or t.get("comercio", ""), "vendor": t.get("establishment") or t.get("comercio", ""), "date": t.get("date") or t.get("fecha") or fecha, "personal_category": t.get("category") or "otros", "category": t.get("category") or "otros", "source": "gmail_pdf", "gmail_doc_id": doc_id, "status": "pending_review", "created_at": datetime.now(timezone.utc).isoformat()}
                            await db.transactions.insert_one(tx_doc)
                            tx_count += 1
                        doc_record["procesado"] = True
                        doc_record["transactions_count"] = tx_count
                        doc_record["card_info"] = card_info
                        result["extracted_transactions"] = tx_count
                        logger.info(f"Gmail PDF processed: {tx_count} transactions from {filepath}")
                except Exception as e:
                    logger.error(f"Error processing Gmail PDF text: {e}")

            await db.gmail_documents.insert_one(doc_record)
            result["filepath"] = filepath
            result["doc_id"] = doc_id
            logger.info(f"PDF saved: {filepath}")
            return result
    except Exception as e:
        logger.error(f"Error downloading Gmail PDF attachment: {e}")
    return result


@router.get("/gmail/auth-url")
async def gmail_auth_url(user: dict = Depends(get_current_user)):
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Google OAuth2 no configurado")
    state = secrets_mod.token_urlsafe(32)
    flow = Flow.from_client_config(
        {"web": {"client_id": GOOGLE_CLIENT_ID, "client_secret": GOOGLE_CLIENT_SECRET, "auth_uri": "https://accounts.google.com/o/oauth2/auth", "token_uri": "https://oauth2.googleapis.com/token", "redirect_uris": [GOOGLE_REDIRECT_URI]}},
        scopes=GMAIL_SCOPES, redirect_uri=GOOGLE_REDIRECT_URI
    )
    auth_url, _ = flow.authorization_url(access_type='offline', include_granted_scopes='true', prompt='consent', state=state)
    now = datetime.now(timezone.utc)
    await db.gmail_oauth_states.insert_one({
        "state": state,
        "user_id": user["id"],
        "created_at": now.isoformat(),
        "expires_at": (now + timedelta(minutes=10)).isoformat()
    })
    return {"auth_url": auth_url}


@router.get("/gmail/callback")
async def gmail_callback(code: str, state: str):
    state_doc = await db.gmail_oauth_states.find_one({"state": state})
    if not state_doc:
        raise HTTPException(status_code=400, detail="invalid_state")
    expires_at = state_doc.get("expires_at", "")
    if expires_at and datetime.fromisoformat(expires_at) < datetime.now(timezone.utc):
        await db.gmail_oauth_states.delete_one({"state": state})
        raise HTTPException(status_code=400, detail="invalid_state")
    await db.gmail_oauth_states.delete_one({"state": state})
    user_id = state_doc["user_id"]
    try:
        flow = Flow.from_client_config(
            {"web": {"client_id": GOOGLE_CLIENT_ID, "client_secret": GOOGLE_CLIENT_SECRET, "auth_uri": "https://accounts.google.com/o/oauth2/auth", "token_uri": "https://oauth2.googleapis.com/token", "redirect_uris": [GOOGLE_REDIRECT_URI]}},
            scopes=GMAIL_SCOPES, redirect_uri=GOOGLE_REDIRECT_URI
        )
        flow.fetch_token(code=code)
        creds = flow.credentials
        await db.gmail_tokens.update_one(
            {"user_id": user_id},
            {"$set": {"user_id": user_id, "access_token": creds.token, "refresh_token": creds.refresh_token, "token_uri": creds.token_uri, "client_id": creds.client_id, "client_secret": creds.client_secret, "expires_at": creds.expiry.isoformat() if creds.expiry else None, "connected_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True
        )
        return HTMLResponse("""<html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;background:#f0fdf4"><div style="text-align:center;padding:40px;background:white;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.1)"><h2 style="color:#16a34a">Gmail conectado exitosamente</h2><p>Puedes cerrar esta ventana y volver a FamilyFinance.</p></div></body></html>""")
    except Exception as e:
        logger.error(f"Gmail OAuth callback error: {e}")
        return HTMLResponse(f"<html><body><h2>Error al conectar Gmail</h2><p>{str(e)}</p></body></html>")


@router.get("/gmail/status")
async def gmail_status(user: dict = Depends(get_current_user)):
    token_doc = await db.gmail_tokens.find_one({"user_id": user["id"]}, {"_id": 0, "access_token": 0, "refresh_token": 0, "client_secret": 0})
    if token_doc:
        last_sync = await db.gmail_transactions.find_one({"user_id": user["id"]}, {"_id": 0, "procesado_at": 1}, sort=[("procesado_at", -1)])
        return {"connected": True, "connected_at": token_doc.get("connected_at"), "last_sync": last_sync.get("procesado_at") if last_sync else None}
    return {"connected": False}


@router.post("/gmail/sync")
async def gmail_sync(user: dict = Depends(get_current_user)):
    creds = await _get_gmail_credentials(user["id"])
    service = build('gmail', 'v1', credentials=creds)
    GMAIL_SENDER_FILTER = (
        "from:(servicios@dinersclub.com.ec OR notificaciones@infopacificard.com.ec "
        "OR servicios@tarjetasbancopichincha.com OR Avisos24@bolivariano.com "
        "OR intermail@bancopacifico.ec OR banco@pichincha.com "
        "OR documentoselectronicos@pichincha.com OR estadodecuenta@pacificard.ec "
        "OR estadoscuenta@bancodelpacifico.com.ec "
        "OR email.apple.com OR netflix.com "
        "OR spotify.com OR google.com OR amazon.com OR adobe.com) is:unread"
    )
    results = service.users().messages().list(userId='me', q=GMAIL_SENDER_FILTER, maxResults=50).execute()
    messages = results.get('messages', [])
    if not messages:
        return {"status": "success", "total": 0, "procesados": 0, "descartados": 0, "message": "No hay emails nuevos"}

    procesados = 0
    descartados = 0
    nuevos = []

    for msg_info in messages:
        gmail_id = msg_info['id']
        existing = await db.gmail_transactions.find_one({"gmail_id": gmail_id, "user_id": user["id"]})
        if existing:
            continue
        msg = service.users().messages().get(userId='me', id=gmail_id, format='full').execute()
        headers = {h['name'].lower(): h['value'] for h in msg.get('payload', {}).get('headers', [])}
        sender = headers.get('from', '')
        subject = headers.get('subject', '')
        date_str = headers.get('date', '')
        body_snippet = msg.get('snippet', '')
        subject_lower = subject.lower()
        is_factura_subject = "factura" in subject_lower
        sender_lower = sender.lower()
        is_bank_email = any(domain in sender_lower for domain in BANK_DOMAINS) or any(addr in sender_lower for addr in BANK_SENDERS)
        is_service_email = any(domain in sender_lower for domain in SERVICE_DOMAINS)

        if not is_bank_email and not is_factura_subject and not is_service_email:
            await db.gmail_transactions.insert_one({"user_id": user["id"], "gmail_id": gmail_id, "remitente": sender, "subject": subject, "fecha_email": date_str, "tipo": "descarte", "monto": None, "comercio": None, "fecha_transaccion": None, "tarjeta_ultimos4": None, "banco": None, "descripcion_corta": "No es email bancario ni de servicio", "nivel_urgencia": "ninguna", "estado": "descartado", "numero_factura": None, "ruc_emisor": None, "es_deducible": False, "es_suscripcion": False, "proxima_renovacion": None, "procesado_at": datetime.now(timezone.utc).isoformat()})
            descartados += 1
            continue

        is_marketing = not is_factura_subject and not is_service_email and any(kw in subject_lower for kw in DISCARD_SUBJECTS)
        if is_marketing:
            await db.gmail_transactions.insert_one({"user_id": user["id"], "gmail_id": gmail_id, "remitente": sender, "subject": subject, "fecha_email": date_str, "tipo": "descarte", "monto": None, "comercio": None, "fecha_transaccion": None, "tarjeta_ultimos4": None, "banco": None, "descripcion_corta": "Email promocional descartado", "nivel_urgencia": "ninguna", "estado": "descartado", "numero_factura": None, "ruc_emisor": None, "es_deducible": False, "es_suscripcion": False, "proxima_renovacion": None, "procesado_at": datetime.now(timezone.utc).isoformat()})
            descartados += 1
            continue

        # Branch: service receipt vs bank/invoice
        if is_service_email and not is_bank_email:
            classification = await _classify_service_receipt(subject, body_snippet)
            doc = {
                "user_id": user["id"], "gmail_id": gmail_id, "remitente": sender,
                "subject": subject, "fecha_email": date_str,
                "tipo": "recibo_servicio",
                "monto": classification.get("monto"),
                "comercio": classification.get("comercio"),
                "fecha_transaccion": classification.get("fecha"),
                "tarjeta_ultimos4": classification.get("tarjeta_ultimos4"),
                "banco": None,
                "descripcion_corta": classification.get("descripcion_corta", subject[:60]),
                "nivel_urgencia": "baja",
                "estado": "pendiente",
                "personal_category": "suscripciones" if classification.get("es_suscripcion") else "otros",
                "sri_category": None,
                "numero_factura": None, "ruc_emisor": None,
                "es_deducible": False,
                "es_suscripcion": classification.get("es_suscripcion", False),
                "proxima_renovacion": classification.get("proxima_renovacion"),
                "procesado_at": datetime.now(timezone.utc).isoformat()
            }
            await db.gmail_transactions.insert_one(doc)
            doc.pop("_id", None)
            nuevos.append(doc)
            procesados += 1
            continue

        # Bank / invoice path — try dedicated parsers first, then GPT-4o fallback
        html_body = extract_html_body(msg)
        text_body = extract_text_body(msg) or body_snippet

        parsed = parser_dispatch(sender, subject, html_body, text_body)

        if parsed:
            tipo = parsed["tipo"]
            vendor_category = None
            vendor_sri = None
            if tipo == "consumo" and parsed.get("comercio"):
                vendor_match = await lookup_known_vendor(user["id"], parsed["comercio"])
                if vendor_match and vendor_match.get("found"):
                    vendor_category = vendor_match.get("personal_category")
                    vendor_sri = vendor_match.get("sri_category")

            pdf_result = {"filepath": None, "doc_id": None, "extracted_transactions": 0}
            has_pdf = parsed.get("has_pdf_attachment", False)
            if has_pdf:
                pdf_result = await _download_gmail_pdf_attachment(service, gmail_id, user["id"], tipo=tipo, banco=parsed["banco"], fecha=parsed.get("fecha") or date_str)

            doc = {
                "user_id": user["id"], "gmail_id": gmail_id, "remitente": sender,
                "subject": subject, "fecha_email": date_str,
                "tipo": tipo, "monto": parsed.get("monto"),
                "comercio": parsed.get("comercio"),
                "fecha_transaccion": parsed.get("fecha"),
                "tarjeta_ultimos4": parsed.get("tarjeta_ultimos4"),
                "banco": parsed.get("banco"),
                "descripcion_corta": parsed.get("descripcion_corta", subject[:60]),
                "nivel_urgencia": parsed.get("nivel_urgencia", "media"),
                "estado": "pendiente",
                "personal_category": vendor_category,
                "sri_category": vendor_sri,
                "numero_factura": None, "ruc_emisor": None,
                "es_deducible": tipo == "factura_sri",
                "es_suscripcion": False, "proxima_renovacion": None,
                "notificacion": parsed.get("notificacion"),
                "parsed_by": parsed.get("parser", "unknown"),
                "pdf_filepath": pdf_result.get("filepath"),
                "pdf_doc_id": pdf_result.get("doc_id"),
                "extracted_transactions": pdf_result.get("extracted_transactions", 0),
                "procesado_at": datetime.now(timezone.utc).isoformat()
            }
            await db.gmail_transactions.insert_one(doc)
            doc.pop("_id", None)
            nuevos.append(doc)
            procesados += 1
            continue

        # GPT-4o fallback — no parser matched
        force_type = "factura_sri" if is_factura_subject else None
        classification = await _classify_email_with_ai(subject, body_snippet, force_type=force_type)
        tipo = classification.get("tipo", "descarte")
        numero_factura = classification.get("numero_factura")
        ruc_emisor = classification.get("ruc_emisor")
        es_deducible = True if tipo == "factura_sri" else False

        vendor_category = None
        vendor_sri = None
        if tipo == "consumo" and classification.get("comercio"):
            comercio = classification["comercio"]
            vendor_match = await lookup_known_vendor(user["id"], comercio)
            if vendor_match and vendor_match.get("found"):
                vendor_category = vendor_match.get("personal_category")
                vendor_sri = vendor_match.get("sri_category")

        pdf_result = {"filepath": None, "doc_id": None, "extracted_transactions": 0}
        should_download_pdf = tipo == "factura_sri" or tipo == "estado_de_cuenta" or any(kw in subject_lower for kw in ["estado de cuenta", "resumen mensual", "factura"])
        if should_download_pdf:
            banco_name = classification.get("banco", "desconocido")
            pdf_result = await _download_gmail_pdf_attachment(service, gmail_id, user["id"], tipo=tipo, banco=banco_name, fecha=classification.get("fecha") or date_str, numero_factura=numero_factura)

        doc = {"user_id": user["id"], "gmail_id": gmail_id, "remitente": sender, "subject": subject, "fecha_email": date_str, "tipo": tipo, "monto": classification.get("monto"), "comercio": classification.get("comercio"), "fecha_transaccion": classification.get("fecha"), "tarjeta_ultimos4": classification.get("tarjeta_ultimos4"), "banco": classification.get("banco"), "descripcion_corta": classification.get("descripcion_corta", subject[:60]), "nivel_urgencia": classification.get("nivel_urgencia", "ninguna"), "estado": "pendiente", "personal_category": vendor_category, "sri_category": vendor_sri, "numero_factura": numero_factura, "ruc_emisor": ruc_emisor, "es_deducible": es_deducible, "es_suscripcion": False, "proxima_renovacion": None, "pdf_filepath": pdf_result.get("filepath"), "pdf_doc_id": pdf_result.get("doc_id"), "extracted_transactions": pdf_result.get("extracted_transactions", 0), "procesado_at": datetime.now(timezone.utc).isoformat()}
        await db.gmail_transactions.insert_one(doc)
        doc.pop("_id", None)
        nuevos.append(doc)
        procesados += 1

    return {"status": "success", "total": len(messages), "procesados": procesados, "descartados": descartados, "ya_procesados": len(messages) - procesados - descartados, "transacciones": nuevos}


@router.get("/gmail/transactions")
async def gmail_transactions(tipo: Optional[str] = None, estado: Optional[str] = None, limit: int = 50, user: dict = Depends(get_current_user)):
    query = {"user_id": user["id"]}
    if tipo:
        query["tipo"] = tipo
    if estado:
        query["estado"] = estado
    else:
        query["estado"] = {"$ne": "descartado"}
    txs = await db.gmail_transactions.find(query, {"_id": 0}).sort("procesado_at", -1).to_list(limit)
    total = await db.gmail_transactions.count_documents({"user_id": user["id"]})
    pending = await db.gmail_transactions.count_documents({"user_id": user["id"], "estado": "pendiente"})
    approved = await db.gmail_transactions.count_documents({"user_id": user["id"], "estado": "aprobado"})
    discarded = await db.gmail_transactions.count_documents({"user_id": user["id"], "estado": "descartado"})
    return {"transactions": txs, "summary": {"total": total, "pendiente": pending, "aprobado": approved, "descartado": discarded}}


@router.put("/gmail/transactions/{gmail_id}/approve")
async def approve_gmail_transaction(gmail_id: str, user: dict = Depends(get_current_user)):
    gmail_tx = await db.gmail_transactions.find_one({"gmail_id": gmail_id, "user_id": user["id"]}, {"_id": 0})
    if not gmail_tx:
        raise HTTPException(status_code=404, detail="Transaccion Gmail no encontrada")
    tx_doc = {"id": str(uuid.uuid4()), "user_id": user["id"], "amount": gmail_tx.get("monto") or 0, "description": gmail_tx.get("descripcion_corta", ""), "establishment": gmail_tx.get("comercio", ""), "vendor": gmail_tx.get("comercio", ""), "date": gmail_tx.get("fecha_transaccion") or datetime.now(timezone.utc).strftime("%Y-%m-%d"), "personal_category": gmail_tx.get("personal_category", "otros"), "category": gmail_tx.get("personal_category", "otros"), "sri_category": gmail_tx.get("sri_category"), "source": "gmail", "status": "approved", "tarjeta_ultimos4": gmail_tx.get("tarjeta_ultimos4"), "transaction_type": "expense", "numero_factura": gmail_tx.get("numero_factura"), "ruc_emisor": gmail_tx.get("ruc_emisor"), "source_type": "invoice" if gmail_tx.get("tipo") == "factura_sri" else "email", "has_invoice": gmail_tx.get("tipo") == "factura_sri", "is_deductible": bool(gmail_tx.get("es_deducible")), "created_at": datetime.now(timezone.utc).isoformat()}
    result = await dedup_or_merge(user["id"], tx_doc, "email_banco")
    await db.gmail_transactions.update_one({"gmail_id": gmail_id, "user_id": user["id"]}, {"$set": {"estado": "aprobado"}})
    # SRI match attempt + retry pendings
    try:
        from routes.sri_match import try_sri_match, retry_pending_matches
        await try_sri_match(user["id"], result["transaction_id"])
        await retry_pending_matches(user["id"])
    except Exception as e:
        logger.warning(f"SRI match hook failed: {e}")
    return {"status": "success", "transaction_id": result["transaction_id"], "action": result["action"]}


@router.put("/gmail/transactions/{gmail_id}/discard")
async def discard_gmail_transaction(gmail_id: str, user: dict = Depends(get_current_user)):
    result = await db.gmail_transactions.update_one({"gmail_id": gmail_id, "user_id": user["id"]}, {"$set": {"estado": "descartado"}})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Transaccion no encontrada")
    return {"status": "success"}


@router.get("/gmail/documents")
async def list_gmail_documents(user: dict = Depends(get_current_user)):
    docs = await db.gmail_documents.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"documents": docs}


@router.get("/gmail/documents/{doc_id}/view")
async def view_gmail_document(doc_id: str, user: dict = Depends(get_current_user)):
    doc = await db.gmail_documents.find_one({"id": doc_id, "user_id": user["id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    filepath = doc.get("filepath")
    if not filepath or not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Archivo PDF no encontrado en el servidor")
    return FileResponse(filepath, media_type="application/pdf", filename=doc.get("filename", "document.pdf"))


@router.post("/gmail/documents/{doc_id}/reprocess")
async def reprocess_gmail_document(doc_id: str, user: dict = Depends(get_current_user)):
    doc = await db.gmail_documents.find_one({"id": doc_id, "user_id": user["id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    filepath = doc.get("filepath")
    if not filepath or not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Archivo PDF no encontrado")
    extracted_text = extract_text_from_pdf(filepath)
    if not extracted_text or len(extracted_text) < 50:
        raise HTTPException(status_code=400, detail="No se pudo extraer texto del PDF")
    ai_result = await process_bank_statement_text(extracted_text)
    transactions = ai_result.get("transactions", [])
    tx_count = 0
    for t in transactions:
        amount = t.get("amount") or t.get("monto", 0)
        if not amount or amount == 0:
            continue
        tx_doc = {"id": str(uuid.uuid4()), "user_id": user["id"], "amount": abs(float(amount)), "description": t.get("description") or t.get("descripcion", ""), "establishment": t.get("establishment") or t.get("comercio", ""), "vendor": t.get("establishment") or t.get("comercio", ""), "date": t.get("date") or t.get("fecha", ""), "personal_category": t.get("category") or "otros", "category": t.get("category") or "otros", "source": "gmail_pdf", "gmail_doc_id": doc_id, "status": "pending_review", "created_at": datetime.now(timezone.utc).isoformat()}
        await db.transactions.insert_one(tx_doc)
        tx_count += 1
    await db.gmail_documents.update_one({"id": doc_id}, {"$set": {"procesado": True, "transactions_count": tx_count}})
    return {"status": "success", "transactions_extracted": tx_count}


@router.get("/gmail/parser-quality")
async def get_parser_quality(user: dict = Depends(get_current_user)):
    """Check parser quality — flag banks where >20% of emails have monto: null."""
    pipeline = [
        {"$match": {"user_id": user["id"], "tipo": {"$in": ["consumo", "pago_tarjeta"]}, "estado": {"$ne": "descartado"}}},
        {"$group": {
            "_id": "$banco",
            "total": {"$sum": 1},
            "null_monto": {"$sum": {"$cond": [{"$eq": ["$monto", None]}, 1, 0]}}
        }}
    ]
    results = await db.gmail_transactions.aggregate(pipeline).to_list(20)
    alerts = []
    for r in results:
        if r["total"] > 0:
            pct = r["null_monto"] / r["total"]
            if pct > 0.2:
                alert = {"banco": r["_id"], "porcentaje_fallido": round(pct * 100, 1), "total": r["total"], "fallidos": r["null_monto"], "fecha": datetime.now(timezone.utc).isoformat()}
                alerts.append(alert)
                await db.parser_alerts.update_one(
                    {"banco": r["_id"]},
                    {"$set": alert},
                    upsert=True
                )
    return {"alerts": alerts}
