const mongoose = require('mongoose');

const OrderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  vendor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor'
  },
  title: { type: String, required: true },
  image: { type: String, default: '' },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true },
  variant: {
    size: String,
    color: String,
    storage: String
  }
});

const TimelineSchema = new mongoose.Schema({
  status: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  note: { type: String }
});

const OrderSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      default: 'master-store',
      index: true
    },
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    items: [OrderItemSchema],
    shippingAddress: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      pinCode: { type: String, required: true },
      country: { type: String, default: 'India' }
    },
    payment: {
      method: {
        type: String,
        enum: ['COD', 'UPI', 'CARD', 'NET_BANKING', 'RAZORPAY'],
        default: 'COD'
      },
      status: {
        type: String,
        enum: ['Pending', 'Paid', 'Failed', 'Refunded'],
        default: 'Pending'
      },
      transactionId: { type: String, default: '' },
      paidAt: { type: Date }
    },
    orderStatus: {
      type: String,
      enum: ['placed', 'confirmed', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned'],
      default: 'placed',
      index: true
    },
    deliveryPartner: {
      partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      name: { type: String, default: 'Balaji Express Logistics' },
      phone: { type: String, default: '+91 98765 43210' },
      trackingId: { type: String },
      liveLocation: {
        latitude: Number,
        longitude: Number
      },
      status: {
        type: String,
        enum: ['assigned', 'accepted', 'reached_pickup', 'picked_up', 'in_transit', 'out_for_delivery', 'reached_customer', 'delivered', 'failed', 'returned'],
        default: 'assigned'
      },
      pickupOtp: { type: String, default: '4812' },
      deliveryOtp: { type: String, default: '9201' },
      deliveryFeeEarned: { type: Number, default: 75 },
      distanceKm: { type: Number, default: 3.4 },
      codCollected: { type: Boolean, default: false },
      codAmountCollected: { type: Number, default: 0 },
      failureReason: { type: String, default: '' },
      deliveryNotes: { type: String, default: '' },
      proofOfDeliveryPhoto: { type: String, default: '' },
      pickedUpAt: { type: Date },
      deliveredAt: { type: Date }
    },
    timeline: [TimelineSchema],
    pricing: {
      subtotal: { type: Number, required: true },
      discount: { type: Number, default: 0 },
      deliveryFee: { type: Number, default: 0 },
      tax: { type: Number, default: 0 },
      platformFee: { type: Number, default: 5 },
      totalAmount: { type: Number, required: true }
    },
    invoiceUrl: { type: String, default: '' },
    cancelReason: { type: String, default: '' },
    returnReason: { type: String, default: '' }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Order', OrderSchema);

