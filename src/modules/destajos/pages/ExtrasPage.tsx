import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FileText, Plus, Search, Pencil, Trash2, RotateCcw, Calendar } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { PageHeader, EmptyState } from '../components';
import { Badge } from '@/components/ui/badge';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface ExtraWithDetails extends Extra {
  obras: { nombre: string } | null;
  instaladores: { nombre: string } | null;
  solicitudRechazada?: boolean;
  solicitudPagada?: boolean;
}

export default function ExtrasPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const [extras, setExtras] = useState<ExtraWithDetails[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);
  const [instaladores, setInstaladores] = useState<Instalador[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'pendiente' | 'aprobado' | 'rechazado' | 'pagado'>('todos');
  const [creatingSolicitud, setCreatingSolicitud] = useState(false);
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

  // Handle edit param from URL
  useEffect(() => {
    const editId = searchParams.get('edit');
    if (editId && extras.length > 0 && !loadingData) {
      const extraToEdit = extras.find(e => e.id === editId);
      if (extraToEdit) {
        openEditModal(extraToEdit);
        // Clear the search param
        setSearchParams({});
      }
    }
  }, [searchParams, extras, loadingData]);

  const fetchData = async () => {
    try {
      setLoadingData(true);
      
      const [extrasRes, obrasRes, instaladoresRes, solicitudesRes] = await Promise.all([
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
        supabase
          .from('solicitudes_pago')
          .select('extras_ids, estado, pagos_destajos(id)')
          .eq('tipo', 'extra'),
      ]);

      if (extrasRes.error) throw extrasRes.error;
      if (obrasRes.error) throw obrasRes.error;
      if (instaladoresRes.error) throw instaladoresRes.error;

      // Map extras with their solicitud status
      const extrasWithStatus = (extrasRes.data || []).map(extra => {
        const solicitud = (solicitudesRes.data || []).find(
          s => s.extras_ids && s.extras_ids.includes(extra.id)
        );
        const hasPago = solicitud?.pagos_destajos && solicitud.pagos_destajos.length > 0;
        return {
          ...extra,
          solicitudRechazada: solicitud?.estado === 'rechazada',
          solicitudPagada: hasPago,
        } as ExtraWithDetails;
      });

      setExtras(extrasWithStatus);
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

        // Get obra discount
        const obraData = obras.find(o => o.id === formData.obra_id);
        const descuento = Number((obraData as any)?.descuento || 0);
        const montoDescuento = monto * (descuento / 100);
        const totalConDescuento = monto - montoDescuento;

        // Crear solicitud de pago para el extra
        const { error: solicitudError } = await supabase
          .from('solicitudes_pago')
          .insert({
            obra_id: formData.obra_id,
            instalador_id: formData.instalador_id,
            tipo: 'extra',
            total_solicitado: totalConDescuento,
            subtotal_extras: monto,
            retencion: montoDescuento,
            extras_ids: [extraCreated.id],
            solicitado_por: user?.id,
            observaciones: descuento > 0 ? `Extra con descuento ${descuento}%` : null,
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
    // Permitir editar/eliminar si está pendiente o si fue rechazado
    return extra.estado === 'pendiente' || extra.solicitudRechazada;
  };

  const handleNuevaSolicitud = async (extra: ExtraWithDetails) => {
    if (!user) return;
    
    try {
      setCreatingSolicitud(true);
      
      // Delete the rejected solicitud first
      await supabase
        .from('solicitudes_pago')
        .delete()
        .contains('extras_ids', [extra.id])
        .eq('estado', 'rechazada');
      
      // Get obra discount
      const { data: obraData } = await supabase
        .from('obras')
        .select('descuento')
        .eq('id', extra.obra_id)
        .single();
      
      const descuento = Number(obraData?.descuento || 0);
      const montoDescuento = extra.monto * (descuento / 100);
      const totalConDescuento = extra.monto - montoDescuento;
      
      // Create new payment request
      const { error } = await supabase
        .from('solicitudes_pago')
        .insert({
          obra_id: extra.obra_id,
          instalador_id: extra.instalador_id,
          tipo: 'extra',
          total_solicitado: totalConDescuento,
          subtotal_extras: extra.monto,
          retencion: montoDescuento,
          extras_ids: [extra.id],
          solicitado_por: user.id,
          observaciones: descuento > 0 ? `Nueva solicitud - Extra con descuento ${descuento}%` : null,
        });
      
      if (error) throw error;
      
      toast({ title: 'Éxito', description: 'Nueva solicitud de pago creada' });
      fetchData();
    } catch (error) {
      console.error('Error creating new solicitud:', error);
      toast({
        title: 'Error',
        description: 'No se pudo crear la solicitud',
        variant: 'destructive',
      });
    } finally {
      setCreatingSolicitud(false);
    }
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
    
    if (statusFilter === 'rechazado') {
      return matchesSearch && extra.solicitudRechazada;
    }
    if (statusFilter === 'pagado') {
      return matchesSearch && extra.solicitudPagada;
    }
    if (statusFilter === 'aprobado') {
      return matchesSearch && extra.estado === 'aprobado' && !extra.solicitudPagada;
    }
    const matchesStatus = statusFilter === 'todos' || extra.estado === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const renderEstadoBadge = (extra: ExtraWithDetails) => {
    if (extra.solicitudPagada) {
      return (
        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
          ✓ Pagado
        </Badge>
      );
    } else if (extra.solicitudRechazada) {
      return (
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
          Rechazado
        </Badge>
      );
    } else if (extra.estado === 'aprobado') {
      return (
        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
          Aprobado
        </Badge>
      );
    } else {
      return (
        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
          Pendiente
        </Badge>
      );
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
        <Select value={statusFilter} onValueChange={(value: 'todos' | 'pendiente' | 'aprobado' | 'rechazado' | 'pagado') => setStatusFilter(value)}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="pendiente">Pendientes</SelectItem>
            <SelectItem value="aprobado">Aprobados</SelectItem>
            <SelectItem value="pagado">Pagados</SelectItem>
            <SelectItem value="rechazado">Rechazados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {filteredExtras.length === 0 ? (
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
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead className="hidden md:table-cell">Obra</TableHead>
                <TableHead className="hidden md:table-cell">Instalador</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead className="hidden lg:table-cell">Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredExtras.map((extra) => (
                <TableRow key={extra.id}>
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      {format(new Date(extra.created_at), 'dd MMM yyyy', { locale: es })}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {extra.obras?.nombre || 'N/A'}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {extra.instaladores?.nombre || 'N/A'}
                  </TableCell>
                  <TableCell className="font-medium">
                    {extra.descripcion}
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatCurrency(Number(extra.monto))}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div className="flex items-center gap-2">
                      {renderEstadoBadge(extra)}
                      {extra.solicitudRechazada && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleNuevaSolicitud(extra)}
                          disabled={creatingSolicitud}
                          className="h-6 text-xs"
                        >
                          <RotateCcw className={`w-3 h-3 mr-1 ${creatingSolicitud ? 'animate-spin' : ''}`} />
                          Nueva solicitud
                        </Button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {canEditOrDelete(extra) && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditModal(extra)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteExtra(extra)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

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
