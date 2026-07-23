require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT) || 5000,
  jwtSecret: process.env.JWT_SECRET || 'qgen-default-secret',
  nodeEnv: process.env.NODE_ENV || 'development',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
};
