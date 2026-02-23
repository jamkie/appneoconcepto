import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, ClipboardList, Kanban as KanbanIcon, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { StatCard } from '../components/StatCard';
import { EtapaBadge } from '../components/StatusBadge';
import { ProduccionEtapa, ETAPA_LABELS } from '../types';
import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2 } from 'lucide-react';

interface DashboardStats {
  pedidosActivos: number;
  ordenesEnProceso: number;
  ordenesCompletadasHoy: number;
  ordenesRetrasadas: number;
}

interface RecentOrden {
  id: string;
  numero_orden: string;
  descripcion: string;
  etapa_actual: ProduccionEtapa;
  fecha_entrega_estimada: string | null;
  pedidos: { cliente: string; nombre_proyecto: string } | null;
}

export default function ProduccionDashboard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({ pedidosActivos: 0, ordenesEnProceso: 0, ordenesCompletadasHoy: 0, ordenesRetrasadas: 0 });
  const [recentOrdenes, setRecentOrdenes] = useState<RecentOrden[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      setLoadingData(true);

      const [pedidosRes, ordenesRes, completadasRes, recentRes] = await Promise.all([
        supabase.from('pedidos').select('*', { count: 'exact', head: true }).not('estado', 'in', '("completado","entregado")'),
        supabase.from('ordenes_produccion').select('*', { count: 'exact', head: true }).not('etapa_actual', 'eq', 'almacen'),
        supabase.from('orden_transiciones').select('*', { count: 'exact', head: true }).eq('etapa_nueva', 'almacen').gte('timestamp', new Date().toISOString().split('T')[0]),
        supabase.from('ordenes_produccion').select('id, numero_orden, descripcion, etapa_actual, fecha_entrega_estimada, pedidos(cliente, nombre_proyecto)').not('etapa_actual', 'eq', 'almacen').order('updated_at', { ascending: false }).limit(10),
      ]);

      // Count delayed orders
      const today = new Date().toISOString().split('T')[0];
      const { count: retrasadas } = await supabase
        .from('ordenes_produccion')
        .select('*', { count: 'exact', head: true })
        .not('etapa_actual', 'eq', 'almacen')
        .lt('fecha_entrega_estimada', today);

      setStats({
        pedidosActivos: pedidosRes.count || 0,
        ordenesEnProceso: ordenesRes.count || 0,
        ordenesCompletadasHoy: completadasRes.count || 0,
        ordenesRetrasadas: retrasadas || 0,
      });

      setRecentOrdenes((recentRes.data || []) as RecentOrden[]);
    } catch (error) {
      console.error('Error fetching dashboard:', error);
    } finally {
      setLoadingData(false);
    }
  };

  if (authLoading || loadingData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <LayoutDashboard className="w-6 h-6" />
          Dashboard de Producción
        </h1>
        <p className="text-sm text-muted-foreground">Resumen general del flujo de producción</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Pedidos Activos" value={stats.pedidosActivos} icon={<ShoppingCart className="w-5 h-5" />} variant="primary" />
        <StatCard title="Órdenes en Proceso" value={stats.ordenesEnProceso} icon={<KanbanIcon className="w-5 h-5" />} />
        <StatCard title="Completadas Hoy" value={stats.ordenesCompletadasHoy} icon={<CheckCircle2 className="w-5 h-5" />} variant="success" />
        <StatCard title="Retrasadas" value={stats.ordenesRetrasadas} icon={<AlertTriangle className="w-5 h-5" />} variant={stats.ordenesRetrasadas > 0 ? 'danger' : 'default'} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ClipboardList className="w-5 h-5" />
            Órdenes Recientes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentOrdenes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No hay órdenes en proceso</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Orden</TableHead>
                    <TableHead className="hidden sm:table-cell">Cliente</TableHead>
                    <TableHead>Etapa</TableHead>
                    <TableHead className="hidden md:table-cell">Entrega</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentOrdenes.map((o) => (
                    <TableRow key={o.id} className="cursor-pointer" onClick={() => navigate('/produccion/ordenes')}>
                      <TableCell>
                        <span className="font-medium">{o.numero_orden}</span>
                        <span className="block text-xs text-muted-foreground sm:hidden">{(o.pedidos as any)?.cliente}</span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm">{(o.pedidos as any)?.cliente}</TableCell>
                      <TableCell><EtapaBadge etapa={o.etapa_actual} /></TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {o.fecha_entrega_estimada ? format(new Date(o.fecha_entrega_estimada), 'dd MMM yyyy', { locale: es }) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
