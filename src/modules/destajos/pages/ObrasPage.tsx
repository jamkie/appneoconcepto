import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Plus, Search, Pencil, Trash2, X, FileText, Download } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { PageHeader, DataTable, EmptyState, StatusBadge } from '../components';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
}

export default function ObrasPage() {
  const { user, loading } = useAuth();
  const { canCreate, canUpdate, canDelete } = useSubmodulePermissions('destajos', 'obras');
  const navigate = useNavigate();
  const { toast } = useToast();
  const [obras, setObras] = useState<ObraWithItems[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedObra, setSelectedObra] = useState<ObraWithItems | null>(null);
  const [saving, setSaving] = useState(false);
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

      // Fetch all extras
      const { data: extrasData } = await supabase
        .from('extras')
        .select('id, obra_id, descripcion, monto, estado');

      // Fetch rejected solicitudes to mark extras as rejected
      const { data: solicitudesRechazadas } = await supabase
        .from('solicitudes_pago')
        .select('extras_ids')
        .eq('tipo', 'extra')
        .eq('estado', 'rechazada');

      // Build the enriched obras
      const enrichedObras: ObraWithItems[] = (obrasData || []).map((obra) => {
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
          .map((e) => ({
            id: e.id,
            descripcion: e.descripcion,
            monto: Number(e.monto),
            estado: rejectedExtraIds.includes(e.id) ? 'rechazado' : (e.estado || 'pendiente'),
          }));

        // Calculate total extras (pendientes y aprobados, excluyendo rechazados)
        const totalExtras = obraExtras
          .filter((e) => e.estado !== 'rechazado')
          .reduce((sum, e) => sum + e.monto, 0);

        return {
          ...obra,
          items,
          avances,
          totalPagado,
          totalExtras,
          extras: obraExtras,
          pagos: obraPagos,
        };
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
      const obraData = {
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
          .insert(obraData)
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
    } catch (error) {
      console.error('Error deleting obra:', error);
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la obra',
        variant: 'destructive',
      });
    }
  };

  const filteredObras = obras.filter((obra) =>
    obra.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    obra.cliente?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(amount);
  };

  const generateEstadoDeCuenta = (obra: ObraWithItems) => {
    const totalItems = obra.items.reduce((sum, pieza) => sum + pieza.cantidad * pieza.precio_unitario, 0);
    const subtotal = totalItems + obra.totalExtras;
    const descuento = (obra as any).descuento || 0;
    const montoDescuento = subtotal * (descuento / 100);
    const total = subtotal - montoDescuento;
    const porPagar = total - obra.totalPagado;

    let content = `ESTADO DE CUENTA\n`;
    content += `================\n\n`;
    content += `Obra: ${obra.nombre}\n`;
    if (obra.cliente) content += `Cliente: ${obra.cliente}\n`;
    content += `Fecha: ${format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: es })}\n`;
    content += `\n`;

    // Piezas
    content += `PIEZAS\n`;
    content += `------\n`;
    obra.items.forEach((pieza) => {
      const completado = obra.avances[pieza.id] || 0;
      const subtotal = pieza.cantidad * pieza.precio_unitario;
      content += `${pieza.descripcion}: ${completado}/${pieza.cantidad} x ${formatCurrency(pieza.precio_unitario)} = ${formatCurrency(subtotal)}\n`;
    });
    content += `Subtotal Piezas: ${formatCurrency(totalItems)}\n\n`;

    // Extras
    const extrasAprobados = obra.extras.filter((e) => e.estado === 'aprobado');
    if (extrasAprobados.length > 0) {
      content += `EXTRAS APROBADOS\n`;
      content += `----------------\n`;
      extrasAprobados.forEach((extra) => {
        content += `${extra.descripcion}: ${formatCurrency(extra.monto)}\n`;
      });
      content += `Subtotal Extras: ${formatCurrency(obra.totalExtras)}\n\n`;
    }

    // Pagos
    if (obra.pagos.length > 0) {
      content += `PAGOS REALIZADOS\n`;
      content += `----------------\n`;
      obra.pagos.forEach((pago) => {
        content += `${format(new Date(pago.fecha), 'dd/MM/yyyy')} - ${pago.instalador_nombre}: ${formatCurrency(pago.monto)} (${pago.metodo_pago})\n`;
      });
      content += `Total Pagado: ${formatCurrency(obra.totalPagado)}\n\n`;
    }

    // Resumen
    content += `RESUMEN\n`;
    content += `-------\n`;
    content += `Subtotal: ${formatCurrency(subtotal)}\n`;
    if (descuento > 0) {
      content += `Descuento (${descuento}%): -${formatCurrency(montoDescuento)}\n`;
    }
    content += `Total Obra: ${formatCurrency(total)}\n`;
    content += `Total Pagado: ${formatCurrency(obra.totalPagado)}\n`;
    content += `Por Pagar: ${formatCurrency(porPagar)}\n`;

    // Download
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `estado-cuenta-${obra.nombre.toLowerCase().replace(/\s+/g, '-')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
    {
      key: 'actions',
      header: 'Acciones',
      cell: (item: ObraWithItems) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            title="Descargar estado de cuenta"
            onClick={(e) => {
              e.stopPropagation();
              generateEstadoDeCuenta(item);
            }}
          >
            <Download className="w-4 h-4" />
          </Button>
          {canUpdate && (
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenModal(item);
              }}
            >
              <Pencil className="w-4 h-4" />
            </Button>
          )}
          {canDelete && (
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedObra(item);
                setIsDeleteDialogOpen(true);
              }}
            >
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
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

  return (
    <div>
      <PageHeader
        title="Obras"
        description="Gestión de obras y proyectos"
        icon={Building2}
        actions={
          <Button onClick={() => handleOpenModal()}>
            <Plus className="w-4 h-4 mr-2" />
            Nueva Obra
          </Button>
        }
      />

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar obras..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filteredObras}
        keyExtractor={(item) => item.id}
        emptyState={
          <EmptyState
            icon={Building2}
            title="Sin obras"
            description="No hay obras registradas"
            action={
              <Button onClick={() => handleOpenModal()}>
                <Plus className="w-4 h-4 mr-2" />
                Nueva Obra
              </Button>
            }
          />
        }
      />

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
            <AlertDialogTitle>¿Eliminar obra?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará la obra "{selectedObra?.nombre}" y todos sus datos asociados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Eliminar
            </AlertDialogAction>
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
                    <span
                      className={`font-semibold ${
                        extra.estado === 'aprobado' ? 'text-emerald-600' : 'text-muted-foreground'
                      }`}
                    >
                      {formatCurrency(extra.monto)}
                    </span>
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
    </div>
  );
}
