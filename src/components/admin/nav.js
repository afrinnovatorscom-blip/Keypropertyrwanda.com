import {
  BarChart3,
  Building2,
  FileText,
  Flame,
  FolderTree,
  History,
  Images,
  Inbox,
  LayoutDashboard,
  Megaphone,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
} from 'lucide-react';

/** Admin navigation; each entry is shown only when the user holds `permission`. */
export const ADMIN_NAV = [
  { group: 'Overview', items: [{ to: '/admin', label: 'Dashboard', icon: LayoutDashboard, permission: 'dashboard.view', end: true }] },
  {
    group: 'Listings',
    items: [
      { to: '/admin/properties', label: 'Properties', icon: Building2, permission: 'properties.view' },
      { to: '/admin/categories', label: 'Categories', icon: FolderTree, permission: 'categories.view' },
      { to: '/admin/inquiries', label: 'Inquiries', icon: Inbox, permission: 'inquiries.view' },
    ],
  },
  {
    group: 'Marketing',
    items: [
      { to: '/admin/featured', label: 'Featured Properties', icon: Star, permission: 'featured.view' },
      { to: '/admin/hot-deals', label: 'Hot Deals', icon: Flame, permission: 'hot_deals.view' },
      { to: '/admin/advertisements', label: 'Advertisements', icon: Megaphone, permission: 'advertisements.view' },
      { to: '/admin/promotions', label: 'Promotions', icon: Sparkles, permission: 'promotions.view' },
      { to: '/admin/analytics', label: 'Campaign Analytics', icon: BarChart3, permission: 'analytics.view' },
    ],
  },
  {
    group: 'Administration',
    items: [
      { to: '/admin/hero', label: 'Home Hero', icon: Images, permission: 'content.view' },
      { to: '/admin/content', label: 'Website Content', icon: FileText, permission: 'content.view' },
      { to: '/admin/users', label: 'Users', icon: Users, permission: 'users.view' },
      { to: '/admin/roles', label: 'Roles & Permissions', icon: ShieldCheck, permission: 'roles.view' },
      { to: '/admin/settings', label: 'Settings', icon: Settings, permission: 'settings.view' },
      { to: '/admin/audit-logs', label: 'Audit Logs', icon: History, permission: 'audit_logs.view' },
    ],
  },
];
