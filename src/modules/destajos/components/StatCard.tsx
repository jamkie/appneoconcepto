import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: {
    value: number;
    label: string;
  };
  variant?: 'default' | 'primary' | 'success' | 'warning';
  className?: string;
}

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  variant = 'default',
  className
}: StatCardProps) {
  const variantStyles = {
    default: 'bg-card',
    primary: 'bg-primary/5 border-primary/20',
    success: 'bg-green-500/5 border-green-500/20',
    warning: 'bg-yellow-500/5 border-yellow-500/20',
  };

  return (
    <div className={cn(
      "rounded-xl border p-4 transition-all hover:shadow-md",
      variantStyles[variant],
      className
    )}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-muted-foreground">{title}</span>
        <div className="text-muted-foreground">{icon}</div>
      </div>
      <div className="space-y-1">
        <p className="text-2xl font-bold text-foreground">{value}</p>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
        {trend && (
          <div className={cn(
            "flex items-center gap-1 text-xs font-medium",
            trend.value >= 0 ? "text-green-600" : "text-red-600"
          )}>
            <span>{trend.value >= 0 ? '+' : ''}{trend.value}%</span>
            <span className="text-muted-foreground">{trend.label}</span>
          </div>
        )}
      </div>
    </div>
  );
}
