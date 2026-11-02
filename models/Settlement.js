const mongoose = require('mongoose');

const SettlementSchema = new mongoose.Schema(
  {
    settlementId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
      index: true
    },
    amount: {
      type: Number,
      required: true
    },
    commissionDeducted: {
      type: Number,
      default: 0
    },
    netPayout: {
      type: Number,
      required: true
    },
    bankRef: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['Pending', 'Processing', 'Completed', 'Rejected'],
      default: 'Processing'
    },
    requestedAt: {
      type: Date,
      default: Date.now
    },
    processedAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Settlement', SettlementSchema);

