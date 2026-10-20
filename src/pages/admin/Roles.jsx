import { useQuery } from '@tanstack/react-query';
import { Lock, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { AdminPage, ConfirmButton, useAdminMutation } from '@/components/admin/AdminUi';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ErrorState, Spinner } from '@/components/ui/feedback';
import { Checkbox, Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { adminApi } from '@/services/adminApi';

const MODULE_TITLES = {
  dashboard: 'Dashboard', properties: 'Properties', categories: 'Categories', featured: 'Featured', hot_deals: 'Hot deals',
  advertisements: 'Advertisements', promotions: 'Promotions', analytics: 'Analytics', inquiries: 'Inquiries', content: 'Website content',
  users: 'Users', roles: 'Roles', settings: 'Settings', audit_logs: 'Audit logs',
};

function RoleDialog({ role, permissions, onClose }) {
  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [selected, setSelected] = useState(new Set(role?.permissions ?? ['dashboard.view']));
  const modules = [...new Set(permissions.map((p) => p.module))];
  const toggle = (slug) => setSelected((s) => {
    const next = new Set(s);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    return next;
  });
  const save = useAdminMutation(
    () => {
      const body = { name, description, permissions: [...selected] };
      return role ? adminApi.roles.update(role.id, body) : adminApi.roles.create(body);
    },
    { success: role ? 'Role updated' : 'Role created', invalidate: [['admin', 'roles'], ['auth', 'me']], onSuccess: onClose },
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent wide>
        <DialogHeader>
          <DialogTitle>{role ? `Edit role: ${role.name}` : 'New role'}</DialogTitle>
          <DialogDescription>Permissions are enforced by the server on every request.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="r-name" required><Input id="r-name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="Description" htmlFor="r-desc"><Input id="r-desc" value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {modules.map((m) => (
              <fieldset key={m} className="rounded-lg border p-3">
                <legend className="px-1 text-sm font-semibold">{MODULE_TITLES[m] ?? m}</legend>
                {permissions.filter((p) => p.module === m).map((p) => (
                  <label key={p.slug} className="flex items-start gap-2 py-1 text-sm">
                    <Checkbox className="mt-0.5" checked={selected.has(p.slug)} onChange={() => toggle(p.slug)} />
                    <span>{p.name} <span className="text-xs text-muted-foreground">({p.slug})</span></span>
                  </label>
                ))}
              </fieldset>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={save.isPending || name.trim().length < 2}>Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Roles() {
  const { can } = useAuth();
  const manage = can('roles.manage');
  const [editing, setEditing] = useState(undefined);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin', 'roles'], queryFn: adminApi.roles.list });
  const remove = useAdminMutation((id) => adminApi.roles.remove(id), { success: 'Role deleted', invalidate: [['admin', 'roles']] });

  if (isLoading) return <Spinner />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  return (
    <AdminPage title="Roles & Permissions" description="What each role can see and do." actions={manage && <Button onClick={() => setEditing(null)}><Plus /> New role</Button>}>
      <div className="grid gap-4 lg:grid-cols-2">
        {data.roles.map((role) => (
          <Card key={role.id}>
            <CardHeader className="flex-row items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">{role.name}{role.isSystem && <Badge variant="muted"><Lock /> System</Badge>}</CardTitle>
                <CardDescription>{role.description} · {role.userCount} user{role.userCount === 1 ? '' : 's'}</CardDescription>
              </div>
              {manage && role.slug !== 'super_admin' && (
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(role)}><Pencil /><span className="sr-only">Edit</span></Button>
                  {!role.isSystem && (
                    <ConfirmButton variant="ghost" disabled={role.userCount > 0} title={`Delete role “${role.name}”?`} confirmLabel="Delete" onConfirm={() => remove.mutate(role.id)}><Trash2 className="text-destructive" /><span className="sr-only">Delete</span></ConfirmButton>
                  )}
                </div>
              )}
            </CardHeader>
            <CardContent>
              {role.slug === 'super_admin' ? (
                <p className="text-sm text-muted-foreground">All permissions (cannot be restricted).</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {role.permissions.map((p) => <Badge key={p} variant="secondary" className="font-mono font-normal">{p}</Badge>)}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      {editing !== undefined && <RoleDialog role={editing} permissions={data.permissions} onClose={() => setEditing(undefined)} />}
    </AdminPage>
  );
}
