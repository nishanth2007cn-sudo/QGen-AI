const express = require('express');
const path = require('path');
const fs = require('fs');

const config = require('./config/env');
const db = require('./config/db');
const routes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { authenticateToken } = require('./middleware/auth');

const app = express();

// Initialize database
db.load();

// Security middleware
app.use(require('helmet')({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(require('cors')());
app.use(require('morgan')(config.nodeEnv === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static files
const ROOT = path.join(__dirname, '..');
app.use('/assets', express.static(path.join(ROOT, 'assets')));
app.use('/css', express.static(path.join(ROOT, 'frontend', 'css')));
app.use('/js', express.static(path.join(ROOT, 'frontend', 'js')));

// API routes
app.use('/api', routes);

// Page routes - serve HTML files
const PAGES_DIR = path.join(ROOT, 'frontend', 'pages');
const PAGE_FILES = fs.readdirSync(PAGES_DIR).filter(f => f.endsWith('.html'));

// Serve pages
PAGE_FILES.forEach(file => {
  const pageName = file.replace('.html', '');
  app.get(`/${pageName}`, (req, res) => {
    res.sendFile(path.join(PAGES_DIR, file));
  });
});

// Root redirect to index
app.get('/', (req, res) => {
  res.sendFile(path.join(ROOT, 'index.html'));
});

// Serve index.html for unknown routes (SPA fallback)
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return notFoundHandler(req, res);
  }
  res.sendFile(path.join(ROOT, 'frontend', 'pages', '404.html'));
});

// Error handling
app.use(errorHandler);

module.exports = app;