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

      {/* Resumen Financiero - Visualización tipo Resta */}
      <Card className="bento-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Resumen Mensual</CardTitle>
          <CardDescription>Proyección de flujo de caja</CardDescription>
        </CardHeader>
        <CardContent className="space-y-0">
          {/* Ingresos - Primera línea */}
          <div className="flex items-center justify-between py-3 border-b">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <Wallet size={18} className="text-emerald-600" />
              </div>
              <div>
                <p className="font-medium">Ingresos Proyectados</p>
                <p className="text-xs text-muted-foreground">Personal + APX + USA</p>
              </div>
            </div>
            <p className="text-xl font-bold text-emerald-600 font-mono">{formatCurrency(totalIncome)}</p>
          </div>

          {/* Gastos - Con signo menos */}
          <div className="flex items-center justify-between py-3 border-b bg-muted/30">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <span className="text-red-600 font-bold text-lg">−</span>
              </div>
              <div>
                <p className="font-medium">Gastos Fijos</p>
                <p className="text-xs text-muted-foreground">Categorías del presupuesto</p>
              </div>
            </div>
            <p className="text-xl font-bold text-red-500 font-mono">{formatCurrency(totalExpenses)}</p>
          </div>

          {/* Ahorro - Con signo menos */}
          <div className="flex items-center justify-between py-3 border-b">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
                <span className="text-teal-600 font-bold text-lg">−</span>
              </div>
              <div className="flex items-center gap-2">
                <div>
                  <p className="font-medium">Ahorro</p>
                  <p className="text-xs text-muted-foreground">Imprevistos • {savingsGoal.percentage}%</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-xl font-bold text-teal-600 font-mono">{formatCurrency(savingsGoal.monthly)}</p>
              <Button 
                variant="ghost" 
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-teal-600"
                onClick={() => setActiveTab("metas")}
              >
                <Pencil size={14} />
              </Button>
            </div>
          </div>

          {/* Inversión - Con signo menos */}
          <div className="flex items-center justify-between py-3 border-b bg-muted/30">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
                <span className="text-[#0F766E] font-bold text-lg">−</span>
              </div>
              <div>
                <p className="font-medium">Inversión</p>
                <p className="text-xs text-muted-foreground">Crecimiento • {investmentGoal.percentage}%</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-xl font-bold text-[#0F766E] font-mono">{formatCurrency(investmentGoal.monthly)}</p>
              <Button 
                variant="ghost" 
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-[#0F766E]"
                onClick={() => setActiveTab("metas")}
              >
                <Pencil size={14} />
              </Button>
            </div>
          </div>

          {/* Meta Viajes - Con signo menos */}
          <div className="flex items-center justify-between py-3 border-b">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <span className="text-[#0F766E] font-bold text-lg">−</span>
              </div>
              <div>
                <p className="font-medium">Meta Viajes</p>
                <p className="text-xs text-muted-foreground">
                  {travelFund ? `${(travelFund.savings_progress || 0).toFixed(0)}% ahorrado` : "Sin configurar"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-xl font-bold text-[#0F766E] font-mono">
                {formatCurrency(travelFund?.monthly_suggested_saving || 0)}
              </p>
              <Link to="/viajes">
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-[#0F766E]"
                >
                  <Airplane size={14} />
                </Button>
              </Link>
            </div>
          </div>

          {/* Línea separadora visual */}
          <div className="border-t-2 border-dashed border-muted-foreground/30 my-1" />

          {/* Resultado - Flujo Libre o Faltante */}
          <div className={`flex items-center justify-between py-4 rounded-lg mt-2 px-3 ${
            balance >= 0 
              ? "bg-emerald-50 dark:bg-emerald-950/30" 
              : "bg-red-50 dark:bg-red-950/30"
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                balance >= 0 
                  ? "bg-emerald-200 dark:bg-emerald-900/50" 
                  : "bg-red-200 dark:bg-red-900/50"
              }`}>
                <span className={`font-bold text-lg ${balance >= 0 ? "text-emerald-700" : "text-red-700"}`}>=</span>
              </div>
              <div>
                <p className={`font-semibold ${balance >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
                  {balance >= 0 ? "Flujo Libre" : "Faltante"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {balance >= 0 ? "Disponible después de metas" : "Necesitas ajustar tu presupuesto"}
                </p>
              </div>
            </div>
            <p className={`text-2xl font-bold font-mono ${balance >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {formatCurrency(Math.abs(balance))}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="gastos">Categorías de Gastos</TabsTrigger>
          <TabsTrigger value="ingresos">Proyección Ingresos</TabsTrigger>
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

        {/* Ingresos Tab */}
        <TabsContent value="ingresos" className="space-y-4 mt-4">
          <Card className="bento-card">
            <CardHeader>
              <CardTitle>Proyección de Ingresos</CardTitle>
              <CardDescription>Ingreso mensual estimado por fuente (variable)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(incomeProjection).map(([key, source]) => (
                <div key={key} className="grid grid-cols-3 gap-4 items-end">
                  <div>
                    <Label className="capitalize">{key}</Label>
                    <Input
                      type="number"
                      value={source.monthly || 0}
                      onChange={(e) => setIncomeProjection(prev => ({
                        ...prev,
                        [key]: {
                          ...prev[key],
                          monthly: parseFloat(e.target.value) || 0,
                          annual: (parseFloat(e.target.value) || 0) * 12
                        }
                      }))}
                      className="font-mono"
                    />
                  </div>
                  <div className="text-center">
                    <Label className="text-muted-foreground text-xs">Anual</Label>
                    <p className="font-mono text-lg">{formatCurrency((source.monthly || 0) * 12)}</p>
                  </div>
                  <div>
                    <Badge variant="secondary">Estimado variable</Badge>
                  </div>
                </div>
              ))}
              
              <div className="pt-4 border-t">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Total Mensual</span>
                  <span className="text-2xl font-bold text-emerald-600">{formatCurrency(totalIncome)}</span>
                </div>
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Total Anual</span>
                  <span className="font-mono">{formatCurrency(totalIncome * 12)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Metas Tab */}
        <TabsContent value="metas" className="space-y-4 mt-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="bento-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PiggyBank size={24} className="text-[#0F766E]" />
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
