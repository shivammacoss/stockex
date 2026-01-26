/**
 * Admin User Management Routes
 * Handles CRUD operations for users by admins
 * 
 * Routes:
 * - GET    /users              - Get all users under admin
 * - POST   /users              - Create new user
 * - GET    /users/:id          - Get user details
 * - PUT    /users/:id          - Update user
 * - DELETE /users/:id          - Delete user
 * - PUT    /users/:id/status   - Toggle user status
 * - PUT    /users/:id/password - Reset user password
 * - PUT    /users/:id/wallet   - Add/deduct user wallet
 */

import express from 'express';
import bcrypt from 'bcryptjs';
import User from '../../models/User.js';
import WalletLedger from '../../models/WalletLedger.js';
import { 
  protectAdmin, 
  applyHierarchyFilter,
  superAdminOnly 
} from '../../middleware/adminAuth.js';

const router = express.Router();

// ============================================================================
// GET ALL USERS
// ============================================================================

/**
 * GET /users
 * Get all users under current admin's hierarchy
 */
router.get('/', protectAdmin, async (req, res) => {
  try {
    let query = {};
    
    if (req.admin.role === 'SUPER_ADMIN') {
      // Super Admin sees all users
      query = {};
    } else {
      // Others see users they created or under their hierarchy
      query = applyHierarchyFilter(req, {});
    }
    
    const users = await User.find(query)
      .select('-password -pin')
      .populate('admin', 'name adminCode role')
      .sort({ createdAt: -1 });
    
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * GET /all-users (Super Admin only)
 * Get all users in the system with admin info
 */
router.get('/all-users', protectAdmin, superAdminOnly, async (req, res) => {
  try {
    const users = await User.find()
      .select('-password -pin')
      .populate('admin', 'name adminCode role')
      .sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ============================================================================
// CREATE USER
// ============================================================================

/**
 * POST /users
 * Create new user under current admin
 */
router.post('/', protectAdmin, async (req, res) => {
  try {
    const { 
      username, fullName, email, phone, password, pin,
      segmentPermissions, scriptSettings 
    } = req.body;
    
    // Check existing
    const exists = await User.findOne({ 
      $or: [{ username }, { email }] 
    });
    if (exists) {
      return res.status(400).json({ message: 'Username or email already exists' });
    }
    
    // Hash credentials
    const hashedPassword = await bcrypt.hash(password, 10);
    const hashedPin = pin ? await bcrypt.hash(pin.toString(), 10) : null;
    
    // Generate user ID
    const count = await User.countDocuments();
    const userId = `USR${String(count + 1).padStart(6, '0')}`;
    
    // Build hierarchy path
    const hierarchyPath = req.admin.role === 'SUPER_ADMIN'
      ? [req.admin._id]
      : [...(req.admin.hierarchyPath || []), req.admin._id];
    
    const user = await User.create({
      userId,
      username,
      fullName: fullName || username,
      email,
      phone,
      password: hashedPassword,
      pin: hashedPin,
      admin: req.admin._id,
      adminCode: req.admin.adminCode,
      creatorRole: req.admin.role,
      hierarchyPath,
      segmentPermissions: segmentPermissions || {},
      scriptSettings: scriptSettings || {},
      wallet: { cashBalance: 0, tradingBalance: 0, totalDeposited: 0, totalWithdrawn: 0 },
      isActive: true
    });
    
    res.status(201).json({
      message: 'User created successfully',
      user: { ...user.toObject(), password: undefined, pin: undefined }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ============================================================================
// GET USER DETAILS
// ============================================================================

/**
 * GET /users/:id
 * Get single user details
 */
router.get('/:id', protectAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password -pin')
      .populate('admin', 'name adminCode role');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Verify access
    if (req.admin.role !== 'SUPER_ADMIN') {
      const hasAccess = user.hierarchyPath?.includes(req.admin._id) ||
                       user.admin?._id?.toString() === req.admin._id.toString();
      if (!hasAccess) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }
    
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ============================================================================
// UPDATE USER
// ============================================================================

/**
 * PUT /users/:id
 * Update user details
 */
router.put('/:id', protectAdmin, async (req, res) => {
  try {
    const { fullName, email, phone, segmentPermissions, scriptSettings } = req.body;
    
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Update fields
    if (fullName) user.fullName = fullName;
    if (email) user.email = email;
    if (phone) user.phone = phone;
    if (segmentPermissions) user.segmentPermissions = segmentPermissions;
    if (scriptSettings) user.scriptSettings = scriptSettings;
    
    await user.save();
    
    res.json({ message: 'User updated', user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ============================================================================
// DELETE USER
// ============================================================================

/**
 * DELETE /users/:id
 * Delete user (only if no active positions)
 */
router.delete('/:id', protectAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check for active positions (implement based on your Position model)
    // const activePositions = await Position.countDocuments({ user: user._id, status: 'OPEN' });
    // if (activePositions > 0) {
    //   return res.status(400).json({ message: 'Cannot delete user with open positions' });
    // }
    
    await User.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ============================================================================
// TOGGLE USER STATUS
// ============================================================================

/**
 * PUT /users/:id/status
 * Toggle user active/inactive status
 */
router.put('/:id/status', protectAdmin, async (req, res) => {
  try {
    const { isActive } = req.body;
    
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    user.isActive = isActive;
    await user.save();
    
    res.json({ message: `User ${isActive ? 'activated' : 'deactivated'}` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ============================================================================
// RESET USER PASSWORD
// ============================================================================

/**
 * PUT /users/:id/password
 * Reset user password
 */
router.put('/:id/password', protectAdmin, async (req, res) => {
  try {
    const { password } = req.body;
    
    if (!password || password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }
    
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    user.password = await bcrypt.hash(password, 10);
    await user.save();
    
    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ============================================================================
// USER WALLET OPERATIONS
// ============================================================================

/**
 * PUT /users/:id/wallet
 * Add or deduct funds from user wallet
 */
router.put('/:id/wallet', protectAdmin, async (req, res) => {
  try {
    const { amount, type, reason } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid amount' });
    }
    
    if (!['ADD', 'DEDUCT'].includes(type)) {
      return res.status(400).json({ message: 'Type must be ADD or DEDUCT' });
    }
    
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // For deduction, check user balance
    if (type === 'DEDUCT' && user.wallet.cashBalance < amount) {
      return res.status(400).json({ message: 'Insufficient user balance' });
    }
    
    // For ADD, check admin balance (except Super Admin)
    if (type === 'ADD' && req.admin.role !== 'SUPER_ADMIN') {
      if (req.admin.wallet.balance < amount) {
        return res.status(400).json({ message: 'Insufficient balance in your wallet' });
      }
      
      // Deduct from admin wallet
      req.admin.wallet.balance -= amount;
      req.admin.wallet.totalWithdrawn += amount;
      await req.admin.save();
      
      // Log admin debit
      await WalletLedger.create({
        ownerType: 'ADMIN',
        ownerId: req.admin._id,
        adminCode: req.admin.adminCode,
        type: 'DEBIT',
        reason: 'USER_DEPOSIT',
        amount,
        balanceAfter: req.admin.wallet.balance,
        description: `Transferred to user ${user.username}`,
        performedBy: req.admin._id
      });
    }
    
    // Update user wallet
    if (type === 'ADD') {
      user.wallet.cashBalance += amount;
      user.wallet.totalDeposited += amount;
    } else {
      user.wallet.cashBalance -= amount;
      user.wallet.totalWithdrawn += amount;
      
      // Credit back to admin (except Super Admin)
      if (req.admin.role !== 'SUPER_ADMIN') {
        req.admin.wallet.balance += amount;
        req.admin.wallet.totalDeposited += amount;
        await req.admin.save();
      }
    }
    
    await user.save();
    
    // Log user transaction
    await WalletLedger.create({
      ownerType: 'USER',
      ownerId: user._id,
      userId: user.userId,
      adminCode: user.adminCode,
      type: type === 'ADD' ? 'CREDIT' : 'DEBIT',
      reason: type === 'ADD' ? 'ADMIN_DEPOSIT' : 'ADMIN_WITHDRAWAL',
      amount,
      balanceAfter: user.wallet.cashBalance,
      description: reason || `${type} by ${req.admin.name || req.admin.username}`,
      performedBy: req.admin._id
    });
    
    res.json({ 
      message: `₹${amount} ${type === 'ADD' ? 'added to' : 'deducted from'} user wallet`,
      newBalance: user.wallet.cashBalance
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ============================================================================
// TRANSFER USER BETWEEN ADMINS (Super Admin only)
// ============================================================================

/**
 * POST /users/:id/transfer
 * Transfer user to another admin
 */
router.post('/:id/transfer', protectAdmin, superAdminOnly, async (req, res) => {
  try {
    const { targetAdminId } = req.body;
    
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const targetAdmin = await Admin.findById(targetAdminId);
    if (!targetAdmin) {
      return res.status(404).json({ message: 'Target admin not found' });
    }
    
    // Update user's admin reference
    user.admin = targetAdmin._id;
    user.adminCode = targetAdmin.adminCode;
    user.hierarchyPath = targetAdmin.role === 'SUPER_ADMIN'
      ? [targetAdmin._id]
      : [...(targetAdmin.hierarchyPath || []), targetAdmin._id];
    
    await user.save();
    
    res.json({ message: `User transferred to ${targetAdmin.name || targetAdmin.username}` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ============================================================================
// PERMANENT DELETE USER (Super Admin Only)
// ============================================================================

/**
 * DELETE /users/:id/permanent
 * Permanently delete a user (Super Admin only)
 */
router.delete('/:id/permanent', protectAdmin, superAdminOnly, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Delete user's related data (trades, positions, orders, etc.)
    // Import models dynamically to avoid circular dependencies
    try {
      const Trade = (await import('../../models/Trade.js')).default;
      const Position = (await import('../../models/Position.js')).default;
      const Order = (await import('../../models/Order.js')).default;
      
      await Trade.deleteMany({ user: user._id });
      await Position.deleteMany({ user: user._id });
      await Order.deleteMany({ user: user._id });
    } catch (err) {
      console.log('Some related models not found, continuing with user deletion');
    }
    
    // Delete wallet ledger entries
    await WalletLedger.deleteMany({ ownerId: user._id, ownerType: 'USER' });
    
    // Delete the user
    await User.findByIdAndDelete(user._id);
    
    res.json({ 
      message: 'User permanently deleted',
      deletedUser: user.username || user.email
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Import Admin model for transfer
import Admin from '../../models/Admin.js';

export default router;
