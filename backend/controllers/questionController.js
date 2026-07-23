const db = require('../config/database');
const { AppError, asyncHandler } = require('../middleware/errorHandler');
const aiService = require('../services/aiService');

const getQuestions = asyncHandler(async (req, res) => {
    const { 
        page = 1, 
        limit = 20, 
        type, 
        difficulty, 
        topic, 
        company,
        search,
        sortBy = 'created_at',
        sortOrder = 'DESC'
    } = req.query;

    let query = `
        SELECT 
            q.*, 
            u.username as author
        FROM questions q
        LEFT JOIN users u ON q.user_id = u.id
        WHERE q.is_duplicate = 0
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
    if (company) {
        query += ' AND q.company = ?';
        params.push(company);
    }
    if (topic) {
        query += ' AND q.topic LIKE ?';
        params.push(`%${topic}%`);
    }
    if (search) {
        query += ' AND (q.title LIKE ? OR q.question_text LIKE ? OR q.topic LIKE ?)';
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const validSortColumns = ['created_at', 'difficulty', 'question_type', 'topic', 'title'];
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const countQuery = query.replace('SELECT q.*, u.username as author', 'SELECT COUNT(*) as total');
    const total = db.prepare(countQuery).get(...params).total;

    query += ` ORDER BY q.${sortColumn} ${order} LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

    const questions = db.prepare(query).all(...params);

    const formattedQuestions = questions.map(q => ({
        id: q.id,
        title: q.title,
        topic: q.topic,
        subtopic: q.subtopic,
        company: q.company,
        type: q.question_type,
        difficulty: q.difficulty,
        language: q.language,
        bloomLevel: q.bloom_level,
        learningOutcome: q.learning_outcome,
        questionText: q.question_text,
        options: q.options ? JSON.parse(q.options) : null,
        correctAnswer: q.correct_answer,
        explanation: q.explanation,
        hint: q.hint,
        algorithm: q.algorithm,
        dryRun: q.dry_run,
        timeComplexity: q.time_complexity,
        spaceComplexity: q.space_complexity,
        solutions: {
            python: q.python_solution,
            java: q.java_solution,
            cpp: q.cpp_solution,
            javascript: q.javascript_solution,
            c: q.c_solution,
            csharp: q.csharp_solution,
            go: q.go_solution,
            rust: q.rust_solution,
            kotlin: q.kotlin_solution,
            sql: q.sql_solution
        },
        author: q.author,
        createdAt: q.created_at,
        generatedAt: q.generated_at
    }));

    res.json({
        questions: formattedQuestions,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
        }
    });
});

const getQuestionById = asyncHandler(async (req, res) => {
    const question = db.prepare(`
        SELECT 
            q.*, 
            u.username as author
        FROM questions q
        LEFT JOIN users u ON q.user_id = u.id
        WHERE q.id = ?
    `).get(req.params.id);

    if (!question) {
        throw new AppError('Question not found', 404, 'QUESTION_NOT_FOUND');
    }

    const formatted = {
        id: question.id,
        title: question.title,
        topic: question.topic,
        subtopic: question.subtopic,
        company: question.company,
        type: question.question_type,
        difficulty: question.difficulty,
        language: question.language,
        bloomLevel: question.bloom_level,
        learningOutcome: question.learning_outcome,
        questionText: question.question_text,
        options: question.options ? JSON.parse(question.options) : null,
        correctAnswer: question.correct_answer,
        explanation: question.explanation,
        hint: question.hint,
        algorithm: question.algorithm,
        dryRun: question.dry_run,
        timeComplexity: question.time_complexity,
        spaceComplexity: question.space_complexity,
        solutions: {
            python: question.python_solution,
            java: question.java_solution,
            cpp: question.cpp_solution,
            javascript: question.javascript_solution,
            c: question.c_solution,
            csharp: question.csharp_solution,
            go: question.go_solution,
            rust: question.rust_solution,
            kotlin: question.kotlin_solution,
            sql: question.sql_solution
        },
        author: question.author,
        createdAt: question.created_at,
        generatedAt: question.generated_at
    };

    res.json({ question: formatted });
});

const generateQuestions = asyncHandler(async (req, res) => {
    const {
        topic,
        subtopic,
        difficulty = 'Medium',
        question_type = 'mcq',
        language,
        company,
        bloom_level,
        learning_outcome,
        count = 5,
        regenerateDuplicates = true
    } = req.body;

    if (!topic) {
        throw new AppError('Topic is required', 400, 'TOPIC_REQUIRED');
    }

    const validTypes = ['mcq', 'coding', 'debugging', 'prediction', 'true_false', 'short_answer', 'scenario', 'interview', 'placement'];
    if (!validTypes.includes(question_type)) {
        throw new AppError('Invalid question type', 400, 'INVALID_QUESTION_TYPE');
    }

    const validDifficulties = ['Easy', 'Medium', 'Hard', 'Mixed'];
    if (!validDifficulties.includes(difficulty)) {
        throw new AppError('Invalid difficulty', 400, 'INVALID_DIFFICULTY');
    }

    const previousQuestions = db.prepare(
        'SELECT question_text FROM questions WHERE user_id = ? AND is_duplicate = 0 ORDER BY created_at DESC LIMIT 50'
    ).all(req.user.id).map(q => q.question_text);

    let questions = [];
    let usedFallback = false;

    try {
        questions = await aiService.generateQuestionsWithAI({
            topic,
            subtopic,
            difficulty,
            questionType: question_type,
            language,
            company,
            bloomLevel: bloom_level,
            learningOutcome: learning_outcome,
            count,
            previousQuestions
        });
    } catch (error) {
        console.warn('AI generation failed, using fallback:', error.message);
        usedFallback = true;
        
        for (let i = 0; i < count; i++) {
            questions.push(aiService.getFallbackQuestion({
                topic,
                subtopic,
                difficulty,
                question_type,
                language,
                company
            }));
        }
    }

    if (regenerateDuplicates && questions.length < count) {
        questions = await aiService.regenerateDuplicates(
            { topic, subtopic, difficulty, question_type, language, company, bloom_level, learning_outcome, count },
            questions
        );
    }

    const savedQuestions = [];
    for (const q of questions) {
        const questionHash = aiService.generateQuestionHash(q.question_text);
        const similarityHash = aiService.generateSimilarityHash(q.question_text);

        const duplicateCheck = await aiService.checkDuplicateQuestion(questionHash, similarityHash);
        if (duplicateCheck.isDuplicate) continue;

        const stmt = db.prepare(`
            INSERT INTO questions (
                user_id, topic, subtopic, company, question_type, difficulty, language,
                bloom_level, learning_outcome, title, question_text, options, correct_answer,
                explanation, hint, algorithm, dry_run, time_complexity, space_complexity,
                python_solution, java_solution, cpp_solution, javascript_solution,
                c_solution, csharp_solution, go_solution, rust_solution, kotlin_solution, sql_solution,
                question_hash, similarity_hash, is_duplicate, source
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const result = stmt.run(
            req.user.id,
            q.topic,
            q.subtopic || null,
            q.company || null,
            q.question_type || question_type,
            q.difficulty,
            q.language || null,
            q.bloom_level || null,
            q.learning_outcome || null,
            q.title,
            q.question_text,
            q.options ? JSON.stringify(q.options) : null,
            q.correct_answer || null,
            q.explanation || null,
            q.hint || null,
            q.algorithm || null,
            q.dry_run || null,
            q.time_complexity || null,
            q.space_complexity || null,
            q.python_solution || null,
            q.java_solution || null,
            q.cpp_solution || null,
            q.javascript_solution || null,
            q.c_solution || null,
            q.csharp_solution || null,
            q.go_solution || null,
            q.rust_solution || null,
            q.kotlin_solution || null,
            q.sql_solution || null,
            questionHash,
            similarityHash,
            0,
            usedFallback ? 'fallback' : 'ai'
        );

        savedQuestions.push({ ...q, id: result.lastInsertRowid });
    }

    await aiService.logAIRequest(
        req.user.id,
        'generate_questions',
        JSON.stringify(req.body),
        JSON.stringify(savedQuestions.map(q => q.title)),
        'gemini-pro',
        0,
        0,
        !usedFallback,
        usedFallback ? 'Fallback used' : null
    );

    res.status(201).json({
        message: `Generated ${savedQuestions.length} question(s)`,
        questions: savedQuestions,
        usedFallback
    });
});

const deleteQuestion = asyncHandler(async (req, res) => {
    const question = db.prepare('SELECT * FROM questions WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    
    if (!question) {
        throw new AppError('Question not found', 404, 'QUESTION_NOT_FOUND');
    }

    db.prepare('DELETE FROM questions WHERE id = ?').run(req.params.id);
    
    res.json({ message: 'Question deleted successfully' });
});

const getQuestionTypes = asyncHandler(async (req, res) => {
    const types = db.prepare(`
        SELECT question_type, difficulty, COUNT(*) as count
        FROM questions
        WHERE user_id = ? AND is_duplicate = 0
        GROUP BY question_type, difficulty
    `).all(req.user.id);

    res.json({ types });
});

const getTopics = asyncHandler(async (req, res) => {
    const topics = db.prepare(`
        SELECT topic, COUNT(*) as count
        FROM questions
        WHERE user_id = ? AND is_duplicate = 0
        GROUP BY topic
        ORDER BY count DESC
    `).all(req.user.id);

    res.json({ topics });
});

const getCompanies = asyncHandler(async (req, res) => {
    const companies = db.prepare(`
        SELECT company, COUNT(*) as count
        FROM questions
        WHERE user_id = ? AND is_duplicate = 0 AND company IS NOT NULL AND company != ''
        GROUP BY company
        ORDER BY count DESC
    `).all(req.user.id);

    res.json({ companies });
});

module.exports = {
    getQuestions,
    getQuestionById,
    generateQuestions,
    deleteQuestion,
    getQuestionTypes,
    getTopics,
    getCompanies
};