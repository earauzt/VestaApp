import { useState, useEffect, useCallback, useRef } from "react";
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
import { DateInput } from "../components/ui/date-input";
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
  CaretRight,
  LinkSimple,
  MagnifyingGlass
} from "@phosphor-icons/react";
import {
  Hotel as LIHotel,
  Plane as LIPlane,
  Utensils as LIUtensils,
  Drama as LIDrama,
  Shirt as LIShirt,
  Smartphone as LISmart,
  Car as LICar,
  Map as LIMap,
  Package as LIPackage,
  GraduationCap as LIGrad,
  Home as LIHome,
  Shield as LIShield,
  PartyPopper as LIParty,
  TrendingUp as LITrend,
  Star as LIStar,
} from "lucide-react";
import { components, typography } from "../styles/design-system";

const IconRender = ({ Comp, size = 16, className = "" }) => Comp ? <Comp size={size} className={className} /> : null;

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SUBCATEGORY_ICONS = {
  "Hoteles": LIHotel,
  "Pasajes": LIPlane,
  "Comida": LIUtensils,
  "Entretenimiento": LIDrama,
  "Ropa": LIShirt,
  "Tech": LISmart,
  "Transporte": LICar,
  "Tours": LIMap,
  "Otros": LIPackage
};

const GOAL_TYPES = [
  { value: "viaje", label: "Viaje", Icon: LIPlane },
  { value: "educacion", label: "Educacion", Icon: LIGrad },
  { value: "hogar", label: "Hogar", Icon: LIHome },
  { value: "emergencia", label: "Emergencia", Icon: LIShield },
  { value: "celebracion", label: "Celebracion", Icon: LIParty },
  { value: "inversion", label: "Inversion", Icon: LITrend },
  { value: "otro", label: "Otro", Icon: LIStar }
];

const STATUS_CONFIG = {
  active: { label: "Activa", color: "bg-slate-50 text-[#0D9E82] dark:bg-slate-800 dark:text-[#0D9E82]", icon: Target },
  completed: { label: "Completada", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400", icon: CheckCircle },
  cancelled: { label: "Cancelada", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400", icon: Clock }
};

export default function MetasViaje() {
  const { getAuthHeaders, user } = useAuth();

  const getAuthHeadersRef = useRef(getAuthHeaders);
  useEffect(() => { getAuthHeadersRef.current = getAuthHeaders; });
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
    tipo: "viaje",
    notes: "",
    status: "active"
  });

  // Link expense state
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkGoalId, setLinkGoalId] = useState(null);
  const [searchTx, setSearchTx] = useState("");
  const [searchResults, setSearchResults] = useState([]);

  const canEdit = user?.role === "admin" || user?.role === "spouse";

  const fetchData = useCallback(async () => {
    try {
      const [goalsRes, fundRes, transactionsRes] = await Promise.all([
        axios.get(`${API}/travel-goals`, { headers: getAuthHeadersRef.current() }),
        axios.get(`${API}/travel-fund`, { headers: getAuthHeadersRef.current() }),
        axios.get(`${API}/travel-fund/transactions`, { headers: getAuthHeadersRef.current() })
      ]);
      
      setGoals(goalsRes.data.goals || []);
      setTravelFund(fundRes.data);
      setTransactions(transactionsRes.data.transactions || []);
      setSubcategorySummary(transactionsRes.data.by_subcategory || []);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') console.error("Error fetching data:", error);
      toast.error("Error al cargar datos de viajes");
    } finally {
      setLoading(false);
    }
  }, []);

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
        await axios.put(`${API}/travel-goals/${editingGoal.id}`, payload, { headers: getAuthHeadersRef.current() });
        toast.success("Meta actualizada");
      } else {
        await axios.post(`${API}/travel-goals`, payload, { headers: getAuthHeadersRef.current() });
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
      await axios.delete(`${API}/travel-goals/${goalId}`, { headers: getAuthHeadersRef.current() });
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
        { headers: getAuthHeadersRef.current() }
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
        { headers: getAuthHeadersRef.current() }
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
        { headers: getAuthHeadersRef.current() }
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
      tipo: "viaje",
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
      tipo: goal.tipo || "viaje",
      notes: goal.notes || "",
      status: goal.status || "active"
    });
    setDialogOpen(true);
  };

  const handleSearchTransactions = async (query) => {
    setSearchTx(query);
    if (query.length < 2) { setSearchResults([]); return; }
    try {
      const res = await axios.get(`${API}/transactions`, { headers: getAuthHeadersRef.current() });
      const filtered = (Array.isArray(res.data) ? res.data : []).filter(t =>
        (t.description || "").toLowerCase().includes(query.toLowerCase()) ||
        (t.establishment || "").toLowerCase().includes(query.toLowerCase())
      ).slice(0, 10);
      setSearchResults(filtered);
    } catch { setSearchResults([]); }
  };

  const handleLinkTransaction = async (txId) => {
    try {
      await axios.post(`${API}/travel-goals/${linkGoalId}/link-transaction`, { transaction_id: txId }, { headers: getAuthHeadersRef.current() });
      toast.success("Gasto vinculado a la meta");
      setLinkDialogOpen(false);
      setSearchTx("");
      setSearchResults([]);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al vincular");
    }
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
            <Airplane size={32} className="text-[#0D9E82]" weight="duotone" />
            Viajes
          </h1>
          <p className="text-muted-foreground">Gestiona tu fondo de viajes y entretenimiento</p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button 
              onClick={() => setFundDepositDialogOpen(true)}
              className="gap-2 bg-[#0D9E82] hover:bg-[#0B8A70] text-white"
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
        <Card className="bento-card bg-white ">
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">Meta Anual {travelFund.year}</p>
                <p className="text-2xl font-bold text-slate-900">{formatCurrency(travelFund.annual_budget)}</p>
                {canEdit && (
                  <Button 
                    variant="link" 
                    size="sm" 
                    className="text-xs h-auto p-0 text-[#0D9E82]"
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
              <div className="text-center p-3 rounded-xl bg-slate-50/50 dark:bg-slate-800">
                <p className="text-xs text-[#0D9E82] dark:text-[#0D9E82] mb-1">Disponible</p>
                <p className="text-2xl font-bold text-[#0D9E82]">{formatCurrency(Math.max(0, available))}</p>
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
                <p className="text-sm text-[#0D9E82] flex items-start gap-2">
                  <LITrend size={14} className="mt-0.5 shrink-0" />
                  <span>Ahorra <strong>{formatCurrency(travelFund.monthly_suggested_saving)}</strong>/mes para completar tu meta</span>
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
                          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center shrink-0 text-slate-600">
                            <IconRender Comp={GOAL_TYPES.find(t => t.value === (goal.tipo || "viaje"))?.Icon || LIStar} size={22} />
                          </div>
                          
                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold truncate">{goal.destination}</h3>
                              <Badge variant="outline" className="text-[10px]">{GOAL_TYPES.find(t => t.value === (goal.tipo || "viaje"))?.label || "Otro"}</Badge>
                              <Badge variant="secondary" className="text-xs">
                                {daysLeft > 0 ? `${daysLeft} dias` : "Vencida"}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                              <span>{format(new Date(goal.target_date), "d MMM yyyy", { locale: es })}</span>
                              {goal.monthly_needed > 0 && <span>Ahorrar {formatCurrency(goal.monthly_needed)}/mes</span>}
                              {goal.total_spent > 0 && <span className="text-amber-600">Gastado: {formatCurrency(goal.total_spent)}</span>}
                            </div>
                            <Progress value={Math.min(progress, 100)} className="h-2 mb-1" />
                            <div className="flex justify-between text-xs">
                              <span className="font-semibold text-[#0D9E82]">
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
                              <Button variant="ghost" size="icon" className="h-8 w-8" title="Vincular gasto"
                                aria-label="Vincular gasto"
                                data-testid={`link-tx-${goal.id}`}
                                onClick={() => { setLinkGoalId(goal.id); setLinkDialogOpen(true); }}>
                                <LinkSimple size={16} />
                              </Button>
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
                          <div className="w-10 h-10 rounded-md bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                            <IconRender Comp={SUBCATEGORY_ICONS[cat.subcategory] || LIPackage} size={18} />
                          </div>
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
                        <div className="w-8 h-8 rounded-md bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                          <IconRender Comp={SUBCATEGORY_ICONS[tx.subcategory] || LIPackage} size={15} />
                        </div>
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
              <IconRender Comp={GOAL_TYPES.find(t => t.value === formData.tipo)?.Icon || LIStar} size={18} className="text-[#0D9E82]" />
              {editingGoal ? "Editar Meta" : "Nueva Meta"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Type selector */}
            <div className="space-y-2">
              <Label>Tipo de Meta</Label>
              <div className="grid grid-cols-4 gap-2">
                {GOAL_TYPES.map(type => (
                  <button
                    key={type.value}
                    type="button"
                    className={`flex flex-col items-center gap-1 p-2 rounded-md border text-xs transition-colors ${
                      formData.tipo === type.value 
                        ? "border-[#0D9E82] bg-slate-50 ring-1 ring-[#0D9E82] text-[#0D9E82]" 
                        : "border-slate-200 hover:border-slate-300 text-slate-600"
                    }`}
                    onClick={() => setFormData({ ...formData, tipo: type.value })}
                  >
                    <IconRender Comp={type.Icon} size={18} />
                    <span>{type.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input
                placeholder="Vacaciones Miami, Fondo universidad..."
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
            
            <DateInput
              label="Fecha Objetivo"
              value={formData.target_date}
              onChange={(date) => setFormData({ ...formData, target_date: date })}
              data-testid="goal-date"
            />
            
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
              <Button onClick={handleFundDeposit} className="gap-2 bg-[#0D9E82] hover:bg-[#0B8A70] text-white" data-testid="confirm-fund-deposit-btn">
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
              <Receipt size={24} className="text-[#0D9E82]" />
              Detalle de Transacción
            </DialogTitle>
          </DialogHeader>
          {selectedTransaction && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/30">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-md bg-slate-100 text-slate-600 flex items-center justify-center">
                    <IconRender Comp={SUBCATEGORY_ICONS[selectedTransaction.subcategory] || LIPackage} size={22} />
                  </div>
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

      {/* Link Transaction Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LinkSimple size={20} className="text-[#0D9E82]" />
              Vincular Gasto a Meta
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar transaccion..."
                className="pl-9"
                value={searchTx}
                onChange={(e) => handleSearchTransactions(e.target.value)}
                data-testid="link-tx-search"
              />
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1">
              {searchResults.map(tx => (
                <button
                  key={tx.id}
                  className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 text-left transition-colors"
                  onClick={() => handleLinkTransaction(tx.id)}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{tx.establishment || tx.description}</p>
                    <p className="text-xs text-muted-foreground">{tx.date}</p>
                  </div>
                  <span className="font-mono font-semibold text-sm shrink-0">${(tx.amount || 0).toFixed(2)}</span>
                </button>
              ))}
              {searchTx.length >= 2 && searchResults.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Sin resultados</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
