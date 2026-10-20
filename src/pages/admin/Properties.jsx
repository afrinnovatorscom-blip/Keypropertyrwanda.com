import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Archive, Download, Eye, EyeOff, Pencil, Plus, RotateCcw, Send } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AdminPage, ConfirmButton, FilterBar, TableCard, useAdminMutation } from '@/components/admin/AdminUi';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, Spinner } from '@/components/ui/feedback';
import { Input, Select } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import { useDebounce } from '@/hooks/useDebounce';
import { downloadUrl } from '@/lib/api';
import { formatDate, formatPrice, label, LABELS } from '@/lib/format';
import { compact } from '@/lib/utils';
import { adminApi } from '@/services/adminApi';

export default function AdminProperties() {
  const { can } = useAuth();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('q') ?? '');
  const q = useDebounce(search);
  const filters = compact({
    q,
    publicationStatus: params.get('publicationStatus'),
    availability: params.get('availability'),
    purpose: params.get('purpose'),
    categoryId: params.get('categoryId'),
    includeArchived: params.get('publicationStatus') === 'archived' ? undefined : params.get('includeArchived'),
    page: params.get('page') ?? 1,
    limit: 20,
  });
  const setFilter = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page');
    setParams(next);
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'properties', filters],
    queryFn: () => adminApi.properties.list(filters),
    placeholderData: keepPreviousData,
  });
  const { data: categories = [] } = useQuery({ queryKey: ['admin', 'categories'], queryFn: adminApi.categories.list });

  const action = useAdminMutation(({ id, name }) => adminApi.properties.action(id, name), {
    success: (_d, { name }) => ({ publish: 'Property published', unpublish: 'Property unpublished', archive: 'Property archived', restore: 'Property restored' })[name],
    invalidate: [['admin', 'properties'], ['admin', 'dashboard']],
  });

  return (
    <AdminPage
      title="Properties"
      description="Create, publish and manage property listings. Publication is separate from availability."
      actions={
        <>
          {can('properties.export') && (
            <Button asChild variant="outline"><a href={downloadUrl('/admin/properties/export', compact({ ...filters, page: undefined, limit: undefined }))}><Download /> Export CSV</a></Button>
          )}
          {can('properties.create') && <Button asChild><Link to="/admin/properties/new"><Plus /> New property</Link></Button>}
        </>
      }
    >
      <FilterBar>
        <Input className="sm:w-64" placeholder="Search title, reference, location…" value={search} onChange={(e) => { setSearch(e.target.value); setFilter('page', ''); }} aria-label="Search properties" />
        <Select className="sm:w-44" value={params.get('publicationStatus') ?? ''} onChange={(e) => setFilter('publicationStatus', e.target.value)} aria-label="Publication status">
          <option value="">All (not archived)</option>
          {Object.entries(LABELS.publication).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
        <Select className="sm:w-40" value={params.get('availability') ?? ''} onChange={(e) => setFilter('availability', e.target.value)} aria-label="Availability">
          <option value="">Any availability</option>
          {Object.entries(LABELS.availability).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
        <Select className="sm:w-36" value={params.get('purpose') ?? ''} onChange={(e) => setFilter('purpose', e.target.value)} aria-label="Purpose">
          <option value="">Sale & rent</option>
          <option value="sale">For sale</option>
          <option value="rent">For rent</option>
        </Select>
        <Select className="sm:w-48" value={params.get('categoryId') ?? ''} onChange={(e) => setFilter('categoryId', e.target.value)} aria-label="Category">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </FilterBar>

      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isLoading ? (
        <Spinner />
      ) : !data.data.length ? (
        <EmptyState title="No properties found" description="Adjust the filters or create a new listing." />
      ) : (
        <TableCard footer={<Pagination page={data.meta.page} totalPages={data.meta.totalPages} onPageChange={(p) => setFilter('page', String(p))} />}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Property</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Publication</TableHead>
                <TableHead>Availability</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.data.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {p.mainImage ? <img src={p.mainImage} alt="" className="h-12 w-16 shrink-0 rounded object-cover" /> : <div className="h-12 w-16 shrink-0 rounded bg-muted" />}
                      <div className="min-w-0">
                        <Link to={`/admin/properties/${p.id}`} className="line-clamp-1 font-medium hover:text-primary">{p.title}</Link>
                        <p className="text-xs text-muted-foreground">{p.reference} · {p.category.name} · {p.district} · {p.imageCount} photo{p.imageCount === 1 ? '' : 's'}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{formatPrice(p)}<p className="text-xs text-muted-foreground">{label('purpose', p.purpose)}</p></TableCell>
                  <TableCell><StatusBadge status={p.publicationStatus}>{label('publication', p.publicationStatus)}</StatusBadge></TableCell>
                  <TableCell><StatusBadge status={p.availabilityStatus}>{label('availability', p.availabilityStatus)}</StatusBadge></TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(p.updatedAt)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1.5">
                      <Button asChild variant="ghost" size="sm" title="Edit"><Link to={`/admin/properties/${p.id}`}><Pencil /><span className="sr-only">Edit</span></Link></Button>
                      <Button asChild variant="ghost" size="sm" title="Preview"><Link to={`/admin/properties/${p.id}/preview`}><Eye /><span className="sr-only">Preview</span></Link></Button>
                      {can('properties.publish') && p.publicationStatus !== 'published' && p.publicationStatus !== 'archived' && (
                        <Button size="sm" variant="outline" disabled={action.isPending} onClick={() => action.mutate({ id: p.id, name: 'publish' })}><Send /> Publish</Button>
                      )}
                      {can('properties.publish') && p.publicationStatus === 'published' && (
                        <Button size="sm" variant="outline" disabled={action.isPending} onClick={() => action.mutate({ id: p.id, name: 'unpublish' })}><EyeOff /> Unpublish</Button>
                      )}
                      {can('properties.archive') && p.publicationStatus !== 'archived' && (
                        <ConfirmButton title="Archive this property?" description="It will be removed from the website, running hot deals will end and featured placements will be deactivated. Inquiry and campaign history is kept." confirmLabel="Archive" onConfirm={() => action.mutate({ id: p.id, name: 'archive' })}>
                          <Archive /><span className="sr-only">Archive</span>
                        </ConfirmButton>
                      )}
                      {can('properties.archive') && p.publicationStatus === 'archived' && (
                        <Button size="sm" variant="outline" onClick={() => action.mutate({ id: p.id, name: 'restore' })}><RotateCcw /> Restore</Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      )}
    </AdminPage>
  );
}
