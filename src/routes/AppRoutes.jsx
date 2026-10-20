import { lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import AdminLayout, { RequirePermission } from '@/layouts/AdminLayout';
import PublicLayout from '@/layouts/PublicLayout';
import About from '@/pages/About';
import Contact from '@/pages/Contact';
import FeaturedProperties from '@/pages/FeaturedProperties';
import Home from '@/pages/Home';
import HotDeals from '@/pages/HotDeals';
import NotFound from '@/pages/NotFound';
import PrivacyPolicy from '@/pages/PrivacyPolicy';
import Properties from '@/pages/Properties';
import PropertyDetails from '@/pages/PropertyDetails';
import Promotions, { PromotionDetails } from '@/pages/Promotions';
import Terms from '@/pages/Terms';

// The administration area is code-split so public visitors never download it.
const Login = lazy(() => import('@/pages/admin/Login'));
const Dashboard = lazy(() => import('@/pages/admin/Dashboard'));
const AdminProperties = lazy(() => import('@/pages/admin/Properties'));
const PropertyEditor = lazy(() => import('@/pages/admin/PropertyEditor'));
const PropertyPreview = lazy(() => import('@/pages/admin/PropertyPreview'));
const Categories = lazy(() => import('@/pages/admin/Categories'));
const Featured = lazy(() => import('@/pages/admin/Featured'));
const AdminHotDeals = lazy(() => import('@/pages/admin/HotDeals'));
const Advertisements = lazy(() => import('@/pages/admin/Advertisements'));
const AdminPromotions = lazy(() => import('@/pages/admin/Promotions'));
const Analytics = lazy(() => import('@/pages/admin/Analytics'));
const Inquiries = lazy(() => import('@/pages/admin/Inquiries'));
const InquiryDetail = lazy(() => import('@/pages/admin/InquiryDetail'));
const Content = lazy(() => import('@/pages/admin/Content'));
const HomeHero = lazy(() => import('@/pages/admin/HomeHero'));
const Users = lazy(() => import('@/pages/admin/Users'));
const Roles = lazy(() => import('@/pages/admin/Roles'));
const Settings = lazy(() => import('@/pages/admin/Settings'));
const AuditLogs = lazy(() => import('@/pages/admin/AuditLogs'));
const Account = lazy(() => import('@/pages/admin/Account'));

const guard = (permission, element) => <RequirePermission permission={permission}>{element}</RequirePermission>;

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<Home />} />
        <Route path="properties" element={<Properties key="all" variant="all" />} />
        <Route path="properties/for-sale" element={<Properties key="sale" variant="sale" />} />
        <Route path="properties/for-rent" element={<Properties key="rent" variant="rent" />} />
        <Route path="properties/houses-apartments" element={<Properties key="residential" variant="residential" />} />
        <Route path="properties/land-plots" element={<Properties key="land" variant="land" />} />
        <Route path="properties/commercial" element={<Properties key="commercial" variant="commercial" />} />
        <Route path="property/:slug" element={<PropertyDetails />} />
        <Route path="featured" element={<FeaturedProperties />} />
        <Route path="hot-deals" element={<HotDeals />} />
        <Route path="promotions" element={<Promotions />} />
        <Route path="promotions/:slug" element={<PromotionDetails />} />
        <Route path="about" element={<About />} />
        <Route path="contact" element={<Contact />} />
        <Route path="privacy-policy" element={<PrivacyPolicy />} />
        <Route path="terms-and-conditions" element={<Terms />} />
        <Route path="*" element={<NotFound />} />
      </Route>

      <Route path="admin/login" element={<Login />} />
      <Route path="admin" element={<AdminLayout />}>
        <Route index element={guard('dashboard.view', <Dashboard />)} />
        <Route path="properties" element={guard('properties.view', <AdminProperties />)} />
        <Route path="properties/new" element={guard('properties.create', <PropertyEditor />)} />
        <Route path="properties/:id" element={guard('properties.view', <PropertyEditor />)} />
        <Route path="properties/:id/preview" element={guard('properties.view', <PropertyPreview />)} />
        <Route path="categories" element={guard('categories.view', <Categories />)} />
        <Route path="featured" element={guard('featured.view', <Featured />)} />
        <Route path="hot-deals" element={guard('hot_deals.view', <AdminHotDeals />)} />
        <Route path="advertisements" element={guard('advertisements.view', <Advertisements />)} />
        <Route path="promotions" element={guard('promotions.view', <AdminPromotions />)} />
        <Route path="analytics" element={guard('analytics.view', <Analytics />)} />
        <Route path="inquiries" element={guard('inquiries.view', <Inquiries />)} />
        <Route path="inquiries/:id" element={guard('inquiries.view', <InquiryDetail />)} />
        <Route path="hero" element={guard('content.view', <HomeHero />)} />
        <Route path="content" element={guard('content.view', <Content />)} />
        <Route path="users" element={guard('users.view', <Users />)} />
        <Route path="roles" element={guard('roles.view', <Roles />)} />
        <Route path="settings" element={guard('settings.view', <Settings />)} />
        <Route path="audit-logs" element={guard('audit_logs.view', <AuditLogs />)} />
        <Route path="account" element={<Account />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
