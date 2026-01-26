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
import { Switch } from "../components/ui/switch";
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
  Lightning
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
  { value: "servicios_basicos", label: "Servicios Básicos" },
  { value: "empleados", label: "Empleados" },
  { value: "colegio_actividades", label: "Colegio y Actividades" },
  { value: "seguros", label: "Seguros" },
  { value: "comida", label: "Comida" },
  { value: "restaurantes", label: "Restaurantes" },
  { value: "carros", label: "Carros" },
  { value: "usa", label: "USA" },
  { value: "viajes", label: "Viajes" },
  { value: "gastos_libres", label: "Gastos Libres" }
];

export default function Flujo() {
  const { getAuthHeaders, user } = useAuth();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    amount: "",
    due_day: 1,
    category: "",
    payment_method: "transferencia",
    is_recurring: true,
    reminder_days_before: 2
  });

  useEffect(() => {
    fetchData();
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const payload = {
        ...formData,
        amount: parseFloat(formData.amount),
        due_day: parseInt(formData.due_day),
        reminder_days_before: parseInt(formData.reminder_days_before)
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
      payment_method: payment.payment_method,
      is_recurring: payment.is_recurring,
      reminder_days_before: payment.reminder_days_before
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
      payment_method: "transferencia",
      is_recurring: true,
      reminder_days_before: 2
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

  const weeks = groupByWeek(payments);
  const totalMonthly = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

  // Get method icon
  const getMethodIcon = (method) => {
    const found = PAYMENT_METHODS.find(m => m.value === method);
    return found?.icon || Receipt;
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
        <div className="flex items-center gap-2">
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

      {/* Calendar View by Week */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(weeks).map(([key, week]) => (
          <Card key={key} className="bento-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <CalendarBlank size={18} />
                  {week.label}
                </span>
                <Badge variant="secondary">
                  {formatCurrency(week.payments.reduce((s, p) => s + p.amount, 0))}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {week.payments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Sin pagos programados
                </p>
              ) : (
                <div className="space-y-2">
                  {week.payments.map((payment) => {
                    const MethodIcon = getMethodIcon(payment.payment_method);
                    const isPastDue = payment.days_until_due < 0;
                    const isDueSoon = payment.is_due_soon;
                    
                    return (
                      <motion.div
                        key={payment.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={`p-3 rounded-lg border transition-colors ${
                          isPastDue 
                            ? "bg-red-50 dark:bg-red-900/20 border-red-200" 
                            : isDueSoon 
                              ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200"
                              : "bg-muted/50 border-transparent"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${
                              isDueSoon ? "bg-amber-100" : "bg-muted"
                            }`}>
                              <MethodIcon size={18} className={isDueSoon ? "text-amber-600" : "text-muted-foreground"} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{payment.name}</span>
                                {isDueSoon && (
                                  <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                                    <Bell size={10} className="mr-1" />
                                    {payment.days_until_due === 0 ? "Hoy" : `${payment.days_until_due}d`}
                                  </Badge>
                                )}
                                {payment.is_recurring && (
                                  <Badge variant="secondary" className="text-xs">
                                    <Clock size={10} className="mr-1" />
                                    Recurrente
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                <span>Día {payment.due_day}</span>
                                <span>•</span>
                                <span>{PAYMENT_METHODS.find(m => m.value === payment.payment_method)?.label}</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-semibold">{formatCurrency(payment.amount)}</span>
                            {canEdit && (
                              <div className="flex gap-1">
                                <Button 
                                  size="icon" 
                                  variant="ghost"
                                  onClick={() => handleMarkPaid(payment.id)}
                                  title="Marcar como pagado"
                                  className="h-8 w-8"
                                >
                                  <CheckCircle size={16} className="text-emerald-600" />
                                </Button>
                                <Button 
                                  size="icon" 
                                  variant="ghost"
                                  onClick={() => handleEdit(payment)}
                                  className="h-8 w-8"
                                >
                                  <Pencil size={14} />
                                </Button>
                                <Button 
                                  size="icon" 
                                  variant="ghost"
                                  onClick={() => handleDelete(payment.id)}
                                  className="h-8 w-8 text-red-600 hover:text-red-700"
                                >
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
            </CardContent>
          </Card>
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
