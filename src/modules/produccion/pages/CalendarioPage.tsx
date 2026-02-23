import { useEffect, useState, useMemo } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useOrdenes } from '../hooks/useOrdenes';
import { EtapaBadge } from '../components/StatusBadge';
import { OrdenProduccion } from '../types';
import { cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isSameDay, addMonths, subMonths, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function CalendarioPage() {
  const { ordenes, loading, fetchOrdenes } = useOrdenes();
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => { fetchOrdenes(); }, []);

  const ordenesConFecha = ordenes.filter(o => o.fecha_entrega_estimada);

  const days = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const allDays = eachDayOfInterval({ start, end });

    // Pad start with empty days for correct weekday alignment (Monday-start)
    const startDay = getDay(start);
    const padDays = startDay === 0 ? 6 : startDay - 1;

    return { allDays, padDays };
  }, [currentMonth]);

  const getOrdenesForDay = (day: Date): OrdenProduccion[] => {
    return ordenesConFecha.filter(o => isSameDay(new Date(o.fecha_entrega_estimada!), day));
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <CalendarIcon className="w-6 h-6" />
          Calendario de Entregas
        </h1>
        <p className="text-sm text-muted-foreground">Fechas de entrega proyectadas</p>
      </div>

      <Card>
        <CardContent className="p-4">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-4">
            <Button variant="outline" size="icon" onClick={() => setCurrentMonth(m => subMonths(m, 1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <h2 className="font-semibold text-lg capitalize">
              {format(currentMonth, 'MMMM yyyy', { locale: es })}
            </h2>
            <Button variant="outline" size="icon" onClick={() => setCurrentMonth(m => addMonths(m, 1))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Empty padding days */}
            {Array.from({ length: days.padDays }).map((_, i) => (
              <div key={`pad-${i}`} className="min-h-[80px] sm:min-h-[100px]" />
            ))}

            {days.allDays.map((day) => {
              const dayOrdenes = getOrdenesForDay(day);
              const today = isToday(day);

              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    'min-h-[80px] sm:min-h-[100px] border border-border rounded-lg p-1 transition-colors',
                    today && 'bg-primary/5 border-primary/30',
                    !isSameMonth(day, currentMonth) && 'opacity-30'
                  )}
                >
                  <span className={cn(
                    'text-xs font-medium block text-center mb-1',
                    today && 'text-primary font-bold'
                  )}>
                    {format(day, 'd')}
                  </span>
                  <div className="space-y-0.5">
                    {dayOrdenes.slice(0, 3).map(o => {
                      const isCompleted = o.etapa_actual === ('almacen' as any);
                      const isLate = !isCompleted && new Date(o.fecha_entrega_estimada!) < new Date();
                      return (
                        <div
                          key={o.id}
                          className={cn(
                            'text-[10px] px-1 py-0.5 rounded truncate',
                            isCompleted
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                              : isLate
                                ? 'bg-destructive/10 text-destructive'
                                : 'bg-primary/10 text-primary'
                          )}
                        >
                          {o.numero_orden}
                      </div>
                      );
                    })}
                    {dayOrdenes.length > 3 && (
                      <span className="text-[10px] text-muted-foreground">+{dayOrdenes.length - 3} más</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex gap-4 mt-4 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-primary/10 border border-primary/30" />
              <span>En proceso</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-destructive/10 border border-destructive/30" />
              <span>Retrasada</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-green-100 border border-green-300 dark:bg-green-900/30" />
              <span>Completada</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
