import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { io as socketIO } from 'socket.io-client';
import { createChart, ColorType } from 'lightweight-charts';
import { 
  ArrowLeft, TrendingUp, TrendingDown, Hash, Trophy, Target, 
  Clock, Users, Coins, Gamepad2, Zap, Star, Gift, ChevronRight,
  ArrowUpCircle, ArrowDownCircle, RefreshCw, X, Check, AlertCircle, Bitcoin,
  Info, Lock, Timer, BookOpen, Award, Crown, Medal
} from 'lucide-react';

// Map frontend game IDs to backend GameSettings keys
const GAME_SETTINGS_KEY = {
  'updown': 'niftyUpDown',
  'btcupdown': 'btcUpDown',
  'niftynumber': 'niftyNumber',
  'niftybracket': 'niftyBracket',
  'niftyjackpot': 'niftyJackpot',
};

const UserGames = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [gamesBalance, setGamesBalance] = useState(0);
  const [activeGame, setActiveGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [gameSettings, setGameSettings] = useState(null);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    } else {
      navigate('/user/login');
    }
  }, [navigate]);

  useEffect(() => {
    if (user) {
      fetchGamesBalance();
      fetchGameSettings();
    }
  }, [user]);

  const fetchGamesBalance = async () => {
    try {
      const { data } = await axios.get('/api/user/wallet', {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      setGamesBalance(data?.gamesWallet?.balance || 0);
    } catch (error) {
      console.error('Error fetching games balance:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchGameSettings = async () => {
    try {
      const { data } = await axios.get('/api/user/game-settings', {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      setGameSettings(data);
    } catch (error) {
      console.error('Error fetching game settings:', error);
    }
  };

  const games = [
    {
      id: 'updown',
      name: 'Nifty Up/Down',
      description: 'Predict if Nifty will go UP or DOWN in the next minute',
      icon: TrendingUp,
      color: 'from-green-600 to-emerald-600',
      bgColor: 'bg-green-900/20',
      borderColor: 'border-green-500/30',
      prize: '2x Returns',
      players: '1.2K',
      timeframe: '1 Min'
    },
    {
      id: 'btcupdown',
      name: 'BTC Up/Down',
      description: 'Predict if Bitcoin will go UP or DOWN in the next minute',
      icon: Bitcoin,
      color: 'from-orange-500 to-amber-500',
      bgColor: 'bg-orange-900/20',
      borderColor: 'border-orange-500/30',
      prize: '2x Returns',
      players: '3.1K',
      timeframe: '1 Min'
    },
    {
      id: 'niftynumber',
      name: 'Nifty Number',
      description: 'Pick the decimal (.00-.99) of Nifty closing price & win tickets',
      icon: Hash,
      color: 'from-purple-600 to-indigo-600',
      bgColor: 'bg-purple-900/20',
      borderColor: 'border-purple-500/30',
      prize: 'Ticket Profit',
      players: '850',
      timeframe: '1 Day'
    },
    {
      id: 'niftybracket',
      name: 'Nifty Bracket',
      description: 'Buy or Sell on bracket levels around Nifty price',
      icon: Target,
      color: 'from-cyan-500 to-teal-500',
      bgColor: 'bg-cyan-900/20',
      borderColor: 'border-cyan-500/30',
      prize: '2x Returns',
      players: '1.2K',
      timeframe: '5 Min'
    },
    {
      id: 'niftyjackpot',
      name: 'Nifty Jackpot',
      description: 'Bid high & rank in top 20 to win big prizes!',
      icon: Trophy,
      color: 'from-yellow-500 to-orange-500',
      bgColor: 'bg-yellow-900/20',
      borderColor: 'border-yellow-500/30',
      prize: 'Top Prizes',
      players: '2.5K',
      timeframe: '1 Day'
    }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <RefreshCw className="animate-spin text-purple-500" size={32} />
      </div>
    );
  }

  // Show game screen if a game is selected
  if (activeGame) {
    if (activeGame === 'niftynumber') {
      return (
        <NiftyNumberScreen
          game={games.find(g => g.id === activeGame)}
          balance={gamesBalance}
          onBack={() => setActiveGame(null)}
          user={user}
          refreshBalance={fetchGamesBalance}
          settings={gameSettings?.games?.[GAME_SETTINGS_KEY[activeGame]] || null}
          tokenValue={gameSettings?.tokenValue || 300}
        />
      );
    }
    if (activeGame === 'niftybracket') {
      return (
        <NiftyBracketScreen
          game={games.find(g => g.id === activeGame)}
          balance={gamesBalance}
          onBack={() => setActiveGame(null)}
          user={user}
          refreshBalance={fetchGamesBalance}
          settings={gameSettings?.games?.[GAME_SETTINGS_KEY[activeGame]] || null}
          tokenValue={gameSettings?.tokenValue || 300}
        />
      );
    }
    if (activeGame === 'niftyjackpot') {
      return (
        <NiftyJackpotScreen
          game={games.find(g => g.id === activeGame)}
          balance={gamesBalance}
          onBack={() => setActiveGame(null)}
          user={user}
          refreshBalance={fetchGamesBalance}
          settings={gameSettings?.games?.[GAME_SETTINGS_KEY[activeGame]] || null}
          tokenValue={gameSettings?.tokenValue || 300}
        />
      );
    }
    return (
      <GameScreen 
        game={games.find(g => g.id === activeGame)} 
        balance={gamesBalance}
        onBack={() => setActiveGame(null)}
        user={user}
        refreshBalance={fetchGamesBalance}
        settings={gameSettings?.games?.[GAME_SETTINGS_KEY[activeGame]] || null}
        tokenValue={gameSettings?.tokenValue || 300}
      />
    );
  }

  return (
    <div className="min-h-screen bg-dark-900 text-white">
      {/* Header */}
      <div className="bg-dark-800 border-b border-dark-600 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => navigate('/user/accounts')}
                className="p-2 hover:bg-dark-700 rounded-lg transition"
              >
                <ArrowLeft size={20} />
              </button>
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center">
                  <Gamepad2 size={20} />
                </div>
                <div>
                  <h1 className="font-bold text-lg">Fantasy Games</h1>
                  <p className="text-xs text-gray-400">Predict & Win</p>
                </div>
              </div>
            </div>
            <div className="bg-dark-700 rounded-lg px-4 py-2">
              <div className="text-xs text-gray-400">Balance</div>
              <div className="font-bold text-purple-400">{(gamesBalance / (gameSettings?.tokenValue || 300)).toFixed(2)} Tickets</div>
              <div className="text-[10px] text-gray-500">₹{gamesBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Live Nifty Banner */}
      <div className="bg-gradient-to-r from-purple-900/50 to-pink-900/50 border-b border-purple-500/20">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-gray-300">NIFTY 50</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xl font-bold">24,850.75</span>
              <span className="text-green-400 text-sm flex items-center gap-1">
                <TrendingUp size={14} />
                +125.50 (0.51%)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Games Grid */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-2">Choose Your Game</h2>
          <p className="text-gray-400 text-sm">Play prediction games and win exciting prizes</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {games.map(game => (
            <div 
              key={game.id}
              onClick={() => setActiveGame(game.id)}
              className={`${game.bgColor} ${game.borderColor} border rounded-2xl p-5 cursor-pointer hover:scale-[1.02] transition-all duration-200 group`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${game.color} flex items-center justify-center shadow-lg`}>
                  <game.icon size={28} className="text-white" />
                </div>
                <div className="flex items-center gap-1 bg-dark-800/50 px-2 py-1 rounded-full">
                  <Zap size={12} className="text-yellow-400" />
                  <span className="text-xs font-medium">{game.prize}</span>
                </div>
              </div>

              <h3 className="text-lg font-bold mb-1">{game.name}</h3>
              <p className="text-sm text-gray-400 mb-4">{game.description}</p>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Users size={12} />
                    {game.players} playing
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {game.timeframe}
                  </span>
                </div>
                <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${game.color} flex items-center justify-center group-hover:scale-110 transition`}>
                  <ChevronRight size={16} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* How to Play */}
        <div className="mt-8 bg-dark-800 rounded-2xl p-5">
          <h3 className="font-bold mb-4 flex items-center gap-2">
            <Gift className="text-purple-400" size={20} />
            How to Play
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-purple-600/20 flex items-center justify-center text-purple-400 font-bold flex-shrink-0">1</div>
              <div>
                <div className="font-medium mb-1">Choose Amount</div>
                <div className="text-gray-400">Select your bet amount from your games wallet</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-purple-600/20 flex items-center justify-center text-purple-400 font-bold flex-shrink-0">2</div>
              <div>
                <div className="font-medium mb-1">Make Prediction</div>
                <div className="text-gray-400">Predict the market movement or number</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-purple-600/20 flex items-center justify-center text-purple-400 font-bold flex-shrink-0">3</div>
              <div>
                <div className="font-medium mb-1">Win Rewards</div>
                <div className="text-gray-400">Get multiplied returns on correct predictions</div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Winners */}
        <div className="mt-6 bg-dark-800 rounded-2xl p-5">
          <h3 className="font-bold mb-4 flex items-center gap-2">
            <Star className="text-yellow-400" size={20} />
            Recent Winners
          </h3>
          <div className="space-y-3">
            {[
              { name: 'Ra***sh', game: 'Nifty Up/Down', amount: 5000, time: '2 min ago' },
              { name: 'Pr***ya', game: 'BTC Up/Down', amount: 25000, time: '5 min ago' },
              { name: 'Am***an', game: 'Nifty Up/Down', amount: 8500, time: '8 min ago' },
            ].map((winner, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-dark-700 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center">
                    <Trophy size={14} />
                  </div>
                  <div>
                    <div className="font-medium">{winner.name}</div>
                    <div className="text-xs text-gray-400">{winner.game}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-green-400 font-bold">+₹{winner.amount.toLocaleString()}</div>
                  <div className="text-xs text-gray-500">{winner.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ==================== TRADING WINDOW LOGIC ====================
// Trading windows: 9:15:15-9:29:59, 9:30:15-9:44:59, 9:45:15-9:59:59, ...
// Results come 15 minutes after the window closes
// Market hours: 9:15 AM to 3:30 PM IST

const MARKET_OPEN_HOUR = 9;
const MARKET_OPEN_MIN = 15;
const MARKET_CLOSE_HOUR = 15;
const MARKET_CLOSE_MIN = 30;
const WINDOW_DURATION_MIN = 15; // 15-minute trading windows
const WINDOW_OFFSET_SEC = 15;   // Windows start at :15 seconds

const getISTNow = () => {
  const now = new Date();
  // Convert to IST (UTC+5:30)
  const istOffset = 5.5 * 60 * 60 * 1000;
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + istOffset);
};

const getTotalSeconds = (date) => {
  return date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds();
};

const formatTime = (hours, minutes, seconds) => {
  const h = hours > 12 ? hours - 12 : hours;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  return `${h}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} ${ampm}`;
};

const formatCountdown = (totalSec) => {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const getTradingWindowInfo = () => {
  const now = getISTNow();
  const currentSec = getTotalSeconds(now);
  
  const marketOpenSec = MARKET_OPEN_HOUR * 3600 + MARKET_OPEN_MIN * 60;
  const marketCloseSec = MARKET_CLOSE_HOUR * 3600 + MARKET_CLOSE_MIN * 60;
  
  // Before market hours
  if (currentSec < marketOpenSec + WINDOW_OFFSET_SEC) {
    const firstWindowStart = marketOpenSec + WINDOW_OFFSET_SEC;
    return {
      status: 'pre_market',
      message: 'Market not yet open',
      nextWindowStart: formatTime(MARKET_OPEN_HOUR, MARKET_OPEN_MIN, WINDOW_OFFSET_SEC),
      countdown: firstWindowStart - currentSec,
      windowNumber: 0,
      canTrade: false
    };
  }
  
  // After market hours
  if (currentSec >= marketCloseSec) {
    return {
      status: 'post_market',
      message: 'Market closed for today',
      nextWindowStart: 'Tomorrow 9:15:15 AM',
      countdown: 0,
      windowNumber: 0,
      canTrade: false
    };
  }
  
  // During market hours - calculate which window we're in
  const secSinceMarketOpen = currentSec - marketOpenSec;
  const windowDurationSec = WINDOW_DURATION_MIN * 60;
  
  // Each cycle: 15 sec gap + 14 min 45 sec trading = 15 min total
  // Window N starts at: marketOpen + N*15min + 15sec
  // Window N ends at:   marketOpen + (N+1)*15min - 1sec
  // Result for Window N: marketOpen + (N+1)*15min + 15min = marketOpen + (N+2)*15min
  
  const windowIndex = Math.floor(secSinceMarketOpen / windowDurationSec);
  const windowStartSec = marketOpenSec + windowIndex * windowDurationSec + WINDOW_OFFSET_SEC;
  const windowEndSec = marketOpenSec + (windowIndex + 1) * windowDurationSec - 1;
  const resultTimeSec = marketOpenSec + (windowIndex + 1) * windowDurationSec + WINDOW_DURATION_MIN * 60;
  const nextWindowStartSec = marketOpenSec + (windowIndex + 1) * windowDurationSec + WINDOW_OFFSET_SEC;
  
  const windowStartH = Math.floor(windowStartSec / 3600);
  const windowStartM = Math.floor((windowStartSec % 3600) / 60);
  const windowStartS = windowStartSec % 60;
  
  const windowEndH = Math.floor(windowEndSec / 3600);
  const windowEndM = Math.floor((windowEndSec % 3600) / 60);
  const windowEndS = windowEndSec % 60;
  
  const resultH = Math.floor(resultTimeSec / 3600);
  const resultM = Math.floor((resultTimeSec % 3600) / 60);
  const resultS = resultTimeSec % 60;
  
  // Check if we're in the trading window (between :15 and :59 of the 15-min block)
  if (currentSec >= windowStartSec && currentSec <= windowEndSec) {
    return {
      status: 'open',
      message: 'Trading Window Open',
      windowStart: formatTime(windowStartH, windowStartM, windowStartS),
      windowEnd: formatTime(windowEndH, windowEndM, windowEndS),
      resultTime: formatTime(resultH, resultM, resultS),
      countdown: windowEndSec - currentSec,
      windowNumber: windowIndex + 1,
      canTrade: true
    };
  }
  
  // We're in the 15-second gap between windows
  if (currentSec > windowEndSec && currentSec < nextWindowStartSec) {
    const nextH = Math.floor(nextWindowStartSec / 3600);
    const nextM = Math.floor((nextWindowStartSec % 3600) / 60);
    const nextS = nextWindowStartSec % 60;
    return {
      status: 'gap',
      message: 'Next window opening soon...',
      nextWindowStart: formatTime(nextH, nextM, nextS),
      countdown: nextWindowStartSec - currentSec,
      windowNumber: windowIndex + 1,
      canTrade: false
    };
  }
  
  return {
    status: 'unknown',
    message: 'Calculating...',
    countdown: 0,
    windowNumber: 0,
    canTrade: false
  };
};

// Instructions Modal Component
const InstructionsModal = ({ onClose, gameId }) => {
  const isNifty = gameId === 'updown';
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-dark-800 rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-dark-800 p-5 pb-3 border-b border-dark-600 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <BookOpen size={20} className="text-purple-400" />
            How to Play
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-dark-700 rounded-lg transition">
            <X size={18} />
          </button>
        </div>
        
        <div className="p-5 space-y-5">
          {/* Trading Window Schedule */}
          <div>
            <h3 className="font-bold text-green-400 mb-2 flex items-center gap-2">
              <Clock size={16} />
              Trading Window Schedule
            </h3>
            <div className="bg-dark-700 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Market Hours</span>
                <span className="font-medium">9:15 AM - 3:30 PM IST</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Window Duration</span>
                <span className="font-medium">~15 Minutes</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Result After</span>
                <span className="font-medium">15 Minutes from window close</span>
              </div>
            </div>
          </div>

          {/* Window Examples */}
          <div>
            <h3 className="font-bold text-blue-400 mb-2 flex items-center gap-2">
              <Timer size={16} />
              Window Examples
            </h3>
            <div className="space-y-2 text-sm">
              {[
                { window: '1st', open: '9:15:15 AM', close: '9:29:59 AM', result: '9:45 AM' },
                { window: '2nd', open: '9:30:15 AM', close: '9:44:59 AM', result: '10:00 AM' },
                { window: '3rd', open: '9:45:15 AM', close: '9:59:59 AM', result: '10:15 AM' },
                { window: '4th', open: '10:00:15 AM', close: '10:14:59 AM', result: '10:30 AM' },
              ].map((w, i) => (
                <div key={i} className="bg-dark-700 rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <span className="text-purple-400 font-medium">{w.window} Trade</span>
                    <div className="text-gray-400 text-xs mt-0.5">{w.open} → {w.close}</div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-gray-400">Result at</span>
                    <div className="text-yellow-400 font-medium">{w.result}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Rules */}
          <div>
            <h3 className="font-bold text-yellow-400 mb-2 flex items-center gap-2">
              <AlertCircle size={16} />
              Rules
            </h3>
            <ul className="space-y-2 text-sm text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-0.5">1.</span>
                <span>You can only place trades during an <strong className="text-white">open trading window</strong>.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-0.5">2.</span>
                <span>Predict whether {isNifty ? 'NIFTY 50' : 'BTC/USDT'} will go <strong className="text-green-400">UP</strong> or <strong className="text-red-400">DOWN</strong> from the window open price.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-0.5">3.</span>
                <span>The result is determined by comparing the <strong className="text-white">open price</strong> (at window start) with the <strong className="text-white">close price</strong> (at result time, 15 min after window close).</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-0.5">4.</span>
                <span>If your prediction is correct, you win <strong className="text-purple-400">2x your bet amount</strong>.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-0.5">5.</span>
                <span>Once a trade is placed, it <strong className="text-white">cannot be cancelled</strong>.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-0.5">6.</span>
                <span>There is a <strong className="text-white">15-second gap</strong> between windows for settlement.</span>
              </li>
            </ul>
          </div>

          {/* Tip */}
          <div className="bg-purple-900/20 border border-purple-500/30 rounded-xl p-4 text-sm">
            <div className="font-bold text-purple-400 mb-1">Pro Tip</div>
            <p className="text-gray-300">Watch the live price movement during the trading window before placing your prediction. The countdown timer shows how much time is left in the current window.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==================== TRADING CHART COMPONENT ====================
const TradingChart = ({ gameId, fullHeight = false, onPriceUpdate }) => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candlestickSeriesRef = useRef(null);
  const lastCandleRef = useRef(null);
  const livePriceRef = useRef(null);
  const socketRef = useRef(null);
  const isLiveRef = useRef(false);

  const [livePrice, setLivePrice] = useState(null);
  const [priceChange, setPriceChange] = useState(null);
  const [isLiveConnected, setIsLiveConnected] = useState(false);

  const isBTC = gameId === 'btcupdown';
  const fallbackPrice = isBTC ? 104250 : 24850;
  const symbol = isBTC ? 'BTC/USDT' : 'NIFTY 50';
  const candleInterval = isBTC ? 60 : 900; // 1-min for BTC, 15-min for Nifty

  // Generate initial historical candles (used as base, updated by live data)
  const generateHistoricalCandles = (base) => {
    const candles = [];
    const now = Math.floor(Date.now() / 1000);
    const numCandles = 80;
    let currentPrice = base;

    for (let i = numCandles; i >= 0; i--) {
      const time = Math.floor((now - i * candleInterval) / candleInterval) * candleInterval;
      const volatility = base * (isBTC ? 0.003 : 0.001);
      const drift = (Math.random() - 0.48) * volatility;
      const open = currentPrice;
      const close = open + drift;
      const high = Math.max(open, close) + Math.random() * volatility * 0.5;
      const low = Math.min(open, close) - Math.random() * volatility * 0.5;
      candles.push({
        time,
        open: parseFloat(open.toFixed(2)),
        high: parseFloat(high.toFixed(2)),
        low: parseFloat(low.toFixed(2)),
        close: parseFloat(close.toFixed(2)),
      });
      currentPrice = close;
    }
    return candles;
  };

  // Update chart candle with a new price tick
  const updateCandleWithPrice = (price) => {
    if (!candlestickSeriesRef.current || !lastCandleRef.current) return;

    const now = Math.floor(Date.now() / 1000);
    const candleTime = Math.floor(now / candleInterval) * candleInterval;
    const lastTime = lastCandleRef.current.time;

    if (candleTime > lastTime) {
      const newCandle = {
        time: candleTime,
        open: price,
        high: price,
        low: price,
        close: price,
      };
      lastCandleRef.current = newCandle;
      candlestickSeriesRef.current.update(newCandle);
    } else {
      const updated = {
        ...lastCandleRef.current,
        high: Math.max(lastCandleRef.current.high, price),
        low: Math.min(lastCandleRef.current.low, price),
        close: price,
      };
      lastCandleRef.current = updated;
      candlestickSeriesRef.current.update(updated);
    }

    livePriceRef.current = price;
    setLivePrice(price);
    if (onPriceUpdate) onPriceUpdate(price);
  };

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0a0a0f' },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { color: '#1a1a2e' },
        horzLines: { color: '#1a1a2e' },
      },
      rightPriceScale: {
        borderColor: '#2a2a3e',
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: '#2a2a3e',
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        mode: 0,
        vertLine: { color: '#6366f1', width: 1, style: 2, labelBackgroundColor: '#6366f1' },
        horzLine: { color: '#6366f1', width: 1, style: 2, labelBackgroundColor: '#6366f1' },
      },
      handleScroll: { vertTouchDrag: false },
    });

    chartRef.current = chart;

    const series = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderDownColor: '#ef4444',
      borderUpColor: '#22c55e',
      wickDownColor: '#ef4444',
      wickUpColor: '#22c55e',
    });

    candlestickSeriesRef.current = series;

    // Load initial historical candles
    const candles = generateHistoricalCandles(fallbackPrice);
    series.setData(candles);
    lastCandleRef.current = candles[candles.length - 1];
    livePriceRef.current = candles[candles.length - 1].close;
    setLivePrice(candles[candles.length - 1].close);

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (chartContainerRef.current) {
        const w = chartContainerRef.current.clientWidth;
        const h = chartContainerRef.current.clientHeight;
        chart.applyOptions({ width: w, ...(h > 0 ? { height: h } : {}) });
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
    };
  }, [gameId]);

  // Connect to Socket.IO for real-time live data
  useEffect(() => {
    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5001';
    const socket = socketIO(socketUrl);
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log(`[GameChart] Socket connected for ${symbol}`);
    });

    // Listen for Zerodha market ticks (NIFTY 50)
    if (!isBTC) {
      socket.on('market_tick', (ticks) => {
        const niftyTick = Object.values(ticks).find(
          d => d.symbol === 'NIFTY 50' || d.symbol === 'NIFTY'
        );
        if (niftyTick && niftyTick.ltp) {
          if (!isLiveRef.current) {
            isLiveRef.current = true;
            setIsLiveConnected(true);
          }
          updateCandleWithPrice(niftyTick.ltp);
          if (niftyTick.close) {
            const change = niftyTick.ltp - niftyTick.close;
            const changePct = ((change / niftyTick.close) * 100).toFixed(2);
            setPriceChange({ change: change.toFixed(2), percent: changePct });
          }
        }
      });
    }

    // Listen for Binance crypto ticks (BTC/USDT)
    if (isBTC) {
      socket.on('crypto_tick', (ticks) => {
        const btcTick = ticks['BTCUSDT'] || ticks['BTC'];
        if (btcTick && btcTick.ltp) {
          if (!isLiveRef.current) {
            isLiveRef.current = true;
            setIsLiveConnected(true);
          }
          updateCandleWithPrice(btcTick.ltp);
          if (btcTick.change !== undefined) {
            setPriceChange({
              change: parseFloat(btcTick.change).toFixed(2),
              percent: btcTick.changePercent
            });
          }
        }
      });
      // Also listen on market_tick (Binance emits on both)
      socket.on('market_tick', (ticks) => {
        const btcTick = ticks['BTCUSDT'] || ticks['BTC'];
        if (btcTick && btcTick.ltp) {
          if (!isLiveRef.current) {
            isLiveRef.current = true;
            setIsLiveConnected(true);
          }
          updateCandleWithPrice(btcTick.ltp);
          if (btcTick.change !== undefined) {
            setPriceChange({
              change: parseFloat(btcTick.change).toFixed(2),
              percent: btcTick.changePercent
            });
          }
        }
      });
    }

    socket.on('disconnect', () => {
      console.log(`[GameChart] Socket disconnected for ${symbol}`);
      isLiveRef.current = false;
      setIsLiveConnected(false);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      isLiveRef.current = false;
    };
  }, [gameId]);

  // Fallback: simulate ticks if no live data after 5 seconds
  useEffect(() => {
    const fallbackTimeout = setTimeout(() => {
      if (isLiveRef.current) return; // Live data is flowing, no need for fallback

      console.log(`[GameChart] No live data for ${symbol}, using simulated ticks`);
      const simInterval = setInterval(() => {
        if (isLiveRef.current) {
          clearInterval(simInterval);
          return;
        }
        const volatility = fallbackPrice * (isBTC ? 0.0008 : 0.0003);
        const tick = (Math.random() - 0.48) * volatility;
        const newPrice = parseFloat(((livePriceRef.current || fallbackPrice) + tick).toFixed(2));
        updateCandleWithPrice(newPrice);
      }, 1000);

      return () => clearInterval(simInterval);
    }, 5000);

    return () => clearTimeout(fallbackTimeout);
  }, [gameId]);

  const displayPrice = livePrice || fallbackPrice;
  const isUp = priceChange ? parseFloat(priceChange.change) >= 0 : true;

  return (
    <div className={`bg-dark-800 rounded-2xl overflow-hidden flex flex-col ${fullHeight ? 'h-full' : 'mb-6'}`}>
      {/* Chart Header */}
      <div className="px-4 pt-3 pb-1 flex items-center justify-between flex-shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-sm">{symbol}</span>
            <div className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full animate-pulse ${isLiveConnected ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
              <span className={`text-xs ${isLiveConnected ? 'text-green-400' : 'text-yellow-400'}`}>
                {isLiveConnected ? 'LIVE' : 'SIMULATED'}
              </span>
            </div>
          </div>
          <div className="text-2xl font-bold mt-0.5">
            {isBTC ? '$' : '₹'}{displayPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="text-right">
          <div className={`text-sm font-medium ${isUp ? 'text-green-400' : 'text-red-400'}`}>
            {priceChange
              ? `${isUp ? '+' : ''}${isBTC ? '$' : '₹'}${priceChange.change} (${priceChange.percent}%)`
              : isBTC ? '+$0.00 (0.00%)' : '+₹0.00 (0.00%)'
            }
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            {isBTC ? '1m candles' : '15m candles'}
          </div>
        </div>
      </div>
      {/* Chart Container */}
      <div ref={chartContainerRef} className={`w-full ${fullHeight ? 'flex-1 min-h-0' : ''}`} style={fullHeight ? {} : { height: 300 }} />
    </div>
  );
};

// Individual Game Screen Component
const GameScreen = ({ game, balance, onBack, user, refreshBalance, settings, tokenValue = 300 }) => {
  const isBTC = game.id === 'btcupdown';
  const btcAlwaysOpen = { status: 'open', message: 'Trading Open 24/7', canTrade: true, countdown: 0, windowNumber: 1, windowStart: '00:00', windowEnd: '23:59', resultTime: '' };
  const [betAmount, setBetAmount] = useState('');
  const [prediction, setPrediction] = useState(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [windowInfo, setWindowInfo] = useState(isBTC ? btcAlwaysOpen : getTradingWindowInfo());
  const [activeTrades, setActiveTrades] = useState([]); // pending trades waiting for result
  const [tradeHistory, setTradeHistory] = useState([]);
  const currentPriceRef = useRef(null);
  const prevWindowStatusRef = useRef(windowInfo.status);

  // Admin-configured settings with fallbacks
  const winMultiplier = settings?.winMultiplier || 1.95;
  const brokeragePercent = settings?.brokeragePercent || 5;
  const minBetRs = settings?.minBet || 100;
  const maxBetRs = settings?.maxBet || 50000;
  const gameEnabled = settings?.enabled !== false;

  // Ticket conversion helpers
  const toTokens = (rs) => parseFloat((rs / tokenValue).toFixed(2));
  const toRupees = (tokens) => parseFloat((tokens * tokenValue).toFixed(2));
  const balanceTokens = toTokens(balance);
  const minBetTokens = toTokens(minBetRs);
  const maxBetTokens = toTokens(maxBetRs);

  // Track live price from chart
  const handlePriceUpdate = useCallback((price) => {
    currentPriceRef.current = price;
  }, []);

  // Update trading window info every second (skip for BTC - always open)
  useEffect(() => {
    if (isBTC) return;
    const interval = setInterval(() => {
      setWindowInfo(getTradingWindowInfo());
    }, 1000);
    return () => clearInterval(interval);
  }, [isBTC]);

  // Resolve all active trades when window transitions from open → gap
  useEffect(() => {
    const prevStatus = prevWindowStatusRef.current;
    prevWindowStatusRef.current = windowInfo.status;

    if (prevStatus === 'open' && windowInfo.status === 'gap' && activeTrades.length > 0) {
      const exitPrice = currentPriceRef.current || 0;

      const resolvedTrades = activeTrades.map(trade => {
        const priceDiff = exitPrice - trade.entryPrice;
        const isUp = priceDiff >= 0;
        const won = (trade.prediction === 'UP' && isUp) || (trade.prediction === 'DOWN' && !isUp);
        // P&L: Win = (amount × multiplier) - brokerage on winnings; Loss = -amount
        const grossWin = trade.amount * winMultiplier;
        const brokerage = won ? parseFloat(((grossWin - trade.amount) * brokeragePercent / 100).toFixed(2)) : 0;
        const pnl = won ? parseFloat((grossWin - trade.amount - brokerage).toFixed(2)) : -trade.amount;

        return {
          ...trade,
          status: 'resolved',
          exitPrice: parseFloat(exitPrice.toFixed(2)),
          priceDiff: parseFloat(priceDiff.toFixed(2)),
          pnl,
          won,
          brokerage,
          grossWin: won ? grossWin : 0,
          resultTime: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        };
      });

      // Send resolved trades to backend to update gamesWallet
      const resolveOnServer = async () => {
        try {
          await axios.post('/api/user/game-bet/resolve', {
            trades: resolvedTrades.map(t => ({
              amount: t.amount,
              won: t.won,
              pnl: t.pnl,
              brokerage: t.brokerage
            }))
          }, {
            headers: { Authorization: `Bearer ${user.token}` }
          });
          refreshBalance();
        } catch (err) {
          console.error('Error resolving trades on server:', err);
        }
      };
      resolveOnServer();

      setTradeHistory(prev => [...resolvedTrades.reverse(), ...prev]);
      setActiveTrades([]);
    }
  }, [windowInfo.status, activeTrades]);

  const quickAmounts = [1, 2, 5, 10];

  const handlePlaceBet = async () => {
    if (!betAmount || parseFloat(betAmount) <= 0 || !prediction) return;
    const tokenAmt = parseFloat(betAmount);
    const amt = toRupees(tokenAmt);
    if (tokenAmt < minBetTokens) {
      alert(`Minimum bet is ${minBetTokens} tickets`);
      return;
    }
    if (tokenAmt > maxBetTokens) {
      alert(`Maximum bet is ${maxBetTokens} tickets`);
      return;
    }
    if (amt > balance) {
      alert('Insufficient balance');
      return;
    }
    if (!isBTC && !windowInfo.canTrade) {
      alert('Trading window is closed. Please wait for the next window.');
      return;
    }
    if (!gameEnabled) {
      alert('This game is currently disabled by admin.');
      return;
    }

    try {
      const { data } = await axios.post('/api/user/game-bet/place', {
        gameId: game.id,
        prediction,
        amount: amt,
        entryPrice: parseFloat((currentPriceRef.current || 0).toFixed(2)),
        windowNumber: windowInfo.windowNumber
      }, {
        headers: { Authorization: `Bearer ${user.token}` }
      });

      const newTrade = {
        id: data.betId || Date.now() + Math.random(),
        windowNumber: windowInfo.windowNumber,
        prediction,
        amount: amt,
        entryPrice: parseFloat((currentPriceRef.current || 0).toFixed(2)),
        status: 'pending',
        time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      };

      setActiveTrades(prev => [...prev, newTrade]);
      refreshBalance();
      setBetAmount('');
      setPrediction(null);
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to place bet');
    }
  };

  // Window status badge
  const WindowStatusBadge = () => {
    if (windowInfo.status === 'open') {
      return (
        <div className="bg-green-900/30 border border-green-500/40 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-green-400 font-bold text-sm">WINDOW OPEN - Trade #{windowInfo.windowNumber}</span>
            </div>
            <span className="text-xs text-gray-400">{windowInfo.windowStart} → {windowInfo.windowEnd}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-sm">Time Remaining</span>
            <span className="text-2xl font-bold text-green-400 font-mono">{formatCountdown(windowInfo.countdown)}</span>
          </div>
          <div className="mt-2 text-xs text-gray-500">Result at: {windowInfo.resultTime}</div>
        </div>
      );
    }
    
    if (windowInfo.status === 'gap') {
      return (
        <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Lock size={16} className="text-yellow-400" />
            <span className="text-yellow-400 font-bold text-sm">WINDOW CLOSED</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-sm">Next window opens at</span>
            <span className="text-yellow-400 font-medium">{windowInfo.nextWindowStart}</span>
          </div>
          <div className="mt-2 w-full bg-dark-700 rounded-full h-1.5">
            <div className="bg-yellow-500 h-1.5 rounded-full animate-pulse" style={{ width: `${((15 - windowInfo.countdown) / 15) * 100}%` }}></div>
          </div>
        </div>
      );
    }
    
    if (windowInfo.status === 'pre_market') {
      return (
        <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={16} className="text-blue-400" />
            <span className="text-blue-400 font-bold text-sm">PRE-MARKET</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-sm">First window opens at</span>
            <span className="text-blue-400 font-medium">{windowInfo.nextWindowStart}</span>
          </div>
          <div className="text-xs text-gray-500 mt-1">Countdown: {formatCountdown(windowInfo.countdown)}</div>
        </div>
      );
    }
    
    if (windowInfo.status === 'post_market') {
      return (
        <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Lock size={16} className="text-red-400" />
            <span className="text-red-400 font-bold text-sm">MARKET CLOSED</span>
          </div>
          <p className="text-gray-400 text-sm">Trading resumes tomorrow at 9:15:15 AM IST</p>
        </div>
      );
    }
    
    return null;
  };

  return (
    <div className="h-screen bg-dark-900 text-white flex flex-col overflow-hidden">
      {/* Header */}
      <div className={`bg-gradient-to-r ${game.color} h-1 flex-shrink-0`}></div>
      <div className="bg-dark-800 border-b border-dark-600 flex-shrink-0">
        <div className="px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={onBack} className="p-2 hover:bg-dark-700 rounded-lg transition">
                <ArrowLeft size={20} />
              </button>
              <div className="flex items-center gap-2">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${game.color} flex items-center justify-center`}>
                  <game.icon size={20} />
                </div>
                <div>
                  <h1 className="font-bold">{game.name}</h1>
                  <p className="text-xs text-gray-400">{winMultiplier}x Returns</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowInstructions(true)}
                className="p-2 bg-dark-700 hover:bg-dark-600 rounded-lg transition"
                title="Instructions"
              >
                <Info size={18} className="text-purple-400" />
              </button>
              <div className="bg-dark-700 rounded-lg px-3 py-1.5">
                <div className="text-xs text-gray-400">Balance</div>
                <div className="font-bold text-purple-400">{balanceTokens} Tkt</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3-Column Desktop Layout / Stacked Mobile - Full Height */}
      <div className="px-3 py-2 flex-1 min-h-0 overflow-hidden">
        <div className="flex flex-col lg:flex-row gap-3 h-full">

          {/* LEFT COLUMN - Trading Window Status */}
          <div className="lg:w-[240px] flex-shrink-0 order-1 lg:order-1 overflow-y-auto">
            {isBTC ? (
              <div className="bg-green-900/30 border border-green-500/40 rounded-xl p-4 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-green-400 font-bold text-sm">24/7 TRADING OPEN</span>
                </div>
                <p className="text-gray-400 text-xs mt-1">BTC market never closes</p>
              </div>
            ) : (
              <WindowStatusBadge />
            )}

            {/* Game Info Card */}
            <div className="bg-dark-800 rounded-xl p-4 border border-dark-600">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${game.color} flex items-center justify-center`}>
                  <game.icon size={24} />
                </div>
                <div>
                  <h3 className="font-bold">{game.name}</h3>
                  <p className="text-xs text-gray-400">{game.description}</p>
                </div>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between py-1 border-b border-dark-600">
                  <span className="text-gray-400">Win Multiplier</span>
                  <span className="text-green-400 font-bold">{winMultiplier}x</span>
                </div>
                <div className="flex justify-between py-1 border-b border-dark-600">
                  <span className="text-gray-400">Brokerage</span>
                  <span className="text-yellow-400 font-medium">{brokeragePercent}%</span>
                </div>
                <div className="flex justify-between py-1 border-b border-dark-600">
                  <span className="text-gray-400">Min Bet</span>
                  <span className="font-medium">{minBetTokens} Tickets</span>
                </div>
                <div className="flex justify-between py-1 border-b border-dark-600">
                  <span className="text-gray-400">Max Bet</span>
                  <span className="font-medium">{maxBetTokens} Tickets</span>
                </div>
                <div className="flex justify-between py-1 border-b border-dark-600">
                  <span className="text-gray-400">1 Ticket</span>
                  <span className="font-medium">₹{tokenValue}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-400">Players</span>
                  <span className="font-medium">{game.players}</span>
                </div>
              </div>
              <div className="mt-2 bg-dark-700/50 rounded-lg p-2 text-[10px] text-gray-500">
                Win 1 Ticket bet → {winMultiplier} T gross - {((winMultiplier - 1) * brokeragePercent / 100).toFixed(2)} T fee = <span className="text-green-400 font-medium">{(winMultiplier - 1 - (winMultiplier - 1) * brokeragePercent / 100).toFixed(2)} T profit</span>
              </div>
              <button
                onClick={() => setShowInstructions(true)}
                className="w-full mt-3 py-2 bg-dark-700 hover:bg-dark-600 rounded-lg text-sm text-purple-400 font-medium transition flex items-center justify-center gap-2"
              >
                <BookOpen size={14} />
                How to Play
              </button>
            </div>
          </div>

          {/* CENTER COLUMN - Chart (fills remaining space) */}
          <div className="flex-1 min-w-0 order-2 lg:order-2 flex flex-col">
            <TradingChart gameId={game.id} fullHeight onPriceUpdate={handlePriceUpdate} />
          </div>

          {/* RIGHT COLUMN - Betting Controls + Active Trades + History */}
          <div className="lg:w-[300px] flex-shrink-0 order-3 lg:order-3 flex flex-col h-full overflow-hidden">
            {/* Betting Controls - Always visible when window is open */}
            <div className="space-y-3 flex-shrink-0">
              {/* Bet Amount */}
              <div className="bg-dark-800 rounded-xl p-4 border border-dark-600">
                <label className="block text-sm text-gray-400 mb-2">Enter Tickets</label>
                <input
                  type="number"
                  value={betAmount}
                  onChange={e => setBetAmount(e.target.value)}
                  placeholder={`${minBetTokens} - ${maxBetTokens} Tickets`}
                  min={minBetTokens}
                  max={maxBetTokens}
                  step="0.01"
                  className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2.5 text-xl font-bold text-center focus:border-purple-500 focus:outline-none"
                />
                <div className="text-[10px] text-gray-500 mt-1 text-center">Min {minBetTokens} • Max {maxBetTokens} Tickets (1Tkt = ₹{tokenValue})</div>
                <div className="grid grid-cols-4 gap-1.5 mt-2">
                  {quickAmounts.map(amt => (
                    <button
                      key={amt}
                      onClick={() => setBetAmount(amt.toString())}
                      className="py-1.5 bg-dark-700 hover:bg-dark-600 rounded-lg text-xs font-medium transition"
                    >
                      {amt} T
                    </button>
                  ))}
                </div>
              </div>

              {/* Prediction Selection */}
              <div className="bg-dark-800 rounded-xl p-4 border border-dark-600">
                <label className="block text-sm text-gray-400 mb-2">Make Your Prediction</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPrediction('UP')}
                    disabled={!windowInfo.canTrade}
                    className={`p-3 rounded-xl border-2 transition-all ${
                      !windowInfo.canTrade ? 'opacity-50 cursor-not-allowed border-dark-600' :
                      prediction === 'UP' 
                        ? 'border-green-500 bg-green-500/20' 
                        : 'border-dark-600 hover:border-green-500/50'
                    }`}
                  >
                    <ArrowUpCircle size={24} className={`mx-auto mb-1 ${prediction === 'UP' ? 'text-green-400' : 'text-gray-400'}`} />
                    <div className="font-bold text-sm">UP</div>
                    <div className="text-[10px] text-gray-400">{winMultiplier}x Returns</div>
                  </button>
                  <button
                    onClick={() => setPrediction('DOWN')}
                    disabled={!windowInfo.canTrade}
                    className={`p-3 rounded-xl border-2 transition-all ${
                      !windowInfo.canTrade ? 'opacity-50 cursor-not-allowed border-dark-600' :
                      prediction === 'DOWN' 
                        ? 'border-red-500 bg-red-500/20' 
                        : 'border-dark-600 hover:border-red-500/50'
                    }`}
                  >
                    <ArrowDownCircle size={24} className={`mx-auto mb-1 ${prediction === 'DOWN' ? 'text-red-400' : 'text-gray-400'}`} />
                    <div className="font-bold text-sm">DOWN</div>
                    <div className="text-[10px] text-gray-400">{winMultiplier}x Returns</div>
                  </button>
                </div>
              </div>

              {/* Place Bet Button */}
              <button
                onClick={handlePlaceBet}
                disabled={!betAmount || !prediction || parseFloat(betAmount) <= 0 || !windowInfo.canTrade}
                className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${
                  betAmount && prediction && parseFloat(betAmount) > 0 && windowInfo.canTrade
                    ? `bg-gradient-to-r ${game.color} hover:opacity-90`
                    : 'bg-dark-700 text-gray-500 cursor-not-allowed'
                }`}
              >
                {!windowInfo.canTrade 
                  ? 'Trading Window Closed' 
                  : betAmount && prediction 
                    ? `Place Trade - ${parseFloat(betAmount)} Tickets` 
                    : 'Select Amount & Prediction'}
              </button>
            </div>

            {/* Active Trades (pending results) */}
            {activeTrades.length > 0 && (
              <div className="mt-3 flex-shrink-0">
                <div className="flex items-center justify-between mb-1.5">
                  <h3 className="text-xs font-bold text-yellow-400">Active Trades ({activeTrades.length})</h3>
                  <div className="flex items-center gap-1">
                    <RefreshCw className="animate-spin text-yellow-400" size={10} />
                    <span className="text-[10px] text-yellow-400">Pending</span>
                  </div>
                </div>
                <div className="space-y-1">
                  {activeTrades.map(trade => (
                    <div key={trade.id} className="bg-yellow-900/15 border border-yellow-500/25 rounded-lg p-2 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          trade.prediction === 'UP' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                          {trade.prediction}
                        </span>
                        <span className="text-[10px] text-gray-400">{toTokens(trade.amount)} T</span>
                      </div>
                      <div className="text-[10px] text-gray-500">
                        @ {game.id === 'btcupdown' ? '$' : '₹'}{trade.entryPrice.toLocaleString()} • {trade.time}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Trade History */}
            <div className="mt-3 flex-1 min-h-0 flex flex-col">
              <div className="flex items-center justify-between mb-1.5 flex-shrink-0">
                <h3 className="text-xs font-bold text-gray-300">Trade History</h3>
                {tradeHistory.length > 0 && (
                  <span className="text-[10px] text-gray-500">{tradeHistory.length} trade{tradeHistory.length !== 1 ? 's' : ''}</span>
                )}
              </div>

              {tradeHistory.length === 0 && activeTrades.length === 0 ? (
                <div className="bg-dark-800 rounded-xl p-3 border border-dark-600 text-center">
                  <Clock size={16} className="mx-auto mb-1.5 text-gray-600" />
                  <p className="text-[10px] text-gray-500">No trades yet. Place your first trade!</p>
                </div>
              ) : tradeHistory.length === 0 ? null : (
                <div className="flex-1 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
                  {/* Summary Row */}
                  <div className="bg-dark-800 rounded-lg p-2 border border-dark-600 flex items-center justify-between">
                    <div className="text-[11px]">
                      <span className="text-gray-400">P&L: </span>
                      <span className={`font-bold ${
                        tradeHistory.reduce((sum, t) => sum + t.pnl, 0) >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {tradeHistory.reduce((sum, t) => sum + t.pnl, 0) >= 0 ? '+' : ''}{toTokens(tradeHistory.reduce((sum, t) => sum + t.pnl, 0))} T
                      </span>
                    </div>
                    <div className="text-[11px]">
                      <span className="text-green-400">{tradeHistory.filter(t => t.won).length}W</span>
                      <span className="text-gray-600 mx-0.5">/</span>
                      <span className="text-red-400">{tradeHistory.filter(t => !t.won).length}L</span>
                    </div>
                  </div>

                  {/* Individual Trades */}
                  {tradeHistory.map(trade => (
                    <div key={trade.id} className={`bg-dark-800 rounded-lg p-2 border ${
                      trade.won ? 'border-green-500/20' : 'border-red-500/20'
                    }`}>
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            trade.won ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                          }`}>
                            {trade.prediction}
                          </span>
                          <span className="text-[10px] text-gray-500">#{trade.windowNumber}</span>
                        </div>
                        <span className={`text-xs font-bold ${trade.won ? 'text-green-400' : 'text-red-400'}`}>
                          {trade.pnl >= 0 ? '+' : ''}{toTokens(trade.pnl)} T
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-gray-500">
                        <span>{toTokens(trade.amount)} T • {trade.time}</span>
                        <span>
                          {game.id === 'btcupdown' ? '$' : ''}{trade.entryPrice.toLocaleString()} → {game.id === 'btcupdown' ? '$' : ''}{trade.exitPrice.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Instructions Modal */}
      {showInstructions && (
        <InstructionsModal onClose={() => setShowInstructions(false)} gameId={game.id} />
      )}
    </div>
  );
};

// ==================== NIFTY NUMBER SCREEN ====================
const NiftyNumberScreen = ({ game, balance, onBack, user, refreshBalance, settings, tokenValue = 300 }) => {
  const [selectedNumbers, setSelectedNumbers] = useState([]);
  const [betAmount, setBetAmount] = useState('');
  const [todayBets, setTodayBets] = useState([]);
  const [remaining, setRemaining] = useState(0);
  const [maxBetsPerDay, setMaxBetsPerDay] = useState(10);
  const [betHistory, setBetHistory] = useState([]);
  const [placing, setPlacing] = useState(false);
  const [loadingBet, setLoadingBet] = useState(true);
  const [message, setMessage] = useState(null);
  const [editingBetId, setEditingBetId] = useState(null);
  const [editAmount, setEditAmount] = useState('');
  const [modifying, setModifying] = useState(false);

  // Admin-configured settings with fallbacks (₹ amounts directly)
  const fixedProfit = settings?.fixedProfit || 4000;
  const minBet = settings?.minBet || 100;
  const maxBet = settings?.maxBet || 10000;
  const gameEnabled = settings?.enabled !== false;

  // Numbers already bet on today (to disable in grid)
  const todayNumbers = todayBets.map(b => b.selectedNumber);

  useEffect(() => {
    fetchTodayBets();
    fetchHistory();
  }, []);

  const fetchTodayBets = async () => {
    try {
      const { data } = await axios.get('/api/user/nifty-number/today', {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      setTodayBets(data.bets || []);
      setRemaining(data.remaining ?? 0);
      setMaxBetsPerDay(data.maxBetsPerDay ?? 10);
    } catch (error) {
      console.error('Error fetching today bets:', error);
    } finally {
      setLoadingBet(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const { data } = await axios.get('/api/user/nifty-number/history', {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      setBetHistory(data);
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  };

  const toggleNumber = (num) => {
    if (todayNumbers.includes(num)) return;
    setSelectedNumbers(prev => {
      if (prev.includes(num)) return prev.filter(n => n !== num);
      if (prev.length >= remaining) {
        setMessage({ type: 'error', text: `You can only pick ${remaining} more number(s) today` });
        return prev;
      }
      return [...prev, num];
    });
  };

  const handlePlaceBet = async () => {
    if (selectedNumbers.length === 0 || !betAmount) return;
    const amt = parseFloat(betAmount);
    const totalCost = amt * selectedNumbers.length;
    if (amt < minBet) { setMessage({ type: 'error', text: `Minimum bet is ₹${minBet} per number` }); return; }
    if (amt > maxBet) { setMessage({ type: 'error', text: `Maximum bet is ₹${maxBet} per number` }); return; }
    if (totalCost > balance) { setMessage({ type: 'error', text: `Insufficient balance. Need ₹${totalCost.toLocaleString()} for ${selectedNumbers.length} number(s)` }); return; }
    if (!gameEnabled) { setMessage({ type: 'error', text: 'Game is currently disabled' }); return; }

    setPlacing(true);
    setMessage(null);
    try {
      const { data } = await axios.post('/api/user/nifty-number/bet', {
        selectedNumbers,
        amount: amt
      }, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const nums = selectedNumbers.map(n => `.${n.toString().padStart(2, '0')}`).join(', ');
      setMessage({ type: 'success', text: `${selectedNumbers.length} bet(s) placed! Numbers: ${nums}` });
      setSelectedNumbers([]);
      setBetAmount('');
      refreshBalance();
      fetchTodayBets();
      fetchHistory();
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to place bet' });
    } finally {
      setPlacing(false);
    }
  };

  const handleModifyBet = async (betId) => {
    const newAmt = parseFloat(editAmount);
    if (isNaN(newAmt) || newAmt <= 0) { setMessage({ type: 'error', text: 'Enter a valid amount' }); return; }
    if (newAmt < minBet) { setMessage({ type: 'error', text: `Minimum bet is ₹${minBet}` }); return; }
    if (newAmt > maxBet) { setMessage({ type: 'error', text: `Maximum bet is ₹${maxBet}` }); return; }

    setModifying(true);
    setMessage(null);
    try {
      await axios.put(`/api/user/nifty-number/bet/${betId}`, {
        newAmount: newAmt
      }, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      setMessage({ type: 'success', text: `Bet updated to ₹${newAmt.toLocaleString()}` });
      setEditingBetId(null);
      setEditAmount('');
      refreshBalance();
      fetchTodayBets();
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to modify bet' });
    } finally {
      setModifying(false);
    }
  };

  const quickAmounts = [100, 200, 500, 1000, 2000, 5000];

  return (
    <div className="h-screen bg-dark-900 text-white flex flex-col overflow-hidden">
      {/* Header Color Bar */}
      <div className={`bg-gradient-to-r ${game.color} h-1 flex-shrink-0`}></div>
      {/* Header */}
      <div className="bg-dark-800 border-b border-dark-600 flex-shrink-0">
        <div className="px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={onBack} className="p-2 hover:bg-dark-700 rounded-lg transition">
                <ArrowLeft size={20} />
              </button>
              <div className="flex items-center gap-2">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${game.color} flex items-center justify-center`}>
                  <game.icon size={20} />
                </div>
                <div>
                  <h1 className="font-bold">{game.name}</h1>
                  <p className="text-xs text-gray-400">Win ₹{fixedProfit.toLocaleString()} profit</p>
                </div>
              </div>
            </div>
            <div className="bg-dark-700 rounded-lg px-3 py-1.5 text-right">
              <div className="text-[10px] text-gray-400">Balance</div>
              <div className="font-bold text-purple-400">₹{balance.toLocaleString()}</div>
            </div>
          </div>
        </div>
      </div>

      {/* 3-Column Desktop Layout / Stacked Mobile - Full Height */}
      <div className="px-3 py-2 flex-1 min-h-0 overflow-hidden">
        <div className="flex flex-col lg:flex-row gap-3 h-full">

          {/* LEFT COLUMN - Game Info + Today's Bet Status */}
          <div className="lg:w-[260px] flex-shrink-0 order-1 lg:order-1 overflow-y-auto">
            {/* Today's Bets Status */}
            {loadingBet ? (
              <div className="flex items-center justify-center py-6">
                <RefreshCw className="animate-spin text-purple-500" size={20} />
              </div>
            ) : todayBets.length > 0 ? (
              <div className="bg-dark-800 rounded-xl p-3 border border-purple-500/30 mb-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-purple-400 font-bold text-xs flex items-center gap-1.5">
                    <Target size={12} />
                    TODAY'S BETS ({todayBets.length}/{maxBetsPerDay})
                  </span>
                  {remaining > 0 && <span className="text-[10px] text-gray-500">{remaining} left</span>}
                </div>
                <div className="space-y-1.5 max-h-[280px] overflow-y-auto">
                  {todayBets.map((bet, idx) => (
                    <div key={bet._id || idx} className={`p-2 rounded-lg text-xs ${
                      bet.status === 'won' ? 'bg-green-900/20' :
                      bet.status === 'lost' ? 'bg-red-900/20' :
                      'bg-yellow-900/10'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-purple-400 font-bold text-sm">.{bet.selectedNumber.toString().padStart(2, '0')}</span>
                          <span className="text-gray-400">₹{bet.amount.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {bet.status === 'pending' && (
                            <button
                              onClick={() => { setEditingBetId(editingBetId === bet._id ? null : bet._id); setEditAmount(bet.amount.toString()); }}
                              className="text-[10px] text-blue-400 hover:text-blue-300 px-1.5 py-0.5 rounded bg-blue-500/10 hover:bg-blue-500/20 transition"
                            >
                              {editingBetId === bet._id ? 'Cancel' : 'Edit'}
                            </button>
                          )}
                          {bet.status === 'pending' && <span className="text-yellow-400 font-medium">Pending</span>}
                          {bet.status === 'won' && <span className="text-green-400 font-bold">+₹{bet.profit?.toLocaleString()}</span>}
                          {bet.status === 'lost' && <span className="text-red-400 font-bold">-₹{bet.amount.toLocaleString()}</span>}
                        </div>
                      </div>
                      {/* Inline Edit */}
                      {editingBetId === bet._id && bet.status === 'pending' && (
                        <div className="mt-2 flex items-center gap-1.5">
                          <input
                            type="number"
                            value={editAmount}
                            onChange={e => setEditAmount(e.target.value)}
                            className="flex-1 bg-dark-700 border border-dark-500 rounded px-2 py-1 text-xs font-bold focus:border-blue-500 focus:outline-none"
                            min={minBet}
                            max={maxBet}
                          />
                          <button
                            onClick={() => handleModifyBet(bet._id)}
                            disabled={modifying}
                            className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-[10px] font-bold transition disabled:opacity-50"
                          >
                            {modifying ? '...' : 'Save'}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {todayBets.some(b => b.status !== 'pending' && b.resultNumber !== null) && (
                  <div className="mt-2 pt-2 border-t border-dark-600 text-xs text-gray-400 text-center">
                    Result: <span className="text-white font-bold">.{todayBets.find(b => b.resultNumber !== null)?.resultNumber?.toString().padStart(2, '0')}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-purple-900/20 border border-purple-500/30 rounded-xl p-3 mb-3">
                <div className="flex items-center gap-2 mb-1">
                  <Target size={14} className="text-purple-400" />
                  <span className="text-purple-400 font-bold text-xs">NO BETS TODAY</span>
                </div>
                <p className="text-gray-400 text-xs">Pick numbers and place your bets →</p>
              </div>
            )}

            {/* Game Info Card */}
            <div className="bg-dark-800 rounded-xl p-4 border border-dark-600">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${game.color} flex items-center justify-center`}>
                  <game.icon size={24} />
                </div>
                <div>
                  <h3 className="font-bold">{game.name}</h3>
                  <p className="text-xs text-gray-400">Pick .00 to .95 (multiples of 5)</p>
                </div>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between py-1 border-b border-dark-600">
                  <span className="text-gray-400">Win Profit</span>
                  <span className="text-green-400 font-bold">₹{fixedProfit.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-dark-600">
                  <span className="text-gray-400">Min Bet</span>
                  <span className="font-medium">₹{minBet.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-dark-600">
                  <span className="text-gray-400">Max Bet</span>
                  <span className="font-medium">₹{maxBet.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-dark-600">
                  <span className="text-gray-400">Bets/Day</span>
                  <span className="text-yellow-400 font-bold">{maxBetsPerDay}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-400">Result At</span>
                  <span className="font-medium">{settings?.resultTime || '15:30'} IST</span>
                </div>
              </div>
              <div className="mt-2 bg-dark-700/50 rounded-lg p-2 text-[10px] text-gray-500">
                Bet ₹{minBet} → If you win: <span className="text-green-400 font-medium">+₹{fixedProfit.toLocaleString()} profit</span>
              </div>
            </div>

            {/* Bet History */}
            <div className="bg-dark-800 rounded-xl p-3 border border-dark-600 mt-3">
              <h3 className="font-bold text-xs mb-2 flex items-center gap-1.5">
                <Clock size={12} className="text-gray-400" />
                History
              </h3>
              {betHistory.length === 0 ? (
                <p className="text-gray-500 text-[10px] text-center py-2">No bets yet</p>
              ) : (
                <div className="space-y-1 max-h-[200px] overflow-y-auto">
                  {betHistory.map((bet, idx) => (
                    <div key={bet._id || idx} className={`flex items-center justify-between p-2 rounded-lg text-xs ${
                      bet.status === 'won' ? 'bg-green-900/20' :
                      bet.status === 'lost' ? 'bg-red-900/20' :
                      'bg-dark-700'
                    }`}>
                      <div>
                        <div className="text-[10px] text-gray-500">{bet.betDate}</div>
                        <div className="font-bold">.{bet.selectedNumber.toString().padStart(2, '0')} <span className="text-gray-400 font-normal">₹{bet.amount.toLocaleString()}</span></div>
                      </div>
                      <div className="text-right">
                        {bet.status === 'pending' && <span className="text-yellow-400 font-medium">Pending</span>}
                        {bet.status === 'won' && <span className="text-green-400 font-bold">+₹{bet.profit?.toLocaleString()}</span>}
                        {bet.status === 'lost' && <span className="text-red-400 font-bold">-₹{bet.amount.toLocaleString()}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* CENTER COLUMN - Nifty Chart (fills remaining space) */}
          <div className="flex-1 min-w-0 order-2 lg:order-2 flex flex-col">
            <TradingChart gameId="updown" fullHeight />
          </div>

          {/* RIGHT COLUMN - Number Picker + Bet Controls */}
          <div className="lg:w-[300px] flex-shrink-0 order-3 lg:order-3 flex flex-col h-full overflow-hidden">
            {/* Message */}
            {message && (
              <div className={`p-2 rounded-lg text-xs font-medium mb-2 ${message.type === 'success' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                {message.text}
              </div>
            )}

            {remaining === 0 && todayBets.length > 0 ? (
              /* All bets used today - show summary */
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center p-6">
                  <div className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center bg-purple-500/20">
                    <Check size={28} className="text-purple-400" />
                  </div>
                  <div className="text-lg font-bold text-purple-400 mb-1">All {maxBetsPerDay} bets placed!</div>
                  <div className="flex flex-wrap gap-1.5 justify-center mb-2">
                    {todayBets.map((b, i) => (
                      <span key={i} className={`px-2 py-1 rounded-lg text-xs font-bold ${
                        b.status === 'won' ? 'bg-green-500/20 text-green-400' :
                        b.status === 'lost' ? 'bg-red-500/20 text-red-400' :
                        'bg-purple-500/20 text-purple-400'
                      }`}>.{b.selectedNumber.toString().padStart(2, '0')}</span>
                    ))}
                  </div>
                  <div className="text-gray-400 text-sm mb-1">
                    Total: ₹{todayBets.reduce((s, b) => s + b.amount, 0).toLocaleString()}
                  </div>
                  <div className="text-yellow-400 text-xs font-medium">Result at {settings?.resultTime || '15:30'} IST</div>
                  <div className="text-[10px] text-gray-500 mt-2">You can still edit pending bet amounts from the left panel</div>
                </div>
              </div>
            ) : (
              /* Betting UI - Multi-number selection */
              <div className="space-y-2 overflow-y-auto flex-1">
                {/* Number Picker Grid */}
                <div className="bg-dark-800 rounded-xl p-3 border border-dark-600">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-gray-400 font-medium">Pick Numbers (.00 - .95)</label>
                    <span className="text-[10px] text-purple-400 font-bold">{selectedNumbers.length} selected • {remaining} left</span>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {Array.from({ length: 20 }, (_, idx) => {
                      const i = idx * 5;
                      const isSelected = selectedNumbers.includes(i);
                      const isAlreadyBet = todayNumbers.includes(i);
                      return (
                        <button
                          key={i}
                          onClick={() => toggleNumber(i)}
                          disabled={isAlreadyBet}
                          className={`py-2 rounded text-xs font-bold transition-all ${
                            isAlreadyBet
                              ? 'bg-yellow-900/30 text-yellow-600 cursor-not-allowed ring-1 ring-yellow-500/30'
                              : isSelected
                              ? 'bg-purple-600 text-white ring-2 ring-purple-400 scale-110 z-10'
                              : 'bg-dark-700 hover:bg-dark-600 text-gray-300'
                          }`}
                        >
                          .{i.toString().padStart(2, '0')}
                        </button>
                      );
                    })}
                  </div>
                  {selectedNumbers.length > 0 && (
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex flex-wrap gap-1">
                        {selectedNumbers.map(n => (
                          <span key={n} className="bg-purple-600/30 text-purple-300 px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer hover:bg-red-600/30 hover:text-red-300"
                            onClick={() => setSelectedNumbers(prev => prev.filter(x => x !== n))}
                          >.{n.toString().padStart(2, '0')} ×</span>
                        ))}
                      </div>
                      <button onClick={() => setSelectedNumbers([])} className="text-[10px] text-gray-500 hover:text-red-400">Clear</button>
                    </div>
                  )}
                </div>

                {/* Bet Amount */}
                <div className="bg-dark-800 rounded-xl p-3 border border-dark-600">
                  <label className="block text-xs text-gray-400 mb-1.5">Amount per number (₹)</label>
                  <input
                    type="number"
                    value={betAmount}
                    onChange={e => setBetAmount(e.target.value)}
                    placeholder={`₹${minBet} - ₹${maxBet}`}
                    min={minBet}
                    max={maxBet}
                    className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-lg font-bold text-center focus:border-purple-500 focus:outline-none"
                  />
                  <div className="text-[10px] text-gray-500 mt-1 text-center">Min ₹{minBet.toLocaleString()} • Max ₹{maxBet.toLocaleString()}</div>
                  <div className="grid grid-cols-3 gap-1.5 mt-1.5">
                    {quickAmounts.map(amt => (
                      <button
                        key={amt}
                        onClick={() => setBetAmount(amt.toString())}
                        className="py-1.5 bg-dark-700 hover:bg-dark-600 rounded-lg text-xs font-medium transition"
                      >
                        ₹{amt.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Total Cost */}
                {selectedNumbers.length > 0 && betAmount && parseFloat(betAmount) > 0 && (
                  <div className="bg-purple-900/20 border border-purple-500/20 rounded-lg p-2 text-xs text-center">
                    <span className="text-gray-400">{selectedNumbers.length} number(s) × ₹{parseFloat(betAmount).toLocaleString()} = </span>
                    <span className="text-purple-400 font-bold">₹{(selectedNumbers.length * parseFloat(betAmount)).toLocaleString()}</span>
                  </div>
                )}

                {/* Place Bet Button */}
                <button
                  onClick={handlePlaceBet}
                  disabled={selectedNumbers.length === 0 || !betAmount || parseFloat(betAmount) <= 0 || placing}
                  className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${
                    selectedNumbers.length > 0 && betAmount && parseFloat(betAmount) > 0
                      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700'
                      : 'bg-dark-700 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {placing ? (
                    <span className="flex items-center justify-center gap-2"><RefreshCw size={16} className="animate-spin" /> Placing...</span>
                  ) : selectedNumbers.length > 0 && betAmount ? (
                    `Place ${selectedNumbers.length} Bet(s) - ₹${(selectedNumbers.length * parseFloat(betAmount)).toLocaleString()}`
                  ) : (
                    'Select Numbers & Amount'
                  )}
                </button>

                {/* Summary */}
                {selectedNumbers.length > 0 && betAmount && parseFloat(betAmount) > 0 && (
                  <div className="bg-dark-800/50 rounded-lg p-2 text-[10px] text-gray-500 text-center">
                    If any number matches → You win <span className="text-green-400 font-bold">₹{fixedProfit.toLocaleString()}</span> profit per match
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

// ==================== NIFTY BRACKET SCREEN ====================
const NiftyBracketScreen = ({ game, balance, onBack, user, refreshBalance, settings, tokenValue = 300 }) => {
  const [betAmount, setBetAmount] = useState('');
  const [activeTrades, setActiveTrades] = useState([]);
  const [tradeHistory, setTradeHistory] = useState([]);
  const [placing, setPlacing] = useState(false);
  const [message, setMessage] = useState(null);
  const [currentPrice, setCurrentPrice] = useState(null);
  const resolveCheckRef = useRef(null);

  const bracketGap = settings?.bracketGap || 20;
  const expiryMinutes = settings?.expiryMinutes || 5;
  const winMultiplier = settings?.winMultiplier || 2;
  const brokeragePercent = settings?.brokeragePercent || 5;
  const minBetRs = settings?.minBet || 100;
  const maxBetRs = settings?.maxBet || 25000;
  const gameEnabled = settings?.enabled !== false;

  // Ticket conversion helpers
  const toTokens = (rs) => parseFloat((rs / tokenValue).toFixed(2));
  const toRupees = (tokens) => parseFloat((tokens * tokenValue).toFixed(2));
  const balanceTokens = toTokens(balance);
  const minBetTokens = toTokens(minBetRs);
  const maxBetTokens = toTokens(maxBetRs);

  const upperTarget = currentPrice ? parseFloat((currentPrice + bracketGap).toFixed(2)) : null;
  const lowerTarget = currentPrice ? parseFloat((currentPrice - bracketGap).toFixed(2)) : null;

  const resolvingRef = useRef(false);

  useEffect(() => {
    fetchActiveTrades();
    fetchHistory();
  }, []);

  // Check active trades against current price for auto-resolution
  // Price comes from TradingChart's onPriceUpdate callback — no separate socket needed
  useEffect(() => {
    if (!currentPrice || activeTrades.length === 0 || resolvingRef.current) return;

    const checkAndResolve = async () => {
      resolvingRef.current = true;
      for (const trade of activeTrades) {
        const hitUpper = currentPrice >= trade.upperTarget;
        const hitLower = currentPrice <= trade.lowerTarget;
        const expired = new Date() >= new Date(trade.expiresAt);

        if (hitUpper || hitLower || expired) {
          try {
            const { data } = await axios.post('/api/user/nifty-bracket/resolve', {
              tradeId: trade._id,
              currentPrice
            }, {
              headers: { Authorization: `Bearer ${user.token}` }
            });
            setMessage({
              type: data.trade.status === 'won' ? 'success' : data.trade.status === 'expired' ? 'info' : 'error',
              text: data.message
            });
            fetchActiveTrades();
            fetchHistory();
            refreshBalance();
          } catch (err) {
            // Trade may already be resolved
          }
        }
      }
      resolvingRef.current = false;
    };

    checkAndResolve();
  }, [currentPrice]);

  const fetchActiveTrades = async () => {
    try {
      const { data } = await axios.get('/api/user/nifty-bracket/active', {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      setActiveTrades(data);
    } catch (error) {
      console.error('Error fetching active trades:', error);
    }
  };

  const fetchHistory = async () => {
    try {
      const { data } = await axios.get('/api/user/nifty-bracket/history', {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      setTradeHistory(data);
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  };

  const handlePlaceTrade = async (prediction) => {
    if (!betAmount || !currentPrice) return;
    const tokenAmt = parseFloat(betAmount);
    const amt = toRupees(tokenAmt);
    if (tokenAmt < minBetTokens) { setMessage({ type: 'error', text: `Minimum bet is ${minBetTokens} tickets` }); return; }
    if (tokenAmt > maxBetTokens) { setMessage({ type: 'error', text: `Maximum bet is ${maxBetTokens} tickets` }); return; }
    if (amt > balance) { setMessage({ type: 'error', text: 'Insufficient balance' }); return; }
    if (!gameEnabled) { setMessage({ type: 'error', text: 'Game is currently disabled' }); return; }

    setPlacing(true);
    setMessage(null);
    try {
      const { data } = await axios.post('/api/user/nifty-bracket/trade', {
        prediction,
        amount: amt,
        entryPrice: currentPrice
      }, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      setMessage({ type: 'success', text: `${prediction} trade placed at ${currentPrice}!` });
      fetchActiveTrades();
      refreshBalance();
    } catch (error) {
      console.error('Bracket trade error:', error.response?.data || error.message);
      setMessage({ type: 'error', text: error.response?.data?.message || error.message || 'Failed to place trade' });
    } finally {
      setPlacing(false);
    }
  };

  const quickAmounts = [1, 2, 3, 5, 10, 20];

  const formatTimeLeft = (expiresAt) => {
    const diff = new Date(expiresAt) - new Date();
    if (diff <= 0) return 'Expired';
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-screen bg-dark-900 text-white flex flex-col overflow-hidden">
      {/* Header Color Bar */}
      <div className={`bg-gradient-to-r ${game.color} h-1 flex-shrink-0`}></div>
      {/* Header */}
      <div className="bg-dark-800 border-b border-dark-600 flex-shrink-0">
        <div className="px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={onBack} className="p-2 hover:bg-dark-700 rounded-lg transition">
                <ArrowLeft size={20} />
              </button>
              <div className="flex items-center gap-2">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${game.color} flex items-center justify-center`}>
                  <game.icon size={20} />
                </div>
                <div>
                  <h1 className="font-bold">{game.name}</h1>
                  <p className="text-xs text-gray-400">{winMultiplier}x Returns • ±{bracketGap} pts</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {currentPrice && (
                <div className="bg-dark-700 rounded-lg px-3 py-1.5 text-right">
                  <div className="text-[10px] text-gray-400">Nifty</div>
                  <div className="font-bold text-cyan-400">{currentPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                </div>
              )}
              <div className="bg-dark-700 rounded-lg px-3 py-1.5 text-right">
                <div className="text-[10px] text-gray-400">Balance</div>
                <div className="font-bold text-purple-400">{balanceTokens} Tkt</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3-Column Desktop Layout */}
      <div className="px-3 py-2 flex-1 min-h-0 overflow-hidden">
        <div className="flex flex-col lg:flex-row gap-3 h-full">

          {/* LEFT COLUMN - Game Info + Active Trades */}
          <div className="lg:w-[260px] flex-shrink-0 order-1 lg:order-1 overflow-y-auto">
            {/* Bracket Info */}
            {currentPrice && (
              <div className="bg-dark-800 rounded-xl p-3 border border-cyan-500/30 mb-3">
                <div className="text-xs text-gray-400 mb-2 font-medium">Current Bracket Levels</div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between bg-green-900/20 rounded-lg p-2 border border-green-500/20">
                    <div className="flex items-center gap-1.5">
                      <ArrowUpCircle size={14} className="text-green-400" />
                      <span className="text-xs text-green-400 font-bold">BUY Target</span>
                    </div>
                    <span className="font-bold text-green-400">{upperTarget?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="text-center text-xs text-gray-500">
                    Entry: <span className="text-white font-bold">{currentPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex items-center justify-between bg-red-900/20 rounded-lg p-2 border border-red-500/20">
                    <div className="flex items-center gap-1.5">
                      <ArrowDownCircle size={14} className="text-red-400" />
                      <span className="text-xs text-red-400 font-bold">SELL Target</span>
                    </div>
                    <span className="font-bold text-red-400">{lowerTarget?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
                <div className="mt-2 text-[10px] text-gray-500 text-center">Gap: ±{bracketGap} pts • Expires: {expiryMinutes} min</div>
              </div>
            )}

            {/* Game Info Card */}
            <div className="bg-dark-800 rounded-xl p-4 border border-dark-600">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${game.color} flex items-center justify-center`}>
                  <game.icon size={24} />
                </div>
                <div>
                  <h3 className="font-bold">{game.name}</h3>
                  <p className="text-xs text-gray-400">{game.description}</p>
                </div>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between py-1 border-b border-dark-600">
                  <span className="text-gray-400">Win Multiplier</span>
                  <span className="text-green-400 font-bold">{winMultiplier}x</span>
                </div>
                <div className="flex justify-between py-1 border-b border-dark-600">
                  <span className="text-gray-400">Brokerage</span>
                  <span className="text-yellow-400 font-medium">{brokeragePercent}%</span>
                </div>
                <div className="flex justify-between py-1 border-b border-dark-600">
                  <span className="text-gray-400">Bracket Gap</span>
                  <span className="text-cyan-400 font-bold">±{bracketGap} pts</span>
                </div>
                <div className="flex justify-between py-1 border-b border-dark-600">
                  <span className="text-gray-400">Min Bet</span>
                  <span className="font-medium">{minBetTokens} Tickets</span>
                </div>
                <div className="flex justify-between py-1 border-b border-dark-600">
                  <span className="text-gray-400">Max Bet</span>
                  <span className="font-medium">{maxBetTokens} Tickets</span>
                </div>
                <div className="flex justify-between py-1 border-b border-dark-600">
                  <span className="text-gray-400">1 Ticket</span>
                  <span className="font-medium">₹{tokenValue}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-400">Expiry</span>
                  <span className="font-medium">{expiryMinutes} min</span>
                </div>
              </div>
              <div className="mt-2 bg-dark-700/50 rounded-lg p-2 text-[10px] text-gray-500">
                Win 1T bet → {winMultiplier} T gross - {((winMultiplier - 1) * brokeragePercent / 100).toFixed(2)} T fee = <span className="text-green-400 font-medium">{(winMultiplier - 1 - (winMultiplier - 1) * brokeragePercent / 100).toFixed(2)} T profit</span>
              </div>
            </div>

            {/* Active Trades */}
            {activeTrades.length > 0 && (
              <div className="mt-3 bg-dark-800 rounded-xl p-3 border border-yellow-500/30">
                <h3 className="font-bold text-xs text-yellow-400 mb-2 flex items-center gap-1.5">
                  <RefreshCw size={12} className="animate-spin" />
                  Active Trades ({activeTrades.length})
                </h3>
                <div className="space-y-1.5">
                  {activeTrades.map(trade => (
                    <div key={trade._id} className="bg-dark-700 rounded-lg p-2 text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                          trade.prediction === 'BUY' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                        }`}>{trade.prediction}</span>
                        <span className="text-gray-400">{toTokens(trade.amount)} T</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-gray-500">
                        <span>{trade.lowerTarget} ↔ {trade.upperTarget}</span>
                        <span className="text-yellow-400">{formatTimeLeft(trade.expiresAt)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Trade History */}
            <div className="bg-dark-800 rounded-xl p-3 border border-dark-600 mt-3">
              <h3 className="font-bold text-xs mb-2 flex items-center gap-1.5">
                <Clock size={12} className="text-gray-400" />
                History
              </h3>
              {tradeHistory.length === 0 ? (
                <p className="text-gray-500 text-[10px] text-center py-2">No trades yet</p>
              ) : (
                <div className="space-y-1 max-h-[200px] overflow-y-auto">
                  {tradeHistory.map((t, idx) => (
                    <div key={t._id || idx} className={`flex items-center justify-between p-2 rounded-lg text-xs ${
                      t.status === 'won' ? 'bg-green-900/20' :
                      t.status === 'lost' ? 'bg-red-900/20' :
                      t.status === 'expired' ? 'bg-gray-800' :
                      'bg-dark-700'
                    }`}>
                      <div>
                        <span className={`font-bold text-[10px] ${t.prediction === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>{t.prediction}</span>
                        <span className="text-gray-400 ml-1">{toTokens(t.amount)} T</span>
                      </div>
                      <div className="text-right">
                        {t.status === 'won' && <span className="text-green-400 font-bold">+{toTokens(t.profit)} T</span>}
                        {t.status === 'lost' && <span className="text-red-400 font-bold">-{toTokens(t.amount)} T</span>}
                        {t.status === 'expired' && <span className="text-gray-400 font-medium">Refunded</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* CENTER COLUMN - Nifty Chart */}
          <div className="flex-1 min-w-0 order-2 lg:order-2 flex flex-col">
            <TradingChart gameId="updown" fullHeight onPriceUpdate={(p) => setCurrentPrice(p)} />
          </div>

          {/* RIGHT COLUMN - Betting Controls */}
          <div className="lg:w-[300px] flex-shrink-0 order-3 lg:order-3 flex flex-col h-full overflow-hidden">
            {/* Message */}
            {message && (
              <div className={`p-2 rounded-lg text-xs font-medium mb-2 ${
                message.type === 'success' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                message.type === 'info' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                'bg-red-500/20 text-red-400 border border-red-500/30'
              }`}>
                {message.text}
              </div>
            )}

            <div className="space-y-3 flex-shrink-0">
              {/* Bet Amount */}
              <div className="bg-dark-800 rounded-xl p-4 border border-dark-600">
                <label className="block text-sm text-gray-400 mb-2">Enter Tickets</label>
                <input
                  type="number"
                  value={betAmount}
                  onChange={e => setBetAmount(e.target.value)}
                  placeholder={`${minBetTokens} - ${maxBetTokens} Tickets`}
                  min={minBetTokens}
                  max={maxBetTokens}
                  step="0.01"
                  className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2.5 text-xl font-bold text-center focus:border-cyan-500 focus:outline-none"
                />
                <div className="text-[10px] text-gray-500 mt-1 text-center">Min {minBetTokens} • Max {maxBetTokens} Tickets (1Tkt = ₹{tokenValue})</div>
                <div className="grid grid-cols-3 gap-1.5 mt-2">
                  {quickAmounts.map(amt => (
                    <button
                      key={amt}
                      onClick={() => setBetAmount(amt.toString())}
                      className="py-1.5 bg-dark-700 hover:bg-dark-600 rounded-lg text-xs font-medium transition"
                    >
                      {amt} T
                    </button>
                  ))}
                </div>
              </div>

              {/* Bracket Display + BUY/SELL */}
              <div className="bg-dark-800 rounded-xl p-4 border border-dark-600">
                <label className="block text-sm text-gray-400 mb-2">Pick Your Side</label>
                {!currentPrice ? (
                  <div className="text-center py-4">
                    <RefreshCw className="animate-spin text-cyan-400 mx-auto mb-2" size={20} />
                    <p className="text-xs text-gray-500">Waiting for live price...</p>
                  </div>
                ) : (
                  <>
                    {/* Upper Target - BUY */}
                    <button
                      onClick={() => handlePlaceTrade('BUY')}
                      disabled={!betAmount || parseFloat(betAmount) <= 0 || placing || !currentPrice}
                      className={`w-full p-3 rounded-xl border-2 transition-all mb-2 ${
                        betAmount && parseFloat(betAmount) > 0 && currentPrice
                          ? 'border-green-500/50 bg-green-900/20 hover:bg-green-900/40 hover:border-green-500'
                          : 'border-dark-600 opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ArrowUpCircle size={22} className="text-green-400" />
                          <div className="text-left">
                            <div className="font-bold text-green-400 text-sm">BUY</div>
                            <div className="text-[10px] text-gray-400">Price hits {upperTarget?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-green-400 font-bold text-sm">{winMultiplier}x</div>
                        </div>
                      </div>
                    </button>

                    {/* Current Price */}
                    <div className="text-center py-1.5 text-xs text-gray-500">
                      Current: <span className="text-white font-bold text-sm">{currentPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      <span className="text-cyan-400 ml-1">(±{bracketGap})</span>
                    </div>

                    {/* Lower Target - SELL */}
                    <button
                      onClick={() => handlePlaceTrade('SELL')}
                      disabled={!betAmount || parseFloat(betAmount) <= 0 || placing || !currentPrice}
                      className={`w-full p-3 rounded-xl border-2 transition-all ${
                        betAmount && parseFloat(betAmount) > 0 && currentPrice
                          ? 'border-red-500/50 bg-red-900/20 hover:bg-red-900/40 hover:border-red-500'
                          : 'border-dark-600 opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ArrowDownCircle size={22} className="text-red-400" />
                          <div className="text-left">
                            <div className="font-bold text-red-400 text-sm">SELL</div>
                            <div className="text-[10px] text-gray-400">Price hits {lowerTarget?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-red-400 font-bold text-sm">{winMultiplier}x</div>
                        </div>
                      </div>
                    </button>
                  </>
                )}
              </div>

              {/* Expiry Info */}
              <div className="bg-dark-800/50 rounded-lg p-2 text-[10px] text-gray-500 text-center">
                <Timer size={10} className="inline mr-1" />
                Trade expires in {expiryMinutes} min if neither target is hit (amount refunded)
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

// ==================== NIFTY JACKPOT SCREEN ====================
const NiftyJackpotScreen = ({ game, balance, onBack, user, refreshBalance, settings, tokenValue = 300 }) => {
  const [bidAmount, setBidAmount] = useState('');
  const [todayBid, setTodayBid] = useState(null);
  const [hasBid, setHasBid] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [myRank, setMyRank] = useState(null);
  const [totalBids, setTotalBids] = useState(0);
  const [bidHistory, setBidHistory] = useState([]);
  const [placing, setPlacing] = useState(false);
  const [loadingBid, setLoadingBid] = useState(true);
  const [message, setMessage] = useState(null);

  // Admin-configured settings with fallbacks
  const topWinners = settings?.topWinners || 10;
  const prizeDistribution = settings?.prizeDistribution || [45000, 10000, 8000, 6000, 5000, 4000, 3000, 2000, 1500, 1000];
  const brokeragePercent = settings?.brokeragePercent || 5;
  const minBetRs = settings?.minBet || 100;
  const maxBetRs = settings?.maxBet || 50000;
  const gameEnabled = settings?.enabled !== false;

  // Ticket conversion helpers
  const toTokens = (rs) => parseFloat((rs / tokenValue).toFixed(2));
  const toRupees = (tokens) => parseFloat((tokens * tokenValue).toFixed(2));
  const balanceTokens = toTokens(balance);
  const minBetTokens = toTokens(minBetRs);
  const maxBetTokens = toTokens(maxBetRs);

  // Calculate prize for a given rank (from prizeDistribution array)
  const getPrize = (rank) => rank >= 1 && rank <= prizeDistribution.length ? prizeDistribution[rank - 1] : 0;
  const getNetPrize = (rank) => {
    const prize = getPrize(rank);
    return prize - (prize * brokeragePercent / 100);
  };

  useEffect(() => {
    fetchTodayBid();
    fetchLeaderboard();
    fetchHistory();
    // Refresh leaderboard every 15 seconds
    const interval = setInterval(fetchLeaderboard, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchTodayBid = async () => {
    try {
      const { data } = await axios.get('/api/user/nifty-jackpot/today', {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      setHasBid(data.hasBid);
      setTodayBid(data.bid);
    } catch (error) {
      console.error('Error fetching today bid:', error);
    } finally {
      setLoadingBid(false);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const { data } = await axios.get('/api/user/nifty-jackpot/leaderboard', {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      setLeaderboard(data.leaderboard || []);
      setMyRank(data.myRank);
      setTotalBids(data.totalBids || 0);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    }
  };

  const fetchHistory = async () => {
    try {
      const { data } = await axios.get('/api/user/nifty-jackpot/history', {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      setBidHistory(data);
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  };

  const handlePlaceBid = async () => {
    if (!bidAmount) return;
    const tokenAmt = parseFloat(bidAmount);
    const amt = toRupees(tokenAmt);
    if (tokenAmt < minBetTokens) { setMessage({ type: 'error', text: `Minimum bid is ${minBetTokens} tickets` }); return; }
    if (tokenAmt > maxBetTokens) { setMessage({ type: 'error', text: `Maximum bid is ${maxBetTokens} tickets` }); return; }
    if (amt > balance) { setMessage({ type: 'error', text: 'Insufficient balance' }); return; }
    if (!gameEnabled) { setMessage({ type: 'error', text: 'Game is currently disabled' }); return; }

    setPlacing(true);
    setMessage(null);
    try {
      const { data } = await axios.post('/api/user/nifty-jackpot/bid', {
        amount: amt
      }, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      setHasBid(true);
      setTodayBid(data.bid);
      setMessage({ type: 'success', text: `Bid of ${tokenAmt} tickets placed!` });
      refreshBalance();
      fetchLeaderboard();
      fetchHistory();
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to place bid' });
    } finally {
      setPlacing(false);
    }
  };

  const quickAmounts = [2, 5, 10, 20, 50, 100];

  // Top 10 for achievements section
  const top10 = leaderboard.slice(0, 10);

  return (
    <div className="h-screen bg-dark-900 text-white flex flex-col overflow-hidden">
      {/* Header Color Bar */}
      <div className={`bg-gradient-to-r ${game.color} h-1 flex-shrink-0`}></div>
      {/* Header */}
      <div className="bg-dark-800 border-b border-dark-600 flex-shrink-0">
        <div className="px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={onBack} className="p-2 hover:bg-dark-700 rounded-lg transition">
                <ArrowLeft size={20} />
              </button>
              <div className="flex items-center gap-2">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${game.color} flex items-center justify-center`}>
                  <game.icon size={20} />
                </div>
                <div>
                  <h1 className="font-bold">{game.name}</h1>
                  <p className="text-xs text-gray-400">Top {topWinners} win prizes!</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {myRank && (
                <div className="bg-yellow-900/30 border border-yellow-500/30 rounded-lg px-3 py-1.5 text-right">
                  <div className="text-[10px] text-yellow-400">Your Rank</div>
                  <div className="font-bold text-yellow-400">#{myRank}</div>
                </div>
              )}
              <div className="bg-dark-700 rounded-lg px-3 py-1.5 text-right">
                <div className="text-[10px] text-gray-400">Balance</div>
                <div className="font-bold text-purple-400">{balanceTokens} Tkt</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3-Column Layout */}
      <div className="px-3 py-2 flex-1 min-h-0 overflow-hidden">
        <div className="flex flex-col lg:flex-row gap-3 h-full">

          {/* LEFT COLUMN - Game Info + Achievements + History */}
          <div className="lg:w-[280px] flex-shrink-0 order-1 lg:order-1 overflow-y-auto space-y-3">

            {/* Achievements / Live Top 10 */}
            <div className="bg-dark-800 rounded-xl p-3 border border-yellow-500/30">
              <h3 className="font-bold text-xs mb-2 flex items-center gap-1.5 text-yellow-400">
                <Crown size={14} />
                LIVE TOP 10
              </h3>
              {top10.length === 0 ? (
                <p className="text-gray-500 text-[10px] text-center py-3">No bids yet today</p>
              ) : (
                <div className="space-y-1">
                  {top10.map((entry, idx) => {
                    const isMe = entry.userId?.toString() === user._id?.toString() || entry.userId === user._id;
                    return (
                      <div key={idx} className={`flex items-center justify-between p-2 rounded-lg text-xs ${
                        isMe ? 'bg-yellow-900/30 border border-yellow-500/20' :
                        idx < 3 ? 'bg-dark-700/80' : 'bg-dark-700/40'
                      }`}>
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                            idx === 0 ? 'bg-yellow-500 text-black' :
                            idx === 1 ? 'bg-gray-300 text-black' :
                            idx === 2 ? 'bg-orange-600 text-white' :
                            'bg-dark-600 text-gray-400'
                          }`}>
                            {idx + 1}
                          </div>
                          <div>
                            <div className={`font-medium ${isMe ? 'text-yellow-400' : 'text-white'}`}>
                              {isMe ? 'You' : entry.name}
                            </div>
                            <div className="text-[10px] text-gray-500">{toTokens(entry.amount)} T</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-green-400 font-bold text-[10px]">{toTokens(entry.prize)} T</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="mt-2 text-center text-[10px] text-gray-500">
                {totalBids} total bidder{totalBids !== 1 ? 's' : ''} today
              </div>
            </div>

            {/* Prize Structure */}
            <div className="bg-dark-800 rounded-xl p-3 border border-dark-600">
              <h3 className="font-bold text-xs mb-2 flex items-center gap-1.5">
                <Award size={12} className="text-yellow-400" />
                Prize Structure ({brokeragePercent}% brokerage)
              </h3>
              <div className="space-y-1 text-xs max-h-[200px] overflow-y-auto">
                {prizeDistribution.map((prize, idx) => (
                  <div key={idx} className="flex justify-between py-1 border-b border-dark-600">
                    <span className="text-gray-400">#{idx + 1}</span>
                    <div className="text-right">
                      <span className="text-green-400 font-bold">{toTokens(getNetPrize(idx + 1))} T</span>
                      <span className="text-gray-600 text-[10px] ml-1">({toTokens(prize)} - {brokeragePercent}%)</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="space-y-1 text-xs mt-1">
                <div className="flex justify-between py-1 border-b border-dark-600">
                  <span className="text-gray-400">Top Winners</span>
                  <span className="text-yellow-400 font-bold">{topWinners}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-400">Result At</span>
                  <span className="font-medium">{settings?.resultTime || '15:30'} IST</span>
                </div>
              </div>
            </div>

            {/* Bid History */}
            <div className="bg-dark-800 rounded-xl p-3 border border-dark-600">
              <h3 className="font-bold text-xs mb-2 flex items-center gap-1.5">
                <Clock size={12} className="text-gray-400" />
                Your History
              </h3>
              {bidHistory.length === 0 ? (
                <p className="text-gray-500 text-[10px] text-center py-2">No bids yet</p>
              ) : (
                <div className="space-y-1 max-h-[160px] overflow-y-auto">
                  {bidHistory.map((bid, idx) => (
                    <div key={bid._id || idx} className={`flex items-center justify-between p-2 rounded-lg text-xs ${
                      bid.status === 'won' ? 'bg-green-900/20' :
                      bid.status === 'lost' ? 'bg-red-900/20' :
                      'bg-dark-700'
                    }`}>
                      <div>
                        <div className="text-[10px] text-gray-500">{bid.betDate}</div>
                        <div className="font-bold">{toTokens(bid.amount)} T {bid.rank ? `#${bid.rank}` : ''}</div>
                      </div>
                      <div className="text-right">
                        {bid.status === 'pending' && <span className="text-yellow-400 font-medium">Pending</span>}
                        {bid.status === 'won' && <span className="text-green-400 font-bold">+{toTokens(bid.prize)} T</span>}
                        {bid.status === 'lost' && <span className="text-red-400 font-bold">-{toTokens(bid.amount)} T</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* CENTER COLUMN - Nifty Chart */}
          <div className="flex-1 min-w-0 order-2 lg:order-2 flex flex-col">
            <TradingChart gameId="updown" fullHeight />
          </div>

          {/* RIGHT COLUMN - Bid Controls + Your Status */}
          <div className="lg:w-[300px] flex-shrink-0 order-3 lg:order-3 flex flex-col h-full overflow-hidden">
            {/* Message */}
            {message && (
              <div className={`p-2 rounded-lg text-xs font-medium mb-2 ${message.type === 'success' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                {message.text}
              </div>
            )}

            {hasBid && todayBid ? (
              /* Already bid today - show status */
              <div className="space-y-3 overflow-y-auto flex-1">
                {/* Your Bid Status */}
                <div className={`rounded-xl p-4 border ${
                  todayBid.status === 'won' ? 'bg-green-900/20 border-green-500/30' :
                  todayBid.status === 'lost' ? 'bg-red-900/20 border-red-500/30' :
                  'bg-yellow-900/20 border-yellow-500/30'
                }`}>
                  <div className="text-center">
                    <div className={`w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center ${
                      todayBid.status === 'pending' ? 'bg-yellow-500/20' :
                      todayBid.status === 'won' ? 'bg-green-500/20' : 'bg-red-500/20'
                    }`}>
                      {todayBid.status === 'pending' && <Clock size={28} className="text-yellow-400" />}
                      {todayBid.status === 'won' && <Trophy size={28} className="text-green-400" />}
                      {todayBid.status === 'lost' && <X size={28} className="text-red-400" />}
                    </div>
                    <div className="text-2xl font-bold text-yellow-400 mb-1">{toTokens(todayBid.amount)} Tickets</div>
                    <div className="text-gray-400 text-sm mb-1">Your Bid</div>
                    {myRank && (
                      <div className={`text-lg font-bold ${myRank <= topWinners ? 'text-green-400' : 'text-red-400'}`}>
                        Rank #{myRank} {myRank <= topWinners ? '🏆' : ''}
                      </div>
                    )}
                    {myRank && myRank <= topWinners && (
                      <div className="text-green-400 text-sm font-medium mt-1">
                        Prize: {toTokens(getNetPrize(myRank))} T <span className="text-gray-500 text-[10px]">(after {brokeragePercent}% fee)</span>
                      </div>
                    )}
                    {todayBid.status === 'pending' && (
                      <div className="text-yellow-400 text-xs font-medium mt-2">Result at {settings?.resultTime || '15:30'} IST</div>
                    )}
                    {todayBid.status === 'won' && todayBid.prize > 0 && (
                      <div className="text-green-400 text-lg font-bold mt-1">Won {toTokens(todayBid.prize)} Tickets!</div>
                    )}
                    {todayBid.status === 'lost' && (
                      <div className="text-red-400 text-sm mt-1">Better luck tomorrow!</div>
                    )}
                  </div>
                </div>

                {/* Live Leaderboard (full) */}
                <div className="bg-dark-800 rounded-xl p-3 border border-dark-600">
                  <h3 className="font-bold text-xs mb-2 flex items-center gap-1.5">
                    <Medal size={12} className="text-yellow-400" />
                    Full Leaderboard ({totalBids} bidders)
                  </h3>
                  <div className="space-y-1 max-h-[300px] overflow-y-auto">
                    {leaderboard.map((entry, idx) => {
                      const isMe = entry.userId?.toString() === user._id?.toString() || entry.userId === user._id;
                      return (
                        <div key={idx} className={`flex items-center justify-between p-1.5 rounded-lg text-[11px] ${
                          isMe ? 'bg-yellow-900/30 border border-yellow-500/20' :
                          entry.isWinner ? 'bg-green-900/10' : 'bg-dark-700/30'
                        }`}>
                          <div className="flex items-center gap-1.5">
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                              idx === 0 ? 'bg-yellow-500 text-black' :
                              idx === 1 ? 'bg-gray-300 text-black' :
                              idx === 2 ? 'bg-orange-600 text-white' :
                              entry.isWinner ? 'bg-green-900/50 text-green-400' :
                              'bg-dark-600 text-gray-500'
                            }`}>{entry.rank}</span>
                            <span className={isMe ? 'text-yellow-400 font-bold' : 'text-gray-300'}>{isMe ? 'You' : entry.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-400">{toTokens(entry.amount)} T</span>
                            {entry.isWinner && <span className="text-green-400 font-bold">{toTokens(entry.prize)} T</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              /* Bidding UI */
              <div className="space-y-3 overflow-y-auto flex-1">
                {/* How It Works */}
                <div className="bg-yellow-900/10 border border-yellow-500/20 rounded-xl p-3">
                  <h3 className="text-xs font-bold text-yellow-400 mb-1.5 flex items-center gap-1.5">
                    <Info size={12} />
                    How It Works
                  </h3>
                  <ul className="text-[10px] text-gray-400 space-y-1">
                    <li>• Place your bid — higher bids rank higher</li>
                    <li>• Top {topWinners} bidders win prizes</li>
                    <li>• 1st gets {toTokens(getNetPrize(1))} T net (after {brokeragePercent}% fee)</li>
                    <li>• Results declared at {settings?.resultTime || '15:30'} IST</li>
                  </ul>
                </div>

                {/* Bid Amount */}
                <div className="bg-dark-800 rounded-xl p-3 border border-dark-600">
                  <label className="block text-xs text-gray-400 mb-1.5 font-medium">Your Bid (Tickets)</label>
                  <input
                    type="number"
                    value={bidAmount}
                    onChange={e => setBidAmount(e.target.value)}
                    placeholder={`${minBetTokens} - ${maxBetTokens} Tickets`}
                    min={minBetTokens}
                    max={maxBetTokens}
                    step="0.01"
                    className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-3 text-xl font-bold text-center focus:border-yellow-500 focus:outline-none"
                  />
                  <div className="text-[10px] text-gray-500 mt-1 text-center">Min {minBetTokens} • Max {maxBetTokens} Tickets (1Tkt = ₹{tokenValue})</div>
                  <div className="grid grid-cols-3 gap-1.5 mt-2">
                    {quickAmounts.map(amt => (
                      <button
                        key={amt}
                        onClick={() => setBidAmount(amt.toString())}
                        className="py-2 bg-dark-700 hover:bg-dark-600 rounded-lg text-xs font-medium transition"
                      >
                        {amt} T
                      </button>
                    ))}
                  </div>
                </div>

                {/* Estimated Rank */}
                {bidAmount && parseFloat(bidAmount) > 0 && (
                  <div className="bg-dark-800 rounded-xl p-3 border border-dark-600 text-center">
                    <div className="text-[10px] text-gray-400 mb-1">Estimated Rank</div>
                    {(() => {
                      const tokenAmt = parseFloat(bidAmount);
                      const amt = toRupees(tokenAmt);
                      const higherCount = leaderboard.filter(e => e.amount > amt).length;
                      const estRank = higherCount + 1;
                      const estNetPrize = getNetPrize(estRank);
                      return (
                        <>
                          <div className={`text-2xl font-bold ${estRank <= topWinners ? 'text-green-400' : 'text-red-400'}`}>
                            #{estRank}
                          </div>
                          {estRank <= topWinners ? (
                            <div className="text-green-400 text-xs font-medium">Est. Prize: {toTokens(estNetPrize)} T <span className="text-gray-500">(after {brokeragePercent}% fee)</span></div>
                          ) : (
                            <div className="text-red-400 text-xs">Outside top {topWinners} — increase bid!</div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* Place Bid Button */}
                <button
                  onClick={handlePlaceBid}
                  disabled={!bidAmount || parseFloat(bidAmount) <= 0 || placing}
                  className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${
                    bidAmount && parseFloat(bidAmount) > 0
                      ? 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-black'
                      : 'bg-dark-700 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {placing ? (
                    <span className="flex items-center justify-center gap-2"><RefreshCw size={16} className="animate-spin" /> Placing...</span>
                  ) : bidAmount && parseFloat(bidAmount) > 0 ? (
                    `Place Bid ${parseFloat(bidAmount)} Tokens`
                  ) : (
                    'Enter Bid Amount'
                  )}
                </button>

                {/* Tip */}
                <div className="bg-dark-800/50 rounded-lg p-2 text-[10px] text-gray-500 text-center">
                  <Zap size={10} className="inline mr-1 text-yellow-400" />
                  Tip: Bid higher to rank higher and win bigger prizes!
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default UserGames;
