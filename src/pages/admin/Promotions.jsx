import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Archive, Eye, Pause, Pencil, Plus, RotateCcw, Send } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { AdminPage, ConfirmButton, FilterBar, TableCard, useAdminMutation } from '@/components/admin/AdminUi';
import { ImageUploadField } from '@/components/admin/ImageUploadField';
import { PropertyPicker } from '@/components/admin/PropertyPicker';
import { PromotionCard } from '@/components/promotions/PromotionCard';
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

function PromotionForm({ promotion, categories, onClose }) {
  const { control, register, handleSubmit, setError, watch, formState: { errors } } = useForm({
    defaultValues: promotion
      ? {
          name: promotion.name, description: promotion.description ?? '', campaignType: promotion.campaignType, categoryId: promotion.category ? String(promotion.category.id) : '',
          placement: promotion.placement, destinationUrl: promotion.destinationUrl ?? '', startAt: toDateTimeInput(promotion.startAt), endAt: toDateTimeInput(promotion.endAt),
          displayOrder: promotion.displayOrder, banner: promotion.bannerImagePath ? { path: promotion.bannerImagePath, url: promotion.bannerImage } : null, properties: promotion.properties ?? [],
        }
      : { name: '', description: '', campaignType: 'general', categoryId: '', placement: 'promotions_page', destinationUrl: '', startAt: toDateTimeInput(new Date()), endAt: '', displayOrder: 0, banner: null, properties: [] },
  });
  const save = useAdminMutation(
    ({ banner, properties, ...v }) => {
      const body = {
        ...v,
        categoryId: v.categoryId || null,
        bannerImage: banner?.path ?? null,
        propertyIds: properties.map((p) => p.id),
        displayOrder: Number(v.displayOrder) || 0,
        startAt: fromDateTimeInput(v.startAt),
        endAt: fromDateTimeInput(v.endAt),
      };
      return promotion ? adminApi.promotions.update(promotion.id, body) : adminApi.promotions.create(body);
    },
    {
      success: promotion ? 'Promotion updated' : 'Promotion saved as draft',
      invalidate: [['admin', 'promotions'], ['promotions']],
      onSuccess: onClose,
      onError: (e) => applyServerErrors(e, setError),
    },
  );
  const v = watch();

  return (
    <form onSubmit={handleSubmit((values) => save.mutate(values))} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Campaign name" htmlFor="p-name" error={errors.name?.message} required className="sm:col-span-2"><Input id="p-name" {...register('name')} /></Field>
        <Field label="Campaign type" htmlFor="p-type"><Select id="p-type" {...register('campaignType')}>{Object.entries(LABELS.campaignType).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
        <Field label="Placement" htmlFor="p-placement"><Select id="p-placement" {...register('placement')}>{Object.entries(LABELS.placement).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
        {v.campaignType === 'category' && (
          <Field label="Category" htmlFor="p-cat" error={errors.categoryId?.message} required hint="If no properties are selected, live listings in this category are shown.">
            <Select id="p-cat" {...register('categoryId')}><option value="">Choose…</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
          </Field>
        )}
        <Field label="Description" htmlFor="p-desc" error={errors.description?.message} className="sm:col-span-2"><Textarea id="p-desc" rows={4} {...register('description')} /></Field>
        <Field label="Banner image" error={errors.bannerImage?.message} className="sm:col-span-2">
          <Controller name="banner" control={control} render={({ field }) => <ImageUploadField folder="promotions" value={field.value} onChange={field.onChange} />} />
        </Field>
        <Field label="Destination URL (optional)" htmlFor="p-url" error={errors.destinationUrl?.message} hint="https://… or a site path." className="sm:col-span-2"><Input id="p-url" {...register('destinationUrl')} /></Field>
        <Field label="Start" htmlFor="p-start" error={errors.startAt?.message} required><Input id="p-start" type="datetime-local" {...register('startAt')} /></Field>
        <Field label="End (optional)" htmlFor="p-end" error={errors.endAt?.message}><Input id="p-end" type="datetime-local" {...register('endAt')} /></Field>
        <Field label="Display order" htmlFor="p-order"><Input id="p-order" type="number" min="0" {...register('displayOrder')} /></Field>
        <Field label="Associated properties" error={errors.propertyIds?.message} className="sm:col-span-2" hint="Existing property records are linked — never copied.">
          <Controller name="properties" control={control} render={({ field }) => <PropertyPicker multiple value={field.value} onChange={field.onChange} />} />
        </Field>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={save.isPending}>Save</Button>
      </DialogFooter>
    </form>
  );
}

function PromotionDialog({ id, categories, onClose }) {
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'promotion', id], queryFn: () => adminApi.promotions.get(id), enabled: Boolean(id) });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent wide>
        <DialogHeader>
          <DialogTitle>{id ? 'Edit promotion' : 'New promotion'}</DialogTitle>
          <DialogDescription>Campaigns appear publicly only while published and within their dates. Expired campaigns are kept for history.</DialogDescription>
        </DialogHeader>
        {id && isLoading ? <Spinner /> : <PromotionForm promotion={id ? data : null} categories={categories} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

export default function Promotions() {
  const { can } = useAuth();
  const [filters, setFilters] = useState({ status: '', campaignType: '', search: '' });
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(undefined);
  const [previewing, setPreviewing] = useState(null);
  const { data: categories = [] } = useQuery({ queryKey: ['admin', 'categories'], queryFn: adminApi.categories.list });
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'promotions', filters, page],
    queryFn: () => adminApi.promotions.list({ ...filters, page, limit: 20 }),
    placeholderData: keepPreviousData,
  });
  const action = useAdminMutation(({ id, name }) => adminApi.promotions.action(id, name), {
    success: (d, { name }) => (name === 'publish' ? (d.status === 'scheduled' ? 'Promotion scheduled' : 'Promotion published') : `Promotion ${name === 'pause' ? 'paused' : name === 'archive' ? 'archived' : 'restored'}`),
    invalidate: [['admin', 'promotions'], ['admin', 'dashboard'], ['promotions']],
  });
  const setFilter = (k) => (e) => { setFilters((f) => ({ ...f, [k]: e.target.value })); setPage(1); };

  return (
    <AdminPage title="Promotions" description="Campaigns that group properties: seasonal, category, featured and hot-deal campaigns." actions={can('promotions.create') && <Button onClick={() => setEditing(null)}><Plus /> New promotion</Button>}>
      <FilterBar>
        <Input className="sm:w-56" placeholder="Search…" value={filters.search} onChange={setFilter('search')} aria-label="Search promotions" />
        <Select className="sm:w-56" value={filters.campaignType} onChange={setFilter('campaignType')} aria-label="Campaign type">
          <option value="">All types</option>
          {Object.entries(LABELS.campaignType).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </Select>
        <Select className="sm:w-40" value={filters.status} onChange={setFilter('status')} aria-label="Status">
          <option value="">All statuses</option>
          {['draft', 'scheduled', 'active', 'paused', 'expired', 'archived'].map((s) => <option key={s} value={s}>{LABELS.campaign[s]}</option>)}
        </Select>
      </FilterBar>
      {error ? <ErrorState error={error} onRetry={refetch} /> : isLoading ? <Spinner /> : !data.data.length ? <EmptyState title="No promotions" /> : (
        <TableCard footer={<Pagination page={page} totalPages={data.meta.totalPages} onPageChange={setPage} />}>
          <Table>
            <TableHeader><TableRow><TableHead>Campaign</TableHead><TableHead>Type / placement</TableHead><TableHead>Schedule</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.data.map((p) => (
                <TableRow key={p.id}>
                  <TableCell><p className="font-medium">{p.name}</p><p className="text-xs text-muted-foreground">{p.propertyCount} propert{p.propertyCount === 1 ? 'y' : 'ies'}{p.category ? ` · ${p.category.name}` : ''}</p></TableCell>
                  <TableCell className="text-sm">{label('campaignType', p.campaignType)}<p className="text-xs text-muted-foreground">{label('placement', p.placement)}</p></TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{formatDateTime(p.startAt)}<br /><span className="text-muted-foreground">→ {p.endAt ? formatDateTime(p.endAt) : 'no end date'}</span></TableCell>
                  <TableCell><StatusBadge status={p.effectiveStatus}>{label('campaign', p.effectiveStatus)}</StatusBadge></TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1.5">
                      <Button size="sm" variant="ghost" onClick={() => setPreviewing(p)}><Eye /><span className="sr-only">Preview</span></Button>
                      {can('promotions.create') && p.status !== 'archived' && <Button size="sm" variant="ghost" onClick={() => setEditing(p.id)}><Pencil /><span className="sr-only">Edit</span></Button>}
                      {can('promotions.publish') && ['draft', 'paused', 'expired'].includes(p.status) && <Button size="sm" variant="outline" onClick={() => action.mutate({ id: p.id, name: 'publish' })}><Send /> Publish</Button>}
                      {can('promotions.publish') && ['scheduled', 'active'].includes(p.status) && <Button size="sm" variant="outline" onClick={() => action.mutate({ id: p.id, name: 'pause' })}><Pause /> Pause</Button>}
                      {can('promotions.archive') && p.status !== 'archived' && <ConfirmButton variant="ghost" title="Archive this promotion?" description="It will stop showing and move to history." confirmLabel="Archive" onConfirm={() => action.mutate({ id: p.id, name: 'archive' })}><Archive /><span className="sr-only">Archive</span></ConfirmButton>}
                      {can('promotions.archive') && p.status === 'archived' && <Button size="sm" variant="outline" onClick={() => action.mutate({ id: p.id, name: 'restore' })}><RotateCcw /> Restore</Button>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      )}
      {editing !== undefined && <PromotionDialog id={editing} categories={categories} onClose={() => setEditing(undefined)} />}
      {previewing && (
        <Dialog open onOpenChange={(o) => !o && setPreviewing(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Public preview</DialogTitle></DialogHeader>
            <div className="pointer-events-none"><PromotionCard promotion={previewing} preview /></div>
          </DialogContent>
        </Dialog>
      )}
    </AdminPage>
  );
}
