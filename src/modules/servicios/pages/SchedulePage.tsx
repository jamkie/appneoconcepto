import { useState } from 'react';
import {
  mockTickets,
  mockTechnicians,
  getClientById,
  getProjectById,
} from '../lib/mock-data';
import { statusLabels } from '../types';
import { StatusBadge, PriorityBadge } from '../components';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addWeeks,
  subWeeks,
  isSameDay,
  isToday,
} from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function SchedulePage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedTechnician, setSelectedTechnician] = useState<string>('all');

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const filteredTickets = mockTickets.filter((ticket) => {
    if (!ticket.scheduled_date) return false;
    if (
      selectedTechnician !== 'all' &&
      ticket.technician_id !== selectedTechnician
    )
      return false;
    return true;
  });

  const getTicketsForDay = (date: Date) => {
    return filteredTickets.filter((ticket) => {
      if (!ticket.scheduled_date) return false;
      return isSameDay(new Date(ticket.scheduled_date), date);
    });
  };

  const previousWeek = () => setCurrentDate(subWeeks(currentDate, 1));
  const nextWeek = () => setCurrentDate(addWeeks(currentDate, 1));
  const goToToday = () => setCurrentDate(new Date());

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Agenda</h1>
          <p className="text-muted-foreground">
            {format(weekStart, "d 'de' MMMM", { locale: es })} -{' '}
            {format(weekEnd, "d 'de' MMMM, yyyy", { locale: es })}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={selectedTechnician}
            onValueChange={setSelectedTechnician}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Técnico" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los técnicos</SelectItem>
              {mockTechnicians.map((tech) => (
                <SelectItem key={tech.id} value={tech.id}>
                  {tech.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={previousWeek}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={nextWeek}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday}>
            Hoy
          </Button>
        </div>
      </div>

      {/* Week View */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
        {weekDays.map((day) => {
          const dayTickets = getTicketsForDay(day);
          const dayIsToday = isToday(day);

          return (
            <div
              key={day.toISOString()}
              className={cn(
                'rounded-xl border bg-card p-3 min-h-[200px]',
                dayIsToday && 'border-primary/50 bg-primary/5'
              )}
            >
              {/* Day Header */}
              <div className="text-center mb-3 pb-2 border-b">
                <p className="text-xs text-muted-foreground uppercase">
                  {format(day, 'EEE', { locale: es })}
                </p>
                <p
                  className={cn(
                    'text-lg font-bold',
                    dayIsToday && 'text-primary'
                  )}
                >
                  {format(day, 'd')}
                </p>
              </div>

              {/* Day Tickets */}
              <div className="space-y-2">
                {dayTickets.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    Sin visitas
                  </p>
                ) : (
                  dayTickets.map((ticket) => {
                    const client = getClientById(ticket.client_id);
                    const project = getProjectById(ticket.project_id);

                    return (
                      <div
                        key={ticket.id}
                        className="p-2 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-1 mb-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs font-medium">
                            {ticket.scheduled_time || '—'}
                          </span>
                        </div>
                        <p className="text-xs font-mono text-primary mb-1">
                          {ticket.folio}
                        </p>
                        <p className="text-xs truncate">{client?.name}</p>
                        <div className="mt-2">
                          <StatusBadge status={ticket.status} size="sm" />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* List View for Mobile */}
      <div className="md:hidden space-y-4">
        <h2 className="font-semibold">Próximas visitas</h2>
        {filteredTickets
          .filter((t) => t.scheduled_date)
          .sort(
            (a, b) =>
              new Date(a.scheduled_date!).getTime() -
              new Date(b.scheduled_date!).getTime()
          )
          .slice(0, 10)
          .map((ticket) => {
            const client = getClientById(ticket.client_id);
            const project = getProjectById(ticket.project_id);
            const technician = ticket.technician_id
              ? mockTechnicians.find((t) => t.id === ticket.technician_id)
              : null;

            return (
              <div
                key={ticket.id}
                className="p-4 rounded-xl border bg-card shadow-sm"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-mono text-sm text-primary font-semibold">
                      {ticket.folio}
                    </p>
                    <p className="font-medium">{client?.name}</p>
                  </div>
                  <StatusBadge status={ticket.status} size="sm" />
                </div>

                <div className="space-y-1.5 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    <span>
                      {format(
                        new Date(ticket.scheduled_date!),
                        "EEE d 'de' MMMM",
                        { locale: es }
                      )}
                    </span>
                    {ticket.scheduled_time && (
                      <>
                        <Clock className="h-4 w-4 ml-2" />
                        <span>{ticket.scheduled_time}</span>
                      </>
                    )}
                  </div>

                  {project && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <span className="truncate">{project.address}</span>
                    </div>
                  )}

                  {technician && (
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span>{technician.name}</span>
                    </div>
                  )}
                </div>

                <div className="mt-3">
                  <PriorityBadge priority={ticket.priority} size="sm" />
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
