import { Routes, Route } from 'react-router-dom';
import { DestajosLayout } from '../components/DestajosLayout';
import DestajosDashboard from './DestajosDashboard';
import ObrasPage from './ObrasPage';
import InstaladoresPage from './InstaladoresPage';
import AvancesPage from './AvancesPage';
import ExtrasPage from './ExtrasPage';
import SolicitudesPage from './SolicitudesPage';
import CortesPage from './CortesPage';
import PagosPage from './PagosPage';

export default function DestajosPage() {
  return (
    <Routes>
      <Route element={<DestajosLayout />}>
        <Route index element={<DestajosDashboard />} />
        <Route path="obras" element={<ObrasPage />} />
        <Route path="instaladores" element={<InstaladoresPage />} />
        <Route path="avances" element={<AvancesPage />} />
        <Route path="extras" element={<ExtrasPage />} />
        <Route path="solicitudes" element={<SolicitudesPage />} />
        <Route path="cortes" element={<CortesPage />} />
        <Route path="pagos" element={<PagosPage />} />
      </Route>
    </Routes>
  );
}
