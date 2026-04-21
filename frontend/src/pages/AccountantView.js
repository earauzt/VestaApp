import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import { toast } from "sonner";
import { 
  Calculator, 
  Scales,
  FileText,
  ArrowUp,
  CheckCircle,
  XCircle
} from "@phosphor-icons/react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  Legend
} from "recharts";

import { components, typography } from "../styles/design-system";
const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SRI_DEDUCTIBLE = ["alimentacion", "salud", "educacion", "vivienda", "vestimenta"];

export default function AccountantView() {
  const { getAuthHeaders } = useAuth();
  const [taxSummary, setTaxSummary] = useState(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTaxSummary();
  }, [selectedYear]);

  const fetchTaxSummary = async () => {
    setLoading(true);
    try {
      const response = await axios.get(
        `${API}/accountant/tax-summary?year=${selectedYear}`, 
        { headers: getAuthHeaders() }
      );
      setTaxSummary(response.data);
    } catch (error) {
      toast.error("Error al cargar resumen tributario");
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

  const years = [];
  const currentYear = new Date().getFullYear();
  for (let y = currentYear; y >= currentYear - 5; y--) {
    years.push(y.toString());
  }

  const categoryData = taxSummary?.by_category 
    ? Object.entries(taxSummary.by_category).map(([key, value]) => ({
        name: value.name,
        total: value.total,
        deductible: value.deductible
      }))
    : [];

  const monthlyData = taxSummary?.monthly_breakdown
    ? Object.entries(taxSummary.monthly_breakdown)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, data]) => ({
          month: month.slice(5),
          Total: data.total,
          Deducible: data.deductible
        }))
    : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-muted-foreground">Cargando resumen tributario...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="accountant-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Calculator size={32} className="text-primary" weight="duotone" />
            Vista Contadora
          </h1>
          <p className="text-muted-foreground">
            Resumen tributario según normativa SRI Ecuador
          </p>
        </div>
        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-[150px]" data-testid="year-select">
            <SelectValue placeholder="Año" />
          </SelectTrigger>
          <SelectContent>
            {years.map((year) => (
              <SelectItem key={year} value={year}>{year}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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
                  <p className="text-sm text-muted-foreground mb-1">Total Gastos {selectedYear}</p>
                  <p className="stat-number text-foreground">
                    {formatCurrency(taxSummary?.total_expenses)}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-muted text-muted-foreground">
                  <FileText size={24} weight="duotone" />
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
          <Card className="bento-card border-primary/50">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Gastos Deducibles SRI</p>
                  <p className="stat-number text-primary">
                    {formatCurrency(taxSummary?.deductible_expenses)}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-primary/10 text-primary">
                  <Scales size={24} weight="duotone" />
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
                  <p className="text-sm text-muted-foreground mb-1">% Deducible</p>
                  <p className="stat-number text-emerald-600">
                    {taxSummary?.total_expenses > 0 
                      ? ((taxSummary?.deductible_expenses / taxSummary?.total_expenses) * 100).toFixed(1)
                      : 0}%
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30">
                  <ArrowUp size={24} weight="duotone" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Monthly Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        <Card className="bento-card">
          <CardHeader>
            <CardTitle className="text-lg">Evolución Mensual</CardTitle>
            <CardDescription>Gastos totales vs deducibles por mes</CardDescription>
          </CardHeader>
          <CardContent>
            {monthlyData.length > 0 ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip 
                      contentStyle={{ 
                        background: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                      formatter={(value) => formatCurrency(value)}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="Total" 
                      stroke="#868e96" 
                      strokeWidth={2}
                      dot={{ fill: '#868e96' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="Deducible" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--primary))' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                No hay datos para el año seleccionado
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Category Breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4 }}
      >
        <Card className="bento-card">
          <CardHeader>
            <CardTitle className="text-lg">Desglose por Categoría</CardTitle>
            <CardDescription>Clasificación según rubros deducibles del SRI</CardDescription>
          </CardHeader>
          <CardContent>
            {categoryData.length > 0 ? (
              <div className="space-y-4">
                {categoryData.map((cat, index) => (
                  <motion.div
                    key={cat.name}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className="flex items-center justify-between p-4 rounded-xl bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      {cat.deductible ? (
                        <CheckCircle size={20} className="text-emerald-500" weight="fill" />
                      ) : (
                        <XCircle size={20} className="text-muted-foreground" weight="fill" />
                      )}
                      <div>
                        <p className="font-medium">{cat.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {cat.deductible ? "Deducible SRI" : "No deducible"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-semibold">
                        {formatCurrency(cat.total)}
                      </p>
                      {cat.deductible && (
                        <Badge className="bg-primary/10 text-primary border-0">
                          Aplica rebaja
                        </Badge>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No hay datos de categorías
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* SRI Info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.5 }}
      >
        <Card className="bento-card bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Scales size={20} className="text-primary" />
              Información SRI Ecuador
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-2">Gastos Personales Deducibles</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle size={16} className="text-emerald-500" />
                    Alimentación
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle size={16} className="text-emerald-500" />
                    Salud
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle size={16} className="text-emerald-500" />
                    Educación
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle size={16} className="text-emerald-500" />
                    Vivienda
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle size={16} className="text-emerald-500" />
                    Vestimenta
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">Requisitos</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Comprobantes de venta válidos</li>
                  <li>• Facturas a nombre del contribuyente</li>
                  <li>• Respetar límites anuales por rubro</li>
                  <li>• Declaración anual de impuesto a la renta</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
