 import Admin from '../models/Admin.js';
import WalletLedger from '../models/WalletLedger.js';
import GameSettings from '../models/GameSettings.js';

/**
 * Distribute game profit/loss amount through the user's admin hierarchy.
 * Cascading logic:
 *   - No SubBroker → SubBroker's share goes to Broker
 *   - No Broker    → Broker's share goes to Admin
 *   - No Admin     → Admin's share goes to SuperAdmin
 *
 * @param {Object} user       - The user document (must have hierarchyPath, admin, adminCode)
 * @param {Number} amount     - Total amount to distribute (e.g. lost bet amount or brokerage)
 * @param {String} gameName   - Game identifier for logging (e.g. 'NiftyUpDown', 'NiftyNumber')
 * @param {String} refId      - Optional reference ID (bet/trade ID)
 * @param {String} gameKey    - Game settings key (e.g. 'niftyUpDown', 'niftyNumber') for per-game percentages
 * @returns {Object}          - Distribution summary { distributions, totalDistributed }
 */
export async function distributeGameProfit(user, amount, gameName, refId, gameKey) {
  if (!user || amount <= 0) return { distributions: {}, totalDistributed: 0 };

  try {
    // Get per-game profit distribution percentages, fallback to global
    const settings = await GameSettings.getSettings();
    const gameConfig = gameKey ? settings.games?.[gameKey] : null;
    const globalDist = settings.profitDistribution || {};

    const subBrokerPercent = gameConfig?.profitSubBrokerPercent ?? globalDist.subBrokerPercent ?? 10;
    const brokerPercent = gameConfig?.profitBrokerPercent ?? globalDist.brokerPercent ?? 20;
    const adminPercent = gameConfig?.profitAdminPercent ?? globalDist.adminPercent ?? 30;
    // Option: If SubBroker not available, should their share go to Broker? (default: true)
    const subBrokerShareToBroker = gameConfig?.subBrokerShareToBroker ?? true;
    // SuperAdmin gets the remainder (100 - admin - broker - subBroker)

    // Build hierarchy chain from user's direct admin up to SuperAdmin
    const hierarchyChain = [];
    let currentAdmin = null;

    // Start with user's direct admin
    if (user.admin) {
      currentAdmin = await Admin.findById(user.admin);
    } else if (user.adminCode) {
      currentAdmin = await Admin.findOne({ adminCode: user.adminCode, status: 'ACTIVE' });
    }

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

    // If no hierarchy found, nothing to distribute
    if (hierarchyChain.length === 0) {
      console.log(`[GameProfit] No hierarchy found for user ${user.userId || user._id}, skipping distribution`);
      return { distributions: {}, totalDistributed: 0 };
    }

    // Determine which roles exist in hierarchy
    const hasSubBroker = hierarchyChain.some(h => h.role === 'SUB_BROKER');
    const hasBroker = hierarchyChain.some(h => h.role === 'BROKER');
    const hasAdmin = hierarchyChain.some(h => h.role === 'ADMIN');
    const hasSuperAdmin = hierarchyChain.some(h => h.role === 'SUPER_ADMIN');

    // Calculate shares with cascading logic
    let sbShare = subBrokerPercent;
    let brShare = brokerPercent;
    let adShare = adminPercent;
    let saShare = Math.max(0, 100 - adminPercent - brokerPercent - subBrokerPercent);

    // If no SubBroker, their share goes to Broker (if enabled) or next up
    if (!hasSubBroker) {
      if (subBrokerShareToBroker && hasBroker) {
        // SubBroker share goes to Broker (configurable option)
        brShare += sbShare;
      } else if (hasAdmin) {
        // If option disabled or no broker, share goes to Admin
        adShare += sbShare;
      } else {
        // Otherwise goes to SuperAdmin
        saShare += sbShare;
      }
      sbShare = 0;
    }

    // If no Broker, their share goes to Admin (or next up)
    if (!hasBroker) {
      if (hasAdmin) {
        adShare += brShare;
      } else {
        saShare += brShare;
      }
      brShare = 0;
    }

    // If no Admin, their share goes to SuperAdmin
    if (!hasAdmin) {
      saShare += adShare;
      adShare = 0;
    }

    // Build distribution map
    const distributions = {};
    if (hasSubBroker && sbShare > 0) distributions.SUB_BROKER = parseFloat((amount * sbShare / 100).toFixed(2));
    if (hasBroker && brShare > 0) distributions.BROKER = parseFloat((amount * brShare / 100).toFixed(2));
    if (hasAdmin && adShare > 0) distributions.ADMIN = parseFloat((amount * adShare / 100).toFixed(2));
    if (hasSuperAdmin && saShare > 0) distributions.SUPER_ADMIN = parseFloat((amount * saShare / 100).toFixed(2));

    // Credit each admin in hierarchy
    let totalDistributed = 0;
    for (const { admin, role } of hierarchyChain) {
      const shareAmount = distributions[role] || 0;
      if (shareAmount <= 0) continue;

      admin.wallet.balance += shareAmount;
      admin.stats.totalBrokerage = (admin.stats.totalBrokerage || 0) + shareAmount;
      await admin.save();

      // Create wallet ledger entry
      await WalletLedger.create({
        ownerType: 'ADMIN',
        ownerId: admin._id,
        adminCode: admin.adminCode,
        type: 'CREDIT',
        reason: 'GAME_PROFIT',
        amount: shareAmount,
        balanceAfter: admin.wallet.balance,
        description: `${gameName} profit share - ${role} (${((shareAmount / amount) * 100).toFixed(1)}% of ₹${amount.toFixed(2)})`,
        reference: refId ? { type: 'Manual', id: null } : undefined
      });

      totalDistributed += shareAmount;
    }

    console.log(`[GameProfit] ${gameName}: Distributed ₹${totalDistributed.toFixed(2)} of ₹${amount.toFixed(2)} for user ${user.userId || user._id} | SA:${distributions.SUPER_ADMIN || 0} AD:${distributions.ADMIN || 0} BR:${distributions.BROKER || 0} SB:${distributions.SUB_BROKER || 0}`);

    return { distributions, totalDistributed };

  } catch (error) {
    console.error(`[GameProfit] Error distributing ${gameName} profit for user ${user.userId || user._id}:`, error);
    return { distributions: {}, totalDistributed: 0 };
  }
}
