import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { compact, cn } from '@/lib/utils';
import { publicApi } from '@/services/publicApi';
import { priceOptions, shortMoney } from './filterOptions';

/** Homepage search: keyword, location, category, sale/rent and price range. */
export function HeroSearch() {
  const navigate = useNavigate();
  const [values, setValues] = useState({ purpose: 'sale', q: '', location: '', category: '', minPrice: '', maxPrice: '' });
  const { data: locations = [] } = useQuery({ queryKey: ['locations'], queryFn: publicApi.locations, staleTime: 5 * 60 * 1000 });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: publicApi.categories, staleTime: 5 * 60 * 1000 });
  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));

  const districts = [...new Set(locations.flatMap((l) => [l.district, l.city]))].sort();
  const prices = priceOptions(values.purpose);

  const submit = (e) => {
    e.preventDefault();
    const params = new URLSearchParams(compact(values));
    navigate(`/properties?${params.toString()}`);
  };

  return (
    <form onSubmit={submit} className="rounded-2xl bg-white p-4 text-foreground shadow-2xl sm:p-5" role="search" aria-label="Search properties">
      <div className="mb-4 inline-flex rounded-lg bg-muted p-1" role="radiogroup" aria-label="Buy or rent">
        {[['sale', 'Buy'], ['rent', 'Rent']].map(([value, text]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={values.purpose === value}
            onClick={() => setValues((v) => ({ ...v, purpose: value, minPrice: '', maxPrice: '' }))}
            className={cn('rounded-md px-5 py-1.5 text-sm font-semibold transition', values.purpose === value ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground')}
          >
            {text}
          </button>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-[2fr_1.2fr_1.2fr_1fr_1fr_auto]">
        <label className="sr-only" htmlFor="hero-q">Keyword</label>
        <Input id="hero-q" placeholder="Keyword, neighbourhood or reference" value={values.q} onChange={set('q')} />
        <label className="sr-only" htmlFor="hero-location">Location</label>
        <Select id="hero-location" value={values.location} onChange={set('location')}>
          <option value="">Any location</option>
          {districts.map((d) => <option key={d} value={d}>{d}</option>)}
        </Select>
        <label className="sr-only" htmlFor="hero-category">Property type</label>
        <Select id="hero-category" value={values.category} onChange={set('category')}>
          <option value="">Any type</option>
          {categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
        </Select>
        <label className="sr-only" htmlFor="hero-min">Minimum price</label>
        <Select id="hero-min" value={values.minPrice} onChange={set('minPrice')}>
          <option value="">Min price</option>
          {prices.map((p) => <option key={p} value={p}>{shortMoney(p)}</option>)}
        </Select>
        <label className="sr-only" htmlFor="hero-max">Maximum price</label>
        <Select id="hero-max" value={values.maxPrice} onChange={set('maxPrice')}>
          <option value="">Max price</option>
          {prices.map((p) => <option key={p} value={p}>{shortMoney(p)}</option>)}
        </Select>
        <Button type="submit" size="lg" className="h-10 md:col-span-2 lg:col-span-1">
          <Search /> Search
        </Button>
      </div>
    </form>
  );
}
