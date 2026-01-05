import { useState } from 'react';
import { TicketCard, StatusBadge } from '../components';
import {
  mockTickets,
  mockTechnicians,
} from '../lib/mock-data';
import {
  statusLabels,
  priorityLabels,
  typeLabels,
  type TicketStatus,
  type TicketPriority,
  type TicketType,
} from '../types';
import {
  Search,
  Plus,
  X,
  SlidersHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { getClientById } from '../lib/mock-data';

export default function TicketsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [technicianFilter, setTechnicianFilter] = useState<string>('all');
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  // Filter tickets
  const filteredTickets = mockTickets.filter((ticket) => {
    const client = getClientById(ticket.client_id);
    const matchesSearch =
      ticket.folio.toLowerCase().includes(search.toLowerCase()) ||
      ticket.description.toLowerCase().includes(search.toLowerCase()) ||
      client?.name.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' || ticket.status === statusFilter;
    const matchesPriority =
      priorityFilter === 'all' || ticket.priority === priorityFilter;
    const matchesType = typeFilter === 'all' || ticket.type === typeFilter;
    const matchesTechnician =
      technicianFilter === 'all' || ticket.technician_id === technicianFilter;

    return (
      matchesSearch &&
      matchesStatus &&
      matchesPriority &&
      matchesType &&
      matchesTechnician
    );
  });

  const activeFiltersCount = [
    statusFilter,
    priorityFilter,
    typeFilter,
    technicianFilter,
  ].filter((f) => f !== 'all').length;

  const clearFilters = () => {
    setStatusFilter('all');
    setPriorityFilter('all');
    setTypeFilter('all');
    setTechnicianFilter('all');
  };

  // Group tickets by status
  const groupedByStatus = filteredTickets.reduce((acc, ticket) => {
    if (!acc[ticket.status]) {
      acc[ticket.status] = [];
    }
    acc[ticket.status].push(ticket);
    return acc;
  }, {} as Record<TicketStatus, typeof filteredTickets>);

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Tickets</h1>
          <p className="text-muted-foreground">
            {filteredTickets.length} tickets encontrados
          </p>
        </div>
        <Button className="w-full md:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Ticket
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por folio, cliente o descripción..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Desktop Filters */}
        <div className="hidden md:flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(statusLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Prioridad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {Object.entries(priorityLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {activeFiltersCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-muted-foreground"
            >
              <X className="h-4 w-4 mr-1" />
              Limpiar
            </Button>
          )}
        </div>

        {/* Mobile Filter Button */}
        <Sheet open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" className="md:hidden">
              <SlidersHorizontal className="h-4 w-4 mr-2" />
              Filtros
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Filtros</SheetTitle>
            </SheetHeader>
            <div className="space-y-4 mt-6">
              <div>
                <label className="text-sm font-medium mb-2 block">Estado</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Prioridad
                </label>
                <Select
                  value={priorityFilter}
                  onValueChange={setPriorityFilter}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {Object.entries(priorityLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Tipo</label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {Object.entries(typeLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Técnico
                </label>
                <Select
                  value={technicianFilter}
                  onValueChange={setTechnicianFilter}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {mockTechnicians.map((tech) => (
                      <SelectItem key={tech.id} value={tech.id}>
                        {tech.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {activeFiltersCount > 0 && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={clearFilters}
                >
                  <X className="h-4 w-4 mr-2" />
                  Limpiar filtros
                </Button>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Tickets List */}
      {filteredTickets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Search className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="font-semibold mb-1">No se encontraron tickets</h3>
          <p className="text-sm text-muted-foreground">
            Intenta ajustar los filtros o buscar con otros términos
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedByStatus).map(([status, tickets]) => (
            <div key={status}>
              <div className="flex items-center gap-2 mb-3">
                <StatusBadge status={status as TicketStatus} />
                <span className="text-sm text-muted-foreground">
                  ({tickets.length})
                </span>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tickets.map((ticket) => (
                  <TicketCard key={ticket.id} ticket={ticket} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
