import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Flame } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageHero } from '@/components/layout/Section';
import { PropertyCardSkeleton } from '@/components/property/PropertyCard';
import { HotDealCard } from '@/components/promotions/HotDealCard';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState } from '@/components/ui/feedback';
import { Pagination } from '@/components/ui/pagination';
import { useSeo } from '@/lib/seo';
import { publicApi } from '@/services/publicApi';

export default function HotDeals() {
  useSeo({ title: 'Hot Deals', description: 'Limited-time property offers in Rwanda from Key Property Rwanda.' });
  const [params, setParams] = useSearchParams();
  const page = Number(params.get('page') ?? 1);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['hot-deals', { page }],
    queryFn: () => publicApi.hotDeals({ page, limit: 12 }),
    placeholderData: keepPreviousData,
  });
  const deals = data?.data ?? [];

  return (
    <>
      <PageHero eyebrow="Limited time" title="Hot Deals" description="Special prices on selected properties. Offers end on the dates shown and only while the property remains available." />
      <div className="container-page py-10">
        {error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 3 }, (_, i) => <PropertyCardSkeleton key={i} />)}</div>
        ) : !deals.length ? (
          <EmptyState icon={Flame} title="No hot deals at the moment" description="Check back soon, or browse all available properties." action={<Button asChild><Link to="/properties">Browse properties</Link></Button>} />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{deals.map((d) => <HotDealCard key={d.id} deal={d} />)}</div>
        )}
        <div className="mt-10">
          <Pagination page={page} totalPages={data?.meta?.totalPages} onPageChange={(p) => setParams({ page: String(p) })} />
        </div>
        <p className="mt-8 text-center text-xs text-muted-foreground">
          Strike-through prices are shown only where our team has verified the original asking price.
        </p>
      </div>
    </>
  );
}
