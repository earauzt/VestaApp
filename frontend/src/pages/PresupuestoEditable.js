import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
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
  ChartLine
} from "@phosphor-icons/react";

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

  useEffect(() => {
    fetchBudgetConfig();
  }, []);

  const fetchBudgetConfig = async () => {
    try {
      const response = await axios.get(`${API}/budget/config`, { headers: getAuthHeaders() });
      setBudgetConfig(response.data);
      if (response.data.income_projection) {
        setIncomeProjection(response.data.income_projection);
      }
      if (response.data.savings_goal) {
        setSavingsGoal(response.data.savings_goal);
      }
      if (response.data.investment_goal) {
        setInvestmentGoal(response.data.investment_goal);
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
  const balance = totalIncome - totalExpenses - savingsGoal.monthly - investmentGoal.monthly;

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

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bento-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Wallet size={18} />
              <span className="text-sm">Ingresos</span>
            </div>
            <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalIncome)}</p>
            <p className="text-xs text-muted-foreground">/mes</p>
          </CardContent>
        </Card>
        <Card className="bento-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <ChartLine size={18} />
              <span className="text-sm">Gastos</span>
            </div>
            <p className="text-2xl font-bold text-red-500">{formatCurrency(totalExpenses)}</p>
            <p className="text-xs text-muted-foreground">/mes</p>
          </CardContent>
        </Card>
        <Card className="bento-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <PiggyBank size={18} />
              <span className="text-sm">Ahorro + Inversión</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">{formatCurrency(savingsGoal.monthly + investmentGoal.monthly)}</p>
            <p className="text-xs text-muted-foreground">{savingsGoal.percentage + investmentGoal.percentage}%</p>
          </CardContent>
        </Card>
        <Card className="bento-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendUp size={18} />
              <span className="text-sm">Flujo Libre</span>
            </div>
            <p className={`text-2xl font-bold ${balance >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {formatCurrency(balance)}
            </p>
            <p className="text-xs text-muted-foreground">/mes</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="gastos">
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
                        <Label className="text-xs text-muted-foreground">Presupuesto Mensual</Label>
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

                    {/* Subcategories */}
                    {editingCategory === key && category.subcategories && (
                      <div className="border-t pt-4 mt-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="font-medium">Subcategorías</Label>
                          <Button variant="ghost" size="sm" onClick={() => handleAddSubcategory(key)}>
                            <Plus size={14} className="mr-1" /> Añadir
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {Object.entries(category.subcategories).map(([subName, subValue]) => (
                            <div key={subName} className="space-y-1">
                              <Label className="text-xs truncate block">{subName}</Label>
                              <Input
                                type="number"
                                value={subValue || 0}
                                onChange={(e) => handleSubcategoryChange(key, subName, e.target.value)}
                                className="text-sm"
                              />
                            </div>
                          ))}
                        </div>
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
                  <PiggyBank size={24} className="text-blue-600" />
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
