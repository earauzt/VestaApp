// Shared helper: derive a clean display name for a transaction-like object.
// Used across Transactions.js, TabPorRevisar.jsx, TabHistorial.jsx.
export function displayName(tx = {}) {
  const comercio = (tx.comercio || "").trim();
  if (comercio.length > 2) return comercio;
  const establishment = (tx.establishment || "").trim();
  if (establishment.length > 2) return establishment;
  const desc = tx.description || "";
  const cleaned = desc
    .replace(/^(FacturaFactura|Factura|Ha recibido su documento electrónico?:?\s*|Ha recibido una Factura nueva|Consumo \w+:\s*\?\s*)/gi, "")
    .replace(/^(FA|FAC|001-|030-)\S+/, "")
    .trim();
  return cleaned.length > 2 ? cleaned.substring(0, 45) : "Sin descripción";
}
