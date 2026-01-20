import User from '../models/User.js';
import Trade from '../models/Trade.js';
import Admin from '../models/Admin.js';
import TradeService from './tradeService.js';
import Instrument from '../models/Instrument.js';
import MarketState from '../models/MarketState.js';
import Notification from '../models/Notification.js';

// Lot sizes for different instruments
const LOT_SIZES = {
  // NSE F&O
  'NIFTY': 25,
  'BANKNIFTY': 15,
  'FINNIFTY': 25,
  'MIDCPNIFTY': 50,
  'SENSEX': 10,
  'BANKEX': 15,
  // MCX Commodities - Mini variants (must be checked first)
  'GOLDM': 10,
  'GOLDGUINEA': 1,
  'GOLDPETAL': 1,
  'SILVERM': 5,
  'SILVERMIC': 1,
  'CRUDEOILM': 10,
  // MCX Commodities - Standard
  'GOLD': 100,
  'SILVER': 30,
  'CRUDEOIL': 100,
  'NATURALGAS': 1250,
  'COPPER': 2500,
  'ZINC': 5000,
  'ALUMINIUM': 5000,
  'LEAD': 5000,
  'NICKEL': 1500,
};

// Market hours (IST)
const MARKET_HOURS = {
  NSE: { open: { hour: 9, minute: 15 }, close: { hour: 15, minute: 30 } },
  BSE: { open: { hour: 9, minute: 15 }, close: { hour: 15, minute: 30 } },
  NFO: { open: { hour: 9, minute: 15 }, close: { hour: 15, minute: 30 } },
  MCX: { open: { hour: 9, minute: 0 }, close: { hour: 23, minute: 30 } },
  BINANCE: { open: { hour: 0, minute: 0 }, close: { hour: 23, minute: 59 } }, // 24/7
  CRYPTO: { open: { hour: 0, minute: 0 }, close: { hour: 23, minute: 59 } }, // 24/7
};

// USD to INR conversion rate
const USD_TO_INR = 83;

// Helper function to check margin usage and send warning notification
const checkMarginWarning = async (user, newUsedMargin, tradingBalance) => {
  try {
    // Calculate margin usage percentage
    const totalMarginAvailable = tradingBalance + newUsedMargin; // Total funds allocated for trading
    if (totalMarginAvailable <= 0) return;
    
    const marginUsagePercent = (newUsedMargin / totalMarginAvailable) * 100;
    
    // Send warning notification if margin usage exceeds 70%
    if (marginUsagePercent >= 70) {
      // Check if we already sent a warning today to avoid spam
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const existingWarning = await Notification.findOne({
        senderType: 'SYSTEM',
        targetType: 'SINGLE_USER',
        targetUserId: user._id,
        title: 'Margin Warning',
        createdAt: { $gte: today }
      });
      
      if (!existingWarning) {
        await Notification.create({
          title: 'Margin Warning',
          subject: `⚠️ High Margin Usage Alert - ${marginUsagePercent.toFixed(1)}%`,
          description: `Your margin usage is at ${marginUsagePercent.toFixed(1)}% (₹${newUsedMargin.toLocaleString()} used out of ₹${totalMarginAvailable.toLocaleString()}). Consider closing some positions to reduce risk. If margin usage reaches 100%, you may not be able to place new trades.`,
          senderType: 'SYSTEM',
          targetType: 'SINGLE_USER',
          targetUserId: user._id
        });
        console.log(`Margin warning sent to user ${user.userId}: ${marginUsagePercent.toFixed(1)}% usage`);
      }
    }
  } catch (error) {
    console.error('Error checking margin warning:', error);
    // Don't throw - this is a non-critical operation
  }
};

class TradingService {
  
  // Get lot size for instrument (sync fallback - prefer getLotSizeAsync)
  static getLotSize(symbol, category, exchange) {
    const sym = symbol?.toUpperCase() || '';
    const cat = category?.toUpperCase() || '';
    const exch = exchange?.toUpperCase() || '';
    
    // MCX commodities - check mini variants FIRST (more specific matches)
    if (exch === 'MCX' || cat === 'MCX') {
      // Mini/Micro variants first
      if (sym.includes('GOLDM') || sym.startsWith('GOLDM')) return 10;
      if (sym.includes('GOLDGUINEA')) return 1;
      if (sym.includes('GOLDPETAL')) return 1;
      if (sym.includes('SILVERM') || sym.startsWith('SILVERM')) return 5;
      if (sym.includes('SILVERMIC')) return 1;
      if (sym.includes('CRUDEOILM') || sym.startsWith('CRUDEOILM')) return 10;
      // Standard variants
      if (sym.includes('GOLD')) return 100;
      if (sym.includes('SILVER')) return 30;
      if (sym.includes('CRUDEOIL')) return 100;
      if (sym.includes('NATURALGAS')) return 1250;
      if (sym.includes('COPPER')) return 2500;
      if (sym.includes('ZINC')) return 5000;
      if (sym.includes('ALUMINIUM')) return 5000;
      if (sym.includes('LEAD')) return 5000;
      if (sym.includes('NICKEL')) return 1500;
    }
    
    // NSE F&O by category
    if (cat) {
      if (cat.includes('NIFTY') && !cat.includes('BANK') && !cat.includes('FIN') && !cat.includes('MID')) return 25;
      if (cat.includes('BANKNIFTY')) return 15;
      if (cat.includes('FINNIFTY')) return 25;
      if (cat.includes('MIDCPNIFTY')) return 50;
    }
    
    // Check by symbol - mini variants first
    const sortedKeys = Object.keys(LOT_SIZES).sort((a, b) => b.length - a.length);
    for (const key of sortedKeys) {
      if (sym.includes(key)) return LOT_SIZES[key];
    }
    return 1;
  }
  
  // Get lot size from database (preferred method)
  static async getLotSizeAsync(symbol, token, exchange) {
    try {
      // Try to find instrument by token first (most accurate)
      let instrument = null;
      if (token) {
        instrument = await Instrument.findOne({ token: token.toString() }).select('lotSize symbol').lean();
      }
      // Fallback to symbol + exchange
      if (!instrument && symbol && exchange) {
        instrument = await Instrument.findOne({ 
          symbol: { $regex: new RegExp(`^${symbol}`, 'i') },
          exchange: exchange 
        }).select('lotSize symbol').lean();
      }
      if (instrument?.lotSize && instrument.lotSize > 0) {
        return instrument.lotSize;
      }
    } catch (error) {
      console.error('Error fetching lot size from DB:', error.message);
    }
    // Fallback to hardcoded
    return this.getLotSize(symbol, null, exchange);
  }

  // Check if market is open - now uses MarketState from database
  static async isMarketOpen(exchange = 'NSE') {
    // Crypto/Binance is always open 24/7
    if (exchange === 'BINANCE' || exchange === 'CRYPTO') {
      return { open: true, reason: 'Crypto markets are open 24/7' };
    }
    
    try {
      // Map exchange to segment for MarketState lookup
      let segment = 'EQUITY';
      if (exchange === 'NFO' || exchange === 'NSE') {
        // Check if it's FNO based on the context - default to checking both
        const fnoResult = await MarketState.isTradingAllowed('FNO');
        const equityResult = await MarketState.isTradingAllowed('EQUITY');
        // If either is open, allow trading
        if (fnoResult.allowed || equityResult.allowed) {
          return { open: true, reason: 'Market open' };
        }
        return { open: false, reason: fnoResult.reason || equityResult.reason || 'Market closed' };
      } else if (exchange === 'MCX') {
        segment = 'MCX';
      } else if (exchange === 'BSE') {
        segment = 'EQUITY';
      }
      
      const result = await MarketState.isTradingAllowed(segment);
      return { open: result.allowed, reason: result.reason };
    } catch (error) {
      console.error('Error checking market state:', error);
      // Fallback to hardcoded hours if database check fails
      return this.isMarketOpenFallback(exchange);
    }
  }
  
  // Fallback market check using hardcoded hours
  static isMarketOpenFallback(exchange = 'NSE') {
    const now = new Date();
    const istOptions = { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: 'numeric', hour12: false, weekday: 'short' };
    const istTimeStr = now.toLocaleString('en-US', istOptions);
    
    const [weekday, time] = istTimeStr.split(' ');
    const [hours, minutes] = time.split(':').map(Number);
    
    if (weekday === 'Sat' || weekday === 'Sun') {
      return { open: false, reason: 'Market closed on weekends' };
    }
    
    const marketHours = MARKET_HOURS[exchange] || MARKET_HOURS.NSE;
    const currentMinutes = hours * 60 + minutes;
    const openMinutes = marketHours.open.hour * 60 + marketHours.open.minute;
    const closeMinutes = marketHours.close.hour * 60 + marketHours.close.minute;
    
    if (currentMinutes < openMinutes) {
      return { open: false, reason: `Market opens at ${marketHours.open.hour}:${String(marketHours.open.minute).padStart(2, '0')} IST` };
    }
    if (currentMinutes > closeMinutes) {
      return { open: false, reason: `Market closed at ${marketHours.close.hour}:${String(marketHours.close.minute).padStart(2, '0')} IST` };
    }
    
    return { open: true };
  }

  // Get admin settings for user
  static async getAdminSettings(user) {
    const admin = await Admin.findOne({ adminCode: user.adminCode });
    return admin || null;
  }

  // Get available leverages for user
  static async getAvailableLeverages(user) {
    const admin = await this.getAdminSettings(user);
    if (!admin || !admin.leverageSettings) {
      return [1, 2, 5, 10];
    }
    return admin.leverageSettings.enabledLeverages || [1, 2, 5, 10];
  }

  // Calculate margin required with leverage
  static calculateMargin(order, user, leverage = 1) {
    const { segment, productType, side, quantity, price, lotSize = 1, lots = 1 } = order;
    
    // For crypto, convert USD to INR for margin calculation
    const isCrypto = segment === 'CRYPTO' || order.isCrypto || order.exchange === 'BINANCE';
    const effectivePrice = isCrypto ? price * USD_TO_INR : price;
    
    // Trade value: quantity already includes lotSize from frontend (quantity = lots × lotSize)
    const tradeValue = quantity * effectivePrice;
    
    let baseMargin = 0;

    if (isCrypto) {
      // Crypto spot trading - full value required (1x leverage for spot)
      baseMargin = tradeValue;
      if (productType === 'MIS') baseMargin *= 0.1; // 10% margin for crypto intraday
    } else if (segment === 'EQUITY' || segment === 'equity') {
      if (productType === 'CNC') {
        baseMargin = side === 'BUY' ? tradeValue : 0;
      } else if (productType === 'MIS') {
        baseMargin = tradeValue * 0.2;
      }
    } else if (segment === 'FNO' && order.instrumentType === 'FUTURES') {
      baseMargin = tradeValue * 0.15;
      if (productType === 'MIS') baseMargin *= 0.5;
    } else if (segment === 'FNO' && order.instrumentType === 'OPTIONS') {
      if (side === 'BUY') {
        baseMargin = tradeValue;
      } else {
        // For option sell, use strike price for notional value
        const notionalValue = quantity * (order.strikePrice || effectivePrice * 10);
        baseMargin = notionalValue * 0.20;
        if (productType === 'MIS') baseMargin *= 0.5;
      }
    } else if (segment === 'MCX' || segment === 'COMMODITY') {
      // MCX commodities - lower margin for B-book
      baseMargin = tradeValue * 0.05; // 5% margin for MCX
      if (productType === 'MIS') baseMargin *= 0.5; // 2.5% for intraday
    } else {
      baseMargin = tradeValue * 0.15;
    }

    const marginRequired = baseMargin / leverage;
    
    return {
      marginRequired: Math.round(marginRequired * 100) / 100,
      tradeValue: Math.round(tradeValue * 100) / 100,
      effectiveMargin: Math.round(baseMargin * 100) / 100,
      leverage,
      isCrypto
    };
  }

  // Place order - Uses user's segment and script settings for all calculations
  static async placeOrder(userId, orderData) {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    const admin = await this.getAdminSettings(user);

    if (user.rmsSettings?.tradingBlocked) {
      throw new Error('Trading blocked. Contact admin.');
    }

    const exchange = orderData.exchange || 'NSE';
    const marketStatus = await this.isMarketOpen(exchange);
    const allowOutsideHours = admin?.tradingSettings?.allowTradingOutsideMarketHours || false;
    
    if (orderData.orderType === 'MARKET' && !marketStatus.open && !allowOutsideHours) {
      throw new Error(marketStatus.reason);
    }

    // POSITION NETTING: Check if there's an existing opposite position for same symbol
    // If user has BUY position and places SELL order (or vice versa), close the existing position
    // Works for ALL segments: NSE, MCX, F&O, Crypto, etc.
    // NOTE: Only apply netting for MARKET orders. LIMIT/SL orders should create pending orders
    if (orderData.orderType === 'MARKET') {
      const oppositeSide = orderData.side === 'BUY' ? 'SELL' : 'BUY';
      const nettingQuery = {
        user: userId,
        symbol: orderData.symbol,
        side: oppositeSide,
        status: 'OPEN'
      };
      // Also match exchange if provided to handle same symbol on different exchanges
      if (orderData.exchange) {
        nettingQuery.exchange = orderData.exchange;
      }
      const existingPosition = await Trade.findOne(nettingQuery);

      if (existingPosition) {
        console.log(`Position netting: Found existing ${oppositeSide} position for ${orderData.symbol}, closing it`);
        
        // Close the existing position instead of creating a new opposite one
        const exitPrice = orderData.side === 'BUY' 
          ? (orderData.askPrice || orderData.price) 
          : (orderData.bidPrice || orderData.price);
        
        const result = await this.squareOffPosition(existingPosition._id, 'NETTING', exitPrice);
        
        return {
          success: true,
          trade: result.trade,
          action: 'POSITION_CLOSED',
          message: `Existing ${oppositeSide} position closed via netting`,
          pnl: result.trade?.realizedPnL || 0
        };
      }
    }

    // Get user's segment and script settings
    const segmentSettings = TradeService.getUserSegmentSettings(user, orderData.segment, orderData.instrumentType);
    const scriptSettings = TradeService.getUserScriptSettings(user, orderData.symbol, orderData.category);
    
    // Validate segment is enabled
    if (!segmentSettings.enabled) {
      throw new Error(`Trading in ${orderData.segment} segment is not enabled for your account`);
    }
    
    // Check if script is blocked
    if (scriptSettings?.blocked) {
      throw new Error(`Trading in ${orderData.symbol} is blocked for your account`);
    }

    // Determine if crypto trade early
    const isCryptoTrade = orderData.segment === 'CRYPTO' || orderData.isCrypto || orderData.exchange === 'BINANCE';
    
    // Get lot size - prefer from order data, then database, then fallback to hardcoded
    // For crypto: lot size is always 1 (fractional units allowed)
    let lotSize = isCryptoTrade ? 1 : orderData.lotSize;
    if (!isCryptoTrade && (!lotSize || lotSize <= 0)) {
      lotSize = await this.getLotSizeAsync(orderData.symbol, orderData.token, orderData.exchange);
    }
    
    // For crypto: use fractional quantity directly
    // For others: use quantity from frontend if provided (quantity mode), otherwise lots * lotSize
    const lots = orderData.lots || 1;
    const totalQuantity = isCryptoTrade 
      ? (orderData.quantity || orderData.cryptoAmount / orderData.price || 0) // Fractional crypto units
      : (orderData.quantity || lots * lotSize); // Use frontend quantity if provided, else calculate from lots
    
    // Skip lot validation for crypto (uses USD amount, not lots)
    if (!isCryptoTrade) {
      // Validate lot limits from user settings
      // Script settings override segment settings, segment settings are the default
      const maxLots = scriptSettings?.lotSettings?.maxLots || segmentSettings?.maxLots || 50;
      const minLots = scriptSettings?.lotSettings?.minLots || segmentSettings?.minLots || 1;
      
      console.log('Lot Validation:', {
        requestedLots: lots,
        maxLots, minLots,
        fromScript: !!scriptSettings?.lotSettings?.maxLots,
        fromSegment: segmentSettings?.maxLots,
        segment: orderData.segment
      });
      
      if (lots < minLots) {
        throw new Error(`Minimum ${minLots} lots required for ${orderData.symbol}`);
      }
      if (lots > maxLots) {
        throw new Error(`Maximum ${maxLots} lots allowed for ${orderData.symbol}. Your limit is ${maxLots} lots.`);
      }
    } else {
      console.log('Crypto trade:', { quantity: totalQuantity, price: orderData.price, cryptoAmount: orderData.cryptoAmount });
    }

    // Calculate spread from user's script settings
    const spreadPoints = TradeService.calculateUserSpread(scriptSettings, orderData.side);
    
    // Calculate brokerage from user's segment/script settings
    const totalCommission = TradeService.calculateUserBrokerage(segmentSettings, scriptSettings, orderData, lots);
    
    // Calculate margin - check for fixed margin first
    const isIntraday = orderData.productType === 'MIS' || orderData.productType === 'INTRADAY';
    const isOption = orderData.instrumentType === 'OPTIONS';
    const isOptionBuy = isOption && orderData.side === 'BUY';
    const isOptionSell = isOption && orderData.side === 'SELL';
    
    let marginRequired = 0;
    let usedFixedMargin = false;
    let marginSource = 'calculated';
    const leverage = orderData.leverage || 1;
    const marginCalc = this.calculateMargin({ ...orderData, quantity: totalQuantity }, user, leverage);
    
    const price = orderData.price || 0;
    const tradeValue = price * lotSize * lots;
    
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
        marginRequired = fixedMarginPerLot * lots;
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
        console.log('Order margin from exposure:', { tradeValue, exposure, marginRequired, isIntraday });
      }
    }
    
    // Priority 3: Fall back to default calculated margin
    if (marginRequired === 0) {
      marginRequired = marginCalc.marginRequired;
      marginSource = 'default_calculated';
    }

    // Determine if crypto trade - check before balance validation
    const isCrypto = orderData.segment === 'CRYPTO' || orderData.isCrypto || orderData.exchange === 'BINANCE';
    
    // For crypto spot trading, calculate trade cost (price × quantity)
    const cryptoTradeCost = isCrypto ? (price * totalQuantity) : 0;
    
    // Use appropriate wallet based on trade type
    let availableBalance;
    if (isCrypto) {
      // Crypto trades use separate crypto wallet (no margin system, spot trading)
      availableBalance = user.cryptoWallet?.balance || 0;
      // For crypto spot trading, need full trade cost + commission
      const totalCryptoRequired = cryptoTradeCost + totalCommission;
      if (totalCryptoRequired > availableBalance) {
        throw new Error(`Insufficient crypto wallet balance. Required: $${totalCryptoRequired.toFixed(2)}, Available: $${availableBalance.toFixed(2)}`);
      }
    } else {
      // Regular trades use trading balance with margin system
      const walletBalance = user.wallet?.tradingBalance || user.wallet?.cashBalance || user.wallet?.balance || 0;
      const blockedMargin = user.wallet?.usedMargin || user.wallet?.blocked || 0;
      availableBalance = walletBalance - blockedMargin;
      
      // Check if user has enough for margin + commission
      if ((marginRequired + totalCommission) > availableBalance) {
        throw new Error(`Insufficient funds. Required: ₹${(marginRequired + totalCommission).toLocaleString()}, Available: ₹${availableBalance.toLocaleString()}`);
      }
    }

    // Indian Net Trading: BUY uses Ask price, SELL uses Bid price
    let baseEntryPrice = orderData.price || 0;
    if (orderData.orderType === 'MARKET') {
      if (orderData.side === 'BUY') {
        baseEntryPrice = orderData.askPrice || orderData.price || 0;
      } else {
        baseEntryPrice = orderData.bidPrice || orderData.price || 0;
      }
    }
    
    // Apply spread from user settings on top of bid/ask price
    let effectiveEntryPrice = baseEntryPrice;
    if (orderData.orderType === 'MARKET' && spreadPoints > 0) {
      if (orderData.side === 'BUY') {
        effectiveEntryPrice = baseEntryPrice + spreadPoints;
      } else {
        effectiveEntryPrice = baseEntryPrice - spreadPoints;
      }
    }
    
    const finalTradeValue = totalQuantity * effectiveEntryPrice;
    const totalCharges = totalCommission;

    // Get adminCode from user or fetch from admin if not set
    let adminCode = user.adminCode;
    if (!adminCode && user.admin) {
      const userAdmin = await Admin.findById(user.admin);
      adminCode = userAdmin?.adminCode || 'SYSTEM';
      // Update user with adminCode for future trades using updateOne to avoid validation issues
      await User.updateOne({ _id: user._id }, { $set: { adminCode: adminCode } });
      user.adminCode = adminCode;
    }
    // If still no adminCode, use SYSTEM as default for crypto trades
    if (!adminCode) {
      if (orderData.isCrypto || orderData.segment === 'CRYPTO' || orderData.exchange === 'BINANCE') {
        adminCode = 'SYSTEM';
        console.log('Using SYSTEM adminCode for crypto trade');
      } else {
        throw new Error('User not linked to any admin. Please contact support.');
      }
    }

    // isCrypto already determined above for balance validation
    
    const trade = new Trade({
      user: userId,
      userId: user.userId,
      adminCode: adminCode,
      segment: orderData.segment || 'FNO',
      instrumentType: orderData.instrumentType || 'OPTIONS',
      symbol: orderData.symbol,
      token: orderData.token, // Store token for price lookup
      pair: orderData.pair, // For crypto trading pairs
      isCrypto: isCrypto,
      exchange: orderData.exchange || (isCrypto ? 'BINANCE' : 'NFO'),
      expiry: orderData.expiry,
      strike: orderData.strike,
      optionType: orderData.optionType,
      side: orderData.side,
      productType: orderData.productType || 'MIS',
      orderType: orderData.orderType || 'MARKET',
      quantity: totalQuantity,
      lotSize: lotSize,
      lots: lots,
      entryPrice: orderData.orderType === 'MARKET' ? effectiveEntryPrice : 0,
      limitPrice: orderData.orderType === 'LIMIT' ? orderData.limitPrice : null,
      triggerPrice: orderData.triggerPrice || null,
      stopLoss: orderData.stopLoss || null,
      target: orderData.target || null,
      marginUsed: marginRequired,
      leverage: leverage,
      effectiveMargin: marginCalc.effectiveMargin,
      spread: spreadPoints,
      commission: totalCommission,
      totalCharges: totalCharges,
      status: orderData.orderType === 'MARKET' ? 'OPEN' : 'PENDING',
      bookType: 'B_BOOK'
    });

    if (orderData.orderType === 'MARKET') {
      trade.entryPrice = effectiveEntryPrice;
      trade.currentPrice = orderData.price; // Current price is actual market price
      trade.marketPrice = orderData.price; // Store original market price
    }
    
    // Block margin from tradingBalance and deduct commission (dual wallet system)
    // For crypto trades, use separate cryptoWallet - no margin system
    let newTradingBalance, newUsedMargin, newBlocked, newCryptoBalance;
    
    if (isCrypto) {
      // Crypto trades: Use separate crypto wallet, spot trading (full cost deducted)
      const cryptoBalance = user.cryptoWallet?.balance || 0;
      const totalCryptoDeduction = cryptoTradeCost + totalCommission;
      newCryptoBalance = cryptoBalance - totalCryptoDeduction;
      
      // Check if user has enough in crypto wallet
      if (newCryptoBalance < 0) {
        throw new Error(`Insufficient crypto wallet balance. Required: $${totalCryptoDeduction.toFixed(2)}, Available: $${cryptoBalance.toFixed(2)}`);
      }
      
      // Regular wallet unchanged for crypto trades
      newTradingBalance = user.wallet.tradingBalance || 0;
      newUsedMargin = user.wallet.usedMargin || 0;
      newBlocked = user.wallet.blocked || 0;
      console.log(`Crypto trade: Deducting $${totalCryptoDeduction.toFixed(2)} from crypto wallet (cost: $${cryptoTradeCost.toFixed(2)}, commission: $${totalCommission.toFixed(2)})`);
      
      // Store the trade cost as marginUsed for crypto (for tracking purposes)
      marginRequired = cryptoTradeCost;
    } else {
      // Regular trades: Block margin and deduct commission
      newTradingBalance = (user.wallet.tradingBalance || 0) - marginRequired - totalCommission;
      newUsedMargin = (user.wallet.usedMargin || 0) + marginRequired;
      newBlocked = (user.wallet.blocked || 0) + marginRequired;
      newCryptoBalance = user.cryptoWallet?.balance || 0; // Unchanged
    }
    
    // Prevent negative balances
    newTradingBalance = Math.max(0, newTradingBalance);
    newCryptoBalance = Math.max(0, newCryptoBalance);
    
    // Use updateOne to avoid validation issues with segmentPermissions
    const updateFields = { 
      'wallet.tradingBalance': newTradingBalance,
      'wallet.usedMargin': newUsedMargin,
      'wallet.blocked': newBlocked
    };
    
    // Update crypto wallet if it's a crypto trade
    if (isCrypto) {
      updateFields['cryptoWallet.balance'] = newCryptoBalance;
    }
    
    await User.updateOne(
      { _id: user._id },
      { $set: updateFields }
    );
    
    // Update local user object
    user.wallet.tradingBalance = newTradingBalance;
    user.wallet.usedMargin = newUsedMargin;
    user.wallet.blocked = newBlocked;
    if (isCrypto) {
      if (!user.cryptoWallet) user.cryptoWallet = {};
      user.cryptoWallet.balance = newCryptoBalance;
    }
    
    await trade.save();

    // Check margin usage and send warning if > 70% (only for non-crypto trades)
    if (!isCrypto) {
      await checkMarginWarning(user, newUsedMargin, newTradingBalance);
    }

    return {
      success: true,
      trade,
      marginBlocked: marginRequired,
      tradeValue: marginCalc.tradeValue,
      leverage,
      spread: spreadPoints,
      commission: totalCommission,
      totalCharges: totalCharges,
      availableBalance: availableBalance - marginRequired - totalCommission
    };
  }

  // Execute pending order when price matches
  static async executePendingOrder(tradeId, currentPrice) {
    const trade = await Trade.findById(tradeId);
    if (!trade || trade.status !== 'PENDING') return null;

    let shouldExecute = false;

    if (trade.orderType === 'LIMIT') {
      if (trade.side === 'BUY' && currentPrice <= trade.limitPrice) shouldExecute = true;
      else if (trade.side === 'SELL' && currentPrice >= trade.limitPrice) shouldExecute = true;
    } else if (trade.orderType === 'SL' || trade.orderType === 'SL-M') {
      if (trade.side === 'BUY' && currentPrice >= trade.triggerPrice) shouldExecute = true;
      else if (trade.side === 'SELL' && currentPrice <= trade.triggerPrice) shouldExecute = true;
    }

    if (shouldExecute) {
      trade.status = 'OPEN';
      trade.entryPrice = currentPrice;
      trade.currentPrice = currentPrice;
      trade.openedAt = new Date();
      await trade.save();
      return trade;
    }

    return null;
  }

  // Check stop loss and target
  static async checkStopLossTarget(tradeId, currentPrice) {
    const trade = await Trade.findById(tradeId);
    if (!trade || trade.status !== 'OPEN') return null;

    let shouldClose = false;
    let closeReason = null;

    if (trade.stopLoss) {
      if (trade.side === 'BUY' && currentPrice <= trade.stopLoss) {
        shouldClose = true;
        closeReason = 'STOP_LOSS';
      } else if (trade.side === 'SELL' && currentPrice >= trade.stopLoss) {
        shouldClose = true;
        closeReason = 'STOP_LOSS';
      }
    }

    if (trade.target && !shouldClose) {
      if (trade.side === 'BUY' && currentPrice >= trade.target) {
        shouldClose = true;
        closeReason = 'TARGET';
      } else if (trade.side === 'SELL' && currentPrice <= trade.target) {
        shouldClose = true;
        closeReason = 'TARGET';
      }
    }

    if (shouldClose) {
      return await this.closeTrade(tradeId, currentPrice, closeReason);
    }

    return null;
  }

  // Close trade
  static async closeTrade(tradeId, exitPrice, reason = 'MANUAL') {
    const trade = await Trade.findById(tradeId);
    if (!trade || trade.status !== 'OPEN') {
      throw new Error('Trade not found or already closed');
    }

    const user = await User.findById(trade.user);
    if (!user) throw new Error('User not found');

    // Apply spread to exit price (opposite of entry)
    const spreadPoints = trade.spread || 0;
    let effectiveExitPrice = exitPrice;
    
    if (spreadPoints > 0) {
      if (trade.side === 'BUY') {
        // When closing a BUY, we SELL - so we get lower price
        effectiveExitPrice = exitPrice - spreadPoints;
      } else {
        // When closing a SELL, we BUY - so we pay higher price
        effectiveExitPrice = exitPrice + spreadPoints;
      }
    }

    // Calculate P&L based on entry price (which already has spread applied) and effective exit price
    const multiplier = trade.side === 'BUY' ? 1 : -1;
    const priceDiff = (effectiveExitPrice - trade.entryPrice) * multiplier;
    const grossPnL = priceDiff * trade.quantity;
    
    // Net P&L is gross P&L (commission was already deducted at entry)
    const netPnL = grossPnL;

    trade.exitPrice = exitPrice; // Store actual market exit price
    trade.effectiveExitPrice = effectiveExitPrice; // Store effective exit price after spread
    trade.status = 'CLOSED';
    trade.closeReason = reason;
    trade.closedAt = new Date();
    trade.realizedPnL = grossPnL;
    trade.pnl = grossPnL;
    trade.unrealizedPnL = 0;
    trade.netPnL = netPnL;
    trade.adminPnL = -grossPnL; // Admin's P&L is opposite (B-book)

    await trade.save();

    // Release blocked margin and add/subtract P&L to tradingBalance (dual wallet system)
    // For crypto trades, use separate cryptoWallet - no margin system
    let newUsedMargin, newBlocked, newTradingBalance, newCryptoBalance, newCryptoRealizedPnL;
    
    if (trade.isCrypto) {
      // Crypto trades: Return trade cost (marginUsed) + P&L to crypto wallet
      // marginUsed stores the original trade cost for crypto trades
      const tradeCostReturned = trade.marginUsed || 0;
      newUsedMargin = user.wallet.usedMargin || 0; // No change to regular wallet
      newBlocked = user.wallet.blocked || 0; // No change
      newTradingBalance = user.wallet.tradingBalance || 0; // No change to regular trading balance
      // Return the trade cost + add P&L (can be negative for loss)
      newCryptoBalance = (user.cryptoWallet?.balance || 0) + tradeCostReturned + netPnL;
      newCryptoRealizedPnL = (user.cryptoWallet?.realizedPnL || 0) + netPnL;
      console.log(`Crypto trade closed: Returning $${tradeCostReturned.toFixed(2)} + P&L $${netPnL.toFixed(2)} to crypto wallet`);
    } else {
      // Regular trades: Release margin and add P&L
      newUsedMargin = Math.max(0, (user.wallet.usedMargin || 0) - trade.marginUsed);
      newBlocked = Math.max(0, (user.wallet.blocked || 0) - trade.marginUsed);
      newTradingBalance = (user.wallet.tradingBalance || 0) + trade.marginUsed + netPnL;
      newCryptoBalance = user.cryptoWallet?.balance || 0; // Unchanged
      newCryptoRealizedPnL = user.cryptoWallet?.realizedPnL || 0; // Unchanged
    }
    
    // Prevent negative balances
    newTradingBalance = Math.max(0, newTradingBalance);
    newCryptoBalance = Math.max(0, newCryptoBalance);
    
    const newRealizedPnL = trade.isCrypto 
      ? (user.wallet.realizedPnL || 0) // Don't add crypto P&L to regular wallet
      : (user.wallet.realizedPnL || 0) + netPnL;
    
    // Use updateOne to avoid validation issues with segmentPermissions
    const updateFields = { 
      'wallet.usedMargin': newUsedMargin,
      'wallet.blocked': newBlocked,
      'wallet.tradingBalance': newTradingBalance,
      'wallet.realizedPnL': newRealizedPnL
    };
    
    // Update crypto wallet if it's a crypto trade
    if (trade.isCrypto) {
      updateFields['cryptoWallet.balance'] = newCryptoBalance;
      updateFields['cryptoWallet.realizedPnL'] = newCryptoRealizedPnL;
    }
    
    await User.updateOne(
      { _id: user._id },
      { $set: updateFields }
    );

    return { 
      trade, 
      pnl: netPnL,
      grossPnL,
      exitPrice,
      effectiveExitPrice,
      spread: spreadPoints
    };
  }

  // Update P&L for all open trades
  static async updateTradesPnL(priceUpdates) {
    const openTrades = await Trade.find({ status: 'OPEN' });
    const results = [];

    for (const trade of openTrades) {
      const currentPrice = priceUpdates[trade.symbol];
      if (!currentPrice) continue;

      const multiplier = trade.side === 'BUY' ? 1 : -1;
      const priceDiff = (currentPrice - trade.entryPrice) * multiplier;
      trade.unrealizedPnL = priceDiff * trade.quantity;
      trade.currentPrice = currentPrice;
      await trade.save();

      const closeResult = await this.checkStopLossTarget(trade._id, currentPrice);
      if (closeResult) {
        results.push({ trade: closeResult.trade, action: 'CLOSED', reason: closeResult.trade.closeReason });
        continue;
      }

      // Margin call check
      const user = await User.findById(trade.user);
      if (user && trade.unrealizedPnL < 0) {
        const walletBalance = user.wallet?.tradingBalance || user.wallet?.cashBalance || user.wallet?.balance || 0;
        const blockedMargin = user.wallet?.usedMargin || user.wallet?.blocked || 0;
        const availableBalance = walletBalance - blockedMargin;
        if (Math.abs(trade.unrealizedPnL) >= availableBalance) {
          const closeResult = await this.closeTrade(trade._id, currentPrice, 'RMS');
          results.push({ trade: closeResult.trade, action: 'MARGIN_CALL', pnl: closeResult.pnl });
        }
      }
    }

    return results;
  }

  // Get positions - optimized with lean() for faster response
  static async getPositions(userId, status = 'OPEN') {
    return Trade.find({ user: userId, status })
      .select('userId symbol token pair isCrypto exchange segment instrumentType optionType strike expiry side productType quantity lotSize lots entryPrice currentPrice marketPrice unrealizedPnL marginUsed leverage spread commission status openedAt')
      .sort({ openedAt: -1 })
      .lean();
  }

  // Get pending orders - optimized
  static async getPendingOrders(userId) {
    return Trade.find({ user: userId, status: 'PENDING' })
      .select('userId symbol exchange segment side productType quantity lots entryPrice limitPrice triggerPrice marginUsed status createdAt orderType isCrypto commission')
      .sort({ createdAt: -1 })
      .lean();
  }

  // Get trade history - optimized
  static async getTradeHistory(userId, limit = 50) {
    return Trade.find({ user: userId, status: 'CLOSED' })
      .select('userId symbol exchange segment side productType quantity lots entryPrice exitPrice realizedPnL netPnL marginUsed commission closedAt createdAt openedAt closeReason isCrypto status')
      .sort({ closedAt: -1 })
      .limit(limit)
      .lean();
  }

  // Get wallet summary - optimized with aggregation for faster P&L
  static async getWalletSummary(userId) {
    const user = await User.findById(userId).select('wallet').lean();
    if (!user) throw new Error('User not found');

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Use aggregation for faster P&L calculation
    const [openStats, closedStats] = await Promise.all([
      Trade.aggregate([
        { $match: { user: userId, status: 'OPEN' } },
        { $group: {
          _id: null,
          unrealizedPnL: { $sum: { $ifNull: ['$unrealizedPnL', 0] } },
          marginUsed: { $sum: { $ifNull: ['$marginUsed', 0] } },
          count: { $sum: 1 }
        }}
      ]),
      Trade.aggregate([
        { $match: { user: userId, status: 'CLOSED', closedAt: { $gte: todayStart } } },
        { $group: {
          _id: null,
          realizedPnL: { $sum: { $ifNull: ['$realizedPnL', 0] } }
        }}
      ])
    ]);

    const unrealizedPnL = openStats[0]?.unrealizedPnL || 0;
    const marginUsed = openStats[0]?.marginUsed || 0;
    const openPositions = openStats[0]?.count || 0;
    const realizedPnL = closedStats[0]?.realizedPnL || 0;

    // Use tradingBalance for trading (dual wallet system)
    const walletBalance = user.wallet?.tradingBalance || user.wallet?.cashBalance || user.wallet?.balance || 0;
    const blockedMargin = user.wallet?.usedMargin || user.wallet?.blocked || 0;
    
    return {
      balance: walletBalance,
      tradingBalance: walletBalance,
      blocked: blockedMargin,
      usedMargin: blockedMargin,
      available: walletBalance - blockedMargin,
      availableMargin: walletBalance - blockedMargin,
      unrealizedPnL,
      realizedPnL,
      totalPnL: unrealizedPnL + realizedPnL,
      marginUsed,
      openPositions
    };
  }

  // Cancel order
  static async cancelOrder(tradeId, userId) {
    const trade = await Trade.findOne({ _id: tradeId, user: userId, status: 'PENDING' });
    if (!trade) throw new Error('Pending order not found');

    const user = await User.findById(userId);
    // Release blocked margin - update both primary and legacy fields
    // For crypto trades, no margin was blocked
    let newUsedMargin, newBlocked, newTradingBalance;
    
    if (trade.isCrypto) {
      // Crypto trades: No margin to release
      newUsedMargin = user.wallet.usedMargin || 0; // No change
      newBlocked = user.wallet.blocked || 0; // No change
      newTradingBalance = user.wallet.tradingBalance || 0; // No change
      console.log('Crypto order cancelled: No margin to release');
    } else {
      // Regular trades: Release margin
      newUsedMargin = Math.max(0, (user.wallet.usedMargin || 0) - trade.marginUsed);
      newBlocked = Math.max(0, (user.wallet.blocked || 0) - trade.marginUsed);
      newTradingBalance = (user.wallet.tradingBalance || 0) + trade.marginUsed;
    }
    
    await User.updateOne(
      { _id: userId },
      { $set: { 
        'wallet.usedMargin': newUsedMargin,
        'wallet.blocked': newBlocked,
        'wallet.tradingBalance': newTradingBalance
      }}
    );

    trade.status = 'CANCELLED';
    await trade.save();

    return { success: true, trade };
  }

  // Legacy methods
  static async getOrders(userId, status = null) {
    const query = { user: userId };
    if (status) query.status = status;
    return Trade.find(query).sort({ createdAt: -1 });
  }

  static async squareOffPosition(positionId, reason = 'MANUAL', exitPrice = null, bidPrice = null, askPrice = null) {
    const trade = await Trade.findById(positionId);
    if (!trade) throw new Error('Position not found');
    
    // Check if this is a crypto trade
    const isCrypto = trade.isCrypto || trade.segment === 'CRYPTO' || trade.exchange === 'BINANCE';
    
    // Indian Net Trading: Use correct price based on position side
    // BUY position closes at Bid price (you sell at bid)
    // SELL position closes at Ask price (you buy at ask)
    let price = exitPrice || trade.currentPrice || trade.entryPrice;
    
    // Priority for exit price:
    // 1. Specific bid/ask based on position side
    // 2. Explicit exitPrice parameter
    // 3. Trade's current market price
    // 4. Trade's entry price as last resort
    if (trade.side === 'BUY') {
      // Closing a BUY = selling, use bid price
      price = bidPrice || exitPrice || trade.currentPrice || trade.entryPrice;
    } else {
      // Closing a SELL = buying, use ask price
      price = askPrice || exitPrice || trade.currentPrice || trade.entryPrice;
    }
    
    // For crypto: always use entry price if no valid price (crypto prices may not be in marketData)
    if (isCrypto && (!price || price <= 0)) {
      price = trade.entryPrice;
      console.log(`Crypto trade: Using entry price ${price} as exit price`);
    }
    
    // Validate price is reasonable (not zero or negative)
    if (!price || price <= 0) {
      throw new Error('Invalid exit price. Please try again with valid market data.');
    }
    
    console.log(`Closing ${trade.side} position ${positionId}: exitPrice=${price}, bid=${bidPrice}, ask=${askPrice}, current=${trade.currentPrice}, isCrypto=${isCrypto}`);
    
    return this.closeTrade(positionId, price, reason);
  }

  static async processPendingOrders(priceUpdates) {
    const pendingTrades = await Trade.find({ status: 'PENDING' });
    const results = [];

    for (const trade of pendingTrades) {
      const currentPrice = priceUpdates[trade.symbol];
      if (!currentPrice) continue;

      const executed = await this.executePendingOrder(trade._id, currentPrice);
      if (executed) {
        results.push({ trade: executed, action: 'EXECUTED' });
      }
    }

    return results;
  }

  static async getMarketStatus(exchange = 'NSE') {
    return await this.isMarketOpen(exchange);
  }

  // Recalculate and sync margin based on actual open positions
  // This fixes stale margin issues when positions are closed but margin wasn't properly released
  static async recalculateMargin(userId) {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    // Get all open positions for this user
    const openTrades = await Trade.find({ user: userId, status: 'OPEN' });
    
    // Calculate total margin that should be blocked
    // Only count non-crypto trades (crypto doesn't use margin)
    let totalMarginUsed = 0;
    for (const trade of openTrades) {
      if (!trade.isCrypto) {
        totalMarginUsed += trade.marginUsed || 0;
      }
    }
    
    const currentUsedMargin = user.wallet.usedMargin || 0;
    const currentBlocked = user.wallet.blocked || 0;
    
    // If there's a discrepancy, fix it
    if (currentUsedMargin !== totalMarginUsed || currentBlocked !== totalMarginUsed) {
      const difference = currentUsedMargin - totalMarginUsed;
      
      // Update user wallet with correct margin values
      await User.updateOne(
        { _id: userId },
        { $set: { 
          'wallet.usedMargin': totalMarginUsed,
          'wallet.blocked': totalMarginUsed,
          // If margin was incorrectly blocked, add it back to trading balance
          'wallet.tradingBalance': (user.wallet.tradingBalance || 0) + difference
        }}
      );
      
      console.log(`Margin recalculated for user ${userId}: was ${currentUsedMargin}, now ${totalMarginUsed}, difference ${difference} added back to trading balance`);
      
      return {
        success: true,
        previousMargin: currentUsedMargin,
        correctedMargin: totalMarginUsed,
        difference,
        openPositions: openTrades.length,
        cryptoPositions: openTrades.filter(t => t.isCrypto).length
      };
    }
    
    return {
      success: true,
      message: 'Margin is already correct',
      usedMargin: totalMarginUsed,
      openPositions: openTrades.length
    };
  }
}

export default TradingService;
