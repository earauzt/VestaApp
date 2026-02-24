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
import { Calendar } from "../components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Progress } from "../components/ui/progress";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { 
  Plus, 
  Pencil, 
  Trash, 
  CalendarBlank,
  ArrowUp,
  CurrencyDollar,
  Repeat,
  Bank,
  Briefcase,
  Globe,
  Clock,
  CheckCircle,
  Warning,
  User,
  Receipt,
  CalendarCheck
} from "@phosphor-icons/react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Income sources with icons
const DISTRIBUTION_CONFIG = {
  Personal: { icon: CurrencyDollar, color: "text-emerald-600", bgColor: "bg-emerald-100 dark:bg-emerald-900/30" },
  APX: { icon: Briefcase, color: "text-blue-600", bgColor: "bg-blue-100 dark:bg-blue-900/30" },
  USA: { icon: Globe, color: "text-purple-600", bgColor: "bg-purple-100 dark:bg-purple-900/30" }
};

const INCOME_CONCEPTS = ["Salario", "Bonus", "Dividendos", "Arriendo", "Honorarios", "Otros"];

const PAYMENT_METHODS = {
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
  efectivo: "Efectivo",
  venmo: "Venmo",
  apple_card: "Apple Card"
};

const STATUS_CONFIG = {
  pending: { label: "Pendiente", color: "bg-amber-100 text-amber-800", icon: Clock },
  received: { label: "Recibido", color: "bg-emerald-100 text-emerald-800", icon: CheckCircle },
  cancelled: { label: "Cancelado", color: "bg-red-100 text-red-800", icon: Warning },
  overdue: { label: "Vencido", color: "bg-red-100 text-red-800", icon: Warning },
  paid: { label: "Pagado", color: "bg-emerald-100 text-emerald-800", icon: CheckCircle },
  partial: { label: "Parcial", color: "bg-blue-100 text-blue-800", icon: Clock }
};

export default function Ingresos() {
  const { getAuthHeaders, user } = useAuth();
  const [activeTab, setActiveTab] = useState("ingresos");
  const [incomes, setIncomes] = useState([]);
  const [expectedIncomes, setExpectedIncomes] = useState([]);
  const [accountsReceivable, setAccountsReceivable] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState("income"); // income, expected, receivable
  const [editingItem, setEditingItem] = useState(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedReceivable, setSelectedReceivable] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarOpen2, setCalendarOpen2] = useState(false);
  const [calendarOpen3, setCalendarOpen3] = useState(false);
  const [calendarOpen4, setCalendarOpen4] = useState(false);
  const [calendarOpenPayment, setCalendarOpenPayment] = useState(false);

  // Form state for income
  const [formData, setFormData] = useState({
    amount: "",
    date: new Date(),
    distribution: "Personal",
    concept: "Salario",
    description: "",
    is_recurring: false,
    payment_method: "transferencia"
  });

  // Form state for expected income
  const [expectedForm, setExpectedForm] = useState({
    description: "",
    amount: "",
    expected_date: new Date(),
    source: "personal",
    recurring: false,
    recurring_frequency: "monthly",
    notes: ""
  });

  // Form state for accounts receivable
  const [receivableForm, setReceivableForm] = useState({
    client_name: "",
    invoice_number: "",
    amount: "",
    invoice_date: new Date(),
    due_date: new Date(),
    notes: ""
  });

  const fetchData = useCallback(async () => {
    try {
      const [incomesRes, summaryRes, expectedRes, receivableRes] = await Promise.all([
        axios.get(`${API}/income?year=${selectedYear}`, { headers: getAuthHeaders() }),
        axios.get(`${API}/income/summary?year=${selectedYear}`, { headers: getAuthHeaders() }),
        axios.get(`${API}/expected-income`, { headers: getAuthHeaders() }).catch(() => ({ data: { items: [] } })),
        axios.get(`${API}/accounts-receivable`, { headers: getAuthHeaders() }).catch(() => ({ data: { items: [] } }))
      ]);
      setIncomes(incomesRes.data);
      setSummary(summaryRes.data);
      setExpectedIncomes(expectedRes.data?.items || []);
      setAccountsReceivable(receivableRes.data?.items || []);
    } catch (error) {
      toast.error("Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }, [selectedYear, getAuthHeaders]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmitIncome = async (e) => {
    e.preventDefault();
    
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast.error("Ingresa un monto válido");
      return;
    }

    try {
      const payload = {
        ...formData,
        amount: parseFloat(formData.amount),
        date: format(formData.date, "yyyy-MM-dd")
      };

      if (editingItem) {
        await axios.put(`${API}/income/${editingItem.id}`, payload, { headers: getAuthHeaders() });
        toast.success("Ingreso actualizado");
      } else {
        await axios.post(`${API}/income`, payload, { headers: getAuthHeaders() });
        toast.success("Ingreso registrado");
      }

      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al guardar");
    }
  };

  const handleSubmitExpected = async (e) => {
    e.preventDefault();
    
    if (!expectedForm.amount || parseFloat(expectedForm.amount) <= 0) {
      toast.error("Ingresa un monto válido");
      return;
    }

    try {
      const payload = {
        ...expectedForm,
        amount: parseFloat(expectedForm.amount),
        expected_date: format(expectedForm.expected_date, "yyyy-MM-dd")
      };

      if (editingItem) {
        await axios.put(`${API}/expected-income/${editingItem.id}`, payload, { headers: getAuthHeaders() });
        toast.success("Ingreso previsto actualizado");
      } else {
        await axios.post(`${API}/expected-income`, payload, { headers: getAuthHeaders() });
        toast.success("Ingreso previsto creado");
      }

      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al guardar");
    }
  };

  const handleSubmitReceivable = async (e) => {
    e.preventDefault();
    
    if (!receivableForm.amount || parseFloat(receivableForm.amount) <= 0) {
      toast.error("Ingresa un monto válido");
      return;
    }

    try {
      const payload = {
        ...receivableForm,
        amount: parseFloat(receivableForm.amount),
        invoice_date: format(receivableForm.invoice_date, "yyyy-MM-dd"),
        due_date: format(receivableForm.due_date, "yyyy-MM-dd")
      };

      await axios.post(`${API}/accounts-receivable`, payload, { headers: getAuthHeaders() });
      toast.success("Cuenta por cobrar creada");

      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al guardar");
    }
  };

  const handleMarkReceived = async (id) => {
    try {
      await axios.put(`${API}/expected-income/${id}/mark-received`, {}, { headers: getAuthHeaders() });
      toast.success("Marcado como recibido");
      fetchData();
    } catch (error) {
      toast.error("Error al actualizar");
    }
  };

  const handleRecordPayment = async () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      toast.error("Ingresa un monto válido");
      return;
    }

    try {
      await axios.put(
        `${API}/accounts-receivable/${selectedReceivable.id}/payment`,
        { amount: parseFloat(paymentAmount) },
        { headers: getAuthHeaders() }
      );
      toast.success("Pago registrado");
      setPaymentDialogOpen(false);
      setPaymentAmount("");
      setSelectedReceivable(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al registrar pago");
    }
  };

  const handleDelete = async (id, type) => {
    if (!window.confirm("¿Eliminar este registro?")) return;
    
    try {
      const endpoint = type === "income" ? "income" : type === "expected" ? "expected-income" : "accounts-receivable";
      await axios.delete(`${API}/${endpoint}/${id}`, { headers: getAuthHeaders() });
      toast.success("Eliminado correctamente");
      fetchData();
    } catch (error) {
      toast.error("Error al eliminar");
    }
  };

  const handleEdit = (item, type) => {
    setEditingItem(item);
    setDialogType(type);
    
    if (type === "income") {
      setFormData({
        amount: item.amount.toString(),
        date: new Date(item.date),
        distribution: item.distribution,
        concept: item.concept,
        description: item.description || "",
        is_recurring: item.is_recurring,
        payment_method: item.payment_method || "transferencia"
      });
    } else if (type === "expected") {
      setExpectedForm({
        description: item.description,
        amount: item.amount.toString(),
        expected_date: new Date(item.expected_date),
        source: item.source,
        recurring: item.recurring,
        recurring_frequency: item.recurring_frequency || "monthly",
        notes: item.notes || ""
      });
    }
    
    setDialogOpen(true);
  };

  const openDialog = (type) => {
    setDialogType(type);
    resetForm();
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingItem(null);
    setFormData({
      amount: "",
      date: new Date(),
      distribution: "Personal",
      concept: "Salario",
      description: "",
      is_recurring: false,
      payment_method: "transferencia"
    });
    setExpectedForm({
      description: "",
      amount: "",
      expected_date: new Date(),
      source: "personal",
      recurring: false,
      recurring_frequency: "monthly",
      notes: ""
    });
    setReceivableForm({
      client_name: "",
      invoice_number: "",
      amount: "",
      invoice_date: new Date(),
      due_date: new Date(),
      notes: ""
    });
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-EC', {
      style: 'currency',
      currency: 'USD'
    }).format(value || 0);
  };

  const canEdit = user?.role === "admin" || user?.role === "spouse";

  // Calculate totals for expected incomes and receivables
  const totalExpectedPending = expectedIncomes
    .filter(i => i.status === "pending")
    .reduce((sum, i) => sum + i.amount, 0);
  
  const totalReceivablePending = accountsReceivable
    .filter(a => a.status !== "paid")
    .reduce((sum, a) => sum + (a.amount - (a.amount_paid || 0)), 0);

  return (
    <div className="space-y-6" data-testid="ingresos-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Ingresos</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Gestiona ingresos, previstos y cuentas por cobrar
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
            <SelectTrigger className="w-[120px]" data-testid="year-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026].map((year) => (
                <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bento-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                <ArrowUp size={20} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Recibido</p>
                <p className="text-lg font-bold text-emerald-600">{formatCurrency(summary?.total || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bento-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <Clock size={20} className="text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Esperado (Pendiente)</p>
                <p className="text-lg font-bold text-amber-600">{formatCurrency(totalExpectedPending)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bento-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Receipt size={20} className="text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Por Cobrar</p>
                <p className="text-lg font-bold text-blue-600">{formatCurrency(totalReceivablePending)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bento-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-900/30">
                <CalendarCheck size={20} className="text-violet-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Flujo Proyectado</p>
                <p className="text-lg font-bold text-violet-600">
                  {formatCurrency((summary?.total || 0) + totalExpectedPending + totalReceivablePending)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="ingresos" className="gap-2" data-testid="tab-ingresos">
            <Bank size={16} />
            <span className="hidden sm:inline">Ingresos</span>
            <Badge variant="secondary" className="ml-1">{incomes.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="previstos" className="gap-2" data-testid="tab-previstos">
            <Clock size={16} />
            <span className="hidden sm:inline">Previstos</span>
            <Badge variant="secondary" className="ml-1">{expectedIncomes.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="cuentas" className="gap-2" data-testid="tab-cuentas">
            <Receipt size={16} />
            <span className="hidden sm:inline">Por Cobrar</span>
            <Badge variant="secondary" className="ml-1">{accountsReceivable.length}</Badge>
          </TabsTrigger>
        </TabsList>

        {/* Tab: Ingresos */}
        <TabsContent value="ingresos" className="space-y-4">
          <div className="flex justify-end">
            {canEdit && (
              <Button onClick={() => openDialog("income")} className="gap-2" data-testid="add-income-btn">
                <Plus size={18} weight="bold" />
                Nuevo Ingreso
              </Button>
            )}
          </div>

          <Card className="bento-card">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Bank size={20} />
                Ingresos Registrados
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Cargando...</div>
              ) : incomes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No hay ingresos registrados para {selectedYear}
                </div>
              ) : (
                <div className="space-y-3">
                  <AnimatePresence>
                    {incomes.map((income, index) => {
                      const config = DISTRIBUTION_CONFIG[income.distribution] || DISTRIBUTION_CONFIG.Personal;
                      return (
                        <motion.div
                          key={income.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.2, delay: index * 0.02 }}
                          className="flex items-center justify-between p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <div className={`p-2 rounded-full ${config.bgColor}`}>
                              <config.icon size={20} className={config.color} weight="bold" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium">{income.concept}</p>
                                {income.is_recurring && (
                                  <Badge variant="outline" className="text-xs gap-1">
                                    <Repeat size={10} />
                                    Recurrente
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                                <span>{format(new Date(income.date), "d MMM yyyy", { locale: es })}</span>
                                <Badge className={config.bgColor + " " + config.color}>{income.distribution}</Badge>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-bold text-emerald-600 text-lg">
                              +{formatCurrency(income.amount)}
                            </span>
                            {canEdit && (
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon" onClick={() => handleEdit(income, "income")}>
                                  <Pencil size={16} />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => handleDelete(income.id, "income")}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash size={16} />
                                </Button>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Ingresos Previstos */}
        <TabsContent value="previstos" className="space-y-4">
          <div className="flex justify-end">
            {canEdit && (
              <Button onClick={() => openDialog("expected")} className="gap-2" data-testid="add-expected-btn">
                <Plus size={18} weight="bold" />
                Nuevo Ingreso Previsto
              </Button>
            )}
          </div>

          <Card className="bento-card">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock size={20} />
                Ingresos Previstos
              </CardTitle>
              <CardDescription>Ingresos que esperas recibir próximamente</CardDescription>
            </CardHeader>
            <CardContent>
              {expectedIncomes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No hay ingresos previstos
                </div>
              ) : (
                <div className="space-y-3">
                  <AnimatePresence>
                    {expectedIncomes.map((item, index) => {
                      const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
                      const StatusIcon = statusConfig.icon;
                      const sourceConfig = DISTRIBUTION_CONFIG[item.source?.charAt(0).toUpperCase() + item.source?.slice(1)] || DISTRIBUTION_CONFIG.Personal;
                      
                      return (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.2, delay: index * 0.02 }}
                          className="flex items-center justify-between p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <div className={`p-2 rounded-full ${sourceConfig.bgColor}`}>
                              <sourceConfig.icon size={20} className={sourceConfig.color} weight="bold" />
                            </div>
                            <div>
                              <p className="font-medium">{item.description}</p>
                              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                                <CalendarBlank size={14} />
                                <span>Esperado: {format(new Date(item.expected_date), "d MMM yyyy", { locale: es })}</span>
                                <Badge className={statusConfig.color}>
                                  <StatusIcon size={12} className="mr-1" />
                                  {statusConfig.label}
                                </Badge>
                                {item.recurring && (
                                  <Badge variant="outline" className="text-xs gap-1">
                                    <Repeat size={10} />
                                    {item.recurring_frequency}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-bold text-amber-600 text-lg">
                              {formatCurrency(item.amount)}
                            </span>
                            {canEdit && item.status === "pending" && (
                              <div className="flex gap-1">
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleMarkReceived(item.id)}
                                  className="gap-1"
                                >
                                  <CheckCircle size={14} />
                                  Recibido
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => handleEdit(item, "expected")}>
                                  <Pencil size={16} />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => handleDelete(item.id, "expected")}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash size={16} />
                                </Button>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Cuentas por Cobrar */}
        <TabsContent value="cuentas" className="space-y-4">
          <div className="flex justify-end">
            {canEdit && (
              <Button onClick={() => openDialog("receivable")} className="gap-2" data-testid="add-receivable-btn">
                <Plus size={18} weight="bold" />
                Nueva Cuenta por Cobrar
              </Button>
            )}
          </div>

          <Card className="bento-card">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Receipt size={20} />
                Cuentas por Cobrar
              </CardTitle>
              <CardDescription>Facturas emitidas pendientes de cobro</CardDescription>
            </CardHeader>
            <CardContent>
              {accountsReceivable.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No hay cuentas por cobrar
                </div>
              ) : (
                <div className="space-y-3">
                  <AnimatePresence>
                    {accountsReceivable.map((item, index) => {
                      const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
                      const StatusIcon = statusConfig.icon;
                      const remaining = item.amount - (item.amount_paid || 0);
                      const progress = ((item.amount_paid || 0) / item.amount) * 100;
                      
                      return (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.2, delay: index * 0.02 }}
                          className="p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30">
                                <User size={20} className="text-blue-600" weight="bold" />
                              </div>
                              <div>
                                <p className="font-medium">{item.client_name}</p>
                                <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                                  {item.invoice_number && <span>Factura: {item.invoice_number}</span>}
                                  <span>Vence: {format(new Date(item.due_date), "d MMM yyyy", { locale: es })}</span>
                                  <Badge className={statusConfig.color}>
                                    <StatusIcon size={12} className="mr-1" />
                                    {statusConfig.label}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-mono font-bold text-lg text-blue-600">
                                {formatCurrency(remaining)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                de {formatCurrency(item.amount)}
                              </p>
                            </div>
                          </div>
                          
                          {item.amount_paid > 0 && (
                            <div className="mt-2">
                              <Progress value={progress} className="h-2" />
                              <p className="text-xs text-muted-foreground mt-1">
                                {progress.toFixed(0)}% cobrado
                              </p>
                            </div>
                          )}
                          
                          {canEdit && item.status !== "paid" && (
                            <div className="flex gap-2 mt-3">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => {
                                  setSelectedReceivable(item);
                                  setPaymentDialogOpen(true);
                                }}
                                className="gap-1"
                              >
                                <CurrencyDollar size={14} />
                                Registrar Pago
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => handleDelete(item.id, "receivable")}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash size={16} />
                              </Button>
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog for Income */}
      <Dialog open={dialogOpen && dialogType === "income"} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Editar Ingreso" : "Nuevo Ingreso"}</DialogTitle>
            <DialogDescription>
              Registra un ingreso y selecciona su distribución
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitIncome} className="space-y-4">
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
                  data-testid="amount-input"
                />
              </div>
              <div className="space-y-2">
                <Label>Fecha</Label>
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start gap-2" data-testid="date-picker">
                      <CalendarBlank size={16} />
                      {format(formData.date, "d MMM", { locale: es })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 z-[250]" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.date}
                      onSelect={(date) => {
                        if (date) {
                          setFormData({ ...formData, date });
                          setCalendarOpen(false);
                        }
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Distribución</Label>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(DISTRIBUTION_CONFIG).map(([key, config]) => (
                  <Button
                    key={key}
                    type="button"
                    variant={formData.distribution === key ? "default" : "outline"}
                    className="gap-2 h-auto py-3"
                    onClick={() => setFormData({ ...formData, distribution: key })}
                  >
                    <config.icon size={18} />
                    {key}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Concepto</Label>
                <Select 
                  value={formData.concept} 
                  onValueChange={(value) => setFormData({ ...formData, concept: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INCOME_CONCEPTS.map((concept) => (
                      <SelectItem key={concept} value={concept}>{concept}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Método de pago</Label>
                <Select 
                  value={formData.payment_method} 
                  onValueChange={(value) => setFormData({ ...formData, payment_method: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PAYMENT_METHODS).map(([key, name]) => (
                      <SelectItem key={key} value={key}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
              <div className="flex items-center gap-2">
                <Repeat size={18} className="text-muted-foreground" />
                <span className="text-sm">¿Es recurrente?</span>
              </div>
              <Switch
                checked={formData.is_recurring}
                onCheckedChange={(checked) => setFormData({ ...formData, is_recurring: checked })}
              />
            </div>

            <DialogFooter>
              <Button type="submit">{editingItem ? "Actualizar" : "Guardar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog for Expected Income */}
      <Dialog open={dialogOpen && dialogType === "expected"} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Editar Ingreso Previsto" : "Nuevo Ingreso Previsto"}</DialogTitle>
            <DialogDescription>
              Registra un ingreso que esperas recibir
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitExpected} className="space-y-4">
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Input
                placeholder="Ej: Pago de cliente X"
                value={expectedForm.description}
                onChange={(e) => setExpectedForm({ ...expectedForm, description: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Monto</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={expectedForm.amount}
                  onChange={(e) => setExpectedForm({ ...expectedForm, amount: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Fecha Esperada</Label>
                <Popover open={calendarOpen2} onOpenChange={setCalendarOpen2}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start gap-2">
                      <CalendarBlank size={16} />
                      {format(expectedForm.expected_date, "d MMM", { locale: es })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 z-[250]" align="start">
                    <Calendar
                      mode="single"
                      selected={expectedForm.expected_date}
                      onSelect={(date) => {
                        if (date) {
                          setExpectedForm({ ...expectedForm, expected_date: date });
                          setCalendarOpen2(false);
                        }
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Fuente</Label>
              <Select 
                value={expectedForm.source} 
                onValueChange={(value) => setExpectedForm({ ...expectedForm, source: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal">Personal</SelectItem>
                  <SelectItem value="apx">APX</SelectItem>
                  <SelectItem value="usa">USA</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
              <div className="flex items-center gap-2">
                <Repeat size={18} className="text-muted-foreground" />
                <span className="text-sm">¿Es recurrente?</span>
              </div>
              <Switch
                checked={expectedForm.recurring}
                onCheckedChange={(checked) => setExpectedForm({ ...expectedForm, recurring: checked })}
              />
            </div>

            {expectedForm.recurring && (
              <div className="space-y-2">
                <Label>Frecuencia</Label>
                <Select 
                  value={expectedForm.recurring_frequency} 
                  onValueChange={(value) => setExpectedForm({ ...expectedForm, recurring_frequency: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Semanal</SelectItem>
                    <SelectItem value="biweekly">Quincenal</SelectItem>
                    <SelectItem value="monthly">Mensual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Notas (opcional)</Label>
              <Input
                placeholder="Detalles adicionales"
                value={expectedForm.notes}
                onChange={(e) => setExpectedForm({ ...expectedForm, notes: e.target.value })}
              />
            </div>

            <DialogFooter>
              <Button type="submit">{editingItem ? "Actualizar" : "Guardar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog for Accounts Receivable */}
      <Dialog open={dialogOpen && dialogType === "receivable"} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Nueva Cuenta por Cobrar</DialogTitle>
            <DialogDescription>
              Registra una factura emitida pendiente de cobro
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitReceivable} className="space-y-4">
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Input
                placeholder="Nombre del cliente"
                value={receivableForm.client_name}
                onChange={(e) => setReceivableForm({ ...receivableForm, client_name: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>N° Factura (opcional)</Label>
                <Input
                  placeholder="001-001-000001"
                  value={receivableForm.invoice_number}
                  onChange={(e) => setReceivableForm({ ...receivableForm, invoice_number: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Monto</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={receivableForm.amount}
                  onChange={(e) => setReceivableForm({ ...receivableForm, amount: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fecha Factura</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start gap-2">
                      <CalendarBlank size={16} />
                      {format(receivableForm.invoice_date, "d MMM", { locale: es })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 z-[200]" align="start">
                    <Calendar
                      mode="single"
                      selected={receivableForm.invoice_date}
                      onSelect={(date) => date && setReceivableForm({ ...receivableForm, invoice_date: date })}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Fecha Vencimiento</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start gap-2">
                      <CalendarBlank size={16} />
                      {format(receivableForm.due_date, "d MMM", { locale: es })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 z-[200]" align="start">
                    <Calendar
                      mode="single"
                      selected={receivableForm.due_date}
                      onSelect={(date) => date && setReceivableForm({ ...receivableForm, due_date: date })}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notas (opcional)</Label>
              <Input
                placeholder="Detalles adicionales"
                value={receivableForm.notes}
                onChange={(e) => setReceivableForm({ ...receivableForm, notes: e.target.value })}
              />
            </div>

            <DialogFooter>
              <Button type="submit">Guardar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog for Recording Payment */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="sm:max-w-[350px]">
          <DialogHeader>
            <DialogTitle>Registrar Pago</DialogTitle>
            <DialogDescription>
              {selectedReceivable && (
                <>
                  Cliente: {selectedReceivable.client_name}<br />
                  Pendiente: {formatCurrency(selectedReceivable.amount - (selectedReceivable.amount_paid || 0))}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Monto del Pago</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleRecordPayment}>Registrar</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
