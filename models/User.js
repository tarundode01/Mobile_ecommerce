const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const AddressSchema = new mongoose.Schema({
  label: { type: String, default: 'Home' }, // Home, Work, Other
  name: { type: String, required: true },
  phone: { type: String, required: true },
  street: { type: String, required: true },
  landmark: { type: String },
  city: { type: String, required: true },
  state: { type: String, required: true },
  pinCode: { type: String, required: true },
  country: { type: String, default: 'India' },
  isDefault: { type: Boolean, default: false }
});

const SessionSchema = new mongoose.Schema({
  deviceId: { type: String },
  deviceName: { type: String },
  ipAddress: { type: String },
  token: { type: String },
  lastActive: { type: Date, default: Date.now }
});

const UserSchema = new mongoose.Schema(
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
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    phone: {
      type: String,
      trim: true
    },
    password: {
      type: String,
      required: true,
      minlength: 6
    },
    role: {
      type: String,
      enum: ['customer', 'vendor', 'admin', 'delivery_partner'],
      default: 'customer',
      index: true
    },
    avatar: {
      type: String,
      default: '👑'
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
      default: 'male'
    },
    dateOfBirth: {
      type: String,
      default: '1998-05-20'
    },
    altPhone: {
      type: String,
      default: ''
    },
    preferences: {
      pushNotifications: { type: Boolean, default: true },
      orderUpdates: { type: Boolean, default: true },
      promos: { type: Boolean, default: true },
      whatsappAlerts: { type: Boolean, default: true },
      language: { type: String, default: 'Hindi' }
    },
    status: {
      type: String,
      enum: ['active', 'suspended', 'pending_approval'],
      default: 'active'
    },
    isVerified: {
      type: Boolean,
      default: true
    },
    createdVendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      index: true
    },
    createdVendorStoreName: {
      type: String,
      default: ''
    },
    addresses: [AddressSchema],
    activeSessions: [SessionSchema],
    resetPasswordToken: String,
    resetPasswordExpires: Date
  },
  {
    timestamps: true
  }
);

// Hash password before saving
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
UserSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);
