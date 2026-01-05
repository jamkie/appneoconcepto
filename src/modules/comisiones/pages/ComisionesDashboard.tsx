import { useState, useEffect } from "react";
import { ComisionesLayout } from "../components/ComisionesLayout";
import { StatCard } from "../components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign,
  TrendingUp,
  Users,
  FileText,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface Seller {
  id: string;
  name: string;
  email: string;
}

interface Sale {
  id: string;
  project_name: string;
  client_name: string;
  date: string;
  total_with_vat: number;
  sale_commissions: { id: string }[];
}

interface Payment {
  id: string;
  date: string;
  amount: number;
  concept: string;
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

export default function ComisionesDashboard() {
  const [sellers, setSellers] = useState<SellerWithBalance[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [allSalesCount, setAllSalesCount] = useState(0);
  const [totalSalesAmount, setTotalSalesAmount] = useState(0);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch sellers
      const { data: sellersData, error: sellersError } = await supabase
        .from("sellers")
        .select("*");

      if (sellersError) throw sellersError;

      // Fetch sales with commissions count
      const { data: salesData, error: salesError } = await supabase
        .from("sales")
        .select("*, sale_commissions(id)")
        .order("date", { ascending: false })
        .limit(4);

      if (salesError) throw salesError;

      // Fetch payments with seller info
      const { data: paymentsData, error: paymentsError } = await supabase
        .from("payments")
        .select("*, sellers(name)")
        .order("date", { ascending: false })
        .limit(4);

      if (paymentsError) throw paymentsError;

      // Fetch all commissions
      const { data: commissionsData, error: commissionsError } = await supabase
        .from("sale_commissions")
        .select("seller_id, amount");

      if (commissionsError) throw commissionsError;

      // Fetch all payments for totals
      const { data: allPaymentsData, error: allPaymentsError } = await supabase
        .from("payments")
        .select("seller_id, amount");

      if (allPaymentsError) throw allPaymentsError;

      // Fetch sales count and total
      const { count } = await supabase
        .from("sales")
        .select("*", { count: "exact", head: true });
      setAllSalesCount(count || 0);

      const { data: allSalesData } = await supabase.from("sales").select("total_with_vat");
      const total = (allSalesData || []).reduce((sum, s) => sum + Number(s.total_with_vat), 0);
      setTotalSalesAmount(total);

      // Calculate balances per seller
      const sellersWithBalance: SellerWithBalance[] = (sellersData || []).map((seller: Seller) => {
        const totalCommissions = (commissionsData || [])
          .filter((c) => c.seller_id === seller.id)
          .reduce((sum, c) => sum + Number(c.amount), 0);

        const totalPaid = (allPaymentsData || [])
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

      setSellers(sellersWithBalance);
      setSales(salesData || []);
      setPayments(paymentsData || []);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const totalCommissions = sellers.reduce((acc, seller) => acc + seller.totalCommissions, 0);
  const totalPending = sellers.reduce((acc, seller) => acc + seller.pendingBalance, 0);

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
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Resumen general de ventas y comisiones
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Ventas Totales"
            value={formatCurrency(totalSalesAmount)}
            subtitle={`${allSalesCount} proyectos`}
            icon={<FileText className="h-5 w-5" />}
          />
          <StatCard
            title="Comisiones Generadas"
            value={formatCurrency(totalCommissions)}
            icon={<TrendingUp className="h-5 w-5" />}
          />
          <StatCard
            title="Saldo Pendiente"
            value={formatCurrency(totalPending)}
            subtitle="Por pagar"
            icon={<DollarSign className="h-5 w-5" />}
          />
          <StatCard
            title="Vendedores Activos"
            value={sellers.length.toString()}
            icon={<Users className="h-5 w-5" />}
          />
        </div>

        {/* Recent Activity */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent Sales */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Ventas Recientes</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/comisiones/ventas" className="flex items-center gap-1">
                  Ver todas
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {sales.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No hay ventas registradas
                  </p>
                ) : (
                  sales.map((sale) => (
                    <div
                      key={sale.id}
                      className="flex items-center justify-between rounded-lg border border-border p-4 transition-colors hover:bg-muted/50"
                    >
                      <div className="space-y-1">
                        <p className="font-medium">{sale.project_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {sale.client_name} • {formatDate(sale.date)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">
                          {formatCurrency(Number(sale.total_with_vat))}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {sale.sale_commissions?.length || 0} vendedor
                          {(sale.sale_commissions?.length || 0) !== 1 ? "es" : ""}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recent Payments */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Pagos Recientes</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/comisiones/pagos" className="flex items-center gap-1">
                  Ver todos
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {payments.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No hay pagos registrados
                  </p>
                ) : (
                  payments.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between rounded-lg border border-border p-4 transition-colors hover:bg-muted/50"
                    >
                      <div className="space-y-1">
                        <p className="font-medium">{payment.sellers?.name || "Vendedor"}</p>
                        <p className="text-sm text-muted-foreground">
                          {payment.concept}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-green-600">
                          {formatCurrency(Number(payment.amount))}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(payment.date)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sellers Overview */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Estado de Vendedores</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/comisiones/vendedores" className="flex items-center gap-1">
                Ver todos
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {sellers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No hay vendedores registrados
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="pb-3 text-sm font-medium text-muted-foreground">
                        Vendedor
                      </th>
                      <th className="pb-3 text-right text-sm font-medium text-muted-foreground">
                        Comisiones
                      </th>
                      <th className="pb-3 text-right text-sm font-medium text-muted-foreground">
                        Pagado
                      </th>
                      <th className="pb-3 text-right text-sm font-medium text-muted-foreground">
                        Pendiente
                      </th>
                      <th className="pb-3 text-right text-sm font-medium text-muted-foreground">
                        Estado
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sellers.map((seller) => (
                      <tr
                        key={seller.id}
                        className="border-b border-border last:border-0 hover:bg-muted/50"
                      >
                        <td className="py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                              {seller.name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-medium">{seller.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {seller.email}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 text-right font-medium">
                          {formatCurrency(seller.totalCommissions)}
                        </td>
                        <td className="py-4 text-right font-medium text-green-600">
                          {formatCurrency(seller.totalPaid)}
                        </td>
                        <td className="py-4 text-right font-medium">
                          {formatCurrency(seller.pendingBalance)}
                        </td>
                        <td className="py-4 text-right">
                          {seller.pendingBalance <= 0 ? (
                            <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                              Pagado
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                              Pendiente
                            </Badge>
                          )}
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
    </ComisionesLayout>
  );
}
