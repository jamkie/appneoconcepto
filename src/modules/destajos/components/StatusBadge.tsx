import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  activa: { label: 'Activa', variant: 'default' },
  cerrada: { label: 'Cerrada', variant: 'secondary' },
  pendiente: { label: 'Pendiente', variant: 'outline' },
  aprobada: { label: 'Aprobada', variant: 'default' },
  aprobado: { label: 'Aprobado', variant: 'default' },
  rechazada: { label: 'Rechazada', variant: 'destructive' },
  rechazado: { label: 'Rechazado', variant: 'destructive' },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || { label: status, variant: 'outline' as const };
  
  return (
    <Badge variant={config.variant} className={cn(className)}>
      {config.label}
    </Badge>
  );
}
