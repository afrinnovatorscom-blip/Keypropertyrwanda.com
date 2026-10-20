import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

export function Logo({ className, light = false, to = '/' }) {
  return (
    <Link to={to} className={cn('flex items-center gap-2.5', className)} aria-label="Key Property Rwanda — home">
      <img src="/assets/key-property-logo.png" alt="" width="40" height="40" className="size-10 rounded-lg" />
      <span className="leading-tight">
        <span className={cn('block text-base font-bold tracking-tight', light ? 'text-white' : 'text-primary')}>Key Property</span>
        <span className={cn('block text-[11px] font-semibold uppercase tracking-[0.2em]', light ? 'text-accent' : 'text-accent')}>Rwanda</span>
      </span>
    </Link>
  );
}
