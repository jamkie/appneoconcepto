import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import * as Icons from 'lucide-react';
import { LucideIcon, ArrowRight, History } from 'lucide-react';
import { Module } from '@/types/modules';

interface RecentModulesProps {
  modules: Module[];
  onEnter: (moduleId: string) => void;
}

export function RecentModules({ modules, onEnter }: RecentModulesProps) {
  const navigate = useNavigate();

  if (modules.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8"
    >
      <div className="flex items-center gap-2 mb-4">
        <History className="w-4 h-4 text-muted-foreground" />
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Recientes
        </h2>
      </div>
      
      <div className="flex flex-wrap gap-3">
        {modules.map((module) => {
          const IconComponent = (Icons[module.icon as keyof typeof Icons] as LucideIcon) || Icons.Box;
          
          return (
            <button
              key={module.id}
              onClick={() => {
                if (module.route) {
                  onEnter(module.id);
                  navigate(module.route);
                }
              }}
              className="group flex items-center gap-3 px-4 py-3 bg-card border border-border rounded-xl hover:border-primary/30 hover:shadow-neo transition-all duration-200"
            >
              <div className="p-2 rounded-lg bg-primary/10">
                <IconComponent className="w-4 h-4 text-primary" />
              </div>
              <span className="font-medium text-sm text-foreground">{module.title}</span>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
