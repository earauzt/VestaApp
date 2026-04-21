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
  User,
  EnvelopeSimple,
  GoogleLogo,
  CheckCircle,
  XCircle,
  SpinnerGap,
  ArrowsClockwise,
  SignOut
} from "@phosphor-icons/react";
import { Store, FileText, Edit2, Trash2, IdCard, UserPlus, Copy } from "lucide-react";
import { PERSONAL_CATEGORIES } from "../constants/categories";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Perfil() {
  const { user, getAuthHeaders, logout } = useAuth();
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

  // Fiscal data state
  const [fiscal, setFiscal] = useState({ ruc: "", nombre_legal: "", tipo_contribuyente: "persona_natural", zona_sri: "" });
  const [savingFiscal, setSavingFiscal] = useState(false);

  // Invitation state (admin only)
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [inviting, setInviting] = useState(false);

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

  const handleCreateInvite = async () => {
    if (!inviteEmail) {
      toast.error("Ingresa un email");
      return;
    }
    setInviting(true);
    try {
      const res = await axios.post(
        `${API}/auth/invite`,
        { email: inviteEmail, rol: "accountant" },
        { headers: getAuthHeadersRef.current() }
      );
      const link = `${window.location.origin}/accept-invite/${res.data.token}`;
      setInviteLink(link);
      toast.success("Invitación creada. Comparte el link con tu contadora.");
    } catch (e) {
      toast.error(e.response?.data?.detail || "No se pudo crear la invitación");
    } finally {
      setInviting(false);
    }
  };

  const copyInviteLink = () => {
    navigator.clipboard.writeText(inviteLink);
    toast.success("Link copiado");
  };

  const handleConnectGmail = async () => {
    setGmailConnecting(true);
    try {
      const res = await axios.get(`${API}/gmail/auth-url`, { headers: getAuthHeadersRef.current() });
      if (res.data?.auth_url) {
        window.location.href = res.data.auth_url;
      } else {
        toast.error("No se pudo iniciar la conexion con Gmail. Intenta de nuevo.");
      }
    } catch {
      toast.error("No se pudo iniciar la conexion con Gmail. Intenta de nuevo.");
      setGmailConnecting(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await axios.post(`${API}/gmail/sync`, {}, { headers: getAuthHeadersRef.current() });
      toast.success(`Sincronizacion completa: ${res.data.procesados} procesados, ${res.data.descartados} descartados`);
      fetchGmailStatus();
    } catch {
      toast.error("Error al sincronizar Gmail");
    } finally {
      setSyncing(false);
    }
  };

  const handleDeleteVendor = async (vendor) => {
    if (!window.confirm(`¿Eliminar "${vendor.establishment}" de tus comercios conocidos?`)) return;
    try {
      await axios.delete(`${API}/known-vendors/${vendor.id}`, { headers: getAuthHeadersRef.current() });
      toast.success("Comercio eliminado");
      fetchRulesData();
    } catch {
      toast.error("No se pudo eliminar");
    }
  };

  const handleDeleteRule = async (rule) => {
    if (!window.confirm(`¿Eliminar regla (${(rule.keywords || []).join(", ")})?`)) return;
    try {
      await axios.delete(`${API}/categorization-rules/${rule.id}`, { headers: getAuthHeadersRef.current() });
      toast.success("Regla eliminada");
      fetchRulesData();
    } catch {
      toast.error("No se pudo eliminar");
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
            <User size={20} className="text-[#0D9E82]" />
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
            <IdCard size={20} className="text-[#0D9E82]" />
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
              className="bg-[#0D9E82] hover:bg-[#0D6B63] text-white"
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
            <EnvelopeSimple size={20} className="text-[#0D9E82]" />
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
                <Button size="sm" onClick={() => setShowConsentModal(true)} disabled={gmailConnecting} className="gap-2 bg-[#0D9E82] hover:bg-[#0D6B63] text-white" data-testid="profile-gmail-connect-btn">
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
            <FileText size={20} className="text-[#0D9E82]" />
            Aprendizaje automático
          </CardTitle>
          <CardDescription>Comercios conocidos y reglas que usa Vesta para categorizar tus gastos</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={rulesTab} onValueChange={setRulesTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="comercios" data-testid="tab-comercios" className="gap-2">
                <Store size={15} /> Comercios ({vendors.length})
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
                      <button
                        onClick={() => openEditVendor(v)}
                        className="text-slate-400 hover:text-slate-700 p-1"
                        data-testid={`vendor-edit-${v.id}`}
                        title="Editar"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        onClick={() => handleDeleteVendor(v)}
                        className="text-slate-400 hover:text-[#DC2626] p-1"
                        data-testid={`vendor-delete-${v.id}`}
                        title="Eliminar"
                      >
                        <Trash2 size={15} />
                      </button>
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
                      <button
                        onClick={() => handleDeleteRule(r)}
                        className="text-slate-400 hover:text-[#DC2626] p-1"
                        data-testid={`rule-delete-${r.id}`}
                        title="Eliminar"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Accesos (admin only) */}
      {user?.role === "admin" && (
        <Card className="bg-white border border-slate-200 shadow-sm" data-testid="access-invite-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-900">
              <UserPlus size={20} className="text-[#0D9E82]" />
              Accesos
            </CardTitle>
            <CardDescription>Invita a tu contadora para que revise tus datos fiscales</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                type="email"
                placeholder="contadora@email.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="flex-1"
                data-testid="invite-email-input"
              />
              <Button
                onClick={handleCreateInvite}
                disabled={inviting}
                className="bg-[#0D9E82] hover:bg-[#0D6B63] text-white gap-2"
                data-testid="invite-create-btn"
              >
                <UserPlus size={15} />
                {inviting ? "Generando..." : "Invitar contadora"}
              </Button>
            </div>
            {inviteLink && (
              <div className="p-3 rounded-md bg-slate-50 border border-slate-200 flex items-center gap-2" data-testid="invite-link-display">
                <code className="flex-1 text-xs text-slate-700 truncate">{inviteLink}</code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={copyInviteLink}
                  className="border-slate-200 text-slate-700 hover:bg-white gap-1 shrink-0"
                  data-testid="invite-copy-btn"
                >
                  <Copy size={13} />
                  Copiar
                </Button>
              </div>
            )}
            <p className="text-xs text-slate-500">El enlace expira en 48 horas.</p>
          </CardContent>
        </Card>
      )}

      {/* Logout */}
      <Card className="bg-white border border-slate-200 border-l-4 border-l-[#DC2626] shadow-sm">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="font-medium text-[#DC2626]">Cerrar Sesión</p>
            <p className="text-xs text-slate-500">Tu sesión se cerrará en este dispositivo</p>
          </div>
          <Button onClick={logout} className="gap-2 bg-[#DC2626] hover:bg-red-700 text-white rounded-md px-4 py-2 text-sm font-medium">
            <SignOut size={16} />
            Salir
          </Button>
        </CardContent>
      </Card>

      {/* Gmail Consent Modal */}
      <Dialog open={showConsentModal} onOpenChange={setShowConsentModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl">¿Qué va a leer FamilyFinance de tu correo?</DialogTitle>
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
            <Button onClick={() => { setShowConsentModal(false); handleConnectGmail(); }} disabled={gmailConnecting} className="gap-2 bg-[#0D9E82] hover:bg-[#0D6B63] text-white">
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
            <Button onClick={handleSaveVendor} className="bg-[#0D9E82] hover:bg-[#0D6B63] text-white" data-testid="vendor-edit-save">Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
