import { ArrowRight, CalendarDays } from 'lucide-react';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { useInView } from '@/hooks/useInView';
import { trackCampaignClick, trackCampaignView } from '@/lib/analytics';
import { formatDate, label } from '@/lib/format';

export function PromotionCard({ promotion, preview = false }) {
  const [ref, inView] = useInView({ threshold: 0.5 });
  useEffect(() => {
    if (inView && !preview) trackCampaignView('promotion', promotion.id);
  }, [inView, promotion.id, preview]);

  return (
    <article ref={ref} className="group overflow-hidden rounded-xl border bg-card shadow-sm">
      <Link to={`/promotions/${promotion.slug}`} onClick={() => !preview && trackCampaignClick('promotion', promotion.id)} className="block">
        <div className="relative aspect-[16/6] overflow-hidden bg-primary">
          {promotion.bannerImage && <img src={promotion.bannerImage} alt="" loading="lazy" className="size-full object-cover transition duration-300 group-hover:scale-105" />}
          <Badge variant="accent" className="absolute left-3 top-3">{label('campaignType', promotion.campaignType)}</Badge>
        </div>
        <div className="space-y-2 p-5">
          <h3 className="text-lg font-bold group-hover:text-primary">{promotion.name}</h3>
          {promotion.description && <p className="line-clamp-2 text-sm text-muted-foreground">{promotion.description}</p>}
          <div className="flex items-center justify-between pt-1 text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <CalendarDays className="size-4" />
              {promotion.endAt ? `Until ${formatDate(promotion.endAt)}` : `From ${formatDate(promotion.startAt)}`}
            </span>
            <span className="inline-flex items-center gap-1 font-semibold text-primary">
              View offer <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}
