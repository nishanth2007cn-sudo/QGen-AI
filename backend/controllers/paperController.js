const db = require('../config/database');
const { AppError, asyncHandler } = require('../middleware/errorHandler');
const aiService = require('../services/aiService');

const PAPER_TYPES = ['mcq', 'coding', 'debugging', 'prediction', 'true_false', 'short_answer', 'scenario', 'interview', 'placement', 'mixed'];
const DIFFICULTIES = ['Easy', 'Medium', 'Hard', 'Mixed'];

const generatePaper = asyncHandler(async (req, res) => {
    const {
        title = 'Generated Question Paper',
        topic,
        subtopic,
        company,
        difficulty = 'Mixed',
        paper_type = 'mixed',
        question_count = 10,
        time_limit_minutes,
        languages = [],
        bloom_levels = [],
        shuffle_questions = true,
        include_solutions = true,
        include_explanations = true,
        random_seed = Date.now()
    } = req.body;

    if (!topic) {
        throw new AppError('Topic is required', 400, 'TOPIC_REQUIRED');
    }

    if (!DIFFICULTIES.includes(difficulty)) {
        throw new AppError('Invalid difficulty', 400, 'INVALID_DIFFICULTY');
    }

    if (!PAPER_TYPES.includes(paper_type)) {
        throw new AppError('Invalid paper type', 400, 'INVALID_PAPER_TYPE');
    }

    if (question_count < 1 || question_count > 100) {
        throw new AppError('Question count must be between 1 and 100', 400, 'INVALID_QUESTION_COUNT');
    }

    const questionTypes = paper_type === 'mixed' 
        ? ['mcq', 'coding', 'debugging', 'prediction', 'true_false', 'short_answer', 'scenario']
        : [paper_type];

    const difficulties = difficulty === 'Mixed' 
        ? ['Easy', 'Medium', 'Hard'] 
        : [difficulty];

    const questionsPerType = Math.ceil(question_count / questionTypes.length);
    const questionsPerDifficulty = Math.ceil(question_count / difficulties.length);

    const previousQuestions = db.prepare(
        'SELECT question_text FROM questions WHERE user_id = ? AND is_duplicate = 0 ORDER BY created_at DESC LIMIT 100'
    ).all(req.user.id).map(q => q.question_text);

    const allQuestions = [];

    for (const qType of questionTypes) {
        for (const diff of difficulties) {
            const needed = Math.min(
                questionsPerType,
                questionsPerDifficulty,
                question_count - allQuestions.length
            );

            if (needed <= 0) break;

            let questions = [];
            try {
                questions = await aiService.generateQuestionsWithAI({
                    topic,
                    subtopic,
                    difficulty: diff,
                    questionType: qType,
                    language: languages[0],
                    company,
                    bloomLevel: bloom_levels[0],
                    learningOutcome: undefined,
                    count: needed,
                    previousQuestions,
                    seed: random_seed + allQuestions.length
                });
            } catch (error) {
                console.warn(`AI generation failed for ${qType} ${diff}, using fallback`);
                for (let i = 0; i < needed; i++) {
                    questions.push(aiService.getFallbackQuestion({
                        topic,
                        subtopic,
                        difficulty: diff,
                        question_type: qType,
                        language: languages[0],
                        company
                    }));
                }
            }

            for (const q of questions) {
                const questionHash = aiService.generateQuestionHash(q.question_text);
                const similarityHash = aiService.generateSimilarityHash(q.question_text);
                
                const duplicateCheck = await aiService.checkDuplicateQuestion(questionHash, similarityHash);
                if (!duplicateCheck.isDuplicate) {
                    allQuestions.push({
                        ...q,
                        question_type: qType,
                        difficulty: diff,
                        question_hash: questionHash,
                        similarity_hash: similarityHash
                    });
                    previousQuestions.push(q.question_text);
                }
            }

            if (allQuestions.length >= question_count) break;
        }
        if (allQuestions.length >= question_count) break;
    }

    if (shuffle_questions) {
        for (let i = allQuestions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allQuestions[i], allQuestions[j]] = [allQuestions[j], allQuestions[i]];
        }
    }

    const finalQuestions = allQuestions.slice(0, question_count);

    const stmt = db.prepare(`
        INSERT INTO question_papers (
            user_id, title, topic, subtopic, company, difficulty, paper_type,
            question_count, time_limit_minutes, languages, bloom_levels,
            shuffle_questions, include_solutions, include_explanations, random_seed
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const paperResult = stmt.run(
        req.user.id,
        title,
        topic,
        subtopic || null,
        company || null,
        difficulty,
        paper_type,
        finalQuestions.length,
        time_limit_minutes || null,
        JSON.stringify(languages),
        JSON.stringify(bloom_levels),
        shuffle_questions ? 1 : 0,
        include_solutions ? 1 : 0,
        include_explanations ? 1 : 0,
        random_seed
    );

    const paperId = paperResult.lastInsertRowid;

    const questionStmt = db.prepare(`
        INSERT INTO paper_questions (
            paper_id, question_id, question_order, topic, subtopic, company,
            difficulty, question_type, language, title, question_text, options,
            correct_answer, explanation, hint, algorithm, dry_run,
            time_complexity, space_complexity, python_solution, java_solution,
            cpp_solution, javascript_solution, c_solution, csharp_solution,
            go_solution, rust_solution, kotlin_solution, sql_solution,
            question_hash, similarity_hash, is_duplicate, source
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertQuestions = db.transaction((questions) => {
        questions.forEach((q, index) => {
            const questionResult = db.prepare(`
                INSERT INTO questions (
                    user_id, topic, subtopic, company, question_type, difficulty, language,
                    bloom_level, learning_outcome, title, question_text, options, correct_answer,
                    explanation, hint, algorithm, dry_run, time_complexity, space_complexity,
                    python_solution, java_solution, cpp_solution, javascript_solution,
                    c_solution, csharp_solution, go_solution, rust_solution, kotlin_solution, sql_solution,
                    question_hash, similarity_hash, is_duplicate, source
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                req.user.id,
                q.topic,
                q.subtopic || null,
                q.company || null,
                q.question_type,
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
                q.question_hash,
                q.similarity_hash,
                0,
                q.source || 'ai'
            );

            questionStmt.run(
                paperId,
                questionResult.lastInsertRowid,
                index + 1,
                q.topic,
                q.subtopic || null,
                q.company || null,
                q.difficulty,
                q.question_type,
                q.language || null,
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
                q.question_hash,
                q.similarity_hash,
                0,
                q.source || 'ai'
            );
        });
    });

    insertQuestions(finalQuestions);

    const paper = db.prepare(`
        SELECT p.*, u.username as author
        FROM question_papers p
        LEFT JOIN users u ON p.user_id = u.id
        WHERE p.id = ?
    `).get(paperId);

    const paperQuestions = db.prepare(`
        SELECT pq.*, q.id as original_question_id
        FROM paper_questions pq
        LEFT JOIN questions q ON q.question_hash = pq.question_hash
        WHERE pq.paper_id = ?
        ORDER BY pq.question_order
    `).all(paperId);

    res.status(201).json({
        message: `Question paper generated with ${finalQuestions.length} questions`,
        paper: {
            id: paper.id,
            title: paper.title,
            topic: paper.topic,
            subtopic: paper.subtopic,
            company: paper.company,
            difficulty: paper.difficulty,
            paperType: paper.paper_type,
            questionCount: paper.question_count,
            timeLimitMinutes: paper.time_limit_minutes,
            languages: JSON.parse(paper.languages || '[]'),
            bloomLevels: JSON.parse(paper.bloom_levels || '[]'),
            shuffleQuestions: Boolean(paper.shuffle_questions),
            includeSolutions: Boolean(paper.include_solutions),
            includeExplanations: Boolean(paper.include_explanations),
            randomSeed: paper.random_seed,
            author: paper.author,
            createdAt: paper.created_at
        },
        questions: paperQuestions.map((q, index) => ({
            order: q.question_order,
            id: q.id,
            title: q.title,
            topic: q.topic,
            subtopic: q.subtopic,
            company: q.company,
            difficulty: q.difficulty,
            type: q.question_type,
            language: q.language,
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
            }
        }))
    });
});

const getPapers = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, status } = req.query;

    let query = `
        SELECT p.*, u.username as author
        FROM question_papers p
        LEFT JOIN users u ON p.user_id = u.id
        WHERE p.user_id = ?
    `;
    const params = [req.user.id];

    if (status) {
        query += ' AND p.status = ?';
        params.push(status);
    }

    query += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

    const papers = db.prepare(query).all(...params);

    const countQuery = 'SELECT COUNT(*) as total FROM question_papers WHERE user_id = ?' + (status ? ' AND status = ?' : '');
    const total = db.prepare(countQuery).get(...params.slice(0, status ? 2 : 1)).total;

    res.json({
        papers: papers.map(p => ({
            id: p.id,
            title: p.title,
            topic: p.topic,
            subtopic: p.subtopic,
            company: p.company,
            difficulty: p.difficulty,
            paperType: p.paper_type,
            questionCount: p.question_count,
            timeLimitMinutes: p.time_limit_minutes,
            status: p.status,
            author: p.author,
            createdAt: p.created_at,
            updatedAt: p.updated_at
        })),
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
        }
    });
});

const getPaperById = asyncHandler(async (req, res) => {
    const paper = db.prepare(`
        SELECT p.*, u.username as author
        FROM question_papers p
        LEFT JOIN users u ON p.user_id = u.id
        WHERE p.id = ? AND p.user_id = ?
    `).get(req.params.id, req.user.id);

    if (!paper) {
        throw new AppError('Paper not found', 404, 'PAPER_NOT_FOUND');
    }

    const questions = db.prepare(`
        SELECT pq.*, q.id as original_question_id
        FROM paper_questions pq
        LEFT JOIN questions q ON q.question_hash = pq.question_hash
        WHERE pq.paper_id = ?
        ORDER BY pq.question_order
    `).all(req.params.id);

    res.json({
        paper: {
            id: paper.id,
            title: paper.title,
            topic: paper.topic,
            subtopic: paper.subtopic,
            company: paper.company,
            difficulty: paper.difficulty,
            paperType: paper.paper_type,
            questionCount: paper.question_count,
            timeLimitMinutes: paper.time_limit_minutes,
            languages: JSON.parse(paper.languages || '[]'),
            bloomLevels: JSON.parse(paper.bloom_levels || '[]'),
            shuffleQuestions: Boolean(paper.shuffle_questions),
            includeSolutions: Boolean(paper.include_solutions),
            includeExplanations: Boolean(paper.include_explanations),
            randomSeed: paper.random_seed,
            author: paper.author,
            status: paper.status,
            createdAt: paper.created_at,
            updatedAt: paper.updated_at
        },
        questions: questions.map((q, index) => ({
            order: q.question_order,
            id: q.id,
            title: q.title,
            topic: q.topic,
            subtopic: q.subtopic,
            company: q.company,
            difficulty: q.difficulty,
            type: q.question_type,
            language: q.language,
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
            }
        }))
    });
});

const deletePaper = asyncHandler(async (req, res) => {
    const paper = db.prepare('SELECT * FROM question_papers WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    
    if (!paper) {
        throw new AppError('Paper not found', 404, 'PAPER_NOT_FOUND');
    }

    db.prepare('DELETE FROM paper_questions WHERE paper_id = ?').run(req.params.id);
    db.prepare('DELETE FROM question_papers WHERE id = ?').run(req.params.id);

    res.json({ message: 'Paper deleted successfully' });
});

const exportPaper = asyncHandler(async (req, res) => {
    const { format = 'pdf' } = req.query;
    
    const paper = db.prepare(`
        SELECT p.*, u.username as author
        FROM question_papers p
        LEFT JOIN users u ON p.user_id = u.id
        WHERE p.id = ? AND p.user_id = ?
    `).get(req.params.id, req.user.id);

    if (!paper) {
        throw new AppError('Paper not found', 404, 'PAPER_NOT_FOUND');
    }

    const questions = db.prepare(`
        SELECT * FROM paper_questions WHERE paper_id = ? ORDER BY question_order
    `).all(req.params.id);

    if (format === 'pdf') {
        const PDFDocument = require('pdfkit');
        const doc = new PDFDocument({ margin: 50 });
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${paper.title.replace(/[^a-z0-9]/gi, '_')}.pdf"`);
        
        doc.pipe(res);

        doc.fontSize(24).text(paper.title, { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(`Topic: ${paper.topic}${paper.subtopic ? ' - ' + paper.subtopic : ''}`, { align: 'center' });
        doc.text(`Difficulty: ${paper.difficulty} | Type: ${paper.paper_type} | Questions: ${paper.question_count}`, { align: 'center' });
        doc.text(`Time Limit: ${paper.time_limit_minutes || 'N/A'} minutes`, { align: 'center' });
        doc.text(`Generated by: ${paper.author} on ${new Date(paper.created_at).toLocaleDateString()}`, { align: 'center' });
        doc.moveDown(2);

        questions.forEach((q, index) => {
            doc.fontSize(14).text(`Q${index + 1}. ${q.title}`);
            doc.fontSize(11).text(`Type: ${q.question_type.toUpperCase()} | Difficulty: ${q.difficulty}`);
            doc.moveDown(0.5);
            doc.fontSize(11).text(q.question_text);
            doc.moveDown(0.5);

            if (q.options) {
                const options = JSON.parse(q.options);
                options.forEach((opt, optIndex) => {
                    const letter = String.fromCharCode(65 + optIndex);
                    const isCorrect = q.correct_answer === letter;
                    doc.fontSize(10).text(`${letter}) ${opt}`, { indent: 20 });
                    if (isCorrect && paper.include_solutions) {
                        doc.fontSize(9).fillColor('green').text(' ✓ Correct Answer', { indent: 40 });
                        doc.fillColor('black');
                    }
                });
                doc.moveDown(0.5);
            }

            if (paper.include_explanations && q.explanation) {
                doc.fontSize(10).fillColor('blue').text('Explanation:', { indent: 20 });
                doc.fontSize(10).fillColor('black').text(q.explanation, { indent: 40 });
                doc.moveDown(0.5);
            }

            if (paper.include_solutions) {
                const solutions = [];
                if (q.python_solution) solutions.push(['Python', q.python_solution]);
                if (q.java_solution) solutions.push(['Java', q.java_solution]);
                if (q.cpp_solution) solutions.push(['C++', q.cpp_solution]);
                if (q.javascript_solution) solutions.push(['JavaScript', q.javascript_solution]);

                if (solutions.length > 0) {
                    doc.fontSize(10).fillColor('purple').text('Solutions:', { indent: 20 });
                    doc.fillColor('black');
                    solutions.forEach(([lang, code]) => {
                        doc.fontSize(9).text(`${lang}:`, { indent: 40 });
                        doc.font('Courier').fontSize(8).text(code, { indent: 60 });
                        doc.font('Helvetica');
                        doc.moveDown(0.3);
                    });
                }
            }

            doc.moveDown(1.5);
            if (index < questions.length - 1) {
                doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke('#ddd');
                doc.moveDown(1);
            }
        });

        doc.end();
    } else if (format === 'docx') {
        const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = require('docx');
        
        const doc = new Document({
            sections: [{
                properties: {},
                children: [
                    new Paragraph({
                        text: paper.title,
                        heading: HeadingLevel.TITLE,
                        alignment: AlignmentType.CENTER
                    }),
                    new Paragraph({
                        text: `Topic: ${paper.topic}${paper.subtopic ? ' - ' + paper.subtopic : ''}`,
                        alignment: AlignmentType.CENTER
                    }),
                    new Paragraph({
                        text: `Difficulty: ${paper.difficulty} | Type: ${paper.paper_type} | Questions: ${paper.question_count}`,
                        alignment: AlignmentType.CENTER
                    }),
                    new Paragraph({
                        text: `Time Limit: ${paper.time_limit_minutes || 'N/A'} minutes`,
                        alignment: AlignmentType.CENTER
                    }),
                    new Paragraph({
                        text: `Generated by: ${paper.author} on ${new Date(paper.created_at).toLocaleDateString()}`,
                        alignment: AlignmentType.CENTER
                    }),
                    ...questions.flatMap((q, index) => [
                        new Paragraph({
                            text: `Q${index + 1}. ${q.title}`,
                            heading: HeadingLevel.HEADING_2
                        }),
                        new Paragraph({
                            children: [
                                new TextRun({ text: `Type: ${q.question_type.toUpperCase()}`, bold: true }),
                                new TextRun({ text: ` | Difficulty: ${q.difficulty}` })
                            ]
                        }),
                        new Paragraph({ text: q.question_text }),
                        ...(q.options ? JSON.parse(q.options).map((opt, optIndex) => 
                            new Paragraph({ text: `${String.fromCharCode(65 + optIndex)}) ${opt}`, indent: { left: 720 } })
                        ) : []),
                        ...(paper.include_explanations && q.explanation ? [
                            new Paragraph({
                                children: [new TextRun({ text: 'Explanation: ', bold: true, color: '0000FF' })],
                                indent: { left: 720 }
                            }),
                            new Paragraph({ text: q.explanation, indent: { left: 1440 } })
                        ] : []),
                        ...(paper.include_solutions ? (() => {
                            const solutions = [];
                            if (q.python_solution) solutions.push(['Python', q.python_solution]);
                            if (q.java_solution) solutions.push(['Java', q.java_solution]);
                            if (q.cpp_solution) solutions.push(['C++', q.cpp_solution]);
                            if (q.javascript_solution) solutions.push(['JavaScript', q.javascript_solution]);
                            return solutions.flatMap(([lang, code]) => [
                                new Paragraph({
                                    children: [new TextRun({ text: `${lang} Solution:`, bold: true, color: '800080' })],
                                    indent: { left: 720 }
                                }),
                                new Paragraph({ 
                                    text: code, 
                                    indent: { left: 1440 },
                                    style: 'CodeBlock'
                                })
                            ]);
                        })() : [])
                    ])
                ]
            }]
        });

        const buffer = await Packer.toBuffer(doc);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="${paper.title.replace(/[^a-z0-9]/gi, '_')}.docx"`);
        res.send(buffer);
    } else if (format === 'json') {
        res.json({
            paper: {
                title: paper.title,
                topic: paper.topic,
                subtopic: paper.subtopic,
                company: paper.company,
                difficulty: paper.difficulty,
                paperType: paper.paper_type,
                questionCount: paper.question_count,
                timeLimitMinutes: paper.time_limit_minutes,
                author: paper.author,
                generatedAt: paper.created_at
            },
            questions: questions.map((q, index) => ({
                order: q.question_order,
                title: q.title,
                topic: q.topic,
                subtopic: q.subtopic,
                company: q.company,
                difficulty: q.difficulty,
                type: q.question_type,
                language: q.language,
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
                }
            }))
        });
    } else if (format === 'csv') {
        const csv = [
            ['Order', 'Title', 'Topic', 'Subtopic', 'Company', 'Difficulty', 'Type', 'Language', 'Question', 'Options', 'Correct Answer', 'Explanation', 'Hint', 'Algorithm', 'Time Complexity', 'Space Complexity'],
            ...questions.map((q, index) => [
                q.question_order,
                q.title,
                q.topic,
                q.subtopic || '',
                q.company || '',
                q.difficulty,
                q.question_type,
                q.language || '',
                q.question_text.replace(/"/g, '""'),
                q.options ? JSON.parse(q.options).join(' | ') : '',
                q.correct_answer || '',
                q.explanation ? q.explanation.replace(/"/g, '""') : '',
                q.hint || '',
                q.algorithm || '',
                q.time_complexity || '',
                q.space_complexity || ''
            ])
        ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${paper.title.replace(/[^a-z0-9]/gi, '_')}.csv"`);
        res.send(csv);
    }
});

module.exports = {
    generatePaper,
    getPapers,
    getPaperById,
    deletePaper,
    exportPaper
};