import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog";
import { Checkbox } from "../components/ui/checkbox";
import { Textarea } from "../components/ui/textarea";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { 
  CheckCircle,
  XCircle,
  Warning,
  Copy,
  Eye,
  ArrowRight,
  Receipt,
  FileText,
  SpinnerGap,
  CheckSquare,
  Scales,
  Pencil,
  Paperclip,
  CalendarBlank,
  Storefront,
  CreditCard
} from "@phosphor-icons/react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CATEGORIES = {
  alimentacion: { name: "Alimentación", deductible: true },
  salud: { name: "Salud", deductible: true },
  educacion: { name: "Educación", deductible: true },
  vivienda: { name: "Vivienda", deductible: true },
  vestimenta: { name: "Vestimenta", deductible: true },
  turismo: { name: "Turismo Nacional", deductible: true },
  transporte: { name: "Transporte", deductible: false },
  viajes_internacionales: { name: "Viajes Internacionales", deductible: false },
  otros: { name: "Otros", deductible: false }
};

const SUBCATEGORIES = {
  alimentacion: ["Comida", "Restaurantes", "Supermercado", "Mercado"],
  salud: ["Seguros", "Medicina", "Consultas", "Hospitalización", "Laboratorio"],
  educacion: ["Colegio y actividades", "Cursos", "Materiales", "Universidad", "Maestría"],
  vivienda: ["Servicios básicos", "Arriendo", "Intereses hipoteca", "Mantenimiento"],
  vestimenta: ["Ropa", "Calzado", "Accesorios"],
  turismo: ["Hoteles Ecuador", "Tours locales", "Transporte turístico"],
  transporte: ["Carros", "Combustible", "Mantenimiento vehicular", "Taxi", "Bus"],
  viajes_internacionales: ["USA", "Europa", "Otros países"],
  otros: ["Empleados", "Entretenimiento", "Varios"]
};

const STATUS_COLORS = {
  pending_review: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  duplicate_suspect: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  duplicate_confirmed: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
};

const STATUS_LABELS = {
  pending_review: "Pendiente",
  approved: "Aprobado",
  rejected: "Rechazado",
  duplicate_suspect: "Posible Duplicado",
  duplicate_confirmed: "Duplicado Confirmado"
};

export default function Reconciliation() {
  const { getAuthHeaders, user } = useAuth();
  const [activeTab, setActiveTab] = useState("pending");
  const [pendingData, setPendingData] = useState({ pending_review: [], duplicate_suspects: [], stats: {} });
  const [duplicatePairs, setDuplicatePairs] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState([]);
  
  // Dialog states
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [selectedPair, setSelectedPair] = useState(null);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [newCategory, setNewCategory] = useState("");
  
  // NEW: Detail view dialog
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [detailTransaction, setDetailTransaction] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({
    description: "",
    amount: "",
    category: "",
    subcategory: "",
    establishment: "",
    review_notes: ""
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [pendingRes, duplicatesRes, statsRes] = await Promise.all([
        axios.get(`${API}/reconciliation/pending`, { headers: getAuthHeaders() }),
        axios.get(`${API}/reconciliation/duplicates`, { headers: getAuthHeaders() }),
        axios.get(`${API}/reconciliation/stats`, { headers: getAuthHeaders() })
      ]);
      setPendingData(pendingRes.data);
      setDuplicatePairs(duplicatesRes.data.pairs || []);
      setStats(statsRes.data);
    } catch (error) {
      toast.error("Error al cargar datos de conciliación");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (transactionId, category = null, subcategory = null) => {
    try {
      let url = `${API}/reconciliation/approve/${transactionId}`;
      const params = new URLSearchParams();
      if (category) params.append("category", category);
      if (subcategory) params.append("subcategory", subcategory);
      if (params.toString()) url += `?${params.toString()}`;
      
      await axios.put(url, {}, { headers: getAuthHeaders() });
      toast.success("Transacción aprobada");
      fetchData();
      setShowCategoryDialog(false);
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
      fetchData();
    } catch (error) {
      toast.error("Error al rechazar");
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
      fetchData();
      setShowDuplicateDialog(false);
    } catch (error) {
      toast.error("Error al procesar duplicado");
    }
  };

  const handleNotDuplicate = async (transactionId) => {
    try {
      await axios.put(
        `${API}/reconciliation/not-duplicate/${transactionId}`,
        {},
        { headers: getAuthHeaders() }
      );
      toast.success("Marcado como no duplicado");
      fetchData();
      setShowDuplicateDialog(false);
    } catch (error) {
      toast.error("Error");
    }
  };

  const handleBulkApprove = async () => {
    if (selectedItems.length === 0) {
      toast.error("Selecciona transacciones primero");
      return;
    }
    try {
      await axios.put(
        `${API}/reconciliation/bulk-approve`,
        selectedItems,
        { headers: getAuthHeaders() }
      );
      toast.success(`${selectedItems.length} transacciones aprobadas`);
      setSelectedItems([]);
      fetchData();
    } catch (error) {
      toast.error("Error en aprobación masiva");
    }
  };

  const toggleSelectItem = (id) => {
    setSelectedItems(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const selectAll = (items) => {
    setSelectedItems(items.map(t => t.id));
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-EC', {
      style: 'currency',
      currency: 'USD'
    }).format(value || 0);
  };

  const openCategoryDialog = (transaction) => {
    setEditingTransaction(transaction);
    setNewCategory(transaction.category);
    setShowCategoryDialog(true);
  };

  // NEW: Open detail dialog
  const openDetailDialog = (transaction) => {
    setDetailTransaction(transaction);
    setEditForm({
      description: transaction.description || "",
      amount: transaction.amount?.toString() || "",
      category: transaction.category || "",
      subcategory: transaction.subcategory || "",
      establishment: transaction.establishment || "",
      review_notes: transaction.review_notes || ""
    });
    setEditMode(false);
    setShowDetailDialog(true);
  };

  // NEW: Save edited transaction
  const handleSaveEdit = async () => {
    if (!detailTransaction) return;
    
    try {
      await axios.put(
        `${API}/transactions/${detailTransaction.id}`,
        {
          ...detailTransaction,
          ...editForm,
          amount: parseFloat(editForm.amount)
        },
        { headers: getAuthHeaders() }
      );
      toast.success("Transacción actualizada");
      setShowDetailDialog(false);
      fetchData();
    } catch (error) {
      toast.error("Error al guardar cambios");
    }
  };

  // NEW: Approve from detail view
  const handleApproveFromDetail = async () => {
    if (!detailTransaction) return;
    await handleApprove(detailTransaction.id, editForm.category, editForm.subcategory);
    setShowDetailDialog(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <SpinnerGap size={48} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="reconciliation-page">
      {/* Duplicate Review Dialog */}
      <Dialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy size={24} className="text-orange-500" />
              Revisar Posible Duplicado
            </DialogTitle>
            <DialogDescription>
              Compara las dos transacciones y decide cuál conservar
            </DialogDescription>
          </DialogHeader>
          {selectedPair && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Original */}
                <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText size={18} className="text-emerald-600" />
                    <span className="font-medium text-emerald-800 dark:text-emerald-400">Original</span>
                  </div>
                  <p className="font-semibold">{selectedPair.original?.description}</p>
                  <p className="text-2xl font-mono mt-2">{formatCurrency(selectedPair.original?.amount)}</p>
                  <p className="text-sm text-muted-foreground mt-1">{selectedPair.original?.date}</p>
                  <p className="text-sm">{selectedPair.original?.establishment}</p>
                  <Badge className="mt-2">{selectedPair.original?.source_type || "manual"}</Badge>
                </div>
                
                {/* Duplicate */}
                <div className="p-4 rounded-lg bg-orange-50 dark:bg-orange-900/10 border border-orange-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Copy size={18} className="text-orange-600" />
                    <span className="font-medium text-orange-800 dark:text-orange-400">Posible Duplicado</span>
                  </div>
                  <p className="font-semibold">{selectedPair.duplicate?.description}</p>
                  <p className="text-2xl font-mono mt-2">{formatCurrency(selectedPair.duplicate?.amount)}</p>
                  <p className="text-sm text-muted-foreground mt-1">{selectedPair.duplicate?.date}</p>
                  <p className="text-sm">{selectedPair.duplicate?.establishment}</p>
                  <Badge className="mt-2">{selectedPair.duplicate?.source_type || "manual"}</Badge>
                </div>
              </div>
              
              <div className="p-3 rounded-lg bg-muted">
                <div className="flex justify-between text-sm">
                  <span>Confianza de coincidencia:</span>
                  <Badge variant={selectedPair.confidence >= 80 ? "destructive" : "secondary"}>
                    {selectedPair.confidence}%
                  </Badge>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span>Diferencia de fechas:</span>
                  <span>{selectedPair.date_diff_days} días</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={() => handleNotDuplicate(selectedPair?.duplicate?.id)}
            >
              No es duplicado
            </Button>
            <Button 
              variant="outline"
              onClick={() => handleConfirmDuplicate(selectedPair?.duplicate?.id, false)}
              className="text-orange-600"
            >
              Conservar nuevo, eliminar original
            </Button>
            <Button 
              onClick={() => handleConfirmDuplicate(selectedPair?.duplicate?.id, true)}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Conservar original
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category Edit Dialog */}
      <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Corregir Categoría</DialogTitle>
            <DialogDescription>
              Selecciona la categoría correcta antes de aprobar
            </DialogDescription>
          </DialogHeader>
          {editingTransaction && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted">
                <p className="font-medium">{editingTransaction.description}</p>
                <p className="text-lg font-mono">{formatCurrency(editingTransaction.amount)}</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Categoría SRI</label>
                <Select value={newCategory} onValueChange={setNewCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORIES).map(([key, cat]) => (
                      <SelectItem key={key} value={key}>
                        {cat.name} {cat.deductible ? "✓" : "✗"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCategoryDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={() => handleApprove(editingTransaction?.id, newCategory)}>
              Aprobar con categoría
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Scales size={32} className="text-primary" weight="duotone" />
            Conciliación
          </h1>
          <p className="text-muted-foreground">
            Revisa, categoriza y aprueba transacciones (estilo QuickBooks)
          </p>
        </div>
        {selectedItems.length > 0 && (
          <Button onClick={handleBulkApprove} className="gap-2">
            <CheckSquare size={18} />
            Aprobar {selectedItems.length} seleccionadas
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bento-card">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-amber-600">{stats.pending_review || 0}</p>
            <p className="text-sm text-muted-foreground">Pendientes</p>
          </CardContent>
        </Card>
        <Card className="bento-card">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-orange-600">{stats.duplicate_suspect || 0}</p>
            <p className="text-sm text-muted-foreground">Duplicados</p>
          </CardContent>
        </Card>
        <Card className="bento-card">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-emerald-600">{stats.approved || 0}</p>
            <p className="text-sm text-muted-foreground">Aprobados</p>
          </CardContent>
        </Card>
        <Card className="bento-card">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-red-600">{stats.rejected || 0}</p>
            <p className="text-sm text-muted-foreground">Rechazados</p>
          </CardContent>
        </Card>
        <Card className="bento-card">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-primary">{formatCurrency(stats.total_pending_amount)}</p>
            <p className="text-sm text-muted-foreground">Por revisar</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Card className="bento-card">
        <CardContent className="p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="pending" className="gap-2">
                <Receipt size={18} />
                Pendientes ({pendingData.pending_review?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="duplicates" className="gap-2">
                <Copy size={18} />
                Posibles Duplicados ({duplicatePairs.length})
              </TabsTrigger>
            </TabsList>

            {/* Pending Tab */}
            <TabsContent value="pending">
              {pendingData.pending_review?.length > 0 && (
                <div className="flex justify-between items-center mb-4">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => selectAll(pendingData.pending_review)}
                  >
                    Seleccionar todas
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Total: {formatCurrency(pendingData.stats?.pending_amount)}
                  </span>
                </div>
              )}
              
              {pendingData.pending_review?.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle size={48} className="mx-auto mb-4 text-emerald-500" />
                  <p>¡No hay transacciones pendientes!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <AnimatePresence>
                    {pendingData.pending_review.map((t, index) => (
                      <TransactionCard
                        key={t.id}
                        transaction={t}
                        index={index}
                        formatCurrency={formatCurrency}
                        selected={selectedItems.includes(t.id)}
                        onToggleSelect={() => toggleSelectItem(t.id)}
                        onApprove={() => handleApprove(t.id)}
                        onReject={() => handleReject(t.id)}
                        onEditCategory={() => openCategoryDialog(t)}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </TabsContent>

            {/* Duplicates Tab */}
            <TabsContent value="duplicates">
              {duplicatePairs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle size={48} className="mx-auto mb-4 text-emerald-500" />
                  <p>¡No hay duplicados detectados!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {duplicatePairs.map((pair, index) => (
                    <motion.div
                      key={pair.duplicate?.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="p-4 rounded-xl bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <Warning size={24} className="text-orange-500" />
                          <div>
                            <p className="font-medium">{pair.duplicate?.description}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="font-mono font-semibold">
                                {formatCurrency(pair.duplicate?.amount)}
                              </span>
                              <ArrowRight size={16} className="text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">
                                Similar a: {pair.original?.description}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant={pair.confidence >= 80 ? "destructive" : "secondary"}>
                            {pair.confidence}% similar
                          </Badge>
                          <Button 
                            size="sm"
                            onClick={() => {
                              setSelectedPair(pair);
                              setShowDuplicateDialog(true);
                            }}
                          >
                            <Eye size={16} className="mr-1" />
                            Revisar
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function TransactionCard({ transaction, index, formatCurrency, selected, onToggleSelect, onApprove, onReject, onEditCategory }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      transition={{ delay: index * 0.02 }}
      className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
        selected 
          ? "bg-primary/5 border-primary" 
          : "bg-muted/50 border-transparent hover:bg-muted"
      }`}
    >
      <Checkbox 
        checked={selected} 
        onCheckedChange={onToggleSelect}
      />
      
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <p className="font-medium">{transaction.description}</p>
          {transaction.has_receipt && (
            <Badge variant="outline" className="text-xs">
              <Receipt size={12} className="mr-1" /> Recibo
            </Badge>
          )}
          {transaction.has_invoice && (
            <Badge variant="outline" className="text-xs">
              <FileText size={12} className="mr-1" /> Factura
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
          <span>{transaction.date ? format(new Date(transaction.date), "d MMM yyyy", { locale: es }) : ""}</span>
          {transaction.establishment && <span>• {transaction.establishment}</span>}
          <Badge className={STATUS_COLORS[transaction.category] || STATUS_COLORS.pending_review}>
            {CATEGORIES[transaction.category]?.name || transaction.category}
          </Badge>
        </div>
      </div>
      
      <div className="text-right">
        <p className="font-mono font-semibold text-lg">{formatCurrency(transaction.amount)}</p>
        <p className="text-xs text-muted-foreground">{transaction.source_type || "manual"}</p>
      </div>
      
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onEditCategory}>
          <Scales size={16} />
        </Button>
        <Button variant="outline" size="sm" onClick={onReject} className="text-red-600 hover:text-red-700">
          <XCircle size={16} />
        </Button>
        <Button size="sm" onClick={onApprove} className="bg-emerald-600 hover:bg-emerald-700">
          <CheckCircle size={16} />
        </Button>
      </div>
    </motion.div>
  );
}
