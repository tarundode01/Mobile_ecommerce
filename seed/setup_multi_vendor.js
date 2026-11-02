const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const User = require('../models/User');
const Vendor = require('../models/Vendor');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Category = require('../models/Category');

async function setupMultiVendor() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB Atlas');

    // 1. Ensure Categories exist
    let catElectronics = await Category.findOne({ slug: 'electronics' });
    if (!catElectronics) {
      catElectronics = await Category.create({
        name: 'Electronics & Audio',
        slug: 'electronics',
        icon: '📱',
        image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500'
      });
    }

    let catWatches = await Category.findOne({ slug: 'watches' });
    if (!catWatches) {
      catWatches = await Category.create({
        name: 'Luxury Watches',
        slug: 'watches',
        icon: '⌚',
        image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500'
      });
    }

    let catJewelry = await Category.findOne({ slug: 'jewelry' });
    if (!catJewelry) {
      catJewelry = await Category.create({
        name: 'Fine Jewelry',
        slug: 'jewelry',
        icon: '💎',
        image: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=500'
      });
    }

    // 2. Define Vendor Profiles (Vendor A, Vendor B, Vendor C)
    const vendorConfigs = [
      {
        email: 'vendor@balajistore.com',
        name: 'Balaji Retail Corp',
        storeName: 'Balaji Flagship Store',
        storeSlug: 'balaji-flagship',
        phone: '+91 98765 11111',
        description: 'Authorized retailer of high-performance electronics, smartphones, and audio accessories.',
        rating: 4.9,
        commissionPercentage: 10,
        address: { street: 'Balaji Tech Hub, BKC', city: 'Mumbai', state: 'Maharashtra', pinCode: '400051' },
        products: [
          {
            title: 'Samsung Galaxy S24 Ultra Titanium 5G',
            slug: 'samsung-galaxy-s24-ultra',
            brand: 'Samsung',
            category: catElectronics._id,
            price: 134999,
            salePrice: 124999,
            stock: 14,
            isFeatured: true,
            description: 'Titanium grey, Snapdragon 8 Gen 3, 200MP Quad Camera with Galaxy AI.',
            images: ['https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=500'],
            tags: ['trending', 'bestseller']
          },
          {
            title: 'Sony WH-1000XM5 Noise Canceling Headphones',
            slug: 'sony-wh-1000xm5-headphones',
            brand: 'Sony',
            category: catElectronics._id,
            price: 34990,
            salePrice: 29990,
            stock: 8,
            isFeatured: true,
            description: 'Industry-leading noise cancellation with two processors and 8 microphones.',
            images: ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500'],
            tags: ['trending']
          },
          {
            title: 'Apple MacBook Pro 16 M3 Max',
            slug: 'apple-macbook-pro-16-m3',
            brand: 'Apple',
            category: catElectronics._id,
            price: 349900,
            salePrice: 329900,
            stock: 4,
            isFeatured: false,
            description: 'Space Black, 36GB Unified Memory, Liquid Retina XDR display.',
            images: ['https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=500'],
            tags: ['new_arrival']
          }
        ]
      },
      {
        email: 'vendorb@balajistore.com',
        name: 'Titan Horology Ltd',
        storeName: 'Titan & Horology Luxe',
        storeSlug: 'titan-horology-luxe',
        phone: '+91 98765 22222',
        description: 'Certified horological boutique featuring bespoke Swiss timepieces, chronographs, and chronometers.',
        rating: 4.8,
        commissionPercentage: 8,
        address: { street: 'Heritage Arcade, Colaba', city: 'Mumbai', state: 'Maharashtra', pinCode: '400001' },
        products: [
          {
            title: 'Audemars Royal Chrono 41mm Platinum Watch',
            slug: 'audemars-royal-chrono-41mm',
            brand: 'Balaji Horology',
            category: catWatches._id,
            price: 345000,
            salePrice: 289999,
            stock: 12,
            isFeatured: true,
            description: 'Handcrafted platinum bezel, sapphire crystal case back, 70-hour power reserve.',
            images: ['https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=500'],
            tags: ['bestseller']
          },
          {
            title: 'Rolex Submariner Date Oystersteel 41mm',
            slug: 'rolex-submariner-date-41mm',
            brand: 'Rolex Luxe',
            category: catWatches._id,
            price: 890000,
            salePrice: 849000,
            stock: 3,
            isFeatured: true,
            description: 'Cerachrom ceramic bezel, 300m waterproofness, black dial with luminescent markers.',
            images: ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500'],
            tags: ['trending', 'bestseller']
          },
          {
            title: 'TAG Heuer Carrera Chronograph Glassbox',
            slug: 'tag-heuer-carrera-glassbox',
            brand: 'TAG Heuer',
            category: catWatches._id,
            price: 645000,
            salePrice: 599000,
            stock: 6,
            isFeatured: false,
            description: 'Iconic domed sapphire crystal, blue circular brushed dial, Calibre TH20-00 automatic.',
            images: ['https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=500'],
            tags: ['new_arrival']
          }
        ]
      },
      {
        email: 'vendorc@balajistore.com',
        name: 'Apex Jewels Co',
        storeName: 'Apex Jewels & Crafts',
        storeSlug: 'apex-jewels',
        phone: '+91 98765 33333',
        description: 'Makers of regal diamond necklaces, solitaire rings, and 24K temple gold ornaments.',
        rating: 4.7,
        commissionPercentage: 12,
        address: { street: 'Zaveri Bazaar, Fort', city: 'Mumbai', state: 'Maharashtra', pinCode: '400002' },
        products: [
          {
            title: '24K Royal Polki Diamond Kundan Necklace',
            slug: '24k-royal-polki-diamond-necklace',
            brand: 'Apex Fine Jewels',
            category: catJewelry._id,
            price: 245000,
            salePrice: 215000,
            stock: 5,
            isFeatured: true,
            description: 'Certified uncut diamonds, syndicate polki, with genuine emerald drop accents.',
            images: ['https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=500'],
            tags: ['bestseller']
          },
          {
            title: 'Solitaire Platinum 2-Carat Diamond Ring',
            slug: 'solitaire-platinum-2-carat-ring',
            brand: 'Apex Fine Jewels',
            category: catJewelry._id,
            price: 185000,
            salePrice: 165000,
            stock: 9,
            isFeatured: true,
            description: 'VVS1 clarity, E color round brilliant cut solitaire set in 950 pure platinum.',
            images: ['https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=500'],
            tags: ['trending']
          }
        ]
      }
    ];

    // Find a customer user to associate sample orders with
    let customerUser = await User.findOne({ role: 'customer' });
    if (!customerUser) {
      customerUser = await User.create({
        name: 'Tarun Dode',
        email: 'tarun@example.com',
        phone: '+91 98765 43210',
        password: 'password123',
        role: 'customer'
      });
    }

    for (const cfg of vendorConfigs) {
      // 1. Create or update User
      let user = await User.findOne({ email: cfg.email });
      if (!user) {
        user = await User.create({
          name: cfg.name,
          email: cfg.email,
          phone: cfg.phone,
          password: 'password123',
          role: 'vendor',
          status: 'active'
        });
        console.log(`👤 Created Vendor User: ${cfg.email}`);
      } else if (user.role !== 'vendor') {
        user.role = 'vendor';
        await user.save();
      }

      // 2. Create or update Vendor
      let vendor = await Vendor.findOne({ userId: user._id });
      if (!vendor) {
        vendor = await Vendor.findOne({ storeSlug: cfg.storeSlug });
      }
      if (!vendor) {
        vendor = await Vendor.create({
          userId: user._id,
          storeName: cfg.storeName,
          storeSlug: cfg.storeSlug,
          description: cfg.description,
          businessEmail: cfg.email,
          businessPhone: cfg.phone,
          rating: cfg.rating,
          commissionPercentage: cfg.commissionPercentage,
          status: 'active',
          isVerified: true,
          address: cfg.address
        });
        console.log(`🏬 Created Vendor Profile: ${cfg.storeName} (ID: ${vendor._id})`);
      } else {
        vendor.userId = user._id;
        vendor.storeName = cfg.storeName;
        vendor.commissionPercentage = cfg.commissionPercentage;
        await vendor.save();
      }

      // 3. Create or update Products for this vendor
      for (const prodCfg of cfg.products) {
        let product = await Product.findOne({ slug: prodCfg.slug });
        if (!product) {
          product = await Product.create({
            ...prodCfg,
            vendorId: vendor._id
          });
          console.log(`📦 Created Product for ${cfg.storeName}: ${product.title}`);
        } else {
          product.vendorId = vendor._id;
          product.price = prodCfg.price;
          product.salePrice = prodCfg.salePrice;
          product.stock = prodCfg.stock;
          await product.save();
        }
      }

      // 4. Ensure Sample Orders for this vendor to verify revenue
      const vendorProducts = await Product.find({ vendorId: vendor._id });
      if (vendorProducts.length > 0) {
        const existingVendorOrder = await Order.findOne({ 'items.vendor': vendor._id });
        if (!existingVendorOrder) {
          const sampleProd = vendorProducts[0];
          const orderNum = 'BLJ-' + cfg.storeSlug.toUpperCase().slice(0, 4) + '-' + Math.floor(1000 + Math.random() * 9000);
          await Order.create({
            orderNumber: orderNum,
            user: customerUser._id,
            items: [
              {
                product: sampleProd._id,
                vendor: vendor._id,
                title: sampleProd.title,
                image: sampleProd.images[0] || '',
                price: sampleProd.salePrice,
                quantity: 1
              }
            ],
            shippingAddress: {
              name: customerUser.name,
              phone: customerUser.phone || '+91 98765 00000',
              street: '402 Balaji Luxe Boulevard',
              city: 'Mumbai',
              state: 'Maharashtra',
              pinCode: '400021'
            },
            payment: {
              method: 'UPI',
              status: 'Paid',
              transactionId: 'TXN-' + Date.now()
            },
            orderStatus: 'confirmed',
            pricing: {
              subtotal: sampleProd.salePrice,
              totalAmount: sampleProd.salePrice,
              tax: Math.round(sampleProd.salePrice * 0.18),
              deliveryFee: 0
            }
          });
          console.log(`🧾 Created verified Order for ${cfg.storeName}: ${orderNum}`);
        }
      }
    }

    console.log('🎉 Multi-Vendor Setup Completed Successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error during multi-vendor setup:', err);
    process.exit(1);
  }
}

setupMultiVendor();

