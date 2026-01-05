// Servicios Module Types

export type TicketStatus =
  | 'nuevo'
  | 'revision'
  | 'programado'
  | 'ruta'
  | 'sitio'
  | 'proceso'
  | 'pendiente'
  | 'terminado'
  | 'cerrado';

export type TicketPriority = 'baja' | 'media' | 'alta' | 'urgente';

export type TicketType =
  | 'preventivo'
  | 'correctivo'
  | 'garantia'
  | 'diagnostico'
  | 'ajuste'
  | 'instalacion';

export type TicketCategory =
  | 'puertas'
  | 'cajones'
  | 'herrajes'
  | 'ajustes'
  | 'dano'
  | 'otro';

export interface ServiciosClient {
  id: string;
  name: string;
  contact: string;
  phone: string;
  email: string;
  notes?: string;
  created_at?: string;
}

export interface ServiciosProject {
  id: string;
  client_id: string;
  name: string;
  address: string;
  delivery_date: string;
  warranty_until: string;
  notes?: string;
  created_at?: string;
}

export interface Technician {
  id: string;
  name: string;
  phone: string;
  email: string;
  avatar?: string;
  user_id?: string;
  created_at?: string;
}

export interface Ticket {
  id: string;
  folio: string;
  client_id: string;
  project_id: string;
  type: TicketType;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  description: string;
  technician_id?: string;
  scheduled_date?: string;
  scheduled_time?: string;
  created_at: string;
  started_at?: string;
  finished_at?: string;
  photos_before: string[];
  photos_after: string[];
  is_warranty: boolean;
  cost?: number;
  rating?: number;
  rating_comment?: string;
  created_by?: string;
}

export interface TimelineEvent {
  id: string;
  ticket_id: string;
  user_id: string;
  user_name: string;
  action: string;
  note?: string;
  created_at: string;
}

// Labels for UI display
export const statusLabels: Record<TicketStatus, string> = {
  nuevo: 'Nuevo',
  revision: 'En Revisión',
  programado: 'Programado',
  ruta: 'En Ruta',
  sitio: 'En Sitio',
  proceso: 'En Proceso',
  pendiente: 'Pendiente Refacciones',
  terminado: 'Terminado',
  cerrado: 'Cerrado',
};

export const priorityLabels: Record<TicketPriority, string> = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
  urgente: 'Urgente',
};

export const typeLabels: Record<TicketType, string> = {
  preventivo: 'Preventivo',
  correctivo: 'Correctivo',
  garantia: 'Garantía',
  diagnostico: 'Diagnóstico',
  ajuste: 'Ajuste',
  instalacion: 'Instalación',
};

export const categoryLabels: Record<TicketCategory, string> = {
  puertas: 'Puertas',
  cajones: 'Cajones',
  herrajes: 'Herrajes',
  ajustes: 'Ajustes',
  dano: 'Daño',
  otro: 'Otro',
};
