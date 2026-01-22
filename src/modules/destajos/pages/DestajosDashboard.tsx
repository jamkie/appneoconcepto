import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Building2, 
  Users, 
  DollarSign,
  Wallet,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader, StatCard, DataTable, EmptyState, StatusBadge } from '../components';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface DashboardStats {
  obrasActivas: number;
  instaladoresActivos: number;
  totalPagado: number;
  totalPorPagar: number;
}

interface RecentCorte {
  id: string;
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado: string;
  total_monto: number;
  total_solicitudes: number;
}

export default function DestajosDashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    obrasActivas: 0,
    instaladoresActivos: 0,
    totalPagado: 0,
    totalPorPagar: 0,
  });
  const [recentCortes, setRecentCortes] = useState<RecentCorte[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      setLoadingData(true);

      // Fetch obras activas
      const { count: obrasCount } = await supabase
        .from('obras')
        .select('*', { count: 'exact', head: true })
        .eq('estado', 'activa');

      // Fetch instaladores activos
      const { count: instaladoresCount } = await supabase
        .from('instaladores')
        .select('*', { count: 'exact', head: true })
        .eq('activo', true);

      // Fetch total pagado (all payments)
      const { data: pagosData } = await supabase
        .from('pagos_destajos')
        .select('monto');

      const totalPagado = pagosData?.reduce((sum, p) => sum + Number(p.monto), 0) || 0;

      // Calculate total por pagar from active obras
      // Get all active obras
      const { data: obrasActivas } = await supabase
        .from('obras')
        .select('id, descuento')
        .eq('estado', 'activa');

      // Get all obra_items
      const { data: obraItems } = await supabase
        .from('obra_items')
        .select('obra_id, cantidad, precio_unitario');

      // Get all approved extras
      const { data: extras } = await supabase
        .from('extras')
        .select('obra_id, monto, descuento')
        .eq('estado', 'aprobado');

      // Get all payments per obra
      const { data: pagosPorObra } = await supabase
        .from('pagos_destajos')
        .select('obra_id, monto');

      // Calculate pending balance for each active obra
      let totalPorPagar = 0;
      (obrasActivas || []).forEach((obra) => {
        // Subtotal items
        const subtotalItems = (obraItems || [])
          .filter((item) => item.obra_id === obra.id)
          .reduce((sum, item) => sum + (item.cantidad * Number(item.precio_unitario)), 0);

        // Subtotal extras (with individual discount)
        const subtotalExtras = (extras || [])
          .filter((e) => e.obra_id === obra.id)
          .reduce((sum, e) => sum + (Number(e.monto) * (1 - (e.descuento || 0) / 100)), 0);

        // Total with obra discount
        const subtotal = subtotalItems + subtotalExtras;
        const montoTotal = subtotal * (1 - (obra.descuento || 0) / 100);

        // Total paid for this obra
        const pagadoObra = (pagosPorObra || [])
          .filter((p) => p.obra_id === obra.id)
          .reduce((sum, p) => sum + Number(p.monto), 0);

        // Add pending balance
        totalPorPagar += Math.max(0, montoTotal - pagadoObra);
      });

      setStats({
        obrasActivas: obrasCount || 0,
        instaladoresActivos: instaladoresCount || 0,
        totalPagado,
        totalPorPagar,
      });

      // Fetch recent cortes with aggregated data
      const { data: cortesData } = await supabase
        .from('cortes_semanales')
        .select(`
          id,
          nombre,
          fecha_inicio,
          fecha_fin,
          estado
        `)
        .order('created_at', { ascending: false })
        .limit(5);

      if (cortesData) {
        // Fetch solicitudes for each corte to calculate totals
        const cortesWithTotals = await Promise.all(
          cortesData.map(async (corte) => {
            const { data: solicitudes } = await supabase
              .from('solicitudes_pago')
              .select('total_solicitado')
              .eq('corte_id', corte.id);

            const totalMonto = solicitudes?.reduce((sum, s) => sum + Number(s.total_solicitado), 0) || 0;
            const totalSolicitudes = solicitudes?.length || 0;

            return {
              ...corte,
              total_monto: totalMonto,
              total_solicitudes: totalSolicitudes,
            };
          })
        );

        setRecentCortes(cortesWithTotals);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoadingData(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(amount);
  };

  if (loading || loadingData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const columns = [
    {
      key: 'nombre',
      header: 'Nombre',
      cell: (item: RecentCorte) => (
        <span className="font-medium">{item.nombre}</span>
      ),
    },
    {
      key: 'periodo',
      header: 'Período',
      cell: (item: RecentCorte) => (
        <span className="text-sm text-muted-foreground">
          {format(new Date(item.fecha_inicio), 'dd MMM', { locale: es })} - {format(new Date(item.fecha_fin), 'dd MMM', { locale: es })}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: 'solicitudes',
      header: 'Solicitudes',
      cell: (item: RecentCorte) => item.total_solicitudes,
    },
    {
      key: 'monto',
      header: 'Monto',
      cell: (item: RecentCorte) => formatCurrency(item.total_monto),
    },
    {
      key: 'estado',
      header: 'Estado',
      cell: (item: RecentCorte) => (
        <StatusBadge 
          status={item.estado === 'cerrado' ? 'pagada' : 'pendiente'} 
        />
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Resumen general del control de destajos"
        icon={LayoutDashboard}
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Obras Activas"
          value={stats.obrasActivas}
          icon={<Building2 className="w-5 h-5" />}
          variant="primary"
        />
        <StatCard
          title="Instaladores"
          value={stats.instaladoresActivos}
          icon={<Users className="w-5 h-5" />}
        />
        <StatCard
          title="Total Pagado"
          value={formatCurrency(stats.totalPagado)}
          icon={<DollarSign className="w-5 h-5" />}
          variant="success"
        />
        <StatCard
          title="Por Pagar"
          value={formatCurrency(stats.totalPorPagar)}
          icon={<Wallet className="w-5 h-5" />}
          variant={stats.totalPorPagar > 0 ? 'warning' : 'default'}
        />
      </div>

      {/* Recent Cortes */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Cortes Recientes
        </h2>
        <DataTable
          columns={columns}
          data={recentCortes}
          keyExtractor={(item) => item.id}
          onRowClick={(item) => navigate(`/destajos/cortes`)}
          emptyState={
            <EmptyState
              icon={AlertCircle}
              title="Sin cortes"
              description="No hay cortes semanales registrados"
            />
          }
        />
      </div>
    </div>
  );
}
