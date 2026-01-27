import { useState, useEffect } from "react";
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
import { Progress } from "../components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Switch } from "../components/ui/switch";
import { Slider } from "../components/ui/slider";
import { toast } from "sonner";
import { 
  CreditCard as CreditCardIcon, 
  Plus, 
  Pencil, 
  Trash, 
  TrendDown,
  Calculator,
  Lightning,
  ArrowRight,
  CheckCircle,
  Warning,
  Info,
  Percent,
  CalendarBlank,
  Bank,
  CurrencyDollar,
  Snowflake,
  Fire
} from "@phosphor-icons/react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const BANKS = [
  { value: "diners", label: "Diners Club", country: "Ecuador" },
  { value: "pichincha", label: "Banco Pichincha", country: "Ecuador" },
  { value: "pacifico", label: "Banco del Pacífico / Pacificard", country: "Ecuador" },
  { value: "guayaquil", label: "Banco de Guayaquil", country: "Ecuador" },
  { value: "apple", label: "Apple Card", country: "USA" }
];

export default function Deudas() {
  const { getAuthHeaders, user } = useAuth();
  const [cards, setCards] = useState([]);
  const [summary, setSummary] = useState(null);
  const [snowballPlan, setSnowballPlan] = useState(null);
  const [deferredPayments, setDeferredPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [editingCard, setEditingCard] = useState(null);
  const [selectedCardForPayment, setSelectedCardForPayment] = useState(null);
  const [extraPayment, setExtraPayment] = useState(500);
  const [activeTab, setActiveTab] = useState("cards");

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    bank: "",
    apr: 15,
    credit_limit: 0,
    current_balance: 0,
    minimum_payment: 0,
    cut_off_day: 15,
    payment_due_day: 5,
    is_international: false
  });

  // Payment form
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentType, setPaymentType] = useState("custom");

  // Deferred payment editing
  const [deferredDialogOpen, setDeferredDialogOpen] = useState(false);
  const [editingDeferred, setEditingDeferred] = useState(null);
  const [deferredForm, setDeferredForm] = useState({
    description: "",
    total_amount: 0,
    monthly_payment: 0,
    remaining_installments: 0,
    total_installments: 0,
    card_name: ""
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [cardsRes, summaryRes, deferredRes] = await Promise.all([
        axios.get(`${API}/credit-cards`, { headers: getAuthHeaders() }),
        axios.get(`${API}/debt/summary`, { headers: getAuthHeaders() }),
        axios.get(`${API}/deferred-payments`, { headers: getAuthHeaders() })
      ]);
      setCards(cardsRes.data);
      setSummary(summaryRes.data);
      setDeferredPayments(deferredRes.data);
    } catch (error) {
      toast.error("Error al cargar datos");
    } finally {
      setLoading(false);
    }
  };

  const calculateSnowball = async () => {
    try {
      const response = await axios.post(
        `${API}/debt/snowball-plan`,
        { strategy: "avalanche", extra_payment: extraPayment },
        { headers: getAuthHeaders() }
      );
      setSnowballPlan(response.data);
      setActiveTab("plan");
      toast.success("Plan calculado");
    } catch (error) {
      toast.error("Error al calcular plan");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const payload = {
        ...formData,
        apr: parseFloat(formData.apr),
        credit_limit: parseFloat(formData.credit_limit),
        current_balance: parseFloat(formData.current_balance),
        minimum_payment: parseFloat(formData.minimum_payment),
        cut_off_day: parseInt(formData.cut_off_day),
        payment_due_day: parseInt(formData.payment_due_day),
        currency: formData.is_international ? "USD" : "USD"
      };

      if (editingCard) {
        await axios.put(`${API}/credit-cards/${editingCard.id}`, payload, { headers: getAuthHeaders() });
        toast.success("Tarjeta actualizada");
      } else {
        await axios.post(`${API}/credit-cards`, payload, { headers: getAuthHeaders() });
        toast.success("Tarjeta agregada");
      }

      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al guardar");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Eliminar esta tarjeta?")) return;
    try {
      await axios.delete(`${API}/credit-cards/${id}`, { headers: getAuthHeaders() });
      toast.success("Tarjeta eliminada");
      fetchData();
    } catch (error) {
      toast.error("Error al eliminar");
    }
  };

  // Deferred payment functions
  const openDeferredDialog = (deferred = null) => {
    if (deferred) {
      setEditingDeferred(deferred);
      setDeferredForm({
        description: deferred.description || "",
        total_amount: deferred.total_amount || 0,
        monthly_payment: deferred.monthly_payment || 0,
        remaining_installments: deferred.remaining_installments || 0,
        total_installments: deferred.total_installments || 0,
        card_name: deferred.card_name || ""
      });
    } else {
      setEditingDeferred(null);
      setDeferredForm({
        description: "",
        total_amount: 0,
        monthly_payment: 0,
        remaining_installments: 0,
        total_installments: 0,
        card_name: ""
      });
    }
    setDeferredDialogOpen(true);
  };

  const handleDeferredSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...deferredForm,
        total_amount: parseFloat(deferredForm.total_amount),
        monthly_payment: parseFloat(deferredForm.monthly_payment),
        remaining_installments: parseInt(deferredForm.remaining_installments),
        total_installments: parseInt(deferredForm.total_installments)
      };

      if (editingDeferred) {
        await axios.put(`${API}/deferred-payments/${editingDeferred.id}`, payload, { headers: getAuthHeaders() });
        toast.success("Diferido actualizado");
      } else {
        await axios.post(`${API}/deferred-payments`, payload, { headers: getAuthHeaders() });
        toast.success("Diferido agregado");
      }

      setDeferredDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al guardar diferido");
    }
  };

  const handleDeleteDeferred = async (id) => {
    if (!window.confirm("¿Eliminar este diferido?")) return;
    try {
      await axios.delete(`${API}/deferred-payments/${id}`, { headers: getAuthHeaders() });
      toast.success("Diferido eliminado");
      fetchData();
    } catch (error) {
      toast.error("Error al eliminar");
    }
  };

  const handleEdit = (card) => {
    setEditingCard(card);
    setFormData({
      name: card.name,
      bank: card.bank,
      apr: card.apr,
      credit_limit: card.credit_limit,
      current_balance: card.current_balance,
      minimum_payment: card.minimum_payment,
      cut_off_day: card.cut_off_day,
      payment_due_day: card.payment_due_day,
      is_international: card.is_international
    });
    setDialogOpen(true);
  };

  const handlePayment = async () => {
    if (!selectedCardForPayment || !paymentAmount) return;
    
    try {
      await axios.post(
        `${API}/debt/payment`,
        {
          card_id: selectedCardForPayment.id,
          amount: parseFloat(paymentAmount),
          date: new Date().toISOString().split("T")[0],
          payment_type: paymentType
        },
        { headers: getAuthHeaders() }
      );
      toast.success("Pago registrado");
      setPaymentDialogOpen(false);
      setPaymentAmount("");
      fetchData();
    } catch (error) {
      toast.error("Error al registrar pago");
    }
  };

  const resetForm = () => {
    setEditingCard(null);
    setFormData({
      name: "",
      bank: "",
      apr: 15,
      credit_limit: 0,
      current_balance: 0,
      minimum_payment: 0,
      cut_off_day: 15,
      payment_due_day: 5,
      is_international: false
    });
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-EC', {
      style: 'currency',
      currency: 'USD'
    }).format(value || 0);
  };

  const getUtilizationColor = (rate) => {
    if (rate < 30) return "text-emerald-600";
    if (rate < 50) return "text-amber-600";
    return "text-red-600";
  };

  const canEdit = user?.role === "admin" || user?.role === "spouse";

  return (
    <div className="space-y-6" data-testid="deudas-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Deudas y Tarjetas</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Gestiona tus tarjetas de crédito y planes de pago con Avalanche
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => setDialogOpen(true)} className="gap-2" data-testid="add-card-btn">
            <Plus size={18} weight="bold" />
            <span className="hidden sm:inline">Agregar Tarjeta</span>
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card className="bento-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                  <TrendDown size={20} className="text-red-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Deuda Total</p>
                  <p className="text-lg font-bold text-red-600">{formatCurrency(summary.total_debt)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bento-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                  <CurrencyDollar size={20} className="text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Crédito Disponible</p>
                  <p className="text-lg font-bold text-emerald-600">{formatCurrency(summary.total_available_credit)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bento-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                  <Percent size={20} className="text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Utilización</p>
                  <p className={`text-lg font-bold ${getUtilizationColor(summary.utilization_rate)}`}>
                    {summary.utilization_rate}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bento-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                  <Calculator size={20} className="text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Pago Mínimo Total</p>
                  <p className="text-lg font-bold text-purple-600">{formatCurrency(summary.total_minimum_payment)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="cards" className="gap-2">
            <CreditCardIcon size={18} />
            <span className="hidden sm:inline">Mis Tarjetas</span>
            <span className="sm:hidden">Tarjetas</span>
          </TabsTrigger>
          <TabsTrigger value="diferidos" className="gap-2">
            <CalendarBlank size={18} />
            <span className="hidden sm:inline">Diferidos</span>
            <span className="sm:hidden">Cuotas</span>
            {deferredPayments?.count > 0 && (
              <Badge variant="secondary" className="ml-1">{deferredPayments.count}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="plan" className="gap-2">
            <Fire size={18} />
            <span className="hidden sm:inline">Plan Avalanche</span>
            <span className="sm:hidden">Plan</span>
          </TabsTrigger>
        </TabsList>

        {/* Cards Tab */}
        <TabsContent value="cards">
          <Card className="bento-card">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CreditCardIcon size={20} />
                Tarjetas de Crédito ({cards.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Cargando...</div>
              ) : cards.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No tienes tarjetas registradas
                </div>
              ) : (
                <div className="space-y-4">
                  {cards.map((card, index) => {
                    const utilization = card.credit_limit > 0 
                      ? (card.current_balance / card.credit_limit * 100) 
                      : 0;
                    
                    return (
                      <motion.div
                        key={card.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="p-4 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 text-white"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-lg">{card.name}</h3>
                              {card.is_international && (
                                <Badge className="bg-purple-500">USA</Badge>
                              )}
                              <Badge variant="outline" className="text-amber-400 border-amber-400">
                                {card.apr}% APR
                              </Badge>
                            </div>
                            <p className="text-slate-400 text-sm">{card.bank}</p>
                            
                            <div className="mt-3 space-y-1">
                              <div className="flex justify-between text-sm">
                                <span className="text-slate-400">Saldo / Límite</span>
                                <span>{formatCurrency(card.current_balance)} / {formatCurrency(card.credit_limit)}</span>
                              </div>
                              <Progress 
                                value={utilization} 
                                className="h-2"
                              />
                              <div className="flex justify-between text-xs text-slate-400">
                                <span>Utilización: {utilization.toFixed(0)}%</span>
                                <span>Disponible: {formatCurrency(card.available_credit)}</span>
                              </div>
                            </div>

                            <div className="flex gap-4 mt-3 text-xs text-slate-400">
                              <span className="flex items-center gap-1">
                                <CalendarBlank size={14} />
                                Corte: día {card.cut_off_day}
                              </span>
                              <span className="flex items-center gap-1">
                                <CalendarBlank size={14} />
                                Pago: día {card.payment_due_day}
                              </span>
                            </div>
                          </div>

                          {canEdit && (
                            <div className="flex sm:flex-col gap-2">
                              <Button 
                                size="sm" 
                                variant="secondary"
                                onClick={() => {
                                  setSelectedCardForPayment(card);
                                  setPaymentAmount(card.minimum_payment.toString());
                                  setPaymentDialogOpen(true);
                                }}
                                className="gap-1"
                              >
                                <CurrencyDollar size={14} />
                                Pagar
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => handleEdit(card)}>
                                <Pencil size={14} />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                onClick={() => handleDelete(card.id)}
                                className="text-red-400 hover:text-red-300"
                              >
                                <Trash size={14} />
                              </Button>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Diferidos Tab */}
        <TabsContent value="diferidos">
          <div className="space-y-4">
            {/* Summary Cards */}
            {deferredPayments?.count > 0 && (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <Card className="bento-card">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Total por Pagar</p>
                    <p className="text-2xl font-bold text-red-500">
                      {formatCurrency(deferredPayments.total_remaining)}
                    </p>
                  </CardContent>
                </Card>
                <Card className="bento-card">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Cuota Mensual</p>
                    <p className="text-2xl font-bold text-primary">
                      {formatCurrency(deferredPayments.total_monthly_obligation)}
                    </p>
                  </CardContent>
                </Card>
                <Card className="bento-card">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Diferidos Activos</p>
                    <p className="text-2xl font-bold">{deferredPayments.count}</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Deferred List */}
            <Card className="bento-card">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CalendarBlank size={20} />
                  Compras Diferidas / Cuotas Pendientes
                </CardTitle>
                <CardDescription>
                  Pagos a plazos extraídos de tus estados de cuenta
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!deferredPayments?.payments || deferredPayments.payments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CalendarBlank size={48} className="mx-auto mb-4 opacity-50" />
                    <p>No tienes compras diferidas registradas</p>
                    <p className="text-sm">Se extraen automáticamente al subir estados de cuenta</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {deferredPayments.payments.map((payment, index) => {
                      const progress = payment.total_installments > 0 
                        ? ((payment.total_installments - payment.remaining_installments) / payment.total_installments) * 100
                        : 0;
                      return (
                        <motion.div
                          key={payment.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="p-4 rounded-xl bg-muted/50 border"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-semibold">{payment.description}</p>
                                {payment.card_name && (
                                  <Badge variant="outline" className="text-xs">
                                    {payment.card_name}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                                <span>Total: {formatCurrency(payment.total_amount)}</span>
                                <span>•</span>
                                <span className="font-medium text-foreground">
                                  Cuota: {formatCurrency(payment.monthly_payment)}/mes
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <Badge 
                                variant={payment.remaining_installments <= 1 ? "default" : "secondary"}
                                className={payment.remaining_installments <= 1 ? "bg-emerald-600" : ""}
                              >
                                {payment.remaining_installments} de {payment.total_installments} cuotas
                              </Badge>
                            </div>
                          </div>
                          <div className="mt-3">
                            <div className="flex justify-between text-xs text-muted-foreground mb-1">
                              <span>Progreso</span>
                              <span>{Math.round(progress)}%</span>
                            </div>
                            <Progress value={progress} className="h-2" />
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Snowball/Avalanche Plan Tab */}
        <TabsContent value="plan">
          <div className="space-y-4">
            {/* Calculator */}
            <Card className="bento-card">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Fire size={20} className="text-orange-500" />
                  Calculadora Avalanche
                </CardTitle>
                <CardDescription>
                  Paga primero la tarjeta con mayor interés para ahorrar más dinero
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Pago extra mensual: {formatCurrency(extraPayment)}</Label>
                  <Slider
                    value={[extraPayment]}
                    onValueChange={(v) => setExtraPayment(v[0])}
                    min={0}
                    max={2000}
                    step={50}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    Además del pago mínimo, ¿cuánto extra puedes pagar cada mes?
                  </p>
                </div>
                
                <Button onClick={calculateSnowball} className="w-full gap-2">
                  <Calculator size={18} />
                  Calcular Plan de Pago
                </Button>
              </CardContent>
            </Card>

            {/* Plan Results */}
            {snowballPlan && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className="bento-card border-orange-500/50">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Lightning size={20} className="text-amber-500" />
                      Tu Plan de Pago
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Summary Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-3 rounded-lg bg-muted text-center">
                        <p className="text-2xl font-bold text-primary">{snowballPlan.months_to_payoff}</p>
                        <p className="text-xs text-muted-foreground">Meses para salir</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted text-center">
                        <p className="text-2xl font-bold text-emerald-600">{formatCurrency(snowballPlan.total_interest)}</p>
                        <p className="text-xs text-muted-foreground">Interés total</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted text-center">
                        <p className="text-2xl font-bold">{formatCurrency(snowballPlan.total_paid)}</p>
                        <p className="text-xs text-muted-foreground">Total a pagar</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted text-center">
                        <p className="text-2xl font-bold">{snowballPlan.years_to_payoff}</p>
                        <p className="text-xs text-muted-foreground">Años</p>
                      </div>
                    </div>

                    {/* Recommendation */}
                    {snowballPlan.recommendation && (
                      <div className="p-4 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200">
                        <div className="flex items-start gap-3">
                          <Fire size={24} className="text-orange-500 shrink-0" />
                          <div>
                            <p className="font-medium text-orange-800 dark:text-orange-200">
                              Recomendación Avalanche
                            </p>
                            <p className="text-sm text-orange-700 dark:text-orange-300">
                              {snowballPlan.recommendation}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Payoff Order */}
                    <div className="space-y-2">
                      <Label>Orden de pago recomendado:</Label>
                      <div className="flex flex-wrap gap-2">
                        {snowballPlan.payoff_order?.map((name, i) => (
                          <div key={name} className="flex items-center gap-1">
                            <Badge variant="secondary" className="gap-1">
                              {i + 1}. {name}
                            </Badge>
                            {i < snowballPlan.payoff_order.length - 1 && (
                              <ArrowRight size={16} className="text-muted-foreground" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Monthly Plan Preview */}
                    {snowballPlan.monthly_plan?.length > 0 && (
                      <div className="space-y-2">
                        <Label>Próximos 3 meses:</Label>
                        <div className="space-y-2 max-h-[300px] overflow-y-auto">
                          {snowballPlan.monthly_plan.slice(0, 3).map((month) => (
                            <div key={month.month} className="p-3 rounded-lg bg-muted/50">
                              <div className="flex justify-between items-center mb-2">
                                <span className="font-medium">Mes {month.month}</span>
                                <span className="font-mono">{formatCurrency(month.total_payment)}</span>
                              </div>
                              <div className="space-y-1">
                                {month.payments?.map((p) => (
                                  <div key={p.card} className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">{p.card}</span>
                                    <span className={p.type === "extra" ? "text-emerald-600 font-medium" : ""}>
                                      {formatCurrency(p.payment)}
                                      {p.type === "extra" && " (extra)"}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Add/Edit Card Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingCard ? "Editar Tarjeta" : "Agregar Tarjeta"}</DialogTitle>
            <DialogDescription>
              Configura los datos de tu tarjeta de crédito
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input
                  placeholder="Ej: Diners Principal"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  data-testid="card-name"
                />
              </div>
              <div className="space-y-2">
                <Label>Banco</Label>
                <Select 
                  value={formData.bank} 
                  onValueChange={(v) => {
                    const bankInfo = BANKS.find(b => b.value === v);
                    setFormData({ 
                      ...formData, 
                      bank: bankInfo?.label || v,
                      is_international: bankInfo?.country === "USA",
                      apr: bankInfo?.country === "USA" ? 29 : 15
                    });
                  }}
                >
                  <SelectTrigger data-testid="card-bank">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {BANKS.map((bank) => (
                      <SelectItem key={bank.value} value={bank.value}>
                        {bank.label} ({bank.country})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>APR (% anual)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.apr}
                  onChange={(e) => setFormData({ ...formData, apr: e.target.value })}
                  required
                  data-testid="card-apr"
                />
              </div>
              <div className="space-y-2">
                <Label>Límite de crédito</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.credit_limit}
                  onChange={(e) => setFormData({ ...formData, credit_limit: e.target.value })}
                  required
                  data-testid="card-limit"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Saldo actual</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.current_balance}
                  onChange={(e) => setFormData({ ...formData, current_balance: e.target.value })}
                  data-testid="card-balance"
                />
              </div>
              <div className="space-y-2">
                <Label>Pago mínimo</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.minimum_payment}
                  onChange={(e) => setFormData({ ...formData, minimum_payment: e.target.value })}
                  data-testid="card-minimum"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Día de corte</Label>
                <Input
                  type="number"
                  min="1"
                  max="31"
                  value={formData.cut_off_day}
                  onChange={(e) => setFormData({ ...formData, cut_off_day: e.target.value })}
                  data-testid="card-cutoff"
                />
              </div>
              <div className="space-y-2">
                <Label>Día límite de pago</Label>
                <Input
                  type="number"
                  min="1"
                  max="31"
                  value={formData.payment_due_day}
                  onChange={(e) => setFormData({ ...formData, payment_due_day: e.target.value })}
                  data-testid="card-dueday"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
              <div className="flex items-center gap-2">
                <Bank size={18} className="text-muted-foreground" />
                <span className="text-sm">¿Es tarjeta internacional (USA)?</span>
              </div>
              <Switch
                checked={formData.is_international}
                onCheckedChange={(checked) => setFormData({ ...formData, is_international: checked })}
              />
            </div>

            <DialogFooter>
              <Button type="submit" data-testid="save-card">
                {editingCard ? "Actualizar" : "Agregar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Registrar Pago</DialogTitle>
            <DialogDescription>
              {selectedCardForPayment?.name} - Saldo: {formatCurrency(selectedCardForPayment?.current_balance)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant={paymentType === "minimum" ? "default" : "outline"}
                onClick={() => {
                  setPaymentType("minimum");
                  setPaymentAmount(selectedCardForPayment?.minimum_payment?.toString() || "");
                }}
                size="sm"
              >
                Mínimo
              </Button>
              <Button
                variant={paymentType === "full" ? "default" : "outline"}
                onClick={() => {
                  setPaymentType("full");
                  setPaymentAmount(selectedCardForPayment?.current_balance?.toString() || "");
                }}
                size="sm"
              >
                Total
              </Button>
              <Button
                variant={paymentType === "custom" ? "default" : "outline"}
                onClick={() => setPaymentType("custom")}
                size="sm"
              >
                Otro
              </Button>
            </div>
            
            <div className="space-y-2">
              <Label>Monto a pagar</Label>
              <Input
                type="number"
                step="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handlePayment} disabled={!paymentAmount}>
              Registrar Pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
