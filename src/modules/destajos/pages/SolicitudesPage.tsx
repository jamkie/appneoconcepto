import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet, Search, Check, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { PageHeader, DataTable, EmptyState, StatusBadge } from '../components';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { SolicitudPago } from '../types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface SolicitudWithDetails extends SolicitudPago {
  obras: { nombre: string } | null;
  instaladores: { nombre: string } | null;
}

export default function SolicitudesPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [solicitudes, setSolicitudes] = useState<SolicitudWithDetails[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Action states
  const [actionType, setActionType] = useState<'aprobar' | 'rechazar' | null>(null);
  const [selectedSolicitud, setSelectedSolicitud] = useState<SolicitudWithDetails | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchSolicitudes();
    }
  }, [user]);

  const fetchSolicitudes = async () => {
    try {
      setLoadingData(true);
      const { data, error } = await supabase
        .from('solicitudes_pago')
        .select(`
          *,
          obras(nombre),
          instaladores(nombre)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSolicitudes((data as SolicitudWithDetails[]) || []);
    } catch (error) {
      console.error('Error fetching solicitudes:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las solicitudes',
        variant: 'destructive',
      });
    } finally {
      setLoadingData(false);
    }
  };

  const handleAprobar = async () => {
    if (!selectedSolicitud || !user) return;
    
    try {
      setProcessing(true);
      
      // Update solicitud status to approved
      const { error: updateError } = await supabase
        .from('solicitudes_pago')
        .update({
          estado: 'aprobada',
          aprobado_por: user.id,
          fecha_aprobacion: new Date().toISOString(),
        })
        .eq('id', selectedSolicitud.id);
      
      if (updateError) throw updateError;
      
      // Create payment record with "pendiente" status (transferencia as default, will be updated when paid)
      const { error: pagoError } = await supabase
        .from('pagos_destajos')
        .insert({
          obra_id: selectedSolicitud.obra_id,
          instalador_id: selectedSolicitud.instalador_id,
          monto: selectedSolicitud.total_solicitado,
          metodo_pago: 'transferencia',
          solicitud_id: selectedSolicitud.id,
          registrado_por: user.id,
          observaciones: `Pago pendiente - Solicitud aprobada`,
        });
      
      if (pagoError) throw pagoError;
      
      toast({ title: 'Éxito', description: 'Solicitud aprobada y pago creado' });
      setActionType(null);
      setSelectedSolicitud(null);
      fetchSolicitudes();
    } catch (error) {
      console.error('Error approving solicitud:', error);
      toast({
        title: 'Error',
        description: 'No se pudo aprobar la solicitud',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleRechazar = async () => {
    if (!selectedSolicitud || !user) return;
    
    try {
      setProcessing(true);
      
      // Update solicitud status to rejected
      const { error: updateError } = await supabase
        .from('solicitudes_pago')
        .update({
          estado: 'rechazada',
          aprobado_por: user.id,
          fecha_aprobacion: new Date().toISOString(),
        })
        .eq('id', selectedSolicitud.id);
      
      if (updateError) throw updateError;
      
      toast({ title: 'Solicitud rechazada', description: 'La solicitud ha sido cancelada' });
      setActionType(null);
      setSelectedSolicitud(null);
      fetchSolicitudes();
    } catch (error) {
      console.error('Error rejecting solicitud:', error);
      toast({
        title: 'Error',
        description: 'No se pudo rechazar la solicitud',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(amount);
  };

  const filteredSolicitudes = solicitudes.filter((solicitud) =>
    solicitud.obras?.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    solicitud.instaladores?.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const columns = [
    {
      key: 'fecha',
      header: 'Fecha',
      cell: (item: SolicitudWithDetails) => format(new Date(item.created_at), 'dd/MM/yyyy', { locale: es }),
    },
    {
      key: 'obra',
      header: 'Obra',
      cell: (item: SolicitudWithDetails) => <span className="font-medium">{item.obras?.nombre || 'N/A'}</span>,
    },
    {
      key: 'instalador',
      header: 'Instalador',
      cell: (item: SolicitudWithDetails) => item.instaladores?.nombre || 'N/A',
      hideOnMobile: true,
    },
    {
      key: 'total',
      header: 'Total',
      cell: (item: SolicitudWithDetails) => formatCurrency(Number(item.total_solicitado)),
    },
    {
      key: 'estado',
      header: 'Estado',
      cell: (item: SolicitudWithDetails) => <StatusBadge status={item.estado} />,
    },
    {
      key: 'acciones',
      header: 'Acciones',
      cell: (item: SolicitudWithDetails) => (
        item.estado === 'pendiente' ? (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"
              onClick={() => {
                setSelectedSolicitud(item);
                setActionType('aprobar');
              }}
            >
              <Check className="w-4 h-4 mr-1" />
              Aprobar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => {
                setSelectedSolicitud(item);
                setActionType('rechazar');
              }}
            >
              <X className="w-4 h-4 mr-1" />
              Rechazar
            </Button>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">-</span>
        )
      ),
    },
  ];

  if (loading || loadingData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Solicitudes de Pago"
        description="Gestión de solicitudes de pago de instaladores"
        icon={Wallet}
      />

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar solicitudes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filteredSolicitudes}
        keyExtractor={(item) => item.id}
        emptyState={
          <EmptyState
            icon={Wallet}
            title="Sin solicitudes"
            description="No hay solicitudes de pago registradas"
          />
        }
      />

      {/* Approve Confirmation */}
      <AlertDialog open={actionType === 'aprobar'} onOpenChange={(open) => !open && setActionType(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Aprobar solicitud?</AlertDialogTitle>
            <AlertDialogDescription>
              Se aprobará la solicitud de pago por {selectedSolicitud && formatCurrency(Number(selectedSolicitud.total_solicitado))} 
              para {selectedSolicitud?.instaladores?.nombre}. Se creará un registro de pago pendiente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAprobar}
              disabled={processing}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {processing ? 'Procesando...' : 'Aprobar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Confirmation */}
      <AlertDialog open={actionType === 'rechazar'} onOpenChange={(open) => !open && setActionType(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Rechazar solicitud?</AlertDialogTitle>
            <AlertDialogDescription>
              Se rechazará la solicitud de pago por {selectedSolicitud && formatCurrency(Number(selectedSolicitud.total_solicitado))} 
              para {selectedSolicitud?.instaladores?.nombre}. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRechazar}
              disabled={processing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {processing ? 'Procesando...' : 'Rechazar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
