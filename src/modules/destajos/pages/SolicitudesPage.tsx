import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet, Search, Check, X, CheckCheck, Trash2, Plus, Banknote } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { PageHeader, DataTable, EmptyState, StatusBadge } from '../components';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import type { SolicitudPago, Obra, Instalador, Anticipo } from '../types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface SolicitudWithDetails extends SolicitudPago {
  obras: { nombre: string } | null;
  instaladores: { nombre: string } | null;
  pagos_destajos: { id: string }[] | null;
}

interface AnticipoWithDetails extends Anticipo {
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
  const [actionType, setActionType] = useState<'aprobar' | 'rechazar' | 'masivo' | 'eliminar' | null>(null);
  const [selectedSolicitud, setSelectedSolicitud] = useState<SolicitudWithDetails | null>(null);
  const [processing, setProcessing] = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState('');
  
  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Anticipo states
  const [isAnticipoModalOpen, setIsAnticipoModalOpen] = useState(false);
  const [obras, setObras] = useState<Obra[]>([]);
  const [instaladores, setInstaladores] = useState<Instalador[]>([]);
  const [anticipos, setAnticipos] = useState<AnticipoWithDetails[]>([]);
  const [anticipoForm, setAnticipoForm] = useState({
    obra_id: '',
    instalador_id: '',
    monto: '',
    observaciones: '',
  });
  const [savingAnticipo, setSavingAnticipo] = useState(false);
  
  // Anticipos selection for approval
  const [selectedAnticipos, setSelectedAnticipos] = useState<Map<string, number>>(new Map());
  const [availableAnticipos, setAvailableAnticipos] = useState<AnticipoWithDetails[]>([]);

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
      const [solicitudesRes, obrasRes, instaladoresRes, anticiposRes] = await Promise.all([
        supabase
          .from('solicitudes_pago')
          .select(`
            *,
            obras(nombre),
            instaladores(nombre),
            pagos_destajos(id)
          `)
          .order('created_at', { ascending: false }),
        supabase.from('obras').select('*').eq('estado', 'activa'),
        supabase.from('instaladores').select('*').eq('activo', true),
        supabase
          .from('anticipos')
          .select(`
            *,
            obras(nombre),
            instaladores(nombre)
          `)
          .gt('monto_disponible', 0)
          .order('created_at', { ascending: false }),
      ]);

      if (solicitudesRes.error) throw solicitudesRes.error;
      if (obrasRes.error) throw obrasRes.error;
      if (instaladoresRes.error) throw instaladoresRes.error;
      if (anticiposRes.error) throw anticiposRes.error;

      setSolicitudes((solicitudesRes.data as SolicitudWithDetails[]) || []);
      setObras((obrasRes.data as Obra[]) || []);
      setInstaladores((instaladoresRes.data as Instalador[]) || []);
      setAnticipos((anticiposRes.data as AnticipoWithDetails[]) || []);
      setSelectedIds(new Set());
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

  const fetchSolicitudes = fetchData;

  const pendingSolicitudes = solicitudes.filter(s => s.estado === 'pendiente');
  const selectedSolicitudes = pendingSolicitudes.filter(s => selectedIds.has(s.id));

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === pendingSolicitudes.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingSolicitudes.map(s => s.id)));
    }
  };

  // When opening approve modal, load available anticipos for that installer/obra
  const openApproveModal = (solicitud: SolicitudWithDetails) => {
    setSelectedSolicitud(solicitud);
    const available = anticipos.filter(
      a => a.instalador_id === solicitud.instalador_id && a.obra_id === solicitud.obra_id && a.monto_disponible > 0
    );
    setAvailableAnticipos(available);
    setSelectedAnticipos(new Map());
    setActionType('aprobar');
  };

  const toggleAnticipoSelection = (anticipo: AnticipoWithDetails, apply: boolean) => {
    const newMap = new Map(selectedAnticipos);
    if (apply) {
      newMap.set(anticipo.id, anticipo.monto_disponible);
    } else {
      newMap.delete(anticipo.id);
    }
    setSelectedAnticipos(newMap);
  };

  const updateAnticipoAmount = (anticipoId: string, amount: number, maxAmount: number) => {
    const newMap = new Map(selectedAnticipos);
    const validAmount = Math.min(Math.max(0, amount), maxAmount);
    if (validAmount > 0) {
      newMap.set(anticipoId, validAmount);
    } else {
      newMap.delete(anticipoId);
    }
    setSelectedAnticipos(newMap);
  };

  const totalAnticiposAplicados = Array.from(selectedAnticipos.values()).reduce((sum, val) => sum + val, 0);

  const handleAprobar = async () => {
    if (!selectedSolicitud || !user) return;
    
    try {
      setProcessing(true);
      
      const montoFinal = Math.max(0, Number(selectedSolicitud.total_solicitado) - totalAnticiposAplicados);
      
      const { error: updateError } = await supabase
        .from('solicitudes_pago')
        .update({
          estado: 'aprobada',
          aprobado_por: user.id,
          fecha_aprobacion: new Date().toISOString(),
        })
        .eq('id', selectedSolicitud.id);
      
      if (updateError) throw updateError;
      
      // Create payment with reduced amount
      const { data: pagoData, error: pagoError } = await supabase
        .from('pagos_destajos')
        .insert({
          obra_id: selectedSolicitud.obra_id,
          instalador_id: selectedSolicitud.instalador_id,
          monto: montoFinal,
          metodo_pago: 'transferencia',
          solicitud_id: selectedSolicitud.id,
          registrado_por: user.id,
          observaciones: totalAnticiposAplicados > 0 
            ? `Pago pendiente - Anticipo aplicado: ${formatCurrency(totalAnticiposAplicados)}`
            : `Pago pendiente - Solicitud aprobada`,
        })
        .select()
        .single();
      
      if (pagoError) throw pagoError;
      
      // Apply anticipos: update monto_disponible and create aplicaciones
      for (const [anticipoId, montoAplicado] of selectedAnticipos) {
        const anticipo = availableAnticipos.find(a => a.id === anticipoId);
        if (!anticipo) continue;
        
        const nuevoDisponible = anticipo.monto_disponible - montoAplicado;
        
        await supabase
          .from('anticipos')
          .update({ monto_disponible: nuevoDisponible })
          .eq('id', anticipoId);
        
        await supabase
          .from('anticipo_aplicaciones')
          .insert({
            anticipo_id: anticipoId,
            pago_id: pagoData.id,
            monto_aplicado: montoAplicado,
          });
      }
      
      toast({ 
        title: 'Éxito', 
        description: totalAnticiposAplicados > 0
          ? `Solicitud aprobada. Anticipo de ${formatCurrency(totalAnticiposAplicados)} aplicado.`
          : 'Solicitud aprobada y pago creado'
      });
      setActionType(null);
      setSelectedSolicitud(null);
      setSelectedAnticipos(new Map());
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

  const handleAprobarMasivo = async () => {
    if (selectedSolicitudes.length === 0 || !user) return;
    
    try {
      setProcessing(true);
      
      // Group by instalador_id + obra_id
      const groups = new Map<string, SolicitudWithDetails[]>();
      for (const sol of selectedSolicitudes) {
        const key = `${sol.instalador_id}-${sol.obra_id}`;
        if (!groups.has(key)) {
          groups.set(key, []);
        }
        groups.get(key)!.push(sol);
      }
      
      // Update all selected solicitudes to approved
      const { error: updateError } = await supabase
        .from('solicitudes_pago')
        .update({
          estado: 'aprobada',
          aprobado_por: user.id,
          fecha_aprobacion: new Date().toISOString(),
        })
        .in('id', Array.from(selectedIds));
      
      if (updateError) throw updateError;
      
      // Create one consolidated payment per group
      const pagosToInsert = Array.from(groups.entries()).map(([_, sols]) => {
        const totalMonto = sols.reduce((sum, s) => sum + Number(s.total_solicitado), 0);
        const solicitudIds = sols.map(s => s.id).join(', ');
        return {
          obra_id: sols[0].obra_id,
          instalador_id: sols[0].instalador_id,
          monto: totalMonto,
          metodo_pago: 'transferencia' as const,
          solicitud_id: sols[0].id,
          registrado_por: user.id,
          observaciones: `Pago consolidado - ${sols.length} solicitud(es): ${solicitudIds}`,
        };
      });
      
      const { error: pagoError } = await supabase
        .from('pagos_destajos')
        .insert(pagosToInsert);
      
      if (pagoError) throw pagoError;
      
      toast({ 
        title: 'Éxito', 
        description: `${selectedSolicitudes.length} solicitudes aprobadas y ${pagosToInsert.length} pago(s) creado(s)` 
      });
      setActionType(null);
      setSelectedIds(new Set());
      fetchSolicitudes();
    } catch (error) {
      console.error('Error bulk approving:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron aprobar las solicitudes',
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
      
      const { error: updateError } = await supabase
        .from('solicitudes_pago')
        .update({
          estado: 'rechazada',
          aprobado_por: user.id,
          fecha_aprobacion: new Date().toISOString(),
          observaciones: motivoRechazo || selectedSolicitud.observaciones,
        })
        .eq('id', selectedSolicitud.id);
      
      if (updateError) throw updateError;
      
      toast({ title: 'Solicitud rechazada', description: 'La solicitud ha sido cancelada' });
      setActionType(null);
      setSelectedSolicitud(null);
      setMotivoRechazo('');
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

  const handleEliminar = async () => {
    if (!selectedSolicitud) return;
    
    try {
      setProcessing(true);
      
      const { error } = await supabase
        .from('solicitudes_pago')
        .delete()
        .eq('id', selectedSolicitud.id);
      
      if (error) throw error;
      
      toast({ title: 'Eliminada', description: 'La solicitud ha sido eliminada' });
      setActionType(null);
      setSelectedSolicitud(null);
      fetchSolicitudes();
    } catch (error) {
      console.error('Error deleting solicitud:', error);
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la solicitud',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleSaveAnticipo = async () => {
    if (!anticipoForm.obra_id || !anticipoForm.instalador_id || !anticipoForm.monto) {
      toast({
        title: 'Error',
        description: 'Obra, instalador y monto son requeridos',
        variant: 'destructive',
      });
      return;
    }

    const monto = parseFloat(anticipoForm.monto);
    if (isNaN(monto) || monto <= 0) {
      toast({
        title: 'Error',
        description: 'El monto debe ser mayor a 0',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSavingAnticipo(true);
      
      const { error } = await supabase
        .from('anticipos')
        .insert({
          obra_id: anticipoForm.obra_id,
          instalador_id: anticipoForm.instalador_id,
          monto_original: monto,
          monto_disponible: monto,
          observaciones: anticipoForm.observaciones.trim() || null,
          registrado_por: user?.id,
        });

      if (error) throw error;

      toast({ title: 'Éxito', description: 'Anticipo registrado correctamente' });
      setIsAnticipoModalOpen(false);
      setAnticipoForm({ obra_id: '', instalador_id: '', monto: '', observaciones: '' });
      fetchData();
    } catch (error) {
      console.error('Error saving anticipo:', error);
      toast({
        title: 'Error',
        description: 'No se pudo registrar el anticipo',
        variant: 'destructive',
      });
    } finally {
      setSavingAnticipo(false);
    }
  };

  const canDeleteSolicitud = (sol: SolicitudWithDetails) => {
    const hasPago = sol.pagos_destajos && sol.pagos_destajos.length > 0;
    const hasAvance = !!sol.avance_id;
    return !hasPago && !hasAvance;
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
      key: 'select',
      header: () => (
        <Checkbox
          checked={pendingSolicitudes.length > 0 && selectedIds.size === pendingSolicitudes.length}
          onCheckedChange={toggleSelectAll}
          aria-label="Seleccionar todas"
        />
      ),
      cell: (item: SolicitudWithDetails) => (
        item.estado === 'pendiente' ? (
          <Checkbox
            checked={selectedIds.has(item.id)}
            onCheckedChange={() => toggleSelection(item.id)}
            aria-label="Seleccionar"
          />
        ) : null
      ),
    },
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
        <div className="flex gap-2">
          {item.estado === 'pendiente' && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                onClick={() => openApproveModal(item)}
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
            </>
          )}
          {canDeleteSolicitud(item) && (
            <Button
              size="sm"
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => {
                setSelectedSolicitud(item);
                setActionType('eliminar');
              }}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
          {!canDeleteSolicitud(item) && item.estado !== 'pendiente' && (
            <span className="text-sm text-muted-foreground">-</span>
          )}
        </div>
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

  const totalSeleccionado = selectedSolicitudes.reduce((sum, s) => sum + Number(s.total_solicitado), 0);
  const totalAnticiposDisponibles = anticipos.reduce((sum, a) => sum + a.monto_disponible, 0);

  return (
    <div>
      <PageHeader
        title="Solicitudes de Pago"
        description="Gestión de solicitudes de pago de instaladores"
        icon={Wallet}
        actions={
          <Button onClick={() => setIsAnticipoModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Anticipo
          </Button>
        }
      />

      {/* Anticipos Summary */}
      {totalAnticiposDisponibles > 0 && (
        <div className="mb-6 p-4 rounded-lg border bg-amber-50 border-amber-200">
          <div className="flex items-center gap-2">
            <Banknote className="w-5 h-5 text-amber-600" />
            <span className="font-medium text-amber-800">
              Anticipos disponibles: {formatCurrency(totalAnticiposDisponibles)}
            </span>
            <span className="text-sm text-amber-600">
              ({anticipos.length} anticipo{anticipos.length !== 1 ? 's' : ''})
            </span>
          </div>
        </div>
      )}

      {/* Search + Bulk Actions */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar solicitudes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {selectedIds.size} seleccionada(s) - {formatCurrency(totalSeleccionado)}
            </span>
            <Button
              onClick={() => setActionType('masivo')}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <CheckCheck className="w-4 h-4 mr-2" />
              Aprobar Seleccionadas
            </Button>
          </div>
        )}
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

      {/* Approve Single Confirmation with Anticipos */}
      <AlertDialog open={actionType === 'aprobar'} onOpenChange={(open) => {
        if (!open) {
          setActionType(null);
          setSelectedAnticipos(new Map());
        }
      }}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Aprobar solicitud</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>
                  Solicitud de pago por <span className="font-semibold">{selectedSolicitud && formatCurrency(Number(selectedSolicitud.total_solicitado))}</span> 
                  {' '}para <span className="font-semibold">{selectedSolicitud?.instaladores?.nombre}</span>.
                </p>
                
                {availableAnticipos.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <p className="text-sm font-medium text-foreground">Anticipos disponibles para aplicar:</p>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {availableAnticipos.map((anticipo) => (
                        <div key={anticipo.id} className="flex items-center gap-3 p-2 rounded border bg-muted/30">
                          <Checkbox
                            checked={selectedAnticipos.has(anticipo.id)}
                            onCheckedChange={(checked) => toggleAnticipoSelection(anticipo, !!checked)}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{anticipo.observaciones || 'Anticipo'}</p>
                            <p className="text-xs text-muted-foreground">
                              Disponible: {formatCurrency(anticipo.monto_disponible)}
                            </p>
                          </div>
                          {selectedAnticipos.has(anticipo.id) && (
                            <Input
                              type="number"
                              min="0"
                              max={anticipo.monto_disponible}
                              value={selectedAnticipos.get(anticipo.id) || 0}
                              onChange={(e) => updateAnticipoAmount(anticipo.id, parseFloat(e.target.value) || 0, anticipo.monto_disponible)}
                              className="w-24 text-right"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                    
                    {totalAnticiposAplicados > 0 && (
                      <div className="pt-2 border-t space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>Total solicitado:</span>
                          <span>{selectedSolicitud && formatCurrency(Number(selectedSolicitud.total_solicitado))}</span>
                        </div>
                        <div className="flex justify-between text-sm text-amber-600">
                          <span>Anticipo aplicado:</span>
                          <span>- {formatCurrency(totalAnticiposAplicados)}</span>
                        </div>
                        <div className="flex justify-between text-sm font-semibold">
                          <span>A pagar:</span>
                          <span>{formatCurrency(Math.max(0, Number(selectedSolicitud?.total_solicitado || 0) - totalAnticiposAplicados))}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
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

      {/* Bulk Approve Confirmation */}
      <AlertDialog open={actionType === 'masivo'} onOpenChange={(open) => !open && setActionType(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Aprobar {selectedIds.size} solicitud(es)?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Se aprobarán las solicitudes seleccionadas y se creará un pago consolidado por instalador/obra.</p>
              <p className="font-semibold">Total: {formatCurrency(totalSeleccionado)}</p>
              <p className="text-amber-600 text-sm">Nota: Para aplicar anticipos, apruebe las solicitudes individualmente.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAprobarMasivo}
              disabled={processing}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {processing ? 'Procesando...' : 'Aprobar Todas'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Confirmation with Reason */}
      <AlertDialog open={actionType === 'rechazar'} onOpenChange={(open) => {
        if (!open) {
          setActionType(null);
          setMotivoRechazo('');
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Rechazar solicitud?</AlertDialogTitle>
            <AlertDialogDescription>
              Se rechazará la solicitud de pago por {selectedSolicitud && formatCurrency(Number(selectedSolicitud.total_solicitado))} 
              para {selectedSolicitud?.instaladores?.nombre}. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Motivo del rechazo (opcional)"
              value={motivoRechazo}
              onChange={(e) => setMotivoRechazo(e.target.value)}
              rows={3}
            />
          </div>
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

      {/* Delete Confirmation */}
      <AlertDialog open={actionType === 'eliminar'} onOpenChange={(open) => !open && setActionType(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar solicitud?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará permanentemente la solicitud de pago por {selectedSolicitud && formatCurrency(Number(selectedSolicitud.total_solicitado))} 
              para {selectedSolicitud?.instaladores?.nombre}. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEliminar}
              disabled={processing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {processing ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Anticipo Modal */}
      <Dialog open={isAnticipoModalOpen} onOpenChange={setIsAnticipoModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Anticipo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="anticipo_obra">Obra *</Label>
              <Select 
                value={anticipoForm.obra_id} 
                onValueChange={(v) => setAnticipoForm(prev => ({ ...prev, obra_id: v }))}
              >
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
              <Label htmlFor="anticipo_instalador">Instalador *</Label>
              <Select 
                value={anticipoForm.instalador_id} 
                onValueChange={(v) => setAnticipoForm(prev => ({ ...prev, instalador_id: v }))}
              >
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
              <Label htmlFor="anticipo_monto">Monto *</Label>
              <Input
                id="anticipo_monto"
                type="number"
                min="0"
                step="0.01"
                value={anticipoForm.monto}
                onChange={(e) => setAnticipoForm(prev => ({ ...prev, monto: e.target.value }))}
                placeholder="0.00"
              />
            </div>
            
            <div>
              <Label htmlFor="anticipo_obs">Observaciones</Label>
              <Textarea
                id="anticipo_obs"
                value={anticipoForm.observaciones}
                onChange={(e) => setAnticipoForm(prev => ({ ...prev, observaciones: e.target.value }))}
                placeholder="Descripción del anticipo..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAnticipoModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveAnticipo} disabled={savingAnticipo}>
              {savingAnticipo ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
