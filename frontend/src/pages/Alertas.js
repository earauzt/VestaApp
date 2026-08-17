import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PRIORIDAD_BADGE = {
  high: "bg-red-100 text-red-700 border-red-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  low: "bg-slate-100 text-slate-600 border-slate-200",
};

const PRIORIDAD_LABEL = {
  high: "Urgente",
  medium: "Pronto",
  low: "Info",
};

export default function Alertas() {
  const { getAuthHeaders } = useAuth();
  const navigate = useNavigate();
  const [notificaciones, setNotificaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const getAuthHeadersRef = useRef(getAuthHeaders);
  useEffect(() => { getAuthHeadersRef.current = getAuthHeaders; });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/notificaciones`, { headers: getAuthHeadersRef.current() });
      setNotificaciones(res.data.notificaciones || []);
      setError(false);
    } catch (e) {
      if (process.env.NODE_ENV === 'development') console.error("Error fetching notificaciones:", e);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="space-y-6" data-testid="alertas-page">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Alertas</h1>
        <p className="text-sm text-slate-500">Pagos próximos, límites de presupuesto y pendientes de revisión</p>
      </div>

      {loading && (
        <div className="text-sm text-slate-500">Cargando alertas...</div>
      )}

      {!loading && error && (
        <Card className="border-red-200">
          <CardContent className="p-5 flex items-center justify-between gap-4">
            <p className="text-sm text-slate-600">No se pudieron cargar las alertas.</p>
            <Button variant="outline" size="sm" onClick={fetchData}>Reintentar</Button>
          </CardContent>
        </Card>
      )}

      {!loading && !error && notificaciones.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-sm text-slate-500">
            No tienes alertas pendientes. Todo al día.
          </CardContent>
        </Card>
      )}

      {!loading && !error && notificaciones.length > 0 && (
        <div className="space-y-3">
          {notificaciones.map((n) => (
            <Card
              key={n.id}
              className="cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => n.accion_url && navigate(n.accion_url)}
              data-testid={`alerta-${n.id}`}
            >
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="shrink-0 h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-lg">
                    {n.icono || "🔔"}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{n.titulo}</p>
                    <p className="text-xs text-slate-500">{n.texto}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className={PRIORIDAD_BADGE[n.prioridad] || PRIORIDAD_BADGE.low}>
                    {PRIORIDAD_LABEL[n.prioridad] || "Info"}
                  </Badge>
                  {n.accion_label && (
                    <Badge variant="outline" className="border-slate-200 text-slate-600">
                      {n.accion_label} →
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
