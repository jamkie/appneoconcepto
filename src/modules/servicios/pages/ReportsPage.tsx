import {
  mockTickets,
  mockTechnicians,
} from '../lib/mock-data';
import {
  statusLabels,
  typeLabels,
  categoryLabels,
  type TicketStatus,
  type TicketType,
  type TicketCategory,
} from '../types';
import { StatCard } from '../components';
import {
  BarChart3,
  CheckCircle2,
  Star,
  TrendingUp,
  Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

export default function ReportsPage() {
  // Calculate metrics
  const totalTickets = mockTickets.length;
  const completedTickets = mockTickets.filter(
    (t) => t.status === 'terminado' || t.status === 'cerrado'
  );
  const warrantyTickets = mockTickets.filter((t) => t.is_warranty);
  const chargedTickets = mockTickets.filter((t) => !t.is_warranty && t.cost);

  const totalRevenue = chargedTickets.reduce((sum, t) => sum + (t.cost || 0), 0);

  const ratingsData = mockTickets.filter((t) => t.rating);
  const averageRating =
    ratingsData.length > 0
      ? ratingsData.reduce((sum, t) => sum + (t.rating || 0), 0) /
        ratingsData.length
      : 0;

  // Status distribution
  const statusDistribution: Record<string, number> = {};
  mockTickets.forEach((t) => {
    statusDistribution[t.status] = (statusDistribution[t.status] || 0) + 1;
  });

  // Type distribution
  const typeDistribution: Record<string, number> = {};
  mockTickets.forEach((t) => {
    typeDistribution[t.type] = (typeDistribution[t.type] || 0) + 1;
  });

  // Category distribution
  const categoryDistribution: Record<string, number> = {};
  mockTickets.forEach((t) => {
    categoryDistribution[t.category] =
      (categoryDistribution[t.category] || 0) + 1;
  });

  // Technician performance
  const technicianStats = mockTechnicians.map((tech) => {
    const techTickets = mockTickets.filter((t) => t.technician_id === tech.id);
    const completed = techTickets.filter(
      (t) => t.status === 'terminado' || t.status === 'cerrado'
    );
    const ratings = techTickets.filter((t) => t.rating);
    const avgRating =
      ratings.length > 0
        ? ratings.reduce((sum, t) => sum + (t.rating || 0), 0) / ratings.length
        : 0;

    return {
      ...tech,
      totalTickets: techTickets.length,
      completedTickets: completed.length,
      averageRating: avgRating,
    };
  });

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Reportes</h1>
          <p className="text-muted-foreground">
            Análisis y métricas del servicio
          </p>
        </div>
        <Button variant="outline" className="w-full md:w-auto">
          <Download className="h-4 w-4 mr-2" />
          Exportar
        </Button>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Tickets"
          value={totalTickets}
          icon={BarChart3}
          variant="primary"
        />
        <StatCard
          title="Completados"
          value={completedTickets.length}
          description={`${Math.round(
            (completedTickets.length / totalTickets) * 100
          )}% del total`}
          icon={CheckCircle2}
          variant="success"
        />
        <StatCard
          title="Calificación"
          value={averageRating.toFixed(1)}
          description={`${ratingsData.length} evaluaciones`}
          icon={Star}
          variant="warning"
        />
        <StatCard
          title="Ingresos"
          value={`$${totalRevenue.toLocaleString()}`}
          description={`${chargedTickets.length} servicios cobrados`}
          icon={TrendingUp}
          variant="success"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <div className="rounded-xl border bg-card p-5">
          <h3 className="font-semibold mb-4">Distribución por Estado</h3>
          <div className="space-y-3">
            {Object.entries(statusDistribution).map(([status, count]) => {
              const percentage = Math.round((count / totalTickets) * 100);
              return (
                <div key={status}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span>{statusLabels[status as TicketStatus]}</span>
                    <span className="text-muted-foreground">
                      {count} ({percentage}%)
                    </span>
                  </div>
                  <Progress value={percentage} className="h-2" />
                </div>
              );
            })}
          </div>
        </div>

        {/* Type Distribution */}
        <div className="rounded-xl border bg-card p-5">
          <h3 className="font-semibold mb-4">Distribución por Tipo</h3>
          <div className="space-y-3">
            {Object.entries(typeDistribution).map(([type, count]) => {
              const percentage = Math.round((count / totalTickets) * 100);
              return (
                <div key={type}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span>{typeLabels[type as TicketType]}</span>
                    <span className="text-muted-foreground">
                      {count} ({percentage}%)
                    </span>
                  </div>
                  <Progress value={percentage} className="h-2" />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Technician Performance */}
      <div className="rounded-xl border bg-card p-5">
        <h3 className="font-semibold mb-4">Rendimiento por Técnico</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                  Técnico
                </th>
                <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">
                  Tickets
                </th>
                <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">
                  Completados
                </th>
                <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">
                  Calificación
                </th>
              </tr>
            </thead>
            <tbody>
              {technicianStats.map((tech) => (
                <tr key={tech.id} className="border-b last:border-0">
                  <td className="py-3 px-4">
                    <div>
                      <p className="font-medium">{tech.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {tech.email}
                      </p>
                    </div>
                  </td>
                  <td className="text-center py-3 px-4">{tech.totalTickets}</td>
                  <td className="text-center py-3 px-4">
                    {tech.completedTickets}
                  </td>
                  <td className="text-center py-3 px-4">
                    <div className="flex items-center justify-center gap-1">
                      <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                      <span>{tech.averageRating.toFixed(1)}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Category Distribution */}
      <div className="rounded-xl border bg-card p-5">
        <h3 className="font-semibold mb-4">Distribución por Categoría</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Object.entries(categoryDistribution).map(([category, count]) => (
            <div
              key={category}
              className="text-center p-4 rounded-lg bg-muted/50"
            >
              <p className="text-2xl font-bold">{count}</p>
              <p className="text-sm text-muted-foreground">
                {categoryLabels[category as TicketCategory]}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
