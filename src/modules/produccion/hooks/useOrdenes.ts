import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { OrdenProduccion, ProduccionEtapa } from '../types';
import { useToast } from '@/hooks/use-toast';

export function useOrdenes() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [ordenes, setOrdenes] = useState<OrdenProduccion[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrdenes = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('ordenes_produccion')
      .select('*, pedidos(cliente, nombre_proyecto, fecha_entrega)')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Error', description: 'No se pudieron cargar las órdenes', variant: 'destructive' });
    } else {
      setOrdenes((data || []) as OrdenProduccion[]);
    }
    setLoading(false);
  }, [toast]);

  const createOrden = async (data: { pedido_id: string; descripcion: string; fecha_entrega_estimada?: string }) => {
    if (!user) return null;

    // Generate order number
    const { count } = await supabase
      .from('ordenes_produccion')
      .select('*', { count: 'exact', head: true });
    
    const numero = `OP-${String((count || 0) + 1).padStart(4, '0')}`;

    const { data: newOrden, error } = await supabase
      .from('ordenes_produccion')
      .insert({
        pedido_id: data.pedido_id,
        numero_orden: numero,
        descripcion: data.descripcion,
        fecha_entrega_estimada: data.fecha_entrega_estimada || null,
        creado_por: user.id,
      })
      .select()
      .single();

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return null;
    }

    // Register transition
    await supabase.from('orden_transiciones').insert({
      orden_id: newOrden.id,
      etapa_anterior: 'ingenieria',
      etapa_nueva: 'ingenieria',
      realizado_por: user.id,
      observaciones: 'Orden creada',
    });

    toast({ title: 'Orden creada', description: `Orden ${numero} registrada` });
    await fetchOrdenes();
    return newOrden;
  };

  const moverEtapa = async (ordenId: string, etapaAnterior: ProduccionEtapa, etapaNueva: ProduccionEtapa, observaciones?: string) => {
    if (!user) return;

    const { error } = await supabase
      .from('ordenes_produccion')
      .update({ etapa_actual: etapaNueva })
      .eq('id', ordenId);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }

    await supabase.from('orden_transiciones').insert({
      orden_id: ordenId,
      etapa_anterior: etapaAnterior,
      etapa_nueva: etapaNueva,
      realizado_por: user.id,
      observaciones: observaciones || null,
    });

    await fetchOrdenes();
  };

  return { ordenes, loading, fetchOrdenes, createOrden, moverEtapa };
}
