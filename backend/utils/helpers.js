const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const generateToken = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

const generateQuestionHash = (questionData) => {
  const content = `${questionData.type}|${questionData.topic}|${questionData.subtopic || ''}|${questionData.difficulty}|${questionData.language || ''}|${questionData.question}`;
  return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
};

const calculateSimilarity = (str1, str2) => {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  if (longer.length === 0) return 1.0;
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
};

const levenshteinDistance = (str1, str2) => {
  const matrix = [];
  for (let i = 0; i <= str2.length; i++) matrix[i] = [i];
  for (let j = 0; j <= str1.length; j++) matrix[0][j] = j;
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[str2.length][str1.length];
};

const sanitizeHtml = (html) => {
  return String(html || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const formatDate = (date, format = 'short') => {
  const d = new Date(date);
  if (format === 'short') {
    return d.toLocaleDateString();
  } else if (format === 'long') {
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  } else if (format === 'datetime') {
    return d.toLocaleString();
  }
  return d.toISOString();
};

const paginate = (page = 1, limit = 20, maxLimit = 100) => {
  const p = Math.max(1, parseInt(page) || 1);
  const l = Math.min(maxLimit, Math.max(1, parseInt(limit) || 20));
  return {
    page: p,
    limit: l,
    offset: (p - 1) * l
  };
};

const buildPaginationResponse = (data, page, limit, total) => {
  const totalPages = Math.ceil(total / limit);
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  };
};

const slugify = (text) => {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const truncate = (text, length = 200, suffix = '...') => {
  if (!text || text.length <= length) return text;
  return text.substring(0, length - suffix.length) + suffix;
};

const parseJsonSafe = (json, fallback = null) => {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const retry = async (fn, retries = 3, delayMs = 1000) => {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) throw error;
    await delay(delayMs);
    return retry(fn, retries - 1, delayMs * 2);
  }
};

module.exports = {
  generateToken,
  generateQuestionHash,
  calculateSimilarity,
  levenshteinDistance,
  sanitizeHtml,
  formatDate,
  paginate,
  buildPaginationResponse,
  slugify,
  truncate,
  parseJsonSafe,
  delay,
  retry,
  uuidv4
};
