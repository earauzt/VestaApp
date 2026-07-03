import { BrowserRouter, Routes, Route, Navigate, Link } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";
import { toast } from "sonner";
import { AuthProvider, useAuth } from "./context/AuthContext";
import ChatBot from "./components/ChatBot";
import FAB from "./components/FAB";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Movimientos from "./pages/Movimientos";
import MiDinero from "./pages/MiDinero";
import Fiscal from "./pages/Fiscal";
import Deudas from "./pages/Deudas";
import MetasViaje from "./pages/MetasViaje";
import Perfil from "./pages/Perfil";
import Layout from "./components/Layout";

function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4 px-4 text-center">
      <h1 className="text-4xl font-bold text-[#0D9E82]">404</h1>
      <p className="text-lg font-medium text-foreground">Página no encontrada</p>
      <p className="text-sm text-muted-foreground max-w-sm">
        La página que buscas no existe o fue movida.
      </p>
      <Link to="/dashboard" className="text-sm font-medium text-[#0D9E82] hover:underline">
        Volver al dashboard
      </Link>
    </div>
  );
}

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Cargando...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    toast.error("No tienes acceso a esa sección");
    return <Navigate to="/dashboard" replace />;
  }

  return <Layout>{children}</Layout>;
};

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/accept-invite/:token" element={<Login />} />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute allowedRoles={["admin", "spouse", "accountant", "demo"]}>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      {/* Movimientos = Bandeja Financiera + Transacciones */}
      <Route
        path="/movimientos"
        element={
          <ProtectedRoute allowedRoles={["admin", "spouse", "accountant", "demo"]}>
            <Movimientos />
          </ProtectedRoute>
        }
      />

      {/* Mi Dinero = Presupuesto + Ingresos + Flujo */}
      <Route
        path="/mi-dinero"
        element={
          <ProtectedRoute allowedRoles={["admin", "spouse", "demo"]}>
            <MiDinero />
          </ProtectedRoute>
        }
      />

      {/* Fiscal = Facturas + Deducciones + Resumen */}
      <Route
        path="/fiscal"
        element={
          <ProtectedRoute allowedRoles={["admin", "spouse", "accountant", "demo"]}>
            <Fiscal />
          </ProtectedRoute>
        }
      />

      <Route
        path="/deudas"
        element={
          <ProtectedRoute allowedRoles={["admin", "spouse", "demo"]}>
            <Deudas />
          </ProtectedRoute>
        }
      />

      <Route
        path="/viajes"
        element={
          <ProtectedRoute allowedRoles={["admin", "spouse", "demo"]}>
            <MetasViaje />
          </ProtectedRoute>
        }
      />

      <Route
        path="/perfil"
        element={
          <ProtectedRoute allowedRoles={["admin", "spouse", "accountant", "demo"]}>
            <Perfil />
          </ProtectedRoute>
        }
      />

      {/* Legacy redirects — keep to avoid breaking bookmarks */}
      <Route path="/cargar" element={<Navigate to="/movimientos?tab=por-revisar" replace />} />
      <Route path="/transactions" element={<Navigate to="/movimientos?tab=todos" replace />} />
      <Route path="/budget" element={<Navigate to="/mi-dinero?tab=presupuesto" replace />} />
      <Route path="/ingresos" element={<Navigate to="/mi-dinero?tab=ingresos" replace />} />
      <Route path="/flujo" element={<Navigate to="/mi-dinero?tab=flujo" replace />} />
      <Route path="/sri-match" element={<Navigate to="/fiscal?tab=facturas" replace />} />
      <Route path="/sri-limits" element={<Navigate to="/fiscal?tab=deducciones" replace />} />
      <Route path="/accountant" element={<Navigate to="/fiscal?tab=resumen" replace />} />
      <Route path="/metas-viaje" element={<Navigate to="/viajes" replace />} />
      <Route path="/predictions" element={<Navigate to="/dashboard" replace />} />
      <Route path="/international" element={<Navigate to="/movimientos?tab=todos" replace />} />

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <ChatBotWrapper />
        <FABWrapper />
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </BrowserRouter>
  );
}

function ChatBotWrapper() {
  const { user } = useAuth();
  if (!user) return null;
  return <ChatBot />;
}

function FABWrapper() {
  const { user } = useAuth();
  if (!user) return null;
  return <FAB />;
}

export default App;
