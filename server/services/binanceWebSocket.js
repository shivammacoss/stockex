import WebSocket from 'ws';

let io = null;
let ws = null;
let cryptoData = {};
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;

// Crypto symbols to track
const CRYPTO_SYMBOLS = [
  'btcusdt', 'ethusdt', 'bnbusdt', 'xrpusdt', 'adausdt',
  'dogeusdt', 'solusdt', 'dotusdt', 'maticusdt', 'ltcusdt',
  'avaxusdt', 'linkusdt', 'atomusdt', 'uniusdt', 'xlmusdt'
];

// Initialize Binance WebSocket with Socket.IO instance
export const initBinanceWebSocket = (socketIO) => {
  io = socketIO;
  console.log('Binance WebSocket service initialized');
  connectWebSocket();
};

// Connect to Binance WebSocket
const connectWebSocket = () => {
  // Create stream URL for all symbols
  const streams = CRYPTO_SYMBOLS.map(s => `${s}@ticker`).join('/');
  const wsUrl = `wss://stream.binance.com:9443/stream?streams=${streams}`;
  
  console.log('Connecting to Binance WebSocket...');
  
  ws = new WebSocket(wsUrl);
  
  ws.on('open', () => {
    console.log('Binance WebSocket connected');
    reconnectAttempts = 0;
  });
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      if (message.data) {
        const ticker = message.data;
        const symbol = ticker.s.replace('USDT', '');
        const pair = ticker.s;
        
        const tickData = {
          symbol: symbol,
          pair: pair,
          exchange: 'BINANCE',
          token: pair,
          ltp: parseFloat(ticker.c),
          open: parseFloat(ticker.o),
          high: parseFloat(ticker.h),
          low: parseFloat(ticker.l),
          close: parseFloat(ticker.c),
          change: parseFloat(ticker.p),
          changePercent: parseFloat(ticker.P).toFixed(2),
          volume: parseFloat(ticker.v),
          quoteVolume: parseFloat(ticker.q),
          bid: parseFloat(ticker.b),
          ask: parseFloat(ticker.a),
          lastUpdated: new Date()
        };
        
        // Store in local cache
        cryptoData[pair] = tickData;
        cryptoData[symbol] = tickData;
        
        // Emit to all connected clients via Socket.IO
        if (io) {
          io.emit('crypto_tick', { [pair]: tickData, [symbol]: tickData });
          // Also emit as market_tick for compatibility
          io.emit('market_tick', { [pair]: tickData, [symbol]: tickData });
        }
      }
    } catch (error) {
      console.error('Error parsing Binance message:', error.message);
    }
  });
  
  ws.on('error', (error) => {
    console.error('Binance WebSocket error:', error.message);
  });
  
  ws.on('close', () => {
    console.log('Binance WebSocket disconnected');
    
    // Attempt reconnection
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
      console.log(`Reconnecting to Binance in ${delay/1000}s (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
      setTimeout(connectWebSocket, delay);
    } else {
      console.error('Max reconnection attempts reached for Binance WebSocket');
    }
  });
};

// Get current crypto data
export const getCryptoData = () => cryptoData;

// Get specific crypto price
export const getCryptoPrice = (symbol) => {
  const pair = symbol.toUpperCase().includes('USDT') ? symbol.toUpperCase() : `${symbol.toUpperCase()}USDT`;
  return cryptoData[pair] || cryptoData[symbol.toUpperCase()] || null;
};

// Check if WebSocket is connected
export const isConnected = () => ws && ws.readyState === WebSocket.OPEN;

export default {
  initBinanceWebSocket,
  getCryptoData,
  getCryptoPrice,
  isConnected
};
