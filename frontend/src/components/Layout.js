import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback } from "./ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { 
  House, 
  CreditCard, 
  Upload, 
  ChartLine, 
  Brain,
  Calculator,
  List,
  SignOut,
  User,
  CaretLeft,
  CaretRight,
  Airplane,
  Scales,
  CheckSquare
} from "@phosphor-icons/react";

const navItems = [
  { path: "/dashboard", label: "Dashboard", icon: House, roles: ["admin", "spouse", "accountant"] },
  { path: "/transactions", label: "Transacciones", icon: CreditCard, roles: ["admin", "spouse", "accountant"] },
  { path: "/upload", label: "Cargar Datos", icon: Upload, roles: ["admin", "spouse"] },
  { path: "/reconciliation", label: "Conciliación", icon: CheckSquare, roles: ["admin", "accountant"] },
  { path: "/budget", label: "Presupuesto", icon: ChartLine, roles: ["admin", "spouse", "accountant"] },
  { path: "/sri-limits", label: "Límites SRI", icon: Scales, roles: ["admin", "spouse", "accountant"] },
  { path: "/international", label: "Gastos Exterior", icon: Airplane, roles: ["admin", "spouse", "accountant"] },
  { path: "/predictions", label: "Predicciones AI", icon: Brain, roles: ["admin", "spouse"] },
  { path: "/accountant", label: "Vista Contadora", icon: Calculator, roles: ["admin", "accountant"] },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const filteredNavItems = navItems.filter(item => item.roles.includes(user?.role));

  const getRoleLabel = (role) => {
    const labels = {
      admin: "Administrador",
      spouse: "Familiar",
      accountant: "Contadora"
    };
    return labels[role] || role;
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 80 : 280 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="fixed left-0 top-0 h-full bg-card border-r border-border z-40 flex flex-col"
      >
        {/* Logo */}
        <div className="p-6 border-b border-border flex items-center justify-between">
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <h1 className="text-xl font-bold text-primary">FamilyFinance</h1>
              <p className="text-xs text-muted-foreground">Ecuador</p>
            </motion.div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="shrink-0"
            data-testid="sidebar-toggle"
          >
            {collapsed ? <CaretRight size={20} /> : <CaretLeft size={20} />}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {filteredNavItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path}>
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    isActive 
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" 
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                  data-testid={`nav-${item.path.slice(1)}`}
                >
                  <item.icon size={22} weight={isActive ? "fill" : "regular"} />
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="font-medium"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </motion.div>
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-border">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                className={`w-full justify-start gap-3 ${collapsed ? "px-3" : "px-4"}`}
                data-testid="user-menu-trigger"
              >
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {user?.name?.charAt(0)?.toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                {!collapsed && (
                  <div className="text-left">
                    <p className="text-sm font-medium truncate max-w-[140px]">{user?.name}</p>
                    <p className="text-xs text-muted-foreground">{getRoleLabel(user?.role)}</p>
                  </div>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Mi cuenta</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2">
                <User size={16} />
                {user?.email}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={logout} 
                className="gap-2 text-destructive focus:text-destructive"
                data-testid="logout-btn"
              >
                <SignOut size={16} />
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </motion.aside>

      {/* Main content */}
      <main 
        className="flex-1 transition-all duration-300"
        style={{ marginLeft: collapsed ? 80 : 280 }}
      >
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
