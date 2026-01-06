import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet, Search, Check, X, CheckCheck, Trash2, Plus, Banknote, ArrowDownCircle } from 'lucide-react';
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
  const [filterTipo, setFilterTipo] = useState<'todos' | 'avance' | 'anticipo'>('todos');
  
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
  const [obraLimits, setObraLimits] = useState<{ totalObra: number; totalPagado: number; saldoPendiente: number } | null>(null);
  const [aplicarAnticipo, setAplicarAnticipo] = useState(false);
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
      setAnticipos((anticiposRes.data as unknown as AnticipoWithDetails[]) || []);
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

  // When opening approve modal, load available anticipos and obra limits
  const openApproveModal = async (solicitud: SolicitudWithDetails) => {
    setSelectedSolicitud(solicitud);
    const available = anticipos.filter(
      a => a.instalador_id === solicitud.instalador_id && a.obra_id === solicitud.obra_id && a.monto_disponible > 0
    );
    setAvailableAnticipos(available);
    setSelectedAnticipos(new Map());
    setAplicarAnticipo(false);
    
    // Calculate obra limits
    try {
      const [itemsRes, extrasRes, pagosRes] = await Promise.all([
        supabase
          .from('obra_items')
          .select('cantidad, precio_unitario')
          .eq('obra_id', solicitud.obra_id),
        supabase
          .from('extras')
          .select('monto')
          .eq('obra_id', solicitud.obra_id)
          .eq('estado', 'aprobado'),
        supabase
          .from('pagos_destajos')
          .select('monto')
          .eq('obra_id', solicitud.obra_id),
      ]);
      
      const totalItems = (itemsRes.data || []).reduce((sum, item) => 
        sum + (Number(item.cantidad) * Number(item.precio_unitario)), 0);
      const totalExtras = (extrasRes.data || []).reduce((sum, extra) => 
        sum + Number(extra.monto), 0);
      const totalPagado = (pagosRes.data || []).reduce((sum, pago) => 
        sum + Number(pago.monto), 0);
      
      const totalObra = totalItems + totalExtras;
      const saldoPendiente = totalObra - totalPagado;
      
      setObraLimits({ totalObra, totalPagado, saldoPendiente });
    } catch (error) {
      console.error('Error loading obra limits:', error);
      setObraLimits(null);
    }
    
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
    // Calculate max allowed based on obra limits
    const maxAllowedByObra = obraLimits 
      ? Math.max(0, obraLimits.saldoPendiente - Number(selectedSolicitud?.total_solicitado || 0))
      : maxAmount;
    const effectiveMax = Math.min(maxAmount, maxAllowedByObra);
    const validAmount = Math.min(Math.max(0, amount), effectiveMax);
    if (validAmount > 0) {
      newMap.set(anticipoId, validAmount);
    } else {
      newMap.delete(anticipoId);
    }
    setSelectedAnticipos(newMap);
  };

  const totalAnticiposAplicados = aplicarAnticipo 
    ? Array.from(selectedAnticipos.values()).reduce((sum, val) => sum + val, 0)
    : 0;
  
  // Calculate the max anticipo that can be applied without exceeding obra total
  const maxAnticipoAllowed = obraLimits 
    ? Math.max(0, obraLimits.saldoPendiente - Number(selectedSolicitud?.total_solicitado || 0))
    : 0;

  const handleAprobar = async () => {
    if (!selectedSolicitud || !user) return;
    
    // Validate we don't exceed obra total (only for non-anticipo solicitudes)
    const isAnticipo = selectedSolicitud.tipo === 'anticipo';
    const montoSolicitud = Number(selectedSolicitud.total_solicitado);
    
    if (!isAnticipo && obraLimits) {
      const montoAPagar = montoSolicitud - totalAnticiposAplicados;
      if (montoAPagar > obraLimits.saldoPendiente) {
        toast({
          title: 'Error',
          description: `No se puede aprobar. El pago de ${formatCurrency(montoAPagar)} excede el saldo pendiente de ${formatCurrency(obraLimits.saldoPendiente)}`,
          variant: 'destructive',
        });
        return;
      }
    }
    
    try {
      setProcessing(true);
      
      const montoFinal = Math.max(0, montoSolicitud - totalAnticiposAplicados);
      
      const { error: updateError } = await supabase
        .from('solicitudes_pago')
        .update({
          estado: 'aprobada',
          aprobado_por: user.id,
          fecha_aprobacion: new Date().toISOString(),
        })
        .eq('id', selectedSolicitud.id);
      
      if (updateError) throw updateError;
      
      // Create payment record
      const { data: pagoData, error: pagoError } = await supabase
        .from('pagos_destajos')
        .insert({
          obra_id: selectedSolicitud.obra_id,
          instalador_id: selectedSolicitud.instalador_id,
          monto: isAnticipo ? montoSolicitud : montoFinal,
          metodo_pago: 'transferencia',
          solicitud_id: selectedSolicitud.id,
          registrado_por: user.id,
          observaciones: isAnticipo 
            ? `Anticipo - ${selectedSolicitud.observaciones || 'Pago adelantado'}`
            : totalAnticiposAplicados > 0 
              ? `Pago pendiente - Anticipo aplicado: ${formatCurrency(totalAnticiposAplicados)}`
              : `Pago pendiente - Solicitud aprobada`,
        })
        .select()
        .single();
      
      if (pagoError) throw pagoError;
      
      // If this is an anticipo, create the anticipo record with available balance
      if (isAnticipo) {
        const { error: anticipoError } = await supabase
          .from('anticipos')
          .insert({
            obra_id: selectedSolicitud.obra_id,
            instalador_id: selectedSolicitud.instalador_id,
            monto_original: montoSolicitud,
            monto_disponible: montoSolicitud,
            observaciones: selectedSolicitud.observaciones,
            registrado_por: user.id,
          });
        
        if (anticipoError) {
          console.error('Error creating anticipo record:', anticipoError);
        }
      }
      
      // If solicitud has associated extras, approve them automatically
      if (selectedSolicitud.extras_ids && selectedSolicitud.extras_ids.length > 0) {
        const { error: extrasError } = await supabase
          .from('extras')
          .update({
            estado: 'aprobado',
            aprobado_por: user.id,
            fecha_aprobacion: new Date().toISOString(),
          })
          .in('id', selectedSolicitud.extras_ids);
        
        if (extrasError) {
          console.error('Error approving extras:', extrasError);
        }
      }
      
      // If this is an extra type solicitud, approve the extra by matching obra/instalador/monto
      if (selectedSolicitud.tipo === 'extra') {
        const { error: extraError } = await supabase
          .from('extras')
          .update({
            estado: 'aprobado',
            aprobado_por: user.id,
            fecha_aprobacion: new Date().toISOString(),
          })
          .eq('obra_id', selectedSolicitud.obra_id)
          .eq('instalador_id', selectedSolicitud.instalador_id)
          .eq('monto', montoSolicitud)
          .eq('estado', 'pendiente');
        
        if (extraError) {
          console.error('Error approving extra:', extraError);
        }
      }
      
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
        description: isAnticipo
          ? 'Anticipo aprobado. El saldo quedará disponible para descuentos.'
          : totalAnticiposAplicados > 0
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

  // Build breakdown by installer for bulk approval modal
  const instaladorBreakdown = (() => {
    const breakdown = new Map<string, { 
      instalador: Instalador | undefined; 
      total: number; 
      solicitudes: SolicitudWithDetails[];
      obraId: string;
    }>();
    
    for (const sol of selectedSolicitudes) {
      const instalador = instaladores.find(i => i.id === sol.instalador_id);
      const key = sol.instalador_id;
      if (!breakdown.has(key)) {
        breakdown.set(key, { 
          instalador, 
          total: 0, 
          solicitudes: [],
          obraId: sol.obra_id,
        });
      }
      const entry = breakdown.get(key)!;
      entry.total += Number(sol.total_solicitado);
      entry.solicitudes.push(sol);
    }
    
    return Array.from(breakdown.values());
  })();

  const handleAprobarMasivo = async () => {
    if (selectedSolicitudes.length === 0 || !user) return;
    
    try {
      setProcessing(true);
      
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
      
      // Create one single consolidated payment for the grand total
      const grandTotal = selectedSolicitudes.reduce((sum, s) => sum + Number(s.total_solicitado), 0);
      const instaladorNames = [...new Set(selectedSolicitudes.map(s => s.instaladores?.nombre || 'N/A'))].join(', ');
      const obraNames = [...new Set(selectedSolicitudes.map(s => s.obras?.nombre || 'N/A'))].join(', ');
      
      // Use first solicitud's obra_id and instalador_id for the single payment record
      const { error: pagoError } = await supabase
        .from('pagos_destajos')
        .insert({
          obra_id: selectedSolicitudes[0].obra_id,
          instalador_id: selectedSolicitudes[0].instalador_id,
          monto: grandTotal,
          metodo_pago: 'transferencia' as const,
          solicitud_id: selectedSolicitudes[0].id,
          registrado_por: user.id,
          observaciones: `Pago consolidado - ${selectedSolicitudes.length} solicitud(es) - Instaladores: ${instaladorNames} - Obras: ${obraNames}`,
        });
      
      if (pagoError) throw pagoError;
      
      toast({ 
        title: 'Éxito', 
        description: `${selectedSolicitudes.length} solicitudes aprobadas y 1 pago consolidado creado por ${formatCurrency(grandTotal)}` 
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
      
      // Create a solicitud_pago with tipo='anticipo'
      const { error } = await supabase
        .from('solicitudes_pago')
        .insert({
          obra_id: anticipoForm.obra_id,
          instalador_id: anticipoForm.instalador_id,
          tipo: 'anticipo',
          subtotal_piezas: 0,
          subtotal_extras: 0,
          monto_libre: monto,
          total_solicitado: monto,
          retencion: 0,
          observaciones: anticipoForm.observaciones.trim() || 'Anticipo',
          solicitado_por: user?.id,
        });

      if (error) throw error;

      toast({ title: 'Éxito', description: 'Anticipo registrado como solicitud pendiente' });
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

  const filteredSolicitudes = solicitudes.filter((solicitud) => {
    const matchesSearch = 
      solicitud.obras?.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      solicitud.instaladores?.nombre.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesTipo = 
      filterTipo === 'todos' ||
      (filterTipo === 'anticipo' && solicitud.tipo === 'anticipo') ||
      (filterTipo === 'avance' && solicitud.tipo !== 'anticipo');
    
    return matchesSearch && matchesTipo;
  });

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
      key: 'tipo',
      header: 'Tipo',
      cell: (item: SolicitudWithDetails) => (
        item.tipo === 'anticipo' ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
            <ArrowDownCircle className="w-3 h-3" />
            Anticipo
          </span>
        ) : (
          <span className="text-muted-foreground text-sm">Avance</span>
        )
      ),
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

      {/* Search + Filter + Bulk Actions */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <div className="relative max-w-sm w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar solicitudes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex gap-1 p-1 bg-muted rounded-lg">
            <Button
              variant={filterTipo === 'todos' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setFilterTipo('todos')}
              className="text-xs"
            >
              Todos
            </Button>
            <Button
              variant={filterTipo === 'avance' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setFilterTipo('avance')}
              className="text-xs"
            >
              Avances
            </Button>
            <Button
              variant={filterTipo === 'anticipo' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setFilterTipo('anticipo')}
              className="text-xs"
            >
              Anticipos
            </Button>
          </div>
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
          setAplicarAnticipo(false);
          setObraLimits(null);
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
                
                {/* Obra limits info */}
                {obraLimits && (
                  <div className="p-3 rounded-lg bg-muted/50 border text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total obra (items + extras):</span>
                      <span className="font-medium">{formatCurrency(obraLimits.totalObra)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Ya pagado:</span>
                      <span>{formatCurrency(obraLimits.totalPagado)}</span>
                    </div>
                    <div className="flex justify-between border-t pt-1">
                      <span className="text-muted-foreground">Saldo pendiente:</span>
                      <span className="font-semibold">{formatCurrency(obraLimits.saldoPendiente)}</span>
                    </div>
                  </div>
                )}
                
                {/* Option to apply anticipo */}
                {availableAnticipos.length > 0 && selectedSolicitud?.tipo !== 'anticipo' && (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="aplicar-anticipo"
                        checked={aplicarAnticipo}
                        onCheckedChange={(checked) => {
                          setAplicarAnticipo(!!checked);
                          if (!checked) {
                            setSelectedAnticipos(new Map());
                          }
                        }}
                      />
                      <label htmlFor="aplicar-anticipo" className="text-sm font-medium cursor-pointer">
                        Aplicar anticipo a este pago
                      </label>
                    </div>
                    
                    {aplicarAnticipo && (
                      <>
                        {maxAnticipoAllowed <= 0 ? (
                          <div className="p-2 rounded border bg-red-50 border-red-200 text-red-700 text-sm">
                            No se puede aplicar anticipo: el pago de esta solicitud ya cubre o excede el saldo pendiente de la obra.
                          </div>
                        ) : (
                          <>
                            <p className="text-xs text-muted-foreground">
                              Máximo aplicable sin exceder el total de la obra: {formatCurrency(maxAnticipoAllowed)}
                            </p>
                            <div className="space-y-2 max-h-40 overflow-y-auto">
                              {availableAnticipos.map((anticipo) => {
                                const maxForThis = Math.min(anticipo.monto_disponible, maxAnticipoAllowed);
                                return (
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
                                        max={maxForThis}
                                        value={selectedAnticipos.get(anticipo.id) || 0}
                                        onChange={(e) => updateAnticipoAmount(anticipo.id, parseFloat(e.target.value) || 0, maxForThis)}
                                        className="w-24 text-right"
                                      />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </>
                        )}
                        
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
                      </>
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
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Aprobar {selectedIds.size} solicitud(es)?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>Se aprobarán las solicitudes seleccionadas y se creará <strong>un solo pago consolidado</strong>.</p>
                
                {/* Breakdown by installer */}
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  <p className="text-sm font-semibold text-foreground">Desglose por instalador:</p>
                  {instaladorBreakdown.map((item, idx) => (
                    <div key={idx} className="p-3 rounded-lg border bg-muted/30 space-y-1">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-foreground">{item.instalador?.nombre || 'N/A'}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.solicitudes.length} solicitud(es)
                          </p>
                        </div>
                        <span className="font-semibold text-emerald-600">{formatCurrency(item.total)}</span>
                      </div>
                      {item.instalador?.numero_cuenta && (
                        <div className="flex items-center gap-2 pt-1 border-t">
                          <span className="text-xs text-muted-foreground">No. Cuenta:</span>
                          <span className="text-sm font-mono bg-background px-2 py-0.5 rounded">
                            {item.instalador.numero_cuenta}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                
                <div className="pt-2 border-t">
                  <div className="flex justify-between text-base font-semibold">
                    <span>Total a pagar:</span>
                    <span className="text-emerald-600">{formatCurrency(totalSeleccionado)}</span>
                  </div>
                </div>
                
                <p className="text-amber-600 text-xs">Nota: Para aplicar anticipos, apruebe las solicitudes individualmente.</p>
              </div>
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
