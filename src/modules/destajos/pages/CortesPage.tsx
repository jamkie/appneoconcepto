import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Plus, Eye, Lock, Search, Users, Unlock, Download, FileText, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { PageHeader, DataTable, EmptyState, StatusBadge } from '../components';
import { useExportCorteExcel } from '../hooks/useExportCorteExcel';
import { useGenerateBatchPDF } from '../hooks/useGenerateBatchPDF';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format, startOfWeek, endOfWeek, addWeeks, getWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import type { CorteSemanal, SolicitudPago, Instalador, Obra } from '../types';

interface CorteWithDetails extends CorteSemanal {
  solicitudes_count?: number;
  total_calculated?: number;
}

interface SolicitudForCorte extends SolicitudPago {
  obras: { nombre: string } | null;
  instaladores: { nombre: string } | null;
}

interface InstaladorResumen {
  id: string;
  nombre: string;
  total: number;
  solicitudes: SolicitudForCorte[];
}

export default function CortesPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { exportCorteToExcel } = useExportCorteExcel();
  const { generateBatchPDF } = useGenerateBatchPDF();
  const [exporting, setExporting] = useState(false);
  const [generatingPDFs, setGeneratingPDFs] = useState(false);
  
  const [cortes, setCortes] = useState<CorteWithDetails[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState<'todos' | 'abierto' | 'cerrado'>('todos');
  
  // New corte modal
  const [isNewCorteOpen, setIsNewCorteOpen] = useState(false);
  const [newCorteNombre, setNewCorteNombre] = useState('');
  const [newCorteFechaInicio, setNewCorteFechaInicio] = useState('');
  const [newCorteFechaFin, setNewCorteFechaFin] = useState('');
  const [savingCorte, setSavingCorte] = useState(false);
  
  // View corte detail
  const [viewingCorte, setViewingCorte] = useState<CorteWithDetails | null>(null);
  const [corteSolicitudes, setCorteSolicitudes] = useState<SolicitudForCorte[]>([]);
  const [solicitudesDisponibles, setSolicitudesDisponibles] = useState<SolicitudForCorte[]>([]);
  const [resumenInstaladores, setResumenInstaladores] = useState<InstaladorResumen[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  
  // Close corte confirmation
  const [confirmClose, setConfirmClose] = useState(false);
  const [closingCorte, setClosingCorte] = useState(false);
  
  // Reopen corte confirmation
  const [confirmReopen, setConfirmReopen] = useState(false);
  const [reopeningCorte, setReopeningCorte] = useState(false);
  
  // Delete corte confirmation
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletingCorte, setDeletingCorte] = useState(false);
  
  // Payment method for closing
  const [metodoPago, setMetodoPago] = useState<'efectivo' | 'transferencia' | 'cheque'>('transferencia');

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchCortes();
    }
  }, [user]);

  const fetchCortes = async () => {
    try {
      setLoadingData(true);
      
      const { data: cortesData, error: cortesError } = await supabase
        .from('cortes_semanales')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (cortesError) throw cortesError;
      
      // Get solicitudes count per corte
      const cortesWithCounts = await Promise.all(
        (cortesData || []).map(async (corte) => {
          const { count, data: solicitudesData } = await supabase
            .from('solicitudes_pago')
            .select('total_solicitado', { count: 'exact' })
            .eq('corte_id', corte.id);
          
          const total = (solicitudesData || []).reduce((sum, s) => sum + Number(s.total_solicitado), 0);
          
          return {
            ...corte,
            solicitudes_count: count || 0,
            total_calculated: total,
          };
        })
      );
      
      setCortes(cortesWithCounts as CorteWithDetails[]);
    } catch (error) {
      console.error('Error fetching cortes:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los cortes',
        variant: 'destructive',
      });
    } finally {
      setLoadingData(false);
    }
  };

  const openNewCorteModal = () => {
    // Default to current week
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 }); // Sunday
    const weekNum = getWeek(now, { weekStartsOn: 1 });
    const monthName = format(now, 'MMMM', { locale: es });
    const year = now.getFullYear();
    
    setNewCorteNombre(`Semana ${weekNum} - ${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year}`);
    setNewCorteFechaInicio(format(weekStart, 'yyyy-MM-dd'));
    setNewCorteFechaFin(format(weekEnd, 'yyyy-MM-dd'));
    setIsNewCorteOpen(true);
  };

  const handleCreateCorte = async () => {
    if (!user || !newCorteNombre || !newCorteFechaInicio || !newCorteFechaFin) return;
    
    try {
      setSavingCorte(true);
      
      const { data, error } = await supabase
        .from('cortes_semanales')
        .insert({
          nombre: newCorteNombre,
          fecha_inicio: newCorteFechaInicio,
          fecha_fin: newCorteFechaFin,
          created_by: user.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      toast({
        title: 'Éxito',
        description: 'Corte creado correctamente',
      });
      
      setIsNewCorteOpen(false);
      fetchCortes();
      
      // Automatically open the detail view
      if (data) {
        handleViewCorte(data as CorteWithDetails);
      }
    } catch (error) {
      console.error('Error creating corte:', error);
      toast({
        title: 'Error',
        description: 'No se pudo crear el corte',
        variant: 'destructive',
      });
    } finally {
      setSavingCorte(false);
    }
  };

  const handleViewCorte = async (corte: CorteWithDetails) => {
    setViewingCorte(corte);
    setLoadingDetail(true);
    
    try {
      // Fetch solicitudes assigned to this corte
      const { data: asignadas, error: asignadasError } = await supabase
        .from('solicitudes_pago')
        .select(`
          *,
          obras(nombre),
          instaladores(nombre)
        `)
        .eq('corte_id', corte.id)
        .order('created_at', { ascending: false });
      
      if (asignadasError) throw asignadasError;
      
      setCorteSolicitudes((asignadas || []) as SolicitudForCorte[]);
      
      // If corte is open, fetch available solicitudes (approved, no corte assigned)
      if (corte.estado === 'abierto') {
        const { data: disponibles, error: disponiblesError } = await supabase
          .from('solicitudes_pago')
          .select(`
            *,
            obras(nombre),
            instaladores(nombre)
          `)
          .eq('estado', 'aprobada')
          .is('corte_id', null)
          .order('created_at', { ascending: false });
        
        if (disponiblesError) throw disponiblesError;
        
        setSolicitudesDisponibles((disponibles || []) as SolicitudForCorte[]);
      } else {
        setSolicitudesDisponibles([]);
      }
      
      // Calculate resumen by instalador
      const resumenMap: Record<string, InstaladorResumen> = {};
      (asignadas || []).forEach((sol: any) => {
        const instaladorId = sol.instalador_id;
        if (!resumenMap[instaladorId]) {
          resumenMap[instaladorId] = {
            id: instaladorId,
            nombre: sol.instaladores?.nombre || 'Desconocido',
            total: 0,
            solicitudes: [],
          };
        }
        resumenMap[instaladorId].total += Number(sol.total_solicitado);
        resumenMap[instaladorId].solicitudes.push(sol);
      });
      
      setResumenInstaladores(Object.values(resumenMap).sort((a, b) => b.total - a.total));
    } catch (error) {
      console.error('Error fetching corte detail:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los detalles del corte',
        variant: 'destructive',
      });
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleAddSolicitudToCorte = async (solicitudId: string) => {
    if (!viewingCorte) return;
    
    try {
      const { error } = await supabase
        .from('solicitudes_pago')
        .update({ corte_id: viewingCorte.id })
        .eq('id', solicitudId);
      
      if (error) throw error;
      
      toast({
        title: 'Éxito',
        description: 'Solicitud agregada al corte',
      });
      
      // Refresh detail
      handleViewCorte(viewingCorte);
    } catch (error) {
      console.error('Error adding solicitud to corte:', error);
      toast({
        title: 'Error',
        description: 'No se pudo agregar la solicitud',
        variant: 'destructive',
      });
    }
  };

  const handleRemoveSolicitudFromCorte = async (solicitudId: string) => {
    if (!viewingCorte) return;
    
    try {
      const { error } = await supabase
        .from('solicitudes_pago')
        .update({ corte_id: null })
        .eq('id', solicitudId);
      
      if (error) throw error;
      
      // Check if the corte now has no solicitudes
      const { count } = await supabase
        .from('solicitudes_pago')
        .select('id', { count: 'exact', head: true })
        .eq('corte_id', viewingCorte.id);
      
      if (count === 0) {
        // Delete the empty corte
        const { error: deleteError } = await supabase
          .from('cortes_semanales')
          .delete()
          .eq('id', viewingCorte.id);
        
        if (deleteError) throw deleteError;
        
        toast({
          title: 'Corte eliminado',
          description: 'El corte fue eliminado porque quedó sin solicitudes',
        });
        
        setViewingCorte(null);
        fetchCortes();
        return;
      }
      
      toast({
        title: 'Éxito',
        description: 'Solicitud removida del corte',
      });
      
      // Refresh detail
      handleViewCorte(viewingCorte);
    } catch (error) {
      console.error('Error removing solicitud from corte:', error);
      toast({
        title: 'Error',
        description: 'No se pudo remover la solicitud',
        variant: 'destructive',
      });
    }
  };

  const handleCloseCorte = async () => {
    if (!viewingCorte || !user || corteSolicitudes.length === 0) return;
    
    try {
      setClosingCorte(true);
      
      // Group solicitudes by instalador and obra
      const pagoGroups: Record<string, { 
        instalador_id: string; 
        obra_id: string;
        total: number;
        solicitud_ids: string[];
      }> = {};
      
      corteSolicitudes.forEach((sol) => {
        const key = `${sol.instalador_id}-${sol.obra_id}`;
        if (!pagoGroups[key]) {
          pagoGroups[key] = {
            instalador_id: sol.instalador_id,
            obra_id: sol.obra_id,
            total: 0,
            solicitud_ids: [],
          };
        }
        pagoGroups[key].total += Number(sol.total_solicitado);
        pagoGroups[key].solicitud_ids.push(sol.id);
      });
      
      // Create one pago per instalador-obra combination
      const totalCorte = corteSolicitudes.reduce((sum, s) => sum + Number(s.total_solicitado), 0);
      
      for (const group of Object.values(pagoGroups)) {
        const { error: pagoError } = await supabase
          .from('pagos_destajos')
          .insert({
            obra_id: group.obra_id,
            instalador_id: group.instalador_id,
            monto: group.total,
            metodo_pago: metodoPago,
            corte_id: viewingCorte.id,
            registrado_por: user.id,
            observaciones: `Pago de corte: ${viewingCorte.nombre}`,
          });
        
        if (pagoError) throw pagoError;
      }
      
      // Update corte status
      const { error: corteError } = await supabase
        .from('cortes_semanales')
        .update({
          estado: 'cerrado',
          total_monto: totalCorte,
          cerrado_por: user.id,
          fecha_cierre: new Date().toISOString(),
        })
        .eq('id', viewingCorte.id);
      
      if (corteError) throw corteError;
      
      toast({
        title: 'Éxito',
        description: `Corte cerrado. Se generaron ${Object.keys(pagoGroups).length} pagos por un total de ${formatCurrency(totalCorte)}`,
      });
      
      setConfirmClose(false);
      setViewingCorte(null);
      fetchCortes();
    } catch (error) {
      console.error('Error closing corte:', error);
      toast({
        title: 'Error',
        description: 'No se pudo cerrar el corte',
        variant: 'destructive',
      });
    } finally {
      setClosingCorte(false);
    }
  };

  const handleReopenCorte = async () => {
    if (!viewingCorte || !user) return;
    
    try {
      setReopeningCorte(true);
      
      // Get all pagos linked to this corte
      const { data: pagosData, error: pagosError } = await supabase
        .from('pagos_destajos')
        .select('id, monto, obra_id, instalador_id')
        .eq('corte_id', viewingCorte.id);
      
      if (pagosError) throw pagosError;
      
      // Get all solicitudes linked to this corte
      const { data: solicitudesData, error: solicitudesError } = await supabase
        .from('solicitudes_pago')
        .select('id, tipo, extras_ids, obra_id, instalador_id, total_solicitado')
        .eq('corte_id', viewingCorte.id);
      
      if (solicitudesError) throw solicitudesError;
      
      // Delete all pagos linked to this corte
      if (pagosData && pagosData.length > 0) {
        const { error: deleteError } = await supabase
          .from('pagos_destajos')
          .delete()
          .eq('corte_id', viewingCorte.id);
        
        if (deleteError) throw deleteError;
      }
      
      // Revert all solicitudes to pendiente (keep corte_id so they stay assigned)
      if (solicitudesData && solicitudesData.length > 0) {
        const solicitudIds = solicitudesData.map(s => s.id);
        
        const { error: updateSolError } = await supabase
          .from('solicitudes_pago')
          .update({
            estado: 'pendiente',
            aprobado_por: null,
            fecha_aprobacion: null,
          })
          .in('id', solicitudIds);
        
        if (updateSolError) throw updateSolError;
        
        // Revert all extras linked to these solicitudes
        const allExtrasIds = solicitudesData
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
        
        // Delete anticipos generated from these solicitudes
        const anticipoSolicitudes = solicitudesData.filter(s => s.tipo === 'anticipo');
        for (const sol of anticipoSolicitudes) {
          const { error: anticipoDeleteError } = await supabase
            .from('anticipos')
            .delete()
            .eq('obra_id', sol.obra_id)
            .eq('instalador_id', sol.instalador_id)
            .eq('monto_original', sol.total_solicitado);
          
          if (anticipoDeleteError) {
            console.error('Error deleting anticipo:', anticipoDeleteError);
          }
        }
      }
      
      // Update corte back to abierto
      const { error: corteError } = await supabase
        .from('cortes_semanales')
        .update({
          estado: 'abierto',
          total_monto: 0,
          cerrado_por: null,
          fecha_cierre: null,
        })
        .eq('id', viewingCorte.id);
      
      if (corteError) throw corteError;
      
      toast({
        title: 'Corte reabierto',
        description: `Se eliminaron ${pagosData?.length || 0} pagos y las solicitudes vuelven a estar pendientes`,
      });
      
      setConfirmReopen(false);
      setViewingCorte(null);
      fetchCortes();
    } catch (error) {
      console.error('Error reopening corte:', error);
      toast({
        title: 'Error',
        description: 'No se pudo reabrir el corte',
        variant: 'destructive',
      });
    } finally {
      setReopeningCorte(false);
    }
  };

  const handleDeleteCorte = async () => {
    if (!viewingCorte) return;
    
    try {
      setDeletingCorte(true);
      
      const { error } = await supabase
        .from('cortes_semanales')
        .delete()
        .eq('id', viewingCorte.id);
      
      if (error) throw error;
      
      toast({
        title: 'Éxito',
        description: 'Corte eliminado correctamente',
      });
      
      setConfirmDelete(false);
      setViewingCorte(null);
      fetchCortes();
    } catch (error) {
      console.error('Error deleting corte:', error);
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el corte',
        variant: 'destructive',
      });
    } finally {
      setDeletingCorte(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(value);
  };

  const handleExportExcel = async () => {
    if (!viewingCorte) return;
    
    setExporting(true);
    const result = await exportCorteToExcel(viewingCorte);
    setExporting(false);
    
    if (result.success) {
      toast({
        title: 'Éxito',
        description: 'Archivo Excel descargado correctamente',
      });
    } else {
      toast({
        title: 'Error',
        description: 'No se pudo generar el archivo Excel',
        variant: 'destructive',
      });
    }
  };

  const handleGenerateBatchPDFs = async () => {
    if (!viewingCorte) return;
    
    if (viewingCorte.estado !== 'cerrado') {
      toast({
        title: 'Corte abierto',
        description: 'Solo puedes generar comprobantes de cortes cerrados',
        variant: 'destructive',
      });
      return;
    }
    
    setGeneratingPDFs(true);
    try {
      const result = await generateBatchPDF(viewingCorte);
      if (result.success) {
        toast({
          title: 'PDFs Generados',
          description: `Se generaron ${result.count} comprobantes en ${result.filename}`,
        });
      } else {
        toast({
          title: 'Sin pagos',
          description: result.error || 'No hay pagos para generar',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error generating batch PDFs:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron generar los comprobantes',
        variant: 'destructive',
      });
    } finally {
      setGeneratingPDFs(false);
    }
  };

  const filteredCortes = cortes.filter((corte) => {
    const matchesSearch = corte.nombre.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesEstado = filterEstado === 'todos' || corte.estado === filterEstado;
    return matchesSearch && matchesEstado;
  });

  const columns = [
    {
      key: 'nombre',
      header: 'Nombre',
      cell: (corte: CorteWithDetails) => (
        <div className="font-medium">{corte.nombre}</div>
      ),
    },
    {
      key: 'periodo',
      header: 'Periodo',
      cell: (corte: CorteWithDetails) => (
        <span className="text-sm text-muted-foreground">
          {format(new Date(corte.fecha_inicio), 'dd MMM', { locale: es })} - {format(new Date(corte.fecha_fin), 'dd MMM yyyy', { locale: es })}
        </span>
      ),
    },
    {
      key: 'solicitudes',
      header: 'Solicitudes',
      cell: (corte: CorteWithDetails) => (
        <span className="text-sm">{corte.solicitudes_count || 0}</span>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      cell: (corte: CorteWithDetails) => (
        <span className="font-medium">{formatCurrency(corte.total_calculated || corte.total_monto)}</span>
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      cell: (corte: CorteWithDetails) => (
        <StatusBadge status={corte.estado === 'abierto' ? 'pendiente' : 'aprobado'} />
      ),
    },
    {
      key: 'acciones',
      header: 'Acciones',
      cell: (corte: CorteWithDetails) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            handleViewCorte(corte);
          }}
        >
          <Eye className="w-4 h-4 mr-1" />
          Ver
        </Button>
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
    <div className="space-y-6">
      <PageHeader
        title="Cortes Semanales"
        description="Agrupa solicitudes aprobadas para generar pagos consolidados"
        icon={Calendar}
        actions={
          <Button onClick={openNewCorteModal}>
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Corte
          </Button>
        }
      />

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cortes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterEstado} onValueChange={(v) => setFilterEstado(v as any)}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filtrar por estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="abierto">Abiertos</SelectItem>
            <SelectItem value="cerrado">Cerrados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Cortes Table */}
      <DataTable
        columns={columns}
        data={filteredCortes}
        keyExtractor={(corte) => corte.id}
        onRowClick={handleViewCorte}
        emptyState={
          <EmptyState
            icon={Calendar}
            title="Sin cortes"
            description="Crea un corte para agrupar solicitudes aprobadas"
          />
        }
      />

      {/* New Corte Modal */}
      <Dialog open={isNewCorteOpen} onOpenChange={setIsNewCorteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo Corte Semanal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nombre del corte</Label>
              <Input
                value={newCorteNombre}
                onChange={(e) => setNewCorteNombre(e.target.value)}
                placeholder="Ej: Semana 1 - Enero 2026"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fecha inicio</Label>
                <Input
                  type="date"
                  value={newCorteFechaInicio}
                  onChange={(e) => setNewCorteFechaInicio(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Fecha fin</Label>
                <Input
                  type="date"
                  value={newCorteFechaFin}
                  onChange={(e) => setNewCorteFechaFin(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewCorteOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateCorte} disabled={savingCorte || !newCorteNombre}>
              {savingCorte ? 'Creando...' : 'Crear Corte'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Corte Detail Modal */}
      <Dialog open={!!viewingCorte} onOpenChange={(open) => !open && setViewingCorte(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              {viewingCorte?.nombre}
              {viewingCorte?.estado === 'cerrado' && (
                <Lock className="w-4 h-4 text-muted-foreground" />
              )}
            </DialogTitle>
          </DialogHeader>
          
          {loadingDetail ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="space-y-6 py-4">
              {/* Resumen por instalador */}
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Resumen por Instalador
                </h3>
                {resumenInstaladores.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No hay solicitudes en este corte</p>
                ) : (
                  <div className="space-y-2">
                    {resumenInstaladores.map((instalador) => (
                      <div key={instalador.id} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                        <div>
                          <span className="font-medium">{instalador.nombre}</span>
                          <span className="text-sm text-muted-foreground ml-2">
                            ({instalador.solicitudes.length} solicitudes)
                          </span>
                        </div>
                        <span className="font-semibold text-primary">{formatCurrency(instalador.total)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg border border-primary/20">
                      <span className="font-semibold">Total del Corte</span>
                      <span className="font-bold text-lg text-primary">
                        {formatCurrency(resumenInstaladores.reduce((sum, i) => sum + i.total, 0))}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Solicitudes asignadas */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Solicitudes en el Corte</h3>
                {corteSolicitudes.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No hay solicitudes asignadas</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {corteSolicitudes.map((sol) => (
                      <div key={sol.id} className="flex justify-between items-center p-2 border rounded-lg">
                        <div className="flex-1">
                          <div className="font-medium text-sm">{sol.obras?.nombre}</div>
                          <div className="text-xs text-muted-foreground">
                            {sol.instaladores?.nombre} • {sol.tipo}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{formatCurrency(Number(sol.total_solicitado))}</span>
                          {viewingCorte?.estado === 'abierto' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveSolicitudFromCorte(sol.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              Quitar
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Solicitudes disponibles (solo si corte abierto) */}
              {viewingCorte?.estado === 'abierto' && solicitudesDisponibles.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Solicitudes Disponibles</h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {solicitudesDisponibles.map((sol) => (
                      <div key={sol.id} className="flex justify-between items-center p-2 border border-dashed rounded-lg">
                        <div className="flex-1">
                          <div className="font-medium text-sm">{sol.obras?.nombre}</div>
                          <div className="text-xs text-muted-foreground">
                            {sol.instaladores?.nombre} • {sol.tipo}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{formatCurrency(Number(sol.total_solicitado))}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAddSolicitudToCorte(sol.id)}
                          >
                            Agregar
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 flex-wrap">
            <Button variant="outline" onClick={() => setViewingCorte(null)}>
              Cerrar
            </Button>
            {resumenInstaladores.length > 0 && (
              <Button 
                variant="secondary" 
                onClick={handleExportExcel}
                disabled={exporting}
              >
                <Download className="w-4 h-4 mr-2" />
                {exporting ? 'Generando...' : 'Descargar Excel'}
              </Button>
            )}
            {viewingCorte?.estado === 'cerrado' && resumenInstaladores.length > 0 && (
              <Button 
                variant="secondary" 
                onClick={handleGenerateBatchPDFs}
                disabled={generatingPDFs}
              >
                <FileText className="w-4 h-4 mr-2" />
                {generatingPDFs ? 'Generando...' : 'Comprobantes PDF'}
              </Button>
            )}
            {viewingCorte?.estado === 'cerrado' && (
              <Button 
                variant="destructive" 
                onClick={() => setConfirmReopen(true)}
              >
                <Unlock className="w-4 h-4 mr-2" />
                Reabrir Corte
              </Button>
            )}
            {viewingCorte?.estado === 'abierto' && corteSolicitudes.length > 0 && (
              <Button onClick={() => setConfirmClose(true)}>
                <Lock className="w-4 h-4 mr-2" />
                Cerrar Corte y Generar Pagos
              </Button>
            )}
            {viewingCorte && (viewingCorte.total_monto === 0 || viewingCorte.total_calculated === 0) && corteSolicitudes.length === 0 && (
              <Button 
                variant="destructive" 
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Eliminar Corte
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Close Corte Dialog */}
      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cerrar corte y generar pagos?</AlertDialogTitle>
            <AlertDialogDescription>
              Se generarán pagos consolidados por instalador. Esta acción no se puede deshacer.
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <p className="font-medium mb-2">Resumen:</p>
                <ul className="text-sm space-y-1">
                  {resumenInstaladores.map((inst) => (
                    <li key={inst.id} className="flex justify-between">
                      <span>{inst.nombre}</span>
                      <span className="font-medium">{formatCurrency(inst.total)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-4">
                <Label className="mb-2 block">Método de pago</Label>
                <Select value={metodoPago} onValueChange={(v) => setMetodoPago(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transferencia">Transferencia</SelectItem>
                    <SelectItem value="efectivo">Efectivo</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={closingCorte}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCloseCorte} disabled={closingCorte}>
              {closingCorte ? 'Procesando...' : 'Confirmar y Generar Pagos'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Reopen Corte Dialog */}
      <AlertDialog open={confirmReopen} onOpenChange={setConfirmReopen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Reabrir corte?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán todos los pagos generados por este corte y las solicitudes volverán a estado pendiente.
              <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="font-medium text-destructive mb-2">Esta acción eliminará:</p>
                <ul className="text-sm space-y-1">
                  <li>• Todos los pagos vinculados a este corte</li>
                  <li>• Los anticipos generados (si aplica)</li>
                </ul>
              </div>
              <div className="mt-3 p-3 bg-muted rounded-lg">
                <p className="font-medium mb-2">Solicitudes que volverán a pendiente:</p>
                <ul className="text-sm space-y-1">
                  {resumenInstaladores.map((inst) => (
                    <li key={inst.id} className="flex justify-between">
                      <span>{inst.nombre}</span>
                      <span className="font-medium">{formatCurrency(inst.total)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reopeningCorte}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleReopenCorte} 
              disabled={reopeningCorte}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {reopeningCorte ? 'Reabriendo...' : 'Sí, Reabrir Corte'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Delete Corte Dialog */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar corte vacío?</AlertDialogTitle>
            <AlertDialogDescription>
              Este corte no tiene solicitudes ni pagos asociados. 
              Se eliminará permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingCorte}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteCorte} 
              disabled={deletingCorte}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingCorte ? 'Eliminando...' : 'Sí, Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
