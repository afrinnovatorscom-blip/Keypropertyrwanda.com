import { cn } from '@/lib/utils';

export function Table({ className, ...props }) {
  return (
    <div className="relative w-full overflow-x-auto">
      <table className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
  );
}

export const TableHeader = ({ className, ...props }) => <thead className={cn('[&_tr]:border-b bg-muted/50', className)} {...props} />;
export const TableBody = ({ className, ...props }) => <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props} />;
export const TableRow = ({ className, ...props }) => <tr className={cn('border-b transition-colors hover:bg-muted/40', className)} {...props} />;
export const TableHead = ({ className, ...props }) => (
  <th className={cn('h-10 px-3 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap', className)} {...props} />
);
export const TableCell = ({ className, ...props }) => <td className={cn('px-3 py-2.5 align-middle', className)} {...props} />;
