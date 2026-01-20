import mongoose from 'mongoose';

const instrumentSchema = new mongoose.Schema({
  // Angel One token for WebSocket subscription
  token: {
    type: String,
    required: true,
    unique: true
  },
  
  // Trading symbol
  symbol: {
    type: String,
    required: true,
    index: true
  },
  
  // Display name
  name: {
    type: String,
    required: true
  },
  
  // Exchange
  exchange: {
    type: String,
    enum: ['NSE', 'BSE', 'NFO', 'MCX', 'CDS', 'BFO', 'BINANCE', 'CRYPTO'],
    required: true
  },
  
  // Segment (internal)
  segment: {
    type: String,
    enum: ['EQUITY', 'FNO', 'COMMODITY', 'CURRENCY', 'MCX', 'CRYPTO'],
    required: true
  },
  
  // Display Segment (for UI tabs) - matches user allowedSegments
  displaySegment: {
    type: String,
    enum: ['NSEFUT', 'NSEOPT', 'MCXFUT', 'MCXOPT', 'NSE-EQ', 'BSE-FUT', 'BSE-OPT'],
    default: 'NSE-EQ',
    index: true
  },
  
  // Instrument type
  instrumentType: {
    type: String,
    enum: ['STOCK', 'INDEX', 'FUTURES', 'OPTIONS', 'COMMODITY', 'CRYPTO'],
    required: true
  },
  
  // For Crypto - trading pair (e.g., BTCUSDT)
  pair: {
    type: String,
    default: null
  },
  
  // Is this a crypto instrument
  isCrypto: {
    type: Boolean,
    default: false
  },
  
  // For F&O
  expiry: {
    type: Date,
    default: null
  },
  strike: {
    type: Number,
    default: null
  },
  optionType: {
    type: String,
    enum: ['CE', 'PE', null],
    default: null
  },
  
  // Lot size
  lotSize: {
    type: Number,
    default: 1
  },
  
  // Tick size
  tickSize: {
    type: Number,
    default: 0.05
  },
  
  // Live price data (updated via WebSocket)
  ltp: {
    type: Number,
    default: 0
  },
  open: {
    type: Number,
    default: 0
  },
  high: {
    type: Number,
    default: 0
  },
  low: {
    type: Number,
    default: 0
  },
  close: {
    type: Number,
    default: 0
  },
  change: {
    type: Number,
    default: 0
  },
  changePercent: {
    type: Number,
    default: 0
  },
  volume: {
    type: Number,
    default: 0
  },
  
  // Last updated timestamp
  lastUpdated: {
    type: Date,
    default: null
  },
  
  // Admin controls
  isEnabled: {
    type: Boolean,
    default: true,
    index: true
  },
  
  // Per-admin visibility (if empty, visible to all)
  visibleToAdmins: [{
    type: String // adminCode
  }],
  
  // Hidden from specific admins
  hiddenFromAdmins: [{
    type: String // adminCode
  }],
  
  // Category for grouping
  category: {
    type: String,
    enum: ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'STOCKS', 'INDICES', 'MCX', 'COMMODITY', 'CURRENCY', 'CRYPTO', 'BSE', 'OTHER'],
    default: 'OTHER'
  },
  
  // Trading symbol from exchange (for Zerodha)
  tradingSymbol: {
    type: String,
    default: null
  },
  
  // Sort order
  sortOrder: {
    type: Number,
    default: 0
  },
  
  // Is this a popular/featured instrument
  isFeatured: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

// Compound index for efficient queries
instrumentSchema.index({ exchange: 1, segment: 1, isEnabled: 1 });
instrumentSchema.index({ category: 1, isEnabled: 1 });
instrumentSchema.index({ symbol: 'text', name: 'text' });

// Static method to get enabled instruments for a user's admin
instrumentSchema.statics.getEnabledForAdmin = async function(adminCode) {
  return this.find({
    isEnabled: true,
    $or: [
      { visibleToAdmins: { $size: 0 } }, // Visible to all
      { visibleToAdmins: adminCode } // Specifically visible to this admin
    ],
    hiddenFromAdmins: { $ne: adminCode } // Not hidden from this admin
  }).sort({ category: 1, sortOrder: 1, symbol: 1 });
};

// Static method to update price from WebSocket
instrumentSchema.statics.updatePrice = async function(token, priceData) {
  const { ltp, open, high, low, close, volume } = priceData;
  
  const change = ltp - close;
  const changePercent = close > 0 ? ((ltp - close) / close) * 100 : 0;
  
  return this.findOneAndUpdate(
    { token },
    {
      ltp,
      open,
      high,
      low,
      close,
      volume,
      change,
      changePercent: Math.round(changePercent * 100) / 100,
      lastUpdated: new Date()
    },
    { new: true }
  );
};

export default mongoose.model('Instrument', instrumentSchema);
