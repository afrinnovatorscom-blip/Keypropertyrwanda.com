import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';

export function AdminPage({ title, description, actions, children }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export function StatCard({ label, value, icon: Icon, hint, tone = 'default', className }) {
  const tones = {
    default: 'bg-secondary text-primary',
    accent: 'bg-amber-100 text-amber-700',
    success: 'bg-emerald-100 text-emerald-700',
    danger: 'bg-red-100 text-red-700',
    info: 'bg-sky-100 text-sky-700',
  };
  return (
    <div className={cn('rounded-xl border bg-card p-4 shadow-sm', className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{value ?? '—'}</p>
          {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
        </div>
        {Icon && <span className={cn('rounded-lg p-2', tones[tone])}><Icon className="size-5" /></span>}
      </div>
    </div>
  );
}

/**
 * useMutation with success/error toasts and cache invalidation.
 * `invalidate` is a list of query keys to refresh on success.
 */
export function useAdminMutation(mutationFn, { success, invalidate = [], onSuccess, onError } = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async (data, variables) => {
      if (success) toast.success(typeof success === 'function' ? success(data, variables) : success);
      await Promise.all(invalidate.map((key) => queryClient.invalidateQueries({ queryKey: key })));
      onSuccess?.(data, variables);
    },
    onError: (error, variables) => {
      if (onError?.(error, variables) === true) return;
      toast.error(errorMessage(error));
    },
  });
}

/** Button that asks for confirmation in a dialog before running `onConfirm`. */
export function ConfirmButton({ children, title = 'Are you sure?', description, confirmLabel = 'Confirm', variant = 'outline', confirmVariant = 'destructive', size = 'sm', onConfirm, disabled, pending }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} size={size} disabled={disabled || pending} onClick={() => setOpen(true)}>
        {children}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              variant={confirmVariant}
              onClick={async () => {
                setOpen(false);
                await onConfirm();
              }}
            >
              {confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function FilterBar({ children, className }) {
  return <div className={cn('flex flex-col gap-3 rounded-xl border bg-card p-3 shadow-sm sm:flex-row sm:flex-wrap sm:items-center', className)}>{children}</div>;
}

export function TableCard({ children, footer }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      {children}
      {footer && <div className="border-t p-3">{footer}</div>}
    </div>
  );
}
