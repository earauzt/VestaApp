import { useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../ui/alert-dialog";
import { CheckCircle, WarningCircle } from "@phosphor-icons/react";
import { Pencil, X } from "lucide-react";
import TransactionEditModal from "../shared/TransactionEditModal";
import { displayName } from "../../utils/displayName";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

const formatDate = (date) => {
  if (!date) return "—";
  try {
    return format(new Date(date), "d MMM yyyy", { locale: es });
  } catch {
    return date;
  }
};

export default function TabPorRevisar({
  budgetCategories,
  reviewFilter, setReviewFilter,
  filteredReview,
  reviewSelectedIds, toggleReviewSelect,
  reviewAllSelected, toggleReviewSelectAll,
  handleReviewBulkApprove, reviewBulkApproving,
  bulkProgress,
  vendorStats,
  getAuthHeaders,
  onAfterUpdate,
  formatCurrency,
  fetchError,
  onRetry,
}) {
  const [modalMode, setModalMode] = useState(null); // 'single' | 'bulk' | null
  const [activeItem, setActiveItem] = useState(null);
  const [discardTarget, setDiscardTarget] = useState(null); // item pending confirmation

  const openSingleEdit = (item) => { setActiveItem(item); setModalMode("single"); };
  const openBulkEdit = () => { setActiveItem(null); setModalMode("bulk"); };
  const closeModal = () => { setModalMode(null); setActiveItem(null); };

  const isZeroValue = (it) => it.amount == null || Number(it.amount) === 0;

  const fmtAmount = (v) => (formatCurrency ? formatCurrency(v) : `$${(v || 0).toFixed(2)}`);

  // Discard a single item, routing to the correct endpoint based on its origin.
  const discardItem = async (item) => {
    const headers = getAuthHeaders();
    if (item.source === "gmail") {
      await axios.put(`${API}/gmail/transactions/${item.origin_id}/discard`, {}, { headers });
    } else {
      // Statement/manual-origin items: there is no gmail discard endpoint for these.
      // Rejecting removes them from the pending review queue.
      await axios.put(`${API}/reconciliation/reject/${item.origin_id}?reason=${encodeURIComponent("Descartado")}`, {}, { headers });
    }
  };

  const requestDiscard = (item) => setDiscardTarget(item);

  const confirmDiscard = async () => {
    const item = discardTarget;
    if (!item) return;
    setDiscardTarget(null);
    try {
      await discardItem(item);
      toast.success("Descartado");
      if (onAfterUpdate) onAfterUpdate();
    } catch (e) {
      if (e.response?.status !== 404) {
        toast.error(e.response?.data?.detail || "No se pudo descartar");
      }
    }
  };

  const handleDiscardAllZero = async () => {
    const zeros = (filteredReview || []).filter(isZeroValue);
    if (zeros.length === 0) { toast.info("No hay items sin valor"); return; }
    try {
      const results = await Promise.allSettled(zeros.map((z) => discardItem(z)));
      const ok = results.filter((r) => r.status === "fulfilled").length;
      toast.success(`${ok} de ${zeros.length} descartados`);
      if (onAfterUpdate) onAfterUpdate();
    } catch {
      toast.error("Error al descartar en batch");
    }
  };

  // Ordenar: items sin valor al final
  const sortedReview = [...(filteredReview || [])].sort((a, b) => {
    const az = isZeroValue(a) ? 1 : 0;
    const bz = isZeroValue(b) ? 1 : 0;
    return az - bz;
  });

  const zeroCount = sortedReview.filter(isZeroValue).length;

  const handleSave = async (data) => {
    try {
      if (modalMode === "bulk") {
        const res = await axios.post(
          `${API}/transactions/bulk-categorize`,
          { ids: reviewSelectedIds, category: data.category, subcategory: data.subcategory || "" },
          { headers: getAuthHeaders() }
        );
        toast.success(`${res.data?.updated ?? reviewSelectedIds.length} transacciones actualizadas`);
      } else if (activeItem) {
        await axios.post(
          `${API}/transactions/bulk-categorize`,
          { ids: [activeItem.id], category: data.category, subcategory: data.subcategory || "" },
          { headers: getAuthHeaders() }
        );
        toast.success("Transacción actualizada");
      }
      closeModal();
      if (onAfterUpdate) onAfterUpdate();
    } catch (e) {
      toast.error(e.response?.data?.detail || "No se pudo guardar");
    }
  };

  return (
    <div className="space-y-4" data-testid="revisar-tab-content">
      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row gap-3 lg:items-center justify-between pb-2 border-b">
        <div className="flex gap-2 flex-wrap">
          <Select value={reviewFilter.source} onValueChange={(v) => setReviewFilter({ ...reviewFilter, source: v })}>
            <SelectTrigger className="w-full sm:w-[150px] h-9" data-testid="review-source-filter">
              <SelectValue placeholder="Origen" />
            </SelectTrigger>
            <SelectContent className="z-[250]">
              <SelectItem value="all">Todos los orígenes</SelectItem>
              <SelectItem value="gmail">Solo Gmail</SelectItem>
              <SelectItem value="statement">Solo PDF/Estados</SelectItem>
              <SelectItem value="manual">Solo manuales</SelectItem>
            </SelectContent>
          </Select>
          <Select value={reviewFilter.category} onValueChange={(v) => setReviewFilter({ ...reviewFilter, category: v })}>
            <SelectTrigger className="w-full sm:w-[170px] h-9" data-testid="review-category-filter">
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent className="z-[250]">
              <SelectItem value="all">Todas las categorías</SelectItem>
              {Object.entries(budgetCategories).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.name || k}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 sm:gap-3">
          <label className="flex items-center gap-2 text-xs cursor-pointer py-1.5">
            <input
              type="checkbox"
              className="h-5 w-5 accent-primary"
              checked={reviewAllSelected}
              onChange={toggleReviewSelectAll}
              data-testid="review-select-all"
            />
            Seleccionar todos ({filteredReview.length})
          </label>
          <Button
            size="sm"
            variant="outline"
            onClick={openBulkEdit}
            disabled={reviewSelectedIds.length === 0}
            className="w-full sm:w-auto"
            data-testid="review-bulk-categorize-btn"
          >
            Categorizar ({reviewSelectedIds.length})
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleDiscardAllZero}
            disabled={zeroCount === 0}
            className="w-full sm:w-auto text-red-600 border-red-200 hover:bg-red-50"
            data-testid="review-discard-zero-btn"
          >
            Descartar sin valor ({zeroCount})
          </Button>
          <Button
            size="sm"
            onClick={handleReviewBulkApprove}
            disabled={reviewSelectedIds.length === 0 || reviewBulkApproving}
            data-testid="review-bulk-approve-btn"
            className="w-full sm:w-auto bg-[#0D9E82] hover:bg-[#0B8A70] text-white"
          >
            {reviewBulkApproving
              ? `Aprobando... (${bulkProgress?.done ?? 0}/${bulkProgress?.total ?? reviewSelectedIds.length})`
              : `Aprobar seleccionados (${reviewSelectedIds.length})`}
          </Button>
        </div>
      </div>

      {/* Unified list */}
      {fetchError ? (
        <div className="text-center py-12 text-muted-foreground">
          <WarningCircle size={40} className="mx-auto mb-3 text-red-500" />
          <p className="font-medium text-red-700">No se pudieron cargar los movimientos</p>
          <p className="text-xs mt-1">Ocurrió un error al conectar con el servidor</p>
          {onRetry && (
            <Button size="sm" variant="outline" className="mt-4" onClick={onRetry}>
              Reintentar
            </Button>
          )}
        </div>
      ) : sortedReview.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <CheckCircle size={40} className="mx-auto mb-3 text-emerald-500" />
          <p className="font-medium">No hay transacciones por revisar</p>
          <p className="text-xs mt-1">Las nuevas transacciones aparecerán aquí</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-100">
          {sortedReview.map((item) => {
            const zero = isZeroValue(item);
            const stats = vendorStats[(item.comercio || "").toLowerCase()];
            const catName = budgetCategories[item.suggested_category]?.name || item.suggested_category || "—";
            const originLabel = item.source === "gmail" ? "Gmail"
              : item.source === "statement" ? "Estado cuenta"
              : item.source === "manual" ? "Manual"
              : (item.source_label || item.source || "—");
            return (
              <div
                key={item.id}
                className="flex items-center gap-3 px-3 py-2.5 border-b border-slate-100 hover:bg-slate-50 transition-colors"
                data-testid={`review-item-${item.id}`}
              >
                <label className="flex items-center justify-center p-2 -m-2 shrink-0 cursor-pointer" aria-label="Seleccionar movimiento">
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-[#0D9E82] shrink-0"
                    checked={reviewSelectedIds.includes(item.id)}
                    onChange={() => toggleReviewSelect(item.id)}
                    data-testid={`review-check-${item.id}`}
                  />
                </label>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate" data-testid={`review-comercio-${item.id}`}>
                    {displayName(item)}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs text-slate-400">{formatDate(item.date)}</span>
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200" data-testid={`review-source-${item.id}`}>
                      {originLabel}
                    </span>
                    {zero && (
                      <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200" data-testid={`review-zero-${item.id}`}>
                        Sin valor
                      </Badge>
                    )}
                    {stats && stats.found && stats.times_used > 0 && (
                      <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200" data-testid={`review-badge-recurrente-${item.id}`}>
                        Conocido ({stats.times_used})
                      </Badge>
                    )}
                    <span className="text-xs text-slate-400">· {catName}</span>
                  </div>
                </div>
                <span className={`text-sm font-semibold shrink-0 ${item.tipo === "income" || item.tipo === "ingreso" ? "text-emerald-600" : "text-red-600"}`}>
                  {fmtAmount(item.amount)}
                </span>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-10 w-10 shrink-0"
                  onClick={() => openSingleEdit(item)}
                  data-testid={`review-edit-btn-${item.id}`}
                  aria-label="Editar"
                >
                  <Pencil size={16} />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-10 w-10 shrink-0 text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => requestDiscard(item)}
                  data-testid={`review-discard-btn-${item.id}`}
                  aria-label="Descartar"
                >
                  <X size={16} />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <TransactionEditModal
        open={modalMode !== null}
        transaction={modalMode === "single" ? activeItem : null}
        bulkCount={reviewSelectedIds.length}
        onSave={handleSave}
        onClose={closeModal}
      />

      <AlertDialog open={discardTarget !== null} onOpenChange={(open) => { if (!open) setDiscardTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Descartar este movimiento?</AlertDialogTitle>
            <AlertDialogDescription>
              No podrás deshacer esta acción.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDiscard}
              className="bg-red-600 hover:bg-red-700 text-white"
              data-testid="confirm-discard-btn"
            >
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
