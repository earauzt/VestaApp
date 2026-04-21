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
import Transactions from "./Transactions";
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
  const [activeTab, setActiveTab] = useState("importar");
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
  const [crossCanalCount, setCrossCanalCount] = useState(0);
  const [bulkSubcategory, setBulkSubcategory] = useState("");
  const [bulkAction, setBulkAction] = useState("approve"); // approve, reject

  // Gmail states
  const [gmailStatus, setGmailStatus] = useState({ connected: false });
  const [gmailTransactions, setGmailTransactions] = useState([]);
  const [selectedGmailIds, setSelectedGmailIds] = useState([]);
  const [gmailFilter, setGmailFilter] = useState("consumo"); // consumo | recibo_servicio | all
  const [bulkApproving, setBulkApproving] = useState(false);
  // SESIÓN 12: Rediseño 3 pestañas (Importar / Por revisar / Historial)
  const [budgetCategories, setBudgetCategories] = useState({});
  const [rowCategory, setRowCategory] = useState({}); // {id: categoryKey}
  const [reviewSelectedIds, setReviewSelectedIds] = useState([]);
  const [reviewFilter, setReviewFilter] = useState({ source: "all", category: "all" });
  const [reviewBulkApproving, setReviewBulkApproving] = useState(false);
  const [gmailSummary, setGmailSummary] = useState({});
  const [gmailSyncing, setGmailSyncing] = useState(false);
  const [gmailLoading, setGmailLoading] = useState(false);
  const [gmailDocuments, setGmailDocuments] = useState([]);

  const fetchPendingData = useCallback(async () => {
    try {
      const [pendingRes, duplicatesRes, statsRes, crossRes] = await Promise.all([
        axios.get(`${API}/reconciliation/pending`, { headers: getAuthHeadersRef.current() }),
        axios.get(`${API}/reconciliation/duplicates`, { headers: getAuthHeadersRef.current() }),
        axios.get(`${API}/reconciliation/stats`, { headers: getAuthHeadersRef.current() }),
        axios.get(`${API}/reconciliation/cross-canal-stats`, { headers: getAuthHeadersRef.current() }).catch(() => ({ data: { cross_canal_count: 0 } }))
      ]);
      setPendingTransactions(pendingRes.data.pending_review || []);
      setDuplicatePairs(duplicatesRes.data.pairs || []);
      setStats(statsRes.data);
      setCrossCanalCount(crossRes.data.cross_canal_count || 0);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') console.error("Error fetching pending data:", error);
    }
  }, []);

  const fetchGmailStatus = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/gmail/status`, { headers: getAuthHeadersRef.current() });
      setGmailStatus(res.data);
    } catch (e) {
      if (process.env.NODE_ENV === 'development') console.log("Gmail status error");
    }
  }, []);

  const fetchGmailTransactions = useCallback(async () => {
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
  }, []);

  const fetchGmailDocuments = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/gmail/documents`, { headers: getAuthHeadersRef.current() });
      setGmailDocuments(res.data.documents || []);
    } catch (e) {
      if (process.env.NODE_ENV === 'development') console.log("Gmail documents error");
    }
  }, []);

  useEffect(() => {
    if (activeTab === "revisar") {
      fetchPendingData();
      fetchGmailStatus();
      fetchGmailTransactions();
      fetchGmailDocuments();
    }
    if (activeTab === "importar") {
      fetchGmailStatus();
    }
  }, [activeTab, fetchPendingData, fetchGmailStatus, fetchGmailTransactions, fetchGmailDocuments]);

  const [gmailConnecting, setGmailConnecting] = useState(false);
  const [showGmailConsentModal, setShowGmailConsentModal] = useState(false);

  const handleConnectGmail = async () => {
    setGmailConnecting(true);
    try {
      const res = await axios.get(`${API}/gmail/auth-url`, { headers: getAuthHeadersRef.current() });
      if (res.data?.auth_url) {
        window.location.href = res.data.auth_url;
      } else {
        toast.error("No se pudo iniciar la conexion con Gmail. Intenta de nuevo.");
      }
    } catch (e) {
      toast.error("No se pudo iniciar la conexion con Gmail. Intenta de nuevo.");
      setGmailConnecting(false);
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

  // SESIÓN 12: cargar categorías de presupuesto (una vez)
  useEffect(() => {
    axios.get(`${API}/budget/categories`, { headers: getAuthHeadersRef.current() })
      .then((r) => setBudgetCategories(r.data?.categories || {}))
      .catch(() => {});
  }, []);

  // Lista unificada para "Por revisar" (Gmail + Estados pendientes)
  const unifiedReview = (() => {
    const items = [];
    gmailTransactions.filter(t => t.estado === "pendiente").forEach(t => {
      items.push({
        id: `gm-${t.gmail_id}`,
        source: "gmail",
        source_label: "Gmail",
        origin_id: t.gmail_id,
        date: t.fecha_transaccion || "",
        comercio: (t.comercio || "").trim() || (t.descripcion_corta || "(sin comercio)").slice(0, 40),
        amount: t.monto || 0,
        tipo: t.tipo,
        suggested_category: t.personal_category || "otros",
      });
    });
    pendingTransactions.forEach(t => {
      items.push({
        id: `st-${t.id}`,
        source: t.source || "statement",
        source_label: t.source === "manual" ? "Manual" : "PDF",
        origin_id: t.id,
        date: t.date || "",
        comercio: (t.establishment || t.description || "(sin comercio)").slice(0, 60),
        amount: t.amount || 0,
        tipo: t.transaction_type,
        suggested_category: t.category || t.budget_category || "otros",
      });
    });
    return items;
  })();

  const filteredReview = unifiedReview.filter((r) => {
    if (reviewFilter.source !== "all" && r.source !== reviewFilter.source) return false;
    if (reviewFilter.category !== "all") {
      const cat = rowCategory[r.id] || r.suggested_category;
      if (cat !== reviewFilter.category) return false;
    }
    return true;
  });

  const reviewAllSelected = filteredReview.length > 0 && filteredReview.every(r => reviewSelectedIds.includes(r.id));

  const toggleReviewSelectAll = () => {
    if (reviewAllSelected) {
      setReviewSelectedIds(prev => prev.filter(id => !filteredReview.some(r => r.id === id)));
    } else {
      const addIds = filteredReview.map(r => r.id);
      setReviewSelectedIds(prev => [...new Set([...prev, ...addIds])]);
    }
  };

  const toggleReviewSelect = (id) => {
    setReviewSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleReviewBulkApprove = async () => {
    if (reviewSelectedIds.length === 0) return;
    setReviewBulkApproving(true);
    const headers = getAuthHeadersRef.current();
    let approved = 0;
    const errors = [];
    try {
      const selected = unifiedReview.filter(r => reviewSelectedIds.includes(r.id));
      for (const item of selected) {
        const cat = rowCategory[item.id] || item.suggested_category;
        try {
          if (item.source === "gmail") {
            const res = await axios.put(
              `${API}/gmail/transactions/${item.origin_id}/approve`,
              {},
              { headers }
            );
            const newTxId = res.data?.transaction_id;
            if (newTxId && cat && cat !== item.suggested_category) {
              await axios.put(
                `${API}/transactions/${newTxId}`,
                { category: cat, budget_category: cat, amount: item.amount, description: item.comercio, date: item.date, transaction_type: "expense" },
                { headers }
              ).catch(() => {});
            }
          } else {
            await axios.put(
              `${API}/reconciliation/approve/${item.origin_id}?category=${encodeURIComponent(cat)}`,
              {},
              { headers }
            );
          }
          approved += 1;
        } catch (e) {
          errors.push({ id: item.id, error: e.response?.data?.detail || e.message });
        }
      }
      if (approved > 0) toast.success(`${approved} transacciones aprobadas y categorizadas`);
      if (errors.length > 0) toast.error(`${errors.length} error(es) al aprobar`);
      setReviewSelectedIds([]);
      setRowCategory({});
      fetchGmailTransactions();
      fetchPendingData();
    } finally {
      setReviewBulkApproving(false);
    }
  };

  // SESIÓN 11: filtros y selección para bulk approve
  const filteredGmailTxs = gmailTransactions.filter((t) => {
    if (t.estado !== "pendiente") return false;
    if (gmailFilter === "all") return true;
    return t.tipo === gmailFilter;
  });

  const allSelected = filteredGmailTxs.length > 0 && filteredGmailTxs.every(t => selectedGmailIds.includes(t.gmail_id));

  const toggleSelectAllGmail = () => {
    if (allSelected) {
      setSelectedGmailIds(prev => prev.filter(id => !filteredGmailTxs.some(t => t.gmail_id === id)));
    } else {
      const addIds = filteredGmailTxs.map(t => t.gmail_id);
      setSelectedGmailIds(prev => [...new Set([...prev, ...addIds])]);
    }
  };

  const toggleSelectGmail = (gid) => {
    setSelectedGmailIds(prev => prev.includes(gid) ? prev.filter(x => x !== gid) : [...prev, gid]);
  };

  const handleGmailBulkApprove = async () => {
    if (selectedGmailIds.length === 0) return;
    setBulkApproving(true);
    try {
      const res = await axios.post(
        `${API}/gmail/transactions/bulk-approve`,
        { gmail_ids: selectedGmailIds },
        { headers: getAuthHeadersRef.current() }
      );
      const cats = res.data.categorias_usadas || {};
      const catSummary = Object.entries(cats).map(([k, v]) => `${v} ${k}`).join(", ");
      toast.success(
        `${res.data.approved} transacciones aprobadas y categorizadas${catSummary ? ` (${catSummary})` : ""}`
      );
      setSelectedGmailIds([]);
      fetchGmailTransactions();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Error al aprobar en bulk");
    } finally {
      setBulkApproving(false);
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
        setActiveTab("revisar");
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
                  {selectedPair.original?.fuentes?.length > 0 && (
                    <div className="flex gap-1 mt-2 flex-wrap">{selectedPair.original.fuentes.map(f => <Badge key={f} variant="outline" className="text-[10px]">{f}</Badge>)}</div>
                  )}
                </div>
                <div className="p-4 rounded-lg bg-orange-50 dark:bg-orange-900/10 border border-orange-200">
                  <span className="font-medium text-orange-800">Posible Duplicado</span>
                  <p className="font-semibold mt-2">{selectedPair.duplicate?.description}</p>
                  <p className="text-2xl font-mono">{formatCurrency(selectedPair.duplicate?.amount)}</p>
                  <p className="text-sm text-muted-foreground">{selectedPair.duplicate?.date}</p>
                  {selectedPair.duplicate?.fuentes?.length > 0 && (
                    <div className="flex gap-1 mt-2 flex-wrap">{selectedPair.duplicate.fuentes.map(f => <Badge key={f} variant="outline" className="text-[10px]">{f}</Badge>)}</div>
                  )}
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
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Bandeja Financiera</h1>
          <p className="text-sm text-muted-foreground">Tus movimientos financieros en un solo lugar</p>
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
              {crossCanalCount > 0 && (
                <Badge className="mt-1 text-[10px] bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-50">{crossCanalCount} cross-canal</Badge>
              )}
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
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="importar" className="gap-2" data-testid="tab-importar">
                <CloudArrowUp size={18} />
                <span className="hidden sm:inline">Importar</span>
              </TabsTrigger>
              <TabsTrigger value="revisar" className="gap-2" data-testid="tab-revisar">
                <CheckSquare size={18} />
                <span className="hidden sm:inline">Por revisar</span>
                {(gmailTransactions.filter(t => t.estado === "pendiente").length + pendingTransactions.length) > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {gmailTransactions.filter(t => t.estado === "pendiente").length + pendingTransactions.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="historial" className="gap-2" data-testid="tab-historial">
                <Receipt size={18} />
                <span className="hidden sm:inline">Historial</span>
              </TabsTrigger>
            </TabsList>

            {/* Importar Tab (Cargar + Estados + Gmail sync) */}
            <TabsContent value="importar">
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
            </TabsContent>

            {/* Revisar Tab - Unified review list (Gmail + Statements) */}
            <TabsContent value="revisar">
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
                        ? "bg-blue-50 text-blue-700 border-blue-200"
                        : "bg-violet-50 text-violet-700 border-violet-200";
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
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate" data-testid={`review-comercio-${item.id}`}>{item.comercio}</p>
                            </div>
                            <span className="font-mono font-semibold text-sm shrink-0">${(item.amount || 0).toFixed(2)}</span>
                            <Badge variant="outline" className={`text-[10px] shrink-0 ${sourceBadgeColor}`} data-testid={`review-source-${item.id}`}>
                              {item.source_label}
                            </Badge>
                          </div>
                          <Select
                            value={selectedCat}
                            onValueChange={(v) => setRowCategory(prev => ({ ...prev, [item.id]: v }))}
                          >
                            <SelectTrigger className="w-[170px] h-9 shrink-0" data-testid={`review-cat-${item.id}`}>
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
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Historial Tab - reutiliza componente Transactions */}
            <TabsContent value="historial">
              <div data-testid="historial-tab-content">
                <Transactions embedded />
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

      {/* Gmail Consent Modal */}
      <Dialog open={showGmailConsentModal} onOpenChange={setShowGmailConsentModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl">Que va a leer FamilyFinance de tu correo?</DialogTitle>
            <DialogDescription>
              Solo accedemos a emails de remitentes financieros especificos
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20">
              <CheckCircle size={20} className="text-emerald-600 shrink-0 mt-0.5" weight="fill" />
              <p className="text-sm">Emails de consumo de tus bancos (Diners, PacifiCard, Pacifico, Pichincha, Bolivariano)</p>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20">
              <CheckCircle size={20} className="text-emerald-600 shrink-0 mt-0.5" weight="fill" />
              <p className="text-sm">Facturas electronicas que lleguen a tu correo</p>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20">
              <CheckCircle size={20} className="text-emerald-600 shrink-0 mt-0.5" weight="fill" />
              <p className="text-sm">Estados de cuenta en PDF</p>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/20">
              <XCircle size={20} className="text-red-500 shrink-0 mt-0.5" weight="fill" />
              <p className="text-sm">Emails personales, de trabajo o de cualquier otro remitente — nunca los leemos</p>
            </div>
            <p className="text-xs text-muted-foreground pt-2">
              FamilyFinance solo lee emails de remitentes financieros especificos. Nunca almacenamos el contenido de tus emails personales. Puedes desconectar tu cuenta en cualquier momento.
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowGmailConsentModal(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => { setShowGmailConsentModal(false); handleConnectGmail(); }}
              disabled={gmailConnecting}
              className="gap-2"
              data-testid="gmail-consent-confirm-btn"
            >
              {gmailConnecting ? (
                <><SpinnerGap size={16} className="animate-spin" /> Conectando...</>
              ) : (
                <><GoogleLogo size={18} weight="bold" /> Entendido, conectar</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
