import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ProduccionEtapa, PedidoEstado, ETAPA_LABELS, PEDIDO_ESTADO_LABELS } from '../types';

const etapaColors: Record<ProduccionEtapa, string> = {
  ingenieria: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  espera_materiales: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  dimensionado: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  enchapado: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  maquinado: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  armado: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  empaquetado: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  almacen: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
};

const estadoColors: Record<PedidoEstado, string> = {
  nuevo: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  en_ingenieria: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  en_produccion: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  completado: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  entregado: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
};

interface EtapaBadgeProps {
  etapa: ProduccionEtapa;
  className?: string;
}

export function EtapaBadge({ etapa, className }: EtapaBadgeProps) {
  return (
    <Badge variant="secondary" className={cn('font-medium', etapaColors[etapa], className)}>
      {ETAPA_LABELS[etapa]}
    </Badge>
  );
}

interface EstadoBadgeProps {
  estado: PedidoEstado;
  className?: string;
}

export function EstadoBadge({ estado, className }: EstadoBadgeProps) {
  return (
    <Badge variant="secondary" className={cn('font-medium', estadoColors[estado], className)}>
      {PEDIDO_ESTADO_LABELS[estado]}
    </Badge>
  );
}
