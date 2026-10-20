import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Mail, MessageSquarePlus, Phone, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AdminPage, useAdminMutation } from '@/components/admin/AdminUi';
import { WhatsAppIcon } from '@/components/layout/BrandIcons';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState, Spinner } from '@/components/ui/feedback';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { formatDateTime, fromDateTimeInput, label, LABELS, toDateTimeInput } from '@/lib/format';
import { whatsappLink } from '@/lib/whatsapp';
import { adminApi } from '@/services/adminApi';

export default function InquiryDetail() {
  const { id } = useParams();
  const { can } = useAuth();
  const manage = can('inquiries.manage');
  const { data: inquiry, isLoading, error } = useQuery({ queryKey: ['admin', 'inquiry', id], queryFn: () => adminApi.inquiries.get(id) });
  const { data: staff = [] } = useQuery({ queryKey: ['admin', 'staff'], queryFn: adminApi.inquiries.staff });
  const [form, setForm] = useState({ status: 'new', assignedTo: '', followUpAt: '' });
  const [note, setNote] = useState('');

  useEffect(() => {
    if (inquiry) setForm({ status: inquiry.status, assignedTo: inquiry.assignedTo?.id ? String(inquiry.assignedTo.id) : '', followUpAt: toDateTimeInput(inquiry.followUpAt) });
  }, [inquiry]);

  const invalidate = [['admin', 'inquiry', id], ['admin', 'inquiries'], ['admin', 'dashboard']];
  const update = useAdminMutation(() => adminApi.inquiries.update(id, { status: form.status, assignedTo: form.assignedTo || null, followUpAt: fromDateTimeInput(form.followUpAt) }), { success: 'Inquiry updated', invalidate });
  const addNote = useAdminMutation(() => adminApi.inquiries.addNote(id, note), { success: 'Note added', invalidate, onSuccess: () => setNote('') });

  if (isLoading) return <Spinner />;
  if (error) return <ErrorState error={error} />;

  const greeting = `Hello ${inquiry.customerName}, this is Key Property Rwanda following up on your inquiry${inquiry.property ? ` about "${inquiry.property.title}" (Ref: ${inquiry.property.reference})` : ''}.`;
  const wa = whatsappLink(inquiry.phone, greeting);

  return (
    <AdminPage
      title={`Inquiry from ${inquiry.customerName}`}
      description={`INQ-${String(inquiry.id).padStart(6, '0')} · received ${formatDateTime(inquiry.createdAt)} · source: ${inquiry.source.replace('_', ' ')}`}
      actions={<Button asChild variant="outline"><Link to="/admin/inquiries"><ArrowLeft /> All inquiries</Link></Button>}
    >
      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Message</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="whitespace-pre-line rounded-lg bg-muted/50 p-4 text-sm">{inquiry.message}</p>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div><dt className="text-muted-foreground">Phone</dt><dd className="font-medium">{inquiry.phone}</dd></div>
                <div><dt className="text-muted-foreground">Email</dt><dd className="font-medium">{inquiry.email ?? '—'}</dd></div>
                <div><dt className="text-muted-foreground">Preferred contact</dt><dd className="font-medium">{label('contact', inquiry.preferredContact)}</dd></div>
                <div>
                  <dt className="text-muted-foreground">Property</dt>
                  <dd className="font-medium">{inquiry.property ? <Link className="text-primary hover:underline" to={`/admin/properties/${inquiry.property.id}`}>{inquiry.property.reference} · {inquiry.property.title}</Link> : inquiry.propertyReference ?? 'General inquiry'}</dd>
                </div>
                {(inquiry.attribution.advertisementName || inquiry.attribution.promotionName || inquiry.attribution.hotDealTitle) && (
                  <div className="sm:col-span-2">
                    <dt className="text-muted-foreground">Clicked through from</dt>
                    <dd className="font-medium">{[inquiry.attribution.advertisementName && `Advert: ${inquiry.attribution.advertisementName}`, inquiry.attribution.promotionName && `Promotion: ${inquiry.attribution.promotionName}`, inquiry.attribution.hotDealTitle && `Hot deal: ${inquiry.attribution.hotDealTitle}`].filter(Boolean).join(' · ')}</dd>
                  </div>
                )}
              </dl>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm"><a href={`tel:${inquiry.phone.replace(/\s/g, '')}`}><Phone /> Call</a></Button>
                {wa && <Button asChild variant="whatsapp" size="sm"><a href={wa} target="_blank" rel="noopener noreferrer"><WhatsAppIcon className="size-4" /> WhatsApp</a></Button>}
                {inquiry.email && <Button asChild variant="outline" size="sm"><a href={`mailto:${inquiry.email}?subject=${encodeURIComponent('Your inquiry with Key Property Rwanda')}`}><Mail /> Email</a></Button>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Internal notes ({inquiry.notes.length})</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {manage && (
                <form onSubmit={(e) => { e.preventDefault(); if (note.trim()) addNote.mutate(); }} className="space-y-2">
                  <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Record a call, viewing, next step…" aria-label="New note" />
                  <Button type="submit" size="sm" disabled={!note.trim() || addNote.isPending}><MessageSquarePlus /> Add note</Button>
                </form>
              )}
              {!inquiry.notes.length ? <p className="text-sm text-muted-foreground">No notes yet.</p> : (
                <ol className="space-y-3">
                  {inquiry.notes.map((n) => (
                    <li key={n.id} className="rounded-lg border p-3">
                      <p className="whitespace-pre-line text-sm">{n.note}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{n.author?.fullName ?? 'Deleted user'} · {formatDateTime(n.createdAt)}</p>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader><CardTitle>Follow-up</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); update.mutate(); }} className="space-y-4">
              <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Current status</span><StatusBadge status={inquiry.status}>{label('inquiry', inquiry.status)}</StatusBadge></div>
              <fieldset disabled={!manage} className="space-y-4">
                <Field label="Status" htmlFor="i-status">
                  <Select id="i-status" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                    {Object.entries(LABELS.inquiry).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </Select>
                </Field>
                <Field label="Assigned to" htmlFor="i-assign">
                  <Select id="i-assign" value={form.assignedTo} onChange={(e) => setForm((f) => ({ ...f, assignedTo: e.target.value }))}>
                    <option value="">Unassigned</option>
                    {staff.map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}
                  </Select>
                </Field>
                <Field label="Follow-up date" htmlFor="i-follow" hint="Shown as due on the dashboard and inquiry list.">
                  <Input id="i-follow" type="datetime-local" value={form.followUpAt} onChange={(e) => setForm((f) => ({ ...f, followUpAt: e.target.value }))} />
                </Field>
                {manage && <Button type="submit" className="w-full" disabled={update.isPending}><Save /> Save</Button>}
              </fieldset>
              <dl className="space-y-1 border-t pt-3 text-xs text-muted-foreground">
                <div className="flex justify-between"><dt>First contacted</dt><dd>{formatDateTime(inquiry.contactedAt)}</dd></div>
                <div className="flex justify-between"><dt>Closed</dt><dd>{formatDateTime(inquiry.closedAt)}</dd></div>
                <div className="flex justify-between"><dt>Consent to contact</dt><dd>{inquiry.consent ? 'Yes' : 'No'}</dd></div>
              </dl>
            </form>
          </CardContent>
        </Card>
      </div>
    </AdminPage>
  );
}
