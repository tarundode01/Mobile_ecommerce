require('dotenv').config();
const mongoose = require('mongoose');

async function testConnection() {
  console.log('Testing connection to MongoDB Atlas...');
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`\n🎉 SUCCESS! MongoDB Connected.`);
    console.log(`Host: ${conn.connection.host}`);
    console.log(`Database: ${conn.connection.name}`);
    await mongoose.connection.close();
    console.log('Connection closed cleanly.');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Connection Failed:');
    console.error(err.message);
    process.exit(1);
  }
}

testConnection();
