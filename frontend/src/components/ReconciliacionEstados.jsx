import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Checkbox } from "../components/ui/checkbox";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { 
  CloudArrowUp,
  SpinnerGap,
  CheckCircle,
  XCircle,
  Warning,
  CreditCard,
  Bank,
  ArrowRight,
  LinkSimple,
  Plus,
  X,
  Eye,
  Receipt
} from "@phosphor-icons/react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const BANKS = [
  { value: "auto", label: "Detectar automáticamente", icon: null },
  { value: "diners", label: "Diners Club", icon: CreditCard, type: "credit_card" },
  { value: "pichincha", label: "Banco Pichincha", icon: CreditCard, type: "credit_card" },
  { value: "pacificard", label: "Pacificard", icon: CreditCard, type: "credit_card" },
  { value: "apple_card", label: "Apple Card", icon: CreditCard, type: "credit_card" },
  { value: "banco_pacifico", label: "Banco Pacífico", icon: Bank, type: "bank_account" },
  { value: "bolivariano", label: "Banco Bolivariano", icon: Bank, type: "bank_account" }
];

const CATEGORIES = {
  servicios_basicos: "Servicios Básicos",
  suscripciones: "Suscripciones",
  empleados: "Empleados",
  colegio_actividades: "Colegio y Actividades",
  seguros: "Seguros",
  comida: "Comida",
  restaurantes: "Restaurantes",
  carros: "Carros",
  gastos_libres: "Gastos Libres",
  viajes_entretenimiento: "Viajes y Entretenimiento",
  diferido: "Diferido",
  usa: "USA",
  otros: "Otros"
};

export default function ReconciliacionEstados() {
  const { getAuthHeaders } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [selectedBank, setSelectedBank] = useState("auto");
  const [reconciliationData, setReconciliationData] = useState(null);
  const [selectedItems, setSelectedItems] = useState([]);
  const [confirmingMatches, setConfirmingMatches] = useState(false);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-EC', {
      style: 'currency',
      currency: 'USD'
    }).format(value || 0);
  };

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const response = await axios.get(`${API}/reconciliation/history`, { headers: getAuthHeaders() });
      setHistory(response.data.statements || []);
      setShowHistory(true);
    } catch (error) {
      toast.error("Error al cargar historial");
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setReconciliationData(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("bank_name", selectedBank);

    try {
      const response = await axios.post(
        `${API}/reconciliation/upload-statement`,
        formData,
        {
          headers: {
            ...getAuthHeaders(),
            "Content-Type": "multipart/form-data"
          },
          timeout: 120000 // 2 minutes timeout for large PDFs
        }
      );

      console.log("Reconciliation response:", response.data);
      
      if (response.data.transactions && response.data.transactions.length > 0) {
        setReconciliationData(response.data);
        
        // Pre-select all new transactions for creation
        const newItems = response.data.transactions
          .filter(t => t.status === "new")
          .map(t => t.temp_id);
        setSelectedItems(newItems);

        toast.success(`Estado de cuenta procesado: ${response.data.summary.total} transacciones (${response.data.summary.matched} coinciden, ${response.data.summary.new} nuevas)`);
      } else {
        toast.warning("No se encontraron transacciones en el estado de cuenta. Verifica que el archivo sea legible.");
      }
    } catch (error) {
      console.error("Upload error:", error);
      const errorMsg = error.response?.data?.detail || error.message || "Error al procesar estado de cuenta";
      toast.error(errorMsg);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const toggleSelectItem = (tempId) => {
    setSelectedItems(prev => 
      prev.includes(tempId) 
        ? prev.filter(id => id !== tempId)
        : [...prev, tempId]
    );
  };

  const selectAllNew = () => {
    const newItems = reconciliationData.transactions
      .filter(t => t.status === "new")
      .map(t => t.temp_id);
    setSelectedItems(newItems);
  };

  const handleConfirmReconciliation = async () => {
    if (!reconciliationData) return;

    setConfirmingMatches(true);

    try {
      const confirmedMatches = reconciliationData.transactions.map(t => {
        if (t.status === "matched") {
          return {
            temp_id: t.temp_id,
            action: "match",
            matched_id: t.matched_transaction_id
          };
        } else if (selectedItems.includes(t.temp_id)) {
          return {
            temp_id: t.temp_id,
            action: "create",
            transaction_data: {
              amount: t.amount,
              date: t.date,
              description: t.description,
              establishment: t.establishment,
              category: t.suggested_category || "otros",
              sri_category: t.suggested_sri_category,
              subcategory: t.suggested_subcategory
            },
            category: t.suggested_category,
            sri_category: t.suggested_sri_category,
            subcategory: t.suggested_subcategory
          };
        } else {
          return {
            temp_id: t.temp_id,
            action: "skip"
          };
        }
      });

      const response = await axios.post(
        `${API}/reconciliation/confirm-matches`,
        { statement_id: reconciliationData.statement_id, confirmed_matches: confirmedMatches },
        { headers: getAuthHeaders() }
      );

      toast.success(`Reconciliación completada: ${response.data.created} creadas, ${response.data.matched} vinculadas`);
      setReconciliationData(null);
      setSelectedItems([]);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al confirmar reconciliación");
    } finally {
      setConfirmingMatches(false);
    }
  };

  const getStatusBadge = (status, confidence) => {
    switch (status) {
      case "matched":
        return (
          <Badge className="bg-emerald-100 text-emerald-700 gap-1">
            <CheckCircle size={12} weight="fill" />
            Coincide ({Math.round(confidence * 100)}%)
          </Badge>
        );
      case "new":
        return (
          <Badge className="bg-blue-100 text-blue-700 gap-1">
            <Plus size={12} weight="bold" />
            Nueva
          </Badge>
        );
      case "no_match":
        return (
          <Badge className="bg-amber-100 text-amber-700 gap-1">
            <Warning size={12} weight="fill" />
            Sin coincidencia
          </Badge>
        );
      default:
        return <Badge variant="outline">Desconocido</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card className="bento-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt size={24} className="text-primary" />
            Reconciliar Estado de Cuenta
          </CardTitle>
          <CardDescription>
            Sube un estado de cuenta de tarjeta de crédito o banco para reconciliar con tus transacciones existentes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Banco / Tarjeta</label>
              <Select value={selectedBank} onValueChange={setSelectedBank}>
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
                  onChange={handleFileUpload}
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

          {/* Bank logos hint */}
          <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
            <div className="flex flex-wrap items-center gap-2">
              <span>Bancos soportados:</span>
              <Badge variant="outline" className="gap-1"><CreditCard size={12} /> Diners</Badge>
              <Badge variant="outline" className="gap-1"><CreditCard size={12} /> Pichincha</Badge>
              <Badge variant="outline" className="gap-1"><CreditCard size={12} /> Pacificard</Badge>
              <Badge variant="outline" className="gap-1"><CreditCard size={12} /> Apple Card</Badge>
              <Badge variant="outline" className="gap-1"><Bank size={12} /> Pacífico</Badge>
              <Badge variant="outline" className="gap-1"><Bank size={12} /> Bolivariano</Badge>
            </div>
            <Button variant="ghost" size="sm" onClick={loadHistory} disabled={loadingHistory}>
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
                  <Button variant="ghost" size="sm" onClick={() => setShowHistory(false)}>
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
                            {BANKS.find(b => b.value === statement.bank_name)?.label || statement.bank_name} • 
                            {statement.period}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm font-medium">{statement.total_transactions} transacciones</p>
                          <p className="text-xs text-muted-foreground">
                            <span className="text-emerald-600">{statement.matched} coinciden</span> • 
                            <span className="text-blue-600">{statement.new} nuevas</span>
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

      {/* Reconciliation Results */}
      <AnimatePresence>
        {reconciliationData && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            {/* Summary Card */}
            <Card className="bento-card mb-4">
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold">
                      {BANKS.find(b => b.value === reconciliationData.bank_name)?.label || reconciliationData.bank_name}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Período: {reconciliationData.period}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-emerald-600">{reconciliationData.summary.matched}</p>
                      <p className="text-xs text-muted-foreground">Coinciden</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-600">{reconciliationData.summary.new}</p>
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

                {/* Card Info */}
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

            {/* Transactions List */}
            <Card className="bento-card">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Transacciones a Reconciliar</CardTitle>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={selectAllNew}>
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
                          ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200"
                          : selectedItems.includes(tx.temp_id)
                            ? "bg-blue-50 dark:bg-blue-950/20 border-blue-200"
                            : "bg-card border-border hover:border-primary/30"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {/* Checkbox for new transactions */}
                        {tx.status !== "matched" && (
                          <Checkbox
                            checked={selectedItems.includes(tx.temp_id)}
                            onCheckedChange={() => toggleSelectItem(tx.temp_id)}
                          />
                        )}
                        {tx.status === "matched" && (
                          <CheckCircle size={20} className="text-emerald-600" weight="fill" />
                        )}

                        {/* Transaction Info */}
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
                                <span>•</span>
                                <span className="text-primary">{CATEGORIES[tx.suggested_category] || tx.suggested_category}</span>
                              </>
                            )}
                            {tx.matched_transaction && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1 text-emerald-600">
                                  <LinkSimple size={12} />
                                  Vinculada a: {tx.matched_transaction.description?.substring(0, 30)}...
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Amount */}
                        <div className="text-right">
                          <p className="font-bold font-mono">{formatCurrency(tx.amount)}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <Button variant="outline" onClick={() => setReconciliationData(null)}>
                    <X size={16} className="mr-2" />
                    Cancelar
                  </Button>
                  <Button 
                    onClick={handleConfirmReconciliation}
                    disabled={confirmingMatches}
                    className="gap-2"
                  >
                    {confirmingMatches ? (
                      <>
                        <SpinnerGap size={16} className="animate-spin" />
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
