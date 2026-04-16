import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import {
  CloudArrowUp,
  SpinnerGap,
  CreditCard,
  Bank,
  Eye,
  Receipt
} from "@phosphor-icons/react";

const BANKS = [
  { value: "auto", label: "Detectar automaticamente", icon: null },
  { value: "diners", label: "Diners Club", icon: CreditCard, type: "credit_card" },
  { value: "pichincha", label: "Banco Pichincha", icon: CreditCard, type: "credit_card" },
  { value: "pacificard", label: "Pacificard", icon: CreditCard, type: "credit_card" },
  { value: "apple_card", label: "Apple Card", icon: CreditCard, type: "credit_card" },
  { value: "banco_pacifico", label: "Banco Pacifico", icon: Bank, type: "bank_account" },
  { value: "bolivariano", label: "Banco Bolivariano", icon: Bank, type: "bank_account" }
];

export { BANKS };

export function ReconciliationHeader({
  selectedBank,
  onBankChange,
  onFileUpload,
  uploading,
  onLoadHistory,
  loadingHistory
}) {
  return (
    <Card className="bento-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt size={24} className="text-primary" />
          Reconciliar Estado de Cuenta
        </CardTitle>
        <CardDescription>
          Sube un estado de cuenta de tarjeta de credito o banco para reconciliar con tus transacciones existentes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Banco / Tarjeta</label>
            <Select value={selectedBank} onValueChange={onBankChange}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar banco" />
              </SelectTrigger>
              <SelectContent>
                {BANKS.map(bank => (
                  <SelectItem key={bank.value} value={bank.value}>
                    <span className="flex items-center gap-2">
                      {bank.icon && <bank.icon size={16} />}
                      {bank.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Archivo</label>
            <div className="relative">
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={onFileUpload}
                disabled={uploading}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                data-testid="statement-upload"
              />
              <Button variant="outline" className="w-full justify-center gap-2" disabled={uploading}>
                {uploading ? (
                  <>
                    <SpinnerGap size={18} className="animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <CloudArrowUp size={18} />
                    Subir Estado de Cuenta
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex flex-wrap items-center gap-2">
            <span>Bancos soportados:</span>
            <Badge variant="outline" className="gap-1"><CreditCard size={12} /> Diners</Badge>
            <Badge variant="outline" className="gap-1"><CreditCard size={12} /> Pichincha</Badge>
            <Badge variant="outline" className="gap-1"><CreditCard size={12} /> Pacificard</Badge>
            <Badge variant="outline" className="gap-1"><CreditCard size={12} /> Apple Card</Badge>
            <Badge variant="outline" className="gap-1"><Bank size={12} /> Pacifico</Badge>
            <Badge variant="outline" className="gap-1"><Bank size={12} /> Bolivariano</Badge>
          </div>
          <Button variant="ghost" size="sm" onClick={onLoadHistory} disabled={loadingHistory}>
            {loadingHistory ? (
              <SpinnerGap size={16} className="animate-spin mr-2" />
            ) : (
              <Eye size={16} className="mr-2" />
            )}
            Ver historial
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
