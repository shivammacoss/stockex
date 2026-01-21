import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import User from '../models/User.js';
import Admin from '../models/Admin.js';
import BankAccount from '../models/BankAccount.js';
import FundRequest from '../models/FundRequest.js';
import WalletLedger from '../models/WalletLedger.js';
import jwt from 'jsonwebtoken';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer for payment proof uploads
const proofUploadDir = path.join(__dirname, '..', 'uploads', 'proofs');
if (!fs.existsSync(proofUploadDir)) {
  fs.mkdirSync(proofUploadDir, { recursive: true });
}

const proofStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, proofUploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'proof-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadProof = multer({
  storage: proofStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed'));
  }
});

const router = express.Router();

// Auth middleware
const protectUser = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Not authorized' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    
    if (!req.user) return res.status(401).json({ message: 'User not found' });
    if (!req.user.isActive) return res.status(401).json({ message: 'Account is deactivated' });
    
    next();
  } catch (error) {
    res.status(401).json({ message: 'Not authorized' });
  }
};

// Get admin's bank accounts (for deposit)
router.get('/admin-bank-accounts', protectUser, async (req, res) => {
  try {
    const accounts = await BankAccount.find({ 
      adminCode: req.user.adminCode,
      isActive: true 
    }).select('-admin');
    
    res.json(accounts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create fund request (deposit) with image upload
router.post('/fund-request/deposit', protectUser, uploadProof.single('proofImage'), async (req, res) => {
  try {
    const { amount, paymentMethod, bankAccountId, referenceId, remarks } = req.body;
    
    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ message: 'Invalid amount' });
    }
    
    // Verify bank account belongs to user's admin
    if (bankAccountId) {
      const bankAccount = await BankAccount.findOne({
        _id: bankAccountId,
        adminCode: req.user.adminCode
      });
      if (!bankAccount) {
        return res.status(400).json({ message: 'Invalid bank account' });
      }
    }
    
    // Get proof image URL if uploaded
    const proofUrl = req.file ? `/uploads/proofs/${req.file.filename}` : '';
    
    const request = await FundRequest.create({
      user: req.user._id,
      userId: req.user.userId,
      adminCode: req.user.adminCode,
      hierarchyPath: req.user.hierarchyPath || [],
      type: 'DEPOSIT',
      amount: parseFloat(amount),
      paymentMethod,
      bankAccount: bankAccountId || null,
      referenceId: referenceId || '',
      proofUrl: proofUrl,
      userRemarks: remarks || ''
    });
    
    res.status(201).json(request);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create fund request (withdrawal)
router.post('/fund-request/withdraw', protectUser, async (req, res) => {
  try {
    const { amount, paymentMethod, withdrawalDetails, remarks } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid amount' });
    }
    
    // Check user balance
    if (req.user.wallet.cashBalance < amount) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }
    
    // Get admin to check withdrawal limits
    const admin = await Admin.findOne({ adminCode: req.user.adminCode });
    if (admin) {
      if (amount < admin.charges.minWithdrawal) {
        return res.status(400).json({ 
          message: `Minimum withdrawal amount is ₹${admin.charges.minWithdrawal}` 
        });
      }
      if (amount > admin.charges.maxWithdrawal) {
        return res.status(400).json({ 
          message: `Maximum withdrawal amount is ₹${admin.charges.maxWithdrawal}` 
        });
      }
    }
    
    const request = await FundRequest.create({
      user: req.user._id,
      userId: req.user.userId,
      adminCode: req.user.adminCode,
      hierarchyPath: req.user.hierarchyPath || [],
      type: 'WITHDRAWAL',
      amount,
      paymentMethod,
      userRemarks: remarks || '',
      withdrawalDetails: withdrawalDetails || {}
    });
    
    res.status(201).json(request);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get my fund requests
router.get('/fund-requests', protectUser, async (req, res) => {
  try {
    const { status, type } = req.query;
    const query = { user: req.user._id };
    
    if (status) query.status = status;
    if (type) query.type = type;
    
    const requests = await FundRequest.find(query)
      .populate('bankAccount', 'type bankName upiId')
      .sort({ createdAt: -1 });
    
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Cancel fund request
router.post('/fund-requests/:id/cancel', protectUser, async (req, res) => {
  try {
    const request = await FundRequest.findOne({
      _id: req.params.id,
      user: req.user._id,
      status: 'PENDING'
    });
    
    if (!request) {
      return res.status(404).json({ message: 'Fund request not found or cannot be cancelled' });
    }
    
    request.status = 'CANCELLED';
    await request.save();
    
    res.json({ message: 'Fund request cancelled', request });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get my wallet ledger
router.get('/ledger', protectUser, async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    
    const ledger = await WalletLedger.find({
      ownerType: 'USER',
      ownerId: req.user._id
    }).sort({ createdAt: -1 }).limit(parseInt(limit));
    
    res.json(ledger);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get my admin info (limited)
router.get('/my-admin', protectUser, async (req, res) => {
  try {
    const admin = await Admin.findOne({ adminCode: req.user.adminCode })
      .select('name adminCode charges.minWithdrawal charges.maxWithdrawal charges.withdrawalFee');
    
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    
    res.json(admin);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Internal transfer between main wallet and trading account
router.post('/internal-transfer', protectUser, async (req, res) => {
  try {
    const { amount, direction } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid amount' });
    }
    
    if (!['toAccount', 'toWallet'].includes(direction)) {
      return res.status(400).json({ message: 'Invalid transfer direction' });
    }
    
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Dual wallet system - handle legacy balance field
    // If cashBalance is 0 but balance has value, use balance as the source
    let mainWalletBalance = user.wallet?.cashBalance || 0;
    if (mainWalletBalance === 0 && user.wallet?.balance > 0) {
      // Migrate legacy balance to cashBalance
      mainWalletBalance = user.wallet.balance;
      user.wallet.cashBalance = mainWalletBalance;
    }
    const tradingBalance = user.wallet?.tradingBalance || 0;
    const usedMargin = user.wallet?.usedMargin || 0;
    const availableTradingBalance = tradingBalance - usedMargin;
    
    let newCashBalance, newTradingBalance;
    
    if (direction === 'toAccount') {
      // Transfer from Main Wallet to Trading Account
      if (amount > mainWalletBalance) {
        return res.status(400).json({ message: `Insufficient balance in Main Wallet. Available: ₹${mainWalletBalance}` });
      }
      
      newCashBalance = mainWalletBalance - amount;
      newTradingBalance = tradingBalance + amount;
      
    } else {
      // Transfer from Trading Account to Main Wallet
      // Block withdrawal if any margin is in use (open positions)
      if (usedMargin > 0) {
        return res.status(400).json({ 
          message: `Cannot withdraw while margin is in use. Close all positions first. Used margin: ₹${usedMargin.toLocaleString()}` 
        });
      }
      
      if (amount > tradingBalance) {
        return res.status(400).json({ message: `Insufficient balance in Trading Account. Available: ₹${tradingBalance.toLocaleString()}` });
      }
      
      newTradingBalance = tradingBalance - amount;
      newCashBalance = mainWalletBalance + amount;
    }
    
    // Use updateOne to avoid full document validation issues with segmentPermissions
    await User.updateOne(
      { _id: req.user._id },
      { 
        $set: { 
          'wallet.cashBalance': newCashBalance,
          'wallet.tradingBalance': newTradingBalance,
          'wallet.balance': newCashBalance // Legacy field
        }
      }
    );
    
    // Update local user object for response
    user.wallet.cashBalance = newCashBalance;
    user.wallet.tradingBalance = newTradingBalance;
    
    // Create ledger entry for the transfer
    const description = direction === 'toAccount' 
      ? 'Internal Transfer: Wallet → Trading Account'
      : 'Internal Transfer: Trading Account → Wallet';
    
    await WalletLedger.create({
      ownerType: 'USER',
      ownerId: user._id,
      adminCode: user.adminCode,
      type: direction === 'toAccount' ? 'DEBIT' : 'CREDIT',
      reason: 'ADJUSTMENT',
      amount: amount,
      balanceAfter: user.wallet.cashBalance,
      description,
      reference: {
        type: 'Manual',
        id: null
      }
    });
    
    res.json({ 
      message: 'Transfer successful',
      mainWalletBalance: user.wallet.cashBalance,
      tradingBalance: user.wallet.tradingBalance
    });
  } catch (error) {
    console.error('Internal transfer error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Crypto transfer between main wallet and crypto account
router.post('/crypto-transfer', protectUser, async (req, res) => {
  try {
    const { amount, direction } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid amount' });
    }
    
    if (!['toCrypto', 'fromCrypto'].includes(direction)) {
      return res.status(400).json({ message: 'Invalid transfer direction' });
    }
    
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // USD to INR conversion rate
    const usdRate = 83.50;
    
    // Get current balances
    let mainWalletBalance = user.wallet?.cashBalance || 0;
    if (mainWalletBalance === 0 && user.wallet?.balance > 0) {
      mainWalletBalance = user.wallet.balance;
      user.wallet.cashBalance = mainWalletBalance;
    }
    const cryptoBalance = user.cryptoWallet?.balance || 0;
    
    let newCashBalance, newCryptoBalance, convertedAmount;
    
    if (direction === 'toCrypto') {
      // Transfer from Main Wallet (INR) to Crypto Account (USD)
      if (amount > mainWalletBalance) {
        return res.status(400).json({ message: `Insufficient balance in Main Wallet. Available: ₹${mainWalletBalance}` });
      }
      
      // Convert INR to USD
      convertedAmount = amount / usdRate;
      newCashBalance = mainWalletBalance - amount;
      newCryptoBalance = cryptoBalance + convertedAmount;
      
    } else {
      // Transfer from Crypto Account (USD) to Main Wallet (INR)
      if (amount > cryptoBalance) {
        return res.status(400).json({ message: `Insufficient balance in Crypto Account. Available: $${cryptoBalance.toFixed(2)}` });
      }
      
      // Convert USD to INR
      convertedAmount = amount * usdRate;
      newCryptoBalance = cryptoBalance - amount;
      newCashBalance = mainWalletBalance + convertedAmount;
    }
    
    // Use updateOne to avoid full document validation issues
    await User.updateOne(
      { _id: req.user._id },
      { 
        $set: { 
          'wallet.cashBalance': newCashBalance,
          'wallet.balance': newCashBalance,
          'cryptoWallet.balance': newCryptoBalance
        }
      }
    );
    
    // Create ledger entry for the transfer
    const description = direction === 'toCrypto' 
      ? `Crypto Transfer: ₹${amount.toLocaleString()} → $${convertedAmount.toFixed(2)} USDT`
      : `Crypto Transfer: $${amount.toFixed(2)} USDT → ₹${convertedAmount.toLocaleString()}`;
    
    await WalletLedger.create({
      ownerType: 'USER',
      ownerId: user._id,
      adminCode: user.adminCode,
      type: direction === 'toCrypto' ? 'DEBIT' : 'CREDIT',
      reason: 'CRYPTO_TRANSFER',
      amount: direction === 'toCrypto' ? amount : convertedAmount,
      balanceAfter: newCashBalance,
      description,
      reference: {
        type: 'Manual',
        id: null
      }
    });
    
    res.json({ 
      message: 'Transfer successful',
      mainWalletBalance: newCashBalance,
      cryptoBalance: newCryptoBalance,
      convertedAmount: direction === 'toCrypto' ? convertedAmount : convertedAmount,
      rate: usdRate
    });
  } catch (error) {
    console.error('Crypto transfer error:', error);
    res.status(500).json({ message: error.message });
  }
});

// MCX transfer between main wallet and MCX account
router.post('/mcx-transfer', protectUser, async (req, res) => {
  try {
    const { amount, direction } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid amount' });
    }
    
    if (!['toMcx', 'fromMcx'].includes(direction)) {
      return res.status(400).json({ message: 'Invalid transfer direction' });
    }
    
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Get current balances
    let mainWalletBalance = user.wallet?.cashBalance || 0;
    if (mainWalletBalance === 0 && user.wallet?.balance > 0) {
      mainWalletBalance = user.wallet.balance;
      user.wallet.cashBalance = mainWalletBalance;
    }
    const mcxBalance = user.mcxWallet?.balance || 0;
    const mcxUsedMargin = user.mcxWallet?.usedMargin || 0;
    
    let newCashBalance, newMcxBalance;
    
    if (direction === 'toMcx') {
      // Transfer from Main Wallet to MCX Account
      if (amount > mainWalletBalance) {
        return res.status(400).json({ message: `Insufficient balance in Main Wallet. Available: ₹${mainWalletBalance.toLocaleString()}` });
      }
      
      newCashBalance = mainWalletBalance - amount;
      newMcxBalance = mcxBalance + amount;
      
    } else {
      // Transfer from MCX Account to Main Wallet
      // Block withdrawal if any margin is in use (open positions)
      if (mcxUsedMargin > 0) {
        return res.status(400).json({ 
          message: `Cannot withdraw while margin is in use. Close all MCX positions first. Used margin: ₹${mcxUsedMargin.toLocaleString()}` 
        });
      }
      
      if (amount > mcxBalance) {
        return res.status(400).json({ message: `Insufficient balance in MCX Account. Available: ₹${mcxBalance.toLocaleString()}` });
      }
      
      newMcxBalance = mcxBalance - amount;
      newCashBalance = mainWalletBalance + amount;
    }
    
    // Use updateOne to avoid full document validation issues
    await User.updateOne(
      { _id: req.user._id },
      { 
        $set: { 
          'wallet.cashBalance': newCashBalance,
          'wallet.balance': newCashBalance,
          'mcxWallet.balance': newMcxBalance
        }
      }
    );
    
    // Create ledger entry for the transfer
    const description = direction === 'toMcx' 
      ? `MCX Transfer: Wallet → MCX Account (₹${amount.toLocaleString()})`
      : `MCX Transfer: MCX Account → Wallet (₹${amount.toLocaleString()})`;
    
    await WalletLedger.create({
      ownerType: 'USER',
      ownerId: user._id,
      adminCode: user.adminCode,
      type: direction === 'toMcx' ? 'DEBIT' : 'CREDIT',
      reason: 'MCX_TRANSFER',
      amount: amount,
      balanceAfter: newCashBalance,
      description,
      reference: {
        type: 'Manual',
        id: null
      }
    });
    
    res.json({ 
      message: 'Transfer successful',
      mainWalletBalance: newCashBalance,
      mcxBalance: newMcxBalance
    });
  } catch (error) {
    console.error('MCX transfer error:', error);
    res.status(500).json({ message: error.message });
  }
});

export default router;
