const express = require('express');
const router = express.Router();
const questionController = require('../controllers/questionController');
const { authenticate } = require('../middleware/auth');
const { validateQuestionGeneration } = require('../middleware/validation');

router.use(authenticate);

router.get('/', questionController.getQuestions);
router.get('/types', questionController.getQuestionTypes);
router.get('/topics', questionController.getTopics);
router.get('/companies', questionController.getCompanies);
router.post('/generate', validateQuestionGeneration, questionController.generateQuestions);
router.get('/:id', questionController.getQuestionById);
router.delete('/:id', questionController.deleteQuestion);

module.exports = router;