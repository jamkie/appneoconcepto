import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Plus, Search, Pencil, Trash2, X, FileText, Download, CheckCircle, Clock, Eye, Loader2, FileSpreadsheet, ClipboardList, Banknote } from 'lucide-react';
import { useGenerateEstadoCuentaPDF } from '../hooks/useGenerateEstadoCuentaPDF';
import { useExportObrasExcel, type ExportFilter } from '../hooks/useExportObrasExcel';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { PageHeader, DataTable, EmptyState, StatusBadge } from '../components';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import type { Obra, ObraStatus, ObraItem } from '../types';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useSubmodulePermissions } from '@/hooks/useSubmodulePermissions';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface MobiliarioItem {
  id?: string;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
}

interface ExtraInfo {
  id: string;
  descripcion: string;
  monto: number;
  montoNeto: number;
  descuento: number;
  estado: string;
}

interface PagoInfo {
  id: string;
  fecha: string;
  monto: number;
  instalador_nombre: string;
  metodo_pago: string;
}

interface ObraWithItems extends Obra {
  items: ObraItem[];
  avances: { [itemId: string]: number };
  totalPagado: number;
  totalExtras: number;
  extras: ExtraInfo[];
  pagos: PagoInfo[];
  created_by?: string;
}

interface ProfileInfo {
  id: string;
  full_name: string;
}

export default function ObrasPage() {
  const { user, loading } = useAuth();
  const { canCreate, canUpdate, canDelete } = useSubmodulePermissions('destajos', 'obras');
  const navigate = useNavigate();
  const { toast } = useToast();
  const { generatePDF: generateEstadoCuentaPDF } = useGenerateEstadoCuentaPDF();
  const { exportObrasToExcel } = useExportObrasExcel();
  const [obras, setObras] = useState<ObraWithItems[]>([]);
  const [profiles, setProfiles] = useState<ProfileInfo[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [registradoPorFilter, setRegistradoPorFilter] = useState('todos');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedObra, setSelectedObra] = useState<ObraWithItems | null>(null);
  const [saving, setSaving] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    nombre: '',
    cliente: '',
    responsable: '',
    estado: 'activa' as ObraStatus,
    descuento: 0,
  });
  const [mobiliarioItems, setMobiliarioItems] = useState<MobiliarioItem[]>([]);
  const [extrasDialogOpen, setExtrasDialogOpen] = useState(false);
  const [extrasDialogObra, setExtrasDialogObra] = useState<ObraWithItems | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailObra, setDetailObra] = useState<ObraWithItems | null>(null);
  const [activeTab, setActiveTab] = useState<string>('activas');

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchObras();
    }
  }, [user]);

  const fetchObras = async () => {
    try {
      setLoadingData(true);
      
      // Fetch obras
      const { data: obrasData, error } = await supabase
        .from('obras')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch profiles for filtering by who registered
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name');
      
      setProfiles((profilesData || []).map(p => ({ id: p.id, full_name: p.full_name || 'Sin nombre' })));

      // Fetch all obra_items
      const { data: itemsData } = await supabase
        .from('obra_items')
        .select('*');

      // Fetch all avance_items to calculate progress
      const { data: avanceItemsData } = await supabase
        .from('avance_items')
        .select('obra_item_id, cantidad_completada');

      // Fetch all pagos_destajos with instalador info
      const { data: pagosData } = await supabase
        .from('pagos_destajos')
        .select('id, obra_id, monto, fecha, metodo_pago, instalador_id');

      // Fetch instaladores for pagos
      const { data: instaladoresData } = await supabase
        .from('instaladores')
        .select('id, nombre');

      // Fetch all extras with descuento
      const { data: extrasData } = await supabase
        .from('extras')
        .select('id, obra_id, descripcion, monto, estado, descuento');

      // Fetch rejected solicitudes to mark extras as rejected
      const { data: solicitudesRechazadas } = await supabase
        .from('solicitudes_pago')
        .select('extras_ids')
        .eq('tipo', 'extra')
        .eq('estado', 'rechazada');

      // Build the enriched obras
      const enrichedObras: ObraWithItems[] = (obrasData as any[] || []).map((obra) => {
        const items = (itemsData || []).filter((item) => item.obra_id === obra.id).map((item) => ({
          ...item,
          cantidad: item.cantidad,
          precio_unitario: Number(item.precio_unitario),
        }));

        // Calculate avances per item
        const avances: { [itemId: string]: number } = {};
        items.forEach((item) => {
          const itemAvances = (avanceItemsData || [])
            .filter((ai) => ai.obra_item_id === item.id)
            .reduce((sum, ai) => sum + ai.cantidad_completada, 0);
          avances[item.id] = itemAvances;
        });

        // Get pagos for this obra with instalador info
        const obraPagos = (pagosData || [])
          .filter((p) => p.obra_id === obra.id)
          .map((p) => {
            const instalador = (instaladoresData || []).find((i) => i.id === p.instalador_id);
            return {
              id: p.id,
              fecha: p.fecha,
              monto: Number(p.monto),
              instalador_nombre: instalador?.nombre || 'Desconocido',
              metodo_pago: p.metodo_pago,
            };
          });

        // Calculate total pagado
        const totalPagado = obraPagos.reduce((sum, p) => sum + p.monto, 0);

        // Get extras for this obra with rejected status from solicitudes
        const rejectedExtraIds = (solicitudesRechazadas || [])
          .flatMap(s => s.extras_ids || []);
        
        const obraExtras = (extrasData || [])
          .filter((e) => e.obra_id === obra.id)
          .map((e) => {
            const descuentoExtra = Number(e.descuento || 0);
            const montoNeto = Number(e.monto) * (1 - descuentoExtra / 100);
            return {
              id: e.id,
              descripcion: e.descripcion,
              monto: Number(e.monto),
              montoNeto: montoNeto,
              descuento: descuentoExtra,
              estado: rejectedExtraIds.includes(e.id) ? 'rechazado' : (e.estado || 'pendiente'),
            };
          });

        // Calculate total extras with discount applied (pendientes y aprobados, excluyendo rechazados)
        const totalExtras = obraExtras
          .filter((e) => e.estado !== 'rechazado')
          .reduce((sum, e) => sum + e.montoNeto, 0);

        return {
          ...obra,
          items,
          avances,
          totalPagado,
          totalExtras,
          extras: obraExtras,
          pagos: obraPagos,
          created_by: obra.created_by || undefined,
        } as ObraWithItems;
      });

      setObras(enrichedObras);
    } catch (error) {
      console.error('Error fetching obras:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las obras',
        variant: 'destructive',
      });
    } finally {
      setLoadingData(false);
    }
  };

  const handleOpenModal = async (obra?: ObraWithItems) => {
    if (obra) {
      setSelectedObra(obra);
      setFormData({
        nombre: obra.nombre,
        cliente: obra.cliente || '',
        responsable: (obra as any).responsable || '',
        estado: obra.estado,
        descuento: (obra as any).descuento || 0,
      });
      setMobiliarioItems(
        obra.items.map((item) => ({
          id: item.id,
          descripcion: item.descripcion,
          cantidad: item.cantidad,
          precio_unitario: Number(item.precio_unitario),
        }))
      );
    } else {
      setSelectedObra(null);
      setFormData({
        nombre: '',
        cliente: '',
        responsable: '',
        estado: 'activa',
        descuento: 0,
      });
      setMobiliarioItems([]);
    }
    setIsModalOpen(true);
  };

  const handleRemoveItem = (index: number) => {
    setMobiliarioItems(mobiliarioItems.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!formData.nombre.trim()) {
      toast({
        title: 'Error',
        description: 'El nombre es requerido',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(true);
      const obraData: Record<string, any> = {
        nombre: formData.nombre.trim(),
        cliente: formData.cliente.trim() || null,
        responsable: formData.responsable.trim() || null,
        ubicacion: null,
        estado: formData.estado,
        descuento: formData.descuento,
        precio_cocina: 0,
        precio_closet: 0,
        precio_cubierta: 0,
        precio_vanity: 0,
      };

      // Add created_by only for new obras
      if (!selectedObra && user) {
        obraData.created_by = user.id;
      }

      let obraId = selectedObra?.id;

      if (selectedObra) {
        const { error } = await supabase
          .from('obras')
          .update(obraData)
          .eq('id', selectedObra.id);
        if (error) throw error;

        // Delete existing items and re-insert
        await supabase.from('obra_items').delete().eq('obra_id', selectedObra.id);
      } else {
        const { data, error } = await supabase
          .from('obras')
          .insert(obraData as any)
          .select('id')
          .single();
        if (error) throw error;
        obraId = data.id;
      }

      // Insert mobiliario items
      if (obraId && mobiliarioItems.length > 0) {
        const itemsToInsert = mobiliarioItems.map((item) => ({
          obra_id: obraId,
          descripcion: item.descripcion,
          cantidad: item.cantidad,
          precio_unitario: item.precio_unitario,
        }));
        const { error: itemsError } = await supabase.from('obra_items').insert(itemsToInsert);
        if (itemsError) throw itemsError;
      }

      toast({
        title: 'Éxito',
        description: selectedObra ? 'Obra actualizada correctamente' : 'Obra creada correctamente',
      });
      setIsModalOpen(false);
      fetchObras();
    } catch (error) {
      console.error('Error saving obra:', error);
      toast({
        title: 'Error',
        description: 'No se pudo guardar la obra',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // Helper to check if obra has avances
  const obraTieneAvances = (obra: ObraWithItems) => {
    return Object.values(obra.avances).some(cantidad => cantidad > 0);
  };

  const handleDelete = async () => {
    if (!selectedObra) return;

    try {
      const { error } = await supabase
        .from('obras')
        .delete()
        .eq('id', selectedObra.id);

      if (error) throw error;

      toast({ title: 'Éxito', description: 'Obra eliminada correctamente' });
      setIsDeleteDialogOpen(false);
      setSelectedObra(null);
      fetchObras();
    } catch (error: any) {
      console.error('Error deleting obra:', error);
      const mensaje = error?.message || 'No se pudo eliminar la obra';
      toast({
        title: 'No se puede eliminar',
        description: mensaje,
        variant: 'destructive',
      });
    }
  };

  // Get unique registradores from obras
  const registradoresUnicos = profiles.filter(profile =>
    obras.some(obra => obra.created_by === profile.id)
  );

  // Filter obras by search, tab, and registrado por
  const filteredObras = obras.filter((obra) => {
    const matchesSearch = obra.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      obra.cliente?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTab = activeTab === 'activas' ? obra.estado === 'activa' : obra.estado === 'cerrada';
    const matchesRegistrador = registradoPorFilter === 'todos' || obra.created_by === registradoPorFilter;
    return matchesSearch && matchesTab && matchesRegistrador;
  });

  // Count for badges
  const obrasActivas = obras.filter(o => o.estado === 'activa').length;
  const obrasCerradas = obras.filter(o => o.estado === 'cerrada').length;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(amount);
  };

  const handleDownloadEstadoCuenta = async (obra: ObraWithItems) => {
    try {
      setGeneratingPDF(true);
      await generateEstadoCuentaPDF({
        id: obra.id,
        nombre: obra.nombre,
        cliente: obra.cliente,
        responsable: (obra as any).responsable,
        estado: obra.estado,
        descuento: (obra as any).descuento,
        items: obra.items,
        extras: obra.extras,
        pagos: obra.pagos,
        avances: obra.avances,
        totalExtras: obra.totalExtras,
        totalPagado: obra.totalPagado,
      });
      toast({
        title: 'PDF generado',
        description: 'El estado de cuenta se descargó correctamente',
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: 'Error',
        description: 'No se pudo generar el PDF',
        variant: 'destructive',
      });
    } finally {
      setGeneratingPDF(false);
    }
  };

  const columns = [
    {
      key: 'nombre',
      header: 'Nombre',
      cell: (item: ObraWithItems) => (
        <div>
          <span className="font-medium">{item.nombre}</span>
          {item.cliente && (
            <p className="text-sm text-muted-foreground">{item.cliente}</p>
          )}
        </div>
      ),
    },
    {
      key: 'responsable',
      header: 'Responsable',
      cell: (item: ObraWithItems) => (
        <span className="text-sm">{(item as any).responsable || '-'}</span>
      ),
      hideOnMobile: true,
    },
    {
      key: 'piezas',
      header: 'Piezas',
      cell: (item: ObraWithItems) => (
        <div className="space-y-1 min-w-[120px]">
          {item.items.length > 0 ? (
            item.items.map((pieza) => {
              const completado = item.avances[pieza.id] || 0;
              const total = pieza.cantidad;
              const percent = total > 0 ? (completado / total) * 100 : 0;
              return (
                <div key={pieza.id} className="text-xs">
                  <div className="flex justify-between mb-0.5">
                    <span>{pieza.descripcion}</span>
                    <span className="text-muted-foreground">{completado}/{total}</span>
                  </div>
                  <Progress value={percent} className="h-1" />
                </div>
              );
            })
          ) : (
            <span className="text-muted-foreground text-xs">Sin piezas</span>
          )}
        </div>
      ),
      hideOnMobile: true,
    },
    {
      key: 'precios',
      header: 'Precios Unitarios',
      cell: (item: ObraWithItems) => (
        <div className="space-y-0.5 text-xs min-w-[140px]">
          {item.items.length > 0 ? (
            item.items.map((pieza) => (
              <div key={pieza.id}>
                <span className="text-muted-foreground">{pieza.descripcion}:</span>{' '}
                <span className="font-medium">{formatCurrency(pieza.precio_unitario)}</span>
              </div>
            ))
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </div>
      ),
      hideOnMobile: true,
    },
    {
      key: 'extras',
      header: 'Extras',
      cell: (item: ObraWithItems) => {
        if (item.extras.length === 0) {
          return <span className="text-muted-foreground text-xs">-</span>;
        }
        return (
          <Button
            variant="ghost"
            size="sm"
            className="h-auto py-1 px-2 text-xs font-medium hover:bg-accent"
            onClick={(e) => {
              e.stopPropagation();
              setExtrasDialogObra(item);
              setExtrasDialogOpen(true);
            }}
          >
            {formatCurrency(item.totalExtras)}
          </Button>
        );
      },
      hideOnMobile: true,
    },
    {
      key: 'montoTotal',
      header: 'Monto Total',
      cell: (item: ObraWithItems) => {
        const totalItems = item.items.reduce((sum, pieza) => sum + pieza.cantidad * pieza.precio_unitario, 0);
        const subtotal = totalItems + item.totalExtras;
        const descuento = (item as any).descuento || 0;
        const montoDescuento = subtotal * (descuento / 100);
        const total = subtotal - montoDescuento;
        return (
          <div>
            <span className="font-medium">{formatCurrency(total)}</span>
            {descuento > 0 && (
              <p className="text-xs text-amber-600">-{descuento}%</p>
            )}
          </div>
        );
      },
      hideOnMobile: true,
    },
    {
      key: 'pagado',
      header: 'Pagado',
      cell: (item: ObraWithItems) => (
        <span className="text-muted-foreground">{formatCurrency(item.totalPagado)}</span>
      ),
      hideOnMobile: true,
    },
    {
      key: 'porPagar',
      header: 'Por Pagar',
      cell: (item: ObraWithItems) => {
        const totalItems = item.items.reduce((sum, pieza) => sum + pieza.cantidad * pieza.precio_unitario, 0);
        const subtotal = totalItems + item.totalExtras;
        const descuento = (item as any).descuento || 0;
        const montoDescuento = subtotal * (descuento / 100);
        const total = subtotal - montoDescuento;
        const porPagar = total - item.totalPagado;
        return <span className="font-medium text-emerald-600">{formatCurrency(porPagar)}</span>;
      },
      hideOnMobile: true,
    },
    {
      key: 'estado',
      header: 'Estado',
      cell: (item: ObraWithItems) => (
        <Badge
          variant="outline"
          className={
            item.estado === 'activa'
              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
              : 'bg-muted text-muted-foreground'
          }
        >
          {item.estado === 'activa' ? 'Activa' : 'Cerrada'}
        </Badge>
      ),
    },
  ];

  const handleOpenDetail = (obra: ObraWithItems) => {
    setDetailObra(obra);
    setDetailDialogOpen(true);
  };

  // Calculate detail obra values
  const getObraCalculations = (obra: ObraWithItems) => {
    const totalItems = obra.items.reduce((sum, pieza) => sum + pieza.cantidad * pieza.precio_unitario, 0);
    const subtotal = totalItems + obra.totalExtras;
    const descuento = (obra as any).descuento || 0;
    const montoDescuento = subtotal * (descuento / 100);
    const total = subtotal - montoDescuento;
    const porPagar = total - obra.totalPagado;
    return { totalItems, subtotal, descuento, montoDescuento, total, porPagar };
  };

  const handleExportExcel = async (filter: ExportFilter) => {
    try {
      setExportingExcel(true);
      await exportObrasToExcel(filter);
      toast({
        title: 'Excel generado',
        description: 'El archivo de obras se descargó correctamente',
      });
      setExportDialogOpen(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo generar el archivo Excel',
        variant: 'destructive',
      });
    } finally {
      setExportingExcel(false);
    }
  };

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
        title="Obras"
        description="Gestión de obras y proyectos"
        icon={Building2}
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setExportDialogOpen(true)}
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Exportar Excel
            </Button>
            {canCreate && (
              <Button onClick={() => handleOpenModal()}>
                <Plus className="w-4 h-4 mr-2" />
                Nueva Obra
              </Button>
            )}
          </div>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="activas" className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            En Proceso
            {obrasActivas > 0 && (
              <Badge variant="secondary" className="ml-1">
                {obrasActivas}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="cerradas" className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Concluidas
            {obrasCerradas > 0 && (
              <Badge variant="secondary" className="ml-1">
                {obrasCerradas}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="activas" className="space-y-4 mt-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-4 items-center">
            <div className="relative max-w-sm flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar obras..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={registradoPorFilter} onValueChange={setRegistradoPorFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Quien registró" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los registros</SelectItem>
                {registradoresUnicos.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {profile.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <DataTable
            columns={columns}
            data={filteredObras}
            keyExtractor={(item) => item.id}
            onRowClick={handleOpenDetail}
            emptyState={
              <EmptyState
                icon={Building2}
                title="Sin obras en proceso"
                description="No hay obras activas registradas"
                action={
                  <Button onClick={() => handleOpenModal()}>
                    <Plus className="w-4 h-4 mr-2" />
                    Nueva Obra
                  </Button>
                }
              />
            }
          />
        </TabsContent>

        <TabsContent value="cerradas" className="space-y-4 mt-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-4 items-center">
            <div className="relative max-w-sm flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar obras concluidas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={registradoPorFilter} onValueChange={setRegistradoPorFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Quien registró" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los registros</SelectItem>
                {registradoresUnicos.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {profile.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <DataTable
            columns={columns}
            data={filteredObras}
            keyExtractor={(item) => item.id}
            onRowClick={handleOpenDetail}
            emptyState={
              <EmptyState
                icon={CheckCircle}
                title="Sin obras concluidas"
                description="No hay obras cerradas registradas"
              />
            }
          />
        </TabsContent>
      </Tabs>

      {/* Create/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {selectedObra ? 'Editar Obra' : 'Nueva Obra'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto flex-1 pr-2">
            <div>
              <Label htmlFor="nombre">Nombre de la obra *</Label>
              <Input
                id="nombre"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                placeholder="Ej: Residencial Las Palmas"
              />
            </div>
            <div>
              <Label htmlFor="cliente">Cliente</Label>
              <Input
                id="cliente"
                value={formData.cliente}
                onChange={(e) => setFormData({ ...formData, cliente: e.target.value })}
                placeholder="Nombre del cliente"
              />
            </div>
            <div>
              <Label htmlFor="responsable">Responsable</Label>
              <Input
                id="responsable"
                value={formData.responsable}
                onChange={(e) => setFormData({ ...formData, responsable: e.target.value })}
                placeholder="Nombre del responsable"
              />
            </div>
            
            {/* Descuento */}
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
              <Label htmlFor="descuento" className="text-amber-700 dark:text-amber-400">Descuento (%)</Label>
              <Input
                id="descuento"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={formData.descuento || ''}
                onChange={(e) => setFormData({ ...formData, descuento: parseFloat(e.target.value) || 0 })}
                placeholder="0"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Porcentaje que se descuenta del total de la obra
              </p>
            </div>

            {/* Piezas Section */}
            <div className="space-y-3">
              <Label>Piezas</Label>

              {/* Items list */}
              {mobiliarioItems.length > 0 && (
                <div className="space-y-3">
                  {mobiliarioItems.map((item, index) => (
                    <div key={index} className="relative border rounded-lg p-3 space-y-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-6 w-6 text-destructive hover:text-destructive"
                        onClick={() => handleRemoveItem(index)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                      <Input
                        value={item.descripcion}
                        onChange={(e) => {
                          const updated = [...mobiliarioItems];
                          updated[index].descripcion = e.target.value;
                          setMobiliarioItems(updated);
                        }}
                        placeholder="Descripción (ej: Cocinas, Clósets, Mueble especial...)"
                        className="pr-10"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          type="number"
                          min="0"
                          value={item.cantidad || ''}
                          onChange={(e) => {
                            const updated = [...mobiliarioItems];
                            updated[index].cantidad = parseInt(e.target.value) || 0;
                            setMobiliarioItems(updated);
                          }}
                          placeholder="Cantidad"
                        />
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.precio_unitario || ''}
                          onChange={(e) => {
                            const updated = [...mobiliarioItems];
                            updated[index].precio_unitario = parseFloat(e.target.value) || 0;
                            setMobiliarioItems(updated);
                          }}
                          placeholder="Precio unitario"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add button below items */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  setMobiliarioItems([
                    ...mobiliarioItems,
                    { descripcion: '', cantidad: 0, precio_unitario: 0 },
                  ]);
                }}
              >
                <Plus className="w-4 h-4 mr-1" />
                Agregar Pieza
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando...' : selectedObra ? 'Guardar' : 'Crear Obra'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {selectedObra && obraTieneAvances(selectedObra) 
                ? '⚠️ No se puede eliminar' 
                : '¿Eliminar obra?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedObra && obraTieneAvances(selectedObra) 
                ? `La obra "${selectedObra.nombre}" tiene avances registrados y no puede ser eliminada. Para eliminarla, primero debe eliminar todos los avances asociados.`
                : `Esta acción no se puede deshacer. Se eliminará la obra "${selectedObra?.nombre}" y todos sus datos asociados.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {selectedObra && obraTieneAvances(selectedObra) ? 'Entendido' : 'Cancelar'}
            </AlertDialogCancel>
            {selectedObra && !obraTieneAvances(selectedObra) && (
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                Eliminar
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Extras Dialog */}
      <Dialog open={extrasDialogOpen} onOpenChange={setExtrasDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Extras - {extrasDialogObra?.nombre}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {extrasDialogObra?.extras.length === 0 ? (
              <p className="text-muted-foreground text-sm">Sin extras registrados</p>
            ) : (
              <>
                {extrasDialogObra?.extras.map((extra) => (
                  <div
                    key={extra.id}
                    className="flex justify-between items-center p-3 rounded-lg border bg-card"
                  >
                    <div>
                      <p className="font-medium text-sm">{extra.descripcion}</p>
                      <Badge
                        variant="outline"
                        className={
                          extra.estado === 'aprobado'
                            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs'
                            : extra.estado === 'pendiente'
                            ? 'bg-amber-500/10 text-amber-600 border-amber-500/20 text-xs'
                            : 'bg-red-500/10 text-red-600 border-red-500/20 text-xs'
                        }
                      >
                        {extra.estado.charAt(0).toUpperCase() + extra.estado.slice(1)}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <span
                        className={`font-semibold ${
                          extra.estado === 'aprobado' ? 'text-emerald-600' : 'text-muted-foreground'
                        }`}
                      >
                        {formatCurrency(extra.montoNeto)}
                      </span>
                      {extra.descuento > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Bruto: {formatCurrency(extra.monto)} (-{extra.descuento}%)
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-3 border-t">
                  <span className="font-medium">Total Aprobados:</span>
                  <span className="font-bold text-emerald-600">
                    {formatCurrency(extrasDialogObra?.totalExtras || 0)}
                  </span>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              {detailObra?.nombre}
            </DialogTitle>
          </DialogHeader>
          
          {detailObra && (
            <div className="space-y-6 overflow-y-auto flex-1 pr-2">
              {/* Info general */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Cliente</p>
                  <p className="font-medium">{detailObra.cliente || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Responsable</p>
                  <p className="font-medium">{(detailObra as any).responsable || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Estado</p>
                  <Badge
                    variant="outline"
                    className={
                      detailObra.estado === 'activa'
                        ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                        : 'bg-muted text-muted-foreground'
                    }
                  >
                    {detailObra.estado === 'activa' ? 'Activa' : 'Cerrada'}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Descuento</p>
                  <p className="font-medium text-amber-600">
                    {(detailObra as any).descuento || 0}%
                  </p>
                </div>
              </div>

              {/* Piezas */}
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Piezas ({detailObra.items.length})
                </h4>
                {detailObra.items.length > 0 ? (
                  <div className="space-y-2 border rounded-lg p-3 bg-muted/30">
                    {detailObra.items.map((pieza) => {
                      const completado = detailObra.avances[pieza.id] || 0;
                      const total = pieza.cantidad;
                      const percent = total > 0 ? (completado / total) * 100 : 0;
                      return (
                        <div key={pieza.id} className="flex justify-between items-center text-sm">
                          <div className="flex-1">
                            <div className="flex justify-between mb-1">
                              <span>{pieza.descripcion}</span>
                              <span className="text-muted-foreground">{completado}/{total} - {formatCurrency(pieza.precio_unitario)} c/u</span>
                            </div>
                            <Progress value={percent} className="h-1.5" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">Sin piezas registradas</p>
                )}
              </div>

              {/* Extras */}
              {detailObra.extras.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Extras ({detailObra.extras.length})</h4>
                  <div className="space-y-2 border rounded-lg p-3 bg-muted/30 max-h-[150px] overflow-y-auto">
                    {detailObra.extras.map((extra) => (
                      <div key={extra.id} className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-2">
                          <span>{extra.descripcion}</span>
                          <Badge
                            variant="outline"
                            className={
                              extra.estado === 'aprobado'
                                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs'
                                : extra.estado === 'pendiente'
                                ? 'bg-amber-500/10 text-amber-600 border-amber-500/20 text-xs'
                                : 'bg-red-500/10 text-red-600 border-red-500/20 text-xs'
                            }
                          >
                            {extra.estado.charAt(0).toUpperCase() + extra.estado.slice(1)}
                          </Badge>
                        </div>
                        <span className={extra.estado === 'aprobado' ? 'text-emerald-600 font-medium' : 'text-muted-foreground'}>
                          {formatCurrency(extra.montoNeto)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pagos */}
              {detailObra.pagos.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Pagos Realizados ({detailObra.pagos.length})</h4>
                  <div className="space-y-2 border rounded-lg p-3 bg-muted/30 max-h-[150px] overflow-y-auto">
                    {detailObra.pagos.map((pago) => (
                      <div key={pago.id} className="flex justify-between items-center text-sm">
                        <div>
                          <span>{pago.instalador_nombre}</span>
                          <span className="text-muted-foreground ml-2 text-xs">
                            {format(new Date(pago.fecha), 'dd/MM/yyyy', { locale: es })}
                          </span>
                        </div>
                        <span className="font-medium">{formatCurrency(pago.monto)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Resumen financiero */}
              <div className="border rounded-lg p-4 bg-muted/30 space-y-2">
                <h4 className="font-semibold mb-3">Resumen Financiero</h4>
                {(() => {
                  const calc = getObraCalculations(detailObra);
                  return (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal Piezas:</span>
                        <span>{formatCurrency(calc.totalItems)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal Extras:</span>
                        <span>{formatCurrency(detailObra.totalExtras)}</span>
                      </div>
                      {calc.descuento > 0 && (
                        <div className="flex justify-between text-sm text-amber-600">
                          <span>Descuento ({calc.descuento}%):</span>
                          <span>-{formatCurrency(calc.montoDescuento)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-semibold border-t pt-2">
                        <span>Monto Total:</span>
                        <span>{formatCurrency(calc.total)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total Pagado:</span>
                        <span>{formatCurrency(detailObra.totalPagado)}</span>
                      </div>
                      <div className="flex justify-between font-semibold text-emerald-600">
                        <span>Por Pagar:</span>
                        <span>{formatCurrency(calc.porPagar)}</span>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2 pt-4 border-t">
            {/* Quick action buttons for adding avances/extras */}
            {detailObra?.estado === 'activa' && (
              <div className="flex gap-2 w-full sm:w-auto">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    if (detailObra) {
                      setDetailDialogOpen(false);
                      navigate(`/destajos/avances?obra=${detailObra.id}`);
                    }
                  }}
                  className="flex-1 sm:flex-none"
                >
                  <ClipboardList className="w-4 h-4 mr-2" />
                  Agregar Avance
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    if (detailObra) {
                      setDetailDialogOpen(false);
                      navigate(`/destajos/extras?obra=${detailObra.id}`);
                    }
                  }}
                  className="flex-1 sm:flex-none"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Agregar Extra
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (detailObra) {
                      setDetailDialogOpen(false);
                      navigate(`/destajos/solicitudes?anticipo_obra=${detailObra.id}`);
                    }
                  }}
                  className="flex-1 sm:flex-none"
                >
                  <Banknote className="w-4 h-4 mr-2" />
                  Agregar Anticipo
                </Button>
              </div>
            )}
            
            <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
              <Button
                variant="outline"
                onClick={() => {
                  if (detailObra) handleDownloadEstadoCuenta(detailObra);
                }}
                disabled={generatingPDF}
                className="flex-1 sm:flex-none"
              >
                {generatingPDF ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                Estado de Cuenta
              </Button>
              {canUpdate && (
                <Button
                  variant="outline"
                  onClick={() => {
                    if (detailObra) {
                      setDetailDialogOpen(false);
                      handleOpenModal(detailObra);
                    }
                  }}
                  className="flex-1 sm:flex-none"
                >
                  <Pencil className="w-4 h-4 mr-2" />
                  Editar
                </Button>
              )}
              <Button
                variant="destructive"
                onClick={() => {
                  if (detailObra) {
                    setDetailDialogOpen(false);
                    setSelectedObra(detailObra);
                    setIsDeleteDialogOpen(true);
                  }
                }}
                disabled={!detailObra || obraTieneAvances(detailObra)}
                className="flex-1 sm:flex-none"
                title={detailObra && obraTieneAvances(detailObra) ? 'No se puede eliminar una obra con avances' : ''}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Eliminar
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Dialog */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Exportar Obras a Excel</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <p className="text-sm text-muted-foreground">¿Qué obras deseas exportar?</p>
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                className="justify-start"
                disabled={exportingExcel}
                onClick={async () => {
                  await handleExportExcel('activas');
                }}
              >
                <Clock className="w-4 h-4 mr-2" />
                Solo En Proceso ({obrasActivas})
              </Button>
              <Button
                variant="outline"
                className="justify-start"
                disabled={exportingExcel}
                onClick={async () => {
                  await handleExportExcel('cerradas');
                }}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Solo Concluidas ({obrasCerradas})
              </Button>
              <Button
                className="justify-start"
                disabled={exportingExcel}
                onClick={async () => {
                  await handleExportExcel('todas');
                }}
              >
                {exportingExcel ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                )}
                Todas las Obras ({obras.length})
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
