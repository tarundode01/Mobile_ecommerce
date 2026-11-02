const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

// Home Feed
router.get('/home-feed', productController.getHomeFeed);

// Suggestions
router.get('/suggestions', productController.getSuggestions);

// Check PIN code
router.post('/check-pincode', productController.checkPinCode);

// Product Catalog
router.get('/', productController.getProducts);
router.get('/:id', productController.getProductById);

module.exports = router;

