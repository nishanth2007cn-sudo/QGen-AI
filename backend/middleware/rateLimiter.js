const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: { error: 'Too many requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'Too many authentication attempts, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
});

const aiGenerationLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    message: { error: 'AI generation rate limit exceeded. Please wait before generating more questions.' },
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = {
    apiLimiter,
    authLimiter,
    aiGenerationLimiter
};