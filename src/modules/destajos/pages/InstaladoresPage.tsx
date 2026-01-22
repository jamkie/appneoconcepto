import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Plus, Search, Pencil, CheckCircle, XCircle, Building2, DollarSign } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { PageHeader, DataTable, EmptyState } from '../components';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
import type { Instalador } from '../types';
import { useSubmodulePermissions } from '@/hooks/useSubmodulePermissions';
import { cn } from '@/lib/utils';

export default function InstaladoresPage() {
  const { user, loading } = useAuth();
  const { canCreate, canUpdate, canDelete } = useSubmodulePermissions('destajos', 'instaladores');
  const navigate = useNavigate();
  const { toast } = useToast();
  const [instaladores, setInstaladores] = useState<Instalador[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'activos' | 'inactivos'>('activos');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedInstalador, setSelectedInstalador] = useState<Instalador | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    nombre: '',
    numero_cuenta: '',
    nombre_banco: '',
    salario_semanal: 0,
  });

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchInstaladores();
    }
  }, [user]);

  const fetchInstaladores = async () => {
    try {
      setLoadingData(true);
      const { data, error } = await supabase
        .from('instaladores')
        .select('*')
        .order('nombre');

      if (error) throw error;
      setInstaladores((data as Instalador[]) || []);
    } catch (error) {
      console.error('Error fetching instaladores:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los instaladores',
        variant: 'destructive',
      });
    } finally {
      setLoadingData(false);
    }
  };

  const handleOpenModal = (instalador?: Instalador) => {
    if (instalador) {
      setSelectedInstalador(instalador);
      setFormData({
        nombre: instalador.nombre,
        numero_cuenta: instalador.numero_cuenta || '',
        nombre_banco: instalador.nombre_banco || '',
        salario_semanal: instalador.salario_semanal || 0,
      });
    } else {
      setSelectedInstalador(null);
      setFormData({
        nombre: '',
        numero_cuenta: '',
        nombre_banco: '',
        salario_semanal: 0,
      });
    }
    setIsModalOpen(true);
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
      const instaladorData = {
        nombre: formData.nombre.trim(),
        numero_cuenta: formData.numero_cuenta.trim() || null,
        nombre_banco: formData.nombre_banco.trim() || null,
        salario_semanal: formData.salario_semanal,
      };

      if (selectedInstalador) {
        const { error } = await supabase
          .from('instaladores')
          .update(instaladorData)
          .eq('id', selectedInstalador.id);
        if (error) throw error;
        toast({ title: 'Éxito', description: 'Instalador actualizado correctamente' });
      } else {
        const { error } = await supabase.from('instaladores').insert(instaladorData);
        if (error) throw error;
        toast({ title: 'Éxito', description: 'Instalador creado correctamente' });
      }

      setIsModalOpen(false);
      fetchInstaladores();
    } catch (error) {
      console.error('Error saving instalador:', error);
      toast({
        title: 'Error',
        description: 'No se pudo guardar el instalador',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActivo = async (instalador: Instalador) => {
    try {
      // If trying to deactivate, check for pending destajo
      if (instalador.activo) {
        // Check for pending solicitudes
        const { data: pendingSolicitudes, error: solError } = await supabase
          .from('solicitudes_pago')
          .select('id')
          .eq('instalador_id', instalador.id)
          .eq('estado', 'pendiente')
          .limit(1);
        
        if (solError) throw solError;
        
        if (pendingSolicitudes && pendingSolicitudes.length > 0) {
          toast({
            title: 'No se puede desactivar',
            description: 'El instalador tiene solicitudes de pago pendientes',
            variant: 'destructive',
          });
          return;
        }
        
        // Check for solicitudes in an open corte
        const { data: openCorteSolicitudes, error: openCorteError } = await supabase
          .from('solicitudes_pago')
          .select('id, cortes_semanales!inner(estado)')
          .eq('instalador_id', instalador.id)
          .eq('cortes_semanales.estado', 'abierto')
          .limit(1);
        
        if (openCorteError) throw openCorteError;
        
        if (openCorteSolicitudes && openCorteSolicitudes.length > 0) {
          toast({
            title: 'No se puede desactivar',
            description: 'El instalador tiene solicitudes en un corte abierto',
            variant: 'destructive',
          });
          return;
        }
        
        // Check for pending saldo a favor (debt to company)
        const { data: saldoData, error: saldoError } = await supabase
          .from('saldos_instaladores')
          .select('saldo_acumulado')
          .eq('instalador_id', instalador.id)
          .maybeSingle();
        
        if (saldoError) throw saldoError;
        
        if (saldoData && saldoData.saldo_acumulado > 0) {
          toast({
            title: 'No se puede desactivar',
            description: `El instalador tiene un saldo pendiente de ${new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(saldoData.saldo_acumulado)}`,
            variant: 'destructive',
          });
          return;
        }
      }
      
      const { error } = await supabase
        .from('instaladores')
        .update({ activo: !instalador.activo })
        .eq('id', instalador.id);

      if (error) throw error;

      toast({
        title: 'Éxito',
        description: `Instalador ${instalador.activo ? 'desactivado' : 'activado'} correctamente`,
      });
      fetchInstaladores();
    } catch (error) {
      console.error('Error toggling instalador:', error);
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el estado del instalador',
        variant: 'destructive',
      });
    }
  };

  const filteredInstaladores = instaladores.filter((instalador) => {
    const matchesSearch = instalador.nombre.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (statusFilter === 'todos') return matchesSearch;
    if (statusFilter === 'activos') return matchesSearch && instalador.activo;
    if (statusFilter === 'inactivos') return matchesSearch && !instalador.activo;
    
    return matchesSearch;
  });

  const columns = [
    {
      key: 'nombre',
      header: 'Nombre',
      cell: (item: Instalador) => <span className="font-medium">{item.nombre}</span>,
    },
    {
      key: 'banco',
      header: 'Banco',
      cell: (item: Instalador) => (
        <div className="flex items-center gap-1">
          {item.nombre_banco ? (
            <>
              <Building2 className="w-3 h-3 text-muted-foreground" />
              <span>{item.nombre_banco}</span>
            </>
          ) : (
            '-'
          )}
        </div>
      ),
      hideOnMobile: true,
    },
    {
      key: 'cuenta',
      header: 'Número de Cuenta',
      cell: (item: Instalador) => item.numero_cuenta || '-',
      hideOnMobile: true,
    },
    {
      key: 'salario',
      header: 'Salario Semanal',
      cell: (item: Instalador) => (
        <div className="flex items-center gap-1">
          <DollarSign className="w-3 h-3 text-muted-foreground" />
          <span className="font-medium">
            {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(item.salario_semanal || 0)}
          </span>
        </div>
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      cell: (item: Instalador) => (
        <div className={cn(
          "flex items-center gap-2",
          item.activo ? "text-green-600" : "text-muted-foreground"
        )}>
          {item.activo ? (
            <CheckCircle className="w-4 h-4" />
          ) : (
            <XCircle className="w-4 h-4" />
          )}
          <span>{item.activo ? 'Activo' : 'Inactivo'}</span>
        </div>
      ),
    },
    ...((canUpdate || canDelete)
      ? [
          {
            key: 'actions',
            header: 'Acciones',
            cell: (item: Instalador) => (
              <div className="flex items-center gap-2">
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
                {canUpdate && (
                  <Switch
                    checked={item.activo}
                    onCheckedChange={() => handleToggleActivo(item)}
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
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
        title="Instaladores"
        description="Gestión de instaladores y trabajadores"
        icon={Users}
        actions={
          canCreate && (
            <Button onClick={() => handleOpenModal()}>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Instalador
            </Button>
          )
        }
      />

      {/* Filters */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar instaladores..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={(value: 'todos' | 'activos' | 'inactivos') => setStatusFilter(value)}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="activos">Activos</SelectItem>
            <SelectItem value="inactivos">Inactivos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filteredInstaladores}
        keyExtractor={(item) => item.id}
        emptyState={
          <EmptyState
            icon={Users}
            title="Sin instaladores"
            description="No hay instaladores registrados"
            action={
              canCreate && (
                <Button onClick={() => handleOpenModal()}>
                  <Plus className="w-4 h-4 mr-2" />
                  Nuevo Instalador
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
              {selectedInstalador ? 'Editar Instalador' : 'Nuevo Instalador'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="nombre">Nombre *</Label>
              <Input
                id="nombre"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                placeholder="Nombre del instalador"
              />
            </div>
            <div>
              <Label htmlFor="nombre_banco">Nombre del Banco</Label>
              <Input
                id="nombre_banco"
                value={formData.nombre_banco}
                onChange={(e) => setFormData({ ...formData, nombre_banco: e.target.value })}
                placeholder="Ej: BBVA, Santander, Banamex"
              />
            </div>
            <div>
              <Label htmlFor="numero_cuenta">Número de Cuenta</Label>
              <Input
                id="numero_cuenta"
                value={formData.numero_cuenta}
                onChange={(e) => setFormData({ ...formData, numero_cuenta: e.target.value })}
                placeholder="Número de cuenta bancaria"
              />
            </div>
            <div>
              <Label htmlFor="salario_semanal">Salario Semanal</Label>
              <Input
                id="salario_semanal"
                type="number"
                min="0"
                step="0.01"
                value={formData.salario_semanal}
                onChange={(e) => setFormData({ ...formData, salario_semanal: parseFloat(e.target.value) || 0 })}
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
    </div>
  );
}
