const Product = require('../models/Product');
const Category = require('../models/Category');
const Banner = require('../models/Banner');
const Vendor = require('../models/Vendor');

// @desc    Get complete Home Feed (Banners, Categories, Flash Deals, Trending, Bestsellers, Vendors)
// @route   GET /api/products/home-feed
// @access  Public
exports.getHomeFeed = async (req, res) => {
  try {
    const [banners, categories, trendingProducts, bestsellers, newArrivals, flashDeals, vendors] =
      await Promise.all([
        Banner.find({ isActive: true }).sort({ order: 1 }).limit(5),
        Category.find({ isActive: true }).sort({ order: 1 }).limit(12),
        Product.find({ isPublished: { $ne: false } })
          .sort({ createdAt: -1 })
          .populate('category', 'name slug icon')
          .populate('vendorId', 'storeName rating isVerified')
          .limit(30),
        Product.find({ isPublished: { $ne: false }, $or: [{ tags: 'bestseller' }, { rating: { $gte: 4.5 } }] })
          .sort({ createdAt: -1 })
          .populate('category', 'name slug icon')
          .populate('vendorId', 'storeName rating isVerified')
          .limit(20),
        Product.find({ isPublished: { $ne: false } })
          .sort({ createdAt: -1 })
          .populate('category', 'name slug icon')
          .populate('vendorId', 'storeName rating isVerified')
          .limit(50),
        Product.find({ isPublished: { $ne: false }, discountPercentage: { $gte: 5 } })
          .sort({ discountPercentage: -1 })
          .populate('category', 'name slug icon')
          .populate('vendorId', 'storeName rating isVerified')
          .limit(20),
        Vendor.find({ status: 'active' }).limit(15)
      ]);

    res.json({
      success: true,
      data: {
        banners,
        categories,
        flashDeals,
        trendingProducts,
        bestsellers,
        newArrivals,
        featuredVendors: vendors
      }
    });
  } catch (error) {
    console.error('Home Feed Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get Products with search, filter, sort & pagination
// @route   GET /api/products
// @access  Public
exports.getProducts = async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const {
      search,
      category,
      brand,
      minPrice,
      maxPrice,
      minRating,
      sort,
      tag,
      vendorId,
      vendor,
      page = 1,
      limit = 50
    } = req.query;

    const query = { isPublished: { $ne: false } };

    // 1. Vendor Filter
    const targetVendor = vendorId || vendor;
    if (targetVendor && mongoose.Types.ObjectId.isValid(targetVendor)) {
      query.vendorId = targetVendor;
    }

    // 2. Comprehensive Search across Title, Brand, Description, Subcategory, Tags, and Category Name!
    if (search && search.trim()) {
      const s = search.trim();
      const searchRegex = new RegExp(s, 'i');

      // Find any categories matching the search term (e.g. "fashion" -> "Fashion & Wear")
      const matchingCats = await Category.find({
        $or: [
          { name: searchRegex },
          { slug: searchRegex }
        ]
      }).select('_id');
      const catIds = matchingCats.map(c => c._id);

      const searchConditions = [
        { title: searchRegex },
        { brand: searchRegex },
        { description: searchRegex },
        { subcategory: searchRegex },
        { tags: searchRegex }
      ];
      if (catIds.length > 0) {
        searchConditions.push({ category: { $in: catIds } });
      }

      query.$or = searchConditions;
    }

    // 3. Category Filter (Matches by ObjectId, slug, exact name, or partial name!)
    if (category && category !== 'all' && category !== 'All') {
      let catDoc = null;
      if (mongoose.Types.ObjectId.isValid(category)) {
        catDoc = await Category.findById(category);
      }
      if (!catDoc) {
        const cleanCat = category.trim();
        catDoc = await Category.findOne({
          $or: [
            { slug: cleanCat.toLowerCase() },
            { name: new RegExp('^' + cleanCat + '$', 'i') },
            { name: new RegExp(cleanCat, 'i') },
            { slug: new RegExp(cleanCat.toLowerCase(), 'i') }
          ]
        });
      }

      const catConditions = [];
      if (catDoc) {
        catConditions.push({ category: catDoc._id });
        catConditions.push({ subcategory: new RegExp(catDoc.name, 'i') });
        catConditions.push({ tags: catDoc.slug });
      } else {
        const catRegex = new RegExp(category.trim(), 'i');
        catConditions.push({ subcategory: catRegex });
        catConditions.push({ tags: catRegex });
        catConditions.push({ title: catRegex });
      }

      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: catConditions }];
        delete query.$or;
      } else {
        query.$or = catConditions;
      }
    }

    // Brand filter
    if (brand) {
      query.brand = { $regex: brand, $options: 'i' };
    }

    // Tag filter (trending, bestseller, etc.)
    if (tag) {
      query.tags = tag;
    }

    // Price range
    if (minPrice || maxPrice) {
      query.salePrice = {};
      if (minPrice) query.salePrice.$gte = Number(minPrice);
      if (maxPrice) query.salePrice.$lte = Number(maxPrice);
    }

    // Rating filter
    if (minRating) {
      query.rating = { $gte: Number(minRating) };
    }

    // Sorting
    let sortOption = { createdAt: -1 };
    if (sort === 'price_asc') sortOption = { salePrice: 1 };
    else if (sort === 'price_desc') sortOption = { salePrice: -1 };
    else if (sort === 'rating') sortOption = { rating: -1 };
    else if (sort === 'discount') sortOption = { discountPercentage: -1 };
    else if (sort === 'popularity') sortOption = { numReviews: -1 };

    const skip = (Number(page) - 1) * Number(limit);
    const total = await Product.countDocuments(query);
    const products = await Product.find(query)
      .populate('category', 'name slug icon')
      .populate('vendorId', 'storeName rating isVerified')
      .sort(sortOption)
      .skip(skip)
      .limit(Number(limit));

    res.json({
      success: true,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      products
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get Product by ID / Slug with related recommendations
// @route   GET /api/products/:id
// @access  Public
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('category', 'name slug icon')
      .populate('vendorId', 'storeName storeLogo rating reviewCount isVerified address');

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Related products in the same category
    const relatedProducts = await Product.find({
      category: product.category._id,
      _id: { $ne: product._id },
      isPublished: true
    }).limit(4);

    res.json({
      success: true,
      product,
      relatedProducts
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Search Autocomplete Suggestions
// @route   GET /api/products/suggestions
// @access  Public
exports.getSuggestions = async (req, res) => {
  try {
    const { query } = req.query;
    if (!query || query.trim().length < 2) {
      return res.json({ success: true, suggestions: [] });
    }

    const products = await Product.find({
      isPublished: true,
      title: { $regex: query, $options: 'i' }
    })
      .select('title brand category salePrice')
      .limit(6);

    const suggestions = products.map(p => ({
      id: p._id,
      title: p.title,
      brand: p.brand,
      price: p.salePrice
    }));

    res.json({ success: true, suggestions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Check PIN code delivery estimation
// @route   POST /api/products/check-pincode
// @access  Public
exports.checkPinCode = async (req, res) => {
  const { pinCode } = req.body;
  if (!pinCode || pinCode.length !== 6) {
    return res.status(400).json({ success: false, message: 'Please enter a valid 6-digit PIN code' });
  }

  // Calculate delivery date (typically 2-4 days ahead)
  const deliveryDays = pinCode.startsWith('4') || pinCode.startsWith('1') ? 2 : 4;
  const deliveryDate = new Date();
  deliveryDate.setDate(deliveryDate.getDate() + deliveryDays);

  res.json({
    success: true,
    serviceable: true,
    deliveryDays,
    estimatedDate: deliveryDate.toLocaleDateString('en-IN', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    }),
    isFreeDelivery: true,
    codAvailable: true
  });
};

