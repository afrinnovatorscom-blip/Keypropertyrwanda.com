import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { BadgeCheck, CircleStop, Eye, Pause, Pencil, Play, Plus } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { AdminPage, ConfirmButton, FilterBar, TableCard, useAdminMutation } from '@/components/admin/AdminUi';
import { PropertyPicker } from '@/components/admin/PropertyPicker';
import { HotDealCard } from '@/components/promotions/HotDealCard';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, EmptyState, ErrorState, Spinner } from '@/components/ui/feedback';
import { Checkbox, Input, Select, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { Pagination } from '@/components/ui/pagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import { useDebounce } from '@/hooks/useDebounce';
import { applyServerErrors, errorMessage } from '@/lib/api';
import { formatDateTime, formatMoney, fromDateTimeInput, label, LABELS, toDateTimeInput } from '@/lib/format';
import { adminApi } from '@/services/adminApi';

const in14Days = () => new Date(Date.now() + 14 * 86400000);

function DealDialog({ deal, onClose }) {
  const { can } = useAuth();
  const { control, register, handleSubmit, watch, setError, formState: { errors } } = useForm({
    defaultValues: deal
      ? {
          property: deal.property, title: deal.title, description: deal.description ?? '', originalPrice: deal.originalPrice ?? '',
          originalPriceVerified: deal.originalPriceVerified, discountType: deal.discountType, discountValue: deal.discountValue,
          startAt: toDateTimeInput(deal.startAt), endAt: toDateTimeInput(deal.endAt), displayOrder: deal.displayOrder,
        }
      : { property: null, title: '', description: '', originalPrice: '', originalPriceVerified: false, discountType: 'percentage', discountValue: 10, startAt: toDateTimeInput(new Date()), endAt: toDateTimeInput(in14Days()), displayOrder: 0 },
  });

  const watched = watch();
  // Debounce a string (stable identity) rather than a new object each render.
  const calcKey = useDebounce(
    JSON.stringify({ propertyId: watched.property?.id, originalPrice: watched.originalPrice, discountType: watched.discountType, discountValue: watched.discountValue }),
    300,
  );
  const calcInput = JSON.parse(calcKey);
  const calc = useQuery({
    queryKey: ['admin', 'deal-calc', calcKey],
    queryFn: () => adminApi.hotDeals.calculate(calcInput),
    enabled: Boolean(calcInput.propertyId && calcInput.discountValue !== ''),
    retry: false,
  });

  const save = useAdminMutation(
    ({ property, ...v }) => {
      const body = {
        ...v,
        propertyId: property?.id,
        originalPrice: v.originalPrice === '' ? null : v.originalPrice,
        displayOrder: Number(v.displayOrder) || 0,
        startAt: fromDateTimeInput(v.startAt),
        endAt: fromDateTimeInput(v.endAt),
      };
      if (!can('hot_deals.verify_price')) delete body.originalPriceVerified;
      return deal ? adminApi.hotDeals.update(deal.id, body) : adminApi.hotDeals.create(body);
    },
    {
      success: deal ? 'Deal updated' : 'Draft deal created',
      invalidate: [['admin', 'hot-deals'], ['admin', 'dashboard'], ['hot-deals']],
      onSuccess: onClose,
      onError: (e) => applyServerErrors(e, (path, err) => setError(path === 'propertyId' ? 'property' : path, err)),
    },
  );

  const verified = watched.originalPriceVerified && watched.originalPrice !== '';
  const previewDeal = calc.data && watched.property
    ? {
        id: 0, title: watched.title || 'Deal title', promotionalPrice: calc.data.promotionalPrice, currency: calc.data.currency,
        originalPrice: verified ? calc.data.basePrice : null, discountAmount: verified ? calc.data.discountAmount : null,
        discountPercentage: verified ? calc.data.discountPercentage : null, endAt: fromDateTimeInput(watched.endAt),
        property: { ...watched.property, slug: watched.property.slug ?? '', mainImage: deal?.property.mainImage ?? null, district: deal?.property.district ?? '' },
      }
    : null;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent wide>
        <DialogHeader>
          <DialogTitle>{deal ? 'Edit hot deal' : 'New hot deal'}</DialogTitle>
          <DialogDescription>Discounts are calculated on the server. The property’s listed price is never changed.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit((v) => save.mutate(v))} className="grid gap-6 md:grid-cols-[1fr_260px]" noValidate>
          <div className="space-y-4">
            <Field label="Property" error={errors.property?.message} required>
              <Controller name="property" control={control} render={({ field }) => <PropertyPicker value={field.value} onChange={field.onChange} invalid={!!errors.property} />} />
            </Field>
            <Field label="Deal title" htmlFor="d-title" error={errors.title?.message} required><Input id="d-title" placeholder="Move-in special: 20% off" {...register('title')} /></Field>
            <Field label="Description" htmlFor="d-desc" error={errors.description?.message}><Textarea id="d-desc" rows={3} {...register('description')} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Discount type" htmlFor="d-type"><Select id="d-type" {...register('discountType')}>{Object.entries(LABELS.discount).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
              <Field label={watched.discountType === 'percentage' ? 'Discount (%)' : watched.discountType === 'amount' ? 'Amount off' : 'Promotional price'} htmlFor="d-value" error={errors.discountValue?.message} required>
                <Input id="d-value" type="number" min="0" step="any" {...register('discountValue')} />
              </Field>
              <Field label="Original price (optional)" htmlFor="d-orig" error={errors.originalPrice?.message} hint="Leave empty to use the property’s current price.">
                <Input id="d-orig" type="number" min="0" step="any" {...register('originalPrice')} />
              </Field>
              <Field label="Display order" htmlFor="d-order"><Input id="d-order" type="number" min="0" {...register('displayOrder')} /></Field>
              <Field label="Start" htmlFor="d-start" error={errors.startAt?.message} required><Input id="d-start" type="datetime-local" {...register('startAt')} /></Field>
              <Field label="Expiry" htmlFor="d-end" error={errors.endAt?.message} required><Input id="d-end" type="datetime-local" {...register('endAt')} /></Field>
            </div>
            <label className={`flex items-start gap-2 text-sm ${can('hot_deals.verify_price') ? '' : 'opacity-60'}`}>
              <Checkbox className="mt-0.5" disabled={!can('hot_deals.verify_price')} {...register('originalPriceVerified')} />
              <span>I have verified the original price. <span className="text-muted-foreground">Only verified original prices (and the discount) are shown publicly.</span></span>
            </label>
          </div>
          <div className="space-y-3">
            <p className="text-sm font-semibold">Calculation</p>
            {calc.isError ? (
              <Alert variant="error">{errorMessage(calc.error)}</Alert>
            ) : calc.data ? (
              <dl className="space-y-1 rounded-lg border bg-muted/40 p-3 text-sm">
                <div className="flex justify-between"><dt>Base price</dt><dd>{formatMoney(calc.data.basePrice, calc.data.currency)}</dd></div>
                <div className="flex justify-between"><dt>Discount</dt><dd>−{formatMoney(calc.data.discountAmount, calc.data.currency)} ({calc.data.discountPercentage}%)</dd></div>
                <div className="flex justify-between border-t pt-1 font-semibold"><dt>Deal price</dt><dd>{formatMoney(calc.data.promotionalPrice, calc.data.currency)}</dd></div>
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">Choose a property and discount to see the calculation.</p>
            )}
            {previewDeal && (
              <>
                <p className="text-sm font-semibold">Card preview</p>
                <div className="pointer-events-none"><HotDealCard deal={previewDeal} preview /></div>
              </>
            )}
          </div>
          <DialogFooter className="md:col-span-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PreviewDialog({ deal, onClose }) {
  const publicView = {
    ...deal,
    originalPrice: deal.originalPriceVerified ? deal.originalPrice : null,
    discountAmount: deal.originalPriceVerified ? deal.discountAmount : null,
    discountPercentage: deal.originalPriceVerified ? deal.discountPercentage : null,
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Public preview</DialogTitle><DialogDescription>How this deal card appears on the website.</DialogDescription></DialogHeader>
        <div className="mx-auto w-full max-w-sm"><HotDealCard deal={publicView} preview /></div>
      </DialogContent>
    </Dialog>
  );
}

export default function HotDeals() {
  const { can } = useAuth();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(undefined);
  const [previewing, setPreviewing] = useState(null);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'hot-deals', status, page],
    queryFn: () => adminApi.hotDeals.list({ status: status || undefined, page, limit: 20 }),
    placeholderData: keepPreviousData,
  });
  const action = useAdminMutation(({ id, name }) => adminApi.hotDeals.action(id, name), {
    success: (d, { name }) => (name === 'activate' ? (d.status === 'scheduled' ? 'Deal scheduled' : 'Deal activated') : name === 'pause' ? 'Deal paused' : 'Deal ended'),
    invalidate: [['admin', 'hot-deals'], ['admin', 'dashboard'], ['hot-deals']],
  });

  return (
    <AdminPage title="Hot Deals" description="Time-limited offers on existing properties. Expired deals and deals on unavailable or unpublished properties never appear publicly." actions={can('hot_deals.create') && <Button onClick={() => setEditing(null)}><Plus /> New deal</Button>}>
      <FilterBar>
        <Select className="sm:w-48" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Filter by status">
          <option value="">All statuses</option>
          <option value="live">Live on website</option>
          {Object.entries({ draft: 'Draft', scheduled: 'Scheduled', active: 'Active', paused: 'Paused', ended: 'Ended', expired: 'Expired' }).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
      </FilterBar>
      {error ? <ErrorState error={error} onRetry={refetch} /> : isLoading ? <Spinner /> : !data.data.length ? <EmptyState title="No hot deals" /> : (
        <TableCard footer={<Pagination page={page} totalPages={data.meta.totalPages} onPageChange={setPage} />}>
          <Table>
            <TableHeader><TableRow><TableHead>Deal</TableHead><TableHead>Pricing</TableHead><TableHead>Schedule</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.data.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>
                    <p className="font-medium">{d.title}</p>
                    <p className="text-xs text-muted-foreground">{d.property.reference} · {d.property.title}</p>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    <span className="font-semibold">{formatMoney(d.promotionalPrice, d.currency)}</span>
                    <span className="text-muted-foreground"> (−{d.discountPercentage}%)</span>
                    <p className="text-xs text-muted-foreground">from {formatMoney(d.basePrice, d.currency)} · {label('discount', d.discountType)}</p>
                    {d.originalPrice !== null && (d.originalPriceVerified ? <Badge variant="success" className="mt-1"><BadgeCheck /> Original verified</Badge> : <Badge variant="warning" className="mt-1">Original unverified</Badge>)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{formatDateTime(d.startAt)}<br /><span className="text-muted-foreground">→ {formatDateTime(d.endAt)}</span></TableCell>
                  <TableCell>
                    <StatusBadge status={d.status}>{label('campaign', d.status)}</StatusBadge>
                    {d.isLive && <StatusBadge status="live" className="ml-1">Live</StatusBadge>}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1.5">
                      <Button size="sm" variant="ghost" onClick={() => setPreviewing(d)}><Eye /><span className="sr-only">Preview</span></Button>
                      {can('hot_deals.create') && !['ended', 'expired'].includes(d.status) && <Button size="sm" variant="ghost" onClick={() => setEditing(d)}><Pencil /><span className="sr-only">Edit</span></Button>}
                      {can('hot_deals.publish') && ['draft', 'paused'].includes(d.status) && <Button size="sm" variant="outline" onClick={() => action.mutate({ id: d.id, name: 'activate' })}><Play /> Activate</Button>}
                      {can('hot_deals.publish') && ['scheduled', 'active'].includes(d.status) && <Button size="sm" variant="outline" onClick={() => action.mutate({ id: d.id, name: 'pause' })}><Pause /> Pause</Button>}
                      {can('hot_deals.publish') && !['ended', 'expired'].includes(d.status) && (
                        <ConfirmButton variant="ghost" title="End this deal?" description="Ended deals are kept for history and cannot be restarted." confirmLabel="End deal" onConfirm={() => action.mutate({ id: d.id, name: 'end' })}><CircleStop className="text-destructive" /><span className="sr-only">End</span></ConfirmButton>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      )}
      {editing !== undefined && <DealDialog deal={editing} onClose={() => setEditing(undefined)} />}
      {previewing && <PreviewDialog deal={previewing} onClose={() => setPreviewing(null)} />}
    </AdminPage>
  );
}
