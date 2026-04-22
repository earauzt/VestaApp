import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { toast } from "sonner";
import { 
  Pencil, 
  Plus, 
  Trash, 
  FloppyDisk, 
  ArrowCounterClockwise,
  Wallet,
  TrendUp,
  PiggyBank,
  ChartLine,
  Airplane
} from "@phosphor-icons/react";

import { components, typography } from "../styles/design-system";
const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function PresupuestoEditable() {
  const { getAuthHeaders } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [budgetConfig, setBudgetConfig] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newCategory, setNewCategory] = useState({ key: "", name: "", monthly_budget: 0 });
  
  // Income projection state
  const [incomeProjection, setIncomeProjection] = useState({
    personal: { monthly: 7250, annual: 87000 },
    apx: { monthly: 2500, annual: 30000 },
    usa: { monthly: 2750, annual: 33000 }
  });
  
  // Goals state
  const [savingsGoal, setSavingsGoal] = useState({ monthly: 1250, percentage: 10 });
  const [investmentGoal, setInvestmentGoal] = useState({ monthly: 1875, percentage: 15 });

  const [travelFund, setTravelFund] = useState(null);
  
  // Tab state for controlled tabs
  const [activeTab, setActiveTab] = useState("gastos");

  useEffect(() => {
    fetchBudgetConfig();
  }, []);

  const fetchBudgetConfig = async () => {
    try {
      const [budgetRes, travelRes] = await Promise.all([
        axios.get(`${API}/budget/config`, { headers: getAuthHeaders() }),
        axios.get(`${API}/travel-fund`, { headers: getAuthHeaders() }).catch(() => ({ data: null }))
      ]);
      
      setBudgetConfig(budgetRes.data);
      setTravelFund(travelRes.data);
      
      if (budgetRes.data.income_projection) {
        setIncomeProjection(budgetRes.data.income_projection);
      }
      if (budgetRes.data.savings_goal) {
        setSavingsGoal(budgetRes.data.savings_goal);
      }
      if (budgetRes.data.investment_goal) {
        setInvestmentGoal(budgetRes.data.investment_goal);
      }
    } catch (error) {
      toast.error("Error al cargar configuración");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBudget = async () => {
    setSaving(true);
    try {
      await axios.post(`${API}/budget/personal`, {
        year: new Date().getFullYear(),
        categories: budgetConfig.categories,
        income_projection: incomeProjection,
        savings_goal: savingsGoal,
        investment_goal: investmentGoal
      }, { headers: getAuthHeaders() });
      toast.success("Presupuesto guardado");
    } catch (error) {
      toast.error("Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleCategoryChange = (key, field, value) => {
    setBudgetConfig(prev => ({
      ...prev,
      categories: {
        ...prev.categories,
        [key]: {
          ...prev.categories[key],
          [field]: field.includes("budget") ? parseFloat(value) || 0 : value
        }
      }
    }));
  };

  const handleSubcategoryChange = (catKey, subName, value) => {
    setBudgetConfig(prev => ({
      ...prev,
      categories: {
        ...prev.categories,
        [catKey]: {
          ...prev.categories[catKey],
          subcategories: {
            ...prev.categories[catKey].subcategories,
            [subName]: parseFloat(value) || 0
          }
        }
      }
    }));
  };

  const handleAddCategory = () => {
    if (!newCategory.key || !newCategory.name) {
      toast.error("Completa nombre y clave");
      return;
    }
    
    setBudgetConfig(prev => ({
      ...prev,
      categories: {
        ...prev.categories,
        [newCategory.key]: {
          name: newCategory.name,
          monthly_budget: parseFloat(newCategory.monthly_budget) || 0,
          annual_budget: (parseFloat(newCategory.monthly_budget) || 0) * 12,
          subcategories: {},
          type: "variable",
          is_recurring: false
        }
      }
    }));
    
    setShowAddDialog(false);
    setNewCategory({ key: "", name: "", monthly_budget: 0 });
    toast.success("Categoría añadida");
  };

  const handleDeleteCategory = (key) => {
    const { [key]: removed, ...rest } = budgetConfig.categories;
    setBudgetConfig(prev => ({
      ...prev,
      categories: rest
    }));
    toast.success("Categoría eliminada");
  };

  const handleAddSubcategory = (catKey) => {
    const name = prompt("Nombre de la subcategoría:");
    if (name) {
      handleSubcategoryChange(catKey, name, 0);
    }
  };

  const calculateTotals = () => {
    if (!budgetConfig?.categories) return { totalExpenses: 0, totalIncome: 0 };
    
    const totalExpenses = Object.values(budgetConfig.categories)
      .reduce((sum, cat) => sum + (cat.monthly_budget || 0), 0);
    
    const totalIncome = Object.values(incomeProjection)
      .reduce((sum, src) => sum + (src.monthly || 0), 0);
    
    return { totalExpenses, totalIncome };
  };

  const { totalExpenses, totalIncome } = calculateTotals();
  const travelMonthly = travelFund?.monthly_suggested_saving || 0;
  const balance = totalIncome - totalExpenses - savingsGoal.monthly - investmentGoal.monthly - travelMonthly;

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(value || 0);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Cargando...</div>;
  }

  return (
    <div className="space-y-6" data-testid="presupuesto-editable">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Mi Presupuesto</h1>
          <p className="text-muted-foreground">Edita tus categorías, ingresos y metas</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchBudgetConfig} className="gap-2">
            <ArrowCounterClockwise size={18} />
            Resetear
          </Button>
          <Button onClick={handleSaveBudget} disabled={saving} className="gap-2">
            <FloppyDisk size={18} />
            {saving ? "Guardando..." : "Guardar Todo"}
          </Button>
        </div>
      </div>

      {/* Resumen Mensual - Números protagonistas */}
      <Card className="bento-card" data-testid="resumen-mensual-card">
        <CardContent className="pt-6 pb-5 space-y-1">
          <p className="text-4xl font-bold tracking-tight text-slate-800" data-testid="resumen-total-gastos">
            {formatCurrency(totalExpenses)}
          </p>
          <p className="text-xs text-slate-400 mb-3">Gastos proyectados del mes</p>
          <p className="text-lg font-medium text-emerald-600" data-testid="resumen-ingresos">
            +{formatCurrency(totalIncome)} <span className="text-xs text-slate-400 font-normal ml-1">ingresos</span>
          </p>
          <p className="text-lg font-medium text-slate-700" data-testid="resumen-gastos">
            {formatCurrency(totalExpenses)} <span className="text-xs text-slate-400 font-normal ml-1">gastos</span>
          </p>
          <div className="flex items-center justify-between pt-3 mt-2 border-t border-slate-100">
            <div>
              <p className="text-xs text-slate-400">Ahorro mensual ({savingsGoal.percentage}%)</p>
              <p className="text-sm font-semibold text-[#0D9E82]">{formatCurrency(savingsGoal.monthly)}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-slate-500 hover:text-[#0D9E82]"
              onClick={() => setActiveTab("metas")}
            >
              <Pencil size={13} className="mr-1" /> Editar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Hidden sections (replaced by the simplified summary above) */}
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="gastos">Categorías de Gastos</TabsTrigger>
          <TabsTrigger value="metas">Ahorro e Inversión</TabsTrigger>
        </TabsList>

        {/* Gastos Tab */}
        <TabsContent value="gastos" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowAddDialog(true)} variant="outline" className="gap-2">
              <Plus size={18} />
              Nueva Categoría
            </Button>
          </div>

          <div className="grid gap-4">
            {budgetConfig?.categories && Object.entries(budgetConfig.categories).map(([key, category]) => (
              <motion.div
                key={key}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <Card className="bento-card">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">{category.name}</CardTitle>
                        {category.is_recurring && <Badge variant="secondary">Recurrente</Badge>}
                        {category.type === "fixed" && <Badge variant="outline">Fijo</Badge>}
                      </div>
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => setEditingCategory(editingCategory === key ? null : key)}
                        >
                          <Pencil size={16} />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleDeleteCategory(key)}
                          className="text-red-500"
                        >
                          <Trash size={16} />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 mb-4">
                      <div className="flex-1">
                        <Label className="text-xs text-muted-foreground">Presupuesto Mensual Total</Label>
                        <Input
                          type="number"
                          value={category.monthly_budget || 0}
                          onChange={(e) => handleCategoryChange(key, "monthly_budget", e.target.value)}
                          className="text-lg font-mono"
                        />
                      </div>
                      <div className="text-right">
                        <Label className="text-xs text-muted-foreground">Anual</Label>
                        <p className="text-lg font-mono text-muted-foreground">
                          {formatCurrency((category.monthly_budget || 0) * 12)}
                        </p>
                      </div>
                    </div>

                    {/* Subcategories - Always visible */}
                    {category.subcategories && Object.keys(category.subcategories).length > 0 && (
                      <div className="border-t pt-4 mt-2 space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="font-medium text-sm">Detalle por Subcategoría</Label>
                          <Button variant="ghost" size="sm" onClick={() => handleAddSubcategory(key)}>
                            <Plus size={14} className="mr-1" /> Añadir
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                          {Object.entries(category.subcategories).map(([subName, subValue]) => (
                            <div key={subName} className="p-3 rounded-lg bg-muted/50 border space-y-1">
                              <Label className="text-xs text-muted-foreground truncate block">{subName}</Label>
                              <div className="flex items-center gap-1">
                                <span className="text-muted-foreground text-sm">$</span>
                                <Input
                                  type="number"
                                  value={subValue || 0}
                                  onChange={(e) => handleSubcategoryChange(key, subName, e.target.value)}
                                  className="text-sm font-mono h-8"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                        {/* Subcategory total vs category budget */}
                        {(() => {
                          const subTotal = Object.values(category.subcategories).reduce((sum, v) => sum + (v || 0), 0);
                          const diff = (category.monthly_budget || 0) - subTotal;
                          return (
                            <div className="flex justify-between items-center pt-2 text-sm">
                              <span className="text-muted-foreground">
                                Suma subcategorías: <span className="font-mono">{formatCurrency(subTotal)}</span>
                              </span>
                              {diff !== 0 && (
                                <Badge variant={diff > 0 ? "secondary" : "destructive"}>
                                  {diff > 0 ? `+${formatCurrency(diff)} sin asignar` : `${formatCurrency(diff)} excedido`}
                                </Badge>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* Add subcategory button if no subcategories */}
                    {(!category.subcategories || Object.keys(category.subcategories).length === 0) && (
                      <div className="border-t pt-4 mt-2">
                        <Button variant="outline" size="sm" onClick={() => handleAddSubcategory(key)} className="w-full">
                          <Plus size={14} className="mr-1" /> Añadir Subcategorías
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </TabsContent>

        {/* Ingresos Tab — eliminado. La proyección de ingresos se maneja en /mi-dinero?tab=ingresos (Ingresos.js). State incomeProjection preservado por si se consume desde otro lado. */}

        {/* Metas Tab */}
        <TabsContent value="metas" className="space-y-4 mt-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="bento-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PiggyBank size={24} className="text-[#0D9E82]" />
                  Meta de Ahorro
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Monto Mensual</Label>
                  <Input
                    type="number"
                    value={savingsGoal.monthly || 0}
                    onChange={(e) => setSavingsGoal(prev => ({
                      ...prev,
                      monthly: parseFloat(e.target.value) || 0,
                      percentage: totalIncome > 0 ? Math.round((parseFloat(e.target.value) / totalIncome) * 100) : 0
                    }))}
                    className="font-mono text-lg"
                  />
                </div>
                <div>
                  <Label>Porcentaje del Ingreso</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={savingsGoal.percentage || 0}
                      onChange={(e) => setSavingsGoal(prev => ({
                        ...prev,
                        percentage: parseFloat(e.target.value) || 0,
                        monthly: totalIncome * (parseFloat(e.target.value) / 100)
                      }))}
                      className="w-24"
                    />
                    <span className="text-muted-foreground">%</span>
                  </div>
                </div>
                <div className="pt-2 border-t text-muted-foreground">
                  <p>Anual: {formatCurrency((savingsGoal.monthly || 0) * 12)}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bento-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendUp size={24} className="text-emerald-600" />
                  Meta de Inversión
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Monto Mensual</Label>
                  <Input
                    type="number"
                    value={investmentGoal.monthly || 0}
                    onChange={(e) => setInvestmentGoal(prev => ({
                      ...prev,
                      monthly: parseFloat(e.target.value) || 0,
                      percentage: totalIncome > 0 ? Math.round((parseFloat(e.target.value) / totalIncome) * 100) : 0
                    }))}
                    className="font-mono text-lg"
                  />
                </div>
                <div>
                  <Label>Porcentaje del Ingreso</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={investmentGoal.percentage || 0}
                      onChange={(e) => setInvestmentGoal(prev => ({
                        ...prev,
                        percentage: parseFloat(e.target.value) || 0,
                        monthly: totalIncome * (parseFloat(e.target.value) / 100)
                      }))}
                      className="w-24"
                    />
                    <span className="text-muted-foreground">%</span>
                  </div>
                </div>
                <div className="pt-2 border-t text-muted-foreground">
                  <p>Anual: {formatCurrency((investmentGoal.monthly || 0) * 12)}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Category Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva Categoría de Gasto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Clave (sin espacios)</Label>
              <Input
                value={newCategory.key}
                onChange={(e) => setNewCategory(prev => ({ ...prev, key: e.target.value.toLowerCase().replace(/\s/g, "_") }))}
                placeholder="ej: transporte_publico"
              />
            </div>
            <div>
              <Label>Nombre</Label>
              <Input
                value={newCategory.name}
                onChange={(e) => setNewCategory(prev => ({ ...prev, name: e.target.value }))}
                placeholder="ej: Transporte Público"
              />
            </div>
            <div>
              <Label>Presupuesto Mensual</Label>
              <Input
                type="number"
                value={newCategory.monthly_budget}
                onChange={(e) => setNewCategory(prev => ({ ...prev, monthly_budget: e.target.value }))}
                placeholder="0"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancelar</Button>
            <Button onClick={handleAddCategory}>Añadir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
