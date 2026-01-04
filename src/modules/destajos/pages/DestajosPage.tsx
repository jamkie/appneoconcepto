import { ArrowLeft, Hammer } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

// TODO: Replace this placeholder with your actual Destajos app code
// Paste your main page component here

export default function DestajosPage() {
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
              <Hammer className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Destajos</h1>
              <p className="text-muted-foreground">
                Control de pagos por obra y trabajo a destajo
              </p>
            </div>
          </div>
        </div>

        {/* TODO: Paste your Destajos app content here */}
        <div className="neo-card p-12 text-center">
          <p className="text-muted-foreground">
            ⏳ Esperando código del módulo Destajos...
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Comparte tu código del proyecto Destajos para integrarlo aquí.
          </p>
        </div>
      </div>
    </div>
  );
}
