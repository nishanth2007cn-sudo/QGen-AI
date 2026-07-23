const express = require('express');
const router = express.Router();
const examController = require('../controllers/examController');
const { authenticate } = require('../middleware/auth');
const { validateExamCreation } = require('../middleware/validation');

router.use(authenticate);

router.post('/create', validateExamCreation, examController.createExam);
router.get('/', examController.getExams);
router.get('/:id', examController.getExamById);
router.post('/:id/start', examController.startExam);
router.post('/:id/answer', examController.submitAnswer);
router.post('/:id/finish', examController.finishExam);
router.get('/:id/result', examController.getResult);
router.delete('/:id', examController.deleteExam);

module.exports = router;