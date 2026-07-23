const db = require('../config/database');
const { AppError, asyncHandler } = require('../middleware/errorHandler');

const startExam = asyncHandler(async (req, res) => {
    const { paper_id, question_ids, time_limit_minutes, exam_type = 'practice' } = req.body;

    let questionIds = [];
    let title = 'Custom Exam';

    if (paper_id) {
        const paper = db.prepare(`
            SELECT p.*, pq.id as question_id
            FROM question_papers p
            LEFT JOIN paper_questions pq ON pq.paper_id = p.id
            WHERE p.id = ? AND p.user_id = ?
        `).all(paper_id, req.user.id);

        if (paper.length === 0) {
            throw new AppError('Paper not found', 404, 'PAPER_NOT_FOUND');
        }

        questionIds = paper.map(p => p.question_id).filter(Boolean);
        title = paper[0].title;
    } else if (question_ids && question_ids.length > 0) {
        const questions = db.prepare(`
            SELECT id FROM questions WHERE id IN (${question_ids.map(() => '?').join(',')}) AND user_id = ?
        `).all(...question_ids, req.user.id);

        questionIds = questions.map(q => q.id);
    }

    if (questionIds.length === 0) {
        throw new AppError('No valid questions found for exam', 400, 'NO_QUESTIONS');
    }

    const timeLimit = time_limit_minutes ? time_limit_minutes * 60 : questionIds.length * 60;

    const stmt = db.prepare(`
        INSERT INTO exam_sessions (
            user_id, paper_id, title, question_ids, time_limit_seconds, exam_type, status
        ) VALUES (?, ?, ?, ?, ?, ?, 'in_progress')
    `);

    const result = stmt.run(
        req.user.id,
        paper_id || null,
        title,
        JSON.stringify(questionIds),
        timeLimit,
        exam_type
    );

    const sessionId = result.lastInsertRowid;

    const questions = db.prepare(`
        SELECT * FROM questions WHERE id IN (${questionIds.map(() => '?').join(',')})
    `).all(...questionIds);

    res.status(201).json({
        message: 'Exam started',
        session: {
            id: sessionId,
            title,
            questionCount: questionIds.length,
            timeLimitMinutes: Math.ceil(timeLimit / 60),
            timeLimitSeconds: timeLimit,
            questions: questions.map(q => ({
                id: q.id,
                title: q.title,
                topic: q.topic,
                subtopic: q.subtopic,
                difficulty: q.difficulty,
                type: q.question_type,
                language: q.language,
                questionText: q.question_text,
                options: q.options ? JSON.parse(q.options) : null,
                hint: q.hint
            }))
        }
    });
});

const getExamSession = asyncHandler(async (req, res) => {
    const session = db.prepare(`
        SELECT es.*, u.username as author
        FROM exam_sessions es
        LEFT JOIN users u ON es.user_id = u.id
        WHERE es.id = ? AND es.user_id = ?
    `).get(req.params.id, req.user.id);

    if (!session) {
        throw new AppError('Exam session not found', 404, 'SESSION_NOT_FOUND');
    }

    const questions = db.prepare(`
        SELECT q.*, er.user_answer, er.is_correct, er.points_earned, er.time_taken as question_time
        FROM exam_sessions es
        JOIN exam_results er ON er.session_id = es.id
        JOIN questions q ON q.id = er.question_id
        WHERE es.id = ?
        ORDER BY er.id
    `).all(req.params.id);

    let examQuestions = [];
    if (questions.length === 0 && session.status === 'in_progress') {
        const questionIds = JSON.parse(session.question_ids);
        const qs = db.prepare(`
            SELECT * FROM questions WHERE id IN (${questionIds.map(() => '?').join(',')})
        `).all(...questionIds);

        examQuestions = qs.map(q => ({
            id: q.id,
            title: q.title,
            topic: q.topic,
            subtopic: q.subtopic,
            difficulty: q.difficulty,
            type: q.question_type,
            language: q.language,
            questionText: q.question_text,
            options: q.options ? JSON.parse(q.options) : null,
            hint: q.hint
        }));
    } else {
        examQuestions = questions.map(q => ({
            id: q.id,
            title: q.title,
            topic: q.topic,
            subtopic: q.subtopic,
            difficulty: q.difficulty,
            type: q.question_type,
            language: q.language,
            questionText: q.question_text,
            options: q.options ? JSON.parse(q.options) : null,
            correctAnswer: q.correct_answer,
            explanation: q.explanation,
            userAnswer: q.user_answer,
            isCorrect: q.is_correct,
            pointsEarned: q.points_earned,
            questionTime: q.question_time,
            hint: q.hint
        }));
    }

    res.json({
        session: {
            id: session.id,
            title: session.title,
            paperId: session.paper_id,
            examType: session.exam_type,
            status: session.status,
            questionCount: session.question_ids ? JSON.parse(session.question_ids).length : 0,
            timeLimitSeconds: session.time_limit_seconds,
            timeTaken: session.time_taken,
            score: session.score,
            correctAnswers: session.correct_answers,
            totalQuestions: session.total_questions,
            startedAt: session.started_at,
            completedAt: session.completed_at
        },
        questions: examQuestions
    });
});

const submitExam = asyncHandler(async (req, res) => {
    const { session_id, answers, time_taken } = req.body;

    const session = db.prepare('SELECT * FROM exam_sessions WHERE id = ? AND user_id = ?').get(session_id, req.user.id);
    
    if (!session) {
        throw new AppError('Exam session not found', 404, 'SESSION_NOT_FOUND');
    }

    if (session.status === 'completed') {
        throw new AppError('Exam already completed', 400, 'EXAM_COMPLETED');
    }

    const questionIds = JSON.parse(session.question_ids);
    const questions = db.prepare(`
        SELECT * FROM questions WHERE id IN (${questionIds.map(() => '?').join(',')})
    `).all(...questionIds);

    let correctCount = 0;
    const results = [];

    questions.forEach((q, index) => {
        const userAnswer = answers[q.id] || answers[index] || '';
        const isCorrect = q.correct_answer && userAnswer.toString().trim().toUpperCase() === q.correct_answer.toString().trim().toUpperCase();
        
        if (isCorrect) correctCount++;

        results.push({
            session_id,
            question_id: q.id,
            user_answer: userAnswer,
            correct_answer: q.correct_answer,
            is_correct: isCorrect ? 1 : 0,
            time_taken: 0,
            points_earned: isCorrect ? 1 : 0
        });
    });

    const score = (correctCount / questions.length) * 100;

    const insertResults = db.transaction((results) => {
        const stmt = db.prepare(`
            INSERT INTO exam_results (session_id, question_id, user_answer, correct_answer, is_correct, time_taken, points_earned)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        results.forEach(r => stmt.run(r.session_id, r.question_id, r.user_answer, r.correct_answer, r.is_correct, r.time_taken, r.points_earned));
    });

    insertResults(results);

    db.prepare(`
        UPDATE exam_sessions 
        SET status = 'completed', completed_at = CURRENT_TIMESTAMP, time_taken = ?, score = ?, correct_answers = ?, total_questions = ?
        WHERE id = ?
    `).run(time_taken || 0, score, correctCount, questions.length, session_id);

    const updatedSession = db.prepare('SELECT * FROM exam_sessions WHERE id = ?').get(session_id);

    res.json({
        message: 'Exam submitted successfully',
        result: {
            sessionId: session_id,
            score: Math.round(score * 100) / 100,
            correctAnswers: correctCount,
            totalQuestions: questions.length,
            timeTaken: time_taken || 0,
            timeLimit: session.time_limit_seconds,
            completedAt: updatedSession.completed_at
        }
    });
});

const getExamHistory = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;

    const exams = db.prepare(`
        SELECT es.*, u.username as author
        FROM exam_sessions es
        LEFT JOIN users u ON es.user_id = u.id
        WHERE es.user_id = ? AND es.status = 'completed'
        ORDER BY es.completed_at DESC
        LIMIT ? OFFSET ?
    `).all(req.user.id, parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

    const total = db.prepare('SELECT COUNT(*) as total FROM exam_sessions WHERE user_id = ? AND status = "completed"').get(req.user.id).total;

    res.json({
        exams: exams.map(e => ({
            id: e.id,
            title: e.title,
            paperId: e.paper_id,
            examType: e.exam_type,
            score: e.score,
            correctAnswers: e.correct_answers,
            totalQuestions: e.total_questions,
            timeTaken: e.time_taken,
            timeLimit: e.time_limit_seconds,
            completedAt: e.completed_at
        })),
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
        }
    });
});

const getExamResults = asyncHandler(async (req, res) => {
    const session = db.prepare(`
        SELECT es.*, u.username as author
        FROM exam_sessions es
        LEFT JOIN users u ON es.user_id = u.id
        WHERE es.id = ? AND es.user_id = ?
    `).get(req.params.id, req.user.id);

    if (!session) {
        throw new AppError('Exam session not found', 404, 'SESSION_NOT_FOUND');
    }

    if (session.status !== 'completed') {
        throw new AppError('Exam not completed yet', 400, 'EXAM_NOT_COMPLETED');
    }

    const results = db.prepare(`
        SELECT q.*, er.user_answer, er.is_correct, er.points_earned, er.time_taken as question_time
        FROM exam_results er
        JOIN questions q ON q.id = er.question_id
        WHERE er.session_id = ?
        ORDER BY er.id
    `).all(req.params.id);

    const questionResults = results.map(r => ({
        id: r.id,
        title: r.title,
        topic: r.topic,
        subtopic: r.subtopic,
        difficulty: r.difficulty,
        type: r.question_type,
        language: r.language,
        questionText: r.question_text,
        options: r.options ? JSON.parse(r.options) : null,
        correctAnswer: r.correct_answer,
        explanation: r.explanation,
        userAnswer: r.user_answer,
        isCorrect: Boolean(r.is_correct),
        pointsEarned: r.points_earned,
        questionTime: r.question_time
    }));

    res.json({
        session: {
            id: session.id,
            title: session.title,
            paperId: session.paper_id,
            examType: session.exam_type,
            score: session.score,
            correctAnswers: session.correct_answers,
            totalQuestions: session.total_questions,
            timeTaken: session.time_taken,
            timeLimit: session.time_limit_seconds,
            completedAt: session.completed_at
        },
        results: questionResults
    });
});

const deleteExamSession = asyncHandler(async (req, res) => {
    const session = db.prepare('SELECT * FROM exam_sessions WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    
    if (!session) {
        throw new AppError('Exam session not found', 404, 'SESSION_NOT_FOUND');
    }

    db.prepare('DELETE FROM exam_results WHERE session_id = ?').run(req.params.id);
    db.prepare('DELETE FROM exam_sessions WHERE id = ?').run(req.params.id);

    res.json({ message: 'Exam session deleted successfully' });
});

module.exports = {
    startExam,
    getExamSession,
    submitExam,
    getExamHistory,
    getExamResults,
    deleteExamSession
};