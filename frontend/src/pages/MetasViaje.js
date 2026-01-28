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
  CurrencyDollar
} from "@phosphor-icons/react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS_CONFIG = {
  active: { label: "Activa", color: "bg-blue-100 text-blue-800", icon: Target },
  completed: { label: "Completada", color: "bg-emerald-100 text-emerald-800", icon: CheckCircle },
  cancelled: { label: "Cancelada", color: "bg-red-100 text-red-800", icon: Clock }
};

// Preset destinations with estimated costs
const PRESET_DESTINATIONS = [
  { name: "Miami, USA", estimatedCost: 3500 },
  { name: "Nueva York, USA", estimatedCost: 4500 },
  { name: "Orlando, USA", estimatedCost: 4000 },
  { name: "Cancún, México", estimatedCost: 2500 },
  { name: "Galápagos, Ecuador", estimatedCost: 2000 },
  { name: "Europa (España)", estimatedCost: 6000 },
  { name: "Colombia (Cartagena)", estimatedCost: 1500 },
  { name: "Perú (Cusco)", estimatedCost: 1800 },
];

export default function MetasViaje() {
  const { getAuthHeaders, user } = useAuth();
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [savingsDialogOpen, setSavingsDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [savingsAmount, setSavingsAmount] = useState("");

  // Form state
  const [formData, setFormData] = useState({
    destination: "",
    target_amount: "",
    target_date: new Date(new Date().setMonth(new Date().getMonth() + 6)),
    notes: ""
  });

  const fetchGoals = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/travel-goals`, { headers: getAuthHeaders() });
      setGoals(response.data?.goals || []);
    } catch (error) {
      toast.error("Error al cargar metas de viaje");
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.destination || !formData.target_amount || parseFloat(formData.target_amount) <= 0) {
      toast.error("Completa todos los campos requeridos");
      return;
    }

    try {
      const payload = {
        destination: formData.destination,
        target_amount: parseFloat(formData.target_amount),
        target_date: format(formData.target_date, "yyyy-MM-dd"),
        notes: formData.notes
      };

      if (editingGoal) {
        await axios.put(`${API}/travel-goals/${editingGoal.id}`, payload, { headers: getAuthHeaders() });
        toast.success("Meta actualizada");
      } else {
        await axios.post(`${API}/travel-goals`, payload, { headers: getAuthHeaders() });
        toast.success("Meta de viaje creada");
      }

      setDialogOpen(false);
      resetForm();
      fetchGoals();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al guardar");
    }
  };

  const handleAddSavings = async () => {
    if (!savingsAmount || parseFloat(savingsAmount) <= 0) {
      toast.error("Ingresa un monto válido");
      return;
    }

    try {
      await axios.put(
        `${API}/travel-goals/${selectedGoal.id}/add-savings`,
        { amount: parseFloat(savingsAmount) },
        { headers: getAuthHeaders() }
      );
      toast.success("Ahorro agregado");
      setSavingsDialogOpen(false);
      setSavingsAmount("");
      setSelectedGoal(null);
      fetchGoals();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al registrar ahorro");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Eliminar esta meta de viaje?")) return;
    try {
      await axios.delete(`${API}/travel-goals/${id}`, { headers: getAuthHeaders() });
      toast.success("Meta eliminada");
      fetchGoals();
    } catch (error) {
      toast.error("Error al eliminar");
    }
  };

  const handleEdit = (goal) => {
    setEditingGoal(goal);
    setFormData({
      destination: goal.destination,
      target_amount: goal.target_amount.toString(),
      target_date: new Date(goal.target_date),
      notes: goal.notes || ""
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingGoal(null);
    setFormData({
      destination: "",
      target_amount: "",
      target_date: new Date(new Date().setMonth(new Date().getMonth() + 6)),
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

  // Calculate totals
  const totalTargetAmount = goals.filter(g => g.status === "active").reduce((sum, g) => sum + g.target_amount, 0);
  const totalSavedAmount = goals.filter(g => g.status === "active").reduce((sum, g) => sum + (g.saved_amount || 0), 0);
  const overallProgress = totalTargetAmount > 0 ? (totalSavedAmount / totalTargetAmount) * 100 : 0;

  return (
    <div className="space-y-6" data-testid="metas-viaje-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
            <Airplane size={32} className="text-violet-500" weight="duotone" />
            Metas de Viaje
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Planifica y ahorra para tus próximos viajes
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => setDialogOpen(true)} className="gap-2" data-testid="add-goal-btn">
            <Plus size={18} weight="bold" />
            Nueva Meta
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bento-card bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 border-violet-200 dark:border-violet-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-violet-100 dark:bg-violet-900/30">
                <Target size={24} className="text-violet-600" weight="duotone" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Meta Total</p>
                <p className="text-xl font-bold text-violet-600">{formatCurrency(totalTargetAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bento-card bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30 border-emerald-200 dark:border-emerald-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
                <PiggyBank size={24} className="text-emerald-600" weight="duotone" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Ahorrado</p>
                <p className="text-xl font-bold text-emerald-600">{formatCurrency(totalSavedAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bento-card bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 border-blue-200 dark:border-blue-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900/30">
                <Airplane size={24} className="text-blue-600" weight="duotone" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Progreso General</p>
                <p className="text-xl font-bold text-blue-600">{overallProgress.toFixed(0)}%</p>
              </div>
            </div>
            <Progress value={overallProgress} className="mt-3 h-2" />
          </CardContent>
        </Card>
      </div>

      {/* Goals List */}
      <Card className="bento-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin size={20} />
            Mis Metas de Viaje ({goals.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Cargando...</div>
          ) : goals.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Airplane size={48} className="mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No tienes metas de viaje</p>
              <p className="text-sm">Crea una meta para empezar a ahorrar para tu próximo destino</p>
              {canEdit && (
                <Button onClick={() => setDialogOpen(true)} className="mt-4 gap-2">
                  <Plus size={18} />
                  Crear Primera Meta
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AnimatePresence>
                {goals.map((goal, index) => {
                  const statusConfig = STATUS_CONFIG[goal.status] || STATUS_CONFIG.active;
                  const StatusIcon = statusConfig.icon;
                  const progress = goal.target_amount > 0 ? ((goal.saved_amount || 0) / goal.target_amount) * 100 : 0;
                  const remaining = goal.target_amount - (goal.saved_amount || 0);
                  const daysUntil = differenceInDays(new Date(goal.target_date), new Date());
                  const monthlySavingsNeeded = daysUntil > 0 ? remaining / (daysUntil / 30) : remaining;

                  return (
                    <motion.div
                      key={goal.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2, delay: index * 0.05 }}
                    >
                      <Card className={`bento-card h-full transition-all hover:shadow-lg ${
                        goal.status === "completed" ? "border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20" : ""
                      }`}>
                        <CardContent className="p-5">
                          {/* Header */}
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg ${
                                goal.status === "completed" 
                                  ? "bg-emerald-100 dark:bg-emerald-900/30" 
                                  : "bg-violet-100 dark:bg-violet-900/30"
                              }`}>
                                <Airplane 
                                  size={24} 
                                  className={goal.status === "completed" ? "text-emerald-600" : "text-violet-600"} 
                                  weight="duotone" 
                                />
                              </div>
                              <div>
                                <h3 className="font-semibold text-lg">{goal.destination}</h3>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <CalendarBlank size={14} />
                                  <span>{format(new Date(goal.target_date), "d MMM yyyy", { locale: es })}</span>
                                  <Badge className={statusConfig.color}>
                                    <StatusIcon size={12} className="mr-1" />
                                    {statusConfig.label}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Progress */}
                          <div className="mb-4">
                            <div className="flex justify-between text-sm mb-2">
                              <span className="text-muted-foreground">Progreso</span>
                              <span className="font-semibold">{progress.toFixed(0)}%</span>
                            </div>
                            <Progress 
                              value={Math.min(progress, 100)} 
                              className={`h-3 ${progress >= 100 ? '[&>div]:bg-emerald-500' : ''}`}
                            />
                          </div>

                          {/* Amount Details */}
                          <div className="grid grid-cols-2 gap-3 mb-4">
                            <div className="p-3 rounded-lg bg-muted/50">
                              <p className="text-xs text-muted-foreground">Ahorrado</p>
                              <p className="text-lg font-bold text-emerald-600">{formatCurrency(goal.saved_amount || 0)}</p>
                            </div>
                            <div className="p-3 rounded-lg bg-muted/50">
                              <p className="text-xs text-muted-foreground">Meta</p>
                              <p className="text-lg font-bold text-violet-600">{formatCurrency(goal.target_amount)}</p>
                            </div>
                          </div>

                          {/* Info */}
                          {goal.status === "active" && remaining > 0 && (
                            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 mb-4">
                              <p className="text-sm text-amber-800 dark:text-amber-200">
                                {daysUntil > 0 ? (
                                  <>
                                    <strong>{daysUntil} días</strong> restantes. 
                                    Necesitas ahorrar <strong>{formatCurrency(monthlySavingsNeeded)}/mes</strong> para alcanzar tu meta.
                                  </>
                                ) : (
                                  <>La fecha límite ha pasado. Te faltan <strong>{formatCurrency(remaining)}</strong>.</>
                                )}
                              </p>
                            </div>
                          )}

                          {goal.notes && (
                            <p className="text-sm text-muted-foreground mb-4 italic">"{goal.notes}"</p>
                          )}

                          {/* Actions */}
                          {canEdit && goal.status === "active" && (
                            <div className="flex gap-2 pt-2 border-t">
                              <Button 
                                variant="default" 
                                size="sm"
                                className="flex-1 gap-1"
                                onClick={() => {
                                  setSelectedGoal(goal);
                                  setSavingsDialogOpen(true);
                                }}
                              >
                                <PiggyBank size={16} />
                                Agregar Ahorro
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleEdit(goal)}>
                                <Pencil size={16} />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => handleDelete(goal.id)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash size={16} />
                              </Button>
                            </div>
                          )}

                          {goal.status === "completed" && (
                            <div className="flex items-center justify-center gap-2 pt-3 border-t text-emerald-600">
                              <CheckCircle size={20} weight="fill" />
                              <span className="font-medium">¡Meta completada!</span>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Goal Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Airplane size={24} className="text-violet-500" />
              {editingGoal ? "Editar Meta de Viaje" : "Nueva Meta de Viaje"}
            </DialogTitle>
            <DialogDescription>
              Define tu destino, monto objetivo y fecha límite
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Destino</Label>
              <Input
                placeholder="Ej: Miami, USA"
                value={formData.destination}
                onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                required
                data-testid="destination-input"
              />
              
              {/* Quick Select Destinations */}
              <div className="flex flex-wrap gap-2 mt-2">
                {PRESET_DESTINATIONS.slice(0, 4).map((dest) => (
                  <Button
                    key={dest.name}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => setFormData({ 
                      ...formData, 
                      destination: dest.name,
                      target_amount: dest.estimatedCost.toString()
                    })}
                  >
                    {dest.name}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Monto Objetivo</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="pl-8"
                    value={formData.target_amount}
                    onChange={(e) => setFormData({ ...formData, target_amount: e.target.value })}
                    required
                    data-testid="target-amount-input"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Fecha Límite</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start gap-2" data-testid="target-date-picker">
                      <CalendarBlank size={16} />
                      {format(formData.target_date, "d MMM yyyy", { locale: es })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.target_date}
                      onSelect={(date) => date && setFormData({ ...formData, target_date: date })}
                      disabled={(date) => date < new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Monthly savings calculation preview */}
            {formData.target_amount && (
              <div className="p-3 rounded-lg bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800">
                <p className="text-sm text-violet-800 dark:text-violet-200">
                  Para alcanzar esta meta, necesitarás ahorrar aproximadamente{" "}
                  <strong>
                    {formatCurrency(
                      parseFloat(formData.target_amount) / 
                      Math.max(1, differenceInDays(formData.target_date, new Date()) / 30)
                    )}
                  </strong>{" "}
                  por mes.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Notas (opcional)</Label>
              <Input
                placeholder="Ej: Viaje familiar de Navidad"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                data-testid="notes-input"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="gap-2" data-testid="save-goal-btn">
                <Airplane size={16} />
                {editingGoal ? "Actualizar" : "Crear Meta"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Savings Dialog */}
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
                  Progreso actual: {formatCurrency(selectedGoal.saved_amount || 0)} de {formatCurrency(selectedGoal.target_amount)}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Monto a Agregar</Label>
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
            </div>

            {/* Quick amounts */}
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
    </div>
  );
}
