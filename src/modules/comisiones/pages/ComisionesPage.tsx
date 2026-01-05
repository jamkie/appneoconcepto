import { Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import ComisionesDashboard from "./ComisionesDashboard";
import VentasPage from "./VentasPage";
import VendedoresPage from "./VendedoresPage";
import PagosPage from "./PagosPage";

export default function ComisionesPage() {
  return (
    <ProtectedRoute>
      <Routes>
        <Route path="/" element={<ComisionesDashboard />} />
        <Route path="/ventas" element={<VentasPage />} />
        <Route path="/vendedores" element={<VendedoresPage />} />
        <Route path="/pagos" element={<PagosPage />} />
      </Routes>
    </ProtectedRoute>
  );
}
