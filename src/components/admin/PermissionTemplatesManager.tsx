import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Loader2, Plus, Pencil, Trash2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { UserPermissionsEditor } from './UserPermissionsEditor';

interface Permission {
  can_read: boolean;
  can_create: boolean;
  can_update: boolean;
  can_delete: boolean;
}

interface PermissionsState {
  [key: string]: Permission;
}

interface PermissionTemplate {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

interface PermissionTemplatesManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PermissionTemplatesManager({ open, onOpenChange }: PermissionTemplatesManagerProps) {
  const [templates, setTemplates] = useState<PermissionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTemplate, setEditTemplate] = useState<PermissionTemplate | null>(null);
  const [deleteTemplate, setDeleteTemplate] = useState<PermissionTemplate | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPermissions, setFormPermissions] = useState<PermissionsState>({});
  const [saving, setSaving] = useState(false);
  const [loadingPermissions, setLoadingPermissions] = useState(false);

  useEffect(() => {
    if (open) {
      fetchTemplates();
    }
  }, [open]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('permission_templates')
        .select('*')
        .order('name');

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast.error('Error al cargar plantillas');
    } finally {
      setLoading(false);
    }
  };

  const loadTemplatePermissions = async (templateId: string): Promise<PermissionsState> => {
    const { data, error } = await supabase
      .from('permission_template_items')
      .select('*')
      .eq('template_id', templateId);

    if (error) {
      console.error('Error loading template permissions:', error);
      return {};
    }

    const permissions: PermissionsState = {};
    data?.forEach((row) => {
      const key = row.submodule_id ? `${row.module_id}/${row.submodule_id}` : row.module_id;
      permissions[key] = {
        can_read: row.can_read || false,
        can_create: row.can_create || false,
        can_update: row.can_update || false,
        can_delete: row.can_delete || false,
      };
    });

    return permissions;
  };

  const handleOpenCreate = () => {
    setFormName('');
    setFormDescription('');
    setFormPermissions({});
    setShowCreateDialog(true);
  };

  const handleOpenEdit = async (template: PermissionTemplate) => {
    setEditTemplate(template);
    setFormName(template.name);
    setFormDescription(template.description || '');
    setLoadingPermissions(true);
    const perms = await loadTemplatePermissions(template.id);
    setFormPermissions(perms);
    setLoadingPermissions(false);
  };

  const handleSaveCreate = async () => {
    if (!formName.trim()) {
      toast.error('El nombre es requerido');
      return;
    }

    setSaving(true);
    try {
      // Create template
      const { data: newTemplate, error: createError } = await supabase
        .from('permission_templates')
        .insert({ name: formName.trim(), description: formDescription.trim() || null })
        .select()
        .single();

      if (createError) throw createError;

      // Save permissions
      await saveTemplatePermissions(newTemplate.id, formPermissions);

      toast.success('Plantilla creada');
      setShowCreateDialog(false);
      fetchTemplates();
    } catch (error: any) {
      console.error('Error creating template:', error);
      if (error.code === '23505') {
        toast.error('Ya existe una plantilla con ese nombre');
      } else {
        toast.error('Error al crear plantilla');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editTemplate || !formName.trim()) {
      toast.error('El nombre es requerido');
      return;
    }

    setSaving(true);
    try {
      // Update template
      const { error: updateError } = await supabase
        .from('permission_templates')
        .update({ name: formName.trim(), description: formDescription.trim() || null })
        .eq('id', editTemplate.id);

      if (updateError) throw updateError;

      // Save permissions
      await saveTemplatePermissions(editTemplate.id, formPermissions);

      toast.success('Plantilla actualizada');
      setEditTemplate(null);
      fetchTemplates();
    } catch (error: any) {
      console.error('Error updating template:', error);
      if (error.code === '23505') {
        toast.error('Ya existe una plantilla con ese nombre');
      } else {
        toast.error('Error al actualizar plantilla');
      }
    } finally {
      setSaving(false);
    }
  };

  const saveTemplatePermissions = async (templateId: string, permissions: PermissionsState) => {
    // Delete existing items
    await supabase.from('permission_template_items').delete().eq('template_id', templateId);

    // Build insert data
    const insertData = Object.entries(permissions)
      .filter(([_, perm]) => perm.can_read || perm.can_create || perm.can_update || perm.can_delete)
      .map(([key, perm]) => {
        const parts = key.split('/');
        const moduleId = parts[0];
        const submoduleId = parts.length > 1 ? parts[1] : null;

        return {
          template_id: templateId,
          module_id: moduleId,
          submodule_id: submoduleId,
          can_read: perm.can_read,
          can_create: perm.can_create,
          can_update: perm.can_update,
          can_delete: perm.can_delete,
        };
      });

    if (insertData.length > 0) {
      const { error } = await supabase.from('permission_template_items').insert(insertData);
      if (error) throw error;
    }
  };

  const handleDelete = async () => {
    if (!deleteTemplate) return;

    try {
      const { error } = await supabase
        .from('permission_templates')
        .delete()
        .eq('id', deleteTemplate.id);

      if (error) throw error;

      toast.success('Plantilla eliminada');
      setDeleteTemplate(null);
      fetchTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('Error al eliminar plantilla');
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Administrar Plantillas de Permisos
            </DialogTitle>
            <DialogDescription>
              Las plantillas permiten aplicar rápidamente un conjunto de permisos predefinidos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex justify-end">
              <Button onClick={handleOpenCreate} size="sm" className="gap-2">
                <Plus className="w-4 h-4" />
                Nueva Plantilla
              </Button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No hay plantillas. Crea una para empezar.
              </div>
            ) : (
              <div className="space-y-2">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card"
                  >
                    <div>
                      <p className="font-medium">{template.name}</p>
                      {template.description && (
                        <p className="text-sm text-muted-foreground">{template.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEdit(template)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive/80"
                        onClick={() => setDeleteTemplate(template)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva Plantilla</DialogTitle>
            <DialogDescription>Define un nombre y los permisos para esta plantilla.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input
                placeholder="Ej: Solo lectura, Capturista, Supervisor..."
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Descripción (opcional)</Label>
              <Textarea
                placeholder="Describe qué tipo de acceso otorga esta plantilla..."
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Permisos</Label>
              <UserPermissionsEditor
                permissions={formPermissions}
                onPermissionsChange={setFormPermissions}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveCreate} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear Plantilla
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editTemplate} onOpenChange={() => setEditTemplate(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Plantilla</DialogTitle>
            <DialogDescription>Modifica el nombre y los permisos de la plantilla.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input
                placeholder="Ej: Solo lectura, Capturista, Supervisor..."
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Descripción (opcional)</Label>
              <Textarea
                placeholder="Describe qué tipo de acceso otorga esta plantilla..."
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Permisos</Label>
              {loadingPermissions ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <UserPermissionsEditor
                  permissions={formPermissions}
                  onPermissionsChange={setFormPermissions}
                />
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTemplate(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving || loadingPermissions}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTemplate} onOpenChange={() => setDeleteTemplate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Plantilla</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas eliminar la plantilla "{deleteTemplate?.name}"?
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
