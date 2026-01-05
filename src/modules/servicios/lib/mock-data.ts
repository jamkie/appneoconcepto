// Mock data for Servicios module
import type {
  ServiciosClient,
  ServiciosProject,
  Technician,
  Ticket,
  TimelineEvent,
} from '../types';

// Mock Clients
export const mockClients: ServiciosClient[] = [
  {
    id: 'c1',
    name: 'María González Hernández',
    contact: 'María González',
    phone: '+52 55 1234 5678',
    email: 'maria.gonzalez@email.com',
    notes: 'Cliente VIP - Proyectos de alta gama',
  },
  {
    id: 'c2',
    name: 'Residencial Los Pinos',
    contact: 'Arq. Roberto Sánchez',
    phone: '+52 55 8765 4321',
    email: 'r.sanchez@lospinos.com',
    notes: 'Desarrollo residencial - 24 unidades',
  },
  {
    id: 'c3',
    name: 'Carlos Méndez López',
    contact: 'Carlos Méndez',
    phone: '+52 55 2468 1357',
    email: 'carlos.mendez@gmail.com',
  },
  {
    id: 'c4',
    name: 'Hotel Boutique Chapultepec',
    contact: 'Lic. Ana Torres',
    phone: '+52 55 9876 5432',
    email: 'atorres@hotelchapultepec.mx',
    notes: 'Renovación de 15 habitaciones',
  },
];

// Mock Projects
export const mockProjects: ServiciosProject[] = [
  {
    id: 'p1',
    client_id: 'c1',
    name: 'Cocina Integral Polanco',
    address: 'Av. Presidente Masaryk 123, Polanco, CDMX',
    delivery_date: '2024-08-15',
    warranty_until: '2025-08-15',
    notes: 'Cocina en isla con barra de granito',
  },
  {
    id: 'p2',
    client_id: 'c1',
    name: 'Vestidor Principal',
    address: 'Av. Presidente Masaryk 123, Polanco, CDMX',
    delivery_date: '2024-09-01',
    warranty_until: '2025-09-01',
  },
  {
    id: 'p3',
    client_id: 'c2',
    name: 'Torre A - Cocinas (8 unidades)',
    address: 'Calle Bosques 456, Santa Fe, CDMX',
    delivery_date: '2024-10-30',
    warranty_until: '2025-10-30',
    notes: 'Cocinas modulares estándar',
  },
  {
    id: 'p4',
    client_id: 'c3',
    name: 'Mueble de Baño',
    address: 'Calle Roma Norte 789, Roma, CDMX',
    delivery_date: '2024-11-10',
    warranty_until: '2025-11-10',
  },
  {
    id: 'p5',
    client_id: 'c4',
    name: 'Suite Presidencial',
    address: 'Av. Chapultepec 1000, CDMX',
    delivery_date: '2024-07-01',
    warranty_until: '2025-07-01',
    notes: 'Muebles personalizados de alta gama',
  },
];

// Mock Technicians
export const mockTechnicians: Technician[] = [
  {
    id: 't1',
    name: 'Juan Pérez',
    phone: '+52 55 1111 2222',
    email: 'juan.perez@empresa.com',
  },
  {
    id: 't2',
    name: 'Miguel Ángel Ruiz',
    phone: '+52 55 3333 4444',
    email: 'miguel.ruiz@empresa.com',
  },
  {
    id: 't3',
    name: 'Pedro Hernández',
    phone: '+52 55 5555 6666',
    email: 'pedro.hernandez@empresa.com',
  },
];

// Mock Tickets
export const mockTickets: Ticket[] = [
  {
    id: 'tk1',
    folio: 'SRV-2024-001',
    client_id: 'c1',
    project_id: 'p1',
    type: 'correctivo',
    category: 'puertas',
    priority: 'alta',
    status: 'programado',
    description: 'Puerta de alacena no cierra correctamente. El cliente reporta que hace ruido al abrir.',
    technician_id: 't1',
    scheduled_date: '2025-01-06',
    scheduled_time: '10:00',
    created_at: '2024-12-23T10:30:00',
    photos_before: [],
    photos_after: [],
    is_warranty: true,
  },
  {
    id: 'tk2',
    folio: 'SRV-2024-002',
    client_id: 'c2',
    project_id: 'p3',
    type: 'preventivo',
    category: 'herrajes',
    priority: 'media',
    status: 'nuevo',
    description: 'Revisión general de herrajes en cocinas de Torre A, departamentos 101-104.',
    created_at: '2024-12-24T09:00:00',
    photos_before: [],
    photos_after: [],
    is_warranty: false,
    cost: 2500,
  },
  {
    id: 'tk3',
    folio: 'SRV-2024-003',
    client_id: 'c1',
    project_id: 'p2',
    type: 'ajuste',
    category: 'cajones',
    priority: 'baja',
    status: 'terminado',
    description: 'Ajuste de cajones del vestidor. Cliente solicita que queden más suaves.',
    technician_id: 't2',
    scheduled_date: '2024-12-20',
    started_at: '2024-12-20T11:00:00',
    finished_at: '2024-12-20T12:30:00',
    created_at: '2024-12-18T14:00:00',
    photos_before: [],
    photos_after: [],
    is_warranty: true,
    rating: 5,
    rating_comment: 'Excelente servicio, muy puntual.',
  },
  {
    id: 'tk4',
    folio: 'SRV-2024-004',
    client_id: 'c4',
    project_id: 'p5',
    type: 'garantia',
    category: 'puertas',
    priority: 'urgente',
    status: 'proceso',
    description: 'Puerta del closet principal se desprendió del marco. Requiere atención inmediata por evento en el hotel.',
    technician_id: 't1',
    scheduled_date: '2025-01-05',
    scheduled_time: '08:00',
    started_at: '2025-01-05T08:15:00',
    created_at: '2024-12-26T16:00:00',
    photos_before: [],
    photos_after: [],
    is_warranty: true,
  },
  {
    id: 'tk5',
    folio: 'SRV-2024-005',
    client_id: 'c3',
    project_id: 'p4',
    type: 'instalacion',
    category: 'herrajes',
    priority: 'media',
    status: 'ruta',
    description: 'Instalación de bisagras soft-close adicionales solicitadas por el cliente.',
    technician_id: 't3',
    scheduled_date: '2025-01-05',
    scheduled_time: '14:00',
    created_at: '2024-12-27T10:00:00',
    photos_before: [],
    photos_after: [],
    is_warranty: false,
    cost: 1800,
  },
  {
    id: 'tk6',
    folio: 'SRV-2024-006',
    client_id: 'c2',
    project_id: 'p3',
    type: 'diagnostico',
    category: 'otro',
    priority: 'media',
    status: 'revision',
    description: 'Evaluación de daños por inundación en cocina del departamento 502.',
    technician_id: 't2',
    created_at: '2024-12-25T16:00:00',
    photos_before: [],
    photos_after: [],
    is_warranty: false,
  },
];

// Mock Timeline Events
export const mockTimelineEvents: TimelineEvent[] = [
  {
    id: 'e1',
    ticket_id: 'tk1',
    user_id: 'u1',
    user_name: 'Ana López',
    action: 'Ticket creado',
    created_at: '2024-12-23T10:30:00',
  },
  {
    id: 'e2',
    ticket_id: 'tk1',
    user_id: 'u1',
    user_name: 'Ana López',
    action: 'Técnico asignado',
    note: 'Asignado a Juan Pérez',
    created_at: '2024-12-23T10:45:00',
  },
  {
    id: 'e3',
    ticket_id: 'tk1',
    user_id: 'u1',
    user_name: 'Ana López',
    action: 'Estatus actualizado',
    note: 'Nuevo → Programado',
    created_at: '2024-12-23T11:00:00',
  },
];

// Helper functions
export const getClientById = (id: string) => mockClients.find((c) => c.id === id);
export const getProjectById = (id: string) => mockProjects.find((p) => p.id === id);
export const getTechnicianById = (id: string) => mockTechnicians.find((t) => t.id === id);
export const getTicketsByClientId = (clientId: string) =>
  mockTickets.filter((t) => t.client_id === clientId);
export const getTicketsByProjectId = (projectId: string) =>
  mockTickets.filter((t) => t.project_id === projectId);
export const getTimelineByTicketId = (ticketId: string) =>
  mockTimelineEvents.filter((e) => e.ticket_id === ticketId);
