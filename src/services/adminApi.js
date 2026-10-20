import { api, setCsrfToken } from '@/lib/api';

const crud = (base) => ({
  list: (query) => api.getPage(base, query),
  get: (id) => api.get(`${base}/${id}`),
  create: (body) => api.post(base, body),
  update: (id, body) => api.put(`${base}/${id}`, body),
  action: (id, action) => api.post(`${base}/${id}/${action}`),
  remove: (id) => api.delete(`${base}/${id}`),
});

export const authApi = {
  me: async () => {
    const data = await api.get('/auth/me');
    setCsrfToken(data.csrfToken);
    return data.user;
  },
  login: async (body) => {
    const data = await api.post('/auth/login', body);
    setCsrfToken(data.csrfToken);
    return data.user;
  },
  logout: async () => {
    await api.post('/auth/logout');
    setCsrfToken(null);
  },
  changePassword: (body) => api.post('/auth/change-password', body),
};

export const adminApi = {
  dashboard: () => api.get('/admin/dashboard'),

  properties: {
    ...crud('/admin/properties'),
    options: (query) => api.get('/admin/properties/options', query),
    setAvailability: (id, status) => api.post(`/admin/properties/${id}/availability`, { status }),
    uploadImages: (id, files) => {
      const form = new FormData();
      for (const file of files) form.append('images', file);
      return api.upload(`/admin/properties/${id}/images`, form);
    },
    reorderImages: (id, imageIds) => api.put(`/admin/properties/${id}/images/order`, { imageIds }),
    updateImage: (id, imageId, altText) => api.patch(`/admin/properties/${id}/images/${imageId}`, { altText }),
    deleteImage: (id, imageId) => api.delete(`/admin/properties/${id}/images/${imageId}`),
  },
  amenities: () => api.get('/admin/amenities'),
  categories: {
    list: () => api.get('/admin/categories'),
    create: (body) => api.post('/admin/categories', body),
    update: (id, body) => api.put(`/admin/categories/${id}`, body),
    remove: (id) => api.delete(`/admin/categories/${id}`),
  },
  featured: crud('/admin/featured'),
  hotDeals: { ...crud('/admin/hot-deals'), calculate: (body) => api.post('/admin/hot-deals/calculate', body) },
  advertisements: { ...crud('/admin/advertisements'), placements: () => api.get('/admin/advertisement-placements') },
  promotions: crud('/admin/promotions'),
  analytics: (query) => api.get('/admin/analytics', query),
  uploadImage: (folder, file) => {
    const form = new FormData();
    form.append('image', file);
    return api.upload('/admin/uploads', form, { folder });
  },

  inquiries: {
    list: (query) => api.getPage('/admin/inquiries', query),
    get: (id) => api.get(`/admin/inquiries/${id}`),
    update: (id, body) => api.patch(`/admin/inquiries/${id}`, body),
    addNote: (id, note) => api.post(`/admin/inquiries/${id}/notes`, { note }),
    staff: () => api.get('/admin/inquiries/staff'),
  },

  hero: {
    get: () => api.get('/admin/hero'),
    createSlide: (body) => api.post('/admin/hero/slides', body),
    updateSlide: (id, body) => api.put(`/admin/hero/slides/${id}`, body),
    deleteSlide: (id) => api.delete(`/admin/hero/slides/${id}`),
    reorder: (slideIds) => api.put('/admin/hero/slides/order', { slideIds }),
    updateSettings: (body) => api.put('/admin/hero/settings', body),
  },
  content: { list: () => api.get('/admin/content'), update: (key, body) => api.put(`/admin/content/${key}`, body) },
  settings: { list: () => api.get('/admin/settings'), update: (values) => api.put('/admin/settings', { values }) },
  users: { list: (query) => api.getPage('/admin/users', query), create: (body) => api.post('/admin/users', body), update: (id, body) => api.put(`/admin/users/${id}`, body) },
  roles: {
    list: () => api.get('/admin/roles'),
    create: (body) => api.post('/admin/roles', body),
    update: (id, body) => api.put(`/admin/roles/${id}`, body),
    remove: (id) => api.delete(`/admin/roles/${id}`),
  },
  auditLogs: { list: (query) => api.getPage('/admin/audit-logs', query), filters: () => api.get('/admin/audit-logs/filters') },
};
