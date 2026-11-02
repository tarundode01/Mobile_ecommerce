require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

async function testUserCreation() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to Atlas.');

    // Count existing users
    const count = await User.countDocuments();
    console.log(`Current users in MongoDB Atlas: ${count}`);

    await mongoose.connection.close();
    console.log('Done.');
  } catch (err) {
    console.error('Error:', err.message);
  }
}

testUserCreation();

