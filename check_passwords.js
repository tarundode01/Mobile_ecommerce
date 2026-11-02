const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();
const User = require('./models/User');

async function testDoubleHash() {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ecommerceDB';
  await mongoose.connect(uri);
  const u = await User.findOne({ email: 'delivery4@gmail.com' }).lean();
  
  // What if the plaintext was 'Balaji@123' or '123456'?
  // If it was double hashed, the first hash looks like: $2a$10$... or $2b$10$...
  // We can't know the exact salt of the first hash, but what if the vendor modal didn't hash it,
  // or what if we just reset all created delivery boys' passwords to 'Balaji@123' properly?
  console.log('Testing reset on delivery4...');
  const salt = await bcrypt.genSalt(10);
  const properHash = await bcrypt.hash('Balaji@123', salt);
  console.log('Compare properHash with Balaji@123:', await bcrypt.compare('Balaji@123', properHash));
  process.exit(0);
}
testDoubleHash().catch(console.error);
