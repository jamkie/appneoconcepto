import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import * as Icons from 'lucide-react';
import { LucideIcon, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Module } from '@/types/modules';

interface ModuleCardProps {
  module: Module;
  onEnter: (moduleId: string) => void;
  index: number;
}

export function ModuleCard({ module, onEnter, index }: ModuleCardProps) {
  const navigate = useNavigate();
  const isComingSoon = module.status === 'coming_soon';
  
  // Dynamically get the icon
  const IconComponent = (Icons[module.icon as keyof typeof Icons] as LucideIcon) || Icons.Box;

  const handleClick = () => {
    if (isComingSoon) {
      toast({
        title: 'Disponible pronto',
        description: `${module.title} estará disponible próximamente.`,
      });
      return;
    }
    
    if (module.route) {
      onEnter(module.id);
      navigate(module.route);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4, ease: 'easeOut' }}
      className="neo-card group relative overflow-hidden p-6"
    >
      {/* Gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      <div className="relative z-10">
        {/* Header with icon and badge */}
        <div className="flex items-start justify-between mb-4">
          <div className={`p-3 rounded-xl ${isComingSoon ? 'bg-muted' : 'neo-gradient-bg'}`}>
            <IconComponent 
              className={`w-6 h-6 ${isComingSoon ? 'text-muted-foreground' : 'text-primary-foreground'}`} 
            />
          </div>
          {isComingSoon && (
            <Badge variant="secondary" className="flex items-center gap-1 text-xs">
              <Clock className="w-3 h-3" />
              Próximamente
            </Badge>
          )}
        </div>

        {/* Content */}
        <h3 className={`text-lg font-semibold mb-2 ${isComingSoon ? 'text-muted-foreground' : 'text-foreground'}`}>
          {module.title}
        </h3>
        <p className="text-sm text-muted-foreground mb-6 line-clamp-2">
          {module.description}
        </p>

        {/* Action button */}
        <Button
          onClick={handleClick}
          disabled={false}
          variant={isComingSoon ? 'outline' : 'default'}
          className={`w-full ${isComingSoon ? 'cursor-pointer' : ''}`}
        >
          {isComingSoon ? 'Ver más' : 'Entrar'}
        </Button>
      </div>
    </motion.div>
  );
}
