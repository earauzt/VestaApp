import { useState, useEffect } from "react";
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
import { Calendar } from "../components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
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
  Warning
} from "@phosphor-icons/react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CATEGORY_COLORS = {
  alimentacion: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  salud: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400",
  educacion: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400",
  vivienda: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  vestimenta: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  transporte: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  viajes_internacionales: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  otros: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
};

const CATEGORIES = {
  alimentacion: { name: "Alimentación", subcategories: ["Comida", "Restaurantes", "Supermercado"], deductible: true },
  salud: { name: "Salud", subcategories: ["Seguros", "Medicina", "Consultas"], deductible: true },
  educacion: { name: "Educación", subcategories: ["Colegio y actividades", "Cursos", "Materiales"], deductible: true },
  vivienda: { name: "Vivienda", subcategories: ["Servicios básicos", "Arriendo", "Mantenimiento"], deductible: true },
  vestimenta: { name: "Vestimenta", subcategories: ["Ropa", "Calzado", "Accesorios"], deductible: true },
  transporte: { name: "Transporte", subcategories: ["Carros", "Combustible", "Mantenimiento vehicular"], deductible: false },
  viajes_internacionales: { name: "Viajes Internacionales", subcategories: ["USA", "Europa", "Otros países"], deductible: false },
  otros: { name: "Otros", subcategories: ["Empleados", "Entretenimiento", "Varios"], deductible: false }
};

const INCOME_SOURCES = ["Personal", "APX", "USA"];
const PAYMENT_SOURCES = [
  { value: "local", label: "Tarjeta Local (Ecuador)" },
  { value: "internacional", label: "Tarjeta Extranjera (USA/Otro)" }
];

export default function Transactions() {
  const { getAuthHeaders, user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterType, setFilterType] = useState("all");
  
  // International transaction popup
  const [showInternationalPopup, setShowInternationalPopup] = useState(false);
  const [pendingFormData, setPendingFormData] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    amount: "",
    description: "",
    category: "",
    subcategory: "",
    date: new Date(),
    transaction_type: "expense",
    source: "",
    establishment: "",
    country: "",
    payment_source: "local",
    is_international: false
  });

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    try {
      const response = await axios.get(`${API}/transactions`, { headers: getAuthHeaders() });
      setTransactions(response.data);
    } catch (error) {
      toast.error("Error al cargar transacciones");
    } finally {
      setLoading(false);
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
        date: format(data.date, "yyyy-MM-dd")
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
      subcategory: transaction.subcategory,
      date: new Date(transaction.date),
      transaction_type: transaction.transaction_type,
      source: transaction.source || "",
      establishment: transaction.establishment || "",
      country: transaction.country || "",
      payment_source: transaction.payment_source || "local",
      is_international: transaction.is_international || false
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingTransaction(null);
    setFormData({
      amount: "",
      description: "",
      category: "",
      subcategory: "",
      date: new Date(),
      transaction_type: "expense",
      source: "",
      establishment: "",
      country: "",
      payment_source: "local",
      is_international: false
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
    return matchesSearch && matchesCategory && matchesType;
  });

  const canEdit = user?.role === "admin" || user?.role === "spouse";

  return (
    <div className="space-y-6" data-testid="transactions-page">
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
          <p className="text-muted-foreground">Gestiona tus ingresos y gastos</p>
        </div>
        {canEdit && (
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="rounded-full gap-2" data-testid="add-transaction-btn">
                <Plus size={18} weight="bold" />
                Nueva transacción
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
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
                  <div className="space-y-2">
                    <Label>Fecha</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start gap-2" data-testid="date-picker">
                          <CalendarBlank size={18} />
                          {format(formData.date, "PPP", { locale: es })}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={formData.date}
                          onSelect={(date) => date && setFormData({ ...formData, date })}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
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
                        <Label>Categoría SRI</Label>
                        <Select 
                          value={formData.category} 
                          onValueChange={(value) => setFormData({ ...formData, category: value, subcategory: "" })}
                        >
                          <SelectTrigger data-testid="category-select">
                            <SelectValue placeholder="Seleccionar" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(CATEGORIES).map(([key, cat]) => (
                              <SelectItem key={key} value={key}>{cat.name}</SelectItem>
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
                          <SelectContent>
                            {formData.category && CATEGORIES[formData.category]?.subcategories.map((sub) => (
                              <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
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
                      <SelectContent>
                        {INCOME_SOURCES.map((source) => (
                          <SelectItem key={source} value={source}>{source}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <DialogFooter>
                  <Button type="submit" data-testid="save-transaction">
                    {editingTransaction ? "Actualizar" : "Guardar"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
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
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[180px]" data-testid="filter-category">
                <Funnel size={18} className="mr-2" />
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {Object.entries(CATEGORIES).map(([key, cat]) => (
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
                    className="flex items-center justify-between p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                    data-testid={`transaction-${transaction.id}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-full ${
                        transaction.transaction_type === "income" 
                          ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30" 
                          : "bg-red-100 text-red-600 dark:bg-red-900/30"
                      }`}>
                        {transaction.transaction_type === "income" 
                          ? <ArrowUp size={20} weight="bold" />
                          : <ArrowDown size={20} weight="bold" />
                        }
                      </div>
                      <div>
                        <p className="font-medium">{transaction.description}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(transaction.date), "d MMM yyyy", { locale: es })}
                          </span>
                          {transaction.establishment && (
                            <span className="text-sm text-muted-foreground">
                              • {transaction.establishment}
                            </span>
                          )}
                          {transaction.ai_classified && (
                            <Badge variant="secondary" className="text-xs">AI</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge className={CATEGORY_COLORS[transaction.category] || CATEGORY_COLORS.otros}>
                        {CATEGORIES[transaction.category]?.name || transaction.category}
                      </Badge>
                      <span className={`font-mono font-semibold ${
                        transaction.transaction_type === "income" 
                          ? "text-emerald-600" 
                          : "text-red-600"
                      }`}>
                        {transaction.transaction_type === "income" ? "+" : "-"}
                        {formatCurrency(transaction.amount)}
                      </span>
                      {canEdit && (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(transaction)}
                            data-testid={`edit-${transaction.id}`}
                          >
                            <Pencil size={16} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(transaction.id)}
                            className="text-destructive hover:text-destructive"
                            data-testid={`delete-${transaction.id}`}
                          >
                            <Trash size={16} />
                          </Button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
