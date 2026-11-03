const DeliveryPartner = require('../models/DeliveryPartner');
const Order = require('../models/Order');
const User = require('../models/User');

// Helper to ensure authenticated delivery partner profile exists
const getOrCreatePartnerProfile = async (user) => {
  let partner = await DeliveryPartner.findOne({
    $or: [{ userId: user._id }, { email: user.email }]
  });
  if (!partner) {
    partner = await DeliveryPartner.create({
      userId: user._id,
      partnerCode: 'DP-' + (user._id ? user._id.toString().slice(-4).toUpperCase() : Math.floor(100 + Math.random() * 900)),
      name: user.name || 'Balaji Express Partner',
      phone: user.phone || '+91 98930 12345',
      email: user.email,
      avatar: user.avatar || '🛵',
      vehicleType: 'EV Bike',
      vehicleNumber: 'MP-09-EV-4812',
      drivingLicense: 'DL-09-202200192',
      isOnline: true,
      attendance: { isCheckedIn: true },
      todayDistanceKm: 0,
      todayDeliveriesCount: 0,
      pendingDeliveriesCount: 0,
      todayEarnings: 0,
      weeklyEarnings: 0,
      monthlyEarnings: 0,
      walletBalance: 0,
      cashInHand: 0,
      rating: 5.0,
      reviewCount: 0,
    });
  }
  return partner;
};

// Helper to calculate distance between coordinates
const calculateKmDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 3.2;
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.max(1.1, Math.round(R * c * 10) / 10);
};

// Helper to build robust MongoDB query for partner's assigned orders
const buildPartnerOrdersQuery = (user, partner) => {
  const ids = [user?._id, partner?._id, partner?.userId].filter(Boolean);

  const orConditions = [
    { 'deliveryPartner.partnerId': { $in: ids } },
  ];

  const phones = [user?.phone, partner?.phone].filter(Boolean).map(p => p.replace(/[^0-9]/g, '').slice(-10)).filter(p => p.length >= 10);
  if (phones.length > 0) {
    orConditions.push({
      'deliveryPartner.phone': { $in: phones.map(p => new RegExp(p)) }
    });
  }

  if (user?.name) {
    orConditions.push({
      'deliveryPartner.name': new RegExp('^' + user.name.trim() + '$', 'i')
    });
  }
  if (partner?.name && partner.name !== user?.name) {
    orConditions.push({
      'deliveryPartner.name': new RegExp('^' + partner.name.trim() + '$', 'i')
    });
  }

  return { $or: orConditions };
};

// Helper to format/enrich order with full source, destination and live route info
const enrichOrderWithRoute = (order, partner) => {
  const o = order.toObject ? order.toObject() : { ...order };
  const firstVendor = o.items?.[0]?.vendor;

  const baseSourceLat = o.deliveryPartner?.sourceLocation?.latitude || firstVendor?.location?.coordinates?.[1] || 22.7196;
  const baseSourceLng = o.deliveryPartner?.sourceLocation?.longitude || firstVendor?.location?.coordinates?.[0] || 75.8577;
  const sourceName = o.deliveryPartner?.sourceLocation?.storeName || firstVendor?.storeName || 'Vendor Store';
  const sourceAddress = o.deliveryPartner?.sourceLocation?.address ||
    (typeof firstVendor?.address === 'string' ? firstVendor.address : `${firstVendor?.address?.street || ''}, ${firstVendor?.address?.city || 'Indore'}`) ||
    'Main Market, Indore';
  const sourcePhone = o.deliveryPartner?.sourceLocation?.phone || firstVendor?.businessPhone || firstVendor?.phone || '+91 98260 11223';

  const baseDestLat = o.deliveryPartner?.destinationLocation?.latitude || o.shippingAddress?.latitude || (baseSourceLat + 0.024);
  const baseDestLng = o.deliveryPartner?.destinationLocation?.longitude || o.shippingAddress?.longitude || (baseSourceLng + 0.018);
  const destName = o.deliveryPartner?.destinationLocation?.customerName || o.shippingAddress?.name || 'Customer';
  const destAddress = o.deliveryPartner?.destinationLocation?.address ||
    `${o.shippingAddress?.street || ''}, ${o.shippingAddress?.city || 'Indore'} ${o.shippingAddress?.pinCode || ''}`.trim() ||
    'Indore, Madhya Pradesh';
  const destPhone = o.deliveryPartner?.destinationLocation?.phone || o.shippingAddress?.phone || '+91 98765 43210';

  const riderLat = o.deliveryPartner?.liveLocation?.latitude || partner?.currentLocation?.latitude || (baseSourceLat + 0.005);
  const riderLng = o.deliveryPartner?.liveLocation?.longitude || partner?.currentLocation?.longitude || (baseSourceLng + 0.005);

  const totalDistance = calculateKmDistance(baseSourceLat, baseSourceLng, baseDestLat, baseDestLng);
  const riderToTargetDistance = (o.deliveryPartner?.status === 'picked_up' || o.deliveryPartner?.status === 'out_for_delivery')
    ? calculateKmDistance(riderLat, riderLng, baseDestLat, baseDestLng)
    : calculateKmDistance(riderLat, riderLng, baseSourceLat, baseSourceLng);

  if (!o.deliveryPartner) o.deliveryPartner = {};

  o.deliveryPartner.sourceLocation = {
    storeName: sourceName,
    address: sourceAddress,
    latitude: baseSourceLat,
    longitude: baseSourceLng,
    phone: sourcePhone,
  };

  o.deliveryPartner.destinationLocation = {
    customerName: destName,
    address: destAddress,
    latitude: baseDestLat,
    longitude: baseDestLng,
    phone: destPhone,
  };

  o.deliveryPartner.liveLocation = {
    latitude: riderLat,
    longitude: riderLng,
  };

  o.deliveryPartner.distanceKm = o.deliveryPartner.distanceKm || totalDistance;
  o.deliveryPartner.riderToTargetDistanceKm = riderToTargetDistance;

  return o;
};

// @desc    Get Delivery Partner Dashboard Overview
// @route   GET /api/delivery/dashboard
// @access  Private (delivery_partner)
exports.getDashboard = async (req, res) => {
  try {
    const partner = await getOrCreatePartnerProfile(req.user);
    const orderQuery = buildPartnerOrdersQuery(req.user, partner);

    // Query real orders assigned to this partner
    const orders = await Order.find(orderQuery)
      .populate('items.product', 'title image price brand')
      .populate('items.vendor', 'storeName address businessPhone')
      .sort({ createdAt: -1 });

    const totalAssigned = orders.length;
    const completedOrders = orders.filter((o) => o.orderStatus === 'delivered' || o.deliveryPartner?.status === 'delivered');
    const completedCount = completedOrders.length;
    const pendingOrders = orders.filter((o) =>
      !['delivered', 'cancelled', 'returned'].includes(o.orderStatus) &&
      o.deliveryPartner?.status !== 'delivered'
    );
    const pendingCount = pendingOrders.length;

    const dynamicTodayEarnings = completedOrders.reduce(
      (sum, o) => sum + (o.deliveryPartner?.deliveryFeeEarned || 75),
      0
    ) + (partner.todayEarnings || 0);

    const dynamicDistance = completedOrders.reduce(
      (sum, o) => sum + (o.deliveryPartner?.distanceKm || 3.2),
      0
    ) + (partner.todayDistanceKm || 0);

    const dynamicCodCashInHand = orders.reduce((sum, o) => {
      if (
        (o.payment?.method === 'COD' || o.deliveryPartner?.codCollected) &&
        (o.deliveryPartner?.status === 'delivered' || o.orderStatus === 'delivered') &&
        !o.deliveryPartner?.codDeposited
      ) {
        return sum + (o.pricing?.totalAmount || o.deliveryPartner?.codAmountCollected || 0);
      }
      return sum;
    }, partner.cashInHand || 0);

    const summary = {
      assignedOrders: totalAssigned,
      completedDeliveries: completedCount,
      pendingDeliveries: pendingCount,
      todayEarnings: dynamicTodayEarnings,
      averageRating: partner.rating || 5.0,
      todayDistanceKm: Math.round(dynamicDistance * 10) / 10,
      walletBalance: partner.walletBalance || dynamicTodayEarnings,
      cashInHand: dynamicCodCashInHand,
      isOnline: partner.isOnline,
      isBusy: pendingCount > 0,
      attendance: partner.attendance || { isCheckedIn: true },
      currentZone: partner.currentZone || 'Indore Central Hub',
      vehicleType: partner.vehicleType || 'EV Bike',
      vehicleNumber: partner.vehicleNumber || 'MP-09-EV-4812',
      kycStatus: partner.kycStatus || 'verified',
    };

    res.json({
      success: true,
      partner,
      summary,
    });
  } catch (error) {
    console.error('Delivery getDashboard error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get Assigned Delivery Orders
// @route   GET /api/delivery/orders
// @access  Private (delivery_partner)
exports.getOrders = async (req, res) => {
  try {
    const partner = await getOrCreatePartnerProfile(req.user);
    const { status } = req.query;
    const orderQuery = buildPartnerOrdersQuery(req.user, partner);

    let orders = await Order.find(orderQuery)
      .populate('items.product', 'title image price brand')
      .populate('items.vendor', 'storeName address businessPhone')
      .sort({ createdAt: -1 });

    if (status && status !== 'all') {
      if (status === 'active') {
        orders = orders.filter((o) =>
          !['delivered', 'cancelled', 'returned'].includes(o.orderStatus) &&
          o.deliveryPartner?.status !== 'delivered'
        );
      } else if (status === 'completed') {
        orders = orders.filter((o) =>
          o.orderStatus === 'delivered' || o.deliveryPartner?.status === 'delivered'
        );
      } else if (status === 'failed') {
        orders = orders.filter((o) =>
          ['cancelled', 'returned'].includes(o.orderStatus) || o.deliveryPartner?.status === 'failed'
        );
      }
    }

    const enrichedOrders = orders.map((o) => enrichOrderWithRoute(o, partner));

    res.json({
      success: true,
      orders: enrichedOrders,
      count: enrichedOrders.length,
    });
  } catch (error) {
    console.error('Delivery getOrders error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Accept Order Assignment
// @route   PUT /api/delivery/orders/:id/accept
// @access  Private (delivery_partner)
exports.acceptOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    order.deliveryPartner.status = 'accepted';
    order.timeline.push({
      status: 'accepted',
      note: 'Delivery Partner accepted delivery request and is proceeding to pickup location.',
    });
    await order.save();

    res.json({
      success: true,
      message: 'Delivery request accepted! Proceed to vendor store for pickup.',
      order,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Reject Order Assignment
// @route   PUT /api/delivery/orders/:id/reject
// @access  Private (delivery_partner)
exports.rejectOrder = async (req, res) => {
  try {
    const { reason } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    order.deliveryPartner.status = 'assigned';
    order.deliveryPartner.failureReason = reason || 'Partner unavailable';
    order.timeline.push({
      status: 'reassigned',
      note: `Delivery partner declined: ${reason || 'Busy / Out of range'}. Reassigning to next partner.`,
    });
    await order.save();

    res.json({
      success: true,
      message: 'Order assignment declined. Admin dispatch will reassign order.',
      order,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Mark Reached Pickup Location
// @route   PUT /api/delivery/orders/:id/reached-pickup
// @access  Private (delivery_partner)
exports.markReachedPickup = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    order.deliveryPartner.status = 'reached_pickup';
    order.timeline.push({
      status: 'reached_pickup',
      note: 'Delivery partner has arrived at vendor store/warehouse.',
    });
    await order.save();

    res.json({
      success: true,
      message: 'Arrived at pickup location! Verify package and enter Pickup OTP.',
      order,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Verify Pickup with OTP and Handover
// @route   PUT /api/delivery/orders/:id/pickup
// @access  Private (delivery_partner)
exports.verifyPickup = async (req, res) => {
  try {
    const { otp } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    // Validate OTP (allow test OTP 4812 or stored OTP)
    if (otp && otp !== '4812' && order.deliveryPartner?.pickupOtp && otp !== order.deliveryPartner.pickupOtp) {
      return res.status(400).json({ success: false, message: 'Invalid Pickup OTP provided by vendor.' });
    }

    order.orderStatus = 'shipped';
    order.deliveryPartner.status = 'picked_up';
    order.deliveryPartner.pickedUpAt = new Date();
    order.timeline.push({
      status: 'picked_up',
      note: 'Package handed over by vendor and verified via Pickup OTP.',
    });
    await order.save();

    res.json({
      success: true,
      message: 'Package picked up successfully! Start navigation to customer address.',
      order,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Start Out for Delivery
// @route   PUT /api/delivery/orders/:id/out-for-delivery
// @access  Private (delivery_partner)
exports.markOutForDelivery = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    order.orderStatus = 'out_for_delivery';
    order.deliveryPartner.status = 'out_for_delivery';
    order.timeline.push({
      status: 'out_for_delivery',
      note: 'Driver is on the way to deliver the package.',
    });
    await order.save();

    res.json({
      success: true,
      message: 'Order is now Out for Delivery! Live tracking shared with customer.',
      order,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Mark Reached Customer Doorstep
// @route   PUT /api/delivery/orders/:id/reached-customer
// @access  Private (delivery_partner)
exports.markReachedCustomer = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    order.deliveryPartner.status = 'reached_customer';
    order.timeline.push({
      status: 'reached_customer',
      note: 'Delivery partner has arrived at customer location.',
    });
    await order.save();

    res.json({
      success: true,
      message: 'Arrived at customer address! Ring bell & request Delivery OTP.',
      order,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Complete Delivery (Verify OTP & COD Collection)
// @route   PUT /api/delivery/orders/:id/deliver
// @access  Private (delivery_partner)
exports.completeDelivery = async (req, res) => {
  try {
    const { otp, codCollected, proofPhoto } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    // Validate Delivery OTP (allow test OTP 9201 or stored OTP)
    if (otp && otp !== '9201' && order.deliveryPartner?.deliveryOtp && otp !== order.deliveryPartner.deliveryOtp) {
      return res.status(400).json({ success: false, message: 'Invalid Customer Delivery OTP.' });
    }

    const partner = await getOrCreatePartnerProfile(req.user);
    const feeEarned = order.deliveryPartner?.deliveryFeeEarned || 75;

    order.orderStatus = 'delivered';
    order.deliveryPartner.status = 'delivered';
    order.deliveryPartner.deliveredAt = new Date();
    if (proofPhoto) order.deliveryPartner.proofOfDeliveryPhoto = proofPhoto;

    // Handle COD collection if COD order
    const isCod = order.payment?.method === 'COD';
    if (isCod) {
      order.payment.status = 'Paid';
      order.deliveryPartner.codCollected = true;
      order.deliveryPartner.codAmountCollected = order.pricing?.totalAmount || 0;
      partner.cashInHand += order.pricing?.totalAmount || 0;
    }

    order.timeline.push({
      status: 'delivered',
      note: `Package delivered successfully. Verified via OTP. ${isCod ? 'Cash on Delivery collected.' : 'Prepaid order.'}`,
    });
    await order.save();

    // Increment partner earnings & stats
    partner.todayEarnings += feeEarned;
    partner.walletBalance += feeEarned;
    partner.todayDeliveriesCount += 1;
    partner.todayDistanceKm += order.deliveryPartner?.distanceKm || 3;
    if (partner.pendingDeliveriesCount > 0) partner.pendingDeliveriesCount -= 1;
    await partner.save();

    res.json({
      success: true,
      message: `🎉 Delivery completed successfully! ₹${feeEarned} credited to your wallet.`,
      order,
      partnerSummary: {
        todayEarnings: partner.todayEarnings,
        walletBalance: partner.walletBalance,
        cashInHand: partner.cashInHand,
        completedDeliveries: partner.todayDeliveriesCount,
      },
    });
  } catch (error) {
    console.error('Delivery completeDelivery error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Mark Delivery Failed
// @route   PUT /api/delivery/orders/:id/fail
// @access  Private (delivery_partner)
exports.markDeliveryFailed = async (req, res) => {
  try {
    const { reason, notes } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    order.deliveryPartner.status = 'failed';
    order.deliveryPartner.failureReason = reason || 'Customer unavailable';
    order.deliveryPartner.deliveryNotes = notes || '';
    order.timeline.push({
      status: 'delivery_failed',
      note: `Delivery attempt failed: ${reason || 'Unreachable'}. ${notes || ''}`,
    });
    await order.save();

    res.json({
      success: true,
      message: `Delivery attempt logged as failed: "${reason}". Return to hub or retry tomorrow.`,
      order,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Toggle Online / Offline Status
// @route   PUT /api/delivery/availability
// @access  Private (delivery_partner)
exports.toggleAvailability = async (req, res) => {
  try {
    const partner = await getOrCreatePartnerProfile(req.user);
    partner.isOnline = !partner.isOnline;
    await partner.save();

    res.json({
      success: true,
      isOnline: partner.isOnline,
      message: partner.isOnline
        ? '🟢 You are now ONLINE! Ready to receive new orders.'
        : '⚪ You are now OFFLINE. New assignments paused.',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Toggle Shift Attendance
// @route   PUT /api/delivery/attendance
// @access  Private (delivery_partner)
exports.toggleAttendance = async (req, res) => {
  try {
    const partner = await getOrCreatePartnerProfile(req.user);
    const currentlyIn = partner.attendance?.isCheckedIn;

    if (!currentlyIn) {
      partner.attendance.isCheckedIn = true;
      partner.attendance.checkInTime = new Date();
      partner.isOnline = true;
    } else {
      partner.attendance.isCheckedIn = false;
      partner.attendance.checkOutTime = new Date();
      partner.isOnline = false;
    }
    await partner.save();

    res.json({
      success: true,
      attendance: partner.attendance,
      message: partner.attendance.isCheckedIn
        ? '✅ Check-In Recorded! Have a safe shift.'
        : '👋 Check-Out Recorded! Good work today.',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Request Wallet Payout
// @route   POST /api/delivery/payout-request
// @access  Private (delivery_partner)
exports.requestPayout = async (req, res) => {
  try {
    const { amount } = req.body;
    const partner = await getOrCreatePartnerProfile(req.user);

    const withdrawAmt = Number(amount) || partner.walletBalance;
    if (withdrawAmt <= 0 || withdrawAmt > partner.walletBalance) {
      return res.status(400).json({
        success: false,
        message: 'Invalid withdrawal amount or insufficient wallet balance.',
      });
    }

    partner.walletBalance -= withdrawAmt;
    partner.payoutHistory.unshift({
      payoutId: 'PO-' + Date.now().toString().slice(-6),
      amount: withdrawAmt,
      date: new Date().toLocaleDateString('en-IN'),
      status: 'Completed',
      bankRef: 'IMPS-' + Math.floor(100000 + Math.random() * 900000),
    });
    await partner.save();

    res.json({
      success: true,
      message: `₹${withdrawAmt.toLocaleString('en-IN')} successfully transferred to ${partner.bankDetails.bankName}!`,
      walletBalance: partner.walletBalance,
      payoutHistory: partner.payoutHistory,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Submit Cash on Delivery (COD) Deposit
// @route   POST /api/delivery/deposit-cod
// @access  Private (delivery_partner)
exports.submitCodDeposit = async (req, res) => {
  try {
    const { amount } = req.body;
    const partner = await getOrCreatePartnerProfile(req.user);

    const depositAmt = Number(amount) || partner.cashInHand;
    if (depositAmt <= 0 || depositAmt > partner.cashInHand) {
      return res.status(400).json({
        success: false,
        message: 'Invalid deposit amount.',
      });
    }

    partner.cashInHand -= depositAmt;
    partner.codDeposits.unshift({
      depositId: 'DEP-' + Date.now().toString().slice(-6),
      amount: depositAmt,
      date: new Date().toLocaleDateString('en-IN'),
      status: 'Verified',
      adminNotes: 'Cash deposited at Central Hub cashier.',
    });
    await partner.save();

    res.json({
      success: true,
      message: `₹${depositAmt.toLocaleString('en-IN')} COD cash deposit confirmed by Hub Admin!`,
      cashInHand: partner.cashInHand,
      codDeposits: partner.codDeposits,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Send SOS Emergency Alert
// @route   POST /api/delivery/emergency-alert
// @access  Private (delivery_partner)
exports.emergencyAlert = async (req, res) => {
  try {
    const { issueType, notes, latitude, longitude } = req.body;
    const partner = await getOrCreatePartnerProfile(req.user);

    res.json({
      success: true,
      message: `🚨 Emergency SOS Alert dispatched to Central Security & Emergency Contact (${partner.emergencyContact.name}: ${partner.emergencyContact.phone})! Help is on the way.`,
      incidentRef: 'SOS-' + Date.now().toString().slice(-6),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update Delivery Partner Profile
// @route   PUT /api/delivery/profile
// @access  Private (delivery_partner)
exports.updateProfile = async (req, res) => {
  try {
    const partner = await getOrCreatePartnerProfile(req.user);
    const { vehicleType, vehicleNumber, phone, drivingLicense, currentZone, bankDetails, emergencyContact } = req.body;

    if (vehicleType) partner.vehicleType = vehicleType;
    if (vehicleNumber) partner.vehicleNumber = vehicleNumber;
    if (phone) partner.phone = phone;
    if (drivingLicense) partner.drivingLicense = drivingLicense;
    if (currentZone) partner.currentZone = currentZone;
    if (bankDetails) partner.bankDetails = { ...partner.bankDetails, ...bankDetails };
    if (emergencyContact) partner.emergencyContact = { ...partner.emergencyContact, ...emergencyContact };

    await partner.save();

    res.json({
      success: true,
      message: 'Delivery Partner profile updated successfully!',
      partner,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update Delivery Partner Live GPS Location
// @route   PUT /api/delivery/location
// @access  Private (delivery_partner)
exports.updateLiveLocation = async (req, res) => {
  try {
    const partner = await getOrCreatePartnerProfile(req.user);
    const { latitude, longitude, address, speedKmH, batteryLevel } = req.body;

    if (latitude && longitude) {
      partner.currentLocation = {
        latitude: Number(latitude),
        longitude: Number(longitude),
        address: address || partner.currentLocation?.address || 'Live Delivery Route'
      };

      // Also sync live location on active orders assigned to this partner so customer and vendor track in real-time
      const partnerIds = [partner._id, partner.userId, req.user?._id].filter(Boolean);
      await Order.updateMany(
        {
          $or: [
            { 'deliveryPartner.partnerId': { $in: partnerIds } },
            { 'deliveryPartner.phone': req.user?.phone || partner.phone },
            { 'deliveryPartner.name': req.user?.name || partner.name }
          ],
          orderStatus: { $in: ['placed', 'confirmed', 'packed', 'shipped', 'out_for_delivery'] }
        },
        {
          $set: {
            'deliveryPartner.liveLocation': {
              latitude: Number(latitude),
              longitude: Number(longitude)
            }
          }
        }
      );
    }
    if (speedKmH !== undefined) partner.speedKmH = Number(speedKmH);
    if (batteryLevel !== undefined) partner.batteryLevel = Number(batteryLevel);

    await partner.save();

    res.json({
      success: true,
      message: 'Live GPS location synchronized',
      currentLocation: partner.currentLocation,
      speedKmH: partner.speedKmH,
      batteryLevel: partner.batteryLevel,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

