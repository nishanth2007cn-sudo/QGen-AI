const express = require('express');
const router = express.Router();
const bookmarkController = require('../controllers/bookmarkController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', bookmarkController.getBookmarks);
router.post('/', bookmarkController.addBookmark);
router.delete('/:questionId', bookmarkController.removeBookmark);
router.get('/folders', bookmarkController.getFolders);
router.post('/folders', bookmarkController.createFolder);
router.put('/folders/:id', bookmarkController.updateFolder);
router.delete('/folders/:id', bookmarkController.deleteFolder);

module.exports = router;