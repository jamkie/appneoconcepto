import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { NotificacionProduccion } from '../types';

export function useNotificaciones() {
  const { user } = useAuth();
  const [notificaciones, setNotificaciones] = useState<NotificacionProduccion[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotificaciones = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('notificaciones_produccion')
      .select('*')
      .eq('usuario_id', user.id)
      .order('created_at', { ascending: false });

    setNotificaciones((data || []) as NotificacionProduccion[]);
    setLoading(false);
  }, [user]);

  const markAsRead = async (id: string) => {
    await supabase
      .from('notificaciones_produccion')
      .update({ leida: true })
      .eq('id', id);
    await fetchNotificaciones();
  };

  const markAllRead = async () => {
    if (!user) return;
    await supabase
      .from('notificaciones_produccion')
      .update({ leida: true })
      .eq('usuario_id', user.id)
      .eq('leida', false);
    await fetchNotificaciones();
  };

  return { notificaciones, loading, fetchNotificaciones, markAsRead, markAllRead };
}
