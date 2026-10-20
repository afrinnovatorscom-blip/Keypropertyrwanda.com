import { useQuery } from '@tanstack/react-query';
import { Clock, Mail, MapPin, Phone } from 'lucide-react';
import { WhatsAppIcon } from '@/components/layout/BrandIcons';
import { PageHero } from '@/components/layout/Section';
import { InquiryForm } from '@/components/property/InquiryForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSiteConfig } from '@/hooks/useSiteConfig';
import { useSeo } from '@/lib/seo';
import { generalMessage, whatsappLink } from '@/lib/whatsapp';
import { publicApi } from '@/services/publicApi';

export default function Contact() {
  const { settings } = useSiteConfig();
  const { data: content } = useQuery({ queryKey: ['content', 'contact_page'], queryFn: () => publicApi.content('contact_page') });
  useSeo({ title: 'Contact Us', description: 'Call, email or WhatsApp Key Property Rwanda about buying, renting or listing a property.' });
  const wa = whatsappLink(settings.whatsapp_number, generalMessage);

  const items = [
    settings.phone && { icon: Phone, label: 'Phone', value: settings.phone, href: `tel:${settings.phone.replace(/\s/g, '')}` },
    settings.email && { icon: Mail, label: 'Email', value: settings.email, href: `mailto:${settings.email}` },
    settings.address && { icon: MapPin, label: 'Office', value: settings.address },
    settings.office_hours && { icon: Clock, label: 'Office hours', value: settings.office_hours },
  ].filter(Boolean);

  return (
    <>
      <PageHero eyebrow="Get in touch" title={content?.title ?? 'Contact us'} description={content?.body} />
      <div className="container-page grid gap-8 py-10 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-4">
          {items.map(({ icon: Icon, label, value, href }) => (
            <div key={label} className="flex gap-4 rounded-xl border bg-card p-5 shadow-sm">
              <span className="h-fit rounded-lg bg-secondary p-2.5 text-primary"><Icon className="size-5" /></span>
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                {href ? <a href={href} className="font-semibold hover:text-primary">{value}</a> : <p className="font-semibold">{value}</p>}
              </div>
            </div>
          ))}
          {wa && (
            <Button asChild variant="whatsapp" size="lg" className="w-full">
              <a href={wa} target="_blank" rel="noopener noreferrer"><WhatsAppIcon className="size-5" /> Chat on WhatsApp</a>
            </Button>
          )}
        </div>
        <Card>
          <CardHeader>
            <CardTitle as="h2" className="text-xl">Send us a message</CardTitle>
            <p className="text-sm text-muted-foreground">Ask about a property, request a viewing, or tell us about the property you want to sell or let.</p>
          </CardHeader>
          <CardContent>
            <InquiryForm source="contact_page" />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
