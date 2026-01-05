import { motion } from 'framer-motion';

export function DashboardHeader() {
  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8"
    >
      <div className="flex items-center gap-4 mb-3">
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold tracking-tight text-primary">NEO</span>
          <span className="text-xl font-medium tracking-wide text-muted-foreground">CONCEPTO</span>
        </div>
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
