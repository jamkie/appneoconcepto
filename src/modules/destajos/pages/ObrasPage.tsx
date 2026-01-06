import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Plus, Search, Pencil, Trash2, X } from 'lucide-react';
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
import { useUserRole } from '@/hooks/useUserRole';

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

interface ObraWithItems extends Obra {
  items: ObraItem[];
  avances: { [itemId: string]: number };
  totalPagado: number;
  totalExtras: number;
  extras: ExtraInfo[];
}

export default function ObrasPage() {
  const { user, loading } = useAuth();
  const { isAdmin } = useUserRole();
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
    estado: 'activa' as ObraStatus,
  });
  const [mobiliarioItems, setMobiliarioItems] = useState<MobiliarioItem[]>([]);

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

      // Fetch all pagos_destajos
      const { data: pagosData } = await supabase
        .from('pagos_destajos')
        .select('obra_id, monto');

      // Fetch all extras
      const { data: extrasData } = await supabase
        .from('extras')
        .select('id, obra_id, descripcion, monto, estado');

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

        // Calculate total pagado
        const totalPagado = (pagosData || [])
          .filter((p) => p.obra_id === obra.id)
          .reduce((sum, p) => sum + Number(p.monto), 0);

        // Get extras for this obra
        const obraExtras = (extrasData || [])
          .filter((e) => e.obra_id === obra.id)
          .map((e) => ({
            id: e.id,
            descripcion: e.descripcion,
            monto: Number(e.monto),
            estado: e.estado || 'pendiente',
          }));

        // Calculate total extras (solo aprobados)
        const totalExtras = obraExtras
          .filter((e) => e.estado === 'aprobado')
          .reduce((sum, e) => sum + e.monto, 0);

        return {
          ...obra,
          items,
          avances,
          totalPagado,
          totalExtras,
          extras: obraExtras,
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
        estado: obra.estado,
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
        estado: 'activa',
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
        ubicacion: null,
        estado: formData.estado,
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
          return <span className="text-muted-foreground text-xs">Sin extras</span>;
        }
        const aprobados = item.extras.filter((e) => e.estado === 'aprobado');
        const pendientes = item.extras.filter((e) => e.estado === 'pendiente');
        return (
          <div className="space-y-1 text-xs min-w-[150px]">
            {aprobados.map((extra) => (
              <div key={extra.id} className="flex justify-between gap-2">
                <span className="truncate max-w-[100px]" title={extra.descripcion}>{extra.descripcion}</span>
                <span className="font-medium text-emerald-600">{formatCurrency(extra.monto)}</span>
              </div>
            ))}
            {pendientes.map((extra) => (
              <div key={extra.id} className="flex justify-between gap-2 text-muted-foreground">
                <span className="truncate max-w-[100px]" title={extra.descripcion}>{extra.descripcion}</span>
                <span className="italic">{formatCurrency(extra.monto)}</span>
              </div>
            ))}
            {pendientes.length > 0 && (
              <p className="text-muted-foreground italic">({pendientes.length} pendiente{pendientes.length > 1 ? 's' : ''})</p>
            )}
          </div>
        );
      },
      hideOnMobile: true,
    },
    {
      key: 'montoTotal',
      header: 'Monto Total',
      cell: (item: ObraWithItems) => {
        const totalItems = item.items.reduce((sum, pieza) => sum + pieza.cantidad * pieza.precio_unitario, 0);
        const total = totalItems + item.totalExtras;
        return <span className="font-medium">{formatCurrency(total)}</span>;
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
        const total = totalItems + item.totalExtras;
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
    ...(isAdmin
      ? [
          {
            key: 'actions',
            header: 'Acciones',
            cell: (item: ObraWithItems) => (
              <div className="flex items-center gap-1">
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
              </div>
            ),
          },
        ]
      : []),
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
          isAdmin && (
            <Button onClick={() => handleOpenModal()}>
              <Plus className="w-4 h-4 mr-2" />
              Nueva Obra
            </Button>
          )
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
              isAdmin && (
                <Button onClick={() => handleOpenModal()}>
                  <Plus className="w-4 h-4 mr-2" />
                  Nueva Obra
                </Button>
              )
            }
          />
        }
      />

      {/* Create/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedObra ? 'Editar Obra' : 'Nueva Obra'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
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

            {/* Piezas Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Piezas</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
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

              {/* Items list */}
              {mobiliarioItems.length > 0 && (
                <div className="space-y-3 max-h-60 overflow-y-auto">
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
    </div>
  );
}
