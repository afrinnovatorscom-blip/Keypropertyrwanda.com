import { Compass } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useSeo } from '@/lib/seo';

export default function NotFound({ message = 'The page you are looking for does not exist or has moved.' }) {
  useSeo({ title: 'Page not found', noindex: true });
  return (
    <div className="container-page flex flex-col items-center py-24 text-center">
      <Compass className="mb-4 size-14 text-accent" aria-hidden="true" />
      <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Error 404</p>
      <h1 className="mt-2 text-3xl font-bold">We couldn’t find that page</h1>
      <p className="mt-3 max-w-md text-muted-foreground">{message}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button asChild><Link to="/properties">Browse properties</Link></Button>
        <Button asChild variant="outline"><Link to="/">Go to homepage</Link></Button>
      </div>
    </div>
  );
}
