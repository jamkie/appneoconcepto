import { useEffect, useState } from 'react';
import { ShoppingCart, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EstadoBadge } from '../components/StatusBadge';
import { usePedidos } from '../hooks/usePedidos';
import { useSubmodulePermissions } from '@/hooks/useSubmodulePermissions';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2 } from 'lucide-react';
import { PedidoEstado } from '../types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function PedidosPage() {
  const { pedidos, loading, fetchPedidos, createPedido, updatePedidoEstado } = usePedidos();
  const { canCreate, canUpdate } = useSubmodulePermissions('produccion', 'pedidos');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filterEstado, setFilterEstado] = useState<string>('todos');
  const [form, setForm] = useState({ cliente: '', nombre_proyecto: '', fecha_entrega: '', observaciones: '' });

  useEffect(() => { fetchPedidos(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await createPedido(form);
    if (result) {
      setDialogOpen(false);
      setForm({ cliente: '', nombre_proyecto: '', fecha_entrega: '', observaciones: '' });
    }
  };

  const filtered = filterEstado === 'todos' ? pedidos : pedidos.filter(p => p.estado === filterEstado);

  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ShoppingCart className="w-6 h-6" />
            Pedidos
          </h1>
          <p className="text-sm text-muted-foreground">Gestión de pedidos de ventas</p>
        </div>
        <div className="flex gap-2">
          <Select value={filterEstado} onValueChange={setFilterEstado}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="nuevo">Nuevos</SelectItem>
              <SelectItem value="en_ingenieria">En Ingeniería</SelectItem>
              <SelectItem value="en_produccion">En Producción</SelectItem>
              <SelectItem value="completado">Completados</SelectItem>
              <SelectItem value="entregado">Entregados</SelectItem>
            </SelectContent>
          </Select>
          {canCreate && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="w-4 h-4 mr-2" />Nuevo Pedido</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nuevo Pedido</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div><Label>Cliente *</Label><Input required value={form.cliente} onChange={(e) => setForm(f => ({ ...f, cliente: e.target.value }))} /></div>
                  <div><Label>Nombre del Proyecto *</Label><Input required value={form.nombre_proyecto} onChange={(e) => setForm(f => ({ ...f, nombre_proyecto: e.target.value }))} /></div>
                  <div><Label>Fecha de Entrega</Label><Input type="date" value={form.fecha_entrega} onChange={(e) => setForm(f => ({ ...f, fecha_entrega: e.target.value }))} /></div>
                  <div><Label>Observaciones</Label><Textarea value={form.observaciones} onChange={(e) => setForm(f => ({ ...f, observaciones: e.target.value }))} /></div>
                  <Button type="submit" className="w-full">Crear Pedido</Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No hay pedidos registrados</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Proyecto</TableHead>
                    <TableHead className="hidden sm:table-cell">Fecha Carga</TableHead>
                    <TableHead className="hidden md:table-cell">Entrega</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.cliente}</TableCell>
                      <TableCell>{p.nombre_proyecto}</TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        {format(new Date(p.fecha_carga), 'dd MMM yyyy', { locale: es })}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {p.fecha_entrega ? format(new Date(p.fecha_entrega), 'dd MMM yyyy', { locale: es }) : '—'}
                      </TableCell>
                      <TableCell>
                        {canUpdate ? (
                          <Select value={p.estado} onValueChange={(val) => updatePedidoEstado(p.id, val as PedidoEstado)}>
                            <SelectTrigger className="w-36 h-7 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="nuevo">Nuevo</SelectItem>
                              <SelectItem value="en_ingenieria">En Ingeniería</SelectItem>
                              <SelectItem value="en_produccion">En Producción</SelectItem>
                              <SelectItem value="completado">Completado</SelectItem>
                              <SelectItem value="entregado">Entregado</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <EstadoBadge estado={p.estado} />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
