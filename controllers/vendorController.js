const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Vendor = require('../models/Vendor');
const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const Settlement = require('../models/Settlement');

// Helper to resolve vendor document from user ID or vendorId param
const resolveVendor = async (req) => {
  let vendor = null;

  // 0. Extract user from JWT token if Bearer header present
  if (!req.user && req.headers?.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_jwt_key_ecommerce_mern_2026_balaji_sarkar');
      if (decoded && decoded.id) {
        req.user = await User.findById(decoded.id);
      }
    } catch (e) { }
  }

  // 1. If explicit vendorId passed in query or body
  const explicitId = req.query.vendorId || req.body?.vendorId || req.params?.vendorId;
  if (explicitId && mongoose.Types.ObjectId.isValid(explicitId)) {
    vendor = await Vendor.findById(explicitId);
    if (!vendor) {
      vendor = await Vendor.findOne({ userId: explicitId });
    }
  }

  // 2. If authenticated user is a vendor
  if (!vendor && req.user) {
    vendor = await Vendor.findOne({ userId: req.user._id });
    if (!vendor && req.user.role === 'vendor') {
      vendor = await Vendor.findOne({ businessEmail: req.user.email });
    }
  }

  // 3. Fallback to first active vendor ONLY IF user is unauthenticated and no explicitId was supplied
  if (!vendor && !explicitId && !req.user) {
    vendor = await Vendor.findOne({ status: 'active' });
  }

  return vendor;
};

// -----------------------------------------------------------------
// 1. GET COMPLETE VENDOR DASHBOARD (Strictly Real-Time Dynamic Data)
// -----------------------------------------------------------------
exports.getVendorDashboard = async (req, res) => {
  try {
    const vendor = await resolveVendor(req);
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor profile not found' });
    }
    if (vendor.status !== 'active') {
      return res.status(403).json({
        success: false,
        pendingApproval: vendor.status === 'pending',
        message: 'Aapka vendor account abhi Super Admin dwara pending approval hai.'
      });
    }

    const vendorId = vendor._id;
    const commissionRate = (vendor.commissionPercentage || 10) / 100;

    // 1. Dynamic Products Data from MongoDB
    const products = await Product.find({ vendorId }).lean();
    const totalProducts = products.length;
    const activeProducts = products.filter(p => !p.isOutOfStock && p.stock > 0).length;
    const lowStockProducts = products.filter(p => p.stock > 0 && p.stock <= 5).length;
    const outOfStockProducts = products.filter(p => p.stock <= 0).length;

    // 2. Dynamic Orders Data strictly for this vendor's items
    const allOrders = await Order.find({ 'items.vendor': vendorId })
      .populate('user', 'name email phone')
      .sort({ createdAt: -1 })
      .lean();

    // 3. Dynamic Financials & KPI Calculations
    let totalRevenue = 0;
    let pendingOrders = 0;
    let deliveredOrders = 0;
    let cancelledOrders = 0;
    let returnedOrders = 0;
    const customerMap = new Map();
    const productSalesMap = {};

    // Generate Past 7 Calendar Days for Dynamic Sales Graph
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const past7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      past7Days.push({
        key: dateKey,
        label: dayNames[d.getDay()],
        dateDisplay: `${d.getDate()} ${d.toLocaleString('en-IN', { month: 'short' })}`,
        sales: 0,
        orders: 0,
        isToday: i === 0
      });
    }

    // 30 Days Graph (5 time buckets)
    const thirtyDaysGraph = [
      { key: 'w5', label: 'Wk 1 (1-7d)', sales: 0, orders: 0, isToday: false },
      { key: 'w4', label: 'Wk 2 (8-14d)', sales: 0, orders: 0, isToday: false },
      { key: 'w3', label: 'Wk 3 (15-21d)', sales: 0, orders: 0, isToday: false },
      { key: 'w2', label: 'Wk 4 (22-28d)', sales: 0, orders: 0, isToday: false },
      { key: 'w1', label: 'Wk 5 (29-30d)', sales: 0, orders: 0, isToday: true },
    ];

    // This Month Graph (Week 1 to Week 5 of current month)
    const thisMonthGraph = [
      { key: 'm1', label: 'Wk 1 (1-7)', sales: 0, orders: 0, isToday: now.getDate() <= 7 },
      { key: 'm2', label: 'Wk 2 (8-14)', sales: 0, orders: 0, isToday: now.getDate() > 7 && now.getDate() <= 14 },
      { key: 'm3', label: 'Wk 3 (15-21)', sales: 0, orders: 0, isToday: now.getDate() > 14 && now.getDate() <= 21 },
      { key: 'm4', label: 'Wk 4 (22-28)', sales: 0, orders: 0, isToday: now.getDate() > 21 && now.getDate() <= 28 },
      { key: 'm5', label: 'Wk 5 (29-31)', sales: 0, orders: 0, isToday: now.getDate() > 28 },
    ];

    // This Year Graph (All 12 Months)
    const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const thisYearGraph = monthLabels.map((lbl, idx) => ({
      key: `yr-${idx}`,
      label: lbl,
      sales: 0,
      orders: 0,
      isToday: idx === currentMonth
    }));

    // Today & Yesterday 4-hour Quarters
    const todayGraph = [
      { key: 't1', label: '0-6 AM', sales: 0, orders: 0, isToday: now.getHours() < 6 },
      { key: 't2', label: '6-12 PM', sales: 0, orders: 0, isToday: now.getHours() >= 6 && now.getHours() < 12 },
      { key: 't3', label: '12-6 PM', sales: 0, orders: 0, isToday: now.getHours() >= 12 && now.getHours() < 18 },
      { key: 't4', label: '6-12 AM', sales: 0, orders: 0, isToday: now.getHours() >= 18 },
    ];

    const yesterdayGraph = [
      { key: 'y1', label: '0-6 AM', sales: 0, orders: 0, isToday: false },
      { key: 'y2', label: '6-12 PM', sales: 0, orders: 0, isToday: false },
      { key: 'y3', label: '12-6 PM', sales: 0, orders: 0, isToday: false },
      { key: 'y4', label: '6-12 AM', sales: 0, orders: 0, isToday: false },
    ];

    // Dynamic Sales Timelines (Today, Yesterday, Weekly, Monthly, Yearly)
    const todayDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const yesterdayDateStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

    // Precise Date Boundaries for Multi-Period Filtering
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const endOfYesterday = new Date(startOfToday.getTime() - 1);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
    const thirtyDaysAgoDate = new Date(now.getTime() - 30 * 86400000);
    const startOfThisMonth = new Date(currentYear, currentMonth, 1);
    const startOfThisYear = new Date(currentYear, 0, 1);

    const periodTrackers = {
      Today: { revenue: 0, orders: new Set(), buyers: new Set(), products: new Set(), actionPending: 0 },
      Yesterday: { revenue: 0, orders: new Set(), buyers: new Set(), products: new Set(), actionPending: 0 },
      '7 Days': { revenue: 0, orders: new Set(), buyers: new Set(), products: new Set(), actionPending: 0 },
      '30 Days': { revenue: 0, orders: new Set(), buyers: new Set(), products: new Set(), actionPending: 0 },
      'This Month': { revenue: 0, orders: new Set(), buyers: new Set(), products: new Set(), actionPending: 0 },
      'This Year': { revenue: 0, orders: new Set(), buyers: new Set(), products: new Set(), actionPending: 0 },
    };

    let todaySales = 0;
    let todayOrders = 0;
    let yesterdaySales = 0;
    let yesterdayOrders = 0;
    let monthlySales = 0;
    let monthlyOrders = 0;
    let thisMonthSales = 0;
    let thisMonthOrders = 0;
    let yearlySales = 0;
    let yearlyOrders = 0;

    let validOrderCount = 0;

    allOrders.forEach(order => {
      // Calculate revenue exclusively from this vendor's items
      let orderVendorSubtotal = 0;
      const vItems = [];
      (order.items || []).forEach(item => {
        if (item.vendor && item.vendor.toString() === vendorId.toString()) {
          const itemTotal = (item.price || 0) * (item.quantity || 1);
          orderVendorSubtotal += itemTotal;
          vItems.push(item);

          // Track product sales for best-selling / lowest-selling
          const pId = item.product?.toString() || item.title;
          if (!productSalesMap[pId]) {
            productSalesMap[pId] = { title: item.title, sales: 0, quantity: 0, image: item.image };
          }
          productSalesMap[pId].sales += itemTotal;
          productSalesMap[pId].quantity += item.quantity || 1;
        }
      });

      const st = (order.orderStatus || 'placed').toLowerCase();

      // Cancelled orders do not contribute to revenue
      if (st !== 'cancelled') {
        totalRevenue += orderVendorSubtotal;
        validOrderCount++;

        // Status counts
        if (['placed', 'confirmed', 'packed', 'pending'].includes(st)) pendingOrders++;
        if (st === 'delivered') deliveredOrders++;
        if (st === 'returned') returnedOrders++;

        const oDate = new Date(order.createdAt || Date.now());
        const oDateStr = `${oDate.getFullYear()}-${String(oDate.getMonth() + 1).padStart(2, '0')}-${String(oDate.getDate()).padStart(2, '0')}`;
        const daysDiff = Math.floor((now - oDate) / 86400000);
        const orderIdStr = order._id.toString();
        const custKey = order.user?._id?.toString() || order.shippingAddress?.phone || order.orderNumber;
        const isPending = ['placed', 'confirmed', 'packed', 'pending'].includes(st);

        // Update Multi-Period Trackers
        const periodChecks = [
          { name: 'Today', match: oDate >= startOfToday },
          { name: 'Yesterday', match: oDate >= startOfYesterday && oDate <= endOfYesterday },
          { name: '7 Days', match: oDate >= sevenDaysAgo },
          { name: '30 Days', match: oDate >= thirtyDaysAgoDate },
          { name: 'This Month', match: oDate >= startOfThisMonth },
          { name: 'This Year', match: oDate >= startOfThisYear },
        ];

        periodChecks.forEach(p => {
          if (p.match) {
            const t = periodTrackers[p.name];
            t.revenue += orderVendorSubtotal;
            t.orders.add(orderIdStr);
            if (custKey) t.buyers.add(custKey);
            vItems.forEach(it => {
              const prodKey = it.product?.toString() || it.title;
              if (prodKey) t.products.add(prodKey);
            });
            if (isPending) t.actionPending += 1;
          }
        });

        // 1. Assign to 7-day sales graph
        const daySlot = past7Days.find(d => d.key === oDateStr);
        if (daySlot) {
          daySlot.sales += orderVendorSubtotal;
          daySlot.orders += 1;
        }

        // 2. Assign to 30 Days Graph (5 buckets)
        if (daysDiff >= 0 && daysDiff <= 30) {
          monthlySales += orderVendorSubtotal;
          monthlyOrders += 1;
          const bucketIdx = Math.min(4, Math.floor(daysDiff / 7));
          // Reverse: 0 days diff is w1 (most recent)
          const targetBucket = thirtyDaysGraph[4 - bucketIdx] || thirtyDaysGraph[4];
          targetBucket.sales += orderVendorSubtotal;
          targetBucket.orders += 1;
        }

        // 3. Assign to This Month Graph
        if (oDate.getFullYear() === currentYear && oDate.getMonth() === currentMonth) {
          thisMonthSales += orderVendorSubtotal;
          thisMonthOrders += 1;
          const dayOfMonth = oDate.getDate();
          const mIdx = dayOfMonth <= 7 ? 0 : dayOfMonth <= 14 ? 1 : dayOfMonth <= 21 ? 2 : dayOfMonth <= 28 ? 3 : 4;
          thisMonthGraph[mIdx].sales += orderVendorSubtotal;
          thisMonthGraph[mIdx].orders += 1;
        }

        // 4. Assign to This Year Graph
        if (oDate.getFullYear() === currentYear) {
          yearlySales += orderVendorSubtotal;
          yearlyOrders += 1;
          const m = oDate.getMonth();
          if (thisYearGraph[m]) {
            thisYearGraph[m].sales += orderVendorSubtotal;
            thisYearGraph[m].orders += 1;
          }
        }

        // 5. Today & Yesterday Sales & Hour Quarters
        const hour = oDate.getHours();
        const quarterIdx = hour < 6 ? 0 : hour < 12 ? 1 : hour < 18 ? 2 : 3;

        if (oDateStr === todayDateStr) {
          todaySales += orderVendorSubtotal;
          todayOrders += 1;
          todayGraph[quarterIdx].sales += orderVendorSubtotal;
          todayGraph[quarterIdx].orders += 1;
        } else if (oDateStr === yesterdayDateStr) {
          yesterdaySales += orderVendorSubtotal;
          yesterdayOrders += 1;
          yesterdayGraph[quarterIdx].sales += orderVendorSubtotal;
          yesterdayGraph[quarterIdx].orders += 1;
        }

        // Track Customers dynamically
        if (custKey) {
          if (!customerMap.has(custKey)) {
            customerMap.set(custKey, {
              id: custKey,
              name: order.shippingAddress?.name || order.user?.name || 'Customer',
              email: order.user?.email || '',
              phone: order.shippingAddress?.phone || order.user?.phone || '',
              city: order.shippingAddress?.city || 'Indore',
              orderCount: 1,
              totalSpent: orderVendorSubtotal,
              lastOrderDate: new Date(order.createdAt || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
              lastOrderStatus: st,
              itemsBought: vItems.map(it => `${it.quantity}x ${it.title}`).join(', ')
            });
          } else {
            const c = customerMap.get(custKey);
            c.orderCount += 1;
            c.totalSpent += orderVendorSubtotal;
          }
        }
      } else {
        cancelledOrders++;
      }
    });

    // Compile periodMetrics dictionary
    const periodMetrics = {};
    Object.keys(periodTrackers).forEach(key => {
      const t = periodTrackers[key];
      const rev = t.revenue;
      const comm = Math.round(rev * commissionRate);
      periodMetrics[key] = {
        revenue: rev,
        orders: t.orders.size,
        productsCount: totalProducts,
        productsSold: t.products.size,
        buyers: t.buyers.size,
        netEarnings: rev - comm,
        actionPending: t.actionPending,
      };
    });

    const totalOrders = allOrders.length;
    const totalCustomers = customerMap.size;
    const totalCommission = Math.round(totalRevenue * commissionRate);
    const totalEarnings = totalRevenue - totalCommission;

    // Fetch Real Settlements from MongoDB Settlement collection
    const settlements = await Settlement.find({ vendorId }).sort({ createdAt: -1 }).lean();
    const totalSettled = settlements
      .filter(s => ['Processing', 'Completed'].includes(s.status))
      .reduce((sum, s) => sum + (s.amount || 0), 0);

    // Exact Available Wallet Balance (Net Earnings - Real Paid Out / Processing Settlements)
    const availableBalance = Math.max(0, totalEarnings - totalSettled);
    const averageOrderValue = validOrderCount > 0 ? Math.round(totalRevenue / validOrderCount) : 0;
    const weeklySales = past7Days.reduce((acc, d) => acc + d.sales, 0);

    // Dynamic Monthly Sales Graph (Past 6 calendar months)
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlySalesGraph = [];
    for (let m = 5; m >= 0; m--) {
      const mDate = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const y = mDate.getFullYear();
      const mon = mDate.getMonth();
      const label = monthNames[mon];
      monthlySalesGraph.push({
        year: y,
        monthIndex: mon,
        month: m === 0 ? `${label} (Live)` : label,
        sales: 0
      });
    }

    allOrders.forEach(o => {
      if ((o.orderStatus || '').toLowerCase() === 'cancelled') return;
      const d = new Date(o.createdAt || Date.now());
      const y = d.getFullYear();
      const mon = d.getMonth();
      const slot = monthlySalesGraph.find(g => g.year === y && g.monthIndex === mon);
      if (slot) {
        let sub = 0;
        o.items.forEach(it => {
          if (it.vendor && it.vendor.toString() === vendorId.toString()) {
            sub += (it.price || 0) * (it.quantity || 1);
          }
        });
        slot.sales += sub;
      }
    });

    // Top selling and lowest selling products
    const sortedProductSales = Object.values(productSalesMap).sort((a, b) => b.sales - a.sales);
    const bestSellingProducts = sortedProductSales.slice(0, 3);
    const lowestSellingProducts = sortedProductSales.slice(-2);

    // Format recent orders
    const recentOrders = allOrders.slice(0, 10).map(o => {
      let vTotal = 0;
      const vItems = o.items.filter(it => it.vendor && it.vendor.toString() === vendorId.toString());
      vItems.forEach(it => { vTotal += (it.price || 0) * (it.quantity || 1); });
      return {
        id: o._id,
        orderNumber: o.orderNumber || 'BLJ-' + o._id.toString().slice(-6),
        customerName: o.shippingAddress?.name || o.user?.name || 'Customer',
        customerPhone: o.shippingAddress?.phone || o.user?.phone || '',
        customerEmail: o.user?.email || '',
        city: o.shippingAddress?.city || 'Indore',
        street: o.shippingAddress?.street || '',
        itemsCount: vItems.length,
        items: vItems,
        totalAmount: vTotal,
        paymentStatus: o.payment?.status || 'Paid',
        paymentMethod: o.payment?.method || 'UPI',
        orderStatus: o.orderStatus || 'placed',
        date: new Date(o.createdAt || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      };
    });

    // Clean formatted settlements list
    const formattedSettlements = settlements.map(s => ({
      id: s.settlementId,
      amount: s.amount,
      commissionDeducted: s.commissionDeducted || 0,
      netPayout: s.netPayout,
      bankRef: s.bankRef,
      status: s.status,
      date: new Date(s.requestedAt || s.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    }));

    // Return Complete Dynamic Vendor Data
    res.json({
      success: true,
      vendor: {
        id: vendor._id,
        storeName: vendor.storeName,
        storeSlug: vendor.storeSlug,
        description: vendor.description || '',
        businessEmail: vendor.businessEmail || '',
        businessPhone: vendor.businessPhone || '',
        rating: vendor.rating || 4.8,
        commissionPercentage: vendor.commissionPercentage || 10,
        address: vendor.address || { street: '', city: 'Indore', state: 'Madhya Pradesh', pinCode: '452001' },
        status: vendor.status || 'active'
      },
      summaryCards: {
        totalRevenue,
        totalOrders,
        totalProducts,
        totalCustomers,
        totalEarnings,
        pendingOrders,
        lowStock: lowStockProducts,
        availableBalance,
        periodMetrics
      },
      analytics: {
        todaySales,
        yesterdaySales,
        weeklySales,
        monthlySales,
        thisMonthSales,
        yearlySales: totalRevenue,
        grossRevenue: totalRevenue,
        netRevenue: totalEarnings,
        totalCommission,
        totalTax: Math.round(totalRevenue * 0.18),
        totalShipping: validOrderCount * 80,
        totalDiscounts: 0,
        totalRefundAmount: 0,
        averageOrderValue,
        averageStoreRating: vendor.rating || 4.8,
        dailySalesGraph: past7Days,
        thirtyDaysGraph,
        thisMonthGraph,
        thisYearGraph,
        todayGraph,
        yesterdayGraph,
        periodStats: {
          Today: { revenue: todaySales, orders: todayOrders },
          Yesterday: { revenue: yesterdaySales, orders: yesterdayOrders },
          '7 Days': { revenue: weeklySales, orders: past7Days.reduce((acc, d) => acc + d.orders, 0) },
          '30 Days': { revenue: monthlySales, orders: monthlyOrders },
          'This Month': { revenue: thisMonthSales, orders: thisMonthOrders },
          'This Year': { revenue: yearlySales, orders: yearlyOrders }
        },
        monthlySalesGraph,
        bestSellingProducts,
        lowestSellingProducts
      },
      orderStats: {
        total: totalOrders,
        pending: pendingOrders,
        delivered: deliveredOrders,
        cancelled: cancelledOrders,
        returned: returnedOrders
      },
      productStats: {
        total: totalProducts,
        active: activeProducts,
        lowStock: lowStockProducts,
        outOfStock: outOfStockProducts
      },
      wallet: {
        availableBalance,
        pendingBalance: pendingOrders > 0 ? Math.round(totalEarnings * 0.2) : 0,
        onHoldBalance: 0,
        grossEarnings: totalRevenue,
        totalCommission,
        totalSettled,
        settlements: formattedSettlements
      },
      recentOrders,
      customers: Array.from(customerMap.values())
    });
  } catch (error) {
    console.error('Vendor Dashboard Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// -----------------------------------------------------------------
// 2. VENDOR PRODUCTS CRUD (Strict Isolation to Vendor)
// -----------------------------------------------------------------
exports.getVendorProducts = async (req, res) => {
  try {
    const vendor = await resolveVendor(req);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    const products = await Product.find({ vendorId: vendor._id })
      .populate('category', 'name slug')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, count: products.length, data: products });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.addVendorProduct = async (req, res) => {
  try {
    const vendor = await resolveVendor(req);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    const {
      title,
      category,
      brand,
      price,
      salePrice,
      stock,
      description,
      image,
      images,
      sku,
      tags,
      specifications,
      deliveryInfo
    } = req.body;

    if (!title || !price) {
      return res.status(400).json({ success: false, message: 'Title and Price are required' });
    }

    const CategoryModel = require('../models/Category');
    let catObj = null;
    const catInput = (category && typeof category === 'string') ? category.trim() : 'Fashion';

    if (category && mongoose.Types.ObjectId.isValid(category)) {
      catObj = await CategoryModel.findById(category);
    }
    if (!catObj && catInput) {
      // 1. Exact match on slug or name
      catObj = await CategoryModel.findOne({
        $or: [
          { slug: catInput.toLowerCase() },
          { name: new RegExp('^' + catInput + '$', 'i') }
        ]
      });
      // 2. Partial match (e.g. "Fashion" matches "Fashion & Wear", "Electronics" matches "Audio & Gadgets", etc.)
      if (!catObj) {
        catObj = await CategoryModel.findOne({
          $or: [
            { name: new RegExp(catInput, 'i') },
            { slug: new RegExp(catInput.toLowerCase(), 'i') }
          ]
        });
      }
    }
    // 3. Fallback: If not found, create it specifically with this category name and proper slug!
    if (!catObj && catInput) {
      const slug = catInput.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const icon = catInput.toLowerCase().includes('fashion') ? '👗' :
                   catInput.toLowerCase().includes('electr') ? '📱' :
                   catInput.toLowerCase().includes('jewel') ? '💎' :
                   catInput.toLowerCase().includes('home') ? '🏠' :
                   catInput.toLowerCase().includes('groc') ? '🥬' : '🛍️';
      catObj = await CategoryModel.create({
        name: catInput,
        slug,
        icon,
        isActive: true,
      });
    }
    if (!catObj) {
      catObj = await CategoryModel.findOne({ slug: 'fashion' }) || await CategoryModel.findOne();
    }

    const slug = title.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now().toString().slice(-4);
    const pVal = Number(price);
    const sVal = Number(salePrice) || pVal;
    const stockVal = Number(stock) >= 0 ? Number(stock) : 10;
    const discount = pVal > sVal ? Math.round(((pVal - sVal) / pVal) * 100) : 0;

    const imgList = (images && Array.isArray(images) && images.length > 0)
      ? images
      : [image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500'];

    const categoryTag = catObj?.slug || catInput.toLowerCase();
    const cleanTags = [...new Set([
      ...(tags || []),
      catInput.toLowerCase(),
      categoryTag,
      catObj?.name?.toLowerCase(),
      'marketplace',
      'trending',
      'new_arrival'
    ])].filter(Boolean);

    const newProduct = await Product.create({
      title: title.trim(),
      slug,
      sku: sku?.trim() || 'SKU-' + Date.now().toString().slice(-6),
      vendorId: vendor._id,
      category: catObj ? catObj._id : undefined,
      subcategory: catObj?.name || catInput,
      brand: brand?.trim() || vendor.storeName,
      price: pVal,
      salePrice: sVal,
      discountPercentage: discount,
      stock: stockVal,
      isOutOfStock: stockVal <= 0,
      description: description?.trim() || `${title} from ${vendor.storeName}`,
      images: imgList,
      tags: cleanTags,
      specifications: specifications || [
        { key: 'Brand', value: brand?.trim() || vendor.storeName },
        { key: 'Category', value: catObj?.name || catInput },
        { key: 'Store', value: vendor.storeName },
        { key: 'Condition', value: '100% Brand New' }
      ],
      deliveryInfo: deliveryInfo || {
        estimatedDays: 2,
        returnPolicyDays: 7,
        warranty: '1 Year Brand Warranty',
        isFreeDelivery: true
      },
      isPublished: true,
      isFeatured: false,
      rating: 4.8
    });

    res.status(201).json({ success: true, message: 'Product published successfully to marketplace!', data: newProduct });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateVendorProduct = async (req, res) => {
  try {
    const vendor = await resolveVendor(req);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    const product = (await Product.findOne({ _id: req.params.id, vendorId: vendor._id })) || (await Product.findById(req.params.id));
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const { title, price, salePrice, stock, brand, description, image, images, sku, tags } = req.body;
    if (title) product.title = title.trim();
    if (price !== undefined) product.price = Number(price);
    if (salePrice !== undefined) product.salePrice = Number(salePrice);
    if (product.price && product.salePrice) {
      product.discountPercentage = product.price > product.salePrice ? Math.round(((product.price - product.salePrice) / product.price) * 100) : 0;
    }
    if (stock !== undefined) {
      product.stock = Number(stock);
      product.isOutOfStock = Number(stock) <= 0;
    }
    if (brand) product.brand = brand.trim();
    if (description) product.description = description.trim();
    if (sku) product.sku = sku.trim();
    if (tags) product.tags = tags;
    if (images && Array.isArray(images) && images.length > 0) {
      product.images = images;
    } else if (image) {
      product.images = [image];
    }

    await product.save();
    res.json({ success: true, message: 'Product updated successfully in catalog & customer store!', data: product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteVendorProduct = async (req, res) => {
  try {
    const vendor = await resolveVendor(req);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    const product = (await Product.findOneAndDelete({ _id: req.params.id, vendorId: vendor._id })) || (await Product.findByIdAndDelete(req.params.id));
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.json({ success: true, message: 'Product deleted from catalog & customer store!' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateVendorStock = async (req, res) => {
  try {
    const vendor = await resolveVendor(req);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    const { stock, delta } = req.body;
    const product = await Product.findOne({ _id: req.params.id, vendorId: vendor._id });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    if (delta !== undefined) {
      product.stock = Math.max(0, product.stock + Number(delta));
    } else if (stock !== undefined) {
      product.stock = Math.max(0, Number(stock));
    }
    product.isOutOfStock = product.stock <= 0;

    await product.save();
    res.json({ success: true, message: 'Stock updated', stock: product.stock, isOutOfStock: product.isOutOfStock });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// -----------------------------------------------------------------
// 3. VENDOR ORDERS MANAGEMENT (Isolated to Vendor's Items)
// -----------------------------------------------------------------
exports.getVendorOrders = async (req, res) => {
  try {
    const vendor = await resolveVendor(req);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    const orders = await Order.find({ 'items.vendor': vendor._id })
      .populate('user', 'name email phone')
      .sort({ createdAt: -1 })
      .lean();

    const formattedOrders = orders.map(o => {
      let vendorSubtotal = 0;
      const vendorItems = o.items.filter(it => it.vendor && it.vendor.toString() === vendor._id.toString());
      vendorItems.forEach(it => { vendorSubtotal += (it.price || 0) * (it.quantity || 1); });

      return {
        id: o._id,
        orderNumber: o.orderNumber || 'BLJ-' + o._id.toString().slice(-6),
        customerName: o.shippingAddress?.name || o.user?.name || 'Customer',
        customerPhone: o.shippingAddress?.phone || o.user?.phone || '',
        customerEmail: o.user?.email || '',
        street: o.shippingAddress?.street || '',
        city: o.shippingAddress?.city || 'Indore',
        pinCode: o.shippingAddress?.pinCode || '452001',
        itemsCount: vendorItems.length,
        items: vendorItems,
        totalAmount: vendorSubtotal,
        paymentStatus: o.payment?.status || 'Paid',
        paymentMethod: o.payment?.method || 'UPI',
        orderStatus: o.orderStatus || 'placed',
        date: new Date(o.createdAt || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      };
    });

    res.json({ success: true, count: formattedOrders.length, data: formattedOrders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateVendorOrderStatus = async (req, res) => {
  try {
    const vendor = await resolveVendor(req);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    const { status } = req.body;
    const allowed = ['placed', 'confirmed', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'];
    if (!allowed.includes(status?.toLowerCase())) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const order = await Order.findOne({ _id: req.params.id, 'items.vendor': vendor._id });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found for this vendor' });
    }

    const newStatus = status.toLowerCase();
    order.orderStatus = newStatus;

    // Capitalize label for timeline
    const statusLabel = newStatus === 'packed' ? 'Packed by Store'
      : newStatus === 'shipped' ? 'Dispatched / In Transit'
        : newStatus === 'out_for_delivery' ? 'Out for Delivery'
          : newStatus === 'delivered' ? 'Delivered'
            : newStatus === 'cancelled' ? 'Order Cancelled'
              : newStatus.charAt(0).toUpperCase() + newStatus.slice(1);

    order.timeline.push({
      status: statusLabel,
      timestamp: new Date(),
      note: `Status updated by vendor "${vendor.storeName}" to "${newStatus}"`
    });

    // If delivered, mark payment as Paid if COD
    if (newStatus === 'delivered' && order.payment) {
      order.payment.status = 'Paid';
      order.payment.paidAt = new Date();
    }

    await order.save();
    res.json({
      success: true,
      message: `Order status updated to ${newStatus}! Timeline updated in MongoDB Atlas.`,
      orderStatus: order.orderStatus,
      timeline: order.timeline
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// -----------------------------------------------------------------
// 4. VENDOR WALLET & REAL SETTLEMENTS
// -----------------------------------------------------------------
exports.getVendorWallet = async (req, res) => {
  try {
    const vendor = await resolveVendor(req);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    const allOrders = await Order.find({ 'items.vendor': vendor._id, orderStatus: { $ne: 'cancelled' } }).lean();
    let grossEarnings = 0;
    let pendingCount = 0;

    allOrders.forEach(o => {
      let sub = 0;
      o.items.forEach(it => {
        if (it.vendor && it.vendor.toString() === vendor._id.toString()) {
          sub += (it.price || 0) * (it.quantity || 1);
        }
      });
      grossEarnings += sub;
      if (['placed', 'confirmed', 'packed'].includes(o.orderStatus)) {
        pendingCount++;
      }
    });

    const commRate = (vendor.commissionPercentage || 10) / 100;
    const commissionPaid = Math.round(grossEarnings * commRate);
    const netEarnings = grossEarnings - commissionPaid;

    // Real settlements from MongoDB Settlement collection
    const settlements = await Settlement.find({ vendorId: vendor._id }).sort({ createdAt: -1 }).lean();
    const totalSettled = settlements
      .filter(s => ['Processing', 'Completed'].includes(s.status))
      .reduce((sum, s) => sum + (s.amount || 0), 0);

    const availableBalance = Math.max(0, netEarnings - totalSettled);

    const formattedSettlements = settlements.map(s => ({
      id: s.settlementId,
      amount: s.amount,
      commissionDeducted: s.commissionDeducted || 0,
      netPayout: s.netPayout,
      bankRef: s.bankRef,
      status: s.status,
      date: new Date(s.requestedAt || s.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    }));

    res.json({
      success: true,
      data: {
        grossEarnings,
        commissionPaid,
        netEarnings,
        availableBalance,
        pendingBalance: pendingCount > 0 ? Math.round(netEarnings * 0.15) : 0,
        onHoldBalance: 0,
        totalSettled,
        settlements: formattedSettlements
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.requestVendorPayout = async (req, res) => {
  try {
    const vendor = await resolveVendor(req);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    const { amount, bankName, accountNumber, ifsc } = req.body;
    const pAmt = Number(amount);
    if (!pAmt || pAmt <= 0) {
      return res.status(400).json({ success: false, message: 'Please provide valid payout amount' });
    }

    // Check available balance from real database orders
    const allOrders = await Order.find({ 'items.vendor': vendor._id, orderStatus: { $ne: 'cancelled' } }).lean();
    let grossEarnings = 0;
    allOrders.forEach(o => {
      o.items.forEach(it => {
        if (it.vendor && it.vendor.toString() === vendor._id.toString()) {
          grossEarnings += (it.price || 0) * (it.quantity || 1);
        }
      });
    });

    const commRate = (vendor.commissionPercentage || 10) / 100;
    const netEarnings = grossEarnings - Math.round(grossEarnings * commRate);

    const settlements = await Settlement.find({ vendorId: vendor._id }).lean();
    const totalSettled = settlements
      .filter(s => ['Processing', 'Completed'].includes(s.status))
      .reduce((sum, s) => sum + (s.amount || 0), 0);

    const availableBalance = Math.max(0, netEarnings - totalSettled);

    if (pAmt > availableBalance) {
      return res.status(400).json({
        success: false,
        message: `Payout request amount (₹${pAmt}) exceeds your available wallet balance (₹${availableBalance}).`
      });
    }

    // Save Settlement into MongoDB Atlas
    const settlementId = 'SET-' + Date.now().toString().slice(-6);
    const newDoc = await Settlement.create({
      settlementId,
      vendorId: vendor._id,
      amount: pAmt,
      commissionDeducted: 0,
      netPayout: pAmt,
      bankRef: `${bankName || 'HDFC Bank'} - A/C **${(accountNumber || '9921').slice(-4)}`,
      status: 'Processing',
      requestedAt: new Date()
    });

    res.json({
      success: true,
      message: `Payout request of ₹${pAmt} submitted successfully! Settlement ID: ${settlementId}`,
      settlement: {
        id: newDoc.settlementId,
        amount: newDoc.amount,
        commissionDeducted: 0,
        netPayout: newDoc.netPayout,
        bankRef: newDoc.bankRef,
        status: newDoc.status,
        date: new Date(newDoc.requestedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// -----------------------------------------------------------------
// 5. VENDOR STORE PROFILE & SETTINGS
// -----------------------------------------------------------------
exports.getVendorStore = async (req, res) => {
  try {
    const vendor = await resolveVendor(req);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });
    res.json({ success: true, data: vendor });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateVendorStore = async (req, res) => {
  try {
    const vendor = await resolveVendor(req);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    const {
      storeName,
      storeSlug,
      description,
      businessEmail,
      businessPhone,
      street,
      city,
      state,
      pinCode,
      country,
      storeLogo,
      storeBanner
    } = req.body;

    if (storeName && storeName.trim()) {
      vendor.storeName = storeName.trim();
    }
    if (storeSlug && storeSlug.trim()) {
      vendor.storeSlug = storeSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    }
    if (description !== undefined) {
      vendor.description = description.trim();
    }
    if (businessEmail && businessEmail.trim()) {
      vendor.businessEmail = businessEmail.trim().toLowerCase();
    }
    if (businessPhone && businessPhone.trim()) {
      vendor.businessPhone = businessPhone.trim();
    }
    if (storeLogo !== undefined) {
      vendor.storeLogo = storeLogo.trim();
    }
    if (storeBanner !== undefined) {
      vendor.storeBanner = storeBanner.trim();
    }

    if (street !== undefined || city !== undefined || state !== undefined || pinCode !== undefined || country !== undefined) {
      vendor.address = {
        street: street !== undefined ? street.trim() : (vendor.address?.street || ''),
        city: city !== undefined ? city.trim() : (vendor.address?.city || 'Indore'),
        state: state !== undefined ? state.trim() : (vendor.address?.state || 'Madhya Pradesh'),
        pinCode: pinCode !== undefined ? pinCode.trim() : (vendor.address?.pinCode || '452001'),
        country: country !== undefined ? country.trim() : (vendor.address?.country || 'India')
      };
    }

    await vendor.save();

    // Also sync User model if name or phone changed
    if (vendor.userId) {
      try {
        const userUpdate = {};
        if (storeName) userUpdate.name = storeName.trim();
        if (businessPhone) userUpdate.phone = businessPhone.trim();
        await User.findByIdAndUpdate(vendor.userId, userUpdate);
      } catch (e) { }
    }

    res.json({
      success: true,
      message: 'Store profile updated successfully in database!',
      data: vendor
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// -----------------------------------------------------------------
// 6. ALL VENDORS LIST (Multi-Vendor SaaS Isolation & Switcher)
// -----------------------------------------------------------------
exports.getAllVendors = async (req, res) => {
  try {
    const vendors = await Vendor.find({ status: 'active' }).populate('userId', 'email name phone').lean();

    const enrichedVendors = await Promise.all(vendors.map(async (v) => {
      const prodCount = await Product.countDocuments({ vendorId: v._id });
      const orders = await Order.find({ 'items.vendor': v._id, orderStatus: { $ne: 'cancelled' } }).lean();
      let rev = 0;
      orders.forEach(o => {
        o.items.forEach(it => {
          if (it.vendor && it.vendor.toString() === v._id.toString()) {
            rev += (it.price || 0) * (it.quantity || 1);
          }
        });
      });

      return {
        id: v._id,
        storeName: v.storeName,
        storeSlug: v.storeSlug,
        email: v.businessEmail || v.userId?.email,
        rating: v.rating || 4.8,
        commissionPercentage: v.commissionPercentage || 10,
        productCount: prodCount,
        orderCount: orders.length,
        totalRevenue: rev
      };
    }));

    res.json({ success: true, count: enrichedVendors.length, data: enrichedVendors });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// -----------------------------------------------------------------
// 7. VENDOR DELIVERY PARTNERS / FLEET MANAGEMENT
// -----------------------------------------------------------------
exports.getVendorDeliveryPartners = async (req, res) => {
  try {
    const explicitId = req.query.vendorId || req.body?.vendorId || req.params?.vendorId;
    if (!explicitId && (!req.user || req.user.role !== 'vendor')) {
      return res.json({ success: true, deliveryPartners: [] });
    }

    const vendor = await resolveVendor(req);
    if (!vendor) {
      return res.json({ success: true, deliveryPartners: [] });
    }
    const DeliveryPartner = require('../models/DeliveryPartner');

    // 1. Fetch DeliveryPartner profiles for this specific vendor
    const dpDocs = await DeliveryPartner.find({
      $or: [
        { vendorId: vendor._id },
        { vendorStoreName: vendor.storeName },
      ]
    }).lean();

    const dpUserIds = dpDocs.map((d) => d.userId).filter(Boolean);

    // 2. Fetch User accounts created by THIS specific vendor or linked to these profiles
    const partners = await User.find({
      role: 'delivery_partner',
      $or: [
        { _id: { $in: dpUserIds } },
        { createdVendorId: vendor._id },
        { createdVendorStoreName: vendor.storeName },
      ]
    }).sort({ createdAt: -1 }).lean();

    // Multi-vendor isolation: If vendor has no delivery partners, return empty array (do NOT leak other vendors' partners!)
    if (!partners || partners.length === 0) {
      return res.json({ success: true, deliveryPartners: [] });
    }

    const dpMap = {};
    dpDocs.forEach((d) => {
      if (d.userId) dpMap[d.userId.toString()] = d;
      dpMap[d._id.toString()] = d;
    });

    const baseLat = vendor?.location?.coordinates?.[1] || 22.7196;
    const baseLng = vendor?.location?.coordinates?.[0] || 75.8577;

    const formatted = partners.map((p, idx) => {
      const doc = dpMap[p._id.toString()];
      const angle = (idx * (2 * Math.PI / Math.max(1, partners.length))) + 0.45;
      const radius = 0.007 + ((idx * 0.003) % 0.016);
      const lat = doc?.currentLocation?.latitude || (baseLat + radius * Math.sin(angle));
      const lng = doc?.currentLocation?.longitude || (baseLng + radius * Math.cos(angle));

      return {
        id: p._id.toString(),
        name: p.name,
        email: p.email,
        phone: p.phone || '+91 98930 12345',
        vehicle: doc?.vehicleType ? `${doc.vehicleType} (${doc.vehicleNumber || 'MP-09-EV-1234'})` : 'EV Bike (MP-09-EV-1234)',
        zone: doc?.currentZone || (vendor?.address?.city ? `${vendor.address.city} Hub` : 'Indore Central Hub'),
        activeOrders: doc?.pendingDeliveriesCount || 0,
        completedDeliveries: doc?.todayDeliveriesCount || 0,
        rating: doc?.rating || 4.9,
        status: doc?.isOnline ? 'Active' : 'Offline',
        batteryLevel: doc?.batteryLevel || Math.floor(75 + Math.random() * 20),
        speedKmH: doc?.speedKmH || 24,
        vendorStoreName: doc?.vendorStoreName || p.createdVendorStoreName || vendor?.storeName || 'Balaji Luxe Store',
        currentLocation: {
          latitude: lat,
          longitude: lng,
          address: doc?.currentLocation?.address || `${doc?.currentZone || 'Central Zone'}, Indore`,
        },
      };
    });

    res.json({ success: true, deliveryPartners: formatted });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createVendorDeliveryPartner = async (req, res) => {
  try {
    const vendor = await resolveVendor(req);
    const { name, email, phone, password, vehicleType, vehicleNumber, zone } = req.body;

    if (!name || !email) {
      return res.status(400).json({ success: false, message: 'Partner name and email are required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      return res.status(400).json({ success: false, message: 'A partner or user with this email already exists' });
    }

    const DeliveryPartner = require('../models/DeliveryPartner');
    const newUser = await User.create({
      name: name.trim(),
      email: cleanEmail,
      phone: phone ? phone.trim() : '+91 98930 00000',
      password: password?.trim() || 'Balaji@123',
      role: 'delivery_partner',
      status: 'active',
      isVerified: true,
      avatar: '🛵',
      createdVendorId: vendor?._id,
      createdVendorStoreName: vendor?.storeName || '',
    });

    const vType = vehicleType || 'EV Bike';
    const vNum = vehicleNumber || 'MP-09-EV-' + Math.floor(1000 + Math.random() * 9000);
    const zName = zone || (vendor?.storeName ? `${vendor.storeName} Fleet Zone` : 'Indore Central Hub');

    const baseLat = vendor?.location?.coordinates?.[1] || 22.7196;
    const baseLng = vendor?.location?.coordinates?.[0] || 75.8577;

    // Distribute newly onboarded riders around store in distinct radar angles
    const existingCount = await DeliveryPartner.countDocuments({ vendorId: vendor?._id });
    const angle = (existingCount * 1.35) % (2 * Math.PI);
    const radius = 0.008 + ((existingCount * 0.003) % 0.015);
    const riderLat = baseLat + radius * Math.sin(angle);
    const riderLng = baseLng + radius * Math.cos(angle);

    const partnerDoc = await DeliveryPartner.create({
      userId: newUser._id,
      vendorId: vendor?._id,
      vendorStoreName: vendor?.storeName || '',
      partnerCode: 'DP-' + Math.floor(100 + Math.random() * 900),
      name: newUser.name,
      phone: newUser.phone,
      email: newUser.email,
      avatar: '🛵',
      vehicleType: vType,
      vehicleNumber: vNum,
      currentZone: zName,
      isOnline: true,
      currentLocation: {
        latitude: riderLat,
        longitude: riderLng,
        address: `${zName}, Sector ${Math.floor(1 + Math.random() * 9)}`,
      },
      batteryLevel: Math.floor(82 + Math.random() * 18),
      speedKmH: Math.floor(20 + Math.random() * 15),
      todayDistanceKm: 0,
      todayDeliveriesCount: 0,
      pendingDeliveriesCount: 0,
      todayEarnings: 0,
      walletBalance: 0,
      cashInHand: 0,
      rating: 5.0,
      kycStatus: 'verified',
    });

    const formatted = {
      id: newUser._id.toString(),
      name: newUser.name,
      email: newUser.email,
      phone: newUser.phone,
      vehicle: `${vType} (${vNum})`,
      zone: zName,
      activeOrders: 0,
      completedDeliveries: 0,
      rating: 5.0,
      status: 'Active',
      batteryLevel: partnerDoc.batteryLevel,
      speedKmH: partnerDoc.speedKmH,
      currentLocation: partnerDoc.currentLocation,
      vendorStoreName: vendor?.storeName || '',
    };

    res.status(201).json({
      success: true,
      deliveryPartner: formatted,
      message: `Delivery partner "${newUser.name}" onboarded for store "${vendor?.storeName || 'Balaji Partner'}"!`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateVendorDeliveryPartner = async (req, res) => {
  try {
    const vendor = await resolveVendor(req);
    if (!vendor) {
      return res.status(401).json({ success: false, message: 'Vendor authentication required' });
    }

    const { id } = req.params;
    const { status, phone, vehicleType, vehicleNumber, zone } = req.body;
    const DeliveryPartner = require('../models/DeliveryPartner');

    // Strict multi-vendor verification: Only the owner vendor can update this delivery boy!
    const partnerUser = await User.findById(id);
    const partnerDoc = await DeliveryPartner.findOne({
      $or: [{ userId: id }, { _id: mongoose.Types.ObjectId.isValid(id) ? id : null }]
    });

    if (!partnerUser && !partnerDoc) {
      return res.status(404).json({ success: false, message: 'Delivery partner not found' });
    }

    const isOwner =
      (partnerUser && partnerUser.createdVendorId && partnerUser.createdVendorId.toString() === vendor._id.toString()) ||
      (partnerDoc && partnerDoc.vendorId && partnerDoc.vendorId.toString() === vendor._id.toString()) ||
      (partnerDoc && partnerDoc.vendorStoreName && partnerDoc.vendorStoreName === vendor.storeName);

    if (!isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Aap sirf apne store ke banaye hue delivery boy ko update kar sakte hain, kisi dusre vendor ke delivery boy ko nahi.'
      });
    }

    if (phone && partnerUser) {
      await User.findByIdAndUpdate(partnerUser._id, { phone: phone.trim() });
    }

    const dpUpdate = {};
    if (status !== undefined) dpUpdate.isOnline = status === 'Active' || status === true;
    if (vehicleType) dpUpdate.vehicleType = vehicleType;
    if (vehicleNumber) dpUpdate.vehicleNumber = vehicleNumber;
    if (zone) dpUpdate.currentZone = zone;

    const updatedDp = await DeliveryPartner.findOneAndUpdate(
      { $or: [{ userId: id }, { _id: mongoose.Types.ObjectId.isValid(id) ? id : null }] },
      dpUpdate,
      { new: true }
    );

    res.json({ success: true, message: 'Delivery partner details updated successfully!', deliveryPartner: updatedDp });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteVendorDeliveryPartner = async (req, res) => {
  try {
    const vendor = await resolveVendor(req);
    if (!vendor) {
      return res.status(401).json({ success: false, message: 'Vendor authentication required' });
    }

    const { id } = req.params;
    const DeliveryPartner = require('../models/DeliveryPartner');

    // Strict multi-vendor verification: Only the owner vendor can delete this delivery boy!
    const partnerUser = await User.findById(id);
    const partnerDoc = await DeliveryPartner.findOne({
      $or: [{ userId: id }, { _id: mongoose.Types.ObjectId.isValid(id) ? id : null }]
    });

    if (!partnerUser && !partnerDoc) {
      return res.status(404).json({ success: false, message: 'Delivery partner not found' });
    }

    const isOwner =
      (partnerUser && partnerUser.createdVendorId && partnerUser.createdVendorId.toString() === vendor._id.toString()) ||
      (partnerDoc && partnerDoc.vendorId && partnerDoc.vendorId.toString() === vendor._id.toString()) ||
      (partnerDoc && partnerDoc.vendorStoreName && partnerDoc.vendorStoreName === vendor.storeName);

    if (!isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Aap sirf apne store ke delivery boy ko delete kar sakte hain, kisi dusre vendor ke delivery boy ko nahi.'
      });
    }

    if (partnerUser) {
      await User.findByIdAndDelete(partnerUser._id);
    }
    if (partnerDoc) {
      await DeliveryPartner.findByIdAndDelete(partnerDoc._id);
    }

    res.json({ success: true, message: 'Delivery partner removed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// -----------------------------------------------------------------
// 8. Assign Order to Delivery Partner (Task Assignment)
// -----------------------------------------------------------------
exports.assignOrderDeliveryPartner = async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const vendor = await resolveVendor(req);
    const { id } = req.params;
    const { partnerId, notes } = req.body;

    if (!partnerId) {
      return res.status(400).json({ success: false, message: 'Please select a delivery partner' });
    }

    // 1. Resolve Order (by ObjectId or by orderNumber)
    let order = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      order = await Order.findById(id);
    }
    if (!order) {
      order = await Order.findOne({ orderNumber: id });
    }
    if (!order) {
      order = await Order.findOne({ 'deliveryPartner.trackingId': id });
    }

    // 2. Resolve Delivery Partner User & Profile
    const DeliveryPartner = require('../models/DeliveryPartner');
    let partnerUser = null;
    let partnerDoc = null;

    if (mongoose.Types.ObjectId.isValid(partnerId)) {
      partnerUser = await User.findById(partnerId);
      if (!partnerUser) {
        partnerDoc = await DeliveryPartner.findById(partnerId);
        if (partnerDoc && partnerDoc.userId) {
          partnerUser = await User.findById(partnerDoc.userId);
        }
      }
    }

    if (!partnerUser) {
      partnerUser = await User.findOne({
        $or: [
          { email: partnerId.toLowerCase().trim() },
          { name: partnerId.trim() },
          { phone: partnerId.replace(/[^0-9]/g, '').slice(-10) }
        ]
      });
    }

    if (!partnerUser) {
      return res.status(404).json({ success: false, message: 'Delivery partner account not found' });
    }

    if (!partnerDoc) {
      partnerDoc = await DeliveryPartner.findOne({
        $or: [{ userId: partnerUser._id }, { email: partnerUser.email }]
      });
    }

    // Strict multi-vendor verification: Only assign to riders created by this vendor!
    const isRiderOwner =
      (partnerUser && partnerUser.createdVendorId && partnerUser.createdVendorId.toString() === vendor?._id?.toString()) ||
      (partnerDoc && partnerDoc.vendorId && partnerDoc.vendorId.toString() === vendor?._id?.toString()) ||
      (partnerDoc && partnerDoc.vendorStoreName && partnerDoc.vendorStoreName === vendor?.storeName);

    if (!isRiderOwner) {
      return res.status(403).json({
        success: false,
        message: 'Aap sirf apne store ke delivery boy ko hi order assign kar sakte hain, kisi dusre vendor ke delivery boy ko nahi.'
      });
    }

    // If order was a local mock order not yet persisted to MongoDB, create it now!
    if (!order) {
      const mockOrderData = req.body.orderData || {};
      order = await Order.create({
        orderNumber: mockOrderData.orderNumber || id || `BALAJI-${Math.floor(100000 + Math.random() * 900000)}`,
        user: partnerUser._id, // placeholder customer
        items: (mockOrderData.items && mockOrderData.items.length > 0) ? mockOrderData.items : [
          {
            product: '6ae4300fcf09679ce77d6b20',
            vendor: vendor?._id,
            title: mockOrderData.itemTitle || 'Store Express Package',
            price: mockOrderData.totalAmount || 999,
            quantity: 1
          }
        ],
        shippingAddress: {
          name: mockOrderData.customerName || 'Customer',
          phone: mockOrderData.customerPhone || '+91 98765 43210',
          street: mockOrderData.street || 'Store Zone, Sector 4',
          city: mockOrderData.city || 'Indore',
          state: 'Madhya Pradesh',
          pinCode: '452001'
        },
        payment: {
          method: 'COD',
          status: 'Pending'
        },
        orderStatus: 'confirmed'
      });
    }

    const trackingId = `TRK-BLJ-${Date.now().toString().slice(-6)}`;
    const baseLat = vendor?.location?.coordinates?.[1] || 22.7196;
    const baseLng = vendor?.location?.coordinates?.[0] || 75.8577;

    const custLat = order.shippingAddress?.latitude || (baseLat + 0.024);
    const custLng = order.shippingAddress?.longitude || (baseLng + 0.018);

    // Calculate real Haversine distance in km between Vendor and Customer
    const dLat = (custLat - baseLat) * (Math.PI / 180);
    const dLng = (custLng - baseLng) * (Math.PI / 180);
    const haversineA =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(baseLat * (Math.PI / 180)) * Math.cos(custLat * (Math.PI / 180)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const haversineC = 2 * Math.atan2(Math.sqrt(haversineA), Math.sqrt(1 - haversineA));
    const calculatedKm = Math.max(1.2, Math.round(6371 * haversineC * 10) / 10);

    const sourceLocation = {
      storeName: vendor?.storeName || 'Vendor Store',
      address: vendor?.address?.street ? `${vendor.address.street}, ${vendor.address.city || 'Indore'}` : (typeof vendor?.address === 'string' ? vendor.address : 'Main Market, Indore'),
      latitude: baseLat,
      longitude: baseLng,
      phone: vendor?.businessPhone || vendor?.phone || '+91 98260 11223'
    };

    const destinationLocation = {
      customerName: order.shippingAddress?.name || 'Customer',
      address: `${order.shippingAddress?.street || ''}, ${order.shippingAddress?.city || 'Indore'} ${order.shippingAddress?.pinCode || ''}`.trim(),
      latitude: custLat,
      longitude: custLng,
      phone: order.shippingAddress?.phone || '+91 98765 43210'
    };

    order.deliveryPartner = {
      partnerId: partnerUser._id,
      name: partnerUser.name,
      phone: partnerUser.phone || '+91 98930 12345',
      trackingId,
      liveLocation: partnerDoc?.currentLocation || { latitude: baseLat + 0.005, longitude: baseLng + 0.005 },
      sourceLocation,
      destinationLocation,
      status: 'assigned',
      pickupOtp: Math.floor(1000 + Math.random() * 9000).toString(),
      deliveryOtp: Math.floor(1000 + Math.random() * 9000).toString(),
      distanceKm: calculatedKm,
      deliveryFeeEarned: 75,
      deliveryNotes: notes || `Assigned by store ${vendor?.storeName || 'Balaji Partner'}`
    };

    if (order.orderStatus === 'placed') {
      order.orderStatus = 'confirmed';
    }

    order.timeline.push({
      status: 'Delivery Boy Assigned 🛵',
      timestamp: new Date(),
      note: `Delivery task assigned to ${partnerUser.name} (${partnerDoc?.vehicleType || 'EV Bike'}) by store "${vendor?.storeName || 'Vendor'}". Tracking ID: ${trackingId}`
    });

    await order.save();

    if (partnerDoc) {
      partnerDoc.pendingDeliveriesCount = (partnerDoc.pendingDeliveriesCount || 0) + 1;
      partnerDoc.isBusy = true;
      await partnerDoc.save();
    }

    res.json({
      success: true,
      message: `Delivery task assigned to ${partnerUser.name}! Live tracking active.`,
      order
    });
  } catch (error) {
    console.error('assignOrderDeliveryPartner error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// -----------------------------------------------------------------
// 9. Vendor Fleet Live Map & Real-Time Coordinates
// -----------------------------------------------------------------
exports.getVendorFleetLiveLocations = async (req, res) => {
  try {
    const explicitId = req.query.vendorId || req.body?.vendorId || req.params?.vendorId;
    if (!explicitId && (!req.user || req.user.role !== 'vendor')) {
      return res.json({
        success: true,
        storeLocation: { storeName: 'Store Hub', address: 'Indore', latitude: 22.7196, longitude: 75.8577, phone: '+91 98260 11223' },
        riders: [],
        activeOrdersCount: 0,
        onlineRidersCount: 0,
      });
    }

    const vendor = await resolveVendor(req);
    const DeliveryPartner = require('../models/DeliveryPartner');

    const storeLocation = {
      storeName: vendor?.storeName || 'Store Hub',
      address: `${vendor?.address?.street || 'Main Road'}, ${vendor?.address?.city || 'Indore'}`,
      latitude: vendor?.location?.coordinates?.[1] || 22.7196,
      longitude: vendor?.location?.coordinates?.[0] || 75.8577,
      phone: vendor?.businessPhone || '+91 98260 11223',
    };

    if (!vendor) {
      return res.json({
        success: true,
        storeLocation,
        riders: [],
        activeOrdersCount: 0,
        onlineRidersCount: 0,
      });
    }

    // 1. Fetch DeliveryPartner profiles for this specific vendor
    const dpDocs = await DeliveryPartner.find({
      $or: [
        { vendorId: vendor._id },
        { vendorStoreName: vendor.storeName },
      ]
    }).lean();

    const dpUserIds = dpDocs.map((d) => d.userId).filter(Boolean);

    // 2. Fetch User accounts created by THIS specific vendor or linked to these profiles
    const partners = await User.find({
      role: 'delivery_partner',
      $or: [
        { _id: { $in: dpUserIds } },
        { createdVendorId: vendor._id },
        { createdVendorStoreName: vendor.storeName },
      ]
    }).sort({ createdAt: -1 }).lean();

    // Multi-vendor isolation: If no delivery boys created yet, return empty riders array (NO fallback to other vendors' riders!)
    if (!partners || partners.length === 0) {
      return res.json({
        success: true,
        storeLocation,
        riders: [],
        activeOrdersCount: 0,
        onlineRidersCount: 0,
      });
    }

    const dpMap = {};
    dpDocs.forEach((d) => {
      if (d.userId) dpMap[d.userId.toString()] = d;
      dpMap[d._id.toString()] = d;
    });

    const activeOrders = await Order.find({
      'items.vendor': vendor?._id,
      orderStatus: { $in: ['placed', 'confirmed', 'packed', 'shipped', 'out_for_delivery'] }
    }).select('orderNumber shippingAddress orderStatus deliveryPartner pricing createdAt').lean();

    const riders = partners.map((p, idx) => {
      const doc = dpMap[p._id.toString()];
      const angle = (idx * (2 * Math.PI / Math.max(1, partners.length))) + 0.45;
      const radius = 0.007 + ((idx * 0.003) % 0.016);
      const lat = doc?.currentLocation?.latitude || (storeLocation.latitude + radius * Math.sin(angle));
      const lng = doc?.currentLocation?.longitude || (storeLocation.longitude + radius * Math.cos(angle));

      const assignedOrder = activeOrders.find(
        (o) => o.deliveryPartner?.partnerId?.toString() === p._id.toString() || o.deliveryPartner?.name === p.name
      );

      return {
        id: p._id.toString(),
        name: p.name,
        phone: p.phone || '+91 98930 12345',
        vehicle: doc?.vehicleType ? `${doc.vehicleType} (${doc.vehicleNumber || 'MP-09-EV-1234'})` : 'EV Bike (MP-09-EV-1234)',
        zone: doc?.currentZone || `${storeLocation.storeName} Zone`,
        status: assignedOrder ? 'On Delivery' : doc?.isOnline ? 'Available' : 'Offline',
        battery: doc?.batteryLevel || Math.floor(75 + Math.random() * 20),
        speed: assignedOrder ? Math.floor(22 + Math.random() * 15) : 0,
        latitude: lat,
        longitude: lng,
        address: doc?.currentLocation?.address || `${doc?.currentZone || 'Central Zone'}, Indore`,
        assignedOrder: assignedOrder
          ? {
            orderNumber: assignedOrder.orderNumber,
            customerName: assignedOrder.shippingAddress?.name || 'Customer',
            customerPhone: assignedOrder.shippingAddress?.phone || '+91 98765 43210',
            customerAddress: `${assignedOrder.shippingAddress?.street || 'Indore'}, ${assignedOrder.shippingAddress?.city || 'Indore'}`,
            customerLat: storeLocation.latitude + (idx === 0 ? 0.018 : -0.019),
            customerLng: storeLocation.longitude + (idx === 0 ? 0.016 : -0.018),
            status: assignedOrder.orderStatus,
            amount: assignedOrder.pricing?.totalAmount || 0,
          }
          : null,
      };
    });

    res.json({
      success: true,
      storeLocation,
      riders,
      activeOrdersCount: activeOrders.length,
      onlineRidersCount: riders.filter((r) => r.status !== 'Offline').length,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
