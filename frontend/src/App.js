import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";
import { AuthProvider, useAuth } from "./context/AuthContext";
import ChatBot from "./components/ChatBot";
import FAB from "./components/FAB";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import CargarValidar from "./pages/CargarValidar";
import PresupuestoEditable from "./pages/PresupuestoEditable";
import Predictions from "./pages/Predictions";
import AccountantView from "./pages/AccountantView";
import InternationalExpenses from "./pages/InternationalExpenses";
import SRILimits from "./pages/SRILimits";
import Ingresos from "./pages/Ingresos";
import Deudas from "./pages/Deudas";
import Flujo from "./pages/Flujo";
import MetasViaje from "./pages/MetasViaje";
import Perfil from "./pages/Perfil";
import Layout from "./components/Layout";

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
    return <Navigate to="/dashboard" replace />;
  }
  
  return <Layout>{children}</Layout>;
};

function AppRoutes() {
  const { user } = useAuth();
  
  return (
    <Routes>
      <Route 
        path="/login" 
        element={user ? <Navigate to="/dashboard" replace /> : <Login />} 
      />
      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute allowedRoles={["admin", "spouse", "accountant", "demo"]}>
            <Dashboard />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/transactions" 
        element={
          <ProtectedRoute allowedRoles={["admin", "spouse", "accountant", "demo"]}>
            <Transactions />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/cargar" 
        element={
          <ProtectedRoute allowedRoles={["admin", "spouse", "accountant"]}>
            <CargarValidar />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/budget" 
        element={
          <ProtectedRoute allowedRoles={["admin", "spouse", "demo"]}>
            <PresupuestoEditable />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/predictions" 
        element={
          <ProtectedRoute allowedRoles={["admin", "spouse"]}>
            <Predictions />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/accountant" 
        element={
          <ProtectedRoute allowedRoles={["admin", "accountant"]}>
            <AccountantView />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/international" 
        element={
          <ProtectedRoute allowedRoles={["admin", "spouse", "accountant", "demo"]}>
            <InternationalExpenses />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/sri-limits" 
        element={
          <ProtectedRoute allowedRoles={["admin", "accountant"]}>
            <SRILimits />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/ingresos" 
        element={
          <ProtectedRoute allowedRoles={["admin", "spouse", "demo"]}>
            <Ingresos />
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
        path="/flujo" 
        element={
          <ProtectedRoute allowedRoles={["admin", "spouse"]}>
            <Flujo />
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
      {/* Redirect old route */}
      <Route path="/metas-viaje" element={<Navigate to="/viajes" replace />} />
      <Route 
        path="/perfil" 
        element={
          <ProtectedRoute allowedRoles={["admin", "spouse", "accountant", "demo"]}>
            <Perfil />
          </ProtectedRoute>
        } 
      />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
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

// ChatBot solo se muestra cuando el usuario está logueado
function ChatBotWrapper() {
  const { user } = useAuth();
  if (!user) return null;
  return <ChatBot />;
}

// FAB solo se muestra cuando el usuario está logueado
function FABWrapper() {
  const { user } = useAuth();
  if (!user) return null;
  return <FAB />;
}

export default App;
