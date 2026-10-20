import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import ContentPage from './ContentPage';

export default function About() {
  return (
    <ContentPage contentKey="about_page" fallbackTitle="About Key Property Rwanda" eyebrow="About us">
      <div className="mt-10 flex flex-wrap gap-3 rounded-xl border bg-secondary/50 p-6">
        <p className="w-full font-semibold">Ready to start your property search?</p>
        <Button asChild><Link to="/properties">Browse properties</Link></Button>
        <Button asChild variant="outline"><Link to="/contact">Talk to our team</Link></Button>
      </div>
    </ContentPage>
  );
}
