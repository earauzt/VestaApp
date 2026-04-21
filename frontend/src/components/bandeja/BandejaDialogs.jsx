import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog";
import { SpinnerGap, CheckCircle, XCircle, GoogleLogo } from "@phosphor-icons/react";

export function BulkActionDialog({
  open, onOpenChange,
  selectedCount,
  bulkAction, setBulkAction,
  bulkCategory, setBulkCategory,
  bulkSubcategory, setBulkSubcategory,
  PERSONAL_CATEGORIES,
  handleBulkAction, loading,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Acción en Lote</DialogTitle>
          <DialogDescription>Procesar {selectedCount} transacciones seleccionadas</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label>Acción</Label>
            <Select value={bulkAction} onValueChange={setBulkAction}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="z-[250]">
                <SelectItem value="approve">Aprobar todas</SelectItem>
                <SelectItem value="reject">Rechazar todas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {bulkAction === "approve" && (
            <>
              <div>
                <Label>Categoría (opcional)</Label>
                <Select value={bulkCategory || "keep"} onValueChange={(v) => { setBulkCategory(v === "keep" ? "" : v); setBulkSubcategory(""); }}>
                  <SelectTrigger><SelectValue placeholder="Mantener categoría actual" /></SelectTrigger>
                  <SelectContent className="z-[250]">
                    <SelectItem value="keep">Mantener actual</SelectItem>
                    {Object.entries(PERSONAL_CATEGORIES).map(([key, cat]) => (
                      <SelectItem key={key} value={key}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {bulkCategory && PERSONAL_CATEGORIES[bulkCategory]?.subcategories && (
                <div>
                  <Label>Subcategoría</Label>
                  <Select value={bulkSubcategory || "none"} onValueChange={(v) => setBulkSubcategory(v === "none" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar subcategoría" /></SelectTrigger>
                    <SelectContent className="z-[250]">
                      <SelectItem value="none">Sin subcategoría</SelectItem>
                      {PERSONAL_CATEGORIES[bulkCategory].subcategories.map(sub => (
                        <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleBulkAction} disabled={loading}>
            {loading ? <SpinnerGap className="animate-spin mr-2" size={16} /> : null}
            Procesar {selectedCount} transacciones
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function GmailConsentDialog({ open, onOpenChange, handleConnectGmail, gmailConnecting }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">¿Qué va a leer Vesta de tu correo?</DialogTitle>
          <DialogDescription>Solo accedemos a emails de remitentes financieros específicos</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="flex items-start gap-3 p-3 rounded-md bg-emerald-50 border border-emerald-100">
            <CheckCircle size={20} className="text-emerald-600 shrink-0 mt-0.5" weight="fill" />
            <p className="text-sm">Emails de consumo de tus bancos (Diners, PacifiCard, Pacifico, Pichincha, Bolivariano)</p>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-md bg-emerald-50 border border-emerald-100">
            <CheckCircle size={20} className="text-emerald-600 shrink-0 mt-0.5" weight="fill" />
            <p className="text-sm">Facturas electrónicas y estados de cuenta en PDF</p>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-md bg-red-50 border border-red-100">
            <XCircle size={20} className="text-red-500 shrink-0 mt-0.5" weight="fill" />
            <p className="text-sm">Emails personales o de otros remitentes — nunca los leemos</p>
          </div>
          <p className="text-xs text-muted-foreground pt-2">
            Vesta solo lee emails de remitentes financieros. Puedes desconectar tu cuenta en cualquier momento.
          </p>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={() => { onOpenChange(false); handleConnectGmail(); }}
            disabled={gmailConnecting}
            className="gap-2"
            data-testid="gmail-consent-confirm-btn"
          >
            {gmailConnecting ? <><SpinnerGap size={16} className="animate-spin" /> Conectando...</> : <><GoogleLogo size={18} weight="bold" /> Entendido, conectar</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
