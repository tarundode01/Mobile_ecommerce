const mongoose = require('mongoose');

const CategorySchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      default: 'master-store',
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    icon: {
      type: String,
      default: '🛍️'
    },
    image: {
      type: String,
      default: ''
    },
    description: String,
    parentCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null
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

module.exports = mongoose.model('Category', CategorySchema);

