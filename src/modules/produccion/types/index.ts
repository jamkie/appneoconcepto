export type ProduccionEtapa =
  | 'ingenieria'
  | 'espera_materiales'
  | 'dimensionado'
  | 'enchapado'
  | 'maquinado'
  | 'armado'
  | 'empaquetado'
  | 'almacen';

export type PedidoEstado =
  | 'nuevo'
  | 'en_ingenieria'
  | 'en_produccion'
  | 'completado'
  | 'entregado';

export interface Pedido {
  id: string;
  cliente: string;
  nombre_proyecto: string;
  fecha_carga: string;
  fecha_entrega: string | null;
  estado: PedidoEstado;
  creado_por: string;
  observaciones: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrdenProduccion {
  id: string;
  pedido_id: string;
  numero_orden: string;
  descripcion: string;
  etapa_actual: ProduccionEtapa;
  fecha_entrega_estimada: string | null;
  creado_por: string;
  created_at: string;
  updated_at: string;
  // Joined
  pedidos?: Pedido;
}

export interface OrdenArchivo {
  id: string;
  orden_id: string;
  nombre_archivo: string;
  tipo: string;
  storage_path: string;
  subido_por: string;
  created_at: string;
}

export interface OrdenTransicion {
  id: string;
  orden_id: string;
  etapa_anterior: ProduccionEtapa;
  etapa_nueva: ProduccionEtapa;
  timestamp: string;
  realizado_por: string;
  observaciones: string | null;
}

export interface NotificacionProduccion {
  id: string;
  usuario_id: string;
  titulo: string;
  mensaje: string;
  tipo: string;
  leida: boolean;
  referencia_id: string | null;
  created_at: string;
}

export const ETAPA_LABELS: Record<ProduccionEtapa, string> = {
  ingenieria: 'Ingeniería',
  espera_materiales: 'Espera de Materiales',
  dimensionado: 'Dimensionado',
  enchapado: 'Enchapado',
  maquinado: 'Maquinado',
  armado: 'Armado',
  empaquetado: 'Empaquetado',
  almacen: 'Almacén',
};

export const ETAPA_ORDER: ProduccionEtapa[] = [
  'ingenieria',
  'espera_materiales',
  'dimensionado',
  'enchapado',
  'maquinado',
  'armado',
  'empaquetado',
  'almacen',
];

export const KANBAN_ETAPAS: ProduccionEtapa[] = [
  'dimensionado',
  'enchapado',
  'maquinado',
  'armado',
  'empaquetado',
];

export const PEDIDO_ESTADO_LABELS: Record<PedidoEstado, string> = {
  nuevo: 'Nuevo',
  en_ingenieria: 'En Ingeniería',
  en_produccion: 'En Producción',
  completado: 'Completado',
  entregado: 'Entregado',
};
