import { ReactNode } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Lock } from 'lucide-react';

interface PermissionInfo {
  canRead?: boolean;
  canCreate?: boolean;
  canUpdate?: boolean;
  canDelete?: boolean;
}

interface RestrictedActionProps {
  children: ReactNode;
  permissions: PermissionInfo;
  requiredPermission: 'read' | 'create' | 'update' | 'delete';
  /** If true, hides the element completely instead of showing disabled */
  hideWhenRestricted?: boolean;
  /** Custom message to show in tooltip */
  customMessage?: string;
  /** Module/submodule name for context */
  resourceName?: string;
}

const permissionLabels: Record<string, string> = {
  read: 'ver',
  create: 'crear',
  update: 'editar',
  delete: 'eliminar',
};

export function RestrictedAction({
  children,
  permissions,
  requiredPermission,
  hideWhenRestricted = false,
  customMessage,
  resourceName,
}: RestrictedActionProps) {
  const permissionMap = {
    read: permissions.canRead,
    create: permissions.canCreate,
    update: permissions.canUpdate,
    delete: permissions.canDelete,
  };

  const hasPermission = permissionMap[requiredPermission] ?? false;

  if (hasPermission) {
    return <>{children}</>;
  }

  if (hideWhenRestricted) {
    return null;
  }

  const actionLabel = permissionLabels[requiredPermission];
  const message = customMessage || 
    `No tienes permiso para ${actionLabel}${resourceName ? ` ${resourceName}` : ''}. Contacta al administrador.`;

  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <div className="inline-flex">
            <div className="pointer-events-none opacity-50 cursor-not-allowed">
              {children}
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent 
          side="top" 
          className="max-w-xs bg-destructive/10 border-destructive/20 text-destructive"
        >
          <div className="flex items-center gap-2">
            <Lock className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="text-xs">{message}</span>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** 
 * Simple badge to show missing permissions inline
 */
export function PermissionBadge({ 
  missingPermissions 
}: { 
  missingPermissions: ('read' | 'create' | 'update' | 'delete')[] 
}) {
  if (missingPermissions.length === 0) return null;

  const labels = missingPermissions.map(p => permissionLabels[p]);
  
  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs cursor-help">
            <Lock className="h-3 w-3" />
            <span>Restringido</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="text-xs">
            <p className="font-medium mb-1">Permisos faltantes:</p>
            <ul className="list-disc list-inside">
              {labels.map((label, i) => (
                <li key={i} className="capitalize">{label}</li>
              ))}
            </ul>
            <p className="mt-2 text-muted-foreground">Contacta al administrador para solicitar acceso.</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Hook helper to get missing permissions array
 */
export function getMissingPermissions(
  permissions: PermissionInfo,
  required: ('read' | 'create' | 'update' | 'delete')[]
): ('read' | 'create' | 'update' | 'delete')[] {
  const permissionMap = {
    read: permissions.canRead,
    create: permissions.canCreate,
    update: permissions.canUpdate,
    delete: permissions.canDelete,
  };

  return required.filter(p => !permissionMap[p]);
}
