import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
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
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "./ui/tooltip";
import {
  SquaresFour,
  ArrowsLeftRight,
  Wallet,
  Target,
  CreditCard,
  Scales,
  Bell,
  List,
  SignOut,
  User,
  CaretLeft,
  CaretRight,
  X,
  Info,
} from "@phosphor-icons/react";

const navItems = [
  { path: "/dashboard", label: "Dashboard", icon: SquaresFour, roles: ["admin", "spouse", "accountant", "demo"] },
  { path: "/movimientos", label: "Movimientos", icon: ArrowsLeftRight, roles: ["admin", "spouse", "accountant", "demo"] },
  { path: "/mi-dinero", label: "Mi Dinero", icon: Wallet, roles: ["admin", "spouse", "demo"] },
  { path: "/viajes", label: "Metas", icon: Target, roles: ["admin", "spouse", "demo"] },
  { path: "/deudas", label: "Deudas", icon: CreditCard, roles: ["admin", "spouse", "demo"] },
  { path: "/fiscal", label: "Fiscal", icon: Scales, roles: ["admin", "spouse", "accountant", "demo"] },
  { path: "/alertas", label: "Alertas", icon: Bell, roles: ["admin", "spouse", "accountant", "demo"] },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
      if (window.innerWidth < 1024) setCollapsed(true);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const filteredNavItems = navItems.filter(item => item.roles.includes(user?.role));

  const getRoleLabel = (role) => {
    const labels = { admin: "Administrador", spouse: "Familiar", accountant: "Contadora" };
    return labels[role] || role;
  };

  const NavContent = ({ mobile = false }) => (
    <>
      {/* Logo */}
      <div className={`border-b border-[hsl(var(--sidebar-active-bg))] flex items-center justify-between ${mobile ? "p-4" : "p-6"}`}>
        {(!collapsed || mobile) && (
          <div>
            <h1 className="text-lg font-semibold text-white tracking-tight">Vesta</h1>
            <p className="text-xs text-[hsl(var(--sidebar-text))]">Tu patrimonio familiar, en orden.</p>
          </div>
        )}
        {mobile ? (
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)} className="text-[hsl(var(--sidebar-text))] hover:text-white hover:bg-[hsl(var(--sidebar-active-bg))]">
            <X size={18} />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="shrink-0 hidden lg:flex text-[hsl(var(--sidebar-text))] hover:text-white hover:bg-[hsl(var(--sidebar-active-bg))]"
            data-testid="sidebar-toggle"
          >
            {collapsed ? <CaretRight size={18} /> : <CaretLeft size={18} />}
          </Button>
        )}
      </div>

      {/* Navigation */}
      <nav className={`flex-1 space-y-1 overflow-y-auto ${mobile ? "p-3" : "p-3"}`}>
        <TooltipProvider delayDuration={200}>
        {filteredNavItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          const showTooltip = collapsed && !mobile;
          const navLink = (
            <Link
              key={item.path}
              to={item.path}
              data-testid={`nav-${item.path.slice(1)}`}
              className="block focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none rounded-md"
            >
              <div
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-[hsl(var(--sidebar-active-bg))] text-white"
                    : "text-[hsl(var(--sidebar-text))] hover:bg-[hsl(var(--sidebar-active-bg))] hover:text-white"
                }`}
              >
                <Icon size={18} strokeWidth={2} className="shrink-0" />
                {(!collapsed || mobile) && <span className="truncate">{item.label}</span>}
              </div>
            </Link>
          );

          if (!showTooltip) {
            return navLink;
          }

          return (
            <Tooltip key={item.path}>
              <TooltipTrigger asChild>{navLink}</TooltipTrigger>
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          );
        })}
        </TooltipProvider>
      </nav>

      {/* User section */}
      <div className={`border-t border-[hsl(var(--sidebar-active-bg))] ${mobile ? "p-3" : "p-3"}`}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className={`w-full justify-start gap-3 text-slate-300 hover:bg-[hsl(var(--sidebar-active-bg))] hover:text-white ${collapsed && !mobile ? "px-2" : "px-3"}`}
              data-testid="user-menu-trigger"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-white text-xs font-medium">
                  {user?.name?.charAt(0)?.toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              {(!collapsed || mobile) && (
                <div className="text-left overflow-hidden">
                  <p className="text-sm font-medium truncate max-w-[150px] text-white">{user?.name}</p>
                  <p className="text-xs text-[hsl(var(--sidebar-text))]">{getRoleLabel(user?.role)}</p>
                </div>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Mi cuenta</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2">
              <User size={15} />
              <span className="truncate">{user?.email}</span>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="gap-2 cursor-pointer">
              <Link to="/perfil">
                <User size={15} />
                Mi Perfil
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={logout}
              className="gap-2 text-[#DC2626] focus:text-[#DC2626]"
              data-testid="logout-btn"
            >
              <SignOut size={15} />
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
      <header className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-border z-50 flex items-center justify-between px-4">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" data-testid="mobile-menu-btn" className="text-foreground">
              <List size={20} />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-72 bg-[hsl(var(--sidebar-bg))] border-[hsl(var(--sidebar-active-bg))]">
            <div className="flex flex-col h-full">
              <NavContent mobile />
            </div>
          </SheetContent>
        </Sheet>

        <h1 className="text-base font-semibold text-foreground">Vesta</h1>

        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-primary text-white text-xs">
            {user?.name?.charAt(0)?.toUpperCase() || "U"}
          </AvatarFallback>
        </Avatar>
      </header>

      {/* Desktop Sidebar */}
      <aside
        style={{ width: collapsed ? 72 : 256, transition: "width 200ms" }}
        className="hidden lg:flex fixed left-0 top-0 h-full bg-[hsl(var(--sidebar-bg))] z-40 flex-col"
      >
        <NavContent />
      </aside>

      {/* Main content */}
      <main
        className="flex-1 transition-all duration-200 pt-14 lg:pt-0"
        style={{ marginLeft: isMobile ? 0 : (collapsed ? 72 : 256) }}
      >
        {/* Demo Mode Banner */}
        {user?.role === "demo" && (
          <div className="bg-amber-500 text-foreground px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2">
            <Info size={16} />
            <span><strong>Modo Demostración</strong> — Estás viendo datos ficticios de ejemplo.</span>
          </div>
        )}
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
