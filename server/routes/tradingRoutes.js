import express from 'express';
import TradingService from '../services/tradingService.js';
import User from '../models/User.js';
import Admin from '../models/Admin.js';
import jwt from 'jsonwebtoken';

const router = express.Router();

// Auth middleware
const protect = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Not authorized' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) return res.status(401).json({ message: 'User not found' });
    
    next();
  } catch (error) {
    res.status(401).json({ message: 'Not authorized' });
  }
};

// Place order
router.post('/order', protect, async (req, res) => {
  try {
    // Check if user is in read-only mode
    if (req.user.isReadOnly) {
      return res.status(403).json({ message: 'Your account is in read-only mode. You can only view and close existing trades.' });
    }
    
    console.log('Order request:', req.body);
    const result = await TradingService.placeOrder(req.user._id, req.body);
    console.log('Order result:', result.success ? 'Success' : 'Failed');
    res.status(201).json(result);
  } catch (error) {
    console.error('Order error:', error.message);
    console.error('Order error stack:', error.stack);
    res.status(400).json({ message: error.message });
  }
});

// Get orders
router.get('/orders', protect, async (req, res) => {
  try {
    const { status } = req.query;
    const orders = await TradingService.getOrders(req.user._id, status);
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get positions
router.get('/positions', protect, async (req, res) => {
  try {
    const { status } = req.query;
    const positions = await TradingService.getPositions(req.user._id, status || 'OPEN');
    res.json(positions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Square off position
router.post('/positions/:id/squareoff', protect, async (req, res) => {
  try {
    const { exitPrice } = req.body;
    const result = await TradingService.squareOffPosition(
      req.params.id, 
      'MANUAL', 
      exitPrice
    );
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Square off all positions
router.post('/positions/squareoff-all', protect, async (req, res) => {
  try {
    const positions = await TradingService.getPositions(req.user._id, 'OPEN');
    const results = [];
    
    for (const position of positions) {
      try {
        const result = await TradingService.squareOffPosition(position._id, 'MANUAL');
        results.push(result);
      } catch (error) {
        results.push({ error: error.message, positionId: position._id });
      }
    }
    
    // After closing all positions, recalculate margin to ensure it's synced
    const marginResult = await TradingService.recalculateMargin(req.user._id);
    
    res.json({ squaredOff: results.length, results, marginSync: marginResult });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get wallet summary
router.get('/wallet', protect, async (req, res) => {
  try {
    const summary = await TradingService.getWalletSummary(req.user._id);
    res.json(summary);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Calculate margin for order (preview) - Uses user's segment and script settings
router.post('/margin-preview', protect, async (req, res) => {
  try {
    const leverage = req.body.leverage || 1;
    const { symbol, productType, side, lots = 1, instrumentType, category, segment } = req.body;
    
    // Import TradeService for user settings helpers
    const TradeService = (await import('../services/tradeService.js')).default;
    
    // Get user's segment and script settings
    const segmentSettings = TradeService.getUserSegmentSettings(req.user, segment, instrumentType);
    const scriptSettings = TradeService.getUserScriptSettings(req.user, symbol, category);
    
    // Debug logging - Check raw segment permissions
    let rawSegmentPerms = req.user.segmentPermissions;
    if (rawSegmentPerms && typeof rawSegmentPerms.toObject === 'function') {
      rawSegmentPerms = rawSegmentPerms.toObject();
    }
    const segmentData = rawSegmentPerms?.[segment] || rawSegmentPerms?.[segment?.toUpperCase()];
    
    console.log('Margin Preview Debug:', {
      symbol, segment, instrumentType,
      segmentSettingsFound: !!segmentSettings,
      rawSegmentFound: !!segmentData,
      exposureIntraday: segmentSettings?.exposureIntraday,
      exposureCarryForward: segmentSettings?.exposureCarryForward,
      commissionLot: segmentSettings?.commissionLot,
      rawExposureIntraday: segmentData?.exposureIntraday,
      rawCommissionLot: segmentData?.commissionLot,
      availableKeys: Object.keys(rawSegmentPerms || {})
    });
    
    let marginRequired = 0;
    let usedFixedMargin = false;
    let marginSource = 'calculated';
    
    // Check for fixed margin in script settings
    const isIntraday = productType === 'MIS' || productType === 'INTRADAY';
    const isOption = instrumentType === 'OPTIONS';
    const isOptionBuy = isOption && side === 'BUY';
    const isOptionSell = isOption && side === 'SELL';
    
    const price = req.body.price || 0;
    const lotSize = req.body.lotSize || TradingService.getLotSize(symbol, category, req.body.exchange);
    // Use quantity directly if provided (for quantity mode), otherwise calculate from lots * lotSize
    const quantity = req.body.quantity || (lots * lotSize);
    const tradeValue = price * quantity;
    
    // Calculate effective lots from quantity (for quantity mode support)
    const effectiveLots = lotSize > 0 ? Math.ceil(quantity / lotSize) : lots;
    
    // Priority 1: Check for fixed margin in script settings
    if (scriptSettings?.fixedMargin) {
      let fixedMarginPerLot = 0;
      if (isOptionBuy) {
        fixedMarginPerLot = isIntraday ? scriptSettings.fixedMargin.optionBuyIntraday : scriptSettings.fixedMargin.optionBuyCarry;
      } else if (isOptionSell) {
        fixedMarginPerLot = isIntraday ? scriptSettings.fixedMargin.optionSellIntraday : scriptSettings.fixedMargin.optionSellCarry;
      } else {
        fixedMarginPerLot = isIntraday ? scriptSettings.fixedMargin.intradayFuture : scriptSettings.fixedMargin.carryFuture;
      }
      
      if (fixedMarginPerLot > 0) {
        // Use quantity-based calculation: margin per unit * quantity
        // For fixed margin per lot, calculate proportionally based on quantity
        marginRequired = (fixedMarginPerLot / lotSize) * quantity;
        usedFixedMargin = true;
        marginSource = 'script_fixed';
      }
    }
    
    // Priority 2: Use segment exposure if no fixed margin
    // Exposure formula: margin = tradeValue / exposure
    if (!usedFixedMargin && segmentSettings) {
      const exposure = isIntraday 
        ? (segmentSettings.exposureIntraday || 1) 
        : (segmentSettings.exposureCarryForward || 1);
      
      if (exposure > 0) {
        marginRequired = tradeValue / exposure;
        marginSource = 'segment_exposure';
        console.log('Margin from exposure:', { tradeValue, exposure, marginRequired, isIntraday });
      }
    }
    
    // Priority 3: Fall back to default calculated margin
    const marginCalc = TradingService.calculateMargin(req.body, req.user, leverage);
    if (marginRequired === 0) {
      marginRequired = marginCalc.marginRequired;
      marginSource = 'default_calculated';
    }
    
    // Apply leverage to margin (divide margin by leverage)
    // This applies to all margin sources - fixed, exposure, or calculated
    if (leverage > 1 && marginSource !== 'default_calculated') {
      // default_calculated already has leverage applied in calculateMargin
      marginRequired = marginRequired / leverage;
      console.log('Applied leverage to margin:', { leverage, marginRequired });
    }
    
    // Calculate brokerage from user settings
    const brokerage = TradeService.calculateUserBrokerage(segmentSettings, scriptSettings, req.body, lots);
    
    // Calculate spread from user settings
    const spread = TradeService.calculateUserSpread(scriptSettings, side);
    
    // Use tradingBalance for trading (not cashBalance which is main wallet)
    const tradingBalance = req.user.wallet?.tradingBalance || 0;
    const blockedMargin = req.user.wallet?.usedMargin || req.user.wallet?.blocked || 0;
    const availableBalance = tradingBalance - blockedMargin;
    
    // Get lot limits from settings
    const maxLots = scriptSettings?.lotSettings?.maxLots || segmentSettings?.maxLots || 50;
    const minLots = scriptSettings?.lotSettings?.minLots || segmentSettings?.minLots || 1;
    
    // Check if lots exceed limit
    const lotsValid = lots >= minLots && lots <= maxLots;
    
    // Get commission from segment settings
    const commission = segmentSettings?.commissionLot || segmentSettings?.commission || 0;
    const perOrderLots = scriptSettings?.lotSettings?.orderLots || segmentSettings?.orderLots || maxLots;
    
    res.json({
      marginRequired: Math.round(marginRequired * 100) / 100,
      tradeValue: Math.round(tradeValue * 100) / 100,
      effectiveMargin: marginCalc.effectiveMargin,
      leverage: marginCalc.leverage,
      canPlace: lotsValid && (marginRequired + brokerage) <= availableBalance,
      availableBalance,
      tradingBalance,
      usedFixedMargin,
      marginSource,
      brokerage: Math.round(brokerage * 100) / 100,
      commission: Math.round(commission * 100) / 100,
      spread,
      maxLots,
      minLots,
      perOrderLots,
      lotsValid,
      lotsError: !lotsValid ? `Lots must be between ${minLots} and ${maxLots}` : null,
      shortfall: (marginRequired + brokerage) > availableBalance ? (marginRequired + brokerage) - availableBalance : 0,
      // Include segment settings for info display
      exposureIntraday: segmentSettings?.exposureIntraday || null,
      exposureCarryForward: segmentSettings?.exposureCarryForward || null
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get market status
router.get('/market-status', async (req, res) => {
  try {
    const exchange = req.query.exchange || 'NSE';
    const status = await TradingService.getMarketStatus(exchange);
    res.json(status);
  } catch (error) {
    console.error('Error getting market status:', error);
    res.json({ open: true, reason: 'Unable to check market status' });
  }
});

// Get available leverages for user (separate intraday and carryforward)
router.get('/leverages', protect, async (req, res) => {
  try {
    const result = await TradingService.getAvailableLeverages(req.user);
    // result contains: { intraday: [...], carryForward: [...], leverages: [...] }
    res.json({
      intraday: result.intraday || [1, 2, 5, 10],
      carryForward: result.carryForward || [1, 2, 5],
      leverages: result.leverages || result // backward compatibility
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get pending orders
router.get('/pending-orders', protect, async (req, res) => {
  try {
    const orders = await TradingService.getPendingOrders(req.user._id);
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Cancel pending order (DELETE alias for mobile/client compatibility)
router.delete('/pending-orders/:id', protect, async (req, res) => {
  try {
    const result = await TradingService.cancelOrder(req.params.id, req.user._id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get trade history
router.get('/history', protect, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const trades = await TradingService.getTradeHistory(req.user._id, limit);
    res.json(trades);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Close position (alias for squareoff)
router.post('/close/:id', protect, async (req, res) => {
  try {
    const { exitPrice, bidPrice, askPrice } = req.body;
    // Indian Net Trading: Use bid price for closing BUY, ask price for closing SELL
    const result = await TradingService.squareOffPosition(
      req.params.id, 
      'MANUAL', 
      exitPrice,
      bidPrice,
      askPrice
    );
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Cancel pending order (alias)
router.post('/cancel/:id', protect, async (req, res) => {
  try {
    const result = await TradingService.cancelOrder(req.params.id, req.user._id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Cancel pending order
router.post('/orders/:id/cancel', protect, async (req, res) => {
  try {
    const result = await TradingService.cancelOrder(req.params.id, req.user._id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update P&L for all trades (called by price tick)
router.post('/update-pnl', protect, async (req, res) => {
  try {
    const { priceUpdates } = req.body;
    const result = await TradingService.updateTradesPnL(priceUpdates);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Process pending orders (check if any should execute)
router.post('/process-pending', protect, async (req, res) => {
  try {
    const { priceUpdates } = req.body;
    const result = await TradingService.processPendingOrders(priceUpdates);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Recalculate and sync margin - fixes stale margin when positions are closed
router.post('/recalculate-margin', protect, async (req, res) => {
  try {
    const result = await TradingService.recalculateMargin(req.user._id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get lot size for symbol
router.get('/lot-size/:symbol', (req, res) => {
  const { category, exchange } = req.query;
  const lotSize = TradingService.getLotSize(req.params.symbol, category, exchange);
  res.json({ symbol: req.params.symbol, lotSize, category, exchange });
});

// ==================== ADMIN CHARGE SETTINGS ====================

// Admin auth middleware
const protectAdmin = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Not authorized' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = await Admin.findById(decoded.id).select('-password');
    if (!req.admin) return res.status(401).json({ message: 'Admin not found' });
    
    next();
  } catch (error) {
    res.status(401).json({ message: 'Not authorized' });
  }
};

// Get charge settings
router.get('/admin/charge-settings', protectAdmin, async (req, res) => {
  try {
    const admin = req.admin;
    const chargeSettings = admin.chargeSettings || { 
      spread: 0, 
      commission: 0,
      commissionType: 'PER_LOT',
      perLotCharge: 0,
      perTradeCharge: 0,
      perCroreCharge: 0
    };
    res.json(chargeSettings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Save charge settings
router.post('/admin/charge-settings', protectAdmin, async (req, res) => {
  try {
    const { spread, commissionType, perLotCharge, perTradeCharge, perCroreCharge } = req.body;
    const admin = req.admin;
    
    admin.chargeSettings = {
      spread: spread || 0,
      commission: perLotCharge || 0, // Keep backward compatibility
      commissionType: commissionType || 'PER_LOT',
      perLotCharge: perLotCharge || 0,
      perTradeCharge: perTradeCharge || 0,
      perCroreCharge: perCroreCharge || 0
    };
    await admin.save();
    
    res.json({ message: 'Charge settings saved', chargeSettings: admin.chargeSettings });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
