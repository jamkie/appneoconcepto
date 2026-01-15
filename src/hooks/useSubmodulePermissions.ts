import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserPermissions } from './useUserPermissions';

interface SubmodulePermissions {
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  loading: boolean;
}

export function useSubmodulePermissions(moduleId: string, submoduleId: string): SubmodulePermissions {
  const { user } = useAuth();
  const { isAdmin, loading: permissionsLoading } = useUserPermissions();
  const [permissions, setPermissions] = useState<SubmodulePermissions>({
    canRead: false,
    canCreate: false,
    canUpdate: false,
    canDelete: false,
    loading: true,
  });

  const fetchPermissions = useCallback(async () => {
    if (!user) {
      setPermissions({
        canRead: false,
        canCreate: false,
        canUpdate: false,
        canDelete: false,
        loading: false,
      });
      return;
    }

    // Admins have full access
    if (isAdmin) {
      setPermissions({
        canRead: true,
        canCreate: true,
        canUpdate: true,
        canDelete: true,
        loading: false,
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_permissions')
        .select('can_read, can_create, can_update, can_delete')
        .eq('user_id', user.id)
        .eq('module_id', moduleId)
        .eq('submodule_id', submoduleId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching submodule permissions:', error);
        setPermissions({
          canRead: false,
          canCreate: false,
          canUpdate: false,
          canDelete: false,
          loading: false,
        });
        return;
      }

      setPermissions({
        canRead: data?.can_read ?? false,
        canCreate: data?.can_create ?? false,
        canUpdate: data?.can_update ?? false,
        canDelete: data?.can_delete ?? false,
        loading: false,
      });
    } catch (error) {
      console.error('Error fetching submodule permissions:', error);
      setPermissions({
        canRead: false,
        canCreate: false,
        canUpdate: false,
        canDelete: false,
        loading: false,
      });
    }
  }, [user, moduleId, submoduleId, isAdmin]);

  useEffect(() => {
    if (!permissionsLoading) {
      fetchPermissions();
    }
  }, [fetchPermissions, permissionsLoading]);

  return permissions;
}
