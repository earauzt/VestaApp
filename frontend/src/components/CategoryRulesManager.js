import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Badge } from "./ui/badge";
import { Switch } from "./ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "./ui/alert-dialog";
import { toast } from "sonner";
import { 
  Plus, 
  Trash, 
  Gear, 
  Lightning,
  Tag,
  X,
  CheckCircle,
  PencilSimple
} from "@phosphor-icons/react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CATEGORIES = {
  alimentacion: { name: "Alimentación", subcategories: ["Comida", "Restaurantes", "Supermercado", "Mercado"], deductible: true },
  salud: { name: "Salud", subcategories: ["Seguros", "Medicina", "Consultas", "Hospitalización", "Laboratorio"], deductible: true },
  educacion: { name: "Educación", subcategories: ["Colegio y actividades", "Cursos", "Materiales", "Universidad", "Maestría"], deductible: true },
  vivienda: { name: "Vivienda", subcategories: ["Servicios básicos", "Arriendo", "Intereses hipoteca", "Mantenimiento"], deductible: true },
  vestimenta: { name: "Vestimenta", subcategories: ["Ropa", "Calzado", "Accesorios"], deductible: true },
  turismo: { name: "Turismo Nacional", subcategories: ["Hoteles Ecuador", "Tours locales", "Transporte turístico"], deductible: true },
  transporte: { name: "Transporte", subcategories: ["Carros", "Combustible", "Mantenimiento vehicular", "Taxi", "Bus"], deductible: false },
  viajes_internacionales: { name: "Viajes Internacionales", subcategories: ["USA", "Europa", "Otros países"], deductible: false },
  otros: { name: "Otros", subcategories: ["Empleados", "Entretenimiento", "Varios"], deductible: false }
};

export function CategoryRulesManager({ open, onOpenChange }) {
  const { getAuthHeaders } = useAuth();
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRule, setNewRule] = useState({
    keywords: "",
    category: "",
    subcategory: ""
  });
  const [testText, setTestText] = useState("");
  const [testResult, setTestResult] = useState(null);
  const [deleteTargetId, setDeleteTargetId] = useState(null);

  useEffect(() => {
    if (open) {
      fetchRules();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const fetchRules = async () => {
    try {
      const response = await axios.get(`${API}/categorization-rules`, { headers: getAuthHeaders() });
      // API returns { default_rules: [...], custom_rules: [...] }
      setRules(response.data.custom_rules || []);
    } catch (error) {
      // API might not exist yet, use empty array
      setRules([]);
    }
  };

  const handleAddRule = async () => {
    if (!newRule.keywords || !newRule.category || !newRule.subcategory) {
      toast.error("Completa todos los campos");
      return;
    }

    setLoading(true);
    try {
      const keywords = newRule.keywords.split(",").map(k => k.trim().toLowerCase()).filter(k => k);
      
      await axios.post(
        `${API}/categorization-rules`,
        {
          keywords,
          category: newRule.category,
          subcategory: newRule.subcategory,
          is_active: true
        },
        { headers: getAuthHeaders() }
      );

      toast.success("Regla creada correctamente");
      setNewRule({ keywords: "", category: "", subcategory: "" });
      setShowAddForm(false);
      fetchRules();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al crear regla");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRule = async (ruleId) => {
    try {
      await axios.delete(`${API}/categorization-rules/${ruleId}`, { headers: getAuthHeaders() });
      toast.success("Regla eliminada");
      fetchRules();
    } catch (error) {
      toast.error("Error al eliminar regla");
    } finally {
      setDeleteTargetId(null);
    }
  };

  const handleTestCategorization = async () => {
    if (!testText.trim()) return;

    try {
      const response = await axios.post(
        `${API}/transactions/auto-categorize`,
        null,
        { 
          headers: getAuthHeaders(),
          params: { description: testText }
        }
      );
      setTestResult(response.data);
    } catch (error) {
      setTestResult({ error: "Error al probar categorización" });
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gear size={24} className="text-primary" />
            Reglas de Categorización Automática
          </DialogTitle>
          <DialogDescription>
            Crea reglas personalizadas para categorizar automáticamente tus transacciones (estilo QuickBooks)
          </DialogDescription>
        </DialogHeader>

        {/* Test Categorization */}
        <Card className="bg-muted/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Lightning size={16} className="text-amber-500" />
              Probar Categorización
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Ej: Compra en Supermaxi..."
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                className="flex-1"
                data-testid="test-categorization-input"
              />
              <Button onClick={handleTestCategorization} size="sm" data-testid="test-categorization-btn">
                Probar
              </Button>
            </div>
            
            {testResult && (
              <div className={`p-3 rounded-lg ${
                testResult.auto_categorized 
                  ? "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200" 
                  : "bg-muted border"
              }`}>
                {testResult.auto_categorized ? (
                  <div className="flex items-center gap-3">
                    <CheckCircle size={20} className="text-emerald-600" weight="fill" />
                    <div>
                      <p className="font-medium">
                        {CATEGORIES[testResult.category]?.name} → {testResult.subcategory}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Palabra clave: "{testResult.matched_keyword}" ({testResult.rule_type === "custom" ? "Regla personalizada" : "Regla predeterminada"})
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No se encontró regla para este texto
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add New Rule */}
        {showAddForm ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Nueva Regla</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Palabras clave (separadas por coma)</Label>
                <Input
                  placeholder="supermaxi, megamaxi, coral hipermercado"
                  value={newRule.keywords}
                  onChange={(e) => setNewRule({ ...newRule, keywords: e.target.value })}
                  data-testid="rule-keywords-input"
                />
                <p className="text-xs text-muted-foreground">
                  Cuando la descripción contenga estas palabras, se categorizará automáticamente
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Categoría</Label>
                  <Select 
                    value={newRule.category} 
                    onValueChange={(value) => setNewRule({ ...newRule, category: value, subcategory: "" })}
                  >
                    <SelectTrigger data-testid="rule-category-select">
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CATEGORIES).map(([key, cat]) => (
                        <SelectItem key={key} value={key}>
                          <span className="flex items-center gap-2">
                            {cat.name}
                            {cat.deductible && <span className="text-xs text-emerald-600">(SRI)</span>}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Subcategoría</Label>
                  <Select 
                    value={newRule.subcategory} 
                    onValueChange={(value) => setNewRule({ ...newRule, subcategory: value })}
                    disabled={!newRule.category}
                  >
                    <SelectTrigger data-testid="rule-subcategory-select">
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {newRule.category && CATEGORIES[newRule.category]?.subcategories.map((sub) => (
                        <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    setShowAddForm(false);
                    setNewRule({ keywords: "", category: "", subcategory: "" });
                  }}
                >
                  Cancelar
                </Button>
                <Button 
                  size="sm" 
                  onClick={handleAddRule} 
                  disabled={loading}
                  className="gap-1"
                  data-testid="save-rule-btn"
                >
                  <CheckCircle size={16} />
                  Guardar Regla
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Button 
            variant="outline" 
            className="w-full gap-2" 
            onClick={() => setShowAddForm(true)}
            data-testid="add-rule-btn"
          >
            <Plus size={18} />
            Agregar nueva regla
          </Button>
        )}

        {/* Rules List */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Tag size={16} />
            Mis Reglas Personalizadas ({rules.length})
          </h4>
          
          {rules.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground border rounded-lg">
              No tienes reglas personalizadas aún
            </div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {rules.map((rule) => (
                <div 
                  key={rule.id} 
                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                >
                  <div className="flex-1">
                    <div className="flex flex-wrap gap-1 mb-1">
                      {rule.keywords?.map((kw, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {kw}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-sm">
                      → <span className="font-medium">{CATEGORIES[rule.category]?.name}</span> / {rule.subcategory}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteTargetId(rule.id)}
                    className="text-destructive hover:text-destructive shrink-0"
                  >
                    <Trash size={16} />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Default Rules Info */}
        <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200">
          <p className="text-sm text-blue-800 dark:text-blue-300">
            <strong>Reglas predeterminadas:</strong> El sistema ya incluye reglas para comercios comunes de Ecuador (Supermaxi, farmacias, gasolineras, etc.)
          </p>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <AlertDialog open={!!deleteTargetId} onOpenChange={(open) => { if (!open) setDeleteTargetId(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar esta regla?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta acción no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => handleDeleteRule(deleteTargetId)}>
            Eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
