import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { Calendar } from "../components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { 
  Plus, 
  Pencil, 
  Trash, 
  CalendarBlank,
  Airplane,
  PiggyBank,
  Target,
  CheckCircle,
  Clock,
  MapPin,
  CurrencyDollar,
  Gear,
  Receipt,
  Eye,
  CaretRight
} from "@phosphor-icons/react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SUBCATEGORY_ICONS = {
  "Hoteles": "🏨",
  "Pasajes": "✈️",
  "Comida": "🍽️",
  "Entretenimiento": "🎭",
  "Ropa": "👕",
  "Tech": "📱",
  "Transporte": "🚗",
  "Tours": "🗺️",
  "Otros": "📦"
};

const STATUS_CONFIG = {
  active: { label: "Activa", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400", icon: Target },
  completed: { label: "Completada", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400", icon: CheckCircle },
  cancelled: { label: "Cancelada", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400", icon: Clock }
};

export default function MetasViaje() {
  const { getAuthHeaders, user } = useAuth();
  const [goals, setGoals] = useState([]);
  const [travelFund, setTravelFund] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [subcategorySummary, setSubcategorySummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  
  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [savingsDialogOpen, setSavingsDialogOpen] = useState(false);
  const [fundDepositDialogOpen, setFundDepositDialogOpen] = useState(false);
  const [fundSettingsDialogOpen, setFundSettingsDialogOpen] = useState(false);
  const [transactionDetailOpen, setTransactionDetailOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  
  const [editingGoal, setEditingGoal] = useState(null);
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [savingsAmount, setSavingsAmount] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [depositNote, setDepositNote] = useState("");
  const [newAnnualBudget, setNewAnnualBudget] = useState("");

  // Form state
  const [formData, setFormData] = useState({
    destination: "",
    target_amount: "",
    target_date: new Date(new Date().setMonth(new Date().getMonth() + 6)),
    notes: "",
    status: "active"
  });

  const canEdit = user?.role === "admin" || user?.role === "spouse";

  const fetchData = useCallback(async () => {
    try {
      const [goalsRes, fundRes, transactionsRes] = await Promise.all([
        axios.get(`${API}/travel-goals`, { headers: getAuthHeaders() }),
        axios.get(`${API}/travel-fund`, { headers: getAuthHeaders() }),
        axios.get(`${API}/travel-fund/transactions`, { headers: getAuthHeaders() })
      ]);
      
      setGoals(goalsRes.data.goals || []);
      setTravelFund(fundRes.data);
      setTransactions(transactionsRes.data.transactions || []);
      setSubcategorySummary(transactionsRes.data.by_subcategory || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Error al cargar datos de viajes");
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-EC', {
      style: 'currency',
      currency: 'USD'
    }).format(value || 0);
  };

  // Goal handlers
  const handleSaveGoal = async () => {
    if (!formData.destination || !formData.target_amount) {
      toast.error("Completa los campos requeridos");
      return;
    }

    try {
      const payload = {
        ...formData,
        target_amount: parseFloat(formData.target_amount),
        target_date: format(formData.target_date, "yyyy-MM-dd")
      };

      if (editingGoal) {
        await axios.put(`${API}/travel-goals/${editingGoal.id}`, payload, { headers: getAuthHeaders() });
        toast.success("Meta actualizada");
      } else {
        await axios.post(`${API}/travel-goals`, payload, { headers: getAuthHeaders() });
        toast.success("Meta creada");
      }

      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      const errorMsg = error.response?.data?.detail;
      toast.error(typeof errorMsg === 'string' ? errorMsg : "Error al guardar meta");
    }
  };

  const handleDeleteGoal = async (goalId) => {
    if (!window.confirm("¿Eliminar esta meta?")) return;
    
    try {
      await axios.delete(`${API}/travel-goals/${goalId}`, { headers: getAuthHeaders() });
      toast.success("Meta eliminada");
      fetchData();
    } catch (error) {
      toast.error("Error al eliminar meta");
    }
  };

  const handleAddSavings = async () => {
    if (!savingsAmount || !selectedGoal) return;

    try {
      await axios.post(
        `${API}/travel-goals/${selectedGoal.id}/add-savings`,
        { amount: parseFloat(savingsAmount) },
        { headers: getAuthHeaders() }
      );
      toast.success(`${formatCurrency(savingsAmount)} agregado a ${selectedGoal.destination}`);
      setSavingsDialogOpen(false);
      setSavingsAmount("");
      setSelectedGoal(null);
      fetchData();
    } catch (error) {
      const errorMsg = error.response?.data?.detail;
      toast.error(typeof errorMsg === 'string' ? errorMsg : "Error al agregar ahorro");
    }
  };

  const handleFundDeposit = async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      toast.error("Ingresa un monto válido");
      return;
    }

    try {
      await axios.post(
        `${API}/travel-fund/deposit`,
        { amount: parseFloat(depositAmount), note: depositNote || "Ahorro para viajes" },
        { headers: getAuthHeaders() }
      );
      toast.success(`${formatCurrency(depositAmount)} agregado al fondo`);
      setFundDepositDialogOpen(false);
      setDepositAmount("");
      setDepositNote("");
      fetchData();
    } catch (error) {
      const errorMsg = error.response?.data?.detail;
      toast.error(typeof errorMsg === 'string' ? errorMsg : "Error al agregar al fondo");
    }
  };

  const handleUpdateBudget = async () => {
    if (!newAnnualBudget || parseFloat(newAnnualBudget) <= 0) {
      toast.error("Ingresa un monto válido");
      return;
    }

    try {
      await axios.put(
        `${API}/travel-fund/settings`,
        { annual_budget: parseFloat(newAnnualBudget) },
        { headers: getAuthHeaders() }
      );
      toast.success("Meta anual actualizada");
      setFundSettingsDialogOpen(false);
      setNewAnnualBudget("");
      fetchData();
    } catch (error) {
      const errorMsg = error.response?.data?.detail;
      toast.error(typeof errorMsg === 'string' ? errorMsg : "Error al actualizar meta");
    }
  };

  const resetForm = () => {
    setFormData({
      destination: "",
      target_amount: "",
      target_date: new Date(new Date().setMonth(new Date().getMonth() + 6)),
      notes: "",
      status: "active"
    });
    setEditingGoal(null);
  };

  const openEditGoal = (goal) => {
    setEditingGoal(goal);
    setFormData({
      destination: goal.destination,
      target_amount: goal.target_amount.toString(),
      target_date: new Date(goal.target_date),
      notes: goal.notes || "",
      status: goal.status || "active"
    });
    setDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const activeGoals = goals.filter(g => g.status === "active");
  const totalSaved = travelFund?.total_saved || travelFund?.total_deposited || 0;
  const totalSpent = travelFund?.total_spent || 0;
  const available = totalSaved - totalSpent;

  return (
    <div className="space-y-6" data-testid="viajes-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
            <Airplane size={32} className="text-violet-600" weight="duotone" />
            Viajes
          </h1>
          <p className="text-muted-foreground">Gestiona tu fondo de viajes y entretenimiento</p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button 
              onClick={() => setFundDepositDialogOpen(true)}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700"
            >
              <PiggyBank size={18} />
              Registrar Ahorro
            </Button>
            <Button 
              onClick={() => { resetForm(); setDialogOpen(true); }}
              className="gap-2"
            >
              <Plus size={18} />
              Nueva Meta
            </Button>
          </div>
        )}
      </div>

      {/* Fondo de Viajes - Resumen Principal */}
      {travelFund && (
        <Card className="bento-card bg-gradient-to-r from-violet-50 via-purple-50 to-fuchsia-50 dark:from-violet-950/30 dark:via-purple-950/30 dark:to-fuchsia-950/30 border-violet-200 dark:border-violet-800">
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">Meta Anual {travelFund.year}</p>
                <p className="text-2xl font-bold text-violet-700">{formatCurrency(travelFund.annual_budget)}</p>
                {canEdit && (
                  <Button 
                    variant="link" 
                    size="sm" 
                    className="text-xs h-auto p-0 text-violet-600"
                    onClick={() => {
                      setNewAnnualBudget(travelFund.annual_budget.toString());
                      setFundSettingsDialogOpen(true);
                    }}
                  >
                    Editar meta
                  </Button>
                )}
              </div>
              <div className="text-center p-3 rounded-xl bg-emerald-100/50 dark:bg-emerald-900/20">
                <p className="text-xs text-emerald-700 dark:text-emerald-400 mb-1">Ya Ahorrado</p>
                <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalSaved)}</p>
                <p className="text-xs text-muted-foreground">{travelFund.savings_progress?.toFixed(0) || 0}% de la meta</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-red-100/50 dark:bg-red-900/20">
                <p className="text-xs text-red-700 dark:text-red-400 mb-1">Gastado</p>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(totalSpent)}</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-blue-100/50 dark:bg-blue-900/20">
                <p className="text-xs text-blue-700 dark:text-blue-400 mb-1">Disponible</p>
                <p className="text-2xl font-bold text-blue-600">{formatCurrency(Math.max(0, available))}</p>
              </div>
            </div>
            
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Progreso de ahorro</span>
                <span>{formatCurrency(totalSaved)} / {formatCurrency(travelFund.annual_budget)}</span>
              </div>
              <Progress value={travelFund.savings_progress || 0} className="h-3" />
              {travelFund.monthly_suggested_saving > 0 && (
                <p className="text-sm text-violet-600">
                  💡 Ahorra <strong>{formatCurrency(travelFund.monthly_suggested_saving)}</strong>/mes para completar tu meta
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs: Destinos | Gastos por Categoría | Transacciones */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview" className="gap-2">
            <Target size={16} />
            Destinos
          </TabsTrigger>
          <TabsTrigger value="categories" className="gap-2">
            <Receipt size={16} />
            Por Categoría
          </TabsTrigger>
          <TabsTrigger value="transactions" className="gap-2">
            <CurrencyDollar size={16} />
            Transacciones
          </TabsTrigger>
        </TabsList>

        {/* Tab: Destinos (Metas de viaje) */}
        <TabsContent value="overview" className="space-y-4">
          {activeGoals.length === 0 ? (
            <Card className="bento-card">
              <CardContent className="text-center py-12">
                <Airplane size={48} className="mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground mb-4">No tienes destinos de viaje activos</p>
                {canEdit && (
                  <Button onClick={() => { resetForm(); setDialogOpen(true); }} className="gap-2">
                    <Plus size={16} />
                    Crear Primer Destino
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {activeGoals.map((goal) => {
                const progress = goal.target_amount > 0 
                  ? ((goal.saved_amount || 0) / goal.target_amount) * 100 
                  : 0;
                const daysLeft = differenceInDays(new Date(goal.target_date), new Date());
                
                return (
                  <motion.div
                    key={goal.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                  >
                    <Card className="bento-card hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          {/* Icon */}
                          <div className="w-12 h-12 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center shrink-0">
                            <MapPin size={24} className="text-violet-600" />
                          </div>
                          
                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold truncate">{goal.destination}</h3>
                              <Badge variant="secondary" className="text-xs">
                                {daysLeft > 0 ? `${daysLeft} días` : "Vencida"}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                              <span>{format(new Date(goal.target_date), "d MMM yyyy", { locale: es })}</span>
                            </div>
                            <Progress value={Math.min(progress, 100)} className="h-2 mb-1" />
                            <div className="flex justify-between text-xs">
                              <span className="font-semibold text-violet-600">
                                {formatCurrency(goal.saved_amount || 0)}
                              </span>
                              <span className="text-muted-foreground">
                                {progress.toFixed(0)}% de {formatCurrency(goal.target_amount)}
                              </span>
                            </div>
                          </div>
                          
                          {/* Actions */}
                          {canEdit && (
                            <div className="flex gap-1 shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => {
                                  setSelectedGoal(goal);
                                  setSavingsDialogOpen(true);
                                }}
                              >
                                <PiggyBank size={16} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openEditGoal(goal)}
                              >
                                <Pencil size={16} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-500 hover:text-red-600"
                                onClick={() => handleDeleteGoal(goal.id)}
                              >
                                <Trash size={16} />
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Tab: Gastos por Categoría */}
        <TabsContent value="categories" className="space-y-4">
          {subcategorySummary.length === 0 ? (
            <Card className="bento-card">
              <CardContent className="text-center py-12">
                <Receipt size={48} className="mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">No hay gastos de viajes registrados este año</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {subcategorySummary.map((cat, index) => {
                const percentage = totalSpent > 0 ? (cat.total / totalSpent) * 100 : 0;
                const budgetPercentage = travelFund?.annual_budget > 0 
                  ? (cat.total / travelFund.annual_budget) * 100 
                  : 0;
                
                return (
                  <motion.div
                    key={cat.subcategory}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="bento-card h-full">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3 mb-3">
                          <span className="text-2xl">{SUBCATEGORY_ICONS[cat.subcategory] || "📦"}</span>
                          <div className="flex-1">
                            <h3 className="font-semibold">{cat.subcategory}</h3>
                            <p className="text-xs text-muted-foreground">{cat.count} transacciones</p>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex justify-between items-end">
                            <span className="text-2xl font-bold text-red-600">
                              {formatCurrency(cat.total)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {percentage.toFixed(0)}% del total
                            </span>
                          </div>
                          
                          <Progress value={budgetPercentage} className="h-2" />
                          
                          <p className="text-xs text-muted-foreground">
                            {budgetPercentage.toFixed(1)}% del presupuesto anual
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Tab: Transacciones */}
        <TabsContent value="transactions" className="space-y-4">
          <Card className="bento-card">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Transacciones de Viajes</CardTitle>
                  <CardDescription>{transactions.length} transacciones este año</CardDescription>
                </div>
                <Badge variant="secondary" className="text-lg px-3 py-1">
                  {formatCurrency(totalSpent)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {transactions.length === 0 ? (
                <div className="text-center py-8">
                  <Receipt size={40} className="mx-auto mb-3 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">No hay transacciones de viajes este año</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                  {transactions.map((tx, index) => (
                    <motion.div
                      key={tx.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.02 }}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => {
                        setSelectedTransaction(tx);
                        setTransactionDetailOpen(true);
                      }}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className="text-lg shrink-0">
                          {SUBCATEGORY_ICONS[tx.subcategory] || "📦"}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{tx.description}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{format(new Date(tx.date), "d MMM", { locale: es })}</span>
                            <Badge variant="outline" className="text-xs">
                              {tx.subcategory || "Sin categoría"}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-red-600">{formatCurrency(tx.amount)}</span>
                        <CaretRight size={16} className="text-muted-foreground" />
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog: Nueva/Editar Meta */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Airplane size={24} className="text-violet-500" />
              {editingGoal ? "Editar Destino" : "Nuevo Destino"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Destino</Label>
              <Input
                placeholder="Miami, Galápagos, Europa..."
                value={formData.destination}
                onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                data-testid="goal-destination"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Monto Objetivo</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  type="number"
                  placeholder="3000"
                  className="pl-8"
                  value={formData.target_amount}
                  onChange={(e) => setFormData({ ...formData, target_amount: e.target.value })}
                  data-testid="goal-amount"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Fecha Objetivo</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start font-normal">
                    <CalendarBlank size={16} className="mr-2" />
                    {format(formData.target_date, "PPP", { locale: es })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-[250]" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.target_date}
                    onSelect={(date) => date && setFormData({ ...formData, target_date: date })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="space-y-2">
              <Label>Notas (opcional)</Label>
              <Input
                placeholder="Notas adicionales..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveGoal} data-testid="save-goal-btn">
                {editingGoal ? "Guardar" : "Crear"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Agregar Ahorro a Meta */}
      <Dialog open={savingsDialogOpen} onOpenChange={setSavingsDialogOpen}>
        <DialogContent className="sm:max-w-[350px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PiggyBank size={24} className="text-emerald-500" />
              Agregar Ahorro
            </DialogTitle>
            <DialogDescription>
              {selectedGoal && (
                <>
                  Meta: <strong>{selectedGoal.destination}</strong><br />
                  Progreso: {formatCurrency(selectedGoal.saved_amount || 0)} / {formatCurrency(selectedGoal.target_amount)}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                className="pl-8 text-lg font-semibold"
                value={savingsAmount}
                onChange={(e) => setSavingsAmount(e.target.value)}
                autoFocus
                data-testid="savings-amount-input"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {[50, 100, 200, 500].map((amount) => (
                <Button
                  key={amount}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSavingsAmount(amount.toString())}
                >
                  ${amount}
                </Button>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSavingsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAddSavings} className="gap-2" data-testid="confirm-savings-btn">
                <CurrencyDollar size={16} />
                Agregar
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Registrar Ahorro al Fondo */}
      <Dialog open={fundDepositDialogOpen} onOpenChange={setFundDepositDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PiggyBank size={24} className="text-emerald-500" />
              Registrar Ahorro
            </DialogTitle>
            <DialogDescription>
              Registra el dinero que has apartado para viajes y entretenimiento.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Monto Ahorrado</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  className="pl-8 text-lg font-semibold"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  autoFocus
                  data-testid="fund-deposit-amount"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Nota (opcional)</Label>
              <Input
                placeholder="Ej: Transferencia a cuenta de ahorros"
                value={depositNote}
                onChange={(e) => setDepositNote(e.target.value)}
                data-testid="fund-deposit-note"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {[100, 250, 500, 1000].map((amount) => (
                <Button
                  key={amount}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDepositAmount(amount.toString())}
                >
                  ${amount}
                </Button>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setFundDepositDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleFundDeposit} className="gap-2 bg-emerald-600 hover:bg-emerald-700" data-testid="confirm-fund-deposit-btn">
                <CurrencyDollar size={16} />
                Registrar
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Editar Meta Anual */}
      <Dialog open={fundSettingsDialogOpen} onOpenChange={setFundSettingsDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gear size={24} className="text-slate-500" />
              Editar Meta Anual
            </DialogTitle>
            <DialogDescription>
              Define cuánto planeas destinar a viajes y entretenimiento este año.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Meta Anual</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="16500.00"
                  className="pl-8 text-lg font-semibold"
                  value={newAnnualBudget}
                  onChange={(e) => setNewAnnualBudget(e.target.value)}
                  autoFocus
                  data-testid="fund-annual-budget"
                />
              </div>
              {newAnnualBudget && (
                <p className="text-sm text-muted-foreground">
                  Debes ahorrar {formatCurrency(parseFloat(newAnnualBudget) / 12)}/mes
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setFundSettingsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleUpdateBudget} data-testid="confirm-fund-settings-btn">
                Guardar
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Detalle de Transacción */}
      <Dialog open={transactionDetailOpen} onOpenChange={setTransactionDetailOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt size={24} className="text-violet-500" />
              Detalle de Transacción
            </DialogTitle>
          </DialogHeader>
          {selectedTransaction && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/30">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-3xl">
                    {SUBCATEGORY_ICONS[selectedTransaction.subcategory] || "📦"}
                  </span>
                  <span className="text-2xl font-bold text-red-600">
                    {formatCurrency(selectedTransaction.amount)}
                  </span>
                </div>
                <h3 className="font-semibold text-lg mb-2">{selectedTransaction.description}</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Fecha</p>
                    <p className="font-medium">
                      {format(new Date(selectedTransaction.date), "PPP", { locale: es })}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Categoría</p>
                    <p className="font-medium">{selectedTransaction.subcategory || "Sin categoría"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Método de Pago</p>
                    <p className="font-medium capitalize">{selectedTransaction.payment_method || "No especificado"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Estado</p>
                    <Badge variant={selectedTransaction.status === "approved" ? "default" : "secondary"}>
                      {selectedTransaction.status === "approved" ? "Aprobada" : "Pendiente"}
                    </Badge>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setTransactionDetailOpen(false)}>
                  Cerrar
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
