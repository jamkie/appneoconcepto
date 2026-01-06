import { useState, useEffect } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserPermissions, AppRole } from '@/hooks/useUserPermissions';
import { supabase } from '@/integrations/supabase/client';
import { modules } from '@/data/modules';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  DialogDescription,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  Users,
  Shield,
  Search,
  Loader2,
  Settings,
  Save,
  UserPlus,
  Power,
} from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';

interface UserProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  activo?: boolean;
  role?: AppRole;
  moduleIds?: string[];
  isSeller?: boolean;
}

interface ModulePermissionRow {
  user_id: string;
  module_id: string;
}

const createUserSchema = z.object({
  email: z.string().trim().email('Email inválido').max(255),
  password: z.string().min(6, 'Mínimo 6 caracteres').max(72),
  fullName: z.string().trim().min(1, 'Nombre requerido').max(100),
});

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: permLoading } = useUserPermissions();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | AppRole>('all');
  const [filterModule, setFilterModule] = useState<string>('all');
  const [filterSeller, setFilterSeller] = useState<'all' | 'yes' | 'no'>('all');
  const [filterActivo, setFilterActivo] = useState<'all' | 'yes' | 'no'>('all');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [editRole, setEditRole] = useState<AppRole>('user');
  const [editModules, setEditModules] = useState<string[]>([]);
  const [editIsSeller, setEditIsSeller] = useState(false);
  const [saving, setSaving] = useState(false);

  // Create user state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState<AppRole>('user');
  const [newUserModules, setNewUserModules] = useState<string[]>([]);
  const [newUserIsSeller, setNewUserIsSeller] = useState(false);
  const [creating, setCreating] = useState(false);

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
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, full_name, activo')
        .order('full_name');

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      const permissions = await fetchModulePermissions();

      // Fetch sellers to know which users are sellers
      const { data: sellers } = await supabase
        .from('sellers')
        .select('user_id');

      const sellerUserIds = new Set(sellers?.map((s) => s.user_id).filter(Boolean) || []);

      const usersWithRoles = profiles?.map((profile) => {
        const userRole = roles?.find((r) => r.user_id === profile.id);
        const userModules = permissions
          ?.filter((p) => p.user_id === profile.id)
          .map((p) => p.module_id) || [];

        return {
          ...profile,
          activo: profile.activo ?? true,
          role: (userRole?.role as AppRole) || 'user',
          moduleIds: userModules,
          isSeller: sellerUserIds.has(profile.id),
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
    setEditIsSeller(userProfile.isSeller || false);
  };

  const handleToggleActivo = async (userProfile: UserProfile) => {
    const newActivo = !userProfile.activo;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ activo: newActivo })
        .eq('id', userProfile.id);

      if (error) throw error;

      setUsers((prev) =>
        prev.map((u) =>
          u.id === userProfile.id ? { ...u, activo: newActivo } : u
        )
      );
      toast.success(newActivo ? 'Usuario activado' : 'Usuario desactivado');
    } catch (error) {
      console.error('Error toggling user status:', error);
      toast.error('Error al cambiar estado del usuario');
    }
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

      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/user_module_permissions?user_id=eq.${selectedUser.id}`,
        {
          method: 'DELETE',
          headers: authHeader,
        }
      );

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

      // Handle seller status
      const wasSeller = selectedUser.isSeller || false;
      if (editIsSeller && !wasSeller) {
        // Add as seller
        await supabase.from('sellers').insert({
          name: selectedUser.full_name || selectedUser.email || '',
          email: selectedUser.email || '',
          user_id: selectedUser.id,
        });
      } else if (!editIsSeller && wasSeller) {
        // Remove as seller
        await supabase.from('sellers').delete().eq('user_id', selectedUser.id);
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

  const handleCreateUser = async () => {
    try {
      createUserSchema.parse({
        email: newUserEmail,
        password: newUserPassword,
        fullName: newUserName,
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0].message);
        return;
      }
    }

    setCreating(true);
    try {
      // Call edge function to create user (doesn't switch session)
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          email: newUserEmail.trim(),
          password: newUserPassword,
          fullName: newUserName.trim(),
          role: newUserRole,
          moduleIds: newUserRole !== 'admin' ? newUserModules : [],
          isSeller: newUserIsSeller,
        },
      });

      if (error) {
        const message = error.message || 'Error al crear usuario';
        if (message.toLowerCase().includes('already') || message.toLowerCase().includes('exists')) {
          toast.error('Este email ya está registrado');
        } else {
          toast.error(message);
        }
        return;
      }

      if (!data?.success) {
        toast.error('Error al crear usuario');
        return;
      }

      toast.success('Usuario creado exitosamente');
      setShowCreateDialog(false);
      resetCreateForm();
      fetchUsers();
    } catch (error) {
      console.error('Error creating user:', error);
      toast.error('Error al crear usuario');
    } finally {
      setCreating(false);
    }
  };

  const resetCreateForm = () => {
    setNewUserEmail('');
    setNewUserPassword('');
    setNewUserName('');
    setNewUserRole('user');
    setNewUserModules([]);
    setNewUserIsSeller(false);
  };

  const toggleModule = (moduleId: string) => {
    setEditModules((prev) =>
      prev.includes(moduleId)
        ? prev.filter((id) => id !== moduleId)
        : [...prev, moduleId]
    );
  };

  const toggleNewUserModule = (moduleId: string) => {
    setNewUserModules((prev) =>
      prev.includes(moduleId)
        ? prev.filter((id) => id !== moduleId)
        : [...prev, moduleId]
    );
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

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase());
    const matchesRole = filterRole === 'all' || u.role === filterRole;
    const matchesModule =
      filterModule === 'all' ||
      u.role === 'admin' ||
      u.moduleIds?.includes(filterModule);
    const matchesSeller =
      filterSeller === 'all' ||
      (filterSeller === 'yes' && u.isSeller) ||
      (filterSeller === 'no' && !u.isSeller);
    const matchesActivo =
      filterActivo === 'all' ||
      (filterActivo === 'yes' && u.activo) ||
      (filterActivo === 'no' && !u.activo);
    return matchesSearch && matchesRole && matchesModule && matchesSeller && matchesActivo;
  });

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

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-primary/10">
                <Settings className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  Administración
                </h1>
                <p className="text-muted-foreground">
                  Gestiona usuarios, roles y permisos
                </p>
              </div>
            </div>
            <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
              <UserPlus className="w-4 h-4" />
              Agregar Usuario
            </Button>
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

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar usuarios..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterRole} onValueChange={(v) => setFilterRole(v as 'all' | AppRole)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Rol" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los roles</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="user">Usuario</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterModule} onValueChange={setFilterModule}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Módulo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los módulos</SelectItem>
              {activeModules.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterSeller} onValueChange={(v) => setFilterSeller(v as 'all' | 'yes' | 'no')}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Vendedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="yes">Vendedores</SelectItem>
              <SelectItem value="no">No vendedores</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterActivo} onValueChange={(v) => setFilterActivo(v as 'all' | 'yes' | 'no')}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="yes">Activos</SelectItem>
              <SelectItem value="no">Inactivos</SelectItem>
            </SelectContent>
          </Select>
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
                      <div className="flex items-center gap-2">
                        <div>
                          <p className={`font-medium ${!userProfile.activo ? 'text-muted-foreground line-through' : ''}`}>
                            {userProfile.full_name || 'Sin nombre'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {userProfile.email}
                          </p>
                        </div>
                        {!userProfile.activo && (
                          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                            Inactivo
                          </Badge>
                        )}
                        {userProfile.isSeller && (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                            Vendedor
                          </Badge>
                        )}
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
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className={userProfile.activo ? 'text-emerald-600 hover:text-emerald-700' : 'text-muted-foreground hover:text-foreground'}
                          onClick={() => handleToggleActivo(userProfile)}
                          title={userProfile.activo ? 'Desactivar usuario' : 'Activar usuario'}
                        >
                          <Power className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(userProfile)}
                        >
                          Editar
                        </Button>
                      </div>
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
                <Label>Rol</Label>
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
                  <Label>Acceso a módulos</Label>
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
                  Los administradores tienen acceso a todos los módulos.
                </p>
              )}

              <div className="flex items-center space-x-3 p-3 rounded-lg border bg-muted/30">
                <Checkbox
                  id="edit-user-seller"
                  checked={editIsSeller}
                  onCheckedChange={(checked) => setEditIsSeller(checked === true)}
                />
                <label
                  htmlFor="edit-user-seller"
                  className="flex-1 text-sm cursor-pointer"
                >
                  <span className="font-medium">Asignar como vendedor</span>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Este usuario podrá registrar ventas y recibir comisiones
                  </p>
                </label>
              </div>
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

        {/* Create User Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Agregar Usuario</DialogTitle>
              <DialogDescription>
                Crea una nueva cuenta de usuario
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="new-name">Nombre completo</Label>
                <Input
                  id="new-name"
                  placeholder="Nombre del usuario"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-email">Correo electrónico</Label>
                <Input
                  id="new-email"
                  type="email"
                  placeholder="usuario@ejemplo.com"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-password">Contraseña</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Rol</Label>
                <Select
                  value={newUserRole}
                  onValueChange={(v) => setNewUserRole(v as AppRole)}
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

              {newUserRole !== 'admin' && (
                <div className="space-y-3">
                  <Label>Acceso a módulos</Label>
                  <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-2">
                    {activeModules.map((mod) => (
                      <div
                        key={mod.id}
                        className="flex items-center space-x-3 p-2 rounded-lg hover:bg-muted/50"
                      >
                        <Checkbox
                          id={`new-${mod.id}`}
                          checked={newUserModules.includes(mod.id)}
                          onCheckedChange={() => toggleNewUserModule(mod.id)}
                        />
                        <label
                          htmlFor={`new-${mod.id}`}
                          className="flex-1 text-sm cursor-pointer"
                        >
                          {mod.title}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {newUserRole === 'admin' && (
                <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                  Los administradores tienen acceso a todos los módulos.
                </p>
              )}

              <div className="flex items-center space-x-3 p-3 rounded-lg border bg-muted/30">
                <Checkbox
                  id="new-user-seller"
                  checked={newUserIsSeller}
                  onCheckedChange={(checked) => setNewUserIsSeller(checked === true)}
                />
                <label
                  htmlFor="new-user-seller"
                  className="flex-1 text-sm cursor-pointer"
                >
                  <span className="font-medium">Asignar como vendedor</span>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Este usuario podrá registrar ventas y recibir comisiones
                  </p>
                </label>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateDialog(false);
                  resetCreateForm();
                }}
              >
                Cancelar
              </Button>
              <Button onClick={handleCreateUser} disabled={creating}>
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <UserPlus className="mr-2 h-4 w-4" />
                Crear Usuario
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
