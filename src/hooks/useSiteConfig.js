import { useQuery } from '@tanstack/react-query';
import { publicApi } from '@/services/publicApi';

/** Public business settings + homepage content blocks (cached for the session). */
export function useSiteConfig() {
  const query = useQuery({ queryKey: ['site'], queryFn: publicApi.site, staleTime: 5 * 60 * 1000 });
  const settings = query.data?.settings ?? {};
  return { ...query, settings, content: query.data?.content ?? {} };
}
