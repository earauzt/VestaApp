import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { CheckCircle } from "@phosphor-icons/react";

export default function TabPorRevisar({
  budgetCategories,
  PERSONAL_CATEGORIES,
  reviewFilter, setReviewFilter,
  filteredReview,
  reviewSelectedIds, toggleReviewSelect,
  reviewAllSelected, toggleReviewSelectAll,
  handleReviewBulkApprove, reviewBulkApproving,
  rowCategory, setRowCategory,
  rowSubcategory, setRowSubcategory,
  vendorStats,
}) {
  return (
    <div className="space-y-4" data-testid="revisar-tab-content">
      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row gap-3 lg:items-center justify-between pb-2 border-b">
        <div className="flex gap-2 flex-wrap">
          <Select value={reviewFilter.source} onValueChange={(v) => setReviewFilter({ ...reviewFilter, source: v })}>
            <SelectTrigger className="w-[150px] h-9" data-testid="review-source-filter">
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
            <SelectTrigger className="w-[170px] h-9" data-testid="review-category-filter">
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
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary"
              checked={reviewAllSelected}
              onChange={toggleReviewSelectAll}
              data-testid="review-select-all"
            />
            Seleccionar todos ({filteredReview.length})
          </label>
          <Button
            size="sm"
            onClick={handleReviewBulkApprove}
            disabled={reviewSelectedIds.length === 0 || reviewBulkApproving}
            data-testid="review-bulk-approve-btn"
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {reviewBulkApproving ? "Aprobando..." : `Aprobar seleccionados (${reviewSelectedIds.length})`}
          </Button>
        </div>
      </div>

      {/* Unified list */}
      {filteredReview.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <CheckCircle size={40} className="mx-auto mb-3 text-emerald-500" />
          <p className="font-medium">No hay transacciones por revisar</p>
          <p className="text-xs mt-1">Las nuevas transacciones aparecerán aquí</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredReview.map((item) => {
            const selectedCat = rowCategory[item.id] || item.suggested_category;
            const sourceBadgeColor = item.source === "gmail"
              ? "bg-red-50 text-red-700 border-red-200"
              : item.source === "manual"
              ? "bg-slate-50 text-[#0D9E82] border-slate-200"
              : "bg-slate-100 text-[#0D9E82] border-slate-200";
            const stats = vendorStats[(item.comercio || "").toLowerCase()];
            return (
              <div
                key={item.id}
                className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                data-testid={`review-item-${item.id}`}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary shrink-0"
                  checked={reviewSelectedIds.includes(item.id)}
                  onChange={() => toggleReviewSelect(item.id)}
                  data-testid={`review-check-${item.id}`}
                />
                <div className="flex-1 min-w-0 flex items-center gap-3">
                  <span className="text-xs text-muted-foreground shrink-0 w-20">{item.date}</span>
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <p className="font-medium text-sm truncate" data-testid={`review-comercio-${item.id}`}>{item.comercio}</p>
                    {stats && stats.found && stats.times_used > 0 ? (
                      <Badge
                        variant="outline"
                        className="text-[10px] shrink-0 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400"
                        data-testid={`review-badge-recurrente-${item.id}`}
                      >
                        Recurrente ({stats.times_used})
                      </Badge>
                    ) : stats ? (
                      <Badge
                        variant="outline"
                        className="text-[10px] shrink-0 bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300"
                        data-testid={`review-badge-nuevo-${item.id}`}
                      >
                        Nuevo
                      </Badge>
                    ) : null}
                  </div>
                  <span className="font-mono font-semibold text-sm shrink-0">${(item.amount || 0).toFixed(2)}</span>
                  <Badge variant="outline" className={`text-[10px] shrink-0 ${sourceBadgeColor}`} data-testid={`review-source-${item.id}`}>
                    {item.source_label}
                  </Badge>
                </div>
                <Select
                  value={selectedCat}
                  onValueChange={(v) => {
                    setRowCategory(prev => ({ ...prev, [item.id]: v }));
                    setRowSubcategory(prev => ({ ...prev, [item.id]: "" }));
                  }}
                >
                  <SelectTrigger className="w-[160px] h-9 shrink-0" data-testid={`review-cat-${item.id}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[250]">
                    {Object.entries(budgetCategories).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.name || k}</SelectItem>
                    ))}
                    {!budgetCategories[selectedCat] && (
                      <SelectItem value={selectedCat}>{selectedCat}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <Select
                  value={rowSubcategory[item.id] || ""}
                  onValueChange={(v) => setRowSubcategory(prev => ({ ...prev, [item.id]: v === "__none__" ? "" : v }))}
                  disabled={!PERSONAL_CATEGORIES[selectedCat]?.subcategories}
                >
                  <SelectTrigger className="w-[150px] h-9 shrink-0" data-testid={`review-subcat-${item.id}`}>
                    <SelectValue placeholder="Subcategoría" />
                  </SelectTrigger>
                  <SelectContent className="z-[250]">
                    <SelectItem value="__none__">Sin subcategoría</SelectItem>
                    {PERSONAL_CATEGORIES[selectedCat]?.subcategories?.map((sub) => (
                      <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
