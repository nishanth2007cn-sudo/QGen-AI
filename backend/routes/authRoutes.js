const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { validateRegistration, validateLogin, validateChangePassword } = require('../middleware/validation');

router.post('/register', validateRegistration, authController.register);
router.post('/login', validateLogin, authController.login);
router.post('/logout', authenticate, authController.logout);
router.post('/refresh', authController.refreshToken);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

router.get('/me', authenticate, authController.getProfile);
router.put('/me', authenticate, authController.updateProfile);
router.put('/me/password', authenticate, validateChangePassword, authController.changePassword);

router.get('/settings', authenticate, authController.getSettings);
router.put('/settings', authenticate, authController.updateSettings);

module.exports = router;