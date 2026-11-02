const Cart = require('../models/Cart');
const Product = require('../models/Product');

// Helper to find or create cart
async function getOrCreateCart(userId, guestSessionId) {
  let cart;
  if (userId) {
    cart = await Cart.findOne({ user: userId }).populate('items.product');
    if (!cart) {
      cart = await Cart.create({ user: userId, items: [] });
    }
  } else if (guestSessionId) {
    cart = await Cart.findOne({ guestSessionId }).populate('items.product');
    if (!cart) {
      cart = await Cart.create({ guestSessionId, items: [] });
    }
  }
  return cart;
}

// @desc    Get Cart for User or Guest
// @route   GET /api/cart
// @access  Public (Uses auth if available or guestSessionId header)
exports.getCart = async (req, res) => {
  try {
    const userId = req.user ? req.user._id : null;
    const guestSessionId = req.headers['x-guest-session-id'] || req.query.guestSessionId;

    if (!userId && !guestSessionId) {
      return res.json({
        success: true,
        cart: { items: [], subtotal: 0, discountAmount: 0, totalAmount: 0 }
      });
    }

    const cart = await getOrCreateCart(userId, guestSessionId);
    if (!cart) {
      return res.json({
        success: true,
        cart: { items: [], subtotal: 0, discountAmount: 0, totalAmount: 0 }
      });
    }

    cart.calculateTotals();
    await cart.save();

    res.json({ success: true, cart });
  } catch (error) {
    console.error('Get Cart Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Add item to Cart
// @route   POST /api/cart/add
// @access  Public (Guest or Logged in)
exports.addToCart = async (req, res) => {
  try {
    const { productId, quantity = 1, variant } = req.body;
    const userId = req.user ? req.user._id : null;
    const guestSessionId = req.headers['x-guest-session-id'] || req.body.guestSessionId;

    if (!productId) {
      return res.status(400).json({ success: false, message: 'Product ID required' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    if (product.stock < quantity) {
      return res.status(400).json({ success: false, message: 'Requested quantity exceeds available stock' });
    }

    let cart = await getOrCreateCart(userId, guestSessionId);
    if (!cart) {
      if (userId) {
        cart = await Cart.create({ user: userId, items: [] });
      } else {
        cart = await Cart.create({ guestSessionId: guestSessionId || Date.now().toString(), items: [] });
      }
    }

    // Check if product with same variant already in cart
    const existingIndex = cart.items.findIndex(
      item => item.product && item.product.toString() === productId
    );

    if (existingIndex > -1) {
      cart.items[existingIndex].quantity += Number(quantity);
    } else {
      cart.items.push({
        product: product._id,
        vendor: product.vendorId,
        variant,
        quantity: Number(quantity),
        price: product.salePrice
      });
    }

    cart.calculateTotals();
    await cart.save();

    const populatedCart = await Cart.findById(cart._id).populate('items.product');

    res.json({
      success: true,
      message: 'Item added to cart!',
      cart: populatedCart
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update Cart Item Quantity
// @route   PUT /api/cart/item/:itemId
// @access  Public
exports.updateQuantity = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { quantity } = req.body;
    const userId = req.user ? req.user._id : null;
    const guestSessionId = req.headers['x-guest-session-id'];

    const cart = await getOrCreateCart(userId, guestSessionId);
    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart not found' });
    }

    const item = cart.items.id(itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not in cart' });
    }

    if (quantity <= 0) {
      cart.items.pull(itemId);
    } else {
      item.quantity = quantity;
    }

    cart.calculateTotals();
    await cart.save();

    const populatedCart = await Cart.findById(cart._id).populate('items.product');
    res.json({ success: true, cart: populatedCart });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Remove Item from Cart
// @route   DELETE /api/cart/item/:itemId
// @access  Public
exports.removeItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const userId = req.user ? req.user._id : null;
    const guestSessionId = req.headers['x-guest-session-id'];

    const cart = await getOrCreateCart(userId, guestSessionId);
    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart not found' });
    }

    cart.items.pull(itemId);
    cart.calculateTotals();
    await cart.save();

    const populatedCart = await Cart.findById(cart._id).populate('items.product');
    res.json({ success: true, message: 'Item removed', cart: populatedCart });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Merge Guest Cart into User Account Cart upon Login
// @route   POST /api/cart/merge
// @access  Private
exports.mergeGuestCart = async (req, res) => {
  try {
    const { guestSessionId } = req.body;
    if (!guestSessionId) {
      return res.status(400).json({ success: false, message: 'Guest session ID required' });
    }

    const guestCart = await Cart.findOne({ guestSessionId });
    if (!guestCart || guestCart.items.length === 0) {
      const userCart = await getOrCreateCart(req.user._id);
      return res.json({ success: true, cart: userCart });
    }

    let userCart = await Cart.findOne({ user: req.user._id });
    if (!userCart) {
      userCart = await Cart.create({ user: req.user._id, items: [] });
    }

    // Merge items
    for (const gItem of guestCart.items) {
      const matchIndex = userCart.items.findIndex(
        uItem => uItem.product.toString() === gItem.product.toString()
      );
      if (matchIndex > -1) {
        userCart.items[matchIndex].quantity += gItem.quantity;
      } else {
        userCart.items.push(gItem);
      }
    }

    userCart.calculateTotals();
    await userCart.save();

    // Clean up old guest cart
    await Cart.findByIdAndDelete(guestCart._id);

    const populatedCart = await Cart.findById(userCart._id).populate('items.product');

    res.json({
      success: true,
      message: 'Guest cart successfully merged with your account!',
      cart: populatedCart
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Apply Coupon Code
// @route   POST /api/cart/apply-coupon
// @access  Public
exports.applyCoupon = async (req, res) => {
  try {
    const { couponCode } = req.body;
    const userId = req.user ? req.user._id : null;
    const guestSessionId = req.headers['x-guest-session-id'];

    const cart = await getOrCreateCart(userId, guestSessionId);
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart is empty' });
    }

    const upperCode = couponCode.toUpperCase().trim();
    let discount = 0;

    if (upperCode === 'BALAJI10') {
      discount = Math.round(cart.subtotal * 0.1); // 10% off
    } else if (upperCode === 'FESTIVE500' && cart.subtotal >= 2000) {
      discount = 500;
    } else if (upperCode === 'FIRSTBUY') {
      discount = 150;
    } else {
      return res.status(400).json({ success: false, message: 'Invalid or expired coupon code' });
    }

    cart.couponCode = upperCode;
    cart.discountAmount = discount;
    cart.calculateTotals();
    await cart.save();

    const populatedCart = await Cart.findById(cart._id).populate('items.product');

    res.json({
      success: true,
      message: `Coupon ${upperCode} applied! You saved ₹${discount}`,
      cart: populatedCart
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

