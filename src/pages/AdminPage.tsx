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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
  Trash2,
  KeyRound,
} from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  UserPermissionsEditor,
  loadUserPermissions,
  saveUserPermissions,
} from '@/components/admin/UserPermissionsEditor';
import { PermissionsCopyTools } from '@/components/admin/PermissionsCopyTools';

interface Permission {
  can_read: boolean;
  can_create: boolean;
  can_update: boolean;
  can_delete: boolean;
}

interface PermissionsState {
  [key: string]: Permission;
}

interface UserProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  activo?: boolean;
  role?: AppRole;
  isSeller?: boolean;
}

interface ModulePermissionRow {
  user_id: string;
  module_id: string;
}

const createUserSchema = z.object({
  email: z.string().trim().email('Email inválido').max(255),
  password: z.string().min(6, 'Mínimo 6 caracteres').max(72).optional(),
  fullName: z.string().trim().min(1, 'Nombre requerido').max(100),
});

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: permLoading } = useUserPermissions();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | AppRole>('all');
  const [filterSeller, setFilterSeller] = useState<'all' | 'yes' | 'no'>('all');
  const [filterActivo, setFilterActivo] = useState<'all' | 'yes' | 'no'>('all');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [editRole, setEditRole] = useState<AppRole>('user');
  const [editIsSeller, setEditIsSeller] = useState(false);
  const [editPermissions, setEditPermissions] = useState<PermissionsState>({});
  const [editDialogTab, setEditDialogTab] = useState<'general' | 'permissions'>('general');
  const [saving, setSaving] = useState(false);
  const [loadingPermissions, setLoadingPermissions] = useState(false);

  // Create user state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState<AppRole>('user');
  const [newUserIsSeller, setNewUserIsSeller] = useState(false);
  const [newUserGeneratePassword, setNewUserGeneratePassword] = useState(true);
  const [newUserPermissions, setNewUserPermissions] = useState<PermissionsState>({});
  const [newUserDialogTab, setNewUserDialogTab] = useState<'general' | 'permissions'>('general');
  const [creating, setCreating] = useState(false);

  // Delete user state
  const [deleteUser, setDeleteUser] = useState<UserProfile | null>(null);
  const [deleteHasMovements, setDeleteHasMovements] = useState(false);
  const [checkingMovements, setCheckingMovements] = useState(false);

  // Password reset state
  const [passwordResetUser, setPasswordResetUser] = useState<UserProfile | null>(null);
  const [newPasswordValue, setNewPasswordValue] = useState('');
  const [generateNewPassword, setGenerateNewPassword] = useState(true);
  const [sendPasswordEmail, setSendPasswordEmail] = useState(true);

  const [resettingPassword, setResettingPassword] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

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

      // Fetch sellers to know which users are sellers
      const { data: sellers } = await supabase
        .from('sellers')
        .select('user_id');

      const sellerUserIds = new Set(sellers?.map((s) => s.user_id).filter(Boolean) || []);

      const usersWithRoles: UserProfile[] = profiles?.map((profile) => {
        const userRole = roles?.find((r) => r.user_id === profile.id);

        return {
          ...profile,
          activo: profile.activo ?? true,
          role: (userRole?.role as AppRole) || 'user',
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

  const openEditDialog = async (userProfile: UserProfile) => {
    setSelectedUser(userProfile);
    setEditRole(userProfile.role || 'user');
    setEditIsSeller(userProfile.isSeller || false);
    setEditDialogTab('general');
    setEditPermissions({});

    // Load user permissions
    if (userProfile.role !== 'admin') {
      setLoadingPermissions(true);
      const perms = await loadUserPermissions(userProfile.id);
      setEditPermissions(perms);
      setLoadingPermissions(false);
    }
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
      // Update role
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

      // Save granular permissions for non-admin users
      if (editRole !== 'admin') {
        await saveUserPermissions(selectedUser.id, editPermissions);
      } else {
        // Clear permissions for admin users
        await supabase.from('user_permissions').delete().eq('user_id', selectedUser.id);
      }

      // Handle seller status
      const wasSeller = selectedUser.isSeller || false;
      if (editIsSeller && !wasSeller) {
        await supabase.from('sellers').insert({
          name: selectedUser.full_name || selectedUser.email || '',
          email: selectedUser.email || '',
          user_id: selectedUser.id,
        });
      } else if (!editIsSeller && wasSeller) {
        await supabase.from('sellers').delete().eq('user_id', selectedUser.id);
      }

      // Build list of changes for notification email
      const changes: string[] = [];
      if (selectedUser.role !== editRole) {
        changes.push(`Rol cambiado a: ${editRole === 'admin' ? 'Administrador' : 'Usuario'}`);
      }
      if (wasSeller !== editIsSeller) {
        changes.push(editIsSeller ? 'Asignado como vendedor' : 'Removido como vendedor');
      }

      // Send notification email if there are changes
      if (changes.length > 0 && selectedUser.email) {
        try {
          await supabase.functions.invoke('send-notification-email', {
            body: {
              type: 'user_updated',
              to: selectedUser.email,
              userName: selectedUser.full_name || selectedUser.email,
              changes,
            },
          });
        } catch (emailError) {
          console.error('Failed to send notification email:', emailError);
        }
      }

      toast.success('Usuario actualizado');
      setSelectedUser(null);
      fetchUsers();
    } catch (error) {
      console.error('Error saving user:', error);
      toast.error('Error al guardar usuario');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateUser = async () => {
    try {
      createUserSchema.parse({
        email: newUserEmail,
        password: newUserGeneratePassword ? undefined : newUserPassword,
        fullName: newUserName,
      });

      if (!newUserGeneratePassword && newUserPassword.length < 6) {
        toast.error('La contraseña debe tener al menos 6 caracteres');
        return;
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0].message);
        return;
      }
    }

    setCreating(true);
    try {
      // Call edge function to create user
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          email: newUserEmail.trim(),
          password: newUserGeneratePassword ? undefined : newUserPassword,
          fullName: newUserName.trim(),
          role: newUserRole,
          moduleIds: [], // No longer using moduleIds
          isSeller: newUserIsSeller,
          generateTempPassword: newUserGeneratePassword,
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

      if (!data?.success || !data?.userId) {
        toast.error('Error al crear usuario');
        return;
      }

      // Save permissions for the new user (if not admin)
      if (newUserRole !== 'admin') {
        await saveUserPermissions(data.userId, newUserPermissions);
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
    setNewUserIsSeller(false);
    setNewUserGeneratePassword(true);
    setNewUserPermissions({});
    setNewUserDialogTab('general');
  };

  const checkUserHasMovements = async (userId: string): Promise<boolean> => {
    const tables = [
      { table: 'avances', column: 'registrado_por' },
      { table: 'extras', column: 'solicitado_por' },
      { table: 'extras', column: 'aprobado_por' },
      { table: 'obra_supervisores', column: 'supervisor_id' },
      { table: 'pagos_destajos', column: 'registrado_por' },
      { table: 'solicitudes_pago', column: 'solicitado_por' },
      { table: 'solicitudes_pago', column: 'aprobado_por' },
      { table: 'sales', column: 'created_by' },
      { table: 'payments', column: 'created_by' },
      { table: 'sale_commissions', column: 'seller_id' },
    ];

    for (const { table, column } of tables) {
      const { count } = await supabase
        .from(table as any)
        .select('*', { count: 'exact', head: true })
        .eq(column, userId);

      if (count && count > 0) return true;
    }
    return false;
  };

  const handleOpenDeleteDialog = async (userProfile: UserProfile) => {
    setDeleteUser(userProfile);
    setCheckingMovements(true);
    const hasMovements = await checkUserHasMovements(userProfile.id);
    setDeleteHasMovements(hasMovements);
    setCheckingMovements(false);
  };

  const handleDeleteUser = async () => {
    if (!deleteUser || deleteHasMovements) return;

    try {
      // Delete from sellers if exists
      await supabase.from('sellers').delete().eq('user_id', deleteUser.id);

      // Delete user permissions
      await supabase.from('user_permissions').delete().eq('user_id', deleteUser.id);

      // Delete user roles
      await supabase.from('user_roles').delete().eq('user_id', deleteUser.id);

      // Delete profile
      const { error } = await supabase.from('profiles').delete().eq('id', deleteUser.id);

      if (error) throw error;

      toast.success('Usuario eliminado permanentemente');
      setDeleteUser(null);
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Error al eliminar usuario');
    }
  };

  const handleResetPassword = async () => {
    if (!passwordResetUser) return;

    if (!generateNewPassword && newPasswordValue.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setResettingPassword(true);
    try {
      const { data, error } = await supabase.functions.invoke('reset-user-password', {
        body: {
          userId: passwordResetUser.id,
          password: generateNewPassword ? undefined : newPasswordValue,
          generateTempPassword: generateNewPassword,
          sendEmail: sendPasswordEmail,
          userEmail: passwordResetUser.email,
          userName: passwordResetUser.full_name,
        },
      });

      if (error) {
        toast.error(error.message || 'Error al cambiar contraseña');
        return;
      }

      if (!data?.success) {
        toast.error('Error al cambiar contraseña');
        return;
      }

      toast.success('Contraseña actualizada exitosamente');
      setPasswordResetUser(null);
      setNewPasswordValue('');
      setGenerateNewPassword(true);
      setSendPasswordEmail(true);
    } catch (error) {
      console.error('Error resetting password:', error);
      toast.error('Error al cambiar contraseña');
    } finally {
      setResettingPassword(false);
    }
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
    const matchesSeller =
      filterSeller === 'all' ||
      (filterSeller === 'yes' && u.isSeller) ||
      (filterSeller === 'no' && !u.isSeller);
    const matchesActivo =
      filterActivo === 'all' ||
      (filterActivo === 'yes' && u.activo) ||
      (filterActivo === 'no' && !u.activo);
    return matchesSearch && matchesRole && matchesSeller && matchesActivo;
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

          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/10">
              <Settings className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Administración</h1>
              <p className="text-muted-foreground">Gestiona usuarios y permisos</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Users className="w-5 h-5" />
              Usuarios
            </h2>
            <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
              <UserPlus className="w-4 h-4" />
              Agregar Usuario
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          <div className="flex flex-wrap gap-4">
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
                <SelectItem value="admin">Administrador</SelectItem>
                <SelectItem value="user">Usuario</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filterSeller}
              onValueChange={(v) => setFilterSeller(v as 'all' | 'yes' | 'no')}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Vendedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="yes">Vendedores</SelectItem>
                <SelectItem value="no">No vendedores</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filterActivo}
              onValueChange={(v) => setFilterActivo(v as 'all' | 'yes' | 'no')}
            >
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
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((userProfile) => (
                    <TableRow key={userProfile.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div>
                            <p
                              className={`font-medium ${!userProfile.activo ? 'text-muted-foreground line-through' : ''}`}
                            >
                              {userProfile.full_name || 'Sin nombre'}
                            </p>
                            <p className="text-sm text-muted-foreground">{userProfile.email}</p>
                          </div>
                          {!userProfile.activo && (
                            <Badge
                              variant="outline"
                              className="bg-destructive/10 text-destructive border-destructive/20"
                            >
                              Inactivo
                            </Badge>
                          )}
                          {userProfile.isSeller && (
                            <Badge
                              variant="outline"
                              className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                            >
                              Vendedor
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={userProfile.role === 'admin' ? 'default' : 'secondary'}>
                          {userProfile.role === 'admin' ? 'Administrador' : 'Usuario'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className={
                              userProfile.activo
                                ? 'text-emerald-600 hover:text-emerald-700'
                                : 'text-muted-foreground hover:text-foreground'
                            }
                            onClick={() => handleToggleActivo(userProfile)}
                            title={userProfile.activo ? 'Desactivar usuario' : 'Activar usuario'}
                          >
                            <Power className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive/80"
                            onClick={() => handleOpenDeleteDialog(userProfile)}
                            title="Eliminar usuario"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setPasswordResetUser(userProfile)}
                            title="Cambiar contraseña"
                          >
                            <KeyRound className="w-4 h-4" />
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
        </div>

        {/* Edit Dialog */}
        <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Usuario</DialogTitle>
              <DialogDescription>
                {selectedUser?.full_name} ({selectedUser?.email})
              </DialogDescription>
            </DialogHeader>

            <Tabs
              value={editDialogTab}
              onValueChange={(v) => setEditDialogTab(v as 'general' | 'permissions')}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="permissions" disabled={editRole === 'admin'}>
                  Permisos
                </TabsTrigger>
              </TabsList>

              <TabsContent value="general" className="space-y-6 py-4">
                <div className="space-y-2">
                  <Label>Rol</Label>
                  <Select value={editRole} onValueChange={(v) => setEditRole(v as AppRole)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">Usuario</SelectItem>
                      <SelectItem value="admin">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {editRole === 'admin' && (
                  <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                    Los administradores tienen acceso total a todos los módulos y funciones.
                  </p>
                )}

                <div className="flex items-center space-x-3 p-3 rounded-lg border bg-muted/30">
                  <Checkbox
                    id="edit-user-seller"
                    checked={editIsSeller}
                    onCheckedChange={(checked) => setEditIsSeller(checked === true)}
                  />
                  <label htmlFor="edit-user-seller" className="flex-1 text-sm cursor-pointer">
                    <span className="font-medium">Asignar como vendedor</span>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Este usuario podrá registrar ventas y recibir comisiones
                    </p>
                  </label>
                </div>
              </TabsContent>

              <TabsContent value="permissions" className="py-4">
                {loadingPermissions ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <PermissionsCopyTools
                      currentUserId={selectedUser?.id}
                      onApplyPermissions={setEditPermissions}
                      existingPermissions={editPermissions}
                    />
                    <p className="text-sm text-muted-foreground">
                      Configura los permisos específicos para cada módulo y submódulo.
                    </p>
                    <UserPermissionsEditor
                      permissions={editPermissions}
                      onPermissionsChange={setEditPermissions}
                    />
                  </div>
                )}
              </TabsContent>
            </Tabs>

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
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Agregar Usuario</DialogTitle>
              <DialogDescription>Crea una nueva cuenta de usuario</DialogDescription>
            </DialogHeader>

            <Tabs
              value={newUserDialogTab}
              onValueChange={(v) => setNewUserDialogTab(v as 'general' | 'permissions')}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="permissions" disabled={newUserRole === 'admin'}>
                  Permisos
                </TabsTrigger>
              </TabsList>

              <TabsContent value="general" className="space-y-4 py-4">
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

                <div className="flex items-center space-x-3 p-3 rounded-lg border bg-muted/30">
                  <Checkbox
                    id="generate-password"
                    checked={newUserGeneratePassword}
                    onCheckedChange={(checked) => setNewUserGeneratePassword(checked === true)}
                  />
                  <label htmlFor="generate-password" className="flex-1 text-sm cursor-pointer">
                    <span className="font-medium">Generar contraseña automática</span>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Se enviará por correo al usuario
                    </p>
                  </label>
                </div>

                {!newUserGeneratePassword && (
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
                )}

                <div className="space-y-2">
                  <Label>Rol</Label>
                  <Select value={newUserRole} onValueChange={(v) => setNewUserRole(v as AppRole)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">Usuario</SelectItem>
                      <SelectItem value="admin">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {newUserRole === 'admin' && (
                  <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                    Los administradores tienen acceso total a todos los módulos y funciones.
                  </p>
                )}

                <div className="flex items-center space-x-3 p-3 rounded-lg border bg-muted/30">
                  <Checkbox
                    id="new-user-seller"
                    checked={newUserIsSeller}
                    onCheckedChange={(checked) => setNewUserIsSeller(checked === true)}
                  />
                  <label htmlFor="new-user-seller" className="flex-1 text-sm cursor-pointer">
                    <span className="font-medium">Asignar como vendedor</span>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Este usuario podrá registrar ventas y recibir comisiones
                    </p>
                  </label>
                </div>
              </TabsContent>

              <TabsContent value="permissions" className="py-4">
                <div className="space-y-4">
                  <PermissionsCopyTools
                    onApplyPermissions={setNewUserPermissions}
                    existingPermissions={newUserPermissions}
                  />
                  <p className="text-sm text-muted-foreground">
                    Configura los permisos específicos para cada módulo y submódulo.
                  </p>
                  <UserPermissionsEditor
                    permissions={newUserPermissions}
                    onPermissionsChange={setNewUserPermissions}
                  />
                </div>
              </TabsContent>
            </Tabs>

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

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deleteUser} onOpenChange={() => setDeleteUser(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {checkingMovements
                  ? 'Verificando...'
                  : deleteHasMovements
                    ? 'No se puede eliminar'
                    : 'Eliminar usuario'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {checkingMovements ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Verificando si el usuario tiene movimientos...
                  </span>
                ) : deleteHasMovements ? (
                  <span>
                    El usuario <strong>{deleteUser?.full_name}</strong> tiene movimientos
                    registrados en el sistema y no puede ser eliminado permanentemente.
                    <br />
                    <br />
                    <strong>Recomendación:</strong> Desactiva el usuario para que no pueda acceder
                    al sistema, pero sus datos históricos se conservarán.
                  </span>
                ) : (
                  <span>
                    ¿Estás seguro de que deseas eliminar permanentemente a{' '}
                    <strong>{deleteUser?.full_name}</strong>?
                    <br />
                    <br />
                    Esta acción no se puede deshacer.
                  </span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              {!checkingMovements && !deleteHasMovements && (
                <AlertDialogAction
                  onClick={handleDeleteUser}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Eliminar permanentemente
                </AlertDialogAction>
              )}
              {!checkingMovements && deleteHasMovements && (
                <AlertDialogAction
                  onClick={() => {
                    if (deleteUser) handleToggleActivo(deleteUser);
                    setDeleteUser(null);
                  }}
                >
                  Desactivar usuario
                </AlertDialogAction>
              )}
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Password Reset Dialog */}
        <Dialog
          open={!!passwordResetUser}
          onOpenChange={() => {
            setPasswordResetUser(null);
            setNewPasswordValue('');
            setGenerateNewPassword(true);
            setSendPasswordEmail(true);
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Cambiar Contraseña</DialogTitle>
              <DialogDescription>
                Restablecer la contraseña de {passwordResetUser?.full_name}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="flex items-center space-x-3 p-3 rounded-lg border bg-muted/30">
                <Checkbox
                  id="generate-new-password"
                  checked={generateNewPassword}
                  onCheckedChange={(checked) => setGenerateNewPassword(checked === true)}
                />
                <label htmlFor="generate-new-password" className="flex-1 text-sm cursor-pointer">
                  <span className="font-medium">Generar contraseña automática</span>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Se generará una contraseña segura
                  </p>
                </label>
              </div>

              {!generateNewPassword && (
                <div className="space-y-2">
                  <Label htmlFor="new-password-input">Nueva contraseña</Label>
                  <Input
                    id="new-password-input"
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={newPasswordValue}
                    onChange={(e) => setNewPasswordValue(e.target.value)}
                  />
                </div>
              )}

              <div className="flex items-center space-x-3 p-3 rounded-lg border bg-muted/30">
                <Checkbox
                  id="send-password-email"
                  checked={sendPasswordEmail}
                  onCheckedChange={(checked) => setSendPasswordEmail(checked === true)}
                />
                <label htmlFor="send-password-email" className="flex-1 text-sm cursor-pointer">
                  <span className="font-medium">Enviar por correo</span>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {generateNewPassword
                      ? 'Se enviará la nueva contraseña al usuario'
                      : 'Se notificará al usuario que su contraseña fue cambiada'}
                  </p>
                </label>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setPasswordResetUser(null);
                  setNewPasswordValue('');
                  setGenerateNewPassword(true);
                  setSendPasswordEmail(true);
                }}
              >
                Cancelar
              </Button>
              <Button onClick={handleResetPassword} disabled={resettingPassword}>
                {resettingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <KeyRound className="mr-2 h-4 w-4" />
                Cambiar Contraseña
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
