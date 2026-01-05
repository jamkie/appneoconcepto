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
import type { Obra, ObraStatus } from '../types';
import { useUserRole } from '@/hooks/useUserRole';

interface MobiliarioItem {
  id?: string;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
}

const TIPOS_MOBILIARIO = [
  'Cocina',
  'Closet',
  'Cubierta',
  'Vanity',
  'Otro',
];

export default function ObrasPage() {
  const { user, loading } = useAuth();
  const { isAdmin } = useUserRole();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [obras, setObras] = useState<Obra[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedObra, setSelectedObra] = useState<Obra | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    nombre: '',
    cliente: '',
    ubicacion: '',
    estado: 'activa' as ObraStatus,
  });
  const [mobiliarioItems, setMobiliarioItems] = useState<MobiliarioItem[]>([]);
  const [newItem, setNewItem] = useState<MobiliarioItem>({
    descripcion: '',
    cantidad: 1,
    precio_unitario: 0,
  });

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
      const { data, error } = await supabase
        .from('obras')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setObras((data as Obra[]) || []);
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

  const handleOpenModal = async (obra?: Obra) => {
    if (obra) {
      setSelectedObra(obra);
      setFormData({
        nombre: obra.nombre,
        cliente: obra.cliente || '',
        ubicacion: obra.ubicacion || '',
        estado: obra.estado,
      });
      // Fetch existing obra_items
      const { data: items } = await supabase
        .from('obra_items')
        .select('*')
        .eq('obra_id', obra.id);
      setMobiliarioItems(
        items?.map((item) => ({
          id: item.id,
          descripcion: item.descripcion,
          cantidad: item.cantidad,
          precio_unitario: Number(item.precio_unitario),
        })) || []
      );
    } else {
      setSelectedObra(null);
      setFormData({
        nombre: '',
        cliente: '',
        ubicacion: '',
        estado: 'activa',
      });
      setMobiliarioItems([]);
    }
    setNewItem({ descripcion: '', cantidad: 1, precio_unitario: 0 });
    setIsModalOpen(true);
  };

  const handleAddItem = () => {
    if (!newItem.descripcion.trim()) {
      toast({
        title: 'Error',
        description: 'Selecciona un tipo de mobiliario',
        variant: 'destructive',
      });
      return;
    }
    setMobiliarioItems([...mobiliarioItems, { ...newItem }]);
    setNewItem({ descripcion: '', cantidad: 1, precio_unitario: 0 });
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
        ubicacion: formData.ubicacion.trim() || null,
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
      cell: (item: Obra) => <span className="font-medium">{item.nombre}</span>,
    },
    {
      key: 'cliente',
      header: 'Cliente',
      cell: (item: Obra) => item.cliente || '-',
      hideOnMobile: true,
    },
    {
      key: 'estado',
      header: 'Estado',
      cell: (item: Obra) => <StatusBadge status={item.estado} />,
    },
    {
      key: 'precios',
      header: 'Precio Cocina',
      cell: (item: Obra) => formatCurrency(Number(item.precio_cocina)),
      hideOnMobile: true,
    },
    ...(isAdmin
      ? [
          {
            key: 'actions',
            header: 'Acciones',
            cell: (item: Obra) => (
              <div className="flex items-center gap-2">
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
              <Label htmlFor="nombre">Nombre *</Label>
              <Input
                id="nombre"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                placeholder="Nombre de la obra"
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
              <Label htmlFor="ubicacion">Ubicación</Label>
              <Input
                id="ubicacion"
                value={formData.ubicacion}
                onChange={(e) => setFormData({ ...formData, ubicacion: e.target.value })}
                placeholder="Ubicación"
              />
            </div>
            <div>
              <Label htmlFor="estado">Estado</Label>
              <Select
                value={formData.estado}
                onValueChange={(value: ObraStatus) => setFormData({ ...formData, estado: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="activa">Activa</SelectItem>
                  <SelectItem value="cerrada">Cerrada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Mobiliario Section */}
            <div className="space-y-3">
              <Label>Mobiliario</Label>
              
              {/* Existing items */}
              {mobiliarioItems.length > 0 && (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {mobiliarioItems.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/50 text-sm"
                    >
                      <div className="flex-1">
                        <span className="font-medium">{item.descripcion}</span>
                        <span className="text-muted-foreground ml-2">
                          x{item.cantidad} @ {formatCurrency(item.precio_unitario)}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleRemoveItem(index)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add new item */}
              <div className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-5">
                  <Label className="text-xs">Tipo</Label>
                  <Select
                    value={newItem.descripcion}
                    onValueChange={(value) => setNewItem({ ...newItem, descripcion: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPOS_MOBILIARIO.map((tipo) => (
                        <SelectItem key={tipo} value={tipo}>
                          {tipo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Cant.</Label>
                  <Input
                    type="number"
                    min="1"
                    value={newItem.cantidad}
                    onChange={(e) =>
                      setNewItem({ ...newItem, cantidad: parseInt(e.target.value) || 1 })
                    }
                  />
                </div>
                <div className="col-span-3">
                  <Label className="text-xs">Precio</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newItem.precio_unitario || ''}
                    onChange={(e) =>
                      setNewItem({ ...newItem, precio_unitario: parseFloat(e.target.value) || 0 })
                    }
                    placeholder="0.00"
                  />
                </div>
                <div className="col-span-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={handleAddItem}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
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
