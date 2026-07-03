import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { FileText, CheckCircle, LinkSimple, Receipt, Eye } from "@phosphor-icons/react";
import { RefreshCw } from "lucide-react";
import TransactionEditModal from "../components/shared/TransactionEditModal";
import { PERSONAL_CATEGORIES } from "../constants/categories";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const fmtCurrency = (v) =>
  new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(v || 0);

const fmtDate = (s) => {
  if (!s) return "—";
  try {
    const d = s.length >= 10 && s[4] === "-" ? new Date(s) : null;
    if (d && !isNaN(d)) return format(d, "dd MMM yyyy");
    return s.slice(0, 10);
  } catch {
    return s;
  }
};

export default function SriMatch() {
  const { getAuthHeaders } = useAuth();
  const getAuthHeadersRef = useRef(getAuthHeaders);
  useEffect(() => { getAuthHeadersRef.current = getAuthHeaders; });

  const [facturas, setFacturas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingPdfs, setProcessingPdfs] = useState(false);
  const [activeFactura, setActiveFactura] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchFacturas = useCallback(async () => {
    try {
      const headers = getAuthHeadersRef.current();
      const r = await axios.get(`${API}/gmail/facturas-summary`, { headers });
      setFacturas(r.data.documents || []);
    } catch {
      toast.error("Error al cargar facturas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFacturas(); }, [fetchFacturas]);

  const handleProcessPdfs = async () => {
    setProcessingPdfs(true);
    try {
      const r = await axios.post(`${API}/gmail/process-factura-pdfs`, {}, { headers: getAuthHeadersRef.current() });
      toast.success(`${r.data.processed} PDFs procesados`);
      fetchFacturas();
    } catch {
      toast.error("Error al procesar PDFs");
    } finally {
      setProcessingPdfs(false);
    }
  };

  const handleViewPdf = (docId) => {
    window.open(`${API}/gmail/documents/${docId}/view`, "_blank");
  };

  const handleCategorize = async (data) => {
    if (!activeFactura) return;
    setSaving(true);
    try {
      const r = await axios.post(
        `${API}/sri/facturas/${activeFactura.id}/categorize`,
        {
          category: data.category,
          subcategory: data.subcategory || "",
          sri_category: data.sri_category || "",
          sri_subcategory: data.sri_subcategory || "",
        },
        { headers: getAuthHeadersRef.current() }
      );
      if (r.data.linked) {
        toast.success(`Categorizada y vinculada con ${r.data.linked_bank || "consumo"}`);
      } else {
        toast.success("Factura categorizada (sin consumo vinculado)");
      }
      setActiveFactura(null);
      fetchFacturas();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Error al categorizar");
    } finally {
      setSaving(false);
    }
  };

  // Dividir: sin budget_category → "Por categorizar"; con → "Vinculadas"
  const porCategorizar = facturas.filter((f) => !f.budget_category);
  const vinculadas = facturas.filter((f) => f.budget_category);

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <RefreshCw className="animate-spin" size={20} />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto" data-testid="sri-match-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Mis Facturas</h1>
          <p className="text-sm text-muted-foreground">Categoriza facturas SRI deducibles y revisa vínculos con consumos.</p>
        </div>
        <Button
          onClick={handleProcessPdfs}
          disabled={processingPdfs}
          variant="outline"
          className="gap-2"
          data-testid="process-pdfs-btn"
          title="Busca en tu correo de Gmail los PDFs de facturas nuevas y los agrega a esta lista"
        >
          <RefreshCw size={16} className={processingPdfs ? "animate-spin" : ""} />
          Buscar facturas nuevas en Gmail
        </Button>
      </div>
      <p className="text-xs text-muted-foreground -mt-4 sm:text-right">
        Revisa tu bandeja de Gmail en busca de PDFs de facturas nuevas para categorizar.
      </p>

      {/* Sección: Por categorizar */}
      <Card data-testid="por-categorizar-section">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Receipt size={20} className="text-amber-600" />
            Por categorizar
            <Badge variant="outline" className="ml-2 bg-amber-50 text-amber-700 border-amber-200">
              {porCategorizar.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {porCategorizar.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              <CheckCircle size={32} className="mx-auto mb-2 text-emerald-500" />
              Todas las facturas están categorizadas.
            </div>
          ) : (
            porCategorizar.map((f) => (
              <div
                key={f.id}
                className="w-full flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/40 transition-colors"
                data-testid={`factura-categorizar-${f.id}`}
              >
                <button
                  type="button"
                  onClick={() => setActiveFactura(f)}
                  className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-3 text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {f.nombre_emisor || f.emisor || f.ruc_emisor || "Emisor desconocido"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {fmtDate(f.fecha)} · {f.numero_factura || "Sin número"}
                    </p>
                  </div>
                  <span className="font-mono font-semibold text-sm shrink-0">
                    {f.monto != null ? fmtCurrency(f.monto) : "—"}
                  </span>
                </button>
                {f.filename && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1 h-8 shrink-0"
                    onClick={(e) => { e.stopPropagation(); handleViewPdf(f.id); }}
                    data-testid={`ver-pdf-pendiente-${f.id}`}
                  >
                    <Eye size={14} /> Ver PDF
                  </Button>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Sección: Vinculadas */}
      <Card data-testid="vinculadas-section">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <LinkSimple size={20} className="text-emerald-600" />
            Vinculadas
            <Badge variant="outline" className="ml-2 bg-emerald-50 text-emerald-700 border-emerald-200">
              {vinculadas.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {vinculadas.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Aún no hay facturas vinculadas.
            </div>
          ) : (
            vinculadas.map((f) => (
              <div
                key={f.id}
                className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border bg-card"
                data-testid={`factura-vinculada-${f.id}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {f.nombre_emisor || f.emisor || "Emisor desconocido"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {fmtDate(f.fecha)} · {f.numero_factura || "—"}
                    {f.linked_bank && (
                      <>
                        {" · "}
                        <span className="text-emerald-700">vinc. {f.linked_bank}</span>
                      </>
                    )}
                  </p>
                </div>
                <span className="font-mono font-semibold text-sm shrink-0">
                  {f.monto != null ? fmtCurrency(f.monto) : "—"}
                </span>
                <Badge variant="outline" className="text-[10px] shrink-0">
                  {PERSONAL_CATEGORIES[f.budget_category]?.name || f.budget_category}
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 h-8 shrink-0"
                  onClick={() => handleViewPdf(f.id)}
                  data-testid={`ver-pdf-${f.id}`}
                >
                  <Eye size={14} /> Ver PDF
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Modal unificado para categorizar */}
      <TransactionEditModal
        open={!!activeFactura}
        transaction={
          activeFactura
            ? {
                amount: activeFactura.monto,
                date: activeFactura.fecha,
                description: activeFactura.nombre_emisor || activeFactura.emisor,
                establishment: activeFactura.nombre_emisor || activeFactura.emisor,
                category: "",
                subcategory: "",
                sri_category: "",
                sri_subcategory: "",
                is_business_use: false,
                applies_iva: true,
                beneficiario: "",
              }
            : null
        }
        onSave={handleCategorize}
        onClose={() => !saving && setActiveFactura(null)}
      />
    </div>
  );
}
