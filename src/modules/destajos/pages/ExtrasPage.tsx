import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Plus, Search, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { PageHeader, DataTable, EmptyState, StatusBadge } from '../components';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import type { Obra, Instalador, Extra } from '../types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ExtraWithDetails extends Extra {
  obras: { nombre: string } | null;
  instaladores: { nombre: string } | null;
}

export default function ExtrasPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [extras, setExtras] = useState<ExtraWithDetails[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);
  const [instaladores, setInstaladores] = useState<Instalador[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'pendiente' | 'aprobado'>('todos');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingExtra, setEditingExtra] = useState<ExtraWithDetails | null>(null);
  const [deleteExtra, setDeleteExtra] = useState<ExtraWithDetails | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [formData, setFormData] = useState({
    obra_id: '',
    instalador_id: '',
    descripcion: '',
    monto: '',
  });

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
      
      const [extrasRes, obrasRes, instaladoresRes] = await Promise.all([
        supabase
          .from('extras')
          .select(`
            *,
            obras(nombre),
            instaladores(nombre)
          `)
          .order('created_at', { ascending: false }),
        supabase.from('obras').select('*').eq('estado', 'activa'),
        supabase.from('instaladores').select('*').eq('activo', true),
      ]);

      if (extrasRes.error) throw extrasRes.error;
      if (obrasRes.error) throw obrasRes.error;
      if (instaladoresRes.error) throw instaladoresRes.error;

      setExtras((extrasRes.data as ExtraWithDetails[]) || []);
      setObras((obrasRes.data as Obra[]) || []);
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

  const resetForm = () => {
    setFormData({
      obra_id: '',
      instalador_id: '',
      descripcion: '',
      monto: '',
    });
    setEditingExtra(null);
  };

  const openCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (extra: ExtraWithDetails) => {
    setEditingExtra(extra);
    setFormData({
      obra_id: extra.obra_id,
      instalador_id: extra.instalador_id,
      descripcion: extra.descripcion,
      monto: String(extra.monto),
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.obra_id || !formData.instalador_id || !formData.descripcion || !formData.monto) {
      toast({
        title: 'Error',
        description: 'Todos los campos son requeridos',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(true);
      const monto = parseFloat(formData.monto);

      if (editingExtra) {
        // Actualizar extra existente
        const { error: extraError } = await supabase
          .from('extras')
          .update({
            obra_id: formData.obra_id,
            instalador_id: formData.instalador_id,
            descripcion: formData.descripcion.trim(),
            monto: monto,
          })
          .eq('id', editingExtra.id);
        if (extraError) throw extraError;

        // Actualizar solicitud de pago asociada si existe y está pendiente
        const { error: solicitudError } = await supabase
          .from('solicitudes_pago')
          .update({
            obra_id: formData.obra_id,
            instalador_id: formData.instalador_id,
            total_solicitado: monto,
            subtotal_extras: monto,
          })
          .contains('extras_ids', [editingExtra.id])
          .eq('estado', 'pendiente');
        
        if (solicitudError) console.warn('No se pudo actualizar la solicitud:', solicitudError);

        toast({ title: 'Éxito', description: 'Extra actualizado correctamente' });
      } else {
        // Crear nuevo extra
        const extraData = {
          obra_id: formData.obra_id,
          instalador_id: formData.instalador_id,
          descripcion: formData.descripcion.trim(),
          monto: monto,
          solicitado_por: user?.id,
        };

        const { data: extraCreated, error: extraError } = await supabase
          .from('extras')
          .insert(extraData)
          .select()
          .single();
        if (extraError) throw extraError;

        // Crear solicitud de pago para el extra
        const { error: solicitudError } = await supabase
          .from('solicitudes_pago')
          .insert({
            obra_id: formData.obra_id,
            instalador_id: formData.instalador_id,
            tipo: 'extra',
            total_solicitado: monto,
            subtotal_extras: monto,
            extras_ids: [extraCreated.id],
            solicitado_por: user?.id,
          });
        if (solicitudError) throw solicitudError;

        toast({ title: 'Éxito', description: 'Extra y solicitud de pago registrados correctamente' });
      }

      setIsModalOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error saving extra:', error);
      toast({
        title: 'Error',
        description: 'No se pudo guardar el extra',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteExtra) return;

    try {
      setDeleting(true);

      // Eliminar solicitud de pago asociada si está pendiente
      await supabase
        .from('solicitudes_pago')
        .delete()
        .contains('extras_ids', [deleteExtra.id])
        .eq('estado', 'pendiente');

      // Eliminar el extra
      const { error } = await supabase
        .from('extras')
        .delete()
        .eq('id', deleteExtra.id);
      if (error) throw error;

      toast({ title: 'Éxito', description: 'Extra eliminado correctamente' });
      setDeleteExtra(null);
      fetchData();
    } catch (error) {
      console.error('Error deleting extra:', error);
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el extra',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  const canEditOrDelete = (extra: ExtraWithDetails) => {
    return extra.estado === 'pendiente';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(amount);
  };

  const filteredExtras = extras.filter((extra) => {
    const matchesSearch = extra.descripcion.toLowerCase().includes(searchTerm.toLowerCase()) ||
      extra.obras?.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      extra.instaladores?.nombre.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'todos' || extra.estado === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const columns = [
    {
      key: 'fecha',
      header: 'Fecha',
      cell: (item: ExtraWithDetails) => format(new Date(item.created_at), 'dd/MM/yyyy', { locale: es }),
    },
    {
      key: 'descripcion',
      header: 'Descripción',
      cell: (item: ExtraWithDetails) => <span className="font-medium">{item.descripcion}</span>,
    },
    {
      key: 'obra',
      header: 'Obra',
      cell: (item: ExtraWithDetails) => item.obras?.nombre || 'N/A',
      hideOnMobile: true,
    },
    {
      key: 'instalador',
      header: 'Instalador',
      cell: (item: ExtraWithDetails) => item.instaladores?.nombre || 'N/A',
      hideOnMobile: true,
    },
    {
      key: 'monto',
      header: 'Monto',
      cell: (item: ExtraWithDetails) => formatCurrency(Number(item.monto)),
    },
    {
      key: 'estado',
      header: 'Estado',
      cell: (item: ExtraWithDetails) => <StatusBadge status={item.estado} />,
    },
    {
      key: 'acciones',
      header: '',
      cell: (item: ExtraWithDetails) => canEditOrDelete(item) ? (
        <div className="flex gap-1 justify-end">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              openEditModal(item);
            }}
          >
            <Pencil className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              setDeleteExtra(item);
            }}
          >
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      ) : null,
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
        title="Extras"
        description="Registro de trabajos extras"
        icon={FileText}
        actions={
          <Button onClick={openCreateModal}>
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Extra
          </Button>
        }
      />

      {/* Filters */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar extras..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={(value: 'todos' | 'pendiente' | 'aprobado') => setStatusFilter(value)}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="pendiente">Pendientes</SelectItem>
            <SelectItem value="aprobado">Aprobados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filteredExtras}
        keyExtractor={(item) => item.id}
        emptyState={
          <EmptyState
            icon={FileText}
            title="Sin extras"
            description="No hay extras registrados"
            action={
              <Button onClick={openCreateModal}>
                <Plus className="w-4 h-4 mr-2" />
                Nuevo Extra
              </Button>
            }
          />
        }
      />

      {/* Create/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={(open) => {
        setIsModalOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingExtra ? 'Editar Extra' : 'Nuevo Extra'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="obra_id">Obra *</Label>
              <Select value={formData.obra_id} onValueChange={(value) => setFormData({ ...formData, obra_id: value })}>
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
              <Label htmlFor="instalador_id">Instalador *</Label>
              <Select value={formData.instalador_id} onValueChange={(value) => setFormData({ ...formData, instalador_id: value })}>
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
              <Label htmlFor="descripcion">Descripción *</Label>
              <Textarea
                id="descripcion"
                value={formData.descripcion}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                placeholder="Describe el trabajo extra..."
              />
            </div>
            <div>
              <Label htmlFor="monto">Monto *</Label>
              <Input
                id="monto"
                type="number"
                min="0"
                step="0.01"
                value={formData.monto}
                onChange={(e) => setFormData({ ...formData, monto: e.target.value })}
                placeholder="0.00"
              />
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
      <AlertDialog open={!!deleteExtra} onOpenChange={(open) => !open && setDeleteExtra(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar extra?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará el extra "{deleteExtra?.descripcion}" y su solicitud de pago asociada.
              Esta acción no se puede deshacer.
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
