import { useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import { useState } from 'react';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useDebounce } from '@/hooks/useDebounce';
import { formatMoney, label } from '@/lib/format';
import { adminApi } from '@/services/adminApi';

/**
 * Search-as-you-type property selector.
 * single: value = { id, title, reference } | null; multiple: value = array.
 * `promotable` restricts results to published + available listings.
 */
export function PropertyPicker({ value, onChange, multiple = false, promotable = false, id, invalid }) {
  const [q, setQ] = useState('');
  const debounced = useDebounce(q, 250);
  const { data: options = [], isFetching } = useQuery({
    queryKey: ['admin', 'property-options', debounced, promotable],
    queryFn: () => adminApi.properties.options({ q: debounced, promotable: promotable ? 'true' : undefined }),
  });

  const selected = multiple ? value ?? [] : value ? [value] : [];
  const selectedIds = new Set(selected.map((s) => s.id));

  const choose = (option) => {
    if (multiple) {
      if (!selectedIds.has(option.id)) onChange([...selected, option]);
    } else {
      onChange(option);
    }
    setQ('');
  };
  const remove = (pid) => onChange(multiple ? selected.filter((s) => s.id !== pid) : null);

  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((s) => (
            <span key={s.id} className="inline-flex items-center gap-1.5 rounded-md border bg-secondary px-2 py-1 text-xs">
              <strong>{s.reference}</strong> {s.title}
              <button type="button" onClick={() => remove(s.id)} aria-label={`Remove ${s.title}`} className="text-muted-foreground hover:text-destructive">
                <X className="size-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      {(multiple || !selected.length) && (
        <div className="rounded-md border">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input id={id} aria-invalid={invalid} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by title or reference…" className="border-0 pl-9 shadow-none" />
          </div>
          <ul className="max-h-52 overflow-y-auto border-t text-sm" role="listbox">
            {options.filter((o) => !selectedIds.has(o.id)).map((o) => (
              <li key={o.id}>
                <button type="button" onClick={() => choose(o)} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-muted">
                  <span className="min-w-0">
                    <span className="font-medium">{o.reference}</span> · <span className="truncate">{o.title}</span>
                    <span className="block text-xs text-muted-foreground">{formatMoney(o.price, o.currency)}</span>
                  </span>
                  <span className="flex shrink-0 gap-1">
                    <StatusBadge status={o.publicationStatus}>{label('publication', o.publicationStatus)}</StatusBadge>
                    {o.availabilityStatus !== 'available' && <Badge variant="danger">{label('availability', o.availabilityStatus)}</Badge>}
                  </span>
                </button>
              </li>
            ))}
            {!options.length && <li className="px-3 py-3 text-muted-foreground">{isFetching ? 'Searching…' : 'No matching properties'}</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
