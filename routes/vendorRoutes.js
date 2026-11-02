const express = require('express');
const router = express.Router();
const vendorController = require('../controllers/vendorController');

// 1. Dashboard Metrics (All 8 main summary cards + full analytics)
router.get('/dashboard', vendorController.getVendorDashboard);

// 2. Products CRUD (Strictly isolated to vendor)
router.get('/products', vendorController.getVendorProducts);
router.post('/products', vendorController.addVendorProduct);
router.put('/products/:id', vendorController.updateVendorProduct);
router.delete('/products/:id', vendorController.deleteVendorProduct);
router.put('/products/:id/stock', vendorController.updateVendorStock);

// 3. Orders Management
router.get('/orders', vendorController.getVendorOrders);
router.put('/orders/:id/status', vendorController.updateVendorOrderStatus);
router.post('/orders/:id/assign-delivery', vendorController.assignOrderDeliveryPartner);

// 4. Wallet & Settlements
router.get('/wallet', vendorController.getVendorWallet);
router.post('/wallet/payout', vendorController.requestVendorPayout);

// 5. Store Profile
router.get('/store', vendorController.getVendorStore);
router.put('/store', vendorController.updateVendorStore);

// 6. List All Vendors (For Admin & Quick Switcher)
router.get('/all', vendorController.getAllVendors);

// 7. Delivery Partners Management (For Vendor Fleet)
router.get('/delivery-partners', vendorController.getVendorDeliveryPartners);
router.post('/delivery-partners', vendorController.createVendorDeliveryPartner);
router.put('/delivery-partners/:id', vendorController.updateVendorDeliveryPartner);
router.delete('/delivery-partners/:id', vendorController.deleteVendorDeliveryPartner);
router.get('/fleet/live-locations', vendorController.getVendorFleetLiveLocations);

module.exports = router;

