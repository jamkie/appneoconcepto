import { useEffect, useState } from 'react';
import { ClipboardList, Plus, Upload, FileText, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EtapaBadge } from '../components/StatusBadge';
import { useOrdenes } from '../hooks/useOrdenes';
import { usePedidos } from '../hooks/usePedidos';
import { useSubmodulePermissions } from '@/hooks/useSubmodulePermissions';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { OrdenArchivo, ETAPA_ORDER, ETAPA_LABELS, ProduccionEtapa } from '../types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

export default function OrdenesPage() {
  const { ordenes, loading, fetchOrdenes, createOrden, moverEtapa } = useOrdenes();
  const { pedidos, fetchPedidos } = usePedidos();
  const { canCreate, canUpdate } = useSubmodulePermissions('produccion', 'ordenes');
  const { user } = useAuth();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ pedido_id: '', descripcion: '', fecha_entrega_estimada: '' });
  const [selectedOrden, setSelectedOrden] = useState<string | null>(null);
  const [archivos, setArchivos] = useState<OrdenArchivo[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { fetchOrdenes(); fetchPedidos(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await createOrden(form);
    if (result) {
      setDialogOpen(false);
      setForm({ pedido_id: '', descripcion: '', fecha_entrega_estimada: '' });
    }
  };

  const fetchArchivos = async (ordenId: string) => {
    const { data } = await supabase.from('orden_archivos').select('*').eq('orden_id', ordenId).order('created_at', { ascending: false });
    setArchivos((data || []) as OrdenArchivo[]);
  };

  const handleOpenDetail = async (ordenId: string) => {
    setSelectedOrden(ordenId);
    await fetchArchivos(ordenId);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !selectedOrden || !user) return;
    setUploading(true);
    const file = e.target.files[0];
    const path = `${selectedOrden}/${Date.now()}-${file.name}`;

    const { error: uploadError } = await supabase.storage.from('produccion-archivos').upload(path, file);
    if (uploadError) {
      toast({ title: 'Error', description: uploadError.message, variant: 'destructive' });
      setUploading(false);
      return;
    }

    const tipo = file.name.toLowerCase().includes('plano') ? 'plano'
      : file.name.toLowerCase().includes('despiece') ? 'despiece'
      : file.name.toLowerCase().includes('oc') || file.name.toLowerCase().includes('orden') ? 'orden_compra'
      : 'otro';

    await supabase.from('orden_archivos').insert({
      orden_id: selectedOrden,
      nombre_archivo: file.name,
      tipo,
      storage_path: path,
      subido_por: user.id,
    });

    toast({ title: 'Archivo subido', description: file.name });
    await fetchArchivos(selectedOrden);
    setUploading(false);
    e.target.value = '';
  };

  const handleDownload = async (archivo: OrdenArchivo) => {
    const { data } = await supabase.storage.from('produccion-archivos').createSignedUrl(archivo.storage_path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  const selectedOrdenData = ordenes.find(o => o.id === selectedOrden);

  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ClipboardList className="w-6 h-6" />
            Órdenes de Producción
          </h1>
          <p className="text-sm text-muted-foreground">Gestión de órdenes y archivos</p>
        </div>
        {canCreate && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" />Nueva Orden</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nueva Orden de Producción</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Pedido *</Label>
                  <Select value={form.pedido_id} onValueChange={(v) => setForm(f => ({ ...f, pedido_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar pedido" /></SelectTrigger>
                    <SelectContent>
                      {pedidos.filter(p => p.estado !== 'entregado').map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.cliente} - {p.nombre_proyecto}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Descripción *</Label><Textarea required value={form.descripcion} onChange={(e) => setForm(f => ({ ...f, descripcion: e.target.value }))} /></div>
                <div><Label>Fecha Entrega Estimada</Label><Input type="date" value={form.fecha_entrega_estimada} onChange={(e) => setForm(f => ({ ...f, fecha_entrega_estimada: e.target.value }))} /></div>
                <Button type="submit" className="w-full" disabled={!form.pedido_id}>Crear Orden</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {ordenes.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No hay órdenes registradas</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Orden</TableHead>
                    <TableHead className="hidden sm:table-cell">Cliente</TableHead>
                    <TableHead>Etapa</TableHead>
                    <TableHead className="hidden md:table-cell">Entrega</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ordenes.map((o) => (
                    <TableRow key={o.id} className="cursor-pointer" onClick={() => handleOpenDetail(o.id)}>
                      <TableCell>
                        <span className="font-medium">{o.numero_orden}</span>
                        <span className="block text-xs text-muted-foreground">{o.descripcion.substring(0, 50)}</span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">{(o.pedidos as any)?.cliente}</TableCell>
                      <TableCell><EtapaBadge etapa={o.etapa_actual} /></TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {o.fecha_entrega_estimada ? format(new Date(o.fecha_entrega_estimada), 'dd MMM yyyy', { locale: es }) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detalle de orden */}
      <Sheet open={!!selectedOrden} onOpenChange={(open) => !open && setSelectedOrden(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selectedOrdenData?.numero_orden} - Detalle</SheetTitle>
          </SheetHeader>
          {selectedOrdenData && (
            <div className="mt-4 space-y-6">
              <div className="space-y-2">
                <p className="text-sm"><span className="font-medium">Descripción:</span> {selectedOrdenData.descripcion}</p>
                <p className="text-sm"><span className="font-medium">Cliente:</span> {(selectedOrdenData.pedidos as any)?.cliente}</p>
                <p className="text-sm"><span className="font-medium">Etapa:</span> <EtapaBadge etapa={selectedOrdenData.etapa_actual} /></p>
              </div>

              {/* Mover etapa */}
              {canUpdate && selectedOrdenData.etapa_actual !== 'almacen' && (
                <div>
                  <Label className="text-sm font-medium">Mover a siguiente etapa</Label>
                  <Button
                    className="w-full mt-2"
                    onClick={() => {
                      const currentIdx = ETAPA_ORDER.indexOf(selectedOrdenData.etapa_actual);
                      const next = ETAPA_ORDER[currentIdx + 1];
                      if (next) {
                        moverEtapa(selectedOrdenData.id, selectedOrdenData.etapa_actual, next);
                        setSelectedOrden(null);
                      }
                    }}
                  >
                    Mover a {ETAPA_LABELS[ETAPA_ORDER[ETAPA_ORDER.indexOf(selectedOrdenData.etapa_actual) + 1] || 'almacen']}
                  </Button>
                </div>
              )}

              {/* Archivos */}
              <div>
                <h4 className="font-medium text-sm mb-2">Archivos adjuntos</h4>
                {canCreate && (
                  <label className="flex items-center gap-2 cursor-pointer border border-dashed border-border rounded-lg p-3 hover:bg-muted/50 transition-colors mb-3">
                    <Upload className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">{uploading ? 'Subiendo...' : 'Subir archivo (PDF/Excel)'}</span>
                    <input type="file" accept=".pdf,.xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                  </label>
                )}
                {archivos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin archivos</p>
                ) : (
                  <div className="space-y-2">
                    {archivos.map(a => (
                      <button key={a.id} onClick={() => handleDownload(a)} className="w-full flex items-center gap-2 p-2 rounded-lg border border-border hover:bg-muted/50 transition-colors text-left">
                        <FileText className="w-4 h-4 text-primary shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{a.nombre_archivo}</p>
                          <p className="text-xs text-muted-foreground capitalize">{a.tipo.replace('_', ' ')}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
