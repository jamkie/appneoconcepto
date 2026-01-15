import { Checkbox } from '@/components/ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { supabase } from '@/integrations/supabase/client';
import { modulesWithSubmodules } from '@/data/modules';

interface Permission {
  can_read: boolean;
  can_create: boolean;
  can_update: boolean;
  can_delete: boolean;
}

interface PermissionsState {
  [key: string]: Permission; // key format: "moduleId" or "moduleId/submoduleId"
}

interface UserPermissionsEditorProps {
  disabled?: boolean;
  permissions: PermissionsState;
  onPermissionsChange: (permissions: PermissionsState) => void;
}

const PERMISSION_LABELS = {
  can_read: 'Ver',
  can_create: 'Crear',
  can_update: 'Editar',
  can_delete: 'Eliminar',
};

const emptyPermission: Permission = {
  can_read: false,
  can_create: false,
  can_update: false,
  can_delete: false,
};

export function UserPermissionsEditor({
  disabled = false,
  permissions,
  onPermissionsChange,
}: UserPermissionsEditorProps) {
  const activeModules = modulesWithSubmodules.filter((m) => m.status === 'active');

  const getPermission = (moduleId: string, submoduleId?: string): Permission => {
    const key = submoduleId ? `${moduleId}/${submoduleId}` : moduleId;
    return permissions[key] || { ...emptyPermission };
  };

  const setPermission = (
    moduleId: string,
    submoduleId: string | undefined,
    field: keyof Permission,
    value: boolean
  ) => {
    const key = submoduleId ? `${moduleId}/${submoduleId}` : moduleId;
    const current = getPermission(moduleId, submoduleId);
    onPermissionsChange({
      ...permissions,
      [key]: { ...current, [field]: value },
    });
  };

  const toggleAllForSubmodule = (moduleId: string, submoduleId: string, checked: boolean) => {
    const key = `${moduleId}/${submoduleId}`;
    onPermissionsChange({
      ...permissions,
      [key]: {
        can_read: checked,
        can_create: checked,
        can_update: checked,
        can_delete: checked,
      },
    });
  };

  const toggleAllForModule = (moduleId: string, checked: boolean) => {
    const module = activeModules.find((m) => m.id === moduleId);
    if (!module) return;

    const newPermissions = { ...permissions };
    module.submodules.forEach((sub) => {
      const key = `${moduleId}/${sub.id}`;
      newPermissions[key] = {
        can_read: checked,
        can_create: checked,
        can_update: checked,
        can_delete: checked,
      };
    });
    onPermissionsChange(newPermissions);
  };

  const isModuleFullyChecked = (moduleId: string): boolean => {
    const module = activeModules.find((m) => m.id === moduleId);
    if (!module || module.submodules.length === 0) return false;

    return module.submodules.every((sub) => {
      const perm = getPermission(moduleId, sub.id);
      return perm.can_read && perm.can_create && perm.can_update && perm.can_delete;
    });
  };

  const isModulePartiallyChecked = (moduleId: string): boolean => {
    const module = activeModules.find((m) => m.id === moduleId);
    if (!module || module.submodules.length === 0) return false;

    let hasAny = false;
    let hasAll = true;

    module.submodules.forEach((sub) => {
      const perm = getPermission(moduleId, sub.id);
      const allChecked = perm.can_read && perm.can_create && perm.can_update && perm.can_delete;
      const anyChecked = perm.can_read || perm.can_create || perm.can_update || perm.can_delete;
      if (anyChecked) hasAny = true;
      if (!allChecked) hasAll = false;
    });

    return hasAny && !hasAll;
  };

  const isSubmoduleFullyChecked = (moduleId: string, submoduleId: string): boolean => {
    const perm = getPermission(moduleId, submoduleId);
    return perm.can_read && perm.can_create && perm.can_update && perm.can_delete;
  };

  return (
    <div className="space-y-2">
      <Accordion type="multiple" className="w-full">
        {activeModules.map((module) => (
          <AccordionItem key={module.id} value={module.id} className="border rounded-lg px-3 mb-2">
            <AccordionTrigger className="hover:no-underline py-3">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={isModuleFullyChecked(module.id)}
                  ref={(ref) => {
                    if (ref) {
                      (ref as any).indeterminate = isModulePartiallyChecked(module.id);
                    }
                  }}
                  onCheckedChange={(checked) => toggleAllForModule(module.id, checked === true)}
                  onClick={(e) => e.stopPropagation()}
                  disabled={disabled}
                />
                <span className="font-medium">{module.title}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3 pl-6 pb-2">
                {module.submodules.map((sub) => (
                  <div key={sub.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={isSubmoduleFullyChecked(module.id, sub.id)}
                          onCheckedChange={(checked) =>
                            toggleAllForSubmodule(module.id, sub.id, checked === true)
                          }
                          disabled={disabled}
                        />
                        <span className="text-sm font-medium">{sub.label}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-4 pl-6">
                      {(Object.keys(PERMISSION_LABELS) as (keyof Permission)[]).map((permKey) => {
                        const perm = getPermission(module.id, sub.id);
                        return (
                          <label
                            key={permKey}
                            className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer"
                          >
                            <Checkbox
                              checked={perm[permKey]}
                              onCheckedChange={(checked) =>
                                setPermission(module.id, sub.id, permKey, checked === true)
                              }
                              disabled={disabled}
                              className="h-3.5 w-3.5"
                            />
                            {PERMISSION_LABELS[permKey]}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

// Helper to load permissions for a user
export async function loadUserPermissions(userId: string): Promise<PermissionsState> {
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
}

// Helper to save permissions for a user
export async function saveUserPermissions(userId: string, permissions: PermissionsState): Promise<boolean> {
  try {
    // Delete existing permissions
    await supabase.from('user_permissions').delete().eq('user_id', userId);

    // Build insert data - only insert if any permission is true
    const insertData = Object.entries(permissions)
      .filter(([_, perm]) => perm.can_read || perm.can_create || perm.can_update || perm.can_delete)
      .map(([key, perm]) => {
        const parts = key.split('/');
        const moduleId = parts[0];
        const submoduleId = parts.length > 1 ? parts[1] : null;

        return {
          user_id: userId,
          module_id: moduleId,
          submodule_id: submoduleId,
          can_read: perm.can_read,
          can_create: perm.can_create,
          can_update: perm.can_update,
          can_delete: perm.can_delete,
        };
      });

    if (insertData.length > 0) {
      const { error } = await supabase.from('user_permissions').insert(insertData);
      if (error) throw error;
    }

    return true;
  } catch (error) {
    console.error('Error saving user permissions:', error);
    return false;
  }
}
