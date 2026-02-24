import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog";
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

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PAYMENT_METHODS = [
  { value: "transferencia", label: "Transferencia", icon: Bank },
  { value: "tarjeta_diners", label: "Tarjeta Diners", icon: CreditCard },
  { value: "tarjeta_pichincha", label: "Tarjeta Pichincha", icon: CreditCard },
  { value: "tarjeta_pacificard", label: "Tarjeta Pacificard", icon: CreditCard },
  { value: "apple_card", label: "Apple Card", icon: CreditCard },
  { value: "efectivo", label: "Efectivo", icon: Money },
  { value: "venmo", label: "Venmo", icon: Receipt }
];

const CATEGORIES = [
  { value: "tarjeta_credito", label: "Pago Tarjeta de Crédito", subcategories: ["Diners", "Pichincha", "Pacificard", "Apple Card"] },
  { value: "servicios_basicos", label: "Servicios Básicos", subcategories: ["Luz", "Agua", "Internet", "Gas", "Teléfono"] },
  { value: "suscripciones", label: "Suscripciones", subcategories: ["Netflix", "Spotify", "Amazon", "Disney+", "iCloud"] },
  { value: "empleados", label: "Empleados", subcategories: ["Ramona", "Angélica", "IESS"] },
  { value: "colegio_actividades", label: "Colegio y Actividades", subcategories: ["Pensión", "Matrícula", "Fútbol", "Telas"] },
  { value: "seguros", label: "Seguros", subcategories: ["Salud", "Carros", "Vida"] },
  { value: "comida", label: "Comida", subcategories: ["Supermaxi", "Mercado"] },
  { value: "restaurantes", label: "Restaurantes", subcategories: ["Comida afuera", "Delivery"] },
  { value: "carros", label: "Carros", subcategories: ["Gasolina 1", "Gasolina 2", "Mantenimiento"] },
  { value: "usa", label: "USA", subcategories: ["Mamá (Venmo)", "TMobile", "Universidad"] },
  { value: "viajes", label: "Viajes", subcategories: ["Hoteles", "Pasajes", "Tours"] },
  { value: "gastos_libres", label: "Gastos Libres", subcategories: ["KP (Esposa)", "EA (Emilio)", "Varios"] },
  { value: "diferido", label: "Pago Diferido", subcategories: ["Compras a plazos"] }
];

export default function Flujo() {
  const { getAuthHeaders, user } = useAuth();
  const [payments, setPayments] = useState([]);
  const [budgetData, setBudgetData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [viewMode, setViewMode] = useState("week"); // week, category
  const [filterWeek, setFilterWeek] = useState("all"); // all, week1, week2, week3, week4

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

  useEffect(() => {
    fetchData();
    fetchBudgetData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await axios.get(`${API}/scheduled-payments`, { headers: getAuthHeaders() });
      setPayments(response.data);
    } catch (error) {
      toast.error("Error al cargar datos");
    } finally {
      setLoading(false);
    }
  };

  const fetchBudgetData = async () => {
    try {
      const response = await axios.get(`${API}/budget/config`, { headers: getAuthHeaders() });
      setBudgetData(response.data);
    } catch (error) {
      console.log("Error loading budget data");
    }
  };

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
        await axios.put(`${API}/scheduled-payments/${editingPayment.id}`, payload, { headers: getAuthHeaders() });
        toast.success("Pago actualizado");
      } else {
        await axios.post(`${API}/scheduled-payments`, payload, { headers: getAuthHeaders() });
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
    if (!window.confirm("¿Eliminar este pago programado?")) return;
    try {
      await axios.delete(`${API}/scheduled-payments/${id}`, { headers: getAuthHeaders() });
      toast.success("Pago eliminado");
      fetchData();
    } catch (error) {
      toast.error("Error al eliminar");
    }
  };

  const handleMarkPaid = async (id) => {
    try {
      await axios.post(`${API}/scheduled-payments/${id}/mark-paid`, {}, { headers: getAuthHeaders() });
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

  // Get method icon
  const getMethodIcon = (method) => {
    const found = PAYMENT_METHODS.find(m => m.value === method);
    return found?.icon || Receipt;
  };

  // Get category label
  const getCategoryLabel = (cat) => {
    const found = CATEGORIES.find(c => c.value === cat);
    return found?.label || cat;
  };

  return (
    <div className="space-y-6" data-testid="flujo-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Planificación de Flujo</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Programa tus pagos y asigna con qué tarjeta/cuenta pagar
          </p>
        </div>
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
      {viewMode === "week" && (
        <div className="space-y-6">
          {Object.entries(weeks).map(([key, week]) => (
            <div key={key}>
              {/* Week Header */}
              <div className="flex items-center justify-between mb-3 sticky top-0 bg-background/95 backdrop-blur py-2 z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <CalendarBlank size={20} className="text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{week.label}</h3>
                    <p className="text-sm text-muted-foreground">{week.payments.length} pagos</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-base font-mono">
                  {formatCurrency(week.payments.reduce((s, p) => s + p.amount, 0))}
                </Badge>
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
                <div className="space-y-2">
                  {week.payments.map((payment, index) => {
                    const MethodIcon = getMethodIcon(payment.payment_method);
                    const isPastDue = payment.days_until_due < 0;
                    const isDueSoon = payment.is_due_soon;
                    const CategoryLabel = getCategoryLabel(payment.category);
                    const isCard = payment.payment_method?.includes("tarjeta") || payment.payment_method === "apple_card";
                    
                    return (
                      <motion.div
                        key={payment.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.03 }}
                        className={`p-4 rounded-xl border transition-all hover:shadow-md ${
                          isPastDue 
                            ? "bg-red-50 dark:bg-red-900/20 border-red-200" 
                            : isDueSoon 
                              ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200"
                              : "bg-card border-border hover:border-primary/30"
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          {/* Day indicator */}
                          <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 ${
                            isPastDue ? "bg-red-100 text-red-600" : isDueSoon ? "bg-amber-100 text-amber-600" : "bg-muted"
                          }`}>
                            <span className="text-lg font-bold">{payment.due_day}</span>
                            <span className="text-[10px] uppercase">día</span>
                          </div>

                          {/* Payment Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold">{payment.name}</span>
                              {payment.card_name && (
                                <Badge variant="outline" className="text-xs gap-1 bg-primary/5">
                                  <CreditCard size={10} />
                                  {payment.card_name}
                                </Badge>
                              )}
                              {payment.is_recurring && (
                                <Badge variant="secondary" className="text-xs">Recurrente</Badge>
                              )}
                              {isDueSoon && (
                                <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                                  <Clock size={12} className="mr-1" />
                                  {payment.days_until_due} días
                                </Badge>
                              )}
                              {isPastDue && (
                                <Badge variant="destructive" className="text-xs">
                                  <Warning size={12} className="mr-1" />
                                  Vencido
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <MethodIcon size={14} />
                                {PAYMENT_METHODS.find(m => m.value === payment.payment_method)?.label || payment.payment_method}
                              </span>
                              <span>•</span>
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
                              <div className="flex items-center gap-4 mt-2 text-xs">
                                {payment.minimum_amount && (
                                  <span className="px-2 py-1 rounded bg-amber-100 text-amber-700">
                                    Mín: {formatCurrency(payment.minimum_amount)}
                                  </span>
                                )}
                                {payment.total_balance && (
                                  <span className="px-2 py-1 rounded bg-blue-100 text-blue-700">
                                    Saldo: {formatCurrency(payment.total_balance)}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Amount & Actions */}
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="text-xl font-bold font-mono">{formatCurrency(payment.amount)}</p>
                            </div>
                            {canEdit && (
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon" onClick={() => handleEdit(payment)} className="h-8 w-8">
                                  <Pencil size={14} />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => handleDelete(payment.id)} className="h-8 w-8 text-red-500">
                                  <Trash size={14} />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* VIEW: By Category */}
      {viewMode === "category" && (
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
                              <Button variant="ghost" size="icon" onClick={() => handleEdit(payment)} className="h-6 w-6">
                                <Pencil size={12} />
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
              <Badge variant="outline" className="text-base font-mono">
                {formatCurrency(week.payments.reduce((s, p) => s + p.amount, 0))}
              </Badge>
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
              <div className="space-y-2">
                {week.payments.map((payment, index) => {
                  const MethodIcon = getMethodIcon(payment.payment_method);
                  const isPastDue = payment.days_until_due < 0;
                  const isDueSoon = payment.is_due_soon;
                  const CategoryLabel = CATEGORIES.find(c => c.value === payment.category)?.label || payment.category;
                  
                  return (
                    <motion.div
                      key={payment.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className={`p-4 rounded-xl border transition-all hover:shadow-md ${
                        isPastDue 
                          ? "bg-red-50 dark:bg-red-900/20 border-red-200" 
                          : isDueSoon 
                            ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200"
                            : "bg-card border-border hover:border-primary/30"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        {/* Day indicator */}
                        <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 ${
                          isPastDue ? "bg-red-100 text-red-600" : isDueSoon ? "bg-amber-100 text-amber-600" : "bg-muted"
                        }`}>
                          <span className="text-lg font-bold">{payment.due_day}</span>
                          <span className="text-[10px] uppercase">día</span>
                        </div>

                        {/* Payment Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold">{payment.name}</span>
                            {payment.is_recurring && (
                              <Badge variant="secondary" className="text-xs">Recurrente</Badge>
                            )}
                            {isDueSoon && (
                              <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                                <Clock size={12} className="mr-1" />
                                {payment.days_until_due} días
                              </Badge>
                            )}
                            {isPastDue && (
                              <Badge variant="destructive" className="text-xs">
                                <Warning size={12} className="mr-1" />
                                Vencido
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <MethodIcon size={14} />
                              {PAYMENT_METHODS.find(m => m.value === payment.payment_method)?.label || payment.payment_method}
                            </span>
                            <span>•</span>
                            <span>{CategoryLabel}</span>
                          </div>
                        </div>

                        {/* Amount & Actions */}
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-xl font-bold font-mono">{formatCurrency(payment.amount)}</p>
                            {payment.minimum_amount && payment.minimum_amount !== payment.amount && (
                              <p className="text-xs text-muted-foreground">Mín: {formatCurrency(payment.minimum_amount)}</p>
                            )}
                          </div>
                          {canEdit && (
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" onClick={() => handleEdit(payment)} className="h-8 w-8">
                                <Pencil size={14} />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDelete(payment.id)} className="h-8 w-8 text-red-500">
                                <Trash size={14} />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

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
        <DialogContent className="sm:max-w-[450px]">
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
                <Label>Monto</Label>
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

            <div className="space-y-2">
              <Label>Categoría</Label>
              <Select 
                value={formData.category} 
                onValueChange={(v) => setFormData({ ...formData, category: v })}
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
              <Label>Método de pago</Label>
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
    </div>
  );
}
