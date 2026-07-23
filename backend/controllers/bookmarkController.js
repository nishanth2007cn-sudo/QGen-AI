const db = require('../config/database');
const { AppError, asyncHandler } = require('../middleware/errorHandler');

const addBookmark = asyncHandler(async (req, res) => {
    const { question_id, folder = 'Favorites' } = req.body;

    if (!question_id) {
        throw new AppError('Question ID is required', 400, 'QUESTION_ID_REQUIRED');
    }

    const question = db.prepare('SELECT * FROM questions WHERE id = ? AND is_duplicate = 0').get(question_id);
    if (!question) {
        throw new AppError('Question not found', 404, 'QUESTION_NOT_FOUND');
    }

    const existing = db.prepare('SELECT * FROM bookmarks WHERE user_id = ? AND question_id = ?').get(req.user.id, question_id);
    
    if (existing) {
        throw new AppError('Question already bookmarked', 409, 'ALREADY_BOOKMARKED');
    }

    const insertBookmark = db.prepare(`
        INSERT INTO bookmarks (user_id, question_id, folder)
        VALUES (?, ?, ?)
    `);

    const result = insertBookmark.run(req.user.id, question_id, folder);

    res.status(201).json({
        message: 'Bookmark added successfully',
        bookmark: {
            id: result.lastInsertRowid,
            questionId: question_id,
            folder,
            createdAt: new Date().toISOString()
        }
    });
});

const getBookmarks = asyncHandler(async (req, res) => {
    const { folder, page = 1, limit = 20, search } = req.query;

    let query = `
        SELECT b.*, q.title, q.topic, q.subtopic, q.company, q.difficulty, q.question_type, q.question_text, q.correct_answer, q.explanation
        FROM bookmarks b
        JOIN questions q ON q.id = b.question_id
        WHERE b.user_id = ? AND q.is_duplicate = 0
    `;
    const params = [req.user.id];

    if (folder && folder !== 'All') {
        query += ' AND b.folder = ?';
        params.push(folder);
    }

    if (search) {
        query += ' AND (q.title LIKE ? OR q.question_text LIKE ? OR q.topic LIKE ?)';
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY b.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

    const bookmarks = db.prepare(query).all(...params);

    const totalQuery = query.replace('SELECT b.*, q.title, q.topic, q.subtopic, q.company, q.difficulty, q.question_type, q.question_text, q.correct_answer, q.explanation', 'SELECT COUNT(*) as total').replace('ORDER BY b.created_at DESC LIMIT ? OFFSET ?', '');
    const total = db.prepare(totalQuery).get(...params.slice(0, -2)).total;

    const folders = db.prepare('SELECT DISTINCT folder FROM bookmarks WHERE user_id = ?').all(req.user.id).map(f => f.folder);

    res.json({
        bookmarks: bookmarks.map(b => ({
            id: b.id,
            questionId: b.question_id,
            folder: b.folder,
            createdAt: b.created_at,
            question: {
                id: b.question_id,
                title: b.title,
                topic: b.topic,
                subtopic: b.subtopic,
                company: b.company,
                difficulty: b.difficulty,
                type: b.question_type,
                questionText: b.question_text,
                correctAnswer: b.correct_answer,
                explanation: b.explanation
            }
        })),
        folders,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
        }
    });
});

const removeBookmark = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { question_id } = req.body;

    let query = 'DELETE FROM bookmarks WHERE id = ? AND user_id = ?';
    let params = [id, req.user.id];

    if (question_id) {
        query = 'DELETE FROM bookmarks WHERE question_id = ? AND user_id = ?';
        params = [question_id, req.user.id];
    }

    const result = db.prepare(query).run(...params);

    if (result.changes === 0) {
        throw new AppError('Bookmark not found', 404, 'BOOKMARK_NOT_FOUND');
    }

    res.json({ message: 'Bookmark removed successfully' });
});

const updateBookmarkFolder = asyncHandler(async (req, res) => {
    const { folder } = req.body;

    if (!folder) {
        throw new AppError('Folder name is required', 400, 'FOLDER_REQUIRED');
    }

    const result = db.prepare('UPDATE bookmarks SET folder = ? WHERE id = ? AND user_id = ?').run(folder, req.params.id, req.user.id);

    if (result.changes === 0) {
        throw new AppError('Bookmark not found', 404, 'BOOKMARK_NOT_FOUND');
    }

    res.json({ message: 'Bookmark folder updated' });
});

const getBookmarkFolders = asyncHandler(async (req, res) => {
    const folders = db.prepare(`
        SELECT folder, COUNT(*) as count
        FROM bookmarks
        WHERE user_id = ?
        GROUP BY folder
        ORDER BY count DESC
    `).all(req.user.id);

    res.json({ folders });
});

module.exports = {
    addBookmark,
    getBookmarks,
    removeBookmark,
    updateBookmarkFolder,
    getBookmarkFolders
};
