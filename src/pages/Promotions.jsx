import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CalendarDays, Megaphone } from 'lucide-react';
import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PageHero, RichText } from '@/components/layout/Section';
import { PropertyGrid } from '@/components/property/PropertyCard';
import { PromotionCard } from '@/components/promotions/PromotionCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { trackCampaignClick, trackCampaignView } from '@/lib/analytics';
import { formatDate, label } from '@/lib/format';
import { useSeo } from '@/lib/seo';
import { publicApi } from '@/services/publicApi';
import NotFound from './NotFound';

export default function Promotions() {
  useSeo({ title: 'Promotions', description: 'Current property campaigns and promotions from Key Property Rwanda.' });
  const { data = [], isLoading, error, refetch } = useQuery({ queryKey: ['promotions', 'all'], queryFn: () => publicApi.promotions() });

  return (
    <>
      <PageHero eyebrow="Campaigns" title="Promotions" description="Seasonal campaigns, category specials and curated collections running now." />
      <div className="container-page py-10">
        {error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : isLoading ? (
          <div className="grid gap-6 md:grid-cols-2">{[0, 1].map((i) => <Skeleton key={i} className="h-72 rounded-xl" />)}</div>
        ) : !data.length ? (
          <EmptyState icon={Megaphone} title="No promotions running right now" description="See our hot deals and featured properties in the meantime." action={<Button asChild><Link to="/hot-deals">View hot deals</Link></Button>} />
        ) : (
          <div className="grid gap-6 md:grid-cols-2">{data.map((p) => <PromotionCard key={p.id} promotion={p} />)}</div>
        )}
      </div>
    </>
  );
}

export function PromotionDetails() {
  const { slug } = useParams();
  const { data: promotion, isLoading, error } = useQuery({
    queryKey: ['promotion', slug],
    queryFn: () => publicApi.promotion(slug),
    retry: (count, err) => err?.status !== 404 && count < 2,
  });
  useSeo({ title: promotion?.name ?? 'Promotion', description: promotion?.description?.slice(0, 160), image: promotion?.bannerImage });
  useEffect(() => {
    if (promotion?.id) trackCampaignView('promotion', promotion.id);
  }, [promotion?.id]);

  if (isLoading) return <div className="container-page py-10"><Skeleton className="h-64 rounded-xl" /></div>;
  if (error?.status === 404) return <NotFound message="This promotion has ended or is no longer available." />;
  if (error) return <div className="container-page py-10"><ErrorState error={error} /></div>;

  const external = promotion.destinationUrl && /^https?:\/\//i.test(promotion.destinationUrl);
  return (
    <>
      <section className="relative overflow-hidden bg-primary text-white">
        {promotion.bannerImage && <img src={promotion.bannerImage} alt="" className="absolute inset-0 size-full object-cover opacity-35" />}
        <div className="container-page relative py-14 sm:py-20">
          <Badge variant="accent" className="mb-3">{label('campaignType', promotion.campaignType)}</Badge>
          <h1 className="text-3xl font-bold sm:text-4xl">{promotion.name}</h1>
          <p className="mt-3 flex items-center gap-2 text-white/85">
            <CalendarDays className="size-4" />
            {promotion.endAt ? `${formatDate(promotion.startAt)} – ${formatDate(promotion.endAt)}` : `From ${formatDate(promotion.startAt)}`}
          </p>
        </div>
      </section>
      <div className="container-page space-y-10 py-10">
        {promotion.description && <RichText text={promotion.description} className="max-w-3xl text-foreground/90" />}
        {promotion.destinationUrl && (
          <Button asChild size="lg" onClick={() => trackCampaignClick('promotion', promotion.id)}>
            {external ? (
              <a href={promotion.destinationUrl} target="_blank" rel="noopener noreferrer">Find out more <ArrowRight /></a>
            ) : (
              <Link to={promotion.destinationUrl}>Find out more <ArrowRight /></Link>
            )}
          </Button>
        )}
        {promotion.properties?.length > 0 ? (
          <section aria-labelledby="promo-props">
            <h2 id="promo-props" className="mb-5 text-xl font-semibold">Properties in this promotion</h2>
            <div onClickCapture={() => trackCampaignClick('promotion', promotion.id)}>
              <PropertyGrid properties={promotion.properties} />
            </div>
          </section>
        ) : (
          <EmptyState title="Properties for this campaign are being updated" description="Contact us for the latest available options." action={<Button asChild variant="outline"><Link to="/contact">Contact us</Link></Button>} />
        )}
      </div>
    </>
  );
}
