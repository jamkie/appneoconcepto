import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/formatters';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';

interface AnticipoDisponible {
  id: string;
  monto_disponible: number;
  monto_original: number;
  obra_id: string;
  obra_nombre: string;
  created_at: string;
  solicitud_pago_id: string | null;
  selected?: boolean;
  montoAplicar?: number;
}

interface ApplyAnticipoModalProps {
  isOpen: boolean;
  onClose: () => void;
  instaladorId: string;
  instaladorNombre: string;
  corteId?: string;
  corteNombre?: string;
  // IDs of solicitudes that belong to this corte (to exclude their anticipos)
  solicitudIdsEnCorte?: Set<string>;
  userId: string;
  onSuccess: () => void;
  /** When provided, only show anticipos for this obra */
  obraId?: string;
  /** Maximum total that can be applied (e.g. the avance amount) */
  montoMaximo?: number;
}

export function ApplyAnticipoModal({
  isOpen,
  onClose,
  instaladorId,
  instaladorNombre,
  corteId,
  corteNombre,
  solicitudIdsEnCorte,
  userId,
  onSuccess,
  obraId,
  montoMaximo,
}: ApplyAnticipoModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [anticipos, setAnticipos] = useState<AnticipoDisponible[]>([]);
  const [montoTotal, setMontoTotal] = useState<number>(0);

  useEffect(() => {
    if (isOpen && instaladorId) {
      fetchAnticipos();
    }
  }, [isOpen, instaladorId]);

  const fetchAnticipos = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('anticipos')
        .select(`
          id,
          monto_disponible,
          monto_original,
          obra_id,
          created_at,
          solicitud_pago_id,
          obras(nombre)
        `)
        .eq('instalador_id', instaladorId)
        .gt('monto_disponible', 0)
        .order('created_at', { ascending: true }); // FIFO - oldest first

      if (obraId) {
        query = query.eq('obra_id', obraId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Filter out anticipos that belong to solicitudes in THIS corte (if provided)
      const filtered = (data || [])
        .filter((a: any) => !solicitudIdsEnCorte || !a.solicitud_pago_id || !solicitudIdsEnCorte.has(a.solicitud_pago_id))
        .map((a: any) => ({
          id: a.id,
          monto_disponible: Number(a.monto_disponible),
          monto_original: Number(a.monto_original),
          obra_id: a.obra_id,
          obra_nombre: a.obras?.nombre || 'Desconocido',
          created_at: a.created_at,
          solicitud_pago_id: a.solicitud_pago_id,
          selected: false,
          montoAplicar: 0,
        }));

      setAnticipos(filtered);
      setMontoTotal(0);
    } catch (error) {
      console.error('Error fetching anticipos:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los anticipos disponibles',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAnticipo = (id: string, checked: boolean) => {
    setAnticipos(prev => {
      const updated = prev.map(a => {
        if (a.id === id) {
          if (!checked) {
            return { ...a, selected: false, montoAplicar: 0 };
          }
          // Calculate available space considering montoMaximo
          const otrosSeleccionados = prev
            .filter(x => x.id !== id)
            .reduce((sum, x) => sum + (x.montoAplicar || 0), 0);
          const espacioDisponible = montoMaximo != null
            ? Math.max(0, montoMaximo - otrosSeleccionados)
            : Infinity;
          const newMontoAplicar = Math.min(a.monto_disponible, espacioDisponible);
          return { ...a, selected: newMontoAplicar > 0, montoAplicar: newMontoAplicar };
        }
        return a;
      });
      const total = updated.reduce((sum, a) => sum + (a.montoAplicar || 0), 0);
      setMontoTotal(total);
      return updated;
    });
  };

  const handleMontoChange = (id: string, value: number) => {
    setAnticipos(prev => {
      const updated = prev.map(a => {
        if (a.id === id) {
          const otrosSeleccionados = prev
            .filter(x => x.id !== id)
            .reduce((sum, x) => sum + (x.montoAplicar || 0), 0);
          const espacioDisponible = montoMaximo != null
            ? Math.max(0, montoMaximo - otrosSeleccionados)
            : Infinity;
          const clampedValue = Math.min(Math.max(0, value), a.monto_disponible, espacioDisponible);
          return { ...a, montoAplicar: clampedValue, selected: clampedValue > 0 };
        }
        return a;
      });
      const total = updated.reduce((sum, a) => sum + (a.montoAplicar || 0), 0);
      setMontoTotal(total);
      return updated;
    });
  };

  const handleApply = async () => {
    const anticiposToApply = anticipos.filter(a => (a.montoAplicar || 0) > 0);
    
    if (anticiposToApply.length === 0) {
      toast({
        title: 'Sin selección',
        description: 'Selecciona al menos un anticipo para aplicar',
        variant: 'destructive',
      });
      return;
    }

    setApplying(true);
    try {
      for (const anticipo of anticiposToApply) {
        const montoAplicar = anticipo.montoAplicar || 0;
        if (montoAplicar <= 0) continue;

        // Create a solicitud tipo 'aplicacion_anticipo' 
        const { error: insertError } = await supabase
          .from('solicitudes_pago')
          .insert({
            tipo: 'aplicacion_anticipo',
            instalador_id: instaladorId,
            obra_id: anticipo.obra_id,
            total_solicitado: montoAplicar,
            estado: 'aprobada',
            solicitado_por: userId,
            aprobado_por: userId,
            fecha_aprobacion: new Date().toISOString(),
            corte_id: corteId || null,
            observaciones: corteNombre
              ? `Aplicación manual de anticipo (${format(new Date(anticipo.created_at), 'dd/MM/yyyy', { locale: es })}) al corte: ${corteNombre}`
              : `Aplicación manual de anticipo (${format(new Date(anticipo.created_at), 'dd/MM/yyyy', { locale: es })}) al registrar avance`,
          });

        if (insertError) throw insertError;

        // Reduce the anticipo's monto_disponible
        const newMontoDisponible = anticipo.monto_disponible - montoAplicar;
        const { error: updateError } = await supabase
          .from('anticipos')
          .update({ monto_disponible: newMontoDisponible })
          .eq('id', anticipo.id);

        if (updateError) throw updateError;
      }

      toast({
        title: 'Anticipo aplicado',
        description: `Se aplicaron ${formatCurrency(montoTotal)} como descuento para ${instaladorNombre}`,
      });

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error applying anticipo:', error);
      toast({
        title: 'Error',
        description: 'No se pudo aplicar el anticipo',
        variant: 'destructive',
      });
    } finally {
      setApplying(false);
    }
  };

  const totalDisponible = anticipos.reduce((sum, a) => sum + a.monto_disponible, 0);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Aplicar Anticipo</DialogTitle>
          <DialogDescription>
            Selecciona los anticipos de <strong>{instaladorNombre}</strong> que deseas descontar en este corte.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : anticipos.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              No hay anticipos disponibles para aplicar.
            </p>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {anticipos.map((anticipo) => (
                <div
                  key={anticipo.id}
                  className={`p-3 rounded-lg border transition-colors ${
                    anticipo.selected ? 'border-primary bg-primary/5' : 'border-border'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={anticipo.selected}
                      onCheckedChange={(checked) => handleToggleAnticipo(anticipo.id, checked === true)}
                    />
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-sm">{anticipo.obra_nombre}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(anticipo.created_at), 'dd MMM yyyy', { locale: es })}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-sm">
                            {formatCurrency(anticipo.monto_disponible)}
                          </p>
                          {anticipo.monto_original !== anticipo.monto_disponible && (
                            <p className="text-xs text-muted-foreground">
                              de {formatCurrency(anticipo.monto_original)}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      {anticipo.selected && (
                        <div className="mt-2 flex items-center gap-2">
                          <Label className="text-xs text-muted-foreground whitespace-nowrap">
                            Monto a aplicar:
                          </Label>
                          <Input
                            type="number"
                            min="0"
                            max={anticipo.monto_disponible}
                            step="100"
                            value={anticipo.montoAplicar || ''}
                            onChange={(e) => handleMontoChange(anticipo.id, parseFloat(e.target.value) || 0)}
                            className="h-8 w-32 text-right"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <div>
            <p className="text-sm text-muted-foreground">Total disponible</p>
            <p className="font-semibold">{formatCurrency(totalDisponible)}</p>
          </div>
          {montoMaximo != null && (
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Monto del avance</p>
              <p className="font-semibold">{formatCurrency(montoMaximo)}</p>
            </div>
          )}
          <div className="text-right">
            <p className="text-sm text-muted-foreground">A aplicar</p>
            <p className={`font-bold text-lg ${montoMaximo != null && montoTotal >= montoMaximo ? 'text-orange-600' : 'text-primary'}`}>
              {formatCurrency(montoTotal)}
            </p>
          </div>
        </div>
        {montoMaximo != null && montoTotal >= montoMaximo && (
          <p className="text-xs text-orange-600 text-center">Se alcanzó el tope máximo del avance</p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={applying}>
            Cancelar
          </Button>
          <Button onClick={handleApply} disabled={applying || montoTotal === 0}>
            {applying ? 'Aplicando...' : `Aplicar ${formatCurrency(montoTotal)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
