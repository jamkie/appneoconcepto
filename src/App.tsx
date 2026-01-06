import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ModuleRoute } from "@/components/ModuleRoute";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import AdminPage from "./pages/AdminPage";
import NotFound from "./pages/NotFound";

// Module imports
import { ComisionesPage } from "./modules/comisiones";
import { DestajosPage } from "./modules/destajos";
import { ServiciosPage } from "./modules/servicios";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            
            {/* Protected routes */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminPage />
                </ProtectedRoute>
              }
            />

            {/* Module Routes - Protected by module permissions */}
            <Route
              path="/comisiones/*"
              element={
                <ModuleRoute moduleId="comisiones">
                  <ComisionesPage />
                </ModuleRoute>
              }
            />
            <Route
              path="/destajos/*"
              element={
                <ModuleRoute moduleId="destajos">
                  <DestajosPage />
                </ModuleRoute>
              }
            />
            <Route
              path="/servicios/*"
              element={
                <ModuleRoute moduleId="servicios">
                  <ServiciosPage />
                </ModuleRoute>
              }
            />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
