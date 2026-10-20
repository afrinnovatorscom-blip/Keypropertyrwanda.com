import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { AlarmClock, Download } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AdminPage, FilterBar, TableCard } from '@/components/admin/AdminUi';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, Spinner } from '@/components/ui/feedback';
import { Checkbox, Input, Select } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import { useDebounce } from '@/hooks/useDebounce';
import { downloadUrl } from '@/lib/api';
import { formatDateTime, label, LABELS } from '@/lib/format';
import { compact } from '@/lib/utils';
import { adminApi } from '@/services/adminApi';

export default function Inquiries() {
  const { can } = useAuth();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('search') ?? '');
  const debounced = useDebounce(search);
  const filters = compact({
    search: debounced,
    status: params.get('status'),
    preferredContact: params.get('preferredContact'),
    assignedTo: params.get('assignedTo'),
    followUpDue: params.get('followUpDue'),
    page: params.get('page') ?? 1,
    limit: 20,
  });
  const setFilter = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next);
  };
  const { data: staff = [] } = useQuery({ queryKey: ['admin', 'staff'], queryFn: adminApi.inquiries.staff });
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin', 'inquiries', filters], queryFn: () => adminApi.inquiries.list(filters), placeholderData: keepPreviousData });

  return (
    <AdminPage
      title="Inquiries"
      description="Customer inquiries from the website. Contact details are personal data — use them only to respond."
      actions={can('inquiries.export') && <Button asChild variant="outline"><a href={downloadUrl('/admin/inquiries/export', compact({ ...filters, page: undefined, limit: undefined }))}><Download /> Export CSV</a></Button>}
    >
      <FilterBar>
        <Input className="sm:w-64" placeholder="Search name, phone, email, reference…" value={search} onChange={(e) => { setSearch(e.target.value); setFilter('page', ''); }} aria-label="Search inquiries" />
        <Select className="sm:w-40" value={params.get('status') ?? ''} onChange={(e) => setFilter('status', e.target.value)} aria-label="Status">
          <option value="">All statuses</option>
          {Object.entries(LABELS.inquiry).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
        <Select className="sm:w-40" value={params.get('preferredContact') ?? ''} onChange={(e) => setFilter('preferredContact', e.target.value)} aria-label="Preferred contact">
          <option value="">Any contact method</option>
          {Object.entries(LABELS.contact).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
        <Select className="sm:w-44" value={params.get('assignedTo') ?? ''} onChange={(e) => setFilter('assignedTo', e.target.value)} aria-label="Assigned to">
          <option value="">Anyone</option>
          {staff.map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}
        </Select>
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={params.get('followUpDue') === 'true'} onChange={(e) => setFilter('followUpDue', e.target.checked ? 'true' : '')} /> Follow-up due</label>
      </FilterBar>
      {error ? <ErrorState error={error} onRetry={refetch} /> : isLoading ? <Spinner /> : !data.data.length ? <EmptyState title="No inquiries match" /> : (
        <TableCard footer={<Pagination page={data.meta.page} totalPages={data.meta.totalPages} onPageChange={(p) => setFilter('page', String(p))} />}>
          <Table>
            <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Property</TableHead><TableHead>Prefers</TableHead><TableHead>Status</TableHead><TableHead>Assigned</TableHead><TableHead>Received</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.data.map((q) => {
                const due = q.followUpAt && new Date(q.followUpAt) <= new Date() && !['converted', 'closed'].includes(q.status);
                return (
                  <TableRow key={q.id}>
                    <TableCell>
                      <Link to={`/admin/inquiries/${q.id}`} className="font-medium hover:text-primary">{q.customerName}</Link>
                      <p className="text-xs text-muted-foreground">{q.phone}{q.email ? ` · ${q.email}` : ''}</p>
                    </TableCell>
                    <TableCell className="max-w-56">{q.property ? <><p className="truncate">{q.property.title}</p><p className="text-xs text-muted-foreground">{q.property.reference}</p></> : <span className="text-muted-foreground">General inquiry</span>}</TableCell>
                    <TableCell className="text-sm">{label('contact', q.preferredContact)}</TableCell>
                    <TableCell>
                      <StatusBadge status={q.status}>{label('inquiry', q.status)}</StatusBadge>
                      {due && <p className="mt-1 flex items-center gap-1 text-xs text-red-700"><AlarmClock className="size-3" /> Follow-up due</p>}
                    </TableCell>
                    <TableCell className="text-sm">{q.assignedTo?.fullName ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{formatDateTime(q.createdAt)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableCard>
      )}
    </AdminPage>
  );
}
