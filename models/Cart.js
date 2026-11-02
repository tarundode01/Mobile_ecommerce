const mongoose = require('mongoose');

const CartItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  vendor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor'
  },
  variant: {
    size: String,
    color: String,
    storage: String,
    sku: String
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  price: {
    type: Number,
    required: true
  }
});

const CartSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      default: 'master-store',
      index: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    guestSessionId: {
      type: String,
      default: null,
      index: true
    },
    items: [CartItemSchema],
    couponCode: {
      type: String,
      default: ''
    },
    discountAmount: {
      type: Number,
      default: 0
    },
    subtotal: {
      type: Number,
      default: 0
    },
    totalAmount: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

// Auto calculate subtotal & total
CartSchema.methods.calculateTotals = function () {
  this.subtotal = this.items.reduce((acc, item) => acc + item.price * item.quantity, 0);
  this.totalAmount = Math.max(0, this.subtotal - (this.discountAmount || 0));
  return this.totalAmount;
};

module.exports = mongoose.model('Cart', CartSchema);

