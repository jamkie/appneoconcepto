import { motion } from 'framer-motion';
import { LayoutGrid } from 'lucide-react';

export function DashboardHeader() {
  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8"
    >
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 rounded-xl neo-gradient-bg">
          <LayoutGrid className="w-5 h-5 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">
          NeoConcepto <span className="neo-gradient-text">Platform</span>
        </h1>
      </div>
      <p className="text-muted-foreground">
        Selecciona un módulo para comenzar a trabajar
      </p>
    </motion.header>
  );
}
