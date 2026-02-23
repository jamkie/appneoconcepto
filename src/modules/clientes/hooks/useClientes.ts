import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Cliente } from '../types';

export function useClientes() {
  const { toast } = useToast();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchClientes = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .order('nombre', { ascending: true });

    if (error) {
      toast({ title: 'Error', description: 'No se pudieron cargar los clientes', variant: 'destructive' });
    } else {
      setClientes((data || []) as Cliente[]);
    }
    setLoading(false);
  }, [toast]);

  const createCliente = async (data: Omit<Cliente, 'id' | 'created_at' | 'updated_at' | 'activo'>) => {
    const { data: newCliente, error } = await supabase
      .from('clientes')
      .insert(data)
      .select()
      .single();

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return null;
    }
    toast({ title: 'Cliente creado', description: `"${data.nombre}" registrado` });
    await fetchClientes();
    return newCliente;
  };

  const updateCliente = async (id: string, data: Partial<Cliente>) => {
    const { error } = await supabase
      .from('clientes')
      .update(data)
      .eq('id', id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Cliente actualizado' });
    await fetchClientes();
    return true;
  };

  const deleteCliente = async (id: string) => {
    const { error } = await supabase
      .from('clientes')
      .delete()
      .eq('id', id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Cliente eliminado' });
    await fetchClientes();
    return true;
  };

  return { clientes, loading, fetchClientes, createCliente, updateCliente, deleteCliente };
}
