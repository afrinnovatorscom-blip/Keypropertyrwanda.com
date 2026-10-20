import { Clock, Mail, MapPin, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSiteConfig } from '@/hooks/useSiteConfig';
import { FacebookIcon, InstagramIcon, LinkedInIcon, XIcon } from './BrandIcons';
import { PROPERTY_LINKS } from './Header';
import { Logo } from './Logo';

const SOCIAL = [
  { key: 'facebook_url', label: 'Facebook', Icon: FacebookIcon },
  { key: 'instagram_url', label: 'Instagram', Icon: InstagramIcon },
  { key: 'x_url', label: 'X', Icon: XIcon },
  { key: 'linkedin_url', label: 'LinkedIn', Icon: LinkedInIcon },
];

export function Footer() {
  const { settings } = useSiteConfig();
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 bg-[#0b3742] text-white/80">
      <div className="container-page grid gap-10 py-12 md:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-4">
          <Logo light />
          <p className="text-sm leading-relaxed">{settings.tagline || 'Your key to property in Rwanda.'}</p>
          <div className="flex gap-3">
            {SOCIAL.filter((s) => settings[s.key]).map(({ key, label, Icon }) => (
              <a key={key} href={settings[key]} target="_blank" rel="noopener noreferrer" aria-label={label} className="rounded-full bg-white/10 p-2 transition hover:bg-accent hover:text-accent-foreground">
                <Icon className="size-4" />
              </a>
            ))}
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white">Properties</h2>
          <ul className="space-y-2 text-sm">
            {PROPERTY_LINKS.map((l) => (
              <li key={l.to}><Link to={l.to} className="hover:text-accent">{l.label}</Link></li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white">Company</h2>
          <ul className="space-y-2 text-sm">
            <li><Link to="/featured" className="hover:text-accent">Featured properties</Link></li>
            <li><Link to="/hot-deals" className="hover:text-accent">Hot deals</Link></li>
            <li><Link to="/promotions" className="hover:text-accent">Promotions</Link></li>
            <li><Link to="/about" className="hover:text-accent">About us</Link></li>
            <li><Link to="/contact" className="hover:text-accent">Contact us</Link></li>
          </ul>
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white">Get in touch</h2>
          <ul className="space-y-3 text-sm">
            {settings.address && <li className="flex gap-2"><MapPin className="mt-0.5 size-4 shrink-0 text-accent" />{settings.address}</li>}
            {settings.phone && <li className="flex gap-2"><Phone className="mt-0.5 size-4 shrink-0 text-accent" /><a href={`tel:${settings.phone.replace(/\s/g, '')}`} className="hover:text-accent">{settings.phone}</a></li>}
            {settings.email && <li className="flex gap-2"><Mail className="mt-0.5 size-4 shrink-0 text-accent" /><a href={`mailto:${settings.email}`} className="hover:text-accent">{settings.email}</a></li>}
            {settings.office_hours && <li className="flex gap-2"><Clock className="mt-0.5 size-4 shrink-0 text-accent" />{settings.office_hours}</li>}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-2 py-5 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} {settings.company_name || 'Key Property Rwanda'}. All rights reserved.</p>
          <div className="flex gap-4">
            <Link to="/privacy-policy" className="hover:text-accent">Privacy Policy</Link>
            <Link to="/terms-and-conditions" className="hover:text-accent">Terms and Conditions</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
