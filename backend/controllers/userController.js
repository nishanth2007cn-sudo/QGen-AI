const db = require('../database');
const bcrypt = require('bcryptjs');
const { asyncHandler, formatDate, paginate, buildPaginationResponse, parseJsonSafe } = require('../utils/helpers');
const logger = require('../utils/logger');

const getUsers = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  
  const { page, limit, offset } = paginate(req.query.page, req.query.limit);
  const { search } = req.query;
  
  let where = 'WHERE 1=1';
  const params = [];
  
  if (search) { where += ' AND (name LIKE ? OR email LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  
  const total = db.prepare(`SELECT COUNT(*) as count FROM users ${where}`).get(...params).count;
  const users = db.prepare(`SELECT id, email, name, role, avatar_url, created_at, last_login_at FROM users ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
  
  res.json(buildPaginationResponse(users, page, limit, total));
});

const getUser = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin' && req.user.id !== parseInt(req.params.id)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  const user = db.prepare('SELECT id, email, name, role, avatar_url, created_at, last_login_at FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  const settings = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(user.id);
  
  res.json({ user, settings });
});

const updateUser = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin' && req.user.id !== parseInt(req.params.id)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  const { name, avatar_url, role } = req.body;
  const userId = req.params.id;
  
  const updates = [];
  const params = [];
  
  if (name !== undefined) { updates.push('name = ?'); params.push(name); }
  if (avatar_url !== undefined) { updates.push('avatar_url = ?'); params.push(avatar_url); }
  if (role !== undefined && req.user.role === 'admin') { updates.push('role = ?'); params.push(role); }
  
  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
  
  params.push(userId);
  db.prepare(`UPDATE users SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...params);
  
  const user = db.prepare('SELECT id, email, name, role, avatar_url, created_at FROM users WHERE id = ?').get(userId);
  res.json({ user });
});

const deleteUser = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  if (req.user.id === parseInt(req.params.id)) return res.status(400).json({ error: 'Cannot delete yourself' });
  
  const result = db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'User not found' });
  
  res.json({ message: 'User deleted successfully' });
});

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.id;
  
  const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId);
  const valid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });
  
  const passwordHash = await bcrypt.hash(newPassword, 12);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, userId);
  
  db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(userId);
  
  res.json({ message: 'Password changed successfully' });
});

const uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  
  const avatarUrl = `/uploads/avatars/${req.file.filename}`;
  db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(avatarUrl, req.user.id);
  
  res.json({ avatarUrl });
});

const getNotifications = asyncHandler(async (req, res) => {
  const { page, limit, offset } = paginate(req.query.page, req.query.limit);
  const { unreadOnly } = req.query;
  
  let where = 'WHERE user_id = ?';
  const params = [req.user.id];
  
  if (unreadOnly === 'true') { where += ' AND is_read = 0'; }
  
  const total = db.prepare(`SELECT COUNT(*) as count FROM notifications ${where}`).get(...params).count;
  const notifications = db.prepare(`SELECT * FROM notifications ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
  
  res.json(buildPaginationResponse(notifications, page, limit, total));
});

const markNotificationRead = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(id, req.user.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Notification not found' });
  res.json({ message: 'Marked as read' });
});

const markAllNotificationsRead = asyncHandler(async (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0').run(req.user.id);
  res.json({ message: 'All notifications marked as read' });
});

const getDashboardStats = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  
  const stats = {
    totalQuestions: db.prepare('SELECT COUNT(*) as count FROM questions WHERE user_id = ?').get(userId).count,
    totalPapers: db.prepare('SELECT COUNT(*) as count FROM papers WHERE user_id = ?').get(userId).count,
    totalBookmarks: db.prepare('SELECT COUNT(*) as count FROM bookmarks WHERE user_id = ?').get(userId).count,
    totalSaved: db.prepare('SELECT COUNT(*) as count FROM saved_questions WHERE user_id = ?').get(userId).count,
    recentPapers: db.prepare('SELECT id, title, subject, difficulty, question_count, score, created_at FROM papers WHERE user_id = ? ORDER BY created_at DESC LIMIT 5').all(userId),
    recentQuestions: db.prepare('SELECT id, topic, type, difficulty, created_at FROM questions WHERE user_id = ? ORDER BY created_at DESC LIMIT 5').all(userId),
    upcomingExams: db.prepare('SELECT id, title, subject, difficulty, question_count, time_limit, created_at FROM papers WHERE user_id = ? AND score IS NULL ORDER BY created_at LIMIT 5').all(userId)
  };
  
  res.json(stats);
});

module.exports = {
  getUsers,
  getUser,
  updateUser,
  deleteUser,
  changePassword,
  uploadAvatar,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getDashboardStats
};