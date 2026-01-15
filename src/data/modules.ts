import { Module } from '@/types/modules';

export interface Submodule {
  id: string;
  label: string;
}

export interface ModuleWithSubmodules extends Module {
  submodules: Submodule[];
}

export const modulesWithSubmodules: ModuleWithSubmodules[] = [
  {
    id: 'comisiones',
    title: 'Comisiones',
    description: 'Gestión y seguimiento de comisiones de ventas y colaboradores.',
    icon: 'Wallet',
    route: '/comisiones',
    status: 'active',
    requiredPermissions: ['comisiones.view'],
    submodules: [
      { id: 'dashboard', label: 'Dashboard' },
      { id: 'ventas', label: 'Ventas' },
      { id: 'vendedores', label: 'Vendedores' },
      { id: 'pagos', label: 'Pagos' },
    ],
  },
  {
    id: 'destajos',
    title: 'Destajos',
    description: 'Control de pagos por obra y trabajo a destajo.',
    icon: 'Hammer',
    route: '/destajos',
    status: 'active',
    requiredPermissions: ['destajos.view'],
    submodules: [
      { id: 'dashboard', label: 'Dashboard' },
      { id: 'obras', label: 'Obras' },
      { id: 'instaladores', label: 'Instaladores' },
      { id: 'avances', label: 'Avances' },
      { id: 'extras', label: 'Extras' },
      { id: 'solicitudes', label: 'Solicitudes' },
      { id: 'cortes', label: 'Cortes' },
      { id: 'pagos', label: 'Pagos' },
    ],
  },
  {
    id: 'servicios',
    title: 'Servicios al Cliente',
    description: 'Atención, seguimiento y gestión de solicitudes de clientes.',
    icon: 'Headphones',
    route: '/servicios',
    status: 'active',
    requiredPermissions: ['servicios.view'],
    submodules: [
      { id: 'dashboard', label: 'Dashboard' },
      { id: 'tickets', label: 'Tickets' },
      { id: 'clientes', label: 'Clientes' },
      { id: 'proyectos', label: 'Proyectos' },
      { id: 'agenda', label: 'Agenda' },
      { id: 'reportes', label: 'Reportes' },
    ],
  },
  {
    id: 'mantenimiento',
    title: 'Mantenimiento de Maquinaria',
    description: 'Programación y registro de mantenimiento preventivo y correctivo.',
    icon: 'Wrench',
    route: null,
    status: 'coming_soon',
    requiredPermissions: ['mantenimiento.view'],
    submodules: [],
  },
  {
    id: 'produccion',
    title: 'Producción',
    description: 'Control y monitoreo de líneas de producción en tiempo real.',
    icon: 'Factory',
    route: null,
    status: 'coming_soon',
    requiredPermissions: ['produccion.view'],
    submodules: [],
  },
];

// Legacy export for backward compatibility
export const modules: Module[] = modulesWithSubmodules;

// Mock user permissions - in production this would come from auth
export const mockUserPermissions = {
  modules: [
    'comisiones.view',
    'destajos.view',
    'servicios.view',
    'mantenimiento.view',
    'produccion.view',
  ],
};
