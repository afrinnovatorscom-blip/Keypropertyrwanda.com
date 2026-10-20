import { ChevronDown, Menu, Phone, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useSiteConfig } from '@/hooks/useSiteConfig';
import { cn } from '@/lib/utils';
import { Logo } from './Logo';

export const PROPERTY_LINKS = [
  { to: '/properties', label: 'All properties' },
  { to: '/properties/for-sale', label: 'For sale' },
  { to: '/properties/for-rent', label: 'For rent' },
  { to: '/properties/houses-apartments', label: 'Houses & apartments' },
  { to: '/properties/land-plots', label: 'Land & plots' },
  { to: '/properties/commercial', label: 'Commercial' },
];

const MAIN_LINKS = [
  { to: '/featured', label: 'Featured' },
  { to: '/hot-deals', label: 'Hot Deals' },
  { to: '/promotions', label: 'Promotions' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
];

const navClass = ({ isActive }) =>
  cn('rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-muted hover:text-primary', isActive ? 'text-primary' : 'text-foreground/80');

export function Header() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { settings } = useSiteConfig();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Logo />

        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          <NavLink to="/" end className={navClass}>Home</NavLink>
          <div className="group relative">
            <NavLink to="/properties" className={(s) => cn(navClass(s), 'inline-flex items-center gap-1')} aria-haspopup="true">
              Properties <ChevronDown className="size-3.5" />
            </NavLink>
            <div className="invisible absolute left-0 top-full z-50 w-56 rounded-lg border bg-popover p-1.5 opacity-0 shadow-lg transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
              {PROPERTY_LINKS.map((l) => (
                <Link key={l.to} to={l.to} className="block rounded-md px-3 py-2 text-sm hover:bg-muted">
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
          {MAIN_LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} className={navClass}>
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {settings.phone && (
            <Button asChild variant="accent" size="sm" className="hidden sm:inline-flex">
              <a href={`tel:${settings.phone.replace(/\s/g, '')}`}>
                <Phone /> {settings.phone}
              </a>
            </Button>
          )}
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls="mobile-nav" aria-label={open ? 'Close menu' : 'Open menu'}>
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>
      </div>

      {open && (
        <nav id="mobile-nav" aria-label="Mobile" className="border-t bg-background lg:hidden">
          <div className="container-page grid gap-1 py-3">
            <NavLink to="/" end className={navClass}>Home</NavLink>
            <p className="px-3 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Properties</p>
            {PROPERTY_LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} end className={navClass}>
                {l.label}
              </NavLink>
            ))}
            <p className="px-3 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Explore</p>
            {MAIN_LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} className={navClass}>
                {l.label}
              </NavLink>
            ))}
            {settings.phone && (
              <Button asChild variant="accent" className="mt-2">
                <a href={`tel:${settings.phone.replace(/\s/g, '')}`}>
                  <Phone /> Call {settings.phone}
                </a>
              </Button>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
