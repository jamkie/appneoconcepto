import { useEffect, useState } from 'react';
import { Users, Plus, Search, Phone, Mail, MapPin, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Loader2 } from 'lucide-react';
import { useClientes } from '../hooks/useClientes';
import { useSubmodulePermissions } from '@/hooks/useSubmodulePermissions';
import { Cliente } from '../types';

const emptyForm = { nombre: '', contacto: '', telefono: '', email: '', direccion: '', notas: '' };

export default function ClientesListPage() {
  const { clientes, loading, fetchClientes, createCliente, updateCliente, deleteCliente } = useClientes();
  const { canCreate, canUpdate, canDelete } = useSubmodulePermissions('clientes', 'clientes');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { fetchClientes(); }, []);

  const handleOpenCreate = () => {
    setEditingCliente(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const handleOpenEdit = (c: Cliente) => {
    setEditingCliente(c);
    setForm({
      nombre: c.nombre,
      contacto: c.contacto || '',
      telefono: c.telefono || '',
      email: c.email || '',
      direccion: c.direccion || '',
      notas: c.notas || '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      nombre: form.nombre,
      contacto: form.contacto || null,
      telefono: form.telefono || null,
      email: form.email || null,
      direccion: form.direccion || null,
      notas: form.notas || null,
    };

    let success = false;
    if (editingCliente) {
      success = await updateCliente(editingCliente.id, payload);
    } else {
      success = !!(await createCliente(payload));
    }

    if (success) {
      setDialogOpen(false);
      setForm(emptyForm);
      setEditingCliente(null);
    }
  };

  const filtered = clientes.filter(
    (c) =>
      c.nombre.toLowerCase().includes(search.toLowerCase()) ||
      (c.email || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.telefono || '').includes(search) ||
      (c.contacto || '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="w-6 h-6" />
            Clientes
          </h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length} cliente{filtered.length !== 1 ? 's' : ''} registrado{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          {canCreate && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={handleOpenCreate}>
                  <Plus className="w-4 h-4 mr-2" />
                  Nuevo Cliente
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingCliente ? 'Editar Cliente' : 'Nuevo Cliente'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label>Nombre / Razón Social *</Label>
                    <Input required value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Contacto</Label>
                    <Input value={form.contacto} onChange={(e) => setForm((f) => ({ ...f, contacto: e.target.value }))} placeholder="Nombre del contacto principal" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label>Teléfono</Label>
                      <Input value={form.telefono} onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Email</Label>
                      <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <Label>Dirección</Label>
                    <Input value={form.direccion} onChange={(e) => setForm((f) => ({ ...f, direccion: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Notas</Label>
                    <Textarea value={form.notas} onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))} />
                  </div>
                  <Button type="submit" className="w-full">
                    {editingCliente ? 'Guardar Cambios' : 'Crear Cliente'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre, contacto, email o teléfono..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Client Cards */}
      <div className="grid gap-4">
        {filtered.map((c) => (
          <Card key={c.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4 md:p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg truncate">{c.nombre}</h3>
                    {!c.activo && (
                      <Badge variant="secondary">Inactivo</Badge>
                    )}
                  </div>
                  {c.contacto && (
                    <p className="text-sm text-muted-foreground">{c.contacto}</p>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    {c.telefono && (
                      <span className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5" />
                        {c.telefono}
                      </span>
                    )}
                    {c.email && (
                      <span className="flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5" />
                        {c.email}
                      </span>
                    )}
                    {c.direccion && (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5" />
                        {c.direccion}
                      </span>
                    )}
                  </div>
                  {c.notas && (
                    <p className="text-sm text-muted-foreground line-clamp-1">{c.notas}</p>
                  )}
                </div>

                <div className="flex gap-1 shrink-0">
                  {canUpdate && (
                    <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(c)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  {canDelete && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Eliminar cliente?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Se eliminará "{c.nombre}" permanentemente. Esta acción no se puede deshacer.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteCliente(c.id)}>Eliminar</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="font-semibold mb-1">No se encontraron clientes</h3>
          <p className="text-sm text-muted-foreground">
            {search ? 'Intenta buscar con otros términos' : 'Agrega tu primer cliente'}
          </p>
        </div>
      )}
    </div>
  );
}
