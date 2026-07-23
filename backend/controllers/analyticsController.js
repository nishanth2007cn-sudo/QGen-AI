const db = require('../database');
const { asyncHandler, paginate, buildPaginationResponse, parseJsonSafe, formatDate, generateQuestionHash, calculateSimilarity } = require('../utils/helpers');
const logger = require('../utils/logger');
const aiService = require('../ai/service');

const getSavedQuestions = asyncHandler(async (req, res) => {
  const { page, limit, offset } = paginate(req.query.page, req.query.limit);
  const { folder } = req.query;
  const userId = req.user.id;
  
  let where = 'WHERE s.user_id = ?';
  const params = [userId];
  
  if (folder) { where += ' AND s.folder = ?'; params.push(folder); }
  
  const total = db.prepare(`SELECT COUNT(*) as count FROM saved_questions s ${where}`).get(...params).count;
  
  const saved = db.prepare(`
    SELECT s.*, q.* FROM saved_questions s
    JOIN questions q ON s.question_id = q.id
    ${where} ORDER BY s.created_at DESC LIMIT ? OFFSET ?
  `).all(...params, limit, offset);
  
  const formatted = saved.map(s => ({
    ...s,
    details: parseJsonSafe(s.details, {}),
    folder: s.folder,
    notes: s.notes,
    savedAt: formatDate(s.created_at)
  }));
  
  res.json(buildPaginationResponse(formatted, page, limit, total));
});

const saveQuestion = asyncHandler(async (req, res) => {
  const { question_id, folder = 'Favorites', notes } = req.body;
  const userId = req.user.id;
  
  const question = db.prepare('SELECT id FROM questions WHERE id = ?').get(question_id);
  if (!question) return res.status(404).json({ error: 'Question not found' });
  
  try {
    db.prepare('INSERT INTO saved_questions (user_id, question_id, folder, notes) VALUES (?, ?, ?, ?)')
      .run(userId, question_id, folder, notes || null);
    
    res.status(201).json({ message: 'Question saved successfully' });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Question already saved' });
    }
    throw error;
  }
});

const unsaveQuestion = asyncHandler(async (req, res) => {
  const { question_id } = req.params;
  const userId = req.user.id;
  
  const result = db.prepare('DELETE FROM saved_questions WHERE user_id = ? AND question_id = ?').run(userId, question_id);
  if (result.changes === 0) return res.status(404).json({ error: 'Saved question not found' });
  
  res.json({ message: 'Question removed from saved' });
});

const updateSavedQuestion = asyncHandler(async (req, res) => {
  const { question_id } = req.params;
  const { folder, notes } = req.body;
  const userId = req.user.id;
  
  const updates = [];
  const params = [];
  
  if (folder !== undefined) { updates.push('folder = ?'); params.push(folder); }
  if (notes !== undefined) { updates.push('notes = ?'); params.push(notes); }
  
  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
  
  params.push(userId, question_id);
  db.prepare(`UPDATE saved_questions SET ${updates.join(', ')} WHERE user_id = ? AND question_id = ?`).run(...params);
  
  res.json({ message: 'Saved question updated' });
});

const getFolders = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  
  const bookmarkFolders = db.prepare('SELECT DISTINCT folder FROM bookmarks WHERE user_id = ?').all(userId).map(r => r.folder);
  const savedFolders = db.prepare('SELECT DISTINCT folder FROM saved_questions WHERE user_id = ?').all(userId).map(r => r.folder);
  
  const folders = [...new Set([...bookmarkFolders, ...savedFolders, 'Favorites', 'Placement', 'Interview', 'College', 'Easy', 'Medium', 'Hard'])];
  res.json({ folders });
});

const getHistory = asyncHandler(async (req, res) => {
  const { page, limit, offset } = paginate(req.query.page, req.query.limit);
  const { type, action } = req.query;
  const userId = req.user.id;
  
  let where = 'WHERE user_id = ?';
  const params = [userId];
  
  if (type) { where += ' AND type = ?'; params.push(type); }
  if (action) { where += ' AND action = ?'; params.push(action); }
  
  const total = db.prepare(`SELECT COUNT(*) as count FROM question_history ${where}`).get(...params).count;
  
  const history = db.prepare(`
    SELECT * FROM question_history ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?
  `).all(...params, limit, offset);
  
  res.json(buildPaginationResponse(history, page, limit, total));
});

const addToHistory = asyncHandler(async (req, res) => {
  const { question_id, action, details } = req.body;
  const userId = req.user.id;
  
  db.prepare('INSERT INTO question_history (question_id, user_id, action, details) VALUES (?, ?, ?, ?)')
    .run(question_id, userId, action, details ? JSON.stringify(details) : null);
  
  res.status(201).json({ message: 'History recorded' });
});

const clearHistory = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  db.prepare('DELETE FROM question_history WHERE user_id = ?').run(userId);
  res.json({ message: 'History cleared' });
});

const getAnalytics = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const now = Date.now();
  const day = 86400000;
  
  const totalQuestions = db.prepare('SELECT COUNT(*) as count FROM questions WHERE user_id = ?').get(userId).count;
  const recentQuestions = db.prepare('SELECT COUNT(*) as count FROM questions WHERE user_id = ? AND created_at > datetime("now", "-1 day")').get(userId).count;
  const weeklyQuestions = db.prepare('SELECT COUNT(*) as count FROM questions WHERE user_id = ? AND created_at > datetime("now", "-7 day")').get(userId).count;
  
  const bookmarksCount = db.prepare('SELECT COUNT(*) as count FROM bookmarks WHERE user_id = ?').get(userId).count;
  const savedCount = db.prepare('SELECT COUNT(*) as count FROM saved_questions WHERE user_id = ?').get(userId).count;
  const papersCount = db.prepare('SELECT COUNT(*) as count FROM papers WHERE user_id = ?').get(userId).count;
  
  const topics = db.prepare('SELECT topic, COUNT(*) as count FROM questions WHERE user_id = ? GROUP BY topic ORDER BY count DESC LIMIT 10').all(userId);
  const difficulties = db.prepare('SELECT difficulty, COUNT(*) as count FROM questions WHERE user_id = ? GROUP BY difficulty').all(userId);
  const types = db.prepare('SELECT type, COUNT(*) as count FROM questions WHERE user_id = ? GROUP BY type').all(userId);
  const languages = db.prepare('SELECT language, COUNT(*) as count FROM questions WHERE user_id = ? AND language IS NOT NULL GROUP BY language ORDER BY count DESC').all(userId);
  
  const timelineData = [];
  const timelineLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now - i * day);
    const dayStart = new Date(date.setHours(0,0,0,0));
    const dayEnd = new Date(date.setHours(23,59,59,999));
    const count = db.prepare('SELECT COUNT(*) as count FROM questions WHERE user_id = ? AND created_at BETWEEN ? AND ?').get(userId, dayStart.toISOString(), dayEnd.toISOString()).count;
    timelineData.push(count);
  }
  
  const recentActivity = db.prepare(`
    SELECT q.*, 'Generated' as action, q.created_at as timestamp 
    FROM questions q WHERE q.user_id = ? ORDER BY q.created_at DESC LIMIT 10
  `).all(userId);
  
  const strongTopics = topics.slice(0, 3).map(t => t.topic);
  const weakTopics = topics.slice(3, 6).map(t => t.topic);
  
  const companyReadiness = db.prepare(`
    SELECT company, COUNT(*) as count FROM questions WHERE user_id = ? AND company IS NOT NULL GROUP BY company
  `).all(userId).map(c => ({
    company: c.company,
    readiness: Math.min(100, 30 + c.count * 15)
  }));
  
  const badges = totalQuestions > 0 ? [
    { name: 'First Steps', icon: 'fa-rocket', desc: 'Generated your first practice set' }
  ] : [];
  
  res.json({
    totalQuestions,
    dailyCount: recentQuestions,
    weeklyCount: weeklyQuestions,
    bookmarksCount,
    savedCount,
    papersCount,
    strongTopics,
    weakTopics,
    companyReadiness,
    timelineLabels,
    timelineData,
    difficultyDist: difficulties.reduce((acc, d) => (acc[d.difficulty] = d.count, acc), {}),
    categories: topics.map(t => t.topic),
    counts: topics.map(t => t.count),
    badges,
    activityFeed: recentActivity.map(a => ({
      description: `Generated ${a.details?.title || a.question}`,
      timestamp: formatDate(a.timestamp)
    }))
  });
});

const getAIUsageStats = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  
  const totalRequests = db.prepare('SELECT COUNT(*) as count FROM ai_logs WHERE user_id = ?').get(userId).count;
  const successfulRequests = db.prepare('SELECT COUNT(*) as count FROM ai_logs WHERE user_id = ? AND success = 1').get(userId).count;
  const totalTokens = db.prepare('SELECT SUM(tokens_used) as total FROM ai_logs WHERE user_id = ?').get(userId).total || 0;
  const avgDuration = db.prepare('SELECT AVG(duration_ms) as avg FROM ai_logs WHERE user_id = ?').get(userId).avg || 0;
  
  const byModel = db.prepare('SELECT model, COUNT(*) as count FROM ai_logs WHERE user_id = ? GROUP BY model').all(userId);
  const byType = db.prepare('SELECT json_extract(prompt, "$.type") as type, COUNT(*) as count FROM ai_logs WHERE user_id = ? GROUP BY type').all(userId);
  
  res.json({ totalRequests, successfulRequests, successRate: totalRequests ? (successfulRequests / totalRequests * 100).toFixed(1) : 0, totalTokens, avgDuration: Math.round(avgDuration), byModel, byType });
});

module.exports = {
  getSavedQuestions,
  saveQuestion,
  unsaveQuestion,
  updateSavedQuestion,
  getFolders,
  getHistory,
  addToHistory,
  clearHistory,
  getAnalytics,
  getAIUsageStats
};