import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Image, PencilSimple, X, Plus, Receipt } from "@phosphor-icons/react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import axios from "axios";

const API = process.env.REACT_APP_BACKEND_URL;

const QUICK_CATEGORIES = [
  { value: "comida", label: "🛒 Supermercado/Comida" },
  { value: "restaurantes", label: "🍽️ Restaurantes" },
  { value: "transporte", label: "🚗 Transporte/Uber" },
  { value: "salud", label: "💊 Salud/Farmacia" },
  { value: "servicios_basicos", label: "💡 Servicios Básicos" },
  { value: "suscripciones", label: "📱 Suscripciones" },
  { value: "vestimenta", label: "👕 Ropa" },
  { value: "entretenimiento", label: "🎬 Entretenimiento" },
  { value: "usa", label: "🇺🇸 Gastos USA" },
  { value: "otros", label: "📦 Otros" },
];

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
  });

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
        toast.success(`✅ ${response.data.transactions_created || 1} transacción(es) creada(s)`);
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
      };

      await axios.post(`${API}/api/transactions`, payload, { headers: getAuthHeaders() });
      
      toast.success("✅ Gasto registrado");
      setShowQuickForm(false);
      setQuickForm({ amount: "", category: "", description: "" });
    } catch (error) {
      toast.error("Error al guardar gasto");
    }
  };

  return (
    <>
      {/* Hidden file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFileSelected(e, "camera")}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        onChange={(e) => handleFileSelected(e, "gallery")}
      />

      {/* FAB Button */}
      <div className="fixed bottom-20 right-6 z-[60]">
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
                className="flex items-center gap-3 bg-white dark:bg-zinc-800 shadow-lg rounded-full pl-4 pr-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
              >
                <span className="text-sm font-medium whitespace-nowrap">Tomar Foto</span>
                <div className="w-10 h-10 rounded-full bg-[#0D9E82] flex items-center justify-center text-white">
                  <Camera size={20} weight="fill" />
                </div>
              </motion.button>

              {/* Gallery Option */}
              <motion.button
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 }}
                onClick={handleGalleryUpload}
                className="flex items-center gap-3 bg-white dark:bg-zinc-800 shadow-lg rounded-full pl-4 pr-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
              >
                <span className="text-sm font-medium whitespace-nowrap">Subir Imagen</span>
                <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-white">
                  <Image size={20} weight="fill" />
                </div>
              </motion.button>

              {/* Quick Manual Entry */}
              <motion.button
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                onClick={handleQuickExpense}
                className="flex items-center gap-3 bg-white dark:bg-zinc-800 shadow-lg rounded-full pl-4 pr-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
              >
                <span className="text-sm font-medium whitespace-nowrap">Gasto Rápido</span>
                <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-white">
                  <PencilSimple size={20} weight="fill" />
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
          className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all ${
            isOpen 
              ? "bg-zinc-700 dark:bg-zinc-600" 
              : "bg-[#0D9E82] hover:bg-[#0B8A70]"
          } ${isUploading ? "animate-pulse" : ""}`}
        >
          {isUploading ? (
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : isOpen ? (
            <X size={24} className="text-white" weight="bold" />
          ) : (
            <Plus size={24} className="text-white" weight="bold" />
          )}
        </motion.button>
      </div>

      {/* Quick Expense Dialog */}
      <Dialog open={showQuickForm} onOpenChange={setShowQuickForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt size={24} className="text-[#0D9E82]" />
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
                      {cat.label}
                    </SelectItem>
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
              className="bg-[#0D9E82] hover:bg-[#0B8A70]"
            >
              Guardar Gasto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
