const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const { protect } = require('../middlewares/authMiddleware');

// Optional auth helper
const optionalAuth = (req, res, next) => {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    return protect(req, res, next);
  }
  next();
};

router.get('/', optionalAuth, cartController.getCart);
router.post('/add', optionalAuth, cartController.addToCart);
router.put('/item/:itemId', optionalAuth, cartController.updateQuantity);
router.delete('/item/:itemId', optionalAuth, cartController.removeItem);
router.post('/merge', protect, cartController.mergeGuestCart);
router.post('/apply-coupon', optionalAuth, cartController.applyCoupon);

module.exports = router;

