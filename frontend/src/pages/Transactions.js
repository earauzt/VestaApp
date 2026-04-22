import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "../components/ui/dialog";
import { Badge } from "../components/ui/badge";
import { DateInput } from "../components/ui/date-input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "../components/ui/dropdown-menu";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { 
  Plus, 
  Trash, 
  Pencil, 
  CalendarBlank,
  MagnifyingGlass,
  ArrowUp,
  ArrowDown,
  Funnel,
  Airplane,
  Warning,
  DotsThreeVertical,
  Scissors,
  Target,
  Paperclip,
  Gear,
  CheckCircle,
  Eye
} from "@phosphor-icons/react";
import {
  Check as LICheck,
} from "lucide-react";
import { components, typography } from "../styles/design-system";
import { SRI_CATEGORIES, INCOME_SOURCES } from "../constants/categories";
import { displayName } from "../utils/displayName";
import TransactionEditModal from "../components/shared/TransactionEditModal";

// Import new QuickBooks-style components
import { SplitTransactionModal } from "../components/SplitTransactionModal";
import { AttachmentUploader, AttachmentViewer } from "../components/AttachmentUploader";
import { ExportButtons } from "../components/ExportButtons";
import { CategoryRulesManager } from "../components/CategoryRulesManager";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Unified category pill style. The name itself is the differentiator, not the color.
const CATEGORY_PILL = "bg-slate-100 text-[#0D9E82] dark:bg-slate-800 dark:text-[#0D9E82]";
const CATEGORY_COLORS = new Proxy({}, { get: () => CATEGORY_PILL });

// Fallback categories (will be replaced by backend data)
const FALLBACK_CATEGORIES = {
  servicios_basicos: { name: "Servicios Básicos", subcategories: ["Luz", "Agua", "Internet", "Gas", "Teléfono"] },
  comida: { name: "Comida", subcategories: ["Supermercado", "Mercado"] },
  restaurantes: { name: "Restaurantes", subcategories: ["Restaurantes", "Delivery", "Cafetería"] },
  carros: { name: "Carros", subcategories: ["Gasolina", "Mantenimiento", "Seguro vehicular"] },
  otros: { name: "Otros", subcategories: ["Varios", "Entretenimiento"] }
};

// SRI_CATEGORIES and INCOME_SOURCES centralizados en /constants/categories.js

export default function Transactions() {
  const { getAuthHeaders, user } = useAuth();

  const getAuthHeadersRef = useRef(getAuthHeaders);
  useEffect(() => { getAuthHeadersRef.current = getAuthHeaders; });
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState(FALLBACK_CATEGORIES);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterPeriod, setFilterPeriod] = useState("all"); // all, this_month, last_month, this_year
  
  // International transaction popup
  const [showInternationalPopup, setShowInternationalPopup] = useState(false);
  const [pendingFormData, setPendingFormData] = useState(null);

  // QuickBooks-style modals
  const [splitModalOpen, setSplitModalOpen] = useState(false);
  const [splitTransaction, setSplitTransaction] = useState(null);
  const [attachmentModalOpen, setAttachmentModalOpen] = useState(false);
  const [attachmentTransaction, setAttachmentTransaction] = useState(null);
  const [rulesModalOpen, setRulesModalOpen] = useState(false);

  // Bulk categorization state
  const [bulkSelectedIds, setBulkSelectedIds] = useState([]);
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkSubcategory, setBulkSubcategory] = useState("");
  const [bulkApplying, setBulkApplying] = useState(false);

  // Recategorize modal (uses shared TransactionEditModal)
  const [recatTx, setRecatTx] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    amount: "",
    description: "",
    category: "",
    subcategory: "",
    sri_category: "",
    sri_subcategory: "",
    date: new Date(),
    transaction_type: "expense",
    source: "",
    establishment: "",
    country: "",
    payment_source: "local",
    is_international: false,
    uso_empresarial: false,
    beneficiario: "yo",
    aplica_iva: true,
    subtotal_sin_iva: ""
  });

  // Fetch categories from budget
  const fetchCategories = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/budget/categories`, { headers: getAuthHeadersRef.current() });
      if (response.data?.categories) {
        // Transform budget categories to transaction categories format
        const budgetCats = response.data.categories;
        const transformedCats = {};
        
        Object.entries(budgetCats).forEach(([key, cat]) => {
          const subcats = cat.subcategories;
          let subcatArray = [];
          
          if (typeof subcats === 'object' && !Array.isArray(subcats)) {
            subcatArray = Object.keys(subcats);
          } else if (Array.isArray(subcats)) {
            subcatArray = subcats;
          }
          
          transformedCats[key] = {
            name: cat.name,
            subcategories: subcatArray.length > 0 ? subcatArray : ["General"]
          };
        });
        
        setCategories(transformedCats);
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') console.log("Using fallback categories");
    }
  }, []);

  const fetchTransactions = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/transactions`, { headers: getAuthHeadersRef.current() });
      setTransactions(response.data);
    } catch (error) {
      // Silenciar 404 al cargar (sin transacciones aún o endpoint temporalmente vacío)
      if (error.response?.status !== 404) {
        toast.error("Error al cargar transacciones");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
    fetchTransactions();
  }, [fetchCategories, fetchTransactions]);

  const handleRecategorize = async (data) => {
    if (!recatTx) return;
    try {
      const res = await axios.post(
        `${API}/transactions/bulk-categorize`,
        { ids: [recatTx.id], category: data.category, subcategory: data.subcategory || "" },
        { headers: getAuthHeadersRef.current() }
      );
      toast.success(`${res.data?.updated ?? 1} transacción actualizada`);
      setRecatTx(null);
      fetchTransactions();
    } catch (e) {
      toast.error(e.response?.data?.detail || "No se pudo recategorizar");
    }
  };

  const toggleBulkSelect = (id) => {
    setBulkSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleBulkApply = async () => {
    if (!bulkCategory || bulkSelectedIds.length === 0) return;
    setBulkApplying(true);
    try {
      const headers = getAuthHeadersRef.current();
      const res = await axios.post(
        `${API}/transactions/bulk-categorize`,
        { ids: bulkSelectedIds, category: bulkCategory, subcategory: bulkSubcategory || "" },
        { headers }
      );
      toast.success(`${res.data?.updated ?? bulkSelectedIds.length} transacciones actualizadas`);
      setBulkSelectedIds([]);
      setBulkCategory("");
      setBulkSubcategory("");
      fetchTransactions();
    } catch (e) {
      toast.error(e.response?.data?.detail || "No se pudieron actualizar las transacciones");
    } finally {
      setBulkApplying(false);
    }
  };

  // Check if transaction might be international
  const checkInternational = (description, establishment, country) => {
    const intlKeywords = ["usa", "united states", "estados unidos", "us ", "miami", "new york", "los angeles", "houston", "amazon.com", "apple.com", "europe", "europa", "spain", "españa"];
    const text = `${description} ${establishment} ${country}`.toLowerCase();
    return intlKeywords.some(keyword => text.includes(keyword));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Check if it might be international
    if (formData.transaction_type === "expense" && !formData.is_international) {
      const mightBeInternational = checkInternational(formData.description, formData.establishment, formData.country);
      if (mightBeInternational) {
        setPendingFormData(formData);
        setShowInternationalPopup(true);
        return;
      }
    }
    
    await submitTransaction(formData);
  };

  const submitTransaction = async (data) => {
    try {
      const payload = {
        ...data,
        amount: parseFloat(data.amount),
        date: format(data.date, "yyyy-MM-dd"),
        subtotal_sin_iva: data.subtotal_sin_iva === "" || data.subtotal_sin_iva == null ? null : parseFloat(data.subtotal_sin_iva)
      };

      if (editingTransaction) {
        await axios.put(
          `${API}/transactions/${editingTransaction.id}`,
          payload,
          { headers: getAuthHeaders() }
        );
        toast.success("Transacción actualizada");
      } else {
        await axios.post(`${API}/transactions`, payload, { headers: getAuthHeaders() });
        toast.success("Transacción creada");
      }

      setDialogOpen(false);
      resetForm();
      fetchTransactions();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al guardar");
    }
  };

  const handleConfirmInternational = async (isInternational) => {
    if (pendingFormData) {
      const updatedData = {
        ...pendingFormData,
        is_international: isInternational,
        category: isInternational ? "viajes_internacionales" : pendingFormData.category,
        subcategory: isInternational ? "USA" : pendingFormData.subcategory,
        payment_source: isInternational ? "internacional" : pendingFormData.payment_source
      };
      await submitTransaction(updatedData);
    }
    setShowInternationalPopup(false);
    setPendingFormData(null);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Eliminar esta transacción?")) return;
    try {
      await axios.delete(`${API}/transactions/${id}`, { headers: getAuthHeaders() });
      toast.success("Transacción eliminada");
      fetchTransactions();
    } catch (error) {
      toast.error("Error al eliminar");
    }
  };

  const handleEdit = (transaction) => {
    setEditingTransaction(transaction);
    setFormData({
      amount: transaction.amount.toString(),
      description: transaction.description,
      category: transaction.category,
      subcategory: transaction.subcategory || "",
      sri_category: transaction.sri_category || "",
      sri_subcategory: transaction.sri_subcategory || "",
      date: new Date(transaction.date),
      transaction_type: transaction.transaction_type,
      source: transaction.source || "",
      establishment: transaction.establishment || "",
      country: transaction.country || "",
      payment_source: transaction.payment_source || "local",
      is_international: transaction.is_international || false,
      uso_empresarial: transaction.uso_empresarial || false,
      beneficiario: transaction.beneficiario || "yo",
      aplica_iva: transaction.aplica_iva !== false,
      subtotal_sin_iva: transaction.subtotal_sin_iva ?? ""
    });
    setDialogOpen(true);
  };

  const handleSplit = (transaction) => {
    setSplitTransaction(transaction);
    setSplitModalOpen(true);
  };

  const handleAttachment = (transaction) => {
    setAttachmentTransaction(transaction);
    setAttachmentModalOpen(true);
  };

  const resetForm = () => {
    setEditingTransaction(null);
    setFormData({
      amount: "",
      description: "",
      category: "",
      subcategory: "",
      sri_category: "",
      sri_subcategory: "",
      date: new Date(),
      transaction_type: "expense",
      source: "",
      establishment: "",
      country: "",
      payment_source: "local",
      is_international: false,
      uso_empresarial: false,
      beneficiario: "yo",
      aplica_iva: true,
      subtotal_sin_iva: ""
    });
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-EC', {
      style: 'currency',
      currency: 'USD'
    }).format(value || 0);
  };

  const filteredTransactions = transactions.filter(t => {
    const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         t.establishment?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === "all" || t.category === filterCategory;
    const matchesType = filterType === "all" || t.transaction_type === filterType;
    
    // Period filter
    let matchesPeriod = true;
    if (filterPeriod !== "all" && t.date) {
      const txDate = new Date(t.date);
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      
      if (filterPeriod === "this_month") {
        matchesPeriod = txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;
      } else if (filterPeriod === "last_month") {
        const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
        matchesPeriod = txDate.getMonth() === lastMonth && txDate.getFullYear() === lastMonthYear;
      } else if (filterPeriod === "this_year") {
        matchesPeriod = txDate.getFullYear() === currentYear;
      }
    }
    
    return matchesSearch && matchesCategory && matchesType && matchesPeriod;
  });

  const canEdit = user?.role === "admin" || user?.role === "spouse";

  // Calculate current date range for export
  const currentYear = new Date().getFullYear();

  return (
    <div className="space-y-6" data-testid="transactions-page">
      {/* QuickBooks-style Modals */}
      <SplitTransactionModal
        open={splitModalOpen}
        onOpenChange={setSplitModalOpen}
        transaction={splitTransaction}
        onSplitComplete={fetchTransactions}
      />
      
      <AttachmentUploader
        open={attachmentModalOpen}
        onOpenChange={setAttachmentModalOpen}
        transaction={attachmentTransaction}
        onUploadComplete={fetchTransactions}
      />
      
      <CategoryRulesManager
        open={rulesModalOpen}
        onOpenChange={setRulesModalOpen}
      />

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
            {pendingFormData && (
              <div className="mt-4 p-3 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground">Transacción:</p>
                <p className="font-medium">{pendingFormData.description}</p>
                <p className="text-lg font-mono">{formatCurrency(parseFloat(pendingFormData.amount) || 0)}</p>
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transacciones</h1>
          <p className="text-muted-foreground">Gestiona tus ingresos y gastos con funciones estilo QuickBooks</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Export Button */}
          <ExportButtons year={currentYear} />
          
          {/* Rules Button */}
          <Button 
            variant="outline" 
            className="gap-2" 
            onClick={() => setRulesModalOpen(true)}
            data-testid="rules-btn"
          >
            <Gear size={18} />
            <span className="hidden sm:inline">Reglas</span>
          </Button>

          {/* Add Transaction */}
          {canEdit && (
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button className="rounded-full gap-2" data-testid="add-transaction-btn">
                  <Plus size={18} weight="bold" />
                  Nueva transacción
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px] overflow-y-auto max-h-[90vh]">
                <DialogHeader>
                  <DialogTitle>
                    {editingTransaction ? "Editar transacción" : "Nueva transacción"}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Type selector */}
                  <div className="grid grid-cols-2 gap-4">
                    <Button
                      type="button"
                      variant={formData.transaction_type === "expense" ? "default" : "outline"}
                      onClick={() => setFormData({ ...formData, transaction_type: "expense" })}
                      className="gap-2"
                      data-testid="type-expense"
                    >
                      <ArrowDown size={18} className="text-red-500" />
                      Gasto
                    </Button>
                    <Button
                      type="button"
                      variant={formData.transaction_type === "income" ? "default" : "outline"}
                      onClick={() => setFormData({ ...formData, transaction_type: "income" })}
                      className="gap-2"
                      data-testid="type-income"
                    >
                      <ArrowUp size={18} className="text-emerald-500" />
                      Ingreso
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Monto</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        required
                        data-testid="amount-input"
                      />
                    </div>
                    <DateInput
                      label="Fecha"
                      value={formData.date}
                      onChange={(date) => setFormData({ ...formData, date })}
                      data-testid="date-picker"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Descripción</Label>
                    <Input
                      placeholder="Descripción de la transacción"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      required
                      data-testid="description-input"
                    />
                  </div>

                  {formData.transaction_type === "expense" ? (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Categoría</Label>
                          <Select 
                            value={formData.category} 
                            onValueChange={(value) => setFormData({ ...formData, category: value, subcategory: "" })}
                          >
                            <SelectTrigger data-testid="category-select">
                              <SelectValue placeholder="Seleccionar" />
                            </SelectTrigger>
                            <SelectContent className="z-[250]">
                              {Object.entries(categories).map(([key, cat]) => (
                                <SelectItem key={key} value={key}>
                                  <span className="flex items-center gap-2">
                                    {cat.name}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Subcategoría</Label>
                          <Select 
                            value={formData.subcategory} 
                            onValueChange={(value) => setFormData({ ...formData, subcategory: value })}
                            disabled={!formData.category}
                          >
                            <SelectTrigger data-testid="subcategory-select">
                              <SelectValue placeholder="Seleccionar" />
                            </SelectTrigger>
                            <SelectContent className="z-[250]">
                              {formData.category && categories[formData.category]?.subcategories?.map((sub) => (
                                <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      {/* Categorías SRI para deducciones fiscales */}
                      <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
                        <Label className="text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-2 mb-3">
                          <CheckCircle size={16} />
                          Categorización SRI (Deducciones)
                        </Label>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Categoría SRI</Label>
                            <Select 
                              value={formData.sri_category} 
                              onValueChange={(value) => setFormData({ ...formData, sri_category: value, sri_subcategory: "" })}
                            >
                              <SelectTrigger data-testid="sri-category-select">
                                <SelectValue placeholder="Seleccionar" />
                              </SelectTrigger>
                              <SelectContent className="z-[250]">
                                {Object.entries(SRI_CATEGORIES).map(([key, cat]) => {
                                  const CIcon = cat.Icon;
                                  return (
                                  <SelectItem key={key} value={key}>
                                    <span className="flex items-center gap-2">
                                      <CIcon size={14} className="text-slate-500" />
                                      {cat.name}
                                      {cat.deductible && <CheckCircle size={12} className="text-emerald-500" />}
                                    </span>
                                  </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Subcategoría SRI</Label>
                            <Select 
                              value={formData.sri_subcategory} 
                              onValueChange={(value) => setFormData({ ...formData, sri_subcategory: value })}
                              disabled={!formData.sri_category}
                            >
                              <SelectTrigger data-testid="sri-subcategory-select">
                                <SelectValue placeholder="Seleccionar" />
                              </SelectTrigger>
                              <SelectContent className="z-[250]">
                                {formData.sri_category && SRI_CATEGORIES[formData.sri_category]?.subcategories?.map((sub) => (
                                  <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        {formData.sri_category && SRI_CATEGORIES[formData.sri_category]?.deductible && (
                          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2 flex items-center gap-1">
                            <LICheck size={12} /> Este gasto es deducible para el SRI
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label>Establecimiento (opcional)</Label>
                        <Input
                          placeholder="Nombre del comercio"
                          value={formData.establishment}
                          onChange={(e) => setFormData({ ...formData, establishment: e.target.value })}
                          data-testid="establishment-input"
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border">
                        <div>
                          <Label className="cursor-pointer" htmlFor="uso-empresarial-toggle">Uso empresarial</Label>
                          <p className="text-xs text-muted-foreground">Excluye esta factura del cálculo SRI personal</p>
                        </div>
                        <input
                          id="uso-empresarial-toggle"
                          type="checkbox"
                          className="h-5 w-5 accent-[#0D9E82]"
                          checked={formData.uso_empresarial}
                          onChange={(e) => setFormData({ ...formData, uso_empresarial: e.target.checked })}
                          data-testid="uso-empresarial-toggle"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Beneficiario</Label>
                        <Select
                          value={formData.beneficiario}
                          onValueChange={(v) => setFormData({ ...formData, beneficiario: v })}
                        >
                          <SelectTrigger data-testid="beneficiario-select">
                            <SelectValue placeholder="Yo mismo" />
                          </SelectTrigger>
                          <SelectContent className="z-[250]">
                            <SelectItem value="yo">Yo mismo</SelectItem>
                            <SelectItem value="conyuge">Cónyuge</SelectItem>
                            <SelectItem value="hijo">Hijo/a</SelectItem>
                            <SelectItem value="padre_madre">Padre/Madre</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">Las facturas de dependientes también son deducibles</p>
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border">
                        <div>
                          <Label className="cursor-pointer" htmlFor="aplica-iva-toggle">Aplica IVA</Label>
                          <p className="text-xs text-muted-foreground">Si no aplica, usa el subtotal para la deducción</p>
                        </div>
                        <input
                          id="aplica-iva-toggle"
                          type="checkbox"
                          className="h-5 w-5 accent-[#0D9E82]"
                          checked={formData.aplica_iva}
                          onChange={(e) => setFormData({ ...formData, aplica_iva: e.target.checked })}
                          data-testid="aplica-iva-toggle"
                        />
                      </div>

                      {!formData.aplica_iva && (
                        <div className="space-y-2">
                          <Label>Subtotal sin IVA</Label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              className="pl-8"
                              value={formData.subtotal_sin_iva}
                              onChange={(e) => setFormData({ ...formData, subtotal_sin_iva: e.target.value })}
                              data-testid="subtotal-sin-iva-input"
                            />
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="space-y-2">
                      <Label>Fuente de ingreso</Label>
                      <Select 
                        value={formData.source} 
                        onValueChange={(value) => setFormData({ ...formData, source: value })}
                      >
                        <SelectTrigger data-testid="source-select">
                          <SelectValue placeholder="Seleccionar fuente" />
                        </SelectTrigger>
                        <SelectContent className="z-[250]">
                          {INCOME_SOURCES.map((source) => (
                            <SelectItem key={source} value={source}>{source}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <DialogFooter className="sticky bottom-0 bg-white pt-3 border-t border-slate-200 mt-4">
                    <Button type="submit" data-testid="save-transaction">
                      {editingTransaction ? "Actualizar" : "Guardar"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card className="bento-card">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <Input
                placeholder="Buscar por descripción o establecimiento..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="search-input"
              />
            </div>
            <Select value={filterPeriod} onValueChange={setFilterPeriod}>
              <SelectTrigger className="w-[150px]" data-testid="filter-period">
                <CalendarBlank size={18} className="mr-2" />
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todo el tiempo</SelectItem>
                <SelectItem value="this_month">Este mes</SelectItem>
                <SelectItem value="last_month">Mes anterior</SelectItem>
                <SelectItem value="this_year">Este año</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[180px]" data-testid="filter-category">
                <Funnel size={18} className="mr-2" />
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {Object.entries(categories).map(([key, cat]) => (
                  <SelectItem key={key} value={key}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[150px]" data-testid="filter-type">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="expense">Gastos</SelectItem>
                <SelectItem value="income">Ingresos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Bulk categorization toolbar */}
      {bulkSelectedIds.length > 0 && (
        <Card className="bento-card border-[#0D9E82] bg-[#0D9E82]/5" data-testid="bulk-toolbar">
          <CardContent className="p-3 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
            <span className="text-sm font-medium text-slate-700">
              {bulkSelectedIds.length} seleccionada{bulkSelectedIds.length !== 1 ? "s" : ""}
            </span>
            <Select value={bulkCategory} onValueChange={(v) => { setBulkCategory(v); setBulkSubcategory(""); }}>
              <SelectTrigger className="w-full sm:w-[180px]" data-testid="bulk-category-select">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent className="z-[250]">
                {Object.entries(categories).map(([key, cat]) => (
                  <SelectItem key={key} value={key}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={bulkSubcategory} onValueChange={setBulkSubcategory} disabled={!bulkCategory}>
              <SelectTrigger className="w-full sm:w-[180px]" data-testid="bulk-subcategory-select">
                <SelectValue placeholder="Subcategoría" />
              </SelectTrigger>
              <SelectContent className="z-[250]">
                {bulkCategory && categories[bulkCategory]?.subcategories?.map((sub) => (
                  <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={handleBulkApply}
              disabled={!bulkCategory || bulkApplying}
              className="bg-[#0D9E82] hover:bg-[#0B8A70] text-white"
              data-testid="bulk-apply-btn"
            >
              {bulkApplying ? "Aplicando..." : `Aplicar a ${bulkSelectedIds.length} transacciones`}
            </Button>
            <Button variant="outline" onClick={() => setBulkSelectedIds([])}>Cancelar</Button>
          </CardContent>
        </Card>
      )}

      {/* Transactions List */}
      <Card className="bento-card">
        <CardHeader>
          <CardTitle className="text-lg">
            {filteredTransactions.length} transacciones
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Cargando...</div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay transacciones que mostrar
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {filteredTransactions.map((transaction, index) => (
                  <motion.div
                    key={transaction.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2, delay: index * 0.02 }}
                    className="flex items-center gap-3 px-3 py-2.5 bg-white border-b border-slate-100 hover:bg-slate-50 transition-colors"
                    data-testid={`transaction-${transaction.id}`}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[#0D9E82] cursor-pointer shrink-0"
                      checked={bulkSelectedIds.includes(transaction.id)}
                      onChange={() => toggleBulkSelect(transaction.id)}
                      onClick={(e) => e.stopPropagation()}
                      data-testid={`bulk-checkbox-${transaction.id}`}
                      aria-label="Seleccionar transacción"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-800 truncate" data-testid={`txname-${transaction.id}`}>
                          {displayName(transaction)}
                        </p>
                        {transaction.is_split && (
                          <Badge variant="outline" className="text-xs gap-1 shrink-0"><Scissors size={12} />Split</Badge>
                        )}
                        {transaction.linked_goal_name && (
                          <Badge variant="outline" className="text-xs gap-1 bg-slate-100 text-[#0D9E82] border-slate-200 shrink-0" data-testid="linked-goal-badge">
                            <Target size={12} />{transaction.linked_goal_name}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-slate-400">
                          {format(new Date(transaction.date), "d MMM yyyy", { locale: es })}
                        </span>
                        {transaction.category && (
                          <span
                            className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200"
                            data-testid={`tx-category-${transaction.id}`}
                          >
                            {(categories[transaction.category]?.name || transaction.category)}
                            {transaction.subcategory ? ` · ${transaction.subcategory}` : ""}
                          </span>
                        )}
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">
                          {transaction.source === "gmail" || transaction.source === "factura_sri" ? "Gmail" : transaction.source === "statement" ? "Estado cuenta" : "Manual"}
                        </span>
                        {(transaction.status === "approved" || transaction.estado === "aprobado") && (
                          <span
                            className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full"
                            data-testid={`tx-validated-${transaction.id}`}
                          >
                            Validada
                          </span>
                        )}
                        {(transaction.matched_rule || transaction.auto_categorized) && (
                          <span
                            className="text-xs bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1"
                            data-testid={`tx-auto-${transaction.id}`}
                          >
                            <Gear size={10} />Auto
                          </span>
                        )}
                        {transaction.attachments?.length > 0 && (
                          <AttachmentViewer attachments={transaction.attachments} transactionId={transaction.id} />
                        )}
                      </div>
                    </div>
                    <span className={`text-sm font-semibold shrink-0 ${transaction.transaction_type === "income" ? "text-emerald-600" : "text-red-600"}`}>
                      {transaction.transaction_type === "income" ? "+" : "-"}{formatCurrency(transaction.amount)}
                    </span>
                    {canEdit && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" data-testid={`actions-${transaction.id}`}>
                            <DotsThreeVertical size={18} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(transaction)} className="gap-2">
                            <Pencil size={16} />Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setRecatTx(transaction)} className="gap-2" data-testid={`recat-${transaction.id}`}>
                            <Target size={16} />Recategorizar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleAttachment(transaction)} className="gap-2">
                            <Paperclip size={16} />Adjuntar documento
                          </DropdownMenuItem>
                          {transaction.transaction_type === "expense" && !transaction.is_split && (
                            <DropdownMenuItem onClick={() => handleSplit(transaction)} className="gap-2">
                              <Scissors size={16} />Dividir transacción
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDelete(transaction.id)}
                            className="gap-2 text-destructive focus:text-destructive"
                          >
                            <Trash size={16} />Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      </Card>

      <TransactionEditModal
        open={!!recatTx}
        transaction={recatTx}
        onSave={handleRecategorize}
        onClose={() => setRecatTx(null)}
      />
    </div>
  );
}
