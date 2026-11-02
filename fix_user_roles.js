const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://TarunDode:Sitaram%404812@cluster0.sa7a3db.mongodb.net/ecommerceDB').then(async () => {
  const res = await mongoose.connection.db.collection('users').updateMany(
    { role: { $nin: ['admin', 'vendor', 'delivery_partner'] } },
    { $set: { role: 'customer' } }
  );
  console.log('Updated non-admin/vendor users to customer:', res.modifiedCount);
  const users = await mongoose.connection.db.collection('users').find().toArray();
  console.log('Current users:', users.map(u => ({ name: u.name, email: u.email, role: u.role })));
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});

