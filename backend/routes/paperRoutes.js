const express = require('express');
const router = express.Router();
const paperController = require('../controllers/paperController');
const { authenticate } = require('../middleware/auth');
const { validatePaperGeneration } = require('../middleware/validation');

router.use(authenticate);

router.get('/', paperController.getPapers);
router.post('/generate', validatePaperGeneration, paperController.generatePaper);
router.get('/:id', paperController.getPaperById);
router.delete('/:id', paperController.deletePaper);
router.get('/:id/export', paperController.exportPaper);

module.exports = router;