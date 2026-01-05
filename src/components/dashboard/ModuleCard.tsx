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
  index: number;
}

export function ModuleCard({ module, index }: ModuleCardProps) {
  const navigate = useNavigate();
  const isComingSoon = module.status === 'coming_soon';
  
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
      navigate(module.route);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.35, ease: 'easeOut' }}
      className="neo-card group relative overflow-hidden p-6"
    >
      <div className="relative z-10">
        {/* Header with icon and badge */}
        <div className="flex items-start justify-between mb-5">
          <div className={`p-3 rounded-lg ${isComingSoon ? 'bg-muted' : 'neo-gradient-bg'}`}>
            <IconComponent 
              className={`w-5 h-5 ${isComingSoon ? 'text-muted-foreground' : 'text-primary-foreground'}`} 
            />
          </div>
          {isComingSoon && (
            <Badge variant="secondary" className="flex items-center gap-1 text-xs font-normal">
              <Clock className="w-3 h-3" />
              Próximamente
            </Badge>
          )}
        </div>

        {/* Content */}
        <h3 className={`text-base font-semibold mb-2 ${isComingSoon ? 'text-muted-foreground' : 'text-foreground'}`}>
          {module.title}
        </h3>
        <p className="text-sm text-muted-foreground mb-5 line-clamp-2 leading-relaxed">
          {module.description}
        </p>

        {/* Action button */}
        <Button
          onClick={handleClick}
          disabled={false}
          variant={isComingSoon ? 'outline' : 'default'}
          size="sm"
          className={`w-full ${isComingSoon ? 'cursor-pointer' : ''}`}
        >
          {isComingSoon ? 'Ver más' : 'Entrar'}
        </Button>
      </div>
    </motion.div>
  );
}
