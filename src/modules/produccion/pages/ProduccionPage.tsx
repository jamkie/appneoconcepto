import { Routes, Route } from 'react-router-dom';
import { ProduccionLayout } from '../components/ProduccionLayout';
import ProduccionDashboard from './ProduccionDashboard';
import PedidosPage from './PedidosPage';
import OrdenesPage from './OrdenesPage';
import KanbanPage from './KanbanPage';
import CalendarioPage from './CalendarioPage';
import NotificacionesPage from './NotificacionesPage';

export default function ProduccionPage() {
  return (
    <Routes>
      <Route element={<ProduccionLayout />}>
        <Route index element={<ProduccionDashboard />} />
        <Route path="pedidos" element={<PedidosPage />} />
        <Route path="ordenes" element={<OrdenesPage />} />
        <Route path="kanban" element={<KanbanPage />} />
        <Route path="calendario" element={<CalendarioPage />} />
        <Route path="notificaciones" element={<NotificacionesPage />} />
      </Route>
    </Routes>
  );
}
