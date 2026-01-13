import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DollarSign, Search, X, FileText, Download } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { PageHeader, DataTable, EmptyState } from '../components';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import type { PagoDestajo, PaymentMethod } from '../types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useUserRole } from '@/hooks/useUserRole';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface PagoWithDetails extends PagoDestajo {
  obras: { nombre: string } | null;
  instaladores: { nombre: string; numero_cuenta: string | null } | null;
}

const paymentMethodLabels: Record<PaymentMethod, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  cheque: 'Cheque',
  otro: 'Otro',
};

export default function PagosPage() {
  const { user, loading } = useAuth();
  const { isAdmin } = useUserRole();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [pagos, setPagos] = useState<PagoWithDetails[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Cancel payment state
  const [pagoToCancel, setPagoToCancel] = useState<PagoWithDetails | null>(null);
  const [cancelling, setCancelling] = useState(false);
  
  // View payment detail state
  const [selectedPago, setSelectedPago] = useState<PagoWithDetails | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      setLoadingData(true);
      
      const { data, error } = await supabase
        .from('pagos_destajos')
        .select(`
          *,
          obras(nombre),
          instaladores(nombre, numero_cuenta)
        `)
        .order('fecha', { ascending: false });

      if (error) throw error;

      setPagos((data as PagoWithDetails[]) || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los datos',
        variant: 'destructive',
      });
    } finally {
      setLoadingData(false);
    }
  };

  const handleCancelPago = async () => {
    if (!pagoToCancel) return;

    try {
      setCancelling(true);

      // Find all solicitudes that should be reverted to pendiente
      // For consolidated payments, we need to find all solicitudes approved around the same time
      // for the same obra/instalador combination mentioned in the observaciones
      if (pagoToCancel.solicitud_id) {
        // First, get the linked solicitud to find its approval timestamp and type
        const { data: linkedSolicitud } = await supabase
          .from('solicitudes_pago')
          .select('fecha_aprobacion, obra_id, instalador_id, extras_ids, tipo')
          .eq('id', pagoToCancel.solicitud_id)
          .single();

        let solicitudesToRevert: { id: string; extras_ids: string[] | null; tipo: string }[] = [];

        if (linkedSolicitud?.fecha_aprobacion) {
          // Find all solicitudes approved at the same timestamp (consolidated payment)
          const { data: allSolicitudes, error: fetchError } = await supabase
            .from('solicitudes_pago')
            .select('id, extras_ids, tipo')
            .eq('fecha_aprobacion', linkedSolicitud.fecha_aprobacion)
            .eq('estado', 'aprobada');

          if (fetchError) throw fetchError;
          solicitudesToRevert = allSolicitudes || [];

          // Update all solicitudes back to pendiente
          const { error: updateError } = await supabase
            .from('solicitudes_pago')
            .update({
              estado: 'pendiente',
              aprobado_por: null,
              fecha_aprobacion: null,
            })
            .eq('fecha_aprobacion', linkedSolicitud.fecha_aprobacion)
            .eq('estado', 'aprobada');

          if (updateError) throw updateError;
        } else {
          // Fallback: just update the single linked solicitud
          solicitudesToRevert = [{ 
            id: pagoToCancel.solicitud_id, 
            extras_ids: linkedSolicitud?.extras_ids || null,
            tipo: linkedSolicitud?.tipo || ''
          }];

          const { error: updateError } = await supabase
            .from('solicitudes_pago')
            .update({
              estado: 'pendiente',
              aprobado_por: null,
              fecha_aprobacion: null,
            })
            .eq('id', pagoToCancel.solicitud_id);

          if (updateError) throw updateError;
        }

        // Revert all extras from these solicitudes back to pendiente
        const allExtrasIds = solicitudesToRevert
          .flatMap(s => s.extras_ids || [])
          .filter(Boolean);

        if (allExtrasIds.length > 0) {
          const { error: extrasError } = await supabase
            .from('extras')
            .update({
              estado: 'pendiente',
              aprobado_por: null,
              fecha_aprobacion: null,
            })
            .in('id', allExtrasIds);

          if (extrasError) throw extrasError;
        }

        // If any of the solicitudes are anticipos, delete the corresponding anticipo records
        const anticipoSolicitudes = solicitudesToRevert.filter(s => s.tipo === 'anticipo');
        if (anticipoSolicitudes.length > 0 && linkedSolicitud) {
          // Delete anticipos that were created for these solicitudes
          // We match by obra_id, instalador_id and approximate creation time
          const { error: anticipoDeleteError } = await supabase
            .from('anticipos')
            .delete()
            .eq('obra_id', linkedSolicitud.obra_id)
            .eq('instalador_id', linkedSolicitud.instalador_id)
            .eq('monto_original', pagoToCancel.monto);

          if (anticipoDeleteError) {
            console.error('Error deleting anticipo:', anticipoDeleteError);
          }
        }
      }

      // Delete the payment
      const { error: deleteError } = await supabase
        .from('pagos_destajos')
        .delete()
        .eq('id', pagoToCancel.id);

      if (deleteError) throw deleteError;

      toast({ title: 'Pago cancelado', description: 'El pago ha sido eliminado y las solicitudes vuelven a estar pendientes' });
      setPagoToCancel(null);
      fetchData();
    } catch (error) {
      console.error('Error cancelling pago:', error);
      toast({
        title: 'Error',
        description: 'No se pudo cancelar el pago',
        variant: 'destructive',
      });
    } finally {
      setCancelling(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(amount);
  };

  const generatePDF = () => {
    if (!selectedPago) return;
    
    const content = `
COMPROBANTE DE PAGO
===================

Fecha: ${format(new Date(selectedPago.fecha), "dd 'de' MMMM 'de' yyyy", { locale: es })}
Folio: ${selectedPago.id.slice(0, 8).toUpperCase()}

DATOS DEL PAGO
--------------
Monto: ${formatCurrency(Number(selectedPago.monto))}
Método de Pago: ${paymentMethodLabels[selectedPago.metodo_pago]}
${selectedPago.referencia ? `Referencia: ${selectedPago.referencia}` : ''}

INSTALADOR
----------
Nombre: ${selectedPago.instaladores?.nombre || 'N/A'}
No. Cuenta: ${selectedPago.instaladores?.numero_cuenta || 'No registrada'}

OBRA
----
Nombre: ${selectedPago.obras?.nombre || 'N/A'}

${selectedPago.observaciones ? `OBSERVACIONES\n-------------\n${selectedPago.observaciones}` : ''}

---
Documento generado el ${format(new Date(), "dd/MM/yyyy 'a las' HH:mm", { locale: es })}
    `.trim();
    
    // Create blob and download
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pago_${selectedPago.id.slice(0, 8)}_${format(new Date(selectedPago.fecha), 'yyyyMMdd')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({ title: 'Archivo generado', description: 'El comprobante se ha descargado' });
  };

  const filteredPagos = pagos.filter((pago) =>
    pago.obras?.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pago.instaladores?.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const columns = [
    {
      key: 'fecha',
      header: 'Fecha',
      cell: (item: PagoWithDetails) => format(new Date(item.fecha), 'dd/MM/yyyy', { locale: es }),
    },
    {
      key: 'obra',
      header: 'Obra',
      cell: (item: PagoWithDetails) => <span className="font-medium">{item.obras?.nombre || 'N/A'}</span>,
    },
    {
      key: 'instalador',
      header: 'Instalador',
      cell: (item: PagoWithDetails) => item.instaladores?.nombre || 'N/A',
      hideOnMobile: true,
    },
    {
      key: 'monto',
      header: 'Monto',
      cell: (item: PagoWithDetails) => (
        <span className="font-semibold text-green-600">{formatCurrency(Number(item.monto))}</span>
      ),
    },
    {
      key: 'metodo',
      header: 'Método',
      cell: (item: PagoWithDetails) => (
        <Badge variant="outline">{paymentMethodLabels[item.metodo_pago]}</Badge>
      ),
      hideOnMobile: true,
    },
    ...(isAdmin ? [{
      key: 'acciones',
      header: 'Acciones',
      cell: (item: PagoWithDetails) => (
        <Button
          size="sm"
          variant="outline"
          className="text-red-600 border-red-200 hover:bg-red-50"
          onClick={(e) => {
            e.stopPropagation();
            setPagoToCancel(item);
          }}
        >
          <X className="w-4 h-4 mr-1" />
          Cancelar
        </Button>
      ),
    }] : []),
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
        title="Pagos"
        description="Registro de pagos a instaladores"
        icon={DollarSign}
      />

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar pagos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filteredPagos}
        keyExtractor={(item) => item.id}
        onRowClick={(item) => setSelectedPago(item)}
        emptyState={
          <EmptyState
            icon={DollarSign}
            title="Sin pagos"
            description="No hay pagos registrados. Los pagos se crean desde Solicitudes."
          />
        }
      />

      {/* Cancel Payment Confirmation */}
      <AlertDialog open={!!pagoToCancel} onOpenChange={(open) => !open && setPagoToCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar pago?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará el pago de {pagoToCancel && formatCurrency(Number(pagoToCancel.monto))} 
              para {pagoToCancel?.instaladores?.nombre}.
              {pagoToCancel?.solicitud_id && ' La solicitud asociada volverá a estado pendiente.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, mantener</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelPago}
              disabled={cancelling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelling ? 'Cancelando...' : 'Sí, cancelar pago'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Payment Detail Modal */}
      <Dialog open={!!selectedPago} onOpenChange={(open) => !open && setSelectedPago(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Detalle de Pago
            </DialogTitle>
          </DialogHeader>
          
          {selectedPago && (
            <div className="space-y-4">
              {/* Payment Amount */}
              <div className="text-center p-4 rounded-lg bg-emerald-50 border border-emerald-200">
                <p className="text-sm text-muted-foreground">Monto del Pago</p>
                <p className="text-3xl font-bold text-emerald-600">
                  {formatCurrency(Number(selectedPago.monto))}
                </p>
              </div>
              
              <Separator />
              
              {/* Installer Info */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Instalador</h4>
                <div className="p-3 rounded-lg border bg-muted/30">
                  <p className="font-medium text-lg">{selectedPago.instaladores?.nombre || 'N/A'}</p>
                  {selectedPago.instaladores?.numero_cuenta ? (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-sm text-muted-foreground">No. Cuenta:</span>
                      <span className="font-mono bg-background px-2 py-1 rounded text-sm">
                        {selectedPago.instaladores.numero_cuenta}
                      </span>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-1">Sin número de cuenta registrado</p>
                  )}
                </div>
              </div>
              
              {/* Payment Details */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Información del Pago</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Fecha</p>
                    <p className="font-medium">{format(new Date(selectedPago.fecha), "dd 'de' MMMM, yyyy", { locale: es })}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Método</p>
                    <Badge variant="outline">{paymentMethodLabels[selectedPago.metodo_pago]}</Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Obra</p>
                    <p className="font-medium">{selectedPago.obras?.nombre || 'N/A'}</p>
                  </div>
                  {selectedPago.referencia && (
                    <div>
                      <p className="text-muted-foreground">Referencia</p>
                      <p className="font-medium font-mono">{selectedPago.referencia}</p>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Observations */}
              {selectedPago.observaciones && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Observaciones</h4>
                  <p className="text-sm p-3 rounded-lg bg-muted/30 border">{selectedPago.observaciones}</p>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSelectedPago(null)}>
              Cerrar
            </Button>
            <Button onClick={generatePDF} className="gap-2">
              <Download className="w-4 h-4" />
              Descargar Comprobante
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
