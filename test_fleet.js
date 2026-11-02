const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');
const DeliveryPartner = require('./models/DeliveryPartner');
const Vendor = require('./models/Vendor');

async function check() {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ecommerceDB';
  await mongoose.connect(uri);
  console.log('Connected to DB');
  const vendors = await Vendor.find().lean();
  console.log('Vendors:', vendors.map(v => ({ id: v._id.toString(), name: v.storeName, email: v.businessEmail })));
  const users = await User.find({ role: { $in: ['delivery_partner', 'delivery', 'delivery_boy', 'driver'] } }).lean();
  console.log('Delivery Users:', users.map(u => ({ id: u._id.toString(), name: u.name, email: u.email, role: u.role, createdVendorId: u.createdVendorId })));
  const partners = await DeliveryPartner.find().lean();
  console.log('DeliveryPartners:', partners.map(p => ({ id: p._id.toString(), name: p.name, email: p.email, vendorId: p.vendorId, vendorStoreName: p.vendorStoreName })));
  process.exit(0);
}
check().catch(console.error);
