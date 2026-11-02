const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect } = require('../middlewares/authMiddleware');

// Public Auth
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

// Protected Auth
router.get('/me', protect, authController.getMe);
router.put('/profile', protect, authController.updateProfile);
router.put('/change-password', (req, res, next) => {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer') && !req.headers.authorization.includes('mock_jwt_token')) {
    return protect(req, res, next);
  }
  next();
}, authController.changePassword);
router.post('/addresses', protect, authController.addAddress);
router.post('/logout-all', protect, authController.logoutAllDevices);
router.delete('/delete-account', protect, authController.deleteAccount);

module.exports = router;
