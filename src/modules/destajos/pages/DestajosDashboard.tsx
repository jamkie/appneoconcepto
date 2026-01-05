import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Building2, 
  Users, 
  Wallet, 
  DollarSign,
  ClipboardList,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader, StatCard, DataTable, EmptyState, StatusBadge } from '../components';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface DashboardStats {
  obrasActivas: number;
  instaladoresActivos: number;
  solicitudesPendientes: number;
  totalPagado: number;
}

interface RecentSolicitud {
  id: string;
  total_solicitado: number;
  estado: string;
  created_at: string;
  obras: { nombre: string } | null;
  instaladores: { nombre: string } | null;
}

export default function DestajosDashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    obrasActivas: 0,
    instaladoresActivos: 0,
    solicitudesPendientes: 0,
    totalPagado: 0,
  });
  const [recentSolicitudes, setRecentSolicitudes] = useState<RecentSolicitud[]>([]);
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

      // Fetch solicitudes pendientes
      const { count: solicitudesCount } = await supabase
        .from('solicitudes_pago')
        .select('*', { count: 'exact', head: true })
        .eq('estado', 'pendiente');

      // Fetch total pagado
      const { data: pagosData } = await supabase
        .from('pagos_destajos')
        .select('monto');

      const totalPagado = pagosData?.reduce((sum, p) => sum + Number(p.monto), 0) || 0;

      setStats({
        obrasActivas: obrasCount || 0,
        instaladoresActivos: instaladoresCount || 0,
        solicitudesPendientes: solicitudesCount || 0,
        totalPagado,
      });

      // Fetch recent solicitudes
      const { data: solicitudesData } = await supabase
        .from('solicitudes_pago')
        .select(`
          id,
          total_solicitado,
          estado,
          created_at,
          obras(nombre),
          instaladores(nombre)
        `)
        .order('created_at', { ascending: false })
        .limit(5);

      setRecentSolicitudes((solicitudesData as RecentSolicitud[]) || []);
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
      key: 'obra',
      header: 'Obra',
      cell: (item: RecentSolicitud) => (
        <span className="font-medium">{item.obras?.nombre || 'N/A'}</span>
      ),
    },
    {
      key: 'instalador',
      header: 'Instalador',
      cell: (item: RecentSolicitud) => item.instaladores?.nombre || 'N/A',
      hideOnMobile: true,
    },
    {
      key: 'monto',
      header: 'Monto',
      cell: (item: RecentSolicitud) => formatCurrency(Number(item.total_solicitado)),
    },
    {
      key: 'estado',
      header: 'Estado',
      cell: (item: RecentSolicitud) => <StatusBadge status={item.estado} />,
    },
    {
      key: 'fecha',
      header: 'Fecha',
      cell: (item: RecentSolicitud) => (
        <span className="text-muted-foreground text-sm">
          {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: es })}
        </span>
      ),
      hideOnMobile: true,
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
          title="Solicitudes Pendientes"
          value={stats.solicitudesPendientes}
          icon={<Wallet className="w-5 h-5" />}
          variant={stats.solicitudesPendientes > 0 ? 'warning' : 'default'}
        />
        <StatCard
          title="Total Pagado"
          value={formatCurrency(stats.totalPagado)}
          icon={<DollarSign className="w-5 h-5" />}
          variant="success"
        />
      </div>

      {/* Recent Solicitudes */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <ClipboardList className="w-5 h-5" />
          Solicitudes Recientes
        </h2>
        <DataTable
          columns={columns}
          data={recentSolicitudes}
          keyExtractor={(item) => item.id}
          onRowClick={(item) => navigate(`/destajos/solicitudes`)}
          emptyState={
            <EmptyState
              icon={AlertCircle}
              title="Sin solicitudes"
              description="No hay solicitudes de pago registradas"
            />
          }
        />
      </div>
    </div>
  );
}
