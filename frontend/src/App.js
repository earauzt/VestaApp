import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import Upload from "./pages/Upload";
import Budget from "./pages/Budget";
import Predictions from "./pages/Predictions";
import AccountantView from "./pages/AccountantView";
import InternationalExpenses from "./pages/InternationalExpenses";
import SRILimits from "./pages/SRILimits";
import Reconciliation from "./pages/Reconciliation";
import Ingresos from "./pages/Ingresos";
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
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/transactions" 
        element={
          <ProtectedRoute>
            <Transactions />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/upload" 
        element={
          <ProtectedRoute>
            <Upload />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/budget" 
        element={
          <ProtectedRoute>
            <Budget />
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
          <ProtectedRoute>
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
          <ProtectedRoute allowedRoles={["admin", "spouse"]}>
            <Ingresos />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/reconciliation" 
        element={
          <ProtectedRoute allowedRoles={["admin", "accountant"]}>
            <Reconciliation />
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
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
