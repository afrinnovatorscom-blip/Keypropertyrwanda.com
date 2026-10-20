import { CalendarClock, Flame, MapPin } from 'lucide-react';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { WhatsAppIcon } from '@/components/layout/BrandIcons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useInView } from '@/hooks/useInView';
import { trackCampaignClick, trackCampaignView } from '@/lib/analytics';
import { formatDate, formatMoney, periodSuffix, timeLeft } from '@/lib/format';

/** Hot deal card. Original price and discount are shown only when the server marked them verified. */
export function HotDealCard({ deal, preview = false }) {
  const [ref, inView] = useInView({ threshold: 0.5 });
  useEffect(() => {
    if (inView && !preview) trackCampaignView('hot_deal', deal.id);
  }, [inView, deal.id, preview]);

  const property = deal.property;
  const suffix = periodSuffix(property.pricePeriod);
  const location = [property.neighborhood, property.district].filter(Boolean).join(', ');
  const onClick = () => !preview && trackCampaignClick('hot_deal', deal.id);

  return (
    <article ref={ref} className="flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
      <Link to={`/property/${property.slug}`} onClick={onClick} className="relative block aspect-[4/3] bg-muted">
        {property.mainImage && <img src={property.mainImage} alt={property.title} loading="lazy" className="size-full object-cover" />}
        <Badge variant="hot" className="absolute left-3 top-3"><Flame /> Hot deal</Badge>
        {deal.discountPercentage ? (
          <span className="absolute right-3 top-3 rounded-full bg-accent px-3 py-1 text-sm font-bold text-accent-foreground shadow">
            −{Math.round(deal.discountPercentage)}%
          </span>
        ) : null}
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-sm font-semibold text-red-700">{deal.title}</p>
        <h3 className="line-clamp-2 font-semibold leading-snug">
          <Link to={`/property/${property.slug}`} onClick={onClick} className="hover:text-primary">{property.title}</Link>
        </h3>
        {location && <p className="flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="size-3.5" /> {location}</p>}
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-xl font-bold text-primary">{formatMoney(deal.promotionalPrice, deal.currency)}{suffix ? ` ${suffix}` : ''}</span>
          {deal.originalPrice ? (
            <span className="text-sm text-muted-foreground line-through" aria-label="Original price">
              {formatMoney(deal.originalPrice, deal.currency)}
            </span>
          ) : null}
        </div>
        {deal.discountAmount ? <p className="text-sm font-medium text-emerald-700">You save {formatMoney(deal.discountAmount, deal.currency)}</p> : null}
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarClock className="size-3.5" /> {timeLeft(deal.endAt)} · until {formatDate(deal.endAt)}
        </p>
        <div className="mt-auto flex gap-2 pt-2">
          <Button asChild size="sm" className="flex-1">
            <Link to={`/property/${property.slug}`} onClick={onClick}>View property</Link>
          </Button>
          {deal.whatsappUrl && (
            <Button asChild size="sm" variant="whatsapp" className="flex-1">
              <a href={deal.whatsappUrl} target="_blank" rel="noopener noreferrer" onClick={onClick}>
                <WhatsAppIcon className="size-4" /> WhatsApp
              </a>
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
