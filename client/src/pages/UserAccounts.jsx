import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Wallet, Plus, Minus, RefreshCw, IndianRupee, MoreHorizontal, X, ArrowRight, ArrowLeftRight, Bitcoin, DollarSign, Gem, Gamepad2
} from 'lucide-react';

const UserAccounts = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [walletData, setWalletData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferDirection, setTransferDirection] = useState('toAccount'); // 'toAccount' or 'toWallet'
  const [showCryptoTransferModal, setShowCryptoTransferModal] = useState(false);
  const [cryptoTransferDirection, setCryptoTransferDirection] = useState('toCrypto'); // 'toCrypto' or 'fromCrypto'
  const [showMcxTransferModal, setShowMcxTransferModal] = useState(false);
  const [mcxTransferDirection, setMcxTransferDirection] = useState('toMcx'); // 'toMcx' or 'fromMcx'
  const [showGamesTransferModal, setShowGamesTransferModal] = useState(false);
  const [gamesTransferDirection, setGamesTransferDirection] = useState('toGames'); // 'toGames' or 'fromGames'

  useEffect(() => {
    fetchWallet();
  }, []);

  const fetchWallet = async () => {
    try {
      const { data } = await axios.get('/api/user/wallet', {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      setWalletData(data);
    } catch (error) {
      console.error('Error fetching wallet:', error);
    } finally {
      setLoading(false);
    }
  };

  const openTraderRoom = () => {
    navigate('/user/trader-room');
  };

  const openTransfer = (direction) => {
    setTransferDirection(direction);
    setShowTransferModal(true);
  };

  // Main wallet balance (for deposit/withdraw with admin)
  // API returns data at top level and also in wallet object
  const mainWalletBalance = walletData?.cashBalance || walletData?.wallet?.cashBalance || walletData?.wallet?.balance || 0;
  // Trading account balance (used for trading)
  const tradingAccountBalance = walletData?.tradingBalance || walletData?.wallet?.tradingBalance || 0;
  const usedMargin = walletData?.usedMargin || walletData?.wallet?.usedMargin || walletData?.wallet?.blocked || 0;
  const availableTradingBalance = tradingAccountBalance - usedMargin;
  
  // Crypto wallet balance (USDT for crypto trading)
  const cryptoBalance = walletData?.cryptoWallet?.balance || 0;
  const cryptoRealizedPnL = walletData?.cryptoWallet?.realizedPnL || 0;

  // MCX wallet balance (INR for MCX trading)
  const mcxBalance = walletData?.mcxWallet?.balance || 0;
  const mcxUsedMargin = walletData?.mcxWallet?.usedMargin || 0;
  const mcxAvailableBalance = mcxBalance - mcxUsedMargin;
  const mcxRealizedPnL = walletData?.mcxWallet?.realizedPnL || 0;

  // Games wallet balance (INR for games/fantasy trading)
  const gamesBalance = walletData?.gamesWallet?.balance || 0;
  const gamesUsedMargin = walletData?.gamesWallet?.usedMargin || 0;
  const gamesAvailableBalance = gamesBalance - gamesUsedMargin;
  const gamesRealizedPnL = walletData?.gamesWallet?.realizedPnL || 0;

  const openCryptoTransfer = (direction) => {
    setCryptoTransferDirection(direction);
    setShowCryptoTransferModal(true);
  };

  const openCryptoTrading = () => {
    navigate('/user/trader-room?mode=crypto');
  };

  const openMcxTransfer = (direction) => {
    setMcxTransferDirection(direction);
    setShowMcxTransferModal(true);
  };

  const openMcxTrading = () => {
    navigate('/user/trader-room?mode=mcx');
  };

  const openGamesTransfer = (direction) => {
    setGamesTransferDirection(direction);
    setShowGamesTransferModal(true);
  };

  const openGamesTrading = () => {
    navigate('/user/games');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="animate-spin text-green-400" size={32} />
      </div>
    );
  }

  
  return (
    <div className="p-4 md:p-6 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">My Accounts</h1>
          <button onClick={fetchWallet} className="text-gray-400 hover:text-white">
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {/* Account Cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Trading Account */}
        <div className="bg-dark-800 rounded-xl overflow-hidden">
          {/* Account Header */}
          <div className="p-4 border-b border-dark-600">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-dark-700 rounded-lg flex items-center justify-center">
                  <Wallet size={20} className="text-gray-400" />
                </div>
                <div>
                  <div className="font-semibold">IND-{user?.userId?.slice(-5) || '00000'}</div>
                  <div className="text-xs text-gray-500">STANDARD</div>
                </div>
              </div>
              <button className="text-gray-400 hover:text-white">
                <MoreHorizontal size={20} />
              </button>
            </div>
          </div>

          {/* Account Body */}
          <div className="p-6 bg-gradient-to-br from-dark-900 to-dark-800">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2 h-2 bg-green-400 rounded-full"></span>
              <span className="text-sm text-green-400">Trading Account</span>
            </div>
            
            <div className="text-4xl font-bold mb-1">
              ₹{tradingAccountBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-sm text-gray-500">Trading Balance</div>
            {usedMargin > 0 && (
              <div className="text-xs text-yellow-400 mt-1">
                Margin Used: ₹{usedMargin.toLocaleString()} | Available: ₹{availableTradingBalance.toLocaleString()}
              </div>
            )}
          </div>

          {/* Account Actions */}
          <div className="p-4 flex gap-2">
            <button 
              onClick={openTraderRoom}
              className="flex-1 flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 py-3 rounded-lg font-medium transition"
            >
              <IndianRupee size={18} />
              Trade
            </button>
            <button 
              onClick={() => openTransfer('toAccount')}
              className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 px-4 py-3 rounded-lg transition"
              title="Transfer from Wallet to Trading Account"
            >
              <Plus size={18} />
              Deposit
            </button>
            <button 
              onClick={() => openTransfer('toWallet')}
              className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 px-4 py-3 rounded-lg transition"
              title="Transfer from Trading Account to Wallet"
            >
              <Minus size={18} />
              Withdraw
            </button>
          </div>
        </div>

        {/* MCX Account */}
        <div className="bg-dark-800 rounded-xl overflow-hidden">
          {/* Account Header */}
          <div className="p-4 border-b border-dark-600">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-yellow-500 to-amber-600 rounded-lg flex items-center justify-center">
                  <Gem size={20} className="text-white" />
                </div>
                <div>
                  <div className="font-semibold">MCX-{user?.userId?.slice(-5) || '00000'}</div>
                  <div className="text-xs text-gray-500">COMMODITY TRADING</div>
                </div>
              </div>
              <button className="text-gray-400 hover:text-white">
                <MoreHorizontal size={20} />
              </button>
            </div>
          </div>

          {/* Account Body */}
          <div className="p-6 bg-gradient-to-br from-yellow-900/20 to-dark-800">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2 h-2 bg-yellow-400 rounded-full"></span>
              <span className="text-sm text-yellow-400">MCX Account</span>
            </div>
            
            <div className="text-4xl font-bold mb-1">
              ₹{mcxBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-sm text-gray-500">MCX Trading Balance</div>
            {mcxUsedMargin > 0 && (
              <div className="text-xs text-yellow-400 mt-1">
                Margin Used: ₹{mcxUsedMargin.toLocaleString()} | Available: ₹{mcxAvailableBalance.toLocaleString()}
              </div>
            )}
            {mcxRealizedPnL !== 0 && (
              <div className={`text-xs mt-1 ${mcxRealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                P&L: {mcxRealizedPnL >= 0 ? '+' : ''}₹{mcxRealizedPnL.toLocaleString()}
              </div>
            )}
          </div>

          {/* Account Actions */}
          <div className="p-4 flex gap-2">
            <button 
              onClick={openMcxTrading}
              className="flex-1 flex items-center justify-center gap-2 bg-yellow-600 hover:bg-yellow-700 py-3 rounded-lg font-medium transition"
            >
              <Gem size={18} />
              Trade
            </button>
            <button 
              onClick={() => openMcxTransfer('toMcx')}
              className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 px-4 py-3 rounded-lg transition"
              title="Transfer from Main Wallet to MCX Account"
            >
              <Plus size={18} />
              Deposit
            </button>
            <button 
              onClick={() => openMcxTransfer('fromMcx')}
              className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 px-4 py-3 rounded-lg transition"
              title="Transfer from MCX Account to Main Wallet"
            >
              <Minus size={18} />
              Withdraw
            </button>
          </div>
        </div>

        {/* Games Account */}
        <div className="bg-dark-800 rounded-xl overflow-hidden">
          {/* Account Header */}
          <div className="p-4 border-b border-dark-600">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center">
                  <Gamepad2 size={20} className="text-white" />
                </div>
                <div>
                  <div className="font-semibold">GAMES-{user?.userId?.slice(-5) || '00000'}</div>
                  <div className="text-xs text-gray-500">FANTASY TRADING</div>
                </div>
              </div>
              <button className="text-gray-400 hover:text-white">
                <MoreHorizontal size={20} />
              </button>
            </div>
          </div>

          {/* Account Body */}
          <div className="p-6 bg-gradient-to-br from-purple-900/20 to-dark-800">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2 h-2 bg-purple-400 rounded-full"></span>
              <span className="text-sm text-purple-400">Games Account</span>
            </div>
            
            <div className="text-4xl font-bold mb-1">
              ₹{gamesBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-sm text-gray-500">Games Balance</div>
            {gamesUsedMargin > 0 && (
              <div className="text-xs text-purple-400 mt-1">
                In Play: ₹{gamesUsedMargin.toLocaleString()} | Available: ₹{gamesAvailableBalance.toLocaleString()}
              </div>
            )}
            {gamesRealizedPnL !== 0 && (
              <div className={`text-xs mt-1 ${gamesRealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                P&L: {gamesRealizedPnL >= 0 ? '+' : ''}₹{gamesRealizedPnL.toLocaleString()}
              </div>
            )}
          </div>

          {/* Account Actions */}
          <div className="p-4 flex gap-2">
            <button 
              onClick={openGamesTrading}
              className="flex-1 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 py-3 rounded-lg font-medium transition"
            >
              <Gamepad2 size={18} />
              Play
            </button>
            <button 
              onClick={() => openGamesTransfer('toGames')}
              className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 px-4 py-3 rounded-lg transition"
              title="Transfer from Main Wallet to Games Account"
            >
              <Plus size={18} />
              Deposit
            </button>
            <button 
              onClick={() => openGamesTransfer('fromGames')}
              className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 px-4 py-3 rounded-lg transition"
              title="Transfer from Games Account to Main Wallet"
            >
              <Minus size={18} />
              Withdraw
            </button>
          </div>
        </div>

        {/* Crypto Account */}
        <div className="bg-dark-800 rounded-xl overflow-hidden">
          {/* Account Header */}
          <div className="p-4 border-b border-dark-600">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-lg flex items-center justify-center">
                  <Bitcoin size={20} className="text-white" />
                </div>
                <div>
                  <div className="font-semibold">CRYPTO-{user?.userId?.slice(-5) || '00000'}</div>
                  <div className="text-xs text-gray-500">SPOT TRADING</div>
                </div>
              </div>
              <button className="text-gray-400 hover:text-white">
                <MoreHorizontal size={20} />
              </button>
            </div>
          </div>

          {/* Account Body */}
          <div className="p-6 bg-gradient-to-br from-orange-900/20 to-dark-800">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2 h-2 bg-orange-400 rounded-full"></span>
              <span className="text-sm text-orange-400">Crypto Account</span>
            </div>
            
            <div className="text-4xl font-bold mb-1 flex items-center gap-2">
              <DollarSign size={32} className="text-green-400" />
              {cryptoBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-sm text-gray-500">USDT Balance</div>
            {cryptoRealizedPnL !== 0 && (
              <div className={`text-xs mt-1 ${cryptoRealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                P&L: {cryptoRealizedPnL >= 0 ? '+' : ''}${cryptoRealizedPnL.toLocaleString()}
              </div>
            )}
          </div>

          {/* Account Actions */}
          <div className="p-4 flex gap-2">
            <button 
              onClick={openCryptoTrading}
              className="flex-1 flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 py-3 rounded-lg font-medium transition"
            >
              <Bitcoin size={18} />
              Trade
            </button>
            <button 
              onClick={() => openCryptoTransfer('toCrypto')}
              className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 px-4 py-3 rounded-lg transition"
              title="Transfer from Main Wallet to Crypto Account"
            >
              <Plus size={18} />
              Deposit
            </button>
            <button 
              onClick={() => openCryptoTransfer('fromCrypto')}
              className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 px-4 py-3 rounded-lg transition"
              title="Transfer from Crypto Account to Main Wallet"
            >
              <Minus size={18} />
              Withdraw
            </button>
          </div>
        </div>
      </div>

      {/* Account Summary */}
      <div className="mt-8 bg-dark-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4">Account Summary</h2>
        <div className="grid md:grid-cols-7 gap-6">
          <div>
            <div className="text-sm text-gray-400 mb-1">Main Wallet</div>
            <div className="text-2xl font-bold text-blue-400">
              ₹{mainWalletBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-400 mb-1">Trading Account</div>
            <div className="text-2xl font-bold text-green-400">
              ₹{tradingAccountBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-400 mb-1">MCX Account</div>
            <div className="text-2xl font-bold text-yellow-400">
              ₹{mcxBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-400 mb-1">Games Account</div>
            <div className="text-2xl font-bold text-purple-400">
              ₹{gamesBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-400 mb-1">Crypto Account</div>
            <div className="text-2xl font-bold text-orange-400">
              ${cryptoBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-400 mb-1">Total Deposited</div>
            <div className="text-2xl font-bold">
              ₹{(walletData?.wallet?.totalDeposited || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-400 mb-1">Total Withdrawn</div>
            <div className="text-2xl font-bold">
              ₹{(walletData?.wallet?.totalWithdrawn || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>

      {/* Internal Transfer Modal */}
      {showTransferModal && (
        <InternalTransferModal
          user={user}
          walletBalance={mainWalletBalance}
          tradingBalance={availableTradingBalance}
          direction={transferDirection}
          onClose={() => setShowTransferModal(false)}
          onSuccess={() => { fetchWallet(); setShowTransferModal(false); }}
        />
      )}

      {/* Crypto Transfer Modal */}
      {showCryptoTransferModal && (
        <CryptoTransferModal
          user={user}
          walletBalance={mainWalletBalance}
          cryptoBalance={cryptoBalance}
          direction={cryptoTransferDirection}
          onClose={() => setShowCryptoTransferModal(false)}
          onSuccess={() => { fetchWallet(); setShowCryptoTransferModal(false); }}
        />
      )}

      {/* MCX Transfer Modal */}
      {showMcxTransferModal && (
        <McxTransferModal
          user={user}
          walletBalance={mainWalletBalance}
          mcxBalance={mcxAvailableBalance}
          direction={mcxTransferDirection}
          onClose={() => setShowMcxTransferModal(false)}
          onSuccess={() => { fetchWallet(); setShowMcxTransferModal(false); }}
        />
      )}

      {/* Games Transfer Modal */}
      {showGamesTransferModal && (
        <GamesTransferModal
          user={user}
          walletBalance={mainWalletBalance}
          gamesBalance={gamesAvailableBalance}
          direction={gamesTransferDirection}
          onClose={() => setShowGamesTransferModal(false)}
          onSuccess={() => { fetchWallet(); setShowGamesTransferModal(false); }}
        />
      )}
    </div>
  );
};

// Internal Transfer Modal - Transfer between Wallet and Trading Account
const InternalTransferModal = ({ user, walletBalance, tradingBalance, direction, onClose, onSuccess }) => {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isToAccount = direction === 'toAccount';
  const sourceBalance = isToAccount ? walletBalance : tradingBalance;
  const sourceLabel = isToAccount ? 'Main Wallet' : 'Trading Account';
  const destLabel = isToAccount ? 'Trading Account' : 'Main Wallet';

  const handleSubmit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    
    if (!amt || amt <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    if (amt > sourceBalance) {
      setError(`Insufficient balance in ${sourceLabel}`);
      return;
    }

    setLoading(true);
    setError('');

    try {
      await axios.post('/api/user/funds/internal-transfer', {
        amount: amt,
        direction: direction // 'toAccount' or 'toWallet'
      }, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || 'Transfer failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 rounded-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <ArrowLeftRight size={20} className="text-blue-400" />
            Internal Transfer
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Transfer Direction Display */}
        <div className="bg-dark-700 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="text-center flex-1">
              <div className="text-xs text-gray-400 mb-1">{sourceLabel}</div>
              <div className="text-lg font-bold text-green-400">₹{sourceBalance.toLocaleString()}</div>
            </div>
            <div className="px-4">
              <ArrowRight size={24} className="text-blue-400" />
            </div>
            <div className="text-center flex-1">
              <div className="text-xs text-gray-400 mb-1">{destLabel}</div>
              <div className="text-lg font-bold text-blue-400">
                ₹{(isToAccount ? tradingBalance : walletBalance).toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/20 text-red-400 p-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Amount (₹)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount to transfer"
              className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500 text-lg"
            />
          </div>

          {/* Quick Amount Buttons */}
          <div className="flex gap-2 flex-wrap">
            {[1000, 5000, 10000, 50000].map(amt => (
              <button
                key={amt}
                type="button"
                onClick={() => setAmount(String(sourceBalance > 0 ? Math.min(amt, sourceBalance) : amt))}
                className="flex-1 min-w-[60px] bg-dark-700 hover:bg-dark-600 py-2 rounded text-sm transition"
              >
                ₹{amt.toLocaleString()}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setAmount(String(Math.max(sourceBalance, 0)))}
              className="flex-1 min-w-[60px] bg-green-600 hover:bg-green-700 py-2 rounded text-sm font-medium transition"
            >
              Max
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 py-3 rounded-lg font-medium transition"
          >
            {loading ? 'Transferring...' : `Transfer to ${destLabel}`}
          </button>
        </form>
      </div>
    </div>
  );
};

// Crypto Transfer Modal - Transfer between Main Wallet and Crypto Account
const CryptoTransferModal = ({ user, walletBalance, cryptoBalance, direction, onClose, onSuccess }) => {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isToCrypto = direction === 'toCrypto';
  // For INR to USDT conversion (approximate rate)
  const usdRate = 83.50;
  
  // Source balance in appropriate currency
  const sourceBalance = isToCrypto ? walletBalance : cryptoBalance;
  const sourceLabel = isToCrypto ? 'Main Wallet (₹)' : 'Crypto Account ($)';
  const destLabel = isToCrypto ? 'Crypto Account ($)' : 'Main Wallet (₹)';
  const sourceCurrency = isToCrypto ? '₹' : '$';
  const destCurrency = isToCrypto ? '$' : '₹';

  // Calculate converted amount
  const numAmount = parseFloat(amount) || 0;
  const convertedAmount = isToCrypto 
    ? (numAmount / usdRate).toFixed(2) 
    : (numAmount * usdRate).toFixed(2);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    
    if (!amt || amt <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    if (amt > sourceBalance) {
      setError(`Insufficient balance in ${sourceLabel}`);
      return;
    }

    setLoading(true);
    setError('');

    try {
      await axios.post('/api/user/funds/crypto-transfer', {
        amount: amt,
        direction: direction // 'toCrypto' or 'fromCrypto'
      }, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || 'Transfer failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 rounded-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Bitcoin size={20} className="text-orange-400" />
            Crypto Transfer
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Transfer Direction Display */}
        <div className="bg-dark-700 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="text-center flex-1">
              <div className="text-xs text-gray-400 mb-1">{sourceLabel}</div>
              <div className={`text-lg font-bold ${isToCrypto ? 'text-blue-400' : 'text-orange-400'}`}>
                {sourceCurrency}{sourceBalance.toLocaleString()}
              </div>
            </div>
            <div className="px-4">
              <ArrowRight size={24} className="text-orange-400" />
            </div>
            <div className="text-center flex-1">
              <div className="text-xs text-gray-400 mb-1">{destLabel}</div>
              <div className={`text-lg font-bold ${isToCrypto ? 'text-orange-400' : 'text-blue-400'}`}>
                {destCurrency}{(isToCrypto ? cryptoBalance : walletBalance).toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {/* Conversion Rate Info */}
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 mb-4 text-sm">
          <div className="flex items-center gap-2 text-orange-400">
            <DollarSign size={16} />
            <span>Rate: 1 USD = ₹{usdRate}</span>
          </div>
          {numAmount > 0 && (
            <div className="mt-1 text-gray-300">
              {sourceCurrency}{numAmount.toLocaleString()} → {destCurrency}{convertedAmount}
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-500/20 text-red-400 p-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Amount ({sourceCurrency})</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Enter amount in ${sourceCurrency}`}
              className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-3 focus:outline-none focus:border-orange-500 text-lg"
            />
          </div>

          {/* Quick Amount Buttons */}
          <div className="flex gap-2 flex-wrap">
            {(isToCrypto ? [1000, 5000, 10000, 50000] : [10, 50, 100, 500]).map(amt => (
              <button
                key={amt}
                type="button"
                onClick={() => setAmount(String(sourceBalance > 0 ? Math.min(amt, sourceBalance) : amt))}
                className="flex-1 min-w-[60px] bg-dark-700 hover:bg-dark-600 py-2 rounded text-sm transition"
              >
                {sourceCurrency}{amt.toLocaleString()}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setAmount(String(Math.max(sourceBalance, 0)))}
              className="flex-1 min-w-[60px] bg-orange-600 hover:bg-orange-700 py-2 rounded text-sm font-medium transition"
            >
              Max
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-50 py-3 rounded-lg font-medium transition"
          >
            {loading ? 'Transferring...' : `Transfer to ${destLabel.split(' ')[0]}`}
          </button>
        </form>
      </div>
    </div>
  );
};

// MCX Transfer Modal - Transfer between Main Wallet and MCX Account
const McxTransferModal = ({ user, walletBalance, mcxBalance, direction, onClose, onSuccess }) => {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isToMcx = direction === 'toMcx';
  const sourceBalance = isToMcx ? walletBalance : mcxBalance;
  const sourceLabel = isToMcx ? 'Main Wallet' : 'MCX Account';
  const destLabel = isToMcx ? 'MCX Account' : 'Main Wallet';

  const handleSubmit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    
    if (!amt || amt <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    if (amt > sourceBalance) {
      setError(`Insufficient balance in ${sourceLabel}`);
      return;
    }

    setLoading(true);
    setError('');

    try {
      await axios.post('/api/user/funds/mcx-transfer', {
        amount: amt,
        direction: direction // 'toMcx' or 'fromMcx'
      }, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || 'Transfer failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 rounded-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Gem size={20} className="text-yellow-400" />
            MCX Transfer
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Transfer Direction Display */}
        <div className="bg-dark-700 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="text-center flex-1">
              <div className="text-xs text-gray-400 mb-1">{sourceLabel}</div>
              <div className={`text-lg font-bold ${isToMcx ? 'text-blue-400' : 'text-yellow-400'}`}>
                ₹{sourceBalance.toLocaleString()}
              </div>
            </div>
            <div className="px-4">
              <ArrowRight size={24} className="text-yellow-400" />
            </div>
            <div className="text-center flex-1">
              <div className="text-xs text-gray-400 mb-1">{destLabel}</div>
              <div className={`text-lg font-bold ${isToMcx ? 'text-yellow-400' : 'text-blue-400'}`}>
                ₹{(isToMcx ? mcxBalance : walletBalance).toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {/* MCX Info */}
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-4 text-sm">
          <div className="flex items-center gap-2 text-yellow-400">
            <Gem size={16} />
            <span>MCX Commodity Trading Account</span>
          </div>
          <div className="mt-1 text-gray-300 text-xs">
            Trade Gold, Silver, Crude Oil, Natural Gas & more
          </div>
        </div>

        {error && (
          <div className="bg-red-500/20 text-red-400 p-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Amount (₹)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount to transfer"
              className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-3 focus:outline-none focus:border-yellow-500 text-lg"
            />
          </div>

          {/* Quick Amount Buttons */}
          <div className="flex gap-2 flex-wrap">
            {[1000, 5000, 10000, 50000].map(amt => (
              <button
                key={amt}
                type="button"
                onClick={() => setAmount(String(sourceBalance > 0 ? Math.min(amt, sourceBalance) : amt))}
                className="flex-1 min-w-[60px] bg-dark-700 hover:bg-dark-600 py-2 rounded text-sm transition"
              >
                ₹{amt.toLocaleString()}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setAmount(String(Math.max(sourceBalance, 0)))}
              className="flex-1 min-w-[60px] bg-yellow-600 hover:bg-yellow-700 py-2 rounded text-sm font-medium transition"
            >
              Max
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 py-3 rounded-lg font-medium transition"
          >
            {loading ? 'Transferring...' : `Transfer to ${destLabel}`}
          </button>
        </form>
      </div>
    </div>
  );
};

// Games Transfer Modal - Transfer between Main Wallet and Games Account
const GamesTransferModal = ({ user, walletBalance, gamesBalance, direction, onClose, onSuccess }) => {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isToGames = direction === 'toGames';
  const sourceBalance = isToGames ? walletBalance : gamesBalance;
  const sourceLabel = isToGames ? 'Main Wallet' : 'Games Account';
  const destLabel = isToGames ? 'Games Account' : 'Main Wallet';

  const handleSubmit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    
    if (!amt || amt <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    if (amt > sourceBalance) {
      setError(`Insufficient balance in ${sourceLabel}`);
      return;
    }

    setLoading(true);
    setError('');

    try {
      await axios.post('/api/user/funds/games-transfer', {
        amount: amt,
        direction: direction // 'toGames' or 'fromGames'
      }, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || 'Transfer failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 rounded-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Gamepad2 size={20} className="text-purple-400" />
            Games Transfer
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Transfer Direction Display */}
        <div className="bg-dark-700 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="text-center flex-1">
              <div className="text-xs text-gray-400 mb-1">{sourceLabel}</div>
              <div className={`text-lg font-bold ${isToGames ? 'text-blue-400' : 'text-purple-400'}`}>
                ₹{sourceBalance.toLocaleString()}
              </div>
            </div>
            <div className="px-4">
              <ArrowRight size={24} className="text-purple-400" />
            </div>
            <div className="text-center flex-1">
              <div className="text-xs text-gray-400 mb-1">{destLabel}</div>
              <div className={`text-lg font-bold ${isToGames ? 'text-purple-400' : 'text-blue-400'}`}>
                ₹{(isToGames ? gamesBalance : walletBalance).toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {/* Games Info */}
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3 mb-4 text-sm">
          <div className="flex items-center gap-2 text-purple-400">
            <Gamepad2 size={16} />
            <span>Fantasy Trading Account</span>
          </div>
          <div className="mt-1 text-gray-300 text-xs">
            Play fantasy games and win real rewards
          </div>
        </div>

        {error && (
          <div className="bg-red-500/20 text-red-400 p-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Amount (₹)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount to transfer"
              className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500 text-lg"
            />
          </div>

          {/* Quick Amount Buttons */}
          <div className="flex gap-2 flex-wrap">
            {[500, 1000, 5000, 10000].map(amt => (
              <button
                key={amt}
                type="button"
                onClick={() => setAmount(String(sourceBalance > 0 ? Math.min(amt, sourceBalance) : amt))}
                className="flex-1 min-w-[60px] bg-dark-700 hover:bg-dark-600 py-2 rounded text-sm transition"
              >
                ₹{amt.toLocaleString()}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setAmount(String(Math.max(sourceBalance, 0)))}
              className="flex-1 min-w-[60px] bg-purple-600 hover:bg-purple-700 py-2 rounded text-sm font-medium transition"
            >
              Max
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 py-3 rounded-lg font-medium transition"
          >
            {loading ? 'Transferring...' : `Transfer to ${destLabel}`}
          </button>
        </form>
      </div>
    </div>
  );
};

export default UserAccounts;
