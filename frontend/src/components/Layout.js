import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
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
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";
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
  CheckSquare,
  CurrencyDollar,
  X
} from "@phosphor-icons/react";

const navItems = [
  { path: "/dashboard", label: "Dashboard", icon: House, roles: ["admin", "spouse", "accountant"] },
  { path: "/transactions", label: "Transacciones", icon: CreditCard, roles: ["admin", "spouse", "accountant"] },
  { path: "/ingresos", label: "Ingresos", icon: CurrencyDollar, roles: ["admin", "spouse"] },
  { path: "/upload", label: "Cargar Datos", icon: Upload, roles: ["admin", "spouse"] },
  { path: "/budget", label: "Mi Presupuesto", icon: ChartLine, roles: ["admin", "spouse"] },
  { path: "/international", label: "Gastos USA", icon: Airplane, roles: ["admin", "spouse", "accountant"] },
  { path: "/predictions", label: "Predicciones AI", icon: Brain, roles: ["admin", "spouse"] },
  // Accountant-only items
  { path: "/reconciliation", label: "Conciliación", icon: CheckSquare, roles: ["admin", "accountant"] },
  { path: "/sri-limits", label: "Límites SRI", icon: Scales, roles: ["admin", "accountant"] },
  { path: "/accountant", label: "Vista Contadora", icon: Calculator, roles: ["admin", "accountant"] },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile/tablet
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
      if (window.innerWidth < 1024) {
        setCollapsed(true);
      }
    };
    
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const filteredNavItems = navItems.filter(item => item.roles.includes(user?.role));

  const getRoleLabel = (role) => {
    const labels = {
      admin: "Administrador",
      spouse: "Familiar",
      accountant: "Contadora"
    };
    return labels[role] || role;
  };

  const NavContent = ({ mobile = false }) => (
    <>
      {/* Logo */}
      <div className={`border-b border-border flex items-center justify-between ${mobile ? "p-4" : "p-6"}`}>
        {(!collapsed || mobile) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <h1 className="text-xl font-bold text-primary">FamilyFinance</h1>
            <p className="text-xs text-muted-foreground">Ecuador</p>
          </motion.div>
        )}
        {mobile ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(false)}
          >
            <X size={20} />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="shrink-0 hidden lg:flex"
            data-testid="sidebar-toggle"
          >
            {collapsed ? <CaretRight size={20} /> : <CaretLeft size={20} />}
          </Button>
        )}
      </div>

      {/* Navigation */}
      <nav className={`flex-1 space-y-1.5 overflow-y-auto ${mobile ? "p-3" : "p-4"}`}>
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
                {(!collapsed || mobile) && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="font-medium text-sm"
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
      <div className={`border-t border-border ${mobile ? "p-3" : "p-4"}`}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              className={`w-full justify-start gap-3 ${collapsed && !mobile ? "px-3" : "px-4"}`}
              data-testid="user-menu-trigger"
            >
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {user?.name?.charAt(0)?.toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              {(!collapsed || mobile) && (
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
    </>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-card border-b border-border z-50 flex items-center justify-between px-4">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" data-testid="mobile-menu-btn">
              <List size={24} />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-72">
            <div className="flex flex-col h-full">
              <NavContent mobile />
            </div>
          </SheetContent>
        </Sheet>
        
        <h1 className="text-lg font-bold text-primary">FamilyFinance</h1>
        
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-primary text-primary-foreground text-sm">
            {user?.name?.charAt(0)?.toUpperCase() || "U"}
          </AvatarFallback>
        </Avatar>
      </header>

      {/* Desktop Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 80 : 280 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="hidden lg:flex fixed left-0 top-0 h-full bg-card border-r border-border z-40 flex-col"
      >
        <NavContent />
      </motion.aside>

      {/* Main content */}
      <main 
        className="flex-1 transition-all duration-300 pt-16 lg:pt-0"
        style={{ marginLeft: isMobile ? 0 : (collapsed ? 80 : 280) }}
      >
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
