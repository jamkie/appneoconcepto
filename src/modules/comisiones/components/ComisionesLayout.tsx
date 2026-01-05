import { ReactNode, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  Users,
  CreditCard,
  LogOut,
  ChevronLeft,
  Menu,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const navigation = [
  { name: "Dashboard", href: "/comisiones", icon: LayoutDashboard },
  { name: "Ventas", href: "/comisiones/ventas", icon: FileText },
  { name: "Vendedores", href: "/comisiones/vendedores", icon: Users },
  { name: "Pagos", href: "/comisiones/pagos", icon: CreditCard },
];

interface ComisionesLayoutProps {
  children: ReactNode;
}

export function ComisionesLayout({ children }: ComisionesLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { user, signOut } = useAuth();
  const { isAdmin } = useUserRole();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const NavContent = () => (
    <div className="flex flex-col h-full">
      {/* Back to Dashboard */}
      <div className="p-4 border-b border-border">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={() => navigate("/dashboard")}
        >
          <ArrowLeft className="h-4 w-4" />
          {!collapsed && "Volver al Hub"}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <NavLink
              key={item.name}
              to={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{item.name}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* User section */}
      <div className="p-4 border-t border-border space-y-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-destructive hover:text-destructive"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && "Cerrar sesión"}
        </Button>
        {!collapsed && user && (
          <p className="text-xs text-muted-foreground truncate px-2 pt-2">
            {user.email}
          </p>
        )}
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <div className="min-h-screen bg-background">
        {/* Mobile Header */}
        <header className="fixed top-0 left-0 right-0 h-14 bg-card border-b border-border flex items-center justify-between px-4 z-50">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <SheetHeader className="p-4 border-b border-border">
                <SheetTitle className="text-left">Comisiones</SheetTitle>
              </SheetHeader>
              <NavContent />
            </SheetContent>
          </Sheet>
          <span className="font-semibold">Comisiones</span>
          <div className="w-10" />
        </header>

        {/* Main content */}
        <main className="pt-14 min-h-screen p-4">{children}</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 h-screen bg-card border-r border-border transition-all duration-300 z-40",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {/* Header */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-border">
          {!collapsed && <span className="font-semibold">Comisiones</span>}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCollapsed(!collapsed)}
          >
            <ChevronLeft
              className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")}
            />
          </Button>
        </div>
        <NavContent />
      </aside>

      {/* Main content */}
      <main
        className={cn(
          "min-h-screen p-8 transition-all duration-300",
          collapsed ? "ml-16" : "ml-64"
        )}
      >
        {children}
      </main>
    </div>
  );
}
