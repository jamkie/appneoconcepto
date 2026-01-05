import { useState } from 'react';
import {
  mockClients,
  mockProjects,
  getTicketsByClientId,
} from '../lib/mock-data';
import {
  Search,
  Plus,
  Phone,
  Mail,
  MapPin,
  ChevronRight,
  FolderKanban,
  Ticket,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function ClientsPage() {
  const [search, setSearch] = useState('');

  const filteredClients = mockClients.filter(
    (client) =>
      client.name.toLowerCase().includes(search.toLowerCase()) ||
      client.email.toLowerCase().includes(search.toLowerCase()) ||
      client.phone.includes(search)
  );

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Clientes</h1>
          <p className="text-muted-foreground">
            {filteredClients.length} clientes registrados
          </p>
        </div>
        <Button className="w-full md:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Cliente
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre, email o teléfono..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Clients List */}
      <div className="grid gap-4">
        {filteredClients.map((client) => {
          const clientProjects = mockProjects.filter(
            (p) => p.client_id === client.id
          );
          const clientTickets = getTicketsByClientId(client.id);
          const openTickets = clientTickets.filter(
            (t) => !['cerrado', 'terminado'].includes(t.status)
          );

          return (
            <div
              key={client.id}
              className={cn(
                'group rounded-xl border bg-card p-4 md:p-5 shadow-sm',
                'hover:shadow-md hover:border-primary/30 cursor-pointer transition-all'
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0 space-y-3">
                  {/* Header */}
                  <div>
                    <h3 className="font-semibold text-lg truncate">
                      {client.name}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {client.contact}
                    </p>
                  </div>

                  {/* Contact Info */}
                  <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Phone className="h-4 w-4" />
                      <span>{client.phone}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Mail className="h-4 w-4" />
                      <span className="truncate max-w-[200px]">
                        {client.email}
                      </span>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="gap-1">
                      <FolderKanban className="h-3 w-3" />
                      {clientProjects.length} proyectos
                    </Badge>
                    <Badge variant="secondary" className="gap-1">
                      <Ticket className="h-3 w-3" />
                      {clientTickets.length} tickets
                    </Badge>
                    {openTickets.length > 0 && (
                      <Badge
                        variant="outline"
                        className="gap-1 border-amber-500/30 text-amber-600"
                      >
                        {openTickets.length} abiertos
                      </Badge>
                    )}
                  </div>

                  {/* Notes */}
                  {client.notes && (
                    <p className="text-sm text-muted-foreground line-clamp-1">
                      {client.notes}
                    </p>
                  )}
                </div>

                <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 transition-transform group-hover:translate-x-1" />
              </div>
            </div>
          );
        })}
      </div>

      {filteredClients.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Search className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="font-semibold mb-1">No se encontraron clientes</h3>
          <p className="text-sm text-muted-foreground">
            Intenta buscar con otros términos
          </p>
        </div>
      )}
    </div>
  );
}
