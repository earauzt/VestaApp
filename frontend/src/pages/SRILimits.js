import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
import { toast } from "sonner";
import { 
  Scales,
  Warning,
  CheckCircle,
  XCircle,
  Info,
  Calculator,
  Receipt,
  Percent,
  CurrencyDollar,
  Check,
  X
} from "@phosphor-icons/react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function SRILimits() {
  const { getAuthHeaders } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cargasFamiliares, setCargasFamiliares] = useState("3");
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargasFamiliares]);

  const fetchData = async () => {
    // Only show the full-page loading skeleton on the very first load.
    // On subsequent refetches (e.g. changing cargas familiares), keep the
    // previous data visible with a subtle overlay instead of unmounting it.
    if (!data) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    try {
      const response = await axios.get(
        `${API}/sri/deduction-limits?cargas_familiares=${cargasFamiliares}`,
        { headers: getAuthHeaders() }
      );
      setData(response.data);
      setLoadError(false);
    } catch (error) {
      setLoadError(true);
      toast.error("Error al cargar límites SRI");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-EC', {
      style: 'currency',
      currency: 'USD'
    }).format(value || 0);
  };

  const getProgressColor = (percentage) => {
    if (percentage >= 100) return "bg-red-500";
    if (percentage >= 80) return "bg-amber-500";
    return "bg-emerald-500";
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-muted-foreground">Cargando límites SRI...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative" data-testid="sri-limits-page">
      {refreshing && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-background border rounded-full px-3 py-1.5 shadow-md text-sm text-muted-foreground" data-testid="sri-limits-refreshing">
          <span className="h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          Actualizando...
        </div>
      )}
      {/* Header */}
      <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 transition-opacity ${refreshing ? "opacity-50" : ""}`}>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
            <Scales size={32} className="text-primary" weight="duotone" />
            Límites SRI Ecuador {data?.year}
          </h1>
          <p className="text-muted-foreground">
            Control de gastos deducibles según Ley de Régimen Tributario Interno
          </p>
        </div>
        <Select value={cargasFamiliares} onValueChange={setCargasFamiliares}>
          <SelectTrigger className="w-[200px]" data-testid="cargas-select">
            <SelectValue placeholder="Cargas familiares" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">0 cargas familiares</SelectItem>
            <SelectItem value="1">1 carga familiar</SelectItem>
            <SelectItem value="2">2 cargas familiares</SelectItem>
            <SelectItem value="3">3 cargas familiares</SelectItem>
            <SelectItem value="4">4 cargas familiares</SelectItem>
            <SelectItem value="5">5+ cargas familiares</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className={`space-y-6 transition-opacity ${refreshing ? "opacity-50" : ""}`}>
      {loadError && !data && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>No se pudieron cargar los límites SRI</AlertTitle>
          <AlertDescription>
            El cálculo falló en el servidor. Revisa la consola o reintenta; no se muestran ceros como si fueran datos reales.
          </AlertDescription>
        </Alert>
      )}
      {/* Contribuyente Info */}
      {data?.contribuyente && (
        <Card className="bento-card bg-white border-slate-200 border-l-4 border-l-primary">
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-primary/10 text-primary">
                <Receipt size={24} weight="duotone" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">{data.contribuyente.nombre}</h3>
                <p className="text-sm text-muted-foreground">RUC: {data.contribuyente.ruc}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant="secondary">{data.contribuyente.tipo}</Badge>
                  <Badge variant="secondary">{data.contribuyente.regimen}</Badge>
                  <Badge variant="outline">{data.contribuyente.jurisdiccion}</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alerts */}
      {data?.alerts && data.alerts.length > 0 && (
        <div className="space-y-2">
          {data.alerts.map((alert, index) => (
            <Alert 
              key={`${alert.type}-${alert.message?.slice(0, 30)}`} 
              variant={alert.type === "error" ? "destructive" : "default"}
              className={alert.type === "warning" ? "border-amber-500 bg-amber-50 dark:bg-amber-900/10" : ""}
            >
              {alert.type === "error" ? (
                <XCircle className="h-4 w-4" />
              ) : (
                <Warning className="h-4 w-4 text-amber-500" />
              )}
              <AlertTitle>{alert.type === "error" ? "Alerta" : "Advertencia"}</AlertTitle>
              <AlertDescription>{alert.message}</AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Summary Cards — no se pintan $0 fingidos si la carga falló */}
      {data && <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="bento-card">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-muted-foreground mb-1">Límite Global</p>
                  <p className="text-lg sm:text-2xl font-bold text-primary break-words">
                    {formatCurrency(data?.limite_global)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {cargasFamiliares} cargas × CBF ${data?.canasta_basica != null ? Number(data.canasta_basica).toFixed(2) : "—"}
                  </p>
                </div>
                <div className="p-2 sm:p-3 rounded-xl bg-primary/10 text-primary shrink-0">
                  <CurrencyDollar size={20} weight="duotone" className="sm:w-6 sm:h-6" />
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
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-muted-foreground mb-1">Gastos Deducibles</p>
                  <p className="text-lg sm:text-2xl font-bold text-emerald-600 break-words">
                    {formatCurrency(data?.total_deductible_spent)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {data?.percentage_used}% del límite usado
                  </p>
                </div>
                <div className="p-2 sm:p-3 rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 shrink-0">
                  <CheckCircle size={20} weight="duotone" className="sm:w-6 sm:h-6" />
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
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-muted-foreground mb-1">Gastos NO Deducibles</p>
                  <p className="text-lg sm:text-2xl font-bold text-red-500 break-words">
                    {formatCurrency(data?.total_non_deductible_spent)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Viajes internacionales, otros
                  </p>
                </div>
                <div className="p-2 sm:p-3 rounded-xl bg-red-100 text-red-500 dark:bg-red-900/30 shrink-0">
                  <XCircle size={20} weight="duotone" className="sm:w-6 sm:h-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
        >
          <Card className="bento-card border-primary/50">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-muted-foreground mb-1">Rebaja IR Estimada</p>
                  <p className="text-lg sm:text-2xl font-bold text-primary break-words">
                    {formatCurrency(data?.rebaja_ir_estimada)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {data?.porcentaje_rebaja}% de gastos aplicables
                  </p>
                </div>
                <div className="p-2 sm:p-3 rounded-xl bg-primary/10 text-primary shrink-0">
                  <Percent size={20} weight="duotone" className="sm:w-6 sm:h-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>}

      {/* Global Progress */}
      {data && <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4 }}
      >
        <Card className="bento-card">
          <CardHeader>
            <CardTitle className="text-lg">Uso del Límite Global</CardTitle>
            <CardDescription>
              Progreso hacia el límite máximo de deducciones {data?.year}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span>Gastos deducibles: {formatCurrency(data?.total_deductible_spent)}</span>
                <span>Límite: {formatCurrency(data?.limite_global)}</span>
              </div>
              <div className="relative h-4 bg-muted rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(data?.percentage_used || 0, 100)}%` }}
                  transition={{ duration: 0.8 }}
                  className={`absolute h-full rounded-full ${getProgressColor(data?.percentage_used || 0)}`}
                />
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{data?.percentage_used}% utilizado</span>
                <span>Disponible: {formatCurrency(data?.remaining_global)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>}

      {/* Category Progress */}
      {data && <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.5 }}
      >
        <Card className="bento-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calculator size={20} />
              Límites por Categoría SRI
            </CardTitle>
            <CardDescription>
              Basado en la Fracción Básica Exenta: {formatCurrency(data?.fraccion_basica_exenta)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {data?.category_progress?.map((cat, index) => (
                <motion.div
                  key={cat.category}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className="space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {cat.over_limit ? (
                        <XCircle size={20} className="text-red-500" weight="fill" />
                      ) : cat.percentage >= 80 ? (
                        <Warning size={20} className="text-amber-500" weight="fill" />
                      ) : (
                        <CheckCircle size={20} className="text-emerald-500" weight="fill" />
                      )}
                      <div>
                        <p className="font-medium">{cat.name}</p>
                        <p className="text-xs text-muted-foreground">{cat.description}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-semibold">
                        {formatCurrency(cat.spent)} / {formatCurrency(cat.limit)}
                      </p>
                      <Badge 
                        variant={cat.over_limit ? "destructive" : cat.percentage >= 80 ? "outline" : "secondary"}
                        className={cat.percentage >= 80 && !cat.over_limit ? "border-amber-500 text-amber-600" : ""}
                      >
                        {cat.percentage}%
                      </Badge>
                    </div>
                  </div>
                  <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(cat.percentage, 100)}%` }}
                      transition={{ duration: 0.5, delay: index * 0.05 }}
                      className={`absolute h-full rounded-full ${getProgressColor(cat.percentage)}`}
                    />
                  </div>
                  {cat.remaining > 0 && (
                    <p className="text-xs text-muted-foreground text-right">
                      Disponible: {formatCurrency(cat.remaining)}
                    </p>
                  )}
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>}

      {/* Info Card */}
      <Card className="bento-card bg-white border border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Info size={20} className="text-primary" />
            Información Importante SRI
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6 text-sm">
            <div>
              <h4 className="font-medium mb-2">Gastos Deducibles</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li className="flex gap-2"><Check size={14} className="text-[#16A34A] mt-0.5 shrink-0" /> Alimentación (supermercados, restaurantes en Ecuador)</li>
                <li className="flex gap-2"><Check size={14} className="text-[#16A34A] mt-0.5 shrink-0" /> Salud (consultas, medicinas, seguros)</li>
                <li className="flex gap-2"><Check size={14} className="text-[#16A34A] mt-0.5 shrink-0" /> Educación (colegios, universidades, cursos)</li>
                <li className="flex gap-2"><Check size={14} className="text-[#16A34A] mt-0.5 shrink-0" /> Vivienda (arriendo, servicios básicos)</li>
                <li className="flex gap-2"><Check size={14} className="text-[#16A34A] mt-0.5 shrink-0" /> Vestimenta (ropa y calzado en Ecuador)</li>
                <li className="flex gap-2"><Check size={14} className="text-[#16A34A] mt-0.5 shrink-0" /> Turismo Nacional</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">NO Deducibles</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li className="flex gap-2"><X size={14} className="text-[#DC2626] mt-0.5 shrink-0" /> Gastos en el exterior (viajes internacionales)</li>
                <li className="flex gap-2"><X size={14} className="text-[#DC2626] mt-0.5 shrink-0" /> Compras con tarjeta extranjera</li>
                <li className="flex gap-2"><X size={14} className="text-[#DC2626] mt-0.5 shrink-0" /> Transporte personal (combustible, mantenimiento)</li>
                <li className="flex gap-2"><X size={14} className="text-[#DC2626] mt-0.5 shrink-0" /> Entretenimiento general</li>
                <li className="flex gap-2"><X size={14} className="text-[#DC2626] mt-0.5 shrink-0" /> Gastos sin factura válida</li>
                <li className="flex gap-2"><X size={14} className="text-[#DC2626] mt-0.5 shrink-0" /> IVA e ICE incluido en facturas</li>
              </ul>
            </div>
          </div>
          <div className="mt-4 p-3 rounded-md bg-slate-50 border border-slate-200">
            <p className="text-sm text-slate-700">
              <strong>Rebaja de Impuesto a la Renta:</strong> 18% del menor valor entre tus gastos deducibles y el límite por cargas familiares. 
              Presenta el Anexo de Gastos Personales en febrero si tus ingresos superan {data?.fraccion_basica_exenta != null ? `$${Number(data.fraccion_basica_exenta).toLocaleString("es-EC")} anuales` : "el umbral legal"}.
            </p>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
