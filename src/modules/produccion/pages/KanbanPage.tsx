import { useEffect, useState, useCallback } from 'react';
import { Kanban as KanbanIcon, AlertTriangle, FileText, GripVertical } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useOrdenes } from '../hooks/useOrdenes';
import { useSubmodulePermissions } from '@/hooks/useSubmodulePermissions';
import { OrdenProduccion, KANBAN_ETAPAS, ETAPA_LABELS, ProduccionEtapa } from '../types';
import { cn } from '@/lib/utils';
import { EtapaBadge } from '../components/StatusBadge';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import { Badge } from '@/components/ui/badge';
import { format, isBefore, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';

export default function KanbanPage() {
  const { ordenes, loading, fetchOrdenes, moverEtapa } = useOrdenes();
  const { canUpdate } = useSubmodulePermissions('produccion', 'kanban');
  const isMobile = useIsMobile();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [archivoCounts, setArchivoCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchOrdenes();
    // Subscribe to realtime changes
    const channel = supabase
      .channel('kanban-ordenes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ordenes_produccion' }, () => fetchOrdenes())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    const fetchArchivoCounts = async () => {
      const { data } = await supabase.from('orden_archivos').select('orden_id');
      if (data) {
        const counts: Record<string, number> = {};
        data.forEach((a) => { counts[a.orden_id] = (counts[a.orden_id] || 0) + 1; });
        setArchivoCounts(counts);
      }
    };
    fetchArchivoCounts();
  }, [ordenes]);

  const kanbanOrdenes = ordenes.filter(o => KANBAN_ETAPAS.includes(o.etapa_actual));

  const getOrdenesForEtapa = (etapa: ProduccionEtapa) => kanbanOrdenes.filter(o => o.etapa_actual === etapa);

  const isDelayed = (o: OrdenProduccion) => {
    if (!o.fecha_entrega_estimada) return false;
    return isBefore(new Date(o.fecha_entrega_estimada), startOfDay(new Date()));
  };

  const handleDragStart = (e: React.DragEvent, ordenId: string) => {
    if (!canUpdate) return;
    e.dataTransfer.setData('ordenId', ordenId);
    setDraggingId(ordenId);
  };

  const handleDrop = (e: React.DragEvent, targetEtapa: ProduccionEtapa) => {
    e.preventDefault();
    if (!canUpdate) return;
    const ordenId = e.dataTransfer.getData('ordenId');
    const orden = ordenes.find(o => o.id === ordenId);
    if (orden && orden.etapa_actual !== targetEtapa) {
      moverEtapa(ordenId, orden.etapa_actual, targetEtapa);
    }
    setDraggingId(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // Touch support for mobile
  const handleTouchMove = useCallback((ordenId: string, etapa: ProduccionEtapa) => {
    if (!canUpdate) return;
    const orden = ordenes.find(o => o.id === ordenId);
    if (!orden) return;
    const currentIdx = KANBAN_ETAPAS.indexOf(orden.etapa_actual);
    const targetIdx = KANBAN_ETAPAS.indexOf(etapa);
    if (currentIdx !== targetIdx) {
      moverEtapa(ordenId, orden.etapa_actual, etapa);
    }
  }, [ordenes, canUpdate, moverEtapa]);

  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <KanbanIcon className="w-6 h-6" />
          Tablero Kanban
        </h1>
        <p className="text-sm text-muted-foreground">Arrastra las tarjetas para mover órdenes entre etapas</p>
      </div>

      <div className={cn(
        'flex gap-4 pb-4',
        isMobile ? 'overflow-x-auto snap-x snap-mandatory -mx-4 px-4' : ''
      )}>
        {KANBAN_ETAPAS.map((etapa) => {
          const etapaOrdenes = getOrdenesForEtapa(etapa);
          return (
            <div
              key={etapa}
              className={cn(
                'flex-shrink-0 bg-muted/30 rounded-xl border border-border',
                isMobile ? 'w-[85vw] snap-center' : 'w-64 min-w-[16rem]'
              )}
              onDrop={(e) => handleDrop(e, etapa)}
              onDragOver={handleDragOver}
            >
              <div className="p-3 border-b border-border">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">{ETAPA_LABELS[etapa]}</h3>
                  <Badge variant="secondary" className="text-xs">{etapaOrdenes.length}</Badge>
                </div>
              </div>
              <div className="p-2 space-y-2 min-h-[200px]">
                {etapaOrdenes.map((o) => (
                  <Card
                    key={o.id}
                    draggable={canUpdate}
                    onDragStart={(e) => handleDragStart(e, o.id)}
                    onDragEnd={() => setDraggingId(null)}
                    className={cn(
                      'cursor-grab active:cursor-grabbing transition-all',
                      draggingId === o.id && 'opacity-50 scale-95',
                      isDelayed(o) && 'border-destructive/50'
                    )}
                  >
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-start justify-between">
                        <span className="font-mono text-xs font-bold text-primary">{o.numero_orden}</span>
                        {canUpdate && <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />}
                      </div>
                      <p className="text-sm font-medium text-foreground">{(o.pedidos as any)?.cliente}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{o.descripcion}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        {isDelayed(o) && (
                          <Badge variant="destructive" className="text-xs gap-1">
                            <AlertTriangle className="w-3 h-3" /> Retrasada
                          </Badge>
                        )}
                        {archivoCounts[o.id] > 0 && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <FileText className="w-3 h-3" /> {archivoCounts[o.id]}
                          </Badge>
                        )}
                      </div>
                      {o.fecha_entrega_estimada && (
                        <p className="text-xs text-muted-foreground">
                          Entrega: {format(new Date(o.fecha_entrega_estimada), 'dd MMM', { locale: es })}
                        </p>
                      )}

                      {/* Mobile: quick move buttons */}
                      {isMobile && canUpdate && (
                        <div className="flex gap-1 mt-2">
                          {KANBAN_ETAPAS.map((targetEtapa) => {
                            if (targetEtapa === etapa) return null;
                            return (
                              <button
                                key={targetEtapa}
                                onClick={() => handleTouchMove(o.id, targetEtapa)}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-muted hover:bg-primary hover:text-primary-foreground transition-colors"
                              >
                                {ETAPA_LABELS[targetEtapa].substring(0, 3)}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
                {etapaOrdenes.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-8">Sin órdenes</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
