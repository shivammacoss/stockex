import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const walletTransactionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['deposit', 'withdraw', 'credit', 'debit'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Generate unique user ID
const generateUserId = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `USR${timestamp}${random}`;
};

const userSchema = new mongoose.Schema({
  // Unique user ID
  userId: {
    type: String,
    unique: true
  },
  
  // Admin code - links user to their creator (can be changed by Super Admin for transfers)
  adminCode: {
    type: String,
    required: false,
    index: true
  },
  
  // Reference to the admin/broker/sub-broker who directly manages this user
  admin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: false // Not required for demo accounts
  },
  
  // Demo Account Fields
  isDemo: {
    type: Boolean,
    default: false
  },
  demoExpiresAt: {
    type: Date,
    default: null
  },
  demoCreatedAt: {
    type: Date,
    default: null
  },
  
  // Role of the creator (ADMIN, BROKER, or SUB_BROKER)
  creatorRole: {
    type: String,
    enum: ['SUPER_ADMIN', 'ADMIN', 'BROKER', 'SUB_BROKER'],
    default: 'ADMIN'
  },
  
  // Hierarchy path - array of all ancestor admin IDs (for efficient queries)
  // e.g., [superAdminId, adminId, brokerId] for a user created by broker
  hierarchyPath: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  }],
  
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  fullName: {
    type: String,
    default: ''
  },
  phone: {
    type: String,
    default: ''
  },
  role: {
    type: String,
    default: 'user'
  },
  
  // Trading status
  tradingStatus: {
    type: String,
    enum: ['ACTIVE', 'BLOCKED', 'SUSPENDED'],
    default: 'ACTIVE'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Session token for single device login - only one active session at a time
  activeSessionToken: {
    type: String,
    default: null
  },
  lastLoginAt: {
    type: Date,
    default: null
  },
  lastLoginDevice: {
    type: String,
    default: null
  },
  // Enhanced Wallet System
  wallet: {
    // Cash Balance (Free Balance) - Main wallet where admin deposits funds
    cashBalance: {
      type: Number,
      default: 0
    },
    // Trading Balance - Funds available for trading (transferred from main wallet)
    tradingBalance: {
      type: Number,
      default: 0
    },
    // Used Margin - Currently blocked for open positions
    usedMargin: {
      type: Number,
      default: 0
    },
    // Collateral Value (Stocks pledged, FD, etc.)
    collateralValue: {
      type: Number,
      default: 0
    },
    // Realized P&L - Booked profit/loss from closed trades
    realizedPnL: {
      type: Number,
      default: 0
    },
    // Unrealized P&L - Live profit/loss from open positions (MTM)
    unrealizedPnL: {
      type: Number,
      default: 0
    },
    // Today's Realized P&L
    todayRealizedPnL: {
      type: Number,
      default: 0
    },
    // Today's Unrealized P&L
    todayUnrealizedPnL: {
      type: Number,
      default: 0
    },
    // Legacy balance field for backward compatibility
    balance: {
      type: Number,
      default: 0
    },
    transactions: [walletTransactionSchema]
  },
  
  // Separate Crypto Wallet - No margin system, spot trading only
  cryptoWallet: {
    // Crypto Balance in USD
    balance: {
      type: Number,
      default: 0
    },
    // Realized P&L from crypto trades
    realizedPnL: {
      type: Number,
      default: 0
    },
    // Unrealized P&L from open crypto positions
    unrealizedPnL: {
      type: Number,
      default: 0
    },
    // Today's Realized P&L
    todayRealizedPnL: {
      type: Number,
      default: 0
    }
  },
  
  // Separate MCX Wallet - For MCX Futures and Options trading only
  mcxWallet: {
    // MCX Trading Balance in INR
    balance: {
      type: Number,
      default: 0
    },
    // Used Margin - Currently blocked for open MCX positions
    usedMargin: {
      type: Number,
      default: 0
    },
    // Realized P&L from MCX trades
    realizedPnL: {
      type: Number,
      default: 0
    },
    // Unrealized P&L from open MCX positions
    unrealizedPnL: {
      type: Number,
      default: 0
    },
    // Today's Realized P&L
    todayRealizedPnL: {
      type: Number,
      default: 0
    },
    // Today's Unrealized P&L
    todayUnrealizedPnL: {
      type: Number,
      default: 0
    }
  },
  // Margin Settings
  marginSettings: {
    // Equity Intraday Leverage (e.g., 5 means 5x)
    equityIntradayLeverage: {
      type: Number,
      default: 5
    },
    // F&O Leverage
    foLeverage: {
      type: Number,
      default: 1
    },
    // Max loss percentage before RMS kicks in
    maxLossPercent: {
      type: Number,
      default: 80 // 80% of margin
    },
    // Auto square-off enabled
    autoSquareOff: {
      type: Boolean,
      default: true
    }
  },
  // RMS (Risk Management) Settings
  rmsSettings: {
    // Is RMS active for this user
    isActive: {
      type: Boolean,
      default: true
    },
    // Last RMS check timestamp
    lastCheck: {
      type: Date,
      default: null
    },
    // RMS triggered count today
    triggeredCount: {
      type: Number,
      default: 0
    },
    // Is trading blocked due to RMS
    tradingBlocked: {
      type: Boolean,
      default: false
    },
    blockReason: {
      type: String,
      default: null
    }
  },
  
  // ========== NEW USER SETTINGS ==========
  
  // Account Settings
  settings: {
    // Margin Type: 'exposure' or 'margin'
    marginType: {
      type: String,
      enum: ['exposure', 'margin'],
      default: 'exposure'
    },
    
    // Ledger Balance Close % - Close positions when loss reaches X% of ledger
    ledgerBalanceClosePercent: {
      type: Number,
      default: 90
    },
    
    // Profit Trade Hold Min Seconds
    profitTradeHoldSeconds: {
      type: Number,
      default: 0
    },
    
    // Loss Trade Hold Min Seconds
    lossTradeHoldSeconds: {
      type: Number,
      default: 0
    },
    
    // Toggle Settings
    isActivated: {
      type: Boolean,
      default: true
    },
    isReadOnly: {
      type: Boolean,
      default: false
    },
    isDemo: {
      type: Boolean,
      default: false
    },
    intradaySquare: {
      type: Boolean,
      default: false
    },
    blockLimitAboveBelowHighLow: {
      type: Boolean,
      default: false
    },
    blockLimitBetweenHighLow: {
      type: Boolean,
      default: false
    }
  },
  
  // Segment Permissions - Detailed settings for each segment
  segmentPermissions: {
    type: Map,
    of: {
      enabled: { type: Boolean, default: false },
      maxExchangeLots: { type: Number, default: 100 },
      commissionType: { type: String, enum: ['PER_LOT', 'PER_TRADE', 'PER_CRORE'], default: 'PER_LOT' },
      commissionLot: { type: Number, default: 0 },
      maxLots: { type: Number, default: 50 },
      minLots: { type: Number, default: 1 },
      orderLots: { type: Number, default: 10 },
      exposureIntraday: { type: Number, default: 1 },
      exposureCarryForward: { type: Number, default: 1 },
      // Option Buy Settings
      optionBuy: {
        allowed: { type: Boolean, default: true },
        commissionType: { type: String, enum: ['PER_LOT', 'PER_TRADE', 'PER_CRORE'], default: 'PER_LOT' },
        commission: { type: Number, default: 0 },
        strikeSelection: { type: Number, default: 50 }, // Number of strikes up/down from ATM
        maxExchangeLots: { type: Number, default: 100 }
      },
      // Option Sell Settings
      optionSell: {
        allowed: { type: Boolean, default: true },
        commissionType: { type: String, enum: ['PER_LOT', 'PER_TRADE', 'PER_CRORE'], default: 'PER_LOT' },
        commission: { type: Number, default: 0 },
        strikeSelection: { type: Number, default: 50 }, // Number of strikes up/down from ATM
        maxExchangeLots: { type: Number, default: 100 }
      }
    },
    default: {
      MCX: { enabled: true, maxExchangeLots: 100, commissionType: 'PER_LOT', commissionLot: 0, maxLots: 50, minLots: 1, orderLots: 10, exposureIntraday: 1, exposureCarryForward: 1, optionBuy: { allowed: true, commissionType: 'PER_LOT', commission: 0, strikeSelection: 50, maxExchangeLots: 100 }, optionSell: { allowed: true, commissionType: 'PER_LOT', commission: 0, strikeSelection: 50, maxExchangeLots: 100 } },
      NSEINDEX: { enabled: true, maxExchangeLots: 100, commissionType: 'PER_LOT', commissionLot: 0, maxLots: 50, minLots: 1, orderLots: 10, exposureIntraday: 1, exposureCarryForward: 1, optionBuy: { allowed: true, commissionType: 'PER_LOT', commission: 0, strikeSelection: 50, maxExchangeLots: 100 }, optionSell: { allowed: true, commissionType: 'PER_LOT', commission: 0, strikeSelection: 50, maxExchangeLots: 100 } },
      NSESTOCK: { enabled: true, maxExchangeLots: 100, commissionType: 'PER_LOT', commissionLot: 0, maxLots: 50, minLots: 1, orderLots: 10, exposureIntraday: 1, exposureCarryForward: 1, optionBuy: { allowed: true, commissionType: 'PER_LOT', commission: 0, strikeSelection: 50, maxExchangeLots: 100 }, optionSell: { allowed: true, commissionType: 'PER_LOT', commission: 0, strikeSelection: 50, maxExchangeLots: 100 } },
      BSE: { enabled: false, maxExchangeLots: 100, commissionType: 'PER_LOT', commissionLot: 0, maxLots: 50, minLots: 1, orderLots: 10, exposureIntraday: 1, exposureCarryForward: 1, optionBuy: { allowed: true, commissionType: 'PER_LOT', commission: 0, strikeSelection: 50, maxExchangeLots: 100 }, optionSell: { allowed: true, commissionType: 'PER_LOT', commission: 0, strikeSelection: 50, maxExchangeLots: 100 } },
      EQ: { enabled: true, maxExchangeLots: 100, commissionType: 'PER_LOT', commissionLot: 0, maxLots: 50, minLots: 1, orderLots: 10, exposureIntraday: 1, exposureCarryForward: 1, optionBuy: { allowed: true, commissionType: 'PER_LOT', commission: 0, strikeSelection: 50, maxExchangeLots: 100 }, optionSell: { allowed: true, commissionType: 'PER_LOT', commission: 0, strikeSelection: 50, maxExchangeLots: 100 } }
    }
  },
  
  // Global Script Settings - Override segment settings for specific scripts (applies to all segments)
  scriptSettings: {
    type: Map,
    of: {
      lotSettings: {
        maxLots: { type: Number, default: 50 },
        minLots: { type: Number, default: 1 },
        perOrderLots: { type: Number, default: 10 }
      },
      quantitySettings: {
        maxQuantity: { type: Number, default: 1000 },
        minQuantity: { type: Number, default: 1 },
        perOrderQuantity: { type: Number, default: 100 }
      },
      fixedMargin: {
        intradayFuture: { type: Number, default: 0 },
        carryFuture: { type: Number, default: 0 },
        optionBuyIntraday: { type: Number, default: 0 },
        optionBuyCarry: { type: Number, default: 0 },
        optionSellIntraday: { type: Number, default: 0 },
        optionSellCarry: { type: Number, default: 0 }
      },
      brokerage: {
        intradayFuture: { type: Number, default: 0 },
        carryFuture: { type: Number, default: 0 },
        optionBuyIntraday: { type: Number, default: 0 },
        optionBuyCarry: { type: Number, default: 0 },
        optionSellIntraday: { type: Number, default: 0 },
        optionSellCarry: { type: Number, default: 0 }
      },
      spread: {
        buy: { type: Number, default: 0 },
        sell: { type: Number, default: 0 }
      },
      blocked: { type: Boolean, default: false }
    },
    default: {}
  },
  
  // Allowed Segments (simplified list)
  allowedSegments: [{
    type: String,
    enum: ['NSE', 'MCX', 'BFO', 'EQ', 'CRYPTO', 'COMEX', 'FOREX', 'GLOBALINDEX']
  }],
  
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  }
}, { timestamps: true });

// Virtual: Calculate Available Margin
userSchema.virtual('availableMargin').get(function() {
  return this.wallet.cashBalance 
    + this.wallet.collateralValue 
    + Math.max(0, this.wallet.unrealizedPnL) // Only add unrealized profit
    - Math.abs(Math.min(0, this.wallet.unrealizedPnL)) // Subtract unrealized loss
    - this.wallet.usedMargin;
});

// Virtual: Total Balance (for display)
userSchema.virtual('totalBalance').get(function() {
  return this.wallet.cashBalance + this.wallet.realizedPnL;
});

// Method: Check if user can place order
userSchema.methods.canPlaceOrder = function(requiredMargin) {
  if (this.rmsSettings.tradingBlocked) return { allowed: false, reason: this.rmsSettings.blockReason };
  if (!this.isActive) return { allowed: false, reason: 'Account is inactive' };
  
  const available = this.wallet.cashBalance 
    + this.wallet.collateralValue 
    + Math.max(0, this.wallet.unrealizedPnL)
    - Math.abs(Math.min(0, this.wallet.unrealizedPnL))
    - this.wallet.usedMargin;
  
  if (available < requiredMargin) {
    return { allowed: false, reason: 'Insufficient margin', available, required: requiredMargin };
  }
  
  return { allowed: true, available };
};

// Method: Block margin for order
userSchema.methods.blockMargin = function(amount) {
  this.wallet.usedMargin += amount;
  return this.save();
};

// Method: Release margin
userSchema.methods.releaseMargin = function(amount) {
  this.wallet.usedMargin = Math.max(0, this.wallet.usedMargin - amount);
  return this.save();
};

// Method: Update unrealized P&L
userSchema.methods.updateUnrealizedPnL = function(amount) {
  this.wallet.unrealizedPnL = amount;
  this.wallet.todayUnrealizedPnL = amount;
  return this.save();
};

// Method: Book realized P&L
userSchema.methods.bookRealizedPnL = function(amount) {
  this.wallet.realizedPnL += amount;
  this.wallet.todayRealizedPnL += amount;
  this.wallet.cashBalance += amount; // Add to cash balance
  return this.save();
};

userSchema.pre('save', async function(next) {
  // Generate userId for new users
  if (this.isNew && !this.userId) {
    let id = generateUserId();
    let exists = await mongoose.model('User').findOne({ userId: id });
    while (exists) {
      id = generateUserId();
      exists = await mongoose.model('User').findOne({ userId: id });
    }
    this.userId = id;
  }
  
  // Hash password if modified
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 12);
  }
  
  // Prevent wallet balances from going negative
  if (this.wallet) {
    if (this.wallet.cashBalance < 0) this.wallet.cashBalance = 0;
    if (this.wallet.tradingBalance < 0) this.wallet.tradingBalance = 0;
    if (this.wallet.balance < 0) this.wallet.balance = 0;
    if (this.wallet.usedMargin < 0) this.wallet.usedMargin = 0;
    if (this.wallet.blocked < 0) this.wallet.blocked = 0;
  }
  if (this.cryptoWallet && this.cryptoWallet.balance < 0) {
    this.cryptoWallet.balance = 0;
  }
  if (this.mcxWallet) {
    if (this.mcxWallet.balance < 0) this.mcxWallet.balance = 0;
    if (this.mcxWallet.usedMargin < 0) this.mcxWallet.usedMargin = 0;
  }
  
  next();
});

// Index for faster queries
userSchema.index({ adminCode: 1, isActive: 1 });
userSchema.index({ adminCode: 1, tradingStatus: 1 });
userSchema.index({ hierarchyPath: 1 });
userSchema.index({ creatorRole: 1 });
userSchema.index({ admin: 1, creatorRole: 1 });
userSchema.index({ isDemo: 1, demoExpiresAt: 1 });

userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model('User', userSchema);
