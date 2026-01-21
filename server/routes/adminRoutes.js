import express from 'express';
import bcrypt from 'bcryptjs';
import Admin from '../models/Admin.js';
import User from '../models/User.js';
import BankSettings from '../models/BankSettings.js';
import { protectAdmin, generateToken } from '../middleware/auth.js';

const router = express.Router();

// Get admin branding by referral code (public endpoint for login page)
router.get('/branding/:refCode', async (req, res) => {
  try {
    const admin = await Admin.findOne({ referralCode: req.params.refCode });
    
    if (!admin) {
      return res.json({ brandName: '', logoUrl: '', welcomeTitle: '' });
    }
    
    res.json({
      brandName: admin.branding?.brandName || '',
      logoUrl: admin.branding?.logoUrl || '',
      welcomeTitle: admin.branding?.welcomeTitle || ''
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get list of brokers for user registration (public endpoint)
router.get('/brokers/public', async (req, res) => {
  try {
    // Fetch all active brokers only (not sub-brokers)
    const brokers = await Admin.find({ 
      role: 'BROKER',
      status: 'ACTIVE'
    })
    .select('name username adminCode role parentId branding')
    .populate('parentId', 'name username adminCode role')
    .sort({ name: 1 });

    res.json({ brokers });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await Admin.findOne({ email });

    if (!admin) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Check if admin is active
    if (admin.status === 'SUSPENDED' || admin.status === 'INACTIVE') {
      return res.status(401).json({ message: 'Account is suspended' });
    }

    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Update last login time
    admin.lastLoginAt = new Date();
    await admin.save();

    // Return all necessary fields (admins can login from multiple devices)
    res.json({
      _id: admin._id,
      username: admin.username,
      name: admin.name,
      email: admin.email,
      phone: admin.phone,
      role: admin.role,
      status: admin.status,
      adminCode: admin.adminCode,
      referralCode: admin.referralCode,
      referralUrl: admin.referralUrl,
      wallet: admin.wallet,
      charges: admin.charges,
      stats: admin.stats,
      token: generateToken(admin._id)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin Logout (just clears local storage on client, no server action needed for multi-device)
router.post('/logout', protectAdmin, async (req, res) => {
  try {
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create Admin (first time setup)
router.post('/setup', async (req, res) => {
  try {
    const adminExists = await Admin.findOne();
    if (adminExists) {
      return res.status(400).json({ message: 'Admin already exists' });
    }

    const { username, email, password, pin } = req.body;

    if (!pin) {
      return res.status(400).json({ message: 'PIN is required' });
    }

    const normalizedPin = pin.toString().trim();
    if (!/^\d{4,6}$/.test(normalizedPin)) {
      return res.status(400).json({ message: 'PIN must be a 4-6 digit number' });
    }

    const admin = await Admin.create({ username, email, password, pin: normalizedPin });

    res.status(201).json({
      _id: admin._id,
      username: admin.username,
      email: admin.email,
      role: admin.role,
      token: generateToken(admin._id)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get current admin's data (refresh endpoint)
router.get('/me', protectAdmin, async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin._id).select('-password -pin');
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    res.json({
      _id: admin._id,
      username: admin.username,
      name: admin.name,
      email: admin.email,
      phone: admin.phone,
      role: admin.role,
      status: admin.status,
      adminCode: admin.adminCode,
      referralCode: admin.referralCode,
      wallet: admin.wallet,
      charges: admin.charges,
      stats: admin.stats
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all users (filtered by hierarchy for non-super admins)
router.get('/users', protectAdmin, async (req, res) => {
  try {
    let query = {};
    if (req.admin.role === 'SUPER_ADMIN') {
      // Super Admin sees all users
      query = {};
    } else {
      // ADMIN, BROKER, SUB_BROKER see users under them (direct + descendants)
      query = {
        $or: [
          { admin: req.admin._id },
          { hierarchyPath: req.admin._id }
        ]
      };
    }
    const users = await User.find(query)
      .select('-password')
      .populate('admin', 'name adminCode role')
      .sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single user
router.get('/users/:id', protectAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create user (All roles including SUPER_ADMIN can create users)
router.post('/users', protectAdmin, async (req, res) => {
  try {
    const { username, email, password, fullName, phone } = req.body;
    
    if (!req.admin.adminCode) {
      return res.status(400).json({ message: 'Admin code missing on your profile. Contact Super Admin.' });
    }

    const userExists = await User.findOne({ $or: [{ email }, { username }] });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Build hierarchy path for the user
    const userHierarchyPath = [...(req.admin.hierarchyPath || []), req.admin._id];

    const user = await User.create({
      username,
      email,
      password,
      fullName,
      phone,
      admin: req.admin._id,
      adminCode: req.admin.adminCode,
      creatorRole: req.admin.role,
      hierarchyPath: userHierarchyPath,
      createdBy: req.admin._id
    });

    res.status(201).json({
      _id: user._id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      adminCode: user.adminCode,
      creatorRole: user.creatorRole,
      wallet: user.wallet,
      isActive: user.isActive
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update user
router.put('/users/:id', protectAdmin, async (req, res) => {
  try {
    const { username, email, fullName, phone, isActive } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.username = username || user.username;
    user.email = email || user.email;
    user.fullName = fullName || user.fullName;
    user.phone = phone || user.phone;
    user.isActive = isActive !== undefined ? isActive : user.isActive;

    await user.save();
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update user segment and script settings
router.put('/users/:id/settings', protectAdmin, async (req, res) => {
  try {
    // Filter by adminCode for regular admins
    const query = req.admin.role === 'SUPER_ADMIN' 
      ? { _id: req.params.id } 
      : { _id: req.params.id, adminCode: req.admin.adminCode };
    
    const user = await User.findOne(query);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    const { segmentPermissions, scriptSettings } = req.body;
    
    const updateFields = {};
    if (segmentPermissions) {
      updateFields.segmentPermissions = segmentPermissions;
    }
    if (scriptSettings) {
      updateFields.scriptSettings = scriptSettings;
    }
    
    // Use updateOne to avoid segmentPermissions validation error
    await User.updateOne({ _id: user._id }, { $set: updateFields });
    
    const updatedUser = await User.findById(user._id).select('-password');
    res.json({ message: 'User settings updated successfully', user: updatedUser });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Change user password
router.put('/users/:id/password', protectAdmin, async (req, res) => {
  try {
    const { newPassword } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.password = newPassword;
    await user.save();
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete user
router.delete('/users/:id', protectAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Force logout user (Super Admin only) - Clear user's session token
router.post('/users/:id/force-logout', protectAdmin, async (req, res) => {
  try {
    if (req.admin.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Only Super Admin can force logout users' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Clear the session token to force logout
    await User.updateOne(
      { _id: req.params.id },
      { $set: { activeSessionToken: null } }
    );

    res.json({ message: 'User has been logged out successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add funds to user wallet
router.post('/users/:id/wallet/deposit', protectAdmin, async (req, res) => {
  try {
    const { amount, description } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.wallet.balance += Number(amount);
    user.marginAvailable += Number(amount);
    user.wallet.transactions.push({
      type: 'deposit',
      amount: Number(amount),
      description: description || 'Deposit by admin',
      performedBy: req.admin._id
    });

    await user.save();
    res.json({ message: 'Funds added successfully', wallet: user.wallet });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Withdraw funds from user wallet
router.post('/users/:id/wallet/withdraw', protectAdmin, async (req, res) => {
  try {
    const { amount, description } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.wallet.balance < amount) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    user.wallet.balance -= Number(amount);
    user.marginAvailable -= Number(amount);
    user.wallet.transactions.push({
      type: 'withdraw',
      amount: Number(amount),
      description: description || 'Withdrawal by admin',
      performedBy: req.admin._id
    });

    await user.save();
    res.json({ message: 'Funds withdrawn successfully', wallet: user.wallet });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get user wallet transactions
router.get('/users/:id/wallet', protectAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('wallet marginAvailable');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ============ BANK MANAGEMENT (Super Admin Only) ============

// Get bank settings
router.get('/bank-settings', protectAdmin, async (req, res) => {
  try {
    if (req.admin.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Only Super Admin can access bank settings' });
    }
    const settings = await BankSettings.getSettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update bank settings
router.put('/bank-settings', protectAdmin, async (req, res) => {
  try {
    if (req.admin.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Only Super Admin can update bank settings' });
    }
    
    let settings = await BankSettings.findOne();
    if (!settings) {
      settings = new BankSettings();
    }
    
    const { minimumDeposit, maximumDeposit, minimumWithdrawal, maximumWithdrawal, 
            withdrawalProcessingTime, depositInstructions, withdrawalInstructions } = req.body;
    
    if (minimumDeposit !== undefined) settings.minimumDeposit = minimumDeposit;
    if (maximumDeposit !== undefined) settings.maximumDeposit = maximumDeposit;
    if (minimumWithdrawal !== undefined) settings.minimumWithdrawal = minimumWithdrawal;
    if (maximumWithdrawal !== undefined) settings.maximumWithdrawal = maximumWithdrawal;
    if (withdrawalProcessingTime) settings.withdrawalProcessingTime = withdrawalProcessingTime;
    if (depositInstructions) settings.depositInstructions = depositInstructions;
    if (withdrawalInstructions) settings.withdrawalInstructions = withdrawalInstructions;
    
    await settings.save();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add bank account
router.post('/bank-settings/bank-account', protectAdmin, async (req, res) => {
  try {
    if (req.admin.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Only Super Admin can add bank accounts' });
    }
    
    const settings = await BankSettings.getSettings();
    const { bankName, accountName, accountNumber, ifscCode, branch, isPrimary } = req.body;
    
    if (!bankName || !accountName || !accountNumber || !ifscCode) {
      return res.status(400).json({ message: 'All bank details are required' });
    }
    
    // If this is set as primary, unset others
    if (isPrimary) {
      settings.bankAccounts.forEach(acc => acc.isPrimary = false);
    }
    
    settings.bankAccounts.push({
      bankName,
      accountName,
      accountNumber,
      ifscCode,
      branch,
      isPrimary: isPrimary || settings.bankAccounts.length === 0,
      isActive: true
    });
    
    await settings.save();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update bank account
router.put('/bank-settings/bank-account/:id', protectAdmin, async (req, res) => {
  try {
    if (req.admin.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Only Super Admin can update bank accounts' });
    }
    
    const settings = await BankSettings.getSettings();
    const account = settings.bankAccounts.id(req.params.id);
    
    if (!account) {
      return res.status(404).json({ message: 'Bank account not found' });
    }
    
    const { bankName, accountName, accountNumber, ifscCode, branch, isActive, isPrimary } = req.body;
    
    if (bankName) account.bankName = bankName;
    if (accountName) account.accountName = accountName;
    if (accountNumber) account.accountNumber = accountNumber;
    if (ifscCode) account.ifscCode = ifscCode;
    if (branch !== undefined) account.branch = branch;
    if (isActive !== undefined) account.isActive = isActive;
    
    if (isPrimary) {
      settings.bankAccounts.forEach(acc => acc.isPrimary = false);
      account.isPrimary = true;
    }
    
    await settings.save();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete bank account
router.delete('/bank-settings/bank-account/:id', protectAdmin, async (req, res) => {
  try {
    if (req.admin.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Only Super Admin can delete bank accounts' });
    }
    
    const settings = await BankSettings.getSettings();
    settings.bankAccounts.pull(req.params.id);
    await settings.save();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add UPI account
router.post('/bank-settings/upi-account', protectAdmin, async (req, res) => {
  try {
    if (req.admin.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Only Super Admin can add UPI accounts' });
    }
    
    const settings = await BankSettings.getSettings();
    const { upiId, name, provider, isPrimary } = req.body;
    
    if (!upiId || !name) {
      return res.status(400).json({ message: 'UPI ID and name are required' });
    }
    
    // If this is set as primary, unset others
    if (isPrimary) {
      settings.upiAccounts.forEach(acc => acc.isPrimary = false);
    }
    
    settings.upiAccounts.push({
      upiId,
      name,
      provider: provider || 'other',
      isPrimary: isPrimary || settings.upiAccounts.length === 0,
      isActive: true
    });
    
    await settings.save();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update UPI account
router.put('/bank-settings/upi-account/:id', protectAdmin, async (req, res) => {
  try {
    if (req.admin.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Only Super Admin can update UPI accounts' });
    }
    
    const settings = await BankSettings.getSettings();
    const account = settings.upiAccounts.id(req.params.id);
    
    if (!account) {
      return res.status(404).json({ message: 'UPI account not found' });
    }
    
    const { upiId, name, provider, isActive, isPrimary } = req.body;
    
    if (upiId) account.upiId = upiId;
    if (name) account.name = name;
    if (provider) account.provider = provider;
    if (isActive !== undefined) account.isActive = isActive;
    
    if (isPrimary) {
      settings.upiAccounts.forEach(acc => acc.isPrimary = false);
      account.isPrimary = true;
    }
    
    await settings.save();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete UPI account
router.delete('/bank-settings/upi-account/:id', protectAdmin, async (req, res) => {
  try {
    if (req.admin.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Only Super Admin can delete UPI accounts' });
    }
    
    const settings = await BankSettings.getSettings();
    settings.upiAccounts.pull(req.params.id);
    await settings.save();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
