import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Badge } from "../components/ui/badge";
import { Checkbox } from "../components/ui/checkbox";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { 
  CloudArrowUp,
  SpinnerGap,
  CheckCircle,
  XCircle,
  Receipt,
  X,
  Images,
  FileXls,
  Eye,
  Pencil,
  Storefront,
  CreditCard,
  CalendarBlank,
  FileText,
  Warning,
  Copy,
  CheckSquare,
  ArrowRight
} from "@phosphor-icons/react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// ============ CATEGORÍAS PERSONALES (del Excel del usuario) ============
const PERSONAL_CATEGORIES = {
  servicios_basicos: { 
    name: "Servicios Básicos", 
    subcategories: ["Alícuota B", "Alícuota GT", "Luz", "Gas", "Celular", "Agua", "Clubes", "Internet", "Suscripciones"]
  },
  suscripciones: { 
    name: "Suscripciones", 
    subcategories: ["Netflix", "Spotify", "Amazon Prime", "Disney+", "YouTube Premium", "iCloud", "Otras"]
  },
  empleados: { 
    name: "Empleados", 
    subcategories: ["Ramona", "Angélica", "IESS"]
  },
  colegio_actividades: { 
    name: "Colegio y Actividades", 
    subcategories: ["Menor", "Fútbol", "Telas Aros"]
  },
  seguros: { 
    name: "Seguros", 
    subcategories: ["Salud", "Carros"]
  },
  comida: { 
    name: "Comida", 
    subcategories: ["Supermaxi", "Mercado"]
  },
  restaurantes: { 
    name: "Restaurantes", 
    subcategories: ["Comida afuera", "Delivery"]
  },
  carros: { 
    name: "Carros", 
    subcategories: ["Gasolina 1", "Gasolina 2", "Mantenimiento"]
  },
  usa: { 
    name: "USA", 
    subcategories: ["Mamá (Venmo)", "TMobile", "Universidad"]
  },
  viajes_entretenimiento: { 
    name: "Viajes y Entretenimiento", 
    subcategories: ["Pasajes", "Hoteles", "Navidad", "Ropa", "Tech"]
  },
  gastos_libres: { 
    name: "Gastos Libres (Otros)", 
    subcategories: ["KP (Esposa)", "EA (Emilio)", "Varios"]
  },
  impuestos: {
    name: "Impuestos",
    subcategories: ["SRI", "Municipio", "Otros impuestos"]
  }
};

// ============ CATEGORÍAS SRI (para contadora - deducibles) ============
const SRI_CATEGORIES = {
  alimentacion: { name: "Alimentación", deductible: true, limit_percent: 32.5 },
  salud: { name: "Salud", deductible: true, limit_percent: 200 },
  educacion: { name: "Educación", deductible: true, limit_percent: 32.5 },
  vivienda: { name: "Vivienda", deductible: true, limit_percent: 32.5 },
  vestimenta: { name: "Vestimenta", deductible: true, limit_percent: 32.5 },
  turismo: { name: "Turismo Nacional", deductible: true, limit_percent: 32.5 },
  no_deducible: { name: "No Deducible", deductible: false, limit_percent: 0 }
};

const SRI_SUBCATEGORIES = {
  alimentacion: ["Supermercado", "Restaurantes", "Mercado", "Delivery"],
  salud: ["Seguro médico", "Medicina", "Consultas", "Hospitalización", "Laboratorio", "Odontología"],
  educacion: ["Colegio", "Universidad", "Cursos", "Materiales", "Uniformes"],
  vivienda: ["Arriendo", "Intereses hipoteca", "Servicios básicos", "Mantenimiento"],
  vestimenta: ["Ropa", "Calzado", "Accesorios"],
  turismo: ["Hoteles Ecuador", "Tours locales", "Transporte turístico"],
  no_deducible: ["Internacional", "Entretenimiento", "Otros"]
};

const STATUS_COLORS = {
  pending_review: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  duplicate_suspect: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
};

const STATUS_LABELS = {
  pending_review: "Pendiente",
  approved: "Aprobado",
  rejected: "Rechazado",
  duplicate_suspect: "Posible Duplicado"
};

export default function CargarValidar() {
  const { getAuthHeaders, user } = useAuth();
  const [activeTab, setActiveTab] = useState("upload");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  
  // Upload state
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  
  // Validation state
  const [pendingTransactions, setPendingTransactions] = useState([]);
  const [duplicatePairs, setDuplicatePairs] = useState([]);
  const [stats, setStats] = useState({});
  const [selectedItems, setSelectedItems] = useState([]);
  
  // Dialog states
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [detailTransaction, setDetailTransaction] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [selectedPair, setSelectedPair] = useState(null);
  const [processingStatus, setProcessingStatus] = useState("");
  const [cardResult, setCardResult] = useState(null);

  useEffect(() => {
    if (activeTab === "validate") {
      fetchPendingData();
    }
  }, [activeTab]);

  const fetchPendingData = async () => {
    try {
      const [pendingRes, duplicatesRes, statsRes] = await Promise.all([
        axios.get(`${API}/reconciliation/pending`, { headers: getAuthHeaders() }),
        axios.get(`${API}/reconciliation/duplicates`, { headers: getAuthHeaders() }),
        axios.get(`${API}/reconciliation/stats`, { headers: getAuthHeaders() })
      ]);
      setPendingTransactions(pendingRes.data.pending_review || []);
      setDuplicatePairs(duplicatesRes.data.pairs || []);
      setStats(statsRes.data);
    } catch (error) {
      console.error("Error fetching pending data:", error);
    }
  };

  // Detect if file is a bank statement (PDF with certain keywords in name)
  const isBankStatement = (file) => {
    const name = file.name.toLowerCase();
    return (
      (name.includes("estado") || name.includes("statement") || 
       name.includes("pichincha") || name.includes("pacificard") || 
       name.includes("diners") || name.includes("produbanco") ||
       name.includes("guayaquil") || name.includes("tarjeta")) &&
      (name.endsWith('.pdf') || name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg'))
    );
  };

  const handleMultipleFilesUpload = async () => {
    if (selectedFiles.length === 0) {
      toast.error("Selecciona al menos un archivo");
      return;
    }

    setLoading(true);
    setResult(null);
    setCardResult(null);
    
    try {
      // Separate bank statements from regular receipts
      const bankStatements = selectedFiles.filter(f => isBankStatement(f));
      const receipts = selectedFiles.filter(f => !isBankStatement(f) && !f.name.endsWith('.xlsx') && !f.name.endsWith('.xls'));
      
      let allTransactions = [];
      let cardInfo = null;
      
      // Process bank statements first (one by one)
      for (const file of bankStatements) {
        setProcessingStatus(`Procesando estado de cuenta: ${file.name}...`);
        const formData = new FormData();
        formData.append("file", file);
        
        try {
          const response = await axios.post(`${API}/process/bank-statement`, formData, {
            headers: { ...getAuthHeaders(), "Content-Type": "multipart/form-data" }
          });
          
          if (response.data.data?.card_info) {
            cardInfo = response.data.data.card_info;
            setCardResult(cardInfo);
            toast.success(`Tarjeta actualizada: ${cardInfo.name || cardInfo.bank}`);
          }
          if (response.data.data?.transactions) {
            allTransactions = [...allTransactions, ...response.data.data.transactions];
          }
        } catch (err) {
          toast.error(`Error en ${file.name}: ${err.response?.data?.detail || err.message}`);
        }
      }
      
      // Process regular receipts
      if (receipts.length > 0) {
        setProcessingStatus(`Procesando ${receipts.length} recibos...`);
        const formData = new FormData();
        receipts.forEach(file => formData.append("files", file));
        
        const response = await axios.post(`${API}/process/receipts-multiple`, formData, {
          headers: { ...getAuthHeaders(), "Content-Type": "multipart/form-data" }
        });
        
        if (response.data.transactions) {
          allTransactions = [...allTransactions, ...response.data.transactions];
        }
      }

      setResult({
        message: `Procesados ${selectedFiles.length} archivos`,
        transactions: allTransactions,
        card_info: cardInfo
      });
      
      toast.success(`${allTransactions.length} transacciones extraídas`);
      setSelectedFiles([]);
      setProcessingStatus("");
      
      // Switch to validation tab and refresh
      setTimeout(() => {
        setActiveTab("validate");
        fetchPendingData();
      }, 1500);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error procesando archivos");
    } finally {
      setLoading(false);
      setProcessingStatus("");
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
    if (e.dataTransfer.files?.length > 0) {
      setSelectedFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
    }
  }, []);

  const handleFileSelect = (e) => {
    if (e.target.files?.length > 0) {
      setSelectedFiles(prev => [...prev, ...Array.from(e.target.files)]);
    }
  };

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Validation functions
  const handleApprove = async (transactionId, category = null, subcategory = null) => {
    try {
      let url = `${API}/reconciliation/approve/${transactionId}`;
      const params = new URLSearchParams();
      if (category) params.append("category", category);
      if (subcategory) params.append("subcategory", subcategory);
      if (params.toString()) url += `?${params.toString()}`;
      
      await axios.put(url, {}, { headers: getAuthHeaders() });
      toast.success("Transacción aprobada");
      fetchPendingData();
      setShowDetailDialog(false);
    } catch (error) {
      toast.error("Error al aprobar");
    }
  };

  const handleReject = async (transactionId, reason = "") => {
    try {
      await axios.put(
        `${API}/reconciliation/reject/${transactionId}?reason=${encodeURIComponent(reason)}`,
        {},
        { headers: getAuthHeaders() }
      );
      toast.success("Transacción rechazada");
      fetchPendingData();
      setShowDetailDialog(false);
    } catch (error) {
      toast.error("Error al rechazar");
    }
  };

  const handleBulkApprove = async () => {
    if (selectedItems.length === 0) {
      toast.error("Selecciona transacciones primero");
      return;
    }
    try {
      await axios.put(`${API}/reconciliation/bulk-approve`, selectedItems, { headers: getAuthHeaders() });
      toast.success(`${selectedItems.length} transacciones aprobadas`);
      setSelectedItems([]);
      fetchPendingData();
    } catch (error) {
      toast.error("Error en aprobación masiva");
    }
  };

  const handleConfirmDuplicate = async (transactionId, keepOriginal = true) => {
    try {
      await axios.put(
        `${API}/reconciliation/confirm-duplicate/${transactionId}?keep_original=${keepOriginal}`,
        {},
        { headers: getAuthHeaders() }
      );
      toast.success("Duplicado procesado");
      fetchPendingData();
      setShowDuplicateDialog(false);
    } catch (error) {
      toast.error("Error al procesar duplicado");
    }
  };

  const handleNotDuplicate = async (transactionId) => {
    try {
      await axios.put(`${API}/reconciliation/not-duplicate/${transactionId}`, {}, { headers: getAuthHeaders() });
      toast.success("Marcado como no duplicado");
      fetchPendingData();
      setShowDuplicateDialog(false);
    } catch (error) {
      toast.error("Error");
    }
  };

  const openDetailDialog = (transaction) => {
    setDetailTransaction(transaction);
    setEditForm({
      description: transaction.description || "",
      amount: transaction.amount?.toString() || "",
      category: transaction.category || "",
      subcategory: transaction.subcategory || "",
      establishment: transaction.establishment || "",
      review_notes: transaction.review_notes || "",
      sri_category: transaction.sri_category || "",
      sri_subcategory: transaction.sri_subcategory || ""
    });
    setEditMode(false);
    setShowDetailDialog(true);
  };

  const handleSaveEdit = async () => {
    if (!detailTransaction) return;
    try {
      await axios.put(
        `${API}/transactions/${detailTransaction.id}`,
        { 
          ...detailTransaction, 
          ...editForm, 
          amount: parseFloat(editForm.amount),
          sri_category: editForm.sri_category,
          sri_subcategory: editForm.sri_subcategory
        },
        { headers: getAuthHeaders() }
      );
      toast.success("Transacción actualizada");
      setShowDetailDialog(false);
      fetchPendingData();
    } catch (error) {
      toast.error("Error al guardar cambios");
    }
  };

  const toggleSelectItem = (id) => {
    setSelectedItems(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(value || 0);
  };

  return (
    <div className="space-y-6" data-testid="cargar-validar-page">
      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye size={24} className="text-primary" />
              {editMode ? "Editar Transacción" : "Detalle de Transacción"}
            </DialogTitle>
          </DialogHeader>
          
          {detailTransaction && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/50 border flex justify-between items-start">
                <div>
                  <Badge className={STATUS_COLORS[detailTransaction.status]}>
                    {STATUS_LABELS[detailTransaction.status] || "Pendiente"}
                  </Badge>
                  <p className="text-2xl font-mono font-bold mt-2">
                    {formatCurrency(detailTransaction.amount)}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setEditMode(!editMode)} className="gap-1">
                  <Pencil size={14} />
                  {editMode ? "Cancelar" : "Editar"}
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Descripción</Label>
                  {editMode ? (
                    <Input value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
                  ) : (
                    <p className="p-2 rounded bg-muted text-sm">{detailTransaction.description}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Monto</Label>
                  {editMode ? (
                    <Input type="number" step="0.01" value={editForm.amount} onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })} />
                  ) : (
                    <p className="p-2 rounded bg-muted text-sm font-mono">{formatCurrency(detailTransaction.amount)}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Establecimiento</Label>
                  {editMode ? (
                    <Input value={editForm.establishment} onChange={(e) => setEditForm({ ...editForm, establishment: e.target.value })} />
                  ) : (
                    <p className="p-2 rounded bg-muted text-sm">{detailTransaction.establishment || "No especificado"}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Fecha</Label>
                  <p className="p-2 rounded bg-muted text-sm">
                    {detailTransaction.date ? format(new Date(detailTransaction.date), "PPP", { locale: es }) : "No especificada"}
                  </p>
                </div>

                {/* Categoría Personal (del presupuesto) */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    Categoría Personal
                    <Badge variant="outline" className="text-xs">Presupuesto</Badge>
                  </Label>
                  {editMode ? (
                    <Select value={editForm.category} onValueChange={(v) => setEditForm({ ...editForm, category: v, subcategory: "" })}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar categoría" /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(PERSONAL_CATEGORIES).map(([key, cat]) => (
                          <SelectItem key={key} value={key}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="p-2 rounded bg-muted text-sm">
                      {PERSONAL_CATEGORIES[detailTransaction.category]?.name || detailTransaction.category || "Sin categoría"}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Subcategoría Personal</Label>
                  {editMode ? (
                    <Select value={editForm.subcategory} onValueChange={(v) => setEditForm({ ...editForm, subcategory: v })} disabled={!editForm.category}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                      <SelectContent>
                        {editForm.category && PERSONAL_CATEGORIES[editForm.category]?.subcategories?.map((sub) => (
                          <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="p-2 rounded bg-muted text-sm">{detailTransaction.subcategory || "No especificada"}</p>
                  )}
                </div>
              </div>

              {/* Sección para Contadora - Categorías SRI */}
              <div className="border-t pt-4 mt-4">
                <Label className="flex items-center gap-2 mb-3 text-base font-semibold">
                  <span>📋</span> Clasificación SRI (Contadora)
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-200">
                  <div className="space-y-2">
                    <Label className="text-sm">Categoría SRI</Label>
                    {editMode ? (
                      <Select value={editForm.sri_category || ""} onValueChange={(v) => setEditForm({ ...editForm, sri_category: v, sri_subcategory: "" })}>
                        <SelectTrigger><SelectValue placeholder="Categoría deducible" /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(SRI_CATEGORIES).map(([key, cat]) => (
                            <SelectItem key={key} value={key}>
                              {cat.name} {cat.deductible ? "✓" : "✗"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="p-2 rounded bg-white dark:bg-muted text-sm">
                        {SRI_CATEGORIES[detailTransaction.sri_category]?.name || "No asignada"}
                        {SRI_CATEGORIES[detailTransaction.sri_category]?.deductible && (
                          <Badge variant="outline" className="ml-2 text-emerald-600 text-xs">Deducible</Badge>
                        )}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Subcategoría SRI</Label>
                    {editMode ? (
                      <Select value={editForm.sri_subcategory || ""} onValueChange={(v) => setEditForm({ ...editForm, sri_subcategory: v })} disabled={!editForm.sri_category}>
                        <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                        <SelectContent>
                          {editForm.sri_category && SRI_SUBCATEGORIES[editForm.sri_category]?.map((sub) => (
                            <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="p-2 rounded bg-white dark:bg-muted text-sm">{detailTransaction.sri_subcategory || "No especificada"}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notas de revisión</Label>
                {editMode ? (
                  <Textarea value={editForm.review_notes} onChange={(e) => setEditForm({ ...editForm, review_notes: e.target.value })} placeholder="Agregar notas..." rows={3} />
                ) : (
                  <p className="p-2 rounded bg-muted text-sm min-h-[60px]">{detailTransaction.review_notes || "Sin notas"}</p>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {editMode ? (
              <>
                <Button variant="outline" onClick={() => setEditMode(false)}>Cancelar</Button>
                <Button onClick={handleSaveEdit}>Guardar cambios</Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => handleReject(detailTransaction?.id)} className="text-red-600">
                  <XCircle size={16} className="mr-1" /> Rechazar
                </Button>
                <Button onClick={() => handleApprove(detailTransaction?.id, editForm.category, editForm.subcategory)} className="bg-emerald-600 hover:bg-emerald-700">
                  <CheckCircle size={16} className="mr-1" /> Aprobar
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate Dialog */}
      <Dialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy size={24} className="text-orange-500" />
              Revisar Posible Duplicado
            </DialogTitle>
          </DialogHeader>
          {selectedPair && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200">
                  <span className="font-medium text-emerald-800">Original</span>
                  <p className="font-semibold mt-2">{selectedPair.original?.description}</p>
                  <p className="text-2xl font-mono">{formatCurrency(selectedPair.original?.amount)}</p>
                  <p className="text-sm text-muted-foreground">{selectedPair.original?.date}</p>
                </div>
                <div className="p-4 rounded-lg bg-orange-50 dark:bg-orange-900/10 border border-orange-200">
                  <span className="font-medium text-orange-800">Posible Duplicado</span>
                  <p className="font-semibold mt-2">{selectedPair.duplicate?.description}</p>
                  <p className="text-2xl font-mono">{formatCurrency(selectedPair.duplicate?.amount)}</p>
                  <p className="text-sm text-muted-foreground">{selectedPair.duplicate?.date}</p>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-muted text-center">
                <Badge variant={selectedPair.confidence >= 80 ? "destructive" : "secondary"}>
                  {selectedPair.confidence}% de coincidencia
                </Badge>
              </div>
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => handleNotDuplicate(selectedPair?.duplicate?.id)}>No es duplicado</Button>
            <Button onClick={() => handleConfirmDuplicate(selectedPair?.duplicate?.id, true)} className="bg-emerald-600">Conservar original</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Cargar y Validar</h1>
          <p className="text-muted-foreground">Sube archivos y aprueba transacciones en un solo lugar</p>
        </div>
        {activeTab === "validate" && selectedItems.length > 0 && (
          <Button onClick={handleBulkApprove} className="gap-2">
            <CheckSquare size={18} />
            Aprobar {selectedItems.length} seleccionadas
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      {activeTab === "validate" && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="bento-card">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-amber-600">{stats.pending_review || 0}</p>
              <p className="text-xs text-muted-foreground">Pendientes</p>
            </CardContent>
          </Card>
          <Card className="bento-card">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-orange-600">{duplicatePairs.length}</p>
              <p className="text-xs text-muted-foreground">Duplicados</p>
            </CardContent>
          </Card>
          <Card className="bento-card">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-emerald-600">{stats.approved || 0}</p>
              <p className="text-xs text-muted-foreground">Aprobados</p>
            </CardContent>
          </Card>
          <Card className="bento-card">
            <CardContent className="p-4 text-center">
              <p className="text-xl font-bold text-primary">{formatCurrency(stats.total_pending_amount)}</p>
              <p className="text-xs text-muted-foreground">Por revisar</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Tabs */}
      <Card className="bento-card">
        <CardContent className="p-4 sm:p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="upload" className="gap-2" data-testid="tab-upload">
                <CloudArrowUp size={18} />
                <span className="hidden sm:inline">Cargar Archivos</span>
                <span className="sm:hidden">Cargar</span>
              </TabsTrigger>
              <TabsTrigger value="validate" className="gap-2" data-testid="tab-validate">
                <CheckSquare size={18} />
                <span className="hidden sm:inline">Validar</span>
                {(stats.pending_review || 0) > 0 && (
                  <Badge variant="secondary" className="ml-1">{stats.pending_review}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Upload Tab */}
            <TabsContent value="upload">
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
                            <div key={index} className={`flex items-center justify-between p-3 rounded-lg ${isStatement ? 'bg-primary/10 border border-primary/20' : 'bg-muted'}`}>
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
                      onClick={handleMultipleFilesUpload}
                      disabled={loading || !selectedFiles.some(f => !f.name.endsWith('.xlsx') && !f.name.endsWith('.xls'))}
                      className="flex-1 gap-2"
                    >
                      {loading ? <SpinnerGap size={18} className="animate-spin" /> : <CloudArrowUp size={18} />}
                      Procesar Archivos
                    </Button>
                    <Button 
                      onClick={handleExcelUpload}
                      disabled={loading || !selectedFiles.some(f => f.name.endsWith('.xlsx') || f.name.endsWith('.xls'))}
                      variant="outline"
                      className="gap-2"
                    >
                      <FileXls size={18} />
                      Excel
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
                      
                      {/* Card Info Extracted */}
                      {result.card_info && (
                        <div className="p-4 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20">
                          <div className="flex items-center gap-2 mb-3">
                            <CreditCard size={20} className="text-primary" />
                            <span className="font-semibold">Tarjeta Actualizada</span>
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
                          {result.transactions.map((t, i) => (
                            <div key={i} className="p-3 rounded-lg bg-muted">
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
                      <Button onClick={() => { setActiveTab("validate"); fetchPendingData(); }} className="w-full gap-2">
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
            </TabsContent>

            {/* Validate Tab */}
            <TabsContent value="validate">
              <div className="space-y-4">
                {/* Pending Transactions */}
                {pendingTransactions.length === 0 && duplicatePairs.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <CheckCircle size={48} className="mx-auto mb-4 text-emerald-500" />
                    <p className="font-medium">¡Todo validado!</p>
                    <p className="text-sm">No hay transacciones pendientes</p>
                  </div>
                ) : (
                  <>
                    {/* Duplicates Warning */}
                    {duplicatePairs.length > 0 && (
                      <div className="p-4 rounded-xl bg-orange-50 dark:bg-orange-900/10 border border-orange-200 mb-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Warning size={24} className="text-orange-500" />
                            <div>
                              <p className="font-medium text-orange-800">{duplicatePairs.length} posible(s) duplicado(s)</p>
                              <p className="text-sm text-orange-600">Revisa antes de aprobar</p>
                            </div>
                          </div>
                          <Button size="sm" variant="outline" onClick={() => { setSelectedPair(duplicatePairs[0]); setShowDuplicateDialog(true); }}>
                            Revisar
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Transaction List */}
                    {pendingTransactions.length > 0 && (
                      <div className="flex justify-between items-center mb-2">
                        <Button variant="outline" size="sm" onClick={() => setSelectedItems(pendingTransactions.map(t => t.id))}>
                          Seleccionar todas
                        </Button>
                        <span className="text-sm text-muted-foreground">{pendingTransactions.length} pendiente(s)</span>
                      </div>
                    )}

                    <div className="space-y-2">
                      {pendingTransactions.map((t, index) => (
                        <motion.div
                          key={t.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.02 }}
                          className={`flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border transition-all ${
                            selectedItems.includes(t.id) ? "bg-primary/5 border-primary" : "bg-muted/50 border-transparent hover:bg-muted"
                          }`}
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <Checkbox checked={selectedItems.includes(t.id)} onCheckedChange={() => toggleSelectItem(t.id)} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                {t.establishment && <span className="font-semibold text-primary">{t.establishment}</span>}
                                {t.has_receipt && <Badge variant="outline" className="text-xs"><Receipt size={12} className="mr-1" />Recibo</Badge>}
                              </div>
                              <p className="text-sm text-muted-foreground truncate">{t.description}</p>
                              <div className="flex items-center gap-2 mt-1 text-xs flex-wrap">
                                <span>{t.date}</span>
                                <Badge variant="secondary">{CATEGORIES[t.category]?.name || t.category}</Badge>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between sm:justify-end gap-3">
                            <p className="font-mono font-bold text-lg">{formatCurrency(t.amount)}</p>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openDetailDialog(t)} title="Ver detalles">
                                <Eye size={18} />
                              </Button>
                              <Button variant="outline" size="icon" onClick={() => handleReject(t.id)} className="text-red-600" title="Rechazar">
                                <XCircle size={16} />
                              </Button>
                              <Button size="icon" onClick={() => handleApprove(t.id)} className="bg-emerald-600 hover:bg-emerald-700" title="Aprobar">
                                <CheckCircle size={16} />
                              </Button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
