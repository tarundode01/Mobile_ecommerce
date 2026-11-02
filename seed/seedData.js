require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('../models/Category');
const Vendor = require('../models/Vendor');
const Product = require('../models/Product');
const Banner = require('../models/Banner');
const User = require('../models/User');

const SEED_BANNERS = [
  {
    title: 'Festive Mega Carnival',
    subtitle: 'Flat 50% Off on Top Tech & Accessories',
    badge: 'LIMITED TIME DEAL',
    discountText: 'UP TO 50% OFF',
    imageUrl: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=1200&q=80',
    ctaText: 'Claim Offer',
    linkType: 'deal',
    linkValue: 'mega-carnival',
    bgColor: '#4F46E5',
    order: 1
  },
  {
    title: 'Next-Gen Wireless Audio',
    subtitle: 'Studio Sound, Active Noise Cancelling',
    badge: 'NEW ARRIVAL',
    discountText: 'SAVE ₹2,000',
    imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1200&q=80',
    ctaText: 'Explore Now',
    linkType: 'category',
    linkValue: 'electronics',
    bgColor: '#0F172A',
    order: 2
  },
  {
    title: 'Premium Footwear Collection',
    subtitle: 'Crafted for Comfort and Elegance',
    badge: 'TRENDING FASHION',
    discountText: 'FLAT 40% OFF',
    imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=80',
    ctaText: 'Shop Style',
    linkType: 'category',
    linkValue: 'fashion',
    bgColor: '#DC2626',
    order: 3
  }
];

const SEED_CATEGORIES = [
  { name: 'All Products', slug: 'all', icon: '🛍️', order: 0 },
  { name: 'Mobiles & Tech', slug: 'mobiles', icon: '📱', order: 1 },
  { name: 'Audio & Gadgets', slug: 'electronics', icon: '🎧', order: 2 },
  { name: 'Fashion & Wear', slug: 'fashion', icon: '👕', order: 3 },
  { name: 'Watches & Gear', slug: 'watches', icon: '⌚', order: 4 },
  { name: 'Home & Living', slug: 'home', icon: '🛋️', order: 5 },
  { name: 'Footwear', slug: 'footwear', icon: '👟', order: 6 },
  { name: 'Beauty & Health', slug: 'beauty', icon: '✨', order: 7 }
];

async function seedDatabase() {
  try {
    console.log('Connecting to MongoDB Atlas...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected!');

    // Clean existing banners and categories
    await Banner.deleteMany({});
    await Category.deleteMany({});

    console.log('Seeding Banners...');
    await Banner.insertMany(SEED_BANNERS);

    console.log('Seeding Categories...');
    const createdCategories = await Category.insertMany(SEED_CATEGORIES);

    const catMap = {};
    createdCategories.forEach(c => {
      catMap[c.slug] = c._id;
    });

    // Check or create a demo Vendor
    let vendor = await Vendor.findOne({ storeSlug: 'balaji-flagship' });
    if (!vendor) {
      // Find or create vendor user
      let vendorUser = await User.findOne({ email: 'vendor@balajistore.com' });
      if (!vendorUser) {
        vendorUser = await User.create({
          name: 'Balaji Retail Corp',
          email: 'vendor@balajistore.com',
          phone: '9876543210',
          password: 'VendorPassword@123',
          role: 'vendor'
        });
      }

      vendor = await Vendor.create({
        userId: vendorUser._id,
        storeName: 'Balaji Official Store',
        storeSlug: 'balaji-flagship',
        storeLogo: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=200&q=80',
        description: 'Verified Top-Rated Multivendor Flagship Seller',
        businessEmail: 'vendor@balajistore.com',
        businessPhone: '9876543210',
        address: {
          street: 'Nariman Point, Marine Drive',
          city: 'Mumbai',
          state: 'Maharashtra',
          pinCode: '400021'
        },
        rating: 4.9,
        reviewCount: 1420,
        isVerified: true
      });
    }

    // Seed Products
    await Product.deleteMany({});

    const SEED_PRODUCTS = [
      {
        title: 'Sony WH-1000XM5 Wireless Noise Canceling Headphones',
        slug: 'sony-wh1000xm5-headphones',
        sku: 'SONY-WH5-BLK',
        vendorId: vendor._id,
        category: catMap['electronics'] || createdCategories[1]._id,
        subcategory: 'Over-ear Headphones',
        brand: 'Sony',
        description: 'Industry-leading noise cancellation with two processors and eight microphones for unprecedented sound clarity and call quality. 30-hour battery life with ultra-fast charging.',
        specifications: [
          { key: 'Driver Unit', value: '30mm Carbon Fiber' },
          { key: 'Battery Life', value: '30 Hours' },
          { key: 'Connectivity', value: 'Bluetooth 5.2 / 3.5mm' },
          { key: 'Fast Charging', value: '3 min charge = 3 hours playback' }
        ],
        images: [
          'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80',
          'https://images.unsplash.com/photo-1484704849700-f032a568e944?auto=format&fit=crop&w=800&q=80'
        ],
        price: 29990,
        salePrice: 24990,
        stock: 35,
        rating: 4.9,
        numReviews: 842,
        tags: ['trending', 'bestseller'],
        deliveryInfo: { estimatedDays: 2, returnPolicyDays: 7, isFreeDelivery: true },
        isFeatured: true
      },
      {
        title: 'Apple Watch Ultra 2 GPS + Cellular 49mm Titanium',
        slug: 'apple-watch-ultra-2',
        sku: 'AW-ULTRA2-49',
        vendorId: vendor._id,
        category: catMap['watches'] || createdCategories[1]._id,
        subcategory: 'Smartwatches',
        brand: 'Apple',
        description: 'The most rugged and capable Apple Watch. Features a lightweight titanium case, extra-long battery life, the brightest Apple display ever, and precision dual-frequency GPS.',
        specifications: [
          { key: 'Display', value: '3000 nits Always-On Retina' },
          { key: 'Water Resistance', value: '100m' },
          { key: 'Battery', value: 'Up to 72 hours in low power mode' },
          { key: 'Case', value: 'Aerospace-Grade Titanium' }
        ],
        images: [
          'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80',
          'https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&w=800&q=80'
        ],
        price: 89900,
        salePrice: 79900,
        stock: 18,
        rating: 4.8,
        numReviews: 312,
        tags: ['trending'],
        deliveryInfo: { estimatedDays: 1, returnPolicyDays: 7, isFreeDelivery: true },
        isFeatured: true
      },
      {
        title: 'Nike Air Max 270 React Premium Running Sneakers',
        slug: 'nike-air-max-270-react',
        sku: 'NIKE-AM270-RED',
        vendorId: vendor._id,
        category: catMap['footwear'] || createdCategories[1]._id,
        subcategory: 'Men Shoes',
        brand: 'Nike',
        description: 'Lightweight, layered no-sew materials create a modern aesthetic. Full-length Nike React foam midsole provides unmatched all-day bounce and comfort.',
        specifications: [
          { key: 'Upper Material', value: 'Breathable Mesh & Synthetic' },
          { key: 'Cushioning', value: 'Air Max 270 Unit + React Foam' },
          { key: 'Closure', value: 'Lace-Up' },
          { key: 'Sole', value: 'Durable Rubber Waffle' }
        ],
        images: [
          'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80',
          'https://images.unsplash.com/photo-1600185365926-3a2ce3cdb9eb?auto=format&fit=crop&w=800&q=80'
        ],
        price: 13995,
        salePrice: 8999,
        stock: 50,
        rating: 4.7,
        numReviews: 520,
        tags: ['bestseller', 'deal_of_the_day'],
        deliveryInfo: { estimatedDays: 3, returnPolicyDays: 10, isFreeDelivery: true },
        isFeatured: true
      },
      {
        title: 'Samsung Galaxy S25 Ultra 5G AI Flagship (12GB/256GB)',
        slug: 'samsung-s25-ultra-5g',
        sku: 'SAMS-S25U-256',
        vendorId: vendor._id,
        category: catMap['mobiles'] || createdCategories[1]._id,
        subcategory: 'Smartphones',
        brand: 'Samsung',
        description: 'Galaxy AI with live call translation, Circle to Search, 200MP Quad Telephoto optical zoom camera, Snapdragon 8 Elite processor and built-in S-Pen.',
        specifications: [
          { key: 'Processor', value: 'Snapdragon 8 Elite (3nm)' },
          { key: 'Main Camera', value: '200MP + 50MP + 50MP + 12MP' },
          { key: 'Battery', value: '5000 mAh with 45W Fast Charge' },
          { key: 'Display', value: '6.8" Dynamic AMOLED 2X 120Hz' }
        ],
        images: [
          'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?auto=format&fit=crop&w=800&q=80',
          'https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=800&q=80'
        ],
        price: 129999,
        salePrice: 119999,
        stock: 22,
        rating: 4.9,
        numReviews: 960,
        tags: ['trending', 'new_arrival'],
        deliveryInfo: { estimatedDays: 1, returnPolicyDays: 7, isFreeDelivery: true },
        isFeatured: true
      },
      {
        title: 'Anker 737 GaNPrime 140W Ultra-Fast Power Bank',
        slug: 'anker-737-140w-powerbank',
        sku: 'ANKER-737-140W',
        vendorId: vendor._id,
        category: catMap['electronics'] || createdCategories[1]._id,
        subcategory: 'Power Accessories',
        brand: 'Anker',
        description: 'Equipped with Power Delivery 3.1 and bi-directional technology to quickly recharge the portable charger or get a 140W ultra-powerful charge. Smart digital display shows real-time output/input power.',
        specifications: [
          { key: 'Capacity', value: '24,000 mAh' },
          { key: 'Max Output', value: '140W PD 3.1' },
          { key: 'Ports', value: '2x USB-C + 1x USB-A' },
          { key: 'Display', value: 'Smart Color TFT Display' }
        ],
        images: [
          'https://images.unsplash.com/photo-1609592426868-b7c126d419fb?auto=format&fit=crop&w=800&q=80'
        ],
        price: 14999,
        salePrice: 9999,
        stock: 45,
        rating: 4.8,
        numReviews: 412,
        tags: ['deal_of_the_day'],
        deliveryInfo: { estimatedDays: 2, returnPolicyDays: 7, isFreeDelivery: true },
        isFeatured: false
      },
      {
        title: 'Minimalist Top-Grain Leather Commuter Backpack',
        slug: 'minimalist-leather-commuter-backpack',
        sku: 'LEATH-BP-BRN',
        vendorId: vendor._id,
        category: catMap['fashion'] || createdCategories[1]._id,
        subcategory: 'Bags & Luggage',
        brand: 'Royal Crafts',
        description: 'Handcrafted from 100% genuine full-grain leather with water-resistant coating, dedicated padded 16-inch laptop compartment, and hidden anti-theft pocket.',
        specifications: [
          { key: 'Material', value: 'Full-Grain Colombian Leather' },
          { key: 'Laptop Fit', value: 'Up to 16.2 inch' },
          { key: 'Weight', value: '1.1 kg' },
          { key: 'Zippers', value: 'YKK Japanese Metal Zippers' }
        ],
        images: [
          'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=80'
        ],
        price: 7999,
        salePrice: 4499,
        stock: 30,
        rating: 4.9,
        numReviews: 240,
        tags: ['bestseller'],
        deliveryInfo: { estimatedDays: 3, returnPolicyDays: 10, isFreeDelivery: true },
        isFeatured: true
      }
    ];

    console.log('Seeding Products...');
    await Product.insertMany(SEED_PRODUCTS);

    console.log('🎉 SUCCESS! Database Seeded with Banners, Categories, Vendor, and Products!');
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Seed Error:', error);
    process.exit(1);
  }
}

seedDatabase();

