import { actorFrom } from '../middleware/auth.js';
import { auditFilterOptions, listAuditLogs } from '../services/auditService.js';
import * as contentService from '../services/contentService.js';
import { getDashboard } from '../services/dashboardService.js';
import * as heroService from '../services/heroService.js';
import * as inquiryService from '../services/inquiryService.js';
import * as userService from '../services/userService.js';
import { toCsv } from '../utils/csv.js';
import { pageMeta, paginate } from '../utils/pagination.js';
import { created, noContent, ok } from '../utils/response.js';

const id = (req) => req.valid.params.id;

export async function dashboard(_req, res) {
  ok(res, await getDashboard());
}

// --------------------------------------------------------------- Inquiries
export const inquiries = {
  list: async (req, res) => {
    const { rows, meta } = await inquiryService.listInquiries(req.valid.query);
    ok(res, rows, meta);
  },
  get: async (req, res) => ok(res, await inquiryService.getInquiry(id(req))),
  update: async (req, res) => ok(res, await inquiryService.updateInquiry(id(req), req.valid.body, actorFrom(req))),
  addNote: async (req, res) => created(res, await inquiryService.addNote(id(req), req.valid.body.note, actorFrom(req))),
  staff: async (_req, res) => ok(res, await inquiryService.staffOptions()),
  exportCsv: async (req, res) => {
    const rows = await inquiryService.exportInquiries(req.valid.query, actorFrom(req));
    const csv = toCsv(rows, [
      { label: 'ID', key: 'id' },
      { label: 'Submitted', key: 'createdAt' },
      { label: 'Status', key: 'status' },
      { label: 'Customer', key: 'customerName' },
      { label: 'Phone', key: 'phone' },
      { label: 'Email', key: 'email' },
      { label: 'Preferred contact', key: 'preferredContact' },
      { label: 'Property reference', key: 'propertyReference' },
      { label: 'Property', value: (r) => r.property?.title ?? '' },
      { label: 'Message', key: 'message' },
      { label: 'Assigned to', value: (r) => r.assignedTo?.fullName ?? '' },
      { label: 'Follow-up', key: 'followUpAt' },
      { label: 'Source', key: 'source' },
    ]);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="inquiries-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  },
};

// ------------------------------------------------------- Content/settings
export const content = {
  list: async (_req, res) => ok(res, await contentService.listContent()),
  update: async (req, res) => ok(res, await contentService.updateContent(req.valid.params.key, req.valid.body, actorFrom(req))),
};

export const settings = {
  list: async (_req, res) => ok(res, await contentService.listSettings()),
  update: async (req, res) => ok(res, await contentService.updateSettings(req.valid.body.values, actorFrom(req))),
};

// --------------------------------------------------------------- Home hero
export const hero = {
  get: async (_req, res) => ok(res, await heroService.getHeroAdmin()),
  createSlide: async (req, res) => created(res, await heroService.createSlide(req.valid.body, actorFrom(req))),
  updateSlide: async (req, res) => ok(res, await heroService.updateSlide(id(req), req.valid.body, actorFrom(req))),
  reorder: async (req, res) => ok(res, await heroService.reorderSlides(req.valid.body.slideIds, actorFrom(req))),
  deleteSlide: async (req, res) => {
    await heroService.deleteSlide(id(req), actorFrom(req));
    noContent(res);
  },
  updateSettings: async (req, res) => ok(res, await heroService.updateHeroSettings(req.valid.body, actorFrom(req))),
};

// ------------------------------------------------------------ Users/roles
export const users = {
  list: async (req, res) => {
    const { rows, meta } = await userService.listUsers(req.valid.query);
    ok(res, rows, meta);
  },
  create: async (req, res) => created(res, await userService.createUser(req.valid.body, actorFrom(req))),
  update: async (req, res) => ok(res, await userService.updateUser(id(req), req.valid.body, actorFrom(req))),
};

export const roles = {
  list: async (_req, res) => ok(res, await userService.listRoles()),
  create: async (req, res) => created(res, await userService.createRole(req.valid.body, actorFrom(req))),
  update: async (req, res) => ok(res, await userService.updateRole(id(req), req.valid.body, actorFrom(req))),
  remove: async (req, res) => {
    await userService.deleteRole(id(req), actorFrom(req));
    noContent(res);
  },
};

// -------------------------------------------------------------- Audit log
export const auditLogs = {
  list: async (req, res) => {
    const page = paginate({ page: req.valid.query.page, limit: req.valid.query.limit ?? 25 });
    const { rows, total } = await listAuditLogs(req.valid.query, page);
    ok(res, rows, pageMeta(page, total));
  },
  filters: async (_req, res) => ok(res, await auditFilterOptions()),
};
