import { cn } from '@/lib/utils';
import { StatusBadge } from './StatusBadge';
import { PriorityBadge } from './PriorityBadge';
import type { Ticket } from '../types';
import { typeLabels, categoryLabels } from '../types';
import {
  getClientById,
  getProjectById,
  getTechnicianById,
} from '../lib/mock-data';
import {
  Calendar,
  Clock,
  MapPin,
  User,
  Wrench,
  ChevronRight,
  Shield,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface TicketCardProps {
  ticket: Ticket;
  onClick?: () => void;
  className?: string;
}

export function TicketCard({ ticket, onClick, className }: TicketCardProps) {
  const client = getClientById(ticket.client_id);
  const project = getProjectById(ticket.project_id);
  const technician = ticket.technician_id
    ? getTechnicianById(ticket.technician_id)
    : null;

  return (
    <div
      onClick={onClick}
      className={cn(
        'group relative rounded-xl border bg-card p-4 shadow-sm transition-all',
        'hover:shadow-md hover:border-primary/30 cursor-pointer',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold text-primary">
              {ticket.folio}
            </span>
            {ticket.is_warranty && (
              <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/10 px-2 py-0.5 text-xs font-medium text-cyan-600">
                <Shield className="h-3 w-3" />
                Garantía
              </span>
            )}
          </div>
          <h3 className="font-semibold truncate">{client?.name}</h3>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
      </div>

      {/* Badges */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <StatusBadge status={ticket.status} size="sm" />
        <PriorityBadge priority={ticket.priority} size="sm" />
      </div>

      {/* Description */}
      <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
        {ticket.description}
      </p>

      {/* Meta Info */}
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
        {project && (
          <div className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            <span className="truncate max-w-[150px]">{project.name}</span>
          </div>
        )}

        <div className="flex items-center gap-1">
          <Wrench className="h-3.5 w-3.5" />
          <span>{typeLabels[ticket.type]}</span>
        </div>

        {ticket.scheduled_date && (
          <div className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            <span>
              {format(new Date(ticket.scheduled_date), 'd MMM', { locale: es })}
            </span>
            {ticket.scheduled_time && (
              <>
                <Clock className="h-3.5 w-3.5 ml-1" />
                <span>{ticket.scheduled_time}</span>
              </>
            )}
          </div>
        )}

        {technician && (
          <div className="flex items-center gap-1">
            <User className="h-3.5 w-3.5" />
            <span>{technician.name}</span>
          </div>
        )}
      </div>

      {/* Category Tag */}
      <div className="absolute top-4 right-12">
        <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">
          {categoryLabels[ticket.category]}
        </span>
      </div>
    </div>
  );
}
