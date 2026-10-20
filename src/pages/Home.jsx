import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Building2, Home as HomeIcon, KeyRound, LandPlot, Mail, Phone, ShieldCheck, Store, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { WhatsAppIcon } from '@/components/layout/BrandIcons';
import { RichText, SectionHeading } from '@/components/layout/Section';
import { HeroSearch } from '@/components/property/HeroSearch';
import { PropertyGrid } from '@/components/property/PropertyCard';
import { AdSlot } from '@/components/promotions/AdSlot';
import { HeroCarousel } from '@/components/promotions/HeroCarousel';
import { HotDealCard } from '@/components/promotions/HotDealCard';
import { PromotionCard } from '@/components/promotions/PromotionCard';
import { Button } from '@/components/ui/button';
import { useSiteConfig } from '@/hooks/useSiteConfig';
import { useSeo } from '@/lib/seo';
import { generalMessage, whatsappLink } from '@/lib/whatsapp';
import { publicApi } from '@/services/publicApi';

const QUICK_LINKS = [
  { to: '/properties/houses-apartments', label: 'Houses & Apartments', icon: HomeIcon },
  { to: '/properties/land-plots', label: 'Land & Plots', icon: LandPlot },
  { to: '/properties/commercial', label: 'Commercial', icon: Store },
  { to: '/properties/for-rent', label: 'For Rent', icon: KeyRound },
];

const VALUES = [
  { icon: ShieldCheck, title: 'Verified listings', text: 'Every property is reviewed by our team before it is published.' },
  { icon: Users, title: 'Local experts', text: 'Agents who know Kigali neighbourhoods and districts across Rwanda.' },
  { icon: Building2, title: 'End-to-end support', text: 'Viewings, negotiation and paperwork handled with you.' },
];

export default function Home() {
  const { settings, content } = useSiteConfig();
  useSeo({
    title: 'Key Property Rwanda — Houses, Apartments, Land & Commercial Property in Rwanda',
    description: 'Find houses, apartments, land and commercial properties for sale and rent in Kigali and across Rwanda.',
  });

  const featured = useQuery({ queryKey: ['featured', 6], queryFn: () => publicApi.featured(6) });
  const latest = useQuery({ queryKey: ['properties', { sort: 'newest', limit: 6 }], queryFn: () => publicApi.properties({ sort: 'newest', limit: 6 }) });
  const deals = useQuery({ queryKey: ['hot-deals', { limit: 3 }], queryFn: () => publicApi.hotDeals({ limit: 3 }) });
  const promotions = useQuery({ queryKey: ['promotions', 'home'], queryFn: () => publicApi.promotions() });

  const { data: heroData } = useQuery({ queryKey: ['hero'], queryFn: publicApi.hero, staleTime: 60 * 1000 });
  const hero = content.home_hero ?? {};
  // Until the slides load, show the text-only hero so the page never jumps.
  const heroSlides = heroData?.slides?.length
    ? heroData.slides
    : [{ id: 0, title: hero.title || 'Find your key to the perfect property in Rwanda', subtitle: hero.body || 'Houses, apartments, land and commercial spaces for sale and rent.', overlayOpacity: 55, textAlign: 'left' }];
  const intro = content.home_intro ?? {};
  const cta = content.home_cta ?? {};
  const waHref = whatsappLink(settings.whatsapp_number, generalMessage);
  // Campaigns placed on the homepage first, then any other running campaign.
  const homepagePromos = [...(promotions.data ?? [])]
    .sort((a, b) => Number(b.placement === 'homepage') - Number(a.placement === 'homepage'))
    .slice(0, 2);

  return (
    <>
      <HeroCarousel slides={heroSlides} animation={heroData?.animation} intervalSeconds={heroData?.intervalSeconds}>
        <HeroSearch />
        <AdSlot placement="home_hero" className="mt-6" />
      </HeroCarousel>

      <section className="container-page py-10">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {QUICK_LINKS.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} className="group flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm transition hover:border-primary hover:shadow-md">
              <span className="rounded-lg bg-secondary p-2.5 text-primary group-hover:bg-primary group-hover:text-primary-foreground"><Icon className="size-5" /></span>
              <span className="text-sm font-semibold">{label}</span>
            </Link>
          ))}
        </div>
      </section>

      <AdSlot placement="mobile_banner" className="container-page mb-6 sm:hidden" />

      {(featured.isLoading || featured.data?.length > 0) && (
        <section className="container-page py-10" aria-labelledby="featured-title">
          <SectionHeading eyebrow="Hand-picked" title={<span id="featured-title">Featured Properties</span>} link="/featured" />
          <PropertyGrid properties={featured.data ?? []} loading={featured.isLoading} skeletonCount={3} />
        </section>
      )}

      <AdSlot placement="home_promo" className="container-page py-4" />

      {deals.data?.data?.length > 0 && (
        <section className="bg-red-50/60 py-12" aria-labelledby="deals-title">
          <div className="container-page">
            <SectionHeading eyebrow="Limited time" title={<span id="deals-title">Hot Deals</span>} description="Special offers on selected properties — while they last." link="/hot-deals" linkLabel="All hot deals" />
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {deals.data.data.map((deal) => <HotDealCard key={deal.id} deal={deal} />)}
            </div>
          </div>
        </section>
      )}

      <section className="container-page py-12" aria-labelledby="latest-title">
        <SectionHeading eyebrow="Just listed" title={<span id="latest-title">Latest Properties</span>} link="/properties?sort=newest" />
        <PropertyGrid
          properties={latest.data?.data ?? []}
          loading={latest.isLoading}
          insert={<AdSlot placement="in_content" variant="card" />}
          insertAfter={5}
        />
      </section>

      {homepagePromos.length > 0 && (
        <section className="container-page py-10" aria-labelledby="promos-title">
          <SectionHeading eyebrow="Campaigns" title={<span id="promos-title">Current Promotions</span>} link="/promotions" />
          <div className="grid gap-6 md:grid-cols-2">
            {homepagePromos.map((p) => <PromotionCard key={p.id} promotion={p} />)}
          </div>
        </section>
      )}

      <section className="bg-secondary/60 py-14" aria-labelledby="intro-title">
        <div className="container-page grid items-center gap-10 lg:grid-cols-2">
          <div>
            <p className="mb-1 text-sm font-semibold uppercase tracking-wider text-accent">About us</p>
            <h2 id="intro-title" className="text-2xl font-bold tracking-tight sm:text-3xl">{intro.title || 'Trusted real estate partners in Rwanda'}</h2>
            <RichText text={intro.body} className="mt-4 text-foreground/85" />
            <Button asChild variant="outline" className="mt-2">
              <Link to="/about">More about us <ArrowRight /></Link>
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
            {VALUES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex gap-4 rounded-xl border bg-card p-5 shadow-sm">
                <span className="h-fit rounded-lg bg-primary p-2.5 text-primary-foreground"><Icon className="size-5" /></span>
                <div>
                  <p className="font-semibold">{title}</p>
                  <p className="text-sm text-muted-foreground">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container-page py-14">
        <div className="hero-pattern flex flex-col items-start gap-6 rounded-2xl p-8 text-white sm:p-10 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <h2 className="text-2xl font-bold sm:text-3xl">{cta.title || 'Looking to buy, rent or list a property?'}</h2>
            <p className="mt-2 text-white/80">{cta.body || 'Talk to our team today.'}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {waHref && (
              <Button asChild size="lg" variant="whatsapp">
                <a href={waHref} target="_blank" rel="noopener noreferrer"><WhatsAppIcon className="size-5" /> WhatsApp</a>
              </Button>
            )}
            {settings.phone && (
              <Button asChild size="lg" variant="accent">
                <a href={`tel:${settings.phone.replace(/\s/g, '')}`}><Phone /> Call us</a>
              </Button>
            )}
            <Button asChild size="lg" variant="outline" className="border-white/40 bg-transparent text-white hover:bg-white/10">
              <Link to="/contact"><Mail /> Send a message</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
