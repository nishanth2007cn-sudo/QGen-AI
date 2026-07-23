const { body, query, param, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Validation failed', 
      details: errors.array() 
    });
  }
  next();
};

const authValidators = {
  register: [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
    handleValidationErrors
  ],
  login: [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password required'),
    handleValidationErrors
  ],
  forgotPassword: [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    handleValidationErrors
  ],
  resetPassword: [
    body('token').notEmpty().withMessage('Reset token required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    handleValidationErrors
  ],
  changePassword: [
    body('currentPassword').notEmpty().withMessage('Current password required'),
    body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
    handleValidationErrors
  ]
};

const questionValidators = {
  generate: [
    body('type').isIn(['mcq', 'coding', 'debugging', 'prediction', 'theory', 'scenario']).withMessage('Invalid question type'),
    body('topic').trim().isLength({ min: 1, max: 200 }).withMessage('Topic required (max 200 chars)'),
    body('subtopic').optional().trim().isLength({ max: 200 }).withMessage('Subtopic max 200 chars'),
    body('difficulty').isIn(['Easy', 'Medium', 'Hard', 'Mixed']).withMessage('Invalid difficulty'),
    body('language').optional().isIn(['Python', 'JavaScript', 'Java', 'C++', 'C', 'C#', 'Go', 'Rust', 'Kotlin', 'SQL']).withMessage('Invalid language'),
    body('company').optional().trim().isLength({ max: 100 }).withMessage('Company max 100 chars'),
    body('count').optional().isInt({ min: 1, max: 50 }).withMessage('Count must be 1-50'),
    body('bloomTaxonomy').optional().isIn(['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create']).withMessage('Invalid Bloom taxonomy'),
    body('learningOutcome').optional().trim().isLength({ max: 500 }).withMessage('Learning outcome max 500 chars'),
    handleValidationErrors
  ],
  save: [
    body('questionId').isInt({ min: 1 }).withMessage('Valid question ID required'),
    body('folder').optional().trim().isLength({ max: 100 }).withMessage('Folder max 100 chars'),
    body('notes').optional().trim().isLength({ max: 2000 }).withMessage('Notes max 2000 chars'),
    handleValidationErrors
  ],
  bookmark: [
    body('questionId').isInt({ min: 1 }).withMessage('Valid question ID required'),
    body('folder').optional().trim().isLength({ max: 100 }).withMessage('Folder max 100 chars'),
    handleValidationErrors
  ],
  update: [
    param('id').isInt({ min: 1 }).withMessage('Valid question ID required'),
    body('question').optional().trim().isLength({ min: 10, max: 5000 }).withMessage('Question 10-5000 chars'),
    body('details').optional().isObject().withMessage('Details must be object'),
    handleValidationErrors
  ],
  delete: [
    param('id').isInt({ min: 1 }).withMessage('Valid question ID required'),
    handleValidationErrors
  ]
};

const paperValidators = {
  generate: [
    body('title').trim().isLength({ min: 3, max: 200 }).withMessage('Title 3-200 chars'),
    body('subject').trim().isLength({ min: 1, max: 200 }).withMessage('Subject required'),
    body('difficulty').isIn(['Easy', 'Medium', 'Hard', 'Mixed']).withMessage('Invalid difficulty'),
    body('questionTypes').isArray({ min: 1 }).withMessage('At least one question type required'),
    body('questionTypes.*').isIn(['mcq', 'coding', 'debugging', 'prediction', 'theory', 'scenario', 'mixed']).withMessage('Invalid question type'),
    body('questionCount').isInt({ min: 1, max: 100 }).withMessage('Question count 1-100'),
    body('timeLimit').optional().isInt({ min: 1, max: 480 }).withMessage('Time limit 1-480 minutes'),
    body('examFormat').optional().trim().isLength({ max: 100 }).withMessage('Exam format max 100 chars'),
    body('description').optional().trim().isLength({ max: 1000 }).withMessage('Description max 1000 chars'),
    handleValidationErrors
  ],
  update: [
    param('id').isInt({ min: 1 }).withMessage('Valid paper ID required'),
    body('title').optional().trim().isLength({ min: 3, max: 200 }).withMessage('Title 3-200 chars'),
    body('questionsData').optional().isArray().withMessage('Questions data must be array'),
    handleValidationErrors
  ],
  delete: [
    param('id').isInt({ min: 1 }).withMessage('Valid paper ID required'),
    handleValidationErrors
  ]
};

const userValidators = {
  updateProfile: [
    body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Name 2-100 chars'),
    body('avatarUrl').optional().isURL().withMessage('Valid avatar URL required'),
    handleValidationErrors
  ],
  updateSettings: [
    body('theme').optional().isIn(['light', 'dark', 'system']).withMessage('Invalid theme'),
    body('language').optional().isLength({ min: 2, max: 10 }).withMessage('Invalid language'),
    body('notificationsEnabled').optional().isBoolean().withMessage('Must be boolean'),
    body('emailNotifications').optional().isBoolean().withMessage('Must be boolean'),
    body('defaultDifficulty').optional().isIn(['Easy', 'Medium', 'Hard']).withMessage('Invalid difficulty'),
    body('defaultLanguage').optional().isIn(['Python', 'JavaScript', 'Java', 'C++', 'C', 'C#', 'Go', 'Rust', 'Kotlin', 'SQL']).withMessage('Invalid language'),
    handleValidationErrors
  ]
};

const searchValidators = {
  query: [
    query('q').optional().trim().isLength({ max: 200 }).withMessage('Query max 200 chars'),
    query('type').optional().isIn(['mcq', 'coding', 'debugging', 'prediction', 'theory', 'scenario']).withMessage('Invalid type'),
    query('difficulty').optional().isIn(['Easy', 'Medium', 'Hard']).withMessage('Invalid difficulty'),
    query('language').optional().isIn(['Python', 'JavaScript', 'Java', 'C++', 'C', 'C#', 'Go', 'Rust', 'Kotlin', 'SQL']).withMessage('Invalid language'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit 1-100'),
    handleValidationErrors
  ]
};

const exportValidators = {
  generate: [
    body('questionIds').isArray({ min: 1 }).withMessage('At least one question ID required'),
    body('questionIds.*').isInt({ min: 1 }).withMessage('Valid question IDs required'),
    body('format').isIn(['pdf', 'docx', 'json', 'csv', 'txt']).withMessage('Invalid export format'),
    body('includeAnswers').optional().isBoolean().withMessage('Must be boolean'),
    body('includeExplanations').optional().isBoolean().withMessage('Must be boolean'),
    handleValidationErrors
  ]
};

module.exports = {
  authValidators,
  questionValidators,
  paperValidators,
  userValidators,
  searchValidators,
  exportValidators,
  handleValidationErrors
};