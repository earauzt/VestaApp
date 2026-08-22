import { motion } from "framer-motion";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Checkbox } from "../components/ui/checkbox";
import {
  CheckCircle,
  Plus,
  X,
  Link as LinkIcon,
  CircleNotch,
  Warning
} from "@phosphor-icons/react";
import { PERSONAL_CATEGORIES } from "../constants/categories";

const CATEGORIES = {
  ...Object.fromEntries(Object.entries(PERSONAL_CATEGORIES).map(([k, c]) => [k, c.name])),
  diferido: "Diferido",
};

function getStatusBadge(status, confidence) {
  switch (status) {
    case "matched":
      return (
        <Badge className="bg-emerald-100 text-emerald-700 gap-1">
          <CheckCircle size={12} />
          Coincide ({Math.round(confidence * 100)}%)
        </Badge>
      );
    case "new":
      return (
        <Badge className="bg-slate-100 text-slate-700 gap-1">
          <Plus size={12} />
          Nueva
        </Badge>
      );
    case "no_match":
      return (
        <Badge className="bg-amber-100 text-amber-700 gap-1">
          <Warning size={12} />
          Sin coincidencia
        </Badge>
      );
    default:
      return <Badge variant="outline">Desconocido</Badge>;
  }
}

export function TransactionList({
  reconciliationData,
  selectedItems,
  onToggleSelect,
  onSelectAllNew,
  onConfirm,
  onCancel,
  confirming,
  formatCurrency
}) {
  return (
    <Card className="bento-card">
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base">Transacciones a Reconciliar</CardTitle>
          <div className="flex items-center flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={onSelectAllNew}>
              Seleccionar todas las nuevas
            </Button>
            <Badge variant="outline">
              {selectedItems.length} seleccionadas
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {reconciliationData.transactions.map((tx, index) => (
            <motion.div
              key={tx.temp_id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.02 }}
              className={`p-3 rounded-lg border transition-all ${
                tx.status === "matched"
                  ? "bg-emerald-50 border-emerald-200"
                  : selectedItems.includes(tx.temp_id)
                    ? "bg-slate-50 border-slate-200"
                    : "bg-card border-border hover:border-primary/30"
              }`}
            >
              <div className="flex items-center gap-3">
                {tx.status !== "matched" && (
                  <Checkbox
                    checked={selectedItems.includes(tx.temp_id)}
                    onCheckedChange={() => onToggleSelect(tx.temp_id)}
                  />
                )}
                {tx.status === "matched" && (
                  <CheckCircle size={20} className="text-emerald-600" />
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{tx.establishment || tx.description}</span>
                    {getStatusBadge(tx.status, tx.confidence)}
                    {tx.vendor_known && tx.auto_categorized && (
                      tx.vendor_match_type === "exact" || (tx.deferred_info?.match_type === "amount_match") ? (
                        <Badge className="text-xs gap-1 bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
                          <CheckCircle size={10} />
                          Auto
                        </Badge>
                      ) : (
                        <Badge className="text-xs gap-1 bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">
                          <Warning size={10} />
                          Sugerido
                        </Badge>
                      )
                    )}
                    {!tx.vendor_known && !tx.auto_categorized && tx.suggested_category && (
                      <Badge variant="secondary" className="text-xs gap-1">
                        Manual
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                    <span>{tx.date}</span>
                    {tx.suggested_category && (
                      <>
                        <span>&bull;</span>
                        <span className="text-primary">{CATEGORIES[tx.suggested_category] || tx.suggested_category}</span>
                      </>
                    )}
                    {tx.matched_transaction && (
                      <>
                        <span>&bull;</span>
                        <span className="flex items-center gap-1 text-emerald-600">
                          <LinkIcon size={12} />
                          Vinculada a: {tx.matched_transaction.description?.substring(0, 30)}...
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <p className="font-bold font-mono">{formatCurrency(tx.amount)}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="flex items-center justify-between mt-4 pt-4 border-t">
          <Button variant="outline" onClick={onCancel}>
            <X size={16} className="mr-2" />
            Cancelar
          </Button>
          <Button
            onClick={onConfirm}
            disabled={confirming}
            className="gap-2"
          >
            {confirming ? (
              <>
                <CircleNotch size={16} className="animate-spin" />
                Procesando...
              </>
            ) : (
              <>
                <CheckCircle size={16} />
                Confirmar Reconciliación
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
