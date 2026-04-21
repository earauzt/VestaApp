from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import HTMLResponse, FileResponse
from datetime import datetime, timezone, timedelta
from typing import Optional, List
import uuid
import os
import re
import json
import logging
import base64
import secrets as secrets_mod
from difflib import SequenceMatcher

from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from database import db
from models import GMAIL_SCOPES, BANK_DOMAINS, BANK_SENDERS, DISCARD_SUBJECTS, SERVICE_DOMAINS, apply_categorization_rules
from utils import (
    get_current_user, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI, EMERGENT_LLM_KEY, extract_text_from_pdf,
    process_bank_statement_text, lookup_known_vendor
)
from routes.documents import _upsert_card_from_statement, _save_deferred_purchases
from routes.sri_match import try_sri_match
from emergentintegrations.llm.chat import LlmChat, UserMessage
from parsers import dispatch as parser_dispatch, extract_html_body, extract_text_body
from utils import dedup_or_merge

GOOGLE_REDIRECT_URI_PROD = os.environ.get("GOOGLE_REDIRECT_URI_PROD", "")
PROD_HOST = "finwise-ec.emergent.host"


def _resolve_redirect_uri(request: Request) -> str:
    host = (request.headers.get("x-forwarded-host") or request.headers.get("host") or "").split(":")[0].lower()
    if host == PROD_HOST and GOOGLE_REDIRECT_URI_PROD:
        return GOOGLE_REDIRECT_URI_PROD
    return GOOGLE_REDIRECT_URI

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


# ================= FACTURA SRI DETECTION =================

FACTURA_KEYWORDS = [
    "factura", "fact", "fct", "fac ",
    "facturación", "facturacion",
    "factura electronica", "factura electrónica",
    "documento electronico", "documento electrónico",
    "documentoselectronicos", "doc.electronico",
    "comprobante electronico", "comprobante electrónico",
    "recibo electronico", "recibo electrónico",
    "ha recibido su documento",
    "su documento electronico",
    "su factura",
    "nota de venta",
    "liquidacion de compra",
    "001-001-", "001-002-", "001-003-",
]

FACTURA_BODY_KEYWORDS = [
    "número de autorización", "numero de autorizacion",
    "clave de acceso",
    "ruc:",
    "ambiente: producción", "ambiente: produccion",
    "comprobante de retención", "comprobante de retencion",
]


def _is_factura_electronica(subject: str, body: str) -> bool:
    """Detecta si un email es una factura electrónica SRI basándose en subject o body."""
    s = (subject or "").lower()
    b = (body or "").lower()
    if any(kw.lower() in s for kw in FACTURA_KEYWORDS):
        return True
    if any(kw.lower() in b for kw in (FACTURA_KEYWORDS + FACTURA_BODY_KEYWORDS)):
        return True
    return False


async def _classify_email_with_ai(subject: str, body_snippet: str, force_type: str = None) -> dict:
    system_prompt = (
        'Eres un clasificador financiero de bancos y facturas electronicas ecuatorianas. '
        'Analiza el subject, remitente y body y devuelve SOLO JSON sin texto adicional: '
        '{"tipo": "consumo|estado_de_cuenta|alerta|factura_sri|descarte", '
        '"monto": numero o null, "comercio": string o null, '
        '"fecha": "YYYY-MM-DD" o null, "tarjeta_ultimos4": string o null, '
        '"banco": string, "descripcion_corta": string, '
        '"nivel_urgencia": "alta|media|baja|ninguna", '
        '"numero_factura": string o null, "ruc_emisor": string o null}. '
        'REGLAS PARA factura_sri (OBLIGATORIAS): El subject o body contiene cualquiera de: '
        '"factura", "fact", "fct", "fac ", "facturacion", "facturacion electronica", '
        '"factura electronica", "documento electronico", "documentoselectronicos", '
        '"doc.electronico", "comprobante electronico", "recibo electronico", '
        '"ha recibido su documento", "su documento electronico", "su factura", '
        '"nota de venta", "liquidacion de compra", "001-001-", "001-002-", "001-003-". '
        'O el body contiene: "numero de autorizacion", "clave de acceso", "RUC:", '
        '"ambiente: produccion", "comprobante de retencion". '
        'O el remitente contiene: "contifico.com", "degeremcia.com", "datil.co", "sri.gob.ec", '
        'facturacion@*, facturas@*, comprobantes@*, documentos@*, documentoselectronicos@*, '
        'electronica@*. En CUALQUIERA de estos casos => tipo DEBE ser factura_sri '
        '(NO consumo, NO descarte). Extrae numero_factura y ruc_emisor del cuerpo '
        '(patron RUC: 13 digitos, patron factura: 001-001-XXXXXXXXX).'
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
                        deferred_purchases = ai_result.get("deferred_purchases", [])
                        tx_count = 0
                        for t in transactions:
                            amount = t.get("amount") or t.get("monto", 0)
                            if not amount or amount == 0:
                                continue
                            tx_doc = {"id": str(uuid.uuid4()), "user_id": user_id, "amount": abs(float(amount)), "description": t.get("description") or t.get("descripcion", ""), "establishment": t.get("establishment") or t.get("comercio", ""), "vendor": t.get("establishment") or t.get("comercio", ""), "date": t.get("date") or t.get("fecha") or fecha, "personal_category": t.get("category") or "otros", "category": t.get("category") or "otros", "source": "gmail_pdf", "gmail_doc_id": doc_id, "status": "pending_review", "created_at": datetime.now(timezone.utc).isoformat()}
                            await db.transactions.insert_one(tx_doc)
                            tx_count += 1
                        # Upsert credit card info (closes the gap where Gmail flow didn't update credit_cards)
                        response_data_stub = {}
                        try:
                            if card_info.get("current_balance") is not None:
                                await _upsert_card_from_statement(user_id, card_info, response_data_stub, raw_text=extracted_text)
                            if deferred_purchases:
                                await _save_deferred_purchases(user_id, deferred_purchases, card_info, response_data_stub, filename)
                        except Exception as e:
                            logger.error(f"Error updating card from Gmail statement: {e}")
                        doc_record["procesado"] = True
                        doc_record["transactions_count"] = tx_count
                        doc_record["card_info"] = card_info
                        doc_record["card_updated"] = response_data_stub.get("card_updated", False)
                        doc_record["deferred_payments_created"] = response_data_stub.get("deferred_payments_created", 0)
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
async def gmail_auth_url(request: Request, user: dict = Depends(get_current_user)):
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Google OAuth2 no configurado")
    redirect_uri = _resolve_redirect_uri(request)
    state = secrets_mod.token_urlsafe(32)
    flow = Flow.from_client_config(
        {"web": {"client_id": GOOGLE_CLIENT_ID, "client_secret": GOOGLE_CLIENT_SECRET, "auth_uri": "https://accounts.google.com/o/oauth2/auth", "token_uri": "https://oauth2.googleapis.com/token", "redirect_uris": [redirect_uri]}},
        scopes=GMAIL_SCOPES, redirect_uri=redirect_uri,
        autogenerate_code_verifier=True
    )
    auth_url, _ = flow.authorization_url(access_type='offline', include_granted_scopes='true', prompt='consent', state=state)
    now = datetime.now(timezone.utc)
    await db.gmail_oauth_states.insert_one({
        "state": state,
        "user_id": user["id"],
        "code_verifier": getattr(flow, "code_verifier", None),
        "redirect_uri": redirect_uri,
        "created_at": now.isoformat(),
        "expires_at": (now + timedelta(minutes=10)).isoformat()
    })
    return {"auth_url": auth_url}


@router.get("/gmail/callback")
async def gmail_callback(code: str, state: str, request: Request):
    state_doc = await db.gmail_oauth_states.find_one({"state": state})
    if not state_doc:
        raise HTTPException(status_code=400, detail="invalid_state")
    expires_at = state_doc.get("expires_at", "")
    if expires_at and datetime.fromisoformat(expires_at) < datetime.now(timezone.utc):
        await db.gmail_oauth_states.delete_one({"state": state})
        raise HTTPException(status_code=400, detail="invalid_state")
    code_verifier = state_doc.get("code_verifier")
    if not code_verifier:
        await db.gmail_oauth_states.delete_one({"state": state})
        raise HTTPException(status_code=400, detail="missing_code_verifier")
    redirect_uri = state_doc.get("redirect_uri") or _resolve_redirect_uri(request)
    await db.gmail_oauth_states.delete_one({"state": state})
    user_id = state_doc["user_id"]
    try:
        flow = Flow.from_client_config(
            {"web": {"client_id": GOOGLE_CLIENT_ID, "client_secret": GOOGLE_CLIENT_SECRET, "auth_uri": "https://accounts.google.com/o/oauth2/auth", "token_uri": "https://oauth2.googleapis.com/token", "redirect_uris": [redirect_uri]}},
            scopes=GMAIL_SCOPES, redirect_uri=redirect_uri
        )
        flow.code_verifier = code_verifier
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
    # Leer ultimo_sync del token para sync incremental. Si no existe, cap a 90 días.
    token_doc = await db.gmail_tokens.find_one({"user_id": user["id"]}, {"_id": 0, "ultimo_sync": 1}) or {}
    ultimo_sync_dt = token_doc.get("ultimo_sync")
    if isinstance(ultimo_sync_dt, str):
        try:
            ultimo_sync_dt = datetime.fromisoformat(ultimo_sync_dt.replace("Z", "+00:00"))
        except Exception:
            ultimo_sync_dt = None
    now = datetime.now(timezone.utc)
    if ultimo_sync_dt:
        # Sync incremental: solo emails desde el último sync
        after_ts = int(ultimo_sync_dt.timestamp())
        max_results = 100
    else:
        # Primer sync: últimos 90 días, máx 100 emails
        after_ts = int((now - timedelta(days=90)).timestamp())
        max_results = 100

    GMAIL_SENDER_FILTER = (
        "from:(servicios@dinersclub.com.ec OR notificaciones@infopacificard.com.ec "
        "OR servicios@tarjetasbancopichincha.com OR Avisos24@bolivariano.com "
        "OR intermail@bancopacifico.ec OR banco@pichincha.com "
        "OR documentoselectronicos@pichincha.com OR estadodecuenta@pacificard.ec "
        "OR estadoscuenta@bancodelpacifico.com.ec "
        "OR email.apple.com OR netflix.com "
        "OR spotify.com OR google.com OR amazon.com OR adobe.com "
        "OR noreply@contifico.com OR noreply@www.contifico.com "
        "OR notifications@degeremcia.com OR noreply@datil.co "
        "OR noreply@sri.gob.ec OR no-reply@sri.gob.ec OR sri.gob.ec "
        "OR facturacion OR facturación OR facturas OR comprobantes OR electronica "
        "OR documentos OR documentoselectronicos) "
        f"after:{after_ts}"
    )
    results = service.users().messages().list(userId='me', q=GMAIL_SENDER_FILTER, maxResults=max_results).execute()
    messages = results.get('messages', [])
    if not messages:
        await db.gmail_tokens.update_one({"user_id": user["id"]}, {"$set": {"ultimo_sync": now.isoformat()}})
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
        # Extract body early for factura detection (full text, not just snippet)
        full_text_body = extract_text_body(msg) or body_snippet
        is_factura_subject = _is_factura_electronica(subject, full_text_body)
        sender_lower = sender.lower()
        INVOICE_SENDERS = ["contifico.com", "degeremcia.com", "datil.co", "sri.gob.ec", "facturacion@", "facturación@", "facturas@", "comprobantes@", "documentos@", "documentoselectronicos@", "electronica@"]
        is_invoice_sender = any(s in sender_lower for s in INVOICE_SENDERS)
        is_bank_email = any(domain in sender_lower for domain in BANK_DOMAINS) or any(addr in sender_lower for addr in BANK_SENDERS)
        is_service_email = any(domain in sender_lower for domain in SERVICE_DOMAINS)

        if not is_bank_email and not is_factura_subject and not is_service_email and not is_invoice_sender:
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
        text_body = full_text_body

        # SHORTCUT: If factura detected by keywords (subject/body) or invoice sender,
        # classify directly as factura_sri without calling GPT.
        if (is_factura_subject or is_invoice_sender) and not is_bank_email:
            # Extract numero_factura and ruc_emisor with regex
            numero_match = re.search(r'(\d{3}-\d{3}-\d{6,9})', text_body or "")
            ruc_match = re.search(r'\b(\d{13})\b', text_body or "")
            numero_factura = numero_match.group(1) if numero_match else None
            ruc_emisor = ruc_match.group(1) if ruc_match else None

            pdf_result = await _download_gmail_pdf_attachment(
                service, gmail_id, user["id"],
                tipo="factura_sri",
                banco=sender.split("@")[-1].split(".")[0] if "@" in sender else "desconocido",
                fecha=date_str,
                numero_factura=numero_factura,
            )
            doc = {
                "user_id": user["id"], "gmail_id": gmail_id, "remitente": sender,
                "subject": subject, "fecha_email": date_str,
                "tipo": "factura_sri",
                "monto": None, "comercio": None, "fecha_transaccion": None,
                "tarjeta_ultimos4": None, "banco": None,
                "descripcion_corta": subject[:60],
                "nivel_urgencia": "ninguna",
                "estado": "pendiente",
                "personal_category": None, "sri_category": None,
                "numero_factura": numero_factura, "ruc_emisor": ruc_emisor,
                "es_deducible": True,
                "es_suscripcion": False, "proxima_renovacion": None,
                "parsed_by": "factura_shortcut",
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
        force_type = "factura_sri" if (is_factura_subject or is_invoice_sender) else None
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
        # Auto-aprobación recurrentes (SESIÓN 13 Task 2): comercio en known_vendors con times_used >= 3
        auto_ok = False
        if tipo == "consumo" and classification.get("comercio"):
            try:
                vendor_row = await db.known_vendors.find_one(
                    {"user_id": user["id"], "establishment": {"$regex": f"^{re.escape(classification['comercio'].strip())}$", "$options": "i"}},
                    {"_id": 0}
                )
                if vendor_row and (vendor_row.get("times_used") or 0) >= 3:
                    doc["estado"] = "auto_aprobado"
                    doc["auto_aprobado"] = True
                    auto_ok = True
            except Exception as e:
                logger.warning(f"auto-approve check failed for {gmail_id}: {e}")
        await db.gmail_transactions.insert_one(doc)
        if auto_ok:
            try:
                doc_clean = {k: v for k, v in doc.items() if k != "_id"}
                await _approve_and_insert(user, doc_clean)
            except Exception as e:
                logger.warning(f"auto-approve insert failed for {gmail_id}: {e}")
        doc.pop("_id", None)
        nuevos.append(doc)
        procesados += 1

    await db.gmail_tokens.update_one({"user_id": user["id"]}, {"$set": {"ultimo_sync": now.isoformat()}})
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
    result = await _approve_and_insert(user, gmail_tx)
    return {"status": "success", "transaction_id": result["transaction_id"], "action": result["action"]}


class _BulkApprovePayload(dict):
    pass


@router.post("/gmail/transactions/bulk-approve")
async def bulk_approve_gmail_transactions(payload: dict, user: dict = Depends(get_current_user)):
    gmail_ids: List[str] = payload.get("gmail_ids") or []
    if not gmail_ids:
        raise HTTPException(status_code=400, detail="gmail_ids requerido")
    approved = 0
    errors = []
    categorias_usadas = {}
    for gid in gmail_ids:
        gmail_tx = await db.gmail_transactions.find_one({"gmail_id": gid, "user_id": user["id"], "estado": "pendiente"}, {"_id": 0})
        if not gmail_tx:
            errors.append({"gmail_id": gid, "reason": "no_encontrada_o_ya_aprobada"})
            continue
        try:
            r = await _approve_and_insert(user, gmail_tx)
            approved += 1
            cat = r.get("budget_category", "otros")
            categorias_usadas[cat] = categorias_usadas.get(cat, 0) + 1
        except Exception as e:
            logger.warning(f"bulk approve failed for {gid}: {e}")
            errors.append({"gmail_id": gid, "reason": str(e)})
    return {
        "status": "success",
        "approved": approved,
        "errors": errors,
        "categorias_usadas": categorias_usadas,
        "message": f"{approved} transacciones aprobadas y categorizadas"
    }


async def _resolve_budget_category(user_id: str, establishment: str, description: str, personal_category: Optional[str]) -> dict:
    """Resuelve (budget_category, subcategory) usando:
    1) known_vendors con SequenceMatcher ≥ 0.85
    2) categorization_rules del usuario (+ defaults)
    3) fallback: personal_category si no es 'otros', sino 'otros'
    """
    establishment = (establishment or "").strip()
    description = (description or "").strip()

    # 1) known_vendors con SequenceMatcher ≥ 0.85
    if establishment:
        all_vendors = await db.known_vendors.find({"user_id": user_id}, {"_id": 0}).to_list(500)
        est_lower = establishment.lower()
        best = None
        best_ratio = 0.0
        for v in all_vendors:
            candidates = [v.get("establishment", "")] + (v.get("aliases") or [])
            for name in candidates:
                if not name:
                    continue
                ratio = SequenceMatcher(None, est_lower, name.lower()).ratio()
                if ratio > best_ratio:
                    best_ratio = ratio
                    best = v
        if best and best_ratio >= 0.85 and best.get("personal_category"):
            return {
                "budget_category": best.get("personal_category"),
                "subcategory": best.get("subcategory") or "General",
                "is_deductible": best.get("is_deductible", False),
                "sri_category": best.get("sri_category"),
                "source": f"known_vendor_{int(best_ratio*100)}%",
            }

    # 2) categorization_rules (custom del usuario + defaults via apply_categorization_rules)
    custom_rules = await db.categorization_rules.find(
        {"user_id": user_id, "is_active": True}, {"_id": 0}
    ).to_list(100)
    text = f"{description} {establishment}".lower()
    for rule in custom_rules:
        for kw in rule.get("keywords", []):
            if kw and kw.lower() in text:
                return {
                    "budget_category": rule.get("category"),
                    "subcategory": rule.get("subcategory") or "General",
                    "is_deductible": False,
                    "sri_category": None,
                    "source": "custom_rule",
                }
    default_match = apply_categorization_rules(description, establishment)
    if default_match.get("category"):
        return {
            "budget_category": default_match["category"],
            "subcategory": default_match.get("subcategory") or "General",
            "is_deductible": False,
            "sri_category": None,
            "source": "default_rule",
        }

    # 3) fallback: personal_category si tiene valor útil
    if personal_category and personal_category != "otros":
        return {
            "budget_category": personal_category,
            "subcategory": "General",
            "is_deductible": False,
            "sri_category": None,
            "source": "personal_category_fallback",
        }
    return {
        "budget_category": "otros",
        "subcategory": "General",
        "is_deductible": False,
        "sri_category": None,
        "source": "none",
    }


async def _approve_and_insert(user: dict, gmail_tx: dict) -> dict:
    """Lógica compartida: inserta tx aprobada con categoría resuelta (+hooks SRI)."""
    personal_category = gmail_tx.get("personal_category") or "otros"
    resolved = await _resolve_budget_category(
        user["id"],
        gmail_tx.get("comercio", "") or "",
        gmail_tx.get("descripcion_corta", "") or "",
        personal_category,
    )
    budget_cat = resolved["budget_category"] or "otros"
    # Mantener consistencia: category = budget_category
    effective_category = budget_cat
    sri_cat = gmail_tx.get("sri_category") or resolved.get("sri_category")
    is_deductible_flag = bool(gmail_tx.get("es_deducible")) or bool(resolved.get("is_deductible"))

    tx_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "amount": gmail_tx.get("monto") or 0,
        "description": gmail_tx.get("descripcion_corta", ""),
        "establishment": gmail_tx.get("comercio", ""),
        "vendor": gmail_tx.get("comercio", ""),
        "date": gmail_tx.get("fecha_transaccion") or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "personal_category": effective_category,
        "category": effective_category,
        "budget_category": budget_cat,
        "subcategory": resolved.get("subcategory") or "General",
        "sri_category": sri_cat,
        "source": "gmail",
        "status": "approved",
        "tarjeta_ultimos4": gmail_tx.get("tarjeta_ultimos4"),
        "transaction_type": "expense",
        "numero_factura": gmail_tx.get("numero_factura"),
        "ruc_emisor": gmail_tx.get("ruc_emisor"),
        "source_type": "invoice" if gmail_tx.get("tipo") == "factura_sri" else "email",
        "has_invoice": gmail_tx.get("tipo") == "factura_sri",
        "is_deductible": is_deductible_flag,
        "auto_categorized": True,
        "matched_rule": resolved.get("source"),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = await dedup_or_merge(user["id"], tx_doc, "email_banco")
    await db.gmail_transactions.update_one(
        {"gmail_id": gmail_tx["gmail_id"], "user_id": user["id"]},
        {"$set": {"estado": "aprobado", "budget_category_asignada": budget_cat}},
    )
    # SRI match attempt + retry pendings
    try:
        from routes.sri_match import try_sri_match, retry_pending_matches
        await try_sri_match(user["id"], result["transaction_id"])
        await retry_pending_matches(user["id"])
    except Exception as e:
        logger.warning(f"SRI match hook failed: {e}")
    return {
        "transaction_id": result["transaction_id"],
        "action": result["action"],
        "budget_category": budget_cat,
        "match_source": resolved.get("source"),
    }


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


async def _parse_factura_pdf(filepath: str, remitente: str = "") -> dict:
    """Extrae datos estructurados de una factura electrónica ecuatoriana (PDF)."""
    text = extract_text_from_pdf(filepath) or ""
    if len(text) < 20:
        return {"ok": False, "error": "PDF sin texto extraíble"}
    # Regex extraction (fast, no AI)
    numero = None
    m = re.search(r"(\d{3}-\d{3}-\d{6,9})", text)
    if m:
        numero = m.group(1)
    ruc = None
    m2 = re.search(r"\b(\d{13})\b", text)
    if m2:
        ruc = m2.group(1)
    emisor = None
    m3 = re.search(r"(?:raz[oó]n\s*social|nombre\s*comercial|emisor)[:\s]*([A-Z0-9 &.,ÑÁÉÍÓÚ-]{5,80})", text, re.IGNORECASE)
    if m3:
        emisor = m3.group(1).strip()[:80]

    # Fallback: escanear primeras 15 líneas para una razón social sin encabezado explícito
    if not emisor:
        lines = [ln.strip() for ln in text.splitlines() if ln.strip()][:15]
        for ln in lines:
            # descartar líneas inválidas
            if re.fullmatch(r"[\d\s.,/-]+", ln):  # solo números/fechas
                continue
            if re.search(r"\bRUC\b", ln, re.IGNORECASE):
                continue
            if re.search(r"^(Direcci[oó]n|Calle|Av(\.|enida)|Km\.|Tel[eé]fono|Email|Correo)", ln, re.IGNORECASE):
                continue
            words = ln.split()
            if len(words) < 3:
                continue
            upper_words = sum(1 for w in words if w[:1].isupper())
            if upper_words >= len(words) * 0.6:
                emisor = ln[:80]
                break

    # Fallback final: usar remitente del email si seguimos sin emisor
    if not emisor and remitente:
        # "Juan Perez <facturas@empresa.com>" -> "Juan Perez"
        cleaned = re.sub(r"<[^>]*>", "", remitente).strip()
        cleaned = re.sub(r"\b[\w.+-]+@[\w.-]+\b", "", cleaned).strip()
        cleaned = cleaned.strip(" -,.\"'")
        if cleaned:
            emisor = cleaned[:80]
        else:
            # si solo había email, extraer el dominio
            dom = re.search(r"@([\w.-]+)", remitente)
            if dom:
                emisor = dom.group(1).split(".")[0][:80]

    monto = None
    for pat in [
        r"VALOR\s*TOTAL[^\d]{0,20}(\d{1,6}(?:[.,]\d{2}))",
        r"TOTAL\s*A\s*PAGAR[^\d]{0,20}(\d{1,6}(?:[.,]\d{2}))",
        r"IMPORTE\s*TOTAL[^\d]{0,20}(\d{1,6}(?:[.,]\d{2}))",
        r"IMPORTE[^\d]{0,20}(\d{1,6}(?:[.,]\d{2}))",
        r"VALOR[^\d]{0,20}(\d{1,6}(?:[.,]\d{2}))",
        r"Total\s*:\s*\$?\s*(\d{1,6}(?:[.,]\d{2}))",
        r"TOTAL\s*:\s*\$?\s*(\d{1,6}(?:[.,]\d{2}))",
    ]:
        mm = re.search(pat, text, re.IGNORECASE)
        if mm:
            try:
                monto = float(mm.group(1).replace(",", "."))
                break
            except Exception:
                pass
    fecha = None
    mf = re.search(r"fecha\s*(?:de\s*)?emisi[oó]n[:\s]*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})", text, re.IGNORECASE)
    if mf:
        fecha = mf.group(1)
    return {"ok": True, "numero_factura": numero, "ruc_emisor": ruc, "emisor": emisor, "monto": monto, "fecha": fecha, "text_length": len(text)}


@router.post("/gmail/process-factura-pdfs")
async def process_factura_pdfs(user: dict = Depends(get_current_user)):
    """Procesa PDFs de facturas SRI aún no parseados — extrae número, RUC, emisor, monto, fecha.
    Luego crea la transacción factura en `transactions` (si no existe) y ejecuta try_sri_match
    para vincularla con un consumo de tarjeta/débito."""
    docs = await db.gmail_documents.find({"user_id": user["id"], "tipo": "factura_sri"}, {"_id": 0}).to_list(100)
    processed = 0
    skipped = 0
    errors = 0
    match_stats = {"con_respaldo": 0, "match_aproximado": 0, "pendiente_match": 0, "skipped_no_amount": 0}
    results = []
    for d in docs:
        filepath = d.get("filepath")
        if not filepath or not os.path.exists(filepath):
            skipped += 1
            continue
        try:
            # Buscar remitente en gmail_transactions correspondiente (fallback para emisor)
            gm_id = d.get("gmail_id")
            remitente = ""
            if gm_id:
                gm_tx = await db.gmail_transactions.find_one({"gmail_id": gm_id, "user_id": user["id"]}, {"_id": 0, "remitente": 1, "sender": 1, "from": 1})
                if gm_tx:
                    remitente = gm_tx.get("remitente") or gm_tx.get("sender") or gm_tx.get("from") or ""
            data = await _parse_factura_pdf(filepath, remitente=remitente)
            if not data.get("ok"):
                errors += 1
                continue
            update = {"procesado": True}
            for k in ("numero_factura", "ruc_emisor", "monto", "fecha"):
                if data.get(k) is not None:
                    update[k] = data[k]
            if data.get("emisor"):
                update["emisor"] = data["emisor"]
                update["nombre_emisor"] = data["emisor"]
            await db.gmail_documents.update_one({"id": d["id"]}, {"$set": update})
            gm_id = d.get("gmail_id")
            if gm_id:
                tx_update = {k: v for k, v in update.items() if k in ("numero_factura", "ruc_emisor", "monto", "emisor") and v is not None}
                if tx_update:
                    await db.gmail_transactions.update_one({"gmail_id": gm_id, "user_id": user["id"]}, {"$set": tx_update})

            # Insert into `transactions` as invoice + run SRI matcher
            monto = data.get("monto")
            fecha_raw = data.get("fecha") or d.get("fecha") or d.get("fecha_email", "")[:10]
            # Normalize fecha to YYYY-MM-DD
            fecha_iso = None
            if fecha_raw:
                for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d/%m/%y", "%d-%m-%y"):
                    try:
                        fecha_iso = datetime.strptime(fecha_raw[:10], fmt).strftime("%Y-%m-%d")
                        break
                    except Exception:
                        continue
            numero = data.get("numero_factura")
            if monto and fecha_iso and numero:
                existing_tx = await db.transactions.find_one({"user_id": user["id"], "numero_factura": numero, "transaction_type": "expense"}, {"_id": 0, "id": 1})
                if existing_tx:
                    tx_id = existing_tx["id"]
                else:
                    tx_id = str(uuid.uuid4())
                    tx_doc = {
                        "id": tx_id, "user_id": user["id"],
                        "amount": float(monto), "date": fecha_iso,
                        "description": data.get("emisor") or d.get("remitente", "Factura"),
                        "establishment": data.get("emisor") or "", "vendor": data.get("emisor") or "",
                        "transaction_type": "expense",
                        "category": "otros", "personal_category": "otros",
                        "source": "gmail_factura_pdf", "source_type": "invoice",
                        "has_invoice": True,
                        "numero_factura": numero, "ruc_emisor": data.get("ruc_emisor"),
                        "gmail_doc_id": d["id"],
                        "status": "pending_review",
                        "estado_sri": None,
                        "created_at": datetime.now(timezone.utc).isoformat(),
                    }
                    await db.transactions.insert_one(tx_doc)
                match_res = await try_sri_match(user["id"], tx_id)
                match_stats[match_res.get("status", "pendiente_match")] = match_stats.get(match_res.get("status"), 0) + 1
            else:
                match_stats["skipped_no_amount"] += 1

            processed += 1
            results.append({"id": d["id"], "filename": d.get("filename"), **{k: data.get(k) for k in ("numero_factura", "ruc_emisor", "emisor", "monto", "fecha")}})
        except Exception as e:
            logger.error(f"Error processing factura PDF {d.get('id')}: {e}")
            errors += 1
    return {"status": "success", "total": len(docs), "processed": processed, "skipped": skipped, "errors": errors, "match_stats": match_stats, "results": results}


@router.get("/gmail/facturas-summary")
async def gmail_facturas_summary(user: dict = Depends(get_current_user)):
    """Resumen de facturas SRI en gmail_documents, con estado de procesamiento."""
    pipeline = [
        {"$match": {"user_id": user["id"], "tipo": "factura_sri"}},
        {"$sort": {"created_at": -1}},
    ]
    docs = []
    async for d in db.gmail_documents.aggregate(pipeline):
        d.pop("_id", None)
        docs.append(d)
    unprocessed = sum(1 for d in docs if not d.get("procesado") or not d.get("numero_factura"))
    return {"total": len(docs), "unprocessed": unprocessed, "documents": docs}


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


# ================= CRON job: sync Gmail cada 6h =================
from apscheduler.schedulers.asyncio import AsyncIOScheduler

_gmail_scheduler: Optional[AsyncIOScheduler] = None


async def _cron_gmail_sync_all():
    """Corre sync_gmail para cada usuario con gmail_tokens activos.
    - Si el token expiró o falla refresh: loguea y continúa
    - Nunca interrumpe el job por errores individuales
    """
    try:
        tokens = await db.gmail_tokens.find({}, {"_id": 0, "user_id": 1}).to_list(1000)
        logger.info(f"CRON gmail: {len(tokens)} usuarios a sincronizar")
        for t in tokens:
            uid = t.get("user_id")
            if not uid:
                continue
            try:
                creds = await _get_gmail_credentials(uid)
                service = build('gmail', 'v1', credentials=creds)
                token_doc = await db.gmail_tokens.find_one({"user_id": uid}, {"_id": 0, "ultimo_sync": 1}) or {}
                ultimo = token_doc.get("ultimo_sync")
                if isinstance(ultimo, str):
                    try:
                        ultimo = datetime.fromisoformat(ultimo.replace("Z", "+00:00"))
                    except Exception:
                        ultimo = None
                now_cron = datetime.now(timezone.utc)
                after_ts = int(ultimo.timestamp()) if ultimo else int((now_cron - timedelta(days=90)).timestamp())
                q = (
                    "from:(servicios@dinersclub.com.ec OR notificaciones@infopacificard.com.ec "
                    "OR servicios@tarjetasbancopichincha.com OR Avisos24@bolivariano.com "
                    "OR intermail@bancopacifico.ec OR banco@pichincha.com "
                    "OR documentoselectronicos@pichincha.com OR estadodecuenta@pacificard.ec "
                    "OR estadoscuenta@bancodelpacifico.com.ec OR email.apple.com OR netflix.com "
                    "OR spotify.com OR google.com OR amazon.com OR adobe.com) "
                    f"after:{after_ts}"
                )
                res = service.users().messages().list(userId='me', q=q, maxResults=100).execute()
                msgs = res.get('messages', []) or []
                logger.info(f"CRON gmail user={uid}: {len(msgs)} emails nuevos detectados")
                # Reutiliza el pipeline de gmail_sync pero sin HTTP: delega al endpoint
                # Para mantener el código mínimo, sólo actualizamos ultimo_sync; el user
                # verá los pendientes al abrir la Bandeja y presionar Sincronizar manual
                # si se requiere procesar ahora, se invoca gmail_sync via fake user dict.
                user_doc = await db.users.find_one({"id": uid}, {"_id": 0})
                if user_doc:
                    try:
                        await gmail_sync(user_doc)
                    except Exception as e2:
                        logger.warning(f"CRON gmail user={uid}: sync failed: {e2}")
                await db.gmail_tokens.update_one({"user_id": uid}, {"$set": {"ultimo_sync": now_cron.isoformat()}})
            except HTTPException as he:
                if he.status_code in (401, 403, 404):
                    logger.warning(f"CRON: usuario {uid} token expirado, skipped")
                else:
                    logger.warning(f"CRON gmail user={uid}: HTTP {he.status_code} - {he.detail}")
            except Exception as e:
                logger.warning(f"CRON gmail user={uid}: {type(e).__name__} - {e}")
    except Exception as e:
        logger.error(f"CRON gmail top-level error: {e}")


def start_gmail_cron():
    """Inicia el scheduler una sola vez (idempotente)."""
    global _gmail_scheduler
    if _gmail_scheduler and _gmail_scheduler.running:
        return _gmail_scheduler
    _gmail_scheduler = AsyncIOScheduler(timezone="UTC")
    _gmail_scheduler.add_job(_cron_gmail_sync_all, "interval", hours=6, id="gmail_sync_all", replace_existing=True)
    _gmail_scheduler.start()
    logger.info("CRON gmail scheduler iniciado (cada 6h)")
    return _gmail_scheduler

