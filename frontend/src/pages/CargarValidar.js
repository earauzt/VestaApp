import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Badge } from "../components/ui/badge";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import ReconciliacionEstados from "../components/ReconciliacionEstados";
import TabImportar from "../components/bandeja/TabImportar";
import TabPorRevisar from "../components/bandeja/TabPorRevisar";
// TabHistorial removido: reemplazado por link "Ver todas las transacciones →"
import BandejaStats from "../components/bandeja/BandejaStats";
import { GmailConsentDialog } from "../components/bandeja/BandejaDialogs";
import Transactions from "./Transactions";
import { SRI_CATEGORIES, PERSONAL_CATEGORIES } from "../constants/categories";
import { 
  CloudArrowUp,
  SpinnerGap,
  CheckCircle,
  XCircle,
  Receipt,
  Eye,
  Pencil,
  FileText,
  Copy,
  CheckSquare
} from "@phosphor-icons/react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// SRI_CATEGORIES and PERSONAL_CATEGORIES are imported from /constants/categories.js
// Single source of truth. DO NOT redeclare locally.

const STATUS_COLORS = {
  pending_review: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  duplicate_suspect: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
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
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState("importar");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [pendingDataError, setPendingDataError] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });
  
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
  const [rowSubcategory, setRowSubcategory] = useState({}); // {id: subcategoryLabel}
  const [reviewSelectedIds, setReviewSelectedIds] = useState([]);
  const [reviewFilter, setReviewFilter] = useState({ source: "all", category: "all" });
  const [reviewBulkApproving, setReviewBulkApproving] = useState(false);
  const [vendorStats, setVendorStats] = useState({}); // {comercio_lower: {found, times_used}}
  const [gmailSummary, setGmailSummary] = useState({});
  const [gmailSyncing, setGmailSyncing] = useState(false);
  const [gmailLoading, setGmailLoading] = useState(false);
  const [gmailDocuments, setGmailDocuments] = useState([]);

  const fetchPendingData = useCallback(async () => {
    // Cada endpoint se resuelve de forma independiente: si uno falla (ej. un 500
    // puntual en /stats) no debe tumbar pending/duplicates, que sí responden bien.
    const [pendingRes, duplicatesRes, statsRes, crossRes] = await Promise.allSettled([
      axios.get(`${API}/reconciliation/pending`, { headers: getAuthHeadersRef.current() }),
      axios.get(`${API}/reconciliation/duplicates`, { headers: getAuthHeadersRef.current() }),
      axios.get(`${API}/reconciliation/stats`, { headers: getAuthHeadersRef.current() }),
      axios.get(`${API}/reconciliation/cross-canal-stats`, { headers: getAuthHeadersRef.current() })
    ]);

    if (pendingRes.status === "fulfilled") {
      setPendingTransactions(pendingRes.value.data.pending_review || []);
    } else if (process.env.NODE_ENV === 'development') {
      console.error("Error fetching pending transactions:", pendingRes.reason);
    }
    if (duplicatesRes.status === "fulfilled") {
      setDuplicatePairs(duplicatesRes.value.data.pairs || []);
    } else if (process.env.NODE_ENV === 'development') {
      console.error("Error fetching duplicates:", duplicatesRes.reason);
    }
    if (statsRes.status === "fulfilled") {
      setStats(statsRes.value.data);
    } else if (process.env.NODE_ENV === 'development') {
      console.error("Error fetching stats:", statsRes.reason);
    }
    setCrossCanalCount(crossRes.status === "fulfilled" ? (crossRes.value.data.cross_canal_count || 0) : 0);

    // Solo mostramos el error bloqueante si el dato principal (pending) no cargó.
    setPendingDataError(pendingRes.status === "rejected");
  }, []);

  // Deep-link support: Dashboard links to /movimientos?tab=por-revisar using
  // human-readable query values that map onto our internal tab keys.
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (!tabParam) return;
    const mapping = {
      "por-revisar": "revisar",
      "revisar": "revisar",
      "todos": "historial",
      "historial": "historial",
      "importar": "importar",
    };
    const mapped = mapping[tabParam];
    if (mapped) setActiveTab(mapped);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // SESIÓN 13 Task 3: Lookup vendor stats para mostrar "Nuevo" vs "Recurrente (N)"
  useEffect(() => {
    const uniqueComercios = [...new Set(
      gmailTransactions
        .filter(t => t.estado === "pendiente")
        .map(t => (t.comercio || "").trim())
        .filter(Boolean)
    )];
    const toLookup = uniqueComercios.filter(c => !(c.toLowerCase() in vendorStats));
    if (toLookup.length === 0) return;
    const headers = getAuthHeadersRef.current();
    Promise.all(
      toLookup.map(c =>
        axios.get(`${API}/known-vendors/lookup?establishment=${encodeURIComponent(c)}`, { headers })
          .then(r => ({ c, data: r.data }))
          .catch(() => ({ c, data: { found: false } }))
      )
    ).then(results => {
      setVendorStats(prev => {
        const next = { ...prev };
        results.forEach(({ c, data }) => {
          const timesUsed = data.vendor?.times_used ?? data.vendor?.match_count ?? 0;
          next[c.toLowerCase()] = { found: !!data.found, times_used: timesUsed };
        });
        return next;
      });
    });
  }, [gmailTransactions, vendorStats]);

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
      setBulkProgress({ done: 0, total: selected.length });
      for (const item of selected) {
        const cat = rowCategory[item.id] || item.suggested_category;
        const subcat = rowSubcategory[item.id] || "";
        try {
          if (item.source === "gmail") {
            const res = await axios.put(
              `${API}/gmail/transactions/${item.origin_id}/approve`,
              {},
              { headers }
            );
            const newTxId = res.data?.transaction_id;
            if (newTxId && ((cat && cat !== item.suggested_category) || subcat)) {
              await axios.put(
                `${API}/transactions/${newTxId}`,
                { category: cat, budget_category: cat, subcategory: subcat || undefined, amount: item.amount, description: item.comercio, date: item.date, transaction_type: "expense" },
                { headers }
              ).catch(() => {});
            }
          } else {
            const params = new URLSearchParams({ category: cat });
            if (subcat) params.append("subcategory", subcat);
            await axios.put(
              `${API}/reconciliation/approve/${item.origin_id}?${params.toString()}`,
              {},
              { headers }
            );
          }
          approved += 1;
        } catch (e) {
          errors.push({ id: item.id, error: e.response?.data?.detail || e.message });
        } finally {
          setBulkProgress((prev) => ({ ...prev, done: prev.done + 1 }));
        }
      }
      if (approved > 0) toast.success(`${approved} transacciones aprobadas y categorizadas`);
      if (errors.length > 0) toast.error(`${errors.length} error(es) al aprobar`);
      setReviewSelectedIds([]);
      setRowCategory({});
      setRowSubcategory({});
      fetchGmailTransactions();
      fetchPendingData();
    } finally {
      setReviewBulkApproving(false);
      setBulkProgress({ done: 0, total: 0 });
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
                  <FileText size={18} className="text-[#0D9E82]" /> Clasificación SRI (Contadora)
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 rounded-md bg-slate-50 border border-slate-200">
                  <div className="space-y-2">
                    <Label className="text-sm">Categoría SRI</Label>
                    {editMode ? (
                      <Select value={editForm.sri_category || ""} onValueChange={(v) => setEditForm({ ...editForm, sri_category: v, sri_subcategory: "" })}>
                        <SelectTrigger><SelectValue placeholder="Categoría deducible" /></SelectTrigger>
                        <SelectContent className="z-[250]">
                          {Object.entries(SRI_CATEGORIES).map(([key, cat]) => (
                            <SelectItem key={key} value={key}>
                              {cat.name} {cat.deductible ? "(Deducible)" : "(No deducible)"}
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
                          {editForm.sri_category && SRI_CATEGORIES[editForm.sri_category]?.subcategories?.map((sub) => (
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
              <Copy size={24} className="text-amber-500" />
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
                <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200">
                  <span className="font-medium text-amber-800">Posible Duplicado</span>
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
          <p className="text-sm text-muted-foreground">Sube archivos y aprueba transacciones en un solo lugar</p>
        </div>
      </div>

      {/* Stats Cards */}
      <BandejaStats
        stats={stats}
        duplicatePairs={duplicatePairs}
        crossCanalCount={crossCanalCount}
        formatCurrency={formatCurrency}
        onDuplicatesClick={duplicatePairs.length > 0 ? () => {
          setSelectedPair(duplicatePairs[0]);
          setShowDuplicateDialog(true);
        } : undefined}
      />

      {/* Main Tabs */}
      <Card className="bento-card">
        <CardContent className="p-4 sm:p-6">
          <Tabs value={activeTab} onValueChange={(v) => { if (!reviewBulkApproving) setActiveTab(v); }}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="importar" className="gap-2" disabled={reviewBulkApproving} data-testid="tab-importar">
                <CloudArrowUp size={18} />
                <span className="text-xs sm:text-sm">Importar</span>
              </TabsTrigger>
              <TabsTrigger value="revisar" className="gap-2" disabled={reviewBulkApproving} data-testid="tab-revisar">
                <CheckSquare size={18} />
                <span className="text-xs sm:text-sm">Por revisar</span>
                {(gmailTransactions.filter(t => t.estado === "pendiente").length + pendingTransactions.length) > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {gmailTransactions.filter(t => t.estado === "pendiente").length + pendingTransactions.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Importar Tab (Cargar + Estados + Gmail sync) */}
            <TabsContent value="importar">
              <TabImportar
                selectedFiles={selectedFiles}
                dragActive={dragActive}
                loading={loading}
                result={result}
                processingStatus={processingStatus}
                handleDrag={handleDrag}
                handleDrop={handleDrop}
                handleFileSelect={handleFileSelect}
                handleMultipleFilesUpload={handleMultipleFilesUpload}
                handleExcelUpload={handleExcelUpload}
                removeFile={removeFile}
                isBankStatement={isBankStatement}
                formatCurrency={formatCurrency}
                setActiveTab={setActiveTab}
                fetchPendingData={fetchPendingData}
                gmailStatus={gmailStatus}
                gmailSummary={gmailSummary}
                gmailSyncing={gmailSyncing}
                gmailConnecting={gmailConnecting}
                setShowGmailConsentModal={setShowGmailConsentModal}
                handleGmailSync={handleGmailSync}
              />
            </TabsContent>

            {/* Revisar Tab - Unified review list (Gmail + Statements) */}
            <TabsContent value="revisar">
              <TabPorRevisar
                budgetCategories={budgetCategories}
                reviewFilter={reviewFilter}
                setReviewFilter={setReviewFilter}
                filteredReview={filteredReview}
                reviewSelectedIds={reviewSelectedIds}
                toggleReviewSelect={toggleReviewSelect}
                reviewAllSelected={reviewAllSelected}
                toggleReviewSelectAll={toggleReviewSelectAll}
                handleReviewBulkApprove={handleReviewBulkApprove}
                reviewBulkApproving={reviewBulkApproving}
                bulkProgress={bulkProgress}
                vendorStats={vendorStats}
                getAuthHeaders={getAuthHeaders}
                onAfterUpdate={() => { fetchPendingData(); }}
                formatCurrency={formatCurrency}
                fetchError={pendingDataError}
                onRetry={fetchPendingData}
              />
            </TabsContent>

            {/* Historial Tab - reemplazado por link a /transactions */}

          </Tabs>

          <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
            <Link
              to="/transactions"
              className="text-sm text-[#0D9E82] hover:underline inline-flex items-center gap-1"
              data-testid="ver-todas-transacciones"
            >
              Ver todas las transacciones →
            </Link>
          </div>
        </CardContent>
      </Card>

      <GmailConsentDialog
        open={showGmailConsentModal}
        onOpenChange={setShowGmailConsentModal}
        handleConnectGmail={handleConnectGmail}
        gmailConnecting={gmailConnecting}
      />
    </div>
  );
}
