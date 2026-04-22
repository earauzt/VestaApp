import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import SriMatch from "./SriMatch";
import SRILimits from "./SRILimits";
import AccountantView from "./AccountantView";

// Unified "Fiscal" page hosting three tabs:
//  - Facturas: SRI invoices review (SriMatch.js)
//  - Deducciones: SRI deduction limits (SRILimits.js)
//  - Resumen: accountant yearly summary (AccountantView.js)
export default function Fiscal() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const validTabs = ["facturas", "deducciones", "resumen"];
  const initial = validTabs.includes(params.get("tab")) ? params.get("tab") : "facturas";
  const [tab, setTab] = useState(initial);

  useEffect(() => {
    const current = new URLSearchParams(location.search).get("tab");
    if (current !== tab) {
      navigate(`${location.pathname}?tab=${tab}`, { replace: true });
    }
  }, [tab, location.pathname, location.search, navigate]);

  return (
    <div className="space-y-4" data-testid="fiscal-page">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Fiscal</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Facturas SRI, límites de deducción y resumen anual para la contadora.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="facturas" data-testid="tab-facturas">Facturas</TabsTrigger>
          <TabsTrigger value="deducciones" data-testid="tab-deducciones">Deducciones</TabsTrigger>
          <TabsTrigger value="resumen" data-testid="tab-resumen">Resumen</TabsTrigger>
        </TabsList>

        <TabsContent value="facturas" className="mt-0"><SriMatch /></TabsContent>
        <TabsContent value="deducciones" className="mt-0"><SRILimits /></TabsContent>
        <TabsContent value="resumen" className="mt-0"><AccountantView /></TabsContent>
      </Tabs>
    </div>
  );
}
