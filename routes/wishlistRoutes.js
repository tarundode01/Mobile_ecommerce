const express = require('express');
const router = express.Router();
const wishlistController = require('../controllers/wishlistController');
const { protect } = require('../middlewares/authMiddleware');

router.get('/', protect, wishlistController.getWishlist);
router.post('/toggle', protect, wishlistController.toggleWishlist);
router.delete('/item/:id', protect, wishlistController.removeFromWishlist);
router.delete('/', protect, wishlistController.clearWishlist);

module.exports = router;

