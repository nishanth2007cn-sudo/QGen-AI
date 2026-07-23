-- QGen-AI Database Schema
-- Run this script to create all tables

CREATE DATABASE IF NOT EXISTS qgen_ai CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE qgen_ai;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    avatar_url VARCHAR(500),
    role ENUM('user', 'admin') DEFAULT 'user',
    is_verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(255),
    reset_password_token VARCHAR(255),
    reset_password_expires DATETIME,
    last_login DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_verification_token (verification_token),
    INDEX idx_reset_token (reset_password_token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Refresh tokens table (for JWT refresh token rotation)
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    revoked_at DATETIME NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id),
    INDEX idx_token (token_hash),
    INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Programming languages table
CREATE TABLE IF NOT EXISTS programming_languages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    icon_class VARCHAR(100),
    color VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Topics table (hierarchical)
CREATE TABLE IF NOT EXISTS topics (
    id INT AUTO_INCREMENT PRIMARY KEY,
    language_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    parent_id INT NULL,
    difficulty ENUM('Easy', 'Medium', 'Hard') DEFAULT 'Medium',
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (language_id) REFERENCES programming_languages(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES topics(id) ON DELETE SET NULL,
    INDEX idx_language (language_id),
    INDEX idx_parent (parent_id),
    UNIQUE KEY unique_language_slug (language_id, slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Question types table
CREATE TABLE IF NOT EXISTS question_types (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    icon_class VARCHAR(100),
    color VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Difficulty levels table
CREATE TABLE IF NOT EXISTS difficulty_levels (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(20) NOT NULL UNIQUE,
    display_name VARCHAR(50) NOT NULL,
    color VARCHAR(20),
    icon_class VARCHAR(100),
    sort_order INT DEFAULT 0,
    description TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bloom's Taxonomy levels
CREATE TABLE IF NOT EXISTS blooms_taxonomy (
    id INT AUTO_INCREMENT PRIMARY KEY,
    level VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    sort_order INT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Questions table
CREATE TABLE IF NOT EXISTS questions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    language_id INT NOT NULL,
    topic_id INT,
    subtopic_id INT,
    question_type_id INT NOT NULL,
    difficulty_id INT NOT NULL,
    blooms_level_id INT,
    company VARCHAR(100),
    title VARCHAR(500) NOT NULL,
    question_text TEXT NOT NULL,
    options JSON,
    correct_answer TEXT,
    explanation TEXT,
    hint TEXT,
    algorithm TEXT,
    dry_run TEXT,
    time_complexity VARCHAR(50),
    space_complexity VARCHAR(50),
    solution_code JSON,
    test_cases JSON,
    constraints TEXT,
    learning_outcomes JSON,
    tags JSON,
    quality_score DECIMAL(3,2) DEFAULT 0.00,
    is_ai_generated BOOLEAN DEFAULT TRUE,
    ai_model VARCHAR(100),
    ai_prompt_hash VARCHAR(64),
    content_hash VARCHAR(64) NOT NULL,
    similarity_hash VARCHAR(64),
    is_duplicate BOOLEAN DEFAULT FALSE,
    duplicate_of_id INT NULL,
    status ENUM('draft', 'published', 'archived', 'flagged') DEFAULT 'published',
    view_count INT DEFAULT 0,
    like_count INT DEFAULT 0,
    bookmark_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (language_id) REFERENCES programming_languages(id) ON DELETE RESTRICT,
    FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE SET NULL,
    FOREIGN KEY (subtopic_id) REFERENCES topics(id) ON DELETE SET NULL,
    FOREIGN KEY (question_type_id) REFERENCES question_types(id) ON DELETE RESTRICT,
    FOREIGN KEY (difficulty_id) REFERENCES difficulty_levels(id) ON DELETE RESTRICT,
    FOREIGN KEY (blooms_level_id) REFERENCES blooms_taxonomy(id) ON DELETE SET NULL,
    FOREIGN KEY (duplicate_of_id) REFERENCES questions(id) ON DELETE SET NULL,
    INDEX idx_user (user_id),
    INDEX idx_language (language_id),
    INDEX idx_topic (topic_id),
    INDEX idx_type (question_type_id),
    INDEX idx_difficulty (difficulty_id),
    INDEX idx_company (company),
    INDEX idx_status (status),
    INDEX idx_content_hash (content_hash),
    INDEX idx_similarity_hash (similarity_hash),
    INDEX idx_ai_generated (is_ai_generated),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Question Papers table
CREATE TABLE IF NOT EXISTS question_papers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    paper_type ENUM('mcq', 'coding', 'debugging', 'output_prediction', 'theory', 'mixed') NOT NULL,
    difficulty ENUM('Easy', 'Medium', 'Hard', 'Mixed') NOT NULL,
    total_questions INT NOT NULL,
    total_marks INT DEFAULT 0,
    duration_minutes INT,
    language_id INT,
    topic_ids JSON,
    company_tags JSON,
    blooms_distribution JSON,
    status ENUM('draft', 'generated', 'published', 'archived') DEFAULT 'draft',
    is_public BOOLEAN DEFAULT FALSE,
    view_count INT DEFAULT 0,
    download_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (language_id) REFERENCES programming_languages(id) ON DELETE SET NULL,
    INDEX idx_user (user_id),
    INDEX idx_type (paper_type),
    INDEX idx_difficulty (difficulty),
    INDEX idx_status (status),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Question Paper Items (questions in a paper)
CREATE TABLE IF NOT EXISTS question_paper_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    paper_id INT NOT NULL,
    question_id INT NOT NULL,
    question_number INT NOT NULL,
    marks INT DEFAULT 1,
    estimated_time_minutes INT,
    bloom_level_id INT,
    learning_outcome TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (paper_id) REFERENCES question_papers(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
    FOREIGN KEY (bloom_level_id) REFERENCES blooms_taxonomy(id) ON DELETE SET NULL,
    UNIQUE KEY unique_paper_question (paper_id, question_number),
    INDEX idx_paper (paper_id),
    INDEX idx_question (question_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bookmarks table
CREATE TABLE IF NOT EXISTS bookmarks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    question_id INT NOT NULL,
    folder VARCHAR(100) DEFAULT 'Favorites',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_question (user_id, question_id),
    INDEX idx_user (user_id),
    INDEX idx_folder (folder)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- History table (question generation history)
CREATE TABLE IF NOT EXISTS generation_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    language_id INT,
    topic_id INT,
    subtopic_id INT,
    question_type_id INT,
    difficulty_id INT,
    company VARCHAR(100),
    question_count INT NOT NULL,
    ai_model VARCHAR(100),
    prompt_hash VARCHAR(64),
    generated_question_ids JSON,
    duration_ms INT,
    status ENUM('success', 'partial', 'failed') DEFAULT 'success',
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Exam Sessions table
CREATE TABLE IF NOT EXISTS exam_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    paper_id INT,
    title VARCHAR(500),
    mode ENUM('practice', 'exam', 'timed') DEFAULT 'practice',
    total_questions INT NOT NULL,
    answered_questions INT DEFAULT 0,
    correct_answers INT DEFAULT 0,
    score DECIMAL(5,2) DEFAULT 0.00,
    time_spent_seconds INT DEFAULT 0,
    time_limit_seconds INT,
    answers JSON,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME NULL,
    status ENUM('in_progress', 'completed', 'abandoned') DEFAULT 'in_progress',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (paper_id) REFERENCES question_papers(id) ON DELETE SET NULL,
    INDEX idx_user (user_id),
    INDEX idx_status (status),
    INDEX idx_started (started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Exam Answers table
CREATE TABLE IF NOT EXISTS exam_answers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT NOT NULL,
    question_id INT NOT NULL,
    user_answer TEXT,
    is_correct BOOLEAN,
    marks_obtained DECIMAL(5,2) DEFAULT 0.00,
    time_spent_seconds INT,
    answered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES exam_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
    UNIQUE KEY unique_session_question (session_id, question_id),
    INDEX idx_session (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- AI Generation Logs table
CREATE TABLE IF NOT EXISTS ai_generation_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    request_id VARCHAR(64) NOT NULL,
    endpoint VARCHAR(100) NOT NULL,
    prompt_tokens INT,
    completion_tokens INT,
    total_tokens INT,
    model VARCHAR(100),
    temperature DECIMAL(3,2),
    prompt_hash VARCHAR(64),
    response_hash VARCHAR(64),
    duration_ms INT,
    status ENUM('success', 'error', 'rate_limited') DEFAULT 'success',
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user (user_id),
    INDEX idx_request (request_id),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Question Analytics table
CREATE TABLE IF NOT EXISTS question_analytics (
    id INT AUTO_INCREMENT PRIMARY KEY,
    question_id INT NOT NULL,
    view_count INT DEFAULT 0,
    attempt_count INT DEFAULT 0,
    correct_count INT DEFAULT 0,
    avg_time_seconds DECIMAL(8,2) DEFAULT 0.00,
    difficulty_rating DECIMAL(3,2) DEFAULT 0.00,
    quality_rating DECIMAL(3,2) DEFAULT 0.00,
    last_calculated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
    UNIQUE KEY unique_question (question_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    data JSON,
    is_read BOOLEAN DEFAULT FALSE,
    read_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_read (user_id, is_read),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User Settings table
CREATE TABLE IF NOT EXISTS user_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    theme ENUM('light', 'dark', 'system') DEFAULT 'system',
    language VARCHAR(10) DEFAULT 'en',
    email_notifications BOOLEAN DEFAULT TRUE,
    push_notifications BOOLEAN DEFAULT TRUE,
    default_difficulty ENUM('Easy', 'Medium', 'Hard') DEFAULT 'Medium',
    default_question_count INT DEFAULT 10,
    preferred_languages JSON,
    editor_theme VARCHAR(50) DEFAULT 'vs-dark',
    font_size INT DEFAULT 14,
    auto_save BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Question Tags table (many-to-many)
CREATE TABLE IF NOT EXISTS question_tags (
    id INT AUTO_INCREMENT PRIMARY KEY,
    question_id INT NOT NULL,
    tag VARCHAR(50) NOT NULL,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
    UNIQUE KEY unique_question_tag (question_id, tag),
    INDEX idx_tag (tag)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Saved Papers table
CREATE TABLE IF NOT EXISTS saved_papers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    paper_id INT NOT NULL,
    custom_title VARCHAR(500),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (paper_id) REFERENCES question_papers(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_paper (user_id, paper_id),
    INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Export History table
CREATE TABLE IF NOT EXISTS export_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    paper_id INT,
    question_ids JSON,
    format ENUM('pdf', 'docx', 'json', 'csv', 'txt') NOT NULL,
    file_path VARCHAR(500),
    file_size INT,
    status ENUM('pending', 'completed', 'failed') DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (paper_id) REFERENCES question_papers(id) ON DELETE SET NULL,
    INDEX idx_user (user_id),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;