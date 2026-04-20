import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
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

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Perfil() {
  const { user, getAuthHeaders, logout } = useAuth();
  const [gmailStatus, setGmailStatus] = useState(null);
  const [gmailLoading, setGmailLoading] = useState(true);
  const [gmailConnecting, setGmailConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);

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

  useEffect(() => { fetchGmailStatus(); }, [fetchGmailStatus]);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Mi Perfil</h1>
        <p className="text-sm text-muted-foreground">Configuracion de tu cuenta y conexiones</p>
      </div>

      {/* User Info */}
      <Card className="bento-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User size={20} className="text-primary" />
            Informacion de la Cuenta
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Nombre</p>
              <p className="font-medium">{user?.name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="font-medium">{user?.email}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Rol</p>
              <Badge variant="outline" className="mt-1">{user?.role}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gmail Connection */}
      <Card className="bento-card" data-testid="gmail-connection-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <EnvelopeSimple size={20} className="text-primary" />
            Cuentas Conectadas
          </CardTitle>
          <CardDescription>Conecta servicios externos para importar transacciones automaticamente</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-white dark:bg-card shadow-sm">
                <GoogleLogo size={28} weight="bold" className="text-[#4285F4]" />
              </div>
              <div>
                <p className="font-medium flex items-center gap-2">
                  Gmail
                  {gmailLoading ? (
                    <SpinnerGap size={14} className="animate-spin text-muted-foreground" />
                  ) : gmailStatus?.connected ? (
                    <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Conectado</Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">No conectado</Badge>
                  )}
                </p>
                {gmailStatus?.connected && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {gmailStatus.connected_at && `Conectado el ${new Date(gmailStatus.connected_at).toLocaleDateString('es-EC')}`}
                    {gmailStatus.last_sync && ` · Ultimo sync: ${new Date(gmailStatus.last_sync).toLocaleDateString('es-EC')}`}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {gmailStatus?.connected ? (
                <>
                  <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing} className="gap-2">
                    {syncing ? <SpinnerGap size={14} className="animate-spin" /> : <ArrowsClockwise size={14} />}
                    Sincronizar
                  </Button>
                </>
              ) : (
                <Button size="sm" onClick={() => setShowConsentModal(true)} disabled={gmailConnecting} className="gap-2" data-testid="profile-gmail-connect-btn">
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

      {/* Logout */}
      <Card className="bento-card border-destructive/20">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="font-medium text-destructive">Cerrar Sesion</p>
            <p className="text-xs text-muted-foreground">Tu sesion se cerrara en este dispositivo</p>
          </div>
          <Button variant="destructive" size="sm" onClick={logout} className="gap-2">
            <SignOut size={16} />
            Salir
          </Button>
        </CardContent>
      </Card>

      {/* Gmail Consent Modal */}
      <Dialog open={showConsentModal} onOpenChange={setShowConsentModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl">Que va a leer FamilyFinance de tu correo?</DialogTitle>
            <DialogDescription>Solo accedemos a emails de remitentes financieros especificos</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20">
              <CheckCircle size={20} className="text-emerald-600 shrink-0 mt-0.5" weight="fill" />
              <p className="text-sm">Emails de consumo de tus bancos (Diners, PacifiCard, Pacifico, Pichincha, Bolivariano)</p>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20">
              <CheckCircle size={20} className="text-emerald-600 shrink-0 mt-0.5" weight="fill" />
              <p className="text-sm">Facturas electronicas y estados de cuenta en PDF</p>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/20">
              <XCircle size={20} className="text-red-500 shrink-0 mt-0.5" weight="fill" />
              <p className="text-sm">Emails personales, de trabajo o de cualquier otro remitente — nunca los leemos</p>
            </div>
            <p className="text-xs text-muted-foreground pt-2">
              Puedes desconectar tu cuenta en cualquier momento desde esta pagina.
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowConsentModal(false)}>Cancelar</Button>
            <Button onClick={() => { setShowConsentModal(false); handleConnectGmail(); }} disabled={gmailConnecting} className="gap-2">
              {gmailConnecting ? <><SpinnerGap size={16} className="animate-spin" /> Conectando...</> : <><GoogleLogo size={18} weight="bold" /> Entendido, conectar</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
