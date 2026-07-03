import { motion } from "framer-motion";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import {
  CloudArrowUp, SpinnerGap, CheckCircle, Receipt, X, Images, FileXls,
  CreditCard, EnvelopeSimple, ArrowsClockwise, GoogleLogo, ArrowRight,
} from "@phosphor-icons/react";
import ReconciliacionEstados from "../ReconciliacionEstados";

export default function TabImportar({
  // Upload state
  selectedFiles,
  dragActive,
  loading, result, processingStatus,
  // Handlers
  handleDrag, handleDrop, handleFileSelect, handleMultipleFilesUpload, handleExcelUpload, removeFile,
  isBankStatement, formatCurrency,
  // Note: processing routes internally by file type (isExcel/isStatement); a single
  // button triggers both flows sequentially so the user doesn't need to understand routing.
  // Navigation
  setActiveTab, fetchPendingData,
  // Gmail
  gmailStatus, gmailSummary, gmailSyncing, gmailConnecting,
  setShowGmailConsentModal, handleGmailSync,
}) {
  return (
    <>
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Upload Area */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Screenshots, Recibos o PDFs</Label>
            <p className="text-sm text-muted-foreground">Sube múltiples archivos para procesarlos con AI (OCR)</p>
          </div>

          <div
            className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
              dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            data-testid="dropzone"
          >
            <Images size={40} className="mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground mb-2">Arrastra archivos aquí o</p>
            <label>
              <input type="file" accept="image/*,.pdf,application/pdf,.xlsx,.xls" multiple className="hidden" onChange={handleFileSelect} />
              <Button variant="outline" asChild><span>Seleccionar archivos</span></Button>
            </label>
            <p className="text-xs text-muted-foreground mt-2">JPG, PNG, PDF, Excel</p>
          </div>

          {selectedFiles.length > 0 && (
            <div className="space-y-2">
              <Label>{selectedFiles.length} archivo(s)</Label>
              <div className="max-h-[200px] overflow-y-auto space-y-2">
                {selectedFiles.map((file, index) => {
                  const isStatement = isBankStatement(file);
                  const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
                  return (
                    <div key={`${file.name}-${file.size}`} className={`flex items-center justify-between p-3 rounded-lg ${isStatement ? 'bg-primary/10 border border-primary/20' : 'bg-muted'}`}>
                      <div className="flex items-center gap-3">
                        {isExcel ? (
                          <FileXls size={20} className="text-emerald-600" />
                        ) : isStatement ? (
                          <CreditCard size={20} className="text-primary" />
                        ) : (
                          <Receipt size={20} className="text-muted-foreground" />
                        )}
                        <div>
                          <span className="text-sm truncate max-w-[180px] block">{file.name}</span>
                          {isStatement && <span className="text-xs text-primary">Estado de cuenta detectado</span>}
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removeFile(index)}>
                        <X size={16} />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={async () => {
                const hasExcel = selectedFiles.some(f => f.name.endsWith('.xlsx') || f.name.endsWith('.xls'));
                const hasOther = selectedFiles.some(f => !f.name.endsWith('.xlsx') && !f.name.endsWith('.xls'));
                // Route internally by file type so the user doesn't have to pick the right button.
                if (hasOther) await handleMultipleFilesUpload();
                if (hasExcel) await handleExcelUpload();
              }}
              disabled={loading || selectedFiles.length === 0}
              className="flex-1 gap-2"
            >
              {loading ? <SpinnerGap size={18} className="animate-spin" /> : <CloudArrowUp size={18} />}
              Procesar {selectedFiles.length} archivo{selectedFiles.length !== 1 ? "s" : ""}
            </Button>
          </div>
        </div>

        {/* Results */}
        <div className="space-y-4">
          <Label>Resultado del procesamiento</Label>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <SpinnerGap size={48} className="animate-spin mb-4" />
              <p>{processingStatus || "Procesando con AI..."}</p>
            </div>
          ) : result ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div className="flex items-center gap-2">
                <CheckCircle size={24} className="text-emerald-500" />
                <span className="font-medium">{result.message}</span>
              </div>

              {result.card_info && (
                <div className="p-4 rounded-md bg-slate-50 border border-slate-200">
                  <div className="flex items-center gap-2 mb-3">
                    <CreditCard size={20} className="text-[#0D9E82]" />
                    <span className="font-semibold text-slate-900">Tarjeta Actualizada</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Banco/Tarjeta</p>
                      <p className="font-medium">{result.card_info.name || result.card_info.bank}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Saldo Actual</p>
                      <p className="font-bold text-lg">{formatCurrency(result.card_info.current_balance)}</p>
                    </div>
                    {result.card_info.minimum_payment > 0 && (
                      <div>
                        <p className="text-muted-foreground">Pago Mínimo</p>
                        <p className="font-medium">{formatCurrency(result.card_info.minimum_payment)}</p>
                      </div>
                    )}
                    {result.card_info.due_date && (
                      <div>
                        <p className="text-muted-foreground">Fecha de Pago</p>
                        <p className="font-medium">{result.card_info.due_date}</p>
                      </div>
                    )}
                    {result.card_info.credit_limit > 0 && (
                      <div>
                        <p className="text-muted-foreground">Límite</p>
                        <p className="font-medium">{formatCurrency(result.card_info.credit_limit)}</p>
                      </div>
                    )}
                    {result.card_info.apr > 0 && (
                      <div>
                        <p className="text-muted-foreground">APR</p>
                        <p className="font-medium">{result.card_info.apr}%</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {result.transactions?.length > 0 && (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  <p className="text-sm text-muted-foreground">{result.transactions.length} transacciones extraídas:</p>
                  {result.transactions.map((t) => (
                    <div key={t.id || `${t.description}-${t.amount}`} className="p-3 rounded-lg bg-muted">
                      <div className="flex justify-between">
                        <p className="font-medium truncate">{t.description || t.establishment}</p>
                        <span className="font-mono">{formatCurrency(t.amount)}</span>
                      </div>
                      <div className="flex gap-2 mt-1">
                        <Badge className="text-xs">{t.category}</Badge>
                        {t.date && <span className="text-xs text-muted-foreground">{t.date}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <Button onClick={() => { setActiveTab("revisar"); fetchPendingData(); }} className="w-full gap-2">
                <ArrowRight size={18} />
                Ir a Validar
              </Button>
            </motion.div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <CloudArrowUp size={48} className="mb-4 opacity-50" />
              <p>Los resultados aparecerán aquí</p>
              <p className="text-xs mt-2">Soporta: recibos, facturas, estados de cuenta</p>
            </div>
          )}
        </div>
      </div>

      {/* Sección: Correo electrónico (Gmail sync) */}
      <div className="mt-6 border rounded-xl p-4 sm:p-6 bg-muted/20" data-testid="gmail-sync-section">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-2 rounded-lg bg-red-50 text-red-500">
            <EnvelopeSimple size={18} weight="duotone" />
          </div>
          <div>
            <h3 className="font-semibold">Correo electrónico</h3>
            <p className="text-xs text-muted-foreground">
              {gmailStatus.connected
                ? `Último sync: ${gmailStatus.last_sync ? new Date(gmailStatus.last_sync).toLocaleString("es-EC") : "Nunca"}`
                : "Conecta Gmail para detectar consumos automáticamente"}
            </p>
          </div>
        </div>
        {!gmailStatus.connected ? (
          <Button onClick={() => setShowGmailConsentModal(true)} className="gap-2" disabled={gmailConnecting} data-testid="gmail-connect-btn-importar">
            {gmailConnecting ? <><SpinnerGap size={16} className="animate-spin" /> Conectando...</> : <><GoogleLogo size={16} weight="bold" /> Conectar Gmail</>}
          </Button>
        ) : (
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
            <div className="flex gap-2 flex-wrap">
              <Badge className="gap-1 bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100" data-testid="gmail-pending-badge">
                Pendientes: {gmailSummary.pendiente || 0}
              </Badge>
              <Badge className="gap-1 bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
                Aprobados: {gmailSummary.aprobado || 0}
              </Badge>
            </div>
            <Button onClick={handleGmailSync} disabled={gmailSyncing} className="gap-2" data-testid="gmail-sync-btn">
              <ArrowsClockwise size={16} className={gmailSyncing ? "animate-spin" : ""} />
              {gmailSyncing ? "Sincronizando..." : "Sincronizar ahora"}
            </Button>
          </div>
        )}
      </div>

      {/* Sección: Estados de cuenta */}
      <div className="mt-6">
        <ReconciliacionEstados />
      </div>
    </>
  );
}
