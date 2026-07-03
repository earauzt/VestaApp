import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import PresupuestoEditable from "./PresupuestoEditable";
import Ingresos from "./Ingresos";
import Flujo from "./Flujo";

// Unified "Mi Dinero" page hosting three tabs:
//  - Presupuesto: monthly budget editor (PresupuestoEditable.js)
//  - Ingresos: income sources + expected + receivables (Ingresos.js)
//  - Flujo: scheduled payments calendar (Flujo.js)
export default function MiDinero() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const validTabs = ["presupuesto", "ingresos", "flujo"];
  const initial = validTabs.includes(params.get("tab")) ? params.get("tab") : "presupuesto";
  const [tab, setTab] = useState(initial);

  useEffect(() => {
    const current = new URLSearchParams(location.search).get("tab");
    if (current !== tab) {
      navigate(`${location.pathname}?tab=${tab}`, { replace: true });
    }
  }, [tab, location.pathname, location.search, navigate]);

  return (
    <div className="space-y-4" data-testid="mi-dinero-page">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Mi Dinero</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Presupuesto, ingresos y planificación de pagos en un solo lugar.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="presupuesto" data-testid="tab-presupuesto">Presupuesto</TabsTrigger>
          <TabsTrigger value="ingresos" data-testid="tab-ingresos">Ingresos</TabsTrigger>
          <TabsTrigger value="flujo" data-testid="tab-flujo">Flujo</TabsTrigger>
        </TabsList>

        <TabsContent value="presupuesto" className="mt-0"><PresupuestoEditable embedded /></TabsContent>
        <TabsContent value="ingresos" className="mt-0"><Ingresos embedded /></TabsContent>
        <TabsContent value="flujo" className="mt-0"><Flujo embedded /></TabsContent>
      </Tabs>
    </div>
  );
}
