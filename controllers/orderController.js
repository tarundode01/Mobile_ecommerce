const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const User = require('../models/User');
const Vendor = require('../models/Vendor');

// @desc    Create / Place a new Order
// @route   POST /api/orders
// @access  Private
exports.createOrder = async (req, res) => {
  try {
    const { items, shippingAddress, paymentMethod, pricing } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'No items in order' });
    }

    if (!shippingAddress || !shippingAddress.street || !shippingAddress.pinCode) {
      return res.status(400).json({ success: false, message: 'Valid shipping address is required' });
    }

    // Default vendor fallback if product vendor is missing
    const defaultVendor = await Vendor.findOne();

    // Verify stock and reserve
    const orderItems = [];
    for (const item of items) {
      const product = await Product.findById(item.product);
      if (!product) {
        return res.status(404).json({ success: false, message: `Product not found: ${item.title}` });
      }

      if (product.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.title}. Only ${product.stock} available.`
        });
      }

      // Decrement stock
      product.stock -= item.quantity;
      if (product.stock <= 0) product.isOutOfStock = true;
      if (!product.vendorId && defaultVendor) {
        product.vendorId = defaultVendor._id;
      }
      await product.save();

      orderItems.push({
        product: product._id,
        vendor: product.vendorId || defaultVendor?._id,
        title: product.title,
        image: product.images[0] || '',
        price: product.salePrice || product.price,
        quantity: item.quantity,
        variant: item.variant
      });
    }

    // Assign active delivery partner
    const deliveryPartnerUser = await User.findOne({ role: 'delivery_partner' });
    const deliveryPartnerData = {
      partnerId: deliveryPartnerUser ? deliveryPartnerUser._id : undefined,
      name: deliveryPartnerUser ? deliveryPartnerUser.name : 'Sanjay Verma (EV Bike)',
      phone: deliveryPartnerUser ? deliveryPartnerUser.phone : '+91 98930 12345',
      trackingId: `TRK-${Date.now().toString().slice(-6)}`,
    };

    // User fallback
    let orderUserId = req.user ? req.user._id : undefined;
    if (!orderUserId) {
      const fallbackUser = await User.findOne({ role: 'customer' }) || await User.findOne();
      orderUserId = fallbackUser ? fallbackUser._id : undefined;
    }

    // Generate unique order number
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `BALAJI-${Date.now().toString().slice(-6)}-${randomSuffix}`;

    const order = await Order.create({
      orderNumber,
      user: orderUserId,
      items: orderItems,
      shippingAddress,
      deliveryPartner: deliveryPartnerData,
      payment: {
        method: paymentMethod || 'COD',
        status: paymentMethod === 'COD' ? 'Pending' : 'Paid',
        transactionId: paymentMethod !== 'COD' ? `TXN-${Date.now()}` : '',
        paidAt: paymentMethod !== 'COD' ? new Date() : undefined
      },
      orderStatus: 'placed',
      timeline: [
        {
          status: 'Order Placed',
          timestamp: new Date(),
          note: 'Customer placed order. Awaiting vendor packing.'
        }
      ],
      pricing: {
        subtotal: pricing?.subtotal || 0,
        discount: pricing?.discount || 0,
        deliveryFee: pricing?.deliveryFee || 0,
        tax: pricing?.tax || 0,
        platformFee: 5,
        totalAmount: pricing?.totalAmount || 0
      },
      invoiceUrl: `https://api.balajistore.com/invoices/${orderNumber}.pdf`
    });

    // Clear user cart if user exists
    if (orderUserId) {
      await Cart.findOneAndUpdate({ user: orderUserId }, { items: [], discountAmount: 0, couponCode: '' });
    }

    res.status(201).json({
      success: true,
      message: 'Order placed successfully! 🎉',
      order
    });
  } catch (error) {
    console.error('Create Order Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get Current User Orders (active, delivered, cancelled)
// @route   GET /api/orders/my-orders
// @access  Private
exports.getMyOrders = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = { user: req.user._id };

    if (status && status !== 'all') {
      if (status === 'active') {
        filter.orderStatus = { $in: ['placed', 'confirmed', 'packed', 'shipped', 'out_for_delivery'] };
      } else {
        filter.orderStatus = status;
      }
    }

    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .populate('items.product', 'title images brand');

    res.json({ success: true, count: orders.length, orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get Order details by ID
// @route   GET /api/orders/:id
// @access  Private
exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      user: req.user._id
    }).populate('items.product items.vendor');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    res.json({ success: true, order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Cancel Order
// @route   POST /api/orders/:id/cancel
// @access  Private
exports.cancelOrder = async (req, res) => {
  try {
    const { reason } = req.body;
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (['shipped', 'out_for_delivery', 'delivered'].includes(order.orderStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Order has already been dispatched. You can request a return after delivery.'
      });
    }

    order.orderStatus = 'cancelled';
    order.cancelReason = reason || 'Customer requested cancellation';
    order.timeline.push({
      status: 'Cancelled',
      timestamp: new Date(),
      note: `Order cancelled. Reason: ${order.cancelReason}`
    });

    // Restore inventory stock
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: item.quantity },
        $set: { isOutOfStock: false }
      });
    }

    await order.save();

    res.json({ success: true, message: 'Order cancelled successfully. Stock restored.', order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

