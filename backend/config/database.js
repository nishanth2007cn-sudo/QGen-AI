const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
require('dotenv').config();

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'database', 'qgen.db');
const DB_DIR = path.dirname(DB_PATH);

if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
}

let db;

function getDb() {
    if (!db) {
        db = new Database(DB_PATH);
        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');
        initializeSchema(db);
    }
    return db;
}

function initializeSchema(db) {
    // Users table
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username VARCHAR(50) UNIQUE NOT NULL,
            email VARCHAR(100) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            full_name VARCHAR(100),
            avatar_url VARCHAR(255),
            role VARCHAR(20) DEFAULT 'user',
            is_active BOOLEAN DEFAULT 1,
            email_verified BOOLEAN DEFAULT 0,
            verification_token VARCHAR(255),
            reset_token VARCHAR(255),
            reset_token_expires DATETIME,
            last_login DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Questions table
    db.exec(`
        CREATE TABLE IF NOT EXISTS questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            topic VARCHAR(100) NOT NULL,
            subtopic VARCHAR(100),
            company VARCHAR(100),
            question_type VARCHAR(30) NOT NULL,
            difficulty VARCHAR(20) NOT NULL,
            language VARCHAR(50),
            bloom_level VARCHAR(30),
            learning_outcome TEXT,
            title VARCHAR(255),
            question_text TEXT NOT NULL,
            options TEXT,
            correct_answer TEXT,
            explanation TEXT,
            hint TEXT,
            algorithm TEXT,
            dry_run TEXT,
            time_complexity VARCHAR(50),
            space_complexity VARCHAR(50),
            python_solution TEXT,
            java_solution TEXT,
            cpp_solution TEXT,
            javascript_solution TEXT,
            c_solution TEXT,
            csharp_solution TEXT,
            go_solution TEXT,
            rust_solution TEXT,
            kotlin_solution TEXT,
            sql_solution TEXT,
            question_hash VARCHAR(64),
            similarity_hash VARCHAR(64),
            is_duplicate BOOLEAN DEFAULT 0,
            source VARCHAR(20) DEFAULT 'ai',
            generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        )
    `);

    // Question Papers table
    db.exec(`
        CREATE TABLE IF NOT EXISTS question_papers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            paper_type VARCHAR(30) NOT NULL,
            difficulty VARCHAR(20) NOT NULL,
            question_count INTEGER NOT NULL,
            time_limit INTEGER,
            total_marks INTEGER,
            passing_marks INTEGER,
            topic VARCHAR(100),
            subtopic VARCHAR(100),
            company VARCHAR(100),
            language VARCHAR(50),
            questions_data TEXT,
            status VARCHAR(20) DEFAULT 'draft',
            is_public BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    // Bookmarks table
    db.exec(`
        CREATE TABLE IF NOT EXISTS bookmarks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            question_id INTEGER NOT NULL,
            folder VARCHAR(50) DEFAULT 'Favorites',
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
            UNIQUE(user_id, question_id)
        )
    `);

    // Exam Sessions table
    db.exec(`
        CREATE TABLE IF NOT EXISTS exam_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            paper_id INTEGER,
            title VARCHAR(255),
            question_ids TEXT NOT NULL,
            answers TEXT,
            started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            completed_at DATETIME,
            time_taken INTEGER,
            score REAL,
            total_questions INTEGER,
            correct_answers INTEGER,
            status VARCHAR(20) DEFAULT 'in_progress',
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (paper_id) REFERENCES question_papers(id) ON DELETE SET NULL
        )
    `);

    // Exam Results table
    db.exec(`
        CREATE TABLE IF NOT EXISTS exam_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            question_id INTEGER NOT NULL,
            user_answer TEXT,
            correct_answer TEXT,
            is_correct BOOLEAN,
            time_taken INTEGER,
            points_earned REAL,
            FOREIGN KEY (session_id) REFERENCES exam_sessions(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
        )
    `);

    // History/Activity Log table
    db.exec(`
        CREATE TABLE IF NOT EXISTS activity_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            action VARCHAR(50) NOT NULL,
            entity_type VARCHAR(30),
            entity_id INTEGER,
            details TEXT,
            ip_address VARCHAR(45),
            user_agent TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    // AI Logs table
    db.exec(`
        CREATE TABLE IF NOT EXISTS ai_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            request_type VARCHAR(30),
            prompt TEXT,
            response TEXT,
            model VARCHAR(50),
            tokens_used INTEGER,
            latency_ms INTEGER,
            success BOOLEAN,
            error_message TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        )
    `);

    // Question Analytics table
    db.exec(`
        CREATE TABLE IF NOT EXISTS question_analytics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            question_id INTEGER NOT NULL,
            view_count INTEGER DEFAULT 0,
            attempt_count INTEGER DEFAULT 0,
            correct_count INTEGER DEFAULT 0,
            bookmark_count INTEGER DEFAULT 0,
            avg_time_ms INTEGER,
            difficulty_rating REAL,
            last_accessed DATETIME,
            FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
        )
    `);

    // User Settings table
    db.exec(`
        CREATE TABLE IF NOT EXISTS user_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL UNIQUE,
            theme VARCHAR(10) DEFAULT 'light',
            language VARCHAR(10) DEFAULT 'en',
            notifications_enabled BOOLEAN DEFAULT 1,
            email_notifications BOOLEAN DEFAULT 1,
            default_difficulty VARCHAR(20) DEFAULT 'Medium',
            default_question_count INTEGER DEFAULT 10,
            preferred_languages TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    // Notifications table
    db.exec(`
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            type VARCHAR(30),
            title VARCHAR(255),
            message TEXT,
            link VARCHAR(255),
            is_read BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    // Refresh Tokens table
    db.exec(`
        CREATE TABLE IF NOT EXISTS refresh_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token VARCHAR(255) NOT NULL UNIQUE,
            expires_at DATETIME NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    // Create indexes
    const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
        'CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)',
        'CREATE INDEX IF NOT EXISTS idx_questions_user ON questions(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_questions_topic ON questions(topic)',
        'CREATE INDEX IF NOT EXISTS idx_questions_type ON questions(question_type)',
        'CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON questions(difficulty)',
        'CREATE INDEX IF NOT EXISTS idx_questions_hash ON questions(question_hash)',
        'CREATE INDEX IF NOT EXISTS idx_questions_similarity ON questions(similarity_hash)',
        'CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON bookmarks(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_exam_sessions_user ON exam_sessions(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_ai_logs_user ON ai_logs(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token)',
        'CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_question_papers_user ON question_papers(user_id)'
    ];

    indexes.forEach(idx => db.exec(idx));

    // Triggers for updated_at
    db.exec(`
        CREATE TRIGGER IF NOT EXISTS update_users_timestamp 
        AFTER UPDATE ON users
        BEGIN
            UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END
    `);

    db.exec(`
        CREATE TRIGGER IF NOT EXISTS update_questions_timestamp 
        AFTER UPDATE ON questions
        BEGIN
            UPDATE questions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END
    `);

    db.exec(`
        CREATE TRIGGER IF NOT EXISTS update_question_papers_timestamp 
        AFTER UPDATE ON question_papers
        BEGIN
            UPDATE question_papers SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END
    `);

    db.exec(`
        CREATE TRIGGER IF NOT EXISTS update_user_settings_timestamp 
        AFTER UPDATE ON user_settings
        BEGIN
            UPDATE user_settings SET updated_at = CURRENT_TIMESTAMP WHERE user_id = NEW.user_id;
        END
    `);

    console.log('Database schema initialized successfully');
}

function closeDb() {
    if (db) {
        db.close();
        db = null;
    }
}

module.exports = {
    getDb,
    closeDb,
    DB_PATH
};