import { useState, useEffect } from "react";
import { ComisionesLayout } from "../components/ComisionesLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Eye, Pencil, Users, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/formatters";

interface Seller {
  id: string;
  name: string;
  email: string;
}

interface SaleCommission {
  id: string;
  seller_id: string;
  percentage: number;
  amount: number;
  seller: {
    id: string;
    name: string;
  };
}

interface Sale {
  id: string;
  project_name: string;
  client_name: string;
  date: string;
  total_with_vat: number;
  vat: number;
  total_without_vat: number;
  sale_commissions: SaleCommission[];
}

interface CommissionEntry {
  sellerId: string;
  percentage: string;
}

export default function VentasPage() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [sales, setSales] = useState<Sale[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [saleToDelete, setSaleToDelete] = useState<Sale | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [newSale, setNewSale] = useState({
    projectName: "",
    clientName: "",
    date: "",
    totalWithVat: "",
  });

  const [editSale, setEditSale] = useState({
    id: "",
    projectName: "",
    clientName: "",
    date: "",
    totalWithVat: "",
  });

  const [commissions, setCommissions] = useState<CommissionEntry[]>([]);
  const [editCommissions, setEditCommissions] = useState<CommissionEntry[]>([]);

  const fetchSales = async () => {
    try {
      const { data, error } = await supabase
        .from("sales")
        .select(`
          *,
          sale_commissions (
            id,
            seller_id,
            percentage,
            amount,
            seller:sellers (
              id,
              name
            )
          )
        `)
        .order("date", { ascending: false });

      if (error) throw error;
      setSales(data || []);
    } catch (error: any) {
      console.error("Error fetching sales:", error);
      toast.error("Error al cargar las ventas");
    } finally {
      setLoading(false);
    }
  };

  const fetchSellers = async () => {
    try {
      const { data, error } = await supabase
        .from("sellers")
        .select("id, name, email")
        .order("name");

      if (error) throw error;
      setSellers(data || []);
    } catch (error: any) {
      console.error("Error fetching sellers:", error);
    }
  };

  useEffect(() => {
    fetchSales();
    fetchSellers();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewSale((prev) => ({ ...prev, [name]: value }));
  };

  const handleEditInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditSale((prev) => ({ ...prev, [name]: value }));
  };

  const calculateVat = (totalWithVat: number) => {
    const vat = totalWithVat - totalWithVat / 1.16;
    return Math.round(vat * 100) / 100;
  };

  const calculateTotalWithoutVat = (totalWithVat: number) => {
    return totalWithVat - calculateVat(totalWithVat);
  };

  const addCommission = () => {
    setCommissions([...commissions, { sellerId: "", percentage: "" }]);
  };

  const removeCommission = (index: number) => {
    setCommissions(commissions.filter((_, i) => i !== index));
  };

  const updateCommission = (index: number, field: keyof CommissionEntry, value: string) => {
    const updated = [...commissions];
    updated[index][field] = value;
    setCommissions(updated);
  };

  const addEditCommission = () => {
    setEditCommissions([...editCommissions, { sellerId: "", percentage: "" }]);
  };

  const removeEditCommission = (index: number) => {
    setEditCommissions(editCommissions.filter((_, i) => i !== index));
  };

  const updateEditCommission = (index: number, field: keyof CommissionEntry, value: string) => {
    const updated = [...editCommissions];
    updated[index][field] = value;
    setEditCommissions(updated);
  };

  const calculateCommissionAmount = (percentage: number, totalWithVat: string) => {
    if (!totalWithVat) return 0;
    const totalWithoutVat = calculateTotalWithoutVat(Number(totalWithVat));
    return Math.round((totalWithoutVat * percentage) / 100 * 100) / 100;
  };

  const resetForm = () => {
    setNewSale({ projectName: "", clientName: "", date: "", totalWithVat: "" });
    setCommissions([]);
  };

  const resetEditForm = () => {
    setEditSale({ id: "", projectName: "", clientName: "", date: "", totalWithVat: "" });
    setEditCommissions([]);
  };

  const handleCreateSale = async () => {
    if (!newSale.projectName || !newSale.clientName || !newSale.date || !newSale.totalWithVat) {
      toast.error("Por favor completa todos los campos");
      return;
    }

    for (const comm of commissions) {
      if (!comm.sellerId || !comm.percentage) {
        toast.error("Por favor completa todos los campos de comisión o elimina los vacíos");
        return;
      }
    }

    if (!user?.id) {
      toast.error("No se pudo identificar al usuario. Por favor, inicia sesión de nuevo.");
      return;
    }

    setSaving(true);
    try {
      const totalWithVat = Number(newSale.totalWithVat);
      const vat = calculateVat(totalWithVat);
      const totalWithoutVat = totalWithVat - vat;

      const { data: saleData, error: saleError } = await supabase
        .from("sales")
        .insert({
          project_name: newSale.projectName,
          client_name: newSale.clientName,
          date: newSale.date,
          total_with_vat: totalWithVat,
          vat: vat,
          total_without_vat: totalWithoutVat,
          created_by: user.id,
        })
        .select()
        .single();

      if (saleError) throw saleError;

      if (commissions.length > 0) {
        const commissionsToInsert = commissions.map((comm) => ({
          sale_id: saleData.id,
          seller_id: comm.sellerId,
          percentage: Number(comm.percentage),
          amount: calculateCommissionAmount(Number(comm.percentage), newSale.totalWithVat),
        }));

        const { error: commError } = await supabase
          .from("sale_commissions")
          .insert(commissionsToInsert);

        if (commError) throw commError;
      }

      toast.success("Venta creada exitosamente");
      resetForm();
      setIsCreateOpen(false);
      fetchSales();
    } catch (error: any) {
      console.error("Error creating sale:", error);
      toast.error("Error al crear la venta: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenEdit = (sale: Sale) => {
    setEditSale({
      id: sale.id,
      projectName: sale.project_name,
      clientName: sale.client_name,
      date: sale.date,
      totalWithVat: sale.total_with_vat.toString(),
    });
    setEditCommissions(
      sale.sale_commissions?.map((c) => ({
        sellerId: c.seller_id,
        percentage: c.percentage.toString(),
      })) || []
    );
    setIsEditOpen(true);
  };

  const handleUpdateSale = async () => {
    if (!editSale.projectName || !editSale.clientName || !editSale.date || !editSale.totalWithVat) {
      toast.error("Por favor completa todos los campos");
      return;
    }

    for (const comm of editCommissions) {
      if (!comm.sellerId || !comm.percentage) {
        toast.error("Por favor completa todos los campos de comisión o elimina los vacíos");
        return;
      }
    }

    setSaving(true);
    try {
      const totalWithVat = Number(editSale.totalWithVat);
      const vat = calculateVat(totalWithVat);
      const totalWithoutVat = totalWithVat - vat;

      const { error: saleError } = await supabase
        .from("sales")
        .update({
          project_name: editSale.projectName,
          client_name: editSale.clientName,
          date: editSale.date,
          total_with_vat: totalWithVat,
          vat: vat,
          total_without_vat: totalWithoutVat,
        })
        .eq("id", editSale.id);

      if (saleError) throw saleError;

      // Delete existing commissions
      const { error: deleteError } = await supabase
        .from("sale_commissions")
        .delete()
        .eq("sale_id", editSale.id);

      if (deleteError) throw deleteError;

      // Insert new commissions
      if (editCommissions.length > 0) {
        const commissionsToInsert = editCommissions.map((comm) => ({
          sale_id: editSale.id,
          seller_id: comm.sellerId,
          percentage: Number(comm.percentage),
          amount: calculateCommissionAmount(Number(comm.percentage), editSale.totalWithVat),
        }));

        const { error: commError } = await supabase
          .from("sale_commissions")
          .insert(commissionsToInsert);

        if (commError) throw commError;
      }

      toast.success("Venta actualizada exitosamente");
      resetEditForm();
      setIsEditOpen(false);
      fetchSales();
    } catch (error: any) {
      console.error("Error updating sale:", error);
      toast.error("Error al actualizar la venta: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSale = async () => {
    if (!saleToDelete) return;

    setDeleting(true);
    try {
      const { error: commError } = await supabase
        .from("sale_commissions")
        .delete()
        .eq("sale_id", saleToDelete.id);

      if (commError) throw commError;

      const { error: saleError } = await supabase
        .from("sales")
        .delete()
        .eq("id", saleToDelete.id);

      if (saleError) throw saleError;

      toast.success("Venta eliminada exitosamente");
      setIsDeleteOpen(false);
      setSaleToDelete(null);
      fetchSales();
    } catch (error: any) {
      console.error("Error deleting sale:", error);
      toast.error("Error al eliminar la venta: " + error.message);
    } finally {
      setDeleting(false);
    }
  };

  const getAvailableSellers = (currentIndex: number, commissionsList: CommissionEntry[]) => {
    const selectedIds = commissionsList
      .filter((_, i) => i !== currentIndex)
      .map((c) => c.sellerId);
    return sellers.filter((s) => !selectedIds.includes(s.id));
  };

  return (
    <ComisionesLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Ventas</h1>
            <p className="text-muted-foreground">
              Gestiona las ventas y proyectos
            </p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={(open) => {
            setIsCreateOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nueva Venta
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Registrar Nueva Venta</DialogTitle>
                <DialogDescription>
                  Completa los datos de la venta y asigna comisiones a los vendedores.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="projectName">Nombre del Proyecto</Label>
                  <Input
                    id="projectName"
                    name="projectName"
                    placeholder="Ej: Cocina en casa Margaritas"
                    value={newSale.projectName}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientName">Cliente</Label>
                  <Input
                    id="clientName"
                    name="clientName"
                    placeholder="Nombre del cliente"
                    value={newSale.clientName}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date">Fecha</Label>
                  <Input
                    id="date"
                    name="date"
                    type="date"
                    value={newSale.date}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="totalWithVat">Monto Total (con IVA)</Label>
                  <Input
                    id="totalWithVat"
                    name="totalWithVat"
                    type="number"
                    placeholder="0"
                    value={newSale.totalWithVat}
                    onChange={handleInputChange}
                  />
                </div>
                {newSale.totalWithVat && (
                  <div className="rounded-lg bg-muted p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">IVA (16%):</span>
                      <span className="font-medium">
                        {formatCurrency(calculateVat(Number(newSale.totalWithVat)))}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Monto sin IVA:</span>
                      <span className="font-medium">
                        {formatCurrency(calculateTotalWithoutVat(Number(newSale.totalWithVat)))}
                      </span>
                    </div>
                  </div>
                )}

                {/* Commissions Section */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Comisiones</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addCommission}
                      disabled={sellers.length === 0 || commissions.length >= sellers.length}
                    >
                      <Plus className="mr-1 h-3 w-3" />
                      Agregar
                    </Button>
                  </div>

                  {sellers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No hay vendedores registrados. Crea vendedores primero.
                    </p>
                  ) : commissions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Sin comisiones asignadas. Haz clic en "Agregar" para asignar vendedores.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {commissions.map((comm, index) => (
                        <div key={index} className="flex items-end gap-2 rounded-lg border border-border p-3">
                          <div className="flex-1 space-y-1">
                            <Label className="text-xs text-muted-foreground">Vendedor</Label>
                            <Select
                              value={comm.sellerId}
                              onValueChange={(value) => updateCommission(index, "sellerId", value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccionar vendedor" />
                              </SelectTrigger>
                              <SelectContent>
                                {getAvailableSellers(index, commissions).map((seller) => (
                                  <SelectItem key={seller.id} value={seller.id}>
                                    {seller.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="w-24 space-y-1">
                            <Label className="text-xs text-muted-foreground">%</Label>
                            <Input
                              type="number"
                              placeholder="5"
                              min="0"
                              max="100"
                              value={comm.percentage}
                              onChange={(e) => updateCommission(index, "percentage", e.target.value)}
                            />
                          </div>
                          <div className="w-28 text-right">
                            <p className="text-xs text-muted-foreground mb-1">Monto</p>
                            <p className="text-sm font-semibold text-green-600">
                              {comm.percentage
                                ? formatCurrency(calculateCommissionAmount(Number(comm.percentage), newSale.totalWithVat))
                                : "$0"}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-destructive hover:text-destructive"
                            onClick={() => removeCommission(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Button
                  className="mt-2"
                  onClick={handleCreateSale}
                  disabled={saving}
                >
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Guardar Venta
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Sales Table */}
        <Card>
          <CardHeader>
            <CardTitle>Todas las Ventas</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : sales.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No hay ventas registradas. Crea tu primera venta.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="pb-3 text-sm font-medium text-muted-foreground">Proyecto</th>
                      <th className="pb-3 text-sm font-medium text-muted-foreground">Cliente</th>
                      <th className="pb-3 text-sm font-medium text-muted-foreground">Fecha</th>
                      <th className="pb-3 text-right text-sm font-medium text-muted-foreground">Total c/IVA</th>
                      <th className="pb-3 text-right text-sm font-medium text-muted-foreground">Base s/IVA</th>
                      <th className="pb-3 text-center text-sm font-medium text-muted-foreground">Vendedores</th>
                      <th className="pb-3 text-right text-sm font-medium text-muted-foreground">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sales.map((sale) => (
                      <tr key={sale.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                        <td className="py-4">
                          <p className="font-medium">{sale.project_name}</p>
                        </td>
                        <td className="py-4 text-muted-foreground">{sale.client_name}</td>
                        <td className="py-4 text-muted-foreground">{formatDate(sale.date)}</td>
                        <td className="py-4 text-right font-medium">
                          {formatCurrency(Number(sale.total_with_vat))}
                        </td>
                        <td className="py-4 text-right font-medium text-primary">
                          {formatCurrency(Number(sale.total_without_vat))}
                        </td>
                        <td className="py-4 text-center">
                          <Badge variant="secondary" className="gap-1">
                            <Users className="h-3 w-3" />
                            {sale.sale_commissions?.length || 0}
                          </Badge>
                        </td>
                        <td className="py-4 text-right">
                          <div className="flex justify-end gap-1">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={() => setSelectedSale(sale)}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="sm:max-w-lg">
                                <DialogHeader>
                                  <DialogTitle>{sale.project_name}</DialogTitle>
                                  <DialogDescription>Detalles de la venta</DialogDescription>
                                </DialogHeader>
                                <div className="space-y-6 py-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <p className="text-sm text-muted-foreground">Cliente</p>
                                      <p className="font-medium">{sale.client_name}</p>
                                    </div>
                                    <div>
                                      <p className="text-sm text-muted-foreground">Fecha</p>
                                      <p className="font-medium">{formatDate(sale.date)}</p>
                                    </div>
                                  </div>
                                  <div className="rounded-lg bg-muted p-4 space-y-2">
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Total con IVA:</span>
                                      <span className="font-bold">{formatCurrency(Number(sale.total_with_vat))}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                      <span className="text-muted-foreground">IVA (16%):</span>
                                      <span>{formatCurrency(Number(sale.vat))}</span>
                                    </div>
                                    <div className="flex justify-between border-t border-border pt-2">
                                      <span className="text-muted-foreground">Base sin IVA:</span>
                                      <span className="font-bold text-primary">
                                        {formatCurrency(Number(sale.total_without_vat))}
                                      </span>
                                    </div>
                                  </div>
                                  <div>
                                    <h4 className="mb-3 font-semibold">Comisiones</h4>
                                    {sale.sale_commissions?.length > 0 ? (
                                      <div className="space-y-3">
                                        {sale.sale_commissions.map((commission) => (
                                          <div
                                            key={commission.id}
                                            className="flex items-center justify-between rounded-lg border border-border p-3"
                                          >
                                            <div className="flex items-center gap-3">
                                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                                                {commission.seller?.name?.charAt(0) || "?"}
                                              </div>
                                              <div>
                                                <p className="font-medium">{commission.seller?.name || "Sin vendedor"}</p>
                                                <p className="text-sm text-muted-foreground">
                                                  {commission.percentage}% de comisión
                                                </p>
                                              </div>
                                            </div>
                                            <p className="font-bold text-green-600">
                                              {formatCurrency(Number(commission.amount))}
                                            </p>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-sm text-muted-foreground">
                                        No hay comisiones asignadas a esta venta.
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                            {isAdmin && (
                              <>
                                <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(sale)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => {
                                    setSaleToDelete(sale);
                                    setIsDeleteOpen(true);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={(open) => {
        setIsEditOpen(open);
        if (!open) resetEditForm();
      }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Venta</DialogTitle>
            <DialogDescription>Modifica los datos de la venta.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-projectName">Nombre del Proyecto</Label>
              <Input
                id="edit-projectName"
                name="projectName"
                value={editSale.projectName}
                onChange={handleEditInputChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-clientName">Cliente</Label>
              <Input
                id="edit-clientName"
                name="clientName"
                value={editSale.clientName}
                onChange={handleEditInputChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-date">Fecha</Label>
              <Input
                id="edit-date"
                name="date"
                type="date"
                value={editSale.date}
                onChange={handleEditInputChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-totalWithVat">Monto Total (con IVA)</Label>
              <Input
                id="edit-totalWithVat"
                name="totalWithVat"
                type="number"
                value={editSale.totalWithVat}
                onChange={handleEditInputChange}
              />
            </div>

            {/* Edit Commissions */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Comisiones</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addEditCommission}
                  disabled={sellers.length === 0 || editCommissions.length >= sellers.length}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Agregar
                </Button>
              </div>

              {editCommissions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin comisiones asignadas.</p>
              ) : (
                <div className="space-y-3">
                  {editCommissions.map((comm, index) => (
                    <div key={index} className="flex items-end gap-2 rounded-lg border border-border p-3">
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs text-muted-foreground">Vendedor</Label>
                        <Select
                          value={comm.sellerId}
                          onValueChange={(value) => updateEditCommission(index, "sellerId", value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar vendedor" />
                          </SelectTrigger>
                          <SelectContent>
                            {getAvailableSellers(index, editCommissions).map((seller) => (
                              <SelectItem key={seller.id} value={seller.id}>
                                {seller.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="w-24 space-y-1">
                        <Label className="text-xs text-muted-foreground">%</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={comm.percentage}
                          onChange={(e) => updateEditCommission(index, "percentage", e.target.value)}
                        />
                      </div>
                      <div className="w-28 text-right">
                        <p className="text-xs text-muted-foreground mb-1">Monto</p>
                        <p className="text-sm font-semibold text-green-600">
                          {comm.percentage
                            ? formatCurrency(calculateCommissionAmount(Number(comm.percentage), editSale.totalWithVat))
                            : "$0"}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-destructive hover:text-destructive"
                        onClick={() => removeEditCommission(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-2">
              <Button variant="outline" className="flex-1" onClick={() => setIsEditOpen(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button className="flex-1" onClick={handleUpdateSale} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar venta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará la venta
              {saleToDelete && <> <strong>"{saleToDelete.project_name}"</strong></>} y todas sus comisiones asociadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSale}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Eliminando...
                </>
              ) : (
                "Eliminar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ComisionesLayout>
  );
}
