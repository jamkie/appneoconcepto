import { Link, useLocation, Outlet } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Building2, 
  Users, 
  ClipboardList, 
  FileText, 
  Wallet, 
  DollarSign,
  ArrowLeft,
  Menu,
  Hammer,
  Calendar
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const navItems = [
  { href: '/destajos', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/destajos/obras', label: 'Obras', icon: Building2 },
  { href: '/destajos/instaladores', label: 'Instaladores', icon: Users },
  { href: '/destajos/avances', label: 'Avances', icon: ClipboardList },
  { href: '/destajos/extras', label: 'Extras', icon: FileText },
  { href: '/destajos/solicitudes', label: 'Solicitudes', icon: Wallet },
  { href: '/destajos/cortes', label: 'Cortes', icon: Calendar },
  { href: '/destajos/pagos', label: 'Pagos', icon: DollarSign },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const { user } = useAuth();

  const isActive = (href: string, exact?: boolean) => {
    if (exact) {
      return location.pathname === href;
    }
    return location.pathname.startsWith(href);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <Link to="/dashboard" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Volver al inicio</span>
        </Link>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Hammer className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">Destajos</h2>
            <p className="text-xs text-muted-foreground">Control de pagos por obra</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 overflow-y-auto">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const active = isActive(item.href, item.exact);
            return (
              <li key={item.href}>
                <Link
                  to={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      {user && (
        <div className="p-4 border-t border-border">
          <p className="text-xs text-muted-foreground truncate">
            {user.email}
          </p>
        </div>
      )}
    </div>
  );
}

export function DestajosLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const isMobile = useIsMobile();

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      {isMobile && (
        <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-background border-b border-border flex items-center px-4">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <SidebarContent onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>
          <div className="ml-3 flex items-center gap-2">
            <Hammer className="w-5 h-5 text-primary" />
            <span className="font-semibold">Destajos</span>
          </div>
        </header>
      )}

      {/* Desktop Sidebar */}
      {!isMobile && (
        <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-card border-r border-border">
          <SidebarContent />
        </aside>
      )}

      {/* Main Content */}
      <main className={cn(
        "min-h-screen transition-all duration-300",
        isMobile ? "pt-14" : "ml-64"
      )}>
        <div className="p-4 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
