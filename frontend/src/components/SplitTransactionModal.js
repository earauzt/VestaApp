import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { toast } from "sonner";
import { Plus, Trash, Scissors, CheckCircle, Warning } from "@phosphor-icons/react";
import { PERSONAL_CATEGORIES } from "../constants/categories";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CATEGORIES = PERSONAL_CATEGORIES;

export function SplitTransactionModal({ open, onOpenChange, transaction, onSplitComplete }) {
  const { getAuthHeaders } = useAuth();
  const [splits, setSplits] = useState([
    { amount: "", category: "", subcategory: "", description: "" },
    { amount: "", category: "", subcategory: "", description: "" }
  ]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && transaction) {
      // Reset splits when modal opens with a new transaction
      const halfAmount = (transaction.amount / 2).toFixed(2);
      setSplits([
        { amount: halfAmount, category: transaction.category, subcategory: transaction.subcategory, description: "" },
        { amount: halfAmount, category: "", subcategory: "", description: "" }
      ]);
    }
  }, [open, transaction]);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-EC', {
      style: 'currency',
      currency: 'USD'
    }).format(value || 0);
  };

  const totalSplit = splits.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
  const remaining = transaction ? transaction.amount - totalSplit : 0;
  const isBalanced = Math.abs(remaining) < 0.01;

  const handleAddSplit = () => {
    setSplits([...splits, { amount: "", category: "", subcategory: "", description: "" }]);
  };

  const handleRemoveSplit = (index) => {
    if (splits.length <= 2) return;
    setSplits(splits.filter((_, i) => i !== index));
  };

  const handleSplitChange = (index, field, value) => {
    const newSplits = [...splits];
    newSplits[index] = { ...newSplits[index], [field]: value };
    
    // Reset subcategory when category changes
    if (field === "category") {
      newSplits[index].subcategory = "";
    }
    
    setSplits(newSplits);
  };

  const handleAutoBalance = () => {
    const nonEmptySplits = splits.filter(s => parseFloat(s.amount) > 0);
    const emptyCount = splits.length - nonEmptySplits.length;
    
    if (emptyCount > 0 && remaining > 0) {
      const amountPerEmpty = (remaining / emptyCount).toFixed(2);
      const newSplits = splits.map(s => {
        if (!s.amount || parseFloat(s.amount) === 0) {
          return { ...s, amount: amountPerEmpty };
        }
        return s;
      });
      setSplits(newSplits);
    }
  };

  const handleSubmit = async () => {
    // Validate all splits have required fields
    for (const split of splits) {
      if (!split.amount || !split.category || !split.subcategory) {
        toast.error("Completa todos los campos de cada división");
        return;
      }
    }

    if (!isBalanced) {
      toast.error(`La suma de las divisiones debe ser igual al monto original (${formatCurrency(transaction.amount)})`);
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(
        `${API}/transactions/split`,
        {
          transaction_id: transaction.id,
          splits: splits.map(s => ({
            amount: parseFloat(s.amount),
            category: s.category,
            subcategory: s.subcategory,
            description: s.description || null
          }))
        },
        { headers: getAuthHeaders() }
      );

      toast.success(response.data.message);
      onSplitComplete?.();
      onOpenChange(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al dividir la transacción");
    } finally {
      setLoading(false);
    }
  };

  if (!transaction) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scissors size={24} className="text-primary" />
            Dividir Transacción
          </DialogTitle>
          <DialogDescription>
            Divide esta transacción en múltiples categorías (estilo QuickBooks)
          </DialogDescription>
        </DialogHeader>

        {/* Original Transaction Info */}
        <div className="p-4 rounded-lg bg-muted/50 border">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-medium">{transaction.description}</p>
              <p className="text-sm text-muted-foreground">{transaction.establishment}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-mono font-bold">{formatCurrency(transaction.amount)}</p>
              <p className="text-sm text-muted-foreground">{transaction.date}</p>
            </div>
          </div>
        </div>

        {/* Balance Status */}
        <div className={`p-3 rounded-lg flex items-center justify-between ${
          isBalanced ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200" : "bg-amber-50 dark:bg-amber-900/20 border-amber-200"
        } border`}>
          {isBalanced ? (
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <CheckCircle size={20} weight="fill" />
              <span className="font-medium">Balanceado correctamente</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <Warning size={20} weight="fill" />
              <span className="font-medium">
                {remaining > 0 ? `Falta asignar: ${formatCurrency(remaining)}` : `Exceso: ${formatCurrency(Math.abs(remaining))}`}
              </span>
            </div>
          )}
          <Button variant="outline" size="sm" onClick={handleAutoBalance} disabled={isBalanced}>
            Auto-balancear
          </Button>
        </div>

        {/* Splits */}
        <div className="space-y-4">
          {splits.map((split, index) => (
            <div key={`split-${index}-${split.category || ''}`} className="p-4 rounded-lg border bg-card space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm text-muted-foreground">División {index + 1}</span>
                {splits.length > 2 && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => handleRemoveSplit(index)}
                    className="h-8 w-8 text-destructive hover:text-destructive"
                  >
                    <Trash size={16} />
                  </Button>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Monto</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={split.amount}
                    onChange={(e) => handleSplitChange(index, "amount", e.target.value)}
                    data-testid={`split-amount-${index}`}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Categoría</Label>
                  <Select 
                    value={split.category} 
                    onValueChange={(value) => handleSplitChange(index, "category", value)}
                  >
                    <SelectTrigger data-testid={`split-category-${index}`}>
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CATEGORIES).map(([key, cat]) => (
                        <SelectItem key={key} value={key}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Subcategoría</Label>
                  <Select 
                    value={split.subcategory} 
                    onValueChange={(value) => handleSplitChange(index, "subcategory", value)}
                    disabled={!split.category}
                  >
                    <SelectTrigger data-testid={`split-subcategory-${index}`}>
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {split.category && CATEGORIES[split.category]?.subcategories.map((sub) => (
                        <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Descripción (opcional)</Label>
                  <Input
                    placeholder="Nota adicional"
                    value={split.description}
                    onChange={(e) => handleSplitChange(index, "description", e.target.value)}
                    data-testid={`split-description-${index}`}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <Button 
          variant="outline" 
          className="w-full gap-2" 
          onClick={handleAddSplit}
          data-testid="add-split-btn"
        >
          <Plus size={18} />
          Agregar otra división
        </Button>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={loading || !isBalanced}
            className="gap-2"
            data-testid="confirm-split-btn"
          >
            <Scissors size={18} />
            {loading ? "Dividiendo..." : "Confirmar división"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
