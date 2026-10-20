import { AlertTriangle, Inbox, LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Skeleton({ className }) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} />;
}

export function Spinner({ className, label = 'Loading' }) {
  return (
    <span role="status" className={cn('inline-flex items-center gap-2 text-sm text-muted-foreground', className)}>
      <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
      <span>{label}…</span>
    </span>
  );
}

export function EmptyState({ title = 'Nothing here yet', description, icon: Icon = Inbox, action, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center rounded-xl border border-dashed p-10 text-center', className)}>
      <Icon className="mb-3 size-10 text-muted-foreground/60" aria-hidden="true" />
      <p className="font-medium">{title}</p>
      {description && <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Alert({ variant = 'info', title, children, className }) {
  const styles = {
    info: 'border-sky-200 bg-sky-50 text-sky-900',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
    error: 'border-red-200 bg-red-50 text-red-900',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  };
  return (
    <div role={variant === 'error' ? 'alert' : 'status'} className={cn('flex gap-3 rounded-lg border p-3 text-sm', styles[variant], className)}>
      {variant !== 'success' && <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}
      <div>
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? 'mt-0.5' : ''}>{children}</div>}
      </div>
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <Alert variant="error" title="Could not load data">
      {error?.message ?? 'Please try again.'}
      {onRetry && (
        <button type="button" onClick={onRetry} className="ml-2 font-medium underline">
          Retry
        </button>
      )}
    </Alert>
  );
}
