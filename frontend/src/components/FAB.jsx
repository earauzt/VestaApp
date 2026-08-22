import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Image, Pencil, X, Plus, Receipt, ShoppingCart, ForkKnife, Car, Heartbeat, Lightning, TShirt } from "@phosphor-icons/react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import axios from "axios";
import { PERSONAL_CATEGORIES, ENTITY_TAGS } from "../constants/categories";

const API = process.env.REACT_APP_BACKEND_URL;

// Compact subset of the canonical PERSONAL_CATEGORIES for the quick-add grid.
const QUICK_CATEGORY_KEYS = ["comida", "restaurantes", "carros", "servicios_basicos", "suscripciones", "otros"];
const QUICK_CATEGORY_ICONS = {
  comida: ShoppingCart,
  restaurantes: ForkKnife,
  carros: Car,
  servicios_basicos: Lightning,
  suscripciones: TShirt,
  salud: Heartbeat,
  otros: Receipt,
};
const QUICK_CATEGORIES = QUICK_CATEGORY_KEYS.map((key) => ({
  value: key,
  label: PERSONAL_CATEGORIES[key]?.name || key,
  Icon: QUICK_CATEGORY_ICONS[key] || Receipt,
}));


export default function FAB() {
  const { getAuthHeaders, user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [showQuickForm, setShowQuickForm] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  
  const [quickForm, setQuickForm] = useState({
    amount: "",
    category: "",
    description: "",
    entityTag: "",
  });
  const [entityTags, setEntityTags] = useState(ENTITY_TAGS);

  useEffect(() => {
    let cancelled = false;
    axios.get(`${API}/api/entity-tags`, { headers: getAuthHeaders() })
      .then((res) => {
        if (!cancelled && res.data?.entity_tags?.length) {
          const fromApi = res.data.entity_tags;
          const keys = new Set(fromApi.map((t) => t.key));
          const missing = ENTITY_TAGS.filter(
            (t) => (t.key === "titular" || t.key === "adicional_kp") && !keys.has(t.key)
          );
          setEntityTags([...missing, ...fromApi]);
        }
      })
      .catch(() => {}); // se queda con DEFAULT_ENTITY_TAGS si falla
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // No mostrar FAB en ciertas páginas o si no hay usuario
  if (!user) return null;

  const handleCameraCapture = () => {
    cameraInputRef.current?.click();
    setIsOpen(false);
  };

  const handleGalleryUpload = () => {
    fileInputRef.current?.click();
    setIsOpen(false);
  };

  const handleFileSelected = async (e, source) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      // Detectar si es un estado de cuenta o recibo
      const fileName = file.name.toLowerCase();
      const isBankStatement = fileName.includes("estado") || 
                             fileName.includes("cuenta") || 
                             fileName.includes("statement") ||
                             fileName.includes("pichincha") ||
                             fileName.includes("pacificard") ||
                             fileName.includes("diners");

      const endpoint = isBankStatement ? "/api/process/bank-statement" : "/api/upload/receipt";
      
      toast.info(`Procesando ${isBankStatement ? 'estado de cuenta' : 'recibo'}...`, {
        duration: 10000,
      });

      const response = await axios.post(`${API}${endpoint}`, formData, {
        headers: { ...getAuthHeaders(), "Content-Type": "multipart/form-data" },
        timeout: 300000, // 5 min para estados de cuenta
      });

      if (response.data.transactions_created > 0 || response.data.transaction) {
        toast.success(`${response.data.transactions_created || 1} transacción(es) creada(s)`);
      } else {
        // OCR falló - mostrar formulario manual
        toast.warning("No se pudo procesar automáticamente");
        setShowQuickForm(true);
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') console.error("Upload error:", error);
      toast.error("Error al procesar. Usa entrada manual.");
      setShowQuickForm(true);
    } finally {
      setIsUploading(false);
      // Reset inputs
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    }
  };

  const handleQuickExpense = () => {
    setIsOpen(false);
    setShowQuickForm(true);
  };

  const handleQuickSubmit = async () => {
    if (!quickForm.amount || !quickForm.category) {
      toast.error("Monto y categoría son requeridos");
      return;
    }

    try {
      const payload = {
        amount: parseFloat(quickForm.amount),
        category: quickForm.category,
        description: quickForm.description || `Gasto rápido - ${QUICK_CATEGORIES.find(c => c.value === quickForm.category)?.label || quickForm.category}`,
        date: new Date().toISOString().split('T')[0],
        transaction_type: "expense",
        payment_method: "efectivo",
        status: "pending_review",
        source_type: "manual_quick",
        ...(quickForm.entityTag ? { entity_tag_key: quickForm.entityTag } : {}),
      };

      await axios.post(`${API}/api/transactions`, payload, { headers: getAuthHeaders() });

      toast.success("Gasto registrado");
      setShowQuickForm(false);
      setQuickForm({ amount: "", category: "", description: "", entityTag: "" });
    } catch (error) {
      toast.error("Error al guardar gasto");
    }
  };

  return (
    <>
      {/* Hidden file inputs */}
      <label htmlFor="fab-camera-input" className="sr-only">Tomar foto de recibo</label>
      <input
        id="fab-camera-input"
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        aria-label="Tomar foto de recibo"
        onChange={(e) => handleFileSelected(e, "camera")}
      />
      <label htmlFor="fab-gallery-input" className="sr-only">Subir imagen de recibo</label>
      <input
        id="fab-gallery-input"
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        aria-label="Subir imagen de recibo"
        onChange={(e) => handleFileSelected(e, "gallery")}
      />

      {/* FAB Button */}
      <div
        className="fixed z-[60] bottom-20 right-4 lg:bottom-6 lg:right-6 pointer-events-auto"
        data-testid="fab-root"
      >
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute bottom-16 right-0 flex flex-col gap-3 items-end"
            >
              {/* Camera Option */}
              <motion.button
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                onClick={handleCameraCapture}
                aria-label="Tomar foto de recibo"
                className="flex items-center gap-3 bg-white shadow-lg rounded-full pl-4 pr-3 py-2 hover:bg-zinc-50 transition-colors"
              >
                <span className="text-sm font-medium whitespace-nowrap">Tomar Foto</span>
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white">
                  <Camera size={20} />
                </div>
              </motion.button>

              {/* Gallery Option */}
              <motion.button
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 }}
                onClick={handleGalleryUpload}
                aria-label="Subir imagen de recibo"
                className="flex items-center gap-3 bg-white shadow-lg rounded-full pl-4 pr-3 py-2 hover:bg-zinc-50 transition-colors"
              >
                <span className="text-sm font-medium whitespace-nowrap">Subir Imagen</span>
                <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-white">
                  <Image size={20} />
                </div>
              </motion.button>

              {/* Quick Manual Entry */}
              <motion.button
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                onClick={handleQuickExpense}
                aria-label="Agregar gasto manualmente"
                className="flex items-center gap-3 bg-white shadow-lg rounded-full pl-4 pr-3 py-2 hover:bg-zinc-50 transition-colors"
              >
                <span className="text-sm font-medium whitespace-nowrap">Gasto Rápido</span>
                <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-white">
                  <Pencil size={20} />
                </div>
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main FAB */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(!isOpen)}
          disabled={isUploading}
          aria-label="Agregar gasto"
          aria-expanded={isOpen}
          className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all ${
            isOpen
              ? "bg-zinc-700"
              : "bg-primary hover:bg-primary/90"
          } ${isUploading ? "animate-pulse" : ""}`}
        >
          {isUploading ? (
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : isOpen ? (
            <X size={24} className="text-white" />
          ) : (
            <Plus size={24} className="text-white" />
          )}
        </motion.button>
      </div>

      {/* Quick Expense Dialog */}
      <Dialog open={showQuickForm} onOpenChange={setShowQuickForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt size={24} className="text-primary" />
              Gasto Rápido
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="amount">Monto *</Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  className="pl-8 text-lg font-semibold"
                  value={quickForm.amount}
                  onChange={(e) => setQuickForm({ ...quickForm, amount: e.target.value })}
                  autoFocus
                />
              </div>
            </div>

            <div>
              <Label>Categoría *</Label>
              <Select 
                value={quickForm.category} 
                onValueChange={(v) => setQuickForm({ ...quickForm, category: v })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Seleccionar categoría" />
                </SelectTrigger>
                <SelectContent>
                  {QUICK_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      <span className="flex items-center gap-2">
                        <cat.Icon size={15} className="text-primary" />
                        {cat.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>¿De quién es este gasto? (opcional)</Label>
              <Select
                value={quickForm.entityTag}
                onValueChange={(v) => setQuickForm({ ...quickForm, entityTag: v })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Sin asignar" />
                </SelectTrigger>
                <SelectContent>
                  {entityTags.map((tag) => (
                    <SelectItem key={tag.key} value={tag.key}>{tag.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="description">Descripción (opcional)</Label>
              <Input
                id="description"
                placeholder="Ej: Almuerzo en..."
                className="mt-1"
                value={quickForm.description}
                onChange={(e) => setQuickForm({ ...quickForm, description: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowQuickForm(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleQuickSubmit}
              className="bg-primary hover:bg-primary/90"
            >
              Guardar Gasto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
