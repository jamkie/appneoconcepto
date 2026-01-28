import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Wallet, Search, Check, X, Trash2, Banknote, ArrowDownCircle, Eye, Pencil, CheckCircle2 } from 'lucide-react';
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
import { useSubmodulePermissions } from '@/hooks/useSubmodulePermissions';

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
  const { canCreate, canUpdate, canDelete } = useSubmodulePermissions('destajos', 'solicitudes');
  const { canCreate: canCreateAnticipo } = useSubmodulePermissions('destajos', 'anticipos');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const [solicitudes, setSolicitudes] = useState<SolicitudWithDetails[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTipo, setFilterTipo] = useState<'todos' | 'avance' | 'anticipo' | 'extra'>('todos');
  
  // Bulk selection states
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [processingBulk, setProcessingBulk] = useState(false);
  
  // Action states
  const [actionType, setActionType] = useState<'aprobar' | 'rechazar' | 'eliminar' | null>(null);
  const [selectedSolicitud, setSelectedSolicitud] = useState<SolicitudWithDetails | null>(null);
  const [processing, setProcessing] = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState('');
  
  // Anticipo application states
  const [showAplicarAnticipoDialog, setShowAplicarAnticipoDialog] = useState(false);
  const [solicitudParaAprobar, setSolicitudParaAprobar] = useState<SolicitudWithDetails | null>(null);
  const [anticiposDisponibles, setAnticiposDisponibles] = useState<AnticipoWithDetails[]>([]);
  const [anticiposSeleccionados, setAnticiposSeleccionados] = useState<{[key: string]: number}>({});
  
  
  
  // View detail state
  const [viewingSolicitud, setViewingSolicitud] = useState<SolicitudWithDetails | null>(null);
  const [avanceItems, setAvanceItems] = useState<{ descripcion: string; cantidad: number; precio: number }[]>([]);
  const [extrasInfo, setExtrasInfo] = useState<{ descripcion: string; monto: number }[]>([]);
  
  // Delete from detail dialog states
  const [confirmDeleteType, setConfirmDeleteType] = useState<'avance' | 'extra' | null>(null);
  const [deletingFromDetail, setDeletingFromDetail] = useState(false);
  
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
  
  // View anticipos modal
  const [showAnticiposModal, setShowAnticiposModal] = useState(false);


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

  // Handle deep link for creating anticipo from obras modal
  useEffect(() => {
    const obraId = searchParams.get('anticipo_obra');
    if (obraId && obras.length > 0 && !loadingData && canCreateAnticipo) {
      setAnticipoForm(prev => ({ ...prev, obra_id: obraId }));
      setIsAnticipoModalOpen(true);
      setSearchParams({});
    }
  }, [searchParams, obras, loadingData, canCreateAnticipo, setSearchParams]);

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


  // Handle viewing solicitud detail
  const handleViewSolicitud = async (solicitud: SolicitudWithDetails) => {
    setViewingSolicitud(solicitud);
    setAvanceItems([]);
    setExtrasInfo([]);
    
    // If it has an avance_id, fetch the avance items
    if (solicitud.avance_id) {
      try {
        const { data: avanceItemsData } = await supabase
          .from('avance_items')
          .select(`
            cantidad_completada,
            obra_items(descripcion, precio_unitario)
          `)
          .eq('avance_id', solicitud.avance_id);
        
        if (avanceItemsData) {
          const items = avanceItemsData.map((item: any) => ({
            descripcion: item.obra_items?.descripcion || 'N/A',
            cantidad: item.cantidad_completada,
            precio: Number(item.obra_items?.precio_unitario || 0),
          }));
          setAvanceItems(items);
        }
      } catch (error) {
        console.error('Error fetching avance items:', error);
      }
    }
    
    // If it has extras_ids, fetch the extras info
    if (solicitud.extras_ids && solicitud.extras_ids.length > 0) {
      try {
        const { data: extrasData } = await supabase
          .from('extras')
          .select('descripcion, monto')
          .in('id', solicitud.extras_ids);
        
        if (extrasData) {
          setExtrasInfo(extrasData.map(e => ({
            descripcion: e.descripcion,
            monto: Number(e.monto),
          })));
        }
      } catch (error) {
        console.error('Error fetching extras:', error);
      }
    }
    
    // If tipo is 'extra', try to find matching extra by obra/instalador/monto
    if (solicitud.tipo === 'extra' && (!solicitud.extras_ids || solicitud.extras_ids.length === 0)) {
      try {
        const { data: extrasData } = await supabase
          .from('extras')
          .select('descripcion, monto')
          .eq('obra_id', solicitud.obra_id)
          .eq('instalador_id', solicitud.instalador_id)
          .eq('monto', solicitud.total_solicitado);
        
        if (extrasData && extrasData.length > 0) {
          setExtrasInfo(extrasData.map(e => ({
            descripcion: e.descripcion,
            monto: Number(e.monto),
          })));
        }
      } catch (error) {
        console.error('Error fetching extra by match:', error);
      }
    }
  };


  const handleAprobarDirecto = async (solicitud: SolicitudWithDetails) => {
    if (!user) return;
    
    const isAnticipo = solicitud.tipo === 'anticipo';
    const montoSolicitud = Number(solicitud.total_solicitado);
    
    // For non-anticipo, check if there are available anticipos for this obra/instalador
    if (!isAnticipo) {
      const anticiposParaAplicar = anticipos.filter(
        a => a.obra_id === solicitud.obra_id && 
             a.instalador_id === solicitud.instalador_id && 
             a.monto_disponible > 0
      );
      
      if (anticiposParaAplicar.length > 0) {
        // Show dialog to apply anticipos
        setSolicitudParaAprobar(solicitud);
        setAnticiposDisponibles(anticiposParaAplicar);
        setAnticiposSeleccionados({});
        setShowAplicarAnticipoDialog(true);
        return;
      }
    }
    
    // Proceed with normal approval
    await aprobarSolicitud(solicitud, {});
  };

  const aprobarSolicitud = async (
    solicitud: SolicitudWithDetails, 
    anticiposAAplicar: {[anticipoId: string]: number}
  ) => {
    if (!user) return;
    
    const isAnticipo = solicitud.tipo === 'anticipo';
    const montoSolicitud = Number(solicitud.total_solicitado);
    const totalAnticiposAplicados = Object.values(anticiposAAplicar).reduce((sum, val) => sum + val, 0);
    const montoEfectivo = montoSolicitud - totalAnticiposAplicados;
    
    // For non-anticipo, validate obra limits
    if (!isAnticipo) {
      try {
        const [obraRes, itemsRes, extrasRes, pagosRes] = await Promise.all([
          supabase
            .from('obras')
            .select('descuento')
            .eq('id', solicitud.obra_id)
            .single(),
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
        
        const descuento = Number(obraRes.data?.descuento || 0);
        const totalItems = (itemsRes.data || []).reduce((sum, item) => 
          sum + (Number(item.cantidad) * Number(item.precio_unitario)), 0);
        const totalExtras = (extrasRes.data || []).reduce((sum, extra) => 
          sum + Number(extra.monto), 0);
        const totalPagado = (pagosRes.data || []).reduce((sum, pago) => 
          sum + Number(pago.monto), 0);
        
        const subtotal = totalItems + totalExtras;
        const montoDescuento = subtotal * (descuento / 100);
        const totalObra = subtotal - montoDescuento;
        const saldoPendiente = totalObra - totalPagado;
        
        if (montoSolicitud > saldoPendiente) {
          toast({
            title: 'Error',
            description: `No se puede aprobar. El pago de ${formatCurrency(montoSolicitud)} excede el saldo pendiente de ${formatCurrency(saldoPendiente)}`,
            variant: 'destructive',
          });
          return;
        }
      } catch (error) {
        console.error('Error validating obra limits:', error);
        toast({
          title: 'Error',
          description: 'No se pudo validar el límite de la obra',
          variant: 'destructive',
        });
        return;
      }
    }
    
    // Proceed with approval
    try {
      setProcessing(true);
      
      const { error: updateError } = await supabase
        .from('solicitudes_pago')
        .update({
          estado: 'aprobada',
          aprobado_por: user.id,
          fecha_aprobacion: new Date().toISOString(),
        })
        .eq('id', solicitud.id);
      
      if (updateError) throw updateError;
      
      // IMPORTANTE:
      // NO crear el registro en `anticipos` al aprobar.
      // Debe volverse disponible únicamente cuando el pago del anticipo se ejecute (al cerrar el corte).
      
      // Apply anticipos if any were selected
      if (totalAnticiposAplicados > 0) {
        for (const [anticipoId, montoAplicar] of Object.entries(anticiposAAplicar)) {
          if (montoAplicar > 0) {
            // Get current anticipo monto_disponible
            const { data: anticipoData, error: anticipoFetchError } = await supabase
              .from('anticipos')
              .select('monto_disponible')
              .eq('id', anticipoId)
              .single();
            
            if (anticipoFetchError) throw anticipoFetchError;
            
            const nuevoDisponible = Number(anticipoData.monto_disponible) - montoAplicar;
            
            // Update the anticipo to reduce monto_disponible
            const { error: anticipoUpdateError } = await supabase
              .from('anticipos')
              .update({ monto_disponible: nuevoDisponible })
              .eq('id', anticipoId);
            
            if (anticipoUpdateError) throw anticipoUpdateError;
          }
        }
      }
      
      // If solicitud has associated extras, approve them automatically
      if (solicitud.extras_ids && solicitud.extras_ids.length > 0) {
        await supabase
          .from('extras')
          .update({
            estado: 'aprobado',
            aprobado_por: user.id,
            fecha_aprobacion: new Date().toISOString(),
          })
          .in('id', solicitud.extras_ids);
      }
      
      // If this is an extra type solicitud, approve the extra
      if (solicitud.tipo === 'extra') {
        await supabase
          .from('extras')
          .update({
            estado: 'aprobado',
            aprobado_por: user.id,
            fecha_aprobacion: new Date().toISOString(),
          })
          .eq('obra_id', solicitud.obra_id)
          .eq('instalador_id', solicitud.instalador_id)
          .eq('monto', montoSolicitud)
          .eq('estado', 'pendiente');
      }
      
      const anticipoMsg = totalAnticiposAplicados > 0 
        ? ` Se descontaron ${formatCurrency(totalAnticiposAplicados)} de anticipos.`
        : '';
      
      toast({
        title: 'Éxito',
        description: isAnticipo
          ? 'Anticipo aprobado - quedará disponible al pagarse en el corte'
          : `Solicitud aprobada - lista para asignar a un corte.${anticipoMsg}`,
      });
      
      // Reset dialog states
      setShowAplicarAnticipoDialog(false);
      setSolicitudParaAprobar(null);
      setAnticiposSeleccionados({});
      
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

  const handleConfirmarAprobacion = async () => {
    if (!solicitudParaAprobar) return;
    await aprobarSolicitud(solicitudParaAprobar, anticiposSeleccionados);
  };

  const handleAprobarSinAnticipo = async () => {
    if (!solicitudParaAprobar) return;
    await aprobarSolicitud(solicitudParaAprobar, {});
  };

  const handleAnticipoAmountChange = (anticipoId: string, value: string, maxDisponible: number) => {
    const numValue = parseFloat(value) || 0;
    const clampedValue = Math.min(Math.max(0, numValue), maxDisponible);
    setAnticiposSeleccionados(prev => ({
      ...prev,
      [anticipoId]: clampedValue,
    }));
  };

  // Delete avance directly from detail dialog
  const handleDeleteAvanceFromDetail = async () => {
    if (!viewingSolicitud || !viewingSolicitud.avance_id) return;
    
    try {
      setDeletingFromDetail(true);
      
      // Delete ALL solicitudes associated with this avance (handles multi-installer avances)
      const { error: solicitudError } = await supabase
        .from('solicitudes_pago')
        .delete()
        .eq('avance_id', viewingSolicitud.avance_id);
      
      if (solicitudError) throw solicitudError;
      
      // Delete avance items
      const { error: itemsError } = await supabase
        .from('avance_items')
        .delete()
        .eq('avance_id', viewingSolicitud.avance_id);
      
      if (itemsError) throw itemsError;
      
      // Delete the avance
      const { error: avanceError } = await supabase
        .from('avances')
        .delete()
        .eq('id', viewingSolicitud.avance_id);
      
      if (avanceError) throw avanceError;
      
      toast({ title: 'Éxito', description: 'Avance eliminado correctamente' });
      setConfirmDeleteType(null);
      setViewingSolicitud(null);
      fetchSolicitudes();
    } catch (error) {
      console.error('Error deleting avance:', error);
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el avance',
        variant: 'destructive',
      });
    } finally {
      setDeletingFromDetail(false);
    }
  };

  // Delete extra directly from detail dialog
  const handleDeleteExtraFromDetail = async () => {
    if (!viewingSolicitud || !viewingSolicitud.extras_ids || viewingSolicitud.extras_ids.length === 0) return;
    
    try {
      setDeletingFromDetail(true);
      
      const extraId = viewingSolicitud.extras_ids[0];
      
      // Delete the solicitud
      const { error: solicitudError } = await supabase
        .from('solicitudes_pago')
        .delete()
        .eq('id', viewingSolicitud.id);
      
      if (solicitudError) throw solicitudError;
      
      // Delete the extra
      const { error: extraError } = await supabase
        .from('extras')
        .delete()
        .eq('id', extraId);
      
      if (extraError) throw extraError;
      
      toast({ title: 'Éxito', description: 'Extra eliminado correctamente' });
      setConfirmDeleteType(null);
      setViewingSolicitud(null);
      fetchSolicitudes();
    } catch (error) {
      console.error('Error deleting extra:', error);
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el extra',
        variant: 'destructive',
      });
    } finally {
      setDeletingFromDetail(false);
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
    const isExtra = sol.tipo === 'extra';
    // No permitir eliminar desde solicitudes si es un extra - debe eliminarse desde la página de extras
    return !hasPago && !hasAvance && !isExtra;
  };

  // Toggle single selection
  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Toggle all pending solicitudes
  const toggleSelectAll = () => {
    const pendingIds = filteredSolicitudes.map(s => s.id);
    const allSelected = pendingIds.every(id => selectedIds.has(id));
    
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingIds));
    }
  };

  // Bulk approval handler
  const handleAprobarMasivo = async () => {
    if (!user || selectedIds.size === 0) return;
    
    setProcessingBulk(true);
    
    const solicitudesAProbar = filteredSolicitudes.filter(s => selectedIds.has(s.id));
    let aprobadas = 0;
    let fallidas: { nombre: string; motivo: string }[] = [];
    
    for (const solicitud of solicitudesAProbar) {
      const isAnticipo = solicitud.tipo === 'anticipo';
      const montoSolicitud = Number(solicitud.total_solicitado);
      
      // For non-anticipo, validate obra limits
      if (!isAnticipo) {
        try {
          const [obraRes, itemsRes, extrasRes, pagosRes] = await Promise.all([
            supabase.from('obras').select('descuento').eq('id', solicitud.obra_id).single(),
            supabase.from('obra_items').select('cantidad, precio_unitario').eq('obra_id', solicitud.obra_id),
            supabase.from('extras').select('monto').eq('obra_id', solicitud.obra_id).eq('estado', 'aprobado'),
            supabase.from('pagos_destajos').select('monto').eq('obra_id', solicitud.obra_id),
          ]);
          
          const descuento = Number(obraRes.data?.descuento || 0);
          const totalItems = (itemsRes.data || []).reduce((sum, item) => 
            sum + (Number(item.cantidad) * Number(item.precio_unitario)), 0);
          const totalExtras = (extrasRes.data || []).reduce((sum, extra) => 
            sum + Number(extra.monto), 0);
          const totalPagado = (pagosRes.data || []).reduce((sum, pago) => 
            sum + Number(pago.monto), 0);
          
          const subtotal = totalItems + totalExtras;
          const montoDescuento = subtotal * (descuento / 100);
          const totalObra = subtotal - montoDescuento;
          const saldoPendiente = totalObra - totalPagado;
          
          if (montoSolicitud > saldoPendiente) {
            fallidas.push({
              nombre: `${solicitud.instaladores?.nombre} - ${solicitud.obras?.nombre}`,
              motivo: `Excede saldo (${formatCurrency(saldoPendiente)})`
            });
            continue;
          }
        } catch (error) {
          fallidas.push({
            nombre: `${solicitud.instaladores?.nombre} - ${solicitud.obras?.nombre}`,
            motivo: 'Error validando obra'
          });
          continue;
        }
      }
      
      // Approve the solicitud
      try {
        const { error: updateError } = await supabase
          .from('solicitudes_pago')
          .update({
            estado: 'aprobada',
            aprobado_por: user.id,
            fecha_aprobacion: new Date().toISOString(),
          })
          .eq('id', solicitud.id);
        
        if (updateError) throw updateError;
        
        // IMPORTANTE:
        // En aprobación masiva NO crear anticipos disponibles.
        // El anticipo se vuelve disponible al pagarse (cuando se cierre el corte).
        
        // If has extras, approve them
        if (solicitud.extras_ids && solicitud.extras_ids.length > 0) {
          await supabase.from('extras').update({
            estado: 'aprobado',
            aprobado_por: user.id,
            fecha_aprobacion: new Date().toISOString(),
          }).in('id', solicitud.extras_ids);
        }
        
        // If extra type, approve matching extra
        if (solicitud.tipo === 'extra') {
          await supabase.from('extras').update({
            estado: 'aprobado',
            aprobado_por: user.id,
            fecha_aprobacion: new Date().toISOString(),
          })
          .eq('obra_id', solicitud.obra_id)
          .eq('instalador_id', solicitud.instalador_id)
          .eq('monto', montoSolicitud)
          .eq('estado', 'pendiente');
        }
        
        aprobadas++;
      } catch (error) {
        fallidas.push({
          nombre: `${solicitud.instaladores?.nombre} - ${solicitud.obras?.nombre}`,
          motivo: 'Error al aprobar'
        });
      }
    }
    
    // Show results
    if (aprobadas > 0) {
      const incluyeAnticipos = solicitudesAProbar.some(s => s.tipo === 'anticipo');
      toast({
        title: `${aprobadas} solicitud${aprobadas > 1 ? 'es' : ''} aprobada${aprobadas > 1 ? 's' : ''}`,
        description: fallidas.length > 0
          ? `${fallidas.length} no se pudieron aprobar`
          : incluyeAnticipos
            ? 'Listas para asignar a un corte (anticipos disponibles al pagarse)'
            : 'Listas para asignar a un corte',
      });
    }
    
    if (fallidas.length > 0 && aprobadas === 0) {
      toast({
        title: 'No se aprobaron solicitudes',
        description: fallidas.map(f => `${f.nombre}: ${f.motivo}`).join('; '),
        variant: 'destructive',
      });
    }
    
    setSelectedIds(new Set());
    setProcessingBulk(false);
    fetchSolicitudes();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(amount);
  };

  const filteredSolicitudes = solicitudes.filter((solicitud) => {
    // Only show pending solicitudes
    if (solicitud.estado !== 'pendiente') return false;
    
    const matchesSearch = 
      solicitud.obras?.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      solicitud.instaladores?.nombre.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesTipo = 
      filterTipo === 'todos' ||
      (filterTipo === 'anticipo' && solicitud.tipo === 'anticipo') ||
      (filterTipo === 'extra' && solicitud.tipo === 'extra') ||
      (filterTipo === 'avance' && solicitud.tipo !== 'anticipo' && solicitud.tipo !== 'extra');
    
    return matchesSearch && matchesTipo;
  });

  // Check if all filtered are selected
  const allPendingSelected = filteredSolicitudes.length > 0 && 
    filteredSolicitudes.every(s => selectedIds.has(s.id));
  const somePendingSelected = filteredSolicitudes.some(s => selectedIds.has(s.id));
  const selectedTotal = filteredSolicitudes
    .filter(s => selectedIds.has(s.id))
    .reduce((sum, s) => sum + Number(s.total_solicitado), 0);

  const columns = [
    {
      key: 'select',
      header: () => (
        <div onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={allPendingSelected}
            // @ts-ignore - indeterminate is valid HTML but not typed
            ref={(el: HTMLButtonElement | null) => {
              if (el) {
                (el as unknown as HTMLInputElement).indeterminate = somePendingSelected && !allPendingSelected;
              }
            }}
            onCheckedChange={() => toggleSelectAll()}
            disabled={!canUpdate}
          />
        </div>
      ),
      cell: (item: SolicitudWithDetails) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={selectedIds.has(item.id)}
            onCheckedChange={() => toggleSelection(item.id)}
            disabled={!canUpdate}
          />
        </div>
      ),
      className: 'w-10',
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
        ) : item.tipo === 'extra' ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
            Extra
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
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          {item.estado === 'pendiente' && canUpdate && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                onClick={() => handleAprobarDirecto(item)}
                disabled={processing}
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
          {canDeleteSolicitud(item) && canDelete && (
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
          {(!canDeleteSolicitud(item) || !canDelete) && item.estado !== 'pendiente' && (
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


  const totalAnticiposDisponibles = anticipos.reduce((sum, a) => sum + a.monto_disponible, 0);

  return (
    <div>
      <PageHeader
        title="Solicitudes de Pago"
        description="Gestión de solicitudes de pago de instaladores"
        icon={Wallet}
      />

      {/* Anticipos Summary - Clickable */}
      {totalAnticiposDisponibles > 0 && (
        <div 
          className="mb-6 p-4 rounded-lg border bg-amber-50 border-amber-200 cursor-pointer hover:bg-amber-100 transition-colors"
          onClick={() => setShowAnticiposModal(true)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Banknote className="w-5 h-5 text-amber-600" />
              <span className="font-medium text-amber-800">
                Anticipos disponibles: {formatCurrency(totalAnticiposDisponibles)}
              </span>
              <span className="text-sm text-amber-600">
                ({anticipos.length} anticipo{anticipos.length !== 1 ? 's' : ''})
              </span>
            </div>
            <Eye className="w-4 h-4 text-amber-600" />
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
            <Button
              variant={filterTipo === 'extra' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setFilterTipo('extra')}
              className="text-xs"
            >
              Extras
            </Button>
          </div>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && canUpdate && (
        <div className="mb-4 p-3 rounded-lg border bg-emerald-50 border-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span className="font-medium text-emerald-800">
              {selectedIds.size} solicitud{selectedIds.size > 1 ? 'es' : ''} seleccionada{selectedIds.size > 1 ? 's' : ''}
            </span>
            <span className="text-emerald-700">
              · Total: {formatCurrency(selectedTotal)}
            </span>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
              disabled={processingBulk}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={handleAprobarMasivo}
              disabled={processingBulk}
            >
              {processingBulk ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Aprobando...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Aprobar seleccionadas
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <DataTable
        columns={columns}
        data={filteredSolicitudes}
        keyExtractor={(item) => item.id}
        onRowClick={(item) => handleViewSolicitud(item)}
        emptyState={
          <EmptyState
            icon={Wallet}
            title="Sin solicitudes"
            description="No hay solicitudes de pago registradas"
          />
        }
      />

      {/* View Solicitud Detail Dialog */}
      <Dialog open={!!viewingSolicitud} onOpenChange={(open) => !open && setViewingSolicitud(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Detalle de Solicitud
            </DialogTitle>
          </DialogHeader>
          {viewingSolicitud && (
            <div className="space-y-4">
              {/* Basic info */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Fecha:</span>
                  <p className="font-medium">{format(new Date(viewingSolicitud.created_at), "dd/MM/yyyy", { locale: es })}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Tipo:</span>
                  <p className="font-medium capitalize">{viewingSolicitud.tipo}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Obra:</span>
                  <p className="font-medium">{viewingSolicitud.obras?.nombre || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Instalador:</span>
                  <p className="font-medium">{viewingSolicitud.instaladores?.nombre || 'N/A'}</p>
                </div>
              </div>

              {/* Avance items breakdown */}
              {viewingSolicitud.tipo !== 'anticipo' && avanceItems.length > 0 && (
                <div className="border rounded-lg p-3 space-y-2">
                  <h4 className="font-semibold text-sm">Desglose de Avance</h4>
                  <div className="space-y-1">
                    {avanceItems.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span>{item.descripcion} x{item.cantidad}</span>
                        <span className="font-medium">{formatCurrency(item.cantidad * item.precio)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Extras breakdown */}
              {extrasInfo.length > 0 && (
                <div className="border rounded-lg p-3 space-y-2 bg-amber-50 border-amber-200">
                  <h4 className="font-semibold text-sm text-amber-800">Detalle del Extra</h4>
                  <div className="space-y-2">
                    {extrasInfo.map((extra, idx) => (
                      <div key={idx} className="text-sm">
                        <p className="text-amber-900">{extra.descripcion}</p>
                        <p className="font-medium text-amber-700">{formatCurrency(extra.monto)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Amounts breakdown */}
              <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
                <h4 className="font-semibold text-sm">Montos</h4>
                {viewingSolicitud.subtotal_piezas > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal Piezas:</span>
                    <span>{formatCurrency(Number(viewingSolicitud.subtotal_piezas))}</span>
                  </div>
                )}
                {viewingSolicitud.subtotal_extras > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal Extras:</span>
                    <span>{formatCurrency(Number(viewingSolicitud.subtotal_extras))}</span>
                  </div>
                )}
                {viewingSolicitud.monto_libre > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Monto Libre:</span>
                    <span>{formatCurrency(Number(viewingSolicitud.monto_libre))}</span>
                  </div>
                )}
                {viewingSolicitud.retencion > 0 && (
                  <div className="flex justify-between text-sm text-red-600">
                    <span>Retención:</span>
                    <span>-{formatCurrency(Number(viewingSolicitud.retencion))}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-semibold border-t pt-2">
                  <span>Total Solicitado:</span>
                  <span className="text-emerald-600">{formatCurrency(Number(viewingSolicitud.total_solicitado))}</span>
                </div>
              </div>

              {/* Observations */}
              {viewingSolicitud.observaciones && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Observaciones:</span>
                  <p className="mt-1 p-2 bg-muted/50 rounded">{viewingSolicitud.observaciones}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            {/* Action buttons for avance/extra when pending */}
            {viewingSolicitud && viewingSolicitud.estado === 'pendiente' && (
              <>
                {viewingSolicitud.avance_id && (
                  <div className="flex gap-2 mr-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const avanceId = viewingSolicitud.avance_id;
                        setViewingSolicitud(null);
                        navigate(`/destajos/avances?edit=${avanceId}`);
                      }}
                    >
                      <Pencil className="w-4 h-4 mr-1" />
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => setConfirmDeleteType('avance')}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Eliminar
                    </Button>
                  </div>
                )}
                {viewingSolicitud.tipo === 'extra' && viewingSolicitud.extras_ids && viewingSolicitud.extras_ids.length > 0 && (
                  <div className="flex gap-2 mr-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const extraId = viewingSolicitud.extras_ids?.[0];
                        setViewingSolicitud(null);
                        navigate(`/destajos/extras?edit=${extraId}`);
                      }}
                    >
                      <Pencil className="w-4 h-4 mr-1" />
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => setConfirmDeleteType('extra')}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Eliminar
                    </Button>
                  </div>
                )}
              </>
            )}
            <Button variant="outline" onClick={() => setViewingSolicitud(null)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


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

      {/* Apply Anticipo Dialog */}
      <Dialog open={showAplicarAnticipoDialog} onOpenChange={(open) => {
        if (!open) {
          setShowAplicarAnticipoDialog(false);
          setSolicitudParaAprobar(null);
          setAnticiposSeleccionados({});
        }
      }}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="w-5 h-5 text-amber-600" />
              Aplicar Anticipos
            </DialogTitle>
          </DialogHeader>
          
          {solicitudParaAprobar && (
            <div className="space-y-4 overflow-y-auto flex-1 pr-1">
              <div className="p-3 bg-muted rounded-lg text-sm">
                <div className="flex justify-between mb-1">
                  <span className="text-muted-foreground">Instalador:</span>
                  <span className="font-medium">{solicitudParaAprobar.instaladores?.nombre}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total a pagar:</span>
                  <span className="font-semibold text-emerald-600">
                    {formatCurrency(Number(solicitudParaAprobar.total_solicitado))}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium">Anticipos disponibles:</Label>
                {anticiposDisponibles.map((anticipo) => (
                  <div key={anticipo.id} className="p-3 border rounded-lg space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {format(new Date(anticipo.created_at), 'dd/MM/yyyy', { locale: es })}
                      </span>
                      <span className="font-medium text-amber-600">
                        Disponible: {formatCurrency(anticipo.monto_disponible)}
                      </span>
                    </div>
                    {anticipo.observaciones && (
                      <p className="text-xs text-muted-foreground">{anticipo.observaciones}</p>
                    )}
                    <div className="flex items-center gap-2">
                      <Label className="text-xs whitespace-nowrap">Aplicar:</Label>
                      <Input
                        type="number"
                        min="0"
                        max={anticipo.monto_disponible}
                        step="0.01"
                        value={anticiposSeleccionados[anticipo.id] || ''}
                        onChange={(e) => handleAnticipoAmountChange(anticipo.id, e.target.value, anticipo.monto_disponible)}
                        placeholder="0.00"
                        className="h-8 text-sm"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs h-8"
                        onClick={() => {
                          const montoSolicitud = Number(solicitudParaAprobar.total_solicitado);
                          const yaAplicado = Object.entries(anticiposSeleccionados)
                            .filter(([id]) => id !== anticipo.id)
                            .reduce((sum, [, val]) => sum + val, 0);
                          const restante = montoSolicitud - yaAplicado;
                          const aplicar = Math.min(anticipo.monto_disponible, restante);
                          handleAnticipoAmountChange(anticipo.id, aplicar.toString(), anticipo.monto_disponible);
                        }}
                      >
                        Max
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {Object.values(anticiposSeleccionados).reduce((sum, val) => sum + val, 0) > 0 && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm">
                  <div className="flex justify-between">
                    <span className="text-emerald-700">Total anticipos a aplicar:</span>
                    <span className="font-semibold text-emerald-700">
                      -{formatCurrency(Object.values(anticiposSeleccionados).reduce((sum, val) => sum + val, 0))}
                    </span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-emerald-700">Pago efectivo:</span>
                    <span className="font-semibold text-emerald-700">
                      {formatCurrency(
                        Number(solicitudParaAprobar.total_solicitado) - 
                        Object.values(anticiposSeleccionados).reduce((sum, val) => sum + val, 0)
                      )}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex-shrink-0 flex-col gap-2 sm:flex-row sm:justify-end pt-4 border-t">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => {
                setShowAplicarAnticipoDialog(false);
                setSolicitudParaAprobar(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={handleAprobarSinAnticipo}
              disabled={processing}
            >
              Aprobar sin anticipo
            </Button>
            <Button
              className="w-full sm:w-auto"
              onClick={handleConfirmarAprobacion}
              disabled={processing || Object.values(anticiposSeleccionados).reduce((sum, val) => sum + val, 0) === 0}
            >
              {processing ? 'Procesando...' : 'Aprobar con anticipo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Anticipos Available Modal */}
      <Dialog open={showAnticiposModal} onOpenChange={setShowAnticiposModal}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="w-5 h-5 text-amber-600" />
              Anticipos Disponibles
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {anticipos.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No hay anticipos disponibles</p>
            ) : (
              <>
                {anticipos.map((anticipo) => (
                  <div 
                    key={anticipo.id} 
                    className="p-4 border rounded-lg bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <p className="font-medium">{anticipo.obras?.nombre || 'Obra sin nombre'}</p>
                        <p className="text-sm text-muted-foreground">{anticipo.instaladores?.nombre || 'Sin instalador'}</p>
                        {anticipo.observaciones && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{anticipo.observaciones}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(anticipo.created_at), 'dd MMM yyyy', { locale: es })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-amber-700">{formatCurrency(anticipo.monto_disponible)}</p>
                        {anticipo.monto_disponible < anticipo.monto_original && (
                          <p className="text-xs text-muted-foreground">
                            de {formatCurrency(anticipo.monto_original)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {/* Total */}
                <div className="flex justify-between items-center pt-3 border-t font-semibold">
                  <span>Total disponible</span>
                  <span className="text-amber-700 text-lg">{formatCurrency(totalAnticiposDisponibles)}</span>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAnticiposModal(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Avance/Extra Confirmation from Detail Dialog */}
      <AlertDialog 
        open={confirmDeleteType !== null} 
        onOpenChange={(open) => !open && setConfirmDeleteType(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Eliminar {confirmDeleteType === 'avance' ? 'avance' : 'extra'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDeleteType === 'avance' 
                ? 'Se eliminará el avance y su solicitud de pago asociada. Esta acción no se puede deshacer.'
                : 'Se eliminará el extra y su solicitud de pago asociada. Esta acción no se puede deshacer.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingFromDetail}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteType === 'avance' ? handleDeleteAvanceFromDetail : handleDeleteExtraFromDetail}
              disabled={deletingFromDetail}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingFromDetail ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
