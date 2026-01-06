import { useEffect, useState, useMemo } from 'react';
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
import type { Obra, Instalador, ObraItem } from '../types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface AvanceItemDisplay {
  obra_item_id: string;
  descripcion: string;
  cantidad_total: number;
  cantidad_avanzada: number;
  cantidad_pendiente: number;
  cantidad_a_avanzar: string;
}

interface AvanceRecord {
  id: string;
  obra_id: string;
  instalador_id: string;
  fecha: string;
  observaciones: string | null;
  registrado_por: string;
  created_at: string;
  obras: { nombre: string } | null;
  instaladores: { nombre: string } | null;
  avance_items: {
    id: string;
    obra_item_id: string;
    cantidad_completada: number;
    obra_items: { descripcion: string } | null;
  }[];
}

export default function AvancesPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [avances, setAvances] = useState<AvanceRecord[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);
  const [instaladores, setInstaladores] = useState<Instalador[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [selectedObraId, setSelectedObraId] = useState('');
  const [selectedInstaladorId, setSelectedInstaladorId] = useState('');
  const [fecha, setFecha] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [observaciones, setObservaciones] = useState('');
  const [obraItems, setObraItems] = useState<AvanceItemDisplay[]>([]);
  const [loadingObraItems, setLoadingObraItems] = useState(false);

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

  // Fetch obra items when obra is selected
  useEffect(() => {
    if (selectedObraId) {
      fetchObraItems(selectedObraId);
    } else {
      setObraItems([]);
    }
  }, [selectedObraId]);

  const fetchData = async () => {
    try {
      setLoadingData(true);
      
      const [avancesRes, obrasRes, instaladoresRes] = await Promise.all([
        supabase
          .from('avances')
          .select(`
            id,
            obra_id,
            instalador_id,
            fecha,
            observaciones,
            registrado_por,
            created_at,
            obras(nombre),
            instaladores(nombre),
            avance_items(
              id,
              obra_item_id,
              cantidad_completada,
              obra_items(descripcion)
            )
          `)
          .order('fecha', { ascending: false }),
        supabase.from('obras').select('*').eq('estado', 'activa'),
        supabase.from('instaladores').select('*').eq('activo', true),
      ]);

      if (avancesRes.error) throw avancesRes.error;
      if (obrasRes.error) throw obrasRes.error;
      if (instaladoresRes.error) throw instaladoresRes.error;

      setAvances((avancesRes.data as AvanceRecord[]) || []);
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

  const fetchObraItems = async (obraId: string) => {
    try {
      setLoadingObraItems(true);
      
      // Get all items for this obra
      const { data: items, error: itemsError } = await supabase
        .from('obra_items')
        .select('*')
        .eq('obra_id', obraId);
      
      if (itemsError) throw itemsError;
      
      // Get all avance_items for this obra to calculate progress
      const { data: avanceItems, error: avanceError } = await supabase
        .from('avance_items')
        .select(`
          obra_item_id,
          cantidad_completada,
          avances!inner(obra_id)
        `)
        .eq('avances.obra_id', obraId);
      
      if (avanceError) throw avanceError;
      
      // Calculate totals per obra_item
      const avanceTotals: Record<string, number> = {};
      (avanceItems || []).forEach((ai: any) => {
        avanceTotals[ai.obra_item_id] = (avanceTotals[ai.obra_item_id] || 0) + ai.cantidad_completada;
      });
      
      // Build display items with pending quantities
      const displayItems: AvanceItemDisplay[] = (items || [])
        .map((item: ObraItem) => {
          const avanzado = avanceTotals[item.id] || 0;
          const pendiente = item.cantidad - avanzado;
          return {
            obra_item_id: item.id,
            descripcion: item.descripcion,
            cantidad_total: item.cantidad,
            cantidad_avanzada: avanzado,
            cantidad_pendiente: pendiente,
            cantidad_a_avanzar: '0',
          };
        })
        .filter((item) => item.cantidad_pendiente > 0); // Only show items with pending work
      
      setObraItems(displayItems);
    } catch (error) {
      console.error('Error fetching obra items:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los items de la obra',
        variant: 'destructive',
      });
    } finally {
      setLoadingObraItems(false);
    }
  };

  const handleItemQuantityChange = (obraItemId: string, value: string) => {
    setObraItems((prev) =>
      prev.map((item) =>
        item.obra_item_id === obraItemId
          ? { ...item, cantidad_a_avanzar: value }
          : item
      )
    );
  };

  const handleSave = async () => {
    if (!selectedObraId || !selectedInstaladorId) {
      toast({
        title: 'Error',
        description: 'Obra e instalador son requeridos',
        variant: 'destructive',
      });
      return;
    }

    // Validate at least one item has progress
    const itemsWithProgress = obraItems.filter(
      (item) => parseInt(item.cantidad_a_avanzar) > 0
    );
    
    if (itemsWithProgress.length === 0) {
      toast({
        title: 'Error',
        description: 'Debes registrar avance en al menos un item',
        variant: 'destructive',
      });
      return;
    }

    // Validate quantities don't exceed pending
    for (const item of itemsWithProgress) {
      const cantidad = parseInt(item.cantidad_a_avanzar);
      if (cantidad > item.cantidad_pendiente) {
        toast({
          title: 'Error',
          description: `La cantidad para "${item.descripcion}" excede lo pendiente (${item.cantidad_pendiente})`,
          variant: 'destructive',
        });
        return;
      }
    }

    try {
      setSaving(true);
      
      // Create the avance record
      const { data: avanceData, error: avanceError } = await supabase
        .from('avances')
        .insert({
          obra_id: selectedObraId,
          instalador_id: selectedInstaladorId,
          fecha,
          observaciones: observaciones.trim() || null,
          registrado_por: user?.id,
        })
        .select()
        .single();
      
      if (avanceError) throw avanceError;
      
      // Create avance_items for each item with progress
      const avanceItemsToInsert = itemsWithProgress.map((item) => ({
        avance_id: avanceData.id,
        obra_item_id: item.obra_item_id,
        cantidad_completada: parseInt(item.cantidad_a_avanzar),
      }));
      
      const { error: itemsError } = await supabase
        .from('avance_items')
        .insert(avanceItemsToInsert);
      
      if (itemsError) throw itemsError;

      toast({ title: 'Éxito', description: 'Avance registrado correctamente' });
      resetForm();
      setIsModalOpen(false);
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

  const resetForm = () => {
    setSelectedObraId('');
    setSelectedInstaladorId('');
    setFecha(format(new Date(), 'yyyy-MM-dd'));
    setObservaciones('');
    setObraItems([]);
  };

  const filteredAvances = avances.filter((avance) =>
    avance.obras?.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    avance.instaladores?.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Format avance items for display in table
  const formatAvanceItems = (items: AvanceRecord['avance_items']) => {
    if (!items || items.length === 0) return 'Sin items';
    return items
      .map((item) => `${item.obra_items?.descripcion || 'Item'}: ${item.cantidad_completada}`)
      .join(', ');
  };

  const columns = [
    {
      key: 'fecha',
      header: 'Fecha',
      cell: (item: AvanceRecord) => format(new Date(item.fecha), 'dd/MM/yyyy', { locale: es }),
    },
    {
      key: 'obra',
      header: 'Obra',
      cell: (item: AvanceRecord) => <span className="font-medium">{item.obras?.nombre || 'N/A'}</span>,
    },
    {
      key: 'instalador',
      header: 'Instalador',
      cell: (item: AvanceRecord) => item.instaladores?.nombre || 'N/A',
      hideOnMobile: true,
    },
    {
      key: 'items',
      header: 'Items Avanzados',
      cell: (item: AvanceRecord) => (
        <span className="text-sm text-muted-foreground truncate max-w-[200px] block">
          {formatAvanceItems(item.avance_items)}
        </span>
      ),
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
      <Dialog open={isModalOpen} onOpenChange={(open) => {
        if (!open) resetForm();
        setIsModalOpen(open);
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuevo Avance</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="obra_id">Obra *</Label>
              <Select value={selectedObraId} onValueChange={setSelectedObraId}>
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
              <Select value={selectedInstaladorId} onValueChange={setSelectedInstaladorId}>
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
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>
            
            {/* Obra Items Section */}
            {selectedObraId && (
              <div className="space-y-3">
                <Label className="text-base font-medium">Items de la Obra</Label>
                {loadingObraItems ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                  </div>
                ) : obraItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No hay items pendientes en esta obra
                  </p>
                ) : (
                  <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
                    {obraItems.map((item) => (
                      <div key={item.obra_item_id} className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.descripcion}</p>
                          <p className="text-xs text-muted-foreground">
                            Pendiente: {item.cantidad_pendiente} de {item.cantidad_total}
                          </p>
                        </div>
                        <div className="w-20">
                          <Input
                            type="number"
                            min="0"
                            max={item.cantidad_pendiente}
                            value={item.cantidad_a_avanzar}
                            onChange={(e) => handleItemQuantityChange(item.obra_item_id, e.target.value)}
                            className="text-center"
                            placeholder="0"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            <div>
              <Label htmlFor="observaciones">Observaciones</Label>
              <Textarea
                id="observaciones"
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Notas adicionales..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving || loadingObraItems}>
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
