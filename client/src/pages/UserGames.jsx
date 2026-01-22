import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  ArrowLeft, TrendingUp, TrendingDown, Hash, Trophy, Target, 
  Clock, Users, Coins, Gamepad2, Zap, Star, Gift, ChevronRight,
  ArrowUpCircle, ArrowDownCircle, RefreshCw, X, Check, AlertCircle, Bitcoin
} from 'lucide-react';

const UserGames = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [gamesBalance, setGamesBalance] = useState(0);
  const [activeGame, setActiveGame] = useState(null);
  const [loading, setLoading] = useState(true);

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
      id: 'number',
      name: 'Nifty Number',
      description: 'Guess the last digit of Nifty closing price',
      icon: Hash,
      color: 'from-blue-600 to-cyan-600',
      bgColor: 'bg-blue-900/20',
      borderColor: 'border-blue-500/30',
      prize: '9x Returns',
      players: '856',
      timeframe: '5 Min'
    },
    {
      id: 'jackpot',
      name: 'Nifty Jackpot',
      description: 'Pick your lucky number and win big jackpot prizes',
      icon: Trophy,
      color: 'from-yellow-600 to-orange-600',
      bgColor: 'bg-yellow-900/20',
      borderColor: 'border-yellow-500/30',
      prize: '100x Jackpot',
      players: '2.5K',
      timeframe: '15 Min'
    },
    {
      id: 'bracket',
      name: 'Nifty Bracket',
      description: 'Predict the price range where Nifty will close',
      icon: Target,
      color: 'from-purple-600 to-pink-600',
      bgColor: 'bg-purple-900/20',
      borderColor: 'border-purple-500/30',
      prize: '5x Returns',
      players: '945',
      timeframe: '3 Min'
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
    return (
      <GameScreen 
        game={games.find(g => g.id === activeGame)} 
        balance={gamesBalance}
        onBack={() => setActiveGame(null)}
        user={user}
        refreshBalance={fetchGamesBalance}
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
              <div className="font-bold text-purple-400">₹{gamesBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
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
              { name: 'Pr***ya', game: 'Nifty Jackpot', amount: 25000, time: '5 min ago' },
              { name: 'Am***an', game: 'Nifty Bracket', amount: 8500, time: '8 min ago' },
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

// Individual Game Screen Component
const GameScreen = ({ game, balance, onBack, user, refreshBalance }) => {
  const [betAmount, setBetAmount] = useState('');
  const [prediction, setPrediction] = useState(null);
  const [timeLeft, setTimeLeft] = useState(60);
  const [gameState, setGameState] = useState('betting'); // betting, waiting, result
  const [result, setResult] = useState(null);

  // Timer countdown
  useEffect(() => {
    if (gameState === 'waiting' && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            // Simulate result (will be replaced with actual logic)
            setGameState('result');
            setResult({ won: Math.random() > 0.5, amount: parseFloat(betAmount) * 2 });
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [gameState, timeLeft]);

  const quickAmounts = [100, 500, 1000, 5000];

  const handlePlaceBet = () => {
    if (!betAmount || parseFloat(betAmount) <= 0 || !prediction) return;
    if (parseFloat(betAmount) > balance) {
      alert('Insufficient balance');
      return;
    }
    setGameState('waiting');
    setTimeLeft(game.id === 'updown' || game.id === 'btcupdown' ? 60 : game.id === 'number' ? 300 : game.id === 'jackpot' ? 900 : 180);
  };

  const resetGame = () => {
    setBetAmount('');
    setPrediction(null);
    setGameState('betting');
    setResult(null);
    setTimeLeft(60);
  };

  return (
    <div className="min-h-screen bg-dark-900 text-white">
      {/* Header */}
      <div className={`bg-gradient-to-r ${game.color} py-1`}></div>
      <div className="bg-dark-800 border-b border-dark-600">
        <div className="max-w-2xl mx-auto px-4 py-4">
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
                  <p className="text-xs text-gray-400">{game.prize}</p>
                </div>
              </div>
            </div>
            <div className="bg-dark-700 rounded-lg px-3 py-1.5">
              <div className="text-xs text-gray-400">Balance</div>
              <div className="font-bold text-purple-400">₹{balance.toLocaleString()}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Live Price */}
        <div className="bg-dark-800 rounded-2xl p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">{game.id === 'btcupdown' ? 'BTC/USDT Live' : 'NIFTY 50 Live'}</span>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-xs text-green-400">LIVE</span>
            </div>
          </div>
          <div className="text-3xl font-bold">{game.id === 'btcupdown' ? '$104,250.50' : '24,850.75'}</div>
          <div className="text-green-400 text-sm">{game.id === 'btcupdown' ? '+$1,250.00 (1.21%)' : '+125.50 (0.51%)'}</div>
        </div>

        {/* Game Content Based on State */}
        {gameState === 'betting' && (
          <>
            {/* Bet Amount */}
            <div className="bg-dark-800 rounded-2xl p-5 mb-4">
              <label className="block text-sm text-gray-400 mb-3">Enter Amount</label>
              <input
                type="number"
                value={betAmount}
                onChange={e => setBetAmount(e.target.value)}
                placeholder="₹0"
                className="w-full bg-dark-700 border border-dark-600 rounded-xl px-4 py-3 text-2xl font-bold text-center focus:border-purple-500 focus:outline-none"
              />
              <div className="flex gap-2 mt-3">
                {quickAmounts.map(amt => (
                  <button
                    key={amt}
                    onClick={() => setBetAmount(amt.toString())}
                    className="flex-1 py-2 bg-dark-700 hover:bg-dark-600 rounded-lg text-sm font-medium transition"
                  >
                    ₹{amt}
                  </button>
                ))}
              </div>
            </div>

            {/* Prediction Selection */}
            <div className="bg-dark-800 rounded-2xl p-5 mb-4">
              <label className="block text-sm text-gray-400 mb-3">Make Your Prediction</label>
              
              {(game.id === 'updown' || game.id === 'btcupdown') && (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setPrediction('UP')}
                    className={`p-6 rounded-xl border-2 transition-all ${
                      prediction === 'UP' 
                        ? 'border-green-500 bg-green-500/20' 
                        : 'border-dark-600 hover:border-green-500/50'
                    }`}
                  >
                    <ArrowUpCircle size={40} className={`mx-auto mb-2 ${prediction === 'UP' ? 'text-green-400' : 'text-gray-400'}`} />
                    <div className="font-bold text-lg">UP</div>
                    <div className="text-xs text-gray-400">2x Returns</div>
                  </button>
                  <button
                    onClick={() => setPrediction('DOWN')}
                    className={`p-6 rounded-xl border-2 transition-all ${
                      prediction === 'DOWN' 
                        ? 'border-red-500 bg-red-500/20' 
                        : 'border-dark-600 hover:border-red-500/50'
                    }`}
                  >
                    <ArrowDownCircle size={40} className={`mx-auto mb-2 ${prediction === 'DOWN' ? 'text-red-400' : 'text-gray-400'}`} />
                    <div className="font-bold text-lg">DOWN</div>
                    <div className="text-xs text-gray-400">2x Returns</div>
                  </button>
                </div>
              )}

              {game.id === 'number' && (
                <div className="grid grid-cols-5 gap-2">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                    <button
                      key={num}
                      onClick={() => setPrediction(num.toString())}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        prediction === num.toString()
                          ? 'border-blue-500 bg-blue-500/20'
                          : 'border-dark-600 hover:border-blue-500/50'
                      }`}
                    >
                      <div className="text-2xl font-bold">{num}</div>
                    </button>
                  ))}
                </div>
              )}

              {game.id === 'jackpot' && (
                <div className="grid grid-cols-5 gap-2">
                  {Array.from({ length: 20 }, (_, i) => i + 1).map(num => (
                    <button
                      key={num}
                      onClick={() => setPrediction(num.toString())}
                      className={`p-3 rounded-xl border-2 transition-all ${
                        prediction === num.toString()
                          ? 'border-yellow-500 bg-yellow-500/20'
                          : 'border-dark-600 hover:border-yellow-500/50'
                      }`}
                    >
                      <div className="text-lg font-bold">{num}</div>
                    </button>
                  ))}
                </div>
              )}

              {game.id === 'bracket' && (
                <div className="space-y-2">
                  {[
                    { range: '24800-24825', multiplier: '5x' },
                    { range: '24825-24850', multiplier: '5x' },
                    { range: '24850-24875', multiplier: '5x' },
                    { range: '24875-24900', multiplier: '5x' },
                    { range: '24900-24925', multiplier: '5x' },
                  ].map(bracket => (
                    <button
                      key={bracket.range}
                      onClick={() => setPrediction(bracket.range)}
                      className={`w-full p-4 rounded-xl border-2 flex items-center justify-between transition-all ${
                        prediction === bracket.range
                          ? 'border-purple-500 bg-purple-500/20'
                          : 'border-dark-600 hover:border-purple-500/50'
                      }`}
                    >
                      <span className="font-bold">{bracket.range}</span>
                      <span className="text-purple-400">{bracket.multiplier}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Place Bet Button */}
            <button
              onClick={handlePlaceBet}
              disabled={!betAmount || !prediction || parseFloat(betAmount) <= 0}
              className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
                betAmount && prediction && parseFloat(betAmount) > 0
                  ? `bg-gradient-to-r ${game.color} hover:opacity-90`
                  : 'bg-dark-700 text-gray-500 cursor-not-allowed'
              }`}
            >
              {betAmount && prediction ? `Place Bet - ₹${parseFloat(betAmount).toLocaleString()}` : 'Select Amount & Prediction'}
            </button>
          </>
        )}

        {gameState === 'waiting' && (
          <div className="bg-dark-800 rounded-2xl p-8 text-center">
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
              <span className="text-3xl font-bold">{timeLeft}</span>
            </div>
            <h3 className="text-xl font-bold mb-2">Waiting for Result</h3>
            <p className="text-gray-400 mb-4">Your prediction: <span className="text-white font-bold">{prediction}</span></p>
            <p className="text-gray-400">Bet Amount: <span className="text-purple-400 font-bold">₹{parseFloat(betAmount).toLocaleString()}</span></p>
            
            <div className="mt-6 flex items-center justify-center gap-2">
              <RefreshCw className="animate-spin text-purple-400" size={20} />
              <span className="text-sm text-gray-400">Game in progress...</span>
            </div>
          </div>
        )}

        {gameState === 'result' && result && (
          <div className="bg-dark-800 rounded-2xl p-8 text-center">
            <div className={`w-24 h-24 mx-auto mb-6 rounded-full flex items-center justify-center ${
              result.won ? 'bg-green-500/20' : 'bg-red-500/20'
            }`}>
              {result.won ? (
                <Check size={48} className="text-green-400" />
              ) : (
                <X size={48} className="text-red-400" />
              )}
            </div>
            
            <h3 className={`text-2xl font-bold mb-2 ${result.won ? 'text-green-400' : 'text-red-400'}`}>
              {result.won ? 'You Won!' : 'Better Luck Next Time'}
            </h3>
            
            {result.won && (
              <p className="text-3xl font-bold text-green-400 mb-4">
                +₹{result.amount.toLocaleString()}
              </p>
            )}
            
            <p className="text-gray-400 mb-6">Your prediction: {prediction}</p>
            
            <button
              onClick={resetGame}
              className={`w-full py-4 rounded-xl font-bold bg-gradient-to-r ${game.color}`}
            >
              Play Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserGames;
