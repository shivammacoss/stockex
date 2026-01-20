import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { Server } from 'socket.io';
import connectDB from './config/db.js';
import adminRoutes from './routes/adminRoutes.js';
import userRoutes from './routes/userRoutes.js';
import tradingRoutes from './routes/tradingRoutes.js';
import adminManagementRoutes from './routes/adminManagementRoutes.js';
import userFundRoutes from './routes/userFundRoutes.js';
import tradeRoutes, { setTradeSocketIO } from './routes/tradeRoutes.js';
import instrumentRoutes from './routes/instrumentRoutes.js';
import binanceRoutes from './routes/binanceRoutes.js';
import zerodhaRoutes, { setSocketIO } from './routes/zerodhaRoutes.js';
import { initZerodhaWebSocket } from './services/zerodhaWebSocket.js';
import { initBinanceWebSocket } from './services/binanceWebSocket.js';
import uploadRoutes from './routes/uploadRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import exchangeRateRoutes from './routes/exchangeRateRoutes.js';
import User from './models/User.js';
import Trade from './models/Trade.js';
import MarketState from './models/MarketState.js';
import TradingService from './services/tradingService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const httpServer = createServer(app);

// Initialize Socket.IO with production CORS
const allowedOrigins = process.env.NODE_ENV === 'production' 
  ? ['https://stockex.com', 'https://www.stockex.com']
  : ['http://localhost:3000', 'http://127.0.0.1:3000'];

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Initialize Zerodha WebSocket service with Socket.IO
initZerodhaWebSocket(io);
setSocketIO(io);
setTradeSocketIO(io);

// Initialize Binance WebSocket for real-time crypto data
initBinanceWebSocket(io);

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Connect to MongoDB
connectDB();

// Middleware - CORS for production
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
// Bump body limits to handle larger admin create-user payloads
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ limit: '25mb', extended: true }));

// Routes
app.use('/api/admin', adminRoutes);
app.use('/api/admin/manage', adminManagementRoutes);
app.use('/api/user', userRoutes);
app.use('/api/user/funds', userFundRoutes);
app.use('/api/trading', tradingRoutes);
app.use('/api/trade', tradeRoutes);
app.use('/api/instruments', instrumentRoutes);
app.use('/api/binance', binanceRoutes);
app.use('/api/zerodha', zerodhaRoutes);
app.use('/auth/zerodha', zerodhaRoutes); // Alias for Kite Connect redirect URL
app.use('/api/upload', uploadRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/exchange-rate', exchangeRateRoutes);

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check
app.get('/api/health', (req, res) => {
  const stateMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };

  const dbState = mongoose.connection.readyState;

  res.json({ 
    status: 'ok', 
    message: 'NTrader API is running',
    database: {
      connected: dbState === 1,
      state: stateMap[dbState] || 'unknown',
      host: mongoose.connection.host || null,
      name: mongoose.connection.name || null
    }
  });
});

const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Auto square-off intraday (MIS) positions at market close
const runIntradayAutoSquareOff = async () => {
  try {
    const now = new Date();
    const istTime = now.toLocaleTimeString('en-IN', { 
      timeZone: 'Asia/Kolkata', 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
    
    // Get market state to check square-off times
    const marketState = await MarketState.getState();
    
    const segments = ['EQUITY', 'FNO', 'MCX'];
    
    for (const segment of segments) {
      const segmentState = marketState.segments[segment];
      if (!segmentState || !segmentState.isOpen) continue;
      
      const squareOffTime = segmentState.intradaySquareOffTime || '15:15';
      
      // Check if current time matches square-off time (within 1 minute window)
      if (istTime === squareOffTime || istTime === squareOffTime.replace(':', '')) {
        console.log(`Running intraday square-off for ${segment} at ${istTime}`);
        
        // Find all open MIS trades for this segment
        const openMISTrades = await Trade.find({
          status: 'OPEN',
          productType: 'MIS',
          $or: [
            { segment: segment },
            { segment: segment === 'FNO' ? { $in: ['NSEFUT', 'NSEOPT', 'NFO'] } : segment },
            { segment: segment === 'EQUITY' ? { $in: ['NSE-EQ', 'EQUITY', 'NSE'] } : segment }
          ]
        }).populate('user');
        
        let closedCount = 0;
        for (const trade of openMISTrades) {
          try {
            const exitPrice = trade.currentPrice || trade.entryPrice;
            await TradingService.squareOffPosition(trade._id, 'INTRADAY_SQUAREOFF', exitPrice);
            closedCount++;
            console.log(`Auto squared-off: ${trade.symbol} for user ${trade.user?.userId || trade.user}`);
          } catch (err) {
            console.error(`Error squaring off trade ${trade._id}:`, err.message);
          }
        }
        
        if (closedCount > 0) {
          console.log(`Intraday square-off completed for ${segment}: ${closedCount} trades closed`);
        }
      }
    }
  } catch (error) {
    console.error('Error in intraday auto square-off:', error);
  }
};

// Run intraday square-off check every minute
setInterval(runIntradayAutoSquareOff, 60 * 1000);

// Cleanup expired demo accounts - runs every hour
const cleanupExpiredDemoAccounts = async () => {
  try {
    const now = new Date();
    const expiredUsers = await User.find({
      isDemo: true,
      demoExpiresAt: { $lt: now }
    });
    
    if (expiredUsers.length > 0) {
      // Import models for cleanup
      const Position = (await import('./models/Position.js')).default;
      const Order = (await import('./models/Order.js')).default;
      const Trade = (await import('./models/Trade.js')).default;
      
      for (const user of expiredUsers) {
        // Delete user's trading data
        await Position.deleteMany({ user: user._id });
        await Order.deleteMany({ user: user._id });
        await Trade.deleteMany({ user: user._id });
        
        // Delete the user
        await User.deleteOne({ _id: user._id });
        console.log(`Deleted expired demo account: ${user.username} (${user.email})`);
      }
      
      console.log(`Cleaned up ${expiredUsers.length} expired demo accounts`);
    }
  } catch (error) {
    console.error('Error cleaning up expired demo accounts:', error);
  }
};

// Run cleanup on startup and then every hour
cleanupExpiredDemoAccounts();
setInterval(cleanupExpiredDemoAccounts, 60 * 60 * 1000); // Every hour
