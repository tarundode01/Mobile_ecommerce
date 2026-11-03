const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { protect } = require('../middlewares/authMiddleware');

router.post('/', protect, orderController.createOrder);
router.get('/my-orders', protect, orderController.getMyOrders);
router.get('/:id', protect, orderController.getOrderById);
router.post('/:id/cancel', protect, orderController.cancelOrder);
router.put('/:id/complete', protect, orderController.customerConfirmDelivery);
router.post('/:id/complete', protect, orderController.customerConfirmDelivery);

module.exports = router;

