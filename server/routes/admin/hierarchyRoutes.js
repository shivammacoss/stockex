/**
 * Admin Hierarchy Routes
 * Handles CRUD for Admin → Broker → Sub Broker hierarchy
 * 
 * Routes:
 * - GET  /admins          - Get all subordinates
 * - POST /admins          - Create new subordinate
 * - GET  /admins/:id      - Get subordinate details
 * - PUT  /admins/:id      - Update subordinate
 * - PUT  /admins/:id/status - Toggle subordinate status
 * - PUT  /admins/:id/password - Reset subordinate password
 * - PUT  /admins/:id/charges - Update subordinate charges
 */

import express from 'express';
import bcrypt from 'bcryptjs';
import Admin from '../../models/Admin.js';
import User from '../../models/User.js';
import { 
  protectAdmin, 
  getAllowedChildRoles,
  canManageRole 
} from '../../middleware/adminAuth.js';

const router = express.Router();

// ============================================================================
// GET ALL SUBORDINATES
// ============================================================================

/**
 * GET /admins
 * Get all subordinates based on hierarchy
 * - SUPER_ADMIN: sees all ADMINs, BROKERs, SUB_BROKERs
 * - ADMIN: sees BROKERs and SUB_BROKERs they created
 * - BROKER: sees SUB_BROKERs they created
 */
router.get('/', protectAdmin, async (req, res) => {
  try {
    let query = {};
    const allowedChildRoles = getAllowedChildRoles(req.admin.role);
    
    if (req.admin.role === 'SUPER_ADMIN') {
      query = { role: { $in: ['ADMIN', 'BROKER', 'SUB_BROKER'] } };
    } else if (allowedChildRoles.length > 0) {
      query = { 
        role: { $in: allowedChildRoles },
        $or: [
          { parentId: req.admin._id },
          { hierarchyPath: req.admin._id }
        ]
      };
    } else {
      return res.json([]);
    }
    
    const admins = await Admin.find(query)
      .select('-password -pin')
      .populate('parentId', 'name adminCode role')
      .sort({ createdAt: -1 });
    
    // Add user counts
    const adminData = await Promise.all(admins.map(async (admin) => {
      const userCount = await User.countDocuments({ admin: admin._id });
      const activeUsers = await User.countDocuments({ admin: admin._id, isActive: true });
      return {
        ...admin.toObject(),
        stats: { ...admin.stats, totalUsers: userCount, activeUsers }
      };
    }));
    
    res.json(adminData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ============================================================================
// CREATE SUBORDINATE
// ============================================================================

/**
 * POST /admins
 * Create new subordinate (ADMIN/BROKER/SUB_BROKER)
 */
router.post('/', protectAdmin, async (req, res) => {
  try {
    const { username, name, email, phone, password, pin, charges, role: requestedRole } = req.body;
    
    const allowedChildRoles = getAllowedChildRoles(req.admin.role);
    let roleToCreate = requestedRole || allowedChildRoles[0];
    
    // Validate role
    if (!allowedChildRoles.includes(roleToCreate)) {
      return res.status(403).json({ 
        message: `You cannot create ${roleToCreate}. Allowed: ${allowedChildRoles.join(', ')}` 
      });
    }
    
    // Check existing
    const exists = await Admin.findOne({ $or: [{ username }, { email }] });
    if (exists) {
      return res.status(400).json({ message: 'Username or email already exists' });
    }
    
    // Hash credentials
    const hashedPassword = await bcrypt.hash(password, 10);
    const hashedPin = pin ? await bcrypt.hash(pin.toString(), 10) : null;
    
    // Build hierarchy path
    const hierarchyPath = req.admin.role === 'SUPER_ADMIN' 
      ? [req.admin._id] 
      : [...(req.admin.hierarchyPath || []), req.admin._id];
    
    // Create admin code
    const rolePrefix = roleToCreate === 'ADMIN' ? 'ADM' : roleToCreate === 'BROKER' ? 'BRK' : 'SBR';
    const count = await Admin.countDocuments({ role: roleToCreate });
    const adminCode = `${rolePrefix}${String(count + 1).padStart(4, '0')}`;
    
    // Create referral code
    const referralCode = `${rolePrefix}${Date.now().toString(36).toUpperCase()}`;
    
    const newAdmin = await Admin.create({
      username,
      name: name || username,
      email,
      phone,
      password: hashedPassword,
      pin: hashedPin,
      role: roleToCreate,
      adminCode,
      referralCode,
      parentId: req.admin._id,
      hierarchyPath,
      createdBy: req.admin._id,
      charges: charges || { brokerage: 20 },
      wallet: { balance: 0, totalDeposited: 0, totalWithdrawn: 0 },
      status: 'ACTIVE'
    });
    
    res.status(201).json({
      message: `${roleToCreate} created successfully`,
      admin: { ...newAdmin.toObject(), password: undefined, pin: undefined }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ============================================================================
// GET SUBORDINATE DETAILS
// ============================================================================

/**
 * GET /admins/:id
 * Get single subordinate with full details
 */
router.get('/:id', protectAdmin, async (req, res) => {
  try {
    const admin = await Admin.findById(req.params.id)
      .select('-password -pin')
      .populate('parentId', 'name adminCode role');
    
    if (!admin) {
      return res.status(404).json({ message: 'Not found' });
    }
    
    // Verify access permission
    if (req.admin.role !== 'SUPER_ADMIN') {
      const hasAccess = admin.hierarchyPath?.includes(req.admin._id) || 
                       admin.parentId?._id?.toString() === req.admin._id.toString();
      if (!hasAccess) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }
    
    // Get user stats
    const userCount = await User.countDocuments({ admin: admin._id });
    const activeUsers = await User.countDocuments({ admin: admin._id, isActive: true });
    
    res.json({
      ...admin.toObject(),
      stats: { ...admin.stats, totalUsers: userCount, activeUsers }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ============================================================================
// UPDATE SUBORDINATE
// ============================================================================

/**
 * PUT /admins/:id
 * Update subordinate details
 */
router.put('/:id', protectAdmin, async (req, res) => {
  try {
    const { name, email, phone, charges } = req.body;
    
    const admin = await Admin.findById(req.params.id);
    if (!admin) {
      return res.status(404).json({ message: 'Not found' });
    }
    
    // Verify permission
    if (!canManageRole(req.admin.role, admin.role)) {
      return res.status(403).json({ message: 'Cannot manage this role' });
    }
    
    // Update fields
    if (name) admin.name = name;
    if (email) admin.email = email;
    if (phone) admin.phone = phone;
    if (charges) admin.charges = { ...admin.charges, ...charges };
    
    await admin.save();
    
    res.json({ message: 'Updated successfully', admin });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ============================================================================
// TOGGLE STATUS
// ============================================================================

/**
 * PUT /admins/:id/status
 * Toggle subordinate active/suspended status
 */
router.put('/:id/status', protectAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['ACTIVE', 'SUSPENDED'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    
    const admin = await Admin.findById(req.params.id);
    if (!admin) {
      return res.status(404).json({ message: 'Not found' });
    }
    
    if (!canManageRole(req.admin.role, admin.role)) {
      return res.status(403).json({ message: 'Cannot manage this role' });
    }
    
    admin.status = status;
    await admin.save();
    
    res.json({ message: `Status changed to ${status}` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ============================================================================
// RESET PASSWORD
// ============================================================================

/**
 * PUT /admins/:id/password
 * Reset subordinate password
 */
router.put('/:id/password', protectAdmin, async (req, res) => {
  try {
    const { password } = req.body;
    
    if (!password || password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }
    
    const admin = await Admin.findById(req.params.id);
    if (!admin) {
      return res.status(404).json({ message: 'Not found' });
    }
    
    if (!canManageRole(req.admin.role, admin.role)) {
      return res.status(403).json({ message: 'Cannot manage this role' });
    }
    
    admin.password = await bcrypt.hash(password, 10);
    await admin.save();
    
    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ============================================================================
// UPDATE CHARGES
// ============================================================================

/**
 * PUT /admins/:id/charges
 * Update subordinate brokerage charges
 */
router.put('/:id/charges', protectAdmin, async (req, res) => {
  try {
    const { charges } = req.body;
    
    const admin = await Admin.findById(req.params.id);
    if (!admin) {
      return res.status(404).json({ message: 'Not found' });
    }
    
    if (!canManageRole(req.admin.role, admin.role)) {
      return res.status(403).json({ message: 'Cannot manage this role' });
    }
    
    admin.charges = { ...admin.charges, ...charges };
    await admin.save();
    
    res.json({ message: 'Charges updated', charges: admin.charges });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ============================================================================
// PERMANENT DELETE (Super Admin Only)
// ============================================================================

/**
 * DELETE /admins/:id/permanent
 * Permanently delete an admin/broker/sub-broker (Super Admin only)
 * This will also delete all users under them
 */
router.delete('/:id/permanent', protectAdmin, async (req, res) => {
  try {
    // Only Super Admin can permanently delete
    if (req.admin.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Only Super Admin can permanently delete admins' });
    }
    
    const adminToDelete = await Admin.findById(req.params.id);
    if (!adminToDelete) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    
    // Cannot delete Super Admin
    if (adminToDelete.role === 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Cannot delete Super Admin' });
    }
    
    // Get all subordinate admins (brokers, sub-brokers under this admin)
    const subordinateAdmins = await Admin.find({
      hierarchyPath: adminToDelete._id
    });
    
    // Get all users under this admin and their subordinates
    const adminIds = [adminToDelete._id, ...subordinateAdmins.map(a => a._id)];
    
    // Delete all users under these admins
    const deletedUsersResult = await User.deleteMany({
      $or: [
        { admin: { $in: adminIds } },
        { hierarchyPath: { $in: adminIds } }
      ]
    });
    
    // Delete all subordinate admins
    const deletedAdminsResult = await Admin.deleteMany({
      hierarchyPath: adminToDelete._id
    });
    
    // Delete the admin itself
    await Admin.findByIdAndDelete(adminToDelete._id);
    
    res.json({ 
      message: `${adminToDelete.role} and all subordinates permanently deleted`,
      deletedAdmin: adminToDelete.name || adminToDelete.username,
      deletedSubordinates: deletedAdminsResult.deletedCount,
      deletedUsers: deletedUsersResult.deletedCount
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
