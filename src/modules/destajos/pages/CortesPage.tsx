import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Plus, Lock, Search, Users, Unlock, Download, FileText, Trash2, CheckCircle, Minus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { PageHeader, DataTable, EmptyState, StatusBadge } from '../components';
import { useExportCorteExcel } from '../hooks/useExportCorteExcel';
import { useGenerateBatchPDF } from '../hooks/useGenerateBatchPDF';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
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
import { format, startOfWeek, endOfWeek, getWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import type { CorteSemanal, SolicitudPago } from '../types';

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
  banco: string;
  clabe: string;
  salarioSemanal: number;
  destajoAcumulado: number;
  anticiposEnCorte: number; // Anticipos in this cut to be applied
  saldoAnterior: number;
  destajoADepositar: number;
  aDepositar: number;
  saldoGenerado: number;
  solicitudes: SolicitudForCorte[];
  total: number; // Alias for aDepositar for backwards compatibility
}

import { useSubmodulePermissions } from '@/hooks/useSubmodulePermissions';

export default function CortesPage() {
  const { user, loading } = useAuth();
  const { canCreate } = useSubmodulePermissions('destajos', 'cortes');
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
  const [solicitudesPendientes, setSolicitudesPendientes] = useState<SolicitudForCorte[]>([]);
  const [resumenInstaladores, setResumenInstaladores] = useState<InstaladorResumen[]>([]);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [filterInstaladorId, setFilterInstaladorId] = useState<string>('todos');
  const [loadingDetail, setLoadingDetail] = useState(false);
  
  // Inline salary editing
  const [salarioEdits, setSalarioEdits] = useState<Record<string, number>>({});
  const [savingSalarioId, setSavingSalarioId] = useState<string | null>(null);
  
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
  
  // Tab for main view
  const [activeTab, setActiveTab] = useState<string>('cortes');
  
  // Available approved solicitudes (not in any corte) for standalone tab
  const [solicitudesAprobadasDisponibles, setSolicitudesAprobadasDisponibles] = useState<SolicitudForCorte[]>([]);
  const [solicitudesPendientesGlobal, setSolicitudesPendientesGlobal] = useState<SolicitudForCorte[]>([]);
  const [loadingDisponibles, setLoadingDisponibles] = useState(false);
  const [searchDisponibles, setSearchDisponibles] = useState('');
  const [filterInstaladorDisponibles, setFilterInstaladorDisponibles] = useState<string>('todos');
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  
  // Bulk removal selection
  const [selectedForRemoval, setSelectedForRemoval] = useState<Set<string>>(new Set());
  const [removingBulk, setRemovingBulk] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchCortes();
      // Also fetch disponibles and pendientes for the banner counters
      fetchSolicitudesDisponiblesCount();
      fetchSolicitudesPendientesCount();
    }
  }, [user]);

  // Quick fetch just for count (used on mount)
  const fetchSolicitudesDisponiblesCount = async () => {
    try {
      const { data, error } = await supabase
        .from('solicitudes_pago')
        .select(`
          *,
          obras(nombre),
          instaladores(nombre)
        `)
        .eq('estado', 'aprobada')
        .is('corte_id', null);
      
      if (error) throw error;
      setSolicitudesAprobadasDisponibles((data || []) as SolicitudForCorte[]);
    } catch (error) {
      console.error('Error fetching solicitudes count:', error);
    }
  };

  // Quick fetch for pending count (used on mount)
  const fetchSolicitudesPendientesCount = async () => {
    try {
      const { data, error } = await supabase
        .from('solicitudes_pago')
        .select(`
          *,
          obras(nombre),
          instaladores(nombre)
        `)
        .eq('estado', 'pendiente')
        .is('corte_id', null);
      
      if (error) throw error;
      setSolicitudesPendientesGlobal((data || []) as SolicitudForCorte[]);
    } catch (error) {
      console.error('Error fetching pendientes count:', error);
    }
  };

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

  const fetchSolicitudesDisponibles = async () => {
    try {
      setLoadingDisponibles(true);
      
      const { data, error } = await supabase
        .from('solicitudes_pago')
        .select(`
          *,
          obras(nombre),
          instaladores(nombre)
        `)
        .eq('estado', 'aprobada')
        .is('corte_id', null)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      setSolicitudesAprobadasDisponibles((data || []) as SolicitudForCorte[]);
    } catch (error) {
      console.error('Error fetching solicitudes disponibles:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las solicitudes disponibles',
        variant: 'destructive',
      });
    } finally {
      setLoadingDisponibles(false);
    }
  };

  // Cancel an approved solicitud (revert to pendiente)
  const handleCancelSolicitudAprobada = async (solicitud: SolicitudForCorte) => {
    try {
      setCancelingId(solicitud.id);

      // Si era anticipo, asegúrate de no dejarlo como “disponible” si aún no se pagó.
      // (Si no existe, no pasa nada.)
      if (solicitud.tipo === 'anticipo') {
        const { error: delAnticipoError } = await supabase
          .from('anticipos')
          .delete()
          .eq('solicitud_pago_id', solicitud.id);

        if (delAnticipoError) throw delAnticipoError;
      }
      
      // Revert solicitud to pendiente
      const { data, error } = await supabase
        .from('solicitudes_pago')
        .update({ 
          estado: 'pendiente',
          aprobado_por: null,
          fecha_aprobacion: null
        })
        .eq('id', solicitud.id)
        .select()
        .single();
      
      if (error) throw error;
      if (!data) throw new Error('No se pudo actualizar la solicitud');
      
      // If it was an extra type, also revert the extras
      if (solicitud.tipo === 'extra' && solicitud.extras_ids && solicitud.extras_ids.length > 0) {
        const { error: extrasError } = await supabase
          .from('extras')
          .update({
            estado: 'pendiente',
            aprobado_por: null,
            fecha_aprobacion: null
          })
          .in('id', solicitud.extras_ids);
        
        if (extrasError) throw extrasError;
      }
      
      toast({
        title: 'Solicitud cancelada',
        description: 'La solicitud fue regresada a estado pendiente',
      });
      
      // Refresh the list
      fetchSolicitudesDisponibles();
      fetchSolicitudesDisponiblesCount();
    } catch (error) {
      console.error('Error canceling solicitud:', error);
      toast({
        title: 'Error',
        description: 'No se pudo cancelar la solicitud',
        variant: 'destructive',
      });
    } finally {
      setCancelingId(null);
    }
  };

  // Fetch solicitudes disponibles when tab changes
  useEffect(() => {
    if (user && activeTab === 'disponibles') {
      fetchSolicitudesDisponibles();
    }
  }, [user, activeTab]);

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
      
      // First, get all approved solicitudes without a corte
      const { data: disponibles, error: disponiblesError } = await supabase
        .from('solicitudes_pago')
        .select('id')
        .eq('estado', 'aprobada')
        .is('corte_id', null);
      
      if (disponiblesError) throw disponiblesError;
      
      // Create the corte
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
      
      // Assign all available solicitudes to the new corte
      const solicitudIds = (disponibles || []).map(s => s.id);
      if (solicitudIds.length > 0) {
        const { error: assignError } = await supabase
          .from('solicitudes_pago')
          .update({ corte_id: data.id })
          .in('id', solicitudIds);
        
        if (assignError) throw assignError;
      }
      
      toast({
        title: 'Éxito',
        description: solicitudIds.length > 0 
          ? `Corte creado con ${solicitudIds.length} solicitud${solicitudIds.length !== 1 ? 'es' : ''} asignada${solicitudIds.length !== 1 ? 's' : ''}`
          : 'Corte creado correctamente',
      });
      
      setIsNewCorteOpen(false);
      fetchCortes();
      fetchSolicitudesDisponiblesCount(); // Update the badge
      
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
      
      // If corte is open, fetch available solicitudes (approved, no corte assigned) and pending ones
      if (corte.estado === 'abierto') {
        // Fetch approved solicitudes without corte
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
        
        // Fetch pending solicitudes (not yet approved)
        const { data: pendientes, error: pendientesError } = await supabase
          .from('solicitudes_pago')
          .select(`
            *,
            obras(nombre),
            instaladores(nombre)
          `)
          .eq('estado', 'pendiente')
          .is('corte_id', null)
          .order('created_at', { ascending: false });
        
        if (pendientesError) throw pendientesError;
        
        setSolicitudesPendientes((pendientes || []) as SolicitudForCorte[]);
      } else {
        setSolicitudesDisponibles([]);
        setSolicitudesPendientes([]);
      }
      
      // Fetch ALL active instaladores
      const { data: allInstaladores, error: instError } = await supabase
        .from('instaladores')
        .select('id, nombre, nombre_banco, numero_cuenta, salario_semanal')
        .eq('activo', true)
        .order('nombre');
      
      if (instError) throw instError;
      
      // Fetch saldos from previous cortes
      const { data: saldosData } = await supabase
        .from('saldos_instaladores')
        .select('instalador_id, saldo_acumulado');
      
      const saldosMap: Record<string, number> = {};
      (saldosData || []).forEach((s: any) => {
        saldosMap[s.instalador_id] = Number(s.saldo_acumulado) || 0;
      });
      
      // If corte is closed, fetch corte_instaladores for historical data
      let corteInstaladoresMap: Record<string, any> = {};
      if (corte.estado === 'cerrado') {
        const { data: ciData } = await supabase
          .from('corte_instaladores')
          .select('*')
          .eq('corte_id', corte.id);
        
        (ciData || []).forEach((ci: any) => {
          corteInstaladoresMap[ci.instalador_id] = ci;
        });
      }
      
      // Build resumen for ALL active instaladores
      const resumenMap: Record<string, InstaladorResumen> = {};
      
      // First, initialize all active instaladores
      (allInstaladores || []).forEach((inst: any) => {
        resumenMap[inst.id] = {
          id: inst.id,
          nombre: inst.nombre || 'Sin nombre',
          banco: inst.nombre_banco || '',
          clabe: inst.numero_cuenta || '',
          salarioSemanal: Number(inst.salario_semanal) || 0,
          destajoAcumulado: 0,
          anticiposEnCorte: 0,
          saldoAnterior: saldosMap[inst.id] || 0,
          destajoADepositar: 0,
          aDepositar: 0,
          saldoGenerado: 0,
          total: 0,
          solicitudes: [],
        };
      });
      
      // Add solicitudes to their instaladores
      // Anticipos are tracked separately and will be subtracted from the payment
      (asignadas || []).forEach((sol: any) => {
        const instaladorId = sol.instalador_id;
        if (resumenMap[instaladorId]) {
          if (sol.tipo === 'anticipo') {
            // Anticipos are money already given, track separately to subtract from payment
            resumenMap[instaladorId].anticiposEnCorte += Number(sol.total_solicitado);
          } else {
            // Regular solicitudes add to destajo
            resumenMap[instaladorId].destajoAcumulado += Number(sol.total_solicitado);
          }
          resumenMap[instaladorId].solicitudes.push(sol);
        }
      });
      
      // Calculate derived fields for each instalador
      Object.values(resumenMap).forEach((inst) => {
        if (corte.estado === 'cerrado' && corteInstaladoresMap[inst.id]) {
          // Use historical data from corte_instaladores (frozen at close time)
          const ci = corteInstaladoresMap[inst.id];
          inst.destajoAcumulado = Number(ci.destajo_acumulado);
          inst.salarioSemanal = Number(ci.salario_semanal); // Use historical salary
          inst.saldoAnterior = Number(ci.saldo_anterior);
          inst.destajoADepositar = Math.max(0, inst.destajoAcumulado - inst.salarioSemanal + inst.saldoAnterior);
          inst.aDepositar = Number(ci.monto_depositado);
          inst.saldoGenerado = Number(ci.saldo_generado);
        } else {
          // Calculate in real-time for open cortes
          // basePago = destajo - salario + saldo anterior - anticipos en este corte
          const basePago = inst.destajoAcumulado - inst.salarioSemanal + inst.saldoAnterior - inst.anticiposEnCorte;
          
          if (basePago >= 0) {
            inst.destajoADepositar = basePago;
            inst.aDepositar = Math.floor(basePago / 50) * 50;
            inst.saldoGenerado = 0; // No saldo a favor cuando destajo cubre o supera salario
          } else {
            // Salario mayor que destajo (después de anticipos) - se genera saldo a favor
            inst.destajoADepositar = 0;
            inst.aDepositar = 0;
            inst.saldoGenerado = Math.max(0, inst.salarioSemanal - inst.destajoAcumulado + inst.anticiposEnCorte);
          }
        }
      });
      
      // Sort: instaladores with destajo first, then by name
      setResumenInstaladores(
        Object.values(resumenMap).sort((a, b) => {
          if (a.destajoAcumulado > 0 && b.destajoAcumulado === 0) return -1;
          if (a.destajoAcumulado === 0 && b.destajoAcumulado > 0) return 1;
          return a.nombre.localeCompare(b.nombre);
        })
      );
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

  const handleApproveAndAddToCorte = async (solicitud: SolicitudForCorte) => {
    if (!viewingCorte || !user) return;
    
    try {
      setApprovingId(solicitud.id);
      
      // Update solicitud to approved and assign to corte
      const { error } = await supabase
        .from('solicitudes_pago')
        .update({ 
          estado: 'aprobada',
          aprobado_por: user.id,
          fecha_aprobacion: new Date().toISOString(),
          corte_id: viewingCorte.id
        })
        .eq('id', solicitud.id);
      
      if (error) throw error;
      
      // If it's an extra type, also update the extras table
      if (solicitud.tipo === 'extra' && solicitud.extras_ids && solicitud.extras_ids.length > 0) {
        const { error: extrasError } = await supabase
          .from('extras')
          .update({
            estado: 'aprobado',
            aprobado_por: user.id,
            fecha_aprobacion: new Date().toISOString()
          })
          .in('id', solicitud.extras_ids);
        
        if (extrasError) throw extrasError;
      }
      
      // If it's an anticipo type, create the anticipo record
      if (solicitud.tipo === 'anticipo') {
        // Check if anticipo already exists for this solicitud
        const { data: existingAnticipo } = await supabase
          .from('anticipos')
          .select('id')
          .eq('solicitud_pago_id', solicitud.id)
          .maybeSingle();
        
        if (!existingAnticipo) {
          const { error: anticipoError } = await supabase
            .from('anticipos')
            .insert({
              obra_id: solicitud.obra_id,
              instalador_id: solicitud.instalador_id,
              monto_original: solicitud.total_solicitado,
              monto_disponible: solicitud.total_solicitado,
              registrado_por: user.id,
              solicitud_pago_id: solicitud.id,
              observaciones: solicitud.observaciones || 'Anticipo aprobado desde corte'
            });
          
          if (anticipoError) throw anticipoError;
        }
      }
      
      toast({
        title: 'Éxito',
        description: 'Solicitud aprobada y agregada al corte',
      });
      
      // Refresh detail
      handleViewCorte(viewingCorte);
    } catch (error) {
      console.error('Error approving and adding solicitud:', error);
      toast({
        title: 'Error',
        description: 'No se pudo aprobar la solicitud',
        variant: 'destructive',
      });
    } finally {
      setApprovingId(null);
    }
  };

  const removeSolicitudFromCorteInternal = async (solicitudId: string): Promise<boolean> => {
    try {
      // Get solicitud details first to check type and extras
      const { data: solicitud, error: fetchError } = await supabase
        .from('solicitudes_pago')
        .select('tipo, extras_ids')
        .eq('id', solicitudId)
        .single();
      
      if (fetchError) throw fetchError;
      
      // If it's an anticipo, delete the associated anticipo record
      if (solicitud?.tipo === 'anticipo') {
        const { error: deleteAnticipoError } = await supabase
          .from('anticipos')
          .delete()
          .eq('solicitud_pago_id', solicitudId);
        
        if (deleteAnticipoError) throw deleteAnticipoError;
      }
      
      // If it has extras, revert them to pendiente
      if (solicitud?.extras_ids && solicitud.extras_ids.length > 0) {
        const { error: extrasError } = await supabase
          .from('extras')
          .update({
            estado: 'pendiente',
            aprobado_por: null,
            fecha_aprobacion: null,
          })
          .in('id', solicitud.extras_ids);
        
        if (extrasError) throw extrasError;
      }
      
      // Revert solicitud to pendiente
      const { error } = await supabase
        .from('solicitudes_pago')
        .update({ 
          corte_id: null,
          estado: 'pendiente',
          aprobado_por: null,
          fecha_aprobacion: null
        })
        .eq('id', solicitudId);
      
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error removing solicitud:', solicitudId, error);
      return false;
    }
  };

  const handleRemoveSolicitudFromCorte = async (solicitudId: string) => {
    if (!viewingCorte) return;
    
    try {
      const success = await removeSolicitudFromCorteInternal(solicitudId);
      if (!success) throw new Error('Failed to remove');
      
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
        setSelectedForRemoval(new Set());
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

  const handleBulkRemoveFromCorte = async () => {
    if (!viewingCorte || selectedForRemoval.size === 0) return;
    
    setRemovingBulk(true);
    try {
      const ids = Array.from(selectedForRemoval);
      let successCount = 0;
      
      for (const id of ids) {
        const success = await removeSolicitudFromCorteInternal(id);
        if (success) successCount++;
      }
      
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
          description: `Se removieron ${successCount} solicitudes y el corte fue eliminado`,
        });
        
        setViewingCorte(null);
        setSelectedForRemoval(new Set());
        fetchCortes();
        return;
      }
      
      toast({
        title: 'Éxito',
        description: `Se removieron ${successCount} solicitudes del corte`,
      });
      
      setSelectedForRemoval(new Set());
      handleViewCorte(viewingCorte);
    } catch (error) {
      console.error('Error in bulk removal:', error);
      toast({
        title: 'Error',
        description: 'Hubo un error al remover las solicitudes',
        variant: 'destructive',
      });
    } finally {
      setRemovingBulk(false);
    }
  };

  const toggleSolicitudSelection = (solicitudId: string) => {
    setSelectedForRemoval(prev => {
      const next = new Set(prev);
      if (next.has(solicitudId)) {
        next.delete(solicitudId);
      } else {
        next.add(solicitudId);
      }
      return next;
    });
  };

  const toggleSelectAllSolicitudes = () => {
    if (selectedForRemoval.size === corteSolicitudes.length) {
      setSelectedForRemoval(new Set());
    } else {
      setSelectedForRemoval(new Set(corteSolicitudes.map(s => s.id)));
    }
  };

  const handleCloseCorte = async () => {
    if (!viewingCorte || !user) return;
    
    // Calculate values with edited salaries for each instalador (including anticipos)
    const instaladoresCalculados = resumenInstaladores.map(inst => {
      const salario = salarioEdits[inst.id] ?? inst.salarioSemanal;
      // basePago = destajo - salario + saldo anterior - anticipos en este corte
      const basePago = inst.destajoAcumulado - salario + inst.saldoAnterior - inst.anticiposEnCorte;
      
      if (basePago >= 0) {
        return {
          ...inst,
          salarioSemanal: salario,
          destajoADepositar: basePago,
          aDepositar: Math.floor(basePago / 50) * 50,
          saldoGenerado: 0,
        };
      } else {
        return {
          ...inst,
          salarioSemanal: salario,
          destajoADepositar: 0,
          aDepositar: 0,
          saldoGenerado: Math.max(0, salario - inst.destajoAcumulado + inst.anticiposEnCorte),
        };
      }
    });
    
    // Check if there are any instaladores with aDepositar > 0 or saldoGenerado > 0
    const instaladoresConPago = instaladoresCalculados.filter(i => i.aDepositar > 0 || i.saldoGenerado > 0);
    if (instaladoresConPago.length === 0 && corteSolicitudes.length === 0) {
      toast({
        title: 'Error',
        description: 'No hay pagos ni saldos para procesar',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      setClosingCorte(true);
      
      // Update salaries in instaladores table if they changed
      for (const inst of resumenInstaladores) {
        const editedSalario = salarioEdits[inst.id];
        if (editedSalario !== undefined && editedSalario !== inst.salarioSemanal) {
          const { error } = await supabase
            .from('instaladores')
            .update({ salario_semanal: editedSalario })
            .eq('id', inst.id);
          
          if (error) throw error;
        }
      }
      
      // Group solicitudes by instalador and obra for payment generation
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
      
      // Process each active instalador (use calculated values)
      let pagosGenerados = 0;
      const totalADepositar = instaladoresCalculados.reduce((sum, i) => sum + i.aDepositar, 0);
      
      for (const inst of instaladoresCalculados) {
        // Save corte_instaladores record for historical data
        const { error: ciError } = await supabase
          .from('corte_instaladores')
          .insert({
            corte_id: viewingCorte.id,
            instalador_id: inst.id,
            destajo_acumulado: inst.destajoAcumulado,
            salario_semanal: inst.salarioSemanal,
            saldo_anterior: inst.saldoAnterior,
            saldo_generado: inst.saldoGenerado,
            monto_depositado: inst.aDepositar,
          });
        
        if (ciError) throw ciError;
        
        // Update or create saldo_instalador record
        const nuevoSaldo = inst.saldoGenerado; // Saldo generado becomes the new accumulated saldo
        
        const { error: saldoError } = await supabase
          .from('saldos_instaladores')
          .upsert({
            instalador_id: inst.id,
            saldo_acumulado: nuevoSaldo,
            ultimo_corte_id: viewingCorte.id,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'instalador_id'
          });
        
        if (saldoError) throw saldoError;
        
        // Create pagos for each obra based on the FULL destajo amount (not net after salary)
        // Salaries are an installer concern, not an obra accounting concern
        const instSolicitudes = corteSolicitudes.filter(
          s => s.instalador_id === inst.id && s.tipo !== 'anticipo'
        );
        
        if (instSolicitudes.length > 0) {
          // Group solicitudes by obra and calculate totals
          const obraMontos: Record<string, number> = {};
          instSolicitudes.forEach(sol => {
            if (!obraMontos[sol.obra_id]) {
              obraMontos[sol.obra_id] = 0;
            }
            obraMontos[sol.obra_id] += Number(sol.total_solicitado);
          });
          
          // Create a payment record for each obra with the FULL destajo amount
          for (const obraId of Object.keys(obraMontos)) {
            const montoPago = obraMontos[obraId];
            
            if (montoPago > 0) {
              const { error: pagoError } = await supabase
                .from('pagos_destajos')
                .insert({
                  obra_id: obraId,
                  instalador_id: inst.id,
                  monto: montoPago,
                  metodo_pago: metodoPago,
                  corte_id: viewingCorte.id,
                  registrado_por: user.id,
                  observaciones: `Pago de corte: ${viewingCorte.nombre}`,
                });
              
              if (pagoError) throw pagoError;
              pagosGenerados++;
            }
          }
        }
      }
      
      // CRITICAL: Update all solicitudes in this corte to 'aprobada' status
      const solicitudIds = corteSolicitudes.map(s => s.id);
      if (solicitudIds.length > 0) {
        const { error: updateSolError } = await supabase
          .from('solicitudes_pago')
          .update({
            estado: 'aprobada',
            aprobado_por: user.id,
            fecha_aprobacion: new Date().toISOString(),
          })
          .in('id', solicitudIds);
        
        if (updateSolError) throw updateSolError;
        
        // Also update related extras to 'aprobado'
        const allExtrasIds = corteSolicitudes
          .flatMap(s => s.extras_ids || [])
          .filter(Boolean);
        
        if (allExtrasIds.length > 0) {
          const { error: extrasError } = await supabase
            .from('extras')
            .update({
              estado: 'aprobado',
              aprobado_por: user.id,
              fecha_aprobacion: new Date().toISOString(),
            })
            .in('id', allExtrasIds);
          
          if (extrasError) throw extrasError;
        }
        
        // Create anticipos for anticipo-type solicitudes that don't have one yet
        const anticipoSolicitudes = corteSolicitudes.filter(s => s.tipo === 'anticipo');
        for (const sol of anticipoSolicitudes) {
          // Check if anticipo already exists for this solicitud
          const { data: existingAnticipo } = await supabase
            .from('anticipos')
            .select('id')
            .eq('solicitud_pago_id', sol.id)
            .maybeSingle();
          
          if (!existingAnticipo) {
            const { error: anticipoError } = await supabase
              .from('anticipos')
              .insert({
                instalador_id: sol.instalador_id,
                obra_id: sol.obra_id,
                monto_original: sol.total_solicitado,
                monto_disponible: sol.total_solicitado,
                registrado_por: user.id,
                solicitud_pago_id: sol.id,
                observaciones: `Anticipo generado al cerrar corte: ${viewingCorte.nombre}`,
              });
            
            if (anticipoError) {
              console.error('Error creating anticipo:', anticipoError);
            }
          }
        }
      }
      
      // Update corte status
      const { error: corteError } = await supabase
        .from('cortes_semanales')
        .update({
          estado: 'cerrado',
          total_monto: totalADepositar,
          cerrado_por: user.id,
          fecha_cierre: new Date().toISOString(),
        })
        .eq('id', viewingCorte.id);
      
      if (corteError) throw corteError;
      
      toast({
        title: 'Éxito',
        description: `Corte cerrado. Se generaron ${pagosGenerados} pagos por un total de ${formatCurrency(totalADepositar)}`,
      });
      
      setConfirmClose(false);
      setViewingCorte(null);
      setSelectedForRemoval(new Set());
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
      
      // Get corte_instaladores to revert saldos
      const { data: ciData, error: ciError } = await supabase
        .from('corte_instaladores')
        .select('*')
        .eq('corte_id', viewingCorte.id);
      
      if (ciError) throw ciError;
      
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
      
      // Revert saldos - restore saldo_anterior values
      for (const ci of (ciData || [])) {
        const { error: saldoError } = await supabase
          .from('saldos_instaladores')
          .upsert({
            instalador_id: ci.instalador_id,
            saldo_acumulado: ci.saldo_anterior,
            ultimo_corte_id: null,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'instalador_id'
          });
        
        if (saldoError) throw saldoError;
      }
      
      // Delete corte_instaladores records
      const { error: deleteCiError } = await supabase
        .from('corte_instaladores')
        .delete()
        .eq('corte_id', viewingCorte.id);
      
      if (deleteCiError) throw deleteCiError;
      
      // Delete all pagos linked to this corte
      if (pagosData && pagosData.length > 0) {
        const { error: deleteError } = await supabase
          .from('pagos_destajos')
          .delete()
          .eq('corte_id', viewingCorte.id);
        
        if (deleteError) throw deleteError;
      }
      
      // NOTE: Do NOT revert solicitudes to 'pendiente' here.
      // Solicitudes keep their 'aprobada' status when reopening a corte.
      // They only revert to 'pendiente' when manually removed from the corte.
      // Anticipos and extras also stay approved - they were created at approval time.
      
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
        description: `Se eliminaron ${pagosData?.length || 0} pagos y se revirtieron los saldos`,
      });
      
      setConfirmReopen(false);
      setViewingCorte(null);
      setSelectedForRemoval(new Set());
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
      
      // Get all solicitudes linked to this corte before deletion
      const { data: solicitudesData, error: solicitudesError } = await supabase
        .from('solicitudes_pago')
        .select('id, tipo, extras_ids')
        .eq('corte_id', viewingCorte.id);
      
      if (solicitudesError) throw solicitudesError;
      
      // Delete anticipos created from anticipo-type solicitudes in this corte
      if (solicitudesData && solicitudesData.length > 0) {
        const anticipoSolicitudes = solicitudesData.filter(s => s.tipo === 'anticipo');
        if (anticipoSolicitudes.length > 0) {
          const anticipoSolIds = anticipoSolicitudes.map(s => s.id);
          const { error: deleteAnticiposError } = await supabase
            .from('anticipos')
            .delete()
            .in('solicitud_pago_id', anticipoSolIds);
          
          if (deleteAnticiposError) throw deleteAnticiposError;
        }
        
        // Revert extras to pendiente
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
        
        // Revert all solicitudes to pendiente
        const { error: revertError } = await supabase
          .from('solicitudes_pago')
          .update({
            corte_id: null,
            estado: 'pendiente',
            aprobado_por: null,
            fecha_aprobacion: null,
          })
          .eq('corte_id', viewingCorte.id);
        
        if (revertError) throw revertError;
      }
      
      // Now delete the corte
      const { error } = await supabase
        .from('cortes_semanales')
        .delete()
        .eq('id', viewingCorte.id);
      
      if (error) throw error;
      
      toast({
        title: 'Éxito',
        description: 'Corte eliminado y solicitudes revertidas a pendiente',
      });
      
      setConfirmDelete(false);
      setViewingCorte(null);
      setSelectedForRemoval(new Set());
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

  // Calculate values with edited salaries for nomina config preview
  const getCalculatedValues = (inst: InstaladorResumen) => {
    const salario = salarioEdits[inst.id] ?? inst.salarioSemanal;
    const basePago = inst.destajoAcumulado - salario + inst.saldoAnterior;
    
    if (basePago >= 0) {
      return {
        salario,
        destajoADepositar: basePago,
        aDepositar: Math.floor(basePago / 50) * 50,
        saldoGenerado: 0,
      };
    } else {
      return {
        salario,
        destajoADepositar: 0,
        aDepositar: 0,
        saldoGenerado: Math.max(0, salario - inst.destajoAcumulado),
      };
    }
  };

  // Handle inline salary save (on blur)
  const handleSaveSalario = async (instaladorId: string) => {
    const newSalario = salarioEdits[instaladorId];
    if (newSalario === undefined) return;
    
    const inst = resumenInstaladores.find(i => i.id === instaladorId);
    if (!inst || newSalario === inst.salarioSemanal) return;
    
    try {
      setSavingSalarioId(instaladorId);
      
      const { error } = await supabase
        .from('instaladores')
        .update({ salario_semanal: newSalario })
        .eq('id', instaladorId);
      
      if (error) throw error;
      
      // Recalculate and update local state (including anticipos)
      setResumenInstaladores(prev => 
        prev.map(i => {
          if (i.id !== instaladorId) return i;
          
          // basePago = destajo - salario + saldo anterior - anticipos en este corte
          const basePago = i.destajoAcumulado - newSalario + i.saldoAnterior - i.anticiposEnCorte;
          
          if (basePago >= 0) {
            return {
              ...i,
              salarioSemanal: newSalario,
              destajoADepositar: basePago,
              aDepositar: Math.floor(basePago / 50) * 50,
              saldoGenerado: 0,
              total: Math.floor(basePago / 50) * 50,
            };
          } else {
            const saldo = Math.max(0, newSalario - i.destajoAcumulado + i.anticiposEnCorte);
            return {
              ...i,
              salarioSemanal: newSalario,
              destajoADepositar: 0,
              aDepositar: 0,
              saldoGenerado: saldo,
              total: 0,
            };
          }
        })
      );
      
      toast({
        title: 'Salario actualizado',
        description: `${inst.nombre}: ${formatCurrency(newSalario)}`,
      });
    } catch (error) {
      console.error('Error updating salary:', error);
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el salario',
        variant: 'destructive',
      });
    } finally {
      setSavingSalarioId(null);
    }
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
        <StatusBadge status={corte.estado} />
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

  // Get unique instaladores from available solicitudes for filter
  const instaladoresDisponibles = Array.from(
    new Map(
      solicitudesAprobadasDisponibles.map(s => [s.instalador_id, s.instaladores?.nombre || 'Desconocido'])
    )
  );

  // Filter solicitudes disponibles
  const filteredSolicitudesDisponibles = solicitudesAprobadasDisponibles.filter(sol => {
    const matchesSearch = 
      (sol.obras?.nombre || '').toLowerCase().includes(searchDisponibles.toLowerCase()) ||
      (sol.instaladores?.nombre || '').toLowerCase().includes(searchDisponibles.toLowerCase());
    const matchesInstalador = filterInstaladorDisponibles === 'todos' || sol.instalador_id === filterInstaladorDisponibles;
    return matchesSearch && matchesInstalador;
  });

  // Calculate total of available solicitudes
  const totalDisponibles = solicitudesAprobadasDisponibles.reduce((sum, s) => sum + Number(s.total_solicitado), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cortes Semanales"
        description="Agrupa solicitudes aprobadas para generar pagos consolidados"
        icon={Calendar}
        actions={
          canCreate && (
            <Button onClick={openNewCorteModal}>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Corte
            </Button>
          )
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="cortes">Cortes</TabsTrigger>
          <TabsTrigger value="disponibles" className="flex items-center gap-2">
            Disponibles
            {solicitudesAprobadasDisponibles.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {solicitudesAprobadasDisponibles.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cortes" className="space-y-4 mt-4">
          {/* Summary banners - clickable to open/create corte */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Pending approval banner */}
            <button
              onClick={() => navigate('/destajos/solicitudes')}
              className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-950/40 transition-colors cursor-pointer text-left w-full"
            >
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-600" />
                <span className="font-medium text-amber-800 dark:text-amber-200 text-sm">
                  Pendientes de aprobación
                </span>
              </div>
              <Badge variant="outline" className="bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border-amber-300">
                {solicitudesPendientesGlobal.length} solicitudes
              </Badge>
            </button>
            
            {/* Available approved banner */}
            <button
              onClick={() => {
                const corteAbierto = cortes.find(c => c.estado === 'abierto');
                if (corteAbierto) {
                  handleViewCorte(corteAbierto);
                } else {
                  openNewCorteModal();
                }
              }}
              className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg hover:bg-green-100 dark:hover:bg-green-950/40 transition-colors cursor-pointer text-left w-full"
            >
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="font-medium text-green-800 dark:text-green-200 text-sm">
                  Aprobadas sin asignar
                </span>
              </div>
              <Badge variant="outline" className="bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 border-green-300">
                {solicitudesAprobadasDisponibles.length} solicitudes • {formatCurrency(solicitudesAprobadasDisponibles.reduce((sum, s) => sum + Number(s.total_solicitado), 0))}
              </Badge>
            </button>
          </div>
          
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
        </TabsContent>

        <TabsContent value="disponibles" className="space-y-4 mt-4">
          {loadingDisponibles ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <>
              {/* Summary card */}
              <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="font-medium text-green-800 dark:text-green-200">
                      {solicitudesAprobadasDisponibles.length} solicitud{solicitudesAprobadasDisponibles.length !== 1 ? 'es' : ''} aprobada{solicitudesAprobadasDisponibles.length !== 1 ? 's' : ''} sin asignar
                    </p>
                    <p className="text-sm text-green-600 dark:text-green-400">
                      Estas solicitudes están listas para ser agregadas a un corte
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Total disponible</p>
                  <p className="text-lg font-bold text-green-700 dark:text-green-300">
                    {formatCurrency(totalDisponibles)}
                  </p>
                </div>
              </div>

              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por obra o instalador..."
                    value={searchDisponibles}
                    onChange={(e) => setSearchDisponibles(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={filterInstaladorDisponibles} onValueChange={setFilterInstaladorDisponibles}>
                  <SelectTrigger className="w-full sm:w-[220px]">
                    <SelectValue placeholder="Filtrar por instalador" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los instaladores</SelectItem>
                    {instaladoresDisponibles.map(([id, nombre]) => (
                      <SelectItem key={id} value={id}>{nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Solicitudes list */}
              {filteredSolicitudesDisponibles.length === 0 ? (
                <EmptyState
                  icon={CheckCircle}
                  title="Sin solicitudes disponibles"
                  description="No hay solicitudes aprobadas pendientes de asignar a un corte"
                />
              ) : (
                <div className="space-y-2">
                  {filteredSolicitudesDisponibles.map((sol) => (
                    <div 
                      key={sol.id} 
                      className="flex justify-between items-center p-4 bg-card border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="font-medium">{sol.obras?.nombre || 'Obra sin nombre'}</div>
                        <div className="text-sm text-muted-foreground flex items-center gap-2">
                          <span>{sol.instaladores?.nombre || 'Sin instalador'}</span>
                          <span>•</span>
                          <span className="capitalize">{sol.tipo}</span>
                          <span>•</span>
                          <span>{format(new Date(sol.created_at || ''), 'dd MMM yyyy', { locale: es })}</span>
                        </div>
                        {sol.observaciones && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                            {sol.observaciones}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="font-semibold text-primary">{formatCurrency(Number(sol.total_solicitado))}</p>
                          <StatusBadge status="aprobado" />
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCancelSolicitudAprobada(sol)}
                          disabled={cancelingId === sol.id}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          {cancelingId === sol.id ? 'Cancelando...' : 'Cancelar'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

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
      <Dialog open={!!viewingCorte} onOpenChange={(open) => { if (!open) { setViewingCorte(null); setSelectedForRemoval(new Set()); } }}>
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
                  <p className="text-muted-foreground text-sm">No hay instaladores activos</p>
                ) : (
                  <div className="space-y-2">
                    {/* Table header */}
                    {(() => {
                      const hasAnticipos = resumenInstaladores.some(i => i.anticiposEnCorte > 0);
                      return hasAnticipos ? (
                        <div className="grid grid-cols-7 gap-2 px-3 py-2 bg-muted rounded-lg text-xs font-semibold text-muted-foreground">
                          <div className="col-span-2">Instalador</div>
                          <div className="text-right">Destajo</div>
                          <div className="text-right">Anticipo</div>
                          <div className="text-right">Salario</div>
                          <div className="text-right">Saldo Ant.</div>
                          <div className="text-right">A Depositar</div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-6 gap-2 px-3 py-2 bg-muted rounded-lg text-xs font-semibold text-muted-foreground">
                          <div className="col-span-2">Instalador</div>
                          <div className="text-right">Destajo</div>
                          <div className="text-right">Salario</div>
                          <div className="text-right">Saldo Ant.</div>
                          <div className="text-right">A Depositar</div>
                        </div>
                      );
                    })()}
                    {resumenInstaladores.map((inst) => {
                      const displaySalario = salarioEdits[inst.id] ?? inst.salarioSemanal;
                      // Include anticipos in calculation
                      const basePago = inst.destajoAcumulado - displaySalario + inst.saldoAnterior - inst.anticiposEnCorte;
                      const displayADepositar = basePago >= 0 ? Math.floor(basePago / 50) * 50 : 0;
                      const displaySaldoGenerado = basePago < 0 ? Math.max(0, displaySalario - inst.destajoAcumulado + inst.anticiposEnCorte) : 0;
                      const hasAnticipos = resumenInstaladores.some(i => i.anticiposEnCorte > 0);
                      
                      return (
                        <div 
                          key={inst.id} 
                          className={`grid ${hasAnticipos ? 'grid-cols-7' : 'grid-cols-6'} gap-2 px-3 py-2 rounded-lg items-center ${
                            inst.destajoAcumulado > 0 || inst.saldoGenerado > 0 || inst.anticiposEnCorte > 0
                              ? 'bg-muted/50' 
                              : 'bg-muted/20 opacity-60'
                          }`}
                        >
                          <div className="col-span-2">
                            <span className="font-medium text-sm">{inst.nombre}</span>
                            {displaySaldoGenerado > 0 && (
                              <Badge variant="outline" className="ml-2 text-xs text-amber-600 border-amber-300">
                                +{formatCurrency(displaySaldoGenerado)} saldo
                              </Badge>
                            )}
                          </div>
                          <div className="text-right text-sm">{formatCurrency(inst.destajoAcumulado)}</div>
                          {hasAnticipos && (
                            <div className="text-right text-sm text-orange-600">
                              {inst.anticiposEnCorte > 0 ? `-${formatCurrency(inst.anticiposEnCorte)}` : '-'}
                            </div>
                          )}
                          <div className="text-right">
                            {viewingCorte?.estado === 'abierto' ? (
                              <div className="flex items-center justify-end gap-1">
                                <Input
                                  type="number"
                                  min="0"
                                  step="100"
                                  value={salarioEdits[inst.id] ?? inst.salarioSemanal}
                                  onChange={(e) => {
                                    const value = parseFloat(e.target.value) || 0;
                                    setSalarioEdits(prev => ({ ...prev, [inst.id]: value }));
                                  }}
                                  onBlur={() => handleSaveSalario(inst.id)}
                                  className="w-24 h-7 text-right text-sm"
                                  disabled={savingSalarioId === inst.id}
                                />
                                {savingSalarioId === inst.id && (
                                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                )}
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">{formatCurrency(inst.salarioSemanal)}</span>
                            )}
                          </div>
                          <div className="text-right text-sm text-muted-foreground">
                            {inst.saldoAnterior > 0 ? formatCurrency(inst.saldoAnterior) : '-'}
                          </div>
                          <div className="text-right font-semibold text-primary">{formatCurrency(displayADepositar)}</div>
                        </div>
                      );
                    })}
                    {/* Totals row */}
                    {(() => {
                      const hasAnticipos = resumenInstaladores.some(i => i.anticiposEnCorte > 0);
                      const totalAnticipos = resumenInstaladores.reduce((sum, i) => sum + i.anticiposEnCorte, 0);
                      return (
                        <div className={`grid ${hasAnticipos ? 'grid-cols-7' : 'grid-cols-6'} gap-2 px-3 py-3 bg-primary/10 rounded-lg border border-primary/20 font-semibold`}>
                          <div className="col-span-2">Total del Corte</div>
                          <div className="text-right">{formatCurrency(resumenInstaladores.reduce((sum, i) => sum + i.destajoAcumulado, 0))}</div>
                          {hasAnticipos && (
                            <div className="text-right text-orange-600">-{formatCurrency(totalAnticipos)}</div>
                          )}
                          <div className="text-right">{formatCurrency(resumenInstaladores.reduce((sum, i) => sum + (salarioEdits[i.id] ?? i.salarioSemanal), 0))}</div>
                          <div className="text-right">{formatCurrency(resumenInstaladores.reduce((sum, i) => sum + i.saldoAnterior, 0))}</div>
                          <div className="text-right text-primary text-lg">
                            {formatCurrency(resumenInstaladores.reduce((sum, inst) => {
                              const sal = salarioEdits[inst.id] ?? inst.salarioSemanal;
                              const base = inst.destajoAcumulado - sal + inst.saldoAnterior - inst.anticiposEnCorte;
                              return sum + (base >= 0 ? Math.floor(base / 50) * 50 : 0);
                            }, 0))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Solicitudes asignadas */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold">Solicitudes en el Corte</h3>
                  {viewingCorte?.estado === 'abierto' && corteSolicitudes.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="select-all"
                        checked={selectedForRemoval.size === corteSolicitudes.length && corteSolicitudes.length > 0}
                        onCheckedChange={toggleSelectAllSolicitudes}
                      />
                      <label htmlFor="select-all" className="text-sm text-muted-foreground cursor-pointer">
                        Seleccionar todas
                      </label>
                    </div>
                  )}
                </div>
                {corteSolicitudes.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No hay solicitudes asignadas</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {corteSolicitudes.map((sol) => (
                      <div key={sol.id} className={`flex justify-between items-center p-2 border rounded-lg transition-colors ${selectedForRemoval.has(sol.id) ? 'bg-destructive/10 border-destructive/30' : ''}`}>
                        <div className="flex items-center gap-3 flex-1">
                          {viewingCorte?.estado === 'abierto' && (
                            <Checkbox
                              checked={selectedForRemoval.has(sol.id)}
                              onCheckedChange={() => toggleSolicitudSelection(sol.id)}
                            />
                          )}
                          <div className="flex-1">
                            <div className="font-medium text-sm">{sol.obras?.nombre}</div>
                            <div className="text-xs text-muted-foreground">
                              {sol.instaladores?.nombre} • {sol.tipo}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{formatCurrency(Number(sol.total_solicitado))}</span>
                          {viewingCorte?.estado === 'cerrado' ? (
                            <StatusBadge status="pagado" />
                          ) : (
                            <StatusBadge status="aprobado" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Bulk action bar */}
                {viewingCorte?.estado === 'abierto' && selectedForRemoval.size > 0 && (
                  <div className="flex items-center justify-between mt-3 p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Minus className="w-4 h-4 text-destructive" />
                      <span className="text-sm font-medium">
                        {selectedForRemoval.size} solicitud{selectedForRemoval.size !== 1 ? 'es' : ''} seleccionada{selectedForRemoval.size !== 1 ? 's' : ''} • {formatCurrency(
                          corteSolicitudes
                            .filter(s => selectedForRemoval.has(s.id))
                            .reduce((sum, s) => sum + Number(s.total_solicitado), 0)
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedForRemoval(new Set())}
                      >
                        Cancelar
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleBulkRemoveFromCorte}
                        disabled={removingBulk}
                      >
                        {removingBulk ? 'Quitando...' : 'Quitar Seleccionadas'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Solicitudes pendientes (para aprobar y agregar) */}
              {viewingCorte?.estado === 'abierto' && solicitudesPendientes.length > 0 && (
                <div>
                  {/* Summary banner */}
                  <div className="flex items-center justify-between p-3 mb-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-amber-600" />
                      <span className="font-medium text-amber-800 dark:text-amber-200 text-sm">
                        {solicitudesPendientes.length} solicitud{solicitudesPendientes.length !== 1 ? 'es' : ''} pendiente{solicitudesPendientes.length !== 1 ? 's' : ''} de aprobación
                      </span>
                    </div>
                    <span className="font-bold text-amber-700 dark:text-amber-300">
                      {formatCurrency(solicitudesPendientes.reduce((sum, s) => sum + Number(s.total_solicitado), 0))}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-muted-foreground">
                      Aprueba y agrega al corte en un solo paso
                    </p>
                    <Select value={filterInstaladorId} onValueChange={setFilterInstaladorId}>
                      <SelectTrigger className="w-[180px] h-8">
                        <SelectValue placeholder="Filtrar por instalador" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos los instaladores</SelectItem>
                        {/* Get unique instaladores from pending solicitudes */}
                        {Array.from(
                          new Map(
                            solicitudesPendientes.map(s => [s.instalador_id, s.instaladores?.nombre || 'Desconocido'])
                          )
                        ).map(([id, nombre]) => (
                          <SelectItem key={id} value={id}>{nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {solicitudesPendientes
                      .filter(sol => filterInstaladorId === 'todos' || sol.instalador_id === filterInstaladorId)
                      .map((sol) => (
                      <div key={sol.id} className="flex justify-between items-center p-2 border border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 rounded-lg">
                        <div className="flex-1">
                          <div className="font-medium text-sm">{sol.obras?.nombre}</div>
                          <div className="text-xs text-muted-foreground">
                            {sol.instaladores?.nombre} • {sol.tipo}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{formatCurrency(Number(sol.total_solicitado))}</span>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleApproveAndAddToCorte(sol)}
                            disabled={approvingId === sol.id}
                          >
                            {approvingId === sol.id ? 'Aprobando...' : 'Aprobar y Agregar'}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Solicitudes disponibles (ya aprobadas, solo agregar) */}
              {viewingCorte?.estado === 'abierto' && solicitudesDisponibles.length > 0 && (
                <div>
                  {/* Summary banner */}
                  <div className="flex items-center justify-between p-3 mb-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="font-medium text-green-800 dark:text-green-200 text-sm">
                        {solicitudesDisponibles.length} solicitud{solicitudesDisponibles.length !== 1 ? 'es' : ''} aprobada{solicitudesDisponibles.length !== 1 ? 's' : ''} sin asignar
                      </span>
                    </div>
                    <span className="font-bold text-green-700 dark:text-green-300">
                      {formatCurrency(solicitudesDisponibles.reduce((sum, s) => sum + Number(s.total_solicitado), 0))}
                    </span>
                  </div>
                  
                  <h3 className="text-sm font-semibold mb-2 text-muted-foreground">
                    Agregar al corte:
                  </h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {solicitudesDisponibles.map((sol) => (
                      <div key={sol.id} className="flex justify-between items-center p-2 border border-dashed border-green-300 rounded-lg">
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
            <Button variant="outline" onClick={() => { setViewingCorte(null); setSelectedForRemoval(new Set()); }}>
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
              <div className="mt-4 p-3 bg-muted rounded-lg max-h-60 overflow-y-auto">
                <p className="font-medium mb-2">Resumen de pagos a generar:</p>
                <ul className="text-sm space-y-1">
                  {resumenInstaladores
                    .filter(inst => {
                      const sal = salarioEdits[inst.id] ?? inst.salarioSemanal;
                      const base = inst.destajoAcumulado - sal + inst.saldoAnterior;
                      return base >= 0 && Math.floor(base / 50) * 50 > 0;
                    })
                    .map((inst) => {
                      const sal = salarioEdits[inst.id] ?? inst.salarioSemanal;
                      const base = inst.destajoAcumulado - sal + inst.saldoAnterior;
                      const aDepositar = Math.floor(base / 50) * 50;
                      return (
                        <li key={inst.id} className="flex justify-between">
                          <span>{inst.nombre}</span>
                          <span className="font-medium">{formatCurrency(aDepositar)}</span>
                        </li>
                      );
                    })}
                </ul>
                {resumenInstaladores.some(inst => {
                  const sal = salarioEdits[inst.id] ?? inst.salarioSemanal;
                  const base = inst.destajoAcumulado - sal + inst.saldoAnterior;
                  return base < 0 && sal - inst.destajoAcumulado > 0;
                }) && (
                  <div className="mt-3 pt-2 border-t">
                    <p className="text-xs text-muted-foreground mb-1">Saldos a favor generados:</p>
                    <ul className="text-sm space-y-1">
                      {resumenInstaladores
                        .filter(inst => {
                          const sal = salarioEdits[inst.id] ?? inst.salarioSemanal;
                          const base = inst.destajoAcumulado - sal + inst.saldoAnterior;
                          return base < 0 && sal - inst.destajoAcumulado > 0;
                        })
                        .map((inst) => {
                          const sal = salarioEdits[inst.id] ?? inst.salarioSemanal;
                          const saldoGenerado = sal - inst.destajoAcumulado;
                          return (
                            <li key={inst.id} className="flex justify-between text-amber-600">
                              <span>{inst.nombre}</span>
                              <span>+{formatCurrency(saldoGenerado)}</span>
                            </li>
                          );
                        })}
                    </ul>
                  </div>
                )}
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
              <div className="mt-3 p-3 bg-muted rounded-lg max-h-40 overflow-y-auto">
                <p className="font-medium mb-2">Instaladores afectados:</p>
                <ul className="text-sm space-y-1">
                  {resumenInstaladores.filter(inst => inst.aDepositar > 0 || inst.saldoGenerado > 0).map((inst) => (
                    <li key={inst.id} className="flex justify-between">
                      <span>{inst.nombre}</span>
                      <span className="font-medium">{formatCurrency(inst.aDepositar)}</span>
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
