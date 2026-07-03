import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Clock as LucideClock } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "../context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Progress } from "../components/ui/progress";
import { Badge } from "../components/ui/badge";
import AutoRuleModal from "../components/AutoRuleModal";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Budget references used to filter categorías mostradas en la sección 2.
// Las categorías con budget > 0 siempre aparecen (aunque el gasto del mes sea 0).
const DEFAULT_FLUJO_CATEGORIES = {
  servicios_basicos: { name: "Servicios Básicos", budget: 1280 },
  empleados: { name: "Empleados", budget: 1300 },
  colegio_actividades: { name: "Colegio y Actividades", budget: 2360 },
  seguros: { name: "Seguros", budget: 1150 },
  comida: { name: "Comida", budget: 950 },
  restaurantes: { name: "Restaurantes", budget: 550 },
  carros: { name: "Carros", budget: 565 },
  usa: { name: "USA (Mamá, TMobile, Universidad)", budget: 1150 },
  gastos_libres: { name: "Gastos Libres (Otros)", budget: 1300 },
};

const DEMO_FLUJO_CATEGORIES = {
  servicios_basicos: { name: "Servicios Básicos", budget: 145 },
  comida: { name: "Alimentación", budget: 350 },
  restaurantes: { name: "Restaurantes", budget: 200 },
  transporte: { name: "Transporte", budget: 120 },
  entretenimiento: { name: "Entretenimiento", budget: 100 },
  otros: { name: "Otros Gastos", budget: 100 },
};

export default function Dashboard() {
  const { getAuthHeaders, user } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [categoryData, setCategoryData] = useState([]);
  const [porRevisarCount, setPorRevisarCount] = useState(0);
  const [period, setPeriod] = useState("month");
  const [loading, setLoading] = useState(true);

  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [ruleEstablishment, setRuleEstablishment] = useState("");

  const getAuthHeadersRef = useRef(getAuthHeaders);
  useEffect(() => { getAuthHeadersRef.current = getAuthHeaders; });

  const fetchData = useCallback(async () => {
    try {
      const headers = getAuthHeadersRef.current();
      const [statsRes, txRes] = await Promise.all([
        axios.get(`${API}/dashboard/stats?period=${period}`, { headers }),
        axios.get(`${API}/transactions?limit=5000`, { headers })
          .catch(() => ({ data: [] })),
      ]);

      setStats(statsRes.data);

      const allTxRaw = txRes.data?.transactions
        || txRes.data?.items
        || (Array.isArray(txRes.data) ? txRes.data : []);
      setPorRevisarCount(
        allTxRaw.filter(t => t.status === "pending" || t.status === "pending_review").length
      );

      const byCategory = statsRes.data?.by_category || {};
      const categoriesSrc = user?.email?.includes("demo")
        ? DEMO_FLUJO_CATEGORIES
        : DEFAULT_FLUJO_CATEGORIES;
      const transformed = Object.entries(categoriesSrc).map(([key, config]) => ({
        key,
        name: config.name,
        value: byCategory[key] || 0,
        budget: config.budget,
      })).filter(d => d.value > 0);
      setCategoryData(transformed);
    } catch {
      toast.error("Error al cargar datos del dashboard");
    } finally {
      setLoading(false);
    }
  }, [period, user?.email]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const sortedCategoryData = useMemo(
    () => [...categoryData].sort((a, b) => (b.value || 0) - (a.value || 0)),
    [categoryData]
  );

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

      {/* Sección 1 — Balance hero */}
      <Card className="bento-card" data-testid="balance-hero-card">
        <CardContent className="p-6 sm:p-8">
          <p className="text-xs text-slate-400 uppercase tracking-wide">Balance del mes</p>
          <p
            className={`text-4xl sm:text-5xl font-bold tracking-tight mt-1 ${
              stats?.balance >= 0 ? "text-slate-800" : "text-red-600"
            }`}
            data-testid="dashboard-balance-hero"
          >
            {formatCurrency(stats?.balance)}
          </p>
          <p className="text-sm text-slate-500 mt-3" data-testid="dashboard-income-expenses-line">
            <span className="text-emerald-600 font-medium">+{formatCurrency(stats?.total_income)}</span>
            <span className="px-2 text-slate-300">·</span>
            <span className="text-slate-700 font-medium">{formatCurrency(stats?.monthly_total || stats?.total_expenses)}</span>
            <span className="ml-1.5 text-slate-400">gastos</span>
          </p>
          <p className="text-xs text-slate-400 mt-2" data-testid="dashboard-daily-average">
            Promedio diario {formatCurrency(stats?.daily_average)}
          </p>
        </CardContent>
      </Card>

      {/* Sección 2 — Gastos este mes por categoría */}
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
              {rows.map((cat) => {
                const pct = totalSpent > 0 ? Math.round((cat.value / totalSpent) * 100) : 0;
                return (
                  <div
                    key={cat.key}
                    className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 items-center"
                    data-testid={`category-row-${cat.key}`}
                  >
                    <span className="text-sm font-medium text-slate-800 truncate">{cat.name}</span>
                    <span className="text-sm font-mono text-slate-600 tabular-nums">
                      {formatCurrency(cat.value)}
                    </span>
                    <Progress
                      value={pct}
                      className="h-2 [&>div]:bg-[#0D9E82] col-start-1"
                    />
                    <span className="text-xs text-slate-500 tabular-nums col-start-2">
                      {pct}%
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })()}

      {/* Sección 3 — Movimientos por revisar */}
      {porRevisarCount > 0 && (
        <Card
          className="bento-card cursor-pointer hover:bg-slate-50 transition-colors focus-visible:ring-2 focus-visible:ring-[#0D9E82] focus-visible:outline-none"
          onClick={() => navigate("/movimientos?tab=por-revisar")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              navigate("/movimientos?tab=por-revisar");
            }
          }}
          data-testid="por-revisar-card"
        >
          <CardContent className="p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="shrink-0 h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center">
                <LucideClock size={18} className="text-[#0D9E82]" />
              </div>
              <div className="min-w-0">
                <p className="text-base font-semibold text-slate-900" data-testid="por-revisar-count">
                  {porRevisarCount} {porRevisarCount === 1 ? "movimiento" : "movimientos"} por revisar
                </p>
                <p className="text-xs text-slate-500">Abre Movimientos para aprobarlos</p>
              </div>
            </div>
            <Badge variant="outline" className="border-slate-200 text-slate-600 shrink-0">
              Ver →
            </Badge>
          </CardContent>
        </Card>
      )}

      <AutoRuleModal
        open={ruleModalOpen}
        onOpenChange={setRuleModalOpen}
        establishment={ruleEstablishment}
        onCreated={() => fetchData()}
      />
    </div>
  );
}
