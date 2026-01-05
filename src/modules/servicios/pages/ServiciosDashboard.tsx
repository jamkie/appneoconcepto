import { StatCard, TicketCard } from '../components';
import {
  mockTickets,
  mockClients,
} from '../lib/mock-data';
import { statusLabels, type TicketStatus } from '../types';
import {
  Ticket,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Calendar,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function ServiciosDashboard() {
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');

  // Calculate stats
  const openTickets = mockTickets.filter(
    (t) => !['cerrado', 'terminado'].includes(t.status)
  );
  const urgentTickets = mockTickets.filter(
    (t) =>
      t.priority === 'urgente' && !['cerrado', 'terminado'].includes(t.status)
  );
  const todayTickets = mockTickets.filter(
    (t) => t.scheduled_date === todayStr
  );
  const completedThisMonth = mockTickets.filter(
    (t) => t.status === 'terminado' || t.status === 'cerrado'
  );

  // Status distribution
  const statusCounts: Partial<Record<TicketStatus, number>> = {};
  openTickets.forEach((t) => {
    statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;
  });

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            {format(today, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
          </p>
        </div>
        <Link to="/servicios/tickets">
          <Button className="w-full md:w-auto">
            <Ticket className="h-4 w-4 mr-2" />
            Nuevo Ticket
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Tickets Abiertos"
          value={openTickets.length}
          description={`${mockClients.length} clientes activos`}
          icon={Ticket}
          variant="primary"
        />
        <StatCard
          title="Urgentes"
          value={urgentTickets.length}
          description="Requieren atención inmediata"
          icon={AlertTriangle}
          variant="danger"
        />
        <StatCard
          title="Hoy"
          value={todayTickets.length}
          description="Visitas programadas"
          icon={Calendar}
          variant="warning"
        />
        <StatCard
          title="Completados"
          value={completedThisMonth.length}
          description="Este mes"
          icon={CheckCircle2}
          variant="success"
        />
      </div>

      {/* Status Overview */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <div className="rounded-xl border bg-card p-5">
          <h3 className="font-semibold mb-4">Estado de Tickets</h3>
          <div className="space-y-3">
            {Object.entries(statusCounts).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  <span className="text-sm">
                    {statusLabels[status as TicketStatus]}
                  </span>
                </div>
                <span className="text-sm font-medium">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Today's Schedule */}
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Agenda de Hoy</h3>
            <Link to="/servicios/agenda">
              <Button variant="ghost" size="sm" className="gap-1">
                Ver todo
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          <div className="space-y-3">
            {todayTickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Clock className="h-10 w-10 text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">
                  No hay visitas programadas para hoy
                </p>
              </div>
            ) : (
              todayTickets.slice(0, 3).map((ticket) => (
                <div
                  key={ticket.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div>
                    <p className="font-medium text-sm">{ticket.folio}</p>
                    <p className="text-xs text-muted-foreground">
                      {ticket.scheduled_time}
                    </p>
                  </div>
                  <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                    {statusLabels[ticket.status]}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent Tickets */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Tickets Recientes</h3>
          <Link to="/servicios/tickets">
            <Button variant="ghost" size="sm" className="gap-1">
              Ver todos
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {openTickets.slice(0, 3).map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} />
          ))}
        </div>
      </div>
    </div>
  );
}
