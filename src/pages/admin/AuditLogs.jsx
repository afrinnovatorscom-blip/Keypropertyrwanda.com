import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { AdminPage, FilterBar, TableCard } from '@/components/admin/AdminUi';
import { EmptyState, ErrorState, Spinner } from '@/components/ui/feedback';
import { Input, Select } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDateTime } from '@/lib/format';
import { compact } from '@/lib/utils';
import { adminApi } from '@/services/adminApi';

export default function AuditLogs() {
  const [filters, setFilters] = useState({ search: '', action: '', entityType: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const search = useDebounce(filters.search);
  const query = compact({ ...filters, search, page, limit: 25, to: filters.to ? new Date(new Date(filters.to).getTime() + 86400000).toISOString().slice(0, 10) : undefined });
  const { data: options } = useQuery({ queryKey: ['admin', 'audit-filters'], queryFn: adminApi.auditLogs.filters });
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin', 'audit', query], queryFn: () => adminApi.auditLogs.list(query), placeholderData: keepPreviousData });
  const setFilter = (k) => (e) => { setFilters((f) => ({ ...f, [k]: e.target.value })); setPage(1); };

  return (
    <AdminPage title="Audit Logs" description="A record of sign-ins and important administrative actions.">
      <FilterBar>
        <Input className="sm:w-56" placeholder="Search…" value={filters.search} onChange={setFilter('search')} aria-label="Search audit logs" />
        <Select className="sm:w-56" value={filters.action} onChange={setFilter('action')} aria-label="Action">
          <option value="">All actions</option>
          {options?.actions.map((a) => <option key={a} value={a}>{a}</option>)}
        </Select>
        <Select className="sm:w-44" value={filters.entityType} onChange={setFilter('entityType')} aria-label="Entity">
          <option value="">All entities</option>
          {options?.entityTypes.map((a) => <option key={a} value={a}>{a}</option>)}
        </Select>
        <Input type="date" className="sm:w-40" value={filters.from} onChange={setFilter('from')} aria-label="From date" />
        <Input type="date" className="sm:w-40" value={filters.to} onChange={setFilter('to')} aria-label="To date" />
      </FilterBar>
      {error ? <ErrorState error={error} onRetry={refetch} /> : isLoading ? <Spinner /> : !data.data.length ? <EmptyState title="No audit entries" /> : (
        <TableCard footer={<Pagination page={page} totalPages={data.meta.totalPages} onPageChange={setPage} />}>
          <Table>
            <TableHeader><TableRow><TableHead>When</TableHead><TableHead>User</TableHead><TableHead>Action</TableHead><TableHead>Entity</TableHead><TableHead>Details</TableHead><TableHead>IP</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.data.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap text-sm">{formatDateTime(log.createdAt)}</TableCell>
                  <TableCell className="text-sm">{log.user ? <>{log.user.fullName}<p className="text-xs text-muted-foreground">{log.user.email}</p></> : <span className="text-muted-foreground">System / anonymous</span>}</TableCell>
                  <TableCell><code className="rounded bg-muted px-1.5 py-0.5 text-xs">{log.action}</code></TableCell>
                  <TableCell className="text-sm">{log.entityType ? `${log.entityType}${log.entityId ? ` #${log.entityId}` : ''}` : '—'}</TableCell>
                  <TableCell className="max-w-md">
                    {log.details && Object.keys(log.details).length > 0 ? (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-primary">View</summary>
                        <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-muted p-2">{JSON.stringify(log.details, null, 2)}</pre>
                      </details>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{log.ipAddress}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      )}
    </AdminPage>
  );
}
