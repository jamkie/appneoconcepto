import { cn } from '@/lib/utils';
import type { TicketPriority } from '../types';
import { priorityLabels } from '../types';
import { AlertTriangle, ArrowDown, ArrowUp, Flame } from 'lucide-react';

interface PriorityBadgeProps {
  priority: TicketPriority;
  className?: string;
  showIcon?: boolean;
  size?: 'sm' | 'md';
}

const priorityStyles: Record<TicketPriority, string> = {
  baja: 'bg-slate-500/15 text-slate-600 border-slate-500/30',
  media: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/30',
  alta: 'bg-orange-500/15 text-orange-600 border-orange-500/30',
  urgente: 'bg-red-500/15 text-red-600 border-red-500/30 animate-pulse',
};

const priorityIcons: Record<TicketPriority, React.ComponentType<{ className?: string }>> = {
  baja: ArrowDown,
  media: ArrowUp,
  alta: AlertTriangle,
  urgente: Flame,
};

export function PriorityBadge({
  priority,
  className,
  showIcon = true,
  size = 'md',
}: PriorityBadgeProps) {
  const Icon = priorityIcons[priority];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
        priorityStyles[priority],
        className
      )}
    >
      {showIcon && <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />}
      {priorityLabels[priority]}
    </span>
  );
}
