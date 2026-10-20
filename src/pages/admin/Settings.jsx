import { useQuery } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AdminPage, useAdminMutation } from '@/components/admin/AdminUi';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState, Spinner } from '@/components/ui/feedback';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { ApiError } from '@/lib/api';
import { adminApi } from '@/services/adminApi';

const EMPTY = [];
const GROUP_TITLES ={ company: 'Company', contact: 'Contact details', social: 'Social media', listings: 'Listings', inquiries: 'Inquiries', hero: 'Home hero (also editable under Home Hero)' };

export default function Settings() {
  const { can } = useAuth();
  const manage = can('settings.manage');
  const { data: loaded, isLoading, error, refetch } = useQuery({ queryKey: ['admin', 'settings'], queryFn: adminApi.settings.list });
  const data = loaded ?? EMPTY;
  const [values, setValues] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  useEffect(() => {
    if (loaded) setValues(Object.fromEntries(loaded.map((s) => [s.key, s.value ?? ''])));
  }, [loaded]);

  const save = useAdminMutation(() => {
    const changed = Object.fromEntries(data.filter((s) => (s.value ?? '') !== values[s.key]).map((s) => [s.key, values[s.key]]));
    return adminApi.settings.update(changed);
  }, {
    success: 'Settings saved',
    invalidate: [['admin', 'settings'], ['site']],
    onSuccess: () => setFieldErrors({}),
    onError: (e) => {
      if (e instanceof ApiError && e.details) {
        setFieldErrors(Object.fromEntries(e.details.map((d) => [d.path, d.message])));
      }
    },
  });

  if (isLoading) return <Spinner />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  const groups = [...new Set(data.map((s) => s.group))];

  return (
    <AdminPage title="Settings" description="Business information used across the website. Public settings are visible to visitors.">
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-6">
        {groups.map((group) => (
          <Card key={group}>
            <CardHeader><CardTitle>{GROUP_TITLES[group] ?? group}</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {data.filter((s) => s.group === group).map((s) => (
                <Field key={s.key} htmlFor={`s-${s.key}`} error={fieldErrors[s.key]} label={<span className="flex items-center gap-2">{s.label}{!s.isPublic && <Badge variant="muted">Internal</Badge>}</span>}>
                  <Input id={`s-${s.key}`} value={values[s.key] ?? ''} disabled={!manage} onChange={(e) => setValues((v) => ({ ...v, [s.key]: e.target.value }))} />
                </Field>
              ))}
            </CardContent>
          </Card>
        ))}
        {manage && <div className="flex justify-end"><Button type="submit" disabled={save.isPending}><Save /> Save settings</Button></div>}
      </form>
    </AdminPage>
  );
}
