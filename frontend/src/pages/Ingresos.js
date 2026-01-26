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
import { Calendar } from "../components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
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
  ChartPie
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

export default function Ingresos() {
  const { getAuthHeaders, user } = useAuth();
  const [incomes, setIncomes] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIncome, setEditingIncome] = useState(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Form state
  const [formData, setFormData] = useState({
    amount: "",
    date: new Date(),
    distribution: "Personal",
    concept: "Salario",
    description: "",
    is_recurring: false,
    payment_method: "transferencia"
  });

  useEffect(() => {
    fetchData();
  }, [selectedYear]);

  const fetchData = async () => {
    try {
      const [incomesRes, summaryRes] = await Promise.all([
        axios.get(`${API}/income?year=${selectedYear}`, { headers: getAuthHeaders() }),
        axios.get(`${API}/income/summary?year=${selectedYear}`, { headers: getAuthHeaders() })
      ]);
      setIncomes(incomesRes.data);
      setSummary(summaryRes.data);
    } catch (error) {
      toast.error("Error al cargar ingresos");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
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

      if (editingIncome) {
        await axios.put(`${API}/income/${editingIncome.id}`, payload, { headers: getAuthHeaders() });
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

  const handleDelete = async (id) => {
    if (!window.confirm("¿Eliminar este ingreso?")) return;
    try {
      await axios.delete(`${API}/income/${id}`, { headers: getAuthHeaders() });
      toast.success("Ingreso eliminado");
      fetchData();
    } catch (error) {
      toast.error("Error al eliminar");
    }
  };

  const handleEdit = (income) => {
    setEditingIncome(income);
    setFormData({
      amount: income.amount.toString(),
      date: new Date(income.date),
      distribution: income.distribution,
      concept: income.concept,
      description: income.description || "",
      is_recurring: income.is_recurring,
      payment_method: income.payment_method || "transferencia"
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingIncome(null);
    setFormData({
      amount: "",
      date: new Date(),
      distribution: "Personal",
      concept: "Salario",
      description: "",
      is_recurring: false,
      payment_method: "transferencia"
    });
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-EC', {
      style: 'currency',
      currency: 'USD'
    }).format(value || 0);
  };

  const canEdit = user?.role === "admin" || user?.role === "spouse";

  return (
    <div className="space-y-6" data-testid="ingresos-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Ingresos</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Registra y distribuye tus ingresos (Personal, APX, USA)
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

          {canEdit && (
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
              <Button onClick={() => setDialogOpen(true)} className="gap-2" data-testid="add-income-btn">
                <Plus size={18} weight="bold" />
                <span className="hidden sm:inline">Nuevo Ingreso</span>
              </Button>
              <DialogContent className="sm:max-w-[450px]">
                <DialogHeader>
                  <DialogTitle>{editingIncome ? "Editar Ingreso" : "Nuevo Ingreso"}</DialogTitle>
                  <DialogDescription>
                    Registra un ingreso y selecciona su distribución para impuestos
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
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
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start gap-2" data-testid="date-picker">
                            <CalendarBlank size={16} />
                            {format(formData.date, "d MMM", { locale: es })}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={formData.date}
                            onSelect={(date) => date && setFormData({ ...formData, date })}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Distribución (para impuestos)</Label>
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
                        <SelectTrigger data-testid="concept-select">
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
                        <SelectTrigger data-testid="payment-method-select">
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

                  <div className="space-y-2">
                    <Label>Descripción (opcional)</Label>
                    <Input
                      placeholder="Detalles adicionales"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      data-testid="description-input"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                    <div className="flex items-center gap-2">
                      <Repeat size={18} className="text-muted-foreground" />
                      <span className="text-sm">¿Es recurrente?</span>
                    </div>
                    <Switch
                      checked={formData.is_recurring}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_recurring: checked })}
                      data-testid="recurring-switch"
                    />
                  </div>

                  <DialogFooter>
                    <Button type="submit" data-testid="save-income">
                      {editingIncome ? "Actualizar" : "Guardar"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bento-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                  <ArrowUp size={20} className="text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total {selectedYear}</p>
                  <p className="text-lg font-bold text-emerald-600">{formatCurrency(summary.total)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {Object.entries(DISTRIBUTION_CONFIG).map(([key, config]) => (
            <Card key={key} className="bento-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${config.bgColor}`}>
                    <config.icon size={20} className={config.color} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{key}</p>
                    <p className={`text-lg font-bold ${config.color}`}>
                      {formatCurrency(summary.by_distribution?.[key] || 0)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Income List */}
      <Card className="bento-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bank size={20} />
            Ingresos {selectedYear} ({incomes.length})
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
                            {income.description && <span>• {income.description}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-emerald-600 text-lg">
                          +{formatCurrency(income.amount)}
                        </span>
                        {canEdit && (
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(income)}>
                              <Pencil size={16} />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleDelete(income.id)}
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
    </div>
  );
}
