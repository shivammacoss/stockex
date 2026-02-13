import mongoose from 'mongoose';

const gameConfigSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: true },
  minBet: { type: Number, default: 100 },
  maxBet: { type: Number, default: 50000 },
  winMultiplier: { type: Number, default: 2 }, // e.g., 2x for up/down
  brokeragePercent: { type: Number, default: 5 }, // Platform fee on winnings
  roundDuration: { type: Number, default: 60 }, // seconds
  cooldownBetweenRounds: { type: Number, default: 5 }, // seconds
  maxBetsPerRound: { type: Number, default: 100 }, // max bets user can place per round
  displayOrder: { type: Number, default: 0 }
}, { _id: false });

const gameSettingsSchema = new mongoose.Schema({
  // Global Settings
  gamesEnabled: { type: Boolean, default: true },
  maintenanceMode: { type: Boolean, default: false },
  maintenanceMessage: { type: String, default: 'Games are under maintenance. Please try again later.' },
  
  // Token System (1 token = tokenValue in ₹)
  tokenValue: { type: Number, default: 300 }, // 1 token = ₹300
  
  // Platform Commission
  platformCommission: { type: Number, default: 5 }, // Global platform fee %
  
  // Profit Distribution Hierarchy (% of win/brokerage amount)
  profitDistribution: {
    superAdminPercent: { type: Number, default: 40 },
    adminPercent: { type: Number, default: 30 },
    brokerPercent: { type: Number, default: 20 },
    subBrokerPercent: { type: Number, default: 10 }
    // Remaining (if any) auto goes to Super Admin
  },
  
  // Min/Max Global Limits
  globalMinBet: { type: Number, default: 10 },
  globalMaxBet: { type: Number, default: 100000 },
  dailyBetLimit: { type: Number, default: 500000 }, // Max a user can bet in a day
  dailyWinLimit: { type: Number, default: 1000000 }, // Max a user can win in a day
  
  // Individual Game Settings
  games: {
    niftyUpDown: {
      ...gameConfigSchema.obj,
      name: { type: String, default: 'Nifty Up/Down' },
      description: { type: String, default: 'Predict if Nifty will go UP or DOWN' },
      winMultiplier: { type: Number, default: 1.95 },
      roundDuration: { type: Number, default: 60 },
      enabled: { type: Boolean, default: true },
      minBet: { type: Number, default: 100 },
      maxBet: { type: Number, default: 50000 },
      brokeragePercent: { type: Number, default: 5 },
      buySellRatioBrokerage: { type: Number, default: 16.67 },
      startTime: { type: String, default: '09:15' },
      endTime: { type: String, default: '15:30' }
    },
    niftyNumber: {
      ...gameConfigSchema.obj,
      name: { type: String, default: 'Nifty Number' },
      description: { type: String, default: 'Pick a decimal (.00-.99) of Nifty closing price' },
      winMultiplier: { type: Number, default: 9 },
      roundDuration: { type: Number, default: 86400 }, // 1 day in seconds
      enabled: { type: Boolean, default: true },
      minBet: { type: Number, default: 100 },
      maxBet: { type: Number, default: 10000 },
      brokeragePercent: { type: Number, default: 10 },
      buySellRatioBrokerage: { type: Number, default: 16.67 },
      fixedProfit: { type: Number, default: 4000 }, // Fixed profit on win
      adminSharePercent: { type: Number, default: 50 }, // Admin gets this % of losing bets
      superAdminSharePercent: { type: Number, default: 50 }, // SuperAdmin gets this % of losing bets
      resultTime: { type: String, default: '15:30' }, // IST time when result is declared
      maxBidTime: { type: String, default: '15:40' }, // Last time users can place bets
      betsPerDay: { type: Number, default: 10 }, // Max bets per user per day
      startTime: { type: String, default: '09:15' },
      endTime: { type: String, default: '15:30' }
    },
    niftyJackpot: {
      ...gameConfigSchema.obj,
      name: { type: String, default: 'Nifty Jackpot' },
      description: { type: String, default: 'Bid and compete for top ranks to win prizes' },
      winMultiplier: { type: Number, default: 1.5 },
      roundDuration: { type: Number, default: 86400 },
      enabled: { type: Boolean, default: true },
      minBet: { type: Number, default: 100 },
      maxBet: { type: Number, default: 50000 },
      brokeragePercent: { type: Number, default: 5 },
      buySellRatioBrokerage: { type: Number, default: 16.67 },
      topWinners: { type: Number, default: 10 },
      prizeDistribution: { type: [Number], default: [45000, 10000, 8000, 6000, 5000, 4000, 3000, 2000, 1500, 1000] },
      resultTime: { type: String, default: '15:30' },
      bidsPerDay: { type: Number, default: 1 },
      adminSharePercent: { type: Number, default: 50 },
      superAdminSharePercent: { type: Number, default: 50 },
      startTime: { type: String, default: '09:15' },
      endTime: { type: String, default: '15:30' }
    },
    niftyBracket: {
      ...gameConfigSchema.obj,
      name: { type: String, default: 'Nifty Bracket' },
      description: { type: String, default: 'Buy/Sell on bracket levels around Nifty price' },
      winMultiplier: { type: Number, default: 2 },
      roundDuration: { type: Number, default: 300 }, // 5 min max wait
      enabled: { type: Boolean, default: true },
      minBet: { type: Number, default: 100 },
      maxBet: { type: Number, default: 25000 },
      brokeragePercent: { type: Number, default: 5 },
      buySellRatioBrokerage: { type: Number, default: 16.67 },
      bracketGap: { type: Number, default: 20 }, // Points above/below current price
      expiryMinutes: { type: Number, default: 5 }, // Trade expires if neither level hit
      startTime: { type: String, default: '09:15' },
      endTime: { type: String, default: '15:30' }
    },
    btcUpDown: {
      ...gameConfigSchema.obj,
      name: { type: String, default: 'BTC Up/Down' },
      description: { type: String, default: 'Predict if Bitcoin will go UP or DOWN' },
      winMultiplier: { type: Number, default: 1.95 },
      roundDuration: { type: Number, default: 60 },
      enabled: { type: Boolean, default: true },
      minBet: { type: Number, default: 100 },
      maxBet: { type: Number, default: 50000 },
      brokeragePercent: { type: Number, default: 5 },
      buySellRatioBrokerage: { type: Number, default: 16.67 },
      startTime: { type: String, default: '00:00' },
      endTime: { type: String, default: '23:59' }
    }
  },
  
  // Referral & Bonus Settings
  referralBonus: {
    enabled: { type: Boolean, default: true },
    referrerBonus: { type: Number, default: 100 }, // Amount referrer gets
    refereeBonus: { type: Number, default: 50 }, // Amount new user gets
    minDepositRequired: { type: Number, default: 500 } // Min deposit to activate bonus
  },
  
  // First Deposit Bonus
  firstDepositBonus: {
    enabled: { type: Boolean, default: true },
    bonusPercent: { type: Number, default: 100 }, // 100% bonus on first deposit
    maxBonus: { type: Number, default: 5000 }, // Max bonus amount
    wageringRequirement: { type: Number, default: 3 } // 3x wagering to withdraw
  },
  
  // Loss Cashback
  lossCashback: {
    enabled: { type: Boolean, default: false },
    cashbackPercent: { type: Number, default: 5 }, // 5% of net losses
    minLoss: { type: Number, default: 1000 }, // Min loss to qualify
    maxCashback: { type: Number, default: 10000 }, // Max cashback per period
    period: { type: String, enum: ['daily', 'weekly', 'monthly'], default: 'weekly' }
  },
  
  // Risk Management
  riskManagement: {
    maxExposurePerUser: { type: Number, default: 100000 }, // Max total bets at risk
    maxWinPerRound: { type: Number, default: 500000 }, // Max payout per round
    autoSuspendOnLargeWin: { type: Boolean, default: true },
    largeWinThreshold: { type: Number, default: 100000 }, // Auto review wins above this
    suspiciousActivityAlert: { type: Boolean, default: true }
  },

  // Trading Hours (when games are available)
  tradingHours: {
    enabled: { type: Boolean, default: false }, // If true, games only available during hours
    startTime: { type: String, default: '09:15' }, // IST
    endTime: { type: String, default: '15:30' }, // IST
    weekendEnabled: { type: Boolean, default: false }
  }
}, {
  timestamps: true
});

// Ensure only one settings document exists
gameSettingsSchema.statics.getSettings = async function() {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

const GameSettings = mongoose.model('GameSettings', gameSettingsSchema);

export default GameSettings;
