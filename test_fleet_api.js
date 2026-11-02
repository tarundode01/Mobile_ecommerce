const mongoose = require('mongoose');
require('dotenv').config();
const vendorController = require('./controllers/vendorController');

async function testApi() {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ecommerceDB';
  await mongoose.connect(uri);

  const req = {
    user: { id: '6ae4300fcf09679ce77d6b1c', role: 'vendor', email: 'luxe@balajistore.com' },
    query: { vendorId: '6ae4300fcf09679ce77d6b1c' }
  };
  const res = {
    json: (data) => {
      console.log('Result riders count:', data.riders?.length);
      console.log('Result riders:', data.riders?.map(r => ({ id: r.id, name: r.name, lat: r.latitude, lng: r.longitude, status: r.status })));
    },
    status: (code) => ({
      json: (err) => console.log('Error status:', code, err)
    })
  };

  await vendorController.getVendorFleetLiveLocations(req, res);
  process.exit(0);
}
testApi().catch(console.error);

