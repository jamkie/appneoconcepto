import { useEffect } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useNotificaciones } from '../hooks/useNotificaciones';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2 } from 'lucide-react';

export default function NotificacionesPage() {
  const { notificaciones, loading, fetchNotificaciones, markAsRead, markAllRead } = useNotificaciones();

  useEffect(() => { fetchNotificaciones(); }, []);

  const unreadCount = notificaciones.filter(n => !n.leida).length;

  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Bell className="w-6 h-6" />
            Notificaciones
          </h1>
          <p className="text-sm text-muted-foreground">{unreadCount > 0 ? `${unreadCount} sin leer` : 'Todas leídas'}</p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead}>
            <CheckCheck className="w-4 h-4 mr-2" />
            Marcar todas como leídas
          </Button>
        )}
      </div>

      {notificaciones.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-muted-foreground">No hay notificaciones</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notificaciones.map((n) => (
            <Card
              key={n.id}
              className={cn(
                'cursor-pointer transition-colors hover:bg-muted/50',
                !n.leida && 'border-primary/30 bg-primary/5'
              )}
              onClick={() => !n.leida && markAsRead(n.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {!n.leida && <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />}
                  <div className={cn('flex-1', n.leida && 'pl-5')}>
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-medium text-sm">{n.titulo}</h4>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: es })}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{n.mensaje}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
