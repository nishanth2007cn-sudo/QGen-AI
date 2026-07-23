const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const questionController = require('../controllers/questionController');
const bookmarkController = require('../controllers/bookmarkController');
const analyticsController = require('../controllers/analyticsController');
const paperController = require('../controllers/paperController');
const searchController = require('../controllers/searchController');
const chatController = require('../controllers/chatController');
const examController = require('../controllers/examController');
const exportController = require('../controllers/exportController');
const historyController = require('../controllers/historyController');
const adminController = require('../controllers/adminController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Auth routes
router.post('/api/auth/register', authController.register);
router.post('/api/auth/login', authController.login);
router.get('/api/auth/profile', authenticateToken, authController.getProfile);
router.put('/api/auth/profile', authenticateToken, authController.updateProfile);

// Question routes
router.post('/api/generate', authenticateToken, questionController.generateQuestions);
router.get('/api/questions', authenticateToken, questionController.getQuestions);
router.get('/api/questions/:id', authenticateToken, questionController.getQuestionById);
router.delete('/api/questions/:id', authenticateToken, questionController.deleteQuestion);
router.put('/api/questions/:id', authenticateToken, questionController.updateQuestion);
router.post('/api/questions/:id/save', authenticateToken, questionController.saveQuestion);
router.get('/api/saved-questions', authenticateToken, questionController.getSavedQuestions);

// Bookmark routes
router.get('/api/bookmarks', authenticateToken, bookmarkController.getBookmarks);
router.post('/api/bookmarks', authenticateToken, bookmarkController.addBookmark);
router.delete('/api/bookmarks', authenticateToken, bookmarkController.removeBookmark);

// Analytics
router.get('/api/analytics', authenticateToken, analyticsController.getAnalytics);

// Paper routes
router.post('/api/paper/generate', authenticateToken, paperController.generatePaper);
router.get('/api/papers', authenticateToken, paperController.getPapers);
router.delete('/api/papers/:id', authenticateToken, paperController.deletePaper);

// Search routes
router.get('/api/search/suggestions', authenticateToken, searchController.searchSuggestions);
router.post('/api/ai-search', authenticateToken, searchController.aiSearch);

// Chat routes
router.get('/api/chat', authenticateToken, chatController.getChats);
router.post('/api/chat', authenticateToken, chatController.sendMessage);
router.delete('/api/chat', authenticateToken, chatController.clearChats);

// Exam routes
router.post('/api/exam/submit', authenticateToken, examController.submitExam);
router.get('/api/exam/result/:id', authenticateToken, examController.getExamResult);
router.get('/api/exams', authenticateToken, examController.getExams);

// Export routes
router.get('/api/export-pdf/:id', authenticateToken, exportController.exportQuestionPDF);
router.get('/api/export-exam-pdf/:id', authenticateToken, exportController.exportExamPDF);
router.get('/api/export/json', authenticateToken, exportController.exportJSON);
router.get('/api/export/csv', authenticateToken, exportController.exportCSV);

// History routes
router.get('/api/history', authenticateToken, historyController.getHistory);
router.delete('/api/history/:id', authenticateToken, historyController.deleteHistory);

// Admin routes
router.get('/api/admin/stats', authenticateToken, requireAdmin, adminController.getAdminStats);
router.get('/api/admin/users', authenticateToken, requireAdmin, adminController.getAdminUsers);
router.delete('/api/admin/users/:id', authenticateToken, requireAdmin, adminController.deleteAdminUser);
router.post('/api/admin/db-clear', authenticateToken, requireAdmin, adminController.clearDatabase);

module.exports = router;