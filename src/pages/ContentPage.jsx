import { useQuery } from '@tanstack/react-query';
import { PageHero, RichText } from '@/components/layout/Section';
import { ErrorState, Skeleton } from '@/components/ui/feedback';
import { formatDate } from '@/lib/format';
import { useSeo } from '@/lib/seo';
import { publicApi } from '@/services/publicApi';

/** Generic page for admin-managed content (Privacy Policy, Terms and Conditions). */
export default function ContentPage({ contentKey, fallbackTitle, eyebrow, children }) {
  const { data, isLoading, error } = useQuery({ queryKey: ['content', contentKey], queryFn: () => publicApi.content(contentKey) });
  useSeo({ title: data?.title ?? fallbackTitle, description: data?.body?.slice(0, 160) });

  return (
    <>
      <PageHero eyebrow={eyebrow} title={data?.title ?? fallbackTitle} />
      <div className="container-page py-10">
        <div className="max-w-3xl">
          {isLoading ? (
            <div className="space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-5 w-full" />)}</div>
          ) : error ? (
            <ErrorState error={error} />
          ) : (
            <>
              <RichText text={data.body} className="text-foreground/90" />
              {data.updatedAt && <p className="mt-8 text-xs text-muted-foreground">Last updated {formatDate(data.updatedAt)}</p>}
            </>
          )}
          {children}
        </div>
      </div>
    </>
  );
}
