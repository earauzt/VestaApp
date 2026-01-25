import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { toast } from "sonner";
import { 
  Brain, 
  ArrowUp, 
  ArrowDown,
  Lightbulb,
  Scales,
  SpinnerGap,
  ArrowRight
} from "@phosphor-icons/react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CATEGORY_NAMES = {
  alimentacion: "Alimentación",
  salud: "Salud",
  educacion: "Educación",
  vivienda: "Vivienda",
  vestimenta: "Vestimenta",
  transporte: "Transporte",
  otros: "Otros"
};

export default function Predictions() {
  const { getAuthHeaders } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPredictions();
  }, []);

  const fetchPredictions = async () => {
    try {
      const response = await axios.get(`${API}/predictions`, { headers: getAuthHeaders() });
      setData(response.data);
    } catch (error) {
      toast.error("Error al cargar predicciones");
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

  const getTrendIcon = (trend) => {
    if (trend === "up") return <ArrowUp size={20} className="text-red-500" />;
    if (trend === "down") return <ArrowDown size={20} className="text-emerald-500" />;
    return <ArrowRight size={20} className="text-amber-500" />;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]" data-testid="predictions-loading">
        <SpinnerGap size={48} className="animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Generando predicciones con AI...</p>
        <p className="text-sm text-muted-foreground">Analizando tus patrones de gasto</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="predictions-page">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Brain size={32} className="text-primary" weight="duotone" />
          Predicciones AI
        </h1>
        <p className="text-muted-foreground">
          Análisis inteligente y consejos personalizados para tus finanzas
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Predictions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="bento-card h-full">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ArrowUp size={20} />
                Proyecciones del Próximo Mes
              </CardTitle>
              <CardDescription>Estimaciones basadas en tu historial</CardDescription>
            </CardHeader>
            <CardContent>
              {Array.isArray(data?.predictions) && data.predictions.length > 0 ? (
                <div className="space-y-4">
                  {data.predictions.map((pred, index) => (
                    <motion.div
                      key={pred.category}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                      className="flex items-center justify-between p-4 rounded-xl bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        {getTrendIcon(pred.trend)}
                        <div>
                          <p className="font-medium">
                            {CATEGORY_NAMES[pred.category] || pred.category}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Tendencia: {pred.trend === "up" ? "Incremento" : pred.trend === "down" ? "Reducción" : "Estable"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-mono font-semibold">
                          {formatCurrency(pred.predicted_amount)}
                        </p>
                        <Badge variant={pred.trend === "up" ? "destructive" : "secondary"}>
                          {pred.trend === "up" ? "↑" : pred.trend === "down" ? "↓" : "→"}
                        </Badge>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Brain size={48} className="mx-auto mb-4 opacity-50" />
                  <p>No hay suficientes datos para predicciones</p>
                  <p className="text-sm">Agrega más transacciones para obtener proyecciones</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Advice */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Card className="bento-card h-full">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Lightbulb size={20} className="text-amber-500" />
                Consejos de Optimización
              </CardTitle>
              <CardDescription>Recomendaciones personalizadas</CardDescription>
            </CardHeader>
            <CardContent>
              {Array.isArray(data?.advice) && data.advice.length > 0 ? (
                <div className="space-y-3">
                  {data.advice.map((tip, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                      className="flex gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/30"
                    >
                      <Lightbulb size={20} className="text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-sm">{tip}</p>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Lightbulb size={48} className="mx-auto mb-4 opacity-50" />
                  <p>Consejos no disponibles</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* SRI Tips */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <Card className="bento-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Scales size={20} className="text-primary" />
              Tips para Deducciones SRI Ecuador
            </CardTitle>
            <CardDescription>
              Maximiza tus beneficios tributarios
            </CardDescription>
          </CardHeader>
          <CardContent>
            {Array.isArray(data?.sri_tips) && data.sri_tips.length > 0 ? (
              <div className="grid md:grid-cols-2 gap-4">
                {data.sri_tips.map((tip, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                    className="flex gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20"
                  >
                    <Scales size={20} className="text-primary shrink-0 mt-0.5" />
                    <p className="text-sm">{tip}</p>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                <div className="flex gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
                  <Scales size={20} className="text-primary shrink-0 mt-0.5" />
                  <p className="text-sm">Guarda todos tus comprobantes de gastos en alimentación, salud, educación, vivienda y vestimenta para maximizar deducciones.</p>
                </div>
                <div className="flex gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
                  <Scales size={20} className="text-primary shrink-0 mt-0.5" />
                  <p className="text-sm">Los gastos deducibles en Ecuador tienen límites anuales. Mantén un registro actualizado para no excederlos.</p>
                </div>
                <div className="flex gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
                  <Scales size={20} className="text-primary shrink-0 mt-0.5" />
                  <p className="text-sm">Las facturas electrónicas son válidas para deducciones. Asegúrate de que incluyan tu RUC o cédula.</p>
                </div>
                <div className="flex gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
                  <Scales size={20} className="text-primary shrink-0 mt-0.5" />
                  <p className="text-sm">Los gastos médicos incluyen medicinas, consultas, exámenes y seguros de salud privados.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
