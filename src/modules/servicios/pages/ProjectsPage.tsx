import { useState } from 'react';
import {
  mockProjects,
  mockClients,
  getTicketsByProjectId,
} from '../lib/mock-data';
import {
  Search,
  Plus,
  MapPin,
  Calendar,
  Shield,
  ChevronRight,
  Ticket,
  Building2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format, isPast, isFuture } from 'date-fns';
import { es } from 'date-fns/locale';

export default function ProjectsPage() {
  const [search, setSearch] = useState('');

  const filteredProjects = mockProjects.filter((project) => {
    const client = mockClients.find((c) => c.id === project.client_id);
    return (
      project.name.toLowerCase().includes(search.toLowerCase()) ||
      project.address.toLowerCase().includes(search.toLowerCase()) ||
      client?.name.toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Proyectos</h1>
          <p className="text-muted-foreground">
            {filteredProjects.length} proyectos registrados
          </p>
        </div>
        <Button className="w-full md:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Proyecto
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por proyecto, dirección o cliente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Projects List */}
      <div className="grid gap-4">
        {filteredProjects.map((project) => {
          const client = mockClients.find((c) => c.id === project.client_id);
          const projectTickets = getTicketsByProjectId(project.id);
          const warrantyActive = isFuture(new Date(project.warranty_until));

          return (
            <div
              key={project.id}
              className={cn(
                'group rounded-xl border bg-card p-4 md:p-5 shadow-sm',
                'hover:shadow-md hover:border-primary/30 cursor-pointer transition-all'
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0 space-y-3">
                  {/* Header */}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-lg truncate">
                        {project.name}
                      </h3>
                      {warrantyActive && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/10 px-2 py-0.5 text-xs font-medium text-cyan-600">
                          <Shield className="h-3 w-3" />
                          Garantía
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Building2 className="h-4 w-4" />
                      <span>{client?.name}</span>
                    </div>
                  </div>

                  {/* Address */}
                  <div className="flex items-start gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{project.address}</span>
                  </div>

                  {/* Dates and Stats */}
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="gap-1">
                      <Calendar className="h-3 w-3" />
                      Entrega:{' '}
                      {format(new Date(project.delivery_date), 'd MMM yyyy', {
                        locale: es,
                      })}
                    </Badge>
                    <Badge variant="secondary" className="gap-1">
                      <Ticket className="h-3 w-3" />
                      {projectTickets.length} tickets
                    </Badge>
                    {warrantyActive && (
                      <Badge
                        variant="outline"
                        className="gap-1 border-cyan-500/30 text-cyan-600"
                      >
                        <Shield className="h-3 w-3" />
                        Hasta{' '}
                        {format(
                          new Date(project.warranty_until),
                          'd MMM yyyy',
                          { locale: es }
                        )}
                      </Badge>
                    )}
                  </div>

                  {/* Notes */}
                  {project.notes && (
                    <p className="text-sm text-muted-foreground line-clamp-1">
                      {project.notes}
                    </p>
                  )}
                </div>

                <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 transition-transform group-hover:translate-x-1" />
              </div>
            </div>
          );
        })}
      </div>

      {filteredProjects.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Search className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="font-semibold mb-1">No se encontraron proyectos</h3>
          <p className="text-sm text-muted-foreground">
            Intenta buscar con otros términos
          </p>
        </div>
      )}
    </div>
  );
}
