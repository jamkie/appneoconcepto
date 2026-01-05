import { useState, useEffect } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserPermissions, AppRole } from '@/hooks/useUserPermissions';
import { supabase } from '@/integrations/supabase/client';
import { modules } from '@/data/modules';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  Users,
  Shield,
  Search,
  Loader2,
  Settings,
  Save,
} from 'lucide-react';
import { toast } from 'sonner';

interface UserProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  role?: AppRole;
  moduleIds?: string[];
}

interface ModulePermissionRow {
  user_id: string;
  module_id: string;
}

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: permLoading } = useUserPermissions();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [editRole, setEditRole] = useState<AppRole>('user');
  const [editModules, setEditModules] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  const fetchModulePermissions = async (): Promise<ModulePermissionRow[]> => {
    const session = await supabase.auth.getSession();
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/user_module_permissions?select=user_id,module_id`,
      {
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${session.data.session?.access_token}`,
        },
      }
    );
    if (response.ok) {
      return await response.json();
    }
    return [];
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Fetch all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .order('full_name');

      if (profilesError) throw profilesError;

      // Fetch all roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Fetch all module permissions via REST API
      const permissions = await fetchModulePermissions();

      // Combine data
      const usersWithRoles = profiles?.map((profile) => {
        const userRole = roles?.find((r) => r.user_id === profile.id);
        const userModules = permissions
          ?.filter((p) => p.user_id === profile.id)
          .map((p) => p.module_id) || [];

        return {
          ...profile,
          role: (userRole?.role as AppRole) || 'user',
          moduleIds: userModules,
        };
      }) || [];

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  const openEditDialog = (userProfile: UserProfile) => {
    setSelectedUser(userProfile);
    setEditRole(userProfile.role || 'user');
    setEditModules(userProfile.moduleIds || []);
  };

  const handleSave = async () => {
    if (!selectedUser) return;

    setSaving(true);
    try {
      const session = await supabase.auth.getSession();
      const authHeader = {
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${session.data.session?.access_token}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      };

      // Update or insert role
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', selectedUser.id)
        .maybeSingle();

      if (existingRole) {
        await supabase
          .from('user_roles')
          .update({ role: editRole })
          .eq('user_id', selectedUser.id);
      } else {
        await supabase.from('user_roles').insert({
          user_id: selectedUser.id,
          role: editRole,
        });
      }

      // Delete existing module permissions via REST API
      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/user_module_permissions?user_id=eq.${selectedUser.id}`,
        {
          method: 'DELETE',
          headers: authHeader,
        }
      );

      // Insert new module permissions (only for non-admins)
      if (editRole !== 'admin' && editModules.length > 0) {
        const insertData = editModules.map((moduleId) => ({
          user_id: selectedUser.id,
          module_id: moduleId,
          created_by: user?.id,
        }));

        await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/user_module_permissions`,
          {
            method: 'POST',
            headers: authHeader,
            body: JSON.stringify(insertData),
          }
        );
      }

      toast.success('Permisos actualizados');
      setSelectedUser(null);
      fetchUsers();
    } catch (error) {
      console.error('Error saving permissions:', error);
      toast.error('Error al guardar permisos');
    } finally {
      setSaving(false);
    }
  };

  const toggleModule = (moduleId: string) => {
    setEditModules((prev) =>
      prev.includes(moduleId)
        ? prev.filter((id) => id !== moduleId)
        : [...prev, moduleId]
    );
  };

  // Loading states
  if (authLoading || permLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Auth check
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Admin check
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const filteredUsers = users.filter(
    (u) =>
      u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const activeModules = modules.filter((m) => m.status === 'active');

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link to="/dashboard">
            <Button variant="ghost" size="sm" className="gap-2 mb-4">
              <ArrowLeft className="w-4 h-4" />
              Volver al HUB
            </Button>
          </Link>

          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/10">
              <Settings className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Administración
              </h1>
              <p className="text-muted-foreground">
                Gestiona usuarios, roles y permisos de módulos
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{users.length}</p>
                <p className="text-sm text-muted-foreground">Usuarios</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Shield className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {users.filter((u) => u.role === 'admin').length}
                </p>
                <p className="text-sm text-muted-foreground">Administradores</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <Settings className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeModules.length}</p>
                <p className="text-sm text-muted-foreground">Módulos activos</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-md mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar usuarios..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Users Table */}
        <div className="rounded-xl border bg-card overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Módulos</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((userProfile) => (
                  <TableRow key={userProfile.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {userProfile.full_name || 'Sin nombre'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {userProfile.email}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          userProfile.role === 'admin' ? 'default' : 'secondary'
                        }
                      >
                        {userProfile.role === 'admin' ? 'Admin' : 'Usuario'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {userProfile.role === 'admin' ? (
                        <span className="text-sm text-muted-foreground">
                          Todos los módulos
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {userProfile.moduleIds?.length ? (
                            userProfile.moduleIds.slice(0, 3).map((id) => {
                              const mod = modules.find((m) => m.id === id);
                              return (
                                <Badge
                                  key={id}
                                  variant="outline"
                                  className="text-xs"
                                >
                                  {mod?.title || id}
                                </Badge>
                              );
                            })
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              Sin acceso
                            </span>
                          )}
                          {(userProfile.moduleIds?.length || 0) > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{(userProfile.moduleIds?.length || 0) - 3}
                            </Badge>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(userProfile)}
                      >
                        Editar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Edit Dialog */}
        <Dialog
          open={!!selectedUser}
          onOpenChange={() => setSelectedUser(null)}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Editar permisos</DialogTitle>
            </DialogHeader>

            <div className="space-y-6 py-4">
              <div>
                <p className="font-medium">{selectedUser?.full_name}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedUser?.email}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Rol</label>
                <Select
                  value={editRole}
                  onValueChange={(v) => setEditRole(v as AppRole)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Usuario</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {editRole !== 'admin' && (
                <div className="space-y-3">
                  <label className="text-sm font-medium">Acceso a módulos</label>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {activeModules.map((mod) => (
                      <div
                        key={mod.id}
                        className="flex items-center space-x-3 p-2 rounded-lg hover:bg-muted/50"
                      >
                        <Checkbox
                          id={mod.id}
                          checked={editModules.includes(mod.id)}
                          onCheckedChange={() => toggleModule(mod.id)}
                        />
                        <label
                          htmlFor={mod.id}
                          className="flex-1 text-sm cursor-pointer"
                        >
                          {mod.title}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {editRole === 'admin' && (
                <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                  Los administradores tienen acceso a todos los módulos automáticamente.
                </p>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedUser(null)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                Guardar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
