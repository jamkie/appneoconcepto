import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { modules } from '@/data/modules';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Plus, Pencil, Trash2, Loader2, Shield, Lock } from 'lucide-react';
import { toast } from 'sonner';

interface Role {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  created_at: string;
}

interface RolePermission {
  id: string;
  role_id: string;
  module_id: string;
  can_read: boolean;
  can_create: boolean;
  can_update: boolean;
  can_delete: boolean;
}

interface RoleWithPermissions extends Role {
  permissions: RolePermission[];
}

export function RolesManager() {
  const [roles, setRoles] = useState<RoleWithPermissions[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Create/Edit dialog
  const [showDialog, setShowDialog] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleWithPermissions | null>(null);
  const [roleName, setRoleName] = useState('');
  const [roleDescription, setRoleDescription] = useState('');
  const [permissions, setPermissions] = useState<Record<string, { read: boolean; create: boolean; update: boolean; delete: boolean }>>({});
  
  // Delete dialog
  const [deleteRole, setDeleteRole] = useState<Role | null>(null);

  const activeModules = modules.filter((m) => m.status === 'active');

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    setLoading(true);
    try {
      const { data: rolesData, error: rolesError } = await supabase
        .from('roles')
        .select('*')
        .order('is_system', { ascending: false })
        .order('name');

      if (rolesError) throw rolesError;

      const { data: permissionsData, error: permError } = await supabase
        .from('role_permissions')
        .select('*');

      if (permError) throw permError;

      const rolesWithPermissions: RoleWithPermissions[] = (rolesData || []).map((role) => ({
        ...role,
        permissions: (permissionsData || []).filter((p) => p.role_id === role.id),
      }));

      setRoles(rolesWithPermissions);
    } catch (error) {
      console.error('Error fetching roles:', error);
      toast.error('Error al cargar roles');
    } finally {
      setLoading(false);
    }
  };

  const openCreateDialog = () => {
    setEditingRole(null);
    setRoleName('');
    setRoleDescription('');
    // Initialize permissions with all false
    const initialPerms: Record<string, { read: boolean; create: boolean; update: boolean; delete: boolean }> = {};
    activeModules.forEach((m) => {
      initialPerms[m.id] = { read: false, create: false, update: false, delete: false };
    });
    setPermissions(initialPerms);
    setShowDialog(true);
  };

  const openEditDialog = (role: RoleWithPermissions) => {
    setEditingRole(role);
    setRoleName(role.name);
    setRoleDescription(role.description || '');
    // Map existing permissions
    const perms: Record<string, { read: boolean; create: boolean; update: boolean; delete: boolean }> = {};
    activeModules.forEach((m) => {
      const existingPerm = role.permissions.find((p) => p.module_id === m.id);
      perms[m.id] = {
        read: existingPerm?.can_read || false,
        create: existingPerm?.can_create || false,
        update: existingPerm?.can_update || false,
        delete: existingPerm?.can_delete || false,
      };
    });
    setPermissions(perms);
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!roleName.trim()) {
      toast.error('El nombre del rol es requerido');
      return;
    }

    setSaving(true);
    try {
      let roleId: string;

      if (editingRole) {
        // Update existing role
        const { error } = await supabase
          .from('roles')
          .update({ name: roleName.trim(), description: roleDescription.trim() || null })
          .eq('id', editingRole.id);

        if (error) throw error;
        roleId = editingRole.id;

        // Delete existing permissions
        await supabase.from('role_permissions').delete().eq('role_id', roleId);
      } else {
        // Create new role
        const { data, error } = await supabase
          .from('roles')
          .insert({ name: roleName.trim(), description: roleDescription.trim() || null })
          .select()
          .single();

        if (error) throw error;
        roleId = data.id;
      }

      // Insert new permissions
      const permissionsToInsert = Object.entries(permissions)
        .filter(([_, perm]) => perm.read || perm.create || perm.update || perm.delete)
        .map(([moduleId, perm]) => ({
          role_id: roleId,
          module_id: moduleId,
          can_read: perm.read,
          can_create: perm.create,
          can_update: perm.update,
          can_delete: perm.delete,
        }));

      if (permissionsToInsert.length > 0) {
        const { error: permError } = await supabase
          .from('role_permissions')
          .insert(permissionsToInsert);

        if (permError) throw permError;
      }

      toast.success(editingRole ? 'Rol actualizado' : 'Rol creado');
      setShowDialog(false);
      fetchRoles();
    } catch (error: any) {
      console.error('Error saving role:', error);
      if (error.code === '23505') {
        toast.error('Ya existe un rol con ese nombre');
      } else {
        toast.error('Error al guardar el rol');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteRole) return;

    try {
      // Check if role is assigned to users
      const { count } = await supabase
        .from('user_custom_roles')
        .select('*', { count: 'exact', head: true })
        .eq('role_id', deleteRole.id);

      if (count && count > 0) {
        toast.error('No se puede eliminar: hay usuarios asignados a este rol');
        setDeleteRole(null);
        return;
      }

      const { error } = await supabase
        .from('roles')
        .delete()
        .eq('id', deleteRole.id);

      if (error) throw error;

      toast.success('Rol eliminado');
      setDeleteRole(null);
      fetchRoles();
    } catch (error) {
      console.error('Error deleting role:', error);
      toast.error('Error al eliminar el rol');
    }
  };

  const togglePermission = (moduleId: string, action: 'read' | 'create' | 'update' | 'delete') => {
    setPermissions((prev) => ({
      ...prev,
      [moduleId]: {
        ...prev[moduleId],
        [action]: !prev[moduleId]?.[action],
      },
    }));
  };

  const toggleAllForModule = (moduleId: string, checked: boolean) => {
    setPermissions((prev) => ({
      ...prev,
      [moduleId]: {
        read: checked,
        create: checked,
        update: checked,
        delete: checked,
      },
    }));
  };

  const getPermissionSummary = (role: RoleWithPermissions) => {
    const modulePerms = role.permissions;
    if (modulePerms.length === 0) return 'Sin permisos';
    
    const summaries = modulePerms.map((p) => {
      const mod = activeModules.find((m) => m.id === p.module_id);
      const actions = [];
      if (p.can_read) actions.push('V');
      if (p.can_create) actions.push('C');
      if (p.can_update) actions.push('E');
      if (p.can_delete) actions.push('D');
      return `${mod?.title || p.module_id}: ${actions.join('')}`;
    });
    
    return summaries.slice(0, 2).join(', ') + (summaries.length > 2 ? ` +${summaries.length - 2}` : '');
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold">Roles Personalizados</h2>
          <p className="text-sm text-muted-foreground">
            Crea y administra roles con permisos CRUD por módulo
          </p>
        </div>
        <Button onClick={openCreateDialog} className="gap-2">
          <Plus className="w-4 h-4" />
          Nuevo Rol
        </Button>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Permisos</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  No hay roles personalizados. Crea uno para comenzar.
                </TableCell>
              </TableRow>
            ) : (
              roles.map((role) => (
                <TableRow key={role.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-primary" />
                      <span className="font-medium">{role.name}</span>
                      {role.is_system && (
                        <Badge variant="outline" className="text-xs">Sistema</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {role.description || '-'}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {getPermissionSummary(role)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(role)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      {!role.is_system && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive/80"
                          onClick={() => setDeleteRole(role)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRole ? 'Editar Rol' : 'Crear Nuevo Rol'}
            </DialogTitle>
            <DialogDescription>
              Define el nombre y los permisos CRUD para cada módulo
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="roleName">Nombre del Rol *</Label>
                <Input
                  id="roleName"
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                  placeholder="Ej: Supervisor, Capturista"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="roleDesc">Descripción</Label>
                <Input
                  id="roleDesc"
                  value={roleDescription}
                  onChange={(e) => setRoleDescription(e.target.value)}
                  placeholder="Descripción opcional"
                />
              </div>
            </div>

            <div className="space-y-4">
              <Label>Permisos por Módulo</Label>
              <p className="text-xs text-muted-foreground">
                V = Ver, C = Crear, E = Editar, D = Eliminar
              </p>
              
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Módulo</TableHead>
                      <TableHead className="text-center w-20">Todo</TableHead>
                      <TableHead className="text-center w-16">Ver</TableHead>
                      <TableHead className="text-center w-16">Crear</TableHead>
                      <TableHead className="text-center w-16">Editar</TableHead>
                      <TableHead className="text-center w-16">Eliminar</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeModules.map((mod) => {
                      const perm = permissions[mod.id] || { read: false, create: false, update: false, delete: false };
                      const allChecked = perm.read && perm.create && perm.update && perm.delete;
                      
                      return (
                        <TableRow key={mod.id}>
                          <TableCell className="font-medium">{mod.title}</TableCell>
                          <TableCell className="text-center">
                            <Checkbox
                              checked={allChecked}
                              onCheckedChange={(checked) => toggleAllForModule(mod.id, !!checked)}
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <Checkbox
                              checked={perm.read}
                              onCheckedChange={() => togglePermission(mod.id, 'read')}
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <Checkbox
                              checked={perm.create}
                              onCheckedChange={() => togglePermission(mod.id, 'create')}
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <Checkbox
                              checked={perm.update}
                              onCheckedChange={() => togglePermission(mod.id, 'update')}
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <Checkbox
                              checked={perm.delete}
                              onCheckedChange={() => togglePermission(mod.id, 'delete')}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingRole ? 'Guardar Cambios' : 'Crear Rol'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteRole} onOpenChange={() => setDeleteRole(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar rol?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El rol "{deleteRole?.name}" será eliminado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
