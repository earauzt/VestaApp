from fastapi import HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from pathlib import Path
from emergentintegrations.llm.chat import LlmChat, UserMessage, FileContentWithMimeType
import os
import re
import json
import uuid
import hashlib
import logging
import pdfplumber

from database import db
from models import TransactionStatus, SRI_CATEGORIES

ROOT_DIR = Path(__file__).parent
UPLOADS_DIR = ROOT_DIR / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)

logger = logging.getLogger(__name__)

# JWT Settings
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'default_secret_key')
ALGORITHM = os.environ.get('JWT_ALGORITHM', 'HS256')
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get('ACCESS_TOKEN_EXPIRE_MINUTES', 1440))
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

# Google OAuth2 / Gmail
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID')
GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET')
GOOGLE_REDIRECT_URI = os.environ.get('GOOGLE_REDIRECT_URI')

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=False)


# ================= AUTH HELPERS =================

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(request: Request, credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = None

    # 1) Try httpOnly cookie
    token = request.cookies.get("access_token")

    # 2) Fall back to Authorization header
    if not token and credentials:
        token = credentials.credentials

    if not token:
        raise HTTPException(status_code=401, detail="No autenticado", headers={"WWW-Authenticate": "Bearer"})

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Token invalido", headers={"WWW-Authenticate": "Bearer"})
    except JWTError:
        raise HTTPException(status_code=401, detail="Token invalido", headers={"WWW-Authenticate": "Bearer"})

    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if user is None:
        raise HTTPException(status_code=401, detail="Usuario no encontrado", headers={"WWW-Authenticate": "Bearer"})
    return user

def check_role(allowed_roles: List[str]):
    async def role_checker(user: dict = Depends(get_current_user)):
        if user["role"] not in allowed_roles:
            raise HTTPException(status_code=403, detail="Acceso denegado")
        return user
    return role_checker


# ================= VENDOR HELPERS =================

async def find_potential_duplicates(user_id: str, amount: float, date: str, establishment: str = None, description: str = None):
    date_obj = datetime.strptime(date, "%Y-%m-%d")
    date_start = (date_obj - timedelta(days=7)).strftime("%Y-%m-%d")
    date_end = (date_obj + timedelta(days=7)).strftime("%Y-%m-%d")

    query = {
        "user_id": user_id,
        "amount": {"$gte": amount * 0.95, "$lte": amount * 1.05},
        "date": {"$gte": date_start, "$lte": date_end},
        "status": {"$nin": [TransactionStatus.DUPLICATE_CONFIRMED, TransactionStatus.REJECTED]}
    }

    potential_duplicates = await db.transactions.find(query, {"_id": 0}).to_list(10)

    duplicates = []
    for t in potential_duplicates:
        confidence = 50
        if establishment and t.get("establishment"):
            if establishment.lower() in t["establishment"].lower() or t["establishment"].lower() in establishment.lower():
                confidence += 30
        if description and t.get("description"):
            words1 = set(description.lower().split())
            words2 = set(t["description"].lower().split())
            common_words = words1.intersection(words2)
            if len(common_words) >= 2:
                confidence += 20
        if t.get("amount") == amount:
            confidence += 10
        if confidence >= 60:
            duplicates.append({"transaction": t, "confidence": min(confidence, 100)})

    return duplicates


# Source priority: higher number = more authoritative
SOURCE_PRIORITY = {"manual": 0, "email_banco": 1, "estado_cuenta": 2, "bank_statement": 2, "factura_sri": 3, "gmail_pdf": 2}


def compute_fingerprint(user_id: str, card_last: str, amount: float, date: str) -> str:
    """SHA-256 fingerprint for cross-channel deduplication."""
    date_only = date[:10] if date else ""
    raw = f"{user_id}|{card_last or ''}|{round(amount, 2)}|{date_only}"
    return hashlib.sha256(raw.encode()).hexdigest()


async def dedup_or_merge(user_id: str, doc: dict, source_label: str) -> dict:
    """Check if a matching transaction exists. If yes, merge sources. If no, insert.
    Returns {"action": "merged"|"inserted", "transaction_id": str, "doc": dict}
    """
    amount = doc.get("amount", 0)
    date = doc.get("date", "")
    card_last = doc.get("tarjeta_ultimos4") or doc.get("card_last_digits") or ""

    # Compute and store fingerprint
    fp = compute_fingerprint(user_id, card_last, amount, date)
    doc["fingerprint"] = fp
    if "fuentes" not in doc:
        doc["fuentes"] = []
    if source_label not in doc["fuentes"]:
        doc["fuentes"].append(source_label)

    # 1. Exact fingerprint match
    existing = await db.transactions.find_one({"user_id": user_id, "fingerprint": fp}, {"_id": 0})

    # 2. Fuzzy match: same card + amount ±1% + date ±2 days
    if not existing and card_last and amount > 0 and date:
        try:
            date_obj = datetime.strptime(date[:10], "%Y-%m-%d")
            date_start = (date_obj - timedelta(days=2)).strftime("%Y-%m-%d")
            date_end = (date_obj + timedelta(days=2)).strftime("%Y-%m-%d")
            existing = await db.transactions.find_one({
                "user_id": user_id,
                "tarjeta_ultimos4": card_last,
                "amount": {"$gte": amount * 0.99, "$lte": amount * 1.01},
                "date": {"$gte": date_start, "$lte": date_end},
            }, {"_id": 0})
        except Exception:
            pass

    if existing:
        # Merge: add source, upgrade fields if new source has higher priority
        update = {}
        existing_fuentes = existing.get("fuentes", [])
        if source_label not in existing_fuentes:
            existing_fuentes.append(source_label)
            update["fuentes"] = existing_fuentes

        new_priority = SOURCE_PRIORITY.get(source_label, 0)
        old_source = existing.get("fuentes", ["manual"])[0] if existing.get("fuentes") else "manual"
        old_priority = SOURCE_PRIORITY.get(old_source, 0)

        if new_priority > old_priority:
            # Upgrade fields from higher-priority source
            for field in ["comercio", "establishment", "description", "category", "sri_category", "subcategory", "is_deductible", "numero_factura", "ruc_emisor"]:
                if doc.get(field) and doc[field] != existing.get(field):
                    update[field] = doc[field]

        if not existing.get("fingerprint"):
            update["fingerprint"] = fp
        update["is_cross_canal_dup"] = True

        if update:
            await db.transactions.update_one({"id": existing["id"]}, {"$set": update})

        return {"action": "merged", "transaction_id": existing["id"], "doc": existing}

    # No match — insert new
    await db.transactions.insert_one(doc)
    return {"action": "inserted", "transaction_id": doc.get("id"), "doc": doc}



async def lookup_known_vendor(user_id: str, establishment: str, description: str = "") -> dict:
    if not establishment and not description:
        return {"found": False}

    search_text = (establishment or description).strip()
    search_lower = search_text.lower()

    # Strategy 1: Exact match
    vendor = await db.known_vendors.find_one({
        "user_id": user_id,
        "establishment": {"$regex": f"^{re.escape(search_lower)}$", "$options": "i"}
    }, {"_id": 0})
    if vendor:
        await _update_vendor_usage(vendor["id"])
        return _format_vendor_result(vendor, "exact")

    # Strategy 1.5: Alias match
    vendor = await db.known_vendors.find_one({
        "user_id": user_id,
        "aliases": {"$regex": f"^{re.escape(search_lower)}$", "$options": "i"}
    }, {"_id": 0})
    if vendor:
        await _update_vendor_usage(vendor["id"])
        return _format_vendor_result(vendor, "alias")

    # Strategy 2: Partial match
    vendor = await db.known_vendors.find_one({
        "user_id": user_id,
        "$or": [{"establishment": {"$regex": re.escape(search_lower), "$options": "i"}}]
    }, {"_id": 0})
    if vendor:
        await _update_vendor_usage(vendor["id"])
        return _format_vendor_result(vendor, "partial")

    # Strategy 3: Word-based matching
    stop_words = {"de", "la", "el", "los", "las", "y", "en", "sa", "cia", "ltda", "inc", "ec", "com"}
    search_words = set(search_lower.split()) - stop_words

    if search_words:
        all_vendors = await db.known_vendors.find({"user_id": user_id}, {"_id": 0}).to_list(500)
        best_match = None
        best_score = 0

        for v in all_vendors:
            vendor_lower = v.get("establishment", "").lower()
            all_names = [vendor_lower] + [a.lower() for a in v.get("aliases", [])]
            best_vendor_score = 0
            for name_variant in all_names:
                variant_words = set(name_variant.split()) - stop_words
                common_words = search_words & variant_words
                if common_words:
                    score = len(common_words) / max(len(search_words), len(variant_words))
                    if search_lower.startswith(name_variant[:5]) or name_variant.startswith(search_lower[:5]):
                        score += 0.3
                    best_vendor_score = max(best_vendor_score, score)
            if best_vendor_score > best_score and best_vendor_score >= 0.4:
                best_score = best_vendor_score
                best_match = v

        if best_match:
            await _update_vendor_usage(best_match["id"])
            return _format_vendor_result(best_match, f"word_match_{int(best_score*100)}%")

    # Strategy 4: Try with description
    if description and description != establishment:
        desc_lower = description.strip().lower()
        vendor = await db.known_vendors.find_one({
            "user_id": user_id,
            "establishment": {"$regex": re.escape(desc_lower[:20]), "$options": "i"}
        }, {"_id": 0})
        if vendor:
            await _update_vendor_usage(vendor["id"])
            return _format_vendor_result(vendor, "description")

    return {"found": False}


async def _update_vendor_usage(vendor_id: str):
    await db.known_vendors.update_one(
        {"id": vendor_id},
        {"$set": {"last_used": datetime.now(timezone.utc).isoformat()}, "$inc": {"times_used": 1}}
    )


def _format_vendor_result(vendor: dict, match_type: str) -> dict:
    return {
        "found": True,
        "match_type": match_type,
        "personal_category": vendor.get("personal_category"),
        "sri_category": vendor.get("sri_category"),
        "subcategory": vendor.get("subcategory"),
        "is_deductible": vendor.get("is_deductible", False),
        "vendor_name": vendor.get("establishment")
    }


# ================= SRI HELPERS =================

def generate_sri_alerts(category_progress, total_deductible, limite_global):
    alerts = []
    if total_deductible >= limite_global * 0.9:
        alerts.append({"type": "warning", "message": f"Has usado el 90% de tu limite global de deducciones (${limite_global:,.2f})"})
    for cat in category_progress:
        if cat["percentage"] >= 100:
            alerts.append({"type": "error", "message": f"LIMITE EXCEDIDO en {cat['name']}: ${cat['spent']:,.2f} de ${cat['limit']:,.2f}"})
        elif cat["percentage"] >= 80:
            alerts.append({"type": "warning", "message": f"{cat['name']}: {cat['percentage']}% del limite usado. Quedan ${cat['remaining']:,.2f}"})
    return alerts


# ================= AI HELPERS =================

async def classify_with_ai(text: str, context: str = "expense") -> dict:
    if not EMERGENT_LLM_KEY:
        return {"category": "otros", "subcategory": "Varios", "amount": 0, "description": text}
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"classify_{uuid.uuid4()}",
            system_message="""Eres un asistente financiero experto en leyes tributarias de Ecuador.
            Clasifica las transacciones en las siguientes categorias del SRI:
            - alimentacion: Comida, Restaurantes, Supermercado
            - salud: Seguros, Medicina, Consultas
            - educacion: Colegio y actividades, Cursos, Materiales
            - vivienda: Servicios basicos, Arriendo, Mantenimiento
            - vestimenta: Ropa, Calzado, Accesorios
            - transporte: Carros, Combustible, Mantenimiento vehicular
            - otros: Empleados, Viajes y Entretenimiento, Varios

            Responde SOLO en formato JSON: {"category": "...", "subcategory": "...", "amount": numero, "description": "...", "establishment": "..."}"""
        ).with_model("openai", "gpt-5.2")
        response = await chat.send_message(UserMessage(text=f"Clasifica esta transaccion: {text}"))
        json_match = re.search(r'\{[^}]+\}', response)
        if json_match:
            return json.loads(json_match.group())
        return {"category": "otros", "subcategory": "Varios", "amount": 0, "description": text}
    except Exception as e:
        logger.error(f"AI classification error: {e}")
        return {"category": "otros", "subcategory": "Varios", "amount": 0, "description": text}


async def process_image_with_ai(file_path: str, document_type: str = "receipt") -> dict:
    if not EMERGENT_LLM_KEY:
        return {"error": "API key not configured"}
    try:
        ext = os.path.splitext(file_path)[1].lower()
        if ext == ".pdf" and document_type == "bank_statement":
            logger.info(f"Processing bank statement PDF: {file_path}")
            extracted_text = extract_text_from_pdf(file_path)
            if extracted_text and len(extracted_text) > 500:
                logger.info(f"Using text-based processing. Extracted {len(extracted_text)} characters")
                return await process_bank_statement_text(extracted_text)
            else:
                logger.info("PDF appears to be image-based (scanned). Using Gemini vision for OCR.")

        if ext == ".pdf":
            mime_type = "application/pdf"
        elif ext in [".png"]:
            mime_type = "image/png"
        elif ext in [".jpg", ".jpeg"]:
            mime_type = "image/jpeg"
        else:
            mime_type = "image/jpeg"

        if document_type == "bank_statement":
            system_prompt = """Eres un experto en OCR y analisis de estados de cuenta bancarios de Ecuador.
Este documento puede ser un PDF escaneado o imagen de un estado de cuenta de Pacificard, Pichincha, Diners, Produbanco o Guayaquil.

EXTRAE TODA la informacion del estado de cuenta en formato JSON VALIDO.

INSTRUCCIONES ESPECIFICAS PARA PACIFICARD:
- "Deuda Total a la fecha corte" o "Valor Monetario USS" = current_balance
- "Total a pagar de contado" o "PAGO SUGERIDO" = suggested_payment
- "Minimo a pagar" = minimum_payment
- "Fecha maximo de pago sin recargos" = due_date
- "Cupo Autorizado" = credit_limit
- "Disponible" = available_credit
- "Tasa de interes efectiva anual" = apr
- "Saldo Diferido Actual" = deferred_balance
- "Saldo Rotativo Actual" = rotative_balance
- Buscar numero de tarjeta formato XXXX-XXXX-XXXX-XXXX o ultimos 4 digitos
- Buscar "BLACK", "PLATINUM", "GOLD" para tipo de tarjeta

FORMATO JSON REQUERIDO:
{
  "card_info": {
    "bank_name": "Pacificard",
    "card_name": "Black/Platinum/Gold/etc",
    "card_number_last4": "ultimos 4 digitos",
    "statement_date": "YYYY-MM-DD",
    "due_date": "YYYY-MM-DD",
    "credit_limit": numero,
    "available_credit": numero,
    "current_balance": numero,
    "minimum_payment": numero,
    "suggested_payment": numero,
    "apr": numero,
    "previous_balance": numero,
    "deferred_balance": numero,
    "rotative_balance": numero
  },
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "descripcion del consumo",
      "amount": numero positivo,
      "establishment": "nombre comercio",
      "category": "alimentacion|salud|educacion|vivienda|vestimenta|suscripciones|turismo|transporte|entretenimiento|otros",
      "is_international": false,
      "is_subscription": false,
      "is_fee": false
    }
  ],
  "deferred_purchases": [
    {
      "description": "descripcion de compra diferida",
      "total_amount": numero,
      "monthly_payment": numero,
      "current_installment": numero,
      "remaining_installments": numero,
      "total_installments": numero
    }
  ]
}

CATEGORIZACION AUTOMATICA:
- SUPERMAXI, MEGAMAXI, KORTES, RED CRAB, DUNKIN, CASADELI, CIABATTA, MIGAJAS, ROGERS, LA COSTENITA, NELSON MARKET = alimentacion
- DISNEY PLUS, APPLE.COM/BILL, NETFLIX, SPOTIFY, HBO, YOUTUBE PREMIUM = suscripciones (is_subscription: true)
- DIFARE, COMFARPI, FYBECA, MEDICITY = salud
- ESTACION DE SERVICIO, PRIMAX, PDV, TEXACO = transporte
- ZARA, H&M, ETAFASHION, TENIS MARKET, FOREVERSOFT = vestimenta
- SUPERCINES, RIVER BEACH TENNIS, DIAMOND CLUB = entretenimiento
- CONECEL, CLARO, MOVISTAR, CNT = vivienda
- AMAGUA, CISNERGIA, CNEL, LUZ = vivienda
- GESTION DE COBRANZA, INTERES, CONTRIB.FINANC.SOLCA, COMISION = is_fee: true
- Consumos marcados como EXTERIOR = is_international: true
- IVA SERVICIO DIGITAL = is_international: true, is_fee: false

REGLAS IMPORTANTES:
- Convertir fechas: ENE=01, FEB=02, MAR=03, ABR=04, MAY=05, JUN=06, JUL=07, AGO=08, SEP=09, OCT=10, NOV=11, DIC=12
- El ano actual es 2025/2026
- NO incluir pagos (lineas con "SU PAGO" o montos negativos)
- Para diferidos tipo "PACIFICARD EFECTIVO BANCA" o marcados como "DIF", extraer cuota mensual
- Buscar seccion "DETALLE DE MOVIMIENTOS DEL PERIODO" para transacciones
- Cada transaccion debe tener amount > 0"""
            user_prompt = """Analiza este estado de cuenta bancario ecuatoriano (puede ser Pacificard, Pichincha u otro banco).
Extrae TODA la informacion: datos de la tarjeta, TODAS las transacciones del periodo, y compras diferidas.
Responde UNICAMENTE con JSON valido, sin explicaciones adicionales."""
        else:
            system_prompt = """Eres un experto en OCR y analisis de recibos/facturas ecuatorianas.
            Extrae la informacion del recibo y clasificala segun categorias SRI Ecuador.
            Responde SOLO en formato JSON:
            {"transactions": [{"amount": numero, "description": "...", "category": "...", "subcategory": "...", "establishment": "...", "date": "YYYY-MM-DD"}]}"""
            user_prompt = "Extrae toda la informacion de este recibo/factura ecuatoriana"

        logger.info(f"Sending file to Gemini for OCR processing: {file_path}")
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"ocr_{uuid.uuid4()}",
            system_message=system_prompt
        ).with_model("gemini", "gemini-2.5-flash")

        file_content = FileContentWithMimeType(file_path=file_path, mime_type=mime_type)
        response = await chat.send_message(UserMessage(text=user_prompt, file_contents=[file_content]))
        logger.info(f"Gemini response received, length: {len(response)}")

        json_match = re.search(r'\{[\s\S]*\}', response)
        if json_match:
            try:
                result = json.loads(json_match.group())
                logger.info(f"Successfully parsed JSON - card_info: {bool(result.get('card_info'))}, transactions: {len(result.get('transactions', []))}")
                return result
            except json.JSONDecodeError as e:
                logger.error(f"JSON decode error: {e}")
                try:
                    fixed = json_match.group().replace("'", '"')
                    return json.loads(fixed)
                except Exception:
                    pass

        logger.warning("No valid JSON found in Gemini response")
        return {"transactions": [], "card_info": None}
    except Exception as e:
        logger.error(f"Image processing error: {e}")
        return {"transactions": [], "card_info": None, "error": str(e)}


def extract_text_from_pdf(file_path: str) -> str:
    try:
        all_text = []
        with pdfplumber.open(file_path) as pdf:
            for page_num, page in enumerate(pdf.pages):
                text = page.extract_text()
                if text:
                    all_text.append(f"--- PAGINA {page_num + 1} ---\n{text}")
                tables = page.extract_tables()
                for table in tables:
                    if table:
                        table_text = "\n".join([" | ".join([str(cell or "") for cell in row]) for row in table if row])
                        if table_text.strip():
                            all_text.append(f"\n[TABLA]\n{table_text}")
        return "\n\n".join(all_text)
    except Exception as e:
        logger.error(f"PDF text extraction error: {e}")
        return ""


async def process_bank_statement_text(text: str) -> dict:
    if not EMERGENT_LLM_KEY:
        return {"error": "API key not configured"}
    try:
        system_prompt = """Eres un experto en analisis de estados de cuenta bancarios de Ecuador.
Analiza el texto extraido del estado de cuenta y extrae TODA la informacion en formato JSON.

INSTRUCCIONES ESPECIFICAS PARA PACIFICARD:
- "Deuda Total a la fecha corte" = current_balance (saldo total a pagar)
- "Total a pagar de contado" o "PAGO SUGERIDO" = pago de contado recomendado
- "Minimo a pagar" o "Pago Minimo" = minimum_payment
- "Fecha maximo de pago sin recargos" = due_date
- "Cupo Autorizado" = credit_limit
- "Disponible" = available_credit
- "Tasa de interes efectiva anual" = apr
- "Saldo Diferido Actual" = total de compras diferidas pendientes
- Buscar "BLACK" o "PLATINUM" en el nombre de la tarjeta

FORMATO DE RESPUESTA JSON:
{
  "card_info": {
    "bank_name": "Pacificard" o el banco detectado,
    "card_name": "Black/Platinum/etc",
    "card_number_last4": "ultimos 4 digitos si se encuentran",
    "statement_date": "YYYY-MM-DD",
    "due_date": "YYYY-MM-DD",
    "credit_limit": numero,
    "available_credit": numero,
    "current_balance": numero (deuda total),
    "minimum_payment": numero,
    "pago_total": numero (TOTAL A PAGAR / Pago de Contado / pago total),
    "apr": numero (tasa efectiva anual),
    "previous_balance": numero,
    "payments_received": numero,
    "period_charges": numero,
    "deferred_balance": numero (SALDO DIFERIDO / Credito Diferido / saldo actual diferido)
  },
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "descripcion",
      "amount": numero positivo,
      "establishment": "comercio",
      "category": "alimentacion|salud|educacion|vivienda|vestimenta|suscripciones|turismo|transporte|entretenimiento|impuestos|otros",
      "is_international": boolean,
      "is_subscription": boolean,
      "is_fee": boolean
    }
  ],
  "deferred_purchases": [
    {
      "description": "descripcion",
      "total_amount": numero,
      "monthly_payment": numero (cuota mensual),
      "current_installment": numero (cuota actual X de Y),
      "remaining_installments": numero,
      "total_installments": numero
    }
  ]
}

CATEGORIZACION:
- DIAMOND CLUB, SUPERMAXI, KORTES, MEGAMAXI, RED CRAB, DUNKIN, CASADELI, CIABATTA, MIGAJAS = alimentacion
- DISNEY PLUS, APPLE.COM/BILL, NETFLIX, SPOTIFY, HBO = suscripciones (is_subscription: true)
- DIFARE, COMFARPI, FYBECA = salud
- ESTACION DE SERVICIO, PRIMAX, PDV = transporte
- ZARA, KORTES SOL PLAZA = vestimenta
- SUPERCINES, RIVER BEACH TENNIS = entretenimiento
- CONECEL, CLARO = vivienda (telefonia)
- AMAGUA, CISNERGIA = vivienda (servicios basicos)
- GESTION DE COBRANZA, INTERES, CONTRIB.FINANC = is_fee: true
- Consumos con "EXTERIOR" o moneda extranjera = is_international: true

REGLAS:
- Las fechas DD/MMM/AAAA convertir a YYYY-MM-DD (ENE=01, FEB=02, MAR=03, ABR=04, MAY=05, JUN=06, JUL=07, AGO=08, SEP=09, OCT=10, NOV=11, DIC=12)
- Incluir TODAS las transacciones del periodo
- NO incluir pagos (montos negativos o "SU PAGO")
- Para diferidos, buscar seccion "DIF" o cuotas mensuales recurrentes"""

        user_prompt = f"""Analiza este texto extraido del estado de cuenta bancario y extrae TODA la informacion:

{text[:15000]}

Responde SOLO con el JSON estructurado."""

        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"bank_stmt_{uuid.uuid4()}",
            system_message=system_prompt
        ).with_model("gemini", "gemini-2.5-flash")

        response = await chat.send_message(UserMessage(text=user_prompt))
        logger.info(f"AI response length: {len(response)}")

        json_match = re.search(r'\{[\s\S]*\}', response)
        if json_match:
            try:
                result = json.loads(json_match.group())
                logger.info(f"Parsed result - card_info: {bool(result.get('card_info'))}, transactions: {len(result.get('transactions', []))}, deferred: {len(result.get('deferred_purchases', []))}")
                return result
            except json.JSONDecodeError as e:
                logger.error(f"JSON decode error: {e}")
                try:
                    fixed = json_match.group().replace("'", '"')
                    return json.loads(fixed)
                except Exception:
                    pass

        logger.warning("No valid JSON found in AI response")
        return {"transactions": [], "card_info": None}
    except Exception as e:
        logger.error(f"Bank statement text processing error: {e}")
        return {"transactions": [], "card_info": None, "error": str(e)}
