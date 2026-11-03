const Wishlist = require('../models/Wishlist');
const Product = require('../models/Product');

// @desc    Get current user's wishlist
// @route   GET /api/wishlist
// @access  Private
exports.getWishlist = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    let wishlist = await Wishlist.findOne({ user: req.user._id }).populate({
      path: 'products',
      select: '_id title price salePrice discountPercentage images rating numReviews brand vendorId isOutOfStock tags category'
    });

    if (!wishlist) {
      wishlist = await Wishlist.create({ user: req.user._id, products: [] });
    }

    const validProducts = (wishlist.products || []).filter(Boolean);

    res.json({
      success: true,
      count: validProducts.length,
      items: validProducts,
    });
  } catch (error) {
    console.error('Get Wishlist Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Toggle product in user's wishlist
// @route   POST /api/wishlist/toggle
// @access  Private
exports.toggleWishlist = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { productId } = req.body;
    if (!productId) {
      return res.status(400).json({ success: false, message: 'Product ID is required' });
    }

    let wishlist = await Wishlist.findOne({ user: req.user._id });
    if (!wishlist) {
      wishlist = await Wishlist.create({ user: req.user._id, products: [] });
    }

    const prodIdStr = productId.toString();
    const existingIndex = wishlist.products.findIndex((p) => p && p.toString() === prodIdStr);

    let inWishlist = false;
    if (existingIndex > -1) {
      // Remove
      wishlist.products.splice(existingIndex, 1);
      inWishlist = false;
    } else {
      // Add
      wishlist.products.unshift(productId);
      inWishlist = true;
    }

    await wishlist.save();

    await wishlist.populate({
      path: 'products',
      select: '_id title price salePrice discountPercentage images rating numReviews brand vendorId isOutOfStock tags category'
    });

    const validProducts = (wishlist.products || []).filter(Boolean);

    res.json({
      success: true,
      inWishlist,
      count: validProducts.length,
      items: validProducts,
      message: inWishlist ? 'Product added to your wishlist' : 'Product removed from your wishlist'
    });
  } catch (error) {
    console.error('Toggle Wishlist Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Remove single item from wishlist
// @route   DELETE /api/wishlist/item/:id
// @access  Private
exports.removeFromWishlist = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const productId = req.params.id;
    let wishlist = await Wishlist.findOne({ user: req.user._id });
    if (!wishlist) {
      return res.json({ success: true, count: 0, items: [] });
    }

    wishlist.products = wishlist.products.filter(
      (p) => p && p.toString() !== productId.toString()
    );
    await wishlist.save();

    await wishlist.populate({
      path: 'products',
      select: '_id title price salePrice discountPercentage images rating numReviews brand vendorId isOutOfStock tags category'
    });

    const validProducts = (wishlist.products || []).filter(Boolean);

    res.json({
      success: true,
      count: validProducts.length,
      items: validProducts,
      message: 'Product removed from wishlist'
    });
  } catch (error) {
    console.error('Remove From Wishlist Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Clear entire wishlist for user
// @route   DELETE /api/wishlist
// @access  Private
exports.clearWishlist = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    await Wishlist.findOneAndUpdate(
      { user: req.user._id },
      { $set: { products: [] } },
      { upsert: true }
    );

    res.json({
      success: true,
      count: 0,
      items: [],
      message: 'Wishlist cleared successfully'
    });
  } catch (error) {
    console.error('Clear Wishlist Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

