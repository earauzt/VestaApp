import { useState, useEffect, useCallback, useRef } from "react";
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
import ReconciliacionEstados from "../components/ReconciliacionEstados";
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
  ArrowRight,
  Bank,
  EnvelopeSimple,
  ArrowsClockwise,
  GoogleLogo
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
    subcategories: ["Hoteles", "Pasajes", "Comida", "Entretenimiento", "Ropa", "Tech", "Transporte", "Tours", "Otros"]
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

  const getAuthHeadersRef = useRef(getAuthHeaders);
  useEffect(() => { getAuthHeadersRef.current = getAuthHeaders; });
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
  
  // Filter and bulk actions state
  const [searchFilter, setSearchFilter] = useState("");
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkSubcategory, setBulkSubcategory] = useState("");
  const [bulkAction, setBulkAction] = useState("approve"); // approve, reject

  // Gmail states
  const [gmailStatus, setGmailStatus] = useState({ connected: false });
  const [gmailTransactions, setGmailTransactions] = useState([]);
  const [gmailSummary, setGmailSummary] = useState({});
  const [gmailSyncing, setGmailSyncing] = useState(false);
  const [gmailLoading, setGmailLoading] = useState(false);
  const [gmailDocuments, setGmailDocuments] = useState([]);

  useEffect(() => {
    if (activeTab === "validate") {
      fetchPendingData();
    }
    if (activeTab === "gmail") {
      fetchGmailStatus();
      fetchGmailTransactions();
      fetchGmailDocuments();
    }
  }, [activeTab]);

  const fetchPendingData = async () => {
    try {
      const [pendingRes, duplicatesRes, statsRes] = await Promise.all([
        axios.get(`${API}/reconciliation/pending`, { headers: getAuthHeadersRef.current() }),
        axios.get(`${API}/reconciliation/duplicates`, { headers: getAuthHeadersRef.current() }),
        axios.get(`${API}/reconciliation/stats`, { headers: getAuthHeadersRef.current() })
      ]);
      setPendingTransactions(pendingRes.data.pending_review || []);
      setDuplicatePairs(duplicatesRes.data.pairs || []);
      setStats(statsRes.data);
    } catch (error) {
      console.error("Error fetching pending data:", error);
    }
  };

  // Gmail functions
  const fetchGmailStatus = async () => {
    try {
      const res = await axios.get(`${API}/gmail/status`, { headers: getAuthHeadersRef.current() });
      setGmailStatus(res.data);
    } catch (e) {
      if (process.env.NODE_ENV === 'development') console.log("Gmail status error");
    }
  };

  const fetchGmailTransactions = async () => {
    setGmailLoading(true);
    try {
      const res = await axios.get(`${API}/gmail/transactions`, { headers: getAuthHeadersRef.current() });
      setGmailTransactions(res.data.transactions || []);
      setGmailSummary(res.data.summary || {});
    } catch (e) {
      if (process.env.NODE_ENV === 'development') console.log("Gmail transactions error");
    } finally {
      setGmailLoading(false);
    }
  };

  const fetchGmailDocuments = async () => {
    try {
      const res = await axios.get(`${API}/gmail/documents`, { headers: getAuthHeadersRef.current() });
      setGmailDocuments(res.data.documents || []);
    } catch (e) {
      if (process.env.NODE_ENV === 'development') console.log("Gmail documents error");
    }
  };

  const handleConnectGmail = async () => {
    try {
      const res = await axios.get(`${API}/gmail/auth-url`, { headers: getAuthHeadersRef.current() });
      window.open(res.data.auth_url, '_blank', 'width=600,height=700');
    } catch (e) {
      toast.error("Error al generar URL de autorización");
    }
  };

  const handleGmailSync = async () => {
    setGmailSyncing(true);
    try {
      const res = await axios.post(`${API}/gmail/sync`, {}, { headers: getAuthHeadersRef.current() });
      const { procesados, descartados } = res.data;
      if (procesados > 0) {
        toast.success(`${procesados} emails procesados, ${descartados} descartados`);
      } else {
        toast.info("No hay emails bancarios nuevos");
      }
      fetchGmailTransactions();
      fetchGmailStatus();
    } catch (e) {
      const detail = e.response?.data?.detail || "Error al sincronizar Gmail";
      toast.error(detail);
    } finally {
      setGmailSyncing(false);
    }
  };

  const handleApproveGmail = async (gmailId) => {
    try {
      await axios.put(`${API}/gmail/transactions/${gmailId}/approve`, {}, { headers: getAuthHeadersRef.current() });
      toast.success("Transacción aprobada");
      fetchGmailTransactions();
    } catch (e) {
      toast.error("Error al aprobar");
    }
  };

  const handleDiscardGmail = async (gmailId) => {
    try {
      await axios.put(`${API}/gmail/transactions/${gmailId}/discard`, {}, { headers: getAuthHeadersRef.current() });
      setGmailTransactions(prev => prev.filter(t => t.gmail_id !== gmailId));
    } catch (e) {
      toast.error("Error al descartar");
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
        setProcessingStatus(`Procesando estado de cuenta: ${file.name}... (esto puede tomar 1-3 minutos)`);
        const formData = new FormData();
        formData.append("file", file);
        
        try {
          const response = await axios.post(`${API}/process/bank-statement`, formData, {
            headers: { ...getAuthHeadersRef.current(), "Content-Type": "multipart/form-data" },
            timeout: 300000 // 5 minutes timeout for bank statement processing
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
          headers: { ...getAuthHeadersRef.current(), "Content-Type": "multipart/form-data" }
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
        headers: { ...getAuthHeadersRef.current(), "Content-Type": "multipart/form-data" }
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
      
      await axios.put(url, {}, { headers: getAuthHeadersRef.current() });
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
        { headers: getAuthHeadersRef.current() }
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
      const response = await axios.put(
        `${API}/reconciliation/bulk-approve`, 
        { transaction_ids: selectedItems }, 
        { headers: getAuthHeadersRef.current() }
      );
      const { approved, failed, total } = response.data;
      if (failed > 0 && approved > 0) {
        toast.warning(`${approved} aprobadas, ${failed} fallaron de ${total}`);
      } else if (failed > 0) {
        toast.error(`${failed} transacciones fallaron`);
      } else {
        toast.success(`${approved} transacciones aprobadas`);
      }
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
        { headers: getAuthHeadersRef.current() }
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
      await axios.put(`${API}/reconciliation/not-duplicate/${transactionId}`, {}, { headers: getAuthHeadersRef.current() });
      toast.success("Marcado como no duplicado");
      fetchPendingData();
      setShowDuplicateDialog(false);
    } catch (error) {
      toast.error("Error");
    }
  };

  // Bulk actions
  const handleBulkAction = async () => {
    if (selectedItems.length === 0) return;
    
    setLoading(true);
    let successCount = 0;
    let errorCount = 0;
    
    try {
      for (const id of selectedItems) {
        try {
          if (bulkAction === "approve") {
            const updateData = {};
            // Solo actualizar si hay categoría válida (no "keep" ni vacío)
            if (bulkCategory && bulkCategory !== "keep") updateData.category = bulkCategory;
            if (bulkSubcategory && bulkSubcategory !== "none") updateData.subcategory = bulkSubcategory;
            
            // Update category if specified
            if (Object.keys(updateData).length > 0) {
              await axios.put(`${API}/transactions/${id}`, updateData, { headers: getAuthHeadersRef.current() });
            }
            
            // Approve
            await axios.put(`${API}/reconciliation/approve/${id}`, {}, { headers: getAuthHeadersRef.current() });
          } else {
            await axios.put(`${API}/reconciliation/reject/${id}`, {}, { headers: getAuthHeadersRef.current() });
          }
          successCount++;
        } catch (e) {
          errorCount++;
        }
      }
      
      toast.success(`${successCount} transacciones procesadas${errorCount > 0 ? `, ${errorCount} errores` : ""}`);
      setSelectedItems([]);
      setShowBulkDialog(false);
      setBulkCategory("");
      setBulkSubcategory("");
      fetchPendingData();
    } catch (error) {
      toast.error("Error en acción en lote");
    } finally {
      setLoading(false);
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
        { headers: getAuthHeadersRef.current() }
      );
      toast.success("Transacción actualizada");
      setShowDetailDialog(false);
      fetchPendingData();
    } catch (error) {
      toast.error("Error al guardar cambios");
    }
  };

  const toggleSelectItem = (transaction) => {
    const txId = transaction._id || transaction.id || transaction;
    setSelectedItems(prev => prev.includes(txId) ? prev.filter(i => i !== txId) : [...prev, txId]);
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
                      <SelectContent className="z-[250]">
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
                      <SelectContent className="z-[250]">
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
                        <SelectContent className="z-[250]">
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
                        <SelectContent className="z-[250]">
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
            <TabsList className="grid w-full grid-cols-4 mb-6">
              <TabsTrigger value="upload" className="gap-2" data-testid="tab-upload">
                <CloudArrowUp size={18} />
                <span className="hidden sm:inline">Cargar</span>
              </TabsTrigger>
              <TabsTrigger value="reconcile" className="gap-2" data-testid="tab-reconcile">
                <Bank size={18} />
                <span className="hidden sm:inline">Estados</span>
                <span className="sm:hidden">Bancos</span>
              </TabsTrigger>
              <TabsTrigger value="gmail" className="gap-2" data-testid="tab-gmail">
                <EnvelopeSimple size={18} />
                <span className="hidden sm:inline">Gmail</span>
                {(gmailSummary.pendiente || 0) > 0 && (
                  <Badge variant="secondary" className="ml-1">{gmailSummary.pendiente}</Badge>
                )}
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

            {/* Reconcile Tab - Estados de Cuenta */}
            <TabsContent value="reconcile">
              <ReconciliacionEstados />
            </TabsContent>

            {/* Gmail Tab */}
            <TabsContent value="gmail">
              <div className="space-y-6" data-testid="gmail-tab-content">
                {!gmailStatus.connected ? (
                  <div className="text-center py-12" data-testid="gmail-connect-prompt">
                    <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-red-50 flex items-center justify-center">
                      <EnvelopeSimple size={40} className="text-red-500" weight="duotone" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">Conecta tu cuenta de Gmail</h3>
                    <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                      FamilyFinance leerá tus notificaciones bancarias para detectar consumos, alertas y estados de cuenta automáticamente.
                    </p>
                    <Button onClick={handleConnectGmail} className="gap-2" data-testid="gmail-connect-btn">
                      <GoogleLogo size={18} weight="bold" />
                      Conectar Gmail
                    </Button>
                  </div>
                ) : (
                  <>
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">Emails Bancarios</h3>
                        <p className="text-sm text-muted-foreground">
                          Último sync: {gmailStatus.last_sync ? new Date(gmailStatus.last_sync).toLocaleString("es-EC") : "Nunca"}
                        </p>
                      </div>
                      <Button 
                        onClick={handleGmailSync} 
                        disabled={gmailSyncing} 
                        className="gap-2"
                        data-testid="gmail-sync-btn"
                      >
                        <ArrowsClockwise size={18} className={gmailSyncing ? "animate-spin" : ""} />
                        {gmailSyncing ? "Sincronizando..." : "Sincronizar ahora"}
                      </Button>
                    </div>

                    {/* Summary badges */}
                    <div className="flex gap-3 flex-wrap">
                      <Badge variant="outline" className="gap-1">
                        <EnvelopeSimple size={14} /> Total: {gmailSummary.total || 0}
                      </Badge>
                      <Badge className="gap-1 bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">
                        Pendientes: {gmailSummary.pendiente || 0}
                      </Badge>
                      <Badge className="gap-1 bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
                        Aprobados: {gmailSummary.aprobado || 0}
                      </Badge>
                    </div>

                    {/* Transaction list */}
                    {gmailLoading ? (
                      <div className="text-center py-8">
                        <SpinnerGap size={32} className="animate-spin mx-auto text-muted-foreground" />
                      </div>
                    ) : gmailTransactions.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <CheckCircle size={32} className="mx-auto mb-2 text-emerald-500" />
                        <p>No hay transacciones pendientes de Gmail</p>
                        <p className="text-xs mt-1">Pulsa "Sincronizar ahora" para buscar nuevos emails</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {gmailTransactions.map((tx) => (
                          <div 
                            key={tx.gmail_id} 
                            className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                            data-testid={`gmail-tx-${tx.gmail_id}`}
                          >
                            <div className={`w-2 h-2 rounded-full shrink-0 ${
                              tx.tipo === "consumo" ? "bg-blue-500" : 
                              tx.tipo === "alerta" ? "bg-red-500" : 
                              tx.tipo === "estado_de_cuenta" ? "bg-violet-500" : 
                              tx.tipo === "factura_sri" ? "bg-emerald-500" : "bg-gray-300"
                            }`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                {tx.tipo === "factura_sri" && <span className="text-base" title="Factura SRI">🧾</span>}
                                <span className="font-medium text-sm truncate">{tx.descripcion_corta || tx.subject}</span>
                                <Badge variant="outline" className={`text-xs shrink-0 ${tx.tipo === "factura_sri" ? "border-emerald-300 text-emerald-700" : ""}`}>{tx.tipo === "factura_sri" ? "Factura SRI" : tx.tipo}</Badge>
                                {tx.nivel_urgencia === "alta" && (
                                  <Badge className="text-xs bg-red-100 text-red-700 border-red-200 hover:bg-red-100">Urgente</Badge>
                                )}
                                {tx.es_deducible && (
                                  <Badge className="text-xs bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-50">Deducible</Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                {tx.banco && <span>{tx.banco}</span>}
                                {tx.tarjeta_ultimos4 && <span>****{tx.tarjeta_ultimos4}</span>}
                                {tx.comercio && <span>· {tx.comercio}</span>}
                                {tx.fecha_transaccion && <span>· {tx.fecha_transaccion}</span>}
                                {tx.numero_factura && <span>· Fact. {tx.numero_factura}</span>}
                                {tx.ruc_emisor && <span>· RUC: {tx.ruc_emisor}</span>}
                              </div>
                            </div>
                            {tx.monto && (
                              <span className="font-bold font-mono text-sm shrink-0">
                                ${tx.monto.toLocaleString("es-EC", { minimumFractionDigits: 2 })}
                              </span>
                            )}
                            {tx.estado === "pendiente" && (
                              <div className="flex gap-1 shrink-0">
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className="h-8 w-8 p-0 text-emerald-600 hover:bg-emerald-50"
                                  onClick={() => handleApproveGmail(tx.gmail_id)}
                                  data-testid={`gmail-approve-${tx.gmail_id}`}
                                >
                                  <CheckCircle size={18} />
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className="h-8 w-8 p-0 text-red-500 hover:bg-red-50"
                                  onClick={() => handleDiscardGmail(tx.gmail_id)}
                                  data-testid={`gmail-discard-${tx.gmail_id}`}
                                >
                                  <XCircle size={18} />
                                </Button>
                              </div>
                            )}
                            {tx.estado === "aprobado" && (
                              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 text-xs">Aprobado</Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Documents Section */}
                    {gmailDocuments.length > 0 && (
                      <div className="space-y-3 mt-6" data-testid="gmail-documents-section">
                        <h4 className="font-semibold flex items-center gap-2">
                          <FileText size={18} className="text-primary" />
                          Documentos recibidos
                          <Badge variant="outline" className="ml-1">{gmailDocuments.length}</Badge>
                        </h4>
                        <div className="space-y-2">
                          {gmailDocuments.map((doc) => (
                            <div 
                              key={doc.id} 
                              className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                              data-testid={`gmail-doc-${doc.id}`}
                            >
                              <div className="p-2 rounded-lg bg-red-50 text-red-500">
                                <FileText size={20} weight="duotone" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{doc.filename}</p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  {doc.banco && <span>{doc.banco}</span>}
                                  {doc.fecha_email && <span>· {doc.fecha_email}</span>}
                                  {doc.tipo === "factura_sri" && doc.numero_factura && <span>· Fact. {doc.numero_factura}</span>}
                                  {doc.transactions_count > 0 && (
                                    <Badge className="text-xs bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-50">
                                      {doc.transactions_count} transacciones
                                    </Badge>
                                  )}
                                  {doc.procesado && (
                                    <Badge className="text-xs bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-50">Procesado</Badge>
                                  )}
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1 shrink-0"
                                onClick={() => window.open(`${API}/gmail/documents/${doc.id}/view`, '_blank')}
                                data-testid={`gmail-doc-view-${doc.id}`}
                              >
                                <Eye size={14} />
                                Ver
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
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
                      <>
                        {/* Search Filter */}
                        <div className="flex flex-col sm:flex-row gap-3 mb-4">
                          <div className="flex-1 relative">
                            <Input
                              placeholder="Buscar transacción... (ej: uber, netflix, supermaxi)"
                              value={searchFilter}
                              onChange={(e) => setSearchFilter(e.target.value)}
                              className="pl-10"
                              data-testid="search-filter"
                            />
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">🔍</span>
                          </div>
                          {selectedItems.length > 0 && (
                            <Button 
                              onClick={() => setShowBulkDialog(true)}
                              className="bg-primary"
                            >
                              <CheckSquare size={16} className="mr-2" />
                              Acción en lote ({selectedItems.length})
                            </Button>
                          )}
                        </div>
                        
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => {
                              const filtered = pendingTransactions
                                .filter(t => !searchFilter || 
                                  t.description?.toLowerCase().includes(searchFilter.toLowerCase()) ||
                                  t.establishment?.toLowerCase().includes(searchFilter.toLowerCase()))
                                .map(t => t._id || t.id);
                              setSelectedItems(filtered);
                            }}>
                              Seleccionar {searchFilter ? "filtradas" : "todas"}
                            </Button>
                            {selectedItems.length > 0 && (
                              <Button variant="ghost" size="sm" onClick={() => setSelectedItems([])}>
                                Deseleccionar
                              </Button>
                            )}
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {searchFilter 
                              ? `${pendingTransactions.filter(t => 
                                  t.description?.toLowerCase().includes(searchFilter.toLowerCase()) ||
                                  t.establishment?.toLowerCase().includes(searchFilter.toLowerCase())
                                ).length} de ${pendingTransactions.length}`
                              : `${pendingTransactions.length} pendiente(s)`
                            }
                          </span>
                        </div>
                      </>
                    )}

                    <div className="space-y-2">
                      {pendingTransactions
                        .filter(t => !searchFilter || 
                          t.description?.toLowerCase().includes(searchFilter.toLowerCase()) ||
                          t.establishment?.toLowerCase().includes(searchFilter.toLowerCase()) ||
                          t.category?.toLowerCase().includes(searchFilter.toLowerCase())
                        )
                        .map((t, index) => (
                        <motion.div
                          key={t.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.02 }}
                          className={`flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border transition-all ${
                            selectedItems.includes(t._id || t.id) ? "bg-primary/5 border-primary" : "bg-muted/50 border-transparent hover:bg-muted"
                          }`}
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <Checkbox checked={selectedItems.includes(t._id || t.id)} onCheckedChange={() => toggleSelectItem(t)} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                {t.establishment && <span className="font-semibold text-primary">{t.establishment}</span>}
                                {t.has_receipt && <Badge variant="outline" className="text-xs"><Receipt size={12} className="mr-1" />Recibo</Badge>}
                              </div>
                              <p className="text-sm text-muted-foreground truncate">{t.description}</p>
                              <div className="flex items-center gap-2 mt-1 text-xs flex-wrap">
                                <span>{t.date}</span>
                                <Badge variant="secondary">{PERSONAL_CATEGORIES[t.category]?.name || t.category}</Badge>
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

      {/* Bulk Action Dialog */}
      <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Acción en Lote</DialogTitle>
            <DialogDescription>
              Procesar {selectedItems.length} transacciones seleccionadas
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label>Acción</Label>
              <Select value={bulkAction} onValueChange={setBulkAction}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[250]">
                  <SelectItem value="approve">✅ Aprobar todas</SelectItem>
                  <SelectItem value="reject">❌ Rechazar todas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {bulkAction === "approve" && (
              <>
                <div>
                  <Label>Categoría (opcional)</Label>
                  <Select value={bulkCategory || "keep"} onValueChange={(v) => { setBulkCategory(v === "keep" ? "" : v); setBulkSubcategory(""); }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Mantener categoría actual" />
                    </SelectTrigger>
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
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar subcategoría" />
                      </SelectTrigger>
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
            <Button variant="outline" onClick={() => setShowBulkDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleBulkAction} disabled={loading}>
              {loading ? <SpinnerGap className="animate-spin mr-2" size={16} /> : null}
              Procesar {selectedItems.length} transacciones
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
