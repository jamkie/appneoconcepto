import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { modulesWithSubmodules } from '@/data/modules';
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Plus, Pencil, Trash2, Loader2, Shield, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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
  submodule_id: string | null;
  can_read: boolean;
  can_create: boolean;
  can_update: boolean;
  can_delete: boolean;
}

interface RoleWithPermissions extends Role {
  permissions: RolePermission[];
}

type PermissionSet = { read: boolean; create: boolean; update: boolean; delete: boolean };
type PermissionsState = Record<string, Record<string, PermissionSet>>;

export function RolesManager() {
  const [roles, setRoles] = useState<RoleWithPermissions[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Create/Edit dialog
  const [showDialog, setShowDialog] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleWithPermissions | null>(null);
  const [roleName, setRoleName] = useState('');
  const [roleDescription, setRoleDescription] = useState('');
  const [permissions, setPermissions] = useState<PermissionsState>({});
  
  // Delete dialog
  const [deleteRole, setDeleteRole] = useState<Role | null>(null);

  const activeModules = modulesWithSubmodules.filter((m) => m.status === 'active');

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

  const initializeEmptyPermissions = (): PermissionsState => {
    const perms: PermissionsState = {};
    activeModules.forEach((mod) => {
      perms[mod.id] = {
        _module: { read: false, create: false, update: false, delete: false },
      };
      mod.submodules.forEach((sub) => {
        perms[mod.id][sub.id] = { read: false, create: false, update: false, delete: false };
      });
    });
    return perms;
  };

  const mapExistingPermissions = (role: RoleWithPermissions): PermissionsState => {
    const perms = initializeEmptyPermissions();
    
    role.permissions.forEach((p) => {
      const key = p.submodule_id || '_module';
      if (perms[p.module_id] && perms[p.module_id][key]) {
        perms[p.module_id][key] = {
          read: p.can_read || false,
          create: p.can_create || false,
          update: p.can_update || false,
          delete: p.can_delete || false,
        };
      }
    });
    
    return perms;
  };

  const openCreateDialog = () => {
    setEditingRole(null);
    setRoleName('');
    setRoleDescription('');
    setPermissions(initializeEmptyPermissions());
    setShowDialog(true);
  };

  const openEditDialog = (role: RoleWithPermissions) => {
    setEditingRole(role);
    setRoleName(role.name);
    setRoleDescription(role.description || '');
    setPermissions(mapExistingPermissions(role));
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
        const { error } = await supabase
          .from('roles')
          .update({ name: roleName.trim(), description: roleDescription.trim() || null })
          .eq('id', editingRole.id);

        if (error) throw error;
        roleId = editingRole.id;

        // Delete existing permissions
        await supabase.from('role_permissions').delete().eq('role_id', roleId);
      } else {
        const { data, error } = await supabase
          .from('roles')
          .insert({ name: roleName.trim(), description: roleDescription.trim() || null })
          .select()
          .single();

        if (error) throw error;
        roleId = data.id;
      }

      // Collect permissions to insert
      const permissionsToInsert: {
        role_id: string;
        module_id: string;
        submodule_id: string | null;
        can_read: boolean;
        can_create: boolean;
        can_update: boolean;
        can_delete: boolean;
      }[] = [];

      Object.entries(permissions).forEach(([moduleId, submodules]) => {
        Object.entries(submodules).forEach(([subKey, perm]) => {
          if (perm.read || perm.create || perm.update || perm.delete) {
            permissionsToInsert.push({
              role_id: roleId,
              module_id: moduleId,
              submodule_id: subKey === '_module' ? null : subKey,
              can_read: perm.read,
              can_create: perm.create,
              can_update: perm.update,
              can_delete: perm.delete,
            });
          }
        });
      });

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

  const togglePermission = (
    moduleId: string,
    submoduleKey: string,
    action: 'read' | 'create' | 'update' | 'delete'
  ) => {
    setPermissions((prev) => ({
      ...prev,
      [moduleId]: {
        ...prev[moduleId],
        [submoduleKey]: {
          ...prev[moduleId]?.[submoduleKey],
          [action]: !prev[moduleId]?.[submoduleKey]?.[action],
        },
      },
    }));
  };

  const toggleAllForItem = (moduleId: string, submoduleKey: string, checked: boolean) => {
    setPermissions((prev) => ({
      ...prev,
      [moduleId]: {
        ...prev[moduleId],
        [submoduleKey]: {
          read: checked,
          create: checked,
          update: checked,
          delete: checked,
        },
      },
    }));
  };

  const toggleAllForModule = (moduleId: string, checked: boolean) => {
    setPermissions((prev) => {
      const newModulePerms = { ...prev[moduleId] };
      Object.keys(newModulePerms).forEach((key) => {
        newModulePerms[key] = {
          read: checked,
          create: checked,
          update: checked,
          delete: checked,
        };
      });
      return { ...prev, [moduleId]: newModulePerms };
    });
  };

  const isModuleFullyChecked = (moduleId: string): boolean => {
    const modulePerms = permissions[moduleId];
    if (!modulePerms) return false;
    return Object.values(modulePerms).every(
      (p) => p.read && p.create && p.update && p.delete
    );
  };

  const isModulePartiallyChecked = (moduleId: string): boolean => {
    const modulePerms = permissions[moduleId];
    if (!modulePerms) return false;
    const hasAny = Object.values(modulePerms).some(
      (p) => p.read || p.create || p.update || p.delete
    );
    return hasAny && !isModuleFullyChecked(moduleId);
  };

  const getPermissionSummary = (role: RoleWithPermissions) => {
    const moduleIds = [...new Set(role.permissions.map((p) => p.module_id))];
    if (moduleIds.length === 0) return 'Sin permisos';
    
    const summaries = moduleIds.map((modId) => {
      const mod = activeModules.find((m) => m.id === modId);
      return mod?.title || modId;
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
            Crea y administra roles con permisos CRUD por módulo y submódulo
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
              <TableHead>Módulos</TableHead>
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRole ? 'Editar Rol' : 'Crear Nuevo Rol'}
            </DialogTitle>
            <DialogDescription>
              Define el nombre y los permisos CRUD para cada módulo y submódulo
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
              <div className="flex items-center justify-between">
                <Label>Permisos por Módulo y Submódulo</Label>
                <p className="text-xs text-muted-foreground">
                  V = Ver, C = Crear, E = Editar, D = Eliminar
                </p>
              </div>
              
              <Accordion type="multiple" className="w-full">
                {activeModules.map((mod) => {
                  const isFullyChecked = isModuleFullyChecked(mod.id);
                  const isPartial = isModulePartiallyChecked(mod.id);
                  
                  return (
                    <AccordionItem key={mod.id} value={mod.id} className="border rounded-lg mb-2 px-4">
                      <AccordionTrigger className="py-3 hover:no-underline">
                        <div className="flex items-center gap-3 flex-1">
                          <Checkbox
                            checked={isFullyChecked}
                            className={cn(isPartial && "data-[state=unchecked]:bg-primary/30")}
                            onCheckedChange={(checked) => {
                              toggleAllForModule(mod.id, !!checked);
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <span className="font-medium">{mod.title}</span>
                          {(isFullyChecked || isPartial) && (
                            <Badge variant="secondary" className="text-xs">
                              {isFullyChecked ? 'Acceso completo' : 'Acceso parcial'}
                            </Badge>
                          )}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="pb-4">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Sección</TableHead>
                                <TableHead className="text-center w-16">Todo</TableHead>
                                <TableHead className="text-center w-14">Ver</TableHead>
                                <TableHead className="text-center w-14">Crear</TableHead>
                                <TableHead className="text-center w-14">Editar</TableHead>
                                <TableHead className="text-center w-14">Eliminar</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {/* Module-level permission */}
                              <TableRow className="bg-muted/30">
                                <TableCell className="font-medium flex items-center gap-2">
                                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                  {mod.title} (General)
                                </TableCell>
                                <PermissionCheckboxes
                                  perm={permissions[mod.id]?.['_module']}
                                  onToggle={(action) => togglePermission(mod.id, '_module', action)}
                                  onToggleAll={(checked) => toggleAllForItem(mod.id, '_module', checked)}
                                />
                              </TableRow>
                              {/* Submodule permissions */}
                              {mod.submodules.map((sub) => (
                                <TableRow key={sub.id}>
                                  <TableCell className="pl-8">{sub.label}</TableCell>
                                  <PermissionCheckboxes
                                    perm={permissions[mod.id]?.[sub.id]}
                                    onToggle={(action) => togglePermission(mod.id, sub.id, action)}
                                    onToggleAll={(checked) => toggleAllForItem(mod.id, sub.id, checked)}
                                  />
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
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

// Extracted component for permission checkboxes
function PermissionCheckboxes({
  perm,
  onToggle,
  onToggleAll,
}: {
  perm?: PermissionSet;
  onToggle: (action: 'read' | 'create' | 'update' | 'delete') => void;
  onToggleAll: (checked: boolean) => void;
}) {
  const p = perm || { read: false, create: false, update: false, delete: false };
  const allChecked = p.read && p.create && p.update && p.delete;

  return (
    <>
      <TableCell className="text-center">
        <Checkbox
          checked={allChecked}
          onCheckedChange={(checked) => onToggleAll(!!checked)}
        />
      </TableCell>
      <TableCell className="text-center">
        <Checkbox checked={p.read} onCheckedChange={() => onToggle('read')} />
      </TableCell>
      <TableCell className="text-center">
        <Checkbox checked={p.create} onCheckedChange={() => onToggle('create')} />
      </TableCell>
      <TableCell className="text-center">
        <Checkbox checked={p.update} onCheckedChange={() => onToggle('update')} />
      </TableCell>
      <TableCell className="text-center">
        <Checkbox checked={p.delete} onCheckedChange={() => onToggle('delete')} />
      </TableCell>
    </>
  );
}
