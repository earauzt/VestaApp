import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { toast } from "sonner";
import { Sparkle } from "@phosphor-icons/react";
import { SRI_CATEGORIES, PERSONAL_CATEGORIES } from "../constants/categories";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const FALLBACK_CATEGORIES = Object.fromEntries(
  Object.entries(PERSONAL_CATEGORIES).map(([key, cat]) => [key, cat.name])
);

/**
 * Modal de creación rápida de regla de categorización.
 * Reutiliza POST /api/known-vendors + POST /api/categorization-rules.
 */
export default function AutoRuleModal({ open, onOpenChange, establishment, onCreated }) {
  const { getAuthHeaders } = useAuth();
  const [category, setCategory] = useState("otros");
  const [sriCategory, setSriCategory] = useState("");
  const [isDeductible, setIsDeductible] = useState(false);
  const [keywords, setKeywords] = useState("");
  const [categories, setCategories] = useState(FALLBACK_CATEGORIES);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !establishment) return;
    const headers = getAuthHeaders();
    setKeywords(establishment);
    // Load user's budget categories
    axios
      .get(`${API}/budget/categories`, { headers })
      .then((r) => {
        const cats = r.data?.categories || {};
        const mapped = {};
        Object.entries(cats).forEach(([k, v]) => (mapped[k] = v.name || k));
        if (Object.keys(mapped).length) setCategories(mapped);
      })
      .catch(() => {});
    // Lookup historical known_vendor for pre-fill
    axios
      .get(`${API}/known-vendors/lookup?establishment=${encodeURIComponent(establishment)}`, { headers })
      .then((r) => {
        if (r.data?.found) {
          setCategory(r.data.personal_category || "otros");
          setSriCategory(r.data.sri_category || "");
          setIsDeductible(!!r.data.is_deductible);
        }
      })
      .catch(() => {});
  }, [open, establishment, getAuthHeaders]);

  const handleCreate = async () => {
    if (!establishment || !category) {
      toast.error("Selecciona una categoría");
      return;
    }
    setSubmitting(true);
    try {
      const headers = getAuthHeaders();
      // 1. Upsert known_vendor
      await axios.post(
        `${API}/known-vendors`,
        {
          establishment,
          personal_category: category,
          sri_category: sriCategory || null,
          is_deductible: isDeductible,
        },
        { headers }
      );
      // 2. Create categorization rule
      const keywordList = keywords
        .split(",")
        .map((k) => k.trim().toLowerCase())
        .filter(Boolean);
      await axios.post(
        `${API}/categorization-rules`,
        {
          keywords: keywordList.length ? keywordList : [establishment.toLowerCase()],
          category,
          subcategory: "General",
          is_active: true,
        },
        { headers }
      );
      toast.success(`Regla creada para ${establishment}`);
      onOpenChange(false);
      if (onCreated) onCreated();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Error al crear regla");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]" data-testid="auto-rule-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkle size={20} weight="duotone" className="text-primary" />
            Crear regla automática
          </DialogTitle>
          <DialogDescription>
            Las futuras transacciones con este establecimiento se categorizarán automáticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Establecimiento</Label>
            <Input value={establishment || ""} disabled data-testid="rule-establishment" />
          </div>

          <div className="space-y-2">
            <Label>Categoría</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger data-testid="rule-category-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[250]">
                {Object.entries(categories).map(([k, name]) => (
                  <SelectItem key={k} value={k}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Palabras clave (separadas por coma)</Label>
            <Input
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder={establishment}
              data-testid="rule-keywords-input"
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border">
            <Label className="cursor-pointer" htmlFor="rule-deductible">
              Deducible SRI
            </Label>
            <input
              id="rule-deductible"
              type="checkbox"
              className="h-5 w-5 accent-emerald-600"
              checked={isDeductible}
              onChange={(e) => setIsDeductible(e.target.checked)}
              data-testid="rule-deductible-toggle"
            />
          </div>

          {isDeductible && (
            <div className="space-y-2">
              <Label>Categoría SRI</Label>
              <Select value={sriCategory} onValueChange={setSriCategory}>
                <SelectTrigger data-testid="rule-sri-category-select">
                  <SelectValue placeholder="Seleccionar categoría SRI" />
                </SelectTrigger>
                <SelectContent className="z-[250]">
                  {Object.entries(SRI_CATEGORIES).map(([key, cat]) => (
                    <SelectItem key={key} value={key}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={submitting} data-testid="rule-confirm-btn">
            {submitting ? "Creando..." : "Crear regla"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
