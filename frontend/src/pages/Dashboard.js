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
    if (t === "subscription_review") navigate("/transactions");
    else if (t === "card_payment") navigate("/deudas");
    else if (t === "payment_due") navigate("/flujo");
    else if (t === "insurance_reminder") navigate("/cargar-validar");
    else navigate("/presupuesto");
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
      case "low": return "bg-slate-50 dark:bg-slate-800 border-slate-200 text-[#0F766E] dark:text-slate-200";
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
      color: "text-[#0F766E]"
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
            ¡Hola {user?.name?.split(" ")[0]}! Aquí está tu resumen financiero
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

      {/* Smart Notifications Banner (SESIÓN 10) */}
      {(() => {
        const visible = notificaciones.filter(n => !dismissedIds.includes(n.id));
        if (visible.length === 0) return null;
        const shown = showAllNotif ? visible : visible.slice(0, 3);
        const priorityColor = {
          high: "bg-red-50 border-red-200 text-red-900 dark:bg-red-950/30 dark:border-red-800 dark:text-red-200",
          medium: "bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-200",
          low: "bg-slate-50 border-slate-200 text-[#0F766E] dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200",
        };
        return (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2" data-testid="notificaciones-banner">
            {shown.map((n) => {
              const borderColor = n.prioridad === "high" ? "border-l-[#DC2626]" : n.prioridad === "medium" ? "border-l-amber-500" : "border-l-blue-500";
              const iconColor = n.prioridad === "high" ? "text-[#DC2626]" : n.prioridad === "medium" ? "text-amber-600" : "text-[#0F766E]";
              return (
              <div
                key={n.id}
                data-testid={`notif-${n.tipo}`}
                className={`bg-white border border-slate-200 border-l-4 ${borderColor} rounded-md shadow-sm p-4 flex items-center justify-between gap-4`}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <LucideBell size={18} className={`shrink-0 ${iconColor}`} />
                  <div className="min-w-0">
                    <p className="font-medium truncate text-slate-900">{n.titulo}</p>
                    <p className="text-sm text-slate-600 truncate">{n.texto}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {n.accion_url && (
                    <Button size="sm" variant="outline" onClick={() => handleNotifAction(n)} data-testid={`notif-action-${n.id}`} className="border-slate-200 text-slate-700 hover:bg-slate-50">
                      {n.accion_label || "Ver"}
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-slate-700" onClick={() => dismissNotif(n.id)} data-testid={`notif-dismiss-${n.id}`}>
                    <X size={16} />
                  </Button>
                </div>
              </div>
              );
            })}
            {visible.length > 3 && (
              <button
                onClick={() => setShowAllNotif(!showAllNotif)}
                className="text-sm text-primary hover:underline px-1"
                data-testid="show-more-notif"
              >
                {showAllNotif ? "Colapsar" : `Ver más (${visible.length - 3})`}
              </button>
            )}
          </motion.div>
        );
      })()}

      {/* Subscription Renewals This Week */}
      {subscriptionRenewals.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2"
          data-testid="subscriptions-this-week"
        >
          <p className="text-sm font-medium text-muted-foreground px-1 flex items-center gap-2">
            <LucideRefreshCw size={14} /> Esta semana ({subscriptionRenewals.length})
          </p>
          {subscriptionRenewals.map((sub) => (
            <div 
              key={`sub-${sub.gmail_id || sub.comercio}`}
              className="bg-white border border-slate-200 border-l-4 border-l-amber-500 rounded-md shadow-sm p-4 flex items-center justify-between gap-4"
              data-testid={`subscription-renewal-${sub.comercio}`}
            >
              <div className="flex items-center gap-3 flex-1">
                <div className="p-2 rounded-md bg-amber-50 text-amber-700">
                  <LucideRefreshCw size={18} />
                </div>
                <div>
                  <p className="font-medium">{sub.comercio || "Suscripcion"}</p>
                  <p className="text-sm opacity-80" data-testid={`renewal-text-${sub.comercio}`}>
                    {typeof sub.days_until_renewal === "number"
                      ? (sub.days_until_renewal === 0
                          ? "Se renueva hoy"
                          : `Se renueva en ${sub.days_until_renewal} ${sub.days_until_renewal === 1 ? "día" : "días"}`)
                      : (sub.proxima_renovacion ? `Renueva el ${sub.proxima_renovacion}` : "Suscripcion activa")}
                    {sub.monto ? ` — $${sub.monto.toFixed(2)}` : ""}
                  </p>
                </div>
              </div>
              <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 text-xs shrink-0">
                Suscripcion
              </Badge>
            </div>
          ))}
        </motion.div>
      )}

      {/* Stats Grid - Responsive */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
        {statCards.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
          >
            <Card className="bento-card hover:-translate-y-1 transition-all duration-300">
              <CardContent className="p-3 sm:p-6">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground mb-1 truncate">{stat.title}</p>
                    <p className={`text-base sm:text-xl lg:text-2xl font-bold ${stat.color} truncate`}>
                      {formatCurrency(stat.value)}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Este mes</p>
                  </div>
                  <div className={`p-2 rounded-xl bg-muted ${stat.color} shrink-0`}>
                    <stat.icon size={18} weight="duotone" className="sm:w-5 sm:h-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Esta Semana Widget (SESIÓN 10) */}
      {estaSemana.length > 0 && (
        <Card className="bento-card" data-testid="esta-semana-widget">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                <CalendarBlank size={18} weight="duotone" />
              </div>
              <div>
                <p className="text-sm font-medium">Esta semana</p>
                <p className="text-xs text-muted-foreground">Próximos pagos y límites de presupuesto</p>
              </div>
            </div>
            <div className="space-y-2">
              {estaSemana.map((item) => (
                <button
                  key={item.id}
                  onClick={() => navigate(item.accion_url)}
                  className="w-full flex items-center justify-between gap-3 p-3 rounded-md border border-slate-200 hover:bg-slate-50 transition-colors text-left"
                  data-testid={`esta-semana-item-${item.tipo}`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <LucideClock size={18} className="shrink-0 text-slate-500" />
                    <div className="min-w-0">
                      <p className="font-medium truncate text-sm text-slate-900">{item.titulo}</p>
                      <p className="text-xs text-slate-500 truncate">{item.texto}</p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={`shrink-0 text-[10px] ${
                      item.badge === "red"
                        ? "bg-red-50 text-[#DC2626] border-red-200"
                        : "bg-amber-50 text-amber-700 border-amber-200"
                    }`}
                    data-testid={`esta-semana-badge-${item.badge}`}
                  >
                    {item.days_until <= 2 ? "Urgente" : item.days_until <= 7 ? `En ${item.days_until}d` : "Pendiente"}
                  </Badge>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* SRI Deductible Widget */}
      <Card className="bento-card" data-testid="sri-deductible-widget">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 shrink-0">
                <Receipt size={18} weight="duotone" />
              </div>
              <div>
                <p className="text-sm font-medium">Gastos deducibles SRI {new Date().getFullYear()}</p>
                <p className="text-xs text-muted-foreground" data-testid="sri-limit-explanation">
                  Tu límite: <strong>{formatCurrency(sriLimits.limite_efectivo)}</strong>
                  {sriLimits.limite_20pct > 0 && (
                    <> (20% de {formatCurrency(sriLimits.ingresos_gravados_anual)} = {formatCurrency(sriLimits.limite_20pct)})</>
                  )}
                  {" — "}Tope legal: <strong>{formatCurrency(sriLimits.limite_legal)}</strong>
                </p>
              </div>
            </div>
            <span className="text-lg font-bold font-mono text-emerald-600">
              {formatCurrency(sriDeductible)}
            </span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{formatCurrency(sriDeductible)} de {formatCurrency(sriLimits.limite_efectivo)} máx.</span>
              <span className={sriDeductible > sriLimits.limite_efectivo ? "text-amber-600 font-semibold" : ""}>
                {sriLimits.limite_efectivo > 0 ? Math.min(100, Math.round((sriDeductible / sriLimits.limite_efectivo) * 100)) : 0}%
              </span>
            </div>
            <Progress 
              value={sriLimits.limite_efectivo > 0 ? Math.min(100, (sriDeductible / sriLimits.limite_efectivo) * 100) : 0} 
              className={`h-2 ${sriDeductible > sriLimits.limite_efectivo ? "[&>div]:bg-amber-500" : "[&>div]:bg-emerald-500"}`}
            />
          </div>
        </CardContent>
      </Card>

      {/* SRI Match Counters (4 buckets) */}
      <Card className="bento-card" data-testid="sri-match-counters">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-slate-100 text-[#0F766E] dark:bg-slate-800 dark:text-[#0F766E] shrink-0">
                <Receipt size={18} weight="duotone" />
              </div>
              <div>
                <p className="text-sm font-medium">Match Factura ↔ Consumo</p>
                <p className="text-xs text-muted-foreground">Estado de respaldo SRI de tus transacciones</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => navigate("/sri-match")}
              data-testid="sri-match-details-btn"
            >
              Ver detalles
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button
              onClick={() => navigate("/sri-match?tab=con_respaldo")}
              className="flex flex-col items-center p-3 rounded-md border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
              data-testid="counter-con-respaldo"
            >
              <LucideCheckCircle size={22} className="mb-1 text-[#16A34A]" />
              <span className="text-xl font-bold text-slate-900">{sriCounters.con_respaldo}</span>
              <span className="text-[11px] text-slate-500 text-center">Con respaldo</span>
            </button>
            <button
              onClick={() => navigate("/sri-match?tab=match_aproximado")}
              className="flex flex-col items-center p-3 rounded-md border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
              data-testid="counter-aproximado"
            >
              <LucideRefreshCw size={22} className="mb-1 text-amber-600" />
              <span className="text-xl font-bold text-slate-900">{sriCounters.match_aproximado}</span>
              <span className="text-[11px] text-slate-500 text-center">Match aproximado</span>
            </button>
            <button
              onClick={() => navigate("/sri-match?tab=pendiente")}
              className="flex flex-col items-center p-3 rounded-md border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
              data-testid="counter-pendiente"
            >
              <LucideClock size={22} className="mb-1 text-[#0F766E]" />
              <span className="text-xl font-bold text-slate-900">{sriCounters.pendiente_match}</span>
              <span className="text-[11px] text-slate-500 text-center">Esperando match</span>
            </button>
            <button
              onClick={() => navigate("/sri-match?tab=sin_vincular")}
              className="flex flex-col items-center p-3 rounded-md border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
              data-testid="counter-sin-vincular"
            >
              <LucideAlertTriangle size={22} className="mb-1 text-[#DC2626]" />
              <span className="text-xl font-bold text-slate-900">{sriCounters.sin_vincular}</span>
              <span className="text-[11px] text-slate-500 text-center">Sin vincular</span>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Charts Row - Responsive */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        {/* Area Chart - Money Flow */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Card className="bento-card h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-base sm:text-lg">Flujo de Dinero</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Ingresos vs Gastos</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[250px] sm:h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                      tickFormatter={(val) => val?.slice(5) || val}
                    />
                    <YAxis 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} 
                      width={60}
                      tickFormatter={(val) => `$${(val/1000).toFixed(0)}k`}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        background: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px'
                      }}
                      formatter={(value) => formatCurrency(value)}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="income" 
                      name="Ingresos"
                      stroke="#22c55e" 
                      fillOpacity={1} 
                      fill="url(#colorIncome)" 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="expenses" 
                      name="Gastos"
                      stroke="#ef4444" 
                      fillOpacity={1} 
                      fill="url(#colorExpenses)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Bar Chart - Categories from Flujo */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <Card className="bento-card h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-base sm:text-lg">Gastos por Categoría</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Según tu presupuesto (Flujos)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[250px] sm:h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      type="number" 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                      tickFormatter={(val) => `$${(val/1000).toFixed(0)}k`}
                    />
                    <YAxis 
                      type="category" 
                      dataKey="name" 
                      width={100}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        background: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px'
                      }}
                      formatter={(value) => formatCurrency(value)}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${entry.key}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Transactions Count */}
        <Card className="bento-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Transacciones este mes</p>
                <p className="text-2xl font-bold">{stats?.transaction_count || 0}</p>
              </div>
              <Badge variant="secondary">{period === "month" ? "Este mes" : period}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Top Category */}
        <Card className="bento-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Mayor gasto</p>
                <p className="text-lg font-bold truncate">
                  {categoryData[0]?.name || "Sin datos"}
                </p>
              </div>
              <span className="font-mono font-semibold text-red-500">
                {formatCurrency(categoryData[0]?.value || 0)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Savings Rate */}
        <Card className="bento-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tasa de ahorro</p>
                <p className={`text-2xl font-bold ${
                  stats?.total_income > 0 && stats?.balance > 0 
                    ? "text-emerald-600" 
                    : "text-red-500"
                }`}>
                  {stats?.total_income > 0 
                    ? `${((stats?.balance / stats?.total_income) * 100).toFixed(0)}%`
                    : "0%"
                  }
                </p>
              </div>
              <CheckCircle 
                size={32} 
                weight="fill" 
                className={stats?.balance > 0 ? "text-emerald-500" : "text-red-400"} 
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cashflow Projection Widget - Full Width */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4 }}
      >
        <Card className="bento-card bg-white border border-slate-200 border-l-4 border-l-[#0F766E] shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2 text-slate-900">
              <TrendUp size={20} className="text-[#0F766E]" weight="duotone" />
              Flujo Proyectado (30 días)
            </CardTitle>
            <CardDescription>Proyección de ingresos y gastos</CardDescription>
          </CardHeader>
          <CardContent>
            {cashflowProjection ? (
              <div className="space-y-4">
                {/* Summary */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg bg-white/60 dark:bg-black/20 text-center">
                    <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                      <ArrowUp size={12} className="text-emerald-500" />
                      Ingresos
                    </p>
                    <p className="text-lg font-bold text-emerald-600">
                      {formatCurrency(cashflowProjection.total_expected_income || 0)}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-white/60 dark:bg-black/20 text-center">
                    <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                      <ArrowDown size={12} className="text-red-500" />
                      Gastos
                    </p>
                    <p className="text-lg font-bold text-red-600">
                      {formatCurrency(cashflowProjection.total_scheduled_payments || 0)}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-white/60 dark:bg-black/20 text-center">
                    <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                      <Wallet size={12} className="text-[#0F766E]" />
                      Neto
                    </p>
                    <p className={`text-lg font-bold ${
                      (cashflowProjection.net_projection || 0) >= 0 
                        ? "text-emerald-600" 
                        : "text-red-600"
                    }`}>
                      {formatCurrency(cashflowProjection.net_projection || 0)}
                    </p>
                  </div>
                </div>

                {/* Upcoming Items */}
                {cashflowProjection.upcoming_items?.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Próximos movimientos:</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {cashflowProjection.upcoming_items.slice(0, 6).map((item, idx) => (
                        <div 
                          key={`upcoming-${item.description}-${item.amount}`} 
                          className="flex items-center justify-between p-2 rounded-lg bg-white/40 dark:bg-black/10"
                        >
                          <div className="flex items-center gap-2">
                            {item.type === "income" ? (
                              <ArrowUp size={14} className="text-emerald-500" />
                            ) : (
                              <ArrowDown size={14} className="text-red-500" />
                            )}
                            <span className="text-sm truncate max-w-[120px]">{item.description}</span>
                          </div>
                          <div className="text-right">
                            <span className={`text-sm font-semibold ${
                              item.type === "income" ? "text-emerald-600" : "text-red-600"
                            }`}>
                              {item.type === "income" ? "+" : "-"}{formatCurrency(item.amount)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Link to="/flujo">
                  <Button variant="outline" size="sm" className="w-full mt-2">
                    Ver Planificación Completa
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <Clock size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">No hay proyección disponible</p>
                <Link to="/flujo">
                  <Button variant="outline" size="sm" className="mt-3">
                    Configurar Flujo
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Gastos por Categoría - Burbujas de Progreso */}
      {categoryData.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
        >
          <Card className="bento-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Receipt size={20} className="text-[#0F766E]" weight="duotone" />
                Gastos por Categoría
              </CardTitle>
              <CardDescription>Progreso vs presupuesto mensual</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {/* Burbuja especial de Viajes - conectada al fondo */}
                {travelFund && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-4 rounded-md bg-white border border-slate-200 border-l-4 border-l-[#0F766E] shadow-sm"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm flex items-center gap-2 text-slate-900">
                        <Airplane size={16} className="text-[#0F766E]" />
                        Viajes
                      </span>
                      <Badge variant="outline" className="text-xs border-slate-200 text-slate-600">
                        Meta
                      </Badge>
                    </div>
                    
                    <div className="space-y-2">
                      <Progress 
                        value={travelFund.savings_progress || 0} 
                        className="h-3 [&>div]:bg-[#0F766E]"
                      />
                      
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-bold text-slate-900">
                          {formatCurrency(travelFund.monthly_suggested_saving || 0)}
                        </span>
                        <span className="text-xs text-slate-500">
                          /mes
                        </span>
                      </div>
                      
                      <p className="text-xs text-slate-500">
                        {(travelFund.savings_progress || 0).toFixed(0)}% ahorrado de {formatCurrency(travelFund.annual_budget)}
                      </p>
                      
                      <Link to="/viajes">
                        <Button variant="ghost" size="sm" className="w-full h-7 text-xs text-[#0F766E] hover:text-[#0D6B63] hover:bg-slate-50">
                          Ver fondo
                        </Button>
                      </Link>
                    </div>
                  </motion.div>
                )}

                {sortedCategoryData
                  .map((cat, index) => {
                    const percentage = cat.budget > 0 ? (cat.value / cat.budget) * 100 : 0;
                    const isOverBudget = percentage > 100;
                    const isNearLimit = percentage >= 80 && percentage <= 100;
                    
                    return (
                      <motion.div
                        key={cat.key}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.05 }}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          isOverBudget 
                            ? "border-red-300 bg-red-50/50 dark:bg-red-950/20" 
                            : isNearLimit
                              ? "border-amber-300 bg-amber-50/50 dark:bg-amber-950/20"
                              : "border-transparent bg-muted/30"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm truncate flex-1">{cat.name}</span>
                          {isOverBudget && (
                            <Badge variant="destructive" className="text-xs ml-2">
                              +{(percentage - 100).toFixed(0)}%
                            </Badge>
                          )}
                        </div>
                        
                        <div className="space-y-2">
                          <Progress 
                            value={Math.min(percentage, 100)} 
                            className={`h-3 ${isOverBudget ? "[&>div]:bg-red-500" : isNearLimit ? "[&>div]:bg-amber-500" : ""}`}
                          />
                          
                          <div className="flex justify-between items-center">
                            <span className={`text-lg font-bold ${
                              isOverBudget ? "text-red-600" : "text-foreground"
                            }`}>
                              {formatCurrency(cat.value)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              / {formatCurrency(cat.budget)}
                            </span>
                          </div>
                          
                          {cat.budget > 0 && (
                            <p className={`text-xs ${
                              isOverBudget 
                                ? "text-red-600" 
                                : isNearLimit 
                                  ? "text-amber-600" 
                                  : "text-muted-foreground"
                            }`}>
                              {isOverBudget 
                                ? `Excedido por ${formatCurrency(cat.value - cat.budget)}`
                                : `Disponible: ${formatCurrency(cat.budget - cat.value)}`
                              }
                            </p>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
              </div>
              
              <Link to="/budget" className="block mt-4">
                <Button variant="outline" size="sm" className="w-full">
                  Ver Presupuesto Completo
                </Button>
              </Link>
            </CardContent>
          </Card>
        </motion.div>
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
