import { api, request } from '@/lib/api';

export const publicApi = {
  site: () => api.get('/site'),
  hero: () => api.get('/hero'),
  content: (key) => api.get(`/content/${key}`),
  categories: () => api.get('/categories'),
  locations: () => api.get('/locations'),
  properties: (query) => api.getPage('/properties', query),
  property: (slug) => api.get(`/properties/${slug}`),
  featured: (limit = 12) => api.get('/featured', { limit }),
  hotDeals: (query) => api.getPage('/hot-deals', query),
  promotions: (placement) => api.get('/promotions', { placement }),
  promotion: (slug) => api.get(`/promotions/${slug}`),
  advertisements: (placement) => api.get('/advertisements', { placement }),
  submitInquiry: (body) => request('/inquiries', { method: 'POST', body }).then((r) => r.data),
};
