import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type AppRole = 'admin' | 'user';

interface UserPermissions {
  role: AppRole | null;
  moduleIds: string[];
  isAdmin: boolean;
  loading: boolean;
}

interface ModulePermissionRow {
  module_id: string;
}

export function useUserPermissions() {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<UserPermissions>({
    role: null,
    moduleIds: [],
    isAdmin: false,
    loading: true,
  });

  const fetchPermissions = useCallback(async () => {
    if (!user) {
      setPermissions({
        role: null,
        moduleIds: [],
        isAdmin: false,
        loading: false,
      });
      return;
    }

    try {
      // Fetch user role
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      const role = (roleData?.role as AppRole) || 'user';
      const isAdmin = role === 'admin';

      // If admin, they have access to all modules
      if (isAdmin) {
        setPermissions({
          role,
          moduleIds: [], // Empty means all access for admin
          isAdmin: true,
          loading: false,
        });
        return;
      }

      // Fetch module permissions from user_permissions table (granular CRUD permissions)
      // A user has access to a module if they have can_read=true for any submodule in that module
      let moduleIds: string[] = [];
      
      try {
        const { data, error } = await supabase
          .from('user_permissions')
          .select('module_id')
          .eq('user_id', user.id)
          .eq('can_read', true);
        
        if (error) {
          console.error('Error fetching module permissions:', error);
        } else {
          // Get unique module IDs
          moduleIds = [...new Set(data?.map((m) => m.module_id) || [])];
        }
      } catch (err) {
        console.error('Error fetching module permissions:', err);
      }

      setPermissions({
        role,
        moduleIds,
        isAdmin: false,
        loading: false,
      });
    } catch (error) {
      console.error('Error fetching permissions:', error);
      setPermissions({
        role: 'user',
        moduleIds: [],
        isAdmin: false,
        loading: false,
      });
    }
  }, [user]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  const hasModuleAccess = useCallback(
    (moduleId: string): boolean => {
      if (permissions.loading) return false;
      if (permissions.isAdmin) return true;
      return permissions.moduleIds.includes(moduleId);
    },
    [permissions]
  );

  const refetch = useCallback(() => {
    setPermissions((prev) => ({ ...prev, loading: true }));
    fetchPermissions();
  }, [fetchPermissions]);

  return {
    ...permissions,
    hasModuleAccess,
    refetch,
  };
}
