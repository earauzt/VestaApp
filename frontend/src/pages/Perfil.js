import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
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
import { Store, FileText, Edit2, Trash2 } from "lucide-react";

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
            <User size={20} className="text-[#0F766E]" />
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

      {/* Gmail Connection */}
      <Card className="bg-white border border-slate-200 shadow-sm" data-testid="gmail-connection-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-900">
            <EnvelopeSimple size={20} className="text-[#0F766E]" />
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
                <Button size="sm" onClick={() => setShowConsentModal(true)} disabled={gmailConnecting} className="gap-2 bg-[#0F766E] hover:bg-[#0D6B63] text-white" data-testid="profile-gmail-connect-btn">
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
            <FileText size={20} className="text-[#0F766E]" />
            Aprendizaje automático
          </CardTitle>
          <CardDescription>Comercios conocidos y reglas que usa FamilyFinance para categorizar tus gastos</CardDescription>
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
            <Button onClick={() => { setShowConsentModal(false); handleConnectGmail(); }} disabled={gmailConnecting} className="gap-2 bg-[#0F766E] hover:bg-[#0D6B63] text-white">
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
              <Input
                value={editForm.personal_category}
                onChange={(e) => setEditForm({ ...editForm, personal_category: e.target.value })}
                placeholder="Ej: comida, servicios_basicos"
                data-testid="vendor-edit-category-input"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Subcategoría</label>
              <Input
                value={editForm.subcategory}
                onChange={(e) => setEditForm({ ...editForm, subcategory: e.target.value })}
                placeholder="Opcional"
                data-testid="vendor-edit-subcategory-input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditVendor(null)} className="border-slate-200 text-slate-700 hover:bg-slate-50">Cancelar</Button>
            <Button onClick={handleSaveVendor} className="bg-[#0F766E] hover:bg-[#0D6B63] text-white" data-testid="vendor-edit-save">Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
