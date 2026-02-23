import { Routes, Route } from 'react-router-dom';
import { ClientesLayout } from '../components/ClientesLayout';
import ClientesListPage from './ClientesListPage';

export default function ClientesPage() {
  return (
    <Routes>
      <Route element={<ClientesLayout />}>
        <Route index element={<ClientesListPage />} />
      </Route>
    </Routes>
  );
}
