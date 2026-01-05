import { cn } from '@/lib/utils';
import type { TicketStatus } from '../types';
import { statusLabels } from '../types';

interface StatusBadgeProps {
  status: TicketStatus;
  className?: string;
  size?: 'sm' | 'md';
}

const statusStyles: Record<TicketStatus, string> = {
  nuevo: 'bg-blue-500/15 text-blue-600 border-blue-500/30',
  revision: 'bg-purple-500/15 text-purple-600 border-purple-500/30',
  programado: 'bg-cyan-500/15 text-cyan-600 border-cyan-500/30',
  ruta: 'bg-indigo-500/15 text-indigo-600 border-indigo-500/30',
  sitio: 'bg-teal-500/15 text-teal-600 border-teal-500/30',
  proceso: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  pendiente: 'bg-orange-500/15 text-orange-600 border-orange-500/30',
  terminado: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
  cerrado: 'bg-slate-500/15 text-slate-600 border-slate-500/30',
};

export function StatusBadge({ status, className, size = 'md' }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
        statusStyles[status],
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {statusLabels[status]}
    </span>
  );
}
