const db = require('../config/database');
const { AppError, asyncHandler } = require('../middleware/errorHandler');

const getAdminStats = asyncHandler(async (req, res) => {
    const stats = db.prepare(`
        SELECT 
            (SELECT COUNT(*) FROM users) as total_users,
            (SELECT COUNT(*) FROM users WHERE role = 'admin') as admin_users,
            (SELECT COUNT(*) FROM questions WHERE is_duplicate = 0) as total_questions,
            (SELECT COUNT(*) FROM questions WHERE is_duplicate = 1) as duplicate_questions,
            (SELECT COUNT(*) FROM question_papers) as total_papers,
            (SELECT COUNT(*) FROM bookmarks) as total_bookmarks,
            (SELECT COUNT(*) FROM history) as total_history,
            (SELECT COUNT(*) FROM ai_logs) as ai_requests
    `).get();

    const recentUsers = db.prepare(`
        SELECT id, username, email, role, created_at, last_login
        FROM users
        ORDER BY created_at DESC
        LIMIT 10
    `).all();

    const recentQuestions = db.prepare(`
        SELECT q.id, q.title, q.topic, q.difficulty, q.question_type, q.company, q.created_at, u.username as author
        FROM questions q
        LEFT JOIN users u ON q.user_id = u.id
        WHERE q.is_duplicate = 0
        ORDER BY q.created_at DESC
        LIMIT 20
    `).all();

    const aiUsage = db.prepare(`
        SELECT 
            DATE(created_at) as date,
            COUNT(*) as requests,
            SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful,
            SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed,
            AVG(latency_ms) as avg_latency
        FROM ai_logs
        WHERE created_at >= datetime('now', '-30 days')
        GROUP BY DATE(created_at)
        ORDER BY date DESC
    `).all();

    res.json({
        stats,
        recentUsers,
        recentQuestions,
        aiUsage
    });
});

const getAllUsers = asyncHandler(async (req, res) => {
    const { page = 1, limit = 50, search, role, status } = req.query;

    let query = `
        SELECT id, username, email, full_name, role, is_active, email_verified, created_at, last_login
        FROM users
        WHERE 1=1
    `;
    const params = [];

    if (search) {
        query += ' AND (username LIKE ? OR email LIKE ? OR full_name LIKE ?)';
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (role) {
        query += ' AND role = ?';
        params.push(role);
    }

    if (status) {
        query += ' AND is_active = ?';
        params.push(status === 'active' ? 1 : 0);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

    const users = db.prepare(query).all(...params);

    const countQuery = query.replace('SELECT id, username, email, full_name, role, is_active, email_verified, created_at, last_login', 'SELECT COUNT(*) as total').replace('ORDER BY created_at DESC LIMIT ? OFFSET ?', '');
    const total = db.prepare(countQuery).get(...params.slice(0, -2)).total;

    res.json({
        users,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
        }
    });
});

const updateUser = asyncHandler(async (req, res) => {
    const { username, email, full_name, role, is_active } = req.body;
    const { id } = req.params;

    if (parseInt(id) === req.user.id) {
        throw new AppError('Cannot modify your own account', 400, 'SELF_MODIFY_NOT_ALLOWED');
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    if (role === 'admin' && user.role === 'admin') {
        const adminCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE role = "admin"').get().count;
        if (adminCount <= 1) {
            throw new AppError('Cannot demote the only admin', 400, 'LAST_ADMIN');
        }
    }

    db.prepare(`
        UPDATE users SET username = ?, email = ?, full_name = ?, role = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(username, email, full_name, role, is_active ? 1 : 0, id);

    const updated = db.prepare('SELECT id, username, email, full_name, role, is_active, created_at FROM users WHERE id = ?').get(id);

    res.json({ user: updated });
});

const deleteUser = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (parseInt(id) === req.user.id) {
        throw new AppError('Cannot delete your own account', 400, 'SELF_DELETE_NOT_ALLOWED');
    }

    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(id);
    if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    if (user.role === 'admin') {
        const adminCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE role = "admin"').get().count;
        if (adminCount <= 1) {
            throw new AppError('Cannot delete the only admin', 400, 'LAST_ADMIN');
        }
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(id);

    res.json({ message: 'User deleted successfully' });
});

const getAllQuestions = asyncHandler(async (req, res) => {
    const { page = 1, limit = 50, type, difficulty, search } = req.query;

    let query = `
        SELECT q.*, u.username as author
        FROM questions q
        LEFT JOIN users u ON q.user_id = u.id
        WHERE 1=1
    `;
    const params = [];

    if (type) {
        query += ' AND q.question_type = ?';
        params.push(type);
    }
    if (difficulty) {
        query += ' AND q.difficulty = ?';
        params.push(difficulty);
    }
    if (search) {
        query += ' AND (q.title LIKE ? OR q.topic LIKE ? OR q.question_text LIKE ?)';
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY q.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

    const questions = db.prepare(query).all(...params);

    const countQuery = query.replace('SELECT q.*, u.username as author', 'SELECT COUNT(*) as total').replace('ORDER BY q.created_at DESC LIMIT ? OFFSET ?', '');
    const total = db.prepare(countQuery).get(...params.slice(0, -2)).total;

    res.json({
        questions: questions.map(q => ({
            id: q.id,
            title: q.title,
            topic: q.topic,
            difficulty: q.difficulty,
            type: q.question_type,
            company: q.company,
            author: q.author,
            isDuplicate: Boolean(q.is_duplicate),
            createdAt: q.created_at
        })),
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
        }
    });
});

const deleteQuestion = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const question = db.prepare('SELECT * FROM questions WHERE id = ?').get(id);
    if (!question) {
        throw new AppError('Question not found', 404, 'QUESTION_NOT_FOUND');
    }

    db.prepare('DELETE FROM questions WHERE id = ?').run(id);

    res.json({ message: 'Question deleted successfully' });
});

const clearAiLogs = asyncHandler(async (req, res) => {
    const { before_date } = req.query;

    let query = 'DELETE FROM ai_logs WHERE 1=1';
    const params = [];

    if (before_date) {
        query += ' AND created_at <= ?';
        params.push(before_date);
    }

    const result = db.prepare(query).run(...params);

    res.json({ message: `Cleared ${result.changes} AI log entries` });
});

const clearHistory = asyncHandler(async (req, res) => {
    const { before_date } = req.query;

    let query = 'DELETE FROM history WHERE 1=1';
    const params = [];

    if (before_date) {
        query += ' AND created_at <= ?';
        params.push(before_date);
    }

    const result = db.prepare(query).run(...params);

    res.json({ message: `Cleared ${result.changes} history entries` });
});

const getSystemHealth = asyncHandler(async (req, res) => {
    const dbSize = db.prepare('SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()').get();

    res.json({
        database: {
            size: dbSize.size,
            size_mb: Math.round(dbSize.size / 1024 / 1024 * 100) / 100
        },
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        node_version: process.version,
        platform: process.platform
    });
});

module.exports = {
    getAdminStats,
    getAllUsers,
    updateUser,
    deleteUser,
    getAllQuestions,
    deleteQuestion,
    clearAiLogs,
    clearHistory,
    getSystemHealth
};