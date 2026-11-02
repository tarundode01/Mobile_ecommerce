require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const DeliveryPartner = require('./models/DeliveryPartner');
const Order = require('./models/Order');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const Vendor = require('./models/Vendor');
  const vendors = await Vendor.find({});
  console.log('Vendors count:', vendors.length);
  vendors.forEach(v => console.log('Vendor:', { id: v._id.toString(), storeName: v.storeName, email: v.businessEmail }));

  const products = await require('./models/Product').find({});
  console.log('Products count:', products.length);
  products.forEach(p => console.log('Product:', { id: p._id.toString(), title: p.title, vendor: p.vendor?.toString() }));

  const partners = await DeliveryPartner.find({});
  console.log('DeliveryPartner docs count:', partners.length);
  partners.forEach(p => console.log('Partner:', { id: p._id.toString(), userId: p.userId?.toString(), name: p.name, email: p.email, phone: p.phone, vendorId: p.vendorId?.toString() }));

  const allOrders = await Order.find({});
  console.log('Total Orders count:', allOrders.length);
  allOrders.forEach(o => {
    console.log('Order:', {
      id: o._id.toString(),
      orderNumber: o.orderNumber,
      orderStatus: o.orderStatus,
      deliveryPartner: o.deliveryPartner
    });
  });

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
