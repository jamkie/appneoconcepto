import { motion } from 'framer-motion';
import logoNeoconcepto from '@/assets/logo-neoconcepto.png';

export function DashboardHeader() {
  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8"
    >
      <div className="flex items-center gap-4 mb-4">
        <img 
          src={logoNeoconcepto} 
          alt="Neo Concepto" 
          className="h-14 w-auto"
        />
      </div>
      <h2 className="text-lg font-medium text-foreground mb-1">
        Plataforma de Gestión
      </h2>
      <p className="text-muted-foreground text-sm">
        Selecciona un módulo para comenzar
      </p>
    </motion.header>
  );
}
