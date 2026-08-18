import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Switch } from "../ui/switch";
import { PERSONAL_CATEGORIES, SRI_CATEGORIES, ENTITY_TAGS } from "../../constants/categories";

/**
 * Modal unificado para editar/recategorizar transacciones.
 * Campos: Categoría + Subcategoría (PERSONAL_CATEGORIES), Categoría SRI + Subcategoría SRI (SRI_CATEGORIES),
 * Establecimiento, Uso empresarial, Beneficiario, Aplica IVA.
 *
 * Props:
 *   open: bool
 *   transaction: objeto individual (modo single) o null (modo bulk)
 *   bulkCount: number (solo en modo bulk)
 *   onSave(updatedData): en single recibe los campos editables; en bulk recibe {category, subcategory}
 *   onClose()
 */
export default function TransactionEditModal({ open, transaction, bulkCount = 0, onSave, onClose }) {
  const isBulk = !transaction;
  const [form, setForm] = useState({
    category: "",
    subcategory: "",
    entity_tag_key: "",
    sri_category: "",
    sri_subcategory: "",
    establishment: "",
    is_business_use: false,
    beneficiario: "",
    applies_iva: false,
  });

  useEffect(() => {
    if (transaction) {
      setForm({
        category: transaction.category || "",
        subcategory: transaction.subcategory || "",
        entity_tag_key: transaction.entity_tag_key || "",
        sri_category: transaction.sri_category || "",
        sri_subcategory: transaction.sri_subcategory || "",
        establishment: transaction.establishment || transaction.comercio || "",
        is_business_use: !!transaction.is_business_use,
        beneficiario: transaction.beneficiario || "",
        applies_iva: !!transaction.applies_iva,
      });
    } else if (open) {
      setForm({
        category: "", subcategory: "", entity_tag_key: "", sri_category: "", sri_subcategory: "",
        establishment: "", is_business_use: false, beneficiario: "", applies_iva: false,
      });
    }
  }, [transaction, open]);

  const handleSave = () => {
    if (isBulk) {
      onSave({
        category: form.category,
        subcategory: form.subcategory,
        ...(form.entity_tag_key ? { entity_tag_key: form.entity_tag_key } : {}),
      });
    } else {
      onSave(form);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-[520px] overflow-y-auto max-h-[90vh]" data-testid="transaction-edit-modal">
        <DialogHeader>
          <DialogTitle>{isBulk ? `Categorizar ${bulkCount} transacciones` : "Editar transacción"}</DialogTitle>
          <DialogDescription>
            {isBulk
              ? "Se aplicará la categoría a todas las seleccionadas."
              : "Actualiza la categorización y los campos fiscales de esta transacción."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Categoría</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v, subcategory: "" })}>
                <SelectTrigger data-testid="tem-category-select"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent className="z-[250]">
                  {Object.entries(PERSONAL_CATEGORIES).map(([k, c]) => (
                    <SelectItem key={k} value={k}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Subcategoría</Label>
              <Select value={form.subcategory} onValueChange={(v) => setForm({ ...form, subcategory: v })} disabled={!form.category}>
                <SelectTrigger data-testid="tem-subcategory-select"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent className="z-[250]">
                  {form.category && PERSONAL_CATEGORIES[form.category]?.subcategories?.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>¿De quién es este gasto?</Label>
            <Select value={form.entity_tag_key} onValueChange={(v) => setForm({ ...form, entity_tag_key: v })}>
              <SelectTrigger data-testid="tem-entity-tag-select"><SelectValue placeholder="Sin asignar" /></SelectTrigger>
              <SelectContent className="z-[250]">
                {ENTITY_TAGS.map((tag) => (
                  <SelectItem key={tag.key} value={tag.key}>{tag.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!isBulk && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Categoría SRI</Label>
                  <Select value={form.sri_category} onValueChange={(v) => setForm({ ...form, sri_category: v, sri_subcategory: "" })}>
                    <SelectTrigger data-testid="tem-sri-category-select"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent className="z-[250]">
                      {Object.entries(SRI_CATEGORIES).map(([k, c]) => (
                        <SelectItem key={k} value={k}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Subcategoría SRI</Label>
                  <Select value={form.sri_subcategory} onValueChange={(v) => setForm({ ...form, sri_subcategory: v })} disabled={!form.sri_category}>
                    <SelectTrigger data-testid="tem-sri-subcategory-select"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent className="z-[250]">
                      {form.sri_category && SRI_CATEGORIES[form.sri_category]?.subcategories?.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Establecimiento</Label>
                <Input
                  value={form.establishment}
                  onChange={(e) => setForm({ ...form, establishment: e.target.value })}
                  placeholder="Comercio o emisor"
                  data-testid="tem-establishment-input"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Beneficiario</Label>
                <Input
                  value={form.beneficiario}
                  onChange={(e) => setForm({ ...form, beneficiario: e.target.value })}
                  placeholder="Opcional"
                  data-testid="tem-beneficiario-input"
                />
              </div>

              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <div>
                  <Label className="text-sm">Uso empresarial</Label>
                  <p className="text-xs text-muted-foreground">Marcar si aplica deducción empresarial</p>
                </div>
                <Switch
                  checked={form.is_business_use}
                  onCheckedChange={(v) => setForm({ ...form, is_business_use: v })}
                  data-testid="tem-is-business-switch"
                />
              </div>

              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <div>
                  <Label className="text-sm">Aplica IVA</Label>
                  <p className="text-xs text-muted-foreground">Marcar si la factura incluye IVA</p>
                </div>
                <Switch
                  checked={form.applies_iva}
                  onCheckedChange={(v) => setForm({ ...form, applies_iva: v })}
                  data-testid="tem-applies-iva-switch"
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter className="sticky bottom-0 bg-white pt-3 border-t border-slate-200 mt-2">
          <Button variant="outline" onClick={onClose} data-testid="tem-cancel-btn">Cancelar</Button>
          <Button onClick={handleSave} disabled={!form.category} data-testid="tem-save-btn" className="bg-primary hover:bg-primary/90 text-white">
            {isBulk ? `Aplicar a ${bulkCount}` : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
