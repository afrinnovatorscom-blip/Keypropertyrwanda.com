import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { SearchX, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHero } from '@/components/layout/Section';
import { ActiveFilters, FilterPanel } from '@/components/property/FilterPanel';
import { SORT_OPTIONS } from '@/components/property/filterOptions';
import { PropertyGrid } from '@/components/property/PropertyCard';
import { AdSlot } from '@/components/promotions/AdSlot';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState } from '@/components/ui/feedback';
import { Select } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { useSeo } from '@/lib/seo';
import { publicApi } from '@/services/publicApi';

export const LISTING_PRESETS = {
  all: { preset: {}, title: 'All Properties', description: 'Browse every available listing across Rwanda.' },
  sale: { preset: { purpose: 'sale' }, title: 'Properties for Sale', description: 'Houses, apartments, land and commercial properties for sale.' },
  rent: { preset: { purpose: 'rent' }, title: 'Properties for Rent', description: 'Homes, apartments, offices and shops available to rent.' },
  residential: { preset: { group: 'residential' }, title: 'Houses and Apartments', description: 'Family homes, villas and apartments for sale and rent.' },
  land: { preset: { group: 'land' }, title: 'Land and Plots', description: 'Residential and commercial land with clear titles.' },
  commercial: { preset: { group: 'commercial' }, title: 'Commercial Properties', description: 'Offices, shops, warehouses and commercial buildings.' },
};

export default function Properties({ variant = 'all' }) {
  const { preset, title, description } = LISTING_PRESETS[variant];
  const [searchParams, setSearchParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  useSeo({ title, description });

  const query = { ...Object.fromEntries(searchParams.entries()), ...preset, limit: 12 };
  const page = Number(searchParams.get('page') ?? 1);
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['properties', query],
    queryFn: () => publicApi.properties(query),
    placeholderData: keepPreviousData,
  });

  const update = (next) => {
    const params = new URLSearchParams(next);
    params.delete('page');
    if (searchParams.get('sort')) params.set('sort', searchParams.get('sort'));
    setSearchParams(params);
  };
  const removeFilter = (key) => {
    const params = new URLSearchParams(searchParams);
    params.delete(key);
    params.delete('page');
    setSearchParams(params);
  };
  const setSort = (sort) => {
    const params = new URLSearchParams(searchParams);
    if (sort && sort !== 'recommended') params.set('sort', sort);
    else params.delete('sort');
    params.delete('page');
    setSearchParams(params);
  };
  const setPage = (p) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', String(p));
    setSearchParams(params);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const total = data?.meta?.total ?? 0;

  return (
    <>
      <PageHero title={title} description={description} eyebrow="Properties" />
      <div className="container-page py-8">
        <AdSlot placement="listing_page" className="mb-8" />
        <div className="grid gap-8 lg:grid-cols-[290px_1fr]">
          <aside className="space-y-6">
            <div className="lg:hidden">
              <Button variant="outline" className="w-full" onClick={() => setFiltersOpen((v) => !v)} aria-expanded={filtersOpen} aria-controls="filter-panel">
                <SlidersHorizontal /> {filtersOpen ? 'Hide filters' : 'Show filters'}
              </Button>
            </div>
            <div id="filter-panel" className={`${filtersOpen ? 'block' : 'hidden'} rounded-xl border bg-card p-5 shadow-sm lg:block`}>
              <h2 className="mb-4 font-semibold">Filter properties</h2>
              <FilterPanel searchParams={searchParams} onApply={update} preset={preset} onClose={() => setFiltersOpen(false)} />
            </div>
            <AdSlot placement="sidebar" variant="card" className="hidden lg:block" />
          </aside>

          <section aria-live="polite" aria-busy={isFetching}>
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {isLoading ? 'Searching…' : <><strong className="text-foreground">{total}</strong> propert{total === 1 ? 'y' : 'ies'} found</>}
              </p>
              <label className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Sort by</span>
                <Select className="w-48" value={searchParams.get('sort') ?? 'recommended'} onChange={(e) => setSort(e.target.value)}>
                  {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              </label>
            </div>
            <ActiveFilters searchParams={searchParams} onRemove={removeFilter} onClear={() => setSearchParams({})} />
            <div className="mt-5">
              {error ? (
                <ErrorState error={error} onRetry={refetch} />
              ) : !isLoading && !data?.data?.length ? (
                <EmptyState
                  icon={SearchX}
                  title="No properties match your search"
                  description="Try removing some filters, or contact us — new listings arrive every week."
                  action={<Button variant="outline" onClick={() => setSearchParams({})}>Clear all filters</Button>}
                />
              ) : (
                <PropertyGrid
                  properties={data?.data ?? []}
                  loading={isLoading}
                  className="lg:grid-cols-2 xl:grid-cols-3"
                  insert={<AdSlot placement="in_content" variant="card" />}
                  insertAfter={6}
                />
              )}
            </div>
            <div className="mt-10">
              <Pagination page={page} totalPages={data?.meta?.totalPages} onPageChange={setPage} />
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
