import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Progress } from "../components/ui/progress";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog";
import { toast } from "sonner";
import { 
  ChartLine, 
  ArrowUp, 
  ArrowDown,
  Minus,
  Target,
  Lightbulb,
  CheckCircle,
  Scales,
  PiggyBank,
  TrendUp,
  Pencil,
  Airplane
} from "@phosphor-icons/react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from "recharts";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CATEGORY_NAMES = {
  alimentacion: "Alimentación",
  salud: "Salud",
  educacion: "Educación",
  vivienda: "Vivienda",
  vestimenta: "Vestimenta",
  transporte: "Transporte",
  viajes_internacionales: "Viajes Internacionales",
  otros: "Otros"
};

const CATEGORY_COLORS = {
  alimentacion: "#2f9e44",
  salud: "#e64980",
  educacion: "#7950f2",
  vivienda: "#1c7ed6",
  vestimenta: "#f59f00",
  transporte: "#e67700",
  viajes_internacionales: "#fd7e14",
  otros: "#868e96"
};

export default function Budget() {
  const { getAuthHeaders } = useAuth();
  const [budget, setBudget] = useState(null);
  const [comparison, setComparison] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [monthsAnalyzed, setMonthsAnalyzed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [budgetRes, comparisonRes, suggestionsRes] = await Promise.all([
        axios.get(`${API}/budget`, { headers: getAuthHeaders() }),
        axios.get(`${API}/budget/vs-actual`, { headers: getAuthHeaders() }),
        axios.get(`${API}/budget/suggestions`, { headers: getAuthHeaders() })
      ]);
      setBudget(budgetRes.data);
      setComparison(comparisonRes.data.comparison);
      setSuggestions(suggestionsRes.data.suggestions || []);
      setMonthsAnalyzed(suggestionsRes.data.months_analyzed || 0);
    } catch (error) {
      toast.error("Error al cargar presupuesto");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-EC', {
      style: 'currency',
      currency: 'USD'
    }).format(value || 0);
  };

  const getTrendIcon = (percentage) => {
    if (percentage > 100) return <ArrowUp size={16} className="text-red-500" />;
    if (percentage < 80) return <ArrowDown size={16} className="text-emerald-500" />;
    return <Minus size={16} className="text-amber-500" />;
  };

  const getProgressColor = (percentage) => {
    if (percentage > 100) return "bg-red-500";
    if (percentage > 80) return "bg-amber-500";
    return "bg-emerald-500";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-muted-foreground">Cargando presupuesto...</div>
      </div>
    );
  }

  const chartData = comparison.map(item => ({
    name: item.category_name,
    Presupuesto: item.planned,
    Real: item.actual,
    color: CATEGORY_COLORS[item.category] || "#868e96"
  }));

  return (
    <div className="space-y-6" data-testid="budget-page">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Presupuesto</h1>
        <p className="text-muted-foreground">Compara tu presupuesto planificado vs gastos reales</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="bento-card">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Ingresos Esperados</p>
                  <p className="stat-number text-emerald-600">
                    {formatCurrency(budget?.total_income)}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30">
                  <ArrowUp size={24} weight="duotone" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Card className="bento-card">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Gastos Presupuestados</p>
                  <p className="stat-number text-red-500">
                    {formatCurrency(budget?.total_expenses)}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-red-100 text-red-500 dark:bg-red-900/30">
                  <ArrowDown size={24} weight="duotone" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <Card className="bento-card">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Ahorro Proyectado</p>
                  <p className="stat-number text-primary">
                    {formatCurrency((budget?.total_income || 0) - (budget?.total_expenses || 0))}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-primary/10 text-primary">
                  <Target size={24} weight="duotone" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        <Card className="bento-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ChartLine size={20} />
              Presupuesto vs Real
            </CardTitle>
            <CardDescription>Comparación por categoría</CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis 
                      type="category" 
                      dataKey="name" 
                      width={100}
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        background: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                      formatter={(value) => formatCurrency(value)}
                    />
                    <Bar dataKey="Presupuesto" fill="hsl(var(--muted))" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="Real" radius={[0, 4, 4, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <ChartLine size={48} className="mx-auto mb-4 opacity-50" />
                <p>No hay datos de presupuesto</p>
                <p className="text-sm">Sube tu archivo Excel de planificación en "Cargar Datos"</p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Detailed Comparison */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4 }}
      >
        <Card className="bento-card">
          <CardHeader>
            <CardTitle className="text-lg">Detalle por Categoría</CardTitle>
            <CardDescription>Progreso de gastos vs presupuesto</CardDescription>
          </CardHeader>
          <CardContent>
            {comparison.length > 0 ? (
              <div className="space-y-6">
                {comparison.map((item, index) => (
                  <motion.div
                    key={item.category}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className="space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: CATEGORY_COLORS[item.category] }}
                        />
                        <span className="font-medium">{item.category_name}</span>
                        {getTrendIcon(item.percentage)}
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-muted-foreground">
                          {formatCurrency(item.actual)} / {formatCurrency(item.planned)}
                        </span>
                        <Badge variant={item.percentage > 100 ? "destructive" : "secondary"}>
                          {item.percentage.toFixed(0)}%
                        </Badge>
                      </div>
                    </div>
                    <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(item.percentage, 100)}%` }}
                        transition={{ duration: 0.5, delay: index * 0.05 }}
                        className={`absolute h-full rounded-full ${getProgressColor(item.percentage)}`}
                      />
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No hay comparaciones disponibles
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Budget Suggestions */}
      {suggestions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
        >
          <Card className="bento-card border-amber-200 dark:border-amber-800">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lightbulb size={20} className="text-amber-500" />
                  <CardTitle className="text-lg">Sugerencias de Ajuste de Presupuesto</CardTitle>
                </div>
                <Badge variant="secondary">
                  Basado en {monthsAnalyzed} meses de datos
                </Badge>
              </div>
              <CardDescription>
                Recomendaciones basadas en tu historial de gastos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {suggestions.map((suggestion, index) => (
                  <motion.div
                    key={suggestion.category}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                    className={`p-4 rounded-xl border ${
                      suggestion.type === "increase" 
                        ? "bg-red-50 border-red-200 dark:bg-red-900/10 dark:border-red-800"
                        : suggestion.type === "decrease"
                        ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-800"
                        : "bg-amber-50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-800"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${
                          suggestion.type === "increase" 
                            ? "bg-red-100 text-red-600 dark:bg-red-900/30"
                            : suggestion.type === "decrease"
                            ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30"
                            : "bg-amber-100 text-amber-600 dark:bg-amber-900/30"
                        }`}>
                          {suggestion.type === "increase" ? (
                            <ArrowUp size={20} />
                          ) : suggestion.type === "decrease" ? (
                            <ArrowDown size={20} />
                          ) : (
                            <Target size={20} />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{suggestion.category_name}</p>
                            {suggestion.is_deductible && (
                              <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
                                <Scales size={12} className="mr-1" />
                                Deducible SRI
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {suggestion.reason}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Sugerido</p>
                        <p className="font-mono font-semibold text-lg">
                          {formatCurrency(suggestion.suggested_budget)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Actual: {formatCurrency(suggestion.current_budget)}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
