const db = require('../config/database');
const { AppError, asyncHandler } = require('../middleware/errorHandler');

const getHistory = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, type, startDate, endDate } = req.query;

    let query = `
        SELECT h.*, q.title, q.topic, q.difficulty, q.question_type
        FROM history h
        LEFT JOIN questions q ON h.question_id = q.id
        WHERE h.user_id = ?
    `;
    const params = [req.user.id];

    if (type) {
        query += ' AND h.action_type = ?';
        params.push(type);
    }

    if (startDate) {
        query += ' AND h.created_at >= ?';
        params.push(startDate);
    }

    if (endDate) {
        query += ' AND h.created_at <= ?';
        params.push(endDate);
    }

    query += ' ORDER BY h.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

    const history = db.prepare(query).all(...params);

    const countQuery = query.replace('SELECT h.*, q.title, q.topic, q.difficulty, q.question_type', 'SELECT COUNT(*) as total').replace('ORDER BY h.created_at DESC LIMIT ? OFFSET ?', '');
    const total = db.prepare(countQuery).get(...params.slice(0, -2)).total;

    res.json({
        history: history.map(h => ({
            id: h.id,
            actionType: h.action_type,
            questionId: h.question_id,
            questionTitle: h.title,
            topic: h.topic,
            difficulty: h.difficulty,
            questionType: h.question_type,
            metadata: h.metadata ? JSON.parse(h.metadata) : null,
            createdAt: h.created_at
        })),
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
        }
    });
});

const addToHistory = asyncHandler(async (req, res) => {
    const { action_type, question_id, metadata } = req.body;

    const stmt = db.prepare(`
        INSERT INTO history (user_id, action_type, question_id, metadata)
        VALUES (?, ?, ?, ?)
    `);

    const result = stmt.run(req.user.id, action_type, question_id || null, metadata ? JSON.stringify(metadata) : null);

    res.status(201).json({
        message: 'History entry added',
        id: result.lastInsertRowid
    });
});

const clearHistory = asyncHandler(async (req, res) => {
    const { before_date } = req.query;

    let query = 'DELETE FROM history WHERE user_id = ?';
    const params = [req.user.id];

    if (before_date) {
        query += ' AND created_at <= ?';
        params.push(before_date);
    }

    const result = db.prepare(query).run(...params);

    res.json({ message: `Cleared ${result.changes} history entries` });
});

const getRecentActivity = asyncHandler(async (req, res) => {
    const { limit = 10 } = req.query;

    const activity = db.prepare(`
        SELECT h.*, q.title, q.topic, q.difficulty, q.question_type
        FROM history h
        LEFT JOIN questions q ON h.question_id = q.id
        WHERE h.user_id = ?
        ORDER BY h.created_at DESC
        LIMIT ?
    `).all(req.user.id, parseInt(limit));

    res.json({
        activity: activity.map(a => ({
            id: a.id,
            actionType: a.action_type,
            questionId: a.question_id,
            questionTitle: a.title,
            topic: a.topic,
            difficulty: a.difficulty,
            questionType: a.question_type,
            metadata: a.metadata ? JSON.parse(a.metadata) : null,
            createdAt: a.created_at
        }))
    });
});

const getStats = asyncHandler(async (req, res) => {
    const { period = 'week' } = req.query;

    let dateFilter = '';
    switch (period) {
        case 'day':
            dateFilter = "AND created_at >= datetime('now', '-1 day')";
            break;
        case 'week':
            dateFilter = "AND created_at >= datetime('now', '-7 days')";
            break;
        case 'month':
            dateFilter = "AND created_at >= datetime('now', '-30 days')";
            break;
        case 'year':
            dateFilter = "AND created_at >= datetime('now', '-365 days')";
            break;
    }

    const stats = db.prepare(`
        SELECT 
            COUNT(*) as total_questions,
            COUNT(DISTINCT topic) as topics_covered,
            COUNT(CASE WHEN difficulty = 'Easy' THEN 1 END) as easy_count,
            COUNT(CASE WHEN difficulty = 'Medium' THEN 1 END) as medium_count,
            COUNT(CASE WHEN difficulty = 'Hard' THEN 1 END) as hard_count,
            COUNT(CASE WHEN question_type = 'mcq' THEN 1 END) as mcq_count,
            COUNT(CASE WHEN question_type = 'coding' THEN 1 END) as coding_count,
            COUNT(CASE WHEN question_type = 'debugging' THEN 1 END) as debugging_count,
            COUNT(CASE WHEN question_type = 'prediction' THEN 1 END) as prediction_count
        FROM questions
        WHERE user_id = ? AND is_duplicate = 0
    `).get(req.user.id);

    const recentActivity = db.prepare(`
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM history
        WHERE user_id = ? ${dateFilter}
        GROUP BY DATE(created_at)
        ORDER BY date DESC
        LIMIT 30
    `).all(req.user.id);

    const topicDistribution = db.prepare(`
        SELECT topic, COUNT(*) as count
        FROM questions
        WHERE user_id = ? AND is_duplicate = 0
        GROUP BY topic
        ORDER BY count DESC
        LIMIT 10
    `).all(req.user.id);

    const companyDistribution = db.prepare(`
        SELECT company, COUNT(*) as count
        FROM questions
        WHERE user_id = ? AND is_duplicate = 0 AND company IS NOT NULL AND company != ''
        GROUP BY company
        ORDER BY count DESC
        LIMIT 10
    `).all(req.user.id);

    const difficultyOverTime = db.prepare(`
        SELECT 
            DATE(created_at) as date,
            difficulty,
            COUNT(*) as count
        FROM questions
        WHERE user_id = ? AND is_duplicate = 0 ${dateFilter}
        GROUP BY DATE(created_at), difficulty
        ORDER BY date
    `).all(req.user.id);

    res.json({
        stats,
        recentActivity,
        topicDistribution,
        companyDistribution,
        difficultyOverTime
    });
});

module.exports = {
    getHistory,
    addToHistory,
    clearHistory,
    getRecentActivity,
    getStats
};