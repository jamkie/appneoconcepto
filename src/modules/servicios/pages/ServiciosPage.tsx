import { Routes, Route, Navigate } from 'react-router-dom';
import { ServiciosLayout } from '../components/ServiciosLayout';
import ServiciosDashboard from './ServiciosDashboard';
import TicketsPage from './TicketsPage';
import ClientsPage from './ClientsPage';
import ProjectsPage from './ProjectsPage';
import SchedulePage from './SchedulePage';
import ReportsPage from './ReportsPage';

export default function ServiciosPage() {
  return (
    <ServiciosLayout>
      <Routes>
        <Route path="/" element={<ServiciosDashboard />} />
        <Route path="/tickets" element={<TicketsPage />} />
        <Route path="/clientes" element={<ClientsPage />} />
        <Route path="/proyectos" element={<ProjectsPage />} />
        <Route path="/agenda" element={<SchedulePage />} />
        <Route path="/reportes" element={<ReportsPage />} />
        <Route path="*" element={<Navigate to="/servicios" replace />} />
      </Routes>
    </ServiciosLayout>
  );
}
