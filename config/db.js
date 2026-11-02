const mongoose = require('mongoose');

const LOCAL_URI = 'mongodb://127.0.0.1:27017/ecommerceDB';

const seedDefaultsIfEmpty = async () => {
  try {
    const User = require('../models/User');
    const Vendor = require('../models/Vendor');

    // 1. Ensure Super Admin exists
    const adminExists = await User.findOne({ email: 'admin@balaji.com' });
    if (!adminExists) {
      await User.create({
        name: 'Balaji Super Admin',
        email: 'admin@balaji.com',
        phone: '+91 99999 88888',
        password: 'admin123',
        role: 'admin',
        status: 'active',
        isVerified: true,
      });
      console.log('👑 Default Super Admin (admin@balaji.com) initialized');
    }

    // 2. Ensure Demo Active Vendor exists
    let vendorUser = await User.findOne({ email: 'vendor@balajistore.com' });
    if (!vendorUser) {
      vendorUser = await User.create({
        name: 'Balaji Flagship Store',
        email: 'vendor@balajistore.com',
        phone: '+91 98222 11111',
        password: 'Balaji@123',
        role: 'vendor',
        status: 'active',
        isVerified: true,
      });
      console.log('🏬 Default Vendor User (vendor@balajistore.com) initialized');
    }

    const vendorDoc = await Vendor.findOne({ userId: vendorUser._id });
    if (!vendorDoc) {
      await Vendor.create({
        userId: vendorUser._id,
        storeName: 'Balaji Flagship Store',
        storeSlug: 'balaji-flagship-store',
        businessEmail: 'vendor@balajistore.com',
        businessPhone: '+91 98222 11111',
        description: 'Verified Top-Rated Multivendor Flagship Seller',
        status: 'active',
        isVerified: true,
        rating: 4.9,
        commissionPercentage: 10,
      });
      console.log('🏬 Default Vendor Profile initialized');
    }

    // 3. Ensure Demo Delivery Partner exists
    const DeliveryPartner = require('../models/DeliveryPartner');
    let deliveryUser = await User.findOne({ email: 'delivery@balaji.com' });
    if (!deliveryUser) {
      deliveryUser = await User.create({
        name: 'Sanjay Verma (Delivery Partner)',
        email: 'delivery@balaji.com',
        phone: '+91 98930 12345',
        password: 'Balaji@123',
        role: 'delivery_partner',
        status: 'active',
        isVerified: true,
        avatar: '🛵',
      });
      console.log('🛵 Default Delivery Partner User (delivery@balaji.com) initialized');
    }

    let partnerDoc = await DeliveryPartner.findOne({ userId: deliveryUser._id });
    if (!partnerDoc) {
      partnerDoc = await DeliveryPartner.create({
        userId: deliveryUser._id,
        partnerCode: 'DP-BALAJI-101',
        name: 'Sanjay Verma',
        phone: '+91 98930 12345',
        email: 'delivery@balaji.com',
        avatar: '🛵',
        vehicleType: 'EV Bike',
        vehicleNumber: 'MP-09-EV-4812',
        drivingLicense: 'DL-09-202200192',
        rcNumber: 'RC-998822',
        aadhaarNumber: 'XXXX-XXXX-9021',
        kycStatus: 'verified',
        isOnline: true,
        isBusy: false,
        currentZone: 'Indore Central / Palasia',
        todayDistanceKm: 28,
        todayDeliveriesCount: 9,
        pendingDeliveriesCount: 3,
        todayEarnings: 1250,
        weeklyEarnings: 7850,
        monthlyEarnings: 32400,
        walletBalance: 3450,
        cashInHand: 1850,
        rating: 4.8,
        reviewCount: 154,
      });
      console.log('🛵 Default Delivery Partner Profile initialized');
    }
  } catch (seedErr) {
    console.log('Notice during seed check:', seedErr.message);
  }
};

const connectDB = async () => {
  // First attempt: Primary MongoDB URI (Atlas)
  if (process.env.MONGO_URI) {
    try {
      const conn = await mongoose.connect(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 3000,
      });
      console.log(`✅ MongoDB Atlas Connected successfully: ${conn.connection.host}`);
      console.log(`📁 Database Name: ${conn.connection.name}`);
      await seedDefaultsIfEmpty();
      return;
    } catch (error) {
      console.warn(`⚠️ MongoDB Atlas Connection Failed (${error.message}). Switching to Local MongoDB...`);
    }
  }

  // Second attempt: Local MongoDB
  try {
    const localConn = await mongoose.connect(LOCAL_URI, {
      serverSelectionTimeoutMS: 3000,
    });
    console.log(`✅ Local MongoDB Connected successfully: ${localConn.connection.host}`);
    console.log(`📁 Database Name: ${localConn.connection.name}`);
    await seedDefaultsIfEmpty();
  } catch (localError) {
    console.error(`❌ Local MongoDB Connection Error: ${localError.message}`);
    console.log('🔄 Retrying MongoDB connection in 5 seconds...');
    setTimeout(connectDB, 5000);
  }
};

module.exports = connectDB;
