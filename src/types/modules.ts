export type ModuleStatus = 'active' | 'coming_soon';

export interface Module {
  id: string;
  title: string;
  description: string;
  icon: string;
  route: string | null;
  status: ModuleStatus;
  requiredPermissions: string[];
}

export interface UserPermissions {
  modules: string[];
}
