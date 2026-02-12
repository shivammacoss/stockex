import mongoose from 'mongoose';

const niftyJackpotBidSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 1
  },
  betDate: {
    type: String, // Format: YYYY-MM-DD
    required: true
  },
  // Rank assigned after result declaration (1 = highest bidder)
  rank: {
    type: Number,
    default: null
  },
  // Prize won based on rank
  prize: {
    type: Number,
    default: 0
  },
  // Status: pending (waiting for result), won (in top N), lost
  status: {
    type: String,
    enum: ['pending', 'won', 'lost'],
    default: 'pending'
  },
  // Admin who manages this user
  admin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  },
  // Profit distribution breakdown (for losing bids)
  distribution: {
    adminShare: { type: Number, default: 0 },
    superAdminShare: { type: Number, default: 0 },
    platformShare: { type: Number, default: 0 }
  },
  resultDeclaredAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// One bid per user per day
niftyJackpotBidSchema.index({ user: 1, betDate: 1 }, { unique: true });
// For resolving all pending bids for a date
niftyJackpotBidSchema.index({ betDate: 1, status: 1 });
// For leaderboard (highest bid first)
niftyJackpotBidSchema.index({ betDate: 1, amount: -1 });

const NiftyJackpotBid = mongoose.model('NiftyJackpotBid', niftyJackpotBidSchema);

export default NiftyJackpotBid;
