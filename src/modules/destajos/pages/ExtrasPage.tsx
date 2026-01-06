import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Plus, Search } from 'lucide-react';
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
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
      setIsModalOpen(false);
      setFormData({
        obra_id: '',
        instalador_id: '',
        descripcion: '',
        monto: '',
      });
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(amount);
  };

  const filteredExtras = extras.filter((extra) =>
    extra.descripcion.toLowerCase().includes(searchTerm.toLowerCase()) ||
    extra.obras?.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    extra.instaladores?.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Extra
          </Button>
        }
      />

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar extras..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
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
              <Button onClick={() => setIsModalOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Nuevo Extra
              </Button>
            }
          />
        }
      />

      {/* Create Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo Extra</DialogTitle>
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
    </div>
  );
}
