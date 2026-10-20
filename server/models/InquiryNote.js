import { executor } from '../config/database.js';

const map = (r) => ({
  id: r.id,
  inquiryId: r.inquiry_id,
  note: r.note,
  author: r.user_id ? { id: r.user_id, fullName: r.full_name } : null,
  createdAt: r.created_at,
});

export const InquiryNote = {
  async listForInquiry(inquiryId, conn) {
    const [rows] = await executor(conn).query(
      `SELECT n.*, u.full_name FROM inquiry_notes n LEFT JOIN users u ON u.id = n.user_id
       WHERE n.inquiry_id = ? ORDER BY n.created_at DESC, n.id DESC`,
      [inquiryId],
    );
    return rows.map(map);
  },

  async create({ inquiryId, userId, note }, conn) {
    const [result] = await executor(conn).query(
      'INSERT INTO inquiry_notes (inquiry_id, user_id, note) VALUES (?, ?, ?)',
      [inquiryId, userId ?? null, note],
    );
    return result.insertId;
  },
};

export default InquiryNote;
