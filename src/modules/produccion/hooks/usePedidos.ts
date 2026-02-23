import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Pedido, PedidoEstado } from '../types';
import { useToast } from '@/hooks/use-toast';

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
}

export function usePedidos() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
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

  const fetchProfiles = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('activo', true)
      .order('full_name', { ascending: true });
    setProfiles((data || []) as Profile[]);
  }, []);

  const createPedido = async (data: {
    cliente: string;
    cliente_id?: string;
    nombre_proyecto: string;
    fecha_entrega?: string;
    observaciones?: string;
    vendedor_id?: string;
    disenador_id?: string;
  }) => {
    if (!user) return null;
    const { data: newPedido, error } = await supabase
      .from('pedidos')
      .insert({
        cliente: data.cliente,
        cliente_id: data.cliente_id || null,
        nombre_proyecto: data.nombre_proyecto,
        fecha_entrega: data.fecha_entrega || null,
        observaciones: data.observaciones || null,
        vendedor_id: data.vendedor_id || null,
        disenador_id: data.disenador_id || null,
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

  return { pedidos, profiles, loading, fetchPedidos, fetchProfiles, createPedido, updatePedidoEstado };
}
