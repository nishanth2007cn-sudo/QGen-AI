class AppError extends Error {
    constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

class ValidationError extends AppError {
    constructor(message, details = null) {
        super(message, 400, 'VALIDATION_ERROR', details);
    }
}

class AuthenticationError extends AppError {
    constructor(message = 'Authentication required') {
        super(message, 401, 'AUTHENTICATION_ERROR');
    }
}

class AuthorizationError extends AppError {
    constructor(message = 'Insufficient permissions') {
        super(message, 403, 'AUTHORIZATION_ERROR');
    }
}

class NotFoundError extends AppError {
    constructor(message = 'Resource not found') {
        super(message, 404, 'NOT_FOUND');
    }
}

class DuplicateError extends AppError {
    constructor(message = 'Resource already exists') {
        super(message, 409, 'DUPLICATE_ERROR');
    }
}

class RateLimitError extends AppError {
    constructor(message = 'Rate limit exceeded') {
        super(message, 429, 'RATE_LIMIT_EXCEEDED');
    }
}

const errorHandler = (err, req, res, next) => {
    console.error('Error:', {
        message: err.message,
        code: err.code,
        statusCode: err.statusCode,
        stack: err.stack,
        path: req.path,
        method: req.method,
        user: req.user?.id
    });

    if (err.isOperational) {
        return res.status(err.statusCode).json({
            error: err.message,
            code: err.code,
            details: err.details
        });
    }

    if (err.name === 'ValidationError') {
        return res.status(400).json({
            error: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: err.details || err.message
        });
    }

    if (err.name === 'UnauthorizedError' || err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            error: 'Invalid or expired token',
            code: 'TOKEN_ERROR'
        });
    }

    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            error: 'Token expired',
            code: 'TOKEN_EXPIRED'
        });
    }

    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(409).json({
            error: 'Resource already exists',
            code: 'DUPLICATE_ERROR'
        });
    }

    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
            error: 'File too large',
            code: 'FILE_TOO_LARGE'
        });
    }

    return res.status(500).json({
        error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
        code: 'INTERNAL_ERROR'
    });
};

const notFoundHandler = (req, res) => {
    res.status(404).json({
        error: 'Route not found',
        code: 'ROUTE_NOT_FOUND',
        path: req.path
    });
};

const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
    AppError,
    ValidationError,
    AuthenticationError,
    AuthorizationError,
    NotFoundError,
    DuplicateError,
    RateLimitError,
    errorHandler,
    notFoundHandler,
    asyncHandler
};