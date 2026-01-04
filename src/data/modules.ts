import { Module } from '@/types/modules';

export const modules: Module[] = [
  {
    id: 'comisiones',
    title: 'Comisiones',
    description: 'Gestión y seguimiento de comisiones de ventas y colaboradores.',
    icon: 'Wallet',
    route: '/comisiones',
    status: 'active',
    requiredPermissions: ['comisiones.view'],
  },
  {
    id: 'destajos',
    title: 'Destajos',
    description: 'Control de pagos por obra y trabajo a destajo.',
    icon: 'Hammer',
    route: '/destajos',
    status: 'active',
    requiredPermissions: ['destajos.view'],
  },
  {
    id: 'servicios',
    title: 'Servicios al Cliente',
    description: 'Atención, seguimiento y gestión de solicitudes de clientes.',
    icon: 'Headphones',
    route: '/servicios',
    status: 'active',
    requiredPermissions: ['servicios.view'],
  },
  {
    id: 'mantenimiento',
    title: 'Mantenimiento de Maquinaria',
    description: 'Programación y registro de mantenimiento preventivo y correctivo.',
    icon: 'Wrench',
    route: null,
    status: 'coming_soon',
    requiredPermissions: ['mantenimiento.view'],
  },
  {
    id: 'produccion',
    title: 'Producción',
    description: 'Control y monitoreo de líneas de producción en tiempo real.',
    icon: 'Factory',
    route: null,
    status: 'coming_soon',
    requiredPermissions: ['produccion.view'],
  },
];

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
