import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Link, Navigate } from 'react-router-dom';
import { modules } from '@/data/modules';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { SearchBar } from '@/components/dashboard/SearchBar';
import { ModuleCard } from '@/components/dashboard/ModuleCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Settings, Loader2, LogOut, KeyRound } from 'lucide-react';
import { toast } from 'sonner';

export default function Dashboard() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { isAdmin, loading: permLoading, hasModuleAccess } = useUserPermissions();
  const [searchQuery, setSearchQuery] = useState('');
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const accessibleModules = useMemo(() => {
    return modules.filter((module) => {
      if (isAdmin) return true;
      return hasModuleAccess(module.id);
    });
  }, [isAdmin, hasModuleAccess]);

  const filteredModules = useMemo(() => {
    if (!searchQuery.trim()) return accessibleModules;
    const query = searchQuery.toLowerCase();
    return accessibleModules.filter(
      (module) =>
        module.title.toLowerCase().includes(query) ||
        module.description.toLowerCase().includes(query)
    );
  }, [accessibleModules, searchQuery]);

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Contraseña actualizada exitosamente');
      setIsPasswordDialogOpen(false);
      setNewPassword('');
      setConfirmPassword('');
    }
    setChangingPassword(false);
  };

  if (authLoading || permLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-0 bg-gradient-to-br from-primary/[0.02] via-transparent to-primary/[0.02] pointer-events-none" />

      <div className="relative z-10 container max-w-6xl mx-auto px-4 py-12">
        <div className="flex items-start justify-between mb-8">
          <DashboardHeader />
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Link to="/admin">
                <Button variant="outline" size="sm" className="gap-2">
                  <Settings className="w-4 h-4" />
                  Administración
                </Button>
              </Link>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-muted-foreground hover:text-foreground"
              onClick={() => setIsPasswordDialogOpen(true)}
            >
              <KeyRound className="w-4 h-4" />
              Contraseña
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="gap-2 text-muted-foreground hover:text-foreground"
              onClick={() => signOut()}
            >
              <LogOut className="w-4 h-4" />
              Salir
            </Button>
          </div>
        </div>

        <div className="mb-8">
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              {searchQuery ? 'Resultados' : 'Tus módulos'}
            </h2>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {filteredModules.length}
            </span>
          </div>

          {filteredModules.length === 0 ? (
            <div className="text-center py-12">
              {searchQuery ? (
                <p className="text-muted-foreground">
                  No se encontraron módulos con "{searchQuery}"
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="text-muted-foreground">
                    No tienes acceso a ningún módulo.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Contacta al administrador para solicitar acceso.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredModules.map((module, index) => (
                <ModuleCard
                  key={module.id}
                  module={module}
                  index={index}
                />
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* Password Dialog */}
      <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar Contraseña</DialogTitle>
            <DialogDescription>
              Ingresa tu nueva contraseña
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nueva Contraseña</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <div className="space-y-2">
              <Label>Confirmar Contraseña</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPasswordDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleChangePassword} disabled={changingPassword}>
              {changingPassword ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
