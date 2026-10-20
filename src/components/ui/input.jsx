import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

const base =
  'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-destructive';

export const Input = forwardRef(({ className, type = 'text', ...props }, ref) => (
  <input ref={ref} type={type} className={cn(base, 'h-10', className)} {...props} />
));
Input.displayName = 'Input';

export const Textarea = forwardRef(({ className, rows = 4, ...props }, ref) => (
  <textarea ref={ref} rows={rows} className={cn(base, 'min-h-20', className)} {...props} />
));
Textarea.displayName = 'Textarea';

/** Native select styled like shadcn inputs (accessible and mobile-friendly). */
export const Select = forwardRef(({ className, children, ...props }, ref) => (
  <select ref={ref} className={cn(base, 'select-chevron h-10 pr-8', className)} {...props}>
    {children}
  </select>
));
Select.displayName = 'Select';

export const Checkbox = forwardRef(({ className, ...props }, ref) => (
  <input ref={ref} type="checkbox" className={cn('size-4 rounded border-input accent-[var(--primary)] cursor-pointer', className)} {...props} />
));
Checkbox.displayName = 'Checkbox';
