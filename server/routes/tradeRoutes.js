import express from 'express';
import Trade from '../models/Trade.js';
import MarketState from '../models/MarketState.js';
import Charges from '../models/Charges.js';
import TradeService from '../services/tradeService.js';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Admin from '../models/Admin.js';
import WalletLedger from '../models/WalletLedger.js';

const router = express.Router();

// Socket.IO instance (set from index.js)
let io = null;
export const setTradeSocketIO = (socketIO) => {
  io = socketIO;
};

// Auth middleware for users
const protectUser = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Not authorized' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    
    if (!req.user) return res.status(401).json({ message: 'User not found' });
    if (!req.user.isActive) return res.status(401).json({ message: 'Account is deactivated' });
    if (req.user.tradingStatus === 'BLOCKED') return res.status(401).json({ message: 'Trading is blocked' });
    
    next();
  } catch (error) {
    res.status(401).json({ message: 'Not authorized' });
  }
};

// Auth middleware for admins
const protectAdmin = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Not authorized' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = await Admin.findById(decoded.id).select('-password');
    
    if (!req.admin) return res.status(401).json({ message: 'Admin not found' });
    if (req.admin.status !== 'ACTIVE') return res.status(401).json({ message: 'Account suspended' });
    
    next();
  } catch (error) {
    res.status(401).json({ message: 'Not authorized' });
  }
};

// Super Admin only
const superAdminOnly = (req, res, next) => {
  if (req.admin.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ message: 'Super Admin access required' });
  }
  next();
};

// ==================== MARKET STATE ROUTES ====================

// Get market state
router.get('/market-state', async (req, res) => {
  try {
    const state = await MarketState.getState();
    res.json(state);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update market state (Super Admin only)
router.put('/market-state', protectAdmin, superAdminOnly, async (req, res) => {
  try {
    const { isMarketOpen, closedMessage } = req.body;
    const state = await MarketState.setMarketStatus(isMarketOpen, req.admin._id);
    
    if (closedMessage) {
      state.closedMessage = closedMessage;
      await state.save();
    }
    
    res.json(state);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update segment timings (Super Admin only)
router.put('/market-state/segment/:segment', protectAdmin, superAdminOnly, async (req, res) => {
  try {
    const { segment } = req.params;
    const { isOpen, dataStartTime, tradingStartTime, tradingEndTime, dataEndTime, intradaySquareOffTime, preMarketDataOnly, closedDays } = req.body;
    
    const validSegments = ['EQUITY', 'FNO', 'MCX', 'CRYPTO'];
    if (!validSegments.includes(segment)) {
      return res.status(400).json({ message: 'Invalid segment' });
    }
    
    const state = await MarketState.getState();
    
    // Update segment settings
    if (isOpen !== undefined) state.segments[segment].isOpen = isOpen;
    if (dataStartTime) state.segments[segment].dataStartTime = dataStartTime;
    if (tradingStartTime) state.segments[segment].tradingStartTime = tradingStartTime;
    if (tradingEndTime) state.segments[segment].tradingEndTime = tradingEndTime;
    if (dataEndTime) state.segments[segment].dataEndTime = dataEndTime;
    if (intradaySquareOffTime) state.segments[segment].intradaySquareOffTime = intradaySquareOffTime;
    if (preMarketDataOnly !== undefined) state.segments[segment].preMarketDataOnly = preMarketDataOnly;
    if (closedDays !== undefined) state.segments[segment].closedDays = closedDays;
    
    state.lastUpdatedAt = new Date();
    state.updatedBy = req.admin._id;
    await state.save();
    
    res.json(state);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Toggle segment status (Super Admin only)
router.put('/market-state/segment/:segment/toggle', protectAdmin, superAdminOnly, async (req, res) => {
  try {
    const { segment } = req.params;
    
    const validSegments = ['EQUITY', 'FNO', 'MCX', 'CRYPTO'];
    if (!validSegments.includes(segment)) {
      return res.status(400).json({ message: 'Invalid segment' });
    }
    
    const state = await MarketState.getState();
    state.segments[segment].isOpen = !state.segments[segment].isOpen;
    state.lastUpdatedAt = new Date();
    state.updatedBy = req.admin._id;
    await state.save();
    
    res.json(state);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Check if trading is allowed for a segment
router.get('/market-state/trading-status/:segment', async (req, res) => {
  try {
    const { segment } = req.params;
    const result = await MarketState.isTradingAllowed(segment);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ==================== USER TRADING ROUTES ====================

// Place a new trade
router.post('/trade', protectUser, async (req, res) => {
  try {
    // Check if user is in read-only mode
    if (req.user.isReadOnly) {
      return res.status(403).json({ message: 'Your account is in read-only mode. You can only view and close existing trades.' });
    }
    
    const trade = await TradeService.openTrade(req.body, req.user._id);
    
    // Emit socket event for real-time admin updates
    if (io) {
      io.emit('trade_update', { type: 'NEW_TRADE', trade, adminCode: trade.adminCode });
    }
    
    res.status(201).json(trade);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Close a trade
router.post('/trade/:id/close', protectUser, async (req, res) => {
  try {
    const { exitPrice } = req.body;
    
    // Verify trade belongs to user
    const trade = await Trade.findOne({ _id: req.params.id, user: req.user._id });
    if (!trade) return res.status(404).json({ message: 'Trade not found' });
    
    const closedTrade = await TradeService.closeTrade(trade._id, exitPrice, 'MANUAL');
    
    // Emit socket event for real-time admin updates
    if (io) {
      io.emit('trade_update', { type: 'TRADE_CLOSED', trade: closedTrade, adminCode: closedTrade.adminCode });
    }
    
    res.json(closedTrade);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get open positions
router.get('/positions/open', protectUser, async (req, res) => {
  try {
    const positions = await TradeService.getOpenPositions(req.user._id);
    res.json(positions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get closed positions
router.get('/positions/closed', protectUser, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const positions = await TradeService.getClosedPositions(req.user._id, limit);
    res.json(positions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get trade summary
router.get('/summary', protectUser, async (req, res) => {
  try {
    const summary = await TradeService.getUserTradeSummary(req.user._id);
    res.json(summary);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get trade history (all trades - open and closed)
router.get('/history', protectUser, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const trades = await Trade.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    res.json(trades);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get margin preview
router.post('/margin-preview', protectUser, async (req, res) => {
  try {
    const { segment, instrumentType, productType, side, quantity, price, lotSize = 1 } = req.body;
    
    const admin = await Admin.findOne({ adminCode: req.user.adminCode });
    
    let leverage = 1;
    if (productType === 'MIS') {
      if (segment === 'EQUITY') {
        leverage = admin?.charges?.intradayLeverage || 5;
      } else if (instrumentType === 'FUTURES') {
        leverage = admin?.charges?.futuresLeverage || 1;
      } else if (instrumentType === 'OPTIONS') {
        leverage = side === 'BUY' 
          ? admin?.charges?.optionBuyLeverage || 1
          : admin?.charges?.optionSellLeverage || 1;
      }
    }
    
    const requiredMargin = TradeService.calculateMargin(price, quantity, lotSize, leverage, productType);
    const availableMargin = req.user.wallet.cashBalance - req.user.wallet.usedMargin + req.user.wallet.collateralValue;
    
    res.json({
      requiredMargin,
      availableMargin,
      leverage,
      canTrade: availableMargin >= requiredMargin
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ==================== ADMIN TRADING ROUTES ====================

// Get all trades for admin's users
router.get('/admin/trades', protectAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    let query = {};
    
    if (req.admin.role !== 'SUPER_ADMIN') {
      query.adminCode = req.admin.adminCode;
    }
    if (status) query.status = status;
    
    const trades = await Trade.find(query)
      .populate('user', 'username fullName userId email')
      .sort({ openedAt: -1 })
      .limit(200);
    
    res.json(trades);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Super Admin: Get all trades across all admins with optional admin filter
router.get('/admin/all-trades', protectAdmin, async (req, res) => {
  try {
    // Only Super Admin can access this
    if (req.admin.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Access denied. Super Admin only.' });
    }
    
    const { status, adminCode } = req.query;
    let query = {};
    
    if (adminCode) query.adminCode = adminCode;
    if (status) query.status = status;
    
    const trades = await Trade.find(query)
      .populate('user', 'username fullName userId email')
      .sort({ openedAt: -1 })
      .limit(500);
    
    res.json(trades);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin create trade for a user
router.post('/admin/create-trade', protectAdmin, async (req, res) => {
  try {
    const { userId, symbol, instrumentToken, segment, side, productType, quantity, entryPrice, tradeDate, tradeTime } = req.body;
    
    // Find the user
    let userQuery = { _id: userId };
    if (req.admin.role !== 'SUPER_ADMIN') {
      userQuery.adminCode = req.admin.adminCode;
    }
    
    const user = await User.findOne(userQuery);
    if (!user) return res.status(404).json({ message: 'User not found or not under your management' });
    
    // Get admin charges
    const adminCharges = req.admin.charges || {};
    const brokerage = adminCharges.brokerage || 20;
    
    // Calculate trade value
    const tradeValue = quantity * entryPrice;
    const lotSize = 1; // Default lot size
    
    // Create trade timestamp
    let tradeTimestamp = new Date();
    if (tradeDate) {
      const [year, month, day] = tradeDate.split('-');
      const [hours, minutes] = (tradeTime || '09:15').split(':');
      tradeTimestamp = new Date(year, month - 1, day, hours, minutes);
    }
    
    // Normalize segment to valid schema enums
    const allowedSegments = ['EQUITY', 'FNO', 'MCX', 'COMMODITY', 'CRYPTO', 'CURRENCY'];
    const segRaw = (segment || 'EQUITY').toUpperCase();
    const segMap = {
      'NSE F&O': 'FNO',
      'NFO': 'FNO',
      'NSEFO': 'FNO',
      'NSE_FO': 'FNO',
      'F&O': 'FNO',
      'BSE F&O': 'FNO',
      'BFO': 'FNO',
      'BSEFO': 'FNO',
      'BSE_FO': 'FNO',
      'NSE': 'EQUITY'
    };
    const segNormalized = segMap[segRaw] || (allowedSegments.includes(segRaw) ? segRaw : 'EQUITY');

    // Determine exchange and instrumentType from normalized segment
    let exchange = 'NSE';
    let instrumentType = 'STOCK';
    
    if (segNormalized === 'EQUITY') {
      exchange = 'NSE';
      instrumentType = 'STOCK';
    } else if (segNormalized === 'FNO') {
      exchange = 'NFO';
      instrumentType = 'FUTURES';
    } else if (segNormalized === 'MCX') {
      exchange = 'MCX';
      instrumentType = 'FUTURES';
    } else if (segNormalized === 'COMMODITY') {
      exchange = 'MCX';
      instrumentType = 'FUTURES';
    } else if (segNormalized === 'CURRENCY') {
      exchange = 'CDS';
      instrumentType = 'CURRENCY';
    } else if (segNormalized === 'CRYPTO') {
      exchange = 'CRYPTO';
      instrumentType = 'CRYPTO';
    }
    
    // Create the trade
    const trade = await Trade.create({
      user: user._id,
      userId: user.userId,
      adminCode: user.adminCode,
      symbol,
      token: instrumentToken || symbol,
      segment: segNormalized,
      exchange,
      instrumentType,
      side,
      productType: productType || 'INTRADAY',
      orderType: 'MARKET',
      quantity,
      lotSize,
      entryPrice,
      currentPrice: entryPrice,
      status: 'OPEN',
      charges: {
        brokerage,
        stt: 0,
        transactionCharges: 0,
        gst: 0,
        sebiCharges: 0,
        stampDuty: 0,
        total: brokerage
      },
      unrealizedPnL: 0,
      openedAt: tradeTimestamp,
      createdBy: 'ADMIN',
      adminCreated: true
    });
    
    res.status(201).json(trade);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Force close a trade (Admin)
router.post('/admin/trade/:id/close', protectAdmin, async (req, res) => {
  try {
    const { exitPrice } = req.body;
    
    let query = { _id: req.params.id };
    if (req.admin.role !== 'SUPER_ADMIN') {
      query.adminCode = req.admin.adminCode;
    }
    
    const trade = await Trade.findOne(query);
    if (!trade) return res.status(404).json({ message: 'Trade not found' });
    
    const closedTrade = await TradeService.closeTrade(trade._id, exitPrice, 'ADMIN');
    res.json(closedTrade);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete a trade (Admin/Super Admin)
router.delete('/admin/trade/:id', protectAdmin, async (req, res) => {
  try {
    let query = { _id: req.params.id };
    if (req.admin.role !== 'SUPER_ADMIN') {
      query.adminCode = req.admin.adminCode;
    }
    
    const trade = await Trade.findOne(query);
    if (!trade) return res.status(404).json({ message: 'Trade not found' });
    
    // Get user to reverse wallet changes
    const user = await User.findById(trade.user);
    if (user) {
      if (trade.status === 'OPEN') {
        // For open trades: Release the blocked margin back to user
        const marginToRelease = trade.marginUsed || 0;
        
        if (trade.isCrypto) {
          // Crypto trades don't have margin, nothing to release
        } else {
          // Regular trade: Release margin
          const newUsedMargin = Math.max(0, (user.wallet.usedMargin || 0) - marginToRelease);
          const newBlocked = Math.max(0, (user.wallet.blocked || 0) - marginToRelease);
          const newTradingBalance = (user.wallet.tradingBalance || 0) + marginToRelease;
          
          await User.updateOne(
            { _id: user._id },
            { 
              $set: { 
                'wallet.usedMargin': newUsedMargin,
                'wallet.blocked': newBlocked,
                'wallet.tradingBalance': newTradingBalance
              } 
            }
          );
        }
      } else if (trade.status === 'CLOSED') {
        // For closed trades: Reverse the realized P&L
        const pnlToReverse = trade.netPnL || 0;
        
        if (trade.isCrypto) {
          // Crypto trade: Reverse P&L from crypto wallet
          const newCryptoBalance = Math.max(0, (user.cryptoWallet?.balance || 0) - pnlToReverse);
          const newCryptoRealizedPnL = (user.cryptoWallet?.realizedPnL || 0) - pnlToReverse;
          
          await User.updateOne(
            { _id: user._id },
            { 
              $set: { 
                'cryptoWallet.balance': newCryptoBalance,
                'cryptoWallet.realizedPnL': newCryptoRealizedPnL
              } 
            }
          );
        } else {
          // Regular trade: Reverse P&L from wallet
          const newCashBalance = Math.max(0, (user.wallet.cashBalance || 0) - pnlToReverse);
          const newRealizedPnL = (user.wallet.realizedPnL || 0) - pnlToReverse;
          
          await User.updateOne(
            { _id: user._id },
            { 
              $set: { 
                'wallet.cashBalance': newCashBalance,
                'wallet.realizedPnL': newRealizedPnL
              } 
            }
          );
        }
      }
    }
    
    // Delete all wallet ledger entries related to this trade
    await WalletLedger.deleteMany({ 
      'reference.type': 'Trade', 
      'reference.id': trade._id 
    });
    
    await Trade.findByIdAndDelete(req.params.id);
    
    // Emit socket event to notify all clients about the trade deletion
    if (io) {
      io.emit('trade_update', { type: 'TRADE_DELETED', tradeId: req.params.id, userId: trade.user });
    }
    
    res.json({ message: 'Trade deleted successfully' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Edit/Update a trade (Admin/Super Admin)
router.put('/admin/trade/:id', protectAdmin, async (req, res) => {
  try {
    let query = { _id: req.params.id };
    if (req.admin.role !== 'SUPER_ADMIN') {
      query.adminCode = req.admin.adminCode;
    }
    
    const trade = await Trade.findOne(query);
    if (!trade) return res.status(404).json({ message: 'Trade not found' });
    
    const { quantity, entryPrice, exitPrice } = req.body;
    
    // Update fields
    if (quantity !== undefined) trade.quantity = quantity;
    if (entryPrice !== undefined) trade.entryPrice = entryPrice;
    
    // Recalculate PNL
    if (trade.status === 'OPEN') {
      const multiplier = trade.side === 'BUY' ? 1 : -1;
      const currentPrice = trade.currentPrice || trade.entryPrice;
      trade.unrealizedPnL = (currentPrice - trade.entryPrice) * multiplier * trade.quantity * (trade.lotSize || 1);
    } else if (trade.status === 'CLOSED') {
      if (exitPrice !== undefined) trade.exitPrice = exitPrice;
      const multiplier = trade.side === 'BUY' ? 1 : -1;
      const grossPnL = (trade.exitPrice - trade.entryPrice) * multiplier * trade.quantity * (trade.lotSize || 1);
      trade.realizedPnL = grossPnL;
      trade.pnl = grossPnL;
      trade.netPnL = grossPnL - (trade.charges?.total || 0);
      trade.adminPnL = trade.bookType === 'B_BOOK' ? -trade.netPnL : 0;
    }
    
    await trade.save();
    res.json(trade);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Reopen a closed trade (Admin/Super Admin)
router.post('/admin/trade/:id/reopen', protectAdmin, async (req, res) => {
  try {
    let query = { _id: req.params.id };
    if (req.admin.role !== 'SUPER_ADMIN') {
      query.adminCode = req.admin.adminCode;
    }
    
    const trade = await Trade.findOne(query);
    if (!trade) return res.status(404).json({ message: 'Trade not found' });
    if (trade.status !== 'CLOSED') return res.status(400).json({ message: 'Trade is not closed' });
    
    // Get user to reverse wallet changes
    const user = await User.findById(trade.user);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    // Store the P&L that was added when trade was closed (to reverse it)
    const pnlToReverse = trade.netPnL || 0;
    const marginToBlock = trade.marginUsed || 0;
    
    // Reverse wallet changes based on trade type
    if (trade.isCrypto) {
      // Crypto trade: Reverse P&L from crypto wallet
      const newCryptoBalance = Math.max(0, (user.cryptoWallet?.balance || 0) - pnlToReverse);
      const newCryptoRealizedPnL = (user.cryptoWallet?.realizedPnL || 0) - pnlToReverse;
      
      await User.updateOne(
        { _id: user._id },
        { 
          $set: { 
            'cryptoWallet.balance': newCryptoBalance,
            'cryptoWallet.realizedPnL': newCryptoRealizedPnL
          } 
        }
      );
    } else {
      // Regular trade: Reverse P&L and re-block margin
      const newTradingBalance = Math.max(0, (user.wallet.tradingBalance || 0) - marginToBlock - pnlToReverse);
      const newUsedMargin = (user.wallet.usedMargin || 0) + marginToBlock;
      const newBlocked = (user.wallet.blocked || 0) + marginToBlock;
      const newRealizedPnL = (user.wallet.realizedPnL || 0) - pnlToReverse;
      
      await User.updateOne(
        { _id: user._id },
        { 
          $set: { 
            'wallet.tradingBalance': newTradingBalance,
            'wallet.usedMargin': newUsedMargin,
            'wallet.blocked': newBlocked,
            'wallet.realizedPnL': newRealizedPnL
          } 
        }
      );
    }
    
    // Reset trade to open state
    trade.status = 'OPEN';
    trade.exitPrice = null;
    trade.effectiveExitPrice = null;
    trade.closedAt = null;
    trade.closeReason = null;
    trade.realizedPnL = 0;
    trade.pnl = 0;
    trade.netPnL = 0;
    trade.adminPnL = 0;
    
    // Recalculate unrealized PNL based on entry price (current price will be updated by market data)
    trade.unrealizedPnL = 0;
    trade.currentPrice = trade.entryPrice;
    
    await trade.save();
    res.json(trade);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Run RMS check manually (Admin)
router.post('/admin/rms-check', protectAdmin, async (req, res) => {
  try {
    const squaredOff = await TradeService.runRMSCheck();
    res.json({ 
      message: `RMS check completed. ${squaredOff.length} trades squared off.`,
      trades: squaredOff 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Run intraday square-off (Admin) - Legacy, kept for manual square-off
router.post('/admin/intraday-squareoff', protectAdmin, async (req, res) => {
  try {
    const { segment = 'EQUITY' } = req.body;
    const squaredOff = await TradeService.runIntradaySquareOff(segment);
    res.json({ 
      message: `Intraday square-off completed. ${squaredOff.length} trades closed.`,
      trades: squaredOff 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Convert intraday to carry forward (Admin) - New method
router.post('/admin/intraday-to-carryforward', protectAdmin, async (req, res) => {
  try {
    const { segment = 'EQUITY' } = req.body;
    const result = await TradeService.runIntradayToCarryForward(segment);
    
    const totalConverted = result.convertedTrades.length;
    const totalPartial = result.partiallyConvertedTrades.length;
    const totalFailed = result.failedTrades.length;
    
    res.json({ 
      message: `Intraday to Carry Forward conversion completed. ${totalConverted} fully converted, ${totalPartial} partially converted, ${totalFailed} failed.`,
      convertedTrades: result.convertedTrades,
      partiallyConvertedTrades: result.partiallyConvertedTrades,
      failedTrades: result.failedTrades
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get admin trading P&L summary
router.get('/admin/pnl-summary', protectAdmin, async (req, res) => {
  try {
    let query = {};
    if (req.admin.role !== 'SUPER_ADMIN') {
      query.adminCode = req.admin.adminCode;
    }
    
    const openTrades = await Trade.find({ ...query, status: 'OPEN' });
    const todayTrades = await Trade.find({
      ...query,
      status: 'CLOSED',
      closedAt: { $gte: new Date().setHours(0, 0, 0, 0) }
    });
    
    const totalUnrealizedPnL = openTrades.reduce((sum, t) => sum + t.unrealizedPnL, 0);
    const todayRealizedPnL = todayTrades.reduce((sum, t) => sum + t.netPnL, 0);
    const todayBrokerage = todayTrades.reduce((sum, t) => sum + t.charges.brokerage, 0);
    const todayAdminPnL = todayTrades.reduce((sum, t) => sum + t.adminPnL, 0);
    
    res.json({
      openPositions: openTrades.length,
      todayTrades: todayTrades.length,
      totalUnrealizedPnL,
      todayRealizedPnL,
      todayBrokerage,
      todayAdminPnL,
      adminTradingPnL: req.admin.tradingPnL
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ==================== CHARGES ROUTES ====================

// Get charges configuration with filtering
router.get('/admin/charges', protectAdmin, async (req, res) => {
  try {
    const { scope, segment, instrumentType, symbol } = req.query;
    let query = { isActive: true };
    
    // Filter by scope if provided
    if (scope) query.scope = scope;
    if (segment) query.segment = segment;
    if (instrumentType) query.instrumentType = instrumentType;
    if (symbol) query.symbol = symbol;
    
    // Non-super admins can only see global and their own charges
    if (req.admin.role !== 'SUPER_ADMIN') {
      query.$or = [
        { scope: 'GLOBAL' },
        { adminCode: req.admin.adminCode }
      ];
    }
    
    const charges = await Charges.find(query).lean();
    res.json(charges);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create/Update charges - supports segment, user, instrument, symbol level
router.post('/admin/charges', protectAdmin, async (req, res) => {
  try {
    const { scope, segment, instrumentType, symbol, userId, brokerage, ...otherCharges } = req.body;
    
    // Only Super Admin can set GLOBAL charges
    if (scope === 'GLOBAL' && req.admin.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Only Super Admin can set global charges' });
    }
    
    const adminCode = req.admin.role === 'SUPER_ADMIN' ? (req.body.adminCode || req.admin.adminCode) : req.admin.adminCode;
    
    const chargeData = {
      scope,
      adminCode,
      segment: segment || null,
      instrumentType: instrumentType || null,
      symbol: symbol || null,
      userId: userId || null,
      brokerage,
      isActive: true,
      ...otherCharges
    };
    
    // Build filter for upsert based on scope
    const filter = { scope };
    switch (scope) {
      case 'GLOBAL':
        // Only one global config
        break;
      case 'ADMIN':
        filter.adminCode = adminCode;
        break;
      case 'SEGMENT':
        filter.adminCode = adminCode;
        filter.segment = segment;
        break;
      case 'INSTRUMENT':
        filter.adminCode = adminCode;
        filter.segment = segment;
        filter.instrumentType = instrumentType;
        if (symbol) filter.symbol = symbol; // Symbol-specific
        break;
      case 'USER':
        filter.userId = userId;
        break;
    }
    
    const charges = await Charges.findOneAndUpdate(filter, chargeData, { upsert: true, new: true });
    res.json({ message: 'Charges saved successfully', charges });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Bulk update charges for multiple segments/instruments
router.post('/admin/charges/bulk', protectAdmin, async (req, res) => {
  try {
    const { charges } = req.body; // Array of charge configs
    
    if (!Array.isArray(charges)) {
      return res.status(400).json({ message: 'charges must be an array' });
    }
    
    const adminCode = req.admin.adminCode;
    const results = [];
    
    for (const chargeConfig of charges) {
      const { scope, segment, instrumentType, symbol, brokerage, ...otherCharges } = chargeConfig;
      
      // Skip global for non-super admins
      if (scope === 'GLOBAL' && req.admin.role !== 'SUPER_ADMIN') continue;
      
      const filter = { scope, adminCode };
      if (segment) filter.segment = segment;
      if (instrumentType) filter.instrumentType = instrumentType;
      if (symbol) filter.symbol = symbol;
      
      const result = await Charges.findOneAndUpdate(
        filter,
        { ...chargeConfig, adminCode, isActive: true },
        { upsert: true, new: true }
      );
      results.push(result);
    }
    
    res.json({ message: `${results.length} charge configs saved`, charges: results });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete charge configuration
router.delete('/admin/charges/:id', protectAdmin, async (req, res) => {
  try {
    const charge = await Charges.findById(req.params.id);
    if (!charge) {
      return res.status(404).json({ message: 'Charge configuration not found' });
    }
    
    // Only Super Admin can delete GLOBAL charges
    if (charge.scope === 'GLOBAL' && req.admin.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Only Super Admin can delete global charges' });
    }
    
    // Regular admins can only delete their own charges
    if (req.admin.role !== 'SUPER_ADMIN' && charge.adminCode !== req.admin.adminCode) {
      return res.status(403).json({ message: 'You can only delete your own charge configurations' });
    }
    
    await Charges.findByIdAndDelete(req.params.id);
    res.json({ message: 'Charge configuration deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
