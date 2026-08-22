import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "../components/ui/alert-dialog";
import {
  User,
  EnvelopeSimple,
  GoogleLogo,
  CheckCircle,
  XCircle,
  SpinnerGap,
  ArrowsClockwise,
  Storefront,
  FileText,
  Pencil,
  Trash,
  IdentificationCard,
} from "@phosphor-icons/react";
import { PERSONAL_CATEGORIES } from "../constants/categories";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Perfil() {
  const { user, getAuthHeaders } = useAuth();
  const [gmailStatus, setGmailStatus] = useState(null);
  const [gmailLoading, setGmailLoading] = useState(true);
  const [gmailConnecting, setGmailConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);

  // Rules section state
  const [vendors, setVendors] = useState([]);
  const [rules, setRules] = useState([]);
  const [rulesTab, setRulesTab] = useState("comercios");
  const [loadingRules, setLoadingRules] = useState(false);
  const [editVendor, setEditVendor] = useState(null);
  const [editForm, setEditForm] = useState({ personal_category: "", subcategory: "" });
  const [confirmDelete, setConfirmDelete] = useState(null); // { type: "vendor" | "rule", item }

  // Fiscal data state
  const [fiscal, setFiscal] = useState({ ruc: "", nombre_legal: "", tipo_contribuyente: "persona_natural", zona_sri: "" });
  const [savingFiscal, setSavingFiscal] = useState(false);

  const getAuthHeadersRef = useRef(getAuthHeaders);
  useEffect(() => { getAuthHeadersRef.current = getAuthHeaders; });

  const fetchGmailStatus = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/gmail/status`, { headers: getAuthHeadersRef.current() });
      setGmailStatus(res.data);
    } catch {
      setGmailStatus({ connected: false });
    } finally {
      setGmailLoading(false);
    }
  }, []);

  const fetchRulesData = useCallback(async () => {
    setLoadingRules(true);
    try {
      const headers = getAuthHeadersRef.current();
      const [vRes, rRes] = await Promise.all([
        axios.get(`${API}/known-vendors`, { headers }),
        axios.get(`${API}/categorization-rules`, { headers }),
      ]);
      setVendors(Array.isArray(vRes.data) ? vRes.data : (vRes.data?.vendors || []));
      setRules(rRes.data?.custom_rules || []);
    } catch {
      toast.error("No se pudieron cargar los comercios y reglas");
    } finally {
      setLoadingRules(false);
    }
  }, []);

  useEffect(() => { fetchGmailStatus(); fetchRulesData(); }, [fetchGmailStatus, fetchRulesData]);

  // Load fiscal data from /auth/me
  useEffect(() => {
    axios.get(`${API}/auth/me`, { headers: getAuthHeadersRef.current() })
      .then((res) => {
        setFiscal({
          ruc: res.data?.ruc || "",
          nombre_legal: res.data?.nombre_legal || "",
          tipo_contribuyente: res.data?.tipo_contribuyente || "persona_natural",
          zona_sri: res.data?.zona_sri || "",
        });
      })
      .catch(() => {});
  }, []);

  const handleSaveFiscal = async () => {
    setSavingFiscal(true);
    try {
      await axios.put(`${API}/auth/profile`, fiscal, { headers: getAuthHeadersRef.current() });
      toast.success("Datos fiscales guardados");
    } catch (e) {
      toast.error(e.response?.data?.detail || "No se pudo guardar");
    } finally {
      setSavingFiscal(false);
    }
  };

  const handleConnectGmail = async () => {
    setGmailConnecting(true);
    try {
      const res = await axios.get(`${API}/gmail/auth-url`, { headers: getAuthHeadersRef.current() });
      if (res.data?.auth_url) {
        window.location.href = res.data.auth_url;
      } else {
        toast.error("No se pudo iniciar la conexión con Gmail. Intenta de nuevo.");
      }
    } catch {
      toast.error("No se pudo iniciar la conexión con Gmail. Intenta de nuevo.");
      setGmailConnecting(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await axios.post(`${API}/gmail/sync`, {}, { headers: getAuthHeadersRef.current() });
      toast.success(`Sincronización completa: ${res.data.procesados} procesados, ${res.data.descartados} descartados`);
      fetchGmailStatus();
    } catch {
      toast.error("Error al sincronizar Gmail");
    } finally {
      setSyncing(false);
    }
  };

  const requestDeleteVendor = (vendor) => setConfirmDelete({ type: "vendor", item: vendor });
  const requestDeleteRule = (rule) => setConfirmDelete({ type: "rule", item: rule });

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    const { type, item } = confirmDelete;
    try {
      if (type === "vendor") {
        await axios.delete(`${API}/known-vendors/${item.id}`, { headers: getAuthHeadersRef.current() });
        toast.success("Comercio eliminado");
      } else {
        await axios.delete(`${API}/categorization-rules/${item.id}`, { headers: getAuthHeadersRef.current() });
        toast.success("Regla eliminada");
      }
      fetchRulesData();
    } catch {
      toast.error("No se pudo eliminar");
    } finally {
      setConfirmDelete(null);
    }
  };

  const openEditVendor = (vendor) => {
    setEditVendor(vendor);
    setEditForm({
      personal_category: vendor.personal_category || "",
      subcategory: vendor.subcategory || "",
    });
  };

  const handleSaveVendor = async () => {
    if (!editVendor) return;
    try {
      await axios.put(
        `${API}/known-vendors/${editVendor.id}`,
        { personal_category: editForm.personal_category, subcategory: editForm.subcategory },
        { headers: getAuthHeadersRef.current() }
      );
      toast.success("Comercio actualizado");
      setEditVendor(null);
      fetchRulesData();
    } catch {
      toast.error("No se pudo actualizar");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Mi Perfil</h1>
        <p className="text-sm text-slate-500">Configuración de tu cuenta y conexiones</p>
      </div>

      {/* User Info */}
      <Card className="bg-white border border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-900">
            <User size={20} className="text-primary" />
            Información de la Cuenta
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-500">Nombre</p>
              <p className="font-medium text-slate-900">{user?.name}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Email</p>
              <p className="font-medium text-slate-900">{user?.email}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Rol</p>
              <Badge variant="outline" className="mt-1 border-slate-200 text-slate-700">{user?.role}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Datos fiscales */}
      <Card className="bg-white border border-slate-200 shadow-sm" data-testid="fiscal-data-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-900">
            <IdentificationCard size={20} className="text-primary" />
            Datos fiscales
          </CardTitle>
          <CardDescription>Usados para cálculos SRI, facturas y reportes anuales</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="fiscal-ruc" className="text-xs text-slate-500">RUC / Cédula</Label>
              <Input
                id="fiscal-ruc"
                data-testid="fiscal-ruc-input"
                value={fiscal.ruc}
                onChange={(e) => setFiscal({ ...fiscal, ruc: e.target.value })}
                placeholder="0912345678001"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="fiscal-nombre" className="text-xs text-slate-500">Nombre legal</Label>
              <Input
                id="fiscal-nombre"
                data-testid="fiscal-nombre-input"
                value={fiscal.nombre_legal}
                onChange={(e) => setFiscal({ ...fiscal, nombre_legal: e.target.value })}
                placeholder="Como aparece en el RUC"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Tipo de contribuyente</Label>
              <Select value={fiscal.tipo_contribuyente} onValueChange={(v) => setFiscal({ ...fiscal, tipo_contribuyente: v })}>
                <SelectTrigger data-testid="fiscal-tipo-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="persona_natural">Persona Natural</SelectItem>
                  <SelectItem value="persona_natural_obligada">Persona Natural Obligada a Llevar Contabilidad</SelectItem>
                  <SelectItem value="rimpe_emprendedor">RIMPE Emprendedor</SelectItem>
                  <SelectItem value="rimpe_popular">RIMPE Popular</SelectItem>
                  <SelectItem value="sociedad">Sociedad</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="fiscal-zona" className="text-xs text-slate-500">Zona SRI</Label>
              <Input
                id="fiscal-zona"
                data-testid="fiscal-zona-input"
                value={fiscal.zona_sri}
                onChange={(e) => setFiscal({ ...fiscal, zona_sri: e.target.value })}
                placeholder="Ej: Zona 8 / Guayas / Guayaquil"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              onClick={handleSaveFiscal}
              disabled={savingFiscal}
              className="bg-primary hover:bg-primary/90 text-white"
              data-testid="fiscal-save-btn"
            >
              {savingFiscal ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card className="bg-white border border-slate-200 shadow-sm" data-testid="gmail-connection-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-900">
            <EnvelopeSimple size={20} className="text-primary" />
            Cuentas Conectadas
          </CardTitle>
          <CardDescription>Conecta servicios externos para importar transacciones automáticamente</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 rounded-md border border-slate-200 bg-slate-50">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-md bg-white border border-slate-200 shadow-sm">
                <GoogleLogo size={24} weight="bold" className="text-[#4285F4]" />
              </div>
              <div>
                <p className="font-medium flex items-center gap-2 text-slate-900">
                  Gmail
                  {gmailLoading ? (
                    <SpinnerGap size={14} className="animate-spin text-slate-400" />
                  ) : gmailStatus?.connected ? (
                    <Badge className="bg-emerald-50 text-[#16A34A] border border-emerald-200 hover:bg-emerald-50">Conectado</Badge>
                  ) : (
                    <Badge variant="outline" className="text-slate-500 border-slate-200">No conectado</Badge>
                  )}
                </p>
                {gmailStatus?.connected && (
                  <p className="text-xs text-slate-500 mt-1">
                    {gmailStatus.connected_at && `Conectado el ${new Date(gmailStatus.connected_at).toLocaleDateString('es-EC')}`}
                    {gmailStatus.last_sync && ` · Último sync: ${new Date(gmailStatus.last_sync).toLocaleDateString('es-EC')}`}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {gmailStatus?.connected ? (
                <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing} className="gap-2 border-slate-200 text-slate-700 hover:bg-slate-50">
                  {syncing ? <SpinnerGap size={14} className="animate-spin" /> : <ArrowsClockwise size={14} />}
                  Sincronizar
                </Button>
              ) : (
                <Button size="sm" onClick={() => setShowConsentModal(true)} disabled={gmailConnecting} className="gap-2 bg-primary hover:bg-primary/90 text-white" data-testid="profile-gmail-connect-btn">
                  {gmailConnecting ? (
                    <><SpinnerGap size={14} className="animate-spin" /> Conectando...</>
                  ) : (
                    <><GoogleLogo size={16} weight="bold" /> Conectar</>
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rules & Vendors */}
      <Card className="bg-white border border-slate-200 shadow-sm" data-testid="rules-section">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-900">
            <FileText size={20} className="text-primary" />
            Aprendizaje automático
          </CardTitle>
          <CardDescription>Comercios conocidos y reglas que usa Vesta para categorizar tus gastos</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={rulesTab} onValueChange={setRulesTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="comercios" data-testid="tab-comercios" className="gap-2">
                <Storefront size={15} /> Comercios ({vendors.length})
              </TabsTrigger>
              <TabsTrigger value="reglas" data-testid="tab-reglas" className="gap-2">
                <FileText size={15} /> Reglas activas ({rules.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="comercios">
              {loadingRules ? (
                <p className="text-sm text-slate-500 text-center py-8">Cargando...</p>
              ) : vendors.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">
                  Aún no hay comercios conocidos. Se aprenden automáticamente al aprobar transacciones.
                </p>
              ) : (
                <div className="divide-y divide-slate-200 border border-slate-200 rounded-md">
                  {vendors.map((v) => (
                    <div key={v.id} className="flex items-center gap-3 p-3" data-testid={`vendor-row-${v.id}`}>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-slate-900 truncate">{v.establishment}</p>
                        <p className="text-xs text-slate-500 truncate">
                          {v.personal_category || "sin categoría"}
                          {v.subcategory ? ` · ${v.subcategory}` : ""}
                        </p>
                      </div>
                      <Badge variant="outline" className="shrink-0 text-xs border-slate-200 text-slate-600" data-testid={`vendor-uses-${v.id}`}>
                        {v.times_used || 0} usos
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditVendor(v)}
                        className="h-10 w-10 shrink-0 text-slate-400 hover:text-slate-700"
                        data-testid={`vendor-edit-${v.id}`}
                        aria-label="Editar comercio"
                        title="Editar"
                      >
                        <Pencil size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => requestDeleteVendor(v)}
                        className="h-10 w-10 shrink-0 text-slate-400 hover:text-[#DC2626]"
                        data-testid={`vendor-delete-${v.id}`}
                        aria-label="Eliminar comercio"
                        title="Eliminar"
                      >
                        <Trash size={16} />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="reglas">
              {loadingRules ? (
                <p className="text-sm text-slate-500 text-center py-8">Cargando...</p>
              ) : rules.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">
                  No tienes reglas personalizadas todavía.
                </p>
              ) : (
                <div className="divide-y divide-slate-200 border border-slate-200 rounded-md">
                  {rules.map((r) => (
                    <div key={r.id} className="flex items-center gap-3 p-3" data-testid={`rule-row-${r.id}`}>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-slate-900 truncate">
                          {(r.keywords || []).join(", ") || "Sin palabras clave"}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {r.category || "sin categoría"}
                          {r.subcategory ? ` · ${r.subcategory}` : ""}
                        </p>
                      </div>
                      <span className="text-xs text-slate-400 shrink-0">
                        {r.created_at ? new Date(r.created_at).toLocaleDateString('es-EC') : ""}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => requestDeleteRule(r)}
                        className="h-10 w-10 shrink-0 text-slate-400 hover:text-[#DC2626]"
                        data-testid={`rule-delete-${r.id}`}
                        aria-label="Eliminar regla"
                        title="Eliminar"
                      >
                        <Trash size={16} />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Gmail Consent Modal */}
      <Dialog open={showConsentModal} onOpenChange={setShowConsentModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl">¿Qué va a leer Vesta de tu correo?</DialogTitle>
            <DialogDescription>Solo accedemos a emails de remitentes financieros específicos</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex items-start gap-3 p-3 rounded-md bg-emerald-50 border border-emerald-100">
              <CheckCircle size={18} className="text-[#16A34A] shrink-0 mt-0.5" weight="fill" />
              <p className="text-sm text-slate-700">Emails de consumo de tus bancos (Diners, PacifiCard, Pacífico, Pichincha, Bolivariano)</p>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-md bg-emerald-50 border border-emerald-100">
              <CheckCircle size={18} className="text-[#16A34A] shrink-0 mt-0.5" weight="fill" />
              <p className="text-sm text-slate-700">Facturas electrónicas y estados de cuenta en PDF</p>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-md bg-red-50 border border-red-100">
              <XCircle size={18} className="text-[#DC2626] shrink-0 mt-0.5" weight="fill" />
              <p className="text-sm text-slate-700">Emails personales, de trabajo o de cualquier otro remitente — nunca los leemos</p>
            </div>
            <p className="text-xs text-slate-500 pt-2">
              Puedes desconectar tu cuenta en cualquier momento desde esta página.
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowConsentModal(false)} className="border-slate-200 text-slate-700 hover:bg-slate-50">Cancelar</Button>
            <Button onClick={() => { setShowConsentModal(false); handleConnectGmail(); }} disabled={gmailConnecting} className="gap-2 bg-primary hover:bg-primary/90 text-white">
              {gmailConnecting ? <><SpinnerGap size={16} className="animate-spin" /> Conectando...</> : <><GoogleLogo size={18} weight="bold" /> Entendido, conectar</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Vendor Modal */}
      <Dialog open={!!editVendor} onOpenChange={(o) => !o && setEditVendor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar comercio</DialogTitle>
            <DialogDescription>{editVendor?.establishment}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Categoría</label>
              <Select
                value={editForm.personal_category}
                onValueChange={(v) => setEditForm({ ...editForm, personal_category: v, subcategory: "" })}
              >
                <SelectTrigger data-testid="vendor-edit-category-select">
                  <SelectValue placeholder="Seleccionar categoría" />
                </SelectTrigger>
                <SelectContent className="z-[250]">
                  {Object.entries(PERSONAL_CATEGORIES).map(([key, cat]) => (
                    <SelectItem key={key} value={key}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Subcategoría</label>
              <Select
                value={editForm.subcategory}
                onValueChange={(v) => setEditForm({ ...editForm, subcategory: v })}
                disabled={!editForm.personal_category}
              >
                <SelectTrigger data-testid="vendor-edit-subcategory-select">
                  <SelectValue placeholder="Seleccionar subcategoría" />
                </SelectTrigger>
                <SelectContent className="z-[250]">
                  {editForm.personal_category && PERSONAL_CATEGORIES[editForm.personal_category]?.subcategories?.map((sub) => (
                    <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditVendor(null)} className="border-slate-200 text-slate-700 hover:bg-slate-50">Cancelar</Button>
            <Button onClick={handleSaveVendor} className="bg-primary hover:bg-primary/90 text-white" data-testid="vendor-edit-save">Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDelete?.type === "vendor" ? "¿Eliminar este comercio?" : "¿Eliminar esta regla?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete?.type === "vendor"
                ? `Esta acción no se puede deshacer. "${confirmDelete?.item?.establishment}" dejará de reconocerse automáticamente.`
                : "Esta acción no se puede deshacer. La regla dejará de aplicarse a nuevas transacciones."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="confirm-delete-cancel">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-[#DC2626] hover:bg-red-700 text-white"
              data-testid="confirm-delete-action"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
