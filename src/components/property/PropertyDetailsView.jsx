import { Bath, BedDouble, CalendarDays, Check, Flame, Hash, LandPlot, MapPin, Phone, Ruler, Star, Tag, Video } from 'lucide-react';
import { Link } from 'react-router-dom';
import { WhatsAppIcon } from '@/components/layout/BrandIcons';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatArea, formatDate, formatMoney, formatPrice, label, periodSuffix, timeLeft } from '@/lib/format';
import { propertyMessage, whatsappLink } from '@/lib/whatsapp';
import { InquiryForm } from './InquiryForm';
import { PropertyGallery } from './PropertyGallery';

/** Embeddable URL for YouTube / Vimeo links (other links are shown as plain links). */
function embedUrl(url) {
  if (!url) return null;
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return null;
}

function Description({ text }) {
  return (
    <div className="prose-content text-[15px] text-foreground/90">
      {String(text ?? '').split(/\n{2,}/).map((para, i) => <p key={i} className="whitespace-pre-line">{para}</p>)}
    </div>
  );
}

/**
 * Presentational property page, shared by the public details page and the
 * admin preview. `settings` provides contact numbers; `slots` renders adverts.
 */
export function PropertyDetailsView({ property, settings = {}, preview = false, detailsAd, sidebarAd }) {
  const location = [property.address, property.neighborhood, property.district, property.city].filter(Boolean).join(', ');
  const whatsappHref = property.whatsappUrl ?? whatsappLink(settings.whatsapp_number, propertyMessage(property));
  const deal = property.hotDeal;
  const video = embedUrl(property.videoUrl);
  const specs = [
    { icon: Hash, label: 'Reference', value: property.reference },
    { icon: Tag, label: 'Category', value: property.category?.name },
    property.bedrooms != null && { icon: BedDouble, label: 'Bedrooms', value: property.bedrooms },
    property.bathrooms != null && { icon: Bath, label: 'Bathrooms', value: property.bathrooms },
    property.propertySize && { icon: Ruler, label: 'Property size', value: formatArea(property.propertySize) },
    property.landSize && { icon: LandPlot, label: 'Land size', value: formatArea(property.landSize) },
    property.publishedAt && { icon: CalendarDays, label: 'Listed', value: formatDate(property.publishedAt) },
  ].filter(Boolean);

  return (
    <div className="container-page py-8">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-primary">Home</Link> /{' '}
        <Link to={property.purpose === 'rent' ? '/properties/for-rent' : '/properties/for-sale'} className="hover:text-primary">{label('purpose', property.purpose)}</Link> /{' '}
        <span className="text-foreground">{property.reference}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-8">
          <PropertyGallery images={property.images} title={property.title} />

          <header className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant={property.purpose === 'rent' ? 'info' : 'default'}>{label('purpose', property.purpose)}</Badge>
              <StatusBadge status={property.availabilityStatus}>{label('availability', property.availabilityStatus)}</StatusBadge>
              {property.isFeatured && <Badge variant="accent"><Star className="fill-current" /> Featured</Badge>}
              {deal && <Badge variant="hot"><Flame /> Hot deal</Badge>}
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{property.title}</h1>
            {location && <p className="flex items-start gap-1.5 text-muted-foreground"><MapPin className="mt-0.5 size-4 shrink-0" /> {location}</p>}
            <div className="flex flex-wrap items-baseline gap-3">
              {deal ? (
                <>
                  <span className="text-3xl font-bold text-red-700">{formatMoney(deal.promotionalPrice, deal.currency)}{periodSuffix(property.pricePeriod) && ` ${periodSuffix(property.pricePeriod)}`}</span>
                  {deal.originalPrice && <span className="text-lg text-muted-foreground line-through">{formatMoney(deal.originalPrice, deal.currency)}</span>}
                  <span className="text-sm text-muted-foreground">Listed price {formatPrice(property)}</span>
                </>
              ) : (
                <span className="text-3xl font-bold text-primary">{formatPrice(property)}</span>
              )}
            </div>
            {deal && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
                <strong>{deal.title}</strong> — {timeLeft(deal.endAt)} (until {formatDate(deal.endAt)}).
              </p>
            )}
          </header>

          <section aria-labelledby="specs-heading">
            <h2 id="specs-heading" className="mb-3 text-lg font-semibold">Key details</h2>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {specs.map((s) => (
                <div key={s.label} className="rounded-lg border bg-muted/40 p-3">
                  <dt className="flex items-center gap-1.5 text-xs text-muted-foreground"><s.icon className="size-3.5" /> {s.label}</dt>
                  <dd className="mt-1 font-semibold">{s.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section aria-labelledby="desc-heading">
            <h2 id="desc-heading" className="mb-3 text-lg font-semibold">Description</h2>
            <Description text={property.description} />
          </section>

          {property.amenities?.length > 0 && (
            <section aria-labelledby="amenities-heading">
              <h2 id="amenities-heading" className="mb-3 text-lg font-semibold">Amenities</h2>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {property.amenities.map((a) => (
                  <li key={a} className="flex items-center gap-2 text-sm"><Check className="size-4 text-success" /> {a}</li>
                ))}
              </ul>
            </section>
          )}

          {(property.videoUrl || property.virtualTourUrl) && (
            <section aria-labelledby="media-heading" className="space-y-3">
              <h2 id="media-heading" className="text-lg font-semibold">Video & virtual tour</h2>
              {video && (
                <div className="aspect-video overflow-hidden rounded-xl bg-black">
                  <iframe src={video} title={`${property.title} video`} className="size-full" allow="accelerometer; encrypted-media; picture-in-picture" allowFullScreen loading="lazy" />
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {property.videoUrl && !video && (
                  <Button asChild variant="outline"><a href={property.videoUrl} target="_blank" rel="noopener noreferrer"><Video /> Watch video</a></Button>
                )}
                {property.virtualTourUrl && (
                  <Button asChild variant="outline"><a href={property.virtualTourUrl} target="_blank" rel="noopener noreferrer"><Video /> Open virtual tour</a></Button>
                )}
              </div>
            </section>
          )}

          {detailsAd}
        </div>

        <aside className="space-y-5 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle as="h2">Interested in this property?</CardTitle>
              <p className="text-sm text-muted-foreground">Reference {property.reference}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {whatsappHref && (
                  <Button asChild variant="whatsapp">
                    <a href={whatsappHref} target="_blank" rel="noopener noreferrer"><WhatsAppIcon className="size-4" /> WhatsApp</a>
                  </Button>
                )}
                {settings.phone && (
                  <Button asChild variant="outline">
                    <a href={`tel:${settings.phone.replace(/\s/g, '')}`}><Phone /> Call</a>
                  </Button>
                )}
              </div>
              {preview ? (
                <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">The inquiry form is disabled in preview mode.</p>
              ) : (
                <InquiryForm property={property} hotDealId={deal?.id} source={deal ? 'hot_deal' : 'property_page'} compact />
              )}
            </CardContent>
          </Card>
          {sidebarAd}
        </aside>
      </div>
    </div>
  );
}
