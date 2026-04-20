"""
Bank email parsers module.
Each parser extracts structured data from emails of specific banks.
The dispatcher tries each parser in order; falls back to GPT-4o if none match.
"""
import re
import base64
import logging
from datetime import datetime, timezone
from html import unescape

logger = logging.getLogger(__name__)

# ─── Shared helpers ───────────────────────────────────────────────

def extract_html_body(msg: dict) -> str:
    """Extract HTML body from a Gmail API message object."""
    payload = msg.get("payload", {})
    parts = payload.get("parts", [])
    # Flatten nested parts
    all_parts = list(parts)
    for p in parts:
        all_parts.extend(p.get("parts", []))
    # Prefer text/html
    for part in all_parts:
        if part.get("mimeType") == "text/html":
            data = part.get("body", {}).get("data", "")
            if data:
                return base64.urlsafe_b64decode(data).decode("utf-8", errors="replace")
    # Fall back to body on payload itself
    body_data = payload.get("body", {}).get("data", "")
    if body_data:
        return base64.urlsafe_b64decode(body_data).decode("utf-8", errors="replace")
    return ""


def extract_text_body(msg: dict) -> str:
    """Extract plain text body from a Gmail API message."""
    payload = msg.get("payload", {})
    parts = payload.get("parts", [])
    all_parts = list(parts)
    for p in parts:
        all_parts.extend(p.get("parts", []))
    for part in all_parts:
        if part.get("mimeType") == "text/plain":
            data = part.get("body", {}).get("data", "")
            if data:
                return base64.urlsafe_b64decode(data).decode("utf-8", errors="replace")
    body_data = payload.get("body", {}).get("data", "")
    if body_data:
        return base64.urlsafe_b64decode(body_data).decode("utf-8", errors="replace")
    return ""


def strip_html(html: str) -> str:
    """Strip HTML tags for plain-text matching."""
    text = re.sub(r'<[^>]+>', ' ', html)
    text = unescape(text)
    return re.sub(r'\s+', ' ', text).strip()


def _base_result(tipo: str, banco: str) -> dict:
    return {
        "matched": True,
        "tipo": tipo,
        "banco": banco,
        "monto": None,
        "comercio": None,
        "tarjeta_ultimos4": None,
        "fecha": None,
        "descripcion_corta": None,
        "nivel_urgencia": "media" if tipo == "consumo" else "baja",
        "notificacion": None,
    }


# ─── PacifiCard consumo ──────────────────────────────────────────

def parse_pacificard_consumo(sender: str, subject: str, html: str, text: str) -> dict:
    if "notificaciones@infopacificard.com.ec" not in sender.lower():
        return None
    plain = strip_html(html) if html else text
    if not plain:
        return None
    r = _base_result("consumo", "Pacificard")
    # Establecimiento
    m = re.search(r'Establecimiento:\s*(.+?)(?:\s*Fecha|\s*Monto|\s*$)', plain, re.I)
    if m:
        r["comercio"] = m.group(1).strip().strip('*').strip()
    # Fecha
    m = re.search(r'Fecha.*?(\d{4}-\d{2}-\d{2})', plain, re.I)
    if m:
        r["fecha"] = m.group(1)
    # Monto — strip trailing dot
    m = re.search(r'Monto\s*\$?\s*([\d.,]+)', plain, re.I)
    if m:
        val = m.group(1).strip('.')
        try:
            r["monto"] = float(val.replace(',', ''))
        except ValueError:
            pass
    # Tarjeta 545178XXXXXXX325 → últimos 3
    m = re.search(r'\d{6}X+(\d{2,4})', plain)
    if m:
        r["tarjeta_ultimos4"] = m.group(1)[-3:]
    if r["comercio"] or r["monto"]:
        r["descripcion_corta"] = f"Consumo Pacificard: {r['comercio'] or '?'} ${r['monto'] or '?'}"
        return r
    return None


# ─── Diners Club consumo ─────────────────────────────────────────

def parse_diners_consumo(sender: str, subject: str, html: str, text: str) -> dict:
    if "servicios@dinersclub.com.ec" not in sender.lower():
        return None
    plain = strip_html(html) if html else text
    if not plain:
        return None
    r = _base_result("consumo", "Diners Club")
    # Tarjeta
    m = re.search(r'TERMINADA EN\s*(\d+)', plain, re.I)
    if m:
        r["tarjeta_ultimos4"] = m.group(1)[-3:]
    # Look for table row: Fecha / Establecimiento / Valor
    m = re.search(r'(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})\s+(.+?)\s+([\d.,]+)\s*$', plain, re.M)
    if m:
        r["fecha"] = m.group(1).strip()[:10]
        r["comercio"] = m.group(2).strip()
        val = m.group(3).strip().replace('.', '').replace(',', '.')
        try:
            r["monto"] = float(val)
        except ValueError:
            pass
    if not r["monto"]:
        # Fallback: look for valor with comma decimal
        m = re.search(r'Valor.*?([\d.]+,\d{2})', plain, re.I)
        if m:
            val = m.group(1).replace('.', '').replace(',', '.')
            try:
                r["monto"] = float(val)
            except ValueError:
                pass
    if not r["comercio"]:
        m = re.search(r'Establecimiento[:\s]+(.+?)(?:\s*Valor|\s*$)', plain, re.I)
        if m:
            r["comercio"] = m.group(1).strip()
    if r["comercio"] or r["monto"]:
        r["descripcion_corta"] = f"Consumo Diners: {r['comercio'] or '?'} ${r['monto'] or '?'}"
        return r
    return None


# ─── Banco Pichincha consumo ─────────────────────────────────────

def parse_pichincha_consumo(sender: str, subject: str, html: str, text: str) -> dict:
    if "servicios@tarjetasbancopichincha.com" not in sender.lower():
        return None
    plain = strip_html(html) if html else text
    if not plain:
        return None
    r = _base_result("consumo", "Banco Pichincha")
    # Valor: $ 7,95
    m = re.search(r'Valor[:\s]*\$?\s*([\d.,]+)', plain, re.I)
    if m:
        val = m.group(1).replace('.', '').replace(',', '.')
        try:
            r["monto"] = float(val)
        except ValueError:
            pass
    # Establecimiento
    m = re.search(r'Establecimiento[:\s]+(.+?)(?:\s*Tarjeta|\s*Fecha|\s*$)', plain, re.I)
    if m:
        r["comercio"] = m.group(1).strip()
    # Tarjeta usada — últimos 3 dígitos
    m = re.search(r'Tarjeta\s+usada[:\s]*\*+(\d+)', plain, re.I)
    if not m:
        m = re.search(r'Tarjeta[:\s]*\*+(\d{2,4})', plain, re.I)
    if m:
        r["tarjeta_ultimos4"] = m.group(1)[-3:]
    # Fecha
    m = re.search(r'Fecha[:\s]*(\d{4}-\d{2}-\d{2})', plain, re.I)
    if m:
        r["fecha"] = m.group(1)
    if r["comercio"] or r["monto"]:
        r["descripcion_corta"] = f"Consumo Pichincha: {r['comercio'] or '?'} ${r['monto'] or '?'}"
        return r
    return None


# ─── Banco Bolivariano consumo ───────────────────────────────────

def parse_bolivariano_consumo(sender: str, subject: str, html: str, text: str) -> dict:
    if "avisos24@bolivariano.com" not in sender.lower():
        return None
    if "compra con tarjeta" not in subject.lower():
        return None
    plain = strip_html(html) if html else text
    if not plain:
        return None
    r = _base_result("consumo", "Banco Bolivariano")
    # Monto: 1.50 USD
    m = re.search(r'([\d.,]+)\s*USD', plain, re.I)
    if m:
        try:
            r["monto"] = float(m.group(1).replace(',', ''))
        except ValueError:
            pass
    # Tarjeta **** **** **** *351 → últimos 3
    m = re.search(r'\*+\s*(\d{3,4})', plain)
    if m:
        r["tarjeta_ultimos4"] = m.group(1)[-3:]
    # Comercio — after "en" or "Comercio:"
    m = re.search(r'(?:Comercio|en)[:\s]+([A-Z][^\n]{3,40}?)(?:\s+(?:Fecha|Tarjeta|Monto)|$)', plain, re.I)
    if m:
        r["comercio"] = m.group(1).strip()
    # Fecha
    m = re.search(r'(\d{4}-\d{2}-\d{2})', plain)
    if m:
        r["fecha"] = m.group(1)
    if r["comercio"] or r["monto"]:
        r["descripcion_corta"] = f"Consumo Bolivariano: {r['comercio'] or '?'} ${r['monto'] or '?'}"
        return r
    return None


# ─── Banco del Pacífico pago/transferencia ───────────────────────

def parse_pacifico_pago(sender: str, subject: str, html: str, text: str) -> dict:
    if "intermail@bancopacifico.ec" not in sender.lower():
        return None
    plain = strip_html(html) if html else text
    if not plain:
        return None
    r = _base_result("pago_tarjeta", "Banco del Pacifico")
    # Valor: $X,XXX.XX
    m = re.search(r'Valor[:\s]*\$?\s*([\d.,]+)', plain, re.I)
    if m:
        val = m.group(1).replace(',', '')
        try:
            r["monto"] = float(val)
        except ValueError:
            pass
    # Tarjeta destino
    m = re.search(r'[Tt]arjeta.*?(\d{4})\s*$', plain, re.M)
    if m:
        r["tarjeta_ultimos4"] = m.group(1)[-3:]
    # Fecha
    m = re.search(r'(\d{4}-\d{2}-\d{2})', plain)
    if m:
        r["fecha"] = m.group(1)
    if r["monto"]:
        r["descripcion_corta"] = f"Pago tarjeta Pacifico ${r['monto']}"
        return r
    return None


# ─── Banco Pichincha transferencia ───────────────────────────────

def parse_pichincha_transferencia(sender: str, subject: str, html: str, text: str) -> dict:
    if "banco@pichincha.com" not in sender.lower():
        return None
    plain = strip_html(html) if html else text
    if not plain:
        return None
    r = _base_result("transferencia", "Banco Pichincha")
    # Monto: USD XXXXX.XX
    m = re.search(r'(?:Monto|Valor)[:\s]*(?:USD|\$)\s*([\d.,]+)', plain, re.I)
    if m:
        val = m.group(1).replace(',', '')
        try:
            r["monto"] = float(val)
        except ValueError:
            pass
    # Fecha
    m = re.search(r'(\d{4}-\d{2}-\d{2})', plain)
    if m:
        r["fecha"] = m.group(1)
    if r["monto"]:
        r["descripcion_corta"] = f"Transferencia Pichincha ${r['monto']}"
        return r
    return None


# ─── Banco Pichincha estado de cuenta ────────────────────────────

def parse_pichincha_estado(sender: str, subject: str, html: str, text: str) -> dict:
    if "documentoselectronicos@pichincha.com" not in sender.lower():
        return None
    plain = strip_html(html) if html else text
    r = _base_result("estado_de_cuenta", "Banco Pichincha")
    # Tarjeta
    m = re.search(r'[Tt]arjeta.*?(\d{4})', plain) if plain else None
    if m:
        r["tarjeta_ultimos4"] = m.group(1)[-3:]
    # Mínimo a pagar
    m = re.search(r'[Mm]ínimo.*?\$?\s*([\d.,]+)', plain) if plain else None
    if m:
        r["pago_minimo"] = m.group(1)
    # Total a pagar
    m = re.search(r'[Tt]otal.*?pagar.*?\$?\s*([\d.,]+)', plain) if plain else None
    if m:
        val = m.group(1).replace(',', '')
        try:
            r["monto"] = float(val)
        except ValueError:
            pass
    r["descripcion_corta"] = "Estado de cuenta Pichincha"
    r["has_pdf_attachment"] = True
    return r


# ─── PacifiCard estado de cuenta ─────────────────────────────────

MONTH_MAP = {"ENE": "01", "FEB": "02", "MAR": "03", "ABR": "04", "MAY": "05", "JUN": "06",
             "JUL": "07", "AGO": "08", "SEP": "09", "OCT": "10", "NOV": "11", "DIC": "12"}

def parse_pacificard_estado(sender: str, subject: str, html: str, text: str) -> dict:
    if "estadodecuenta@pacificard.ec" not in sender.lower():
        return None
    plain = strip_html(html) if html else text
    r = _base_result("estado_de_cuenta", "Pacificard")
    # Tarjeta 5451-78XX-XXXX-X325
    m = re.search(r'(\d{4}-\d{2}XX-XXXX-X?\d{2,4})', plain or "") 
    if m:
        digits = re.findall(r'\d', m.group(1))
        r["tarjeta_ultimos4"] = "".join(digits[-3:]) if len(digits) >= 3 else None
    # Fecha de corte: 24/MAR/2026
    m = re.search(r'[Cc]orte[:\s]*(\d{2})/(\w{3})/(\d{4})', plain or "")
    if m:
        month = MONTH_MAP.get(m.group(2).upper(), "01")
        r["fecha_corte"] = f"{m.group(3)}-{month}-{m.group(1)}"
    # Fecha máxima de pago
    m = re.search(r'[Pp]ago[:\s]*(\d{2})/(\w{3})/(\d{4})', plain or "")
    if m:
        month = MONTH_MAP.get(m.group(2).upper(), "01")
        r["fecha_max_pago"] = f"{m.group(3)}-{month}-{m.group(1)}"
    # Saldo al corte / pago mínimo / pago sugerido
    for label, key in [("saldo", "monto"), ("mínimo", "pago_minimo"), ("sugerido", "pago_sugerido")]:
        m = re.search(rf'{label}.*?\$?\s*([\d.,]+)', plain or "", re.I)
        if m:
            val = m.group(1).replace(',', '')
            try:
                r[key] = float(val)
            except ValueError:
                pass
    r["descripcion_corta"] = "Estado de cuenta Pacificard"
    r["has_pdf_attachment"] = True
    return r


# ─── Banco del Pacífico estado de cuenta ─────────────────────────

def parse_pacifico_estado(sender: str, subject: str, html: str, text: str) -> dict:
    if "estadoscuenta@bancodelpacifico.com.ec" not in sender.lower():
        return None
    r = _base_result("estado_de_cuenta", "Banco del Pacifico")
    r["descripcion_corta"] = "Estado de cuenta Banco del Pacifico"
    r["has_pdf_attachment"] = True
    return r


# ─── Banco Bolivariano estado de cuenta (sin adjunto) ────────────

def parse_bolivariano_estado(sender: str, subject: str, html: str, text: str) -> dict:
    if "avisos24@bolivariano.com" not in sender.lower():
        return None
    if "estado de cuenta" not in subject.lower():
        return None
    r = _base_result("estado_de_cuenta_sin_adjunto", "Banco Bolivariano")
    r["descripcion_corta"] = "Estado de cuenta Bolivariano disponible"
    r["notificacion"] = "Tu estado de cuenta de Bolivariano esta disponible. Descargalo desde bolivariano.com y subelo en Bandeja Financiera > Estados."
    r["has_pdf_attachment"] = False
    return r


# ─── Dispatcher ───────────────────────────────────────────────────

# Order matters: estado de cuenta parsers before consumo (e.g. Bolivariano)
PARSERS = [
    parse_bolivariano_estado,
    parse_pacificard_estado,
    parse_pichincha_estado,
    parse_pacifico_estado,
    parse_pacificard_consumo,
    parse_diners_consumo,
    parse_pichincha_consumo,
    parse_bolivariano_consumo,
    parse_pacifico_pago,
    parse_pichincha_transferencia,
]


def dispatch(sender: str, subject: str, html: str, text: str) -> dict:
    """Try each parser in order. Returns result dict or None if no match."""
    for parser in PARSERS:
        try:
            result = parser(sender, subject, html, text)
            if result is not None:
                result["parser"] = parser.__name__
                return result
        except Exception as e:
            logger.warning(f"Parser {parser.__name__} error: {e}")
    return None
