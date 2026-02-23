import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { ReactNode } from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  subtitle?: string;
}

const variantStyles = {
  default: 'border-border',
  primary: 'border-primary/30 bg-primary/5',
  success: 'border-green-500/30 bg-green-500/5',
  warning: 'border-amber-500/30 bg-amber-500/5',
  danger: 'border-destructive/30 bg-destructive/5',
};

const iconStyles = {
  default: 'text-muted-foreground',
  primary: 'text-primary',
  success: 'text-green-600 dark:text-green-400',
  warning: 'text-amber-600 dark:text-amber-400',
  danger: 'text-destructive',
};

export function StatCard({ title, value, icon, variant = 'default', subtitle }: StatCardProps) {
  return (
    <Card className={cn('transition-all', variantStyles[variant])}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className={cn('p-2 rounded-lg bg-background', iconStyles[variant])}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
