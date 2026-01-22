import express from 'express';
import User from '../models/User.js';
import Admin from '../models/Admin.js';
import BankSettings from '../models/BankSettings.js';
import BankAccount from '../models/BankAccount.js';
import FundRequest from '../models/FundRequest.js';
import Notification from '../models/Notification.js';
import BrokerChangeRequest from '../models/BrokerChangeRequest.js';
import { protectUser, generateToken, generateSessionToken } from '../middleware/auth.js';

const router = express.Router();

// PUBLIC: Get Broker Info by Referral Code (for signup page)
router.get('/broker-info/:referralCode', async (req, res) => {
  try {
    const { referralCode } = req.params;
    
    const broker = await Admin.findOne({ 
      referralCode: referralCode.toUpperCase(),
      status: 'ACTIVE'
    })
    .select('name username branding certificate adminCode referralCode')
    .lean();

    if (!broker) {
      return res.status(404).json({ message: 'Broker not found' });
    }

    res.json({
      name: broker.name || broker.branding?.brandName || broker.username,
      username: broker.username,
      adminCode: broker.adminCode,
      referralCode: broker.referralCode,
      certificateNumber: broker.certificate?.certificateNumber || '',
      specialization: broker.certificate?.specialization || '',
      isVerified: broker.certificate?.isVerified || false,
      brandName: broker.branding?.brandName || '',
      logoUrl: broker.branding?.logoUrl || ''
    });
  } catch (error) {
    console.error('Error fetching broker info:', error);
    res.status(500).json({ message: 'Failed to fetch broker info' });
  }
});

// PUBLIC: Get Certified Brokers for Landing Page (No Auth Required)
router.get('/certified-brokers', async (req, res) => {
  try {
    const brokers = await Admin.find({
      role: 'BROKER',
      status: 'ACTIVE',
      'certificate.showOnLandingPage': true,
      'certificate.isVerified': true
    })
    .select('name username branding certificate referralCode adminCode stats.totalUsers')
    .sort({ 'certificate.displayOrder': 1, 'certificate.rating': -1 })
    .lean();

    const formattedBrokers = brokers.map(broker => ({
      id: broker._id,
      name: broker.name || broker.branding?.brandName || broker.username,
      brandName: broker.branding?.brandName || '',
      logoUrl: broker.branding?.logoUrl || '',
      certificateNumber: broker.certificate?.certificateNumber || '',
      description: broker.certificate?.description || '',
      specialization: broker.certificate?.specialization || '',
      yearsOfExperience: broker.certificate?.yearsOfExperience || 0,
      totalClients: broker.certificate?.totalClients || broker.stats?.totalUsers || 0,
      rating: broker.certificate?.rating || 5,
      referralCode: broker.referralCode,
      adminCode: broker.adminCode
    }));

    res.json({ brokers: formattedBrokers });
  } catch (error) {
    console.error('Error fetching certified brokers:', error);
    res.status(500).json({ message: 'Failed to fetch brokers' });
  }
});

// User Registration
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, fullName, phone, adminCode, referralCode } = req.body;
    
    let admin;
    
    // If admin code or referral code provided, use that admin
    if (adminCode || referralCode) {
      const lookup = adminCode
        ? { adminCode: adminCode.trim().toUpperCase() }
        : { referralCode: referralCode.trim().toUpperCase() };

      admin = await Admin.findOne(lookup);

      if (!admin) {
        return res.status(400).json({ message: 'Invalid admin or referral code' });
      }

      if (admin.status !== 'ACTIVE') {
        return res.status(400).json({ message: 'Admin is not active. Contact support.' });
      }
    } else {
      // No admin code provided - assign to Super Admin by default
      admin = await Admin.findOne({ role: 'SUPER_ADMIN', status: 'ACTIVE' });
      
      if (!admin) {
        return res.status(400).json({ message: 'System not configured. Please contact support.' });
      }
    }
    
    const userExists = await User.findOne({ $or: [{ email }, { username }] });
    if (userExists) {
      return res.status(400).json({ message: 'User with this email or username already exists' });
    }

    const user = await User.create({
      username,
      email,
      password,
      fullName,
      phone,
      admin: admin._id,
      adminCode: admin.adminCode
    });

    // Update admin stats - increment user count
    admin.stats.totalUsers = (admin.stats.totalUsers || 0) + 1;
    admin.stats.activeUsers = (admin.stats.activeUsers || 0) + 1;
    await admin.save();

    res.status(201).json({
      _id: user._id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      adminCode: user.adminCode,
      wallet: user.wallet,
      marginAvailable: user.marginAvailable,
      token: generateToken(user._id)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create Demo Account - No admin required, 7-day trial with 100,000 demo balance
router.post('/demo-register', async (req, res) => {
  try {
    const { username, email, password, fullName, phone } = req.body;
    
    // Check if user already exists
    const userExists = await User.findOne({ $or: [{ email }, { username }] });
    if (userExists) {
      return res.status(400).json({ message: 'User with this email or username already exists' });
    }
    
    // Calculate expiry date (7 days from now)
    const demoExpiresAt = new Date();
    demoExpiresAt.setDate(demoExpiresAt.getDate() + 7);
    
    // Create demo user without admin
    const user = await User.create({
      username,
      email,
      password,
      fullName,
      phone,
      isDemo: true,
      demoExpiresAt,
      demoCreatedAt: new Date(),
      adminCode: null,
      admin: null,
      hierarchyPath: [],
      wallet: {
        balance: 1000000,
        cashBalance: 1000000,
        tradingBalance: 0,
        usedMargin: 0,
        collateralValue: 0,
        realizedPnL: 0,
        unrealizedPnL: 0,
        todayRealizedPnL: 0,
        todayUnrealizedPnL: 0,
        transactions: []
      },
      settings: {
        isDemo: true,
        isActivated: true
      }
    });

    res.status(201).json({
      _id: user._id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      isDemo: true,
      demoExpiresAt: user.demoExpiresAt,
      wallet: user.wallet,
      token: generateToken(user._id),
      message: 'Demo account created! Valid for 7 days with ₹10,00,000 demo balance.'
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// User Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (!user.isActive) {
      return res.status(401).json({ message: 'Your account is not active. Please contact your admin.' });
    }
    
    // Check if demo account has expired
    if (user.isDemo && user.demoExpiresAt && new Date() > user.demoExpiresAt) {
      return res.status(401).json({ message: 'Your demo account has expired. Please create a new account.' });
    }

    if (await user.comparePassword(password)) {
      // Check if user is already logged in on another device
      if (user.activeSessionToken) {
        return res.status(403).json({ 
          message: 'You are already logged in on another device. Please logout from that device first.',
          code: 'ALREADY_LOGGED_IN'
        });
      }
      
      // Generate unique session token for single device login
      const sessionToken = generateSessionToken();
      
      // Get device info from user agent
      const userAgent = req.headers['user-agent'] || 'Unknown device';
      const deviceType = userAgent.includes('Mobile') ? 'Mobile' : 'Desktop';
      
      // Update user with new session token and login info
      await User.updateOne(
        { _id: user._id },
        { 
          activeSessionToken: sessionToken,
          lastLoginAt: new Date(),
          lastLoginDevice: deviceType
        }
      );
      
      res.json({
        _id: user._id,
        userId: user.userId,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        role: user.role,
        wallet: user.wallet,
        marginAvailable: user.marginAvailable,
        isReadOnly: user.isReadOnly || false,
        isDemo: user.isDemo || false,
        demoExpiresAt: user.demoExpiresAt,
        createdAt: user.createdAt,
        token: generateToken(user._id, sessionToken)
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// User Logout - Clear session token to allow login from other devices
router.post('/logout', protectUser, async (req, res) => {
  try {
    await User.updateOne(
      { _id: req.user._id },
      { activeSessionToken: null }
    );
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get user profile
router.get('/profile', protectUser, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get bank details for deposits - Shows admin's bank accounts, not Super Admin's
router.get('/bank-details', protectUser, async (req, res) => {
  try {
    // Get the user's admin code to fetch their admin's bank accounts
    const userAdminCode = req.user.adminCode;
    
    // First try to get the admin's bank accounts
    const adminBankAccounts = await BankAccount.find({ 
      adminCode: userAdminCode, 
      type: 'BANK',
      isActive: true 
    }).sort({ isPrimary: -1 });
    
    const adminUpiAccounts = await BankAccount.find({ 
      adminCode: userAdminCode, 
      type: 'UPI',
      isActive: true 
    }).sort({ isPrimary: -1 });
    
    // Get global settings for limits and instructions
    const settings = await BankSettings.getSettings();
    
    // If admin has bank accounts configured, use them
    if (adminBankAccounts.length > 0 || adminUpiAccounts.length > 0) {
      const bankAccount = adminBankAccounts[0]; // Primary or first active
      const upiAccount = adminUpiAccounts[0]; // Primary or first active
      
      res.json({
        bankName: bankAccount?.bankName || 'Not configured',
        accountName: bankAccount?.holderName || 'Not configured',
        accountNumber: bankAccount?.accountNumber || 'Not configured',
        ifscCode: bankAccount?.ifsc || 'Not configured',
        branch: bankAccount?.accountType || '',
        upiId: upiAccount?.upiId || 'Not configured',
        upiName: upiAccount?.holderName || 'Not configured',
        depositInstructions: settings.depositInstructions,
        minimumDeposit: settings.minimumDeposit,
        maximumDeposit: settings.maximumDeposit
      });
    } else {
      // Fallback to global settings (Super Admin's bank) if admin hasn't configured any
      const bankAccount = settings.bankAccounts.find(acc => acc.isPrimary && acc.isActive) 
        || settings.bankAccounts.find(acc => acc.isActive);
      
      const upiAccount = settings.upiAccounts.find(acc => acc.isPrimary && acc.isActive)
        || settings.upiAccounts.find(acc => acc.isActive);
      
      res.json({
        bankName: bankAccount?.bankName || 'Not configured',
        accountName: bankAccount?.accountName || 'Not configured',
        accountNumber: bankAccount?.accountNumber || 'Not configured',
        ifscCode: bankAccount?.ifscCode || 'Not configured',
        branch: bankAccount?.branch || '',
        upiId: upiAccount?.upiId || 'Not configured',
        upiName: upiAccount?.name || 'Not configured',
        depositInstructions: settings.depositInstructions,
        minimumDeposit: settings.minimumDeposit,
        maximumDeposit: settings.maximumDeposit
      });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Submit deposit request
router.post('/deposit-request', protectUser, async (req, res) => {
  try {
    const { amount, utrNumber, paymentMethod, remarks } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid amount' });
    }
    if (!utrNumber) {
      return res.status(400).json({ message: 'UTR/Transaction ID is required' });
    }

    const request = await FundRequest.create({
      user: req.user._id,
      userId: req.user.userId,
      adminCode: req.user.adminCode || 'SUPER',
      hierarchyPath: req.user.hierarchyPath || [],
      type: 'DEPOSIT',
      amount,
      paymentMethod: paymentMethod || 'BANK',
      referenceId: utrNumber,
      userRemarks: remarks || ''
    });
    
    res.status(201).json({ 
      message: 'Deposit request submitted successfully',
      requestId: request.requestId
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Submit withdrawal request
router.post('/withdraw-request', protectUser, async (req, res) => {
  try {
    const { amount, accountDetails, paymentMethod, remarks } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid amount' });
    }

    const user = await User.findById(req.user._id);
    
    if (amount > user.wallet.cashBalance) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }
    
    const request = await FundRequest.create({
      user: req.user._id,
      userId: req.user.userId,
      adminCode: req.user.adminCode || 'SUPER',
      hierarchyPath: req.user.hierarchyPath || [],
      type: 'WITHDRAWAL',
      amount,
      paymentMethod: paymentMethod || 'BANK',
      userRemarks: remarks || '',
      withdrawalDetails: {
        notes: accountDetails || ''
      }
    });
    
    res.status(201).json({ 
      message: 'Withdrawal request submitted successfully',
      requestId: request.requestId
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get wallet info (enhanced with dual wallet system)
router.get('/wallet', protectUser, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('wallet cryptoWallet mcxWallet marginSettings rmsSettings');
    
    // Dual wallet system - Main Wallet (cashBalance) and Trading Account (tradingBalance)
    // Handle legacy: if cashBalance is 0 but balance has value, use balance as cashBalance
    let mainWalletBalance = user.wallet.cashBalance || 0;
    if (mainWalletBalance === 0 && user.wallet.balance > 0) {
      mainWalletBalance = user.wallet.balance;
      // Migrate to cashBalance
      user.wallet.cashBalance = mainWalletBalance;
      await user.save();
    }
    
    const tradingBalance = user.wallet.tradingBalance || 0;
    const usedMargin = user.wallet.usedMargin || 0;
    
    // Calculate available margin (for trading)
    const availableMargin = tradingBalance 
      + (user.wallet.collateralValue || 0)
      + Math.max(0, user.wallet.unrealizedPnL || 0)
      - Math.abs(Math.min(0, user.wallet.unrealizedPnL || 0))
      - usedMargin;

    res.json({
      // Core wallet fields - Dual Wallet System
      cashBalance: mainWalletBalance,           // Main Wallet (for deposit/withdraw with admin)
      tradingBalance: tradingBalance,           // Trading Account (for trading)
      usedMargin: usedMargin,
      collateralValue: user.wallet.collateralValue || 0,
      realizedPnL: user.wallet.realizedPnL || 0,
      unrealizedPnL: user.wallet.unrealizedPnL || 0,
      todayRealizedPnL: user.wallet.todayRealizedPnL || 0,
      todayUnrealizedPnL: user.wallet.todayUnrealizedPnL || 0,
      
      // Calculated fields
      availableMargin,
      totalBalance: mainWalletBalance + tradingBalance,
      
      // Separate Crypto Wallet - No margin system
      cryptoWallet: {
        balance: user.cryptoWallet?.balance || 0,
        realizedPnL: user.cryptoWallet?.realizedPnL || 0,
        unrealizedPnL: user.cryptoWallet?.unrealizedPnL || 0,
        todayRealizedPnL: user.cryptoWallet?.todayRealizedPnL || 0
      },
      
      // Separate MCX Wallet - For MCX Futures and Options trading
      mcxWallet: {
        balance: user.mcxWallet?.balance || 0,
        usedMargin: user.mcxWallet?.usedMargin || 0,
        realizedPnL: user.mcxWallet?.realizedPnL || 0,
        unrealizedPnL: user.mcxWallet?.unrealizedPnL || 0,
        todayRealizedPnL: user.mcxWallet?.todayRealizedPnL || 0,
        todayUnrealizedPnL: user.mcxWallet?.todayUnrealizedPnL || 0,
        availableBalance: (user.mcxWallet?.balance || 0) - (user.mcxWallet?.usedMargin || 0)
      },
      
      // Legacy fields for backward compatibility
      wallet: {
        balance: mainWalletBalance,
        cashBalance: mainWalletBalance,
        tradingBalance: tradingBalance,
        usedMargin: usedMargin,
        blocked: usedMargin,
        totalDeposited: user.wallet.totalDeposited || 0,
        totalWithdrawn: user.wallet.totalWithdrawn || 0,
        totalPnL: user.wallet.realizedPnL || 0,
        transactions: user.wallet.transactions
      },
      marginAvailable: availableMargin,
      
      // Settings
      marginSettings: user.marginSettings,
      rmsStatus: user.rmsSettings?.tradingBlocked ? 'BLOCKED' : 'ACTIVE',
      rmsBlockReason: user.rmsSettings?.blockReason
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get user settings (margin, exposure, RMS)
router.get('/settings', protectUser, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('marginSettings rmsSettings settings segmentPermissions')
      .lean(); // Use lean() to get plain JS object instead of Mongoose document
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Default segment settings for all Market Watch segments
    const defaultSegment = { 
      enabled: false, 
      maxExchangeLots: 100, 
      commissionType: 'PER_LOT', 
      commissionLot: 0, 
      maxLots: 50, 
      minLots: 1, 
      orderLots: 10, 
      exposureIntraday: 1, 
      exposureCarryForward: 1,
      optionBuy: { allowed: true, commissionType: 'PER_LOT', commission: 0, strikeSelection: 50, maxExchangeLots: 100 },
      optionSell: { allowed: true, commissionType: 'PER_LOT', commission: 0, strikeSelection: 50, maxExchangeLots: 100 }
    };
    
    // All segments matching Market Watch
    const allSegments = ['NSEFUT', 'NSEOPT', 'MCXFUT', 'MCXOPT', 'NSE-EQ', 'BSE-FUT', 'BSE-OPT'];
    
    // Build segment permissions with defaults for missing segments
    const userSegments = user.segmentPermissions || {};
    const segmentPermissions = {};
    
    allSegments.forEach(segment => {
      segmentPermissions[segment] = userSegments[segment] || { ...defaultSegment };
    });
    
    res.json({
      marginSettings: user.marginSettings || {},
      rmsSettings: user.rmsSettings || {},
      settings: user.settings || {},
      segmentPermissions
    });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Update profile
router.put('/profile', protectUser, async (req, res) => {
  try {
    const { fullName, phone } = req.body;
    
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Update allowed fields
    if (fullName) user.fullName = fullName;
    if (phone) user.phone = phone;
    
    await user.save();
    
    res.json({
      message: 'Profile updated successfully',
      user: {
        _id: user._id,
        userId: user.userId,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Change password
router.post('/change-password', protectUser, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: 'Please provide old and new password' });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }
    
    const user = await User.findById(req.user._id).select('+password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check if old password matches
    const isMatch = await user.comparePassword(oldPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }
    
    // Update password
    user.password = newPassword;
    await user.save();
    
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: error.message });
  }
});

// ==================== NOTIFICATIONS ====================

// Get user notifications
router.get('/notifications', protectUser, async (req, res) => {
  try {
    const userId = req.user._id;
    const userAdminCode = req.user.adminCode;
    
    // Find notifications targeted to this user
    const notifications = await Notification.find({
      isActive: true,
      $or: [
        { targetType: 'ALL_USERS' },
        { targetType: 'ALL_ADMINS_USERS' },
        { targetType: 'SINGLE_USER', targetUserId: userId },
        { targetType: 'SELECTED_USERS', targetUserIds: userId },
        { targetType: 'ADMIN_USERS', targetAdminCode: userAdminCode }
      ]
    }).sort({ createdAt: -1 }).limit(50);
    
    // Format notifications with read status
    const formattedNotifications = notifications.map(notif => {
      const readEntry = notif.readBy.find(r => r.userId.toString() === userId.toString());
      return {
        _id: notif._id,
        title: notif.title,
        subject: notif.subject,
        message: notif.description,
        image: notif.image,
        isRead: !!readEntry,
        readAt: readEntry?.readAt,
        createdAt: notif.createdAt
      };
    });
    
    const unreadCount = formattedNotifications.filter(n => !n.isRead).length;
    
    res.json({
      notifications: formattedNotifications,
      unreadCount,
      total: formattedNotifications.length
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: error.message });
  }
});

// Mark notification as read
router.put('/notifications/:id/read', protectUser, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    
    // Check if already read
    const alreadyRead = notification.readBy.some(r => r.userId.toString() === req.user._id.toString());
    if (!alreadyRead) {
      notification.readBy.push({ userId: req.user._id, readAt: new Date() });
      await notification.save();
    }
    
    res.json({ message: 'Marked as read' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Mark all notifications as read
router.put('/notifications/read-all', protectUser, async (req, res) => {
  try {
    const userId = req.user._id;
    const userAdminCode = req.user.adminCode;
    
    // Find all unread notifications for this user
    const notifications = await Notification.find({
      isActive: true,
      'readBy.userId': { $ne: userId },
      $or: [
        { targetType: 'ALL_USERS' },
        { targetType: 'ALL_ADMINS_USERS' },
        { targetType: 'SINGLE_USER', targetUserId: userId },
        { targetType: 'SELECTED_USERS', targetUserIds: userId },
        { targetType: 'ADMIN_USERS', targetAdminCode: userAdminCode }
      ]
    });
    
    // Mark all as read
    for (const notif of notifications) {
      notif.readBy.push({ userId, readAt: new Date() });
      await notif.save();
    }
    
    res.json({ message: 'All notifications marked as read', count: notifications.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ==================== BROKER CHANGE REQUEST ROUTES ====================

// Get available brokers/admins for transfer request
// Only returns brokers under the same parent ADMIN
router.get('/available-brokers', protectUser, async (req, res) => {
  try {
    const currentAdminCode = req.user.adminCode;
    
    // Get current admin
    const currentAdmin = await Admin.findOne({ adminCode: currentAdminCode });
    if (!currentAdmin) {
      return res.status(400).json({ message: 'Current admin not found' });
    }
    
    // Find the parent ADMIN of current admin
    let parentAdminId = null;
    if (currentAdmin.role === 'ADMIN') {
      parentAdminId = currentAdmin._id;
    } else if (currentAdmin.role === 'SUPER_ADMIN') {
      // If under SuperAdmin, show all admins
      parentAdminId = null;
    } else {
      // Find ADMIN in hierarchy path
      const parentAdmin = await Admin.findOne({
        _id: { $in: currentAdmin.hierarchyPath || [] },
        role: 'ADMIN'
      });
      parentAdminId = parentAdmin?._id;
    }
    
    let query = {
      status: 'ACTIVE',
      role: { $in: ['ADMIN', 'BROKER', 'SUB_BROKER'] },
      adminCode: { $ne: currentAdminCode }
    };
    
    // If there's a parent ADMIN, only show brokers under that admin
    if (parentAdminId) {
      query.$or = [
        { _id: parentAdminId }, // The parent admin itself
        { hierarchyPath: parentAdminId } // All admins under the parent
      ];
    }
    
    const admins = await Admin.find(query)
      .select('name username adminCode role')
      .sort({ role: 1, name: 1 });
    
    res.json(admins);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get user's broker change requests
router.get('/broker-change-requests', protectUser, async (req, res) => {
  try {
    const requests = await BrokerChangeRequest.find({ user: req.user._id })
      .populate('currentAdmin', 'name username adminCode role')
      .populate('requestedAdmin', 'name username adminCode role')
      .populate('processedBy', 'name username')
      .sort({ createdAt: -1 });
    
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create broker change request
router.post('/broker-change-request', protectUser, async (req, res) => {
  try {
    const { requestedAdminCode, reason } = req.body;
    
    if (!requestedAdminCode) {
      return res.status(400).json({ message: 'Please select a broker/admin to transfer to' });
    }
    
    // Check if user already has a pending request
    const existingRequest = await BrokerChangeRequest.findOne({
      user: req.user._id,
      status: 'PENDING'
    });
    
    if (existingRequest) {
      return res.status(400).json({ message: 'You already have a pending broker change request' });
    }
    
    // Get current admin
    const currentAdmin = await Admin.findOne({ adminCode: req.user.adminCode });
    if (!currentAdmin) {
      return res.status(400).json({ message: 'Current admin not found' });
    }
    
    // Get requested admin
    const requestedAdmin = await Admin.findOne({ 
      adminCode: requestedAdminCode.trim().toUpperCase(),
      status: 'ACTIVE'
    });
    
    if (!requestedAdmin) {
      return res.status(400).json({ message: 'Invalid or inactive broker/admin code' });
    }
    
    if (requestedAdmin.adminCode === req.user.adminCode) {
      return res.status(400).json({ message: 'You are already under this broker/admin' });
    }
    
    // Find the parent admin (ADMIN role) of current admin
    // If current admin is ADMIN, they are the parent
    // If current admin is BROKER or SUB_BROKER, find their parent ADMIN
    let parentAdminId = null;
    if (currentAdmin.role === 'ADMIN') {
      parentAdminId = currentAdmin._id;
    } else {
      // Find ADMIN in hierarchy path
      const parentAdmin = await Admin.findOne({
        _id: { $in: currentAdmin.hierarchyPath || [] },
        role: 'ADMIN'
      });
      parentAdminId = parentAdmin?._id;
    }
    
    // Check if requested admin is under the same parent ADMIN
    let requestedParentAdminId = null;
    if (requestedAdmin.role === 'ADMIN') {
      requestedParentAdminId = requestedAdmin._id;
    } else {
      const requestedParentAdmin = await Admin.findOne({
        _id: { $in: requestedAdmin.hierarchyPath || [] },
        role: 'ADMIN'
      });
      requestedParentAdminId = requestedParentAdmin?._id;
    }
    
    // Validate: both must be under the same parent ADMIN (or both are ADMINs under SuperAdmin)
    if (parentAdminId && requestedParentAdminId) {
      if (parentAdminId.toString() !== requestedParentAdminId.toString()) {
        return res.status(400).json({ 
          message: 'You can only change to a broker under the same parent admin' 
        });
      }
    }
    
    // Create the request - will be reviewed by parent ADMIN or SUPER_ADMIN
    const request = await BrokerChangeRequest.create({
      user: req.user._id,
      userId: req.user.userId,
      currentAdminCode: req.user.adminCode,
      currentAdmin: currentAdmin._id,
      requestedAdminCode: requestedAdmin.adminCode,
      requestedAdmin: requestedAdmin._id,
      reason: reason || '',
      parentAdmin: parentAdminId // Track which admin should approve
    });
    
    await request.populate([
      { path: 'currentAdmin', select: 'name username adminCode role' },
      { path: 'requestedAdmin', select: 'name username adminCode role' }
    ]);
    
    res.status(201).json({
      message: 'Broker change request submitted successfully. It will be reviewed by your admin.',
      request
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Cancel broker change request
router.delete('/broker-change-request/:id', protectUser, async (req, res) => {
  try {
    const request = await BrokerChangeRequest.findOne({
      _id: req.params.id,
      user: req.user._id,
      status: 'PENDING'
    });
    
    if (!request) {
      return res.status(404).json({ message: 'Request not found or already processed' });
    }
    
    await BrokerChangeRequest.deleteOne({ _id: request._id });
    
    res.json({ message: 'Request cancelled successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ==================== DEMO ACCOUNT ROUTES ====================

// Get available brokers for demo user to select when converting
router.get('/demo/available-brokers', protectUser, async (req, res) => {
  try {
    if (!req.user.isDemo) {
      return res.status(400).json({ message: 'This is not a demo account' });
    }
    
    // Get all active admins/brokers/sub-brokers
    const admins = await Admin.find({
      status: 'ACTIVE',
      role: { $in: ['ADMIN', 'BROKER', 'SUB_BROKER'] }
    })
    .select('name username adminCode role')
    .sort({ role: 1, name: 1 });
    
    res.json(admins);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Convert demo account to real account
router.post('/demo/convert-to-real', protectUser, async (req, res) => {
  try {
    const { selectedBrokerCode } = req.body;
    const user = await User.findById(req.user._id);
    
    if (!user.isDemo) {
      return res.status(400).json({ message: 'This is not a demo account' });
    }
    
    // Find the admin to assign to
    let admin;
    if (selectedBrokerCode) {
      admin = await Admin.findOne({ adminCode: selectedBrokerCode, status: 'ACTIVE' });
      if (!admin) {
        return res.status(400).json({ message: 'Invalid broker code' });
      }
    } else {
      // Default to Super Admin if no broker selected
      admin = await Admin.findOne({ role: 'SUPER_ADMIN', status: 'ACTIVE' });
      if (!admin) {
        return res.status(400).json({ message: 'System not configured. Please contact support.' });
      }
    }
    
    // Build hierarchy path
    let hierarchyPath = [];
    if (admin.hierarchyPath && admin.hierarchyPath.length > 0) {
      hierarchyPath = [...admin.hierarchyPath, admin._id];
    } else {
      hierarchyPath = [admin._id];
    }
    
    // Clear demo data and convert to real account
    // Reset wallet to zero
    user.wallet = {
      balance: 0,
      cashBalance: 0,
      tradingBalance: 0,
      usedMargin: 0,
      collateralValue: 0,
      realizedPnL: 0,
      unrealizedPnL: 0,
      todayRealizedPnL: 0,
      todayUnrealizedPnL: 0,
      transactions: []
    };
    
    // Reset crypto wallet
    user.cryptoWallet = {
      balance: 0,
      realizedPnL: 0,
      unrealizedPnL: 0,
      todayRealizedPnL: 0
    };
    
    // Update user to real account
    user.isDemo = false;
    user.demoExpiresAt = null;
    user.demoCreatedAt = null;
    user.settings.isDemo = false;
    user.admin = admin._id;
    user.adminCode = admin.adminCode;
    user.hierarchyPath = hierarchyPath;
    user.creatorRole = admin.role;
    
    await user.save();
    
    // Update admin stats
    admin.stats.totalUsers = (admin.stats.totalUsers || 0) + 1;
    admin.stats.activeUsers = (admin.stats.activeUsers || 0) + 1;
    await admin.save();
    
    // Delete all trading history for this user (positions, orders, trades)
    const Position = (await import('../models/Position.js')).default;
    const Order = (await import('../models/Order.js')).default;
    const Trade = (await import('../models/Trade.js')).default;
    
    await Position.deleteMany({ user: user._id });
    await Order.deleteMany({ user: user._id });
    await Trade.deleteMany({ user: user._id });
    
    res.json({
      message: 'Account converted to real account successfully!',
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        isDemo: false,
        adminCode: user.adminCode,
        wallet: user.wallet
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get demo account info
router.get('/demo/info', protectUser, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user.isDemo) {
      return res.status(400).json({ message: 'This is not a demo account', isDemo: false });
    }
    
    const now = new Date();
    const expiresAt = new Date(user.demoExpiresAt);
    const daysRemaining = Math.max(0, Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24)));
    
    res.json({
      isDemo: true,
      demoExpiresAt: user.demoExpiresAt,
      demoCreatedAt: user.demoCreatedAt,
      daysRemaining,
      demoBalance: user.wallet.balance || user.wallet.cashBalance
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
