import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { toast } from "sonner";
import { Wallet, ChartLineUp, Shield, Users } from "@phosphor-icons/react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Human-friendly role labels (mirrors Layout.js getRoleLabel)
const ROLE_LABELS = { admin: "Administrador", spouse: "Familiar", accountant: "Contadora" };
const getRoleLabel = (role) => ROLE_LABELS[role] || role;

// Maps common raw backend error strings to friendly Spanish messages.
// Falls back to a generic message instead of showing raw backend text.
function getFriendlyErrorMessage(error) {
  const raw = error?.response?.data?.detail || "";
  const normalized = String(raw).toLowerCase();

  if (!raw) return "Ocurrió un error, intenta de nuevo";

  if (normalized.includes("incorrect") || normalized.includes("invalid_credentials") || normalized.includes("credenciales")) {
    return "Credenciales incorrectas";
  }
  if (normalized.includes("already registered") || normalized.includes("ya esta registrado") || normalized.includes("ya está registrado")) {
    return "Ese correo ya está registrado";
  }
  if (normalized.includes("invalid_state") || normalized.includes("expired") || normalized.includes("expirada") || normalized.includes("invalida") || normalized.includes("inválida")) {
    return "El enlace de invitación no es válido o expiró";
  }
  if (normalized.includes("no coincide")) {
    return "El correo no coincide con la invitación";
  }

  return "Ocurrió un error, intenta de nuevo";
}

export default function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const { token: inviteToken } = useParams();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (searchParams.get("session_expired")) {
      toast.info("Tu sesión expiró, vuelve a ingresar");
    }
  }, [searchParams]);

  // Invite mode state
  const [inviteInfo, setInviteInfo] = useState(null); // {email, rol} when valid
  const [inviteError, setInviteError] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [invitePassword, setInvitePassword] = useState("");

  useEffect(() => {
    if (!inviteToken) return;
    axios.get(`${API}/auth/accept-invite/${inviteToken}`)
      .then((res) => setInviteInfo(res.data))
      .catch((err) => setInviteError(err.response?.data?.detail || "Invitación inválida"));
  }, [inviteToken]);

  const handleAcceptInvite = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await axios.post(`${API}/auth/register?invite_token=${encodeURIComponent(inviteToken)}`, {
        name: inviteName,
        email: inviteInfo.email,
        password: invitePassword,
        role: inviteInfo.rol,
      }, { withCredentials: true });
      toast.success("Cuenta creada. Bienvenido!");
      // Force full reload so AuthContext picks up the new session cookie
      window.location.href = "/dashboard";
    } catch (error) {
      toast.error(getFriendlyErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };
  
  // Login form
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  
  // Register form
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  // Public registration always creates the primary/admin account.
  // Additional users (spouse/accountant) are added later via the invite flow,
  // where the role comes from the invite token, not from user choice.
  const REGISTER_DEFAULT_ROLE = "admin";

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await login(loginEmail, loginPassword);
      toast.success("Bienvenido de vuelta!");
    } catch (error) {
      toast.error(getFriendlyErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await register(regName, regEmail, regPassword, REGISTER_DEFAULT_ROLE);
      toast.success("Cuenta creada exitosamente!");
    } catch (error) {
      toast.error(getFriendlyErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const features = [
    { icon: Wallet, title: "Control Total", desc: "Gestiona todos tus gastos e ingresos" },
    { icon: ChartLineUp, title: "Predicciones AI", desc: "Proyecciones inteligentes de gastos" },
    { icon: Shield, title: "Cumplimiento SRI", desc: "Categorías tributarias de Ecuador" },
    { icon: Users, title: "Multi-usuario", desc: "Acceso para familia y contadora" },
  ];

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left Panel - Hero */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-primary text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 bg-white/20 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
        </div>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative z-10"
        >
          <h1 className="text-4xl font-bold tracking-tight">Vesta</h1>
          <p className="text-primary-foreground/80 mt-2">Tu patrimonio familiar, en orden.</p>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="relative z-10 space-y-8"
        >
          <h2 className="text-3xl font-semibold leading-tight">
            Tu aliado financiero<br />para toda la familia
          </h2>
          
          <div className="grid grid-cols-2 gap-6">
            {features.map((feature, i) => (
              <motion.div 
                key={feature.title}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.4 + i * 0.1 }}
                className="flex items-start gap-3"
              >
                <div className="p-2 rounded-lg bg-white/10">
                  <feature.icon size={24} weight="duotone" />
                </div>
                <div>
                  <p className="font-medium">{feature.title}</p>
                  <p className="text-sm text-primary-foreground/70">{feature.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
        
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="relative z-10 text-sm text-primary-foreground/60"
        >
          Optimizado para leyes tributarias ecuatorianas
        </motion.p>
      </div>

      {/* Right Panel - Auth Forms */}
      <div className="flex items-center justify-center p-8 bg-background">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <div className="lg:hidden text-center mb-8">
            <h1 className="text-3xl font-bold text-primary">Vesta</h1>
            <p className="text-muted-foreground">Tu patrimonio familiar, en orden.</p>
          </div>

          <Card className="border-0 shadow-xl">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-2xl">{inviteToken ? "Aceptar invitación" : "Bienvenido"}</CardTitle>
              <CardDescription>
                {inviteToken
                  ? (inviteInfo ? `Te invitaron como ${getRoleLabel(inviteInfo.rol)}` : (inviteError || "Validando invitación..."))
                  : "Ingresa o crea tu cuenta para continuar"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {inviteToken ? (
                inviteError ? (
                  <div className="space-y-4 text-center">
                    <p className="text-sm text-red-600" data-testid="invite-error">{inviteError}</p>
                    <Button onClick={() => navigate("/login")} className="w-full">Volver a login</Button>
                  </div>
                ) : !inviteInfo ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Validando invitación...</p>
                ) : (
                  <form onSubmit={handleAcceptInvite} className="space-y-4" data-testid="accept-invite-form">
                    <div className="space-y-2">
                      <Label>Correo electrónico</Label>
                      <Input type="email" value={inviteInfo.email} disabled data-testid="invite-email" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="inv-name">Tu nombre</Label>
                      <Input id="inv-name" data-testid="invite-name" value={inviteName} onChange={(e) => setInviteName(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="inv-pass">Crea tu contraseña</Label>
                      <Input id="inv-pass" type="password" data-testid="invite-password" value={invitePassword} onChange={(e) => setInvitePassword(e.target.value)} required />
                    </div>
                    <Button type="submit" disabled={isLoading} className="w-full rounded-full" data-testid="invite-submit">
                      {isLoading ? "Creando cuenta..." : "Crear cuenta"}
                    </Button>
                  </form>
                )
              ) : (
                <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="login" data-testid="login-tab">Ingresar</TabsTrigger>
                  <TabsTrigger value="register" data-testid="register-tab">Registrarse</TabsTrigger>
                </TabsList>

                <TabsContent value="login">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-email">Correo electrónico</Label>
                      <Input
                        id="login-email"
                        data-testid="login-email"
                        type="email"
                        placeholder="tu@email.com"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="login-password">Contraseña</Label>
                      <Input
                        id="login-password"
                        data-testid="login-password"
                        type="password"
                        placeholder="••••••••"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        required
                      />
                    </div>
                    <Button 
                      type="submit" 
                      data-testid="login-submit"
                      className="w-full rounded-full"
                      disabled={isLoading}
                    >
                      {isLoading ? "Ingresando..." : "Ingresar"}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="register">
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="reg-name">Nombre completo</Label>
                      <Input
                        id="reg-name"
                        data-testid="register-name"
                        placeholder="Tu nombre"
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reg-email">Correo electrónico</Label>
                      <Input
                        id="reg-email"
                        data-testid="register-email"
                        type="email"
                        placeholder="tu@email.com"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reg-password">Contraseña</Label>
                      <Input
                        id="reg-password"
                        data-testid="register-password"
                        type="password"
                        placeholder="••••••••"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        required
                      />
                    </div>
                    <Button
                      type="submit"
                      data-testid="register-submit"
                      className="w-full rounded-full"
                      disabled={isLoading}
                    >
                      {isLoading ? "Creando cuenta..." : "Crear cuenta"}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
