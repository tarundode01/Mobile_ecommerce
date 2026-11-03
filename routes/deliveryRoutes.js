const express = require('express');
const router = express.Router();
const { protect, protectDelivery, authorize } = require('../middlewares/authMiddleware');
const {
  getDashboard,
  getOrders,
  acceptOrder,
  rejectOrder,
  markReachedPickup,
  verifyPickup,
  markOutForDelivery,
  markReachedCustomer,
  completeDelivery,
  markDeliveryFailed,
  toggleAvailability,
  toggleAttendance,
  requestPayout,
  submitCodDeposit,
  emergencyAlert,
  updateProfile,
  updateLiveLocation,
} = require('../controllers/deliveryController');

// All delivery partner routes use resilient authentication
router.use(protectDelivery);

// 1. Dashboard & Profile
router.get('/dashboard', getDashboard);
router.put('/profile', updateProfile);
router.put('/location', updateLiveLocation);
router.put('/availability', toggleAvailability);
router.put('/attendance', toggleAttendance);

// 2. Orders Lifecycle
router.get('/orders', getOrders);
router.put('/orders/:id/accept', acceptOrder);
router.put('/orders/:id/reject', rejectOrder);
router.put('/orders/:id/reached-pickup', markReachedPickup);
router.put('/orders/:id/pickup', verifyPickup);
router.put('/orders/:id/out-for-delivery', markOutForDelivery);
router.put('/orders/:id/reached-customer', markReachedCustomer);
router.put('/orders/:id/deliver', completeDelivery);
router.put('/orders/:id/fail', markDeliveryFailed);

// 3. Wallet, COD & Safety
router.post('/payout-request', requestPayout);
router.post('/deposit-cod', submitCodDeposit);
router.post('/emergency-alert', emergencyAlert);

module.exports = router;

