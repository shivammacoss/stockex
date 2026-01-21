import express from 'express';
import bcrypt from 'bcryptjs';
import Admin from '../models/Admin.js';
import User from '../models/User.js';
import BankAccount from '../models/BankAccount.js';
import FundRequest from '../models/FundRequest.js';
import WalletLedger from '../models/WalletLedger.js';
import AdminFundRequest from '../models/AdminFundRequest.js';
import BrokerChangeRequest from '../models/BrokerChangeRequest.js';
import jwt from 'jsonwebtoken';

const router = express.Router();

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// Auth middleware - validates admin token
const protectAdmin = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Not authorized' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = await Admin.findById(decoded.id).select('-password');
    
    if (!req.admin) return res.status(401).json({ message: 'Admin not found' });
    if (req.admin.status !== 'ACTIVE') return res.status(401).json({ message: 'Account suspended' });
    
    next();
  } catch (error) {
    res.status(401).json({ message: 'Not authorized' });
  }
};

// Super Admin only middleware
const superAdminOnly = (req, res, next) => {
  if (req.admin.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ message: 'Super Admin access required' });
  }
  next();
};

// Hierarchy levels for permission checks
const HIERARCHY_LEVELS = {
  'SUPER_ADMIN': 0,
  'ADMIN': 1,
  'BROKER': 2,
  'SUB_BROKER': 3
};

// Get allowed child roles for a given role
// SUPER_ADMIN can create ADMIN, BROKER, SUB_BROKER (must specify parent for BROKER/SUB_BROKER)
// ADMIN can create BROKER, SUB_BROKER (must specify parent broker for SUB_BROKER)
// BROKER can create SUB_BROKER
// All roles (except SUPER_ADMIN) can create Users
const getAllowedChildRoles = (role) => {
  const childRoles = {
    'SUPER_ADMIN': ['ADMIN', 'BROKER', 'SUB_BROKER'], // Can create all, but must specify parent for SUB_BROKER
    'ADMIN': ['BROKER', 'SUB_BROKER'], // Can create SUB_BROKER under their brokers
    'BROKER': ['SUB_BROKER'], // Only BROKER can create SUB_BROKER directly
    'SUB_BROKER': []
  };
  return childRoles[role] || [];
};

// Check if requester can manage target role
const canManageRole = (requesterRole, targetRole) => {
  return HIERARCHY_LEVELS[requesterRole] < HIERARCHY_LEVELS[targetRole];
};

// Apply filter based on hierarchy - users see only their own and descendants
const applyHierarchyFilter = (req, query = {}) => {
  if (req.admin.role === 'SUPER_ADMIN') {
    return query; // Super Admin sees all
  }
  // For other roles, filter by hierarchyPath containing their ID or direct admin reference
  query.$or = [
    { admin: req.admin._id },
    { hierarchyPath: req.admin._id }
  ];
  return query;
};

// Apply adminCode filter for non-super admins (legacy support)
const applyAdminFilter = (req, query = {}) => {
  if (req.admin.role === 'SUPER_ADMIN') {
    return query;
  }
  // Include users under this admin and all descendants
  query.$or = [
    { adminCode: req.admin.adminCode },
    { hierarchyPath: req.admin._id }
  ];
  return query;
};

// ==================== SUPER ADMIN ROUTES ====================

// Get all subordinates (admins/brokers/sub-brokers) based on hierarchy
// SUPER_ADMIN sees all ADMINs, BROKERs, SUB_BROKERs (created by them or their descendants)
// ADMIN sees BROKERs and SUB_BROKERs created by them or their descendants
// BROKER sees SUB_BROKERs created by them
router.get('/admins', protectAdmin, async (req, res) => {
  try {
    let query = {};
    const allowedChildRoles = getAllowedChildRoles(req.admin.role);
    
    if (req.admin.role === 'SUPER_ADMIN') {
      // Super Admin sees all non-super-admin roles
      query = { role: { $in: ['ADMIN', 'BROKER', 'SUB_BROKER'] } };
    } else if (allowedChildRoles.length > 0) {
      // Other roles see their direct children AND descendants in hierarchy
      query = { 
        role: { $in: allowedChildRoles },
        $or: [
          { parentId: req.admin._id },
          { hierarchyPath: req.admin._id }
        ]
      };
    } else {
      // SUB_BROKER has no subordinates
      return res.json([]);
    }
    
    const admins = await Admin.find(query)
      .select('-password -pin')
      .populate('parentId', 'name adminCode role')
      .sort({ createdAt: -1 });
    
    // Get user counts for each admin
    const adminData = await Promise.all(admins.map(async (admin) => {
      const userCount = await User.countDocuments({ admin: admin._id });
      const activeUsers = await User.countDocuments({ admin: admin._id, isActive: true });
      return {
        ...admin.toObject(),
        stats: {
          ...admin.stats,
          totalUsers: userCount,
          activeUsers
        }
      };
    }));
    
    res.json(adminData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create new subordinate (ADMIN creates BROKER, BROKER creates SUB_BROKER, etc.)
// SUPER_ADMIN can optionally specify parentAdminId to create broker under a specific admin
router.post('/admins', protectAdmin, async (req, res) => {
  try {
    const { username, name, email, phone, password, pin, charges, role: requestedRole, parentAdminId } = req.body;
    
    // Determine the role to create
    const allowedChildRoles = getAllowedChildRoles(req.admin.role);
    let roleToCreate = requestedRole || allowedChildRoles[0];
    
    if (!roleToCreate || !allowedChildRoles.includes(roleToCreate)) {
      return res.status(403).json({ 
        message: `You can only create: ${allowedChildRoles.join(', ') || 'No subordinates allowed'}` 
      });
    }
    
    if (!pin) {
      return res.status(400).json({ message: 'PIN is required' });
    }

    const normalizedPin = pin.toString().trim();
    if (!/^\d{4,6}$/.test(normalizedPin)) {
      return res.status(400).json({ message: 'PIN must be a 4-6 digit number' });
    }
    
    // Check if admin exists
    const exists = await Admin.findOne({ $or: [{ email }, { username }] });
    if (exists) {
      return res.status(400).json({ message: 'User with this email or username already exists' });
    }
    
    // Determine the actual parent for hierarchy
    let actualParent = req.admin;
    
    // SUPER_ADMIN or ADMIN can specify a different parent for the new broker/sub-broker
    if (['SUPER_ADMIN', 'ADMIN'].includes(req.admin.role) && parentAdminId) {
      const specifiedParent = await Admin.findById(parentAdminId);
      if (!specifiedParent) {
        return res.status(400).json({ message: 'Specified parent not found' });
      }
      
      // For ADMIN, verify they can only assign under their own hierarchy
      if (req.admin.role === 'ADMIN') {
        const isInHierarchy = specifiedParent.hierarchyPath?.some(id => id.toString() === req.admin._id.toString()) 
                            || specifiedParent.parentId?.toString() === req.admin._id.toString();
        if (!isInHierarchy && specifiedParent._id.toString() !== req.admin._id.toString()) {
          return res.status(403).json({ message: 'You can only assign under your own hierarchy' });
        }
      }
      
      // Validate parent role based on what we're creating
      // BROKER should be under ADMIN or SUPER_ADMIN
      // SUB_BROKER should be under BROKER
      if (roleToCreate === 'BROKER' && !['SUPER_ADMIN', 'ADMIN'].includes(specifiedParent.role)) {
        return res.status(400).json({ message: 'Broker can only be created under Super Admin or Admin' });
      }
      if (roleToCreate === 'SUB_BROKER' && specifiedParent.role !== 'BROKER') {
        return res.status(400).json({ message: 'Sub-broker can only be created under a Broker' });
      }
      
      actualParent = specifiedParent;
    }
    
    // SUB_BROKER requires a parent broker - enforce this
    if (roleToCreate === 'SUB_BROKER' && actualParent.role !== 'BROKER') {
      return res.status(400).json({ message: 'Sub-broker must be created under a Broker. Please select a parent broker.' });
    }
    
    // Build hierarchy path based on actual parent
    const hierarchyPath = [...(actualParent.hierarchyPath || []), actualParent._id];
    
    const admin = await Admin.create({
      role: roleToCreate,
      username,
      name,
      email,
      phone,
      password,
      pin: normalizedPin,
      charges: charges || {},
      createdBy: req.admin._id,
      parentId: actualParent._id,
      hierarchyPath,
      hierarchyLevel: HIERARCHY_LEVELS[roleToCreate]
    });
    
    res.status(201).json({
      _id: admin._id,
      adminCode: admin.adminCode,
      username: admin.username,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      status: admin.status,
      charges: admin.charges,
      wallet: admin.wallet,
      parentId: admin.parentId,
      hierarchyLevel: admin.hierarchyLevel
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single admin details (Super Admin only)
router.get('/admins/:id', protectAdmin, superAdminOnly, async (req, res) => {
  try {
    const admin = await Admin.findById(req.params.id).select('-password');
    if (!admin) return res.status(404).json({ message: 'Admin not found' });
    
    // Get user stats
    const userCount = await User.countDocuments({ adminCode: admin.adminCode });
    const activeUsers = await User.countDocuments({ adminCode: admin.adminCode, isActive: true });
    
    res.json({
      ...admin.toObject(),
      stats: { ...admin.stats, totalUsers: userCount, activeUsers }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update admin (Super Admin only)
router.put('/admins/:id', protectAdmin, superAdminOnly, async (req, res) => {
  try {
    const { name, phone, status, charges } = req.body;
    
    const admin = await Admin.findById(req.params.id);
    if (!admin) return res.status(404).json({ message: 'Admin not found' });
    if (admin.role === 'SUPER_ADMIN') return res.status(403).json({ message: 'Cannot modify Super Admin' });
    
    if (name) admin.name = name;
    if (phone) admin.phone = phone;
    if (status) {
      admin.status = status;
      admin.isActive = status === 'ACTIVE';
    }
    if (charges) admin.charges = { ...admin.charges, ...charges };
    
    await admin.save();
    res.json(admin);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update admin lot settings (Super Admin only)
router.put('/admins/:id/lot-settings', protectAdmin, superAdminOnly, async (req, res) => {
  try {
    const { lotSettings, enabledLeverages, allowTradingOutsideMarketHours, marginCallPercentage } = req.body;
    
    const admin = await Admin.findById(req.params.id);
    if (!admin) return res.status(404).json({ message: 'Admin not found' });
    if (admin.role === 'SUPER_ADMIN') return res.status(403).json({ message: 'Cannot modify Super Admin settings' });
    
    // Update lot settings
    if (lotSettings) {
      admin.lotSettings = { ...admin.lotSettings, ...lotSettings };
    }
    
    // Update leverage settings
    if (enabledLeverages) {
      if (!admin.leverageSettings) admin.leverageSettings = {};
      admin.leverageSettings.enabledLeverages = enabledLeverages;
      admin.leverageSettings.maxLeverage = Math.max(...enabledLeverages);
    }
    
    // Update trading settings
    if (!admin.tradingSettings) admin.tradingSettings = {};
    if (typeof allowTradingOutsideMarketHours === 'boolean') {
      admin.tradingSettings.allowTradingOutsideMarketHours = allowTradingOutsideMarketHours;
    }
    if (marginCallPercentage) {
      admin.tradingSettings.autoClosePercentage = marginCallPercentage;
    }
    
    await admin.save();
    
    res.json({ 
      message: 'Settings updated successfully', 
      lotSettings: admin.lotSettings,
      leverageSettings: admin.leverageSettings,
      tradingSettings: admin.tradingSettings
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ============ HIERARCHICAL LEVERAGE MANAGEMENT ============

// Set max leverage for child admin (hierarchical)
// SuperAdmin can set for Admin, Admin can set for Broker, Broker can set for SubBroker
router.put('/admins/:id/leverage', protectAdmin, async (req, res) => {
  try {
    const { maxLeverageFromParent, intradayLeverages, carryForwardLeverages } = req.body;
    const parentAdmin = req.admin;
    
    const childAdmin = await Admin.findById(req.params.id);
    if (!childAdmin) return res.status(404).json({ message: 'Admin not found' });
    
    // Verify hierarchy - parent must be able to manage child
    if (!parentAdmin.canManage(childAdmin.role)) {
      return res.status(403).json({ message: 'You cannot manage this admin level' });
    }
    
    // Verify child belongs to parent (check hierarchyPath or parentId)
    if (childAdmin.parentId && childAdmin.parentId.toString() !== parentAdmin._id.toString()) {
      // Check if parent is in hierarchy path
      const isInHierarchy = childAdmin.hierarchyPath?.some(id => id.toString() === parentAdmin._id.toString());
      if (!isInHierarchy && parentAdmin.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ message: 'This admin is not under your management' });
      }
    }
    
    // Get parent's max leverage limit
    const parentMaxLeverage = parentAdmin.role === 'SUPER_ADMIN' 
      ? 2000 // SuperAdmin has unlimited
      : (parentAdmin.leverageSettings?.maxLeverageFromParent || 10);
    
    // Validate maxLeverageFromParent doesn't exceed parent's limit
    if (maxLeverageFromParent && maxLeverageFromParent > parentMaxLeverage) {
      return res.status(400).json({ 
        message: `Cannot set leverage higher than your limit (${parentMaxLeverage}x)` 
      });
    }
    
    // Initialize leverageSettings if not exists
    if (!childAdmin.leverageSettings) {
      childAdmin.leverageSettings = {};
    }
    
    // Update maxLeverageFromParent
    if (maxLeverageFromParent) {
      childAdmin.leverageSettings.maxLeverageFromParent = maxLeverageFromParent;
    }
    
    const maxAllowed = childAdmin.leverageSettings.maxLeverageFromParent || parentMaxLeverage;
    
    // Update intradayLeverages (filter to only include values <= maxLeverageFromParent)
    if (intradayLeverages && Array.isArray(intradayLeverages)) {
      const filteredLeverages = intradayLeverages.filter(lev => lev <= maxAllowed);
      childAdmin.leverageSettings.intradayLeverages = filteredLeverages.sort((a, b) => a - b);
    }
    
    // Update carryForwardLeverages (filter to only include values <= maxLeverageFromParent)
    if (carryForwardLeverages && Array.isArray(carryForwardLeverages)) {
      const filteredLeverages = carryForwardLeverages.filter(lev => lev <= maxAllowed);
      childAdmin.leverageSettings.carryForwardLeverages = filteredLeverages.sort((a, b) => a - b);
    }
    
    // Update legacy enabledLeverages for backward compatibility (combine both)
    const allLeverages = [...new Set([
      ...(childAdmin.leverageSettings.intradayLeverages || []),
      ...(childAdmin.leverageSettings.carryForwardLeverages || [])
    ])].sort((a, b) => a - b);
    childAdmin.leverageSettings.enabledLeverages = allLeverages;
    childAdmin.leverageSettings.maxLeverage = allLeverages.length > 0 ? Math.max(...allLeverages) : 10;
    
    await childAdmin.save();
    
    res.json({ 
      message: 'Leverage settings updated successfully',
      leverageSettings: childAdmin.leverageSettings,
      parentMaxLeverage
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get leverage settings for admin (including parent's limit)
router.get('/admins/:id/leverage', protectAdmin, async (req, res) => {
  try {
    const admin = await Admin.findById(req.params.id);
    if (!admin) return res.status(404).json({ message: 'Admin not found' });
    
    // Get parent's max leverage for context
    let parentMaxLeverage = 2000; // Default for SuperAdmin
    if (admin.parentId) {
      const parentAdmin = await Admin.findById(admin.parentId);
      if (parentAdmin) {
        parentMaxLeverage = parentAdmin.role === 'SUPER_ADMIN' 
          ? 2000 
          : (parentAdmin.leverageSettings?.maxLeverageFromParent || 10);
      }
    }
    
    res.json({
      leverageSettings: admin.leverageSettings || { enabledLeverages: [1, 2, 5, 10], maxLeverage: 10, maxLeverageFromParent: 10 },
      parentMaxLeverage,
      role: admin.role
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Set leverage for user (by parent admin/broker)
router.put('/users/:id/leverage', protectAdmin, async (req, res) => {
  try {
    const { enabledLeverages, maxLeverage } = req.body;
    const parentAdmin = req.admin;
    
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    // Verify user belongs to this admin (by adminCode or hierarchyPath)
    const isDirectParent = user.adminCode === parentAdmin.adminCode;
    const isInHierarchy = user.hierarchyPath?.some(id => id.toString() === parentAdmin._id.toString());
    
    if (!isDirectParent && !isInHierarchy && parentAdmin.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'This user is not under your management' });
    }
    
    // Get parent's max leverage limit
    const parentMaxLeverage = parentAdmin.role === 'SUPER_ADMIN' 
      ? 2000 
      : (parentAdmin.leverageSettings?.maxLeverageFromParent || 10);
    
    // Validate leverages don't exceed parent's limit
    if (enabledLeverages && Array.isArray(enabledLeverages)) {
      const invalidLeverages = enabledLeverages.filter(lev => lev > parentMaxLeverage);
      if (invalidLeverages.length > 0) {
        return res.status(400).json({ 
          message: `Cannot set leverage higher than your limit (${parentMaxLeverage}x). Invalid: ${invalidLeverages.join(', ')}x` 
        });
      }
    }
    
    // Initialize leverageSettings if not exists
    if (!user.leverageSettings) {
      user.leverageSettings = {};
    }
    
    // Update user's leverage settings
    if (enabledLeverages && Array.isArray(enabledLeverages)) {
      user.leverageSettings.enabledLeverages = enabledLeverages.sort((a, b) => a - b);
      user.leverageSettings.maxLeverage = maxLeverage || Math.max(...enabledLeverages);
    }
    
    await user.save();
    
    res.json({ 
      message: 'User leverage settings updated successfully',
      leverageSettings: user.leverageSettings,
      parentMaxLeverage
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get user's leverage settings
router.get('/users/:id/leverage', protectAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    // Get parent admin's leverage limit
    let parentMaxLeverage = 10;
    if (user.admin) {
      const parentAdmin = await Admin.findById(user.admin);
      if (parentAdmin) {
        parentMaxLeverage = parentAdmin.role === 'SUPER_ADMIN' 
          ? 2000 
          : (parentAdmin.leverageSettings?.maxLeverageFromParent || 10);
      }
    }
    
    res.json({
      leverageSettings: user.leverageSettings || { enabledLeverages: [1, 2, 5, 10], maxLeverage: 10 },
      parentMaxLeverage
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ============ END HIERARCHICAL LEVERAGE MANAGEMENT ============

// Create user (Super Admin only) - can assign to any admin
router.post('/create-user', protectAdmin, superAdminOnly, async (req, res) => {
  try {
    const { 
      username, email, password, fullName, phone, adminCode, initialBalance,
      // New settings
      marginType, ledgerBalanceClosePercent, profitTradeHoldSeconds, lossTradeHoldSeconds,
      // Toggle settings
      isActivated, isReadOnly, isDemo, intradaySquare, blockLimitAboveBelowHighLow, blockLimitBetweenHighLow,
      // Segment permissions
      allowedSegments, segmentPermissions, scriptSettings
    } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'Username, email and password are required' });
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email or username already exists' });
    }
    
    // Find the target admin if adminCode is provided and not SUPER
    let targetAdmin = null;
    let targetAdminCode = adminCode || 'SUPER';
    
    if (adminCode && adminCode !== 'SUPER') {
      targetAdmin = await Admin.findOne({ adminCode });
      if (!targetAdmin) {
        return res.status(400).json({ message: 'Invalid admin code' });
      }
    }
    
    // Create user with all settings
    const user = await User.create({
      username,
      email,
      password,
      fullName: fullName || '',
      phone: phone || '',
      adminCode: targetAdminCode,
      admin: targetAdmin?._id || null,
      wallet: {
        balance: initialBalance || 0,
        cashBalance: initialBalance || 0,
        blocked: 0
      },
      isActive: isActivated !== false,
      // New settings
      settings: {
        marginType: marginType || 'exposure',
        ledgerBalanceClosePercent: ledgerBalanceClosePercent || 90,
        profitTradeHoldSeconds: profitTradeHoldSeconds || 0,
        lossTradeHoldSeconds: lossTradeHoldSeconds || 0,
        isActivated: isActivated !== false,
        isReadOnly: isReadOnly || false,
        isDemo: isDemo || false,
        intradaySquare: intradaySquare || false,
        blockLimitAboveBelowHighLow: blockLimitAboveBelowHighLow || false,
        blockLimitBetweenHighLow: blockLimitBetweenHighLow || false
      },
      // Segment permissions with detailed settings
      segmentPermissions: segmentPermissions || {
        MCX: { enabled: true, maxExchangeLots: 100, commissionType: 'PER_LOT', commissionLot: 0, maxLots: 50, minLots: 1, orderLots: 10, exposureIntraday: 1, exposureCarryForward: 1, optionBuy: { allowed: true, commissionType: 'PER_LOT', commission: 0, strikeSelection: 50, maxExchangeLots: 100 }, optionSell: { allowed: true, commissionType: 'PER_LOT', commission: 0, strikeSelection: 50, maxExchangeLots: 100 } },
        NSEINDEX: { enabled: true, maxExchangeLots: 100, commissionType: 'PER_LOT', commissionLot: 0, maxLots: 50, minLots: 1, orderLots: 10, exposureIntraday: 1, exposureCarryForward: 1, optionBuy: { allowed: true, commissionType: 'PER_LOT', commission: 0, strikeSelection: 50, maxExchangeLots: 100 }, optionSell: { allowed: true, commissionType: 'PER_LOT', commission: 0, strikeSelection: 50, maxExchangeLots: 100 } },
        NSESTOCK: { enabled: true, maxExchangeLots: 100, commissionType: 'PER_LOT', commissionLot: 0, maxLots: 50, minLots: 1, orderLots: 10, exposureIntraday: 1, exposureCarryForward: 1, optionBuy: { allowed: true, commissionType: 'PER_LOT', commission: 0, strikeSelection: 50, maxExchangeLots: 100 }, optionSell: { allowed: true, commissionType: 'PER_LOT', commission: 0, strikeSelection: 50, maxExchangeLots: 100 } },
        BSE: { enabled: false, maxExchangeLots: 100, commissionType: 'PER_LOT', commissionLot: 0, maxLots: 50, minLots: 1, orderLots: 10, exposureIntraday: 1, exposureCarryForward: 1, optionBuy: { allowed: true, commissionType: 'PER_LOT', commission: 0, strikeSelection: 50, maxExchangeLots: 100 }, optionSell: { allowed: true, commissionType: 'PER_LOT', commission: 0, strikeSelection: 50, maxExchangeLots: 100 } },
        EQ: { enabled: true, maxExchangeLots: 100, commissionType: 'PER_LOT', commissionLot: 0, maxLots: 50, minLots: 1, orderLots: 10, exposureIntraday: 1, exposureCarryForward: 1, optionBuy: { allowed: true, commissionType: 'PER_LOT', commission: 0, strikeSelection: 50, maxExchangeLots: 100 }, optionSell: { allowed: true, commissionType: 'PER_LOT', commission: 0, strikeSelection: 50, maxExchangeLots: 100 } }
      },
      // Global Script Settings - applies to all segments
      scriptSettings: scriptSettings || {}
    });
    
    // Update admin stats if assigned to an admin
    if (targetAdmin) {
      targetAdmin.stats.totalUsers = (targetAdmin.stats.totalUsers || 0) + 1;
      targetAdmin.stats.activeUsers = (targetAdmin.stats.activeUsers || 0) + 1;
      await targetAdmin.save();
    }
    
    res.status(201).json({
      message: 'User created successfully',
      user: {
        _id: user._id,
        userId: user.userId,
        username: user.username,
        email: user.email,
        adminCode: user.adminCode,
        settings: user.settings,
        segmentPermissions: user.segmentPermissions
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Transfer user to another admin (Super Admin only)
router.post('/users/:userId/transfer', protectAdmin, superAdminOnly, async (req, res) => {
  try {
    const { targetAdminId } = req.body;
    const { userId } = req.params;
    
    if (!targetAdminId) {
      return res.status(400).json({ message: 'Target admin ID is required' });
    }
    
    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Find the target admin
    const targetAdmin = await Admin.findById(targetAdminId);
    if (!targetAdmin) {
      return res.status(404).json({ message: 'Target admin not found' });
    }
    
    if (targetAdmin.status !== 'ACTIVE') {
      return res.status(400).json({ message: 'Target admin is not active' });
    }
    
    // Get the old admin to update stats
    const oldAdmin = await Admin.findById(user.admin);
    const oldAdminCode = user.adminCode;
    
    // Update user's admin reference using updateOne to avoid segmentPermissions validation
    await User.updateOne(
      { _id: userId },
      { $set: { admin: targetAdmin._id, adminCode: targetAdmin.adminCode } }
    );
    
    // Update old admin stats
    if (oldAdmin) {
      await Admin.updateOne(
        { _id: oldAdmin._id },
        { 
          $set: { 
            'stats.totalUsers': Math.max(0, (oldAdmin.stats.totalUsers || 1) - 1),
            'stats.activeUsers': user.isActive ? Math.max(0, (oldAdmin.stats.activeUsers || 1) - 1) : oldAdmin.stats.activeUsers
          }
        }
      );
    }
    
    // Update new admin stats
    await Admin.updateOne(
      { _id: targetAdmin._id },
      { 
        $set: { 
          'stats.totalUsers': (targetAdmin.stats.totalUsers || 0) + 1,
          'stats.activeUsers': user.isActive ? (targetAdmin.stats.activeUsers || 0) + 1 : targetAdmin.stats.activeUsers
        }
      }
    );
    
    res.json({ 
      message: 'User transferred successfully',
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        oldAdminCode,
        newAdminCode: targetAdmin.adminCode,
        newAdminName: targetAdmin.name
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all users for Super Admin (can see all users across all admins)
router.get('/all-users', protectAdmin, superAdminOnly, async (req, res) => {
  try {
    const users = await User.find()
      .select('-password')
      .populate('admin', 'name adminCode')
      .sort({ createdAt: -1 });
    
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add funds to admin wallet (Parent can add to subordinate)
router.post('/admins/:id/add-funds', protectAdmin, async (req, res) => {
  try {
    const { amount, description } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ message: 'Invalid amount' });
    
    const targetAdmin = await Admin.findById(req.params.id);
    if (!targetAdmin) return res.status(404).json({ message: 'Admin not found' });
    
    // Check permission: Super Admin can add to anyone, others can only add to their subordinates
    if (req.admin.role !== 'SUPER_ADMIN') {
      const isSubordinate = targetAdmin.parentId?.toString() === req.admin._id.toString() ||
                           targetAdmin.hierarchyPath?.includes(req.admin._id.toString());
      if (!isSubordinate) {
        return res.status(403).json({ message: 'You can only add funds to your subordinates' });
      }
      
      // Check if parent has sufficient balance
      if (req.admin.wallet.balance < amount) {
        return res.status(400).json({ message: `Insufficient balance. You have ₹${req.admin.wallet.balance.toLocaleString()}` });
      }
      
      // Deduct from parent's wallet
      req.admin.wallet.balance -= amount;
      req.admin.wallet.totalWithdrawn += amount;
      await req.admin.save();
      
      // Create ledger entry for parent (debit)
      await WalletLedger.create({
        ownerType: 'ADMIN',
        ownerId: req.admin._id,
        adminCode: req.admin.adminCode,
        type: 'DEBIT',
        reason: 'ADMIN_TRANSFER',
        amount,
        balanceAfter: req.admin.wallet.balance,
        description: `Transferred to ${targetAdmin.name || targetAdmin.username}`,
        performedBy: req.admin._id
      });
    }
    
    // Update target admin wallet
    targetAdmin.wallet.balance += amount;
    targetAdmin.wallet.totalDeposited += amount;
    await targetAdmin.save();
    
    // Create ledger entry for target (credit)
    await WalletLedger.create({
      ownerType: 'ADMIN',
      ownerId: targetAdmin._id,
      adminCode: targetAdmin.adminCode,
      type: 'CREDIT',
      reason: 'ADMIN_DEPOSIT',
      amount,
      balanceAfter: targetAdmin.wallet.balance,
      description: description || `Fund added by ${req.admin.name || req.admin.username}`,
      performedBy: req.admin._id
    });
    
    res.json({ message: 'Funds added successfully', wallet: targetAdmin.wallet });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Deduct funds from admin wallet (Parent can deduct from subordinate)
router.post('/admins/:id/deduct-funds', protectAdmin, async (req, res) => {
  try {
    const { amount, description } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ message: 'Invalid amount' });
    
    const targetAdmin = await Admin.findById(req.params.id);
    if (!targetAdmin) return res.status(404).json({ message: 'Admin not found' });
    
    // Check permission: Super Admin can deduct from anyone, others can only deduct from their subordinates
    if (req.admin.role !== 'SUPER_ADMIN') {
      const isSubordinate = targetAdmin.parentId?.toString() === req.admin._id.toString() ||
                           targetAdmin.hierarchyPath?.includes(req.admin._id.toString());
      if (!isSubordinate) {
        return res.status(403).json({ message: 'You can only deduct funds from your subordinates' });
      }
    }
    
    if (targetAdmin.wallet.balance < amount) {
      return res.status(400).json({ message: 'Insufficient balance in target wallet' });
    }
    
    // Update target admin wallet
    targetAdmin.wallet.balance -= amount;
    targetAdmin.wallet.totalWithdrawn += amount;
    await targetAdmin.save();
    
    // Create ledger entry for target (debit)
    await WalletLedger.create({
      ownerType: 'ADMIN',
      ownerId: targetAdmin._id,
      adminCode: targetAdmin.adminCode,
      type: 'DEBIT',
      reason: 'ADMIN_WITHDRAW',
      amount,
      balanceAfter: targetAdmin.wallet.balance,
      description: description || `Fund deducted by ${req.admin.name || req.admin.username}`,
      performedBy: req.admin._id
    });
    
    // Credit back to parent (except Super Admin)
    if (req.admin.role !== 'SUPER_ADMIN') {
      req.admin.wallet.balance += amount;
      req.admin.wallet.totalDeposited += amount;
      await req.admin.save();
      
      // Create ledger entry for parent (credit)
      await WalletLedger.create({
        ownerType: 'ADMIN',
        ownerId: req.admin._id,
        adminCode: req.admin.adminCode,
        type: 'CREDIT',
        reason: 'ADMIN_TRANSFER',
        amount,
        balanceAfter: req.admin.wallet.balance,
        description: `Received from ${targetAdmin.name || targetAdmin.username}`,
        performedBy: req.admin._id
      });
    }
    
    res.json({ message: 'Funds deducted successfully', wallet: targetAdmin.wallet });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get dashboard stats - works for all roles based on hierarchy
router.get('/dashboard-stats', protectAdmin, async (req, res) => {
  try {
    let adminQuery = {};
    let userQuery = {};
    
    if (req.admin.role === 'SUPER_ADMIN') {
      // Super Admin sees all
      adminQuery = { role: { $ne: 'SUPER_ADMIN' } };
      userQuery = {};
    } else {
      // Other roles see only their descendants
      adminQuery = { hierarchyPath: req.admin._id };
      userQuery = { hierarchyPath: req.admin._id };
    }
    
    // Count by role
    const totalAdmins = await Admin.countDocuments({ ...adminQuery, role: 'ADMIN' });
    const activeAdmins = await Admin.countDocuments({ ...adminQuery, role: 'ADMIN', status: 'ACTIVE' });
    const totalBrokers = await Admin.countDocuments({ ...adminQuery, role: 'BROKER' });
    const activeBrokers = await Admin.countDocuments({ ...adminQuery, role: 'BROKER', status: 'ACTIVE' });
    const totalSubBrokers = await Admin.countDocuments({ ...adminQuery, role: 'SUB_BROKER' });
    const activeSubBrokers = await Admin.countDocuments({ ...adminQuery, role: 'SUB_BROKER', status: 'ACTIVE' });
    
    // User counts
    const totalUsers = await User.countDocuments(userQuery);
    const activeUsers = await User.countDocuments({ ...userQuery, isActive: true });
    
    // Direct users (users created directly by this admin)
    const directUsers = req.admin.role !== 'SUPER_ADMIN' 
      ? await User.countDocuments({ admin: req.admin._id })
      : totalUsers;
    
    // Aggregate wallet balances
    const adminWallets = await Admin.aggregate([
      { $match: { ...adminQuery, role: { $in: ['ADMIN', 'BROKER', 'SUB_BROKER'] } } },
      { $group: { _id: null, totalBalance: { $sum: '$wallet.balance' } } }
    ]);
    
    const userWallets = await User.aggregate([
      { $match: userQuery },
      { $group: { _id: null, totalBalance: { $sum: '$wallet.cashBalance' } } }
    ]);
    
    res.json({
      // Admins
      totalAdmins,
      activeAdmins,
      // Brokers
      totalBrokers,
      activeBrokers,
      // Sub Brokers
      totalSubBrokers,
      activeSubBrokers,
      // Users
      totalUsers,
      activeUsers,
      directUsers,
      // Balances
      totalAdminBalance: adminWallets[0]?.totalBalance || 0,
      totalUserBalance: userWallets[0]?.totalBalance || 0,
      // Current admin info
      myRole: req.admin.role,
      myBalance: req.admin.wallet?.balance || 0
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ==================== ADMIN ROUTES (Both Super Admin & Admin) ====================

// Get my profile
router.get('/profile', protectAdmin, async (req, res) => {
  try {
    res.json(req.admin);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update my profile
router.put('/profile', protectAdmin, async (req, res) => {
  try {
    const { name, phone } = req.body;
    
    if (name) req.admin.name = name;
    if (phone) req.admin.phone = phone;
    
    await req.admin.save();
    res.json(req.admin);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get my users (Admin sees only their users, Super Admin sees all)
router.get('/users', protectAdmin, async (req, res) => {
  try {
    const query = applyAdminFilter(req);
    const users = await User.find(query).select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create user (All roles can create users under them)
router.post('/users', protectAdmin, async (req, res) => {
  try {
    const { username, email, password, fullName, phone } = req.body;
    
    // Check if user exists
    const exists = await User.findOne({ $or: [{ email }, { username }] });
    if (exists) {
      return res.status(400).json({ message: 'User with this email or username already exists' });
    }
    
    // Build hierarchy path for the user (includes all ancestors + creator)
    const userHierarchyPath = [...(req.admin.hierarchyPath || []), req.admin._id];
    
    const user = await User.create({
      adminCode: req.admin.adminCode,
      admin: req.admin._id,
      creatorRole: req.admin.role,
      hierarchyPath: userHierarchyPath,
      username,
      email,
      password,
      fullName,
      phone,
      createdBy: req.admin._id
    });
    
    // Update admin stats
    req.admin.stats.totalUsers += 1;
    req.admin.stats.activeUsers += 1;
    await req.admin.save();
    
    res.status(201).json({
      _id: user._id,
      userId: user.userId,
      adminCode: user.adminCode,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      wallet: user.wallet,
      creatorRole: user.creatorRole
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single user
router.get('/users/:id', protectAdmin, async (req, res) => {
  try {
    const query = applyAdminFilter(req, { _id: req.params.id });
    const user = await User.findOne(query).select('-password');
    
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update user
router.put('/users/:id', protectAdmin, async (req, res) => {
  try {
    const query = applyAdminFilter(req, { _id: req.params.id });
    const user = await User.findOne(query);
    
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    const { fullName, phone, tradingStatus, isActive } = req.body;
    
    if (fullName) user.fullName = fullName;
    if (phone) user.phone = phone;
    if (tradingStatus) user.tradingStatus = tradingStatus;
    if (typeof isActive === 'boolean') user.isActive = isActive;
    
    await user.save();
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update user segment and script settings (Admin can update their own users)
router.put('/users/:id/settings', protectAdmin, async (req, res) => {
  try {
    const query = applyAdminFilter(req, { _id: req.params.id });
    const user = await User.findOne(query);
    
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    const { segmentPermissions, scriptSettings, mergeScriptSettings } = req.body;
    
    const updateFields = {};
    if (segmentPermissions) {
      updateFields.segmentPermissions = segmentPermissions;
    }
    if (scriptSettings) {
      // If mergeScriptSettings is true, merge with existing instead of replacing
      if (mergeScriptSettings) {
        // Get existing script settings as plain object
        const existingSettings = user.scriptSettings instanceof Map 
          ? Object.fromEntries(user.scriptSettings) 
          : (user.scriptSettings || {});
        
        // Deep merge each script's settings
        const mergedSettings = { ...existingSettings };
        for (const [symbol, newSettings] of Object.entries(scriptSettings)) {
          if (mergedSettings[symbol]) {
            // Merge with existing script settings
            mergedSettings[symbol] = {
              ...mergedSettings[symbol],
              ...newSettings,
              // Deep merge nested objects
              lotSettings: { ...mergedSettings[symbol]?.lotSettings, ...newSettings?.lotSettings },
              quantitySettings: { ...mergedSettings[symbol]?.quantitySettings, ...newSettings?.quantitySettings },
              fixedMargin: { ...mergedSettings[symbol]?.fixedMargin, ...newSettings?.fixedMargin },
              brokerage: { ...mergedSettings[symbol]?.brokerage, ...newSettings?.brokerage },
              block: { ...mergedSettings[symbol]?.block, ...newSettings?.block },
              spread: newSettings?.spread !== undefined ? newSettings.spread : mergedSettings[symbol]?.spread
            };
          } else {
            // New script, add as-is
            mergedSettings[symbol] = newSettings;
          }
        }
        updateFields.scriptSettings = mergedSettings;
      } else {
        updateFields.scriptSettings = scriptSettings;
      }
    }
    
    // Use updateOne to avoid segmentPermissions validation error
    await User.updateOne({ _id: user._id }, { $set: updateFields });
    
    const updatedUser = await User.findById(user._id).select('-password');
    res.json({ message: 'User settings updated successfully', user: updatedUser });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update single script setting for a user (merge only that script)
router.put('/users/:id/script-settings/:symbol', protectAdmin, async (req, res) => {
  try {
    const query = applyAdminFilter(req, { _id: req.params.id });
    const user = await User.findOne(query);
    
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    const symbol = req.params.symbol;
    const scriptSetting = req.body;
    
    // Get existing script settings as plain object
    const existingSettings = user.scriptSettings instanceof Map 
      ? Object.fromEntries(user.scriptSettings) 
      : (user.scriptSettings || {});
    
    // Merge with existing settings for this symbol
    const existingScriptSetting = existingSettings[symbol] || {};
    const mergedScriptSetting = {
      ...existingScriptSetting,
      ...scriptSetting,
      // Deep merge nested objects only if they exist in new settings
      ...(scriptSetting.lotSettings && { lotSettings: { ...existingScriptSetting?.lotSettings, ...scriptSetting.lotSettings } }),
      ...(scriptSetting.quantitySettings && { quantitySettings: { ...existingScriptSetting?.quantitySettings, ...scriptSetting.quantitySettings } }),
      ...(scriptSetting.fixedMargin && { fixedMargin: { ...existingScriptSetting?.fixedMargin, ...scriptSetting.fixedMargin } }),
      ...(scriptSetting.brokerage && { brokerage: { ...existingScriptSetting?.brokerage, ...scriptSetting.brokerage } }),
      ...(scriptSetting.block && { block: { ...existingScriptSetting?.block, ...scriptSetting.block } })
    };
    
    existingSettings[symbol] = mergedScriptSetting;
    
    await User.updateOne({ _id: user._id }, { $set: { scriptSettings: existingSettings } });
    
    const updatedUser = await User.findById(user._id).select('-password');
    res.json({ message: `Script settings for ${symbol} updated successfully`, user: updatedUser });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Copy user segment and script settings to another user (Admin can copy between their own users)
router.post('/users/:id/copy-settings', protectAdmin, async (req, res) => {
  try {
    const query = applyAdminFilter(req, { _id: req.params.id });
    const targetUser = await User.findOne(query);
    
    if (!targetUser) return res.status(404).json({ message: 'Target user not found' });
    
    const { sourceUserId, segmentPermissions, scriptSettings } = req.body;
    
    if (!sourceUserId) {
      return res.status(400).json({ message: 'Source user ID is required' });
    }
    
    const sourceQuery = applyAdminFilter(req, { _id: sourceUserId });
    const sourceUser = await User.findOne(sourceQuery);
    if (!sourceUser) return res.status(404).json({ message: 'Source user not found' });
    
    const updateFields = {};
    
    // Copy segment permissions - convert to plain object if it's a Map
    if (segmentPermissions) {
      if (segmentPermissions instanceof Map) {
        updateFields.segmentPermissions = Object.fromEntries(segmentPermissions);
      } else if (typeof segmentPermissions === 'object') {
        updateFields.segmentPermissions = segmentPermissions;
      }
    }
    
    // Copy script settings - convert to plain object if it's a Map
    if (scriptSettings) {
      if (scriptSettings instanceof Map) {
        updateFields.scriptSettings = Object.fromEntries(scriptSettings);
      } else if (typeof scriptSettings === 'object') {
        updateFields.scriptSettings = scriptSettings;
      }
    }
    
    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ message: 'No settings to copy' });
    }
    
    // Use updateOne to avoid segmentPermissions validation error
    await User.updateOne({ _id: targetUser._id }, { $set: updateFields });
    
    const updatedUser = await User.findById(targetUser._id).select('-password');
    res.json({ message: 'Settings copied successfully', user: updatedUser });
  } catch (error) {
    console.error('Copy settings error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Update user password (Admin/Super Admin)
router.put('/users/:id/password', protectAdmin, async (req, res) => {
  try {
    const query = applyAdminFilter(req, { _id: req.params.id });
    const user = await User.findOne(query);
    
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }
    
    user.password = password;
    await user.save();
    
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add funds to user (Admin → User)
router.post('/users/:id/add-funds', protectAdmin, async (req, res) => {
  try {
    const { amount, description } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ message: 'Invalid amount' });
    
    const query = applyAdminFilter(req, { _id: req.params.id });
    const user = await User.findOne(query);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    let userAdmin = null;
    let newAdminBalance = 0;
    
    // Determine which admin's wallet to deduct from
    if (req.admin.role === 'SUPER_ADMIN') {
      // Super Admin: deduct from user's admin wallet
      userAdmin = await Admin.findOne({ adminCode: user.adminCode });
      if (!userAdmin) {
        return res.status(404).json({ message: 'User admin not found' });
      }
      if (userAdmin.wallet.balance < amount) {
        return res.status(400).json({ 
          message: `Insufficient balance in admin ${userAdmin.name || userAdmin.username}'s wallet. Available: ₹${userAdmin.wallet.balance}` 
        });
      }
      newAdminBalance = userAdmin.wallet.balance - amount;
    } else {
      // Regular Admin: deduct from their own wallet
      if (req.admin.wallet.balance < amount) {
        return res.status(400).json({ message: 'Insufficient admin wallet balance' });
      }
      userAdmin = req.admin;
      newAdminBalance = req.admin.wallet.balance - amount;
    }
    
    // Deduct from admin wallet using updateOne
    await Admin.updateOne(
      { _id: userAdmin._id },
      { $set: { 'wallet.balance': newAdminBalance } }
    );
    
    // Create admin ledger entry
    await WalletLedger.create({
      ownerType: 'ADMIN',
      ownerId: userAdmin._id,
      adminCode: userAdmin.adminCode,
      type: 'DEBIT',
      reason: 'FUND_ADD',
      amount,
      balanceAfter: newAdminBalance,
      description: `Fund added to user ${user.userId}${req.admin.role === 'SUPER_ADMIN' ? ' by Super Admin' : ''}`,
      performedBy: req.admin._id
    });
    
    // Add to user wallet using updateOne to avoid segmentPermissions validation
    const newUserCashBalance = user.wallet.cashBalance + amount;
    await User.updateOne(
      { _id: user._id },
      { $set: { 'wallet.cashBalance': newUserCashBalance, 'wallet.balance': newUserCashBalance } }
    );
    
    // Create user ledger entry
    await WalletLedger.create({
      ownerType: 'USER',
      ownerId: user._id,
      adminCode: user.adminCode,
      type: 'CREDIT',
      reason: 'FUND_ADD',
      amount,
      balanceAfter: newUserCashBalance,
      description: description || 'Fund added by admin',
      performedBy: req.admin._id
    });
    
    res.json({ 
      message: 'Funds added successfully', 
      userWallet: { ...user.wallet, cashBalance: newUserCashBalance, balance: newUserCashBalance },
      adminWallet: { balance: newAdminBalance },
      deductedFromAdmin: userAdmin.adminCode
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Deduct funds from user
router.post('/users/:id/deduct-funds', protectAdmin, async (req, res) => {
  try {
    const { amount, description } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ message: 'Invalid amount' });
    
    const query = applyAdminFilter(req, { _id: req.params.id });
    const user = await User.findOne(query);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    if (user.wallet.cashBalance < amount) {
      return res.status(400).json({ message: 'Insufficient user balance' });
    }
    
    // Deduct from user wallet using updateOne to avoid segmentPermissions validation
    const newUserCashBalance = user.wallet.cashBalance - amount;
    await User.updateOne(
      { _id: user._id },
      { $set: { 'wallet.cashBalance': newUserCashBalance, 'wallet.balance': newUserCashBalance } }
    );
    
    let userAdmin = null;
    let newAdminBalance = 0;
    
    // Determine which admin's wallet to credit
    if (req.admin.role === 'SUPER_ADMIN') {
      // Super Admin: credit to user's admin wallet
      userAdmin = await Admin.findOne({ adminCode: user.adminCode });
      if (!userAdmin) {
        return res.status(404).json({ message: 'User admin not found' });
      }
      newAdminBalance = userAdmin.wallet.balance + amount;
    } else {
      // Regular Admin: credit to their own wallet
      userAdmin = req.admin;
      newAdminBalance = req.admin.wallet.balance + amount;
    }
    
    // Credit to admin wallet
    await Admin.updateOne(
      { _id: userAdmin._id },
      { $set: { 'wallet.balance': newAdminBalance } }
    );
    
    // Create admin ledger entry
    await WalletLedger.create({
      ownerType: 'ADMIN',
      ownerId: userAdmin._id,
      adminCode: userAdmin.adminCode,
      type: 'CREDIT',
      reason: 'FUND_WITHDRAW',
      amount,
      balanceAfter: newAdminBalance,
      description: `Fund deducted from user ${user.userId}${req.admin.role === 'SUPER_ADMIN' ? ' by Super Admin' : ''}`,
      performedBy: req.admin._id
    });
    
    // Create user ledger entry
    await WalletLedger.create({
      ownerType: 'USER',
      ownerId: user._id,
      adminCode: user.adminCode,
      type: 'DEBIT',
      reason: 'FUND_WITHDRAW',
      amount,
      balanceAfter: newUserCashBalance,
      description: description || 'Fund deducted by admin',
      performedBy: req.admin._id
    });
    
    res.json({ 
      message: 'Funds deducted successfully', 
      userWallet: { ...user.wallet, cashBalance: newUserCashBalance, balance: newUserCashBalance },
      adminWallet: { balance: newAdminBalance },
      creditedToAdmin: userAdmin.adminCode
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ==================== TRADING WALLET ROUTES ====================

// Add funds directly to user's trading wallet
router.post('/users/:id/add-trading-funds', protectAdmin, async (req, res) => {
  try {
    const { amount, description } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ message: 'Invalid amount' });
    
    const query = applyAdminFilter(req, { _id: req.params.id });
    const user = await User.findOne(query);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    let userAdmin = null;
    let newAdminBalance = 0;
    
    // Determine which admin's wallet to deduct from
    if (req.admin.role === 'SUPER_ADMIN') {
      // Super Admin: deduct from user's admin wallet
      userAdmin = await Admin.findOne({ adminCode: user.adminCode });
      if (!userAdmin) {
        return res.status(404).json({ message: 'User admin not found' });
      }
      if (userAdmin.wallet.balance < amount) {
        return res.status(400).json({ 
          message: `Insufficient balance in admin ${userAdmin.name || userAdmin.username}'s wallet. Available: ₹${userAdmin.wallet.balance}` 
        });
      }
      newAdminBalance = userAdmin.wallet.balance - amount;
    } else {
      // Regular Admin: deduct from their own wallet
      if (req.admin.wallet.balance < amount) {
        return res.status(400).json({ message: 'Insufficient admin wallet balance' });
      }
      userAdmin = req.admin;
      newAdminBalance = req.admin.wallet.balance - amount;
    }
    
    // Deduct from admin wallet
    await Admin.updateOne(
      { _id: userAdmin._id },
      { $set: { 'wallet.balance': newAdminBalance } }
    );
    
    // Create admin ledger entry
    await WalletLedger.create({
      ownerType: 'ADMIN',
      ownerId: userAdmin._id,
      adminCode: userAdmin.adminCode,
      type: 'DEBIT',
      reason: 'TRADING_FUND_ADD',
      amount,
      balanceAfter: newAdminBalance,
      description: `Trading fund added to user ${user.userId}${req.admin.role === 'SUPER_ADMIN' ? ' by Super Admin' : ''}`,
      performedBy: req.admin._id
    });
    
    // Add directly to trading balance
    const newTradingBalance = (user.wallet.tradingBalance || 0) + amount;
    
    await User.updateOne(
      { _id: user._id },
      { $set: { 'wallet.tradingBalance': newTradingBalance } }
    );
    
    // Create user ledger entry
    await WalletLedger.create({
      ownerType: 'USER',
      ownerId: user._id,
      adminCode: user.adminCode,
      type: 'CREDIT',
      reason: 'TRADING_FUND_ADD',
      amount,
      balanceAfter: newTradingBalance,
      description: description || 'Trading funds added by admin',
      performedBy: req.admin._id
    });
    
    res.json({ 
      message: 'Trading funds added successfully', 
      userWallet: { ...user.wallet, tradingBalance: newTradingBalance },
      adminWallet: { balance: newAdminBalance },
      deductedFromAdmin: userAdmin.adminCode
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Deduct/Withdraw funds from user's trading wallet
router.post('/users/:id/deduct-trading-funds', protectAdmin, async (req, res) => {
  try {
    const { amount, description } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ message: 'Invalid amount' });
    
    const query = applyAdminFilter(req, { _id: req.params.id });
    const user = await User.findOne(query);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    const currentTradingBalance = user.wallet.tradingBalance || 0;
    const usedMargin = user.wallet.usedMargin || 0;
    const availableBalance = currentTradingBalance - usedMargin;
    
    if (availableBalance < amount) {
      return res.status(400).json({ 
        message: `Insufficient trading balance. Available: ₹${availableBalance.toLocaleString()} (Total: ₹${currentTradingBalance.toLocaleString()}, Margin Used: ₹${usedMargin.toLocaleString()})` 
      });
    }
    
    // Deduct from trading balance
    const newTradingBalance = currentTradingBalance - amount;
    
    await User.updateOne(
      { _id: user._id },
      { $set: { 'wallet.tradingBalance': newTradingBalance } }
    );
    
    // Create user ledger entry
    await WalletLedger.create({
      ownerType: 'USER',
      ownerId: user._id,
      adminCode: user.adminCode,
      type: 'DEBIT',
      reason: 'TRADING_FUND_WITHDRAW',
      amount,
      balanceAfter: newTradingBalance,
      description: description || 'Trading funds withdrawn by admin',
      performedBy: req.admin._id
    });
    
    let userAdmin = null;
    let newAdminBalance = 0;
    
    // Determine which admin's wallet to credit
    if (req.admin.role === 'SUPER_ADMIN') {
      // Super Admin: credit to user's admin wallet
      userAdmin = await Admin.findOne({ adminCode: user.adminCode });
      if (!userAdmin) {
        return res.status(404).json({ message: 'User admin not found' });
      }
      newAdminBalance = userAdmin.wallet.balance + amount;
    } else {
      // Regular Admin: credit to their own wallet
      userAdmin = req.admin;
      newAdminBalance = req.admin.wallet.balance + amount;
    }
    
    // Credit to admin wallet
    await Admin.updateOne(
      { _id: userAdmin._id },
      { $set: { 'wallet.balance': newAdminBalance } }
    );
    
    // Create admin ledger entry
    await WalletLedger.create({
      ownerType: 'ADMIN',
      ownerId: userAdmin._id,
      adminCode: userAdmin.adminCode,
      type: 'CREDIT',
      reason: 'TRADING_FUND_WITHDRAW',
      amount,
      balanceAfter: newAdminBalance,
      description: `Trading fund withdrawn from user ${user.userId}${req.admin.role === 'SUPER_ADMIN' ? ' by Super Admin' : ''}`,
      performedBy: req.admin._id
    });
    
    res.json({ 
      message: 'Trading funds withdrawn successfully', 
      userWallet: { ...user.wallet, tradingBalance: newTradingBalance },
      adminWallet: { balance: newAdminBalance },
      creditedToAdmin: userAdmin.adminCode
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ==================== CRYPTO WALLET ROUTES ====================

// Add funds to user's crypto wallet (Admin → User)
router.post('/users/:id/add-crypto-funds', protectAdmin, async (req, res) => {
  try {
    const { amount, description } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ message: 'Invalid amount' });
    
    const query = applyAdminFilter(req, { _id: req.params.id });
    const user = await User.findOne(query);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    // Add to user's crypto wallet
    const currentCryptoBalance = user.cryptoWallet?.balance || 0;
    const newCryptoBalance = currentCryptoBalance + amount;
    
    await User.updateOne(
      { _id: user._id },
      { $set: { 'cryptoWallet.balance': newCryptoBalance } }
    );
    
    // Create ledger entry
    await WalletLedger.create({
      ownerType: 'USER',
      ownerId: user._id,
      adminCode: user.adminCode,
      type: 'CREDIT',
      reason: 'CRYPTO_DEPOSIT',
      amount,
      balanceAfter: newCryptoBalance,
      description: description || 'Crypto funds added by admin',
      performedBy: req.admin._id
    });
    
    res.json({ 
      message: 'Crypto funds added successfully', 
      cryptoWallet: { balance: newCryptoBalance }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Deduct funds from user's crypto wallet
router.post('/users/:id/deduct-crypto-funds', protectAdmin, async (req, res) => {
  try {
    const { amount, description } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ message: 'Invalid amount' });
    
    const query = applyAdminFilter(req, { _id: req.params.id });
    const user = await User.findOne(query);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    const currentCryptoBalance = user.cryptoWallet?.balance || 0;
    if (currentCryptoBalance < amount) {
      return res.status(400).json({ message: 'Insufficient crypto wallet balance' });
    }
    
    const newCryptoBalance = currentCryptoBalance - amount;
    
    await User.updateOne(
      { _id: user._id },
      { $set: { 'cryptoWallet.balance': newCryptoBalance } }
    );
    
    // Create ledger entry
    await WalletLedger.create({
      ownerType: 'USER',
      ownerId: user._id,
      adminCode: user.adminCode,
      type: 'DEBIT',
      reason: 'CRYPTO_WITHDRAW',
      amount,
      balanceAfter: newCryptoBalance,
      description: description || 'Crypto funds deducted by admin',
      performedBy: req.admin._id
    });
    
    res.json({ 
      message: 'Crypto funds deducted successfully', 
      cryptoWallet: { balance: newCryptoBalance }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ==================== BANK ACCOUNT ROUTES ====================

// Get bank accounts
router.get('/bank-accounts', protectAdmin, async (req, res) => {
  try {
    const query = req.admin.role === 'SUPER_ADMIN' ? {} : { adminCode: req.admin.adminCode };
    const accounts = await BankAccount.find(query).sort({ createdAt: -1 });
    res.json(accounts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add bank account
router.post('/bank-accounts', protectAdmin, async (req, res) => {
  try {
    if (req.admin.role === 'SUPER_ADMIN') {
      return res.status(400).json({ message: 'Super Admin cannot add bank accounts' });
    }
    
    const { type, holderName, bankName, accountNumber, ifsc, accountType, upiId, qrCodeUrl } = req.body;
    
    const account = await BankAccount.create({
      adminCode: req.admin.adminCode,
      admin: req.admin._id,
      type,
      holderName,
      bankName,
      accountNumber,
      ifsc,
      accountType,
      upiId,
      qrCodeUrl
    });
    
    res.status(201).json(account);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update bank account
router.put('/bank-accounts/:id', protectAdmin, async (req, res) => {
  try {
    const query = req.admin.role === 'SUPER_ADMIN' 
      ? { _id: req.params.id }
      : { _id: req.params.id, adminCode: req.admin.adminCode };
    
    const account = await BankAccount.findOne(query);
    if (!account) return res.status(404).json({ message: 'Bank account not found' });
    
    const updates = req.body;
    Object.keys(updates).forEach(key => {
      if (key !== 'adminCode' && key !== 'admin') {
        account[key] = updates[key];
      }
    });
    
    await account.save();
    res.json(account);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete bank account
router.delete('/bank-accounts/:id', protectAdmin, async (req, res) => {
  try {
    const query = req.admin.role === 'SUPER_ADMIN' 
      ? { _id: req.params.id }
      : { _id: req.params.id, adminCode: req.admin.adminCode };
    
    const account = await BankAccount.findOneAndDelete(query);
    if (!account) return res.status(404).json({ message: 'Bank account not found' });
    
    res.json({ message: 'Bank account deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ==================== FUND REQUEST ROUTES ====================

// Get ALL fund requests (Super Admin only)
router.get('/all-fund-requests', protectAdmin, superAdminOnly, async (req, res) => {
  try {
    const { status, type } = req.query;
    let query = {};
    if (status && status !== 'ALL') query.status = status;
    if (type) query.type = type;
    
    const requests = await FundRequest.find(query)
      .populate('user', 'username fullName email userId adminCode')
      .populate('processedBy', 'username adminCode')
      .populate('bankAccount', 'bankName accountNumber')
      .sort({ createdAt: -1 })
      .limit(500);
    
    // Add admin info from adminCode
    const requestsWithAdmin = await Promise.all(requests.map(async (req) => {
      const reqObj = req.toObject();
      if (req.adminCode) {
        const admin = await Admin.findOne({ adminCode: req.adminCode });
        reqObj.admin = admin ? { 
          name: admin.name, 
          username: admin.username, 
          adminCode: admin.adminCode,
          role: admin.role 
        } : null;
      }
      return reqObj;
    }));
    
    // Calculate stats
    const allRequests = await FundRequest.find({});
    const stats = {
      pending: allRequests.filter(r => r.status === 'PENDING').length,
      approved: allRequests.filter(r => r.status === 'APPROVED').length,
      rejected: allRequests.filter(r => r.status === 'REJECTED').length,
      totalDeposits: allRequests.filter(r => r.type === 'DEPOSIT' && r.status === 'APPROVED').reduce((sum, r) => sum + r.amount, 0),
      totalWithdrawals: allRequests.filter(r => r.type === 'WITHDRAWAL' && r.status === 'APPROVED').reduce((sum, r) => sum + r.amount, 0)
    };
    
    res.json({ requests: requestsWithAdmin, stats });
  } catch (error) {
    console.error('Error fetching all fund requests:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get fund requests (for specific admin)
router.get('/fund-requests', protectAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    const query = applyAdminFilter(req);
    if (status) query.status = status;
    
    const requests = await FundRequest.find(query)
      .populate('user', 'username fullName email userId')
      .sort({ createdAt: -1 });
    
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Approve fund request
router.post('/fund-requests/:id/approve', protectAdmin, async (req, res) => {
  try {
    const query = applyAdminFilter(req, { _id: req.params.id, status: 'PENDING' });
    const request = await FundRequest.findOne(query);
    
    if (!request) return res.status(404).json({ message: 'Fund request not found or already processed' });
    
    const user = await User.findById(request.user);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    let newUserCashBalance = user.wallet.cashBalance;
    let newAdminBalance = req.admin.wallet.balance;
    
    if (request.type === 'DEPOSIT') {
      // For deposits, admin wallet is debited, user wallet is credited
      if (req.admin.role === 'ADMIN') {
        if (req.admin.wallet.balance < request.amount) {
          return res.status(400).json({ message: 'Insufficient admin wallet balance' });
        }
        
        newAdminBalance = req.admin.wallet.balance - request.amount;
        await Admin.updateOne(
          { _id: req.admin._id },
          { $set: { 'wallet.balance': newAdminBalance } }
        );
        
        await WalletLedger.create({
          ownerType: 'ADMIN',
          ownerId: req.admin._id,
          adminCode: req.admin.adminCode,
          type: 'DEBIT',
          reason: 'FUND_ADD',
          amount: request.amount,
          balanceAfter: newAdminBalance,
          reference: { type: 'FundRequest', id: request._id },
          performedBy: req.admin._id
        });
      }
      
      // Use updateOne to avoid segmentPermissions validation error
      newUserCashBalance = user.wallet.cashBalance + request.amount;
      await User.updateOne(
        { _id: user._id },
        { $set: { 'wallet.cashBalance': newUserCashBalance, 'wallet.balance': newUserCashBalance } }
      );
      
      await WalletLedger.create({
        ownerType: 'USER',
        ownerId: user._id,
        adminCode: user.adminCode,
        type: 'CREDIT',
        reason: 'FUND_ADD',
        amount: request.amount,
        balanceAfter: newUserCashBalance,
        reference: { type: 'FundRequest', id: request._id },
        performedBy: req.admin._id
      });
    } else {
      // For withdrawals, user wallet is debited
      if (user.wallet.cashBalance < request.amount) {
        return res.status(400).json({ message: 'Insufficient user balance' });
      }
      
      // Use updateOne to avoid segmentPermissions validation error
      newUserCashBalance = user.wallet.cashBalance - request.amount;
      await User.updateOne(
        { _id: user._id },
        { $set: { 'wallet.cashBalance': newUserCashBalance, 'wallet.balance': newUserCashBalance } }
      );
      
      await WalletLedger.create({
        ownerType: 'USER',
        ownerId: user._id,
        adminCode: user.adminCode,
        type: 'DEBIT',
        reason: 'FUND_WITHDRAW',
        amount: request.amount,
        balanceAfter: newUserCashBalance,
        reference: { type: 'FundRequest', id: request._id },
        performedBy: req.admin._id
      });
    }
    
    request.status = 'APPROVED';
    request.processedBy = req.admin._id;
    request.processedAt = new Date();
    request.adminRemarks = req.body.remarks || '';
    await request.save();
    
    res.json({ message: 'Fund request approved', request });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Reject fund request
router.post('/fund-requests/:id/reject', protectAdmin, async (req, res) => {
  try {
    const query = applyAdminFilter(req, { _id: req.params.id, status: 'PENDING' });
    const request = await FundRequest.findOne(query);
    
    if (!request) return res.status(404).json({ message: 'Fund request not found or already processed' });
    
    request.status = 'REJECTED';
    request.processedBy = req.admin._id;
    request.processedAt = new Date();
    request.adminRemarks = req.body.remarks || '';
    await request.save();
    
    res.json({ message: 'Fund request rejected', request });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ==================== LEDGER ROUTES ====================

// Get wallet ledger
router.get('/ledger', protectAdmin, async (req, res) => {
  try {
    const { ownerType, ownerId, limit = 50 } = req.query;
    const query = applyAdminFilter(req);
    
    if (ownerType) query.ownerType = ownerType;
    if (ownerId) query.ownerId = ownerId;
    
    const ledger = await WalletLedger.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));
    
    res.json(ledger);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get admin's own ledger
router.get('/my-ledger', protectAdmin, async (req, res) => {
  try {
    const ledger = await WalletLedger.find({
      ownerType: 'ADMIN',
      ownerId: req.admin._id
    }).sort({ createdAt: -1 }).limit(100);
    
    res.json(ledger);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ==================== PASSWORD & PROFILE ROUTES ====================

// Change own password
router.put('/change-password', protectAdmin, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new password required' });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }
    
    const admin = await Admin.findById(req.admin._id);
    const isMatch = await admin.comparePassword(currentPassword);
    
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }
    
    admin.password = newPassword;
    await admin.save();
    
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update own profile
router.put('/update-profile', protectAdmin, async (req, res) => {
  try {
    const { name, phone, email } = req.body;
    
    if (email && email !== req.admin.email) {
      const exists = await Admin.findOne({ email, _id: { $ne: req.admin._id } });
      if (exists) {
        return res.status(400).json({ message: 'Email already in use' });
      }
      req.admin.email = email;
    }
    
    if (name) req.admin.name = name;
    if (phone) req.admin.phone = phone;
    
    await req.admin.save();
    res.json(req.admin);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update branding settings (Admin only)
router.put('/branding', protectAdmin, async (req, res) => {
  try {
    const { brandName, logoUrl, welcomeTitle } = req.body;
    
    const admin = await Admin.findById(req.admin._id);
    if (!admin) return res.status(404).json({ message: 'Admin not found' });
    
    if (!admin.branding) {
      admin.branding = {};
    }
    
    if (brandName !== undefined) admin.branding.brandName = brandName;
    if (logoUrl !== undefined) admin.branding.logoUrl = logoUrl;
    if (welcomeTitle !== undefined) admin.branding.welcomeTitle = welcomeTitle;
    
    await admin.save();
    res.json({ 
      message: 'Branding updated successfully',
      branding: admin.branding 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ==================== SUPER ADMIN - ADMIN PASSWORD RESET ====================

// Reset admin password (Super Admin only)
router.put('/admins/:id/reset-password', protectAdmin, superAdminOnly, async (req, res) => {
  try {
    const { newPassword } = req.body;
    
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }
    
    const admin = await Admin.findById(req.params.id);
    if (!admin) return res.status(404).json({ message: 'Admin not found' });
    if (admin.role === 'SUPER_ADMIN') return res.status(403).json({ message: 'Cannot reset Super Admin password here' });
    
    // Hash the password manually to ensure it's properly hashed
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    // Use updateOne to bypass pre-save hook since we're manually hashing
    await Admin.updateOne(
      { _id: req.params.id },
      { $set: { password: hashedPassword } }
    );
    
    res.json({ message: 'Admin password reset successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ==================== SUPER ADMIN - DETAILED VIEWS ====================

// Get admin with all their users (hierarchical - parent can view child's users)
router.get('/admins/:id/users', protectAdmin, async (req, res) => {
  try {
    const targetAdmin = await Admin.findById(req.params.id).select('-password');
    if (!targetAdmin) return res.status(404).json({ message: 'Admin not found' });
    
    // Check permission: Super Admin can view anyone, others can only view their children or themselves
    const isSuperAdmin = req.admin.role === 'SUPER_ADMIN';
    const isParent = targetAdmin.parentId?.toString() === req.admin._id.toString();
    const isSelf = targetAdmin._id.toString() === req.admin._id.toString();
    const canManage = req.admin.canManage && req.admin.canManage(targetAdmin.role);
    
    if (!isSuperAdmin && !isParent && !isSelf && !canManage) {
      return res.status(403).json({ message: 'You can only view users for your subordinates' });
    }
    
    const users = await User.find({ adminCode: targetAdmin.adminCode }).select('-password');
    
    res.json({ admin: targetAdmin, users });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get admin's ledger (Super Admin only)
router.get('/admins/:id/ledger', protectAdmin, superAdminOnly, async (req, res) => {
  try {
    const admin = await Admin.findById(req.params.id);
    if (!admin) return res.status(404).json({ message: 'Admin not found' });
    
    const ledger = await WalletLedger.find({
      ownerType: 'ADMIN',
      ownerId: admin._id
    }).sort({ createdAt: -1 }).limit(200);
    
    res.json(ledger);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all transactions across all admins (Super Admin only)
router.get('/all-transactions', protectAdmin, superAdminOnly, async (req, res) => {
  try {
    const { limit = 100, ownerType } = req.query;
    const query = {};
    if (ownerType) query.ownerType = ownerType;
    
    const transactions = await WalletLedger.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate('performedBy', 'username name');
    
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get comprehensive stats (Super Admin only)
router.get('/comprehensive-stats', protectAdmin, superAdminOnly, async (req, res) => {
  try {
    // Admin stats
    const admins = await Admin.find({ role: 'ADMIN' }).select('-password');
    
    // Get user counts per admin
    const userCounts = await User.aggregate([
      { $group: { _id: '$adminCode', count: { $sum: 1 }, activeCount: { $sum: { $cond: ['$isActive', 1, 0] } } } }
    ]);
    
    const userCountMap = {};
    userCounts.forEach(uc => { userCountMap[uc._id] = uc; });
    
    // Enhance admin data with user counts
    const adminData = admins.map(admin => ({
      ...admin.toObject(),
      userCount: userCountMap[admin.adminCode]?.count || 0,
      activeUserCount: userCountMap[admin.adminCode]?.activeCount || 0
    }));
    
    // Total stats
    const totalAdmins = admins.length;
    const activeAdmins = admins.filter(a => a.status === 'ACTIVE').length;
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    
    // Wallet totals
    const adminWalletTotal = admins.reduce((sum, a) => sum + (a.wallet?.balance || 0), 0);
    const userWalletTotal = await User.aggregate([
      { $group: { _id: null, total: { $sum: '$wallet.cashBalance' } } }
    ]);
    
    // Recent transactions
    const recentTransactions = await WalletLedger.find()
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('performedBy', 'username name');
    
    res.json({
      admins: adminData,
      stats: {
        totalAdmins,
        activeAdmins,
        totalUsers,
        activeUsers,
        adminWalletTotal,
        userWalletTotal: userWalletTotal[0]?.total || 0
      },
      recentTransactions
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Suspend/Activate admin (Super Admin only)
router.put('/admins/:id/status', protectAdmin, superAdminOnly, async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['ACTIVE', 'SUSPENDED', 'INACTIVE'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    
    const admin = await Admin.findById(req.params.id);
    if (!admin) return res.status(404).json({ message: 'Admin not found' });
    if (admin.role === 'SUPER_ADMIN') return res.status(403).json({ message: 'Cannot modify Super Admin' });
    
    admin.status = status;
    admin.isActive = status === 'ACTIVE';
    await admin.save();
    
    res.json({ message: `Admin ${status.toLowerCase()}`, admin });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update admin charges (hierarchical - parent can update child's charges)
router.put('/admins/:id/charges', protectAdmin, async (req, res) => {
  try {
    const targetAdmin = await Admin.findById(req.params.id);
    if (!targetAdmin) return res.status(404).json({ message: 'Admin not found' });
    
    // Check permission: Super Admin can edit anyone, others can only edit their children
    const isSuperAdmin = req.admin.role === 'SUPER_ADMIN';
    const isParent = targetAdmin.parentId?.toString() === req.admin._id.toString();
    const canManage = req.admin.canManage && req.admin.canManage(targetAdmin.role);
    
    if (!isSuperAdmin && !isParent && !canManage) {
      return res.status(403).json({ message: 'You can only update charges for your subordinates' });
    }
    
    const { charges } = req.body;
    targetAdmin.charges = { ...targetAdmin.charges, ...charges };
    await targetAdmin.save();
    
    res.json({ message: 'Charges updated', admin: targetAdmin });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update brokerage caps for child admin (Parent admin sets min/max limits)
// Super Admin can set caps for any admin, Admin can set caps for their brokers
router.put('/admins/:id/brokerage-caps', protectAdmin, async (req, res) => {
  try {
    const targetAdmin = await Admin.findById(req.params.id);
    if (!targetAdmin) return res.status(404).json({ message: 'Admin not found' });
    
    // Check permission: Super Admin can edit anyone, others can only edit their children
    const isSuperAdmin = req.admin.role === 'SUPER_ADMIN';
    const isParent = targetAdmin.parentId?.toString() === req.admin._id.toString();
    
    if (!isSuperAdmin && !isParent) {
      return res.status(403).json({ message: 'You can only set brokerage caps for your subordinates' });
    }
    
    const { brokerageCaps } = req.body;
    
    // Validate brokerageCaps structure
    if (!brokerageCaps) {
      return res.status(400).json({ message: 'brokerageCaps is required' });
    }
    
    // Update brokerage caps
    targetAdmin.brokerageCaps = {
      perLot: {
        min: brokerageCaps.perLot?.min ?? targetAdmin.brokerageCaps?.perLot?.min ?? 0,
        max: brokerageCaps.perLot?.max ?? targetAdmin.brokerageCaps?.perLot?.max ?? 1000
      },
      perCrore: {
        min: brokerageCaps.perCrore?.min ?? targetAdmin.brokerageCaps?.perCrore?.min ?? 0,
        max: brokerageCaps.perCrore?.max ?? targetAdmin.brokerageCaps?.perCrore?.max ?? 10000
      },
      perTrade: {
        min: brokerageCaps.perTrade?.min ?? targetAdmin.brokerageCaps?.perTrade?.min ?? 0,
        max: brokerageCaps.perTrade?.max ?? targetAdmin.brokerageCaps?.perTrade?.max ?? 500
      }
    };
    
    await targetAdmin.save();
    
    res.json({ 
      message: 'Brokerage caps updated successfully', 
      brokerageCaps: targetAdmin.brokerageCaps 
    });
  } catch (error) {
    console.error('Error updating brokerage caps:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get brokerage caps for an admin
router.get('/admins/:id/brokerage-caps', protectAdmin, async (req, res) => {
  try {
    const targetAdmin = await Admin.findById(req.params.id).select('brokerageCaps username name role');
    if (!targetAdmin) return res.status(404).json({ message: 'Admin not found' });
    
    // Check permission
    const isSuperAdmin = req.admin.role === 'SUPER_ADMIN';
    const isParent = targetAdmin.parentId?.toString() === req.admin._id.toString();
    const isSelf = targetAdmin._id.toString() === req.admin._id.toString();
    
    if (!isSuperAdmin && !isParent && !isSelf) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    res.json({
      admin: {
        _id: targetAdmin._id,
        username: targetAdmin.username,
        name: targetAdmin.name,
        role: targetAdmin.role
      },
      brokerageCaps: targetAdmin.brokerageCaps || {
        perLot: { min: 0, max: 1000 },
        perCrore: { min: 0, max: 10000 },
        perTrade: { min: 0, max: 500 }
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update admin role (Super Admin only)
router.put('/admins/:id/role', protectAdmin, superAdminOnly, async (req, res) => {
  try {
    const { role } = req.body;
    
    // Validate role
    const validRoles = ['ADMIN', 'BROKER', 'SUB_BROKER'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: 'Invalid role. Must be ADMIN, BROKER, or SUB_BROKER' });
    }
    
    const admin = await Admin.findById(req.params.id);
    if (!admin) return res.status(404).json({ message: 'Admin not found' });
    if (admin.role === 'SUPER_ADMIN') return res.status(403).json({ message: 'Cannot modify Super Admin role' });
    
    const oldRole = admin.role;
    admin.role = role;
    
    // Update hierarchy level based on role
    const hierarchyLevels = { 'ADMIN': 1, 'BROKER': 2, 'SUB_BROKER': 3 };
    admin.hierarchyLevel = hierarchyLevels[role];
    
    await admin.save();
    
    res.json({ 
      message: `Role changed from ${oldRole} to ${role}`, 
      admin: {
        _id: admin._id,
        username: admin.username,
        name: admin.name,
        role: admin.role,
        hierarchyLevel: admin.hierarchyLevel
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ==================== ADMIN TO ADMIN FUND TRANSFER ====================

// Transfer funds to another admin
router.post('/admin-transfer', protectAdmin, async (req, res) => {
  try {
    const { targetAdminId, amount, remarks } = req.body;
    
    if (!targetAdminId || !amount || amount <= 0) {
      return res.status(400).json({ message: 'Target admin and valid amount required' });
    }
    
    // Cannot transfer to self
    if (targetAdminId === req.admin._id.toString()) {
      return res.status(400).json({ message: 'Cannot transfer to yourself' });
    }
    
    // Check sender has sufficient balance
    if (req.admin.wallet.balance < amount) {
      return res.status(400).json({ message: 'Insufficient wallet balance' });
    }
    
    // Find target admin
    const targetAdmin = await Admin.findById(targetAdminId);
    if (!targetAdmin) {
      return res.status(404).json({ message: 'Target admin not found' });
    }
    
    // Deduct from sender
    req.admin.wallet.balance -= amount;
    await req.admin.save();
    
    // Add to receiver
    targetAdmin.wallet.balance += amount;
    await targetAdmin.save();
    
    // Create ledger entries for both
    await WalletLedger.create({
      ownerType: 'ADMIN',
      ownerId: req.admin._id,
      ownerCode: req.admin.adminCode,
      type: 'DEBIT',
      reason: 'ADMIN_TRANSFER',
      amount: amount,
      balanceAfter: req.admin.wallet.balance,
      description: `Transferred to ${targetAdmin.role} - ${targetAdmin.name || targetAdmin.username}${remarks ? ': ' + remarks : ''}`,
      performedBy: req.admin._id
    });
    
    await WalletLedger.create({
      ownerType: 'ADMIN',
      ownerId: targetAdmin._id,
      ownerCode: targetAdmin.adminCode,
      type: 'CREDIT',
      reason: 'ADMIN_TRANSFER',
      amount: amount,
      balanceAfter: targetAdmin.wallet.balance,
      description: `Received from ${req.admin.role} - ${req.admin.name || req.admin.username}${remarks ? ': ' + remarks : ''}`,
      performedBy: req.admin._id
    });
    
    res.json({
      message: `Successfully transferred ₹${amount} to ${targetAdmin.name || targetAdmin.username}`,
      senderBalance: req.admin.wallet.balance,
      transfer: {
        from: req.admin.name || req.admin.username,
        to: targetAdmin.name || targetAdmin.username,
        amount,
        remarks
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get list of admins for transfer (only ADMIN role, excludes self)
router.get('/transfer-targets', protectAdmin, async (req, res) => {
  try {
    const admins = await Admin.find({
      _id: { $ne: req.admin._id },
      role: 'ADMIN',
      status: 'ACTIVE'
    }).select('_id name username adminCode role wallet.balance');
    
    res.json(admins);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ==================== ADMIN FUND REQUEST SYSTEM ====================

// Admin creates fund request to Super Admin
router.post('/fund-request', protectAdmin, async (req, res) => {
  try {
    const { amount, reason } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid amount' });
    }
    
    // SUPER_ADMIN cannot request funds (they are the top)
    if (req.admin.role === 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Super Admin cannot request funds' });
    }
    
    // Find the parent admin to request funds from
    let targetAdmin = null;
    if (req.admin.parentId) {
      targetAdmin = await Admin.findById(req.admin.parentId);
    }
    
    // If no parent found, request goes to Super Admin
    if (!targetAdmin) {
      targetAdmin = await Admin.findOne({ role: 'SUPER_ADMIN' });
    }
    
    if (!targetAdmin) {
      return res.status(400).json({ message: 'No parent admin found to request funds from' });
    }
    
    const fundRequest = await AdminFundRequest.create({
      admin: req.admin._id,
      adminCode: req.admin.adminCode,
      requestorRole: req.admin.role,
      targetAdmin: targetAdmin._id,
      targetAdminCode: targetAdmin.adminCode,
      targetRole: targetAdmin.role,
      amount,
      reason: reason || ''
    });
    
    res.status(201).json({ 
      message: `Fund request submitted to ${targetAdmin.role === 'SUPER_ADMIN' ? 'Super Admin' : targetAdmin.name || targetAdmin.username}`, 
      fundRequest 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin gets their fund requests
router.get('/my-fund-requests', protectAdmin, async (req, res) => {
  try {
    const requests = await AdminFundRequest.find({ admin: req.admin._id })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get fund requests targeted to the current admin (hierarchical)
// Super Admin sees all, Admin sees Broker/SubBroker requests, Broker sees SubBroker requests
router.get('/admin-fund-requests', protectAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    let query = {};
    
    if (req.admin.role === 'SUPER_ADMIN') {
      // Super Admin sees all requests
      query = status ? { status } : {};
    } else if (req.admin.role === 'SUB_BROKER') {
      // Sub Broker cannot approve any fund requests
      return res.json([]);
    } else {
      // Admin and Broker see requests targeted to them
      query = { targetAdmin: req.admin._id };
      if (status) query.status = status;
    }
    
    const requests = await AdminFundRequest.find(query)
      .populate('admin', 'name username email adminCode wallet role')
      .populate('targetAdmin', 'name username adminCode role')
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Approve/Reject fund request (hierarchical - each level approves from their own wallet)
// Super Admin can approve all, Admin approves Broker/SubBroker, Broker approves SubBroker
router.put('/admin-fund-requests/:id', protectAdmin, async (req, res) => {
  try {
    const { status, remarks } = req.body;
    
    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    
    // Sub Broker cannot approve any fund requests
    if (req.admin.role === 'SUB_BROKER') {
      return res.status(403).json({ message: 'Sub Broker cannot approve fund requests' });
    }
    
    const fundRequest = await AdminFundRequest.findById(req.params.id);
    if (!fundRequest) return res.status(404).json({ message: 'Request not found' });
    if (fundRequest.status !== 'PENDING') {
      return res.status(400).json({ message: 'Request already processed' });
    }
    
    // Check if the current admin can approve this request
    // Super Admin can approve all, others can only approve requests targeted to them
    if (req.admin.role !== 'SUPER_ADMIN' && fundRequest.targetAdmin.toString() !== req.admin._id.toString()) {
      return res.status(403).json({ message: 'You can only approve requests directed to you' });
    }
    
    // For approval, check if approver has sufficient balance (except Super Admin)
    if (status === 'APPROVED' && req.admin.role !== 'SUPER_ADMIN') {
      if (req.admin.wallet.balance < fundRequest.amount) {
        return res.status(400).json({ 
          message: `Insufficient balance. You have ₹${req.admin.wallet.balance.toLocaleString()}, but request is for ₹${fundRequest.amount.toLocaleString()}` 
        });
      }
    }
    
    fundRequest.status = status;
    fundRequest.processedBy = req.admin._id;
    fundRequest.processedAt = new Date();
    fundRequest.adminRemarks = remarks || '';
    await fundRequest.save();
    
    // If approved, transfer funds
    if (status === 'APPROVED') {
      const requestor = await Admin.findById(fundRequest.admin);
      
      if (requestor) {
        // Add funds to requestor's wallet
        requestor.wallet.balance += fundRequest.amount;
        requestor.wallet.totalDeposited += fundRequest.amount;
        await requestor.save();
        
        // Create credit ledger entry for requestor
        await WalletLedger.create({
          ownerType: 'ADMIN',
          ownerId: requestor._id,
          adminCode: requestor.adminCode,
          type: 'CREDIT',
          reason: 'ADMIN_DEPOSIT',
          amount: fundRequest.amount,
          balanceAfter: requestor.wallet.balance,
          description: `Fund request ${fundRequest.requestId} approved by ${req.admin.role === 'SUPER_ADMIN' ? 'Super Admin' : req.admin.name || req.admin.username}`,
          performedBy: req.admin._id
        });
        
        // Deduct from approver's wallet (except Super Admin who has unlimited funds)
        if (req.admin.role !== 'SUPER_ADMIN') {
          req.admin.wallet.balance -= fundRequest.amount;
          req.admin.wallet.totalWithdrawn = (req.admin.wallet.totalWithdrawn || 0) + fundRequest.amount;
          await req.admin.save();
          
          // Create debit ledger entry for approver
          await WalletLedger.create({
            ownerType: 'ADMIN',
            ownerId: req.admin._id,
            adminCode: req.admin.adminCode,
            type: 'DEBIT',
            reason: 'ADMIN_TRANSFER',
            amount: fundRequest.amount,
            balanceAfter: req.admin.wallet.balance,
            description: `Transferred to ${requestor.role} - ${requestor.name || requestor.username} (${fundRequest.requestId})`,
            performedBy: req.admin._id
          });
        }
      }
    }
    
    res.json({ message: `Request ${status.toLowerCase()}`, fundRequest });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ==================== ADMIN WALLET & LEDGER ====================

// Admin gets their own wallet details and summary
router.get('/my-wallet', protectAdmin, async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin._id);
    
    // Get user transaction summary
    const users = await User.find({ adminCode: admin.adminCode });
    
    let totalUserDeposits = 0;
    let totalUserWithdrawals = 0;
    let totalUserProfits = 0;
    let totalUserLosses = 0;
    let totalUserBalance = 0;
    
    users.forEach(user => {
      totalUserBalance += user.wallet?.cashBalance || 0;
      // Sum from wallet transactions if available
      if (user.wallet?.transactions) {
        user.wallet.transactions.forEach(tx => {
          if (tx.type === 'deposit') totalUserDeposits += tx.amount;
          if (tx.type === 'withdraw') totalUserWithdrawals += tx.amount;
        });
      }
      // Sum P&L
      const pnl = user.wallet?.totalPnL || 0;
      if (pnl > 0) totalUserProfits += pnl;
      else totalUserLosses += Math.abs(pnl);
    });
    
    // Get ledger entries for this admin
    const ledgerEntries = await WalletLedger.find({ 
      ownerType: 'ADMIN', 
      ownerId: admin._id 
    }).sort({ createdAt: -1 }).limit(100);
    
    // Calculate distributed amount (funds given to users)
    const distributedToUsers = await WalletLedger.aggregate([
      { 
        $match: { 
          adminCode: admin.adminCode,
          ownerType: 'USER',
          reason: 'FUND_ADD'
        } 
      },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    res.json({
      wallet: admin.wallet,
      summary: {
        totalUsers: users.length,
        totalUserBalance,
        totalUserDeposits,
        totalUserWithdrawals,
        totalUserProfits,
        totalUserLosses,
        distributedToUsers: distributedToUsers[0]?.total || 0
      },
      ledger: ledgerEntries
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin gets their ledger for download (CSV format)
router.get('/my-ledger/download', protectAdmin, async (req, res) => {
  try {
    const { from, to } = req.query;
    
    const query = { 
      ownerType: 'ADMIN', 
      ownerId: req.admin._id 
    };
    
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) query.createdAt.$lte = new Date(to);
    }
    
    const ledger = await WalletLedger.find(query).sort({ createdAt: -1 });
    
    // Generate CSV
    const headers = ['Date', 'Type', 'Reason', 'Amount', 'Balance After', 'Description'];
    const rows = ledger.map(entry => [
      new Date(entry.createdAt).toLocaleString(),
      entry.type,
      entry.reason,
      entry.amount,
      entry.balanceAfter,
      entry.description || ''
    ]);
    
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=admin-ledger-${Date.now()}.csv`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin gets user transactions summary for their users
router.get('/user-transactions-summary', protectAdmin, async (req, res) => {
  try {
    const adminCode = req.admin.role === 'SUPER_ADMIN' ? req.query.adminCode : req.admin.adminCode;
    
    if (!adminCode && req.admin.role !== 'SUPER_ADMIN') {
      return res.status(400).json({ message: 'Admin code required' });
    }
    
    const query = adminCode ? { adminCode } : {};
    
    // Get all user ledger entries
    const userLedger = await WalletLedger.find({ 
      ...query,
      ownerType: 'USER' 
    }).sort({ createdAt: -1 }).limit(500);
    
    // Aggregate by reason
    const summary = await WalletLedger.aggregate([
      { $match: { ...query, ownerType: 'USER' } },
      { 
        $group: { 
          _id: '$reason', 
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 }
        } 
      }
    ]);
    
    res.json({ ledger: userLedger, summary });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update user segment and script settings (Super Admin only)
router.put('/users/:id/settings', protectAdmin, superAdminOnly, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    const { segmentPermissions, scriptSettings } = req.body;
    
    if (segmentPermissions) {
      user.segmentPermissions = segmentPermissions;
    }
    
    if (scriptSettings) {
      user.scriptSettings = scriptSettings;
    }
    
    await user.save();
    res.json({ message: 'User settings updated successfully', user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Note: copy-settings route is defined earlier in the file (line ~651) for all admins

// Download user transactions as CSV
router.get('/user-transactions/download', protectAdmin, async (req, res) => {
  try {
    const adminCode = req.admin.role === 'SUPER_ADMIN' ? req.query.adminCode : req.admin.adminCode;
    const { from, to } = req.query;
    
    const query = { ownerType: 'USER' };
    if (adminCode) query.adminCode = adminCode;
    
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) query.createdAt.$lte = new Date(to);
    }
    
    const ledger = await WalletLedger.find(query)
      .populate('ownerId', 'username fullName userId')
      .sort({ createdAt: -1 });
    
    // Generate CSV
    const headers = ['Date', 'User', 'User ID', 'Type', 'Reason', 'Amount', 'Balance After', 'Description'];
    const rows = ledger.map(entry => [
      new Date(entry.createdAt).toLocaleString(),
      entry.ownerId?.fullName || entry.ownerId?.username || 'N/A',
      entry.ownerId?.userId || 'N/A',
      entry.type,
      entry.reason,
      entry.amount,
      entry.balanceAfter,
      entry.description || ''
    ]);
    
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=user-transactions-${Date.now()}.csv`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ==================== SUPER ADMIN: FUND REQUEST APPROVE/REJECT ====================

// Super Admin approve fund request (deducts from user's admin wallet, unless user is directly under Super Admin)
router.post('/all-fund-requests/:id/approve', protectAdmin, superAdminOnly, async (req, res) => {
  try {
    const request = await FundRequest.findOne({ _id: req.params.id, status: 'PENDING' });
    
    if (!request) {
      return res.status(404).json({ message: 'Fund request not found or already processed' });
    }
    
    const user = await User.findById(request.user);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Find the admin who owns this user
    const userAdmin = await Admin.findOne({ adminCode: request.adminCode });
    
    let newUserCashBalance = user.wallet.cashBalance;
    let debitAdmin = null;
    let newAdminBalance = null;
    
    // Determine if we need to deduct from an admin
    // If user is directly under Super Admin (no userAdmin or userAdmin is Super Admin), no deduction
    if (userAdmin && userAdmin.role !== 'SUPER_ADMIN') {
      debitAdmin = userAdmin;
    }
    
    if (request.type === 'DEPOSIT') {
      // Check if admin has sufficient balance (only if deduction needed)
      if (debitAdmin) {
        if (debitAdmin.wallet.balance < request.amount) {
          return res.status(400).json({ 
            message: `Insufficient balance in ${debitAdmin.name || debitAdmin.username}'s wallet. Available: ₹${debitAdmin.wallet.balance.toLocaleString()}, Required: ₹${request.amount.toLocaleString()}` 
          });
        }
        
        // Debit from admin wallet
        newAdminBalance = debitAdmin.wallet.balance - request.amount;
        await Admin.updateOne(
          { _id: debitAdmin._id },
          { 
            $set: { 'wallet.balance': newAdminBalance },
            $inc: { 'wallet.totalWithdrawn': request.amount }
          }
        );
        
        await WalletLedger.create({
          ownerType: 'ADMIN',
          ownerId: debitAdmin._id,
          adminCode: debitAdmin.adminCode,
          type: 'DEBIT',
          reason: 'FUND_ADD',
          amount: request.amount,
          balanceAfter: newAdminBalance,
          reference: { type: 'FundRequest', id: request._id },
          performedBy: req.admin._id,
          description: `Fund approved by Super Admin for user ${user.username}`
        });
      }
      
      // Credit to user wallet - use updateOne to avoid segmentPermissions validation
      newUserCashBalance = user.wallet.cashBalance + request.amount;
      await User.updateOne(
        { _id: user._id },
        { 
          $set: { 'wallet.cashBalance': newUserCashBalance, 'wallet.balance': newUserCashBalance },
          $inc: { 'wallet.totalDeposited': request.amount }
        }
      );
      
      await WalletLedger.create({
        ownerType: 'USER',
        ownerId: user._id,
        adminCode: user.adminCode,
        type: 'CREDIT',
        reason: 'FUND_ADD',
        amount: request.amount,
        balanceAfter: newUserCashBalance,
        reference: { type: 'FundRequest', id: request._id },
        performedBy: req.admin._id,
        description: debitAdmin ? `Approved (from ${debitAdmin.name || debitAdmin.username})` : 'Approved by Super Admin (unlimited)'
      });
    } else {
      // For withdrawals, user wallet is debited
      if (user.wallet.cashBalance < request.amount) {
        return res.status(400).json({ message: 'Insufficient user balance' });
      }
      
      // Use updateOne to avoid segmentPermissions validation
      newUserCashBalance = user.wallet.cashBalance - request.amount;
      await User.updateOne(
        { _id: user._id },
        { 
          $set: { 'wallet.cashBalance': newUserCashBalance, 'wallet.balance': newUserCashBalance },
          $inc: { 'wallet.totalWithdrawn': request.amount }
        }
      );
      
      await WalletLedger.create({
        ownerType: 'USER',
        ownerId: user._id,
        adminCode: user.adminCode,
        type: 'DEBIT',
        reason: 'FUND_WITHDRAW',
        amount: request.amount,
        balanceAfter: newUserCashBalance,
        reference: { type: 'FundRequest', id: request._id },
        performedBy: req.admin._id
      });
      
      // Credit back to admin (if exists and not Super Admin)
      if (debitAdmin) {
        newAdminBalance = debitAdmin.wallet.balance + request.amount;
        await Admin.updateOne(
          { _id: debitAdmin._id },
          { 
            $set: { 'wallet.balance': newAdminBalance },
            $inc: { 'wallet.totalDeposited': request.amount }
          }
        );
        
        await WalletLedger.create({
          ownerType: 'ADMIN',
          ownerId: debitAdmin._id,
          adminCode: debitAdmin.adminCode,
          type: 'CREDIT',
          reason: 'FUND_WITHDRAW',
          amount: request.amount,
          balanceAfter: newAdminBalance,
          reference: { type: 'FundRequest', id: request._id },
          performedBy: req.admin._id,
          description: `Withdrawal approved for user ${user.username}`
        });
      }
    }
    
    request.status = 'APPROVED';
    request.processedBy = req.admin._id;
    request.processedAt = new Date();
    request.adminRemarks = req.body.remarks || 'Approved by Super Admin';
    await request.save();
    
    res.json({ 
      message: 'Fund request approved successfully', 
      request,
      adminWalletBalance: newAdminBalance,
      deductedFrom: debitAdmin ? (debitAdmin.name || debitAdmin.username) : 'Super Admin (unlimited)'
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Super Admin reject fund request
router.post('/all-fund-requests/:id/reject', protectAdmin, superAdminOnly, async (req, res) => {
  try {
    const request = await FundRequest.findOne({ _id: req.params.id, status: 'PENDING' });
    
    if (!request) {
      return res.status(404).json({ message: 'Fund request not found or already processed' });
    }
    
    request.status = 'REJECTED';
    request.processedBy = req.admin._id;
    request.processedAt = new Date();
    request.adminRemarks = req.body.remarks || 'Rejected by Super Admin';
    await request.save();
    
    res.json({ message: 'Fund request rejected', request });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Reset user margin (fix orphaned margin when no open positions exist)
router.post('/users/:id/reset-margin', protectAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check admin access
    if (req.admin.role !== 'SUPER_ADMIN' && user.adminCode !== req.admin.adminCode) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const oldUsedMargin = user.wallet.usedMargin || 0;
    const oldBlocked = user.wallet.blocked || 0;
    
    // Reset margin fields
    await User.updateOne(
      { _id: user._id },
      { 
        $set: { 
          'wallet.usedMargin': 0,
          'wallet.blocked': 0
        }
      }
    );
    
    res.json({ 
      message: 'Margin reset successfully',
      oldUsedMargin,
      oldBlocked,
      newUsedMargin: 0,
      newBlocked: 0
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Reconcile user margin based on actual open positions
router.post('/users/:id/reconcile-margin', protectAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check admin access
    if (req.admin.role !== 'SUPER_ADMIN' && user.adminCode !== req.admin.adminCode) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Import Trade model dynamically to avoid circular dependency
    const Trade = (await import('../models/Trade.js')).default;
    
    // Get all open positions for this user
    const openPositions = await Trade.find({ 
      user: user._id, 
      status: 'OPEN',
      isCrypto: { $ne: true } // Only non-crypto trades use margin
    });
    
    // Calculate actual margin used
    const actualMarginUsed = openPositions.reduce((sum, pos) => sum + (pos.marginUsed || 0), 0);
    
    const oldUsedMargin = user.wallet.usedMargin || 0;
    const oldBlocked = user.wallet.blocked || 0;
    
    // Update margin to match actual open positions
    await User.updateOne(
      { _id: user._id },
      { 
        $set: { 
          'wallet.usedMargin': actualMarginUsed,
          'wallet.blocked': actualMarginUsed
        }
      }
    );
    
    res.json({ 
      message: 'Margin reconciled successfully',
      openPositionsCount: openPositions.length,
      oldUsedMargin,
      oldBlocked,
      newUsedMargin: actualMarginUsed,
      newBlocked: actualMarginUsed
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Reset segmentPermissions for all users to use new Market Watch segments
router.post('/users/reset-segment-permissions', protectAdmin, superAdminOnly, async (req, res) => {
  try {
    // Default segment permissions for all 7 Market Watch segments
    const defaultSegmentPermissions = {
      'NSEFUT': { enabled: true, maxExchangeLots: 100, commissionType: 'PER_LOT', commissionLot: 0, maxLots: 50, minLots: 1, orderLots: 10, exposureIntraday: 1, exposureCarryForward: 1, optionBuy: { allowed: true, commissionType: 'PER_LOT', commission: 0, strikeSelection: 50, maxExchangeLots: 100 }, optionSell: { allowed: true, commissionType: 'PER_LOT', commission: 0, strikeSelection: 50, maxExchangeLots: 100 } },
      'NSEOPT': { enabled: true, maxExchangeLots: 100, commissionType: 'PER_LOT', commissionLot: 0, maxLots: 50, minLots: 1, orderLots: 10, exposureIntraday: 1, exposureCarryForward: 1, optionBuy: { allowed: true, commissionType: 'PER_LOT', commission: 0, strikeSelection: 50, maxExchangeLots: 100 }, optionSell: { allowed: true, commissionType: 'PER_LOT', commission: 0, strikeSelection: 50, maxExchangeLots: 100 } },
      'MCXFUT': { enabled: true, maxExchangeLots: 100, commissionType: 'PER_LOT', commissionLot: 0, maxLots: 50, minLots: 1, orderLots: 10, exposureIntraday: 1, exposureCarryForward: 1, optionBuy: { allowed: true, commissionType: 'PER_LOT', commission: 0, strikeSelection: 50, maxExchangeLots: 100 }, optionSell: { allowed: true, commissionType: 'PER_LOT', commission: 0, strikeSelection: 50, maxExchangeLots: 100 } },
      'MCXOPT': { enabled: true, maxExchangeLots: 100, commissionType: 'PER_LOT', commissionLot: 0, maxLots: 50, minLots: 1, orderLots: 10, exposureIntraday: 1, exposureCarryForward: 1, optionBuy: { allowed: true, commissionType: 'PER_LOT', commission: 0, strikeSelection: 50, maxExchangeLots: 100 }, optionSell: { allowed: true, commissionType: 'PER_LOT', commission: 0, strikeSelection: 50, maxExchangeLots: 100 } },
      'NSE-EQ': { enabled: true, maxExchangeLots: 100, commissionType: 'PER_LOT', commissionLot: 0, maxLots: 50, minLots: 1, orderLots: 10, exposureIntraday: 1, exposureCarryForward: 1, optionBuy: { allowed: true, commissionType: 'PER_LOT', commission: 0, strikeSelection: 50, maxExchangeLots: 100 }, optionSell: { allowed: true, commissionType: 'PER_LOT', commission: 0, strikeSelection: 50, maxExchangeLots: 100 } },
      'BSE-FUT': { enabled: false, maxExchangeLots: 100, commissionType: 'PER_LOT', commissionLot: 0, maxLots: 50, minLots: 1, orderLots: 10, exposureIntraday: 1, exposureCarryForward: 1, optionBuy: { allowed: true, commissionType: 'PER_LOT', commission: 0, strikeSelection: 50, maxExchangeLots: 100 }, optionSell: { allowed: true, commissionType: 'PER_LOT', commission: 0, strikeSelection: 50, maxExchangeLots: 100 } },
      'BSE-OPT': { enabled: false, maxExchangeLots: 100, commissionType: 'PER_LOT', commissionLot: 0, maxLots: 50, minLots: 1, orderLots: 10, exposureIntraday: 1, exposureCarryForward: 1, optionBuy: { allowed: true, commissionType: 'PER_LOT', commission: 0, strikeSelection: 50, maxExchangeLots: 100 }, optionSell: { allowed: true, commissionType: 'PER_LOT', commission: 0, strikeSelection: 50, maxExchangeLots: 100 } }
    };
    
    // Update all users with new segment permissions
    const result = await User.updateMany(
      {},
      { 
        $set: { 
          segmentPermissions: defaultSegmentPermissions,
          scriptSettings: {} // Also clear script settings
        }
      }
    );
    
    res.json({ 
      message: 'Segment permissions reset for all users',
      modifiedCount: result.modifiedCount,
      segments: Object.keys(defaultSegmentPermissions)
    });
  } catch (error) {
    console.error('Error resetting segment permissions:', error);
    res.status(500).json({ message: error.message });
  }
});

// ==================== BROKER CHANGE REQUEST ROUTES (Super Admin Only) ====================

// Get all broker change requests
router.get('/broker-change-requests', protectAdmin, superAdminOnly, async (req, res) => {
  try {
    const { status } = req.query;
    let query = {};
    if (status && status !== 'ALL') query.status = status;
    
    const requests = await BrokerChangeRequest.find(query)
      .populate('user', 'username fullName email userId')
      .populate('currentAdmin', 'name username adminCode role')
      .populate('requestedAdmin', 'name username adminCode role')
      .populate('processedBy', 'name username')
      .sort({ createdAt: -1 });
    
    // Calculate stats
    const allRequests = await BrokerChangeRequest.find({});
    const stats = {
      total: allRequests.length,
      pending: allRequests.filter(r => r.status === 'PENDING').length,
      approved: allRequests.filter(r => r.status === 'APPROVED').length,
      rejected: allRequests.filter(r => r.status === 'REJECTED').length
    };
    
    res.json({ requests, stats });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Approve broker change request
router.post('/broker-change-requests/:id/approve', protectAdmin, superAdminOnly, async (req, res) => {
  try {
    const request = await BrokerChangeRequest.findOne({ 
      _id: req.params.id, 
      status: 'PENDING' 
    }).populate('requestedAdmin').populate('currentAdmin');
    
    if (!request) {
      return res.status(404).json({ message: 'Request not found or already processed' });
    }
    
    // Get the user with wallet
    const user = await User.findById(request.user);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const newAdmin = request.requestedAdmin;
    if (!newAdmin) {
      return res.status(400).json({ message: 'Requested admin not found' });
    }
    
    // Get user's wallet balance
    const userWalletBalance = user.wallet?.balance || 0;
    
    // If user has balance, transfer funds from current admin to new admin
    if (userWalletBalance > 0) {
      // Get current admin (the one who will lose the funds)
      const currentAdmin = await Admin.findOne({ adminCode: request.currentAdminCode });
      
      if (!currentAdmin) {
        return res.status(400).json({ message: 'Current admin not found' });
      }
      
      // Check if current admin is Super Admin - if so, no fund transfer needed from admin wallet
      if (currentAdmin.role !== 'SUPER_ADMIN') {
        // Check if current admin has enough balance
        const currentAdminBalance = currentAdmin.wallet?.balance || 0;
        
        if (currentAdminBalance < userWalletBalance) {
          return res.status(400).json({ 
            message: `Current ${currentAdmin.role === 'BROKER' ? 'Broker' : currentAdmin.role === 'SUB_BROKER' ? 'Sub Broker' : 'Admin'} (${currentAdmin.adminCode}) does not have sufficient funds (₹${currentAdminBalance.toLocaleString()}) to transfer user's balance (₹${userWalletBalance.toLocaleString()}). Please ask them to add funds first.`
          });
        }
        
        // Deduct from current admin's wallet
        currentAdmin.wallet.balance -= userWalletBalance;
        await currentAdmin.save();
        
        // Create ledger entry for current admin (debit)
        await WalletLedger.create({
          admin: currentAdmin._id,
          adminCode: currentAdmin.adminCode,
          type: 'DEBIT',
          amount: userWalletBalance,
          balanceAfter: currentAdmin.wallet.balance,
          reason: `User ${user.username} transferred to ${newAdmin.adminCode}`,
          reference: request.requestId,
          category: 'USER_TRANSFER'
        });
      }
      
      // Add to new admin's wallet (if not Super Admin)
      if (newAdmin.role !== 'SUPER_ADMIN') {
        // Refresh newAdmin to get latest wallet
        const newAdminFresh = await Admin.findById(newAdmin._id);
        newAdminFresh.wallet = newAdminFresh.wallet || { balance: 0 };
        newAdminFresh.wallet.balance = (newAdminFresh.wallet.balance || 0) + userWalletBalance;
        await newAdminFresh.save();
        
        // Create ledger entry for new admin (credit)
        await WalletLedger.create({
          admin: newAdminFresh._id,
          adminCode: newAdminFresh.adminCode,
          type: 'CREDIT',
          amount: userWalletBalance,
          balanceAfter: newAdminFresh.wallet.balance,
          reason: `User ${user.username} transferred from ${request.currentAdminCode}`,
          reference: request.requestId,
          category: 'USER_TRANSFER'
        });
      }
    }
    
    // Build new hierarchy path
    let newHierarchyPath = [];
    if (newAdmin.hierarchyPath && newAdmin.hierarchyPath.length > 0) {
      newHierarchyPath = [...newAdmin.hierarchyPath, newAdmin._id];
    } else {
      newHierarchyPath = [newAdmin._id];
    }
    
    // Update user's admin assignment
    const oldAdminCode = user.adminCode;
    user.adminCode = newAdmin.adminCode;
    user.hierarchyPath = newHierarchyPath;
    user.creatorId = newAdmin._id;
    user.creatorRole = newAdmin.role;
    await user.save();
    
    // Update the request
    request.status = 'APPROVED';
    request.processedBy = req.admin._id;
    request.processedAt = new Date();
    request.adminRemarks = req.body.remarks || '';
    await request.save();
    
    res.json({ 
      message: `User ${user.username} transferred from ${oldAdminCode} to ${newAdmin.adminCode}${userWalletBalance > 0 ? `. Wallet balance ₹${userWalletBalance.toLocaleString()} transferred.` : ''}`,
      request,
      fundsTransferred: userWalletBalance
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Reject broker change request
router.post('/broker-change-requests/:id/reject', protectAdmin, superAdminOnly, async (req, res) => {
  try {
    const request = await BrokerChangeRequest.findOne({ 
      _id: req.params.id, 
      status: 'PENDING' 
    });
    
    if (!request) {
      return res.status(404).json({ message: 'Request not found or already processed' });
    }
    
    request.status = 'REJECTED';
    request.processedBy = req.admin._id;
    request.processedAt = new Date();
    request.adminRemarks = req.body.remarks || '';
    await request.save();
    
    res.json({ message: 'Request rejected', request });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
