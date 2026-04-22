import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Progress } from "../components/ui/progress";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { toast } from "sonner";
import AutoRuleModal from "../components/AutoRuleModal";
import { 
  ArrowUp, 
  ArrowDown, 
  Wallet, 
  CalendarBlank,
  Bell,
  Warning,
  CheckCircle,
  CreditCard,
  FirstAid,
  Sparkle,
  X,
  TrendUp,
  Clock,
  Airplane,
  Receipt
} from "@phosphor-icons/react";
import {
  CheckCircle as LucideCheckCircle,
  RefreshCw as LucideRefreshCw,
  Clock as LucideClock,
  AlertTriangle as LucideAlertTriangle,
  Target as LucideTarget,
  FileText as LucideFileText,
  Bell as LucideBell,
} from "lucide-react";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from "recharts";

import { components, typography } from "../styles/design-system";
const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Default categories (will be overridden by backend for demo users)
const DEFAULT_FLUJO_CATEGORIES = {
  servicios_basicos: { name: "Servicios Básicos", color: "#8b5cf6", budget: 1280 },
  empleados: { name: "Empleados", color: "#06b6d4", budget: 1300 },
  colegio_actividades: { name: "Colegio y Actividades", color: "#3b82f6", budget: 2360 },
  seguros: { name: "Seguros", color: "#ec4899", budget: 1150 },
  comida: { name: "Comida", color: "#22c55e", budget: 950 },
  restaurantes: { name: "Restaurantes", color: "#f97316", budget: 550 },
  carros: { name: "Carros", color: "#ef4444", budget: 565 },
  usa: { name: "USA (Mamá, TMobile, Universidad)", color: "#6366f1", budget: 1150 },
  gastos_libres: { name: "Gastos Libres (Otros)", color: "#f59e0b", budget: 1300 }
};

// Demo user categories (simpler/smaller)
const DEMO_FLUJO_CATEGORIES = {
  servicios_basicos: { name: "Servicios Básicos", color: "#8b5cf6", budget: 145 },
  comida: { name: "Alimentación", color: "#22c55e", budget: 350 },
  restaurantes: { name: "Restaurantes", color: "#f97316", budget: 200 },
  transporte: { name: "Transporte", color: "#ef4444", budget: 120 },
  entretenimiento: { name: "Entretenimiento", color: "#14b8a6", budget: 100 },
  otros: { name: "Otros Gastos", color: "#f59e0b", budget: 100 }
};

export default function Dashboard() {
  const { getAuthHeaders, user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [dismissedReminders, setDismissedReminders] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [cashflowProjection, setCashflowProjection] = useState(null);
  const [travelGoals, setTravelGoals] = useState([]);
  const [period, setPeriod] = useState("month");
  const [loading, setLoading] = useState(true);

  // Select categories based on user type
  const isDemo = user?.role === "demo" || user?.email === "demo@fintrack.ec";
  const FLUJO_CATEGORIES = isDemo ? DEMO_FLUJO_CATEGORIES : DEFAULT_FLUJO_CATEGORIES;

  // Function to dismiss a reminder
  const dismissReminder = (index) => {
    setDismissedReminders([...dismissedReminders, index]);
  };

  // Filter out dismissed reminders
  const visibleReminders = reminders.filter((_, index) => !dismissedReminders.includes(index));
  const [showAllReminders, setShowAllReminders] = useState(false);

  const handleReminderAction = (reminder) => {
    const t = reminder.type;
    if (t === "subscription_review") navigate("/movimientos?tab=todos");
    else if (t === "gmail_pending_review") navigate("/movimientos?tab=por-revisar");
    else if (t === "payment_due") navigate("/mi-dinero?tab=flujo");
    else if (t === "insurance_reminder") navigate("/movimientos?tab=por-revisar");
    else if (t === "card_payment") navigate("/deudas");
    else navigate("/mi-dinero?tab=presupuesto");
  };

  const [travelFund, setTravelFund] = useState(null);
  const [sriDeductible, setSriDeductible] = useState(0);
  const [sriLimits, setSriLimits] = useState({ limite_20pct: 0, limite_legal: 2784, limite_efectivo: 2784, ingresos_gravados_anual: 0 });
  const [sriCounters, setSriCounters] = useState({ con_respaldo: 0, match_aproximado: 0, pendiente_match: 0, sin_vincular: 0 });
  const [subscriptionRenewals, setSubscriptionRenewals] = useState([]);
  const [notificaciones, setNotificaciones] = useState([]);
  const [estaSemana, setEstaSemana] = useState([]);
  const [dismissedIds, setDismissedIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem("dismissed_notif_ids") || "[]"); } catch { return []; }
  });
  const [showAllNotif, setShowAllNotif] = useState(false);
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [ruleEstablishment, setRuleEstablishment] = useState("");
  const [porRevisarCount, setPorRevisarCount] = useState(0);

  const dismissNotif = (id) => {
    const next = [...new Set([...dismissedIds, id])];
    setDismissedIds(next);
    localStorage.setItem("dismissed_notif_ids", JSON.stringify(next));
  };

  const handleNotifAction = (n) => {
    if (n.tipo === "sugerir_filtro") {
      setRuleEstablishment(n.establishment || n.titulo.replace(/^Crear regla para ['"]|['"]$/g, ""));
      setRuleModalOpen(true);
      return;
    }
    if (n.accion_url) navigate(n.accion_url);
  };

  const getAuthHeadersRef = useRef(getAuthHeaders);
  useEffect(() => { getAuthHeadersRef.current = getAuthHeaders; });

  const fetchData = useCallback(async () => {
    try {
      const headers = getAuthHeadersRef.current();
      const [statsRes, chartRes, remindersRes, cashflowRes, goalsRes, fundRes, txRes, subsRes, sriRes, sriLimitsRes, notifRes, semanaRes] = await Promise.all([
        axios.get(`${API}/dashboard/stats`, { headers }),
        axios.get(`${API}/dashboard/chart-data?period=${period}`, { headers }),
        axios.get(`${API}/reminders`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API}/cashflow/projection`, { headers }).catch(() => ({ data: null })),
        axios.get(`${API}/travel-goals`, { headers }).catch(() => ({ data: { goals: [] } })),
        axios.get(`${API}/travel-fund`, { headers }).catch(() => ({ data: null })),
        axios.get(`${API}/transactions?limit=5000`, { headers }).catch(() => ({ data: { transactions: [] } })),
        axios.get(`${API}/dashboard/subscription-renewals`, { headers }).catch(() => ({ data: { upcoming_this_week: [] } })),
        axios.get(`${API}/sri/counters`, { headers }).catch(() => ({ data: { con_respaldo: 0, match_aproximado: 0, pendiente_match: 0, sin_vincular: 0 } })),
        axios.get(`${API}/sri/deduction-limits`, { headers }).catch(() => ({ data: null })),
        axios.get(`${API}/notificaciones`, { headers }).catch(() => ({ data: { notificaciones: [] } })),
        axios.get(`${API}/dashboard/esta-semana`, { headers }).catch(() => ({ data: { items: [] } }))
      ]);
      
      setStats(statsRes.data);
      setChartData(chartRes.data.data);
      setReminders(remindersRes.data);
      setCashflowProjection(cashflowRes.data);
      setTravelFund(fundRes.data);
      const goalsData = goalsRes.data?.goals || [];
      setTravelGoals(goalsData.filter(g => g.status === "active").slice(0, 2));
      
      // Transacciones por revisar (status === 'pending' o 'pending_review')
      const allTxRaw = txRes.data?.transactions || txRes.data?.items || (Array.isArray(txRes.data) ? txRes.data : []);
      setPorRevisarCount(allTxRaw.filter(t => t.status === "pending" || t.status === "pending_review").length);

      // Transform category data to match Flujo categories with budgets
      const byCategory = statsRes.data?.by_category || {};
      // Use demo categories for demo users, default categories for others
      const categories = user?.email?.includes('demo') ? DEMO_FLUJO_CATEGORIES : DEFAULT_FLUJO_CATEGORIES;
      const transformed = Object.entries(categories).map(([key, config]) => {
        const spent = byCategory[key] || 0;
        const budget = config.budget;
        const percentage = budget > 0 ? Math.round((spent / budget) * 100) : 0;
        return {
          name: config.name,
          value: spent,
          budget: budget,
          percentage: percentage,
          color: config.color,
          key
        };
      }).filter(d => d.value > 0 || d.budget > 0);
      
      setCategoryData(transformed);

      // Calculate SRI deductible total for the year
      const allTx = txRes.data?.transactions || txRes.data?.items || (Array.isArray(txRes.data) ? txRes.data : []);
      const currentYear = new Date().getFullYear();
      const deductibleTotal = allTx
        .filter(t => t.is_deductible && t.status === "approved" && new Date(t.date).getFullYear() === currentYear)
        .reduce((sum, t) => sum + (t.amount || 0), 0);
      setSriDeductible(deductibleTotal);

      // Subscription renewals
      setSubscriptionRenewals(subsRes.data?.upcoming_this_week || []);
      // Notificaciones inteligentes (SESIÓN 10)
      setNotificaciones(notifRes.data?.notificaciones || []);
      setEstaSemana(semanaRes.data?.items || []);
      // SRI match counters
      setSriCounters(sriRes.data || { con_respaldo: 0, match_aproximado: 0, pendiente_match: 0, sin_vincular: 0 });
      // SRI limits (dynamic)
      if (sriLimitsRes.data) {
        setSriLimits({
          limite_20pct: sriLimitsRes.data.limite_20pct || 0,
          limite_legal: sriLimitsRes.data.limite_legal || 2784,
          limite_efectivo: sriLimitsRes.data.limite_efectivo || 2784,
          ingresos_gravados_anual: sriLimitsRes.data.ingresos_gravados_anual || 0,
        });
        setSriDeductible(sriLimitsRes.data.total_deductible_spent || 0);
      }
    } catch (error) {
      toast.error("Error al cargar datos del dashboard");
    } finally {
      setLoading(false);
    }
  }, [period, user?.email]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const sortedCategoryData = useMemo(() => 
    categoryData
      .filter(cat => cat.budget > 0 || cat.value > 0)
      .sort((a, b) => (b.value / (b.budget || 1)) - (a.value / (a.budget || 1))),
    [categoryData]
  );

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-EC', {
      style: 'currency',
      currency: 'USD'
    }).format(value || 0);
  };

  const getReminderIcon = (type) => {
    switch (type) {
      case "payment_due": return Bell;
      case "card_payment": return CreditCard;
      case "subscription_review": return Warning;
      case "insurance_reminder": return FirstAid;
      case "motivation": return Sparkle;
      default: return Bell;
    }
  };

  const getReminderColor = (priority) => {
    switch (priority) {
      case "high": return "bg-red-50 dark:bg-red-900/20 border-red-200 text-red-800 dark:text-red-200";
      case "medium": return "bg-amber-50 dark:bg-amber-900/20 border-amber-200 text-amber-800 dark:text-amber-200";
      case "low": return "bg-slate-50 dark:bg-slate-800 border-slate-200 text-[#0D9E82] dark:text-slate-200";
      default: return "bg-muted";
    }
  };

  const statCards = [
    { 
      title: "Balance Mensual", 
      value: stats?.balance, 
      icon: Wallet,
      color: stats?.balance >= 0 ? "text-emerald-600" : "text-red-500"
    },
    { 
      title: "Ingresos", 
      value: stats?.total_income, 
      icon: ArrowUp,
      color: "text-emerald-600"
    },
    { 
      title: "Gastos del Mes", 
      value: stats?.monthly_total, 
      icon: ArrowDown,
      color: "text-red-500"
    },
    { 
      title: "Promedio Diario", 
      value: stats?.daily_average, 
      icon: CalendarBlank,
      color: "text-[#0D9E82]"
    }
  ];

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
            <span className="mx-2 text-slate-300">·</span>
            <span className="text-slate-700 font-medium">{formatCurrency(stats?.monthly_total || stats?.total_expenses)}</span>
            <span className="ml-1 text-slate-400">gastos</span>
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
          className="bento-card cursor-pointer hover:bg-slate-50 transition-colors"
          onClick={() => navigate("/movimientos?tab=por-revisar")}
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
            <Badge
              variant="outline"
              className="border-slate-200 text-slate-600 shrink-0"
            >
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
