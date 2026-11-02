const mongoose = require('mongoose');

const BannerSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      default: 'master-store',
      index: true
    },
    title: {
      type: String,
      required: true
    },
    subtitle: String,
    badge: {
      type: String,
      default: 'LIMITED TIME'
    },
    discountText: {
      type: String,
      default: 'UP TO 50% OFF'
    },
    imageUrl: {
      type: String,
      required: true
    },
    ctaText: {
      type: String,
      default: 'Shop Now'
    },
    linkType: {
      type: String,
      enum: ['category', 'product', 'deal', 'brand'],
      default: 'category'
    },
    linkValue: {
      type: String,
      default: 'all'
    },
    bgColor: {
      type: String,
      default: '#4F46E5'
    },
    isActive: {
      type: Boolean,
      default: true
    },
    order: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Banner', BannerSchema);

