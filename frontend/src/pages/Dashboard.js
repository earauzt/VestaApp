import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Progress } from "../components/ui/progress";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { toast } from "sonner";
import { 
  ArrowUp, 
  ArrowDown, 
  Wallet, 
  CalendarBlank,
  Bell,
  Warning,
  CheckCircle,
  Heart,
  Lightning,
  CreditCard,
  FirstAid,
  Sparkle
} from "@phosphor-icons/react";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from "recharts";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Categories from Excel "Flujos" tab
const FLUJO_CATEGORIES = {
  servicios_basicos: { name: "Servicios Básicos", color: "#3b82f6" },
  empleados: { name: "Empleados", color: "#8b5cf6" },
  colegio_actividades: { name: "Colegio y Actividades", color: "#06b6d4" },
  seguros: { name: "Seguros", color: "#ec4899" },
  comida: { name: "Comida", color: "#22c55e" },
  restaurantes: { name: "Restaurantes", color: "#f97316" },
  carros: { name: "Carros", color: "#ef4444" },
  usa: { name: "USA", color: "#6366f1" },
  viajes: { name: "Viajes", color: "#14b8a6" },
  gastos_libres: { name: "Gastos Libres", color: "#f59e0b" }
};

export default function Dashboard() {
  const { getAuthHeaders, user } = useAuth();
  const [stats, setStats] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [period, setPeriod] = useState("month");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [period]);

  const fetchData = async () => {
    try {
      const [statsRes, chartRes, remindersRes] = await Promise.all([
        axios.get(`${API}/dashboard/stats`, { headers: getAuthHeaders() }),
        axios.get(`${API}/dashboard/chart-data?period=${period}`, { headers: getAuthHeaders() }),
        axios.get(`${API}/reminders`, { headers: getAuthHeaders() }).catch(() => ({ data: [] }))
      ]);
      
      setStats(statsRes.data);
      setChartData(chartRes.data.data);
      setReminders(remindersRes.data);
      
      // Transform category data to match Flujo categories
      const byCategory = statsRes.data?.by_category || {};
      const transformed = Object.entries(FLUJO_CATEGORIES).map(([key, config]) => ({
        name: config.name,
        value: byCategory[key] || 0,
        color: config.color,
        key
      })).filter(d => d.value > 0);
      
      setCategoryData(transformed);
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

  const getReminderIcon = (type) => {
    switch (type) {
      case "payment_due": return Bell;
      case "card_payment": return CreditCard;
      case "subscription_review": return Warning;
      case "insurance_reminder": return FirstAid;
      case "motivation": return Sparkle;
      default: return Bell;
    }
  };

  const getReminderColor = (priority) => {
    switch (priority) {
      case "high": return "bg-red-50 dark:bg-red-900/20 border-red-200 text-red-800 dark:text-red-200";
      case "medium": return "bg-amber-50 dark:bg-amber-900/20 border-amber-200 text-amber-800 dark:text-amber-200";
      case "low": return "bg-blue-50 dark:bg-blue-900/20 border-blue-200 text-blue-800 dark:text-blue-200";
      default: return "bg-muted";
    }
  };

  const statCards = [
    { 
      title: "Balance Mensual", 
      value: stats?.balance, 
      icon: Wallet,
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
          <p className="text-sm sm:text-base text-muted-foreground">
            ¡Hola {user?.name?.split(" ")[0]}! Aquí está tu resumen financiero
          </p>
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

      {/* Smart Reminders Banner */}
      {reminders.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2"
        >
          {reminders.slice(0, 3).map((reminder, index) => {
            const Icon = getReminderIcon(reminder.type);
            return (
              <div 
                key={index}
                className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${getReminderColor(reminder.priority)}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    reminder.priority === "high" ? "bg-red-100 dark:bg-red-900/30" :
                    reminder.priority === "medium" ? "bg-amber-100 dark:bg-amber-900/30" :
                    "bg-blue-100 dark:bg-blue-900/30"
                  }`}>
                    <Icon size={20} weight="fill" />
                  </div>
                  <div>
                    <p className="font-medium">{reminder.title}</p>
                    {reminder.message && (
                      <p className="text-sm opacity-80">{reminder.message}</p>
                    )}
                  </div>
                </div>
                {reminder.action && reminder.type !== "motivation" && (
                  <Button size="sm" variant="outline" className="shrink-0">
                    {reminder.action}
                  </Button>
                )}
              </div>
            );
          })}
        </motion.div>
      )}

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

      {/* Charts Row - Responsive */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        {/* Area Chart - Money Flow */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
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
                      tickFormatter={(val) => val?.slice(5) || val}
                    />
                    <YAxis 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} 
                      width={60}
                      tickFormatter={(val) => `$${(val/1000).toFixed(0)}k`}
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

        {/* Bar Chart - Categories from Flujo */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <Card className="bento-card h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-base sm:text-lg">Gastos por Categoría</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Según tu presupuesto (Flujos)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[250px] sm:h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      type="number" 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                      tickFormatter={(val) => `$${(val/1000).toFixed(0)}k`}
                    />
                    <YAxis 
                      type="category" 
                      dataKey="name" 
                      width={100}
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
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {/* Legend */}
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-1 text-xs">
                {categoryData.slice(0, 6).map((item) => (
                  <div key={item.key} className="flex items-center gap-1">
                    <div 
                      className="w-2 h-2 rounded-full shrink-0" 
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-muted-foreground truncate">{item.name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Transactions Count */}
        <Card className="bento-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Transacciones este mes</p>
                <p className="text-2xl font-bold">{stats?.transaction_count || 0}</p>
              </div>
              <Badge variant="secondary">{period === "month" ? "Este mes" : period}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Top Category */}
        <Card className="bento-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Mayor gasto</p>
                <p className="text-lg font-bold truncate">
                  {categoryData[0]?.name || "Sin datos"}
                </p>
              </div>
              <span className="font-mono font-semibold text-red-500">
                {formatCurrency(categoryData[0]?.value || 0)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Savings Rate */}
        <Card className="bento-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tasa de ahorro</p>
                <p className={`text-2xl font-bold ${
                  stats?.total_income > 0 && stats?.balance > 0 
                    ? "text-emerald-600" 
                    : "text-red-500"
                }`}>
                  {stats?.total_income > 0 
                    ? `${((stats?.balance / stats?.total_income) * 100).toFixed(0)}%`
                    : "0%"
                  }
                </p>
              </div>
              <CheckCircle 
                size={32} 
                weight="fill" 
                className={stats?.balance > 0 ? "text-emerald-500" : "text-red-400"} 
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
