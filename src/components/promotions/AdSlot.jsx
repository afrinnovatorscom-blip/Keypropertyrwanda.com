import { useQuery } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useInView } from '@/hooks/useInView';
import { trackAdClick, trackAdImpression } from '@/lib/analytics';
import { cn } from '@/lib/utils';
import { publicApi } from '@/services/publicApi';

/**
 * Presentational advert. Always carries a visible "Advertisement" label so it
 * cannot be mistaken for an ordinary property listing.
 */
export function AdBanner({ ad, variant = 'banner', onClick, className, innerRef }) {
  const href = ad.destinationUrl;
  const external = ad.isExternal ?? /^https?:\/\//i.test(href ?? '');
  const content = (
    <div className={cn('relative overflow-hidden rounded-xl border-2 border-dashed border-accent/60 bg-gradient-to-r from-amber-50 to-white', className)}>
      <span className="absolute left-2 top-2 z-10 rounded bg-black/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
        Advertisement
      </span>
      {variant === 'card' ? (
        <div>
          {ad.desktopImage && <img src={ad.desktopImage} alt="" loading="lazy" className="aspect-[16/9] w-full object-cover" />}
          <div className="space-y-1 p-4">
            <p className="font-semibold">{ad.headline}</p>
            {ad.description && <p className="text-sm text-muted-foreground">{ad.description}</p>}
            {href && <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">Learn more {external && <ExternalLink className="size-3.5" />}</span>}
          </div>
        </div>
      ) : (
        <div className="grid items-center sm:grid-cols-[1.2fr_1fr]">
          <picture className="block">
            {ad.mobileImage && <source media="(max-width: 640px)" srcSet={ad.mobileImage} />}
            {ad.desktopImage && <img src={ad.desktopImage} alt="" loading="lazy" className="aspect-[16/5] size-full object-cover sm:aspect-auto sm:h-48" />}
          </picture>
          <div className="space-y-1.5 p-5">
            <p className="text-lg font-bold text-primary">{ad.headline}</p>
            {ad.description && <p className="text-sm text-muted-foreground">{ad.description}</p>}
            {href && <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">Learn more {external && <ExternalLink className="size-3.5" />}</span>}
          </div>
        </div>
      )}
    </div>
  );

  if (!href) return <div ref={innerRef}>{content}</div>;
  if (external) {
    return (
      <a ref={innerRef} href={href} target="_blank" rel="noopener noreferrer sponsored" onClick={onClick} className="block">
        {content}
      </a>
    );
  }
  return (
    <Link ref={innerRef} to={href} onClick={onClick} className="block">
      {content}
    </Link>
  );
}

function TrackedAd({ ad, variant, className }) {
  const [ref, inView] = useInView({ threshold: 0.5 });
  useEffect(() => {
    if (inView) trackAdImpression(ad.id);
  }, [inView, ad.id]);
  return <AdBanner ad={ad} variant={variant} className={className} innerRef={ref} onClick={() => trackAdClick(ad.id)} />;
}

/** Fetches and renders live adverts for a placement. Renders nothing when none are scheduled. */
export function AdSlot({ placement, variant = 'banner', limit = 1, className, itemClassName }) {
  const { data } = useQuery({
    queryKey: ['ads', placement],
    queryFn: () => publicApi.advertisements(placement),
    staleTime: 60 * 1000,
  });
  const ads = (data ?? []).slice(0, limit);
  if (!ads.length) return null;
  return (
    <aside aria-label="Advertisement" className={cn('space-y-4', className)}>
      {ads.map((ad) => (
        <TrackedAd key={ad.id} ad={ad} variant={variant} className={itemClassName} />
      ))}
    </aside>
  );
}
