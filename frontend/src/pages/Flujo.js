import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from "../components/ui/alert-dialog";
import { Badge } from "../components/ui/badge";
import { Switch } from "../components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Progress } from "../components/ui/progress";
import { toast } from "sonner";
import { 
  Plus, 
  Pencil, 
  Trash, 
  CalendarBlank,
  CheckCircle,
  Warning,
  Clock,
  CreditCard,
  Bank,
  Money,
  Receipt,
  Bell,
  ArrowRight,
  Lightning,
  Funnel,
  ChartBar,
  CaretDown,
  User
} from "@phosphor-icons/react";
import { PERSONAL_CATEGORIES } from "../constants/categories";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PAYMENT_METHODS = [
  { value: "transferencia", label: "Transferencia", icon: Bank },
  { value: "tarjeta_diners", label: "Tarjeta Diners", icon: CreditCard },
  { value: "tarjeta_pichincha", label: "Tarjeta Pichincha", icon: CreditCard },
  { value: "tarjeta_pacificard", label: "Tarjeta Pacificard", icon: CreditCard },
  { value: "efectivo", label: "Efectivo", icon: Money },
  { value: "venmo", label: "Venmo", icon: Receipt }
];

// Cashflow-only keys (not part of PERSONAL_CATEGORIES) + canonical taxonomy.
// Identity of titular vs adicional (p. ej. KP) vive en entity_tag / nombre de
// tarjeta, no en subcategorías hardcodeadas.
const CATEGORIES = [
  { value: "tarjeta_credito", label: "Pago Tarjeta de Crédito", subcategories: ["Diners", "Pichincha", "Pacificard"] },
  { value: "diferido", label: "Pago Diferido", subcategories: ["Compras a plazos"] },
  ...Object.entries(PERSONAL_CATEGORIES).map(([value, cat]) => ({
    value,
    label: cat.name,
    subcategories: cat.subcategories,
  })),
];

const LEGACY_CATEGORY_LABELS = {
  viajes: PERSONAL_CATEGORIES.viajes_entretenimiento.name,
};

export default function Flujo({ embedded = false } = {}) {
  const { getAuthHeaders, user } = useAuth();

  const getAuthHeadersRef = useRef(getAuthHeaders);
  useEffect(() => { getAuthHeadersRef.current = getAuthHeaders; });
  const [payments, setPayments] = useState([]);
  const [deferredPayments, setDeferredPayments] = useState([]);
  const [budgetData, setBudgetData] = useState(null);
  const [incomeData, setIncomeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [viewMode, setViewMode] = useState("week"); // week, category
  const [filterWeek, setFilterWeek] = useState("all"); // all, week1, week2, week3, week4
  const [deleteTargetId, setDeleteTargetId] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    amount: "",
    due_day: 1,
    category: "",
    subcategory: "",
    payment_method: "transferencia",
    is_recurring: true,
    reminder_days_before: 2,
    minimum_amount: "",
    total_balance: "",
    card_name: ""
  });

  const fetchData = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/scheduled-payments`, { headers: getAuthHeadersRef.current() });
      setPayments(response.data);
    } catch (error) {
      toast.error("Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchBudgetData = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/budget/config`, { headers: getAuthHeadersRef.current() });
      setBudgetData(response.data);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') console.log("Error loading budget data");
    }
  }, []);

  const fetchDeferredPayments = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/deferred-payments`, { headers: getAuthHeadersRef.current() });
      setDeferredPayments(response.data?.payments || []);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') console.log("Error loading deferred payments");
    }
  }, []);

  const fetchIncomeData = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/income/summary`, { headers: getAuthHeadersRef.current() });
      setIncomeData(response.data);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') console.log("Error loading income data");
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchBudgetData();
    fetchDeferredPayments();
    fetchIncomeData();
  }, [fetchData, fetchBudgetData, fetchDeferredPayments, fetchIncomeData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const payload = {
        name: formData.name,
        amount: parseFloat(formData.amount),
        due_day: parseInt(formData.due_day),
        category: formData.category,
        subcategory: formData.subcategory || null,
        payment_method: formData.payment_method,
        is_recurring: formData.is_recurring,
        reminder_days_before: parseInt(formData.reminder_days_before),
        minimum_amount: formData.minimum_amount ? parseFloat(formData.minimum_amount) : null,
        total_balance: formData.total_balance ? parseFloat(formData.total_balance) : null,
        card_name: formData.card_name || null
      };

      if (editingPayment) {
        await axios.put(`${API}/scheduled-payments/${editingPayment.id}`, payload, { headers: getAuthHeadersRef.current() });
        toast.success("Pago actualizado");
      } else {
        await axios.post(`${API}/scheduled-payments`, payload, { headers: getAuthHeadersRef.current() });
        toast.success("Pago programado agregado");
      }

      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al guardar");
    }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`${API}/scheduled-payments/${id}`, { headers: getAuthHeadersRef.current() });
      toast.success("Pago eliminado");
      fetchData();
    } catch (error) {
      toast.error("Error al eliminar");
    } finally {
      setDeleteTargetId(null);
    }
  };

  const handleMarkPaid = async (id) => {
    try {
      await axios.post(`${API}/scheduled-payments/${id}/mark-paid`, {}, { headers: getAuthHeadersRef.current() });
      toast.success("Marcado como pagado");
      fetchData();
    } catch (error) {
      toast.error("Error al marcar como pagado");
    }
  };

  const handleEdit = (payment) => {
    setEditingPayment(payment);
    setFormData({
      name: payment.name,
      amount: payment.amount.toString(),
      due_day: payment.due_day,
      category: payment.category,
      subcategory: payment.subcategory || "",
      payment_method: payment.payment_method,
      is_recurring: payment.is_recurring,
      reminder_days_before: payment.reminder_days_before,
      minimum_amount: payment.minimum_amount?.toString() || "",
      total_balance: payment.total_balance?.toString() || "",
      card_name: payment.card_name || ""
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingPayment(null);
    setFormData({
      name: "",
      amount: "",
      due_day: 1,
      category: "",
      subcategory: "",
      payment_method: "transferencia",
      is_recurring: true,
      reminder_days_before: 2,
      minimum_amount: "",
      total_balance: "",
      card_name: ""
    });
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-EC', {
      style: 'currency',
      currency: 'USD'
    }).format(value || 0);
  };

  const canEdit = user?.role === "admin" || user?.role === "spouse";

  // Group payments by week of month
  const groupByWeek = (payments) => {
    const weeks = {
      week1: { label: "Semana 1 (días 1-7)", payments: [] },
      week2: { label: "Semana 2 (días 8-14)", payments: [] },
      week3: { label: "Semana 3 (días 15-21)", payments: [] },
      week4: { label: "Semana 4 (días 22-31)", payments: [] }
    };

    payments.forEach(p => {
      const day = p.due_day;
      if (day <= 7) weeks.week1.payments.push(p);
      else if (day <= 14) weeks.week2.payments.push(p);
      else if (day <= 21) weeks.week3.payments.push(p);
      else weeks.week4.payments.push(p);
    });

    return weeks;
  };

  // Group payments by category
  const groupByCategory = (payments) => {
    const grouped = {};
    payments.forEach(p => {
      const cat = p.category || "otros";
      if (!grouped[cat]) {
        grouped[cat] = { payments: [], total: 0 };
      }
      grouped[cat].payments.push(p);
      grouped[cat].total += p.amount || 0;
    });
    return grouped;
  };

  // Get category budget from budget data
  const getCategoryBudget = (category) => {
    if (!budgetData?.categories?.[category]) return null;
    const catData = budgetData.categories[category];
    return catData.total || Object.values(catData.subcategories || {}).reduce((sum, val) => sum + (val || 0), 0);
  };

  // Filter payments by week if needed
  const filteredPayments = filterWeek === "all" 
    ? payments 
    : payments.filter(p => {
        const day = p.due_day;
        if (filterWeek === "week1") return day <= 7;
        if (filterWeek === "week2") return day > 7 && day <= 14;
        if (filterWeek === "week3") return day > 14 && day <= 21;
        if (filterWeek === "week4") return day > 21;
        return true;
      });

  const weeks = groupByWeek(filteredPayments);
  const byCategory = groupByCategory(payments);
  const totalMonthly = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  // NOTE: GET /api/income/summary returns `total` as the SUM OF ALL INCOME FOR THE
  // ENTIRE YEAR (no month filter server-side), not a monthly figure. `total_monthly`
  // is not actually returned by the backend today (kept as a forward-compatible
  // fallback). So we divide the annual total by 12 to approximate a monthly figure
  // before deriving a weekly figure (still using the 4-weeks-per-month model used
  // elsewhere on this page).
  const monthlyIncome = incomeData?.total_monthly || (incomeData?.total ? incomeData.total / 12 : 0);
  const weeklyIncome = monthlyIncome / 4;

  // Semaphore: color for weekly card based on projected balance
  const getWeekSemaphore = (weekPayments) => {
    const weekTotal = weekPayments.reduce((s, p) => s + (p.amount || 0), 0);
    const balance = weeklyIncome - weekTotal;
    const ratio = weeklyIncome > 0 ? balance / weeklyIncome : 0;
    if (balance < 0) return { color: "#ef4444", label: "Déficit" };        // red
    if (ratio < 0.20) return { color: "#f59e0b", label: "Ajustado" };       // yellow
    return { color: "#22c55e", label: "Holgado" };                           // green
  };

  // Estimate completion date for a deferred payment
  const getEstimatedEndDate = (dp) => {
    const remaining = dp.remaining_installments || 0;
    const now = new Date();
    const endDate = new Date(now.getFullYear(), now.getMonth() + remaining, now.getDate());
    return endDate.toLocaleDateString("es-EC", { month: "short", year: "numeric" });
  };

  // Get method icon
  const getMethodIcon = (method) => {
    const found = PAYMENT_METHODS.find(m => m.value === method);
    return found?.icon || Receipt;
  };

  // Get category label
  const getCategoryLabel = (cat) => {
    const found = CATEGORIES.find(c => c.value === cat);
    return found?.label || LEGACY_CATEGORY_LABELS[cat] || cat;
  };

  return (
    <div className="space-y-6" data-testid="flujo-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {embedded ? (
          <h2 className="text-lg font-semibold">Planificación de Flujo</h2>
        ) : (
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Planificación de Flujo</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Programa tus pagos y asigna con qué tarjeta/cuenta pagar
            </p>
          </div>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-lg px-4 py-2">
            Total mensual: {formatCurrency(totalMonthly)}
          </Badge>
          {canEdit && (
            <Button onClick={() => setDialogOpen(true)} className="gap-2" data-testid="add-payment-btn">
              <Plus size={18} weight="bold" />
              <span className="hidden sm:inline">Nuevo Pago</span>
            </Button>
          )}
        </div>
      </div>

      {/* View Options and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Tabs value={viewMode} onValueChange={setViewMode} className="flex-1">
          <TabsList>
            <TabsTrigger value="week" className="gap-2">
              <CalendarBlank size={16} />
              Por Semana
            </TabsTrigger>
            <TabsTrigger value="category" className="gap-2">
              <ChartBar size={16} />
              Por Categoría
            </TabsTrigger>
          </TabsList>
        </Tabs>
        
        {viewMode === "week" && (
          <Select value={filterWeek} onValueChange={setFilterWeek}>
            <SelectTrigger className="w-[180px]">
              <Funnel size={16} className="mr-2" />
              <SelectValue placeholder="Filtrar semana" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo el mes</SelectItem>
              <SelectItem value="week1">Semana 1 (1-7)</SelectItem>
              <SelectItem value="week2">Semana 2 (8-14)</SelectItem>
              <SelectItem value="week3">Semana 3 (15-21)</SelectItem>
              <SelectItem value="week4">Semana 4 (22-31)</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {/* VIEW: By Week */}
      {viewMode === "week" && loading && (
        <div className="space-y-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2 animate-pulse">
              <div className="h-5 w-40 bg-slate-200 rounded" />
              <div className="h-16 bg-slate-100 rounded-lg" />
            </div>
          ))}
        </div>
      )}
      {viewMode === "week" && !loading && (
        <div className="space-y-6">
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-red-500" /> Déficit</span>
            <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-amber-500" /> Ajustado</span>
            <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-emerald-500" /> Holgado</span>
          </div>
          {Object.entries(weeks).map(([key, week]) => {
            const semaphore = getWeekSemaphore(week.payments);
            return (
            <div key={key} className="space-y-2">
              {/* Week Header — Parker-style */}
              <div className="flex items-center justify-between mb-2 py-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${semaphore.color === "#ef4444" ? "bg-red-500" : semaphore.color === "#f59e0b" ? "bg-amber-500" : "bg-emerald-500"}`}
                    role="img"
                    aria-label={semaphore.label}
                    title={semaphore.label}
                  />
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">{week.label}</h3>
                  <span className="text-xs text-slate-400">· {semaphore.label}</span>
                  <span className="text-xs text-slate-400 ml-1">({week.payments.length} pagos)</span>
                </div>
                <span className="text-sm font-semibold text-slate-700 font-mono">
                  {formatCurrency(week.payments.reduce((s, p) => s + p.amount, 0))}
                </span>
              </div>

              {/* Payments List */}
              {week.payments.length === 0 ? (
                <Card className="bento-card">
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <CheckCircle size={32} className="mx-auto mb-2 text-emerald-500" />
                    <p>Sin pagos programados esta semana</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="bg-white rounded-lg border border-slate-100">
                  {week.payments.map((payment, index) => {
                    const MethodIcon = getMethodIcon(payment.payment_method);
                    const isPastDue = payment.days_until_due < 0;
                    const isDueSoon = payment.is_due_soon;
                    const CategoryLabel = getCategoryLabel(payment.category);
                    const isCard = payment.payment_method?.includes("tarjeta");

                    return (
                      <motion.div
                        key={payment.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.02 }}
                        className="flex items-center gap-3 px-3 py-2.5 border-b border-slate-100 hover:bg-slate-50 transition-colors"
                        data-testid={`payment-row-${payment.id}`}
                      >
                        <span className={`font-bold w-8 text-center text-sm ${isPastDue ? "text-red-600" : isDueSoon ? "text-amber-600" : "text-slate-700"}`}>
                          {payment.due_day}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm text-slate-700 truncate">{payment.name}</span>
                            {payment.is_recurring && (
                              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">
                                Recurrente
                              </span>
                            )}
                            {isPastDue && (
                              <span className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded-full border border-red-200">
                                Vencido
                              </span>
                            )}
                            {isDueSoon && !isPastDue && (
                              <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
                                {payment.days_until_due}d
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                            <span className="flex items-center gap-1">
                              <MethodIcon size={12} />
                              {PAYMENT_METHODS.find(m => m.value === payment.payment_method)?.label || payment.payment_method}
                            </span>
                            <span>·</span>
                            <span>{CategoryLabel}</span>
                            {payment.subcategory && (
                                <>
                                  <span>•</span>
                                  <span className="text-primary">{payment.subcategory}</span>
                                </>
                              )}
                            </div>
                            {/* Credit card info */}
                            {isCard && (payment.minimum_amount || payment.total_balance) && (
                              <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400">
                                {payment.minimum_amount && (
                                  <span>Mín: {formatCurrency(payment.minimum_amount)}</span>
                                )}
                                {payment.total_balance && (
                                  <span>Saldo: {formatCurrency(payment.total_balance)}</span>
                                )}
                              </div>
                            )}
                          </div>

                          <span className="text-sm font-semibold text-slate-700 shrink-0 font-mono">{formatCurrency(payment.amount)}</span>
                          {canEdit && (
                            <div className="flex gap-0.5 shrink-0">
                              <Button variant="ghost" size="icon" onClick={() => handleEdit(payment)} className="h-10 w-10 text-slate-400 hover:text-slate-600">
                                <Pencil size={18} />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => setDeleteTargetId(payment.id)} className="h-10 w-10 text-slate-400 hover:text-red-500">
                                <Trash size={18} />
                              </Button>
                            </div>
                          )}
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          )})}
        </div>
      )}

      {/* VIEW: By Category */}
      {viewMode === "category" && loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-40 bg-slate-100 rounded-lg animate-pulse" />
          ))}
        </div>
      )}
      {viewMode === "category" && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(byCategory).map(([category, data]) => {
            const budget = getCategoryBudget(category);
            const spent = data.total;
            const percentage = budget ? (spent / budget) * 100 : 0;
            
            return (
              <Card key={category} className="bento-card">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <ChartBar size={18} className="text-primary" />
                      {getCategoryLabel(category)}
                    </CardTitle>
                    <Badge variant="outline" className="font-mono">
                      {formatCurrency(spent)}
                    </Badge>
                  </div>
                  {budget && (
                    <div className="mt-2">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Presupuesto: {formatCurrency(budget)}</span>
                        <span className={percentage > 100 ? "text-red-600" : ""}>{percentage.toFixed(0)}%</span>
                      </div>
                      <Progress 
                        value={Math.min(percentage, 100)} 
                        className={`h-2 ${percentage > 100 ? "[&>div]:bg-red-500" : ""}`} 
                      />
                    </div>
                  )}
                </CardHeader>
                <CardContent className="pt-2">
                  <div className="space-y-2">
                    {data.payments.map((payment) => {
                      const MethodIcon = getMethodIcon(payment.payment_method);
                      return (
                        <div 
                          key={payment.id}
                          className="flex items-center justify-between p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium w-6 h-6 flex items-center justify-center bg-background rounded">
                              {payment.due_day}
                            </span>
                            <div>
                              <p className="text-sm font-medium">{payment.name}</p>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <MethodIcon size={12} />
                                <span>{payment.subcategory || PAYMENT_METHODS.find(m => m.value === payment.payment_method)?.label}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-bold">{formatCurrency(payment.amount)}</span>
                            {canEdit && (
                              <Button variant="ghost" size="icon" onClick={() => handleEdit(payment)} className="h-9 w-9">
                                <Pencil size={16} />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Deferred Payments Progress */}
      {deferredPayments.length > 0 && (
        <Card className="bento-card" data-testid="deferred-progress-section">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard size={20} className="text-primary" />
              Diferidos Activos
            </CardTitle>
            <CardDescription>Progreso de tus compras a plazos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {deferredPayments.map((dp) => {
                const total = dp.total_installments || 1;
                const paid = dp.paid_installments || (total - (dp.remaining_installments || 0));
                const pct = Math.round((paid / total) * 100);
                const remaining = dp.remaining_amount || ((dp.monthly_payment || 0) * (dp.remaining_installments || 0));
                return (
                  <div key={dp.id} className="p-3 rounded-lg bg-muted/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{dp.description}</p>
                        <p className="text-xs text-muted-foreground">{dp.card_name}</p>
                      </div>
                      <Badge variant="outline" className="font-mono text-xs">
                        {formatCurrency(dp.monthly_payment)}/mes
                      </Badge>
                    </div>
                    <Progress value={pct} className="h-2" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Cuota {paid} de {total} — Quedan {formatCurrency(remaining)}</span>
                      <span>Termina {getEstimatedEndDate(dp)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card className="bento-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Lightning size={20} className="text-amber-500" />
            Pagos que vencen pronto
          </CardTitle>
        </CardHeader>
        <CardContent>
          {payments.filter(p => p.is_due_soon).length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              <CheckCircle size={32} className="mx-auto mb-2 text-emerald-500" />
              <p>¡No tienes pagos urgentes!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {payments.filter(p => p.is_due_soon).map((payment) => (
                <div 
                  key={payment.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20"
                >
                  <div className="flex items-center gap-3">
                    <Warning size={20} className="text-amber-600" />
                    <div>
                      <p className="font-medium">{payment.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Vence {payment.days_until_due === 0 ? "hoy" : `en ${payment.days_until_due} días`} • Pagar con {PAYMENT_METHODS.find(m => m.value === payment.payment_method)?.label}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-lg">{formatCurrency(payment.amount)}</span>
                    <Button size="sm" onClick={() => handleMarkPaid(payment.id)} className="gap-1">
                      <CheckCircle size={16} />
                      Pagado
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Payment Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPayment ? "Editar Pago" : "Nuevo Pago Programado"}</DialogTitle>
            <DialogDescription>
              Configura un pago recurrente o único
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre del pago</Label>
              <Input
                placeholder="Ej: Luz, Internet, Colegio..."
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                data-testid="payment-name"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Monto a Pagar</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required
                  data-testid="payment-amount"
                />
              </div>
              <div className="space-y-2">
                <Label>Día del mes</Label>
                <Input
                  type="number"
                  min="1"
                  max="31"
                  value={formData.due_day}
                  onChange={(e) => setFormData({ ...formData, due_day: e.target.value })}
                  required
                  data-testid="payment-day"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Categoría</Label>
                <Select 
                  value={formData.category} 
                  onValueChange={(v) => setFormData({ ...formData, category: v, subcategory: "" })}
                >
                  <SelectTrigger data-testid="payment-category">
                    <SelectValue placeholder="Seleccionar categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Subcategoría</Label>
                <Select 
                  value={formData.subcategory} 
                  onValueChange={(v) => setFormData({ ...formData, subcategory: v })}
                  disabled={!formData.category}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.find(c => c.value === formData.category)?.subcategories?.map((sub) => (
                      <SelectItem key={sub} value={sub}>
                        {sub}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Método de pago / Tarjeta</Label>
              <Select 
                value={formData.payment_method} 
                onValueChange={(v) => setFormData({ ...formData, payment_method: v })}
              >
                <SelectTrigger data-testid="payment-method">
                  <SelectValue placeholder="Seleccionar método" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((method) => (
                    <SelectItem key={method.value} value={method.value}>
                      <span className="flex items-center gap-2">
                        <method.icon size={16} />
                        {method.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Credit Card Info - Only show for credit card payments */}
            {formData.payment_method?.includes("tarjeta") && (
              <Card className="bg-muted/50 border-dashed">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-primary">
                    <CreditCard size={16} />
                    Información de Tarjeta
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Nombre de la tarjeta</Label>
                    <Input
                      placeholder="Ej: Diners Club, Pacificard Black..."
                      value={formData.card_name}
                      onChange={(e) => setFormData({ ...formData, card_name: e.target.value })}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs">Pago Mínimo</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={formData.minimum_amount}
                        onChange={(e) => setFormData({ ...formData, minimum_amount: e.target.value })}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Saldo Total del Mes</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={formData.total_balance}
                        onChange={(e) => setFormData({ ...formData, total_balance: e.target.value })}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Recordar días antes</Label>
                <Input
                  type="number"
                  min="0"
                  max="7"
                  value={formData.reminder_days_before}
                  onChange={(e) => setFormData({ ...formData, reminder_days_before: e.target.value })}
                  data-testid="payment-reminder"
                />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted h-full">
                <span className="text-sm">¿Recurrente?</span>
                <Switch
                  checked={formData.is_recurring}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_recurring: checked })}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="submit" data-testid="save-payment">
                {editingPayment ? "Actualizar" : "Agregar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete AlertDialog */}
      <AlertDialog open={!!deleteTargetId} onOpenChange={(open) => { if (!open) setDeleteTargetId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este pago programado?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTargetId(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleDelete(deleteTargetId)}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
