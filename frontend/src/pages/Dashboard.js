import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Clock, CreditCard, Bell } from "@phosphor-icons/react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

import { useAuth } from "../context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Progress } from "../components/ui/progress";
import { Badge } from "../components/ui/badge";
import AutoRuleModal from "../components/AutoRuleModal";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Mismos umbrales que Deudas.js (getUtilizationColor) — una sola definicion
// de "que utilizacion de credito es sana" en toda la app.
const utilizationColor = (rate) => {
  if (rate < 30) return "text-emerald-600";
  if (rate < 50) return "text-amber-600";
  return "text-red-600";
};

// Color por categoria (Apple Wallet / Copilot): reutiliza los 5 tokens --chart-*
// que ya existian en index.css sin uso real, en vez de un unico verde uniforme.
const CATEGORY_COLORS = [
  { dot: "bg-chart-1", bar: "[&>div]:bg-chart-1" },
  { dot: "bg-chart-2", bar: "[&>div]:bg-chart-2" },
  { dot: "bg-chart-3", bar: "[&>div]:bg-chart-3" },
  { dot: "bg-chart-4", bar: "[&>div]:bg-chart-4" },
  { dot: "bg-chart-5", bar: "[&>div]:bg-chart-5" },
];

export default function Dashboard() {
  const { getAuthHeaders, user } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [categoriesConfig, setCategoriesConfig] = useState({});
  const [reconStats, setReconStats] = useState(null);
  const [debtSummary, setDebtSummary] = useState(null);
  const [alertasUrgentes, setAlertasUrgentes] = useState([]);
  const [period, setPeriod] = useState("month");
  const [loading, setLoading] = useState(true);

  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [ruleEstablishment, setRuleEstablishment] = useState("");

  const getAuthHeadersRef = useRef(getAuthHeaders);
  useEffect(() => { getAuthHeadersRef.current = getAuthHeaders; });

  const fetchData = useCallback(async () => {
    const headers = getAuthHeadersRef.current();
    // Cada tarjeta del dashboard depende de un endpoint distinto — si uno falla
    // (ej. el usuario no tiene tarjetas todavia) el resto del panorama se sigue viendo.
    const [statsRes, chartRes, catsRes, reconRes, debtRes, notifRes] = await Promise.allSettled([
      axios.get(`${API}/dashboard/stats?period=${period}`, { headers }),
      axios.get(`${API}/dashboard/chart-data?period=${period}`, { headers }),
      axios.get(`${API}/budget/categories`, { headers }),
      axios.get(`${API}/reconciliation/stats`, { headers }),
      axios.get(`${API}/debt/summary`, { headers }),
      axios.get(`${API}/notificaciones`, { headers }),
    ]);

    if (statsRes.status === "fulfilled") {
      setStats(statsRes.value.data);
    } else {
      toast.error("Error al cargar el resumen del mes");
    }
    setChartData(chartRes.status === "fulfilled" ? (chartRes.value.data.data || []) : []);
    setCategoriesConfig(catsRes.status === "fulfilled" ? (catsRes.value.data.categories || {}) : {});
    setReconStats(reconRes.status === "fulfilled" ? reconRes.value.data : null);
    setDebtSummary(debtRes.status === "fulfilled" ? debtRes.value.data : null);
    setAlertasUrgentes(
      notifRes.status === "fulfilled"
        ? (notifRes.value.data.notificaciones || []).filter(n => n.prioridad === "high")
        : []
    );
    setLoading(false);
  }, [period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const sortedCategoryData = useMemo(() => {
    const byCategory = stats?.by_category || {};
    return Object.entries(categoriesConfig)
      .map(([key, config]) => ({
        key,
        name: config.name || key,
        value: byCategory[key] || 0,
        budget: config.monthly_budget || 0,
      }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [categoriesConfig, stats]);

  const formatCurrency = (value) => new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
  }).format(value || 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-muted-foreground">Cargando dashboard...</div>
      </div>
    );
  }

  // pending_review_total incluye tanto transacciones ya importadas en estado
  // pending_review como candidatos de Gmail sin importar todavia — mismo numero
  // que usan Movimientos y Alertas para "cosas pendientes", para no mostrar 3
  // totales distintos del mismo concepto segun la pantalla.
  const pendingCount = reconStats?.pending_review_total ?? reconStats?.pending_review ?? 0;
  const pendingAmount = reconStats?.total_pending_amount || 0;
  const totalDebt = debtSummary?.total_debt_with_deferred ?? debtSummary?.total_debt;
  const balancePositive = (stats?.balance || 0) >= 0;

  return (
    <div className="space-y-6 lg:space-y-8" data-testid="dashboard-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Hola {user?.name?.split(" ")[0]}, aquí está tu resumen del mes.
          </p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[140px] sm:w-[180px]" data-testid="period-select">
            <SelectValue placeholder="Seleccionar período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">Esta semana</SelectItem>
            <SelectItem value="month">Este mes</SelectItem>
            <SelectItem value="year">Este año</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Alertas urgentes — lo primero que se ve si algo necesita atencion ya */}
      {alertasUrgentes.length > 0 && (
        <Card
          className="border-red-200 bg-red-50/60 cursor-pointer hover:bg-red-50 transition-colors"
          onClick={() => navigate("/alertas")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate("/alertas"); } }}
          data-testid="alertas-urgentes-card"
        >
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="shrink-0 h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                <Bell size={18} className="text-red-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-red-900 truncate">{alertasUrgentes[0].titulo}</p>
                <p className="text-xs text-red-700/80">
                  {alertasUrgentes.length > 1 ? `+${alertasUrgentes.length - 1} alerta${alertasUrgentes.length - 1 === 1 ? "" : "s"} más urgente${alertasUrgentes.length - 1 === 1 ? "" : "s"}` : alertasUrgentes[0].texto}
                </p>
              </div>
            </div>
            <Badge variant="outline" className="border-red-200 text-red-700 shrink-0 bg-white">
              Ver →
            </Badge>
          </CardContent>
        </Card>
      )}

      {/* Sección 1 — Balance hero */}
      <Card className="bento-card" data-testid="balance-hero-card">
        <CardContent className="p-6 sm:p-8">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Balance del mes</p>
          <p
            className={`text-4xl sm:text-5xl font-bold tracking-tight mt-1 ${
              balancePositive ? "text-emerald-700" : "text-red-600"
            }`}
            data-testid="dashboard-balance-hero"
          >
            {formatCurrency(stats?.balance)}
          </p>
          <p className="text-sm text-muted-foreground mt-3" data-testid="dashboard-income-expenses-line">
            <span className="text-emerald-600 font-medium">+{formatCurrency(stats?.total_income)}</span>
            <span className="px-2 text-muted-foreground/50">·</span>
            <span className="text-foreground font-medium">{formatCurrency(stats?.monthly_total || stats?.total_expenses)}</span>
            <span className="ml-1.5 text-muted-foreground">gastos</span>
          </p>
          <p className="text-xs text-muted-foreground mt-2" data-testid="dashboard-daily-average">
            Promedio diario {formatCurrency(stats?.daily_average)}
          </p>

          {chartData.length > 1 && (
            <div className="mt-5 -mx-2" data-testid="dashboard-spend-chart">
              <ResponsiveContainer width="100%" height={90}>
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d) => {
                      const parsed = new Date(`${d}T00:00:00`);
                      return Number.isNaN(parsed.getTime()) ? d : parsed.toLocaleDateString("es-EC", { weekday: "short" }).slice(0, 1).toUpperCase();
                    }}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <Tooltip
                    formatter={(value) => formatCurrency(value)}
                    labelFormatter={(d) => new Date(`${d}T00:00:00`).toLocaleDateString("es-EC", { day: "numeric", month: "short" })}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))" }}
                  />
                  <Bar dataKey="expenses" radius={[4, 4, 2, 2]} maxBarSize={18}>
                    {chartData.map((_, i) => (
                      <Cell key={i} fill="hsl(var(--primary))" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sección 2 — Deuda + Por revisar, lado a lado: los dos numeros que junto
          al balance completan "cual es mi estado financiero ahora mismo". */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {debtSummary && totalDebt > 0 && (
          <Card
            className="bento-card cursor-pointer hover:bg-muted transition-colors"
            onClick={() => navigate("/deudas")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate("/deudas"); } }}
            data-testid="dashboard-debt-card"
          >
            <CardContent className="p-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="shrink-0 h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                  <CreditCard size={18} className="text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-base font-semibold text-foreground">{formatCurrency(totalDebt)}</p>
                  <p className="text-xs text-muted-foreground">
                    Deuda total (tarjetas + diferidos)
                    {debtSummary.utilization_rate != null && (
                      <span className={`ml-1 font-medium ${utilizationColor(debtSummary.utilization_rate)}`}>
                        · {debtSummary.utilization_rate}% utilización
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {pendingCount > 0 && (
          <Card
            className="bento-card cursor-pointer hover:bg-muted transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            onClick={() => navigate("/movimientos?tab=por-revisar")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate("/movimientos?tab=por-revisar"); } }}
            data-testid="por-revisar-card"
          >
            <CardContent className="p-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="shrink-0 h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                  <Clock size={18} className="text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-base font-semibold text-foreground" data-testid="por-revisar-count">
                    {pendingCount} {pendingCount === 1 ? "movimiento" : "movimientos"} por revisar
                  </p>
                  <p className="text-xs text-muted-foreground">{formatCurrency(pendingAmount)} pendientes de aprobar</p>
                </div>
              </div>
              <Badge variant="outline" className="border-border text-muted-foreground shrink-0">
                Ver →
              </Badge>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Sección 3 — Gastos este mes por categoría */}
      {(() => {
        const totalSpent = sortedCategoryData.reduce((s, c) => s + (c.value || 0), 0);
        const rows = sortedCategoryData.slice(0, 8);
        if (rows.length === 0) return null;
        return (
          <Card className="bento-card" data-testid="categories-list-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Gastos este mes por categoría</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                {rows.length} categorías · {formatCurrency(totalSpent)} total
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {rows.map((cat, idx) => {
                const pct = totalSpent > 0 ? Math.round((cat.value / totalSpent) * 100) : 0;
                const overBudget = cat.budget > 0 && cat.value > cat.budget;
                const catColor = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
                return (
                  <div
                    key={cat.key}
                    className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 items-center cursor-pointer rounded-md -mx-2 px-2 py-1 hover:bg-muted transition-colors"
                    onClick={() => navigate(`/movimientos?tab=todos&category=${cat.key}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(`/movimientos?tab=todos&category=${cat.key}`); } }}
                    data-testid={`category-row-${cat.key}`}
                  >
                    <span className="text-sm font-medium text-foreground truncate flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${overBudget ? "bg-red-500" : catColor.dot}`} />
                      {cat.name}
                    </span>
                    <span className={`text-sm font-mono tabular-nums ${overBudget ? "text-red-600 font-semibold" : "text-muted-foreground"}`}>
                      {formatCurrency(cat.value)}
                      {cat.budget > 0 && <span className="text-muted-foreground/60"> / {formatCurrency(cat.budget)}</span>}
                    </span>
                    <Progress
                      value={pct}
                      className={`h-2 col-start-1 ${overBudget ? "[&>div]:bg-red-500" : catColor.bar}`}
                    />
                    <span className="text-xs text-muted-foreground tabular-nums col-start-2">
                      {pct}%
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })()}

      <AutoRuleModal
        open={ruleModalOpen}
        onOpenChange={setRuleModalOpen}
        establishment={ruleEstablishment}
        onCreated={() => fetchData()}
      />
    </div>
  );
}
