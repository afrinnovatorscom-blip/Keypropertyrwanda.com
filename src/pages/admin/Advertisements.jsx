import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Archive, Eye, Pause, Pencil, Plus, RotateCcw, Send } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { AdminPage, ConfirmButton, FilterBar, TableCard, useAdminMutation } from '@/components/admin/AdminUi';
import { ImageUploadField } from '@/components/admin/ImageUploadField';
import { PropertyPicker } from '@/components/admin/PropertyPicker';
import { AdBanner } from '@/components/promotions/AdSlot';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState, ErrorState, Spinner } from '@/components/ui/feedback';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { Pagination } from '@/components/ui/pagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import { applyServerErrors } from '@/lib/api';
import { formatDateTime, fromDateTimeInput, label, LABELS, toDateTimeInput } from '@/lib/format';
import { adminApi } from '@/services/adminApi';

const img = (url, path) => (path ? { url, path } : null);

function AdDialog({ ad, placements, onClose }) {
  const { control, register, handleSubmit, setError, watch, formState: { errors } } = useForm({
    defaultValues: ad
      ? {
          internalName: ad.internalName, headline: ad.headline, description: ad.description ?? '', destinationUrl: ad.destinationUrl ?? '',
          property: ad.property, placementId: String(ad.placement.id), startAt: toDateTimeInput(ad.startAt), endAt: toDateTimeInput(ad.endAt),
          displayOrder: ad.displayOrder, desktop: img(ad.desktopImage, ad.desktopImagePath), mobile: img(ad.mobileImage, ad.mobileImagePath),
        }
      : { internalName: '', headline: '', description: '', destinationUrl: '', property: null, placementId: String(placements[0]?.id ?? ''), startAt: toDateTimeInput(new Date()), endAt: '', displayOrder: 0, desktop: null, mobile: null },
  });
  const save = useAdminMutation(
    ({ property, desktop, mobile, ...v }) => {
      const body = {
        ...v,
        propertyId: property?.id ?? null,
        desktopImage: desktop?.path ?? null,
        mobileImage: mobile?.path ?? null,
        displayOrder: Number(v.displayOrder) || 0,
        startAt: fromDateTimeInput(v.startAt),
        endAt: fromDateTimeInput(v.endAt),
      };
      return ad ? adminApi.advertisements.update(ad.id, body) : adminApi.advertisements.create(body);
    },
    {
      success: ad ? 'Advertisement updated' : 'Advertisement saved as draft',
      invalidate: [['admin', 'advertisements'], ['ads']],
      onSuccess: onClose,
      onError: (e) => applyServerErrors(e, setError),
    },
  );
  const v = watch();
  const preview = { id: 0, headline: v.headline || 'Headline', description: v.description, desktopImage: v.desktop?.url, mobileImage: v.mobile?.url, destinationUrl: null };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent wide>
        <DialogHeader>
          <DialogTitle>{ad ? 'Edit advertisement' : 'New advertisement'}</DialogTitle>
          <DialogDescription>Adverts are always labelled “Advertisement” on the website and only appear while published and within their schedule.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit((values) => save.mutate(values))} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Internal name" htmlFor="a-name" error={errors.internalName?.message} required><Input id="a-name" {...register('internalName')} /></Field>
            <Field label="Placement" htmlFor="a-placement" error={errors.placementId?.message} required>
              <Select id="a-placement" {...register('placementId')}>{placements.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
            </Field>
            <Field label="Headline" htmlFor="a-headline" error={errors.headline?.message} required className="sm:col-span-2"><Input id="a-headline" {...register('headline')} /></Field>
            <Field label="Description" htmlFor="a-desc" error={errors.description?.message} className="sm:col-span-2"><Textarea id="a-desc" rows={2} {...register('description')} /></Field>
            <Field label="Desktop image" error={errors.desktopImage?.message} hint="Required to publish. Wide images work best (e.g. 1600×500).">
              <Controller name="desktop" control={control} render={({ field }) => <ImageUploadField folder="advertisements" value={field.value} onChange={field.onChange} />} />
            </Field>
            <Field label="Mobile image (optional)" error={errors.mobileImage?.message}>
              <Controller name="mobile" control={control} render={({ field }) => <ImageUploadField folder="advertisements" value={field.value} onChange={field.onChange} aspect="aspect-[4/3]" />} />
            </Field>
            <Field label="Destination URL" htmlFor="a-url" error={errors.destinationUrl?.message} hint="https://… or a site path such as /properties/for-rent. Leave empty to link the associated property.">
              <Input id="a-url" {...register('destinationUrl')} />
            </Field>
            <Field label="Associated property (optional)" error={errors.propertyId?.message}>
              <Controller name="property" control={control} render={({ field }) => <PropertyPicker value={field.value} onChange={field.onChange} />} />
            </Field>
            <Field label="Start" htmlFor="a-start" error={errors.startAt?.message} required><Input id="a-start" type="datetime-local" {...register('startAt')} /></Field>
            <Field label="End (optional)" htmlFor="a-end" error={errors.endAt?.message}><Input id="a-end" type="datetime-local" {...register('endAt')} /></Field>
            <Field label="Display order" htmlFor="a-order"><Input id="a-order" type="number" min="0" {...register('displayOrder')} /></Field>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">Preview</p>
            <AdBanner ad={preview} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Advertisements() {
  const { can } = useAuth();
  const [filters, setFilters] = useState({ status: '', placementId: '', search: '' });
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(undefined);
  const [previewing, setPreviewing] = useState(null);
  const { data: placements = [] } = useQuery({ queryKey: ['admin', 'placements'], queryFn: adminApi.advertisements.placements });
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'advertisements', filters, page],
    queryFn: () => adminApi.advertisements.list({ ...filters, page, limit: 20 }),
    placeholderData: keepPreviousData,
  });
  const action = useAdminMutation(({ id, name }) => adminApi.advertisements.action(id, name), {
    success: (d, { name }) => (name === 'publish' ? (d.status === 'scheduled' ? 'Advert scheduled' : 'Advert published') : `Advert ${name === 'pause' ? 'paused' : name === 'archive' ? 'archived' : 'restored'}`),
    invalidate: [['admin', 'advertisements'], ['admin', 'dashboard'], ['ads']],
  });
  const setFilter = (k) => (e) => { setFilters((f) => ({ ...f, [k]: e.target.value })); setPage(1); };

  return (
    <AdminPage title="Advertisements" description="Banner placements across the website, scheduled and tracked." actions={can('advertisements.create') && <Button onClick={() => setEditing(null)} disabled={!placements.length}><Plus /> New advertisement</Button>}>
      <FilterBar>
        <Input className="sm:w-56" placeholder="Search…" value={filters.search} onChange={setFilter('search')} aria-label="Search advertisements" />
        <Select className="sm:w-56" value={filters.placementId} onChange={setFilter('placementId')} aria-label="Placement">
          <option value="">All placements</option>
          {placements.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
        <Select className="sm:w-40" value={filters.status} onChange={setFilter('status')} aria-label="Status">
          <option value="">All statuses</option>
          {['draft', 'scheduled', 'active', 'paused', 'expired', 'archived'].map((s) => <option key={s} value={s}>{LABELS.campaign[s]}</option>)}
        </Select>
      </FilterBar>
      {error ? <ErrorState error={error} onRetry={refetch} /> : isLoading ? <Spinner /> : !data.data.length ? <EmptyState title="No advertisements" /> : (
        <TableCard footer={<Pagination page={page} totalPages={data.meta.totalPages} onPageChange={setPage} />}>
          <Table>
            <TableHeader><TableRow><TableHead>Advertisement</TableHead><TableHead>Placement</TableHead><TableHead>Schedule</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.data.map((ad) => (
                <TableRow key={ad.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {ad.desktopImage ? <img src={ad.desktopImage} alt="" className="h-10 w-24 rounded object-cover" /> : <div className="h-10 w-24 rounded bg-muted" />}
                      <div><p className="font-medium">{ad.internalName}</p><p className="text-xs text-muted-foreground">{ad.headline}</p></div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{ad.placement.name}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{formatDateTime(ad.startAt)}<br /><span className="text-muted-foreground">→ {ad.endAt ? formatDateTime(ad.endAt) : 'no end date'}</span></TableCell>
                  <TableCell><StatusBadge status={ad.effectiveStatus}>{label('campaign', ad.effectiveStatus)}</StatusBadge></TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1.5">
                      <Button size="sm" variant="ghost" onClick={() => setPreviewing(ad)}><Eye /><span className="sr-only">Preview</span></Button>
                      {can('advertisements.create') && ad.status !== 'archived' && <Button size="sm" variant="ghost" onClick={() => setEditing(ad)}><Pencil /><span className="sr-only">Edit</span></Button>}
                      {can('advertisements.publish') && ['draft', 'paused', 'expired'].includes(ad.status) && <Button size="sm" variant="outline" onClick={() => action.mutate({ id: ad.id, name: 'publish' })}><Send /> Publish</Button>}
                      {can('advertisements.publish') && ['scheduled', 'active'].includes(ad.status) && <Button size="sm" variant="outline" onClick={() => action.mutate({ id: ad.id, name: 'pause' })}><Pause /> Pause</Button>}
                      {can('advertisements.archive') && ad.status !== 'archived' && <ConfirmButton variant="ghost" title="Archive this advertisement?" confirmLabel="Archive" onConfirm={() => action.mutate({ id: ad.id, name: 'archive' })}><Archive /><span className="sr-only">Archive</span></ConfirmButton>}
                      {can('advertisements.archive') && ad.status === 'archived' && <Button size="sm" variant="outline" onClick={() => action.mutate({ id: ad.id, name: 'restore' })}><RotateCcw /> Restore</Button>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      )}
      {editing !== undefined && <AdDialog ad={editing} placements={placements} onClose={() => setEditing(undefined)} />}
      {previewing && (
        <Dialog open onOpenChange={(o) => !o && setPreviewing(null)}>
          <DialogContent wide>
            <DialogHeader><DialogTitle>Preview — {previewing.placement.name}</DialogTitle></DialogHeader>
            <AdBanner ad={{ ...previewing, destinationUrl: null }} variant={previewing.placement.slug === 'sidebar' || previewing.placement.slug === 'in_content' ? 'card' : 'banner'} />
          </DialogContent>
        </Dialog>
      )}
    </AdminPage>
  );
}
