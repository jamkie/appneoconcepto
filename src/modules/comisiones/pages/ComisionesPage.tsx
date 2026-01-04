import { ArrowLeft, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

// TODO: Replace this placeholder with your actual Comisiones app code
// Paste your main page component here

export default function ComisionesPage() {
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
              <Wallet className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Comisiones</h1>
              <p className="text-muted-foreground">
                Gestión y seguimiento de comisiones de ventas
              </p>
            </div>
          </div>
        </div>

        {/* TODO: Paste your Comisiones app content here */}
        <div className="neo-card p-12 text-center">
          <p className="text-muted-foreground">
            ⏳ Esperando código del módulo Comisiones...
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Comparte tu código del proyecto Comisiones para integrarlo aquí.
          </p>
        </div>
      </div>
    </div>
  );
}
