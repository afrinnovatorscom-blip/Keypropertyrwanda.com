import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap [&_svg]:size-3', {
  variants: {
    variant: {
      default: 'bg-primary text-primary-foreground',
      secondary: 'bg-secondary text-secondary-foreground',
      accent: 'bg-accent text-accent-foreground',
      outline: 'border border-border text-foreground',
      success: 'bg-emerald-100 text-emerald-800',
      warning: 'bg-amber-100 text-amber-800',
      danger: 'bg-red-100 text-red-700',
      muted: 'bg-muted text-muted-foreground',
      info: 'bg-sky-100 text-sky-800',
      hot: 'bg-red-600 text-white',
    },
  },
  defaultVariants: { variant: 'default' },
});

export function Badge({ className, variant, ...props }) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

const STATUS_VARIANTS = {
  published: 'success', active: 'success', available: 'success', converted: 'success', live: 'success',
  draft: 'muted', unpublished: 'warning', archived: 'muted', paused: 'warning', scheduled: 'info',
  expired: 'muted', ended: 'muted', closed: 'muted', suspended: 'danger',
  sold: 'danger', rented: 'danger', unavailable: 'danger', under_offer: 'warning',
  new: 'accent', contacted: 'info', in_progress: 'warning',
};

/** Badge colour chosen from a status value. */
export function StatusBadge({ status, children, className }) {
  return (
    <Badge variant={STATUS_VARIANTS[status] ?? 'outline'} className={className}>
      {children ?? status}
    </Badge>
  );
}
