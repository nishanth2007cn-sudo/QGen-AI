const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../database');
const logger = require('../utils/logger');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  jwt.verify(token, config.jwt.secret, (err, user) => {
    if (err) {
      logger.warn('Token verification failed:', err.message);
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    
    const dbUser = db.prepare('SELECT id, email, name, role, avatar_url FROM users WHERE id = ?').get(user.id);
    if (!dbUser) {
      return res.status(403).json({ error: 'User not found' });
    }
    
    req.user = dbUser;
    next();
  });
};

const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (token) {
    jwt.verify(token, config.jwt.secret, (err, user) => {
      if (!err) {
        const dbUser = db.prepare('SELECT id, email, name, role, avatar_url FROM users WHERE id = ?').get(user.id);
        if (dbUser) req.user = dbUser;
      }
    });
  }
  next();
};

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

const rateLimit = (windowMs = config.rateLimit.windowMs, maxRequests = config.rateLimit.maxRequests) => {
  const requests = new Map();
  
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const windowStart = now - windowMs;
    
    if (!requests.has(ip)) {
      requests.set(ip, []);
    }
    
    const userRequests = requests.get(ip).filter(time => time > windowStart);
    userRequests.push(now);
    requests.set(ip, userRequests);
    
    if (userRequests.length > maxRequests) {
      return res.status(429).json({ 
        error: 'Too many requests', 
        retryAfter: Math.ceil(windowMs / 1000) 
      });
    }
    
    res.set('X-RateLimit-Limit', maxRequests);
    res.set('X-RateLimit-Remaining', maxRequests - userRequests.length);
    res.set('X-RateLimit-Reset', new Date(now + windowMs).toISOString());
    
    next();
  };
};

const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: error.details.map(d => d.message) 
      });
    }
    next();
  };
};

const errorHandler = (err, req, res, next) => {
  logger.error('Unhandled error:', err);
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: 'Validation error', details: err.message });
  }
  
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    return res.status(409).json({ error: 'Resource already exists' });
  }
  
  res.status(500).json({ 
    error: 'Internal server error',
    ...(config.nodeEnv === 'development' && { details: err.message })
  });
};

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  authenticateToken,
  optionalAuth,
  requireRole,
  rateLimit,
  validateRequest,
  errorHandler,
  asyncHandler
};