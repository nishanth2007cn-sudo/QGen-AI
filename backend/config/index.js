require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const path = require('path');

const config = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d'
  },
  
  bcrypt: {
    saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12
  },
  
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5000',
    credentials: true
  },
  
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX) || 100
  },
  
  ai: {
    provider: process.env.AI_PROVIDER || 'gemini',
    gemini: {
      apiKey: process.env.GEMINI_API_KEY || '',
      model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
      maxTokens: parseInt(process.env.GEMINI_MAX_TOKENS) || 8192,
      temperature: parseFloat(process.env.GEMINI_TEMPERATURE) || 0.7
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini'
    }
  },
  
  database: {
    path: process.env.DATABASE_PATH || path.join(__dirname, '..', 'database', 'qgen.db')
  },
  
  upload: {
    dir: process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads'),
    maxSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024
  },
  
  export: {
    dir: process.env.EXPORT_DIR || path.join(__dirname, '..', 'exports')
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || path.join(__dirname, '..', 'logs', 'app.log')
  },
  
  supportedLanguages: [
    'Python', 'JavaScript', 'Java', 'C++', 'C', 'C#', 'Go', 'Rust', 'Kotlin', 'SQL'
  ],
  
  questionTypes: [
    { value: 'mcq', label: 'Multiple Choice', icon: 'fa-list-check' },
    { value: 'coding', label: 'Coding Challenge', icon: 'fa-code' },
    { value: 'debugging', label: 'Debugging', icon: 'fa-bug' },
    { value: 'prediction', label: 'Output Prediction', icon: 'fa-terminal' },
    { value: 'theory', label: 'Theory/Conceptual', icon: 'fa-book' },
    { value: 'scenario', label: 'Scenario Based', icon: 'fa-lightbulb' }
  ],
  
  difficulties: [
    { value: 'Easy', label: 'Easy', color: 'success' },
    { value: 'Medium', label: 'Medium', color: 'warning' },
    { value: 'Hard', label: 'Hard', color: 'danger' },
    { value: 'Mixed', label: 'Mixed', color: 'info' }
  ],
  
  paperTypes: [
    { value: 'mcq', label: 'MCQ Paper' },
    { value: 'coding', label: 'Coding Paper' },
    { value: 'debugging', label: 'Debugging Paper' },
    { value: 'prediction', label: 'Output Prediction Paper' },
    { value: 'theory', label: 'Theory Paper' },
    { value: 'mixed', label: 'Mixed Paper' }
  ],
  
  bloomTaxonomy: [
    { value: 'remember', label: 'Remember' },
    { value: 'understand', label: 'Understand' },
    { value: 'apply', label: 'Apply' },
    { value: 'analyze', label: 'Analyze' },
    { value: 'evaluate', label: 'Evaluate' },
    { value: 'create', label: 'Create' }
  ],
  
  exportFormats: [
    { value: 'pdf', label: 'PDF', icon: 'fa-file-pdf' },
    { value: 'docx', label: 'Word (DOCX)', icon: 'fa-file-word' },
    { value: 'json', label: 'JSON', icon: 'fa-file-code' },
    { value: 'csv', label: 'CSV', icon: 'fa-file-csv' },
    { value: 'txt', label: 'Text', icon: 'fa-file-alt' }
  ]
};

module.exports = config;