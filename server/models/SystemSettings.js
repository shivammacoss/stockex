import mongoose from 'mongoose';

// System-wide default settings for each role
// SuperAdmin can set these defaults which cascade down to all admins/users
const systemSettingsSchema = new mongoose.Schema({
  // Singleton document identifier
  settingsType: {
    type: String,
    default: 'global',
    unique: true
  },
  
  // Default settings for ADMIN role
  adminDefaults: {
    brokerage: {
      perLot: { type: Number, default: 20 },
      perCrore: { type: Number, default: 100 },
      perTrade: { type: Number, default: 10 }
    },
    leverage: {
      intraday: { type: Number, default: 10 },
      carryForward: { type: Number, default: 5 }
    },
    charges: {
      depositFee: { type: Number, default: 0 },
      withdrawalFee: { type: Number, default: 0 },
      tradingFee: { type: Number, default: 0 }
    },
    lotSettings: {
      maxLotSize: { type: Number, default: 100 },
      minLotSize: { type: Number, default: 1 }
    },
    quantitySettings: {
      maxQuantity: { type: Number, default: 50000 }, // Overall max quantity limit (total exposure)
      breakupQuantity: { type: Number, default: 5000 } // Breakup quantity per single order
    },
    // Permissions - whether Admin can change these settings
    permissions: {
      canChangeBrokerage: { type: Boolean, default: true },
      canChangeCharges: { type: Boolean, default: true },
      canChangeLeverage: { type: Boolean, default: true },
      canChangeLotSettings: { type: Boolean, default: true },
      canChangeTradingSettings: { type: Boolean, default: true },
      canChangeQuantitySettings: { type: Boolean, default: true }
    }
  },
  
  // Default settings for BROKER role
  brokerDefaults: {
    brokerage: {
      perLot: { type: Number, default: 25 },
      perCrore: { type: Number, default: 120 },
      perTrade: { type: Number, default: 15 }
    },
    leverage: {
      intraday: { type: Number, default: 8 },
      carryForward: { type: Number, default: 4 }
    },
    charges: {
      depositFee: { type: Number, default: 0 },
      withdrawalFee: { type: Number, default: 0 },
      tradingFee: { type: Number, default: 0 }
    },
    lotSettings: {
      maxLotSize: { type: Number, default: 50 },
      minLotSize: { type: Number, default: 1 }
    },
    quantitySettings: {
      maxQuantity: { type: Number, default: 25000 },
      breakupQuantity: { type: Number, default: 2500 }
    },
    // Permissions - whether Broker can change these settings
    permissions: {
      canChangeBrokerage: { type: Boolean, default: false },
      canChangeCharges: { type: Boolean, default: false },
      canChangeLeverage: { type: Boolean, default: false },
      canChangeLotSettings: { type: Boolean, default: false },
      canChangeTradingSettings: { type: Boolean, default: false },
      canChangeQuantitySettings: { type: Boolean, default: false }
    }
  },
  
  // Default settings for SUB_BROKER role
  subBrokerDefaults: {
    brokerage: {
      perLot: { type: Number, default: 30 },
      perCrore: { type: Number, default: 150 },
      perTrade: { type: Number, default: 20 }
    },
    leverage: {
      intraday: { type: Number, default: 5 },
      carryForward: { type: Number, default: 3 }
    },
    charges: {
      depositFee: { type: Number, default: 0 },
      withdrawalFee: { type: Number, default: 0 },
      tradingFee: { type: Number, default: 0 }
    },
    lotSettings: {
      maxLotSize: { type: Number, default: 25 },
      minLotSize: { type: Number, default: 1 }
    },
    quantitySettings: {
      maxQuantity: { type: Number, default: 10000 },
      breakupQuantity: { type: Number, default: 1000 }
    },
    // Permissions - whether SubBroker can change these settings
    permissions: {
      canChangeBrokerage: { type: Boolean, default: false },
      canChangeCharges: { type: Boolean, default: false },
      canChangeLeverage: { type: Boolean, default: false },
      canChangeLotSettings: { type: Boolean, default: false },
      canChangeTradingSettings: { type: Boolean, default: false },
      canChangeQuantitySettings: { type: Boolean, default: false }
    }
  },
  
  // Default settings for USER (applied via their parent admin)
  userDefaults: {
    brokerage: {
      perLot: { type: Number, default: 30 },
      perCrore: { type: Number, default: 150 },
      perTrade: { type: Number, default: 20 }
    },
    leverage: {
      intraday: { type: Number, default: 5 },
      carryForward: { type: Number, default: 3 }
    },
    charges: {
      depositFee: { type: Number, default: 0 },
      withdrawalFee: { type: Number, default: 0 },
      tradingFee: { type: Number, default: 0 }
    },
    lotSettings: {
      maxLotSize: { type: Number, default: 10 },
      minLotSize: { type: Number, default: 1 }
    },
    quantitySettings: {
      maxQuantity: { type: Number, default: 5000 },
      breakupQuantity: { type: Number, default: 500 }
    }
  },
  
  // Segment-wise default settings (margin, leverage per segment)
  segmentDefaults: {
    EQUITY: {
      enabled: { type: Boolean, default: true },
      intradayLeverage: { type: Number, default: 5 },
      deliveryLeverage: { type: Number, default: 1 },
      marginRequired: { type: Number, default: 20 }, // percentage
      lotSize: { type: Number, default: 1 },
      intradayMaxLots: { type: Number, default: 10000 },
      intradayBreakupLots: { type: Number, default: 1000 },
      carryForwardMaxLots: { type: Number, default: 5000 },
      carryForwardBreakupLots: { type: Number, default: 500 },
      brokeragePerLot: { type: Number, default: 20 },
      brokeragePerCrore: { type: Number, default: 100 }
    },
    FNO: {
      enabled: { type: Boolean, default: true },
      intradayLeverage: { type: Number, default: 10 },
      carryForwardLeverage: { type: Number, default: 5 },
      marginRequired: { type: Number, default: 10 },
      lotSize: { type: Number, default: 50 },
      intradayMaxLots: { type: Number, default: 100 },
      intradayBreakupLots: { type: Number, default: 10 },
      carryForwardMaxLots: { type: Number, default: 50 },
      carryForwardBreakupLots: { type: Number, default: 5 },
      brokeragePerLot: { type: Number, default: 20 },
      brokeragePerCrore: { type: Number, default: 100 }
    },
    MCX: {
      enabled: { type: Boolean, default: true },
      intradayLeverage: { type: Number, default: 8 },
      carryForwardLeverage: { type: Number, default: 4 },
      marginRequired: { type: Number, default: 12 },
      lotSize: { type: Number, default: 100 },
      intradayMaxLots: { type: Number, default: 50 },
      intradayBreakupLots: { type: Number, default: 5 },
      carryForwardMaxLots: { type: Number, default: 25 },
      carryForwardBreakupLots: { type: Number, default: 3 },
      brokeragePerLot: { type: Number, default: 25 },
      brokeragePerCrore: { type: Number, default: 120 }
    },
    CRYPTO: {
      enabled: { type: Boolean, default: true },
      intradayLeverage: { type: Number, default: 3 },
      carryForwardLeverage: { type: Number, default: 2 },
      marginRequired: { type: Number, default: 33 },
      lotSize: { type: Number, default: 1 },
      intradayMaxLots: { type: Number, default: 1000 },
      intradayBreakupLots: { type: Number, default: 100 },
      carryForwardMaxLots: { type: Number, default: 500 },
      carryForwardBreakupLots: { type: Number, default: 50 },
      brokeragePerLot: { type: Number, default: 30 },
      brokeragePerCrore: { type: Number, default: 150 }
    },
    CURRENCY: {
      enabled: { type: Boolean, default: true },
      intradayLeverage: { type: Number, default: 10 },
      carryForwardLeverage: { type: Number, default: 5 },
      marginRequired: { type: Number, default: 10 },
      lotSize: { type: Number, default: 1000 },
      intradayMaxLots: { type: Number, default: 100 },
      intradayBreakupLots: { type: Number, default: 10 },
      carryForwardMaxLots: { type: Number, default: 50 },
      carryForwardBreakupLots: { type: Number, default: 5 },
      brokeragePerLot: { type: Number, default: 20 },
      brokeragePerCrore: { type: Number, default: 100 }
    }
  },
  
  // Instrument-wise default settings (for popular instruments)
  instrumentDefaults: {
    NIFTY: {
      enabled: { type: Boolean, default: true },
      intradayLeverage: { type: Number, default: 15 },
      carryForwardLeverage: { type: Number, default: 8 },
      marginRequired: { type: Number, default: 7 },
      lotSize: { type: Number, default: 25 },
      intradayMaxLots: { type: Number, default: 100 },
      intradayBreakupLots: { type: Number, default: 10 },
      carryForwardMaxLots: { type: Number, default: 50 },
      carryForwardBreakupLots: { type: Number, default: 5 },
      brokeragePerLot: { type: Number, default: 20 }
    },
    BANKNIFTY: {
      enabled: { type: Boolean, default: true },
      intradayLeverage: { type: Number, default: 12 },
      carryForwardLeverage: { type: Number, default: 6 },
      marginRequired: { type: Number, default: 8 },
      lotSize: { type: Number, default: 15 },
      intradayMaxLots: { type: Number, default: 100 },
      intradayBreakupLots: { type: Number, default: 10 },
      carryForwardMaxLots: { type: Number, default: 50 },
      carryForwardBreakupLots: { type: Number, default: 5 },
      brokeragePerLot: { type: Number, default: 20 }
    },
    FINNIFTY: {
      enabled: { type: Boolean, default: true },
      intradayLeverage: { type: Number, default: 12 },
      carryForwardLeverage: { type: Number, default: 6 },
      marginRequired: { type: Number, default: 8 },
      lotSize: { type: Number, default: 25 },
      intradayMaxLots: { type: Number, default: 100 },
      intradayBreakupLots: { type: Number, default: 10 },
      carryForwardMaxLots: { type: Number, default: 50 },
      carryForwardBreakupLots: { type: Number, default: 5 },
      brokeragePerLot: { type: Number, default: 20 }
    },
    MIDCPNIFTY: {
      enabled: { type: Boolean, default: true },
      intradayLeverage: { type: Number, default: 10 },
      carryForwardLeverage: { type: Number, default: 5 },
      marginRequired: { type: Number, default: 10 },
      lotSize: { type: Number, default: 50 },
      intradayMaxLots: { type: Number, default: 100 },
      intradayBreakupLots: { type: Number, default: 10 },
      carryForwardMaxLots: { type: Number, default: 50 },
      carryForwardBreakupLots: { type: Number, default: 5 },
      brokeragePerLot: { type: Number, default: 20 }
    },
    SENSEX: {
      enabled: { type: Boolean, default: true },
      intradayLeverage: { type: Number, default: 12 },
      carryForwardLeverage: { type: Number, default: 6 },
      marginRequired: { type: Number, default: 8 },
      lotSize: { type: Number, default: 10 },
      intradayMaxLots: { type: Number, default: 100 },
      intradayBreakupLots: { type: Number, default: 10 },
      carryForwardMaxLots: { type: Number, default: 50 },
      carryForwardBreakupLots: { type: Number, default: 5 },
      brokeragePerLot: { type: Number, default: 20 }
    },
    CRUDEOIL: {
      enabled: { type: Boolean, default: true },
      intradayLeverage: { type: Number, default: 8 },
      carryForwardLeverage: { type: Number, default: 4 },
      marginRequired: { type: Number, default: 12 },
      lotSize: { type: Number, default: 100 },
      intradayMaxLots: { type: Number, default: 50 },
      intradayBreakupLots: { type: Number, default: 5 },
      carryForwardMaxLots: { type: Number, default: 25 },
      carryForwardBreakupLots: { type: Number, default: 3 },
      brokeragePerLot: { type: Number, default: 25 }
    },
    GOLD: {
      enabled: { type: Boolean, default: true },
      intradayLeverage: { type: Number, default: 8 },
      carryForwardLeverage: { type: Number, default: 4 },
      marginRequired: { type: Number, default: 12 },
      lotSize: { type: Number, default: 100 },
      intradayMaxLots: { type: Number, default: 50 },
      intradayBreakupLots: { type: Number, default: 5 },
      carryForwardMaxLots: { type: Number, default: 25 },
      carryForwardBreakupLots: { type: Number, default: 3 },
      brokeragePerLot: { type: Number, default: 25 }
    },
    SILVER: {
      enabled: { type: Boolean, default: true },
      intradayLeverage: { type: Number, default: 8 },
      carryForwardLeverage: { type: Number, default: 4 },
      marginRequired: { type: Number, default: 12 },
      lotSize: { type: Number, default: 30 },
      intradayMaxLots: { type: Number, default: 50 },
      intradayBreakupLots: { type: Number, default: 5 },
      carryForwardMaxLots: { type: Number, default: 25 },
      carryForwardBreakupLots: { type: Number, default: 3 },
      brokeragePerLot: { type: Number, default: 25 }
    },
    NATURALGAS: {
      enabled: { type: Boolean, default: true },
      intradayLeverage: { type: Number, default: 6 },
      carryForwardLeverage: { type: Number, default: 3 },
      marginRequired: { type: Number, default: 15 },
      lotSize: { type: Number, default: 1250 },
      intradayMaxLots: { type: Number, default: 25 },
      intradayBreakupLots: { type: Number, default: 5 },
      carryForwardMaxLots: { type: Number, default: 10 },
      carryForwardBreakupLots: { type: Number, default: 2 },
      brokeragePerLot: { type: Number, default: 25 }
    }
  },
  
  // Notification Settings
  notificationSettings: {
    marginWarningThreshold: { type: Number, default: 70 }, // % margin usage to trigger warning
    marginDangerThreshold: { type: Number, default: 90 }, // % margin usage for danger alert
    autoSquareOffThreshold: { type: Number, default: 100 }, // % margin usage for auto square off
    enableMarginNotifications: { type: Boolean, default: true },
    enableTradeNotifications: { type: Boolean, default: true },
    enableLoginNotifications: { type: Boolean, default: false },
    notifyAdminOnUserMarginWarning: { type: Boolean, default: true }, // Notify parent admin when user hits margin warning
    notifyAdminOnUserDanger: { type: Boolean, default: true } // Notify parent admin when user hits danger level
  },
  
  // Last updated by
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  }
}, { timestamps: true });

// Static method to get or create the singleton settings document
systemSettingsSchema.statics.getSettings = async function() {
  let settings = await this.findOne({ settingsType: 'global' });
  if (!settings) {
    settings = await this.create({ settingsType: 'global' });
  }
  return settings;
};

export default mongoose.model('SystemSettings', systemSettingsSchema);
