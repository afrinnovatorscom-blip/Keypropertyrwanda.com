import { useQuery } from '@tanstack/react-query';
import { Info, MousePointerClick, Percent, Send, View } from 'lucide-react';
import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AdminPage, FilterBar, StatCard, TableCard } from '@/components/admin/AdminUi';
import { StatusBadge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState, ErrorState, Spinner } from '@/components/ui/feedback';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { label } from '@/lib/format';
import { adminApi } from '@/services/adminApi';

// Validated categorical slots (CVD-safe pair): 1 = impressions/views, 2 = clicks.
const SERIES = { views: '#2a78d6', clicks: '#eb6834' };
const AXIS = { stroke: '#5b6b71', fontSize: 12 };
const GRID = '#e6ecee';

const isoDay = (d) => d.toISOString().slice(0, 10);

function ChartTooltip({ active, payload, label: title }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-background px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-semibold">{title}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2">
          <span className="inline-block size-2.5 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="ml-auto font-medium tabular-nums">{p.value.toLocaleString()}</span>
        </p>
      ))}
    </div>
  );
}

function PerformanceTable({ title, rows, viewLabel, viewKey, showAttributed = true }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="p-0">
        {!rows.length ? <p className="p-5 text-sm text-muted-foreground">No data for this period.</p> : (
          <TableCard>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead><TableHead>Status</TableHead>
                  <TableHead className="text-right">{viewLabel}</TableHead><TableHead className="text-right">Clicks</TableHead><TableHead className="text-right">CTR</TableHead>
                  {showAttributed && <TableHead className="text-right">Attributed inquiries</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell><p className="font-medium">{r.name}</p>{r.placement && <p className="text-xs text-muted-foreground">{r.placement}</p>}</TableCell>
                    <TableCell>{r.status ? <StatusBadge status={r.status}>{label('campaign', r.status)}</StatusBadge> : <StatusBadge status={r.isActive ? 'active' : 'paused'}>{r.isActive ? 'Active' : 'Inactive'}</StatusBadge>}</TableCell>
                    <TableCell className="text-right tabular-nums">{r[viewKey].toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.clicks.toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.ctr}%</TableCell>
                    {showAttributed && <TableCell className="text-right tabular-nums">{r.attributedInquiries ?? 0}</TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableCard>
        )}
      </CardContent>
    </Card>
  );
}

export default function Analytics() {
  const today = new Date();
  const [range, setRange] = useState({ from: isoDay(new Date(today.getTime() - 29 * 86400000)), to: isoDay(today) });
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin', 'analytics', range], queryFn: () => adminApi.analytics(range) });

  return (
    <AdminPage title="Campaign Analytics" description="Advertisement, promotion, hot deal and featured placement performance.">
      <FilterBar>
        <Field label="From" htmlFor="an-from" className="sm:w-44"><Input id="an-from" type="date" value={range.from} max={range.to} onChange={(e) => e.target.value && setRange((r) => ({ ...r, from: e.target.value }))} /></Field>
        <Field label="To" htmlFor="an-to" className="sm:w-44"><Input id="an-to" type="date" value={range.to} min={range.from} onChange={(e) => e.target.value && setRange((r) => ({ ...r, to: e.target.value }))} /></Field>
      </FilterBar>

      {error ? <ErrorState error={error} onRetry={refetch} /> : isLoading ? <Spinner /> : (
        <>
          <section aria-label="Advertising totals" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Ad impressions" value={data.totals.impressions.toLocaleString()} icon={View} />
            <StatCard label="Ad clicks" value={data.totals.clicks.toLocaleString()} icon={MousePointerClick} tone="accent" />
            <StatCard label="Click-through rate" value={`${data.totals.ctr}%`} icon={Percent} tone="info" />
            <StatCard label="Attributed inquiries" value={data.totals.attributedInquiries} icon={Send} tone="success" hint="Click-through in same session" />
          </section>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Daily ad impressions and clicks</CardTitle></CardHeader>
              <CardContent>
                {!data.daily.length ? <EmptyState title="No ad events in this period" /> : (
                  <div className="h-72" role="img" aria-label="Line chart of daily advertisement impressions and clicks; values are listed in the tables below.">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data.daily} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                        <CartesianGrid stroke={GRID} vertical={false} />
                        <XAxis dataKey="day" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
                        <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} width={40} />
                        <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#5b6b71', strokeDasharray: '3 3' }} />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                        <Line type="monotone" dataKey="impressions" name="Impressions" stroke={SERIES.views} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 5 }} />
                        <Line type="monotone" dataKey="clicks" name="Clicks" stroke={SERIES.clicks} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 5 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Placement performance</CardTitle></CardHeader>
              <CardContent>
                <div className="h-72" role="img" aria-label="Bar chart of impressions and clicks per advertisement placement; values are listed in the table below.">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.placements} margin={{ top: 8, right: 16, left: 0, bottom: 0 }} barGap={2}>
                      <CartesianGrid stroke={GRID} vertical={false} />
                      <XAxis dataKey="name" tick={{ ...AXIS, fontSize: 11 }} tickLine={false} axisLine={{ stroke: GRID }} interval={0} angle={-20} textAnchor="end" height={60} />
                      <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} width={40} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(15,76,92,0.06)' }} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="impressions" name="Impressions" fill={SERIES.views} radius={[4, 4, 0, 0]} maxBarSize={28} />
                      <Bar dataKey="clicks" name="Clicks" fill={SERIES.clicks} radius={[4, 4, 0, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <PerformanceTable title="Placements" rows={data.placements} viewLabel="Impressions" viewKey="impressions" showAttributed={false} />
          <PerformanceTable title="Advertisements" rows={data.advertisements} viewLabel="Impressions" viewKey="impressions" />
          <PerformanceTable title="Promotions" rows={data.promotions} viewLabel="Views" viewKey="views" />
          <PerformanceTable title="Hot deals" rows={data.hotDeals} viewLabel="Views" viewKey="views" />
          <PerformanceTable title="Featured placements" rows={data.featured} viewLabel="Views" viewKey="views" showAttributed={false} />

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Info className="size-4" /> How events are counted</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                {Object.entries(data.definitions).map(([k, v]) => (
                  <div key={k}><dt className="font-semibold capitalize">{k.replace(/([A-Z])/g, ' $1')}</dt><dd className="text-muted-foreground">{v}</dd></div>
                ))}
              </dl>
              <p className="mt-4 text-xs text-muted-foreground">Visitors are identified by an anonymous hash that rotates daily; no IP addresses are stored. Known bots are excluded. Sales are never inferred from these figures.</p>
            </CardContent>
          </Card>
        </>
      )}
    </AdminPage>
  );
}
