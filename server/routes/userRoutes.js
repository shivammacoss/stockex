import express from 'express';
import User from '../models/User.js';
import Admin from '../models/Admin.js';
import BankSettings from '../models/BankSettings.js';
import BankAccount from '../models/BankAccount.js';
import FundRequest from '../models/FundRequest.js';
import Notification from '../models/Notification.js';
import BrokerChangeRequest from '../models/BrokerChangeRequest.js';
import GameSettings from '../models/GameSettings.js';
import NiftyNumberBet from '../models/NiftyNumberBet.js';
import NiftyBracketTrade from '../models/NiftyBracketTrade.js';
import NiftyJackpotBid from '../models/NiftyJackpotBid.js';
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
    const user = await User.findById(req.user._id).select('wallet cryptoWallet mcxWallet gamesWallet marginSettings rmsSettings');
    
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
      
      // Separate Games Wallet - For fantasy/games trading
      gamesWallet: {
        balance: user.gamesWallet?.balance || 0,
        usedMargin: user.gamesWallet?.usedMargin || 0,
        realizedPnL: user.gamesWallet?.realizedPnL || 0,
        unrealizedPnL: user.gamesWallet?.unrealizedPnL || 0,
        todayRealizedPnL: user.gamesWallet?.todayRealizedPnL || 0,
        todayUnrealizedPnL: user.gamesWallet?.todayUnrealizedPnL || 0,
        availableBalance: (user.gamesWallet?.balance || 0) - (user.gamesWallet?.usedMargin || 0)
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

// PUBLIC: Get game settings for frontend (user-facing)
router.get('/game-settings', protectUser, async (req, res) => {
  try {
    const settings = await GameSettings.getSettings();
    const settingsObj = settings.toObject();
    
    // Return only what the frontend needs (no internal/admin fields)
    const games = {};
    if (settingsObj.games) {
      for (const [key, game] of Object.entries(settingsObj.games)) {
        games[key] = {
          enabled: game.enabled,
          name: game.name,
          description: game.description,
          winMultiplier: game.winMultiplier,
          brokeragePercent: game.brokeragePercent,
          minBet: game.minBet,
          maxBet: game.maxBet,
          roundDuration: game.roundDuration,
          cooldownBetweenRounds: game.cooldownBetweenRounds,
          // Nifty Number specific
          ...(game.fixedProfit !== undefined && { fixedProfit: game.fixedProfit }),
          ...(game.resultTime !== undefined && { resultTime: game.resultTime }),
          ...(game.betsPerDay !== undefined && { betsPerDay: game.betsPerDay }),
          // Nifty Bracket specific
          ...(game.bracketGap !== undefined && { bracketGap: game.bracketGap }),
          ...(game.expiryMinutes !== undefined && { expiryMinutes: game.expiryMinutes }),
          // Nifty Jackpot specific
          ...(game.topWinners !== undefined && { topWinners: game.topWinners }),
          ...(game.firstPrize !== undefined && { firstPrize: game.firstPrize }),
          ...(game.prizeStep !== undefined && { prizeStep: game.prizeStep }),
          ...(game.bidsPerDay !== undefined && { bidsPerDay: game.bidsPerDay }),
        };
      }
    }

    res.json({
      gamesEnabled: settingsObj.gamesEnabled,
      maintenanceMode: settingsObj.maintenanceMode,
      maintenanceMessage: settingsObj.maintenanceMessage,
      games,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ==================== UP/DOWN GAME (Nifty & BTC) ====================

// Place an Up/Down bet (debit gamesWallet)
router.post('/game-bet/place', protectUser, async (req, res) => {
  try {
    const { gameId, prediction, amount, entryPrice, windowNumber } = req.body;
    const userId = req.user._id;

    if (!['UP', 'DOWN'].includes(prediction)) {
      return res.status(400).json({ message: 'Prediction must be UP or DOWN' });
    }

    // Map gameId to settings key
    const settingsKey = gameId === 'btcupdown' ? 'btcUpDown' : 'niftyUpDown';
    const settings = await GameSettings.getSettings();
    const gameConfig = settings.games?.[settingsKey];
    if (!gameConfig?.enabled) {
      return res.status(400).json({ message: 'This game is currently disabled' });
    }

    const betAmount = parseFloat(amount);
    if (isNaN(betAmount) || betAmount <= 0) {
      return res.status(400).json({ message: 'Invalid bet amount' });
    }
    if (betAmount < (gameConfig.minBet || 100)) {
      return res.status(400).json({ message: `Minimum bet is ₹${gameConfig.minBet || 100}` });
    }
    if (betAmount > (gameConfig.maxBet || 50000)) {
      return res.status(400).json({ message: `Maximum bet is ₹${gameConfig.maxBet || 50000}` });
    }

    const user = await User.findById(userId);
    if (!user || user.gamesWallet.balance < betAmount) {
      return res.status(400).json({ message: 'Insufficient balance in games wallet' });
    }

    // Debit
    user.gamesWallet.balance -= betAmount;
    user.gamesWallet.usedMargin += betAmount;
    await user.save();

    res.json({
      message: 'Bet placed!',
      betId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      newBalance: user.gamesWallet.balance
    });
  } catch (error) {
    console.error('Game bet place error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Resolve Up/Down bets (credit/debit gamesWallet based on results)
router.post('/game-bet/resolve', protectUser, async (req, res) => {
  try {
    const { trades } = req.body;
    // trades = [{ amount, won, pnl, brokerage }]
    if (!Array.isArray(trades) || trades.length === 0) {
      return res.status(400).json({ message: 'No trades to resolve' });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    let totalPnl = 0;
    for (const trade of trades) {
      const amount = parseFloat(trade.amount);
      const pnl = parseFloat(trade.pnl);
      const won = trade.won;

      // Release used margin
      user.gamesWallet.usedMargin = Math.max(0, user.gamesWallet.usedMargin - amount);

      if (won) {
        // Refund bet + profit
        user.gamesWallet.balance += amount + pnl;
        user.gamesWallet.realizedPnL += pnl;
        user.gamesWallet.todayRealizedPnL += pnl;
      } else {
        // Loss — bet already deducted, just track P&L
        user.gamesWallet.realizedPnL -= amount;
        user.gamesWallet.todayRealizedPnL -= amount;
      }
      totalPnl += pnl;
    }

    await user.save();

    res.json({
      message: `${trades.length} trade(s) resolved`,
      totalPnl,
      newBalance: user.gamesWallet.balance
    });
  } catch (error) {
    console.error('Game bet resolve error:', error);
    res.status(500).json({ message: error.message });
  }
});

// ==================== NIFTY NUMBER GAME ====================

// Helper: Get today's date string in IST (YYYY-MM-DD)
function getTodayIST() {
  const now = new Date();
  const ist = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
  return ist.toISOString().split('T')[0];
}

// Place a Nifty Number bet (multiple numbers allowed per day)
router.post('/nifty-number/bet', protectUser, async (req, res) => {
  try {
    const { selectedNumbers, amount } = req.body;
    const userId = req.user._id;
    const today = getTodayIST();

    // Support both single number (legacy) and array of numbers
    const numbers = Array.isArray(selectedNumbers)
      ? selectedNumbers.map(n => parseInt(n))
      : [parseInt(selectedNumbers ?? req.body.selectedNumber)];

    // Validate numbers
    if (numbers.length === 0) {
      return res.status(400).json({ message: 'Please select at least one number' });
    }
    for (const num of numbers) {
      if (isNaN(num) || num < 0 || num > 99) {
        return res.status(400).json({ message: 'All numbers must be between .00 and .99' });
      }
    }
    // Check for duplicates in the request
    if (new Set(numbers).size !== numbers.length) {
      return res.status(400).json({ message: 'Duplicate numbers are not allowed' });
    }

    // Get game settings
    const settings = await GameSettings.getSettings();
    const gameConfig = settings.games?.niftyNumber;
    if (!gameConfig?.enabled) {
      return res.status(400).json({ message: 'Nifty Number game is currently disabled' });
    }

    // Validate amount (per number)
    const betAmount = parseFloat(amount);
    if (isNaN(betAmount) || betAmount <= 0) {
      return res.status(400).json({ message: 'Invalid bet amount' });
    }
    if (betAmount < (gameConfig.minBet || 100)) {
      return res.status(400).json({ message: `Minimum bet is ₹${gameConfig.minBet || 100} per number` });
    }
    if (betAmount > (gameConfig.maxBet || 10000)) {
      return res.status(400).json({ message: `Maximum bet is ₹${gameConfig.maxBet || 10000} per number` });
    }

    const totalCost = betAmount * numbers.length;

    // Check how many bets user already placed today
    const todayBetsCount = await NiftyNumberBet.countDocuments({ user: userId, betDate: today });
    const maxBetsPerDay = gameConfig.betsPerDay || 1;
    if (todayBetsCount + numbers.length > maxBetsPerDay) {
      const remaining = Math.max(0, maxBetsPerDay - todayBetsCount);
      return res.status(400).json({ message: `You can only place ${maxBetsPerDay} bets per day. You have ${remaining} remaining.` });
    }

    // Check if user already bet on any of these numbers today
    const existingBets = await NiftyNumberBet.find({ user: userId, betDate: today, selectedNumber: { $in: numbers } });
    if (existingBets.length > 0) {
      const dupes = existingBets.map(b => `.${b.selectedNumber.toString().padStart(2, '0')}`).join(', ');
      return res.status(400).json({ message: `You already bet on ${dupes} today` });
    }

    // Check balance
    const user = await User.findById(userId);
    if (!user || user.gamesWallet.balance < totalCost) {
      return res.status(400).json({ message: `Insufficient balance. Need ₹${totalCost.toLocaleString()} for ${numbers.length} number(s)` });
    }

    // Debit the total bet amount
    user.gamesWallet.balance -= totalCost;
    user.gamesWallet.usedMargin += totalCost;
    await user.save();

    // Create bets for each number
    const betDocs = numbers.map(num => ({
      user: userId,
      selectedNumber: num,
      amount: betAmount,
      betDate: today,
      admin: user.admin || null,
      status: 'pending'
    }));
    const bets = await NiftyNumberBet.insertMany(betDocs);

    res.json({
      message: `${numbers.length} bet(s) placed successfully!`,
      bets: bets.map(b => ({
        _id: b._id,
        selectedNumber: b.selectedNumber,
        amount: b.amount,
        betDate: b.betDate,
        status: b.status
      })),
      newBalance: user.gamesWallet.balance
    });
  } catch (error) {
    console.error('Nifty Number bet error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get today's bets for current user
router.get('/nifty-number/today', protectUser, async (req, res) => {
  try {
    const today = getTodayIST();
    const bets = await NiftyNumberBet.find({ user: req.user._id, betDate: today }).sort({ createdAt: -1 });

    const settings = await GameSettings.getSettings();
    const maxBetsPerDay = settings.games?.niftyNumber?.betsPerDay || 1;

    res.json({
      hasBet: bets.length > 0,
      betsCount: bets.length,
      maxBetsPerDay,
      remaining: Math.max(0, maxBetsPerDay - bets.length),
      bets: bets.map(b => ({
        _id: b._id,
        selectedNumber: b.selectedNumber,
        amount: b.amount,
        betDate: b.betDate,
        status: b.status,
        resultNumber: b.resultNumber,
        closingPrice: b.closingPrice,
        profit: b.profit,
        resultDeclaredAt: b.resultDeclaredAt
      }))
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get bet history for current user
router.get('/nifty-number/history', protectUser, async (req, res) => {
  try {
    const bets = await NiftyNumberBet.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(30);

    res.json(bets.map(b => ({
      _id: b._id,
      selectedNumber: b.selectedNumber,
      amount: b.amount,
      betDate: b.betDate,
      status: b.status,
      resultNumber: b.resultNumber,
      closingPrice: b.closingPrice,
      profit: b.profit,
      resultDeclaredAt: b.resultDeclaredAt
    })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ==================== NIFTY BRACKET GAME ====================

// Place a bracket trade
router.post('/nifty-bracket/trade', protectUser, async (req, res) => {
  try {
    const { prediction, amount, entryPrice } = req.body;
    const userId = req.user._id;

    // Validate prediction
    if (!['BUY', 'SELL'].includes(prediction)) {
      return res.status(400).json({ message: 'Prediction must be BUY or SELL' });
    }

    // Get game settings
    const settings = await GameSettings.getSettings();
    const gameConfig = settings.games?.niftyBracket;
    if (!gameConfig?.enabled) {
      return res.status(400).json({ message: 'Nifty Bracket game is currently disabled' });
    }

    // Validate amount
    const betAmount = parseFloat(amount);
    if (isNaN(betAmount) || betAmount <= 0) {
      return res.status(400).json({ message: 'Invalid bet amount' });
    }
    if (betAmount < (gameConfig.minBet || 100)) {
      return res.status(400).json({ message: `Minimum bet is ₹${gameConfig.minBet || 100}` });
    }
    if (betAmount > (gameConfig.maxBet || 25000)) {
      return res.status(400).json({ message: `Maximum bet is ₹${gameConfig.maxBet || 25000}` });
    }

    // Validate entryPrice
    const price = parseFloat(entryPrice);
    if (isNaN(price) || price <= 0) {
      return res.status(400).json({ message: 'Invalid entry price' });
    }

    const bracketGap = gameConfig.bracketGap || 20;
    const expiryMinutes = gameConfig.expiryMinutes || 5;
    const winMultiplier = gameConfig.winMultiplier || 2;
    const brokeragePercent = gameConfig.brokeragePercent || 5;

    const upperTarget = parseFloat((price + bracketGap).toFixed(2));
    const lowerTarget = parseFloat((price - bracketGap).toFixed(2));

    // Check balance
    const user = await User.findById(userId);
    if (!user || user.gamesWallet.balance < betAmount) {
      return res.status(400).json({ message: 'Insufficient balance in games wallet' });
    }

    // Debit the bet amount
    user.gamesWallet.balance -= betAmount;
    user.gamesWallet.usedMargin += betAmount;
    await user.save();

    // Create the trade
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);
    const tradeData = {
      user: userId,
      entryPrice: price,
      upperTarget,
      lowerTarget,
      bracketGap,
      prediction,
      amount: betAmount,
      winMultiplier,
      brokeragePercent,
      expiresAt,
      status: 'active'
    };
    if (user.admin) tradeData.admin = user.admin;
    const trade = await NiftyBracketTrade.create(tradeData);

    res.json({
      message: 'Trade placed!',
      trade: {
        _id: trade._id,
        entryPrice: trade.entryPrice,
        upperTarget: trade.upperTarget,
        lowerTarget: trade.lowerTarget,
        prediction: trade.prediction,
        amount: trade.amount,
        status: trade.status,
        expiresAt: trade.expiresAt,
        winMultiplier,
        brokeragePercent
      },
      newBalance: user.gamesWallet.balance
    });
  } catch (error) {
    console.error('Nifty Bracket trade error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get active bracket trades for current user
router.get('/nifty-bracket/active', protectUser, async (req, res) => {
  try {
    const trades = await NiftyBracketTrade.find({
      user: req.user._id,
      status: 'active'
    }).sort({ createdAt: -1 });

    res.json(trades.map(t => ({
      _id: t._id,
      entryPrice: t.entryPrice,
      upperTarget: t.upperTarget,
      lowerTarget: t.lowerTarget,
      prediction: t.prediction,
      amount: t.amount,
      status: t.status,
      expiresAt: t.expiresAt,
      winMultiplier: t.winMultiplier,
      brokeragePercent: t.brokeragePercent,
      createdAt: t.createdAt
    })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get bracket trade history for current user
router.get('/nifty-bracket/history', protectUser, async (req, res) => {
  try {
    const trades = await NiftyBracketTrade.find({
      user: req.user._id,
      status: { $ne: 'active' }
    }).sort({ createdAt: -1 }).limit(50);

    res.json(trades.map(t => ({
      _id: t._id,
      entryPrice: t.entryPrice,
      upperTarget: t.upperTarget,
      lowerTarget: t.lowerTarget,
      prediction: t.prediction,
      amount: t.amount,
      status: t.status,
      exitPrice: t.exitPrice,
      profit: t.profit,
      brokerageAmount: t.brokerageAmount,
      resolvedAt: t.resolvedAt,
      createdAt: t.createdAt
    })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Resolve a bracket trade (called by socket/cron when price hits target or expires)
router.post('/nifty-bracket/resolve', protectUser, async (req, res) => {
  try {
    const { tradeId, currentPrice } = req.body;
    const trade = await NiftyBracketTrade.findOne({ _id: tradeId, user: req.user._id, status: 'active' });
    if (!trade) {
      return res.status(404).json({ message: 'Active trade not found' });
    }

    const price = parseFloat(currentPrice);
    const now = new Date();
    let status, exitPrice, profit = 0, brokerageAmount = 0;

    const hitUpper = price >= trade.upperTarget;
    const hitLower = price <= trade.lowerTarget;
    const expired = now >= trade.expiresAt;

    if (hitUpper) {
      exitPrice = trade.upperTarget;
      if (trade.prediction === 'BUY') {
        // User predicted BUY (price goes up) and upper target hit → WIN
        const grossWin = trade.amount * trade.winMultiplier;
        brokerageAmount = parseFloat(((grossWin - trade.amount) * trade.brokeragePercent / 100).toFixed(2));
        profit = parseFloat((grossWin - trade.amount - brokerageAmount).toFixed(2));
        status = 'won';
      } else {
        // User predicted SELL but price went up → LOSS
        profit = -trade.amount;
        status = 'lost';
      }
    } else if (hitLower) {
      exitPrice = trade.lowerTarget;
      if (trade.prediction === 'SELL') {
        // User predicted SELL (price goes down) and lower target hit → WIN
        const grossWin = trade.amount * trade.winMultiplier;
        brokerageAmount = parseFloat(((grossWin - trade.amount) * trade.brokeragePercent / 100).toFixed(2));
        profit = parseFloat((grossWin - trade.amount - brokerageAmount).toFixed(2));
        status = 'won';
      } else {
        // User predicted BUY but price went down → LOSS
        profit = -trade.amount;
        status = 'lost';
      }
    } else if (expired) {
      // Neither target hit → expired, refund
      exitPrice = price;
      profit = 0;
      status = 'expired';
    } else {
      return res.status(400).json({ message: 'Trade is still active, no target hit yet' });
    }

    // Update trade
    trade.status = status;
    trade.exitPrice = exitPrice;
    trade.profit = profit;
    trade.brokerageAmount = brokerageAmount;
    trade.resolvedAt = now;
    await trade.save();

    // Update user wallet
    const user = await User.findById(trade.user);
    if (user) {
      user.gamesWallet.usedMargin = Math.max(0, user.gamesWallet.usedMargin - trade.amount);
      if (status === 'won') {
        const payout = trade.amount + profit + brokerageAmount; // refund bet + gross win - brokerage already deducted from profit
        user.gamesWallet.balance += trade.amount + profit;
        user.gamesWallet.realizedPnL += profit;
        user.gamesWallet.todayRealizedPnL += profit;
      } else if (status === 'lost') {
        user.gamesWallet.realizedPnL -= trade.amount;
        user.gamesWallet.todayRealizedPnL -= trade.amount;
      } else if (status === 'expired') {
        // Refund full amount
        user.gamesWallet.balance += trade.amount;
      }
      await user.save();
    }

    res.json({
      message: status === 'won' ? 'You won!' : status === 'lost' ? 'You lost' : 'Trade expired - amount refunded',
      trade: {
        _id: trade._id,
        status: trade.status,
        exitPrice: trade.exitPrice,
        profit: trade.profit,
        brokerageAmount: trade.brokerageAmount
      },
      newBalance: user?.gamesWallet.balance
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ==================== NIFTY JACKPOT GAME ====================

// Place a jackpot bid (one per day)
router.post('/nifty-jackpot/bid', protectUser, async (req, res) => {
  try {
    const { amount } = req.body;
    const userId = req.user._id;
    const today = getTodayIST();

    // Get game settings
    const settings = await GameSettings.getSettings();
    const gameConfig = settings.games?.niftyJackpot;
    if (!gameConfig?.enabled) {
      return res.status(400).json({ message: 'Nifty Jackpot game is currently disabled' });
    }

    // Validate amount
    const bidAmount = parseFloat(amount);
    if (isNaN(bidAmount) || bidAmount <= 0) {
      return res.status(400).json({ message: 'Invalid bid amount' });
    }
    if (bidAmount < (gameConfig.minBet || 100)) {
      return res.status(400).json({ message: `Minimum bid is ₹${gameConfig.minBet || 100}` });
    }
    if (bidAmount > (gameConfig.maxBet || 50000)) {
      return res.status(400).json({ message: `Maximum bid is ₹${gameConfig.maxBet || 50000}` });
    }

    // Check if user already placed a bid today
    const existingBid = await NiftyJackpotBid.findOne({ user: userId, betDate: today });
    if (existingBid) {
      return res.status(400).json({ message: 'You have already placed a bid today. Only 1 bid per day is allowed.' });
    }

    // Check balance
    const user = await User.findById(userId);
    if (!user || user.gamesWallet.balance < bidAmount) {
      return res.status(400).json({ message: 'Insufficient balance in games wallet' });
    }

    // Debit the bid amount
    user.gamesWallet.balance -= bidAmount;
    user.gamesWallet.usedMargin += bidAmount;
    await user.save();

    // Create the bid
    const bidData = {
      user: userId,
      amount: bidAmount,
      betDate: today,
      status: 'pending'
    };
    if (user.admin) bidData.admin = user.admin;
    const bid = await NiftyJackpotBid.create(bidData);

    res.json({
      message: 'Bid placed successfully!',
      bid: {
        _id: bid._id,
        amount: bid.amount,
        betDate: bid.betDate,
        status: bid.status
      },
      newBalance: user.gamesWallet.balance
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'You have already placed a bid today.' });
    }
    console.error('Nifty Jackpot bid error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get today's bid for current user
router.get('/nifty-jackpot/today', protectUser, async (req, res) => {
  try {
    const today = getTodayIST();
    const bid = await NiftyJackpotBid.findOne({ user: req.user._id, betDate: today });

    res.json({
      hasBid: !!bid,
      bid: bid ? {
        _id: bid._id,
        amount: bid.amount,
        betDate: bid.betDate,
        status: bid.status,
        rank: bid.rank,
        prize: bid.prize,
        resultDeclaredAt: bid.resultDeclaredAt
      } : null
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get live leaderboard for today (top bidders)
router.get('/nifty-jackpot/leaderboard', protectUser, async (req, res) => {
  try {
    const date = req.query.date || getTodayIST();

    const bids = await NiftyJackpotBid.find({ betDate: date })
      .sort({ amount: -1 })
      .populate('user', 'name username')
      .limit(50);

    const settings = await GameSettings.getSettings();
    const gameConfig = settings.games?.niftyJackpot;
    const topWinners = gameConfig?.topWinners || 20;
    const firstPrize = gameConfig?.firstPrize || 3000;
    const prizeStep = gameConfig?.prizeStep || 20;

    const leaderboard = bids.map((bid, idx) => {
      const rank = idx + 1;
      const prize = rank <= topWinners ? Math.max(0, firstPrize - (rank - 1) * prizeStep) : 0;
      return {
        rank,
        userId: bid.user?._id,
        name: bid.user?.name || bid.user?.username || 'Anonymous',
        amount: bid.amount,
        prize,
        isWinner: rank <= topWinners,
        status: bid.status
      };
    });

    // Find current user's position
    const myBid = await NiftyJackpotBid.findOne({ user: req.user._id, betDate: date });
    let myRank = null;
    if (myBid) {
      const higherBids = await NiftyJackpotBid.countDocuments({ betDate: date, amount: { $gt: myBid.amount } });
      myRank = higherBids + 1;
    }

    res.json({
      date,
      totalBids: bids.length,
      topWinners,
      firstPrize,
      prizeStep,
      leaderboard,
      myRank,
      myBid: myBid ? { amount: myBid.amount, status: myBid.status, rank: myBid.rank, prize: myBid.prize } : null
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get bid history for current user
router.get('/nifty-jackpot/history', protectUser, async (req, res) => {
  try {
    const bids = await NiftyJackpotBid.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(30);

    res.json(bids.map(b => ({
      _id: b._id,
      amount: b.amount,
      betDate: b.betDate,
      status: b.status,
      rank: b.rank,
      prize: b.prize,
      resultDeclaredAt: b.resultDeclaredAt
    })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
