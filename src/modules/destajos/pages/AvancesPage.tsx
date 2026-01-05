import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Plus, Search } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { PageHeader, DataTable, EmptyState } from '../components';
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
import type { Obra, Instalador, Avance } from '../types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface AvanceWithDetails extends Avance {
  obras: { nombre: string } | null;
  instaladores: { nombre: string } | null;
}

export default function AvancesPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [avances, setAvances] = useState<AvanceWithDetails[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);
  const [instaladores, setInstaladores] = useState<Instalador[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    obra_id: '',
    instalador_id: '',
    fecha: format(new Date(), 'yyyy-MM-dd'),
    cocinas_completadas: '0',
    closets_completados: '0',
    cubiertas_completadas: '0',
    vanitys_completados: '0',
    observaciones: '',
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
      
      const [avancesRes, obrasRes, instaladoresRes] = await Promise.all([
        supabase
          .from('avances')
          .select(`
            *,
            obras(nombre),
            instaladores(nombre)
          `)
          .order('fecha', { ascending: false }),
        supabase.from('obras').select('*').eq('estado', 'activa'),
        supabase.from('instaladores').select('*').eq('activo', true),
      ]);

      if (avancesRes.error) throw avancesRes.error;
      if (obrasRes.error) throw obrasRes.error;
      if (instaladoresRes.error) throw instaladoresRes.error;

      setAvances((avancesRes.data as AvanceWithDetails[]) || []);
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

  const handleSave = async () => {
    if (!formData.obra_id || !formData.instalador_id) {
      toast({
        title: 'Error',
        description: 'Obra e instalador son requeridos',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(true);
      const avanceData = {
        obra_id: formData.obra_id,
        instalador_id: formData.instalador_id,
        fecha: formData.fecha,
        cocinas_completadas: parseInt(formData.cocinas_completadas) || 0,
        closets_completados: parseInt(formData.closets_completados) || 0,
        cubiertas_completadas: parseInt(formData.cubiertas_completadas) || 0,
        vanitys_completados: parseInt(formData.vanitys_completados) || 0,
        observaciones: formData.observaciones.trim() || null,
        registrado_por: user?.id,
      };

      const { error } = await supabase.from('avances').insert(avanceData);
      if (error) throw error;

      toast({ title: 'Éxito', description: 'Avance registrado correctamente' });
      setIsModalOpen(false);
      setFormData({
        obra_id: '',
        instalador_id: '',
        fecha: format(new Date(), 'yyyy-MM-dd'),
        cocinas_completadas: '0',
        closets_completados: '0',
        cubiertas_completadas: '0',
        vanitys_completados: '0',
        observaciones: '',
      });
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

  const filteredAvances = avances.filter((avance) =>
    avance.obras?.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    avance.instaladores?.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const columns = [
    {
      key: 'fecha',
      header: 'Fecha',
      cell: (item: AvanceWithDetails) => format(new Date(item.fecha), 'dd/MM/yyyy', { locale: es }),
    },
    {
      key: 'obra',
      header: 'Obra',
      cell: (item: AvanceWithDetails) => <span className="font-medium">{item.obras?.nombre || 'N/A'}</span>,
    },
    {
      key: 'instalador',
      header: 'Instalador',
      cell: (item: AvanceWithDetails) => item.instaladores?.nombre || 'N/A',
      hideOnMobile: true,
    },
    {
      key: 'cocinas',
      header: 'Cocinas',
      cell: (item: AvanceWithDetails) => item.cocinas_completadas,
    },
    {
      key: 'closets',
      header: 'Closets',
      cell: (item: AvanceWithDetails) => item.closets_completados,
      hideOnMobile: true,
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
        title="Avances"
        description="Registro de avances de trabajo"
        icon={ClipboardList}
        actions={
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Avance
          </Button>
        }
      />

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar avances..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filteredAvances}
        keyExtractor={(item) => item.id}
        emptyState={
          <EmptyState
            icon={ClipboardList}
            title="Sin avances"
            description="No hay avances registrados"
            action={
              <Button onClick={() => setIsModalOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Nuevo Avance
              </Button>
            }
          />
        }
      />

      {/* Create Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo Avance</DialogTitle>
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
              <Label htmlFor="fecha">Fecha</Label>
              <Input
                id="fecha"
                type="date"
                value={formData.fecha}
                onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="cocinas">Cocinas</Label>
                <Input
                  id="cocinas"
                  type="number"
                  min="0"
                  value={formData.cocinas_completadas}
                  onChange={(e) => setFormData({ ...formData, cocinas_completadas: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="closets">Closets</Label>
                <Input
                  id="closets"
                  type="number"
                  min="0"
                  value={formData.closets_completados}
                  onChange={(e) => setFormData({ ...formData, closets_completados: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="cubiertas">Cubiertas</Label>
                <Input
                  id="cubiertas"
                  type="number"
                  min="0"
                  value={formData.cubiertas_completadas}
                  onChange={(e) => setFormData({ ...formData, cubiertas_completadas: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="vanitys">Vanitys</Label>
                <Input
                  id="vanitys"
                  type="number"
                  min="0"
                  value={formData.vanitys_completados}
                  onChange={(e) => setFormData({ ...formData, vanitys_completados: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="observaciones">Observaciones</Label>
              <Textarea
                id="observaciones"
                value={formData.observaciones}
                onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                placeholder="Notas adicionales..."
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
