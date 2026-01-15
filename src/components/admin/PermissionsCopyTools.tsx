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
import { Loader2, Copy, Users } from 'lucide-react';
import { toast } from 'sonner';

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
  const [loadingUsers, setLoadingUsers] = useState(true);

  // User copy state
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [userCopyMode, setUserCopyMode] = useState<CopyMode>('replace');
  const [copyingUser, setCopyingUser] = useState(false);

  useEffect(() => {
    fetchUsers();
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

  return (
    <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Users className="w-4 h-4" />
        Copiar permisos de otro usuario
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
  );
}
