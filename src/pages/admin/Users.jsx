import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { AdminPage, FilterBar, TableCard, useAdminMutation } from '@/components/admin/AdminUi';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState, ErrorState, Spinner } from '@/components/ui/feedback';
import { Input, Select } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { Pagination } from '@/components/ui/pagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import { useDebounce } from '@/hooks/useDebounce';
import { applyServerErrors } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { adminApi } from '@/services/adminApi';

function UserDialog({ user, roles, onClose }) {
  const { user: me } = useAuth();
  const { register, handleSubmit, setError, formState: { errors } } = useForm({
    defaultValues: user
      ? { fullName: user.fullName, email: user.email, phone: user.phone ?? '', roleId: String(user.role.id), status: user.status, password: '' }
      : { fullName: '', email: '', phone: '', roleId: String(roles.find((r) => r.slug === 'viewer')?.id ?? roles[0]?.id ?? ''), status: 'active', password: '' },
  });
  const save = useAdminMutation((v) => (user ? adminApi.users.update(user.id, v) : adminApi.users.create(v)), {
    success: user ? 'User updated' : 'User created',
    invalidate: [['admin', 'users'], ['admin', 'staff'], ['admin', 'roles']],
    onSuccess: onClose,
    onError: (e) => applyServerErrors(e, setError),
  });
  const isSelf = user?.id === me.id;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{user ? 'Edit user' : 'New user'}</DialogTitle>
          <DialogDescription>Passwords need 10+ characters with upper- and lower-case letters and a number.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit((v) => save.mutate(v))} className="space-y-4" noValidate>
          <Field label="Full name" htmlFor="u-name" error={errors.fullName?.message} required><Input id="u-name" {...register('fullName')} /></Field>
          <Field label="Email" htmlFor="u-email" error={errors.email?.message} required><Input id="u-email" type="email" autoComplete="off" {...register('email')} /></Field>
          <Field label="Phone" htmlFor="u-phone" error={errors.phone?.message}><Input id="u-phone" type="tel" {...register('phone')} /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Role" htmlFor="u-role" error={errors.roleId?.message}>
              <Select id="u-role" disabled={isSelf} {...register('roleId')}>{roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</Select>
            </Field>
            <Field label="Status" htmlFor="u-status" error={errors.status?.message}>
              <Select id="u-status" disabled={isSelf} {...register('status')}><option value="active">Active</option><option value="suspended">Suspended</option></Select>
            </Field>
          </div>
          <Field label={user ? 'Reset password (optional)' : 'Password'} htmlFor="u-pass" error={errors.password?.message} required={!user} hint={user ? 'Resetting signs the user out everywhere.' : undefined}>
            <Input id="u-pass" type="password" autoComplete="new-password" {...register('password')} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Users() {
  const { can } = useAuth();
  const [filters, setFilters] = useState({ search: '', roleId: '', status: '' });
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(undefined);
  const search = useDebounce(filters.search);
  const { data: roleData } = useQuery({ queryKey: ['admin', 'roles'], queryFn: adminApi.roles.list });
  const roles = roleData?.roles ?? [];
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'users', { ...filters, search }, page],
    queryFn: () => adminApi.users.list({ ...filters, search, page, limit: 20 }),
    placeholderData: keepPreviousData,
  });
  const setFilter = (k) => (e) => { setFilters((f) => ({ ...f, [k]: e.target.value })); setPage(1); };

  return (
    <AdminPage title="Users" description="Staff accounts and their roles." actions={can('users.manage') && <Button onClick={() => setEditing(null)} disabled={!roles.length}><Plus /> New user</Button>}>
      <FilterBar>
        <Input className="sm:w-64" placeholder="Search name or email…" value={filters.search} onChange={setFilter('search')} aria-label="Search users" />
        <Select className="sm:w-48" value={filters.roleId} onChange={setFilter('roleId')} aria-label="Role"><option value="">All roles</option>{roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</Select>
        <Select className="sm:w-40" value={filters.status} onChange={setFilter('status')} aria-label="Status"><option value="">Any status</option><option value="active">Active</option><option value="suspended">Suspended</option></Select>
      </FilterBar>
      {error ? <ErrorState error={error} onRetry={refetch} /> : isLoading ? <Spinner /> : !data.data.length ? <EmptyState title="No users found" /> : (
        <TableCard footer={<Pagination page={page} totalPages={data.meta.totalPages} onPageChange={setPage} />}>
          <Table>
            <TableHeader><TableRow><TableHead>User</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead><TableHead>Last sign-in</TableHead>{can('users.manage') && <TableHead className="text-right">Actions</TableHead>}</TableRow></TableHeader>
            <TableBody>
              {data.data.map((u) => (
                <TableRow key={u.id}>
                  <TableCell><p className="font-medium">{u.fullName}</p><p className="text-xs text-muted-foreground">{u.email}</p></TableCell>
                  <TableCell>{u.role.name}</TableCell>
                  <TableCell><StatusBadge status={u.status}>{u.status === 'active' ? 'Active' : 'Suspended'}</StatusBadge>{u.lockedUntil && new Date(u.lockedUntil) > new Date() && <StatusBadge status="paused" className="ml-1">Locked</StatusBadge>}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDateTime(u.lastLoginAt)}</TableCell>
                  {can('users.manage') && <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => setEditing(u)}><Pencil /> Edit</Button></TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      )}
      {editing !== undefined && <UserDialog user={editing} roles={roles} onClose={() => setEditing(undefined)} />}
    </AdminPage>
  );
}
