import { KeyRound } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { AdminPage, useAdminMutation } from '@/components/admin/AdminUi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { applyServerErrors } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { authApi } from '@/services/adminApi';

export default function Account() {
  const { user } = useAuth();
  const { register, handleSubmit, setError, reset, watch, formState: { errors } } = useForm({ defaultValues: { currentPassword: '', newPassword: '', confirm: '' } });
  const save = useAdminMutation(({ currentPassword, newPassword }) => authApi.changePassword({ currentPassword, newPassword }), {
    success: 'Password changed. Other sessions have been signed out.',
    onSuccess: () => reset(),
    onError: (e) => applyServerErrors(e, setError),
  });

  return (
    <AdminPage title="My account">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Name</dt><dd>{user.fullName}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Email</dt><dd>{user.email}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Role</dt><dd>{user.role.name}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Last sign-in</dt><dd>{formatDateTime(user.lastLoginAt)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Password changed</dt><dd>{formatDateTime(user.passwordChangedAt)}</dd></div>
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Change password</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit((v) => save.mutate(v))} className="space-y-4" noValidate>
              <Field label="Current password" htmlFor="cp" error={errors.currentPassword?.message}><Input id="cp" type="password" autoComplete="current-password" {...register('currentPassword', { required: 'Required' })} /></Field>
              <Field label="New password" htmlFor="np" error={errors.newPassword?.message} hint="10+ characters with upper- and lower-case letters and a number."><Input id="np" type="password" autoComplete="new-password" {...register('newPassword', { required: 'Required' })} /></Field>
              <Field label="Confirm new password" htmlFor="cf" error={errors.confirm?.message}><Input id="cf" type="password" autoComplete="new-password" {...register('confirm', { validate: (v) => v === watch('newPassword') || 'Passwords do not match' })} /></Field>
              <Button type="submit" disabled={save.isPending}><KeyRound /> Update password</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AdminPage>
  );
}
