const mongoose = require('mongoose');

const DeliveryPartnerSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      index: true,
    },
    vendorStoreName: {
      type: String,
      default: '',
    },
    batteryLevel: {
      type: Number,
      default: 85,
    },
    speedKmH: {
      type: Number,
      default: 24,
    },
    partnerCode: {
      type: String,
      required: true,
      unique: true,
      default: () => 'DP-' + Math.floor(100 + Math.random() * 900),
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    avatar: {
      type: String,
      default: '🛵',
    },
    vehicleType: {
      type: String,
      enum: ['EV Bike', 'Motorcycle', 'Scooter', 'EV Van', 'Bicycle'],
      default: 'EV Bike',
    },
    vehicleNumber: {
      type: String,
      default: 'MP-09-EV-4812',
    },
    drivingLicense: {
      type: String,
      default: 'DL-09-202200192',
    },
    rcNumber: {
      type: String,
      default: 'RC-998822',
    },
    aadhaarNumber: {
      type: String,
      default: 'XXXX-XXXX-9021',
    },
    kycStatus: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'verified',
    },
    isOnline: {
      type: Boolean,
      default: true,
    },
    isBusy: {
      type: Boolean,
      default: false,
    },
    currentZone: {
      type: String,
      default: 'Indore Central / Vijay Nagar',
    },
    currentLocation: {
      latitude: { type: Number, default: 22.7196 },
      longitude: { type: Number, default: 75.8577 },
      address: { type: String, default: 'Palasia Square, Indore' },
    },
    todayDistanceKm: {
      type: Number,
      default: 28,
    },
    todayDeliveriesCount: {
      type: Number,
      default: 9,
    },
    pendingDeliveriesCount: {
      type: Number,
      default: 3,
    },
    todayEarnings: {
      type: Number,
      default: 1250,
    },
    weeklyEarnings: {
      type: Number,
      default: 7850,
    },
    monthlyEarnings: {
      type: Number,
      default: 32400,
    },
    totalEarnings: {
      type: Number,
      default: 98600,
    },
    walletBalance: {
      type: Number,
      default: 3450,
    },
    cashInHand: {
      type: Number,
      default: 1850,
    },
    rating: {
      type: Number,
      default: 4.8,
    },
    reviewCount: {
      type: Number,
      default: 154,
    },
    attendance: {
      isCheckedIn: { type: Boolean, default: true },
      checkInTime: { type: Date, default: () => new Date(Date.now() - 4 * 3600000) },
      checkOutTime: { type: Date },
      totalShiftMinutes: { type: Number, default: 240 },
    },
    bankDetails: {
      accountHolder: { type: String, default: 'Sanjay Verma' },
      accountNumber: { type: String, default: '50100481239912' },
      ifscCode: { type: String, default: 'HDFC0001234' },
      bankName: { type: String, default: 'HDFC Bank, Palasia Branch' },
      isVerified: { type: Boolean, default: true },
    },
    emergencyContact: {
      name: { type: String, default: 'Kailash Verma' },
      phone: { type: String, default: '+91 98260 99887' },
      relation: { type: String, default: 'Brother' },
    },
    payoutHistory: [
      {
        payoutId: String,
        amount: Number,
        date: String,
        status: { type: String, enum: ['Completed', 'Pending', 'Failed'], default: 'Completed' },
        bankRef: String,
      },
    ],
    codDeposits: [
      {
        depositId: String,
        amount: Number,
        date: String,
        status: { type: String, enum: ['Verified', 'Pending Review'], default: 'Verified' },
        adminNotes: String,
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('DeliveryPartner', DeliveryPartnerSchema);

