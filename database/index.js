const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, '..', 'database');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'qgen.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schema = `
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'moderator')),
  is_verified INTEGER DEFAULT 0,
  last_login_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Questions table
CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT UNIQUE NOT NULL,
  user_id INTEGER,
  question TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('mcq', 'coding', 'debugging', 'prediction', 'theory', 'scenario')),
  topic TEXT NOT NULL,
  subtopic TEXT,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('Easy', 'Medium', 'Hard', 'Mixed')),
  language TEXT,
  company TEXT,
  bloom_taxonomy TEXT DEFAULT 'apply',
  learning_outcome TEXT,
  details_json TEXT NOT NULL,
  hash TEXT UNIQUE,
  similarity_hash TEXT,
  is_ai_generated INTEGER DEFAULT 1,
  generation_params_json TEXT,
  view_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Question Papers table
CREATE TABLE IF NOT EXISTS question_papers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT UNIQUE NOT NULL,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  paper_type TEXT NOT NULL CHECK (paper_type IN ('mcq', 'coding', 'debugging', 'prediction', 'theory', 'mixed')),
  difficulty TEXT NOT NULL CHECK (difficulty IN ('Easy', 'Medium', 'Hard', 'Mixed')),
  total_questions INTEGER NOT NULL,
  total_marks INTEGER DEFAULT 0,
  time_limit_minutes INTEGER,
  exam_format TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  questions_json TEXT NOT NULL,
  settings_json TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Bookmarks table
CREATE TABLE IF NOT EXISTS bookmarks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  question_id INTEGER NOT NULL,
  folder TEXT DEFAULT 'Favorites',
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
  UNIQUE(user_id, question_id)
);

-- History table
CREATE TABLE IF NOT EXISTS history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  question_id INTEGER,
  paper_id INTEGER,
  action_type TEXT NOT NULL CHECK (action_type IN ('generated', 'viewed', 'attempted', 'bookmarked', 'exported')),
  metadata_json TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE SET NULL,
  FOREIGN KEY (paper_id) REFERENCES question_papers(id) ON DELETE SET NULL
);

-- Exams/Attempts table
CREATE TABLE IF NOT EXISTS exams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT UNIQUE NOT NULL,
  user_id INTEGER NOT NULL,
  paper_id INTEGER,
  title TEXT NOT NULL,
  questions_json TEXT NOT NULL,
  answers_json TEXT,
  score REAL,
  correct_count INTEGER,
  total_questions INTEGER,
  time_taken_seconds INTEGER,
  started_at DATETIME,
  completed_at DATETIME,
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (paper_id) REFERENCES question_papers(id) ON DELETE SET NULL
);

-- AI Logs table
CREATE TABLE IF NOT EXISTS ai_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  prompt TEXT NOT NULL,
  response TEXT,
  model TEXT,
  tokens_used INTEGER,
  duration_ms INTEGER,
  success INTEGER DEFAULT 0,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Question Analytics table
CREATE TABLE IF NOT EXISTS question_analytics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id INTEGER NOT NULL,
  view_count INTEGER DEFAULT 0,
  attempt_count INTEGER DEFAULT 0,
  correct_count INTEGER DEFAULT 0,
  avg_time_seconds REAL,
  difficulty_rating REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
);

-- Saved Papers table
CREATE TABLE IF NOT EXISTS saved_papers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  paper_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (paper_id) REFERENCES question_papers(id) ON DELETE CASCADE,
  UNIQUE(user_id, paper_id)
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
  is_read INTEGER DEFAULT 0,
  related_entity_type TEXT,
  related_entity_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Settings table
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  key TEXT NOT NULL,
  value TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, key)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_questions_user_id ON questions(user_id);
CREATE INDEX IF NOT EXISTS idx_questions_type ON questions(type);
CREATE INDEX IF NOT EXISTS idx_questions_topic ON questions(topic);
CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON questions(difficulty);
CREATE INDEX IF NOT EXISTS idx_questions_hash ON questions(hash);
CREATE INDEX IF NOT EXISTS idx_questions_created_at ON questions(created_at);
CREATE INDEX IF NOT EXISTS idx_question_papers_user_id ON question_papers(user_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_history_user_id ON history(user_id);
CREATE INDEX IF NOT EXISTS idx_exams_user_id ON exams(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_logs_user_id ON ai_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
`;

db.exec(schema);

const crypto = require('crypto');

function generateHash(question, type) {
  const content = `${question.question}-${question.type}-${JSON.stringify(question.details)}`;
  return crypto.createHash('sha256').update(content).digest('hex').substring(0, 32);
}

function generateSimilarityHash(question) {
  const words = question.question.toLowerCase().match(/\b\w{4,}\b/g) || [];
  const sorted = words.sort().join(' ');
  return crypto.createHash('md5').update(sorted).digest('hex').substring(0, 16);
}

function isDuplicate(db, question, type, excludeId = null) {
  const hash = generateHash(question, type);
  const simHash = generateSimilarityHash(question);
  
  let query = 'SELECT id FROM questions WHERE (hash = ? OR similarity_hash = ?)';
  const params = [hash, simHash];
  
  if (excludeId) {
    query += ' AND id != ?';
    params.push(excludeId);
  }
  
  const existing = db.prepare(query).get(...params);
  return !!existing;
}

const uuid = require('uuid');

const stmt = {
  // Users
  createUser: db.prepare(`
    INSERT INTO users (uuid, email, password_hash, name, avatar_url, role)
    VALUES (?, ?, ?, ?, ?, ?)
  `),
  getUserByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
  getUserById: db.prepare('SELECT * FROM users WHERE id = ?'),
  getUserByUuid: db.prepare('SELECT * FROM users WHERE uuid = ?'),
  updateUser: db.prepare(`
    UPDATE users SET name = ?, avatar_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `),
  updateLastLogin: db.prepare('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?'),
  
  // Questions
  createQuestion: db.prepare(`
    INSERT INTO questions (uuid, user_id, question, type, topic, subtopic, difficulty, language, company, 
      bloom_taxonomy, learning_outcome, details_json, hash, similarity_hash, is_ai_generated, generation_params_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  getQuestion: db.prepare('SELECT * FROM questions WHERE id = ?'),
  getQuestionByUuid: db.prepare('SELECT * FROM questions WHERE uuid = ?'),
  getQuestions: db.prepare(`
    SELECT * FROM questions 
    WHERE user_id = ? 
    ORDER BY created_at DESC 
    LIMIT ? OFFSET ?
  `),
  getQuestionsByType: db.prepare(`
    SELECT * FROM questions 
    WHERE type = ? AND user_id = ?
    ORDER BY created_at DESC
  `),
  updateQuestion: db.prepare(`
    UPDATE questions SET question = ?, details_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `),
  deleteQuestion: db.prepare('DELETE FROM questions WHERE id = ?'),
  searchQuestions: db.prepare(`
    SELECT * FROM questions 
    WHERE (question LIKE ? OR topic LIKE ? OR subtopic LIKE ?) AND user_id = ?
    ORDER BY created_at DESC
  `),
  
  // Question Papers
  createPaper: db.prepare(`
    INSERT INTO question_papers (uuid, user_id, title, description, paper_type, difficulty, total_questions, 
      total_marks, time_limit_minutes, exam_format, status, questions_json, settings_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  getPaper: db.prepare('SELECT * FROM question_papers WHERE id = ?'),
  getPaperByUuid: db.prepare('SELECT * FROM question_papers WHERE uuid = ?'),
  getPapers: db.prepare(`
    SELECT * FROM question_papers 
    WHERE user_id = ? 
    ORDER BY created_at DESC 
    LIMIT ? OFFSET ?
  `),
  updatePaper: db.prepare(`
    UPDATE question_papers SET title = ?, description = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `),
  deletePaper: db.prepare('DELETE FROM question_papers WHERE id = ?'),
  
  // Bookmarks
  createBookmark: db.prepare(`
    INSERT INTO bookmarks (user_id, question_id, folder, notes) VALUES (?, ?, ?, ?)
  `),
  getBookmarks: db.prepare(`
    SELECT b.*, q.* FROM bookmarks b
    JOIN questions q ON b.question_id = q.id
    WHERE b.user_id = ? AND (b.folder = ? OR ? = '')
    ORDER BY b.created_at DESC
  `),
  deleteBookmark: db.prepare('DELETE FROM bookmarks WHERE user_id = ? AND question_id = ?'),
  
  // History
  addHistory: db.prepare(`
    INSERT INTO history (user_id, question_id, paper_id, action_type, metadata_json)
    VALUES (?, ?, ?, ?, ?)
  `),
  getHistory: db.prepare(`
    SELECT h.*, q.question, q.type, q.topic, q.difficulty, q.details_json
    FROM history h
    LEFT JOIN questions q ON h.question_id = q.id
    WHERE h.user_id = ?
    ORDER BY h.created_at DESC
    LIMIT ? OFFSET ?
  `),
  
  // Exams
  createExam: db.prepare(`
    INSERT INTO exams (uuid, user_id, paper_id, title, questions_json, started_at, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `),
  updateExam: db.prepare(`
    UPDATE exams SET answers_json = ?, score = ?, correct_count = ?, total_questions = ?,
      time_taken_seconds = ?, completed_at = ?, status = ? WHERE id = ?
  `),
  getExam: db.prepare('SELECT * FROM exams WHERE id = ?'),
  getExams: db.prepare(`
    SELECT * FROM exams WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?
  `),
  
  // AI Logs
  logAI: db.prepare(`
    INSERT INTO ai_logs (user_id, prompt, response, model, tokens_used, duration_ms, success, error_message)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `),
  getAILogs: db.prepare(`
    SELECT * FROM ai_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?
  `),
  
  // Analytics
  getAnalytics: db.prepare(`
    SELECT 
      COUNT(*) as total_questions,
      COUNT(DISTINCT topic) as unique_topics,
      COUNT(CASE WHEN created_at > datetime('now', '-1 day') THEN 1 END) as daily_count,
      COUNT(CASE WHEN created_at > datetime('now', '-7 day') THEN 1 END) as weekly_count,
      AVG(CASE WHEN type = 'mcq' THEN 1 ELSE 0 END) * 100 as mcq_percentage,
      COUNT(CASE WHEN difficulty = 'Easy' THEN 1 END) as easy_count,
      COUNT(CASE WHEN difficulty = 'Medium' THEN 1 END) as medium_count,
      COUNT(CASE WHEN difficulty = 'Hard' THEN 1 END) as hard_count
    FROM questions WHERE user_id = ?
  `),
  getTopicStats: db.prepare(`
    SELECT topic, COUNT(*) as count FROM questions WHERE user_id = ? GROUP BY topic ORDER BY count DESC LIMIT 10
  `),
  getDifficultyStats: db.prepare(`
    SELECT difficulty, COUNT(*) as count FROM questions WHERE user_id = ? GROUP BY difficulty
  `),
  getLanguageStats: db.prepare(`
    SELECT language, COUNT(*) as count FROM questions WHERE user_id = ? AND language != '' GROUP BY language ORDER BY count DESC
  `),
  getTimelineStats: db.prepare(`
    SELECT date(created_at) as date, COUNT(*) as count 
    FROM questions WHERE user_id = ? AND created_at > datetime('now', '-30 day')
    GROUP BY date(created_at) ORDER BY date
  `),
  
  // Notifications
  createNotification: db.prepare(`
    INSERT INTO notifications (user_id, title, message, type, related_entity_type, related_entity_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `),
  getNotifications: db.prepare(`
    SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?
  `),
  markNotificationRead: db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?'),
  
  // Settings
  getSetting: db.prepare('SELECT value FROM settings WHERE user_id = ? AND key = ?'),
  setSetting: db.prepare(`
    INSERT INTO settings (user_id, key, value) VALUES (?, ?, ?)
    ON CONFLICT(user_id, key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP
  `),
  getSettings: db.prepare('SELECT key, value FROM settings WHERE user_id = ?'),
  
  // Saved Papers
  savePaper: db.prepare('INSERT OR IGNORE INTO saved_papers (user_id, paper_id) VALUES (?, ?)'),
  unsavePaper: db.prepare('DELETE FROM saved_papers WHERE user_id = ? AND paper_id = ?'),
  getSavedPapers: db.prepare(`
    SELECT p.*, sp.created_at as saved_at FROM question_papers p
    JOIN saved_papers sp ON p.id = sp.paper_id
    WHERE sp.user_id = ? ORDER BY sp.created_at DESC
  `)
};

function close() {
  db.close();
}

module.exports = { db, stmt, generateHash, generateSimilarityHash, isDuplicate, close };