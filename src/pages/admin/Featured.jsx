import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Pause, Pencil, Play, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { AdminPage, ConfirmButton, FilterBar, TableCard, useAdminMutation } from '@/components/admin/AdminUi';
import { PropertyPicker } from '@/components/admin/PropertyPicker';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState, ErrorState, Spinner } from '@/components/ui/feedback';
import { Checkbox, Input, Select } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { Pagination } from '@/components/ui/pagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import { applyServerErrors } from '@/lib/api';
import { formatDateTime, fromDateTimeInput, label, toDateTimeInput } from '@/lib/format';
import { adminApi } from '@/services/adminApi';

function FeaturedDialog({ item, onClose }) {
  const { control, register, handleSubmit, setError, formState: { errors } } = useForm({
    defaultValues: item
      ? { property: item.property, label: item.label ?? '', displayOrder: item.displayOrder, startAt: toDateTimeInput(item.startAt), endAt: toDateTimeInput(item.endAt), isActive: item.isActive, priorityInSearch: item.priorityInSearch }
      : { property: null, label: '', displayOrder: 0, startAt: toDateTimeInput(new Date()), endAt: '', isActive: true, priorityInSearch: false },
  });
  const save = useAdminMutation(
    ({ property, ...v }) => {
      const body = { ...v, propertyId: property?.id, displayOrder: Number(v.displayOrder) || 0, startAt: fromDateTimeInput(v.startAt), endAt: fromDateTimeInput(v.endAt) };
      return item ? adminApi.featured.update(item.id, body) : adminApi.featured.create(body);
    },
    {
      success: item ? 'Featured placement updated' : 'Property featured',
      invalidate: [['admin', 'featured'], ['admin', 'dashboard'], ['featured']],
      onSuccess: onClose,
      onError: (e) => applyServerErrors(e, (path, err) => setError(path === 'propertyId' ? 'property' : path, err)),
    },
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item ? 'Edit featured placement' : 'Feature a property'}</DialogTitle>
          <DialogDescription>Only published and available properties can be featured. Featuring never changes the property’s price.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit((v) => save.mutate(v))} className="space-y-4" noValidate>
          <Field label="Property" error={errors.property?.message} required>
            <Controller name="property" control={control} render={({ field }) => <PropertyPicker value={field.value} onChange={field.onChange} promotable invalid={!!errors.property} />} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Badge label (optional)" htmlFor="f-label" error={errors.label?.message}><Input id="f-label" placeholder="Editor’s pick" {...register('label')} /></Field>
            <Field label="Display order" htmlFor="f-order" hint="Lower numbers appear first."><Input id="f-order" type="number" min="0" {...register('displayOrder')} /></Field>
            <Field label="Start" htmlFor="f-start" error={errors.startAt?.message} required><Input id="f-start" type="datetime-local" {...register('startAt')} /></Field>
            <Field label="End (optional)" htmlFor="f-end" error={errors.endAt?.message}><Input id="f-end" type="datetime-local" {...register('endAt')} /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm"><Checkbox {...register('isActive')} /> Active</label>
          <label className="flex items-center gap-2 text-sm"><Checkbox {...register('priorityInSearch')} /> Give priority placement in search results</label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Featured() {
  const { can } = useAuth();
  const manage = can('featured.manage');
  const [state, setState] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(undefined);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'featured', state, page],
    queryFn: () => adminApi.featured.list({ state: state || undefined, page, limit: 20 }),
    placeholderData: keepPreviousData,
  });
  const action = useAdminMutation(({ id, name }) => (name === 'delete' ? adminApi.featured.remove(id) : adminApi.featured.action(id, name)), {
    success: (_d, { name }) => ({ activate: 'Activated', deactivate: 'Deactivated', delete: 'Removed' })[name],
    invalidate: [['admin', 'featured'], ['admin', 'dashboard'], ['featured']],
  });

  return (
    <AdminPage title="Featured Properties" description="Promote listings on the homepage, the Featured page and (optionally) at the top of search results." actions={manage && <Button onClick={() => setEditing(null)}><Plus /> Feature a property</Button>}>
      <FilterBar>
        <Select className="sm:w-48" value={state} onChange={(e) => { setState(e.target.value); setPage(1); }} aria-label="Filter featured placements">
          <option value="">All placements</option>
          <option value="live">Live now</option>
          <option value="scheduled">Scheduled</option>
          <option value="inactive">Deactivated</option>
          <option value="expired">Expired</option>
        </Select>
      </FilterBar>
      {error ? <ErrorState error={error} onRetry={refetch} /> : isLoading ? <Spinner /> : !data.data.length ? <EmptyState title="No featured placements" /> : (
        <TableCard footer={<Pagination page={page} totalPages={data.meta.totalPages} onPageChange={setPage} />}>
          <Table>
            <TableHeader><TableRow><TableHead>Property</TableHead><TableHead>Schedule</TableHead><TableHead>Order</TableHead><TableHead>State</TableHead>{manage && <TableHead className="text-right">Actions</TableHead>}</TableRow></TableHeader>
            <TableBody>
              {data.data.map((f) => (
                <TableRow key={f.id}>
                  <TableCell>
                    <p className="font-medium">{f.property.title}</p>
                    <p className="text-xs text-muted-foreground">{f.property.reference} · {label('publication', f.property.publicationStatus)} · {label('availability', f.property.availabilityStatus)}</p>
                    <div className="mt-1 flex gap-1">{f.label && <Badge variant="accent">{f.label}</Badge>}{f.priorityInSearch && <Badge variant="info">Search priority</Badge>}</div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{formatDateTime(f.startAt)}<br /><span className="text-muted-foreground">→ {f.endAt ? formatDateTime(f.endAt) : 'no end date'}</span></TableCell>
                  <TableCell>{f.displayOrder}</TableCell>
                  <TableCell>
                    {f.isLive ? <StatusBadge status="live">Live</StatusBadge> : f.isActive ? <StatusBadge status="scheduled">Not showing</StatusBadge> : <StatusBadge status="paused">Deactivated</StatusBadge>}
                    {f.isActive && !f.isLive && <p className="mt-1 max-w-48 text-xs text-muted-foreground">Outside schedule, or property not published/available.</p>}
                  </TableCell>
                  {manage && (
                    <TableCell>
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(f)}><Pencil /><span className="sr-only">Edit</span></Button>
                        {f.isActive
                          ? <Button size="sm" variant="outline" onClick={() => action.mutate({ id: f.id, name: 'deactivate' })}><Pause /> Deactivate</Button>
                          : <Button size="sm" variant="outline" onClick={() => action.mutate({ id: f.id, name: 'activate' })}><Play /> Activate</Button>}
                        <ConfirmButton variant="ghost" title="Remove this featured placement?" confirmLabel="Remove" onConfirm={() => action.mutate({ id: f.id, name: 'delete' })}><Trash2 className="text-destructive" /><span className="sr-only">Remove</span></ConfirmButton>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      )}
      {editing !== undefined && <FeaturedDialog item={editing} onClose={() => setEditing(undefined)} />}
    </AdminPage>
  );
}
