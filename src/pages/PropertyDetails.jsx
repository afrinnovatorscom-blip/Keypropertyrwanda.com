import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { SectionHeading } from '@/components/layout/Section';
import { PropertyDetailsView } from '@/components/property/PropertyDetailsView';
import { PropertyGrid } from '@/components/property/PropertyCard';
import { AdSlot } from '@/components/promotions/AdSlot';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/feedback';
import { useSiteConfig } from '@/hooks/useSiteConfig';
import { formatPrice } from '@/lib/format';
import { useSeo } from '@/lib/seo';
import { publicApi } from '@/services/publicApi';
import NotFound from './NotFound';

export default function PropertyDetails() {
  const { slug } = useParams();
  const { settings } = useSiteConfig();
  const { data: property, isLoading, error } = useQuery({
    queryKey: ['property', slug],
    queryFn: () => publicApi.property(slug),
    retry: (count, err) => err?.status !== 404 && count < 2,
  });

  useSeo({
    title: property ? `${property.title} — ${formatPrice(property)}` : 'Property',
    description: property?.description?.slice(0, 160),
    image: property?.mainImage,
    jsonLd: property?.structuredData,
  });

  if (isLoading) {
    return (
      <div className="container-page grid gap-8 py-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <Skeleton className="aspect-[16/10] w-full rounded-xl" />
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-6 w-1/3" />
        </div>
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }
  if (error?.status === 404) return <NotFound message="This property is no longer available. It may have been sold, rented or withdrawn." />;
  if (error) {
    return (
      <div className="container-page py-16 text-center">
        <p className="mb-4">We could not load this property.</p>
        <Button asChild><Link to="/properties">Browse properties</Link></Button>
      </div>
    );
  }

  return (
    <>
      <PropertyDetailsView
        property={property}
        settings={settings}
        detailsAd={<AdSlot placement="details_page" />}
        sidebarAd={<AdSlot placement="sidebar" variant="card" />}
      />
      {property.related?.length > 0 && (
        <section className="container-page pb-6 pt-4" aria-labelledby="related-title">
          <SectionHeading title={<span id="related-title">Similar properties</span>} link={`/properties?category=${property.category.slug}`} />
          <PropertyGrid properties={property.related} className="lg:grid-cols-4" />
        </section>
      )}
    </>
  );
}
