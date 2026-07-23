const { body, param, query, validationResult } = require('express-validator');

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

const validateRegister = [
    body('username')
        .trim()
        .isLength({ min: 3, max: 30 })
        .withMessage('Username must be 3-30 characters')
        .matches(/^[a-zA-Z0-9_]+$/)
        .withMessage('Username can only contain letters, numbers, and underscores'),
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Valid email required'),
    body('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('Password must contain uppercase, lowercase, and number'),
    body('confirmPassword')
        .custom((value, { req }) => value === req.body.password)
        .withMessage('Passwords do not match'),
    handleValidationErrors
];

const validateLogin = [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Valid email required'),
    body('password')
        .notEmpty()
        .withMessage('Password required'),
    handleValidationErrors
];

const validateForgotPassword = [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Valid email required'),
    handleValidationErrors
];

const validateResetPassword = [
    body('token')
        .notEmpty()
        .withMessage('Reset token required'),
    body('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('Password must contain uppercase, lowercase, and number'),
    body('confirmPassword')
        .custom((value, { req }) => value === req.body.password)
        .withMessage('Passwords do not match'),
    handleValidationErrors
];

const validateGenerateQuestions = [
    body('topic')
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Topic must be 2-100 characters'),
    body('subtopic')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('Subtopic max 100 characters'),
    body('difficulty')
        .optional()
        .isIn(['Easy', 'Medium', 'Hard', 'Mixed'])
        .withMessage('Invalid difficulty'),
    body('questionType')
        .optional()
        .isIn(['coding', 'mcq', 'debugging', 'output_prediction', 'theory', 'interview', 'placement', 'true_false', 'short_answer', 'scenario'])
        .withMessage('Invalid question type'),
    body('count')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Count must be 1-100'),
    body('language')
        .optional()
        .trim()
        .isLength({ max: 30 })
        .withMessage('Language max 30 characters'),
    body('company')
        .optional()
        .trim()
        .isLength({ max: 50 })
        .withMessage('Company max 50 characters'),
    body('bloomLevel')
        .optional()
        .isIn(['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'])
        .withMessage('Invalid Bloom\'s taxonomy level'),
    body('learningOutcomes')
        .optional()
        .isArray()
        .withMessage('Learning outcomes must be an array'),
    body('previousQuestions')
        .optional()
        .isArray()
        .withMessage('Previous questions must be an array'),
    handleValidationErrors
];

const validatePaperGeneration = [
    body('title')
        .trim()
        .isLength({ min: 3, max: 200 })
        .withMessage('Title must be 3-200 characters'),
    body('paperType')
        .isIn(['mcq', 'coding', 'debugging', 'output_prediction', 'theory', 'mixed'])
        .withMessage('Invalid paper type'),
    body('difficulty')
        .isIn(['Easy', 'Medium', 'Hard', 'Mixed'])
        .withMessage('Invalid difficulty'),
    body('questionCount')
        .isInt({ min: 5, max: 100 })
        .withMessage('Question count must be 5-100'),
    body('topic')
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Topic must be 2-100 characters'),
    body('subtopics')
        .optional()
        .isArray()
        .withMessage('Subtopics must be an array'),
    body('languages')
        .optional()
        .isArray()
        .withMessage('Languages must be an array'),
    body('companies')
        .optional()
        .isArray()
        .withMessage('Companies must be an array'),
    body('timeLimit')
        .optional()
        .isInt({ min: 5, max: 300 })
        .withMessage('Time limit must be 5-300 minutes'),
    body('marksPerQuestion')
        .optional()
        .isInt({ min: 1, max: 10 })
        .withMessage('Marks per question must be 1-10'),
    handleValidationErrors
];

const validateExamSubmit = [
    body('paperId')
        .isInt({ min: 1 })
        .withMessage('Valid paper ID required'),
    body('answers')
        .isObject()
        .withMessage('Answers must be an object'),
    body('timeTaken')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Time taken must be a positive integer'),
    handleValidationErrors
];

const validateBookmark = [
    body('questionId')
        .isInt({ min: 1 })
        .withMessage('Valid question ID required'),
    body('folder')
        .optional()
        .trim()
        .isLength({ max: 50 })
        .withMessage('Folder max 50 characters'),
    body('notes')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Notes max 500 characters'),
    handleValidationErrors
];

const validateIdParam = (paramName = 'id') => [
    param(paramName)
        .isInt({ min: 1 })
        .withMessage(`Valid ${paramName} required`),
    handleValidationErrors
];

module.exports = {
    handleValidationErrors,
    validateRegister,
    validateLogin,
    validateForgotPassword,
    validateResetPassword,
    validateGenerateQuestions,
    validatePaperGeneration,
    validateExamSubmit,
    validateBookmark,
    validateIdParam
};