import { useState, useEffect } from "react";
import { ComisionesLayout } from "../components/ComisionesLayout";
import { StatCard } from "../components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { CreditCard, DollarSign, TrendingDown, Filter, Loader2, Pencil, Trash2 } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";

interface Seller {
  id: string;
  name: string;
  email: string;
}

interface Payment {
  id: string;
  date: string;
  amount: number;
  concept: string;
  seller_id: string;
  sellers: { name: string } | null;
}

interface SellerWithBalance {
  id: string;
  name: string;
  email: string;
  totalCommissions: number;
  totalPaid: number;
  pendingBalance: number;
}

export default function PagosPage() {
  const { isAdmin } = useUserRole();
  const isMobile = useIsMobile();
  const [filterSeller, setFilterSeller] = useState<string>("all");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [sellersWithBalance, setSellersWithBalance] = useState<SellerWithBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedSeller, setSelectedSeller] = useState<SellerWithBalance | null>(null);
  const [paymentToEdit, setPaymentToEdit] = useState<Payment | null>(null);
  const [paymentToDelete, setPaymentToDelete] = useState<Payment | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentConcept, setPaymentConcept] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentSellerId, setPaymentSellerId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      const { data: sellersData, error: sellersError } = await supabase.from("sellers").select("*");
      if (sellersError) throw sellersError;

      const { data: paymentsData, error: paymentsError } = await supabase
        .from("payments")
        .select("*, sellers(name)")
        .order("date", { ascending: false });
      if (paymentsError) throw paymentsError;

      const { data: commissionsData, error: commissionsError } = await supabase
        .from("sale_commissions")
        .select("seller_id, amount");
      if (commissionsError) throw commissionsError;

      const sellersBalances: SellerWithBalance[] = (sellersData || []).map((seller: Seller) => {
        const totalCommissions = (commissionsData || [])
          .filter((c) => c.seller_id === seller.id)
          .reduce((sum, c) => sum + Number(c.amount), 0);

        const totalPaid = (paymentsData || [])
          .filter((p) => p.seller_id === seller.id)
          .reduce((sum, p) => sum + Number(p.amount), 0);

        return {
          id: seller.id,
          name: seller.name,
          email: seller.email,
          totalCommissions,
          totalPaid,
          pendingBalance: totalCommissions - totalPaid,
        };
      });

      setSellers(sellersData || []);
      setPayments(paymentsData || []);
      setSellersWithBalance(sellersBalances);
    } catch (error) {
      console.error("Error fetching payments data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPaymentDialog = (seller: SellerWithBalance) => {
    setSelectedSeller(seller);
    setPaymentAmount(seller.pendingBalance.toString());
    setPaymentConcept("Pago de comisiones");
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setIsPaymentDialogOpen(true);
  };

  const handleOpenEditDialog = (payment: Payment) => {
    setPaymentToEdit(payment);
    setPaymentAmount(payment.amount.toString());
    setPaymentConcept(payment.concept);
    setPaymentDate(payment.date);
    setPaymentSellerId(payment.seller_id);
    setIsEditDialogOpen(true);
  };

  const handleOpenDeleteDialog = (payment: Payment) => {
    setPaymentToDelete(payment);
    setIsDeleteDialogOpen(true);
  };

  const resetForm = () => {
    setPaymentAmount("");
    setPaymentConcept("");
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setPaymentSellerId("");
    setSelectedSeller(null);
    setPaymentToEdit(null);
  };

  const handleSubmitPayment = async () => {
    if (!selectedSeller || !paymentAmount || !paymentConcept || !paymentDate) {
      toast.error("Por favor complete todos los campos");
      return;
    }

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("El monto debe ser un número positivo");
      return;
    }

    try {
      setIsSubmitting(true);

      const { error } = await supabase.from("payments").insert({
        seller_id: selectedSeller.id,
        amount: amount,
        concept: paymentConcept,
        date: paymentDate,
      });

      if (error) throw error;

      toast.success(`Pago de ${formatCurrency(amount)} registrado a ${selectedSeller.name}`);
      setIsPaymentDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error("Error registering payment:", error);
      toast.error(error.message || "Error al registrar el pago");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdatePayment = async () => {
    if (!paymentToEdit || !paymentAmount || !paymentConcept || !paymentDate || !paymentSellerId) {
      toast.error("Por favor complete todos los campos");
      return;
    }

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("El monto debe ser un número positivo");
      return;
    }

    try {
      setIsSubmitting(true);

      const { error } = await supabase
        .from("payments")
        .update({
          seller_id: paymentSellerId,
          amount: amount,
          concept: paymentConcept,
          date: paymentDate,
        })
        .eq("id", paymentToEdit.id);

      if (error) throw error;

      toast.success("Pago actualizado correctamente");
      setIsEditDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error("Error updating payment:", error);
      toast.error(error.message || "Error al actualizar el pago");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePayment = async () => {
    if (!paymentToDelete) return;

    try {
      setIsDeleting(true);

      const { error } = await supabase.from("payments").delete().eq("id", paymentToDelete.id);

      if (error) throw error;

      toast.success("Pago eliminado correctamente");
      setIsDeleteDialogOpen(false);
      setPaymentToDelete(null);
      fetchData();
    } catch (error: any) {
      console.error("Error deleting payment:", error);
      toast.error(error.message || "Error al eliminar el pago");
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredPayments = filterSeller === "all" ? payments : payments.filter((p) => p.seller_id === filterSeller);

  const totalPaid = payments.reduce((acc, p) => acc + Number(p.amount), 0);
  const totalPending = sellersWithBalance.reduce((acc, s) => acc + Math.max(0, s.pendingBalance), 0);
  const paymentsThisMonth = payments.filter((p) => {
    const pDate = new Date(p.date);
    const now = new Date();
    return pDate.getMonth() === now.getMonth() && pDate.getFullYear() === now.getFullYear();
  }).length;

  if (loading) {
    return (
      <ComisionesLayout>
        <div className="flex h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </ComisionesLayout>
    );
  }

  return (
    <ComisionesLayout>
      <div className="space-y-6 md:space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Pagos</h1>
          <p className="text-sm md:text-base text-muted-foreground">Historial de pagos a vendedores</p>
        </div>

        {/* Stats */}
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
          <StatCard title="Total Pagado" value={formatCurrency(totalPaid)} subtitle={`${payments.length} pagos realizados`} icon={<DollarSign className="h-5 w-5" />} />
          <StatCard title="Pendiente por Pagar" value={formatCurrency(totalPending)} icon={<TrendingDown className="h-5 w-5" />} />
          <StatCard title="Pagos Este Mes" value={paymentsThisMonth.toString()} icon={<CreditCard className="h-5 w-5" />} />
        </div>

        {/* Payments */}
        <Card>
          <CardHeader className={isMobile ? "flex-col items-start gap-3" : "flex flex-row items-center justify-between"}>
            <CardTitle className="text-lg">Historial de Pagos</CardTitle>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Filter className="h-4 w-4 text-muted-foreground hidden md:block" />
              <Select value={filterSeller} onValueChange={setFilterSeller}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Filtrar por vendedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los vendedores</SelectItem>
                  {sellers.map((seller) => (
                    <SelectItem key={seller.id} value={seller.id}>{seller.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isMobile ? (
              <div className="space-y-3">
                {filteredPayments.length === 0 ? (
                  <div className="py-12 text-center">
                    <CreditCard className="mx-auto h-12 w-12 text-muted-foreground/50" />
                    <p className="mt-4 text-muted-foreground">No hay pagos registrados</p>
                  </div>
                ) : (
                  filteredPayments.map((payment) => (
                    <div key={payment.id} className="rounded-lg border border-border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                            {payment.sellers?.name?.charAt(0) || "?"}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate text-sm">{payment.sellers?.name || "Vendedor"}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(payment.date)}</p>
                          </div>
                        </div>
                        <p className="font-bold text-green-600 text-sm shrink-0">{formatCurrency(Number(payment.amount))}</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2 truncate">{payment.concept}</p>
                      {isAdmin && (
                        <div className="flex justify-end gap-1 mt-2 pt-2 border-t border-border">
                          <Button variant="ghost" size="sm" className="h-7" onClick={() => handleOpenEditDialog(payment)}>
                            <Pencil className="h-3 w-3 mr-1" /> Editar
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 text-destructive hover:text-destructive" onClick={() => handleOpenDeleteDialog(payment)}>
                            <Trash2 className="h-3 w-3 mr-1" /> Eliminar
                          </Button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="pb-3 text-sm font-medium text-muted-foreground">Fecha</th>
                      <th className="pb-3 text-sm font-medium text-muted-foreground">Vendedor</th>
                      <th className="pb-3 text-sm font-medium text-muted-foreground">Concepto</th>
                      <th className="pb-3 text-right text-sm font-medium text-muted-foreground">Monto</th>
                      {isAdmin && <th className="pb-3 text-right text-sm font-medium text-muted-foreground">Acciones</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPayments.map((payment) => (
                      <tr key={payment.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                        <td className="py-4 text-muted-foreground">{formatDate(payment.date)}</td>
                        <td className="py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                              {payment.sellers?.name?.charAt(0) || "?"}
                            </div>
                            <span className="font-medium">{payment.sellers?.name || "Vendedor"}</span>
                          </div>
                        </td>
                        <td className="py-4 text-muted-foreground">{payment.concept}</td>
                        <td className="py-4 text-right">
                          <span className="font-bold text-green-600">{formatCurrency(Number(payment.amount))}</span>
                        </td>
                        {isAdmin && (
                          <td className="py-4 text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => handleOpenEditDialog(payment)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleOpenDeleteDialog(payment)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredPayments.length === 0 && (
                  <div className="py-12 text-center">
                    <CreditCard className="mx-auto h-12 w-12 text-muted-foreground/50" />
                    <p className="mt-4 text-muted-foreground">No hay pagos registrados</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Balances */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Saldos Pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sellersWithBalance.filter((s) => s.pendingBalance > 0).map((seller) => (
                <div key={seller.id} className={`rounded-lg border border-border p-3 md:p-4 ${isMobile ? "space-y-3" : "flex items-center justify-between"}`}>
                  <div className="flex items-center gap-3">
                    <div className={`flex ${isMobile ? "h-8 w-8 text-sm" : "h-10 w-10 text-lg"} items-center justify-center rounded-full bg-primary/10 font-semibold text-primary`}>
                      {seller.name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{seller.name}</p>
                      {!isMobile && <p className="text-sm text-muted-foreground truncate">{seller.email}</p>}
                    </div>
                    {isMobile && <p className="font-bold text-amber-600 text-sm">{formatCurrency(seller.pendingBalance)}</p>}
                  </div>
                  <div className={`flex items-center ${isMobile ? "justify-end" : "gap-4"}`}>
                    {!isMobile && (
                      <div className="text-right">
                        <p className="font-bold text-amber-600">{formatCurrency(seller.pendingBalance)}</p>
                        <p className="text-sm text-muted-foreground">pendiente</p>
                      </div>
                    )}
                    {isAdmin && (
                      <Button size="sm" onClick={() => handleOpenPaymentDialog(seller)}>Pagar</Button>
                    )}
                  </div>
                </div>
              ))}
              {sellersWithBalance.filter((s) => s.pendingBalance > 0).length === 0 && (
                <div className="py-8 text-center">
                  <Badge className="bg-green-100 text-green-700 text-base md:text-lg px-4 py-2">✓ Todos los vendedores están al día</Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* New Payment Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={(open) => { setIsPaymentDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Pago</DialogTitle>
            <DialogDescription>
              {selectedSeller && (
                <>Registrar pago para <strong>{selectedSeller.name}</strong><br />Saldo pendiente: <strong>{formatCurrency(selectedSeller.pendingBalance)}</strong></>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Monto</Label>
              <Input type="number" placeholder="0.00" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Concepto</Label>
              <Input placeholder="Ej: Pago de comisiones" value={paymentConcept} onChange={(e) => setPaymentConcept(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Fecha</Label>
              <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsPaymentDialogOpen(false)} disabled={isSubmitting}>Cancelar</Button>
              <Button onClick={handleSubmitPayment} disabled={isSubmitting}>
                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...</> : "Registrar Pago"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Payment Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => { setIsEditDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Pago</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Vendedor</Label>
              <Select value={paymentSellerId} onValueChange={setPaymentSellerId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar vendedor" /></SelectTrigger>
                <SelectContent>
                  {sellers.map((seller) => <SelectItem key={seller.id} value={seller.id}>{seller.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Monto</Label>
              <Input type="number" placeholder="0.00" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Concepto</Label>
              <Input placeholder="Ej: Pago de comisiones" value={paymentConcept} onChange={(e) => setPaymentConcept(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Fecha</Label>
              <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={isSubmitting}>Cancelar</Button>
              <Button onClick={handleUpdatePayment} disabled={isSubmitting}>
                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...</> : "Guardar Cambios"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar pago?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará el pago de{" "}
              {paymentToDelete && <strong>{formatCurrency(Number(paymentToDelete.amount))}</strong>}
              {paymentToDelete?.sellers?.name && <> a <strong>{paymentToDelete.sellers.name}</strong></>}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePayment} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeleting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Eliminando...</> : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ComisionesLayout>
  );
}
