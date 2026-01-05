import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { Loader2, ShieldX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

interface ModuleRouteProps {
  children: ReactNode;
  moduleId: string;
}

export function ModuleRoute({ children, moduleId }: ModuleRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { loading: permLoading, hasModuleAccess } = useUserPermissions();
  const location = useLocation();

  if (authLoading || permLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (!hasModuleAccess(moduleId)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 max-w-md px-4">
          <div className="flex justify-center">
            <div className="p-4 rounded-full bg-destructive/10">
              <ShieldX className="h-12 w-12 text-destructive" />
            </div>
          </div>
          <h1 className="text-2xl font-bold">Acceso no autorizado</h1>
          <p className="text-muted-foreground">
            No tienes permisos para acceder a este módulo. Contacta al administrador si crees que esto es un error.
          </p>
          <Link to="/dashboard">
            <Button>Volver al inicio</Button>
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
