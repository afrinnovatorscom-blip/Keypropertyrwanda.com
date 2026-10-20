import { useQuery } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHero } from '@/components/layout/Section';
import { PropertyGrid } from '@/components/property/PropertyCard';
import { AdSlot } from '@/components/promotions/AdSlot';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState } from '@/components/ui/feedback';
import { useSeo } from '@/lib/seo';
import { publicApi } from '@/services/publicApi';

export default function FeaturedProperties() {
  useSeo({ title: 'Featured Properties', description: 'Hand-picked featured properties from Key Property Rwanda.' });
  const { data = [], isLoading, error, refetch } = useQuery({ queryKey: ['featured', 48], queryFn: () => publicApi.featured(48) });

  return (
    <>
      <PageHero eyebrow="Hand-picked" title="Featured Properties" description="Our team’s current selection of standout homes, land and commercial spaces." />
      <div className="container-page space-y-8 py-10">
        {error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : !isLoading && !data.length ? (
          <EmptyState icon={Star} title="No featured properties right now" description="Browse all listings to see everything currently available." action={<Button asChild><Link to="/properties">Browse properties</Link></Button>} />
        ) : (
          <PropertyGrid properties={data} loading={isLoading} />
        )}
        <AdSlot placement="home_promo" />
      </div>
    </>
  );
}
