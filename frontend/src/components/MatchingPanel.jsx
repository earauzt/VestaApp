import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { CreditCard, Bank, X } from "@phosphor-icons/react";
import { BANKS } from "./ReconciliationHeader";

export function MatchingPanel({
  showHistory,
  history,
  reconciliationData,
  onCloseHistory,
  formatCurrency
}) {
  return (
    <>
      {/* History Section */}
      <AnimatePresence>
        {showHistory && history.length > 0 && !reconciliationData && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card className="bento-card">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Historial de Estados</CardTitle>
                  <Button variant="ghost" size="sm" onClick={onCloseHistory}>
                    <X size={16} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {history.map((statement) => (
                    <div
                      key={statement.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                    >
                      <div className="flex items-center gap-3">
                        {statement.statement_type === "credit_card" ? (
                          <CreditCard size={20} className="text-primary" />
                        ) : (
                          <Bank size={20} className="text-primary" />
                        )}
                        <div>
                          <p className="font-medium">{statement.file_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {BANKS.find(b => b.value === statement.bank_name)?.label || statement.bank_name} &bull;{" "}
                            {statement.period}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm font-medium">{statement.total_transactions} transacciones</p>
                          <p className="text-xs text-muted-foreground">
                            <span className="text-emerald-600">{statement.matched} coinciden</span> &bull;{" "}
                            <span className="text-slate-600">{statement.new} nuevas</span>
                          </p>
                        </div>
                        <Badge variant={statement.status === "completed" ? "default" : "secondary"}>
                          {statement.status === "completed" ? "Completado" : statement.status === "ready" ? "Pendiente" : statement.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Summary Card (card info from reconciliation) */}
      {reconciliationData && (
        <Card className="bento-card mb-4">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold">
                  {BANKS.find(b => b.value === reconciliationData.bank_name)?.label || reconciliationData.bank_name}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Periodo: {reconciliationData.period}
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-emerald-600">{reconciliationData.summary.matched}</p>
                  <p className="text-xs text-muted-foreground">Coinciden</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-slate-600">{reconciliationData.summary.new}</p>
                  <p className="text-xs text-muted-foreground">Nuevas</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-amber-600">{reconciliationData.summary.no_match}</p>
                  <p className="text-xs text-muted-foreground">Sin match</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{reconciliationData.summary.total}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              </div>
            </div>

            {reconciliationData.card_info && reconciliationData.card_info.current_balance && (
              <div className="mt-4 p-3 rounded-lg bg-muted/50 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Saldo Actual</p>
                  <p className="font-bold text-lg">{formatCurrency(reconciliationData.card_info.current_balance)}</p>
                </div>
                {reconciliationData.card_info.minimum_payment && (
                  <div>
                    <p className="text-muted-foreground">Pago Mínimo</p>
                    <p className="font-bold text-lg text-amber-600">{formatCurrency(reconciliationData.card_info.minimum_payment)}</p>
                  </div>
                )}
                {reconciliationData.card_info.credit_limit && (
                  <div>
                    <p className="text-muted-foreground">Límite</p>
                    <p className="font-bold">{formatCurrency(reconciliationData.card_info.credit_limit)}</p>
                  </div>
                )}
                {reconciliationData.card_info.due_date && (
                  <div>
                    <p className="text-muted-foreground">Fecha Pago</p>
                    <p className="font-bold">{reconciliationData.card_info.due_date}</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}
