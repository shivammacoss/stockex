import Trade from '../models/Trade.js';
import User from '../models/User.js';
import Admin from '../models/Admin.js';
import MarketState from '../models/MarketState.js';
import Charges from '../models/Charges.js';
import WalletLedger from '../models/WalletLedger.js';
import Instrument from '../models/Instrument.js';
import SystemSettings from '../models/SystemSettings.js';

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
  // NOTE: quantity here is the RAW quantity (e.g. number of shares/units, NOT multiplied by lotSize)
  // notionalValue = price × quantity × lotSize
  // If caller passes totalQuantity (already includes lotSize), pass lotSize=1
  static calculateMargin(price, quantity, lotSize, leverage, productType) {
    const notionalValue = price * quantity * lotSize;
    
    if (productType === 'CNC') {
      return notionalValue; // Full amount for delivery
    }
    
    return notionalValue / leverage;
  }
  
  // Check if trade segment is MCX (uses separate MCX wallet)
  static isMcxTrade(segment, exchange) {
    const segmentUpper = segment?.toUpperCase() || '';
    const exchangeUpper = exchange?.toUpperCase() || '';
    return segmentUpper === 'MCX' || segmentUpper === 'MCXFUT' || segmentUpper === 'MCXOPT' || 
           segmentUpper === 'COMMODITY' || exchangeUpper === 'MCX';
  }
  
  // Validate if user has sufficient margin
  static async validateMargin(userId, requiredMargin, segment = null, exchange = null) {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');
    
    // Use MCX wallet for MCX trades
    const isMcx = this.isMcxTrade(segment, exchange);
    let availableMargin;
    let walletType;
    
    if (isMcx) {
      const mcxBalance = user.mcxWallet?.balance || 0;
      const mcxUsedMargin = user.mcxWallet?.usedMargin || 0;
      availableMargin = mcxBalance - mcxUsedMargin;
      walletType = 'MCX';
    } else {
      const walletBalance = user.wallet?.tradingBalance || user.wallet?.cashBalance || 0;
      availableMargin = walletBalance - user.wallet.usedMargin + (user.wallet.collateralValue || 0);
      walletType = 'Main';
    }
    
    if (availableMargin < requiredMargin) {
      throw new Error(`Insufficient margin in ${walletType} Account. Required: ₹${requiredMargin.toFixed(2)}, Available: ₹${availableMargin.toFixed(2)}`);
    }
    
    return { user, availableMargin, isMcx };
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
    // Option buy = no leverage (full premium required as per SEBI/Zerodha rules)
    let leverage = 1;
    const isCrypto = tradeData.segment === 'CRYPTO' || tradeData.isCrypto;
    const isOptionBuy = tradeData.instrumentType === 'OPTIONS' && tradeData.side === 'BUY';
    
    if (!isOptionBuy && (tradeData.productType === 'MIS' || tradeData.productType === 'INTRADAY')) {
      if (tradeData.segment === 'EQUITY') {
        leverage = admin.charges?.intradayLeverage || 5;
      } else if (tradeData.instrumentType === 'FUTURES') {
        leverage = admin.charges?.futuresLeverage || 1;
      } else if (tradeData.instrumentType === 'OPTIONS') {
        // Only option sell gets leverage
        leverage = admin.charges?.optionSellLeverage || 1;
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
        // Pass lotSize=1 since tradeData.quantity is already totalQuantity (lots * lotSize)
        requiredMargin = this.calculateMargin(marginPrice, tradeData.quantity, 1, leverage, tradeData.productType);
      }
    } else {
      // Pass lotSize=1 since tradeData.quantity is already totalQuantity (lots * lotSize)
      requiredMargin = this.calculateMargin(marginPrice, tradeData.quantity, 1, leverage, tradeData.productType);
    }
    
    // 11. Validate margin - pass segment and exchange for MCX wallet check
    const isMcx = this.isMcxTrade(tradeData.segment, tradeData.exchange);
    await this.validateMargin(userId, requiredMargin, tradeData.segment, tradeData.exchange);
    
    // 12. Block margin - use MCX wallet for MCX trades
    if (isMcx) {
      await User.updateOne(
        { _id: userId },
        { $inc: { 'mcxWallet.usedMargin': requiredMargin } }
      );
    } else {
      await User.updateOne(
        { _id: userId },
        { $inc: { 'wallet.usedMargin': requiredMargin, 'wallet.blocked': requiredMargin } }
      );
    }
    
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
    
    // Check if MCX trade - use MCX wallet
    const isMcx = this.isMcxTrade(trade.segment, trade.exchange);
    
    // Release margin and book P&L - use updateOne to avoid validation issues
    if (isMcx) {
      await User.updateOne(
        { _id: user._id },
        { $inc: { 
          'mcxWallet.usedMargin': -trade.marginUsed,
          'mcxWallet.balance': trade.netPnL,
          'mcxWallet.realizedPnL': trade.netPnL,
          'mcxWallet.todayRealizedPnL': trade.netPnL
        }}
      );
    } else {
      await User.updateOne(
        { _id: user._id },
        { $inc: { 
          'wallet.usedMargin': -trade.marginUsed,
          'wallet.blocked': -trade.marginUsed,
          'wallet.tradingBalance': trade.netPnL,
          'wallet.cashBalance': trade.netPnL,
          'wallet.realizedPnL': trade.netPnL,
          'wallet.todayRealizedPnL': trade.netPnL
        }}
      );
    }
    
    await trade.save();
    
    // Create ledger entry for user
    const balanceAfter = isMcx ? (user.mcxWallet?.balance || 0) : (user.wallet?.tradingBalance || user.wallet?.cashBalance || 0);
    await WalletLedger.create({
      ownerType: 'USER',
      ownerId: user._id,
      adminCode: user.adminCode,
      type: trade.netPnL >= 0 ? 'CREDIT' : 'DEBIT',
      reason: 'TRADE_PNL',
      amount: Math.abs(trade.netPnL),
      balanceAfter: balanceAfter,
      reference: { type: 'Trade', id: trade._id },
      description: `${trade.symbol} ${trade.side} P&L${isMcx ? ' (MCX)' : ''}`
    });
    
    // Update admin P&L (B_BOOK) and distribute brokerage through hierarchy
    if (trade.bookType === 'B_BOOK' && admin) {
      admin.tradingPnL.realized += trade.adminPnL;
      admin.tradingPnL.todayRealized += trade.adminPnL;
      admin.stats.totalPnL += trade.adminPnL;
      await admin.save();
      
      // Distribute brokerage through MLM hierarchy
      await this.distributeBrokerage(trade, charges.brokerage, admin, user);
    }
    
    return trade;
  }
  
  // Distribute brokerage through MLM hierarchy
  // Handles cases where hierarchy levels are missing (e.g., user directly under Admin)
  static async distributeBrokerage(trade, totalBrokerage, directAdmin, user) {
    try {
      // Get system settings for sharing percentages
      const systemSettings = await SystemSettings.getSettings();
      const sharing = systemSettings.brokerageSharing || {};
      
      // If sharing is disabled, give all to direct admin
      if (!sharing.enabled) {
        await this.creditBrokerageToAdmin(directAdmin, totalBrokerage, trade, 'Full brokerage (sharing disabled)');
        return;
      }
      
      // Get sharing percentages
      const superAdminShare = sharing.superAdminShare || 20;
      const adminShare = sharing.adminShare || 25;
      const brokerShare = sharing.brokerShare || 25;
      const subBrokerShare = sharing.subBrokerShare || 30;
      
      // Build hierarchy chain from user up to SuperAdmin
      // user -> directAdmin -> ... -> SuperAdmin
      const hierarchyChain = [];
      let currentAdmin = directAdmin;
      
      while (currentAdmin) {
        hierarchyChain.push({
          admin: currentAdmin,
          role: currentAdmin.role
        });
        
        if (currentAdmin.role === 'SUPER_ADMIN' || !currentAdmin.parentId) {
          break;
        }
        
        currentAdmin = await Admin.findById(currentAdmin.parentId);
      }
      
      // Determine which roles exist in hierarchy
      const hasSubBroker = hierarchyChain.some(h => h.role === 'SUB_BROKER');
      const hasBroker = hierarchyChain.some(h => h.role === 'BROKER');
      const hasAdmin = hierarchyChain.some(h => h.role === 'ADMIN');
      const hasSuperAdmin = hierarchyChain.some(h => h.role === 'SUPER_ADMIN');
      
      // Calculate actual distribution based on existing hierarchy
      // Missing levels' shares go to the next level up
      let distributions = {};
      
      if (sharing.mode === 'CASCADING') {
        // Cascading mode: each level gets % of remaining
        let remaining = totalBrokerage;
        
        if (hasSubBroker) {
          distributions.SUB_BROKER = remaining * (subBrokerShare / 100);
          remaining -= distributions.SUB_BROKER;
        }
        if (hasBroker) {
          distributions.BROKER = remaining * (brokerShare / 100);
          remaining -= distributions.BROKER;
        }
        if (hasAdmin) {
          distributions.ADMIN = remaining * (adminShare / 100);
          remaining -= distributions.ADMIN;
        }
        if (hasSuperAdmin) {
          distributions.SUPER_ADMIN = remaining; // SuperAdmin gets whatever remains
        }
      } else {
        // Percentage mode: redistribute missing shares proportionally
        let totalActiveShare = 0;
        let activeShares = {};
        
        if (hasSubBroker) {
          activeShares.SUB_BROKER = subBrokerShare;
          totalActiveShare += subBrokerShare;
        }
        if (hasBroker) {
          activeShares.BROKER = brokerShare + (hasSubBroker ? 0 : subBrokerShare);
          totalActiveShare += activeShares.BROKER;
        } else if (!hasBroker && !hasSubBroker) {
          // No broker or subbroker - their shares go to admin
        }
        if (hasAdmin) {
          let extraShare = 0;
          if (!hasBroker) extraShare += brokerShare;
          if (!hasSubBroker && !hasBroker) extraShare += subBrokerShare;
          activeShares.ADMIN = adminShare + extraShare;
          totalActiveShare += activeShares.ADMIN;
        }
        if (hasSuperAdmin) {
          let extraShare = 0;
          if (!hasAdmin) {
            extraShare += adminShare;
            if (!hasBroker) extraShare += brokerShare;
            if (!hasSubBroker) extraShare += subBrokerShare;
          }
          activeShares.SUPER_ADMIN = superAdminShare + extraShare;
          totalActiveShare += activeShares.SUPER_ADMIN;
        }
        
        // Calculate actual amounts
        for (const [role, share] of Object.entries(activeShares)) {
          distributions[role] = totalBrokerage * (share / 100);
        }
      }
      
      // Credit brokerage to each admin in hierarchy
      for (const { admin, role } of hierarchyChain) {
        const amount = distributions[role] || 0;
        if (amount > 0) {
          await this.creditBrokerageToAdmin(admin, amount, trade, `${role} share (${((amount/totalBrokerage)*100).toFixed(1)}%)`);
        }
      }
      
    } catch (error) {
      console.error('Error distributing brokerage:', error);
      // Fallback: credit all to direct admin
      await this.creditBrokerageToAdmin(directAdmin, totalBrokerage, trade, 'Full brokerage (distribution error)');
    }
  }
  
  // Helper to credit brokerage to a single admin
  static async creditBrokerageToAdmin(admin, amount, trade, description) {
    if (!admin || amount <= 0) return;
    
    admin.wallet.balance += amount;
    admin.stats.totalBrokerage += amount;
    await admin.save();
    
    await WalletLedger.create({
      ownerType: 'ADMIN',
      ownerId: admin._id,
      adminCode: admin.adminCode,
      type: 'CREDIT',
      reason: 'BROKERAGE',
      amount: amount,
      balanceAfter: admin.wallet.balance,
      reference: { type: 'Trade', id: trade._id },
      description: `Brokerage from ${trade.tradeId} - ${description}`
    });
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
  
  // Convert intraday (MIS) positions to carry forward (NRML) at market close
  // Instead of square-off, we convert to carry forward with leverage adjustment
  static async runIntradayToCarryForward(segment = 'EQUITY') {
    const openTrades = await Trade.find({ 
      status: 'OPEN',
      productType: 'MIS',
      segment
    });
    
    const convertedTrades = [];
    const partiallyConvertedTrades = [];
    const failedTrades = [];
    
    for (const trade of openTrades) {
      try {
        const result = await this.convertIntradayToCarryForward(trade);
        if (result.fullyConverted) {
          convertedTrades.push(result);
        } else {
          partiallyConvertedTrades.push(result);
        }
      } catch (error) {
        console.error(`Failed to convert trade ${trade._id}:`, error.message);
        failedTrades.push({ trade, error: error.message });
      }
    }
    
    return { convertedTrades, partiallyConvertedTrades, failedTrades };
  }
  
  // Convert a single intraday trade to carry forward
  static async convertIntradayToCarryForward(trade) {
    const user = await User.findById(trade.user);
    if (!user) throw new Error('User not found');
    
    const admin = await Admin.findOne({ adminCode: trade.adminCode });
    if (!admin) throw new Error('Admin not found');
    
    // Get leverage values
    const intradayLeverage = trade.leverage || admin.charges?.intradayLeverage || 5;
    const carryForwardLeverage = admin.charges?.deliveryLeverage || 1;
    
    // Calculate current margin used (intraday)
    const currentMarginUsed = trade.marginUsed;
    
    // Calculate required margin for carry forward (higher margin needed)
    const notionalValue = trade.entryPrice * trade.quantity * (trade.lotSize || 1);
    const requiredCarryForwardMargin = notionalValue / carryForwardLeverage;
    
    // Calculate additional margin needed
    const additionalMarginNeeded = requiredCarryForwardMargin - currentMarginUsed;
    
    // Calculate current unrealized P&L
    const currentPrice = trade.currentPrice || trade.entryPrice;
    const priceDiff = trade.side === 'BUY' 
      ? (currentPrice - trade.entryPrice) 
      : (trade.entryPrice - currentPrice);
    const unrealizedPnL = priceDiff * trade.quantity * (trade.lotSize || 1);
    
    // Check if MCX trade - use MCX wallet
    const isMcx = this.isMcxTrade(trade.segment, trade.exchange);
    
    // Available balance = wallet balance - used margin + unrealized profit (if positive)
    let availableBalance;
    if (isMcx) {
      const mcxBalance = user.mcxWallet?.balance || 0;
      const mcxUsedMargin = user.mcxWallet?.usedMargin || 0;
      availableBalance = mcxBalance - mcxUsedMargin;
    } else {
      availableBalance = user.wallet.cashBalance - user.wallet.usedMargin;
    }
    const availableWithProfit = availableBalance + Math.max(0, unrealizedPnL);
    
    let result = {
      tradeId: trade._id,
      symbol: trade.symbol,
      originalQuantity: trade.quantity,
      originalLots: trade.lots,
      intradayLeverage,
      carryForwardLeverage,
      currentMarginUsed,
      requiredCarryForwardMargin,
      additionalMarginNeeded,
      unrealizedPnL,
      fullyConverted: false
    };
    
    if (additionalMarginNeeded <= 0) {
      // No additional margin needed (rare case where carry forward leverage >= intraday)
      await Trade.updateOne(
        { _id: trade._id },
        { 
          productType: 'NRML',
          leverage: carryForwardLeverage,
          convertedFromIntraday: true,
          conversionTime: new Date()
        }
      );
      result.fullyConverted = true;
      result.newProductType = 'NRML';
      result.message = 'Converted to carry forward - no additional margin needed';
      
    } else if (availableWithProfit >= additionalMarginNeeded) {
      // User has enough balance (including profit) to cover additional margin
      
      // First, deduct from profit if available
      let deductedFromProfit = 0;
      let deductedFromBalance = additionalMarginNeeded;
      
      if (unrealizedPnL > 0) {
        deductedFromProfit = Math.min(unrealizedPnL, additionalMarginNeeded);
        deductedFromBalance = additionalMarginNeeded - deductedFromProfit;
      }
      
      // Update user's margin - use MCX wallet for MCX trades
      if (isMcx) {
        await User.updateOne(
          { _id: user._id },
          { $inc: { 'mcxWallet.usedMargin': additionalMarginNeeded } }
        );
      } else {
        await User.updateOne(
          { _id: user._id },
          { $inc: { 'wallet.usedMargin': additionalMarginNeeded } }
        );
      }
      
      // Update trade to carry forward
      await Trade.updateOne(
        { _id: trade._id },
        { 
          productType: 'NRML',
          leverage: carryForwardLeverage,
          marginUsed: requiredCarryForwardMargin,
          convertedFromIntraday: true,
          conversionTime: new Date(),
          conversionDetails: {
            additionalMarginDeducted: additionalMarginNeeded,
            deductedFromProfit,
            deductedFromBalance
          }
        }
      );
      
      // Create ledger entry for margin adjustment
      const balanceAfterConversion = isMcx 
        ? (user.mcxWallet?.balance || 0) - (user.mcxWallet?.usedMargin || 0) - additionalMarginNeeded
        : user.wallet.cashBalance - user.wallet.usedMargin - additionalMarginNeeded;
      await WalletLedger.create({
        ownerType: 'USER',
        ownerId: user._id,
        userId: user.userId,
        adminCode: user.adminCode,
        type: 'DEBIT',
        reason: 'MARGIN_ADJUSTMENT',
        amount: additionalMarginNeeded,
        balanceAfter: balanceAfterConversion,
        reference: { type: 'Trade', id: trade._id },
        description: `Intraday to Carry Forward conversion - ${trade.symbol}${isMcx ? ' (MCX)' : ''}`
      });
      
      result.fullyConverted = true;
      result.newProductType = 'NRML';
      result.deductedFromProfit = deductedFromProfit;
      result.deductedFromBalance = deductedFromBalance;
      result.message = 'Converted to carry forward - additional margin deducted';
      
    } else {
      // Not enough balance - need to reduce position size
      // Calculate how many lots can be converted with available margin
      const marginPerLot = requiredCarryForwardMargin / trade.lots;
      const totalAvailableForConversion = currentMarginUsed + availableWithProfit;
      const lotsCanConvert = Math.floor(totalAvailableForConversion / marginPerLot);
      
      if (lotsCanConvert <= 0) {
        // Cannot convert any lots - close the entire position
        const exitPrice = trade.currentPrice || trade.entryPrice;
        await this.closeTrade(trade._id, exitPrice, 'MARGIN_INSUFFICIENT');
        
        result.fullyConverted = false;
        result.action = 'CLOSED';
        result.message = 'Position closed - insufficient margin for carry forward';
        result.closedQuantity = trade.quantity;
        
      } else {
        // Partial conversion - convert some lots, close the rest
        const lotsToClose = trade.lots - lotsCanConvert;
        const quantityToClose = lotsToClose * (trade.lotSize || 1);
        const quantityToKeep = lotsCanConvert * (trade.lotSize || 1);
        
        // Calculate margin for kept position
        const newMarginRequired = marginPerLot * lotsCanConvert;
        const marginToRelease = currentMarginUsed - newMarginRequired;
        
        // Close partial position
        const exitPrice = trade.currentPrice || trade.entryPrice;
        const pnlPerUnit = trade.side === 'BUY' 
          ? (exitPrice - trade.entryPrice) 
          : (trade.entryPrice - exitPrice);
        const closedPnL = pnlPerUnit * quantityToClose * (trade.lotSize || 1);
        
        // Update user wallet - release margin for closed portion, add P&L
        // Use MCX wallet for MCX trades
        if (isMcx) {
          await User.updateOne(
            { _id: user._id },
            { 
              $inc: { 
                'mcxWallet.usedMargin': -marginToRelease,
                'mcxWallet.balance': closedPnL,
                'mcxWallet.realizedPnL': closedPnL,
                'mcxWallet.todayRealizedPnL': closedPnL
              } 
            }
          );
        } else {
          await User.updateOne(
            { _id: user._id },
            { 
              $inc: { 
                'wallet.usedMargin': -marginToRelease,
                'wallet.cashBalance': closedPnL
              } 
            }
          );
        }
        
        // Update trade with reduced quantity and carry forward
        await Trade.updateOne(
          { _id: trade._id },
          { 
            productType: 'NRML',
            leverage: carryForwardLeverage,
            quantity: quantityToKeep,
            lots: lotsCanConvert,
            marginUsed: newMarginRequired,
            convertedFromIntraday: true,
            conversionTime: new Date(),
            partialClose: {
              closedQuantity: quantityToClose,
              closedLots: lotsToClose,
              closedPnL,
              closeReason: 'MARGIN_INSUFFICIENT_PARTIAL'
            }
          }
        );
        
        // Create ledger entry
        const partialCloseBalance = isMcx 
          ? (user.mcxWallet?.balance || 0) + closedPnL
          : user.wallet.cashBalance + closedPnL;
        await WalletLedger.create({
          ownerType: 'USER',
          ownerId: user._id,
          userId: user.userId,
          adminCode: user.adminCode,
          type: closedPnL >= 0 ? 'CREDIT' : 'DEBIT',
          reason: 'PARTIAL_CLOSE',
          amount: Math.abs(closedPnL),
          balanceAfter: partialCloseBalance,
          reference: { type: 'Trade', id: trade._id },
          description: `Partial close for carry forward conversion - ${trade.symbol} (${lotsToClose} lots)${isMcx ? ' (MCX)' : ''}`
        });
        
        result.fullyConverted = false;
        result.action = 'PARTIAL_CONVERSION';
        result.newProductType = 'NRML';
        result.keptLots = lotsCanConvert;
        result.closedLots = lotsToClose;
        result.closedPnL = closedPnL;
        result.message = `Partially converted - ${lotsCanConvert} lots kept, ${lotsToClose} lots closed`;
      }
    }
    
    return result;
  }
  
  // Legacy square-off method (kept for manual square-off)
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
