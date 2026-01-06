import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DollarSign, Plus, Search, X, FileText, Download } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { PageHeader, DataTable, EmptyState } from '../components';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import type { Obra, Instalador, PagoDestajo, PaymentMethod } from '../types';
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
  const [obras, setObras] = useState<Obra[]>([]);
  const [instaladores, setInstaladores] = useState<Instalador[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    obra_id: '',
    instalador_id: '',
    monto: '',
    metodo_pago: 'transferencia' as PaymentMethod,
    referencia: '',
    observaciones: '',
    fecha: format(new Date(), 'yyyy-MM-dd'),
  });

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
      
      const [pagosRes, obrasRes, instaladoresRes] = await Promise.all([
        supabase
          .from('pagos_destajos')
          .select(`
            *,
            obras(nombre),
            instaladores(nombre, numero_cuenta)
          `)
          .order('fecha', { ascending: false }),
        supabase.from('obras').select('*').eq('estado', 'activa'),
        supabase.from('instaladores').select('*').eq('activo', true),
      ]);

      if (pagosRes.error) throw pagosRes.error;
      if (obrasRes.error) throw obrasRes.error;
      if (instaladoresRes.error) throw instaladoresRes.error;

      setPagos((pagosRes.data as PagoWithDetails[]) || []);
      setObras((obrasRes.data as Obra[]) || []);
      setInstaladores((instaladoresRes.data as Instalador[]) || []);
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

  const handleSave = async () => {
    if (!formData.obra_id || !formData.instalador_id || !formData.monto) {
      toast({
        title: 'Error',
        description: 'Obra, instalador y monto son requeridos',
        variant: 'destructive',
      });
      return;
    }

    const monto = parseFloat(formData.monto);

    try {
      setSaving(true);
      
      // Validate we don't exceed obra total
      const [itemsRes, extrasRes, pagosRes] = await Promise.all([
        supabase
          .from('obra_items')
          .select('cantidad, precio_unitario')
          .eq('obra_id', formData.obra_id),
        supabase
          .from('extras')
          .select('monto')
          .eq('obra_id', formData.obra_id)
          .eq('estado', 'aprobado'),
        supabase
          .from('pagos_destajos')
          .select('monto')
          .eq('obra_id', formData.obra_id),
      ]);
      
      const totalItems = (itemsRes.data || []).reduce((sum, item) => 
        sum + (Number(item.cantidad) * Number(item.precio_unitario)), 0);
      const totalExtras = (extrasRes.data || []).reduce((sum, extra) => 
        sum + Number(extra.monto), 0);
      const totalPagado = (pagosRes.data || []).reduce((sum, pago) => 
        sum + Number(pago.monto), 0);
      
      const totalObra = totalItems + totalExtras;
      const saldoPendiente = totalObra - totalPagado;
      
      if (monto > saldoPendiente) {
        toast({
          title: 'Error',
          description: `El monto de ${formatCurrency(monto)} excede el saldo pendiente de ${formatCurrency(saldoPendiente)}. Total obra: ${formatCurrency(totalObra)}, Ya pagado: ${formatCurrency(totalPagado)}`,
          variant: 'destructive',
        });
        setSaving(false);
        return;
      }
      
      const pagoData = {
        obra_id: formData.obra_id,
        instalador_id: formData.instalador_id,
        monto: monto,
        metodo_pago: formData.metodo_pago,
        referencia: formData.referencia.trim() || null,
        observaciones: formData.observaciones.trim() || null,
        fecha: formData.fecha,
        registrado_por: user?.id,
      };

      const { error } = await supabase.from('pagos_destajos').insert(pagoData);
      if (error) throw error;

      toast({ title: 'Éxito', description: 'Pago registrado correctamente' });
      setIsModalOpen(false);
      setFormData({
        obra_id: '',
        instalador_id: '',
        monto: '',
        metodo_pago: 'transferencia',
        referencia: '',
        observaciones: '',
        fecha: format(new Date(), 'yyyy-MM-dd'),
      });
      fetchData();
    } catch (error) {
      console.error('Error saving pago:', error);
      toast({
        title: 'Error',
        description: 'No se pudo guardar el pago',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
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
        // First, get the linked solicitud to find its approval timestamp
        const { data: linkedSolicitud } = await supabase
          .from('solicitudes_pago')
          .select('fecha_aprobacion, obra_id, instalador_id, extras_ids')
          .eq('id', pagoToCancel.solicitud_id)
          .single();

        let solicitudesToRevert: { id: string; extras_ids: string[] | null }[] = [];

        if (linkedSolicitud?.fecha_aprobacion) {
          // Find all solicitudes approved at the same timestamp (consolidated payment)
          const { data: allSolicitudes, error: fetchError } = await supabase
            .from('solicitudes_pago')
            .select('id, extras_ids')
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
          solicitudesToRevert = [{ id: pagoToCancel.solicitud_id, extras_ids: linkedSolicitud?.extras_ids || null }];

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
        actions={
          isAdmin && (
            <Button onClick={() => setIsModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Pago
            </Button>
          )
        }
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
            description="No hay pagos registrados"
            action={
              isAdmin && (
                <Button onClick={() => setIsModalOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Nuevo Pago
                </Button>
              )
            }
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

      {/* Create Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo Pago</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="obra_id">Obra *</Label>
              <Select value={formData.obra_id} onValueChange={(value) => setFormData({ ...formData, obra_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar obra" />
                </SelectTrigger>
                <SelectContent>
                  {obras.map((obra) => (
                    <SelectItem key={obra.id} value={obra.id}>
                      {obra.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="instalador_id">Instalador *</Label>
              <Select value={formData.instalador_id} onValueChange={(value) => setFormData({ ...formData, instalador_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar instalador" />
                </SelectTrigger>
                <SelectContent>
                  {instaladores.map((instalador) => (
                    <SelectItem key={instalador.id} value={instalador.id}>
                      {instalador.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="monto">Monto *</Label>
              <Input
                id="monto"
                type="number"
                min="0"
                step="0.01"
                value={formData.monto}
                onChange={(e) => setFormData({ ...formData, monto: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label htmlFor="metodo_pago">Método de Pago</Label>
              <Select value={formData.metodo_pago} onValueChange={(value: PaymentMethod) => setFormData({ ...formData, metodo_pago: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="transferencia">Transferencia</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="fecha">Fecha</Label>
              <Input
                id="fecha"
                type="date"
                value={formData.fecha}
                onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="referencia">Referencia</Label>
              <Input
                id="referencia"
                value={formData.referencia}
                onChange={(e) => setFormData({ ...formData, referencia: e.target.value })}
                placeholder="Número de referencia"
              />
            </div>
            <div>
              <Label htmlFor="observaciones">Observaciones</Label>
              <Textarea
                id="observaciones"
                value={formData.observaciones}
                onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                placeholder="Notas adicionales..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
