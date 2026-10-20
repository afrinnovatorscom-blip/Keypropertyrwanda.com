// Canonical permission catalog and system role defaults.
// `npm run db:migrate` synchronises these into the permissions/roles tables.

export const PERMISSIONS = [
  ['dashboard.view', 'View dashboard', 'dashboard'],

  ['properties.view', 'View property records', 'properties'],
  ['properties.create', 'Create properties and save drafts', 'properties'],
  ['properties.edit', 'Edit property details and images', 'properties'],
  ['properties.change_price', 'Change property prices', 'properties'],
  ['properties.change_availability', 'Change property availability', 'properties'],
  ['properties.publish', 'Publish and unpublish properties', 'properties'],
  ['properties.archive', 'Archive and restore properties', 'properties'],
  ['properties.export', 'Export property records', 'properties'],

  ['categories.view', 'View categories', 'categories'],
  ['categories.manage', 'Create, edit and deactivate categories', 'categories'],

  ['featured.view', 'View featured placements', 'featured'],
  ['featured.manage', 'Create, schedule and deactivate featured placements', 'featured'],

  ['hot_deals.view', 'View hot deals', 'hot_deals'],
  ['hot_deals.create', 'Create and edit draft hot deals', 'hot_deals'],
  ['hot_deals.publish', 'Schedule, activate, pause and end hot deals', 'hot_deals'],
  ['hot_deals.verify_price', 'Verify original prices shown on hot deals', 'hot_deals'],

  ['advertisements.view', 'View advertisements', 'advertisements'],
  ['advertisements.create', 'Create and edit advertisements', 'advertisements'],
  ['advertisements.publish', 'Publish, schedule and pause advertisements', 'advertisements'],
  ['advertisements.archive', 'Archive advertisements', 'advertisements'],

  ['promotions.view', 'View promotions', 'promotions'],
  ['promotions.create', 'Create and edit promotions', 'promotions'],
  ['promotions.publish', 'Publish, schedule and pause promotions', 'promotions'],
  ['promotions.archive', 'Archive promotions', 'promotions'],

  ['analytics.view', 'View campaign analytics', 'analytics'],

  ['inquiries.view', 'View customer inquiries', 'inquiries'],
  ['inquiries.manage', 'Update inquiries, add notes and follow-ups', 'inquiries'],
  ['inquiries.export', 'Export inquiries', 'inquiries'],

  ['content.view', 'View website content', 'content'],
  ['content.manage', 'Edit website content', 'content'],

  ['users.view', 'View users', 'users'],
  ['users.manage', 'Create, edit and suspend users', 'users'],

  ['roles.view', 'View roles and permissions', 'roles'],
  ['roles.manage', 'Manage roles and permissions', 'roles'],

  ['settings.view', 'View business settings', 'settings'],
  ['settings.manage', 'Manage business settings', 'settings'],

  ['audit_logs.view', 'View audit logs', 'audit_logs'],
].map(([slug, name, module]) => ({ slug, name, module }));

export const ALL_PERMISSION_SLUGS = PERMISSIONS.map((p) => p.slug);

export const SUPER_ADMIN_ROLE = 'super_admin';

export const SYSTEM_ROLES = [
  {
    slug: SUPER_ADMIN_ROLE,
    name: 'Super Admin',
    description: 'Full access to every module, including users, roles and settings.',
    permissions: ALL_PERMISSION_SLUGS,
  },
  {
    slug: 'property_manager',
    name: 'Property Manager',
    description: 'Manages listings, prices, availability, categories and featured placements.',
    permissions: [
      'dashboard.view',
      'properties.view', 'properties.create', 'properties.edit', 'properties.change_price',
      'properties.change_availability', 'properties.publish', 'properties.archive', 'properties.export',
      'categories.view', 'categories.manage',
      'featured.view', 'featured.manage',
      'hot_deals.view', 'advertisements.view', 'promotions.view',
      'inquiries.view',
    ],
  },
  {
    slug: 'marketing_manager',
    name: 'Marketing Manager',
    description: 'Runs featured placements, hot deals, advertisements, promotions and analytics.',
    permissions: [
      'dashboard.view',
      'properties.view', 'categories.view',
      'featured.view', 'featured.manage',
      'hot_deals.view', 'hot_deals.create', 'hot_deals.publish', 'hot_deals.verify_price',
      'advertisements.view', 'advertisements.create', 'advertisements.publish', 'advertisements.archive',
      'promotions.view', 'promotions.create', 'promotions.publish', 'promotions.archive',
      'analytics.view',
      'inquiries.view',
    ],
  },
  {
    slug: 'inquiry_officer',
    name: 'Inquiry Officer',
    description: 'Handles customer inquiries, follow-ups and internal notes.',
    permissions: ['dashboard.view', 'properties.view', 'inquiries.view', 'inquiries.manage', 'inquiries.export'],
  },
  {
    slug: 'content_manager',
    name: 'Content Manager',
    description: 'Maintains website pages and public business information.',
    permissions: ['dashboard.view', 'properties.view', 'categories.view', 'content.view', 'content.manage', 'settings.view'],
  },
  {
    slug: 'viewer',
    name: 'Viewer',
    description: 'Read-only access to listings, campaigns and inquiries.',
    permissions: [
      'dashboard.view', 'properties.view', 'categories.view', 'featured.view', 'hot_deals.view',
      'advertisements.view', 'promotions.view', 'analytics.view', 'inquiries.view', 'content.view',
    ],
  },
];
