import { Bath, BedDouble, Flame, MapPin, Ruler, Star } from 'lucide-react';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { useInView } from '@/hooks/useInView';
import { trackCampaignClick, trackCampaignView } from '@/lib/analytics';
import { formatArea, formatPrice, label } from '@/lib/format';
import { cn } from '@/lib/utils';

export function PropertyCard({ property, className }) {
  const [ref, inView] = useInView({ threshold: 0.5 });
  const { featuredId } = property;

  useEffect(() => {
    if (inView && featuredId) trackCampaignView('featured', featuredId);
  }, [inView, featuredId]);

  const size = formatArea(property.propertySize ?? property.landSize);
  const location = [property.neighborhood, property.district].filter(Boolean).join(', ');

  return (
    <article ref={ref} className={cn('group overflow-hidden rounded-xl border bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-md', className)}>
      <Link
        to={`/property/${property.slug}`}
        className="block focus-visible:outline-none"
        onClick={() => featuredId && trackCampaignClick('featured', featuredId)}
      >
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          {property.mainImage ? (
            <img src={property.mainImage} alt={property.title} loading="lazy" className="size-full object-cover transition duration-300 group-hover:scale-105" />
          ) : (
            <div className="flex size-full items-center justify-center text-sm text-muted-foreground">No photo yet</div>
          )}
          <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
            <Badge variant={property.purpose === 'rent' ? 'info' : 'default'}>{label('purpose', property.purpose)}</Badge>
            {property.isFeatured && (
              <Badge variant="accent"><Star className="fill-current" /> Featured</Badge>
            )}
            {property.hasHotDeal && (
              <Badge variant="hot"><Flame /> Hot deal</Badge>
            )}
          </div>
          {property.availabilityStatus && property.availabilityStatus !== 'available' && (
            <StatusBadge status={property.availabilityStatus} className="absolute right-3 top-3">
              {label('availability', property.availabilityStatus)}
            </StatusBadge>
          )}
        </div>
        <div className="space-y-2 p-4">
          <p className="text-lg font-bold text-primary">{formatPrice(property)}</p>
          <h3 className="line-clamp-2 font-semibold leading-snug group-hover:text-primary">{property.title}</h3>
          {location && (
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="size-3.5 shrink-0" /> {location}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-3 text-sm text-muted-foreground">
            {property.bedrooms != null && (
              <span className="flex items-center gap-1"><BedDouble className="size-4" /> {property.bedrooms} bd</span>
            )}
            {property.bathrooms != null && (
              <span className="flex items-center gap-1"><Bath className="size-4" /> {property.bathrooms} ba</span>
            )}
            {size && <span className="flex items-center gap-1"><Ruler className="size-4" /> {size}</span>}
            <span className="ml-auto text-xs">{property.category?.name}</span>
          </div>
        </div>
      </Link>
    </article>
  );
}

export function PropertyCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="aspect-[4/3] animate-pulse bg-muted" />
      <div className="space-y-3 p-4">
        <div className="h-5 w-1/3 animate-pulse rounded bg-muted" />
        <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}

/** Responsive grid; optionally injects an element (e.g. an in-content advert) after N cards. */
export function PropertyGrid({ properties, loading, skeletonCount = 6, insert, insertAfter = 6, className }) {
  if (loading) {
    return (
      <div className={cn('grid gap-6 sm:grid-cols-2 lg:grid-cols-3', className)}>
        {Array.from({ length: skeletonCount }, (_, i) => <PropertyCardSkeleton key={i} />)}
      </div>
    );
  }
  return (
    <div className={cn('grid gap-6 sm:grid-cols-2 lg:grid-cols-3', className)}>
      {properties.map((p, i) => (
        <PropertyGridItem key={p.id} property={p} insert={insert && i === Math.min(insertAfter, properties.length) - 1 ? insert : null} />
      ))}
    </div>
  );
}

function PropertyGridItem({ property, insert }) {
  return (
    <>
      <PropertyCard property={property} />
      {insert}
    </>
  );
}
