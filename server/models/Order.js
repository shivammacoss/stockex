import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  symbol: {
    type: String,
    required: true
  },
  exchange: {
    type: String,
    enum: ['NSE', 'BSE', 'MCX'],
    required: true
  },
  segment: {
    type: String,
    enum: ['equity', 'futures', 'options'],
    required: true
  },
  optionType: {
    type: String,
    enum: ['CE', 'PE', null],
    default: null
  },
  strikePrice: {
    type: Number,
    default: null
  },
  expiry: {
    type: Date,
    default: null
  },
  productType: {
    type: String,
    enum: ['CNC', 'MIS', 'NRML'],
    required: true
  },
  orderType: {
    type: String,
    enum: ['MARKET', 'LIMIT', 'SL', 'SL-M'],
    required: true
  },
  side: {
    type: String,
    enum: ['BUY', 'SELL'],
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },
  lotSize: {
    type: Number,
    default: 1
  },
  price: {
    type: Number,
    default: 0 // For LIMIT orders
  },
  triggerPrice: {
    type: Number,
    default: 0 // For SL orders
  },
  executedPrice: {
    type: Number,
    default: null
  },
  executedQuantity: {
    type: Number,
    default: 0
  },
  marginBlocked: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['PENDING', 'OPEN', 'EXECUTED', 'PARTIALLY_EXECUTED', 'CANCELLED', 'REJECTED'],
    default: 'PENDING'
  },
  rejectionReason: {
    type: String,
    default: null
  },
  position: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Position',
    default: null
  }
}, { timestamps: true });

// Index for faster queries
orderSchema.index({ user: 1, status: 1 });
orderSchema.index({ user: 1, symbol: 1 });

export default mongoose.model('Order', orderSchema);
