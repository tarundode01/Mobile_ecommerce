const mongoose = require('mongoose');

const VariantSchema = new mongoose.Schema({
  sku: { type: String },
  size: { type: String },
  color: { type: String },
  storage: { type: String },
  price: { type: Number, required: true },
  salePrice: { type: Number },
  stock: { type: Number, default: 10 }
});

const ProductSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      default: 'master-store',
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    sku: {
      type: String,
      trim: true
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      required: false,
      index: true
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      index: true
    },
    subcategory: {
      type: String,
      default: ''
    },
    brand: {
      type: String,
      trim: true,
      default: 'Balaji Premium'
    },
    description: {
      type: String,
      required: true
    },
    specifications: [
      {
        key: { type: String },
        value: { type: String }
      }
    ],
    images: {
      type: [String],
      required: true,
      default: []
    },
    videoUrl: String,
    price: {
      type: Number,
      required: true
    },
    salePrice: {
      type: Number,
      required: true
    },
    discountPercentage: {
      type: Number,
      default: 0
    },
    stock: {
      type: Number,
      required: true,
      default: 20
    },
    isOutOfStock: {
      type: Boolean,
      default: false
    },
    rating: {
      type: Number,
      default: 4.8
    },
    numReviews: {
      type: Number,
      default: 0
    },
    tags: {
      type: [String],
      default: ['trending'],
      index: true
    }, // 'trending', 'bestseller', 'new_arrival', 'deal_of_the_day'
    variants: [VariantSchema],
    deliveryInfo: {
      estimatedDays: { type: Number, default: 2 },
      returnPolicyDays: { type: Number, default: 7 },
      warranty: { type: String, default: '1 Year Brand Warranty' },
      isFreeDelivery: { type: Boolean, default: true }
    },
    isPublished: {
      type: Boolean,
      default: true
    },
    isFeatured: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

// Calculate discount percentage before saving
ProductSchema.pre('save', function (next) {
  if (this.price && this.salePrice && this.price > this.salePrice) {
    this.discountPercentage = Math.round(((this.price - this.salePrice) / this.price) * 100);
  } else {
    this.discountPercentage = 0;
  }
  this.isOutOfStock = this.stock <= 0;
  next();
});

ProductSchema.index({ title: 'text', brand: 'text', description: 'text' });

module.exports = mongoose.model('Product', ProductSchema);

