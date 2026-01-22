import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ClipboardList, Plus, Search, Pencil, Trash2, Calendar, Box, RefreshCw, Users, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { PageHeader, EmptyState } from '../components';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { Obra, Instalador, ObraItem, AvanceInstaladorInput } from '../types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useSubmodulePermissions } from '@/hooks/useSubmodulePermissions';

interface AvanceItemDisplay {
  obra_item_id: string;
  descripcion: string;
  cantidad_total: number;
  cantidad_avanzada: number;
  cantidad_pendiente: number;
  cantidad_a_avanzar: string;
  precio_unitario: number;
}

interface AvanceRecord {
  id: string;
  obra_id: string;
  instalador_id: string | null;
  fecha: string;
  observaciones: string | null;
  registrado_por: string;
  created_at: string;
  obras: { nombre: string; descuento?: number } | null;
  instaladores: { nombre: string } | null;
  profiles: { full_name: string | null; email: string | null } | null;
  avance_items: {
    id: string;
    obra_item_id: string;
    cantidad_completada: number;
    obra_items: { descripcion: string; precio_unitario: number } | null;
  }[];
  solicitudes_pago: { id: string; estado: string; created_at: string; total_solicitado: number; subtotal_piezas: number; retencion: number; corte_id: string | null; cortes_semanales: { estado: string } | null; pagos_destajos: { id: string }[]; instaladores: { nombre: string } | null }[];
  avance_instaladores?: { id: string; instalador_id: string; porcentaje: number; instaladores: { nombre: string } | null }[];
}

export default function AvancesPage() {
  const { user, loading } = useAuth();
  const { canCreate, canUpdate, canDelete } = useSubmodulePermissions('destajos', 'avances');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const [avances, setAvances] = useState<AvanceRecord[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);
  const [obrasWithPending, setObrasWithPending] = useState<Set<string>>(new Set());
  const [instaladores, setInstaladores] = useState<Instalador[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'pendiente' | 'pagado' | 'rechazada'>('todos');
  const [instaladorFilter, setInstaladorFilter] = useState<string>('todos');
  const [registradoPorFilter, setRegistradoPorFilter] = useState<string>('todos');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Edit/Delete state
  const [editingAvance, setEditingAvance] = useState<AvanceRecord | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [avanceToDelete, setAvanceToDelete] = useState<AvanceRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [creatingSolicitud, setCreatingSolicitud] = useState<string | null>(null);
  
  // View detail state
  const [viewingAvance, setViewingAvance] = useState<AvanceRecord | null>(null);
  
  // Form state
  const [selectedObraId, setSelectedObraId] = useState('');
  const [selectedInstaladores, setSelectedInstaladores] = useState<AvanceInstaladorInput[]>([]);
  const [fecha, setFecha] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [observaciones, setObservaciones] = useState('');
  const [obraItems, setObraItems] = useState<AvanceItemDisplay[]>([]);
  const [loadingObraItems, setLoadingObraItems] = useState(false);

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

  // Handle edit param from URL
  useEffect(() => {
    const editId = searchParams.get('edit');
    if (editId && avances.length > 0 && !loadingData) {
      const avanceToEdit = avances.find(a => a.id === editId);
      if (avanceToEdit && canEditAvance(avanceToEdit)) {
        handleOpenEdit(avanceToEdit);
        // Clear the search param
        setSearchParams({});
      }
    }
  }, [searchParams, avances, loadingData]);

  // Handle obra param from URL (coming from Obras detail to create new avance)
  useEffect(() => {
    const obraId = searchParams.get('obra');
    if (obraId && obras.length > 0 && !loadingData && canCreate) {
      // Open modal with pre-selected obra
      setSelectedObraId(obraId);
      setIsModalOpen(true);
      // Clear the search param
      setSearchParams({});
    }
  }, [searchParams, obras, loadingData, canCreate]);

  // Fetch obra items when obra is selected (also in edit mode when changing obra)
  useEffect(() => {
    if (selectedObraId) {
      // Si estamos editando y cambiamos de obra, cargar nuevos items
      if (editingAvance && selectedObraId !== editingAvance.obra_id) {
        fetchObraItems(selectedObraId);
      } else if (!editingAvance) {
        fetchObraItems(selectedObraId);
      }
    } else {
      setObraItems([]);
    }
  }, [selectedObraId]);

  const fetchData = async () => {
    try {
      setLoadingData(true);
      
      const [avancesRes, obrasRes, instaladoresRes, obraItemsRes, allAvanceItemsRes, avanceInstaladoresRes] = await Promise.all([
        supabase
          .from('avances')
          .select(`
            id,
            obra_id,
            instalador_id,
            fecha,
            observaciones,
            registrado_por,
            created_at,
            obras(nombre, descuento),
            instaladores(nombre),
            profiles:registrado_por(full_name, email),
            avance_items(
              id,
              obra_item_id,
              cantidad_completada,
              obra_items(descripcion, precio_unitario)
            ),
            solicitudes_pago(id, estado, created_at, total_solicitado, subtotal_piezas, retencion, corte_id, cortes_semanales(estado), pagos_destajos(id), instaladores(nombre)),
            avance_instaladores(id, instalador_id, porcentaje, instaladores(nombre))
          `)
          .order('fecha', { ascending: false }),
        supabase.from('obras').select('*').eq('estado', 'activa'),
        supabase.from('instaladores').select('*').eq('activo', true),
        supabase.from('obra_items').select('id, obra_id, cantidad'),
        supabase.from('avance_items').select('obra_item_id, cantidad_completada'),
        supabase.from('avance_instaladores').select('avance_id, instalador_id, porcentaje, instaladores(nombre)'),
      ]);

      if (avancesRes.error) throw avancesRes.error;
      if (obrasRes.error) throw obrasRes.error;
      if (instaladoresRes.error) throw instaladoresRes.error;
      if (obraItemsRes.error) throw obraItemsRes.error;
      if (allAvanceItemsRes.error) throw allAvanceItemsRes.error;

      // Calculate which obras have pending items
      const avanceTotals: Record<string, number> = {};
      (allAvanceItemsRes.data || []).forEach((ai: any) => {
        avanceTotals[ai.obra_item_id] = (avanceTotals[ai.obra_item_id] || 0) + ai.cantidad_completada;
      });

      const obrasWithPendingItems = new Set<string>();
      (obraItemsRes.data || []).forEach((item: any) => {
        const avanzado = avanceTotals[item.id] || 0;
        const pendiente = item.cantidad - avanzado;
        if (pendiente > 0) {
          obrasWithPendingItems.add(item.obra_id);
        }
      });

      // Sort solicitudes by created_at to get the most recent one first
      const avancesWithSortedSolicitudes = (avancesRes.data || []).map((avance: any) => ({
        ...avance,
        solicitudes_pago: avance.solicitudes_pago?.sort((a: any, b: any) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ) || [],
      }));

      setAvances(avancesWithSortedSolicitudes as AvanceRecord[]);
      setObras((obrasRes.data as Obra[]) || []);
      setObrasWithPending(obrasWithPendingItems);
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

  const fetchObraItems = async (obraId: string, excludeAvanceId?: string) => {
    try {
      setLoadingObraItems(true);
      
      const { data: items, error: itemsError } = await supabase
        .from('obra_items')
        .select('*')
        .eq('obra_id', obraId);
      
      if (itemsError) throw itemsError;
      
      const { data: avanceItems, error: avanceError } = await supabase
        .from('avance_items')
        .select(`
          obra_item_id,
          cantidad_completada,
          avance_id,
          avances!inner(obra_id)
        `)
        .eq('avances.obra_id', obraId);
      
      if (avanceError) throw avanceError;
      
      const avanceTotals: Record<string, number> = {};
      (avanceItems || []).forEach((ai: any) => {
        if (excludeAvanceId && ai.avance_id === excludeAvanceId) return;
        avanceTotals[ai.obra_item_id] = (avanceTotals[ai.obra_item_id] || 0) + ai.cantidad_completada;
      });
      
      const displayItems: AvanceItemDisplay[] = (items || [])
        .map((item: ObraItem) => {
          const avanzado = avanceTotals[item.id] || 0;
          const pendiente = item.cantidad - avanzado;
          return {
            obra_item_id: item.id,
            descripcion: item.descripcion,
            cantidad_total: item.cantidad,
            cantidad_avanzada: avanzado,
            cantidad_pendiente: pendiente,
            cantidad_a_avanzar: '0',
            precio_unitario: item.precio_unitario,
          };
        })
        .filter((item) => item.cantidad_pendiente > 0);
      
      setObraItems(displayItems);
    } catch (error) {
      console.error('Error fetching obra items:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los items de la obra',
        variant: 'destructive',
      });
    } finally {
      setLoadingObraItems(false);
    }
  };

  const handleOpenEdit = async (avance: AvanceRecord) => {
    setEditingAvance(avance);
    setSelectedObraId(avance.obra_id);
    
    // Load instaladores from avance_instaladores or fallback to single instalador_id
    if (avance.avance_instaladores && avance.avance_instaladores.length > 0) {
      setSelectedInstaladores(avance.avance_instaladores.map(ai => ({
        instalador_id: ai.instalador_id,
        porcentaje: ai.porcentaje,
      })));
    } else if (avance.instalador_id) {
      setSelectedInstaladores([{ instalador_id: avance.instalador_id, porcentaje: 100 }]);
    } else {
      setSelectedInstaladores([]);
    }
    
    setFecha(avance.fecha);
    setObservaciones(avance.observaciones || '');
    
    try {
      setLoadingObraItems(true);
      
      const { data: items, error: itemsError } = await supabase
        .from('obra_items')
        .select('*')
        .eq('obra_id', avance.obra_id);
      
      if (itemsError) throw itemsError;
      
      const { data: avanceItems, error: avanceError } = await supabase
        .from('avance_items')
        .select(`
          obra_item_id,
          cantidad_completada,
          avance_id,
          avances!inner(obra_id)
        `)
        .eq('avances.obra_id', avance.obra_id);
      
      if (avanceError) throw avanceError;
      
      const avanceTotals: Record<string, number> = {};
      (avanceItems || []).forEach((ai: any) => {
        if (ai.avance_id === avance.id) return;
        avanceTotals[ai.obra_item_id] = (avanceTotals[ai.obra_item_id] || 0) + ai.cantidad_completada;
      });
      
      const currentItems: Record<string, number> = {};
      avance.avance_items.forEach((ai) => {
        currentItems[ai.obra_item_id] = ai.cantidad_completada;
      });
      
      const displayItems: AvanceItemDisplay[] = (items || [])
        .map((item: ObraItem) => {
          const avanzadoOtros = avanceTotals[item.id] || 0;
          const avanzadoActual = currentItems[item.id] || 0;
          const pendiente = item.cantidad - avanzadoOtros;
          return {
            obra_item_id: item.id,
            descripcion: item.descripcion,
            cantidad_total: item.cantidad,
            cantidad_avanzada: avanzadoOtros,
            cantidad_pendiente: pendiente,
            cantidad_a_avanzar: avanzadoActual.toString(),
            precio_unitario: item.precio_unitario,
          };
        })
        .filter((item) => item.cantidad_pendiente > 0 || currentItems[item.obra_item_id]);
      
      setObraItems(displayItems);
    } catch (error) {
      console.error('Error loading edit data:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los datos para editar',
        variant: 'destructive',
      });
    } finally {
      setLoadingObraItems(false);
    }
    
    setIsModalOpen(true);
  };

  const handleItemQuantityChange = (obraItemId: string, value: string) => {
    setObraItems((prev) =>
      prev.map((item) =>
        item.obra_item_id === obraItemId
          ? { ...item, cantidad_a_avanzar: value }
          : item
      )
    );
  };

  const handleSave = async () => {
    if (!selectedObraId || selectedInstaladores.length === 0) {
      toast({
        title: 'Error',
        description: 'Obra e instalador(es) son requeridos',
        variant: 'destructive',
      });
      return;
    }

    // Validar que los porcentajes sumen 100%
    const totalPorcentaje = selectedInstaladores.reduce((acc, inst) => acc + inst.porcentaje, 0);
    if (Math.abs(totalPorcentaje - 100) > 0.01) {
      toast({
        title: 'Error',
        description: `Los porcentajes deben sumar 100% (actualmente: ${totalPorcentaje.toFixed(1)}%)`,
        variant: 'destructive',
      });
      return;
    }

    const itemsWithProgress = obraItems.filter(
      (item) => parseInt(item.cantidad_a_avanzar) > 0
    );
    
    if (itemsWithProgress.length === 0) {
      toast({
        title: 'Error',
        description: 'Debes registrar avance en al menos un item',
        variant: 'destructive',
      });
      return;
    }

    for (const item of itemsWithProgress) {
      const cantidad = parseInt(item.cantidad_a_avanzar);
      if (cantidad > item.cantidad_pendiente) {
        toast({
          title: 'Error',
          description: `La cantidad para "${item.descripcion}" excede lo pendiente (${item.cantidad_pendiente})`,
          variant: 'destructive',
        });
        return;
      }
    }

    try {
      setSaving(true);
      
      // Get obra discount
      const obraData = obras.find(o => o.id === selectedObraId);
      const descuento = Number((obraData as any)?.descuento || 0);
      
      const subtotalPiezas = itemsWithProgress.reduce((acc, item) => {
        return acc + (parseInt(item.cantidad_a_avanzar) * item.precio_unitario);
      }, 0);
      
      if (editingAvance) {
        // Update avance - set instalador_id to first one for backwards compatibility
        const { error: avanceError } = await supabase
          .from('avances')
          .update({
            obra_id: selectedObraId,
            instalador_id: selectedInstaladores.length === 1 ? selectedInstaladores[0].instalador_id : null,
            fecha,
            observaciones: observaciones.trim() || null,
          })
          .eq('id', editingAvance.id);
        
        if (avanceError) throw avanceError;
        
        // Delete old avance_items
        const { error: deleteItemsError } = await supabase
          .from('avance_items')
          .delete()
          .eq('avance_id', editingAvance.id);
        
        if (deleteItemsError) throw deleteItemsError;
        
        // Delete old avance_instaladores
        await supabase
          .from('avance_instaladores')
          .delete()
          .eq('avance_id', editingAvance.id);
        
        // Insert new avance_items
        const avanceItemsToInsert = itemsWithProgress.map((item) => ({
          avance_id: editingAvance.id,
          obra_item_id: item.obra_item_id,
          cantidad_completada: parseInt(item.cantidad_a_avanzar),
        }));
        
        const { error: itemsError } = await supabase
          .from('avance_items')
          .insert(avanceItemsToInsert);
        
        if (itemsError) throw itemsError;

        // Insert new avance_instaladores if multiple
        if (selectedInstaladores.length > 1) {
          const avanceInstaladoresInsert = selectedInstaladores.map(inst => ({
            avance_id: editingAvance.id,
            instalador_id: inst.instalador_id,
            porcentaje: inst.porcentaje,
          }));
          
          await supabase.from('avance_instaladores').insert(avanceInstaladoresInsert);
        }

        // Delete old pending solicitudes and create new ones
        const pendingSolicitudes = editingAvance.solicitudes_pago?.filter(s => s.estado === 'pendiente') || [];
        for (const sol of pendingSolicitudes) {
          await supabase.from('solicitudes_pago').delete().eq('id', sol.id);
        }

        // Create new solicitudes for each instalador
        for (const inst of selectedInstaladores) {
          const porcentajeFactor = inst.porcentaje / 100;
          const subtotalInst = subtotalPiezas * porcentajeFactor;
          const montoDescuento = subtotalInst * (descuento / 100);
          const totalConDescuento = subtotalInst - montoDescuento;

          const instaladorNombre = instaladores.find(i => i.id === inst.instalador_id)?.nombre || 'Instalador';

          await supabase.from('solicitudes_pago').insert({
            obra_id: selectedObraId,
            instalador_id: inst.instalador_id,
            solicitado_por: user?.id,
            tipo: 'avance',
            subtotal_piezas: subtotalInst,
            subtotal_extras: 0,
            retencion: montoDescuento,
            total_solicitado: totalConDescuento,
            observaciones: selectedInstaladores.length > 1
              ? `Avance ${format(new Date(fecha), 'dd/MM/yyyy')} - ${instaladorNombre} (${inst.porcentaje}%)${descuento > 0 ? ` - Descuento ${descuento}%` : ''}`
              : `Avance registrado el ${format(new Date(fecha), 'dd/MM/yyyy')}${descuento > 0 ? ` (Descuento ${descuento}%)` : ''}`,
            avance_id: editingAvance.id,
          });
        }

        toast({ title: 'Éxito', description: 'Avance actualizado correctamente' });
      } else {
        // Create new avance
        const { data: avanceData, error: avanceError } = await supabase
          .from('avances')
          .insert({
            obra_id: selectedObraId,
            instalador_id: selectedInstaladores.length === 1 ? selectedInstaladores[0].instalador_id : null,
            fecha,
            observaciones: observaciones.trim() || null,
            registrado_por: user?.id,
          })
          .select()
          .single();
        
        if (avanceError) throw avanceError;
        
        // Insert avance_items
        const avanceItemsToInsert = itemsWithProgress.map((item) => ({
          avance_id: avanceData.id,
          obra_item_id: item.obra_item_id,
          cantidad_completada: parseInt(item.cantidad_a_avanzar),
        }));
        
        const { error: itemsError } = await supabase
          .from('avance_items')
          .insert(avanceItemsToInsert);
        
        if (itemsError) throw itemsError;

        // Insert avance_instaladores if multiple
        if (selectedInstaladores.length > 1) {
          const avanceInstaladoresInsert = selectedInstaladores.map(inst => ({
            avance_id: avanceData.id,
            instalador_id: inst.instalador_id,
            porcentaje: inst.porcentaje,
          }));
          
          await supabase.from('avance_instaladores').insert(avanceInstaladoresInsert);
        }

        // Create solicitudes for each instalador
        let solicitudSuccess = true;
        for (const inst of selectedInstaladores) {
          const porcentajeFactor = inst.porcentaje / 100;
          const subtotalInst = subtotalPiezas * porcentajeFactor;
          const montoDescuento = subtotalInst * (descuento / 100);
          const totalConDescuento = subtotalInst - montoDescuento;

          const instaladorNombre = instaladores.find(i => i.id === inst.instalador_id)?.nombre || 'Instalador';

          const { error: solicitudError } = await supabase.from('solicitudes_pago').insert({
            obra_id: selectedObraId,
            instalador_id: inst.instalador_id,
            solicitado_por: user?.id,
            tipo: 'avance',
            subtotal_piezas: subtotalInst,
            subtotal_extras: 0,
            retencion: montoDescuento,
            total_solicitado: totalConDescuento,
            observaciones: selectedInstaladores.length > 1
              ? `Avance ${format(new Date(fecha), 'dd/MM/yyyy')} - ${instaladorNombre} (${inst.porcentaje}%)${descuento > 0 ? ` - Descuento ${descuento}%` : ''}`
              : `Avance registrado el ${format(new Date(fecha), 'dd/MM/yyyy')}${descuento > 0 ? ` (Descuento ${descuento}%)` : ''}`,
            avance_id: avanceData.id,
          });

          if (solicitudError) {
            console.error('Error creating solicitud:', solicitudError);
            solicitudSuccess = false;
          }
        }

        if (!solicitudSuccess) {
          toast({ 
            title: 'Aviso', 
            description: 'Avance registrado, pero hubo un error al crear alguna solicitud de pago',
            variant: 'destructive',
          });
        } else {
          toast({ 
            title: 'Éxito', 
            description: selectedInstaladores.length > 1 
              ? `Avance y ${selectedInstaladores.length} solicitudes de pago registradas correctamente`
              : 'Avance y solicitud de pago registrados correctamente'
          });
        }
      }

      resetForm();
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error saving avance:', error);
      toast({
        title: 'Error',
        description: 'No se pudo guardar el avance',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!avanceToDelete) return;

    try {
      setDeleting(true);
      
      // Check if there's a solicitud with a pago
      const solicitud = avanceToDelete.solicitudes_pago?.[0];
      if (solicitud && solicitud.pagos_destajos?.length > 0) {
        toast({
          title: 'No se puede eliminar',
          description: 'Este avance tiene un pago asociado. Primero cancele el pago.',
          variant: 'destructive',
        });
        setIsDeleteOpen(false);
        setDeleting(false);
        return;
      }
      
      // Delete ALL associated solicitudes (handles multi-installer avances)
      const { error: solicitudError } = await supabase
        .from('solicitudes_pago')
        .delete()
        .eq('avance_id', avanceToDelete.id);
      
      if (solicitudError) throw solicitudError;
      
      const { error: itemsError } = await supabase
        .from('avance_items')
        .delete()
        .eq('avance_id', avanceToDelete.id);
      
      if (itemsError) throw itemsError;
      
      const { data: deletedData, error: avanceError } = await supabase
        .from('avances')
        .delete()
        .eq('id', avanceToDelete.id)
        .select('id');
      
      if (avanceError) throw avanceError;
      
      // Si RLS bloqueó la eliminación, deletedData estará vacío
      if (!deletedData || deletedData.length === 0) {
        throw new Error('No tienes permisos para eliminar este avance');
      }

      toast({ title: 'Éxito', description: 'Avance eliminado correctamente' });
      setIsDeleteOpen(false);
      setAvanceToDelete(null);
      fetchData();
    } catch (error) {
      console.error('Error deleting avance:', error);
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el avance',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleCrearNuevaSolicitud = async (avance: AvanceRecord) => {
    try {
      setCreatingSolicitud(avance.id);
      
      const subtotalPiezas = avance.avance_items.reduce((acc, item) => {
        return acc + (item.cantidad_completada * (item.obra_items?.precio_unitario || 0));
      }, 0);

      // Get obra discount
      const { data: obraData } = await supabase
        .from('obras')
        .select('descuento')
        .eq('id', avance.obra_id)
        .single();
      
      const descuento = Number(obraData?.descuento || 0);
      const montoDescuento = subtotalPiezas * (descuento / 100);
      const totalConDescuento = subtotalPiezas - montoDescuento;

      const { error } = await supabase
        .from('solicitudes_pago')
        .insert({
          obra_id: avance.obra_id,
          instalador_id: avance.instalador_id,
          solicitado_por: user?.id,
          tipo: 'avance',
          subtotal_piezas: subtotalPiezas,
          subtotal_extras: 0,
          retencion: montoDescuento,
          total_solicitado: totalConDescuento,
          observaciones: descuento > 0
            ? `Nueva solicitud - Avance del ${format(new Date(avance.fecha), 'dd/MM/yyyy')} (Descuento ${descuento}%)`
            : `Nueva solicitud - Avance del ${format(new Date(avance.fecha), 'dd/MM/yyyy')}`,
          avance_id: avance.id,
        });

      if (error) throw error;

      toast({ title: 'Éxito', description: 'Nueva solicitud de pago creada' });
      fetchData();
    } catch (error) {
      console.error('Error creating solicitud:', error);
      toast({
        title: 'Error',
        description: 'No se pudo crear la solicitud',
        variant: 'destructive',
      });
    } finally {
      setCreatingSolicitud(null);
    }
  };

  const canDeleteAvance = (avance: AvanceRecord): boolean => {
    const solicitud = avance.solicitudes_pago?.[0];
    const hasPago = solicitud?.pagos_destajos?.length > 0;
    const corteCerrado = solicitud?.cortes_semanales?.estado === 'cerrado';
    return !solicitud || (!hasPago && !corteCerrado);
  };

  const canEditAvance = (avance: AvanceRecord): boolean => {
    const solicitud = avance.solicitudes_pago?.[0];
    const hasPago = solicitud?.pagos_destajos?.length > 0;
    const corteCerrado = solicitud?.cortes_semanales?.estado === 'cerrado';
    // No permitir editar si tiene pago asociado o corte cerrado
    return !hasPago && !corteCerrado;
  };

  const resetForm = () => {
    setSelectedObraId('');
    setSelectedInstaladores([]);
    setFecha(format(new Date(), 'yyyy-MM-dd'));
    setObservaciones('');
    setObraItems([]);
    setEditingAvance(null);
  };

  // Helper function to distribute percentages equally
  const calcularDistribucionEquitativa = (count: number): number[] => {
    if (count === 0) return [];
    const porcentajeIgual = Math.floor(100 / count);
    const resto = 100 - (porcentajeIgual * count);
    return Array.from({ length: count }, (_, i) => porcentajeIgual + (i === 0 ? resto : 0));
  };

  // Helper functions for managing instaladores
  const handleAddInstalador = () => {
    // Find first instalador not already selected
    const availableInstalador = instaladores.find(
      i => !selectedInstaladores.some(si => si.instalador_id === i.id)
    );
    if (availableInstalador) {
      const newCount = selectedInstaladores.length + 1;
      const porcentajes = calcularDistribucionEquitativa(newCount);
      
      setSelectedInstaladores(prev => {
        const updated = prev.map((item, i) => ({ ...item, porcentaje: porcentajes[i] }));
        return [...updated, { instalador_id: availableInstalador.id, porcentaje: porcentajes[newCount - 1] }];
      });
    }
  };

  const handleRemoveInstalador = (instaladorId: string) => {
    setSelectedInstaladores(prev => {
      const filtered = prev.filter(i => i.instalador_id !== instaladorId);
      if (filtered.length === 0) return filtered;
      const porcentajes = calcularDistribucionEquitativa(filtered.length);
      return filtered.map((item, i) => ({ ...item, porcentaje: porcentajes[i] }));
    });
  };

  const handleInstaladorChange = (index: number, instaladorId: string) => {
    setSelectedInstaladores(prev => prev.map((item, i) => 
      i === index ? { ...item, instalador_id: instaladorId } : item
    ));
  };

  const handlePorcentajeChange = (index: number, porcentaje: number) => {
    setSelectedInstaladores(prev => prev.map((item, i) => 
      i === index ? { ...item, porcentaje: Math.max(0, Math.min(100, porcentaje)) } : item
    ));
  };

  const distribuirEquitativamente = () => {
    if (selectedInstaladores.length === 0) return;
    const porcentajes = calcularDistribucionEquitativa(selectedInstaladores.length);
    
    setSelectedInstaladores(prev => prev.map((item, i) => ({
      ...item,
      porcentaje: porcentajes[i]
    })));
  };

  const totalPorcentaje = selectedInstaladores.reduce((acc, i) => acc + i.porcentaje, 0);

  // Calculate estimated amount per instalador
  const subtotalPiezasEstimado = obraItems.reduce((acc, item) => {
    return acc + (parseInt(item.cantidad_a_avanzar || '0') * item.precio_unitario);
  }, 0);
  const obraData = obras.find(o => o.id === selectedObraId);
  const descuentoObra = Number((obraData as any)?.descuento || 0);
  const totalConDescuentoEstimado = subtotalPiezasEstimado * (1 - descuentoObra / 100);

  // Get unique users who registered avances for filter
  const registradoresUnicos = Array.from(
    new Map(
      avances
        .filter(a => a.profiles)
        .map(a => [a.registrado_por, { id: a.registrado_por, nombre: a.profiles?.full_name || a.profiles?.email || 'Sin nombre' }])
    ).values()
  );

  const filteredAvances = avances.filter((avance) => {
    // Check search in obra name or any instalador name
    const instaladorNames = avance.avance_instaladores?.map(ai => ai.instaladores?.nombre || '').join(' ') || '';
    const matchesSearch = avance.obras?.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      avance.instaladores?.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      instaladorNames.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Filter by instalador (check both single and multiple)
    if (instaladorFilter !== 'todos') {
      const matchesSingle = avance.instalador_id === instaladorFilter;
      const matchesMultiple = avance.avance_instaladores?.some(ai => ai.instalador_id === instaladorFilter);
      if (!matchesSingle && !matchesMultiple) {
        return false;
      }
    }
    
    // Filter by registrado_por
    if (registradoPorFilter !== 'todos' && avance.registrado_por !== registradoPorFilter) {
      return false;
    }
    
    if (statusFilter === 'todos') return matchesSearch;
    
    const solicitud = avance.solicitudes_pago?.[0];
    const hasPago = solicitud?.pagos_destajos?.length > 0;
    const corteCerrado = solicitud?.cortes_semanales?.estado === 'cerrado';
    const isPagado = hasPago || corteCerrado;
    
    if (statusFilter === 'pagado') {
      return matchesSearch && isPagado;
    }
    if (statusFilter === 'rechazada') {
      return matchesSearch && solicitud?.estado === 'rechazada';
    }
    if (statusFilter === 'pendiente') {
      return matchesSearch && solicitud?.estado === 'pendiente' && !isPagado;
    }
    
    return matchesSearch;
  });

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
        title="Avances de Obra"
        description="Registro de piezas completadas por los instaladores"
        icon={ClipboardList}
        actions={
          canCreate && (
            <Button onClick={() => setIsModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Registrar Avance
            </Button>
          )
        }
      />

      {/* Filters */}
      <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por obra o instalador..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={(value: 'todos' | 'pendiente' | 'pagado' | 'rechazada') => setStatusFilter(value)}>
          <SelectTrigger>
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los estados</SelectItem>
            <SelectItem value="pendiente">Pendientes</SelectItem>
            <SelectItem value="pagado">Pagados</SelectItem>
            <SelectItem value="rechazada">Rechazados</SelectItem>
          </SelectContent>
        </Select>
        <Select value={instaladorFilter} onValueChange={setInstaladorFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Filtrar por instalador" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los instaladores</SelectItem>
            {instaladores.map((instalador) => (
              <SelectItem key={instalador.id} value={instalador.id}>
                {instalador.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={registradoPorFilter} onValueChange={setRegistradoPorFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Quien registró" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los registradores</SelectItem>
            {registradoresUnicos.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {filteredAvances.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Sin avances"
          description="No hay avances registrados"
          action={
            canCreate && (
              <Button onClick={() => setIsModalOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Registrar Avance
              </Button>
            )
          }
        />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Obra</TableHead>
                <TableHead className="hidden md:table-cell">Instalador</TableHead>
                <TableHead>Piezas Completadas</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead className="hidden lg:table-cell">Estado</TableHead>
                <TableHead className="hidden xl:table-cell">Registrado por</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAvances.map((avance) => (
                <TableRow 
                  key={avance.id} 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setViewingAvance(avance)}
                >
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      {format(new Date(avance.fecha), 'dd MMM yyyy', { locale: es })}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    {avance.obras?.nombre || 'N/A'}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {(() => {
                      // Check if has multiple instaladores
                      if (avance.avance_instaladores && avance.avance_instaladores.length > 1) {
                        const nombres = avance.avance_instaladores
                          .map(ai => `${ai.instaladores?.nombre || 'N/A'} (${ai.porcentaje}%)`)
                          .join(', ');
                        return (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1 cursor-help">
                                  <Users className="w-4 h-4 text-muted-foreground" />
                                  <span>Varios ({avance.avance_instaladores.length})</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{nombres}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        );
                      }
                      // Single instalador
                      return avance.instaladores?.nombre || 'N/A';
                    })()}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {avance.avance_items.map((item) => (
                        <div key={item.id} className="flex items-center gap-2 text-sm">
                          <Box className="w-3 h-3 text-muted-foreground" />
                          <span>{item.obra_items?.descripcion || 'Item'}:</span>
                          <span className="font-medium">{item.cantidad_completada}</span>
                        </div>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {(() => {
                      const solicitudes = avance.solicitudes_pago || [];
                      if (solicitudes.length > 0) {
                        // Sum all solicitudes for total amount (handles multi-installer cases)
                        const totalMonto = solicitudes.reduce((acc, sol) => acc + sol.total_solicitado, 0);
                        const descuento = avance.obras?.descuento || 0;
                        return (
                          <div className="space-y-0.5">
                            <div className="font-semibold text-primary">
                              {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(totalMonto)}
                            </div>
                            {descuento > 0 && (
                              <div className="text-xs text-muted-foreground">
                                -{descuento}% desc.
                              </div>
                            )}
                          </div>
                        );
                      }
                      // Calculate from items if no solicitud
                      const subtotal = avance.avance_items.reduce((acc, item) => {
                        return acc + (item.cantidad_completada * (item.obra_items?.precio_unitario || 0));
                      }, 0);
                      const descuento = avance.obras?.descuento || 0;
                      const total = subtotal * (1 - descuento / 100);
                      return (
                        <div className="space-y-0.5">
                          <div className="font-semibold text-primary">
                            {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(total)}
                          </div>
                          {descuento > 0 && (
                            <div className="text-xs text-muted-foreground">
                              -{descuento}% desc.
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {(() => {
                      const solicitud = avance.solicitudes_pago?.[0];
                      const estado = solicitud?.estado || 'sin_solicitud';
                      const hasPago = solicitud?.pagos_destajos?.length > 0;
                      const corteCerrado = solicitud?.cortes_semanales?.estado === 'cerrado';
                      
                      // If corte is closed, it means payment was processed
                      if (hasPago || corteCerrado) {
                        return (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                            ✓ Pagado
                          </Badge>
                        );
                      } else if (estado === 'aprobada') {
                        return (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                            Aprobada
                          </Badge>
                        );
                      } else if (estado === 'rechazada') {
                        return (
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                              Rechazada
                            </Badge>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCrearNuevaSolicitud(avance)}
                              disabled={creatingSolicitud === avance.id}
                              className="h-6 text-xs"
                            >
                              <RefreshCw className={`w-3 h-3 mr-1 ${creatingSolicitud === avance.id ? 'animate-spin' : ''}`} />
                              Nueva solicitud
                            </Button>
                          </div>
                        );
                      } else if (estado === 'pendiente') {
                        return (
                          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                            Pendiente
                          </Badge>
                        );
                      } else {
                        return (
                          <Badge variant="outline" className="bg-muted text-muted-foreground">
                            Sin solicitud
                          </Badge>
                        );
                      }
                    })()}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell text-sm text-muted-foreground">
                    {avance.profiles?.full_name || avance.profiles?.email || '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* View Avance Detail Modal */}
      <Dialog open={!!viewingAvance} onOpenChange={(open) => !open && setViewingAvance(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5" />
              Detalle del Avance
            </DialogTitle>
          </DialogHeader>
          {viewingAvance && (
            <div className="space-y-4">
              {/* Basic info */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Fecha:</span>
                  <p className="font-medium">{format(new Date(viewingAvance.fecha), 'dd/MM/yyyy', { locale: es })}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Obra:</span>
                  <p className="font-medium">{viewingAvance.obras?.nombre || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Instalador:</span>
                  <p className="font-medium">
                    {viewingAvance.avance_instaladores && viewingAvance.avance_instaladores.length > 1 
                      ? `Varios (${viewingAvance.avance_instaladores.length})`
                      : viewingAvance.instaladores?.nombre || 'N/A'
                    }
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Registrado por:</span>
                  <p className="font-medium">{viewingAvance.profiles?.full_name || viewingAvance.profiles?.email || '-'}</p>
                </div>
              </div>

              {/* Multi-installer breakdown */}
              {viewingAvance.avance_instaladores && viewingAvance.avance_instaladores.length > 1 && (
                <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
                  <h4 className="font-semibold text-sm">Distribución por Instalador</h4>
                  <div className="space-y-1">
                    {viewingAvance.avance_instaladores.map((ai) => (
                      <div key={ai.id} className="flex justify-between text-sm">
                        <span>{ai.instaladores?.nombre || 'N/A'}</span>
                        <span className="font-medium">{ai.porcentaje}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Items breakdown */}
              <div className="border rounded-lg p-3 space-y-2">
                <h4 className="font-semibold text-sm">Piezas Completadas</h4>
                <div className="space-y-1">
                  {viewingAvance.avance_items.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <Box className="w-3 h-3 text-muted-foreground" />
                        {item.obra_items?.descripcion || 'Item'} x{item.cantidad_completada}
                      </span>
                      <span className="font-medium">
                        {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(
                          item.cantidad_completada * (item.obra_items?.precio_unitario || 0)
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Monto total */}
              <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg">
                <span className="font-semibold">Total</span>
                <span className="text-lg font-bold text-primary">
                  {(() => {
                    const solicitudes = viewingAvance.solicitudes_pago || [];
                    if (solicitudes.length > 0) {
                      const totalMonto = solicitudes.reduce((acc, sol) => acc + sol.total_solicitado, 0);
                      return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(totalMonto);
                    }
                    const subtotal = viewingAvance.avance_items.reduce((acc, item) => {
                      return acc + (item.cantidad_completada * (item.obra_items?.precio_unitario || 0));
                    }, 0);
                    const descuento = viewingAvance.obras?.descuento || 0;
                    const total = subtotal * (1 - descuento / 100);
                    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(total);
                  })()}
                </span>
              </div>

              {/* Estado */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Estado:</span>
                {(() => {
                  const solicitud = viewingAvance.solicitudes_pago?.[0];
                  const estado = solicitud?.estado || 'sin_solicitud';
                  const hasPago = solicitud?.pagos_destajos?.length > 0;
                  const corteCerrado = solicitud?.cortes_semanales?.estado === 'cerrado';
                  
                  if (hasPago || corteCerrado) {
                    return (
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                        ✓ Pagado
                      </Badge>
                    );
                  } else if (estado === 'aprobada') {
                    return (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        Aprobada
                      </Badge>
                    );
                  } else if (estado === 'rechazada') {
                    return (
                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                        Rechazada
                      </Badge>
                    );
                  } else if (estado === 'pendiente') {
                    return (
                      <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                        Pendiente
                      </Badge>
                    );
                  } else {
                    return (
                      <Badge variant="outline" className="bg-muted text-muted-foreground">
                        Sin solicitud
                      </Badge>
                    );
                  }
                })()}
              </div>

              {/* Observaciones */}
              {viewingAvance.observaciones && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Observaciones:</span>
                  <p className="mt-1 p-2 bg-muted/50 rounded">{viewingAvance.observaciones}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            {/* Actions for editable/deletable avances */}
            {viewingAvance && (
              <div className="flex gap-2 mr-auto">
                {/* Nueva solicitud button for rejected */}
                {viewingAvance.solicitudes_pago?.[0]?.estado === 'rechazada' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      handleCrearNuevaSolicitud(viewingAvance);
                    }}
                    disabled={creatingSolicitud === viewingAvance.id}
                  >
                    <RefreshCw className={`w-4 h-4 mr-1 ${creatingSolicitud === viewingAvance.id ? 'animate-spin' : ''}`} />
                    Nueva solicitud
                  </Button>
                )}
                {canEditAvance(viewingAvance) && canUpdate && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setViewingAvance(null);
                      handleOpenEdit(viewingAvance);
                    }}
                  >
                    <Pencil className="w-4 h-4 mr-1" />
                    Editar
                  </Button>
                )}
                {canDeleteAvance(viewingAvance) && canDelete && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive border-destructive/30 hover:bg-destructive/10"
                    onClick={() => {
                      setViewingAvance(null);
                      setAvanceToDelete(viewingAvance);
                      setIsDeleteOpen(true);
                    }}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Eliminar
                  </Button>
                )}
              </div>
            )}
            <Button variant="outline" onClick={() => setViewingAvance(null)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={(open) => {
        if (!open) resetForm();
        setIsModalOpen(open);
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAvance ? 'Editar Avance' : 'Registrar Avance'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="obra_id">Obra *</Label>
              <Select 
                value={selectedObraId} 
                onValueChange={setSelectedObraId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar obra" />
                </SelectTrigger>
                <SelectContent>
                  {obras
                    .filter((obra) => obrasWithPending.has(obra.id) || (editingAvance && obra.id === editingAvance.obra_id))
                    .map((obra) => (
                      <SelectItem key={obra.id} value={obra.id}>
                        {obra.nombre}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Instaladores Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Instaladores *</Label>
                <div className="flex gap-2">
                  {selectedInstaladores.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={distribuirEquitativamente}
                    >
                      Distribuir igual
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddInstalador}
                    disabled={selectedInstaladores.length >= instaladores.length}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Agregar
                  </Button>
                </div>
              </div>
              
              {selectedInstaladores.length === 0 ? (
                <div className="text-sm text-muted-foreground py-4 text-center border rounded-lg bg-muted/30">
                  Agrega al menos un instalador
                </div>
              ) : (
                <div className="space-y-2 border rounded-lg p-3 bg-muted/30">
                  {selectedInstaladores.map((inst, index) => {
                    const instaladorNombre = instaladores.find(i => i.id === inst.instalador_id)?.nombre || '';
                    const montoEstimado = totalConDescuentoEstimado * (inst.porcentaje / 100);
                    
                    return (
                      <div key={index} className="flex items-center gap-2">
                        <div className="flex-1">
                          <Select 
                            value={inst.instalador_id} 
                            onValueChange={(value) => handleInstaladorChange(index, value)}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Seleccionar instalador" />
                            </SelectTrigger>
                            <SelectContent>
                              {instaladores
                                .filter(i => i.id === inst.instalador_id || !selectedInstaladores.some(si => si.instalador_id === i.id))
                                .map((instalador) => (
                                  <SelectItem key={instalador.id} value={instalador.id}>
                                    {instalador.nombre}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="w-20">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={inst.porcentaje}
                            onChange={(e) => handlePorcentajeChange(index, parseFloat(e.target.value) || 0)}
                            className="text-center h-9"
                            placeholder="%"
                          />
                        </div>
                        <div className="w-24 text-right text-sm text-muted-foreground">
                          {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(montoEstimado)}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 flex-shrink-0"
                          onClick={() => handleRemoveInstalador(inst.instalador_id)}
                        >
                          <X className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    );
                  })}
                  
                  {/* Total row */}
                  <div className="flex items-center gap-2 pt-2 border-t mt-2">
                    <div className="flex-1 text-sm font-medium">Total</div>
                    <div className={`w-20 text-center text-sm font-bold ${Math.abs(totalPorcentaje - 100) < 0.01 ? 'text-green-600' : 'text-destructive'}`}>
                      {totalPorcentaje.toFixed(0)}%
                    </div>
                    <div className="w-24 text-right text-sm font-semibold">
                      {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(totalConDescuentoEstimado)}
                    </div>
                    <div className="w-9" /> {/* Spacer for alignment */}
                  </div>
                  
                  {Math.abs(totalPorcentaje - 100) > 0.01 && (
                    <p className="text-xs text-destructive">
                      Los porcentajes deben sumar 100%
                    </p>
                  )}
                </div>
              )}
            </div>
            
            <div>
              <Label htmlFor="fecha">Fecha</Label>
              <Input
                id="fecha"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>
            
            {/* Obra Items Section */}
            {selectedObraId && (
              <div className="space-y-3">
                <Label className="text-base font-medium">Items de la Obra</Label>
                {loadingObraItems ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                  </div>
                ) : obraItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No hay items pendientes en esta obra
                  </p>
                ) : (
                  <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
                    {obraItems.map((item) => (
                      <div key={item.obra_item_id} className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.descripcion}</p>
                          <p className="text-xs text-muted-foreground">
                            Pendiente: {item.cantidad_pendiente} de {item.cantidad_total}
                          </p>
                        </div>
                        <div className="w-20">
                          <Input
                            type="number"
                            min="0"
                            max={item.cantidad_pendiente}
                            value={item.cantidad_a_avanzar}
                            onChange={(e) => handleItemQuantityChange(item.obra_item_id, e.target.value)}
                            className="text-center"
                            placeholder="0"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            <div>
              <Label htmlFor="observaciones">Observaciones</Label>
              <Textarea
                id="observaciones"
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Notas adicionales..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving || loadingObraItems}>
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar avance?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará el avance y sus items asociados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
