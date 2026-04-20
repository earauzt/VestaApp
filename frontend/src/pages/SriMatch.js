import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CheckCircle, XCircle, Coins, LinkSimple, Trash, ArrowsClockwise, Receipt } from "@phosphor-icons/react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const fmtCurrency = (v) =>
  new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(v || 0);

export default function SriMatch() {
  const { getAuthHeaders } = useAuth();
  const getAuthHeadersRef = useRef(getAuthHeaders);
  useEffect(() => { getAuthHeadersRef.current = getAuthHeaders; });

  const [counters, setCounters] = useState({ con_respaldo: 0, match_aproximado: 0, pendiente_match: 0, sin_vincular: 0 });
  const [aprox, setAprox] = useState([]);
  const [expired, setExpired] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("match_aproximado");

  const fetchAll = useCallback(async () => {
    try {
      const headers = getAuthHeadersRef.current();
      const [c, p] = await Promise.all([
        axios.get(`${API}/sri/counters`, { headers }),
        axios.get(`${API}/sri/pending`, { headers }),
      ]);
      setCounters(c.data);
      setAprox(p.data.match_aproximado || []);
      setExpired(p.data.sin_respaldo_72h || []);
    } catch {
      toast.error("Error al cargar SRI match");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab) setActiveTab(tab);
  }, [fetchAll]);

  const handleConfirm = async (id) => {
    try {
      await axios.post(`${API}/sri/confirm-match/${id}`, {}, { headers: getAuthHeadersRef.current() });
      toast.success("Match confirmado");
      fetchAll();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Error al confirmar");
    }
  };

  const handleReject = async (id) => {
    try {
      await axios.post(`${API}/sri/reject-match/${id}`, {}, { headers: getAuthHeadersRef.current() });
      toast.success("Match rechazado, volverá a intentarse");
      fetchAll();
    } catch {
      toast.error("Error al rechazar");
    }
  };

  const handleMarkCash = async (id) => {
    try {
      await axios.post(`${API}/sri/mark-cash/${id}`, {}, { headers: getAuthHeadersRef.current() });
      toast.success("Marcado como pago en efectivo");
      fetchAll();
    } catch {
      toast.error("Error al marcar efectivo");
    }
  };

  const handleDiscard = async (id) => {
    if (!window.confirm("¿Descartar esta transacción del SRI?")) return;
    try {
      await axios.post(`${API}/sri/discard/${id}`, {}, { headers: getAuthHeadersRef.current() });
      toast.success("Descartada");
      fetchAll();
    } catch {
      toast.error("Error al descartar");
    }
  };

  const handleRescan = async () => {
    try {
      const r = await axios.post(`${API}/sri/scan`, {}, { headers: getAuthHeadersRef.current() });
      toast.success(`Reescaneadas ${r.data.retried}, ${r.data.matched} vinculadas`);
      fetchAll();
    } catch {
      toast.error("Error al reescanear");
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-6" data-testid="sri-match-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
            <Receipt size={32} weight="duotone" className="text-violet-600" />
            Match Factura ↔ Consumo
          </h1>
          <p className="text-muted-foreground">Vincula facturas SRI con sus consumos de tarjeta/débito</p>
        </div>
        <Button variant="outline" onClick={handleRescan} className="gap-2" data-testid="rescan-btn">
          <ArrowsClockwise size={16} />
          Reescanear
        </Button>
      </div>

      {/* Counters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { key: "con_respaldo", icon: "✅", label: "Con respaldo", value: counters.con_respaldo, bg: "bg-emerald-50 dark:bg-emerald-950/30", fg: "text-emerald-700 dark:text-emerald-400" },
          { key: "match_aproximado", icon: "🔄", label: "Match aproximado", value: counters.match_aproximado, bg: "bg-amber-50 dark:bg-amber-950/30", fg: "text-amber-700 dark:text-amber-400" },
          { key: "pendiente", icon: "⏳", label: "Esperando", value: counters.pendiente_match, bg: "bg-blue-50 dark:bg-blue-950/30", fg: "text-blue-700 dark:text-blue-400" },
          { key: "sin_vincular", icon: "⚠️", label: "Sin vincular", value: counters.sin_vincular, bg: "bg-red-50 dark:bg-red-950/30", fg: "text-red-700 dark:text-red-400" },
        ].map((c) => (
          <Card key={c.key} className={`bento-card ${c.bg}`}>
            <CardContent className="p-4 flex flex-col items-center">
              <span className="text-2xl mb-1">{c.icon}</span>
              <span className={`text-2xl font-bold ${c.fg}`}>{c.value}</span>
              <span className="text-xs text-muted-foreground text-center">{c.label}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="match_aproximado" data-testid="tab-aprox">Match aproximado ({aprox.length})</TabsTrigger>
          <TabsTrigger value="sin_vincular" data-testid="tab-sin">Sin vincular ({expired.length})</TabsTrigger>
        </TabsList>

        {/* Match aproximado */}
        <TabsContent value="match_aproximado" className="space-y-3 mt-4">
          {aprox.length === 0 ? (
            <Card className="bento-card"><CardContent className="text-center py-12 text-muted-foreground">No hay matches aproximados pendientes</CardContent></Card>
          ) : (
            aprox.map((t) => (
              <Card key={t.id} className="bento-card" data-testid={`aprox-${t.id}`}>
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">{t.source_type === "invoice" || t.has_invoice ? "📄 Factura" : "💳 Consumo"}</Badge>
                        {t.match_aproximado_confianza && (
                          <Badge variant="secondary" className="text-xs">{Math.round(t.match_aproximado_confianza * 100)}% confianza</Badge>
                        )}
                      </div>
                      <p className="font-medium truncate mt-1">{t.description || t.establishment}</p>
                      <p className="text-sm text-muted-foreground">{format(new Date(t.date), "d MMM yyyy", { locale: es })} · <strong>{fmtCurrency(t.amount)}</strong></p>
                      {t.candidato && (
                        <div className="mt-2 p-2 rounded bg-muted/30 text-sm">
                          <span className="text-muted-foreground">Candidato:</span> {t.candidato.description || t.candidato.establishment}
                          <span className="ml-2 font-mono">{fmtCurrency(t.candidato.amount)}</span>
                          <span className="ml-2 text-xs text-muted-foreground">{t.candidato.date}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" onClick={() => handleConfirm(t.id)} className="gap-1 bg-emerald-600 hover:bg-emerald-700" data-testid={`confirm-${t.id}`}>
                        <CheckCircle size={14} /> Sí
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleReject(t.id)} className="gap-1" data-testid={`reject-${t.id}`}>
                        <XCircle size={14} /> No
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Sin vincular (72h expired) */}
        <TabsContent value="sin_vincular" className="space-y-3 mt-4">
          {expired.length === 0 ? (
            <Card className="bento-card"><CardContent className="text-center py-12 text-muted-foreground">No hay transacciones sin vincular</CardContent></Card>
          ) : (
            expired.map((t) => (
              <Card key={t.id} className="bento-card" data-testid={`expired-${t.id}`}>
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <Badge variant="outline" className="text-xs mb-1">{t.source_type === "invoice" || t.has_invoice ? "📄 Factura" : "💳 Consumo"}</Badge>
                      <p className="font-medium truncate">{t.description || t.establishment}</p>
                      <p className="text-sm text-muted-foreground">{format(new Date(t.date), "d MMM yyyy", { locale: es })} · <strong>{fmtCurrency(t.amount)}</strong></p>
                      <p className="text-xs text-amber-600 mt-1">Pasaron 72h sin encontrar contraparte</p>
                    </div>
                    <div className="flex gap-2 shrink-0 flex-wrap">
                      <Button size="sm" onClick={() => handleMarkCash(t.id)} className="gap-1" variant="secondary" data-testid={`cash-${t.id}`}>
                        <Coins size={14} /> Efectivo
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => toast.info("Usa la búsqueda de transacciones para vincular manualmente")} className="gap-1">
                        <LinkSimple size={14} /> Manual
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleDiscard(t.id)} className="gap-1 text-red-600" data-testid={`discard-${t.id}`}>
                        <Trash size={14} /> Descartar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
