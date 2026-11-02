const mongoose = require('mongoose');

const VendorSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      default: 'master-store',
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    storeName: {
      type: String,
      required: true,
      trim: true
    },
    storeSlug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    storeLogo: {
      type: String,
      default: ''
    },
    storeBanner: {
      type: String,
      default: ''
    },
    description: String,
    businessEmail: String,
    businessPhone: String,
    address: {
      street: String,
      city: String,
      state: String,
      pinCode: String,
      country: { type: String, default: 'India' }
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [72.8777, 19.0760] // Default Mumbai coordinates
      }
    },
    rating: {
      type: Number,
      default: 4.8
    },
    reviewCount: {
      type: Number,
      default: 0
    },
    isVerified: {
      type: Boolean,
      default: true
    },
    status: {
      type: String,
      enum: ['active', 'pending', 'suspended'],
      default: 'active'
    },
    commissionPercentage: {
      type: Number,
      default: 10
    }
  },
  {
    timestamps: true
  }
);

VendorSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Vendor', VendorSchema);

