import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import CargarValidar from "./CargarValidar";
import Transactions from "./Transactions";

// Unified "Movimientos" page that hosts:
//  - "Por revisar" tab: pending inbox + import tools (from CargarValidar.js)
//  - "Todos" tab: full ledger (from Transactions.js)
// Query string ?tab=todos|por-revisar keeps tab state bookmarkable.
export default function Movimientos() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const initial = params.get("tab") === "todos" ? "todos" : "por-revisar";
  const [tab, setTab] = useState(initial);

  useEffect(() => {
    const current = new URLSearchParams(location.search).get("tab");
    const target = tab === "todos" ? "todos" : "por-revisar";
    if (current !== target) {
      navigate(`${location.pathname}?tab=${target}`, { replace: true });
    }
  }, [tab, location.pathname, location.search, navigate]);

  return (
    <div className="space-y-4" data-testid="movimientos-page">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Movimientos</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Aprueba transacciones pendientes y revisa todo tu historial.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="por-revisar" data-testid="tab-por-revisar">Por revisar</TabsTrigger>
          <TabsTrigger value="todos" data-testid="tab-todos">Todos</TabsTrigger>
        </TabsList>

        <TabsContent value="por-revisar" className="mt-0">
          <CargarValidar />
        </TabsContent>
        <TabsContent value="todos" className="mt-0">
          <Transactions />
        </TabsContent>
      </Tabs>
    </div>
  );
}
