import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { NotificacionProduccion } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificacionProduccion[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  const fetchNotifications = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('notificaciones_produccion')
      .select('*')
      .eq('usuario_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (data) {
      setNotifications(data as NotificacionProduccion[]);
      setUnreadCount(data.filter((n) => !n.leida).length);
    }
  };

  useEffect(() => {
    fetchNotifications();

    if (!user) return;

    const channel = supabase
      .channel('notificaciones-produccion')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notificaciones_produccion',
          filter: `usuario_id=eq.${user.id}`,
        },
        () => fetchNotifications()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const markAsRead = async (id: string) => {
    await supabase
      .from('notificaciones_produccion')
      .update({ leida: true })
      .eq('id', id);
    fetchNotifications();
  };

  const markAllRead = async () => {
    if (!user) return;
    await supabase
      .from('notificaciones_produccion')
      .update({ leida: true })
      .eq('usuario_id', user.id)
      .eq('leida', false);
    fetchNotifications();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center font-bold">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b border-border">
          <h4 className="font-semibold text-sm">Notificaciones</h4>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={markAllRead}>
              Marcar todas como leídas
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Sin notificaciones
            </div>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => {
                  markAsRead(n.id);
                  setOpen(false);
                  navigate('/produccion/notificaciones');
                }}
                className={cn(
                  'w-full text-left p-3 border-b border-border/50 hover:bg-muted/50 transition-colors',
                  !n.leida && 'bg-primary/5'
                )}
              >
                <div className="flex items-start gap-2">
                  {!n.leida && <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />}
                  <div className={cn(!n.leida ? '' : 'pl-4')}>
                    <p className="text-sm font-medium">{n.titulo}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{n.mensaje}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: es })}
                    </p>
                  </div>
                </div>
              </button>
            ))
          )}
        </ScrollArea>
        {notifications.length > 0 && (
          <div className="p-2 border-t border-border">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs"
              onClick={() => { setOpen(false); navigate('/produccion/notificaciones'); }}
            >
              Ver todas
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
