const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');

async function fixDeliveryPasswords() {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ecommerceDB';
  await mongoose.connect(uri);
  
  const deliveryUsers = await User.find({ role: { $in: ['delivery_partner', 'delivery', 'delivery_boy', 'driver'] } });
  console.log('Found delivery users:', deliveryUsers.length);

  for (const user of deliveryUsers) {
    user.password = 'Balaji@123';
    await user.save(); // triggers UserSchema.pre('save') which hashes it properly once!
    console.log(`Updated password for ${user.email} (${user.name})`);
  }

  // Now verify bcrypt compare
  for (const user of deliveryUsers) {
    const fresh = await User.findById(user._id);
    const matches = await fresh.comparePassword('Balaji@123');
    console.log(`Verification: ${fresh.email} matches Balaji@123?`, matches);
  }

  process.exit(0);
}
fixDeliveryPasswords().catch(console.error);

