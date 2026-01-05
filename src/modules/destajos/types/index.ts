// Destajos Module Types

export type ObraStatus = 'activa' | 'cerrada';
export type PaymentRequestStatus = 'pendiente' | 'aprobada' | 'rechazada';
export type ExtraStatus = 'pendiente' | 'aprobado' | 'rechazado';
export type PaymentMethod = 'efectivo' | 'transferencia' | 'cheque' | 'otro';

export interface Instalador {
  id: string;
  nombre: string;
  numero_cuenta: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Obra {
  id: string;
  nombre: string;
  cliente: string | null;
  ubicacion: string | null;
  estado: ObraStatus;
  precio_cocina: number;
  precio_closet: number;
  precio_cubierta: number;
  precio_vanity: number;
  created_at: string;
  updated_at: string;
}

export interface ObraItem {
  id: string;
  obra_id: string;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  created_at: string;
}

export interface ObraInstalador {
  id: string;
  obra_id: string;
  instalador_id: string;
  created_at: string;
}

export interface ObraSupervisor {
  id: string;
  obra_id: string;
  supervisor_id: string;
  created_at: string;
}

export interface Avance {
  id: string;
  obra_id: string;
  instalador_id: string;
  fecha: string;
  cocinas_completadas: number;
  closets_completados: number;
  cubiertas_completadas: number;
  vanitys_completados: number;
  observaciones: string | null;
  registrado_por: string;
  created_at: string;
}

export interface AvanceItem {
  id: string;
  avance_id: string;
  obra_item_id: string;
  cantidad_completada: number;
  created_at: string;
}

export interface TipoExtra {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  created_at: string;
}

export interface Extra {
  id: string;
  obra_id: string;
  instalador_id: string;
  tipo_extra_id: string | null;
  descripcion: string;
  monto: number;
  estado: ExtraStatus;
  aprobado_por: string | null;
  fecha_aprobacion: string | null;
  solicitado_por: string;
  created_at: string;
}

export interface SolicitudPago {
  id: string;
  obra_id: string;
  instalador_id: string;
  tipo: string;
  cocinas_solicitadas: number;
  closets_solicitados: number;
  monto_libre: number;
  extras_ids: string[];
  subtotal_piezas: number;
  subtotal_extras: number;
  total_solicitado: number;
  retencion: number;
  estado: PaymentRequestStatus;
  observaciones: string | null;
  solicitado_por: string;
  aprobado_por: string | null;
  fecha_aprobacion: string | null;
  created_at: string;
}

export interface PagoDestajo {
  id: string;
  solicitud_id: string | null;
  instalador_id: string;
  obra_id: string;
  monto: number;
  metodo_pago: PaymentMethod;
  referencia: string | null;
  observaciones: string | null;
  registrado_por: string;
  fecha: string;
  created_at: string;
}

// Extended types with relations
export interface ObraWithDetails extends Obra {
  instaladores?: Instalador[];
}

export interface AvanceWithDetails extends Avance {
  obra?: Obra;
  instalador?: Instalador;
}

export interface SolicitudPagoWithDetails extends SolicitudPago {
  obra?: Obra;
  instalador?: Instalador;
}

export interface PagoDestajoWithDetails extends PagoDestajo {
  obra?: Obra;
  instalador?: Instalador;
  solicitud?: SolicitudPago;
}
