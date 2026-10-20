import { useQuery } from '@tanstack/react-query';
import { SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { compact } from '@/lib/utils';
import { publicApi } from '@/services/publicApi';
import { AVAILABILITY_OPTIONS, describeFilter, FILTER_KEYS, priceOptions, shortMoney } from './filterOptions';

const pick = (params) => Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) ?? '']));

/**
 * Full filter form. `preset` holds route-level filters (e.g. purpose=sale on
 * /properties/for-sale) whose inputs are hidden or narrowed accordingly.
 */
export function FilterPanel({ searchParams, onApply, preset = {}, onClose }) {
  const [values, setValues] = useState(() => pick(searchParams));
  useEffect(() => {
    setValues(pick(searchParams));
  }, [searchParams]);

  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: publicApi.categories, staleTime: 5 * 60 * 1000 });
  const { data: locations = [] } = useQuery({ queryKey: ['locations'], queryFn: publicApi.locations, staleTime: 5 * 60 * 1000 });

  const purpose = preset.purpose ?? values.purpose;
  const prices = priceOptions(purpose);
  const visibleCategories = preset.group ? categories.filter((c) => c.typeGroup === preset.group) : categories;
  const places = [...new Set(locations.flatMap((l) => [l.district, l.city]))].sort();
  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));
  const showRooms = preset.group !== 'land';

  const submit = (e) => {
    e.preventDefault();
    onApply(compact(values));
    onClose?.();
  };

  return (
    <form onSubmit={submit} className="space-y-4" aria-label="Filter properties">
      <Field label="Keyword" htmlFor="f-q">
        <Input id="f-q" value={values.q} onChange={set('q')} placeholder="e.g. Kibagabaga, pool, KPR-00012" />
      </Field>
      <Field label="Location" htmlFor="f-location">
        <Select id="f-location" value={values.location} onChange={set('location')}>
          <option value="">Any location</option>
          {places.map((p) => <option key={p} value={p}>{p}</option>)}
        </Select>
      </Field>
      <Field label="Category" htmlFor="f-category">
        <Select id="f-category" value={values.category} onChange={set('category')}>
          <option value="">All categories</option>
          {visibleCategories.map((c) => <option key={c.id} value={c.slug}>{c.name} ({c.propertyCount})</option>)}
        </Select>
      </Field>
      {!preset.purpose && (
        <Field label="Sale or rent" htmlFor="f-purpose">
          <Select id="f-purpose" value={values.purpose} onChange={set('purpose')}>
            <option value="">Sale or rent</option>
            <option value="sale">For sale</option>
            <option value="rent">For rent</option>
          </Select>
        </Field>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Min price" htmlFor="f-min">
          <Select id="f-min" value={values.minPrice} onChange={set('minPrice')}>
            <option value="">No min</option>
            {prices.map((p) => <option key={p} value={p}>{shortMoney(p)}</option>)}
          </Select>
        </Field>
        <Field label="Max price" htmlFor="f-max">
          <Select id="f-max" value={values.maxPrice} onChange={set('maxPrice')}>
            <option value="">No max</option>
            {prices.map((p) => <option key={p} value={p}>{shortMoney(p)}</option>)}
          </Select>
        </Field>
      </div>
      {showRooms && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Bedrooms" htmlFor="f-bed">
            <Select id="f-bed" value={values.bedrooms} onChange={set('bedrooms')}>
              <option value="">Any</option>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}+</option>)}
            </Select>
          </Field>
          <Field label="Bathrooms" htmlFor="f-bath">
            <Select id="f-bath" value={values.bathrooms} onChange={set('bathrooms')}>
              <option value="">Any</option>
              {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}+</option>)}
            </Select>
          </Field>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Min size (m²)" htmlFor="f-minsize">
          <Input id="f-minsize" type="number" min="0" inputMode="numeric" value={values.minSize} onChange={set('minSize')} />
        </Field>
        <Field label="Max size (m²)" htmlFor="f-maxsize">
          <Input id="f-maxsize" type="number" min="0" inputMode="numeric" value={values.maxSize} onChange={set('maxSize')} />
        </Field>
      </div>
      <Field label="Availability" htmlFor="f-avail">
        <Select id="f-avail" value={values.availability} onChange={set('availability')}>
          <option value="">Any availability</option>
          {AVAILABILITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      </Field>
      <div className="flex gap-2">
        <Button type="submit" className="flex-1"><SlidersHorizontal /> Apply filters</Button>
        <Button type="button" variant="outline" onClick={() => { onApply({}); onClose?.(); }}>Clear</Button>
      </div>
    </form>
  );
}

/** Chips for the active filters, each removable, plus "Clear all". */
export function ActiveFilters({ searchParams, onRemove, onClear }) {
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: publicApi.categories, staleTime: 5 * 60 * 1000 });
  const active = FILTER_KEYS.filter((k) => searchParams.get(k));
  if (!active.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Active filters">
      {active.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onRemove(key)}
          className="inline-flex items-center gap-1 rounded-full border bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground hover:bg-secondary/70"
          aria-label={`Remove filter ${describeFilter(key, searchParams.get(key), categories)}`}
        >
          {describeFilter(key, searchParams.get(key), categories)} <X className="size-3" />
        </button>
      ))}
      <button type="button" onClick={onClear} className="text-xs font-semibold text-primary underline-offset-2 hover:underline">
        Clear all filters
      </button>
    </div>
  );
}
