import { ExternalLink, KeyRound, LogOut, Menu, ShieldAlert, X } from 'lucide-react';
import { Suspense, useEffect, useState } from 'react';
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ADMIN_NAV } from '@/components/admin/nav';
import { Logo } from '@/components/layout/Logo';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/feedback';
import { useAuth } from '@/contexts/AuthContext';
import { useSeo } from '@/lib/seo';
import { cn } from '@/lib/utils';

function Sidebar({ onNavigate }) {
  const { can } = useAuth();
  return (
    <nav aria-label="Administration" className="space-y-6 p-4">
      {ADMIN_NAV.map((section) => {
        const items = section.items.filter((i) => can(i.permission));
        if (!items.length) return null;
        return (
          <div key={section.group}>
            <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-white/50">{section.group}</p>
            <ul className="space-y-0.5">
              {items.map(({ to, label, icon: Icon, end }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={end}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn('flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition', isActive ? 'bg-white/15 text-white' : 'text-white/75 hover:bg-white/10 hover:text-white')
                    }
                  >
                    <Icon className="size-4" /> {label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

export default function AdminLayout() {
  const { user, isLoading, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  useSeo({ title: 'Admin', noindex: true });
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  if (isLoading) return <div className="flex min-h-screen items-center justify-center"><Spinner /></div>;
  if (!user) return <Navigate to="/admin/login" replace state={{ from: location.pathname + location.search }} />;

  const signOut = async () => {
    await logout();
    navigate('/admin/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-muted/40">
      <aside className={cn('fixed inset-y-0 left-0 z-50 w-64 overflow-y-auto bg-[#0b3742] transition-transform lg:translate-x-0', open ? 'translate-x-0' : '-translate-x-full')}>
        <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
          <Logo light to="/admin" />
          <button type="button" className="text-white lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu"><X className="size-5" /></button>
        </div>
        <Sidebar onNavigate={() => setOpen(false)} />
      </aside>
      {open && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setOpen(false)} aria-hidden="true" />}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b bg-background px-4 sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="size-5" /></Button>
          <div className="hidden text-sm text-muted-foreground lg:block">Key Property Rwanda · Administration</div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm"><a href="/" target="_blank" rel="noopener noreferrer"><ExternalLink /> <span className="hidden sm:inline">View site</span></a></Button>
            <Button asChild variant="ghost" size="sm"><Link to="/admin/account"><KeyRound /> <span className="hidden sm:inline">{user.fullName}</span></Link></Button>
            <span className="hidden rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground md:inline">{user.role.name}</span>
            <Button variant="outline" size="sm" onClick={signOut}><LogOut /> <span className="hidden sm:inline">Sign out</span></Button>
          </div>
        </header>
        <main className="p-4 sm:p-6 lg:p-8">
          <Suspense fallback={<Spinner />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}

/** Renders children only when the user has the permission; otherwise an access-denied panel. */
export function RequirePermission({ permission, children }) {
  const { can } = useAuth();
  if (can(permission)) return children;
  return (
    <div className="mx-auto mt-16 max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
      <ShieldAlert className="mx-auto mb-3 size-10 text-destructive" />
      <h1 className="text-lg font-semibold">Access denied</h1>
      <p className="mt-1 text-sm text-muted-foreground">Your role does not include access to this section. Contact a Super Admin if you need it.</p>
      <Button asChild variant="outline" className="mt-5"><Link to="/admin">Back to dashboard</Link></Button>
    </div>
  );
}
