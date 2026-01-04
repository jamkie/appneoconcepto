import { ArrowLeft, Headphones } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function Servicios() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <Link to="/dashboard">
            <Button variant="ghost" size="sm" className="gap-2 mb-4">
              <ArrowLeft className="w-4 h-4" />
              Volver al inicio
            </Button>
          </Link>
          
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl neo-gradient-bg">
              <Headphones className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Servicios al Cliente</h1>
              <p className="text-muted-foreground">
                Atención, seguimiento y gestión de solicitudes
              </p>
            </div>
          </div>
        </div>

        <div className="neo-card p-12 text-center">
          <p className="text-muted-foreground">
            El contenido del módulo de Servicios al Cliente se mostrará aquí.
          </p>
        </div>
      </div>
    </div>
  );
}
