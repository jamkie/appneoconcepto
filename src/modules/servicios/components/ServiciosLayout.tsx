import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  LayoutDashboard,
  Ticket,
  Users,
  FolderKanban,
  Calendar,
  BarChart3,
  Headphones,
} from 'lucide-react';

const navItems = [
  { title: 'Dashboard', path: '/servicios', icon: LayoutDashboard },
  { title: 'Tickets', path: '/servicios/tickets', icon: Ticket },
  { title: 'Clientes', path: '/servicios/clientes', icon: Users },
  { title: 'Proyectos', path: '/servicios/proyectos', icon: FolderKanban },
  { title: 'Agenda', path: '/servicios/agenda', icon: Calendar },
  { title: 'Reportes', path: '/servicios/reportes', icon: BarChart3 },
];

interface ServiciosLayoutProps {
  children: ReactNode;
}

export function ServiciosLayout({ children }: ServiciosLayoutProps) {
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/servicios') return location.pathname === '/servicios';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r bg-card">
        <div className="p-4 border-b">
          <Link to="/dashboard">
            <Button variant="ghost" size="sm" className="gap-2 w-full justify-start">
              <ArrowLeft className="w-4 h-4" />
              Volver al HUB
            </Button>
          </Link>
        </div>

        <div className="p-4 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Headphones className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Servicios</h2>
              <p className="text-xs text-muted-foreground">Atención al Cliente</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.path} to={item.path}>
                <Button
                  variant="ghost"
                  className={cn(
                    'w-full justify-start gap-3',
                    isActive(item.path) &&
                      'bg-primary/10 text-primary hover:bg-primary/15'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {item.title}
                </Button>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-card border-b">
        <div className="flex items-center justify-between p-3">
          <Link to="/dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Headphones className="w-5 h-5 text-primary" />
            <span className="font-semibold">Servicios</span>
          </div>
          <div className="w-10" />
        </div>
        <nav className="flex overflow-x-auto px-2 pb-2 gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.path} to={item.path}>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'flex-shrink-0 gap-2',
                    isActive(item.path) &&
                      'bg-primary/10 text-primary hover:bg-primary/15'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {item.title}
                </Button>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Main Content */}
      <main className="flex-1 md:pt-0 pt-28 pb-4 overflow-auto">{children}</main>
    </div>
  );
}
