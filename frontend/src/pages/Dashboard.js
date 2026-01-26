import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Progress } from "../components/ui/progress";
import { Badge } from "../components/ui/badge";
import { toast } from "sonner";
import { 
  ArrowUp, 
  ArrowDown, 
  Wallet, 
  CalendarBlank,
  Receipt,
  Target,
  TrendUp,
  PiggyBank
} from "@phosphor-icons/react";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend
} from "recharts";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Personal Budget Categories (from Excel)
const BUDGET_CATEGORY_COLORS = {
  servicios_basicos: "#3b82f6",  // blue
  empleados: "#8b5cf6",          // purple
  colegio_actividades: "#06b6d4", // cyan
  seguros: "#ec4899",            // pink
  comida: "#22c55e",             // green
  restaurantes: "#f97316",       // orange
  carros: "#ef4444",             // red
  usa: "#6366f1",                // indigo
  viajes: "#14b8a6",             // teal
  gastos_libres: "#f59e0b"       // amber
};

const BUDGET_CATEGORY_NAMES = {
  servicios_basicos: "Servicios Básicos",
  empleados: "Empleados",
  colegio_actividades: "Colegio y Actividades",
  seguros: "Seguros",
  comida: "Comida",
  restaurantes: "Restaurantes",
  carros: "Carros",
  usa: "USA",
  viajes: "Viajes",
  gastos_libres: "Gastos Libres"
};

export default function Dashboard() {
  const { getAuthHeaders, user } = useAuth();
  const [stats, setStats] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [budgetData, setBudgetData] = useState(null);
  const [period, setPeriod] = useState("month");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [period]);

  const fetchData = async () => {
    try {
      const [statsRes, chartRes, budgetRes] = await Promise.all([
        axios.get(`${API}/dashboard/stats`, { headers: getAuthHeaders() }),
        axios.get(`${API}/dashboard/chart-data?period=${period}`, { headers: getAuthHeaders() }),
        axios.get(`${API}/budget/personal`, { headers: getAuthHeaders() }).catch(() => ({ data: null }))
      ]);
      setStats(statsRes.data);
      setChartData(chartRes.data.data);
      setBudgetData(budgetRes.data);
    } catch (error) {
      toast.error("Error al cargar datos del dashboard");
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

  // Use budget categories for pie chart
  const pieData = budgetData?.by_category 
    ? Object.entries(budgetData.by_category).map(([key, value]) => ({
        name: BUDGET_CATEGORY_NAMES[key] || key,
        value,
        color: BUDGET_CATEGORY_COLORS[key] || "#868e96"
      })).filter(d => d.value > 0)
    : stats?.by_category 
      ? Object.entries(stats.by_category).map(([key, value]) => ({
          name: BUDGET_CATEGORY_NAMES[key] || key,
          value,
          color: BUDGET_CATEGORY_COLORS[key] || "#868e96"
        })).filter(d => d.value > 0)
      : [];

  const statCards = [
    { 
      title: "Balance Mensual", 
      value: stats?.balance, 
      icon: Wallet,
      trend: stats?.balance >= 0 ? "up" : "down",
      color: stats?.balance >= 0 ? "text-emerald-600" : "text-red-500"
    },
    { 
      title: "Ingresos", 
      value: stats?.total_income, 
      icon: ArrowUp,
      color: "text-emerald-600"
    },
    { 
      title: "Gastos del Mes", 
      value: stats?.monthly_total, 
      icon: ArrowDown,
      color: "text-red-500"
    },
    { 
      title: "Promedio Diario", 
      value: stats?.daily_average, 
      icon: CalendarBlank,
      color: "text-blue-500"
    }
  ];

  // Budget goals progress
  const goalProgress = budgetData?.goal_progress;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-muted-foreground">Cargando dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 lg:space-y-8" data-testid="dashboard-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Resumen de tus finanzas familiares</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[140px] sm:w-[180px]" data-testid="period-select">
            <SelectValue placeholder="Seleccionar período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">Esta semana</SelectItem>
            <SelectItem value="month">Este mes</SelectItem>
            <SelectItem value="year">Este año</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats Grid - Responsive */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
        {statCards.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
          >
            <Card className="bento-card hover:-translate-y-1 transition-all duration-300">
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm text-muted-foreground mb-1 truncate">{stat.title}</p>
                    <p className={`text-lg sm:text-2xl font-bold ${stat.color}`}>
                      {formatCurrency(stat.value)}
                    </p>
                  </div>
                  <div className={`p-2 sm:p-3 rounded-xl bg-muted ${stat.color} self-start`}>
                    <stat.icon size={20} weight="duotone" className="sm:w-6 sm:h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Budget Goals (if available) */}
      {goalProgress && user?.role !== "accountant" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Card className="bento-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <Target size={20} className="text-primary" />
                Metas Financieras
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Fixed Expenses Goal */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Gastos Fijos (meta: 55-65%)</span>
                  <span className={`font-medium ${
                    goalProgress.gastos_fijos?.status === "on_track" ? "text-emerald-600" : "text-amber-600"
                  }`}>
                    {((goalProgress.gastos_fijos?.actual_percent || 0) * 100).toFixed(0)}%
                  </span>
                </div>
                <Progress 
                  value={(goalProgress.gastos_fijos?.actual_percent || 0) * 100} 
                  className="h-2"
                />
              </div>
              
              {/* Guilt-free Spending */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Gastos Libres (máx. $30k/año)</span>
                  <span className="font-medium">
                    {formatCurrency(goalProgress.gastos_libres?.actual_annual || 0)}
                  </span>
                </div>
                <Progress 
                  value={((goalProgress.gastos_libres?.actual_annual || 0) / 30000) * 100} 
                  className="h-2"
                />
                <p className="text-xs text-muted-foreground">
                  Disponible: {formatCurrency(goalProgress.gastos_libres?.remaining || 30000)}
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Charts Row - Responsive */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        {/* Area Chart - 2 columns on lg */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="lg:col-span-2"
        >
          <Card className="bento-card h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-base sm:text-lg">Flujo de Dinero</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Ingresos vs Gastos</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[250px] sm:h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                      tickFormatter={(val) => val.slice(5)}
                    />
                    <YAxis 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} 
                      width={60}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        background: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px'
                      }}
                      formatter={(value) => formatCurrency(value)}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="income" 
                      name="Ingresos"
                      stroke="#22c55e" 
                      fillOpacity={1} 
                      fill="url(#colorIncome)" 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="expenses" 
                      name="Gastos"
                      stroke="#ef4444" 
                      fillOpacity={1} 
                      fill="url(#colorExpenses)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Pie Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
        >
          <Card className="bento-card h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-base sm:text-lg">Por Categoría</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Distribución de gastos</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[200px] sm:h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        background: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px'
                      }}
                      formatter={(value) => formatCurrency(value)}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* Legend - Scrollable on mobile */}
              <div className="mt-2 max-h-[100px] overflow-y-auto">
                <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                  {pieData.slice(0, 8).map((item) => (
                    <div key={item.name} className="flex items-center gap-1.5 text-xs sm:text-sm">
                      <div 
                        className="w-2 h-2 sm:w-3 sm:h-3 rounded-full shrink-0" 
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-muted-foreground truncate">{item.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Budget Categories Bar Chart */}
      {pieData.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
        >
          <Card className="bento-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base sm:text-lg">Gastos por Categoría</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Tu presupuesto personal</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[200px] sm:h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pieData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      type="number" 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                      tickFormatter={(val) => `$${(val/1000).toFixed(0)}k`}
                    />
                    <YAxis 
                      type="category" 
                      dataKey="name" 
                      width={80}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        background: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px'
                      }}
                      formatter={(value) => formatCurrency(value)}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
