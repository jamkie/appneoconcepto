import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Pedido, PedidoEstado } from '../types';
import { useToast } from '@/hooks/use-toast';

export function usePedidos() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPedidos = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('pedidos')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Error', description: 'No se pudieron cargar los pedidos', variant: 'destructive' });
    } else {
      setPedidos((data || []) as Pedido[]);
    }
    setLoading(false);
  }, [toast]);

  const createPedido = async (data: { cliente: string; nombre_proyecto: string; fecha_entrega?: string; observaciones?: string }) => {
    if (!user) return null;
    const { data: newPedido, error } = await supabase
      .from('pedidos')
      .insert({
        cliente: data.cliente,
        nombre_proyecto: data.nombre_proyecto,
        fecha_entrega: data.fecha_entrega || null,
        observaciones: data.observaciones || null,
        creado_por: user.id,
      })
      .select()
      .single();

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return null;
    }
    toast({ title: 'Pedido creado', description: `Pedido "${data.nombre_proyecto}" registrado` });
    await fetchPedidos();
    return newPedido;
  };

  const updatePedidoEstado = async (id: string, estado: PedidoEstado) => {
    const { error } = await supabase
      .from('pedidos')
      .update({ estado })
      .eq('id', id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      await fetchPedidos();
    }
  };

  return { pedidos, loading, fetchPedidos, createPedido, updatePedidoEstado };
}
