import { useQuery } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { AdminPage, useAdminMutation } from '@/components/admin/AdminUi';
import { RichText } from '@/components/layout/Section';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ErrorState, Spinner } from '@/components/ui/feedback';
import { Input, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { applyServerErrors } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { adminApi } from '@/services/adminApi';

function ContentDialog({ block, onClose }) {
  const { register, handleSubmit, setError, watch, formState: { errors } } = useForm({ defaultValues: { title: block.title ?? '', body: block.body ?? '' } });
  const save = useAdminMutation((v) => adminApi.content.update(block.key, v), {
    success: 'Content updated',
    invalidate: [['admin', 'content'], ['content'], ['site']],
    onSuccess: onClose,
    onError: (e) => applyServerErrors(e, setError),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent wide>
        <DialogHeader>
          <DialogTitle>{block.description ?? block.key}</DialogTitle>
          <DialogDescription>Plain text. Separate paragraphs with a blank line; start lines with “- ” for a bulleted list; a short line without a full stop becomes a heading.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit((v) => save.mutate(v))} className="space-y-4">
          <Field label="Title" htmlFor="ct-title" error={errors.title?.message}><Input id="ct-title" {...register('title')} /></Field>
          <Field label="Body" htmlFor="ct-body" error={errors.body?.message}><Textarea id="ct-body" rows={12} {...register('body')} /></Field>
          <details className="rounded-lg border p-3 text-sm">
            <summary className="cursor-pointer font-medium">Preview</summary>
            <RichText text={watch('body')} className="mt-3" />
          </details>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Content() {
  const { can } = useAuth();
  const [editing, setEditing] = useState(null);
  const { data = [], isLoading, error, refetch } = useQuery({ queryKey: ['admin', 'content'], queryFn: adminApi.content.list });

  return (
    <AdminPage title="Website Content" description="Edit the text shown on the homepage, About, Contact and legal pages.">
      {error ? <ErrorState error={error} onRetry={refetch} /> : isLoading ? <Spinner /> : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.map((block) => (
            <Card key={block.key}>
              <CardHeader className="flex-row items-start justify-between gap-3">
                <div>
                  <CardTitle>{block.description ?? block.key}</CardTitle>
                  <CardDescription>Updated {formatDateTime(block.updatedAt)}{block.updatedBy ? ` by ${block.updatedBy.fullName}` : ''}</CardDescription>
                </div>
                {can('content.manage') && <Button size="sm" variant="outline" onClick={() => setEditing(block)}><Pencil /> Edit</Button>}
              </CardHeader>
              <CardContent>
                <p className="font-medium">{block.title}</p>
                <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{block.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {editing && <ContentDialog block={editing} onClose={() => setEditing(null)} />}
    </AdminPage>
  );
}
