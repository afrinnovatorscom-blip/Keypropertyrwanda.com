import { useQuery } from '@tanstack/react-query';
import { AlarmClock, Archive, BellRing, Building2, CheckCircle2, FilePen, Flame, Inbox, KeyRound, Megaphone, Plus, Sparkles, Star, Tag } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AdminPage, StatCard, TableCard } from '@/components/admin/AdminUi';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState, ErrorState, Spinner } from '@/components/ui/feedback';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import { formatDateTime, label, timeLeft } from '@/lib/format';
import { adminApi } from '@/services/adminApi';

const EXPIRY_LINKS = { hot_deal: '/admin/hot-deals', featured: '/admin/featured', advertisement: '/admin/advertisements', promotion: '/admin/promotions' };
const EXPIRY_LABELS = { hot_deal: 'Hot deal', featured: 'Featured', advertisement: 'Advert', promotion: 'Promotion' };

export default function Dashboard() {
  const { can, user } = useAuth();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin', 'dashboard'], queryFn: adminApi.dashboard, refetchInterval: 60_000 });

  if (isLoading) return <Spinner />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  const { properties: p, campaigns: c, inquiries: i } = data;

  return (
    <AdminPage
      title={`Welcome, ${user.fullName.split(' ')[0]}`}
      description="Live figures calculated from the database."
      actions={
        <>
          {can('properties.create') && <Button asChild><Link to="/admin/properties/new"><Plus /> New property</Link></Button>}
          {can('inquiries.view') && <Button asChild variant="outline"><Link to="/admin/inquiries?status=new"><Inbox /> New inquiries ({i.new})</Link></Button>}
        </>
      }
    >
      <section aria-label="Property metrics" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total properties" value={p.total} icon={Building2} hint={`${p.archived} archived`} />
        <StatCard label="Published" value={p.published} icon={CheckCircle2} tone="success" />
        <StatCard label="Drafts" value={p.drafts} icon={FilePen} tone="accent" hint={`${p.unpublished} unpublished`} />
        <StatCard label="Sold / rented" value={`${p.sold} / ${p.rented}`} icon={Archive} tone="info" />
        <StatCard label="For sale" value={p.forSale} icon={Tag} hint={`${p.liveForSale} live & available`} />
        <StatCard label="For rent" value={p.forRent} icon={KeyRound} hint={`${p.liveForRent} live & available`} />
        <StatCard label="New inquiries" value={i.new} icon={BellRing} tone="accent" />
        <StatCard label="Inquiries in progress" value={i.in_progress} icon={Inbox} tone="info" hint={`${i.followUpsDue} follow-ups due`} />
      </section>

      <section aria-label="Campaign metrics" className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Active featured" value={c.activeFeatured} icon={Star} tone="accent" />
        <StatCard label="Active hot deals" value={c.activeHotDeals} icon={Flame} tone="danger" />
        <StatCard label="Active adverts" value={c.activeAdvertisements} icon={Megaphone} />
        <StatCard label="Active promotions" value={c.activePromotions} icon={Sparkles} tone="success" />
        <StatCard label="Expiring soon" value={c.expiringSoonCount} icon={AlarmClock} tone="danger" hint={`within ${c.expiryWindowDays} days`} className="col-span-2 lg:col-span-1" />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardHeader><CardTitle>Campaigns approaching expiry</CardTitle></CardHeader>
          <CardContent>
            {!data.expiringSoon.length ? (
              <p className="text-sm text-muted-foreground">Nothing expires in the next {c.expiryWindowDays} days.</p>
            ) : (
              <ul className="divide-y">
                {data.expiringSoon.map((e) => (
                  <li key={`${e.type}-${e.id}`} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="min-w-0">
                      <span className="mr-2 rounded bg-muted px-1.5 py-0.5 text-xs font-medium">{EXPIRY_LABELS[e.type]}</span>
                      <Link to={EXPIRY_LINKS[e.type]} className="font-medium hover:text-primary">{e.name}</Link>
                    </span>
                    <span className="shrink-0 text-xs text-red-700">{timeLeft(e.endAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Recent inquiries</h2>
            {can('inquiries.view') && <Link to="/admin/inquiries" className="text-sm font-medium text-primary hover:underline">View all</Link>}
          </div>
          {!data.recentInquiries.length ? (
            <EmptyState title="No inquiries yet" />
          ) : (
            <TableCard>
              <Table>
                <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Property</TableHead><TableHead>Status</TableHead><TableHead>Received</TableHead></TableRow></TableHeader>
                <TableBody>
                  {data.recentInquiries.map((q) => (
                    <TableRow key={q.id}>
                      <TableCell>{can('inquiries.view') ? <Link to={`/admin/inquiries/${q.id}`} className="font-medium hover:text-primary">{q.customerName}</Link> : q.customerName}</TableCell>
                      <TableCell className="max-w-48 truncate">{q.property?.title ?? <span className="text-muted-foreground">General</span>}</TableCell>
                      <TableCell><StatusBadge status={q.status}>{label('inquiry', q.status)}</StatusBadge></TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(q.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableCard>
          )}
        </div>
      </div>
    </AdminPage>
  );
}
