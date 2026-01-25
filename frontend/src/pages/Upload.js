import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog";
import { toast } from "sonner";
import { 
  Envelope, 
  Camera, 
  FileXls,
  CloudArrowUp,
  SpinnerGap,
  CheckCircle,
  Receipt,
  X,
  Airplane,
  Warning,
  Images
} from "@phosphor-icons/react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Upload() {
  const { getAuthHeaders } = useAuth();
  const [activeTab, setActiveTab] = useState("email");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  // Email state
  const [emailContent, setEmailContent] = useState("");

  // Multiple files upload state
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [dragActive, setDragActive] = useState(false);

  // International transaction popup
  const [showInternationalPopup, setShowInternationalPopup] = useState(false);
  const [pendingTransaction, setPendingTransaction] = useState(null);

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    if (!emailContent.trim()) {
      toast.error("Ingresa el contenido del email");
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("email_content", emailContent);

      const response = await axios.post(`${API}/process/email`, formData, {
        headers: { ...getAuthHeaders(), "Content-Type": "multipart/form-data" }
      });

      // Check if transaction might be international
      if (response.data.transaction) {
        const t = response.data.transaction;
        const isUSA = t.establishment?.toLowerCase().includes('usa') || 
                      t.establishment?.toLowerCase().includes('united states') ||
                      t.description?.toLowerCase().includes('usa') ||
                      t.description?.toLowerCase().includes('international');
        
        if (isUSA) {
          setPendingTransaction(response.data.transaction);
          setShowInternationalPopup(true);
        }
      }

      setResult(response.data);
      toast.success("Email procesado exitosamente");
      setEmailContent("");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error procesando email");
    } finally {
      setLoading(false);
    }
  };

  const handleMultipleReceiptsUpload = async () => {
    if (selectedFiles.length === 0) {
      toast.error("Selecciona al menos una imagen");
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const formData = new FormData();
      selectedFiles.forEach(file => {
        formData.append("files", file);
      });

      const response = await axios.post(`${API}/process/receipts-multiple`, formData, {
        headers: { ...getAuthHeaders(), "Content-Type": "multipart/form-data" }
      });

      // Check for international transactions
      const internationalTx = response.data.transactions?.filter(t => t.is_international);
      if (internationalTx?.length > 0) {
        toast.info(`${internationalTx.length} transacción(es) detectada(s) como viaje internacional (no deducible)`);
      }

      setResult(response.data);
      toast.success(`Procesados ${selectedFiles.length} archivos exitosamente`);
      setSelectedFiles([]);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error procesando recibos");
    } finally {
      setLoading(false);
    }
  };

  const handleExcelUpload = async () => {
    const excelFile = selectedFiles.find(f => f.name.endsWith('.xlsx') || f.name.endsWith('.xls'));
    if (!excelFile) {
      toast.error("Selecciona un archivo Excel");
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", excelFile);

      const response = await axios.post(`${API}/process/excel`, formData, {
        headers: { ...getAuthHeaders(), "Content-Type": "multipart/form-data" }
      });

      setResult(response.data);
      toast.success("Excel procesado exitosamente");
      setSelectedFiles([]);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error procesando Excel");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmInternational = async (isInternational) => {
    if (pendingTransaction && isInternational) {
      // Update the transaction to be international
      try {
        await axios.put(
          `${API}/transactions/${pendingTransaction.id}`,
          {
            ...pendingTransaction,
            category: "viajes_internacionales",
            subcategory: "USA",
            is_international: true,
            is_deductible: false,
            payment_source: "internacional"
          },
          { headers: getAuthHeaders() }
        );
        toast.success("Transacción marcada como viaje internacional (no deducible)");
      } catch (error) {
        toast.error("Error actualizando transacción");
      }
    }
    setShowInternationalPopup(false);
    setPendingTransaction(null);
  };

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newFiles = Array.from(e.dataTransfer.files);
      setSelectedFiles(prev => [...prev, ...newFiles]);
    }
  }, []);

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-EC', {
      style: 'currency',
      currency: 'USD'
    }).format(value || 0);
  };

  const uploadTypes = [
    { 
      id: "email", 
      label: "Email", 
      icon: Envelope,
      description: "Pega el contenido de emails de consumo de tu tarjeta PacifiCard"
    },
    { 
      id: "receipt", 
      label: "Recibos", 
      icon: Images,
      description: "Sube múltiples fotos de recibos o facturas para procesamiento OCR con AI"
    },
    { 
      id: "excel", 
      label: "Excel", 
      icon: FileXls,
      description: "Carga tu archivo Excel de planificación financiera"
    }
  ];

  return (
    <div className="space-y-6" data-testid="upload-page">
      {/* International Transaction Popup */}
      <Dialog open={showInternationalPopup} onOpenChange={setShowInternationalPopup}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Airplane size={24} className="text-amber-500" />
              ¿Es un gasto internacional?
            </DialogTitle>
            <DialogDescription>
              Este gasto parece ser de Estados Unidos u otro país.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <Warning size={24} className="text-amber-500 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  Los gastos de viajes internacionales NO son deducibles
                </p>
                <p className="text-amber-700 dark:text-amber-300 mt-1">
                  Según la ley tributaria ecuatoriana, estos gastos no aplican para deducciones del SRI.
                </p>
              </div>
            </div>
            {pendingTransaction && (
              <div className="mt-4 p-3 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground">Transacción:</p>
                <p className="font-medium">{pendingTransaction.description}</p>
                <p className="text-lg font-mono">{formatCurrency(pendingTransaction.amount)}</p>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => handleConfirmInternational(false)}
            >
              No, es local
            </Button>
            <Button 
              onClick={() => handleConfirmInternational(true)}
              className="bg-amber-500 hover:bg-amber-600"
            >
              Sí, es internacional
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Cargar Datos</h1>
        <p className="text-muted-foreground">
          Procesa emails, múltiples recibos y archivos Excel con AI
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Upload Section */}
        <Card className="bento-card">
          <CardHeader>
            <CardTitle className="text-lg">Selecciona el tipo de datos</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3 mb-6">
                {uploadTypes.map((type) => (
                  <TabsTrigger 
                    key={type.id} 
                    value={type.id}
                    className="gap-2"
                    data-testid={`tab-${type.id}`}
                  >
                    <type.icon size={18} />
                    <span className="hidden sm:inline">{type.label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>

              {/* Email Tab */}
              <TabsContent value="email">
                <form onSubmit={handleEmailSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Contenido del email</Label>
                    <p className="text-sm text-muted-foreground">
                      Pega aquí el contenido del email de consumo de tu tarjeta PacifiCard
                    </p>
                    <Textarea
                      placeholder="Estimado cliente, Por su seguridad, Banco del Pacífico S.A. le comunica que ha realizado una transacción..."
                      value={emailContent}
                      onChange={(e) => setEmailContent(e.target.value)}
                      rows={8}
                      className="resize-none"
                      data-testid="email-content"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    disabled={loading} 
                    className="w-full gap-2"
                    data-testid="process-email-btn"
                  >
                    {loading ? (
                      <SpinnerGap size={18} className="animate-spin" />
                    ) : (
                      <CloudArrowUp size={18} />
                    )}
                    {loading ? "Procesando..." : "Procesar Email"}
                  </Button>
                </form>
              </TabsContent>

              {/* Receipts Tab - Multiple Files */}
              <TabsContent value="receipt">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Fotos de recibos o facturas</Label>
                    <p className="text-sm text-muted-foreground">
                      Puedes subir <strong>múltiples archivos</strong> al mismo tiempo
                    </p>
                  </div>
                  
                  <div
                    className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
                      dragActive 
                        ? "border-primary bg-primary/5" 
                        : "border-muted-foreground/25 hover:border-primary/50"
                    }`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    data-testid="receipt-dropzone"
                  >
                    <Images size={40} className="mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground mb-2">
                      Arrastra múltiples imágenes aquí o
                    </p>
                    <label>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleFileSelect}
                        data-testid="receipt-input"
                      />
                      <Button variant="outline" asChild>
                        <span>Seleccionar archivos</span>
                      </Button>
                    </label>
                  </div>

                  {/* Selected Files List */}
                  {selectedFiles.length > 0 && (
                    <div className="space-y-2">
                      <Label>{selectedFiles.length} archivo(s) seleccionado(s)</Label>
                      <div className="max-h-[200px] overflow-y-auto space-y-2">
                        <AnimatePresence>
                          {selectedFiles.map((file, index) => (
                            <motion.div
                              key={`${file.name}-${index}`}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: 20 }}
                              className="flex items-center justify-between p-3 rounded-lg bg-muted"
                            >
                              <div className="flex items-center gap-3">
                                <Camera size={20} className="text-muted-foreground" />
                                <div>
                                  <p className="text-sm font-medium truncate max-w-[200px]">{file.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {(file.size / 1024).toFixed(1)} KB
                                  </p>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeFile(index)}
                              >
                                <X size={16} />
                              </Button>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>
                    </div>
                  )}

                  <Button 
                    onClick={handleMultipleReceiptsUpload}
                    disabled={loading || selectedFiles.length === 0}
                    className="w-full gap-2"
                    data-testid="process-receipt-btn"
                  >
                    {loading ? (
                      <SpinnerGap size={18} className="animate-spin" />
                    ) : (
                      <CloudArrowUp size={18} />
                    )}
                    {loading ? "Procesando con AI..." : `Procesar ${selectedFiles.length} archivo(s)`}
                  </Button>
                </div>
              </TabsContent>

              {/* Excel Tab */}
              <TabsContent value="excel">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Archivo Excel de planificación</Label>
                    <p className="text-sm text-muted-foreground">
                      Sube tu archivo Excel con el presupuesto familiar
                    </p>
                  </div>
                  
                  <div
                    className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
                      dragActive 
                        ? "border-primary bg-primary/5" 
                        : "border-muted-foreground/25 hover:border-primary/50"
                    }`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    data-testid="excel-dropzone"
                  >
                    {selectedFiles.some(f => f.name.endsWith('.xlsx') || f.name.endsWith('.xls')) ? (
                      <div className="space-y-2">
                        <CheckCircle size={40} className="mx-auto text-emerald-500" />
                        <p className="font-medium">
                          {selectedFiles.find(f => f.name.endsWith('.xlsx') || f.name.endsWith('.xls'))?.name}
                        </p>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setSelectedFiles(prev => prev.filter(f => !f.name.endsWith('.xlsx') && !f.name.endsWith('.xls')))}
                        >
                          Cambiar archivo
                        </Button>
                      </div>
                    ) : (
                      <>
                        <FileXls size={40} className="mx-auto text-muted-foreground mb-3" />
                        <p className="text-muted-foreground mb-2">
                          Arrastra tu archivo Excel aquí o
                        </p>
                        <label>
                          <input
                            type="file"
                            accept=".xlsx,.xls"
                            className="hidden"
                            onChange={handleFileSelect}
                            data-testid="excel-input"
                          />
                          <Button variant="outline" asChild>
                            <span>Seleccionar archivo</span>
                          </Button>
                        </label>
                      </>
                    )}
                  </div>

                  <Button 
                    onClick={handleExcelUpload}
                    disabled={loading || !selectedFiles.some(f => f.name.endsWith('.xlsx') || f.name.endsWith('.xls'))}
                    className="w-full gap-2"
                    data-testid="process-excel-btn"
                  >
                    {loading ? (
                      <SpinnerGap size={18} className="animate-spin" />
                    ) : (
                      <CloudArrowUp size={18} />
                    )}
                    {loading ? "Procesando..." : "Procesar Excel"}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Results Section */}
        <Card className="bento-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Receipt size={20} />
              Resultado del procesamiento
            </CardTitle>
            <CardDescription>
              Las transacciones procesadas aparecerán aquí
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <SpinnerGap size={48} className="animate-spin mb-4" />
                <p>Procesando con AI...</p>
                <p className="text-sm">Esto puede tomar unos segundos</p>
              </div>
            ) : result ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle size={24} className="text-emerald-500" />
                  <span className="font-medium">{result.message}</span>
                </div>

                {result.transaction && (
                  <TransactionCard transaction={result.transaction} formatCurrency={formatCurrency} />
                )}

                {result.transactions && result.transactions.length > 0 && (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {result.transactions.map((t, i) => (
                      <TransactionCard key={i} transaction={t} formatCurrency={formatCurrency} />
                    ))}
                  </div>
                )}

                {result.errors && result.errors.length > 0 && (
                  <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                    <p className="text-sm font-medium text-red-800 dark:text-red-200">Errores:</p>
                    {result.errors.map((err, i) => (
                      <p key={i} className="text-sm text-red-600 dark:text-red-300">
                        {err.file}: {err.error}
                      </p>
                    ))}
                  </div>
                )}

                {result.budget && (
                  <div className="p-4 rounded-lg bg-muted space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Ingresos totales:</span>
                      <span className="font-mono font-semibold text-emerald-600">
                        {formatCurrency(result.budget.total_income)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Gastos presupuestados:</span>
                      <span className="font-mono font-semibold text-red-600">
                        {formatCurrency(result.budget.total_expenses)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Ítems del presupuesto:</span>
                      <span>{result.budget.items?.length || 0}</span>
                    </div>
                  </div>
                )}
              </motion.div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <CloudArrowUp size={48} className="mb-4 opacity-50" />
                <p>Los resultados aparecerán aquí</p>
                <p className="text-sm">Selecciona un tipo de dato y procésalo</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Instructions */}
      <Card className="bento-card">
        <CardHeader>
          <CardTitle className="text-lg">Instrucciones</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-6">
            {uploadTypes.map((type, i) => (
              <motion.div
                key={type.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex gap-4"
              >
                <div className="p-3 rounded-xl bg-primary/10 text-primary h-fit">
                  <type.icon size={24} />
                </div>
                <div>
                  <h3 className="font-medium mb-1">{type.label}</h3>
                  <p className="text-sm text-muted-foreground">{type.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
          
          {/* International Warning */}
          <div className="mt-6 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
            <div className="flex items-start gap-3">
              <Airplane size={24} className="text-amber-500 shrink-0" />
              <div>
                <h4 className="font-medium text-amber-800 dark:text-amber-200">Gastos Internacionales</h4>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  Los gastos realizados en el extranjero (USA, Europa, etc.) serán detectados automáticamente 
                  y marcados como "Viajes Internacionales" (no deducibles según SRI Ecuador).
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Transaction Card Component
function TransactionCard({ transaction, formatCurrency }) {
  return (
    <div className="p-4 rounded-lg bg-muted space-y-2">
      <div className="flex justify-between items-start">
        <div>
          <p className="font-medium">{transaction.description}</p>
          {transaction.establishment && (
            <p className="text-sm text-muted-foreground">{transaction.establishment}</p>
          )}
        </div>
        <span className="font-mono font-semibold">
          {formatCurrency(transaction.amount)}
        </span>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <Badge>{transaction.category}</Badge>
        {transaction.is_international && (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
            <Airplane size={14} className="mr-1" />
            Internacional
          </Badge>
        )}
        {transaction.is_deductible === false && (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">
            No deducible
          </Badge>
        )}
        {transaction.source_file && (
          <span className="text-xs text-muted-foreground">
            📎 {transaction.source_file}
          </span>
        )}
      </div>
    </div>
  );
}
