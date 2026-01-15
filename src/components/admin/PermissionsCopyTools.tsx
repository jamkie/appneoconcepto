import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Copy, FileText, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Separator } from '@/components/ui/separator';

interface Permission {
  can_read: boolean;
  can_create: boolean;
  can_update: boolean;
  can_delete: boolean;
}

interface PermissionsState {
  [key: string]: Permission;
}

interface UserOption {
  id: string;
  name: string;
  email: string;
}

interface TemplateOption {
  id: string;
  name: string;
  description: string | null;
}

interface PermissionsCopyToolsProps {
  currentUserId?: string; // Exclude this user from the list
  onApplyPermissions: (permissions: PermissionsState) => void;
  existingPermissions: PermissionsState;
}

type CopyMode = 'replace' | 'merge';

export function PermissionsCopyTools({
  currentUserId,
  onApplyPermissions,
  existingPermissions,
}: PermissionsCopyToolsProps) {
  const [users, setUsers] = useState<UserOption[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  // User copy state
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [userCopyMode, setUserCopyMode] = useState<CopyMode>('replace');
  const [copyingUser, setCopyingUser] = useState(false);

  // Template state
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [templateCopyMode, setTemplateCopyMode] = useState<CopyMode>('replace');
  const [applyingTemplate, setApplyingTemplate] = useState(false);

  useEffect(() => {
    fetchUsers();
    fetchTemplates();
  }, []);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('activo', true)
        .order('full_name');

      if (error) throw error;

      // Filter out current user and map to options
      const userOptions: UserOption[] = (profiles || [])
        .filter((p) => p.id !== currentUserId)
        .map((p) => ({
          id: p.id,
          name: p.full_name || p.email || 'Sin nombre',
          email: p.email || '',
        }));

      setUsers(userOptions);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const { data, error } = await supabase
        .from('permission_templates')
        .select('id, name, description')
        .order('name');

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const loadUserPermissions = async (userId: string): Promise<PermissionsState> => {
    const { data, error } = await supabase
      .from('user_permissions')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error('Error loading user permissions:', error);
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

  const mergePermissions = (
    existing: PermissionsState,
    incoming: PermissionsState
  ): PermissionsState => {
    const merged: PermissionsState = { ...existing };

    Object.entries(incoming).forEach(([key, perm]) => {
      if (merged[key]) {
        merged[key] = {
          can_read: merged[key].can_read || perm.can_read,
          can_create: merged[key].can_create || perm.can_create,
          can_update: merged[key].can_update || perm.can_update,
          can_delete: merged[key].can_delete || perm.can_delete,
        };
      } else {
        merged[key] = { ...perm };
      }
    });

    return merged;
  };

  const handleCopyFromUser = async () => {
    if (!selectedUserId) {
      toast.error('Selecciona un usuario');
      return;
    }

    setCopyingUser(true);
    try {
      const userPerms = await loadUserPermissions(selectedUserId);

      if (userCopyMode === 'replace') {
        onApplyPermissions(userPerms);
      } else {
        const merged = mergePermissions(existingPermissions, userPerms);
        onApplyPermissions(merged);
      }

      const user = users.find((u) => u.id === selectedUserId);
      toast.success(`Permisos ${userCopyMode === 'merge' ? 'fusionados' : 'copiados'} de ${user?.name}`);
      setSelectedUserId('');
    } catch (error) {
      console.error('Error copying permissions:', error);
      toast.error('Error al copiar permisos');
    } finally {
      setCopyingUser(false);
    }
  };

  const handleApplyTemplate = async () => {
    if (!selectedTemplateId) {
      toast.error('Selecciona una plantilla');
      return;
    }

    setApplyingTemplate(true);
    try {
      const templatePerms = await loadTemplatePermissions(selectedTemplateId);

      if (templateCopyMode === 'replace') {
        onApplyPermissions(templatePerms);
      } else {
        const merged = mergePermissions(existingPermissions, templatePerms);
        onApplyPermissions(merged);
      }

      const template = templates.find((t) => t.id === selectedTemplateId);
      toast.success(`Plantilla "${template?.name}" ${templateCopyMode === 'merge' ? 'fusionada' : 'aplicada'}`);
      setSelectedTemplateId('');
    } catch (error) {
      console.error('Error applying template:', error);
      toast.error('Error al aplicar plantilla');
    } finally {
      setApplyingTemplate(false);
    }
  };

  return (
    <div className="space-y-4 p-4 rounded-lg border bg-muted/30">
      <h4 className="text-sm font-medium flex items-center gap-2">
        Aplicación rápida de permisos
      </h4>

      {/* Apply Template */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <FileText className="w-4 h-4" />
          Aplicar plantilla
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
              <SelectTrigger>
                <SelectValue placeholder={loadingTemplates ? 'Cargando...' : 'Seleccionar plantilla'} />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    <div className="flex flex-col">
                      <span>{template.name}</span>
                      {template.description && (
                        <span className="text-xs text-muted-foreground">{template.description}</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <RadioGroup
            value={templateCopyMode}
            onValueChange={(v) => setTemplateCopyMode(v as CopyMode)}
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="replace" id="template-replace" />
              <Label htmlFor="template-replace" className="text-sm cursor-pointer">
                Reemplazar
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="merge" id="template-merge" />
              <Label htmlFor="template-merge" className="text-sm cursor-pointer">
                Fusionar
              </Label>
            </div>
          </RadioGroup>

          <Button
            onClick={handleApplyTemplate}
            disabled={!selectedTemplateId || applyingTemplate}
            size="sm"
            variant="secondary"
            className="gap-2"
          >
            {applyingTemplate && <Loader2 className="h-4 w-4 animate-spin" />}
            Aplicar
          </Button>
        </div>
      </div>

      <Separator />

      {/* Copy from User */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Users className="w-4 h-4" />
          Copiar de otro usuario
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder={loadingUsers ? 'Cargando...' : 'Seleccionar usuario'} />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    <div className="flex flex-col">
                      <span>{user.name}</span>
                      <span className="text-xs text-muted-foreground">{user.email}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <RadioGroup
            value={userCopyMode}
            onValueChange={(v) => setUserCopyMode(v as CopyMode)}
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="replace" id="user-replace" />
              <Label htmlFor="user-replace" className="text-sm cursor-pointer">
                Reemplazar
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="merge" id="user-merge" />
              <Label htmlFor="user-merge" className="text-sm cursor-pointer">
                Fusionar
              </Label>
            </div>
          </RadioGroup>

          <Button
            onClick={handleCopyFromUser}
            disabled={!selectedUserId || copyingUser}
            size="sm"
            variant="secondary"
            className="gap-2"
          >
            {copyingUser && <Loader2 className="h-4 w-4 animate-spin" />}
            <Copy className="h-4 w-4" />
            Copiar
          </Button>
        </div>
      </div>
    </div>
  );
}
