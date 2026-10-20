import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Eye } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { PropertyDetailsView } from '@/components/property/PropertyDetailsView';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ErrorState, Spinner } from '@/components/ui/feedback';
import { useSiteConfig } from '@/hooks/useSiteConfig';
import { label } from '@/lib/format';
import { adminApi } from '@/services/adminApi';

/** Renders any property (including drafts) exactly as the public page would. */
export default function PropertyPreview() {
  const { id } = useParams();
  const { settings } = useSiteConfig();
  const { data: property, isLoading, error } = useQuery({ queryKey: ['admin', 'property', id], queryFn: () => adminApi.properties.get(id) });

  if (isLoading) return <Spinner />;
  if (error) return <ErrorState error={error} />;

  return (
    <div className="-m-4 sm:-m-6 lg:-m-8">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:px-6">
        <span className="flex items-center gap-2">
          <Eye className="size-4" /> <strong>Preview</strong> — this is how the listing will look. Current status:
          <StatusBadge status={property.publicationStatus}>{label('publication', property.publicationStatus)}</StatusBadge>
        </span>
        <Button asChild size="sm" variant="outline"><Link to={`/admin/properties/${id}`}><ArrowLeft /> Back to editor</Link></Button>
      </div>
      <div className="bg-background">
        <PropertyDetailsView property={property} settings={settings} preview />
      </div>
    </div>
  );
}
