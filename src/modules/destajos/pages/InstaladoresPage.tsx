import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Plus, Search, Pencil, CheckCircle, XCircle } from 'lucide-react';
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
import type { Instalador } from '../types';
import { useUserRole } from '@/hooks/useUserRole';
import { cn } from '@/lib/utils';

export default function InstaladoresPage() {
  const { user, loading } = useAuth();
  const { isAdmin } = useUserRole();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [instaladores, setInstaladores] = useState<Instalador[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedInstalador, setSelectedInstalador] = useState<Instalador | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    nombre: '',
    numero_cuenta: '',
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
      });
    } else {
      setSelectedInstalador(null);
      setFormData({
        nombre: '',
        numero_cuenta: '',
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

  const filteredInstaladores = instaladores.filter((instalador) =>
    instalador.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const columns = [
    {
      key: 'nombre',
      header: 'Nombre',
      cell: (item: Instalador) => <span className="font-medium">{item.nombre}</span>,
    },
    {
      key: 'cuenta',
      header: 'Número de Cuenta',
      cell: (item: Instalador) => item.numero_cuenta || '-',
      hideOnMobile: true,
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
    ...(isAdmin
      ? [
          {
            key: 'actions',
            header: 'Acciones',
            cell: (item: Instalador) => (
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
                <Switch
                  checked={item.activo}
                  onCheckedChange={() => handleToggleActivo(item)}
                  onClick={(e) => e.stopPropagation()}
                />
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
          isAdmin && (
            <Button onClick={() => handleOpenModal()}>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Instalador
            </Button>
          )
        }
      />

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar instaladores..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
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
              isAdmin && (
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
              <Label htmlFor="numero_cuenta">Número de Cuenta</Label>
              <Input
                id="numero_cuenta"
                value={formData.numero_cuenta}
                onChange={(e) => setFormData({ ...formData, numero_cuenta: e.target.value })}
                placeholder="Número de cuenta bancaria"
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
