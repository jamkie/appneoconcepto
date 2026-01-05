import { useState, useEffect } from "react";
import { ComisionesLayout } from "../components/ComisionesLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Eye, CreditCard, Loader2, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/formatters";

interface Seller {
  id: string;
  name: string;
  email: string;
  user_id: string | null;
}

interface SaleCommission {
  id: string;
  percentage: number;
  amount: number;
  sale: {
    id: string;
    project_name: string;
    client_name: string;
    date: string;
    total_without_vat: number;
  };
}

interface Payment {
  id: string;
  date: string;
  amount: number;
  concept: string;
}

interface SellerWithStats extends Seller {
  totalCommissions: number;
  totalPaid: number;
  pendingBalance: number;
  commissions: SaleCommission[];
  payments: Payment[];
}

export default function VendedoresPage() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const isMobile = useIsMobile();
  const [sellers, setSellers] = useState<SellerWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [selectedSeller, setSelectedSeller] = useState<SellerWithStats | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [sellerToEdit, setSellerToEdit] = useState<SellerWithStats | null>(null);
  const [sellerToDelete, setSellerToDelete] = useState<SellerWithStats | null>(null);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [newSeller, setNewSeller] = useState({ name: "", email: "" });
  const [newPayment, setNewPayment] = useState({ amount: "", date: "", concept: "" });
  const [editData, setEditData] = useState({ name: "", email: "" });

  const fetchSellers = async () => {
    try {
      const { data: sellersData, error: sellersError } = await supabase
        .from("sellers")
        .select("*")
        .order("name");

      if (sellersError) throw sellersError;

      const { data: commissionsData, error: commissionsError } = await supabase
        .from("sale_commissions")
        .select(`
          id,
          seller_id,
          percentage,
          amount,
          sale:sales (
            id,
            project_name,
            client_name,
            date,
            total_without_vat
          )
        `);

      if (commissionsError) throw commissionsError;

      const { data: paymentsData, error: paymentsError } = await supabase
        .from("payments")
        .select("*")
        .order("date", { ascending: false });

      if (paymentsError) throw paymentsError;

      const sellersWithStats: SellerWithStats[] = (sellersData || []).map((seller) => {
        const sellerCommissions = (commissionsData || []).filter((c) => c.seller_id === seller.id);
        const sellerPayments = (paymentsData || []).filter((p) => p.seller_id === seller.id);

        const totalCommissions = sellerCommissions.reduce((sum, c) => sum + Number(c.amount), 0);
        const totalPaid = sellerPayments.reduce((sum, p) => sum + Number(p.amount), 0);

        return {
          ...seller,
          totalCommissions,
          totalPaid,
          pendingBalance: totalCommissions - totalPaid,
          commissions: sellerCommissions,
          payments: sellerPayments,
        };
      });

      setSellers(sellersWithStats);
    } catch (error: any) {
      console.error("Error fetching sellers:", error);
      toast.error("Error al cargar los vendedores");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSellers();
  }, []);

  const resetForm = () => setNewSeller({ name: "", email: "" });
  const resetPaymentForm = () => setNewPayment({ amount: "", date: "", concept: "" });
  const resetEditForm = () => {
    setEditData({ name: "", email: "" });
    setSellerToEdit(null);
  };

  const handleCreateSeller = async () => {
    if (!newSeller.name || !newSeller.email) {
      toast.error("Por favor completa todos los campos");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("sellers").insert({
        name: newSeller.name,
        email: newSeller.email,
      });

      if (error) throw error;

      toast.success("Vendedor creado exitosamente");
      resetForm();
      setIsCreateOpen(false);
      fetchSellers();
    } catch (error: any) {
      console.error("Error creating seller:", error);
      toast.error("Error al crear el vendedor: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreatePayment = async () => {
    if (!selectedSeller) return;

    if (!newPayment.amount || !newPayment.date || !newPayment.concept) {
      toast.error("Por favor completa todos los campos");
      return;
    }

    const amount = Number(newPayment.amount);
    if (amount <= 0) {
      toast.error("El monto debe ser mayor a 0");
      return;
    }

    if (amount > selectedSeller.pendingBalance) {
      toast.error("El monto no puede ser mayor al saldo pendiente");
      return;
    }

    setSavingPayment(true);
    try {
      const { error } = await supabase.from("payments").insert({
        seller_id: selectedSeller.id,
        amount: amount,
        date: newPayment.date,
        concept: newPayment.concept,
        created_by: user?.id,
      });

      if (error) throw error;

      toast.success("Pago registrado exitosamente");
      resetPaymentForm();
      setIsPaymentOpen(false);
      fetchSellers();
    } catch (error: any) {
      console.error("Error creating payment:", error);
      toast.error("Error al registrar el pago: " + error.message);
    } finally {
      setSavingPayment(false);
    }
  };

  const handleOpenEdit = (seller: SellerWithStats) => {
    setSellerToEdit(seller);
    setEditData({ name: seller.name, email: seller.email });
    setIsEditOpen(true);
  };

  const handleUpdateSeller = async () => {
    if (!sellerToEdit) return;

    if (!editData.name || !editData.email) {
      toast.error("Por favor completa todos los campos");
      return;
    }

    setUpdating(true);
    try {
      const { error } = await supabase
        .from("sellers")
        .update({ name: editData.name, email: editData.email })
        .eq("id", sellerToEdit.id);

      if (error) throw error;

      toast.success("Vendedor actualizado exitosamente");
      resetEditForm();
      setIsEditOpen(false);
      fetchSellers();
    } catch (error: any) {
      console.error("Error updating seller:", error);
      toast.error(error.message || "Error al actualizar vendedor");
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteSeller = async () => {
    if (!sellerToDelete) return;

    setDeleting(true);
    try {
      const { error } = await supabase.from("sellers").delete().eq("id", sellerToDelete.id);

      if (error) throw error;

      toast.success("Vendedor eliminado exitosamente");
      setSellerToDelete(null);
      setIsDeleteOpen(false);
      fetchSellers();
    } catch (error: any) {
      console.error("Error deleting seller:", error);
      toast.error(error.message || "Error al eliminar vendedor");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <ComisionesLayout>
      <div className="space-y-6 md:space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Vendedores</h1>
            <p className="text-sm md:text-base text-muted-foreground">Gestiona tu equipo de ventas</p>
          </div>
          {isAdmin && (
            <Button onClick={() => setIsCreateOpen(true)}>
              <span className="mr-2">+</span> Nuevo Vendedor
            </Button>
          )}
        </div>

        {/* Sellers */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : sellers.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">No hay vendedores registrados.</p>
          </div>
        ) : isMobile ? (
          <div className="space-y-3">
            {sellers.map((seller) => (
              <Card key={seller.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                        {seller.name.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{seller.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{seller.email}</p>
                      </div>
                    </div>
                    <Badge className={seller.pendingBalance <= 0 ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}>
                      {seller.pendingBalance <= 0 ? "Al día" : "Pendiente"}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                    <div className="rounded-lg bg-muted/50 p-2">
                      <p className="text-xs text-muted-foreground">Comisiones</p>
                      <p className="text-sm font-medium">{formatCurrency(seller.totalCommissions)}</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-2">
                      <p className="text-xs text-muted-foreground">Pagado</p>
                      <p className="text-sm font-medium text-green-600">{formatCurrency(seller.totalPaid)}</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-2">
                      <p className="text-xs text-muted-foreground">Saldo</p>
                      <p className={`text-sm font-bold ${seller.pendingBalance > 0 ? "text-amber-600" : "text-green-600"}`}>
                        {formatCurrency(seller.pendingBalance)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-1 mt-3 pt-3 border-t border-border">
                    <Button variant="ghost" size="sm" onClick={() => { setSelectedSeller(seller); setIsDetailOpen(true); }}>
                      <Eye className="h-4 w-4 mr-1" /> Ver
                    </Button>
                    {isAdmin && seller.pendingBalance > 0 && (
                      <Button variant="ghost" size="sm" onClick={() => { setSelectedSeller(seller); setIsPaymentOpen(true); }}>
                        <CreditCard className="h-4 w-4 mr-1" /> Pagar
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Comisiones</TableHead>
                  <TableHead className="text-right">Pagado</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sellers.map((seller) => (
                  <TableRow key={seller.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                          {seller.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium">{seller.name}</p>
                          <p className="text-sm text-muted-foreground">{seller.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={seller.pendingBalance <= 0 ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}>
                        {seller.pendingBalance <= 0 ? "Al día" : "Pendiente"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(seller.totalCommissions)}</TableCell>
                    <TableCell className="text-right font-medium text-green-600">{formatCurrency(seller.totalPaid)}</TableCell>
                    <TableCell className={`text-right font-bold ${seller.pendingBalance > 0 ? "text-amber-600" : "text-green-600"}`}>
                      {formatCurrency(seller.pendingBalance)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => { setSelectedSeller(seller); setIsDetailOpen(true); }}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {isAdmin && seller.pendingBalance > 0 && (
                          <Button variant="ghost" size="icon" onClick={() => { setSelectedSeller(seller); setIsPaymentOpen(true); }}>
                            <CreditCard className="h-4 w-4" />
                          </Button>
                        )}
                        {isAdmin && (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(seller)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => { setSellerToDelete(seller); setIsDeleteOpen(true); }}>
                              <Trash2 className="h-4 w-4" />
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
      </div>

      {/* Create Seller Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if (!open) resetForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo Vendedor</DialogTitle>
            <DialogDescription>Agrega un nuevo vendedor al equipo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nombre Completo</Label>
              <Input placeholder="Nombre del vendedor" value={newSeller.name} onChange={(e) => setNewSeller({ ...newSeller, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Correo Electrónico</Label>
              <Input type="email" placeholder="correo@empresa.com" value={newSeller.email} onChange={(e) => setNewSeller({ ...newSeller, email: e.target.value })} />
            </div>
            <Button className="w-full" onClick={handleCreateSeller} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Crear Vendedor
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={(open) => { setIsDetailOpen(open); if (!open) setSelectedSeller(null); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedSeller && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                    {selectedSeller.name.charAt(0)}
                  </div>
                  {selectedSeller.name}
                </DialogTitle>
              </DialogHeader>
              <Tabs defaultValue="summary" className="mt-4">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="summary">Resumen</TabsTrigger>
                  <TabsTrigger value="sales">Ventas</TabsTrigger>
                  <TabsTrigger value="payments">Pagos</TabsTrigger>
                </TabsList>

                <TabsContent value="summary" className="space-y-4 mt-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="rounded-lg bg-muted p-4 text-center">
                      <p className="text-2xl font-bold">{formatCurrency(selectedSeller.totalCommissions)}</p>
                      <p className="text-sm text-muted-foreground">Comisiones</p>
                    </div>
                    <div className="rounded-lg bg-green-50 p-4 text-center">
                      <p className="text-2xl font-bold text-green-600">{formatCurrency(selectedSeller.totalPaid)}</p>
                      <p className="text-sm text-muted-foreground">Pagado</p>
                    </div>
                    <div className="rounded-lg bg-amber-50 p-4 text-center">
                      <p className="text-2xl font-bold text-amber-600">{formatCurrency(selectedSeller.pendingBalance)}</p>
                      <p className="text-sm text-muted-foreground">Pendiente</p>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="sales" className="mt-4">
                  <div className="space-y-3">
                    {selectedSeller.commissions.length > 0 ? (
                      selectedSeller.commissions.map((commission) => (
                        <div key={commission.id} className="flex items-center justify-between rounded-lg border border-border p-4">
                          <div>
                            <p className="font-medium">{commission.sale?.project_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {commission.sale?.client_name} • {commission.sale?.date && formatDate(commission.sale.date)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-green-600">{formatCurrency(Number(commission.amount))}</p>
                            <p className="text-sm text-muted-foreground">
                              {commission.percentage}% de {formatCurrency(Number(commission.sale?.total_without_vat || 0))}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-center text-muted-foreground py-8">No hay ventas registradas</p>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="payments" className="mt-4">
                  <div className="space-y-3">
                    {selectedSeller.payments.length > 0 ? (
                      selectedSeller.payments.map((payment) => (
                        <div key={payment.id} className="flex items-center justify-between rounded-lg border border-border p-4">
                          <div>
                            <p className="font-medium">{payment.concept}</p>
                            <p className="text-sm text-muted-foreground">{formatDate(payment.date)}</p>
                          </div>
                          <p className="font-bold text-green-600">{formatCurrency(Number(payment.amount))}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-center text-muted-foreground py-8">No hay pagos registrados</p>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={isPaymentOpen} onOpenChange={(open) => { setIsPaymentOpen(open); if (!open) { resetPaymentForm(); setSelectedSeller(null); } }}>
        <DialogContent className="sm:max-w-md">
          {selectedSeller && (
            <>
              <DialogHeader>
                <DialogTitle>Registrar Pago</DialogTitle>
                <DialogDescription>Saldo pendiente: {formatCurrency(selectedSeller.pendingBalance)}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>Monto</Label>
                  <Input type="number" placeholder="0" max={selectedSeller.pendingBalance} value={newPayment.amount} onChange={(e) => setNewPayment({ ...newPayment, amount: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Fecha</Label>
                  <Input type="date" value={newPayment.date} onChange={(e) => setNewPayment({ ...newPayment, date: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Concepto</Label>
                  <Input placeholder="Ej: Pago de comisiones enero" value={newPayment.concept} onChange={(e) => setNewPayment({ ...newPayment, concept: e.target.value })} />
                </div>
                <Button onClick={handleCreatePayment} disabled={savingPayment}>
                  {savingPayment && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Registrar Pago
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={(open) => { setIsEditOpen(open); if (!open) resetEditForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Vendedor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nombre Completo</Label>
              <Input value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Correo Electrónico</Label>
              <Input type="email" value={editData.email} onChange={(e) => setEditData({ ...editData, email: e.target.value })} />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setIsEditOpen(false)} disabled={updating}>Cancelar</Button>
              <Button className="flex-1" onClick={handleUpdateSeller} disabled={updating}>
                {updating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Guardar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar vendedor?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará el vendedor
              {sellerToDelete && <> <strong>"{sellerToDelete.name}"</strong></>} y todos sus datos asociados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSeller} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Eliminando...</> : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ComisionesLayout>
  );
}
