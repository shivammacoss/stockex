import Trade from '../models/Trade.js';
import User from '../models/User.js';
import Admin from '../models/Admin.js';
import MarketState from '../models/MarketState.js';
import Charges from '../models/Charges.js';
import WalletLedger from '../models/WalletLedger.js';
import Instrument from '../models/Instrument.js';

class TradeService {
  
  // Check if market is open for trading
  static async checkMarketOpen(segment = 'EQUITY') {
    const isOpen = await MarketState.isTradingAllowed(segment);
    if (!isOpen) {
      throw new Error('Market is closed. Trading disabled.');
    }
    return true;
  }
  
  // Calculate required margin for a trade
  static calculateMargin(price, quantity, lotSize, leverage, productType) {
    const notionalValue = price * quantity * lotSize;
    
    if (productType === 'CNC') {
      return notionalValue; // Full amount for delivery
    }
    
    return notionalValue / leverage;
  }
  
  // Validate if user has sufficient margin
  static async validateMargin(userId, requiredMargin) {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');
    
    const availableMargin = user.wallet.cashBalance - user.wallet.usedMargin + user.wallet.collateralValue;
    
    if (availableMargin < requiredMargin) {
      throw new Error(`Insufficient margin. Required: ₹${requiredMargin.toFixed(2)}, Available: ₹${availableMargin.toFixed(2)}`);
    }
    
    return { user, availableMargin };
  }
  
  // Get user's segment settings for a trade
  static getUserSegmentSettings(user, segment, instrumentType) {
    // Map trade segment/displaySegment to Market Watch segment permission key
    // Market Watch segments: NSEFUT, NSEOPT, MCXFUT, MCXOPT, NSE-EQ, BSE-FUT, BSE-OPT
    const segmentUpper = segment?.toUpperCase() || '';
    const isOptions = instrumentType === 'OPTIONS' || instrumentType === 'OPT';
    
    let segmentKey = segment; // Default to passed segment
    
    // Direct matches for Market Watch segments
    const marketWatchSegments = ['NSEFUT', 'NSEOPT', 'MCXFUT', 'MCXOPT', 'NSE-EQ', 'BSE-FUT', 'BSE-OPT'];
    if (marketWatchSegments.includes(segmentUpper)) {
      segmentKey = segmentUpper;
    }
    // Map old segment names to new Market Watch segments
    else if (segmentUpper === 'EQUITY' || segmentUpper === 'EQ' || segmentUpper === 'NSE' || segmentUpper === 'NSEEQ') {
      segmentKey = 'NSE-EQ';
    } else if (segmentUpper === 'FNO' || segmentUpper === 'NFO' || segmentUpper === 'NSEINDEX' || segmentUpper === 'NSESTOCK') {
      segmentKey = isOptions ? 'NSEOPT' : 'NSEFUT';
    } else if (segmentUpper === 'MCX' || segmentUpper === 'COMMODITY') {
      segmentKey = isOptions ? 'MCXOPT' : 'MCXFUT';
    } else if (segmentUpper === 'BSE' || segmentUpper === 'BFO') {
      segmentKey = isOptions ? 'BSE-OPT' : 'BSE-FUT';
    } else if (segmentUpper === 'CURRENCY' || segmentUpper === 'CDS') {
      segmentKey = 'NSEFUT'; // Currency derivatives mapped to NSE futures
    } else if (segmentUpper === 'CRYPTO') {
      segmentKey = 'NSE-EQ'; // Crypto uses equity settings
    }
    
    // Handle Mongoose Map - convert to plain object first if needed
    let segmentPerms = user.segmentPermissions;
    if (segmentPerms && typeof segmentPerms.toObject === 'function') {
      segmentPerms = segmentPerms.toObject();
    }
    
    // Try to get segment permissions - check if it's a Map or Object
    let segmentPermissions = null;
    
    if (segmentPerms instanceof Map) {
      segmentPermissions = segmentPerms.get(segmentKey) || segmentPerms.get(segment?.toUpperCase());
    } else if (segmentPerms && typeof segmentPerms === 'object') {
      // It's a plain object (most likely from Mongoose)
      segmentPermissions = segmentPerms[segmentKey] || segmentPerms[segment?.toUpperCase()];
    }
    
    // Convert nested Map/Object if needed
    if (segmentPermissions && typeof segmentPermissions.toObject === 'function') {
      segmentPermissions = segmentPermissions.toObject();
    }
    
    console.log('Segment Settings Debug:', {
      segment, segmentKey,
      found: !!segmentPermissions,
      maxLots: segmentPermissions?.maxLots,
      commissionLot: segmentPermissions?.commissionLot,
      availableKeys: segmentPerms instanceof Map 
        ? Array.from(segmentPerms.keys())
        : Object.keys(segmentPerms || {})
    });
    
    return segmentPermissions || {
      enabled: true,
      maxExchangeLots: 100,
      commissionType: 'PER_LOT',
      commissionLot: 0,
      maxLots: 50,
      minLots: 1,
      orderLots: 10,
      exposureIntraday: 1,
      exposureCarryForward: 1,
      optionBuy: { allowed: true, commissionType: 'PER_LOT', commission: 0, strikeSelection: 50, maxExchangeLots: 100 },
      optionSell: { allowed: true, commissionType: 'PER_LOT', commission: 0, strikeSelection: 50, maxExchangeLots: 100 }
    };
  }
  
  // Get user's script-specific settings
  static getUserScriptSettings(user, symbol, category) {
    if (!user.scriptSettings) return null;
    
    // Handle Mongoose Map - convert to plain object first if needed
    let scriptPerms = user.scriptSettings;
    if (scriptPerms && typeof scriptPerms.toObject === 'function') {
      scriptPerms = scriptPerms.toObject();
    }
    
    // Try multiple lookup keys in order of priority
    const lookupKeys = [];
    
    // 1. Category (e.g., "COPPER", "GOLD") - most reliable for MCX
    if (category) {
      lookupKeys.push(category.toUpperCase());
      lookupKeys.push(category);
    }
    
    // 2. Symbol as-is (e.g., "COPPER", "NIFTY25JANFUT")
    if (symbol) {
      lookupKeys.push(symbol.toUpperCase());
      lookupKeys.push(symbol);
      
      // 3. Extract base symbol from F&O format
      const baseSymbol = symbol.replace(/\d+[A-Z]{3}\d*FUT$/i, '')
                               .replace(/\d+[A-Z]{3}\d+[CP]E$/i, '')
                               .replace(/\d+$/i, '');
      if (baseSymbol && baseSymbol !== symbol) {
        lookupKeys.push(baseSymbol.toUpperCase());
        lookupKeys.push(baseSymbol);
      }
    }
    
    // Try each key until we find settings
    const isMap = scriptPerms instanceof Map;
    for (const key of lookupKeys) {
      let settings = isMap ? scriptPerms.get(key) : scriptPerms[key];
      if (settings) {
        // Convert nested Map/Object if needed
        if (settings && typeof settings.toObject === 'function') {
          settings = settings.toObject();
        }
        console.log(`Script settings found for key: ${key}`, JSON.stringify(settings));
        return settings;
      }
    }
    
    console.log(`No script settings found. Using segment defaults. Tried keys: ${lookupKeys.join(', ')}`);
    return null;
  }
  
  // Calculate brokerage based on user settings with caps enforcement
  static calculateUserBrokerage(segmentSettings, scriptSettings, tradeData, lots, brokerageCaps = null) {
    let brokerage = 0;
    let commissionType = 'PER_LOT'; // Track commission type for cap enforcement
    const isIntraday = tradeData.productType === 'MIS' || tradeData.productType === 'INTRADAY';
    const isOption = tradeData.instrumentType === 'OPTIONS';
    const isOptionBuy = isOption && tradeData.side === 'BUY';
    const isOptionSell = isOption && tradeData.side === 'SELL';
    
    // Calculate turnover for PER_CRORE calculation
    const price = tradeData.price || tradeData.entryPrice || 0;
    const lotSize = tradeData.lotSize || 1;
    const turnover = price * lots * lotSize;
    
    // Helper to calculate brokerage based on commission type
    const calcBrokerage = (commType, commission) => {
      commissionType = commType; // Store for cap enforcement
      if (commType === 'PER_LOT') return commission * lots;
      if (commType === 'PER_TRADE') return commission;
      if (commType === 'PER_CRORE') return (turnover / 10000000) * commission; // Per crore = per 1 crore (10 million)
      return commission;
    };
    
    // First check script-specific settings
    if (scriptSettings?.brokerage) {
      commissionType = 'PER_LOT'; // Script settings are per lot
      if (isOptionBuy) {
        brokerage = isIntraday ? scriptSettings.brokerage.optionBuyIntraday : scriptSettings.brokerage.optionBuyCarry;
      } else if (isOptionSell) {
        brokerage = isIntraday ? scriptSettings.brokerage.optionSellIntraday : scriptSettings.brokerage.optionSellCarry;
      } else {
        brokerage = isIntraday ? scriptSettings.brokerage.intradayFuture : scriptSettings.brokerage.carryFuture;
      }
      brokerage = brokerage * lots;
    } else {
      // Fall back to segment settings
      if (isOptionBuy && segmentSettings?.optionBuy) {
        const commType = segmentSettings.optionBuy.commissionType || 'PER_LOT';
        const commission = segmentSettings.optionBuy.commission || 0;
        brokerage = calcBrokerage(commType, commission);
      } else if (isOptionSell && segmentSettings?.optionSell) {
        const commType = segmentSettings.optionSell.commissionType || 'PER_LOT';
        const commission = segmentSettings.optionSell.commission || 0;
        brokerage = calcBrokerage(commType, commission);
      } else {
        const commType = segmentSettings?.commissionType || 'PER_LOT';
        const commission = segmentSettings?.commissionLot || 0;
        brokerage = calcBrokerage(commType, commission);
      }
    }
    
    // Apply brokerage caps from parent admin if set
    if (brokerageCaps) {
      let minCap = 0;
      let maxCap = Infinity;
      
      // Get caps based on commission type
      if (commissionType === 'PER_LOT' && brokerageCaps.perLot) {
        // For per-lot, caps are per lot - so multiply by lots
        minCap = (brokerageCaps.perLot.min || 0) * lots;
        maxCap = (brokerageCaps.perLot.max || Infinity) * lots;
      } else if (commissionType === 'PER_CRORE' && brokerageCaps.perCrore) {
        // For per-crore, calculate min/max based on turnover
        const crores = turnover / 10000000;
        minCap = (brokerageCaps.perCrore.min || 0) * crores;
        maxCap = (brokerageCaps.perCrore.max || Infinity) * crores;
      } else if (commissionType === 'PER_TRADE' && brokerageCaps.perTrade) {
        // For per-trade, caps are flat per trade
        minCap = brokerageCaps.perTrade.min || 0;
        maxCap = brokerageCaps.perTrade.max || Infinity;
      }
      
      // Enforce caps: brokerage must be at least min and at most max
      if (brokerage < minCap) {
        brokerage = minCap;
      } else if (brokerage > maxCap) {
        brokerage = maxCap;
      }
    }
    
    return brokerage;
  }
  
  // Calculate spread based on user settings
  static calculateUserSpread(scriptSettings, side) {
    if (!scriptSettings?.spread) return 0;
    return side === 'BUY' ? (scriptSettings.spread.buy || 0) : (scriptSettings.spread.sell || 0);
  }
  
  // Open a new trade
  static async openTrade(tradeData, userId) {
    // 1. Check market status (CRYPTO is always open)
    await this.checkMarketOpen(tradeData.segment);
    
    // 2. Get user and admin
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');
    
    const admin = await Admin.findOne({ adminCode: user.adminCode });
    if (!admin) throw new Error('Admin not found');
    
    // 3. Get user's segment and script settings
    const segmentSettings = this.getUserSegmentSettings(user, tradeData.segment, tradeData.instrumentType);
    const scriptSettings = this.getUserScriptSettings(user, tradeData.symbol, tradeData.category);
    
    // 4. Validate segment is enabled for user
    if (!segmentSettings.enabled) {
      throw new Error(`Trading in ${tradeData.segment} segment is not enabled for your account`);
    }
    
    // 5. Check if script is blocked
    if (scriptSettings?.blocked) {
      throw new Error(`Trading in ${tradeData.symbol} is blocked for your account`);
    }
    
    // 6. Get leverage from admin charges
    let leverage = 1;
    const isCrypto = tradeData.segment === 'CRYPTO' || tradeData.isCrypto;
    
    if (tradeData.productType === 'MIS' || tradeData.productType === 'INTRADAY') {
      if (tradeData.segment === 'EQUITY') {
        leverage = admin.charges?.intradayLeverage || 5;
      } else if (tradeData.instrumentType === 'FUTURES') {
        leverage = admin.charges?.futuresLeverage || 1;
      } else if (tradeData.instrumentType === 'OPTIONS') {
        leverage = tradeData.side === 'BUY' 
          ? admin.charges?.optionBuyLeverage || 1
          : admin.charges?.optionSellLeverage || 1;
      } else if (isCrypto) {
        leverage = admin.charges?.cryptoLeverage || 1;
      }
    }
    
    // 7. Calculate lot size - fetch from database if not provided
    let lotSize = tradeData.lotSize;
    if (!lotSize || lotSize <= 0) {
      // Try to get lot size from instrument database
      try {
        let instrument = null;
        if (tradeData.token) {
          instrument = await Instrument.findOne({ token: tradeData.token.toString() }).select('lotSize').lean();
        }
        if (!instrument && tradeData.symbol && tradeData.exchange) {
          instrument = await Instrument.findOne({ 
            symbol: { $regex: new RegExp(`^${tradeData.symbol}`, 'i') },
            exchange: tradeData.exchange 
          }).select('lotSize').lean();
        }
        lotSize = instrument?.lotSize > 0 ? instrument.lotSize : 1;
      } catch (error) {
        console.error('Error fetching lot size:', error.message);
        lotSize = 1;
      }
    }
    const lots = tradeData.lots || Math.ceil(tradeData.quantity / lotSize);
    
    // Validate lot limits from user settings
    const maxLots = scriptSettings?.lotSettings?.maxLots || segmentSettings.maxLots || 50;
    const minLots = scriptSettings?.lotSettings?.minLots || segmentSettings.minLots || 1;
    
    if (lots < minLots) {
      throw new Error(`Minimum ${minLots} lots required for ${tradeData.symbol}`);
    }
    if (lots > maxLots) {
      throw new Error(`Maximum ${maxLots} lots allowed for ${tradeData.symbol}`);
    }
    
    // 8. Calculate spread from user settings
    const spread = this.calculateUserSpread(scriptSettings, tradeData.side);
    
    // Apply spread to entry price
    let effectiveEntryPrice = tradeData.entryPrice;
    if (spread > 0) {
      if (tradeData.side === 'BUY') {
        effectiveEntryPrice = tradeData.entryPrice + spread;
      } else {
        effectiveEntryPrice = tradeData.entryPrice - spread;
      }
    }
    
    // 9. Calculate brokerage from user settings with caps from admin
    const brokerage = this.calculateUserBrokerage(segmentSettings, scriptSettings, tradeData, lots, admin.brokerageCaps);
    
    // 10. Calculate required margin
    // For crypto, price is in USD - convert to INR for margin calculation
    let marginPrice = effectiveEntryPrice;
    const usdToInr = 83;
    
    if (isCrypto) {
      marginPrice = effectiveEntryPrice * usdToInr;
    }
    
    // Check for fixed margin from script settings
    let requiredMargin;
    const isIntraday = tradeData.productType === 'MIS' || tradeData.productType === 'INTRADAY';
    
    if (scriptSettings?.fixedMargin) {
      const isOption = tradeData.instrumentType === 'OPTIONS';
      const isOptionBuy = isOption && tradeData.side === 'BUY';
      const isOptionSell = isOption && tradeData.side === 'SELL';
      
      let fixedMarginPerLot = 0;
      if (isOptionBuy) {
        fixedMarginPerLot = isIntraday ? scriptSettings.fixedMargin.optionBuyIntraday : scriptSettings.fixedMargin.optionBuyCarry;
      } else if (isOptionSell) {
        fixedMarginPerLot = isIntraday ? scriptSettings.fixedMargin.optionSellIntraday : scriptSettings.fixedMargin.optionSellCarry;
      } else {
        fixedMarginPerLot = isIntraday ? scriptSettings.fixedMargin.intradayFuture : scriptSettings.fixedMargin.carryFuture;
      }
      
      if (fixedMarginPerLot > 0) {
        requiredMargin = fixedMarginPerLot * lots;
      } else {
        requiredMargin = this.calculateMargin(marginPrice, tradeData.quantity, lotSize, leverage, tradeData.productType);
      }
    } else {
      requiredMargin = this.calculateMargin(marginPrice, tradeData.quantity, lotSize, leverage, tradeData.productType);
    }
    
    // 11. Validate margin
    await this.validateMargin(userId, requiredMargin);
    
    // 12. Block margin - use updateOne to avoid validation issues
    await User.updateOne(
      { _id: userId },
      { $inc: { 'wallet.usedMargin': requiredMargin } }
    );
    
    // 13. Create trade with user's settings applied
    const trade = await Trade.create({
      user: userId,
      userId: user.userId,
      adminCode: user.adminCode,
      segment: tradeData.segment,
      instrumentType: tradeData.instrumentType,
      symbol: tradeData.symbol,
      token: tradeData.token,
      pair: tradeData.pair,
      isCrypto: isCrypto,
      exchange: tradeData.exchange || (isCrypto ? 'BINANCE' : 'NSE'),
      expiry: tradeData.expiry,
      strike: tradeData.strike,
      optionType: tradeData.optionType,
      side: tradeData.side,
      productType: tradeData.productType || 'MIS',
      quantity: tradeData.quantity,
      lotSize,
      lots,
      entryPrice: effectiveEntryPrice, // Entry price with spread applied
      currentPrice: tradeData.entryPrice, // Current market price without spread
      marketPrice: tradeData.entryPrice, // Original market price
      spread: spread, // Store spread applied
      marginUsed: requiredMargin,
      leverage,
      status: 'OPEN',
      bookType: admin.bookType || 'B_BOOK',
      // Store charges upfront
      charges: {
        brokerage: brokerage,
        exchange: 0,
        gst: brokerage * 0.18, // 18% GST on brokerage
        sebi: 0,
        stamp: 0,
        stt: 0,
        total: brokerage + (brokerage * 0.18)
      },
      commission: brokerage,
      totalCharges: brokerage + (brokerage * 0.18)
    });
    
    return trade;
  }
  
  // Close a trade
  static async closeTrade(tradeId, exitPrice, reason = 'MANUAL') {
    const trade = await Trade.findById(tradeId);
    if (!trade) throw new Error('Trade not found');
    if (trade.status !== 'OPEN') throw new Error('Trade is not open');
    
    // Get user and admin
    const user = await User.findById(trade.user);
    const admin = await Admin.findOne({ adminCode: trade.adminCode });
    
    // Calculate charges
    trade.exitPrice = exitPrice;
    const charges = await Charges.calculateCharges(trade, trade.adminCode, trade.user);
    trade.charges = charges;
    
    // Close trade and calculate P&L
    trade.closeTrade(exitPrice, reason);
    
    // Release margin and book P&L - use updateOne to avoid validation issues
    await User.updateOne(
      { _id: user._id },
      { $inc: { 
        'wallet.usedMargin': -trade.marginUsed,
        'wallet.cashBalance': trade.netPnL,
        'wallet.realizedPnL': trade.netPnL,
        'wallet.todayRealizedPnL': trade.netPnL
      }}
    );
    
    await trade.save();
    
    // Create ledger entry for user
    await WalletLedger.create({
      ownerType: 'USER',
      ownerId: user._id,
      adminCode: user.adminCode,
      type: trade.netPnL >= 0 ? 'CREDIT' : 'DEBIT',
      reason: 'TRADE_PNL',
      amount: Math.abs(trade.netPnL),
      balanceAfter: user.wallet.cashBalance,
      reference: { type: 'Trade', id: trade._id },
      description: `${trade.symbol} ${trade.side} P&L`
    });
    
    // Update admin P&L (B_BOOK)
    if (trade.bookType === 'B_BOOK' && admin) {
      admin.tradingPnL.realized += trade.adminPnL;
      admin.tradingPnL.todayRealized += trade.adminPnL;
      admin.stats.totalPnL += trade.adminPnL;
      
      // Add brokerage to admin wallet
      admin.wallet.balance += charges.brokerage;
      admin.stats.totalBrokerage += charges.brokerage;
      
      await admin.save();
      
      // Create ledger entry for admin brokerage
      await WalletLedger.create({
        ownerType: 'ADMIN',
        ownerId: admin._id,
        adminCode: admin.adminCode,
        type: 'CREDIT',
        reason: 'BROKERAGE',
        amount: charges.brokerage,
        balanceAfter: admin.wallet.balance,
        reference: { type: 'Trade', id: trade._id },
        description: `Brokerage from ${trade.tradeId}`
      });
    }
    
    return trade;
  }
  
  // Update live P&L for all open trades
  static async updateLivePnL(priceUpdates) {
    // priceUpdates = { 'SYMBOL': price, ... }
    const openTrades = await Trade.find({ status: 'OPEN' });
    
    for (const trade of openTrades) {
      const currentPrice = priceUpdates[trade.symbol];
      if (currentPrice) {
        trade.calculateUnrealizedPnL(currentPrice);
        await trade.save();
      }
    }
    
    // Update user unrealized P&L
    const userPnL = {};
    for (const trade of openTrades) {
      if (!userPnL[trade.user]) userPnL[trade.user] = 0;
      userPnL[trade.user] += trade.unrealizedPnL;
    }
    
    for (const [userId, pnl] of Object.entries(userPnL)) {
      await User.findByIdAndUpdate(userId, {
        'wallet.unrealizedPnL': pnl,
        'wallet.todayUnrealizedPnL': pnl
      });
    }
    
    return openTrades;
  }
  
  // RMS Check - Auto square-off if wallet goes negative
  static async runRMSCheck() {
    const users = await User.find({ isActive: true });
    const squaredOffTrades = [];
    
    for (const user of users) {
      const effectiveBalance = user.wallet.cashBalance + user.wallet.unrealizedPnL;
      
      if (effectiveBalance <= 0) {
        // Get open trades sorted by P&L (most loss first)
        const openTrades = await Trade.find({ 
          user: user._id, 
          status: 'OPEN' 
        }).sort({ unrealizedPnL: 1 });
        
        // Close trades one by one until balance is positive
        for (const trade of openTrades) {
          const exitPrice = trade.currentPrice || trade.entryPrice;
          await this.closeTrade(trade._id, exitPrice, 'RMS');
          squaredOffTrades.push(trade);
          
          // Refresh user balance
          const updatedUser = await User.findById(user._id);
          if (updatedUser.wallet.cashBalance > 0) break;
        }
      }
    }
    
    return squaredOffTrades;
  }
  
  // Time-based auto square-off for intraday positions
  static async runIntradaySquareOff(segment = 'EQUITY') {
    const openTrades = await Trade.find({ 
      status: 'OPEN',
      productType: 'MIS',
      segment
    });
    
    const squaredOffTrades = [];
    
    for (const trade of openTrades) {
      const exitPrice = trade.currentPrice || trade.entryPrice;
      await this.closeTrade(trade._id, exitPrice, 'TIME_BASED');
      squaredOffTrades.push(trade);
    }
    
    return squaredOffTrades;
  }
  
  // Get user's open positions
  static async getOpenPositions(userId) {
    return Trade.find({ user: userId, status: 'OPEN' }).sort({ openedAt: -1 });
  }
  
  // Get user's closed positions
  static async getClosedPositions(userId, limit = 50) {
    return Trade.find({ user: userId, status: 'CLOSED' })
      .sort({ closedAt: -1 })
      .limit(limit);
  }
  
  // Get admin's all trades
  static async getAdminTrades(adminCode, status = null) {
    const query = { adminCode };
    if (status) query.status = status;
    return Trade.find(query).sort({ openedAt: -1 });
  }
  
  // Get trade summary for user
  static async getUserTradeSummary(userId) {
    const openTrades = await Trade.find({ user: userId, status: 'OPEN' });
    const todayTrades = await Trade.find({
      user: userId,
      status: 'CLOSED',
      closedAt: { $gte: new Date().setHours(0, 0, 0, 0) }
    });
    
    const totalUnrealizedPnL = openTrades.reduce((sum, t) => sum + t.unrealizedPnL, 0);
    const todayRealizedPnL = todayTrades.reduce((sum, t) => sum + t.netPnL, 0);
    const totalMarginUsed = openTrades.reduce((sum, t) => sum + t.marginUsed, 0);
    
    return {
      openPositions: openTrades.length,
      todayTrades: todayTrades.length,
      totalUnrealizedPnL,
      todayRealizedPnL,
      totalMarginUsed
    };
  }
}

export default TradeService;
