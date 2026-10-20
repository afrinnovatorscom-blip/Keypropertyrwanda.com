import { useQuery } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { AdminPage, ConfirmButton, TableCard, useAdminMutation } from '@/components/admin/AdminUi';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ErrorState, Spinner } from '@/components/ui/feedback';
import { Checkbox, Input, Select, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import { applyServerErrors } from '@/lib/api';
import { label, LABELS } from '@/lib/format';
import { adminApi } from '@/services/adminApi';

function CategoryDialog({ category, open, onOpenChange }) {
  const form = useForm({
    values: category
      ? { name: category.name, slug: category.slug, typeGroup: category.typeGroup, description: category.description ?? '', isActive: category.isActive, sortOrder: category.sortOrder }
      : { name: '', slug: '', typeGroup: 'residential', description: '', isActive: true, sortOrder: 0 },
  });
  const { register, handleSubmit, setError, formState: { errors } } = form;
  const save = useAdminMutation((v) => (category ? adminApi.categories.update(category.id, v) : adminApi.categories.create(v)), {
    success: category ? 'Category updated' : 'Category created',
    invalidate: [['admin', 'categories'], ['categories']],
    onSuccess: () => onOpenChange(false),
    onError: (e) => applyServerErrors(e, setError),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{category ? 'Edit category' : 'New category'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit((v) => save.mutate({ ...v, sortOrder: Number(v.sortOrder) || 0 }))} className="space-y-4" noValidate>
          <Field label="Name" htmlFor="c-name" error={errors.name?.message} required><Input id="c-name" {...register('name', { required: 'Required' })} /></Field>
          <Field label="Slug" htmlFor="c-slug" error={errors.slug?.message} hint="Leave empty to generate from the name."><Input id="c-slug" {...register('slug')} /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Group" htmlFor="c-group" hint="Controls which listing page shows it.">
              <Select id="c-group" {...register('typeGroup')}>{Object.entries(LABELS.group).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
            </Field>
            <Field label="Display order" htmlFor="c-order"><Input id="c-order" type="number" min="0" {...register('sortOrder')} /></Field>
          </div>
          <Field label="Description" htmlFor="c-desc" error={errors.description?.message}><Textarea id="c-desc" rows={3} {...register('description')} /></Field>
          <label className="flex items-center gap-2 text-sm"><Checkbox {...register('isActive')} /> Active (available for new listings and public filters)</label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Categories() {
  const { can } = useAuth();
  const [editing, setEditing] = useState(undefined);
  const { data = [], isLoading, error, refetch } = useQuery({ queryKey: ['admin', 'categories'], queryFn: adminApi.categories.list });
  const remove = useAdminMutation((id) => adminApi.categories.remove(id), { success: 'Category deleted', invalidate: [['admin', 'categories'], ['categories']] });
  const manage = can('categories.manage');

  return (
    <AdminPage title="Categories" description="Property categories used for listings, filters and category campaigns." actions={manage && <Button onClick={() => setEditing(null)}><Plus /> New category</Button>}>
      {error ? <ErrorState error={error} onRetry={refetch} /> : isLoading ? <Spinner /> : (
        <TableCard>
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Group</TableHead><TableHead>Properties</TableHead><TableHead>Status</TableHead><TableHead>Order</TableHead>{manage && <TableHead className="text-right">Actions</TableHead>}</TableRow></TableHeader>
            <TableBody>
              {data.map((c) => (
                <TableRow key={c.id}>
                  <TableCell><p className="font-medium">{c.name}</p><p className="text-xs text-muted-foreground">/{c.slug}</p></TableCell>
                  <TableCell>{label('group', c.typeGroup)}</TableCell>
                  <TableCell>{c.propertyCount}</TableCell>
                  <TableCell><StatusBadge status={c.isActive ? 'active' : 'archived'}>{c.isActive ? 'Active' : 'Inactive'}</StatusBadge></TableCell>
                  <TableCell>{c.sortOrder}</TableCell>
                  {manage && (
                    <TableCell>
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(c)}><Pencil /><span className="sr-only">Edit</span></Button>
                        <ConfirmButton variant="ghost" disabled={c.propertyCount > 0} title={`Delete “${c.name}”?`} description="Only categories without properties can be deleted." confirmLabel="Delete" onConfirm={() => remove.mutate(c.id)}>
                          <Trash2 className="text-destructive" /><span className="sr-only">Delete</span>
                        </ConfirmButton>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      )}
      {editing !== undefined && <CategoryDialog category={editing} open onOpenChange={(o) => !o && setEditing(undefined)} />}
    </AdminPage>
  );
}
