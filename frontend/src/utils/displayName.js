// Shared helper: derive a clean display name for a transaction-like object.
// Used across Transactions.js, TabPorRevisar.jsx, TabHistorial.jsx.
const EMAIL_BOILERPLATE = /phishing|no solicite|clave secreta|este correo|estimado(?:a)? cliente|si usted no|www\.|https?:\/\//i;
const LEADING_NOISE = /^(FacturaFactura|Factura|Ha recibido su documento electrónico?:?\s*|Ha recibido una Factura nueva)/gi;

export function sanitizeDescription(raw, maxLen = 45) {
  if (raw == null) return "";
  let text = String(raw).replace(/\s+/g, " ").trim();
  text = text.replace(LEADING_NOISE, "");
  text = text.replace(/^(FA|FAC|001-|030-)\S+/, "");
  text = text.replace(/:\s*\?\s*/g, ": ").replace(/\s+\?\s+/g, " ").replace(/\s+/g, " ").trim();
  if (!text || text === "?" || text.length < 2) return "";
  if (text.length > 80 && EMAIL_BOILERPLATE.test(text)) {
    const cut = text.split(/(?:Estimado|Este correo|Si usted|Diners Club le informa)/i)[0].trim();
    text = cut.length > 2 ? cut : "";
  }
  if (text.length > maxLen) text = text.slice(0, maxLen).trim();
  return text;
}

export function displayName(tx = {}, maxLen = 45) {
  const candidates = [tx.comercio, tx.establishment, tx.descripcion_corta, tx.description];
  for (const raw of candidates) {
    const cleaned = sanitizeDescription(raw, maxLen);
    if (cleaned) return cleaned;
  }
  return "Sin descripción";
}
