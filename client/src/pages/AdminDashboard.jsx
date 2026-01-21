import { useState, useEffect, useMemo, useRef } from 'react';
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import io from 'socket.io-client';
import { 
  Users, LogOut, Plus, Search, Edit, Trash2, TrendingUp,
  Key, Wallet, Eye, EyeOff, X, ArrowUpCircle, ArrowDownCircle,
  RefreshCw, Menu, Shield, CreditCard, FileText, BarChart3, Building2, Settings, UserPlus, Copy,
  ChevronLeft, ChevronRight, ArrowRightLeft
} from 'lucide-react';

// Reusable Pagination Component
const Pagination = ({ currentPage, totalPages, onPageChange, totalItems, itemsPerPage }) => {
  if (totalPages <= 1) return null;
  
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 px-2">
      <div className="text-sm text-gray-400">
        Showing {startItem}-{endItem} of {totalItems}
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-2 rounded bg-dark-700 hover:bg-dark-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={16} />
        </button>
        {getPageNumbers().map(page => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`px-3 py-1 rounded ${currentPage === page ? 'bg-yellow-600 text-white' : 'bg-dark-700 hover:bg-dark-600'}`}
          >
            {page}
          </button>
        ))}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-2 rounded bg-dark-700 hover:bg-dark-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};

// Custom hook for pagination with global search
const usePagination = (data, itemsPerPage = 20, searchTerm = '', searchFields = []) => {
  const [currentPage, setCurrentPage] = useState(1);

  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return data;
    const term = searchTerm.toLowerCase();
    return data.filter(item => 
      searchFields.some(field => {
        const value = field.split('.').reduce((obj, key) => obj?.[key], item);
        return value?.toString().toLowerCase().includes(term);
      })
    );
  }, [data, searchTerm, searchFields]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  
  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(start, start + itemsPerPage);
  }, [filteredData, currentPage, itemsPerPage]);

  return {
    currentPage,
    setCurrentPage,
    totalPages,
    paginatedData,
    filteredData,
    totalItems: filteredData.length
  };
};

const AdminDashboard = () => {
  const { admin, logoutAdmin, updateAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [walletBalance, setWalletBalance] = useState(admin?.wallet?.balance || 0);

  const isSuperAdmin = admin?.role === 'SUPER_ADMIN';
  const isAdmin = admin?.role === 'ADMIN';
  const isBroker = admin?.role === 'BROKER';
  const isSubBroker = admin?.role === 'SUB_BROKER';
  
  // Get role display name
  const getRoleDisplayName = () => {
    switch(admin?.role) {
      case 'SUPER_ADMIN': return 'Super Admin';
      case 'ADMIN': return 'Admin';
      case 'BROKER': return 'Broker';
      case 'SUB_BROKER': return 'Sub Broker';
      default: return 'Admin';
    }
  };
  
  // Get role color
  const getRoleColor = () => {
    switch(admin?.role) {
      case 'SUPER_ADMIN': return 'text-yellow-400';
      case 'ADMIN': return 'text-purple-400';
      case 'BROKER': return 'text-cyan-400';
      case 'SUB_BROKER': return 'text-green-400';
      default: return 'text-purple-400';
    }
  };
  
  // Get role button color
  const getRoleButtonColor = () => {
    switch(admin?.role) {
      case 'SUPER_ADMIN': return 'bg-yellow-600';
      case 'ADMIN': return 'bg-purple-600';
      case 'BROKER': return 'bg-cyan-600';
      case 'SUB_BROKER': return 'bg-green-600';
      default: return 'bg-purple-600';
    }
  };

  // Refresh admin data on mount to get latest wallet balance
  useEffect(() => {
    if (!isSuperAdmin && admin?.token) {
      refreshAdminData();
    }
  }, []);

  const refreshAdminData = async () => {
    try {
      const { data } = await axios.get('/api/admin/me', {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      if (data.wallet) {
        setWalletBalance(data.wallet.balance || 0);
        updateAdmin({ wallet: data.wallet, stats: data.stats });
      }
    } catch (error) {
      console.error('Error refreshing admin data:', error);
    }
  };

  const handleLogout = async () => {
    await logoutAdmin();
    navigate('/admin/login');
  };

  // Navigation items based on role
  // SUPER_ADMIN: Sees ALL - Admin/Broker/SubBroker Management, All Users, Instruments, Market Control
  // ADMIN: Can create Broker, SubBroker, Users - sees subordinates
  // BROKER: Can create SubBroker, Users - sees subordinates  
  // SUB_BROKER: Can only create Users - sees only users
  const getNavItems = () => {
    const baseItems = [
      { path: '/admin/dashboard', icon: BarChart3, label: 'Dashboard' },
    ];
    
    if (isSuperAdmin) {
      return [
        ...baseItems,
        { path: '/admin/admins', icon: Shield, label: 'Hierarchy Management' },
        { path: '/admin/all-users', icon: Users, label: 'All Users' },
        { path: '/admin/trading', icon: TrendingUp, label: 'Market Watch' },
        { path: '/admin/all-trades', icon: FileText, label: 'All Position' },
        { path: '/admin/all-fund-requests', icon: CreditCard, label: 'All Fund Requests' },
        { path: '/admin/create-user', icon: UserPlus, label: 'Create User' },
        { path: '/admin/instruments', icon: Settings, label: 'Instruments' },
        { path: '/admin/admin-fund-requests', icon: Wallet, label: 'Admin Fund Requests' },
        { path: '/admin/broker-change-requests', icon: RefreshCw, label: 'Transfer Requests' },
        { path: '/admin/market-control', icon: TrendingUp, label: 'Market Control' },
        { path: '/admin/bank-management', icon: Building2, label: 'Bank Settings' },
        { path: '/admin/profile', icon: Settings, label: 'Profile' },
      ];
    }
    
    if (isAdmin) {
      return [
        ...baseItems,
        { path: '/admin/wallet', icon: Wallet, label: 'My Wallet' },
        { path: '/admin/admins', icon: Shield, label: 'Broker/SubBroker' },
        { path: '/admin/subordinate-fund-requests', icon: CreditCard, label: 'Subordinate Requests' },
        { path: '/admin/users', icon: Users, label: 'User Management' },
        { path: '/admin/create-user', icon: UserPlus, label: 'Create User' },
        { path: '/admin/trading', icon: TrendingUp, label: 'Market Watch' },
        { path: '/admin/trades', icon: FileText, label: 'Position' },
        { path: '/admin/fund-requests', icon: CreditCard, label: 'User Fund Requests' },
        { path: '/admin/bank-accounts', icon: Building2, label: 'Bank Accounts' },
        { path: '/admin/ledger', icon: FileText, label: 'Transactions' },
        { path: '/admin/profile', icon: Settings, label: 'Profile' },
      ];
    }
    
    if (isBroker) {
      return [
        ...baseItems,
        { path: '/admin/wallet', icon: Wallet, label: 'My Wallet' },
        { path: '/admin/admins', icon: Shield, label: 'Sub Brokers' },
        { path: '/admin/subordinate-fund-requests', icon: CreditCard, label: 'SubBroker Requests' },
        { path: '/admin/users', icon: Users, label: 'User Management' },
        { path: '/admin/create-user', icon: UserPlus, label: 'Create User' },
        { path: '/admin/trading', icon: TrendingUp, label: 'Market Watch' },
        { path: '/admin/trades', icon: FileText, label: 'Position' },
        { path: '/admin/fund-requests', icon: CreditCard, label: 'User Fund Requests' },
        { path: '/admin/bank-accounts', icon: Building2, label: 'Bank Accounts' },
        { path: '/admin/ledger', icon: FileText, label: 'Transactions' },
        { path: '/admin/profile', icon: Settings, label: 'Profile' },
      ];
    }
    
    // SUB_BROKER - only users, no subordinates
    return [
      ...baseItems,
      { path: '/admin/wallet', icon: Wallet, label: 'My Wallet' },
      { path: '/admin/users', icon: Users, label: 'User Management' },
      { path: '/admin/create-user', icon: UserPlus, label: 'Create User' },
      { path: '/admin/trading', icon: TrendingUp, label: 'Market Watch' },
      { path: '/admin/trades', icon: FileText, label: 'Position' },
      { path: '/admin/fund-requests', icon: CreditCard, label: 'Fund Requests' },
      { path: '/admin/bank-accounts', icon: Building2, label: 'Bank Accounts' },
      { path: '/admin/ledger', icon: FileText, label: 'Transactions' },
      { path: '/admin/profile', icon: Settings, label: 'Profile' },
    ];
  };
  
  const navItems = getNavItems();

  return (
    <div className="min-h-screen bg-dark-900 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <header className="md:hidden bg-dark-800 border-b border-dark-600 px-4 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-lg font-bold">stockex</span>
          <span className={`text-xs ml-1 ${getRoleColor()}`}>
            {getRoleDisplayName()}
          </span>
        </Link>
        <button 
          onClick={() => setShowMobileMenu(!showMobileMenu)}
          className="text-gray-400 hover:text-white"
        >
          <Menu size={24} />
        </button>
      </header>

      {/* Mobile Menu */}
      {showMobileMenu && (
        <div className="md:hidden bg-dark-800 border-b border-dark-600 p-4">
          {navItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setShowMobileMenu(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-2 ${
                location.pathname === item.path || (item.path !== '/admin/dashboard' && location.pathname.startsWith(item.path))
                  ? (isSuperAdmin ? 'bg-yellow-600' : 'bg-purple-600') + ' text-white'
                  : 'text-gray-400'
              }`}
            >
              <item.icon size={20} />
              {item.label}
            </Link>
          ))}
          <div className="border-t border-dark-600 pt-3 mt-3">
            <div className="text-sm text-gray-400 mb-1 px-4">
              {admin?.name || admin?.username}
            </div>
            {admin?.adminCode && (
              <div className="text-xs text-purple-400 mb-2 px-4">
                Code: {admin.adminCode}
              </div>
            )}
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-red-400 hover:text-red-300 px-4 py-2"
            >
              <LogOut size={18} />
              Logout
            </button>
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-dark-800 border-r border-dark-600 flex-col">
        <div className="p-4 border-b border-dark-600">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-xl font-bold">stockex</span>
          </Link>
          <p className={`text-xs mt-1 ${isSuperAdmin ? 'text-yellow-400' : 'text-purple-400'}`}>
            {isSuperAdmin ? 'Super Admin Panel' : 'Admin Panel'}
          </p>
        </div>

        {/* Admin Info */}
        {!isSuperAdmin && admin?.adminCode && (
          <div className="px-4 py-3 border-b border-dark-600 bg-dark-700/50">
            <div className="text-xs text-gray-400">Your Admin Code</div>
            <div className="text-lg font-mono font-bold text-purple-400">{admin.adminCode}</div>
            <div className={`text-xs mt-1 ${getRoleColor()}`}>
              Role: {getRoleDisplayName()}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Wallet: ₹{walletBalance.toLocaleString()}
            </div>
          </div>
        )}

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                location.pathname === item.path || (item.path !== '/admin/dashboard' && location.pathname.startsWith(item.path))
                  ? (isSuperAdmin ? 'bg-yellow-600' : 'bg-purple-600') + ' text-white'
                  : 'text-gray-400 hover:bg-dark-700'
              }`}
            >
              <item.icon size={20} />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-dark-600">
          <div className="text-sm text-gray-400 mb-1">
            {admin?.name || admin?.username}
          </div>
          <div className="text-xs text-gray-500 mb-2">{admin?.email}</div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-red-400 hover:text-red-300 transition"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="dashboard" element={isSuperAdmin ? <SuperAdminDashboard /> : <AdminDashboardHome />} />
          {/* Super Admin Only Routes */}
          {isSuperAdmin && <Route path="admins/*" element={<AdminManagement />} />}
          {isSuperAdmin && <Route path="all-users" element={<AllUsersManagement />} />}
          {isSuperAdmin && <Route path="all-trades" element={<SuperAdminAllTrades />} />}
          {isSuperAdmin && <Route path="all-fund-requests" element={<SuperAdminAllFundRequests />} />}
          {isSuperAdmin && <Route path="create-user" element={<SuperAdminCreateUser />} />}
          {isSuperAdmin && <Route path="instruments" element={<InstrumentManagement />} />}
                    {isSuperAdmin && <Route path="fund-requests" element={<SuperAdminFundRequests />} />}
          {isSuperAdmin && <Route path="admin-fund-requests" element={<AdminFundRequestsManagement />} />}
          {isSuperAdmin && <Route path="broker-change-requests" element={<BrokerChangeRequestsManagement />} />}
          {isSuperAdmin && <Route path="market-control" element={<MarketControl />} />}
          {isSuperAdmin && <Route path="bank-management" element={<BankManagement />} />}
          {/* Admin Only Routes */}
          {!isSuperAdmin && <Route path="wallet" element={<AdminWallet />} />}
          {!isSuperAdmin && !isSubBroker && <Route path="admins/*" element={<AdminManagement />} />}
          {!isSuperAdmin && !isSubBroker && <Route path="subordinate-fund-requests" element={<SubordinateFundRequests />} />}
          {!isSuperAdmin && <Route path="users/*" element={<UserManagement />} />}
          {!isSuperAdmin && <Route path="create-user" element={<AdminCreateUser />} />}
          {!isSuperAdmin && <Route path="trades" element={<AllTrades />} />}
          {!isSuperAdmin && <Route path="fund-requests" element={<FundRequests />} />}
          {!isSuperAdmin && <Route path="bank-accounts" element={<BankAccounts />} />}
          {!isSuperAdmin && <Route path="ledger" element={<LedgerView />} />}
          {/* Common Routes - Both Super Admin and Admin */}
          <Route path="trading" element={<TradingPanel />} />
          <Route path="profile" element={<ProfileSettings />} />
          <Route path="*" element={isSuperAdmin ? <SuperAdminDashboard /> : <AdminDashboardHome />} />
        </Routes>
      </main>
    </div>
  );
};

// Super Admin Dashboard
const SuperAdminDashboard = () => {
  const { admin } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [zerodhaStatus, setZerodhaStatus] = useState({ connected: false });
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    fetchStats();
    fetchZerodhaStatus();
    
    // Check URL params for Zerodha callback
    const params = new URLSearchParams(window.location.search);
    const zerodhaResult = params.get('zerodha');
    if (zerodhaResult === 'success') {
      window.history.replaceState({}, '', window.location.pathname);
      fetchZerodhaStatus();
    } else if (zerodhaResult === 'error') {
      alert('Zerodha connection failed: ' + (params.get('message') || 'Unknown error'));
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const fetchStats = async () => {
    try {
      const { data } = await axios.get('/api/admin/manage/dashboard-stats', {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchZerodhaStatus = async () => {
    try {
      const { data } = await axios.get('/api/zerodha/status');
      setZerodhaStatus(data);
    } catch (error) {
      console.error('Error fetching Zerodha status:', error);
    }
  };

  const connectZerodha = async () => {
    setConnecting(true);
    try {
      const { data } = await axios.get('/api/zerodha/login-url', {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      window.location.href = data.loginUrl;
    } catch (error) {
      alert(error.response?.data?.message || 'Error getting Zerodha login URL');
      setConnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin text-gray-400" size={32} />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Super Admin Dashboard</h1>
        
        {/* Zerodha Connection */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${zerodhaStatus.connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
            <span className="text-sm text-gray-400">
              Zerodha: {zerodhaStatus.connected ? (
                <span className="text-green-400">Connected ({zerodhaStatus.userId})</span>
              ) : (
                <span className="text-red-400">Disconnected</span>
              )}
            </span>
          </div>
          {!zerodhaStatus.connected && (
            <button
              onClick={connectZerodha}
              disabled={connecting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {connecting ? (
                <>
                  <RefreshCw className="animate-spin" size={14} />
                  Connecting...
                </>
              ) : (
                <>
                  <TrendingUp size={14} />
                  Connect Zerodha
                </>
              )}
            </button>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Total Admins" value={stats?.totalAdmins || 0} subtitle={`${stats?.activeAdmins || 0} active`} color="yellow" />
        <StatCard title="Total Users" value={stats?.totalUsers || 0} subtitle={`${stats?.activeUsers || 0} active`} color="purple" />
        <StatCard title="Admin Wallets" value={`₹${(stats?.totalAdminBalance || 0).toLocaleString()}`} subtitle="Total balance" color="green" />
        <StatCard title="User Wallets" value={`₹${(stats?.totalUserBalance || 0).toLocaleString()}`} subtitle="Total balance" color="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-dark-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <Link to="/admin/admins" className="flex items-center gap-3 p-3 bg-dark-700 rounded-lg hover:bg-dark-600 transition">
              <Shield className="text-yellow-400" size={24} />
              <div>
                <div className="font-medium">Manage Admins</div>
                <div className="text-sm text-gray-400">Create, edit, fund admins</div>
              </div>
            </Link>
            <Link to="/admin/instruments" className="flex items-center gap-3 p-3 bg-dark-700 rounded-lg hover:bg-dark-600 transition">
              <TrendingUp className="text-green-400" size={24} />
              <div>
                <div className="font-medium">Instruments</div>
                <div className="text-sm text-gray-400">Manage trading instruments</div>
              </div>
            </Link>
            <Link to="/admin/market-control" className="flex items-center gap-3 p-3 bg-dark-700 rounded-lg hover:bg-dark-600 transition">
              <BarChart3 className="text-blue-400" size={24} />
              <div>
                <div className="font-medium">Market Control</div>
                <div className="text-sm text-gray-400">Open/Close market trading</div>
              </div>
            </Link>
          </div>
        </div>

        <div className="bg-dark-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">System Info</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Platform</span>
              <span>NTrader v1.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Your Role</span>
              <span className="text-yellow-400">SUPER_ADMIN</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Status</span>
              <span className="text-green-400">Active</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Admin Dashboard Home
const AdminDashboardHome = () => {
  const { admin, updateAdmin } = useAuth();
  const [stats, setStats] = useState({ users: 0, pendingRequests: 0 });
  const [loading, setLoading] = useState(true);
  const [walletBalance, setWalletBalance] = useState(admin?.wallet?.balance || 0);

  useEffect(() => {
    fetchStats();
    refreshAdminData();
  }, []);

  // Refresh admin data from server to get latest wallet balance
  const refreshAdminData = async () => {
    try {
      const { data } = await axios.get('/api/admin/me', {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      if (data.wallet) {
        setWalletBalance(data.wallet.balance || 0);
        updateAdmin({ wallet: data.wallet, stats: data.stats });
      }
    } catch (error) {
      console.error('Error refreshing admin data:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const [usersRes, requestsRes] = await Promise.all([
        axios.get('/api/admin/manage/users', { headers: { Authorization: `Bearer ${admin.token}` } }),
        axios.get('/api/admin/manage/fund-requests?status=PENDING', { headers: { Authorization: `Bearer ${admin.token}` } })
      ]);
      setStats({
        users: usersRes.data.length,
        pendingRequests: requestsRes.data.length
      });
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Your Wallet" value={`₹${walletBalance.toLocaleString()}`} subtitle="Available balance" color="green" />
        <StatCard title="Total Users" value={stats.users} subtitle="Under your code" color="purple" />
        <StatCard title="Pending Requests" value={stats.pendingRequests} subtitle="Fund requests" color="yellow" />
        <StatCard title="Admin Code" value={admin?.adminCode || 'N/A'} subtitle="Share with users" color="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-dark-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <Link to="/admin/users" className="flex items-center gap-3 p-3 bg-dark-700 rounded-lg hover:bg-dark-600 transition">
              <Users className="text-purple-400" size={24} />
              <div>
                <div className="font-medium">Manage Users</div>
                <div className="text-sm text-gray-400">Create, edit, fund users</div>
              </div>
            </Link>
            <Link to="/admin/trades" className="flex items-center gap-3 p-3 bg-dark-700 rounded-lg hover:bg-dark-600 transition">
              <FileText className="text-green-400" size={24} />
              <div>
                <div className="font-medium">Trade Management</div>
                <div className="text-sm text-gray-400">View and manage user trades</div>
              </div>
            </Link>
            <Link to="/admin/fund-requests" className="flex items-center gap-3 p-3 bg-dark-700 rounded-lg hover:bg-dark-600 transition">
              <CreditCard className="text-yellow-400" size={24} />
              <div>
                <div className="font-medium">Fund Requests</div>
                <div className="text-sm text-gray-400">{stats.pendingRequests} pending</div>
              </div>
            </Link>
            <Link to="/admin/bank-accounts" className="flex items-center gap-3 p-3 bg-dark-700 rounded-lg hover:bg-dark-600 transition">
              <Building2 className="text-blue-400" size={24} />
              <div>
                <div className="font-medium">Bank Accounts</div>
                <div className="text-sm text-gray-400">Manage payment methods</div>
              </div>
            </Link>
          </div>
        </div>

        <div className="bg-dark-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Your Info</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Name</span>
              <span>{admin?.name || admin?.username}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Email</span>
              <span>{admin?.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Admin Code</span>
              <span className="text-purple-400 font-mono">{admin?.adminCode}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Status</span>
              <span className="text-green-400">{admin?.status || 'ACTIVE'}</span>
            </div>
          </div>
          
          {/* User Registration Link */}
          {admin?.referralCode && (
            <div className="mt-4 pt-4 border-t border-dark-600">
              <div className="text-sm text-gray-400 mb-2">User Registration Link</div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={`${window.location.origin}/login?ref=${admin.referralCode}`}
                  className="flex-1 bg-dark-700 border border-dark-600 rounded px-3 py-2 text-xs font-mono text-green-400"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/login?ref=${admin.referralCode}`);
                    alert('Link copied!');
                  }}
                  className="px-3 py-2 bg-green-600 hover:bg-green-700 rounded text-sm"
                >
                  Copy
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">Share this link with users to register under your account.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Stat Card Component
const StatCard = ({ title, value, subtitle, color }) => {
  const colors = {
    green: 'text-green-400',
    purple: 'text-purple-400',
    yellow: 'text-yellow-400',
    blue: 'text-blue-400',
    red: 'text-red-400'
  };

  return (
    <div className="bg-dark-800 rounded-lg p-4">
      <div className="text-sm text-gray-400">{title}</div>
      <div className={`text-2xl font-bold ${colors[color] || 'text-white'}`}>{value}</div>
      <div className="text-xs text-gray-500">{subtitle}</div>
    </div>
  );
};

// Admin Management - Shows hierarchy based on role
// SUPER_ADMIN: sees all Admins, Brokers, Sub Brokers
// ADMIN: sees Brokers and Sub Brokers they created
// BROKER: sees Sub Brokers they created
const AdminManagement = () => {
  const { admin } = useAuth();
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFundModal, setShowFundModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showChargesModal, setShowChargesModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showUsersModal, setShowUsersModal] = useState(false);
  const [adminUsers, setAdminUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  
  const isSuperAdmin = admin?.role === 'SUPER_ADMIN';
  const isAdmin = admin?.role === 'ADMIN';
  const isBroker = admin?.role === 'BROKER';
  
  // Get allowed roles based on current admin role
  const getAllowedRoles = () => {
    if (isSuperAdmin) return ['ADMIN', 'BROKER', 'SUB_BROKER'];
    if (isAdmin) return ['BROKER', 'SUB_BROKER'];
    if (isBroker) return ['SUB_BROKER'];
    return [];
  };
  
  const allowedRoles = getAllowedRoles();
  
  // Filter admins by role
  const filteredByRole = roleFilter === 'ALL' 
    ? admins 
    : admins.filter(a => a.role === roleFilter);

  const { currentPage, setCurrentPage, totalPages, paginatedData: paginatedAdmins, totalItems } = usePagination(
    filteredByRole, 20, searchTerm, ['name', 'username', 'email', 'adminCode', 'phone']
  );
  
  // Get role badge color
  const getRoleBadgeColor = (role) => {
    switch(role) {
      case 'ADMIN': return 'bg-purple-500/20 text-purple-400';
      case 'BROKER': return 'bg-cyan-500/20 text-cyan-400';
      case 'SUB_BROKER': return 'bg-green-500/20 text-green-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };
  
  // Get role display name
  const getRoleLabel = (role) => {
    switch(role) {
      case 'ADMIN': return 'Admin';
      case 'BROKER': return 'Broker';
      case 'SUB_BROKER': return 'Sub Broker';
      default: return role;
    }
  };
  
  // Get title based on role
  const getTitle = () => {
    if (isSuperAdmin) return 'Hierarchy Management';
    if (isAdmin) return 'Broker / Sub Broker Management';
    if (isBroker) return 'Sub Broker Management';
    return 'Management';
  };
  
  // Get create button label
  const getCreateLabel = () => {
    if (isSuperAdmin) return 'Create Admin/Broker/SubBroker';
    if (isAdmin) return 'Create Broker/SubBroker';
    if (isBroker) return 'Create Sub Broker';
    return 'Create';
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    try {
      const { data } = await axios.get('/api/admin/manage/admins', {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      setAdmins(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (adminId, newStatus) => {
    try {
      await axios.put(`/api/admin/manage/admins/${adminId}/status`, { status: newStatus }, {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      fetchAdmins();
    } catch (error) {
      alert(error.response?.data?.message || 'Error updating status');
    }
  };

  const handleRoleChange = async (adminId, newRole) => {
    try {
      await axios.put(`/api/admin/manage/admins/${adminId}/role`, { role: newRole }, {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      fetchAdmins();
      setShowRoleModal(false);
      setSelectedAdmin(null);
      alert(`Role changed to ${newRole} successfully`);
    } catch (error) {
      alert(error.response?.data?.message || 'Error changing role');
    }
  };

  const fetchAdminUsers = async (targetAdmin) => {
    setLoadingUsers(true);
    setAdminUsers([]);
    try {
      const { data } = await axios.get(`/api/admin/manage/admins/${targetAdmin._id}/users`, {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      setAdminUsers(data.users || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      setAdminUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleViewUsers = (adm) => {
    setSelectedAdmin(adm);
    setShowUsersModal(true);
    fetchAdminUsers(adm);
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold">{getTitle()}</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-yellow-600 hover:bg-yellow-700 px-4 py-2 rounded-lg"
        >
          <Plus size={20} />
          {getCreateLabel()}
        </button>
      </div>

      {/* Role Filter & Search */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        {/* Role Filter Tabs */}
        {allowedRoles.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setRoleFilter('ALL')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                roleFilter === 'ALL' ? 'bg-yellow-600 text-white' : 'bg-dark-700 text-gray-400 hover:bg-dark-600'
              }`}
            >
              All ({admins.length})
            </button>
            {allowedRoles.map(role => (
              <button
                key={role}
                onClick={() => setRoleFilter(role)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  roleFilter === role ? getRoleBadgeColor(role).replace('/20', '') : 'bg-dark-700 text-gray-400 hover:bg-dark-600'
                }`}
              >
                {getRoleLabel(role)} ({admins.filter(a => a.role === role).length})
              </button>
            ))}
          </div>
        )}
        
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search by name, email, or code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-dark-700 border border-dark-600 rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:border-yellow-500"
          />
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-dark-800 rounded-lg p-4">
          <div className="text-sm text-gray-400">Total</div>
          <div className="text-2xl font-bold text-yellow-400">{admins.length}</div>
        </div>
        {isSuperAdmin && (
          <div className="bg-dark-800 rounded-lg p-4">
            <div className="text-sm text-gray-400">Admins</div>
            <div className="text-2xl font-bold text-purple-400">{admins.filter(a => a.role === 'ADMIN').length}</div>
          </div>
        )}
        {(isSuperAdmin || isAdmin) && (
          <div className="bg-dark-800 rounded-lg p-4">
            <div className="text-sm text-gray-400">Brokers</div>
            <div className="text-2xl font-bold text-blue-400">{admins.filter(a => a.role === 'BROKER').length}</div>
          </div>
        )}
        <div className="bg-dark-800 rounded-lg p-4">
          <div className="text-sm text-gray-400">Sub Brokers</div>
          <div className="text-2xl font-bold text-green-400">{admins.filter(a => a.role === 'SUB_BROKER').length}</div>
        </div>
        <div className="bg-dark-800 rounded-lg p-4">
          <div className="text-sm text-gray-400">Total Users</div>
          <div className="text-2xl font-bold text-purple-400">{admins.reduce((sum, a) => sum + (a.stats?.totalUsers || 0), 0)}</div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8"><RefreshCw className="animate-spin inline" /></div>
      ) : totalItems === 0 ? (
        <div className="text-center py-8 text-gray-400">No admins found</div>
      ) : (
        <div className="space-y-4">
          {paginatedAdmins.map(adm => (
            <div key={adm._id} className="bg-dark-800 rounded-lg p-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Admin Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-lg">{adm.name || adm.username}</span>
                    <span className={`px-2 py-0.5 rounded text-xs ${getRoleBadgeColor(adm.role)}`}>
                      {getRoleLabel(adm.role)}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs ${adm.status === 'ACTIVE' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      {adm.status}
                    </span>
                  </div>
                  <div className="text-sm text-gray-400 mt-1">{adm.email} • {adm.phone || 'No phone'}</div>
                  <div className="flex items-center gap-4 mt-2 flex-wrap">
                    <span className="text-sm font-mono bg-purple-500/20 text-purple-400 px-2 py-1 rounded">{adm.adminCode}</span>
                    {adm.parentId && (
                      <span className="text-xs text-gray-500">Parent: {adm.parentId?.name || adm.parentId?.adminCode || 'N/A'}</span>
                    )}
                    <span className="text-xs text-gray-500">Created: {new Date(adm.createdAt).toLocaleDateString()}</span>
                    {adm.referralCode && (
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/login?ref=${adm.referralCode}`);
                          alert('Registration link copied!');
                        }}
                        className="text-xs bg-green-600/20 text-green-400 px-2 py-1 rounded hover:bg-green-600/30"
                      >
                        Copy User Link
                      </button>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="flex gap-6">
                  <div className="text-center">
                    <div className="text-xs text-gray-400">Wallet</div>
                    <div className="text-lg font-bold text-green-400">₹{(adm.wallet?.balance || 0).toLocaleString()}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-400">Users</div>
                    <div className="text-lg font-bold">{adm.stats?.totalUsers || adm.userCount || 0}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-400">Brokerage</div>
                    <div className="text-lg font-bold">₹{adm.charges?.brokerage || 20}</div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => { setSelectedAdmin(adm); setShowDetailModal(true); }}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm flex items-center gap-1"
                  >
                    <Eye size={16} /> View
                  </button>
                  <button
                    onClick={() => handleViewUsers(adm)}
                    className="px-3 py-2 bg-cyan-600 hover:bg-cyan-700 rounded text-sm flex items-center gap-1"
                  >
                    <Users size={16} /> Users ({adm.stats?.totalUsers || adm.userCount || 0})
                  </button>
                  <button
                    onClick={() => { setSelectedAdmin(adm); setShowFundModal(true); }}
                    className="px-3 py-2 bg-green-600 hover:bg-green-700 rounded text-sm flex items-center gap-1"
                  >
                    <Wallet size={16} /> Fund
                  </button>
                  <button
                    onClick={() => { setSelectedAdmin(adm); setShowChargesModal(true); }}
                    className="px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded text-sm flex items-center gap-1"
                  >
                    <Settings size={16} /> Charges
                  </button>
                  <button
                    onClick={() => { setSelectedAdmin(adm); setShowPasswordModal(true); }}
                    className="px-3 py-2 bg-yellow-600 hover:bg-yellow-700 rounded text-sm flex items-center gap-1"
                  >
                    <Key size={16} /> Password
                  </button>
                  {isSuperAdmin && (
                    <button
                      onClick={() => { setSelectedAdmin(adm); setShowRoleModal(true); }}
                      className="px-3 py-2 bg-orange-600 hover:bg-orange-700 rounded text-sm flex items-center gap-1"
                    >
                      <Shield size={16} /> Role
                    </button>
                  )}
                  {adm.status === 'ACTIVE' ? (
                    <button
                      onClick={() => handleStatusChange(adm._id, 'SUSPENDED')}
                      className="px-3 py-2 bg-red-600 hover:bg-red-700 rounded text-sm"
                    >
                      Suspend
                    </button>
                  ) : (
                    <button
                      onClick={() => handleStatusChange(adm._id, 'ACTIVE')}
                      className="px-3 py-2 bg-green-600 hover:bg-green-700 rounded text-sm"
                    >
                      Activate
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalItems={totalItems}
            itemsPerPage={20}
          />
        </div>
      )}

      {/* Modals */}
      {showCreateModal && (
        <CreateAdminModal
          token={admin.token}
          creatorRole={admin.role}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => { setShowCreateModal(false); fetchAdmins(); }}
        />
      )}

      {showFundModal && selectedAdmin && (
        <AdminFundModal
          admin={selectedAdmin}
          token={admin.token}
          onClose={() => { setShowFundModal(false); setSelectedAdmin(null); }}
          onSuccess={() => { fetchAdmins(); }}
        />
      )}

      {showDetailModal && selectedAdmin && (
        <AdminDetailModal
          admin={selectedAdmin}
          token={admin.token}
          onClose={() => { setShowDetailModal(false); setSelectedAdmin(null); }}
        />
      )}

      {showPasswordModal && selectedAdmin && (
        <AdminPasswordResetModal
          admin={selectedAdmin}
          token={admin.token}
          onClose={() => { setShowPasswordModal(false); setSelectedAdmin(null); }}
        />
      )}

      {showChargesModal && selectedAdmin && (
        <AdminChargesModal
          admin={selectedAdmin}
          token={admin.token}
          onClose={() => { setShowChargesModal(false); setSelectedAdmin(null); }}
          onSuccess={() => { fetchAdmins(); }}
        />
      )}

      {/* Role Change Modal - Super Admin Only */}
      {showRoleModal && selectedAdmin && isSuperAdmin && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Change Role</h2>
              <button onClick={() => { setShowRoleModal(false); setSelectedAdmin(null); }} className="text-gray-400 hover:text-white">
                <X size={24} />
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-gray-400 mb-2">
                Change role for <span className="text-white font-medium">{selectedAdmin.name || selectedAdmin.username}</span>
              </p>
              <p className="text-sm text-gray-500">
                Current Role: <span className={`font-medium ${
                  selectedAdmin.role === 'ADMIN' ? 'text-purple-400' : 
                  selectedAdmin.role === 'BROKER' ? 'text-blue-400' : 'text-green-400'
                }`}>{getRoleLabel(selectedAdmin.role)}</span>
              </p>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-gray-400">Select new role:</p>
              <div className="grid grid-cols-3 gap-2">
                {['ADMIN', 'BROKER', 'SUB_BROKER'].map(role => (
                  <button
                    key={role}
                    onClick={() => handleRoleChange(selectedAdmin._id, role)}
                    disabled={selectedAdmin.role === role}
                    className={`px-4 py-3 rounded-lg text-sm font-medium transition ${
                      selectedAdmin.role === role
                        ? 'bg-dark-600 text-gray-500 cursor-not-allowed'
                        : role === 'ADMIN' ? 'bg-purple-600 hover:bg-purple-700 text-white'
                        : role === 'BROKER' ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'bg-green-600 hover:bg-green-700 text-white'
                    }`}
                  >
                    {getRoleLabel(role)}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <p className="text-xs text-yellow-400">
                ⚠️ Changing role will affect this admin's permissions and hierarchy access.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Users Modal - View users under selected admin */}
      {showUsersModal && selectedAdmin && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 rounded-lg w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-dark-600">
              <div>
                <h2 className="text-xl font-bold">Users under {selectedAdmin.name || selectedAdmin.username}</h2>
                <p className="text-sm text-gray-400">
                  <span className={`px-2 py-0.5 rounded text-xs ${getRoleBadgeColor(selectedAdmin.role)}`}>
                    {getRoleLabel(selectedAdmin.role)}
                  </span>
                  <span className="ml-2">{selectedAdmin.adminCode}</span>
                </p>
              </div>
              <button onClick={() => { setShowUsersModal(false); setSelectedAdmin(null); setAdminUsers([]); }} className="text-gray-400 hover:text-white">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto flex-1">
              {loadingUsers ? (
                <div className="text-center py-8"><RefreshCw className="animate-spin inline" size={24} /></div>
              ) : adminUsers.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Users size={48} className="mx-auto mb-4 opacity-50" />
                  <p>No users found under this {getRoleLabel(selectedAdmin.role).toLowerCase()}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-sm text-gray-400 mb-4">
                    Total Users: <span className="text-white font-bold">{adminUsers.length}</span>
                  </div>
                  <div className="grid gap-3">
                    {adminUsers.map(user => (
                      <div key={user._id} className="bg-dark-700 rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold">{user.fullName || user.username}</span>
                            <span className={`px-2 py-0.5 rounded text-xs ${user.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                              {user.isActive ? 'Active' : 'Inactive'}
                            </span>
                            {user.isDemo && <span className="px-2 py-0.5 rounded text-xs bg-yellow-500/20 text-yellow-400">Demo</span>}
                          </div>
                          <div className="text-sm text-gray-400 mt-1">{user.email}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            <span className="font-mono">{user.userId}</span>
                            {user.phone && <span className="ml-2">• {user.phone}</span>}
                          </div>
                        </div>
                        <div className="flex gap-4 text-center">
                          <div>
                            <div className="text-xs text-gray-400">Cash Balance</div>
                            <div className="text-green-400 font-bold">₹{(user.wallet?.cashBalance || 0).toLocaleString()}</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-400">P&L</div>
                            <div className={`font-bold ${(user.wallet?.totalPnL || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              ₹{(user.wallet?.totalPnL || 0).toLocaleString()}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-400">Created</div>
                            <div className="text-gray-300 text-sm">{new Date(user.createdAt).toLocaleDateString()}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-dark-600">
              <button
                onClick={() => { setShowUsersModal(false); setSelectedAdmin(null); setAdminUsers([]); }}
                className="w-full py-2 bg-dark-600 hover:bg-dark-500 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Create Admin Modal - Supports role selection based on creator's role
const CreateAdminModal = ({ token, onClose, onSuccess, creatorRole }) => {
  // Get allowed roles based on creator's role
  const getAllowedRoles = () => {
    switch(creatorRole) {
      case 'SUPER_ADMIN': return ['ADMIN', 'BROKER', 'SUB_BROKER']; // Can create all with parent selection
      case 'ADMIN': return ['BROKER', 'SUB_BROKER']; // Can create broker and sub-broker under their brokers
      case 'BROKER': return ['SUB_BROKER']; // Only Broker can create Sub-Broker directly
      default: return [];
    }
  };
  
  const allowedRoles = getAllowedRoles();
  const [formData, setFormData] = useState({ 
    username: '', 
    name: '', 
    email: '', 
    phone: '', 
    password: '', 
    pin: '',
    role: allowedRoles[0] || 'ADMIN',
    parentAdminId: '' // For assigning broker/sub-broker under specific parent
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [adminsList, setAdminsList] = useState([]); // List of ADMINs
  const [brokersList, setBrokersList] = useState([]); // List of BROKERs (filtered by selected admin)
  const [allBrokers, setAllBrokers] = useState([]); // All brokers for filtering
  const [selectedAdminFilter, setSelectedAdminFilter] = useState(''); // Admin filter for SUB_BROKER creation
  
  // Fetch admins and brokers list based on role selection
  useEffect(() => {
    if (['SUPER_ADMIN', 'ADMIN'].includes(creatorRole) && ['BROKER', 'SUB_BROKER'].includes(formData.role)) {
      fetchHierarchyList();
    }
  }, [formData.role, creatorRole]);
  
  // Filter brokers when admin filter changes
  useEffect(() => {
    if (formData.role === 'SUB_BROKER' && selectedAdminFilter) {
      const filtered = allBrokers.filter(b => b.parentId?._id === selectedAdminFilter || b.parentId === selectedAdminFilter);
      setBrokersList(filtered);
      // Reset broker selection if current selection is not in filtered list
      if (formData.parentAdminId && !filtered.find(b => b._id === formData.parentAdminId)) {
        setFormData(prev => ({ ...prev, parentAdminId: '' }));
      }
    } else if (formData.role === 'SUB_BROKER' && !selectedAdminFilter) {
      setBrokersList(allBrokers);
    }
  }, [selectedAdminFilter, allBrokers, formData.role]);
  
  const fetchHierarchyList = async () => {
    try {
      const res = await axios.get('/api/admin/manage/admins', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const admins = res.data.filter(a => a.role === 'ADMIN');
      const brokers = res.data.filter(a => a.role === 'BROKER');
      setAdminsList(admins);
      setAllBrokers(brokers);
      setBrokersList(brokers);
    } catch (err) {
      console.error('Error fetching hierarchy:', err);
    }
  };
  
  const getRoleLabel = (role) => {
    switch(role) {
      case 'ADMIN': return 'Admin';
      case 'BROKER': return 'Broker';
      case 'SUB_BROKER': return 'Sub Broker';
      default: return role;
    }
  };
  
  const getRoleBadgeColor = (role) => {
    switch(role) {
      case 'ADMIN': return 'bg-purple-600';
      case 'BROKER': return 'bg-cyan-600';
      case 'SUB_BROKER': return 'bg-green-600';
      default: return 'bg-gray-600';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      // Prepare payload - include parentAdminId only if selected
      const payload = { ...formData };
      if (!payload.parentAdminId) {
        delete payload.parentAdminId;
      }
      await axios.post('/api/admin/manage/admins', payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || 'Error creating');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 rounded-lg w-full max-w-md p-6">
        <div className="flex justify-between mb-4">
          <h2 className="text-xl font-bold">Create New {getRoleLabel(formData.role)}</h2>
          <button onClick={onClose}><X size={24} /></button>
        </div>
        {error && <div className="bg-red-500/20 text-red-400 p-2 rounded mb-4">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Role Selection */}
          {allowedRoles.length > 1 && (
            <div>
              <label className="block text-sm text-gray-400 mb-2">Select Role</label>
              <div className="flex gap-2 flex-wrap">
                {allowedRoles.map(role => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => { setFormData({...formData, role, parentAdminId: ''}); setSelectedAdminFilter(''); }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                      formData.role === role ? getRoleBadgeColor(role) + ' text-white' : 'bg-dark-700 text-gray-400 hover:bg-dark-600'
                    }`}
                  >
                    {getRoleLabel(role)}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {/* Parent Selection - For SUPER_ADMIN/ADMIN creating BROKER */}
          {['SUPER_ADMIN', 'ADMIN'].includes(creatorRole) && formData.role === 'BROKER' && (
            <div>
              <label className="block text-sm text-gray-400 mb-2">Assign Under Admin (Optional)</label>
              <select
                value={formData.parentAdminId}
                onChange={e => setFormData({...formData, parentAdminId: e.target.value})}
                className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2"
              >
                <option value="">-- Direct under {creatorRole === 'SUPER_ADMIN' ? 'Super Admin' : 'You'} --</option>
                {adminsList.map(adm => (
                  <option key={adm._id} value={adm._id}>
                    {adm.name || adm.username} ({adm.adminCode})
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Leave empty to create broker directly under you, or select an admin.
              </p>
            </div>
          )}
          
          {/* Two-step Selection for SUB_BROKER: First Admin filter, then Broker */}
          {['SUPER_ADMIN', 'ADMIN'].includes(creatorRole) && formData.role === 'SUB_BROKER' && (
            <>
              {/* Step 1: Filter by Admin (Optional) */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Filter by Admin (Optional)</label>
                <select
                  value={selectedAdminFilter}
                  onChange={e => setSelectedAdminFilter(e.target.value)}
                  className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2"
                >
                  <option value="">-- All Admins --</option>
                  {adminsList.map(adm => (
                    <option key={adm._id} value={adm._id}>
                      {adm.name || adm.username} ({adm.adminCode})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Select an admin to show only brokers under that admin.
                </p>
              </div>
              
              {/* Step 2: Select Parent Broker */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Select Parent Broker *</label>
                <select
                  value={formData.parentAdminId}
                  onChange={e => setFormData({...formData, parentAdminId: e.target.value})}
                  className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2"
                  required
                >
                  <option value="">-- Select a Broker --</option>
                  {brokersList.map(broker => (
                    <option key={broker._id} value={broker._id}>
                      {broker.name || broker.username} ({broker.adminCode}) {broker.parentId?.name ? `- Under ${broker.parentId.name}` : ''}
                    </option>
                  ))}
                </select>
                {brokersList.length === 0 && selectedAdminFilter && (
                  <p className="text-xs text-yellow-500 mt-1">
                    No brokers found under this admin.
                  </p>
                )}
                {!selectedAdminFilter && (
                  <p className="text-xs text-gray-500 mt-1">
                    Sub-broker must be created under a broker.
                  </p>
                )}
              </div>
            </>
          )}
          
          <input type="text" placeholder="Username *" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2" required />
          <input type="text" placeholder="Full Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2" />
          <input type="email" placeholder="Email *" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2" required />
          <input type="text" placeholder="Phone" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2" />
          <input type="password" placeholder="Password *" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2" required />
          <input
            type="text"
            inputMode="numeric"
            placeholder="4-6 digit PIN *"
            value={formData.pin}
            onChange={e => setFormData({ ...formData, pin: e.target.value.replace(/\D/g, '') })}
            className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2"
            required
            pattern="[0-9]{4,6}"
          />
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 bg-dark-600 py-2 rounded">Cancel</button>
            <button type="submit" disabled={loading} className={`flex-1 ${getRoleBadgeColor(formData.role)} py-2 rounded`}>
              {loading ? 'Creating...' : `Create ${getRoleLabel(formData.role)}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Admin Fund Modal
const AdminFundModal = ({ admin: targetAdmin, token, onClose, onSuccess }) => {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFund = async (action) => {
    if (!amount || Number(amount) <= 0) return setError('Enter valid amount');
    setLoading(true);
    setError('');
    try {
      await axios.post(`/api/admin/manage/admins/${targetAdmin._id}/${action}-funds`, { 
        amount: Number(amount),
        description 
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAmount('');
      setDescription('');
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 rounded-lg w-full max-w-md p-6">
        <div className="flex justify-between mb-4">
          <h2 className="text-xl font-bold">Manage Admin Wallet</h2>
          <button onClick={onClose}><X size={24} /></button>
        </div>
        <div className="bg-dark-700 rounded p-4 mb-4">
          <div className="text-sm text-gray-400">{targetAdmin.name || targetAdmin.username}</div>
          <div className="text-xs text-purple-400 font-mono">{targetAdmin.adminCode}</div>
          <div className="text-2xl font-bold text-green-400 mt-2">₹{targetAdmin.wallet?.balance?.toLocaleString() || '0'}</div>
        </div>
        {error && <div className="bg-red-500/20 text-red-400 p-2 rounded mb-4">{error}</div>}
        <input type="number" placeholder="Amount (₹)" value={amount} onChange={e => setAmount(e.target.value)} className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2 mb-3" />
        <input type="text" placeholder="Description (optional)" value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2 mb-4" />
        <div className="flex gap-3">
          <button onClick={() => handleFund('add')} disabled={loading} className="flex-1 bg-green-600 hover:bg-green-700 py-2 rounded flex items-center justify-center gap-2">
            <ArrowUpCircle size={18} /> Deposit
          </button>
          <button onClick={() => handleFund('deduct')} disabled={loading} className="flex-1 bg-red-600 hover:bg-red-700 py-2 rounded flex items-center justify-center gap-2">
            <ArrowDownCircle size={18} /> Withdraw
          </button>
        </div>
      </div>
    </div>
  );
};

// Admin Detail Modal - Shows users and ledger
const AdminDetailModal = ({ admin: targetAdmin, token, onClose }) => {
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [usersRes, ledgerRes] = await Promise.all([
        axios.get(`/api/admin/manage/admins/${targetAdmin._id}/users`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`/api/admin/manage/admins/${targetAdmin._id}/ledger`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setUsers(usersRes.data.users || []);
      setLedger(ledgerRes.data || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-start p-6 border-b border-dark-600">
          <div>
            <h2 className="text-xl font-bold">{targetAdmin.name || targetAdmin.username}</h2>
            <div className="text-sm text-gray-400">{targetAdmin.email}</div>
            <div className="flex items-center gap-3 mt-2">
              <span className="font-mono bg-purple-500/20 text-purple-400 px-2 py-1 rounded text-sm">{targetAdmin.adminCode}</span>
              <span className={`px-2 py-1 rounded text-xs ${targetAdmin.status === 'ACTIVE' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                {targetAdmin.status}
              </span>
            </div>
          </div>
          <button onClick={onClose}><X size={24} /></button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 p-4 border-b border-dark-600">
          <div className="text-center">
            <div className="text-xs text-gray-400">Wallet Balance</div>
            <div className="text-lg font-bold text-green-400">₹{(targetAdmin.wallet?.balance || 0).toLocaleString()}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-400">Total Users</div>
            <div className="text-lg font-bold">{users.length}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-400">Brokerage</div>
            <div className="text-lg font-bold">₹{targetAdmin.charges?.brokerage || 20}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-400">Leverage</div>
            <div className="text-lg font-bold">{targetAdmin.charges?.intradayLeverage || 5}x</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-dark-600">
          <button onClick={() => setActiveTab('users')} className={`flex-1 py-3 ${activeTab === 'users' ? 'bg-purple-600' : 'bg-dark-700'}`}>
            Users ({users.length})
          </button>
          <button onClick={() => setActiveTab('ledger')} className={`flex-1 py-3 ${activeTab === 'ledger' ? 'bg-purple-600' : 'bg-dark-700'}`}>
            Ledger ({ledger.length})
          </button>
          <button onClick={() => setActiveTab('charges')} className={`flex-1 py-3 ${activeTab === 'charges' ? 'bg-purple-600' : 'bg-dark-700'}`}>
            Charges
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center py-8"><RefreshCw className="animate-spin inline" /></div>
          ) : activeTab === 'users' ? (
            users.length === 0 ? (
              <div className="text-center py-8 text-gray-400">No users under this admin</div>
            ) : (
              <div className="space-y-2">
                {users.map(user => (
                  <div key={user._id} className="flex items-center justify-between bg-dark-700 rounded p-3">
                    <div>
                      <div className="font-medium">{user.fullName || user.username}</div>
                      <div className="text-xs text-gray-400">{user.email} • {user.userId}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-green-400 font-bold">₹{(user.wallet?.cashBalance || 0).toLocaleString()}</div>
                      <div className="text-xs text-blue-400">Trading: ₹{(user.wallet?.tradingBalance || 0).toLocaleString()}</div>
                      <div className={`text-xs ${user.isActive ? 'text-green-400' : 'text-red-400'}`}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : activeTab === 'ledger' ? (
            ledger.length === 0 ? (
              <div className="text-center py-8 text-gray-400">No transactions</div>
            ) : (
              <div className="space-y-2">
                {ledger.map(entry => (
                  <div key={entry._id} className="flex items-center justify-between bg-dark-700 rounded p-3">
                    <div>
                      <div className="text-sm">{entry.reason}</div>
                      <div className="text-xs text-gray-400">{new Date(entry.createdAt).toLocaleString()}</div>
                    </div>
                    <div className="text-right">
                      <div className={entry.type === 'CREDIT' ? 'text-green-400' : 'text-red-400'}>
                        {entry.type === 'CREDIT' ? '+' : '-'}₹{entry.amount?.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-400">Bal: ₹{entry.balanceAfter?.toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-dark-700 rounded p-3">
                <div className="text-xs text-gray-400">Brokerage</div>
                <div className="text-lg font-bold">₹{targetAdmin.charges?.brokerage || 20}</div>
              </div>
              <div className="bg-dark-700 rounded p-3">
                <div className="text-xs text-gray-400">Intraday Leverage</div>
                <div className="text-lg font-bold">{targetAdmin.charges?.intradayLeverage || 5}x</div>
              </div>
              <div className="bg-dark-700 rounded p-3">
                <div className="text-xs text-gray-400">Delivery Leverage</div>
                <div className="text-lg font-bold">{targetAdmin.charges?.deliveryLeverage || 1}x</div>
              </div>
              <div className="bg-dark-700 rounded p-3">
                <div className="text-xs text-gray-400">Option Buy Leverage</div>
                <div className="text-lg font-bold">{targetAdmin.charges?.optionBuyLeverage || 1}x</div>
              </div>
              <div className="bg-dark-700 rounded p-3">
                <div className="text-xs text-gray-400">Withdrawal Fee</div>
                <div className="text-lg font-bold">₹{targetAdmin.charges?.withdrawalFee || 0}</div>
              </div>
              <div className="bg-dark-700 rounded p-3">
                <div className="text-xs text-gray-400">Profit Share</div>
                <div className="text-lg font-bold">{targetAdmin.charges?.profitShare || 0}%</div>
              </div>
              <div className="bg-dark-700 rounded p-3">
                <div className="text-xs text-gray-400">Min Withdrawal</div>
                <div className="text-lg font-bold">₹{targetAdmin.charges?.minWithdrawal || 100}</div>
              </div>
              <div className="bg-dark-700 rounded p-3">
                <div className="text-xs text-gray-400">Max Withdrawal</div>
                <div className="text-lg font-bold">₹{targetAdmin.charges?.maxWithdrawal || 100000}</div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-dark-600">
          <button onClick={onClose} className="w-full bg-dark-600 hover:bg-dark-500 py-2 rounded">Close</button>
        </div>
      </div>
    </div>
  );
};

// Admin Password Reset Modal
const AdminPasswordResetModal = ({ admin: targetAdmin, token, onClose }) => {
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const handleReset = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters' });
      return;
    }
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      await axios.put(`/api/admin/manage/admins/${targetAdmin._id}/reset-password`, { newPassword }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage({ type: 'success', text: 'Password reset successfully' });
      setTimeout(onClose, 1500);
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Error resetting password' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 rounded-lg w-full max-w-md p-6">
        <div className="flex justify-between mb-4">
          <h2 className="text-xl font-bold">Reset Admin Password</h2>
          <button onClick={onClose}><X size={24} /></button>
        </div>
        <div className="bg-dark-700 rounded p-4 mb-4">
          <div className="text-sm text-gray-400">Resetting password for:</div>
          <div className="font-bold">{targetAdmin.name || targetAdmin.username}</div>
          <div className="text-xs text-purple-400 font-mono">{targetAdmin.adminCode}</div>
        </div>
        {message.text && (
          <div className={`p-3 rounded mb-4 ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
            {message.text}
          </div>
        )}
        <form onSubmit={handleReset}>
          <div className="relative mb-4">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="New Password (min 6 characters)"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2 pr-10"
              required
              minLength={6}
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 bg-dark-600 py-2 rounded">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 bg-yellow-600 hover:bg-yellow-700 py-2 rounded">
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Admin Charges Modal
const AdminChargesModal = ({ admin: targetAdmin, token, onClose, onSuccess }) => {
  const [charges, setCharges] = useState({
    brokerage: targetAdmin.charges?.brokerage || 20,
    intradayLeverage: targetAdmin.charges?.intradayLeverage || 5,
    deliveryLeverage: targetAdmin.charges?.deliveryLeverage || 1,
    optionBuyLeverage: targetAdmin.charges?.optionBuyLeverage || 1,
    optionSellLeverage: targetAdmin.charges?.optionSellLeverage || 1,
    futuresLeverage: targetAdmin.charges?.futuresLeverage || 1,
    withdrawalFee: targetAdmin.charges?.withdrawalFee || 0,
    profitShare: targetAdmin.charges?.profitShare || 0,
    minWithdrawal: targetAdmin.charges?.minWithdrawal || 100,
    maxWithdrawal: targetAdmin.charges?.maxWithdrawal || 100000
  });
  const [brokerageCaps, setBrokerageCaps] = useState({
    perLot: {
      min: targetAdmin.brokerageCaps?.perLot?.min || 0,
      max: targetAdmin.brokerageCaps?.perLot?.max || 1000
    },
    perCrore: {
      min: targetAdmin.brokerageCaps?.perCrore?.min || 0,
      max: targetAdmin.brokerageCaps?.perCrore?.max || 10000
    },
    perTrade: {
      min: targetAdmin.brokerageCaps?.perTrade?.min || 0,
      max: targetAdmin.brokerageCaps?.perTrade?.max || 500
    }
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      // Save charges
      await axios.put(`/api/admin/manage/admins/${targetAdmin._id}/charges`, { charges }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Save brokerage caps
      await axios.put(`/api/admin/manage/admins/${targetAdmin._id}/brokerage-caps`, { brokerageCaps }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage({ type: 'success', text: 'Charges & Caps updated successfully' });
      onSuccess();
      setTimeout(onClose, 1500);
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Error updating charges' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 rounded-lg w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between mb-4">
          <h2 className="text-xl font-bold">Edit Admin Charges</h2>
          <button onClick={onClose}><X size={24} /></button>
        </div>
        <div className="bg-dark-700 rounded p-3 mb-4">
          <div className="font-bold">{targetAdmin.name || targetAdmin.username}</div>
          <div className="text-xs text-purple-400 font-mono">{targetAdmin.adminCode}</div>
        </div>
        {message.text && (
          <div className={`p-3 rounded mb-4 ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
            {message.text}
          </div>
        )}
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Brokerage (₹)</label>
              <input type="number" value={charges.brokerage} onChange={e => setCharges({...charges, brokerage: Number(e.target.value)})} className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Intraday Leverage</label>
              <input type="number" value={charges.intradayLeverage} onChange={e => setCharges({...charges, intradayLeverage: Number(e.target.value)})} className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Delivery Leverage</label>
              <input type="number" value={charges.deliveryLeverage} onChange={e => setCharges({...charges, deliveryLeverage: Number(e.target.value)})} className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Option Buy Leverage</label>
              <input type="number" value={charges.optionBuyLeverage} onChange={e => setCharges({...charges, optionBuyLeverage: Number(e.target.value)})} className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Option Sell Leverage</label>
              <input type="number" value={charges.optionSellLeverage} onChange={e => setCharges({...charges, optionSellLeverage: Number(e.target.value)})} className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Futures Leverage</label>
              <input type="number" value={charges.futuresLeverage} onChange={e => setCharges({...charges, futuresLeverage: Number(e.target.value)})} className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Withdrawal Fee (₹)</label>
              <input type="number" value={charges.withdrawalFee} onChange={e => setCharges({...charges, withdrawalFee: Number(e.target.value)})} className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Profit Share (%)</label>
              <input type="number" value={charges.profitShare} onChange={e => setCharges({...charges, profitShare: Number(e.target.value)})} className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Min Withdrawal (₹)</label>
              <input type="number" value={charges.minWithdrawal} onChange={e => setCharges({...charges, minWithdrawal: Number(e.target.value)})} className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Max Withdrawal (₹)</label>
              <input type="number" value={charges.maxWithdrawal} onChange={e => setCharges({...charges, maxWithdrawal: Number(e.target.value)})} className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2" />
            </div>
          </div>
          
          {/* Brokerage Caps Section */}
          <div className="border-t border-dark-600 pt-4 mt-4">
            <h3 className="text-sm font-semibold text-yellow-400 mb-3">Brokerage Caps (Min/Max Limits)</h3>
            <p className="text-xs text-gray-500 mb-3">Set minimum and maximum brokerage this admin can charge to users</p>
            
            {/* Per Lot Caps */}
            <div className="bg-dark-700 rounded p-3 mb-3">
              <div className="text-xs text-gray-400 font-medium mb-2">Per Lot (₹)</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Min</label>
                  <input type="number" value={brokerageCaps.perLot.min} onChange={e => setBrokerageCaps({...brokerageCaps, perLot: {...brokerageCaps.perLot, min: Number(e.target.value)}})} className="w-full bg-dark-600 border border-dark-500 rounded px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Max</label>
                  <input type="number" value={brokerageCaps.perLot.max} onChange={e => setBrokerageCaps({...brokerageCaps, perLot: {...brokerageCaps.perLot, max: Number(e.target.value)}})} className="w-full bg-dark-600 border border-dark-500 rounded px-3 py-2 text-sm" />
                </div>
              </div>
            </div>
            
            {/* Per Crore Caps */}
            <div className="bg-dark-700 rounded p-3 mb-3">
              <div className="text-xs text-gray-400 font-medium mb-2">Per Crore (₹)</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Min</label>
                  <input type="number" value={brokerageCaps.perCrore.min} onChange={e => setBrokerageCaps({...brokerageCaps, perCrore: {...brokerageCaps.perCrore, min: Number(e.target.value)}})} className="w-full bg-dark-600 border border-dark-500 rounded px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Max</label>
                  <input type="number" value={brokerageCaps.perCrore.max} onChange={e => setBrokerageCaps({...brokerageCaps, perCrore: {...brokerageCaps.perCrore, max: Number(e.target.value)}})} className="w-full bg-dark-600 border border-dark-500 rounded px-3 py-2 text-sm" />
                </div>
              </div>
            </div>
            
            {/* Per Trade Caps */}
            <div className="bg-dark-700 rounded p-3">
              <div className="text-xs text-gray-400 font-medium mb-2">Per Trade (₹)</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Min</label>
                  <input type="number" value={brokerageCaps.perTrade.min} onChange={e => setBrokerageCaps({...brokerageCaps, perTrade: {...brokerageCaps.perTrade, min: Number(e.target.value)}})} className="w-full bg-dark-600 border border-dark-500 rounded px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Max</label>
                  <input type="number" value={brokerageCaps.perTrade.max} onChange={e => setBrokerageCaps({...brokerageCaps, perTrade: {...brokerageCaps.perTrade, max: Number(e.target.value)}})} className="w-full bg-dark-600 border border-dark-500 rounded px-3 py-2 text-sm" />
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 bg-dark-600 py-2 rounded">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 bg-purple-600 hover:bg-purple-700 py-2 rounded">
              {loading ? 'Saving...' : 'Save Charges'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Super Admin Create User - Create users and assign to any admin
const SuperAdminCreateUser = () => {
  const { admin } = useAuth();
  const [admins, setAdmins] = useState([]);
  const [selectedAdmin, setSelectedAdmin] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [expandedSegment, setExpandedSegment] = useState(null);
  
  const defaultSegmentSettings = {
    enabled: false,
    fraction: false,
    maxExchangeLots: 100,
    commissionType: 'PER_LOT',
    commissionLot: 0,
    maxLots: 50,
    minLots: 1,
    orderLots: 10,
    exposureIntraday: 1,
    exposureCarryForward: 1,
    // Option Buy Settings
    optionBuy: {
      allowed: true,
      fraction: false,
      commissionType: 'PER_LOT',
      commission: 0,
      strikeSelection: 50, // Number of strikes up/down from current price
      maxExchangeLots: 100
    },
    // Option Sell Settings
    optionSell: {
      allowed: true,
      fraction: false,
      commissionType: 'PER_LOT',
      commission: 0,
      strikeSelection: 50,
      maxExchangeLots: 100
    }
  };
  
  const [formData, setFormData] = useState({
    username: '', email: '', password: '', fullName: '', phone: '', initialBalance: 0,
    // Settings
    marginType: 'exposure',
    ledgerBalanceClosePercent: 90,
    profitTradeHoldSeconds: 0,
    lossTradeHoldSeconds: 0,
    // Toggles
    isActivated: true,
    isReadOnly: false,
    isDemo: false,
    intradaySquare: false,
    blockLimitAboveBelowHighLow: false,
    blockLimitBetweenHighLow: false,
    // Segment Settings with detailed settings
    segmentPermissions: {
      NSEFUT: { ...defaultSegmentSettings, enabled: true },
      NSEOPT: { ...defaultSegmentSettings, enabled: true },
      MCXFUT: { ...defaultSegmentSettings, enabled: true },
      MCXOPT: { ...defaultSegmentSettings, enabled: true },
      'NSE-EQ': { ...defaultSegmentSettings, enabled: true },
      'BSE-FUT': { ...defaultSegmentSettings, enabled: false },
      'BSE-OPT': { ...defaultSegmentSettings, enabled: false },
      'CRYPTO': { ...defaultSegmentSettings, enabled: false }
    },
    // Global Script Settings - applies to all segments
    scriptSettings: {},
    // For script settings UI
    selectedScriptSegment: null,
    selectedScript: null,
    segmentSymbols: {
      CRYPTO: ['BTC', 'ETH', 'BNB', 'XRP', 'SOL', 'DOGE', 'ADA', 'MATIC', 'LTC', 'AVAX']
    }
  });

  useEffect(() => {
    fetchAdmins();
    fetchSegmentSymbols();
  }, []);

  // Fetch segments and symbols from market data
  const fetchSegmentSymbols = async () => {
    try {
      const { data } = await axios.get('/api/instruments/settings-data', {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      
      // Build segment symbols from scripts data
      const segmentSymbols = {
        CRYPTO: ['BTC', 'ETH', 'BNB', 'XRP', 'SOL', 'DOGE', 'ADA', 'MATIC', 'LTC', 'AVAX']
      };
      for (const [segKey, scripts] of Object.entries(data.scripts || {})) {
        segmentSymbols[segKey] = scripts.map(s => s.baseSymbol);
      }
      
      // Also update segmentPermissions with new segments from market data
      const newSegmentPermissions = { ...formData.segmentPermissions };
      for (const seg of data.segments || []) {
        if (!newSegmentPermissions[seg.id]) {
          newSegmentPermissions[seg.id] = { ...defaultSegmentSettings, enabled: false };
        }
      }
      
      setFormData(prev => ({ 
        ...prev, 
        segmentSymbols,
        marketSegments: data.segments || [],
        marketScripts: data.scripts || {},
        segmentPermissions: newSegmentPermissions
      }));
    } catch (error) {
      console.error('Error fetching segment symbols:', error);
      // Fallback with sample symbols if API fails
      setFormData(prev => ({
        ...prev,
        segmentSymbols: {
          MCX: ['CRUDEOIL', 'CRUDEM', 'GOLD', 'SILVER', 'SILVERMIC', 'NATURALGAS', 'NATGASMINI', 'COPPER', 'ZINC', 'ZINCMINI', 'ALUMINIUM', 'LEAD', 'LEADMINI', 'NICKEL'],
          NSEINDEX: ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'NIFTYIT'],
          NSESTOCK: ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'SBIN', 'BHARTIARTL', 'ITC', 'KOTAKBANK', 'LT'],
          BSE: ['SENSEX', 'BANKEX'],
          EQ: ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'SBIN', 'BHARTIARTL', 'ITC', 'KOTAKBANK', 'LT'],
          CRYPTO: ['BTC', 'ETH', 'BNB', 'XRP', 'SOL', 'DOGE', 'ADA', 'MATIC', 'LTC', 'AVAX']
        }
      }));
    }
  };

  const fetchAdmins = async () => {
    try {
      const { data } = await axios.get('/api/admin/manage/admins', {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      const allAdmins = [
        { _id: 'SUPER', username: 'Super Admin (Direct)', adminCode: 'SUPER' },
        ...data
      ];
      setAdmins(allAdmins);
      setSelectedAdmin('SUPER');
    } catch (error) {
      console.error('Error fetching admins:', error);
    }
  };

  const handleSegmentClick = (segment) => {
    setExpandedSegment(expandedSegment === segment ? null : segment);
  };

  const handleSegmentPermissionChange = (segment, field, value) => {
    setFormData(prev => ({
      ...prev,
      segmentPermissions: {
        ...prev.segmentPermissions,
        [segment]: {
          ...prev.segmentPermissions[segment],
          [field]: value
        }
      }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const targetAdmin = admins.find(a => a._id === selectedAdmin);
      const adminCode = targetAdmin?.adminCode || 'SUPER';

      // Build a minimal payload to avoid oversized requests
      const {
        username, email, password, fullName, phone, initialBalance,
        marginType, ledgerBalanceClosePercent, profitTradeHoldSeconds, lossTradeHoldSeconds,
        isActivated, isReadOnly, isDemo, intradaySquare,
        blockLimitAboveBelowHighLow, blockLimitBetweenHighLow,
        segmentPermissions, scriptSettings
      } = formData;

      const payload = {
        username,
        email,
        password,
        fullName,
        phone,
        initialBalance,
        marginType,
        ledgerBalanceClosePercent,
        profitTradeHoldSeconds,
        lossTradeHoldSeconds,
        isActivated,
        isReadOnly,
        isDemo,
        intradaySquare,
        blockLimitAboveBelowHighLow,
        blockLimitBetweenHighLow,
        segmentPermissions,
        scriptSettings,
        adminCode
      };

      const { data } = await axios.post('/api/admin/manage/create-user', payload, {
        headers: { Authorization: `Bearer ${admin.token}` }
      });

      setMessage({ type: 'success', text: `User created successfully! User ID: ${data.user?.userId || data.userId}` });
      // Reset form
      setFormData({
        username: '', email: '', password: '', fullName: '', phone: '', initialBalance: 0,
        marginType: 'exposure', ledgerBalanceClosePercent: 90, profitTradeHoldSeconds: 0, lossTradeHoldSeconds: 0,
        isActivated: true, isReadOnly: false, isDemo: false, intradaySquare: false,
        blockLimitAboveBelowHighLow: false, blockLimitBetweenHighLow: false,
        segmentPermissions: {
          NSEFUT: { ...defaultSegmentSettings, enabled: true },
          NSEOPT: { ...defaultSegmentSettings, enabled: true },
          MCXFUT: { ...defaultSegmentSettings, enabled: true },
          MCXOPT: { ...defaultSegmentSettings, enabled: true },
          'NSE-EQ': { ...defaultSegmentSettings, enabled: true },
          'BSE-FUT': { ...defaultSegmentSettings, enabled: false },
          'BSE-OPT': { ...defaultSegmentSettings, enabled: false },
          'CRYPTO': { ...defaultSegmentSettings, enabled: false }
        },
        scriptSettings: {},
        selectedScriptSegment: null,
        selectedScript: null
      });
      setExpandedSegment(null);
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to create user' });
    } finally {
      setLoading(false);
    }
  };

  // Toggle Switch Component
  const ToggleSwitch = ({ label, checked, onChange }) => (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-gray-300">{label}</span>
      <button
        type="button"
        onClick={onChange}
        className={`relative w-12 h-6 rounded-full transition-colors ${checked ? 'bg-green-600' : 'bg-dark-600'}`}
      >
        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${checked ? 'left-7' : 'left-1'}`} />
      </button>
    </div>
  );

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Create User</h1>
        <p className="text-gray-400 text-sm mt-1">Create a new user with comprehensive settings</p>
      </div>

      {message.text && (
        <div className={`mb-4 p-3 rounded-lg ${message.type === 'success' ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Basic Info */}
        <div className="bg-dark-800 rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold text-yellow-500 mb-4">Basic Information</h2>
          
          {/* Assign to Admin */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Assign to Admin</label>
            <select
              value={selectedAdmin}
              onChange={(e) => setSelectedAdmin(e.target.value)}
              className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2"
            >
              {admins.map(a => (
                <option key={a._id} value={a._id}>{a.username} ({a.adminCode})</option>
              ))}
            </select>
          </div>

          {/* Username */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Username *</label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2"
              required
            />
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Full Name</label>
            <input
              type="text"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Email *</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2"
              required
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Phone</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Password *</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2"
              required
              minLength={6}
            />
          </div>

          {/* Initial Balance */}
          {/* <div>
            <label className="block text-sm text-gray-400 mb-2">Initial Balance (₹)</label>
            <input
              type="number"
              value={formData.initialBalance}
              onChange={(e) => setFormData({ ...formData, initialBalance: parseFloat(e.target.value) || 0 })}
              className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2"
              min="0"
            />
          </div> */}

          {/* Margin Type */}
          {/* <div>
            <label className="block text-sm text-gray-400 mb-2">Margin Type</label>
            <select
              value={formData.marginType}
              onChange={(e) => setFormData({ ...formData, marginType: e.target.value })}
              className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2"
            >
              <option value="exposure">Exposure</option>
              <option value="margin">Margin</option>
            </select>
          </div> */}
        </div>

        {/* Right Column - Settings */}
        <div className="space-y-6">
          {/* Trading Settings */}
          <div className="bg-dark-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-yellow-500 mb-4">Trading Settings</h2>
            
            {/* Ledger Balance Close % */}
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Ledger Balance Close (%)</label>
              <input
                type="number"
                value={formData.ledgerBalanceClosePercent}
                onChange={(e) => setFormData({ ...formData, ledgerBalanceClosePercent: parseInt(e.target.value) || 90 })}
                className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2"
                min="0"
                max="100"
              />
              <p className="text-xs text-gray-500 mt-1">Close positions when loss reaches this % of ledger balance</p>
            </div>

            {/* Profit Trade Hold Seconds */}
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Profit Trade Hold (seconds)</label>
              <input
                type="number"
                value={formData.profitTradeHoldSeconds}
                onChange={(e) => setFormData({ ...formData, profitTradeHoldSeconds: parseInt(e.target.value) || 0 })}
                className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2"
                min="0"
              />
            </div>

            {/* Loss Trade Hold Seconds */}
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Loss Trade Hold (seconds)</label>
              <input
                type="number"
                value={formData.lossTradeHoldSeconds}
                onChange={(e) => setFormData({ ...formData, lossTradeHoldSeconds: parseInt(e.target.value) || 0 })}
                className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2"
                min="0"
              />
            </div>
          </div>

          {/* Toggle Settings */}
          <div className="bg-dark-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-yellow-500 mb-4">Account Controls</h2>
            <ToggleSwitch 
              label="Activation" 
              checked={formData.isActivated} 
              onChange={() => setFormData({ ...formData, isActivated: !formData.isActivated })} 
            />
            <ToggleSwitch 
              label="Read Only" 
              checked={formData.isReadOnly} 
              onChange={() => setFormData({ ...formData, isReadOnly: !formData.isReadOnly })} 
            />
            <ToggleSwitch 
              label="Demo Account" 
              checked={formData.isDemo} 
              onChange={() => setFormData({ ...formData, isDemo: !formData.isDemo })} 
            />
            <ToggleSwitch 
              label="Intraday Square (3:29 PM)" 
              checked={formData.intradaySquare} 
              onChange={() => setFormData({ ...formData, intradaySquare: !formData.intradaySquare })} 
            />
            <ToggleSwitch 
              label="Block Limit Above/Below High Low" 
              checked={formData.blockLimitAboveBelowHighLow} 
              onChange={() => setFormData({ ...formData, blockLimitAboveBelowHighLow: !formData.blockLimitAboveBelowHighLow })} 
            />
            <ToggleSwitch 
              label="Block Limit Between High Low" 
              checked={formData.blockLimitBetweenHighLow} 
              onChange={() => setFormData({ ...formData, blockLimitBetweenHighLow: !formData.blockLimitBetweenHighLow })} 
            />
          </div>
        </div>

        {/* Segment Settings - Full Width */}
        <div className="lg:col-span-2 bg-dark-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-yellow-500 mb-4">Segment Settings</h2>
          <p className="text-gray-400 text-sm mb-4">Click on a segment to configure its settings. Green = Enabled, Gray = Disabled</p>
          
          {/* Segment Buttons - Dynamic from market data + CRYPTO */}
          <div className="flex flex-wrap gap-3 mb-4">
            {[...(formData.marketSegments?.length > 0 
              ? formData.marketSegments.map(s => s.id)
              : ['NSEFUT', 'NSEOPT', 'MCXFUT', 'MCXOPT', 'NSE-EQ', 'BSE-FUT', 'BSE-OPT']
            ), 'CRYPTO'].filter((v, i, a) => a.indexOf(v) === i).map(segment => (
              <button
                key={segment}
                type="button"
                onClick={() => handleSegmentClick(segment)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  expandedSegment === segment
                    ? 'bg-yellow-600 text-white ring-2 ring-yellow-400'
                    : formData.segmentPermissions[segment]?.enabled
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-dark-700 text-gray-400 hover:bg-dark-600'
                }`}
              >
                {formData.marketSegments?.find(s => s.id === segment)?.name || segment}
                {formData.marketSegments?.find(s => s.id === segment)?.count && (
                  <span className="ml-1 text-xs opacity-70">({formData.marketSegments.find(s => s.id === segment).count})</span>
                )}
              </button>
            ))}
          </div>

          {/* Expanded Segment Settings */}
          {expandedSegment && formData.segmentPermissions[expandedSegment] && (
            <div className="bg-dark-700 rounded-lg p-4 border border-dark-600 animate-fadeIn">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-blue-400">{expandedSegment} Settings</h3>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSegmentPermissionChange(expandedSegment, 'fraction', !formData.segmentPermissions[expandedSegment].fraction)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      formData.segmentPermissions[expandedSegment].fraction
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-600 text-white'
                    }`}
                  >
                    {formData.segmentPermissions[expandedSegment].fraction ? 'Fraction On' : 'Fraction Off'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSegmentPermissionChange(expandedSegment, 'enabled', !formData.segmentPermissions[expandedSegment].enabled)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      formData.segmentPermissions[expandedSegment].enabled
                        ? 'bg-green-600 text-white'
                        : 'bg-red-600 text-white'
                    }`}
                  >
                    {formData.segmentPermissions[expandedSegment].enabled ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
              </div>
              
              {/* General Settings */}
              <h4 className="text-sm font-medium text-gray-300 mb-2">General Settings</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Max Exchange Lots</label>
                  <input
                    type="number"
                    value={formData.segmentPermissions[expandedSegment].maxExchangeLots}
                    onChange={(e) => handleSegmentPermissionChange(expandedSegment, 'maxExchangeLots', Number(e.target.value))}
                    className="w-full bg-dark-800 border border-dark-600 rounded px-3 py-2 text-sm"
                  />
                </div>
                  <div>
                  <label className="block text-xs text-gray-400 mb-1">Max Lots</label>
                  <input
                    type="number"
                    value={formData.segmentPermissions[expandedSegment].maxLots}
                    onChange={(e) => handleSegmentPermissionChange(expandedSegment, 'maxLots', Number(e.target.value))}
                    className="w-full bg-dark-800 border border-dark-600 rounded px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">Commission Type</label>
                  <select
                    value={formData.segmentPermissions[expandedSegment].commissionType}
                    onChange={(e) => handleSegmentPermissionChange(expandedSegment, 'commissionType', e.target.value)}
                    className="w-full bg-dark-800 border border-dark-600 rounded px-3 py-2 text-sm"
                  >
                    <option value="PER_LOT">Per Lot</option>
                    <option value="PER_TRADE">Per Trade</option>
                    <option value="PER_CRORE">Per Crore</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Commission (₹)</label>
                  <input
                    type="number"
                    value={formData.segmentPermissions[expandedSegment].commissionLot}
                    onChange={(e) => handleSegmentPermissionChange(expandedSegment, 'commissionLot', Number(e.target.value))}
                    className="w-full bg-dark-800 border border-dark-600 rounded px-3 py-2 text-sm"
                  />
                </div>
                
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Min Lots</label>
                  <input
                    type="number"
                    value={formData.segmentPermissions[expandedSegment].minLots}
                    onChange={(e) => handleSegmentPermissionChange(expandedSegment, 'minLots', Number(e.target.value))}
                    className="w-full bg-dark-800 border border-dark-600 rounded px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Order Lots</label>
                  <input
                    type="number"
                    value={formData.segmentPermissions[expandedSegment].orderLots}
                    onChange={(e) => handleSegmentPermissionChange(expandedSegment, 'orderLots', Number(e.target.value))}
                    className="w-full bg-dark-800 border border-dark-600 rounded px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Exposure Intraday</label>
                  <input
                    type="number"
                    value={formData.segmentPermissions[expandedSegment].exposureIntraday}
                    onChange={(e) => handleSegmentPermissionChange(expandedSegment, 'exposureIntraday', Number(e.target.value))}
                    className="w-full bg-dark-800 border border-dark-600 rounded px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Exposure Carry Forward</label>
                  <input
                    type="number"
                    value={formData.segmentPermissions[expandedSegment].exposureCarryForward}
                    onChange={(e) => handleSegmentPermissionChange(expandedSegment, 'exposureCarryForward', Number(e.target.value))}
                    className="w-full bg-dark-800 border border-dark-600 rounded px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {/* Option Buy & Sell Settings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Option Buy Settings */}
                <div className="bg-dark-800 rounded-lg p-4 border border-green-900/50">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-green-400">Option Buy Settings</h4>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleSegmentPermissionChange(expandedSegment, 'optionBuy', {
                          ...formData.segmentPermissions[expandedSegment].optionBuy,
                          fraction: !formData.segmentPermissions[expandedSegment].optionBuy?.fraction
                        })}
                        className={`px-3 py-1 rounded text-xs font-medium ${
                          formData.segmentPermissions[expandedSegment].optionBuy?.fraction
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-600 text-white'
                        }`}
                      >
                        {formData.segmentPermissions[expandedSegment].optionBuy?.fraction ? 'Fraction On' : 'Fraction Off'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSegmentPermissionChange(expandedSegment, 'optionBuy', {
                          ...formData.segmentPermissions[expandedSegment].optionBuy,
                          allowed: !formData.segmentPermissions[expandedSegment].optionBuy?.allowed
                        })}
                        className={`px-3 py-1 rounded text-xs font-medium ${
                          formData.segmentPermissions[expandedSegment].optionBuy?.allowed
                            ? 'bg-green-600 text-white'
                            : 'bg-red-600 text-white'
                        }`}
                      >
                        {formData.segmentPermissions[expandedSegment].optionBuy?.allowed ? 'Allowed' : 'Blocked'}
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Commission Type</label>
                      <select
                        value={formData.segmentPermissions[expandedSegment].optionBuy?.commissionType || 'PER_LOT'}
                        onChange={(e) => handleSegmentPermissionChange(expandedSegment, 'optionBuy', {
                          ...formData.segmentPermissions[expandedSegment].optionBuy,
                          commissionType: e.target.value
                        })}
                        className="w-full bg-dark-700 border border-dark-600 rounded px-2 py-1.5 text-sm"
                      >
                        <option value="PER_LOT">Per Lot</option>
                        <option value="PER_TRADE">Per Trade</option>
                        <option value="PER_CRORE">Per Crore</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Commission (₹)</label>
                      <input
                        type="number"
                        value={formData.segmentPermissions[expandedSegment].optionBuy?.commission || 0}
                        onChange={(e) => handleSegmentPermissionChange(expandedSegment, 'optionBuy', {
                          ...formData.segmentPermissions[expandedSegment].optionBuy,
                          commission: Number(e.target.value)
                        })}
                        className="w-full bg-dark-700 border border-dark-600 rounded px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Strike Selection (±)</label>
                      <input
                        type="number"
                        value={formData.segmentPermissions[expandedSegment].optionBuy?.strikeSelection || 50}
                        onChange={(e) => handleSegmentPermissionChange(expandedSegment, 'optionBuy', {
                          ...formData.segmentPermissions[expandedSegment].optionBuy,
                          strikeSelection: Number(e.target.value)
                        })}
                        className="w-full bg-dark-700 border border-dark-600 rounded px-2 py-1.5 text-sm"
                        placeholder="Strikes from ATM"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Max Exchange Lots</label>
                      <input
                        type="number"
                        value={formData.segmentPermissions[expandedSegment].optionBuy?.maxExchangeLots || 100}
                        onChange={(e) => handleSegmentPermissionChange(expandedSegment, 'optionBuy', {
                          ...formData.segmentPermissions[expandedSegment].optionBuy,
                          maxExchangeLots: Number(e.target.value)
                        })}
                        className="w-full bg-dark-700 border border-dark-600 rounded px-2 py-1.5 text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Option Sell Settings */}
                <div className="bg-dark-800 rounded-lg p-4 border border-red-900/50">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-red-400">Option Sell Settings</h4>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleSegmentPermissionChange(expandedSegment, 'optionSell', {
                          ...formData.segmentPermissions[expandedSegment].optionSell,
                          fraction: !formData.segmentPermissions[expandedSegment].optionSell?.fraction
                        })}
                        className={`px-3 py-1 rounded text-xs font-medium ${
                          formData.segmentPermissions[expandedSegment].optionSell?.fraction
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-600 text-white'
                        }`}
                      >
                        {formData.segmentPermissions[expandedSegment].optionSell?.fraction ? 'Fraction On' : 'Fraction Off'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSegmentPermissionChange(expandedSegment, 'optionSell', {
                          ...formData.segmentPermissions[expandedSegment].optionSell,
                          allowed: !formData.segmentPermissions[expandedSegment].optionSell?.allowed
                        })}
                        className={`px-3 py-1 rounded text-xs font-medium ${
                          formData.segmentPermissions[expandedSegment].optionSell?.allowed
                            ? 'bg-green-600 text-white'
                            : 'bg-red-600 text-white'
                        }`}
                      >
                        {formData.segmentPermissions[expandedSegment].optionSell?.allowed ? 'Allowed' : 'Blocked'}
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Commission Type</label>
                      <select
                        value={formData.segmentPermissions[expandedSegment].optionSell?.commissionType || 'PER_LOT'}
                        onChange={(e) => handleSegmentPermissionChange(expandedSegment, 'optionSell', {
                          ...formData.segmentPermissions[expandedSegment].optionSell,
                          commissionType: e.target.value
                        })}
                        className="w-full bg-dark-700 border border-dark-600 rounded px-2 py-1.5 text-sm"
                      >
                        <option value="PER_LOT">Per Lot</option>
                        <option value="PER_TRADE">Per Trade</option>
                        <option value="PER_CRORE">Per Crore</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Commission (₹)</label>
                      <input
                        type="number"
                        value={formData.segmentPermissions[expandedSegment].optionSell?.commission || 0}
                        onChange={(e) => handleSegmentPermissionChange(expandedSegment, 'optionSell', {
                          ...formData.segmentPermissions[expandedSegment].optionSell,
                          commission: Number(e.target.value)
                        })}
                        className="w-full bg-dark-700 border border-dark-600 rounded px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Strike Selection (±)</label>
                      <input
                        type="number"
                        value={formData.segmentPermissions[expandedSegment].optionSell?.strikeSelection || 50}
                        onChange={(e) => handleSegmentPermissionChange(expandedSegment, 'optionSell', {
                          ...formData.segmentPermissions[expandedSegment].optionSell,
                          strikeSelection: Number(e.target.value)
                        })}
                        className="w-full bg-dark-700 border border-dark-600 rounded px-2 py-1.5 text-sm"
                        placeholder="Strikes from ATM"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Max Exchange Lots</label>
                      <input
                        type="number"
                        value={formData.segmentPermissions[expandedSegment].optionSell?.maxExchangeLots || 100}
                        onChange={(e) => handleSegmentPermissionChange(expandedSegment, 'optionSell', {
                          ...formData.segmentPermissions[expandedSegment].optionSell,
                          maxExchangeLots: Number(e.target.value)
                        })}
                        className="w-full bg-dark-700 border border-dark-600 rounded px-2 py-1.5 text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Script Settings - Separate Section - Full Width */}
        <div className="lg:col-span-2 bg-dark-800 rounded-lg p-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-purple-400">Script Settings</h2>
            <p className="text-gray-400 text-sm">Select a segment to view its symbols. Click on a symbol to customize its settings (overrides segment defaults).</p>
          </div>
          
          {/* Segment Tabs for Script Settings */}
          <div className="flex flex-wrap gap-2 mb-4">
            {['NSEFUT', 'NSEOPT', 'MCXFUT', 'MCXOPT', 'NSE-EQ', 'BSE-FUT', 'BSE-OPT', 'CRYPTO'].map(seg => (
              <button
                key={seg}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, selectedScriptSegment: seg }))}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  formData.selectedScriptSegment === seg
                    ? 'bg-purple-600 text-white'
                    : 'bg-dark-700 text-gray-400 hover:bg-dark-600'
                }`}
              >
                {seg}
              </button>
            ))}
          </div>
          
          {formData.selectedScriptSegment ? (
            <div className="bg-dark-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-yellow-400">{formData.selectedScriptSegment} Symbols</h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">
                    {Object.keys(formData.scriptSettings || {}).filter(s => 
                      formData.scriptSettings[s]?.segment === formData.selectedScriptSegment
                    ).length} customized
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const symbols = formData.segmentSymbols?.[formData.selectedScriptSegment] || [];
                      const segmentKey = formData.selectedScriptSegment;
                      const segmentDefaults = formData.segmentPermissions?.[segmentKey] || {};
                      const newScriptSettings = { ...formData.scriptSettings };
                      symbols.forEach(symbol => {
                        if (!newScriptSettings[symbol]) {
                          newScriptSettings[symbol] = {
                            segment: segmentKey,
                            settingType: 'LOT',
                            lotSettings: { 
                              maxLots: segmentDefaults.maxLots || 50, 
                              minLots: segmentDefaults.minLots || 1, 
                              perOrderLots: segmentDefaults.orderLots || 10 
                            },
                            quantitySettings: { maxQuantity: 1000, minQuantity: 1, perOrderQuantity: 100 },
                            fixedMargin: { intradayFuture: 0, carryFuture: 0, optionBuyIntraday: 0, optionBuyCarry: 0, optionSellIntraday: 0, optionSellCarry: 0 },
                            brokerage: { 
                              type: segmentDefaults.commissionType || 'PER_LOT', 
                              value: segmentDefaults.commissionLot || 0 
                            },
                            spread: { buy: 0, sell: 0 },
                            block: { future: false, option: false }
                          };
                        }
                      });
                      setFormData(prev => ({ ...prev, scriptSettings: newScriptSettings }));
                    }}
                    className="px-2 py-1 bg-green-600 hover:bg-green-700 rounded text-xs font-medium"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const symbols = formData.segmentSymbols?.[formData.selectedScriptSegment] || [];
                      const newScriptSettings = { ...formData.scriptSettings };
                      symbols.forEach(symbol => {
                        delete newScriptSettings[symbol];
                      });
                      setFormData(prev => ({ ...prev, scriptSettings: newScriptSettings, selectedScript: null }));
                    }}
                    className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs font-medium"
                  >
                    Unselect All
                  </button>
                </div>
              </div>
              
              {/* Search Filter */}
              <div className="mb-3">
                <input
                  type="text"
                  placeholder="Search symbols..."
                  value={formData.scriptSearchTerm || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, scriptSearchTerm: e.target.value }))}
                  className="w-full bg-dark-600 border border-dark-500 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>
              
              {/* Symbol List with Checkboxes */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 mb-4 max-h-40 overflow-y-auto">
                {(formData.segmentSymbols?.[formData.selectedScriptSegment] || [])
                  .filter(symbol => !formData.scriptSearchTerm || symbol.toLowerCase().includes(formData.scriptSearchTerm.toLowerCase()))
                  .map(symbol => {
                  const isCustomized = formData.scriptSettings?.[symbol];
                  return (
                    <div
                      key={symbol}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs font-medium transition-all cursor-pointer ${
                        isCustomized
                          ? 'bg-purple-600 text-white'
                          : 'bg-dark-600 text-gray-400 hover:bg-dark-500'
                      } ${formData.selectedScript === symbol ? 'ring-2 ring-yellow-500' : ''}`}
                      onClick={() => {
                        if (isCustomized) {
                          setFormData(prev => ({ ...prev, selectedScript: symbol }));
                        } else {
                          // Add default settings for this symbol - use segment settings as defaults
                          const segmentKey = formData.selectedScriptSegment;
                          const segmentDefaults = formData.segmentPermissions?.[segmentKey] || {};
                          setFormData(prev => ({
                            ...prev,
                            selectedScript: symbol,
                            scriptSettings: {
                              ...prev.scriptSettings,
                              [symbol]: {
                                segment: segmentKey,
                                settingType: 'LOT',
                                lotSettings: { 
                                  maxLots: segmentDefaults.maxLots || 50, 
                                  minLots: segmentDefaults.minLots || 1, 
                                  perOrderLots: segmentDefaults.orderLots || 10 
                                },
                                quantitySettings: { maxQuantity: 1000, minQuantity: 1, perOrderQuantity: 100 },
                                fixedMargin: { intradayFuture: 0, carryFuture: 0, optionBuyIntraday: 0, optionBuyCarry: 0, optionSellIntraday: 0, optionSellCarry: 0 },
                                brokerage: { 
                                  type: segmentDefaults.commissionType || 'PER_LOT', 
                                  value: segmentDefaults.commissionLot || 0 
                                },
                                spread: { buy: 0, sell: 0 },
                                block: { future: false, option: false }
                              }
                            }
                          }));
                        }
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={!!isCustomized}
                        onChange={(e) => {
                          e.stopPropagation();
                          if (isCustomized) {
                            // Remove from script settings
                            const updatedScripts = { ...formData.scriptSettings };
                            delete updatedScripts[symbol];
                            setFormData(prev => ({ 
                              ...prev, 
                              scriptSettings: updatedScripts,
                              selectedScript: prev.selectedScript === symbol ? null : prev.selectedScript
                            }));
                          } else {
                            // Add to script settings with defaults
                            const segmentKey = formData.selectedScriptSegment;
                            const segmentDefaults = formData.segmentPermissions?.[segmentKey] || {};
                            setFormData(prev => ({
                              ...prev,
                              scriptSettings: {
                                ...prev.scriptSettings,
                                [symbol]: {
                                  segment: segmentKey,
                                  settingType: 'LOT',
                                  lotSettings: { 
                                    maxLots: segmentDefaults.maxLots || 50, 
                                    minLots: segmentDefaults.minLots || 1, 
                                    perOrderLots: segmentDefaults.orderLots || 10 
                                  },
                                  quantitySettings: { maxQuantity: 1000, minQuantity: 1, perOrderQuantity: 100 },
                                  fixedMargin: { intradayFuture: 0, carryFuture: 0, optionBuyIntraday: 0, optionBuyCarry: 0, optionSellIntraday: 0, optionSellCarry: 0 },
                                  brokerage: { 
                                    type: segmentDefaults.commissionType || 'PER_LOT', 
                                    value: segmentDefaults.commissionLot || 0 
                                  },
                                  spread: { buy: 0, sell: 0 },
                                  block: { future: false, option: false }
                                }
                              }
                            }));
                          }
                        }}
                        className="w-3 h-3 accent-purple-500"
                      />
                      <span className="truncate">{symbol}</span>
                    </div>
                  );
                })}
                {(!formData.segmentSymbols?.[formData.selectedScriptSegment] || formData.segmentSymbols[formData.selectedScriptSegment].length === 0) && (
                  <p className="col-span-full text-xs text-gray-500 italic">No symbols available for this segment</p>
                )}
              </div>
              
              {/* Selected Symbol Settings */}
              {formData.selectedScript && formData.scriptSettings?.[formData.selectedScript] && (
                <div className="bg-dark-800 rounded-lg p-4 border border-purple-600">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-yellow-400">{formData.selectedScript} Settings</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const updatedScripts = { ...formData.scriptSettings };
                          delete updatedScripts[formData.selectedScript];
                          setFormData(prev => ({ ...prev, scriptSettings: updatedScripts, selectedScript: null }));
                        }}
                        className="text-red-400 hover:text-red-300 text-xs"
                      >
                        Reset to Default
                      </button>
                    </div>
                  </div>
                  
                  {/* Setting Type Selection */}
                  <div className="mb-4">
                    <label className="block text-xs text-gray-400 font-medium mb-2">Setting Type</label>
                    <div className="flex gap-2">
                      {['LOT', 'QUANTITY', 'FIXED_MARGIN', 'BROKERAGE', 'SPREAD', 'BLOCK'].map(type => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setFormData(prev => ({
                            ...prev,
                            scriptSettings: {
                              ...prev.scriptSettings,
                              [formData.selectedScript]: {
                                ...prev.scriptSettings[formData.selectedScript],
                                settingType: type
                              }
                            }
                          }))}
                          className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                            (formData.scriptSettings[formData.selectedScript]?.settingType || 'LOT') === type
                              ? 'bg-purple-600 text-white'
                              : 'bg-dark-600 text-gray-400 hover:bg-dark-500'
                          }`}
                        >
                          {type === 'LOT' ? 'Lot' : type === 'QUANTITY' ? 'Quantity' : type === 'FIXED_MARGIN' ? 'Fixed Margin' : type === 'BROKERAGE' ? 'Brokerage' : type === 'SPREAD' ? 'Spread' : 'Block'}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Lot Settings - Show when LOT is selected */}
                  {(formData.scriptSettings[formData.selectedScript]?.settingType || 'LOT') === 'LOT' && (
                    <div className="mb-3">
                      <span className="text-xs text-gray-400 font-medium">Lot Settings</span>
                      <div className="grid grid-cols-3 gap-2 mt-1">
                        <div>
                          <label className="block text-xs text-gray-500">Max Lots</label>
                          <input
                            type="number"
                            value={formData.scriptSettings[formData.selectedScript]?.lotSettings?.maxLots || 50}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              scriptSettings: {
                                ...prev.scriptSettings,
                                [formData.selectedScript]: {
                                  ...prev.scriptSettings[formData.selectedScript],
                                  lotSettings: { ...prev.scriptSettings[formData.selectedScript]?.lotSettings, maxLots: Number(e.target.value) }
                                }
                              }
                            }))}
                            className="w-full bg-dark-600 border border-dark-500 rounded px-2 py-1 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500">Min Lots</label>
                          <input
                            type="number"
                            value={formData.scriptSettings[formData.selectedScript]?.lotSettings?.minLots || 1}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              scriptSettings: {
                                ...prev.scriptSettings,
                                [formData.selectedScript]: {
                                  ...prev.scriptSettings[formData.selectedScript],
                                  lotSettings: { ...prev.scriptSettings[formData.selectedScript]?.lotSettings, minLots: Number(e.target.value) }
                                }
                              }
                            }))}
                            className="w-full bg-dark-600 border border-dark-500 rounded px-2 py-1 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500">Per Order</label>
                          <input
                            type="number"
                            value={formData.scriptSettings[formData.selectedScript]?.lotSettings?.perOrderLots || 10}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              scriptSettings: {
                                ...prev.scriptSettings,
                                [formData.selectedScript]: {
                                  ...prev.scriptSettings[formData.selectedScript],
                                  lotSettings: { ...prev.scriptSettings[formData.selectedScript]?.lotSettings, perOrderLots: Number(e.target.value) }
                                }
                              }
                            }))}
                            className="w-full bg-dark-600 border border-dark-500 rounded px-2 py-1 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Quantity Settings - Show when QUANTITY is selected */}
                  {formData.scriptSettings[formData.selectedScript]?.settingType === 'QUANTITY' && (
                    <div className="mb-3">
                      <span className="text-xs text-gray-400 font-medium">Quantity Settings</span>
                      <div className="grid grid-cols-3 gap-2 mt-1">
                        <div>
                          <label className="block text-xs text-gray-500">Max Qty</label>
                          <input
                            type="number"
                            value={formData.scriptSettings[formData.selectedScript]?.quantitySettings?.maxQuantity || 1000}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              scriptSettings: {
                                ...prev.scriptSettings,
                                [formData.selectedScript]: {
                                  ...prev.scriptSettings[formData.selectedScript],
                                  quantitySettings: { ...prev.scriptSettings[formData.selectedScript]?.quantitySettings, maxQuantity: Number(e.target.value) }
                                }
                              }
                            }))}
                            className="w-full bg-dark-600 border border-dark-500 rounded px-2 py-1 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500">Min Qty</label>
                          <input
                            type="number"
                            value={formData.scriptSettings[formData.selectedScript]?.quantitySettings?.minQuantity || 1}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              scriptSettings: {
                                ...prev.scriptSettings,
                                [formData.selectedScript]: {
                                  ...prev.scriptSettings[formData.selectedScript],
                                  quantitySettings: { ...prev.scriptSettings[formData.selectedScript]?.quantitySettings, minQuantity: Number(e.target.value) }
                                }
                              }
                            }))}
                            className="w-full bg-dark-600 border border-dark-500 rounded px-2 py-1 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500">Per Order</label>
                          <input
                            type="number"
                            value={formData.scriptSettings[formData.selectedScript]?.quantitySettings?.perOrderQuantity || 100}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              scriptSettings: {
                                ...prev.scriptSettings,
                                [formData.selectedScript]: {
                                  ...prev.scriptSettings[formData.selectedScript],
                                  quantitySettings: { ...prev.scriptSettings[formData.selectedScript]?.quantitySettings, perOrderQuantity: Number(e.target.value) }
                                }
                              }
                            }))}
                            className="w-full bg-dark-600 border border-dark-500 rounded px-2 py-1 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Fixed Margin Settings - Show when FIXED_MARGIN is selected */}
                  {formData.scriptSettings[formData.selectedScript]?.settingType === 'FIXED_MARGIN' && (
                    <div className="space-y-3">
                      <span className="text-xs text-gray-400 font-medium block">Fixed Margin Settings</span>
                      
                      {/* Future Margins */}
                      <div className="bg-dark-700 rounded p-3">
                        <span className="text-xs text-blue-400 font-medium block mb-2">Future Margins</span>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-gray-500">Intraday Future</label>
                            <input
                              type="number"
                              value={formData.scriptSettings[formData.selectedScript]?.fixedMargin?.intradayFuture || 0}
                              onChange={(e) => setFormData(prev => ({
                                ...prev,
                                scriptSettings: {
                                  ...prev.scriptSettings,
                                  [formData.selectedScript]: {
                                    ...prev.scriptSettings[formData.selectedScript],
                                    fixedMargin: { ...prev.scriptSettings[formData.selectedScript]?.fixedMargin, intradayFuture: Number(e.target.value) }
                                  }
                                }
                              }))}
                              className="w-full bg-dark-600 border border-dark-500 rounded px-2 py-1 text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500">Carry Future</label>
                            <input
                              type="number"
                              value={formData.scriptSettings[formData.selectedScript]?.fixedMargin?.carryFuture || 0}
                              onChange={(e) => setFormData(prev => ({
                                ...prev,
                                scriptSettings: {
                                  ...prev.scriptSettings,
                                  [formData.selectedScript]: {
                                    ...prev.scriptSettings[formData.selectedScript],
                                    fixedMargin: { ...prev.scriptSettings[formData.selectedScript]?.fixedMargin, carryFuture: Number(e.target.value) }
                                  }
                                }
                              }))}
                              className="w-full bg-dark-600 border border-dark-500 rounded px-2 py-1 text-xs"
                            />
                          </div>
                        </div>
                      </div>
                      
                      {/* Option Buy Margins */}
                      <div className="bg-dark-700 rounded p-3">
                        <span className="text-xs text-green-400 font-medium block mb-2">Option Buy Margins</span>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-gray-500">Option Buy Intraday</label>
                            <input
                              type="number"
                              value={formData.scriptSettings[formData.selectedScript]?.fixedMargin?.optionBuyIntraday || 0}
                              onChange={(e) => setFormData(prev => ({
                                ...prev,
                                scriptSettings: {
                                  ...prev.scriptSettings,
                                  [formData.selectedScript]: {
                                    ...prev.scriptSettings[formData.selectedScript],
                                    fixedMargin: { ...prev.scriptSettings[formData.selectedScript]?.fixedMargin, optionBuyIntraday: Number(e.target.value) }
                                  }
                                }
                              }))}
                              className="w-full bg-dark-600 border border-dark-500 rounded px-2 py-1 text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500">Option Buy Carry</label>
                            <input
                              type="number"
                              value={formData.scriptSettings[formData.selectedScript]?.fixedMargin?.optionBuyCarry || 0}
                              onChange={(e) => setFormData(prev => ({
                                ...prev,
                                scriptSettings: {
                                  ...prev.scriptSettings,
                                  [formData.selectedScript]: {
                                    ...prev.scriptSettings[formData.selectedScript],
                                    fixedMargin: { ...prev.scriptSettings[formData.selectedScript]?.fixedMargin, optionBuyCarry: Number(e.target.value) }
                                  }
                                }
                              }))}
                              className="w-full bg-dark-600 border border-dark-500 rounded px-2 py-1 text-xs"
                            />
                          </div>
                        </div>
                      </div>
                      
                      {/* Option Sell Margins */}
                      <div className="bg-dark-700 rounded p-3">
                        <span className="text-xs text-red-400 font-medium block mb-2">Option Sell Margins</span>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-gray-500">Option Sell Intraday</label>
                            <input
                              type="number"
                              value={formData.scriptSettings[formData.selectedScript]?.fixedMargin?.optionSellIntraday || 0}
                              onChange={(e) => setFormData(prev => ({
                                ...prev,
                                scriptSettings: {
                                  ...prev.scriptSettings,
                                  [formData.selectedScript]: {
                                    ...prev.scriptSettings[formData.selectedScript],
                                    fixedMargin: { ...prev.scriptSettings[formData.selectedScript]?.fixedMargin, optionSellIntraday: Number(e.target.value) }
                                  }
                                }
                              }))}
                              className="w-full bg-dark-600 border border-dark-500 rounded px-2 py-1 text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500">Option Sell Carry</label>
                            <input
                              type="number"
                              value={formData.scriptSettings[formData.selectedScript]?.fixedMargin?.optionSellCarry || 0}
                              onChange={(e) => setFormData(prev => ({
                                ...prev,
                                scriptSettings: {
                                  ...prev.scriptSettings,
                                  [formData.selectedScript]: {
                                    ...prev.scriptSettings[formData.selectedScript],
                                    fixedMargin: { ...prev.scriptSettings[formData.selectedScript]?.fixedMargin, optionSellCarry: Number(e.target.value) }
                                  }
                                }
                              }))}
                              className="w-full bg-dark-600 border border-dark-500 rounded px-2 py-1 text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Brokerage Settings - Show when BROKERAGE is selected */}
                  {formData.scriptSettings[formData.selectedScript]?.settingType === 'BROKERAGE' && (() => {
                    const segmentKey = formData.scriptSettings[formData.selectedScript]?.segment || formData.selectedScriptSegment;
                    const segmentDefaults = formData.segmentPermissions?.[segmentKey] || {};
                    return (
                    <div className="space-y-3">
                      <span className="text-xs text-gray-400 font-medium block">Brokerage Settings <span className="text-gray-600">(Segment default: {segmentDefaults.commissionType || 'PER_LOT'} - {segmentDefaults.commissionLot || 0})</span></span>
                      
                      <div className="bg-dark-700 rounded p-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-gray-500">Brokerage Type</label>
                            <select
                              value={formData.scriptSettings[formData.selectedScript]?.brokerage?.type || segmentDefaults.commissionType || 'PER_LOT'}
                              onChange={(e) => setFormData(prev => ({
                                ...prev,
                                scriptSettings: {
                                  ...prev.scriptSettings,
                                  [formData.selectedScript]: {
                                    ...prev.scriptSettings[formData.selectedScript],
                                    brokerage: { ...prev.scriptSettings[formData.selectedScript]?.brokerage, type: e.target.value }
                                  }
                                }
                              }))}
                              className="w-full bg-dark-600 border border-dark-500 rounded px-2 py-1 text-xs"
                            >
                              <option value="PER_LOT">Per Lot</option>
                              <option value="PER_CRORE">Per Crore</option>
                              <option value="PER_TRADE">Per Trade</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500">Brokerage Value</label>
                            <input
                              type="number"
                              value={formData.scriptSettings[formData.selectedScript]?.brokerage?.value ?? segmentDefaults.commissionLot ?? 0}
                              onChange={(e) => setFormData(prev => ({
                                ...prev,
                                scriptSettings: {
                                  ...prev.scriptSettings,
                                  [formData.selectedScript]: {
                                    ...prev.scriptSettings[formData.selectedScript],
                                    brokerage: { ...prev.scriptSettings[formData.selectedScript]?.brokerage, value: Number(e.target.value) }
                                  }
                                }
                              }))}
                              className="w-full bg-dark-600 border border-dark-500 rounded px-2 py-1 text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    );
                  })()}
                  
                  {/* Spread Settings - Show when SPREAD is selected */}
                  {formData.scriptSettings[formData.selectedScript]?.settingType === 'SPREAD' && (
                    <div className="space-y-3">
                      <span className="text-xs text-gray-400 font-medium block">Spread Settings</span>
                      
                      <div className="bg-dark-700 rounded p-3">
                        <div>
                          <label className="block text-xs text-gray-500">Spread Value</label>
                          <input
                            type="number"
                            step="0.01"
                            value={formData.scriptSettings[formData.selectedScript]?.spread || 0}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              scriptSettings: {
                                ...prev.scriptSettings,
                                [formData.selectedScript]: {
                                  ...prev.scriptSettings[formData.selectedScript],
                                  spread: Number(e.target.value)
                                }
                              }
                            }))}
                            className="w-full bg-dark-600 border border-dark-500 rounded px-2 py-1 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Block Settings - Show when BLOCK is selected */}
                  {formData.scriptSettings[formData.selectedScript]?.settingType === 'BLOCK' && (
                    <div className="space-y-3">
                      <span className="text-xs text-gray-400 font-medium block">Block Settings</span>
                      
                      <div className="bg-dark-700 rounded p-3">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="flex items-center justify-between">
                            <label className="text-xs text-gray-500">Block Future</label>
                            <button
                              type="button"
                              onClick={() => setFormData(prev => ({
                                ...prev,
                                scriptSettings: {
                                  ...prev.scriptSettings,
                                  [formData.selectedScript]: {
                                    ...prev.scriptSettings[formData.selectedScript],
                                    block: { ...prev.scriptSettings[formData.selectedScript]?.block, future: !prev.scriptSettings[formData.selectedScript]?.block?.future }
                                  }
                                }
                              }))}
                              className={`px-3 py-1 rounded text-xs font-medium ${
                                formData.scriptSettings[formData.selectedScript]?.block?.future
                                  ? 'bg-red-600 text-white'
                                  : 'bg-green-600 text-white'
                              }`}
                            >
                              {formData.scriptSettings[formData.selectedScript]?.block?.future ? 'Yes' : 'No'}
                            </button>
                          </div>
                          <div className="flex items-center justify-between">
                            <label className="text-xs text-gray-500">Block Option</label>
                            <button
                              type="button"
                              onClick={() => setFormData(prev => ({
                                ...prev,
                                scriptSettings: {
                                  ...prev.scriptSettings,
                                  [formData.selectedScript]: {
                                    ...prev.scriptSettings[formData.selectedScript],
                                    block: { ...prev.scriptSettings[formData.selectedScript]?.block, option: !prev.scriptSettings[formData.selectedScript]?.block?.option }
                                  }
                                }
                              }))}
                              className={`px-3 py-1 rounded text-xs font-medium ${
                                formData.scriptSettings[formData.selectedScript]?.block?.option
                                  ? 'bg-red-600 text-white'
                                  : 'bg-green-600 text-white'
                              }`}
                            >
                              {formData.scriptSettings[formData.selectedScript]?.block?.option ? 'Yes' : 'No'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic text-center py-4">Select a segment above to view and customize symbol settings</p>
          )}
        </div>

        {/* Submit Button - Full Width */}
        <div className="lg:col-span-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-yellow-600 hover:bg-yellow-700 rounded-lg font-semibold disabled:opacity-50"
          >
            {loading ? 'Creating User...' : 'Create User'}
          </button>
        </div>
      </form>
    </div>
  );
};

// Admin Create User - Create users assigned to the logged-in admin only
const AdminCreateUser = () => {
  const { admin } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [expandedSegment, setExpandedSegment] = useState(null);
  
  const defaultSegmentSettings = {
    enabled: false,
    fraction: false,
    maxExchangeLots: 100,
    commissionType: 'PER_LOT',
    commissionLot: 0,
    maxLots: 50,
    minLots: 1,
    orderLots: 10,
    exposureIntraday: 1,
    exposureCarryForward: 1,
    optionBuy: {
      allowed: true,
      fraction: false,
      commissionType: 'PER_LOT',
      commission: 0,
      strikeSelection: 50,
      maxExchangeLots: 100
    },
    optionSell: {
      allowed: true,
      fraction: false,
      commissionType: 'PER_LOT',
      commission: 0,
      strikeSelection: 50,
      maxExchangeLots: 100
    }
  };
  
  const [formData, setFormData] = useState({
    username: '', email: '', password: '', fullName: '', phone: '', initialBalance: 0,
    marginType: 'exposure',
    ledgerBalanceClosePercent: 90,
    profitTradeHoldSeconds: 0,
    lossTradeHoldSeconds: 0,
    isActivated: true,
    isReadOnly: false,
    isDemo: false,
    intradaySquare: false,
    blockLimitAboveBelowHighLow: false,
    blockLimitBetweenHighLow: false,
    segmentPermissions: {
      NSEFUT: { ...defaultSegmentSettings, enabled: true },
      NSEOPT: { ...defaultSegmentSettings, enabled: true },
      MCXFUT: { ...defaultSegmentSettings, enabled: true },
      MCXOPT: { ...defaultSegmentSettings, enabled: true },
      'NSE-EQ': { ...defaultSegmentSettings, enabled: true },
      'BSE-FUT': { ...defaultSegmentSettings, enabled: false },
      'BSE-OPT': { ...defaultSegmentSettings, enabled: false },
      'CRYPTO': { ...defaultSegmentSettings, enabled: false }
    },
    scriptSettings: {},
    selectedScriptSegment: null,
    selectedScript: null,
    scriptSearchTerm: '',
    segmentSymbols: {}
  });

  useEffect(() => {
    fetchSegmentSymbols();
  }, []);

  const fetchSegmentSymbols = async () => {
    try {
      const { data } = await axios.get('/api/instruments/settings-data', {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      
      const segmentSymbols = {};
      for (const [segKey, scripts] of Object.entries(data.scripts || {})) {
        segmentSymbols[segKey] = scripts.map(s => s.baseSymbol);
      }
      
      const newSegmentPermissions = { ...formData.segmentPermissions };
      for (const seg of data.segments || []) {
        if (!newSegmentPermissions[seg.id]) {
          newSegmentPermissions[seg.id] = { ...defaultSegmentSettings, enabled: false };
        }
      }
      
      setFormData(prev => ({ 
        ...prev, 
        segmentSymbols,
        marketSegments: data.segments || [],
        marketScripts: data.scripts || {},
        segmentPermissions: newSegmentPermissions
      }));
    } catch (error) {
      console.error('Error fetching segment symbols:', error);
    }
  };

  const handleSegmentClick = (segment) => {
    setExpandedSegment(expandedSegment === segment ? null : segment);
  };

  const handleSegmentPermissionChange = (segment, field, value) => {
    setFormData(prev => ({
      ...prev,
      segmentPermissions: {
        ...prev.segmentPermissions,
        [segment]: {
          ...prev.segmentPermissions[segment],
          [field]: value
        }
      }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const {
        username, email, password, fullName, phone,
        ledgerBalanceClosePercent, profitTradeHoldSeconds, lossTradeHoldSeconds,
        isActivated, isReadOnly, isDemo, intradaySquare,
        blockLimitAboveBelowHighLow, blockLimitBetweenHighLow,
        segmentPermissions, scriptSettings
      } = formData;

      const payload = {
        username,
        email,
        password,
        fullName,
        phone,
        ledgerBalanceClosePercent,
        profitTradeHoldSeconds,
        lossTradeHoldSeconds,
        isActivated,
        isReadOnly,
        isDemo,
        intradaySquare,
        blockLimitAboveBelowHighLow,
        blockLimitBetweenHighLow,
        segmentPermissions,
        scriptSettings
      };

      const { data } = await axios.post('/api/admin/users', payload, {
        headers: { Authorization: `Bearer ${admin.token}` }
      });

      setMessage({ type: 'success', text: `User created successfully! User ID: ${data._id}` });
      // Reset form
      setFormData(prev => ({
        ...prev,
        username: '', email: '', password: '', fullName: '', phone: '',
        isActivated: true, isReadOnly: false, isDemo: false, intradaySquare: false,
        blockLimitAboveBelowHighLow: false, blockLimitBetweenHighLow: false,
        scriptSettings: {},
        selectedScriptSegment: null,
        selectedScript: null
      }));
      setExpandedSegment(null);
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to create user' });
    } finally {
      setLoading(false);
    }
  };

  const ToggleSwitch = ({ label, checked, onChange }) => (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-gray-300">{label}</span>
      <button
        type="button"
        onClick={onChange}
        className={`relative w-12 h-6 rounded-full transition-colors ${checked ? 'bg-green-600' : 'bg-dark-600'}`}
      >
        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${checked ? 'left-7' : 'left-1'}`} />
      </button>
    </div>
  );

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Create User</h1>
        <p className="text-gray-400 text-sm mt-1">Create a new user for your admin account</p>
      </div>

      {message.text && (
        <div className={`mb-4 p-3 rounded-lg ${message.type === 'success' ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Basic Info */}
        <div className="bg-dark-800 rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold text-purple-500 mb-4">Basic Information</h2>
          
          {/* Assigned Admin - Read Only */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Assigned to Admin</label>
            <input
              type="text"
              value={`${admin.username} (${admin.adminCode})`}
              disabled
              className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2 text-gray-400 cursor-not-allowed"
            />
            <p className="text-xs text-gray-500 mt-1">Users will be created under your admin account</p>
          </div>

          {/* Username */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Username *</label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2"
              required
            />
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Full Name</label>
            <input
              type="text"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Email *</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2"
              required
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Phone</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Password *</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2"
              required
              minLength={6}
            />
          </div>
        </div>

        {/* Right Column - Settings */}
        <div className="space-y-6">
          {/* Trading Settings */}
          <div className="bg-dark-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-purple-500 mb-4">Trading Settings</h2>
            
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Ledger Balance Close (%)</label>
              <input
                type="number"
                value={formData.ledgerBalanceClosePercent}
                onChange={(e) => setFormData({ ...formData, ledgerBalanceClosePercent: parseInt(e.target.value) || 90 })}
                className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2"
                min="0"
                max="100"
              />
              <p className="text-xs text-gray-500 mt-1">Close positions when loss reaches this % of ledger balance</p>
            </div>

            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Profit Trade Hold (seconds)</label>
              <input
                type="number"
                value={formData.profitTradeHoldSeconds}
                onChange={(e) => setFormData({ ...formData, profitTradeHoldSeconds: parseInt(e.target.value) || 0 })}
                className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2"
                min="0"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Loss Trade Hold (seconds)</label>
              <input
                type="number"
                value={formData.lossTradeHoldSeconds}
                onChange={(e) => setFormData({ ...formData, lossTradeHoldSeconds: parseInt(e.target.value) || 0 })}
                className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2"
                min="0"
              />
            </div>
          </div>

          {/* Toggle Settings */}
          <div className="bg-dark-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-purple-500 mb-4">Account Controls</h2>
            <ToggleSwitch 
              label="Activation" 
              checked={formData.isActivated} 
              onChange={() => setFormData({ ...formData, isActivated: !formData.isActivated })} 
            />
            <ToggleSwitch 
              label="Read Only" 
              checked={formData.isReadOnly} 
              onChange={() => setFormData({ ...formData, isReadOnly: !formData.isReadOnly })} 
            />
            <ToggleSwitch 
              label="Demo Account" 
              checked={formData.isDemo} 
              onChange={() => setFormData({ ...formData, isDemo: !formData.isDemo })} 
            />
            <ToggleSwitch 
              label="Intraday Square (3:29 PM)" 
              checked={formData.intradaySquare} 
              onChange={() => setFormData({ ...formData, intradaySquare: !formData.intradaySquare })} 
            />
            <ToggleSwitch 
              label="Block Limit Above/Below High Low" 
              checked={formData.blockLimitAboveBelowHighLow} 
              onChange={() => setFormData({ ...formData, blockLimitAboveBelowHighLow: !formData.blockLimitAboveBelowHighLow })} 
            />
            <ToggleSwitch 
              label="Block Limit Between High Low" 
              checked={formData.blockLimitBetweenHighLow} 
              onChange={() => setFormData({ ...formData, blockLimitBetweenHighLow: !formData.blockLimitBetweenHighLow })} 
            />
          </div>
        </div>

        {/* Segment Settings - Full Width */}
        <div className="lg:col-span-2 bg-dark-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-purple-500 mb-4">Segment Settings</h2>
          <p className="text-gray-400 text-sm mb-4">Click on a segment to configure its settings. Green = Enabled, Gray = Disabled</p>
          
          <div className="flex flex-wrap gap-3 mb-4">
            {[...(formData.marketSegments?.length > 0 
              ? formData.marketSegments.map(s => s.id)
              : ['NSEFUT', 'NSEOPT', 'MCXFUT', 'MCXOPT', 'NSE-EQ', 'BSE-FUT', 'BSE-OPT']
            ), 'CRYPTO'].filter((v, i, a) => a.indexOf(v) === i).map(segment => (
              <button
                key={segment}
                type="button"
                onClick={() => handleSegmentClick(segment)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  expandedSegment === segment
                    ? 'bg-purple-600 text-white ring-2 ring-purple-400'
                    : formData.segmentPermissions[segment]?.enabled
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-dark-700 text-gray-400 hover:bg-dark-600'
                }`}
              >
                {formData.marketSegments?.find(s => s.id === segment)?.name || segment}
              </button>
            ))}
          </div>

          {/* Expanded Segment Settings */}
          {expandedSegment && formData.segmentPermissions[expandedSegment] && (
            <div className="bg-dark-700 rounded-lg p-4 border border-dark-600 animate-fadeIn">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-blue-400">{expandedSegment} Settings</h3>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSegmentPermissionChange(expandedSegment, 'fraction', !formData.segmentPermissions[expandedSegment].fraction)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      formData.segmentPermissions[expandedSegment].fraction
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-600 text-white'
                    }`}
                  >
                    {formData.segmentPermissions[expandedSegment].fraction ? 'Fraction On' : 'Fraction Off'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSegmentPermissionChange(expandedSegment, 'enabled', !formData.segmentPermissions[expandedSegment].enabled)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      formData.segmentPermissions[expandedSegment].enabled
                        ? 'bg-green-600 text-white'
                        : 'bg-red-600 text-white'
                    }`}
                  >
                    {formData.segmentPermissions[expandedSegment].enabled ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
              </div>
              
              <h4 className="text-sm font-medium text-gray-300 mb-2">General Settings</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Max Exchange Lots</label>
                  <input
                    type="number"
                    value={formData.segmentPermissions[expandedSegment].maxExchangeLots}
                    onChange={(e) => handleSegmentPermissionChange(expandedSegment, 'maxExchangeLots', Number(e.target.value))}
                    className="w-full bg-dark-800 border border-dark-600 rounded px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Max Lots</label>
                  <input
                    type="number"
                    value={formData.segmentPermissions[expandedSegment].maxLots}
                    onChange={(e) => handleSegmentPermissionChange(expandedSegment, 'maxLots', Number(e.target.value))}
                    className="w-full bg-dark-800 border border-dark-600 rounded px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Commission Type</label>
                  <select
                    value={formData.segmentPermissions[expandedSegment].commissionType}
                    onChange={(e) => handleSegmentPermissionChange(expandedSegment, 'commissionType', e.target.value)}
                    className="w-full bg-dark-800 border border-dark-600 rounded px-3 py-2 text-sm"
                  >
                    <option value="PER_LOT">Per Lot</option>
                    <option value="PER_TRADE">Per Trade</option>
                    <option value="PER_CRORE">Per Crore</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Commission (₹)</label>
                  <input
                    type="number"
                    value={formData.segmentPermissions[expandedSegment].commissionLot}
                    onChange={(e) => handleSegmentPermissionChange(expandedSegment, 'commissionLot', Number(e.target.value))}
                    className="w-full bg-dark-800 border border-dark-600 rounded px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Min Lots</label>
                  <input
                    type="number"
                    value={formData.segmentPermissions[expandedSegment].minLots}
                    onChange={(e) => handleSegmentPermissionChange(expandedSegment, 'minLots', Number(e.target.value))}
                    className="w-full bg-dark-800 border border-dark-600 rounded px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Order Lots</label>
                  <input
                    type="number"
                    value={formData.segmentPermissions[expandedSegment].orderLots}
                    onChange={(e) => handleSegmentPermissionChange(expandedSegment, 'orderLots', Number(e.target.value))}
                    className="w-full bg-dark-800 border border-dark-600 rounded px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Exposure Intraday</label>
                  <input
                    type="number"
                    value={formData.segmentPermissions[expandedSegment].exposureIntraday}
                    onChange={(e) => handleSegmentPermissionChange(expandedSegment, 'exposureIntraday', Number(e.target.value))}
                    className="w-full bg-dark-800 border border-dark-600 rounded px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Exposure Carry Forward</label>
                  <input
                    type="number"
                    value={formData.segmentPermissions[expandedSegment].exposureCarryForward}
                    onChange={(e) => handleSegmentPermissionChange(expandedSegment, 'exposureCarryForward', Number(e.target.value))}
                    className="w-full bg-dark-800 border border-dark-600 rounded px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Script Settings - Full Width */}
        <div className="lg:col-span-2 bg-dark-800 rounded-lg p-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-purple-400">Script Settings</h2>
            <p className="text-gray-400 text-sm">Select a segment to view its symbols. Click on a symbol to customize its settings.</p>
          </div>
          
          {/* Segment Tabs for Script Settings */}
          <div className="flex flex-wrap gap-2 mb-4">
            {['NSEFUT', 'NSEOPT', 'MCXFUT', 'MCXOPT', 'NSE-EQ', 'BSE-FUT', 'BSE-OPT', 'CRYPTO'].map(seg => (
              <button
                key={seg}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, selectedScriptSegment: seg, scriptSearchTerm: '' }))}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  formData.selectedScriptSegment === seg
                    ? 'bg-purple-600 text-white'
                    : 'bg-dark-700 text-gray-400 hover:bg-dark-600'
                }`}
              >
                {seg}
              </button>
            ))}
          </div>
          
          {formData.selectedScriptSegment && (
            <div className="bg-dark-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-yellow-400">{formData.selectedScriptSegment} Symbols</h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">
                    {Object.keys(formData.scriptSettings || {}).filter(s => 
                      formData.scriptSettings[s]?.segment === formData.selectedScriptSegment
                    ).length} customized
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const symbols = formData.segmentSymbols?.[formData.selectedScriptSegment] || [];
                      const segmentDefaults = formData.segmentPermissions?.[formData.selectedScriptSegment] || {};
                      const newScriptSettings = { ...formData.scriptSettings };
                      symbols.forEach(symbol => {
                        if (!newScriptSettings[symbol]) {
                          newScriptSettings[symbol] = {
                            segment: formData.selectedScriptSegment,
                            settingType: 'LOT',
                            lotSettings: { maxLots: segmentDefaults.maxLots || 50, minLots: segmentDefaults.minLots || 1, perOrderLots: segmentDefaults.orderLots || 10 },
                            quantitySettings: { maxQuantity: 1000, minQuantity: 1, perOrderQuantity: 100 }
                          };
                        }
                      });
                      setFormData(prev => ({ ...prev, scriptSettings: newScriptSettings }));
                    }}
                    className="px-2 py-1 bg-green-600 hover:bg-green-700 rounded text-xs font-medium"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const symbols = formData.segmentSymbols?.[formData.selectedScriptSegment] || [];
                      const newScriptSettings = { ...formData.scriptSettings };
                      symbols.forEach(symbol => {
                        delete newScriptSettings[symbol];
                      });
                      setFormData(prev => ({ ...prev, scriptSettings: newScriptSettings, selectedScript: null }));
                    }}
                    className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs font-medium"
                  >
                    Unselect All
                  </button>
                </div>
              </div>
              
              {/* Search Filter */}
              <div className="mb-3">
                <input
                  type="text"
                  placeholder="Search symbols..."
                  value={formData.scriptSearchTerm || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, scriptSearchTerm: e.target.value }))}
                  className="w-full bg-dark-600 border border-dark-500 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>
              
              {/* Symbol List with Checkboxes */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 mb-4 max-h-40 overflow-y-auto">
                {(formData.segmentSymbols?.[formData.selectedScriptSegment] || [])
                  .filter(symbol => !formData.scriptSearchTerm || symbol.toLowerCase().includes(formData.scriptSearchTerm.toLowerCase()))
                  .map(symbol => {
                  const isCustomized = formData.scriptSettings?.[symbol];
                  return (
                    <div
                      key={symbol}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs font-medium transition-all cursor-pointer ${
                        isCustomized
                          ? 'bg-purple-600 text-white'
                          : 'bg-dark-600 text-gray-400 hover:bg-dark-500'
                      } ${formData.selectedScript === symbol ? 'ring-2 ring-yellow-500' : ''}`}
                      onClick={() => {
                        if (isCustomized) {
                          setFormData(prev => ({ ...prev, selectedScript: symbol }));
                        } else {
                          const segmentDefaults = formData.segmentPermissions?.[formData.selectedScriptSegment] || {};
                          setFormData(prev => ({
                            ...prev,
                            selectedScript: symbol,
                            scriptSettings: {
                              ...prev.scriptSettings,
                              [symbol]: {
                                segment: formData.selectedScriptSegment,
                                settingType: 'LOT',
                                lotSettings: { maxLots: segmentDefaults.maxLots || 50, minLots: segmentDefaults.minLots || 1, perOrderLots: segmentDefaults.orderLots || 10 },
                                quantitySettings: { maxQuantity: 1000, minQuantity: 1, perOrderQuantity: 100 }
                              }
                            }
                          }));
                        }
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={!!isCustomized}
                        onChange={(e) => {
                          e.stopPropagation();
                          if (isCustomized) {
                            const updatedScripts = { ...formData.scriptSettings };
                            delete updatedScripts[symbol];
                            setFormData(prev => ({ 
                              ...prev, 
                              scriptSettings: updatedScripts,
                              selectedScript: prev.selectedScript === symbol ? null : prev.selectedScript
                            }));
                          } else {
                            const segmentDefaults = formData.segmentPermissions?.[formData.selectedScriptSegment] || {};
                            setFormData(prev => ({
                              ...prev,
                              scriptSettings: {
                                ...prev.scriptSettings,
                                [symbol]: {
                                  segment: formData.selectedScriptSegment,
                                  settingType: 'LOT',
                                  lotSettings: { maxLots: segmentDefaults.maxLots || 50, minLots: segmentDefaults.minLots || 1, perOrderLots: segmentDefaults.orderLots || 10 },
                                  quantitySettings: { maxQuantity: 1000, minQuantity: 1, perOrderQuantity: 100 }
                                }
                              }
                            }));
                          }
                        }}
                        className="w-3 h-3 accent-purple-500"
                      />
                      <span className="truncate">{symbol}</span>
                    </div>
                  );
                })}
                {(!formData.segmentSymbols?.[formData.selectedScriptSegment] || formData.segmentSymbols[formData.selectedScriptSegment].length === 0) && (
                  <p className="col-span-full text-xs text-gray-500 italic">No symbols available for this segment</p>
                )}
              </div>
              
              {/* Selected Symbol Settings */}
              {formData.selectedScript && formData.scriptSettings?.[formData.selectedScript] && (
                <div className="bg-dark-800 rounded-lg p-4 border border-purple-600">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-yellow-400">{formData.selectedScript} Settings</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const updatedScripts = { ...formData.scriptSettings };
                          delete updatedScripts[formData.selectedScript];
                          setFormData(prev => ({ ...prev, scriptSettings: updatedScripts, selectedScript: null }));
                        }}
                        className="text-red-400 hover:text-red-300 text-xs"
                      >
                        Reset to Default
                      </button>
                    </div>
                  </div>
                  
                  {/* Lot Settings */}
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs text-gray-500">Max Lots</label>
                      <input
                        type="number"
                        value={formData.scriptSettings[formData.selectedScript]?.lotSettings?.maxLots || 50}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          scriptSettings: {
                            ...prev.scriptSettings,
                            [formData.selectedScript]: {
                              ...prev.scriptSettings[formData.selectedScript],
                              lotSettings: { ...prev.scriptSettings[formData.selectedScript]?.lotSettings, maxLots: Number(e.target.value) }
                            }
                          }
                        }))}
                        className="w-full bg-dark-600 border border-dark-500 rounded px-2 py-1 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500">Min Lots</label>
                      <input
                        type="number"
                        value={formData.scriptSettings[formData.selectedScript]?.lotSettings?.minLots || 1}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          scriptSettings: {
                            ...prev.scriptSettings,
                            [formData.selectedScript]: {
                              ...prev.scriptSettings[formData.selectedScript],
                              lotSettings: { ...prev.scriptSettings[formData.selectedScript]?.lotSettings, minLots: Number(e.target.value) }
                            }
                          }
                        }))}
                        className="w-full bg-dark-600 border border-dark-500 rounded px-2 py-1 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500">Per Order</label>
                      <input
                        type="number"
                        value={formData.scriptSettings[formData.selectedScript]?.lotSettings?.perOrderLots || 10}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          scriptSettings: {
                            ...prev.scriptSettings,
                            [formData.selectedScript]: {
                              ...prev.scriptSettings[formData.selectedScript],
                              lotSettings: { ...prev.scriptSettings[formData.selectedScript]?.lotSettings, perOrderLots: Number(e.target.value) }
                            }
                          }
                        }))}
                        className="w-full bg-dark-600 border border-dark-500 rounded px-2 py-1 text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Submit Button - Full Width */}
        <div className="lg:col-span-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold disabled:opacity-50"
          >
            {loading ? 'Creating User...' : 'Create User'}
          </button>
        </div>
      </form>
    </div>
  );
};

// Super Admin Fund Requests - Shows all fund requests from all users
const SuperAdminFundRequests = () => {
  const { admin } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('PENDING');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0, totalDeposits: 0, totalWithdrawals: 0 });

  useEffect(() => {
    fetchRequests();
  }, [filter, typeFilter]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get('/api/admin/manage/all-fund-requests', {
        params: { status: filter, type: typeFilter !== 'ALL' ? typeFilter : undefined },
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      setRequests(data.requests || []);
      setStats(data.stats || stats);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id, action) => {
    try {
      await axios.post(`/api/admin/manage/fund-requests/${id}/${action}`, {}, {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      fetchRequests();
    } catch (error) {
      alert(error.response?.data?.message || 'Error');
    }
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Fund Requests</h1>
          <p className="text-gray-400 text-sm mt-1">Manage deposit and withdrawal requests from all users</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-dark-800 rounded-lg p-4">
          <div className="text-sm text-gray-400">Pending</div>
          <div className="text-2xl font-bold text-yellow-400">{stats.pending}</div>
        </div>
        <div className="bg-dark-800 rounded-lg p-4">
          <div className="text-sm text-gray-400">Approved</div>
          <div className="text-2xl font-bold text-green-400">{stats.approved}</div>
        </div>
        <div className="bg-dark-800 rounded-lg p-4">
          <div className="text-sm text-gray-400">Rejected</div>
          <div className="text-2xl font-bold text-red-400">{stats.rejected}</div>
        </div>
        <div className="bg-dark-800 rounded-lg p-4">
          <div className="text-sm text-gray-400">Total Deposits</div>
          <div className="text-xl font-bold text-green-400">₹{stats.totalDeposits?.toLocaleString() || 0}</div>
        </div>
        <div className="bg-dark-800 rounded-lg p-4">
          <div className="text-sm text-gray-400">Total Withdrawals</div>
          <div className="text-xl font-bold text-red-400">₹{stats.totalWithdrawals?.toLocaleString() || 0}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex gap-2">
          {['PENDING', 'APPROVED', 'REJECTED', 'ALL'].map(status => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded text-sm ${filter === status ? 'bg-purple-600' : 'bg-dark-700 hover:bg-dark-600'}`}
            >
              {status}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {['ALL', 'DEPOSIT', 'WITHDRAWAL'].map(type => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              className={`px-4 py-2 rounded text-sm ${typeFilter === type ? 'bg-blue-600' : 'bg-dark-700 hover:bg-dark-600'}`}
            >
              {type === 'ALL' ? 'All Types' : type}
            </button>
          ))}
        </div>
      </div>

      {/* Requests List */}
      {loading ? (
        <div className="text-center py-8"><RefreshCw className="animate-spin inline" /></div>
      ) : requests.length === 0 ? (
        <div className="text-center py-8 text-gray-400">No {filter.toLowerCase()} requests found</div>
      ) : (
        <div className="bg-dark-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-dark-700">
              <tr>
                <th className="text-left px-4 py-3 text-gray-400">User</th>
                <th className="text-left px-4 py-3 text-gray-400">Admin</th>
                <th className="text-left px-4 py-3 text-gray-400">Type</th>
                <th className="text-right px-4 py-3 text-gray-400">Amount</th>
                <th className="text-left px-4 py-3 text-gray-400">Reference</th>
                <th className="text-left px-4 py-3 text-gray-400">Date</th>
                <th className="text-center px-4 py-3 text-gray-400">Status</th>
                <th className="text-center px-4 py-3 text-gray-400">Action</th>
              </tr>
            </thead>
            <tbody>
              {requests.map(req => (
                <tr key={req._id} className="border-t border-dark-600 hover:bg-dark-700/50">
                  <td className="px-4 py-3">
                    <div className="font-medium">{req.user?.fullName || req.user?.username}</div>
                    <div className="text-xs text-gray-500">{req.user?.userId}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm">{req.admin?.username || 'Super Admin'}</div>
                    <div className="text-xs text-gray-500">{req.admin?.adminCode || '-'}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${req.type === 'DEPOSIT' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      {req.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold">
                    ₹{req.amount?.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {req.referenceId || '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(req.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      req.status === 'PENDING' ? 'bg-yellow-500/20 text-yellow-400' :
                      req.status === 'APPROVED' ? 'bg-green-500/20 text-green-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      {req.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {req.status === 'PENDING' && (
                      <div className="flex gap-1 justify-center">
                        <button 
                          onClick={() => handleAction(req._id, 'approve')} 
                          className="px-2 py-1 bg-green-600 hover:bg-green-700 rounded text-xs"
                        >
                          Approve
                        </button>
                        <button 
                          onClick={() => handleAction(req._id, 'reject')} 
                          className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// Fund Requests Component (for Admin)
const FundRequests = () => {
  const { admin } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('PENDING');
  const [searchTerm, setSearchTerm] = useState('');

  const { currentPage, setCurrentPage, totalPages, paginatedData: paginatedRequests, totalItems } = usePagination(
    requests, 20, searchTerm, ['user.username', 'user.fullName', 'userId', 'referenceId', 'amount']
  );

  useEffect(() => {
    fetchRequests();
  }, [filter]);

  const fetchRequests = async () => {
    try {
      const { data } = await axios.get(`/api/admin/manage/fund-requests?status=${filter}`, {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      setRequests(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id, action) => {
    try {
      await axios.post(`/api/admin/manage/fund-requests/${id}/${action}`, {}, {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      fetchRequests();
    } catch (error) {
      alert(error.response?.data?.message || 'Error');
    }
  };

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-bold mb-6">Fund Requests</h1>
      
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex gap-2">
          {['PENDING', 'APPROVED', 'REJECTED'].map(status => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded ${filter === status ? 'bg-purple-600' : 'bg-dark-700'}`}
            >
              {status}
            </button>
          ))}
        </div>
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search by user, reference..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-dark-700 border border-dark-600 rounded-lg pl-10 pr-4 py-2"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8"><RefreshCw className="animate-spin inline" /></div>
      ) : totalItems === 0 ? (
        <div className="text-center py-8 text-gray-400">No {filter.toLowerCase()} requests</div>
      ) : (
        <div className="space-y-4">
          {paginatedRequests.map(req => (
            <div key={req._id} className="bg-dark-800 rounded-lg p-4">
              <div className="flex flex-col md:flex-row justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${req.type === 'DEPOSIT' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      {req.type}
                    </span>
                    <span className="font-bold">₹{req.amount.toLocaleString()}</span>
                  </div>
                  <div className="text-sm text-gray-400 mt-1">
                    User: {req.user?.fullName || req.user?.username} ({req.userId})
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(req.createdAt).toLocaleString()}
                  </div>
                  {req.referenceId && <div className="text-xs text-gray-500">Ref: {req.referenceId}</div>}
                  {req.paymentMethod && <div className="text-xs text-gray-500">Method: {req.paymentMethod}</div>}
                  {req.userRemarks && <div className="text-xs text-gray-400 mt-1">Remarks: {req.userRemarks}</div>}
                  
                  {/* Withdrawal Details */}
                  {req.type === 'WITHDRAWAL' && req.withdrawalDetails && (
                    <div className="bg-dark-700 rounded p-2 mt-2 text-xs">
                      <div className="text-gray-400 font-medium mb-1">Withdrawal To:</div>
                      {req.withdrawalDetails.upiId && (
                        <div className="text-green-400">UPI: {req.withdrawalDetails.upiId}</div>
                      )}
                      {req.withdrawalDetails.bankName && (
                        <>
                          <div>Bank: {req.withdrawalDetails.bankName}</div>
                          <div>A/C: {req.withdrawalDetails.accountNumber}</div>
                          <div>IFSC: {req.withdrawalDetails.ifscCode}</div>
                          <div>Name: {req.withdrawalDetails.accountHolderName}</div>
                        </>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Payment Proof Image */}
                {req.proofUrl && (
                  <div className="flex-shrink-0">
                    <div className="text-xs text-gray-400 mb-1">Payment Proof:</div>
                    <img 
                      src={`${import.meta.env.VITE_SOCKET_URL || ''}${req.proofUrl}`} 
                      alt="Payment proof" 
                      className="w-24 h-24 object-cover rounded-lg border border-dark-600 hover:border-purple-500 transition cursor-pointer"
                      onClick={() => window.open(`${import.meta.env.VITE_SOCKET_URL || ''}${req.proofUrl}`, '_blank')}
                    />
                  </div>
                )}
                
                {req.status === 'PENDING' && (
                  <div className="flex gap-2 items-start">
                    <button onClick={() => handleAction(req._id, 'approve')} className="px-4 py-2 bg-green-600 rounded text-sm">Approve</button>
                    <button onClick={() => handleAction(req._id, 'reject')} className="px-4 py-2 bg-red-600 rounded text-sm">Reject</button>
                  </div>
                )}
              </div>
            </div>
          ))}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalItems={totalItems}
            itemsPerPage={20}
          />
        </div>
      )}
    </div>
  );
};

// Bank Accounts Component
const BankAccounts = () => {
  const { admin } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const { data } = await axios.get('/api/admin/manage/bank-accounts', {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      setAccounts(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this account?')) return;
    try {
      await axios.delete(`/api/admin/manage/bank-accounts/${id}`, {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      fetchAccounts();
    } catch (error) {
      alert('Error deleting');
    }
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex justify-between mb-6">
        <h1 className="text-2xl font-bold">Bank Accounts</h1>
        <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 bg-purple-600 px-4 py-2 rounded">
          <Plus size={20} /> Add Account
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8"><RefreshCw className="animate-spin inline" /></div>
      ) : accounts.length === 0 ? (
        <div className="text-center py-8 text-gray-400">No bank accounts added</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {accounts.map(acc => (
            <div key={acc._id} className="bg-dark-800 rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div>
                  <span className={`px-2 py-0.5 rounded text-xs ${acc.type === 'BANK' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>
                    {acc.type}
                  </span>
                  <div className="font-bold mt-2">{acc.holderName}</div>
                  {acc.type === 'BANK' ? (
                    <>
                      <div className="text-sm text-gray-400">{acc.bankName}</div>
                      <div className="text-sm font-mono">{acc.accountNumber}</div>
                      <div className="text-xs text-gray-500">IFSC: {acc.ifsc}</div>
                    </>
                  ) : (
                    <div className="text-sm font-mono text-purple-400">{acc.upiId}</div>
                  )}
                </div>
                <button onClick={() => handleDelete(acc._id)} className="text-red-400 hover:text-red-300">
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <AddBankModal token={admin.token} onClose={() => setShowAddModal(false)} onSuccess={() => { setShowAddModal(false); fetchAccounts(); }} />
      )}
    </div>
  );
};

// Add Bank Modal
const AddBankModal = ({ token, onClose, onSuccess }) => {
  const [type, setType] = useState('BANK');
  const [formData, setFormData] = useState({ holderName: '', bankName: '', accountNumber: '', ifsc: '', upiId: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post('/api/admin/manage/bank-accounts', { type, ...formData }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      onSuccess();
    } catch (error) {
      alert(error.response?.data?.message || 'Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 rounded-lg w-full max-w-md p-6">
        <div className="flex justify-between mb-4">
          <h2 className="text-xl font-bold">Add Payment Method</h2>
          <button onClick={onClose}><X size={24} /></button>
        </div>
        <div className="flex gap-2 mb-4">
          <button onClick={() => setType('BANK')} className={`flex-1 py-2 rounded ${type === 'BANK' ? 'bg-blue-600' : 'bg-dark-700'}`}>Bank</button>
          <button onClick={() => setType('UPI')} className={`flex-1 py-2 rounded ${type === 'UPI' ? 'bg-purple-600' : 'bg-dark-700'}`}>UPI</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="text" placeholder="Account Holder Name *" value={formData.holderName} onChange={e => setFormData({...formData, holderName: e.target.value})} className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2" required />
          {type === 'BANK' ? (
            <>
              <input type="text" placeholder="Bank Name *" value={formData.bankName} onChange={e => setFormData({...formData, bankName: e.target.value})} className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2" required />
              <input type="text" placeholder="Account Number *" value={formData.accountNumber} onChange={e => setFormData({...formData, accountNumber: e.target.value})} className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2" required />
              <input type="text" placeholder="IFSC Code *" value={formData.ifsc} onChange={e => setFormData({...formData, ifsc: e.target.value})} className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2" required />
            </>
          ) : (
            <input type="text" placeholder="UPI ID *" value={formData.upiId} onChange={e => setFormData({...formData, upiId: e.target.value})} className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2" required />
          )}
          <button type="submit" disabled={loading} className="w-full bg-green-600 py-2 rounded">{loading ? 'Adding...' : 'Add Account'}</button>
        </form>
      </div>
    </div>
  );
};

// Admin Wallet - For Admin to view wallet, request funds, download ledger
const AdminWallet = () => {
  const { admin, updateAdmin } = useAuth();
  const [walletData, setWalletData] = useState(null);
  const [fundRequests, setFundRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestAmount, setRequestAmount] = useState('');
  const [requestReason, setRequestReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferTargets, setTransferTargets] = useState([]);
  const [transferData, setTransferData] = useState({ targetAdminId: '', amount: '', remarks: '' });

  useEffect(() => {
    fetchWalletData();
    fetchFundRequests();
  }, []);

  const fetchWalletData = async () => {
    try {
      const { data } = await axios.get('/api/admin/manage/my-wallet', {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      setWalletData(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFundRequests = async () => {
    try {
      const { data } = await axios.get('/api/admin/manage/my-fund-requests', {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      setFundRequests(data);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleRequestFund = async (e) => {
    e.preventDefault();
    if (!requestAmount || Number(requestAmount) <= 0) {
      setMessage({ type: 'error', text: 'Enter valid amount' });
      return;
    }
    setSubmitting(true);
    setMessage({ type: '', text: '' });
    try {
      await axios.post('/api/admin/manage/fund-request', {
        amount: Number(requestAmount),
        reason: requestReason
      }, {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      setMessage({ type: 'success', text: 'Fund request submitted successfully' });
      setRequestAmount('');
      setRequestReason('');
      setShowRequestModal(false);
      fetchFundRequests();
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Error submitting request' });
    } finally {
      setSubmitting(false);
    }
  };

  const downloadLedger = async () => {
    try {
      const response = await axios.get('/api/admin/manage/my-ledger/download', {
        headers: { Authorization: `Bearer ${admin.token}` },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `admin-ledger-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      alert('Error downloading ledger');
    }
  };

  const downloadUserTransactions = async () => {
    try {
      const response = await axios.get('/api/admin/manage/user-transactions/download', {
        headers: { Authorization: `Bearer ${admin.token}` },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `user-transactions-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      alert('Error downloading transactions');
    }
  };

  const fetchTransferTargets = async () => {
    try {
      const { data } = await axios.get('/api/admin/manage/transfer-targets', {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      setTransferTargets(data);
    } catch (error) {
      console.error('Error fetching transfer targets:', error);
    }
  };

  const handleTransfer = async (e) => {
    e.preventDefault();
    if (!transferData.targetAdminId || !transferData.amount || Number(transferData.amount) <= 0) {
      setMessage({ type: 'error', text: 'Select admin and enter valid amount' });
      return;
    }
    if (Number(transferData.amount) > (walletData?.wallet?.balance || 0)) {
      setMessage({ type: 'error', text: 'Insufficient balance' });
      return;
    }
    setSubmitting(true);
    setMessage({ type: '', text: '' });
    try {
      const { data } = await axios.post('/api/admin/manage/admin-transfer', {
        targetAdminId: transferData.targetAdminId,
        amount: Number(transferData.amount),
        remarks: transferData.remarks
      }, {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      setMessage({ type: 'success', text: data.message });
      setTransferData({ targetAdminId: '', amount: '', remarks: '' });
      setShowTransferModal(false);
      fetchWalletData();
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Transfer failed' });
    } finally {
      setSubmitting(false);
    }
  };

  const openTransferModal = () => {
    fetchTransferTargets();
    setShowTransferModal(true);
  };

  if (loading) {
    return <div className="p-6 text-center"><RefreshCw className="animate-spin inline" size={24} /></div>;
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold">My Wallet</h1>
        <div className="flex gap-2">
          {admin?.role === 'ADMIN' && (
            <button
              onClick={openTransferModal}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg"
            >
              <ArrowRightLeft size={20} />
              Transfer to Admin
            </button>
          )}
          <button
            onClick={() => setShowRequestModal(true)}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg"
          >
            <Plus size={20} />
            Request Funds
          </button>
        </div>
      </div>

      {message.text && (
        <div className={`mb-4 p-3 rounded ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
          {message.text}
        </div>
      )}

      {/* Wallet Balance Card */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl p-6 mb-6">
        <div className="text-white/80 text-sm mb-1">Available Balance</div>
        <div className="text-4xl font-bold text-white mb-4">₹{(walletData?.wallet?.balance || 0).toLocaleString()}</div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-white/60">Total Deposited</div>
            <div className="text-white font-semibold">₹{(walletData?.wallet?.totalDeposited || 0).toLocaleString()}</div>
          </div>
          <div>
            <div className="text-white/60">Total Withdrawn</div>
            <div className="text-white font-semibold">₹{(walletData?.wallet?.totalWithdrawn || 0).toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* User Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-dark-800 rounded-lg p-4">
          <div className="text-sm text-gray-400">Total Users</div>
          <div className="text-2xl font-bold text-purple-400">{walletData?.summary?.totalUsers || 0}</div>
        </div>
        <div className="bg-dark-800 rounded-lg p-4">
          <div className="text-sm text-gray-400">User Deposits</div>
          <div className="text-2xl font-bold text-green-400">₹{(walletData?.summary?.totalUserDeposits || 0).toLocaleString()}</div>
        </div>
        <div className="bg-dark-800 rounded-lg p-4">
          <div className="text-sm text-gray-400">User Withdrawals</div>
          <div className="text-2xl font-bold text-red-400">₹{(walletData?.summary?.totalUserWithdrawals || 0).toLocaleString()}</div>
        </div>
        <div className="bg-dark-800 rounded-lg p-4">
          <div className="text-sm text-gray-400">Distributed to Users</div>
          <div className="text-2xl font-bold text-blue-400">₹{(walletData?.summary?.distributedToUsers || 0).toLocaleString()}</div>
        </div>
      </div>

      {/* P&L Summary */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-dark-800 rounded-lg p-4">
          <div className="text-sm text-gray-400">Total User Profits</div>
          <div className="text-2xl font-bold text-green-400">₹{(walletData?.summary?.totalUserProfits || 0).toLocaleString()}</div>
        </div>
        <div className="bg-dark-800 rounded-lg p-4">
          <div className="text-sm text-gray-400">Total User Losses</div>
          <div className="text-2xl font-bold text-red-400">₹{(walletData?.summary?.totalUserLosses || 0).toLocaleString()}</div>
        </div>
      </div>

      {/* Download Buttons */}
      <div className="flex flex-wrap gap-3 mb-6">
        <button onClick={downloadLedger} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg">
          <FileText size={18} /> Download My Ledger
        </button>
        <button onClick={downloadUserTransactions} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg">
          <FileText size={18} /> Download User Transactions
        </button>
      </div>

      {/* Fund Requests History */}
      <div className="bg-dark-800 rounded-lg p-4 mb-6">
        <h2 className="text-lg font-semibold mb-4">My Fund Requests</h2>
        {fundRequests.length === 0 ? (
          <div className="text-center py-4 text-gray-400">No fund requests yet</div>
        ) : (
          <div className="space-y-2">
            {fundRequests.map(req => (
              <div key={req._id} className="flex items-center justify-between bg-dark-700 rounded p-3">
                <div>
                  <div className="font-medium">₹{req.amount.toLocaleString()}</div>
                  <div className="text-xs text-gray-400">{req.reason || 'No reason'}</div>
                  <div className="text-xs text-gray-500">{new Date(req.createdAt).toLocaleString()}</div>
                </div>
                <span className={`px-3 py-1 rounded text-sm ${
                  req.status === 'APPROVED' ? 'bg-green-500/20 text-green-400' :
                  req.status === 'REJECTED' ? 'bg-red-500/20 text-red-400' :
                  'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {req.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Ledger */}
      <div className="bg-dark-800 rounded-lg p-4">
        <h2 className="text-lg font-semibold mb-4">Recent Transactions</h2>
        {!walletData?.ledger?.length ? (
          <div className="text-center py-4 text-gray-400">No transactions yet</div>
        ) : (
          <div className="space-y-2">
            {walletData.ledger.slice(0, 10).map(entry => (
              <div key={entry._id} className="flex items-center justify-between bg-dark-700 rounded p-3">
                <div>
                  <div className="text-sm">{entry.reason}</div>
                  <div className="text-xs text-gray-400">{entry.description}</div>
                  <div className="text-xs text-gray-500">{new Date(entry.createdAt).toLocaleString()}</div>
                </div>
                <div className="text-right">
                  <div className={entry.type === 'CREDIT' ? 'text-green-400' : 'text-red-400'}>
                    {entry.type === 'CREDIT' ? '+' : '-'}₹{entry.amount.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-400">Bal: ₹{entry.balanceAfter.toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Request Fund Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 rounded-lg w-full max-w-md p-6">
            <div className="flex justify-between mb-4">
              <h2 className="text-xl font-bold">Request Funds</h2>
              <button onClick={() => setShowRequestModal(false)}><X size={24} /></button>
            </div>
            <p className="text-gray-400 text-sm mb-4">
              Request funds from your {admin?.role === 'ADMIN' ? 'Super Admin' : admin?.role === 'BROKER' ? 'Admin' : admin?.role === 'SUB_BROKER' ? 'Broker' : 'Superior'}. 
              Your current balance is ₹{(walletData?.wallet?.balance || 0).toLocaleString()}
            </p>
            <form onSubmit={handleRequestFund} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Amount (₹)</label>
                <input
                  type="number"
                  value={requestAmount}
                  onChange={e => setRequestAmount(e.target.value)}
                  className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2"
                  placeholder="Enter amount"
                  required
                  min="1"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Reason (optional)</label>
                <textarea
                  value={requestReason}
                  onChange={e => setRequestReason(e.target.value)}
                  className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2"
                  placeholder="Why do you need these funds?"
                  rows={3}
                />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowRequestModal(false)} className="flex-1 bg-dark-600 py-2 rounded">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="flex-1 bg-green-600 hover:bg-green-700 py-2 rounded">
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 rounded-lg w-full max-w-md p-6">
            <div className="flex justify-between mb-4">
              <h2 className="text-xl font-bold">Transfer to Admin</h2>
              <button onClick={() => setShowTransferModal(false)}><X size={24} /></button>
            </div>
            <p className="text-gray-400 text-sm mb-4">
              Transfer funds from your wallet to another admin. Your balance: ₹{(walletData?.wallet?.balance || 0).toLocaleString()}
            </p>
            <form onSubmit={handleTransfer} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Select Admin</label>
                <select
                  value={transferData.targetAdminId}
                  onChange={e => setTransferData({...transferData, targetAdminId: e.target.value})}
                  className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2"
                  required
                >
                  <option value="">-- Select Admin --</option>
                  {transferTargets.map(t => (
                    <option key={t._id} value={t._id}>
                      {t.name || t.username} ({t.role}) - ₹{(t.wallet?.balance || 0).toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Amount (₹)</label>
                <input
                  type="number"
                  value={transferData.amount}
                  onChange={e => setTransferData({...transferData, amount: e.target.value})}
                  className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2"
                  placeholder="Enter amount"
                  required
                  min="1"
                  max={walletData?.wallet?.balance || 0}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Remarks (optional)</label>
                <input
                  type="text"
                  value={transferData.remarks}
                  onChange={e => setTransferData({...transferData, remarks: e.target.value})}
                  className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2"
                  placeholder="e.g., Fund sharing"
                />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowTransferModal(false)} className="flex-1 bg-dark-600 py-2 rounded">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="flex-1 bg-blue-600 hover:bg-blue-700 py-2 rounded">
                  {submitting ? 'Transferring...' : 'Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Broker Change Requests Management - For Super Admin to approve/reject user transfer requests
const BrokerChangeRequestsManagement = () => {
  const { admin } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('PENDING');
  const [actionLoading, setActionLoading] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const { currentPage, setCurrentPage, totalPages, paginatedData: paginatedRequests, totalItems } = usePagination(
    requests, 20, searchTerm, ['user.username', 'user.fullName', 'currentAdminCode', 'requestedAdminCode', 'requestId']
  );

  useEffect(() => {
    fetchRequests();
  }, [filter]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get('/api/admin/manage/broker-change-requests', {
        params: { status: filter || 'ALL' },
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      setRequests(data.requests || []);
    } catch (error) {
      console.error('Error fetching broker change requests:', error);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId) => {
    if (!confirm('Approve this transfer request? User wallet balance will be transferred from current broker to new broker.')) return;
    
    setActionLoading(requestId);
    try {
      const { data } = await axios.post(`/api/admin/manage/broker-change-requests/${requestId}/approve`, {}, {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      alert(data.message);
      fetchRequests();
    } catch (error) {
      alert(error.response?.data?.message || 'Error approving request');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (requestId) => {
    const remarks = prompt('Enter rejection reason (optional):');
    if (remarks === null) return;
    
    setActionLoading(requestId);
    try {
      await axios.post(`/api/admin/manage/broker-change-requests/${requestId}/reject`, { remarks }, {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      fetchRequests();
    } catch (error) {
      alert(error.response?.data?.message || 'Error rejecting request');
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      PENDING: 'bg-yellow-500/20 text-yellow-400',
      APPROVED: 'bg-green-500/20 text-green-400',
      REJECTED: 'bg-red-500/20 text-red-400'
    };
    return <span className={`px-2 py-0.5 rounded text-xs ${styles[status] || styles.PENDING}`}>{status}</span>;
  };

  const getRoleBadge = (role) => {
    const styles = {
      ADMIN: 'bg-purple-500/20 text-purple-400',
      BROKER: 'bg-cyan-500/20 text-cyan-400',
      SUB_BROKER: 'bg-green-500/20 text-green-400'
    };
    const labels = { ADMIN: 'Admin', BROKER: 'Broker', SUB_BROKER: 'SubBroker' };
    return <span className={`px-1.5 py-0.5 rounded text-xs ${styles[role] || 'bg-gray-500/20 text-gray-400'}`}>{labels[role] || role}</span>;
  };

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-bold mb-6">User Transfer Requests</h1>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {['PENDING', 'APPROVED', 'REJECTED', ''].map(status => (
          <button
            key={status || 'ALL'}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              filter === status 
                ? 'bg-yellow-600 text-white' 
                : 'bg-dark-700 text-gray-400 hover:bg-dark-600'
            }`}
          >
            {status || 'All'}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search by user, admin code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-dark-700 border border-dark-600 rounded-lg pl-10 pr-4 py-2"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="animate-spin text-yellow-400" size={32} />
        </div>
      ) : paginatedRequests.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No transfer requests found</div>
      ) : (
        <>
          {/* Mobile Card View */}
          <div className="md:hidden space-y-4">
            {paginatedRequests.map(req => (
              <div key={req._id} className="bg-dark-800 rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="font-bold">{req.user?.fullName || req.user?.username}</div>
                    <div className="text-xs text-gray-400">{req.user?.email}</div>
                  </div>
                  {getStatusBadge(req.status)}
                </div>
                
                <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                  <div>
                    <div className="text-gray-500 text-xs">From</div>
                    <div className="font-medium">{req.currentAdmin?.name || req.currentAdminCode}</div>
                    {req.currentAdmin?.role && getRoleBadge(req.currentAdmin.role)}
                  </div>
                  <div>
                    <div className="text-gray-500 text-xs">To</div>
                    <div className="font-medium">{req.requestedAdmin?.name || req.requestedAdminCode}</div>
                    {req.requestedAdmin?.role && getRoleBadge(req.requestedAdmin.role)}
                  </div>
                </div>
                
                {req.reason && (
                  <div className="text-xs text-gray-400 mb-2">
                    <span className="font-medium">Reason: </span>{req.reason}
                  </div>
                )}
                
                <div className="text-xs text-gray-500 mb-3">
                  {new Date(req.createdAt).toLocaleString()}
                </div>
                
                {req.status === 'PENDING' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(req._id)}
                      disabled={actionLoading === req._id}
                      className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 rounded text-sm disabled:opacity-50"
                    >
                      {actionLoading === req._id ? 'Processing...' : 'Approve'}
                    </button>
                    <button
                      onClick={() => handleReject(req._id)}
                      disabled={actionLoading === req._id}
                      className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 rounded text-sm disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block bg-dark-800 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-dark-700">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-400">Request ID</th>
                  <th className="text-left px-4 py-3 text-gray-400">User</th>
                  <th className="text-left px-4 py-3 text-gray-400">From</th>
                  <th className="text-left px-4 py-3 text-gray-400">To</th>
                  <th className="text-left px-4 py-3 text-gray-400">Reason</th>
                  <th className="text-left px-4 py-3 text-gray-400">Date</th>
                  <th className="text-center px-4 py-3 text-gray-400">Status</th>
                  <th className="text-center px-4 py-3 text-gray-400">Action</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRequests.map(req => (
                  <tr key={req._id} className="border-t border-dark-600">
                    <td className="px-4 py-3 font-mono text-xs">{req.requestId}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{req.user?.fullName || req.user?.username}</div>
                      <div className="text-xs text-gray-500">{req.user?.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{req.currentAdmin?.name || req.currentAdmin?.username || '-'}</div>
                      <div className="text-xs text-gray-500">{req.currentAdminCode}</div>
                      {req.currentAdmin?.role && getRoleBadge(req.currentAdmin.role)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{req.requestedAdmin?.name || req.requestedAdmin?.username || '-'}</div>
                      <div className="text-xs text-gray-500">{req.requestedAdminCode}</div>
                      {req.requestedAdmin?.role && getRoleBadge(req.requestedAdmin.role)}
                    </td>
                    <td className="px-4 py-3 text-xs max-w-[150px] truncate" title={req.reason}>
                      {req.reason || '-'}
                    </td>
                    <td className="px-4 py-3 text-xs">{new Date(req.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3 text-center">{getStatusBadge(req.status)}</td>
                    <td className="px-4 py-3 text-center">
                      {req.status === 'PENDING' ? (
                        <div className="flex gap-1 justify-center">
                          <button
                            onClick={() => handleApprove(req._id)}
                            disabled={actionLoading === req._id}
                            className="px-2 py-1 bg-green-600 hover:bg-green-700 rounded text-xs disabled:opacity-50"
                          >
                            ✓
                          </button>
                          <button
                            onClick={() => handleReject(req._id)}
                            disabled={actionLoading === req._id}
                            className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs disabled:opacity-50"
                          >
                            ✗
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-4">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 bg-dark-700 rounded disabled:opacity-50"
              >
                Prev
              </button>
              <span className="text-sm text-gray-400">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 bg-dark-700 rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// Admin Fund Requests Management - For Super Admin to approve/reject admin fund requests
const AdminFundRequestsManagement = () => {
  const { admin } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('PENDING');
  const [processing, setProcessing] = useState(null);

  useEffect(() => {
    fetchRequests();
  }, [filter]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`/api/admin/manage/admin-fund-requests?status=${filter}`, {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      setRequests(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (requestId, status, remarks = '') => {
    setProcessing(requestId);
    try {
      await axios.put(`/api/admin/manage/admin-fund-requests/${requestId}`, {
        status,
        remarks
      }, {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      fetchRequests();
    } catch (error) {
      alert(error.response?.data?.message || 'Error processing request');
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-bold mb-6">Admin Fund Requests</h1>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6">
        {['PENDING', 'APPROVED', 'REJECTED'].map(status => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg ${filter === status ? 
              status === 'PENDING' ? 'bg-yellow-600' :
              status === 'APPROVED' ? 'bg-green-600' : 'bg-red-600'
              : 'bg-dark-700'}`}
          >
            {status}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-8"><RefreshCw className="animate-spin inline" /></div>
      ) : requests.length === 0 ? (
        <div className="text-center py-8 text-gray-400">No {filter.toLowerCase()} requests</div>
      ) : (
        <div className="space-y-4">
          {requests.map(req => (
            <div key={req._id} className="bg-dark-800 rounded-lg p-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-lg">{req.admin?.name || req.admin?.username}</span>
                    <span className="font-mono bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded text-sm">{req.adminCode}</span>
                  </div>
                  <div className="text-sm text-gray-400 mt-1">{req.admin?.email}</div>
                  <div className="text-sm text-gray-500 mt-1">
                    Current Balance: ₹{(req.admin?.wallet?.balance || 0).toLocaleString()}
                  </div>
                  {req.reason && <div className="text-sm mt-2 text-gray-300">Reason: {req.reason}</div>}
                  <div className="text-xs text-gray-500 mt-1">{new Date(req.createdAt).toLocaleString()}</div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-400">Requested Amount</div>
                  <div className="text-2xl font-bold text-green-400">₹{req.amount.toLocaleString()}</div>
                </div>
                {filter === 'PENDING' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAction(req._id, 'APPROVED')}
                      disabled={processing === req._id}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded flex items-center gap-1"
                    >
                      <ArrowUpCircle size={18} /> Approve
                    </button>
                    <button
                      onClick={() => handleAction(req._id, 'REJECTED')}
                      disabled={processing === req._id}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded flex items-center gap-1"
                    >
                      <ArrowDownCircle size={18} /> Reject
                    </button>
                  </div>
                )}
                {filter !== 'PENDING' && (
                  <span className={`px-4 py-2 rounded ${
                    req.status === 'APPROVED' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                  }`}>
                    {req.status}
                  </span>
                )}
              </div>
              {req.adminRemarks && (
                <div className="mt-3 pt-3 border-t border-dark-600 text-sm text-gray-400">
                  Remarks: {req.adminRemarks}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Subordinate Fund Requests - For Admin/Broker to approve fund requests from Broker/SubBroker
const SubordinateFundRequests = () => {
  const { admin } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('PENDING');
  const [processing, setProcessing] = useState(null);
  
  const isAdmin = admin?.role === 'ADMIN';
  const isBroker = admin?.role === 'BROKER';
  
  const getTitle = () => {
    if (isAdmin) return 'Broker/SubBroker Fund Requests';
    if (isBroker) return 'SubBroker Fund Requests';
    return 'Subordinate Fund Requests';
  };
  
  const getRoleBadgeColor = (role) => {
    switch(role) {
      case 'ADMIN': return 'bg-purple-500/20 text-purple-400';
      case 'BROKER': return 'bg-cyan-500/20 text-cyan-400';
      case 'SUB_BROKER': return 'bg-green-500/20 text-green-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };
  
  const getRoleLabel = (role) => {
    switch(role) {
      case 'ADMIN': return 'Admin';
      case 'BROKER': return 'Broker';
      case 'SUB_BROKER': return 'SubBroker';
      default: return role;
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [filter]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`/api/admin/manage/admin-fund-requests?status=${filter}`, {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      setRequests(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (requestId, status, remarks = '') => {
    setProcessing(requestId);
    try {
      await axios.put(`/api/admin/manage/admin-fund-requests/${requestId}`, {
        status,
        remarks
      }, {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      fetchRequests();
      // Refresh admin data to update wallet balance
      window.location.reload();
    } catch (error) {
      alert(error.response?.data?.message || 'Error processing request');
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{getTitle()}</h1>
        <div className="text-sm text-gray-400">
          Your Wallet: <span className="text-green-400 font-bold">₹{(admin?.wallet?.balance || 0).toLocaleString()}</span>
        </div>
      </div>
      
      <div className="bg-blue-500/20 text-blue-300 p-3 rounded-lg mb-6 text-sm">
        💡 When you approve a request, funds will be deducted from your wallet and credited to the requestor's wallet.
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6">
        {['PENDING', 'APPROVED', 'REJECTED'].map(status => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg ${filter === status ? 
              status === 'PENDING' ? 'bg-yellow-600' :
              status === 'APPROVED' ? 'bg-green-600' : 'bg-red-600'
              : 'bg-dark-700'}`}
          >
            {status}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-8"><RefreshCw className="animate-spin inline" /></div>
      ) : requests.length === 0 ? (
        <div className="text-center py-8 text-gray-400">No {filter.toLowerCase()} requests from your subordinates</div>
      ) : (
        <div className="space-y-4">
          {requests.map(req => (
            <div key={req._id} className="bg-dark-800 rounded-lg p-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-lg">{req.admin?.name || req.admin?.username}</span>
                    <span className={`px-2 py-0.5 rounded text-xs ${getRoleBadgeColor(req.requestorRole)}`}>
                      {getRoleLabel(req.requestorRole)}
                    </span>
                    <span className="font-mono bg-gray-500/20 text-gray-400 px-2 py-0.5 rounded text-sm">{req.adminCode}</span>
                  </div>
                  <div className="text-sm text-gray-400 mt-1">{req.admin?.email}</div>
                  <div className="text-sm text-gray-500 mt-1">
                    Their Current Balance: ₹{(req.admin?.wallet?.balance || 0).toLocaleString()}
                  </div>
                  {req.reason && <div className="text-sm mt-2 text-gray-300">Reason: {req.reason}</div>}
                  <div className="text-xs text-gray-500 mt-1">{new Date(req.createdAt).toLocaleString()}</div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-400">Requested Amount</div>
                  <div className="text-2xl font-bold text-green-400">₹{req.amount.toLocaleString()}</div>
                  {filter === 'PENDING' && admin?.wallet?.balance < req.amount && (
                    <div className="text-xs text-red-400 mt-1">Insufficient balance</div>
                  )}
                </div>
                {filter === 'PENDING' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAction(req._id, 'APPROVED')}
                      disabled={processing === req._id || admin?.wallet?.balance < req.amount}
                      className={`px-4 py-2 rounded flex items-center gap-1 ${
                        admin?.wallet?.balance < req.amount 
                          ? 'bg-gray-600 cursor-not-allowed' 
                          : 'bg-green-600 hover:bg-green-700'
                      }`}
                    >
                      <ArrowUpCircle size={18} /> Approve
                    </button>
                    <button
                      onClick={() => handleAction(req._id, 'REJECTED')}
                      disabled={processing === req._id}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded flex items-center gap-1"
                    >
                      <ArrowDownCircle size={18} /> Reject
                    </button>
                  </div>
                )}
                {filter !== 'PENDING' && (
                  <span className={`px-4 py-2 rounded ${
                    req.status === 'APPROVED' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                  }`}>
                    {req.status}
                  </span>
                )}
              </div>
              {req.adminRemarks && (
                <div className="mt-3 pt-3 border-t border-dark-600 text-sm text-gray-400">
                  Remarks: {req.adminRemarks}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Ledger View
const LedgerView = () => {
  const { admin } = useAuth();
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLedger();
  }, []);

  const fetchLedger = async () => {
    try {
      const { data } = await axios.get('/api/admin/manage/my-ledger', {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      setLedger(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-bold mb-6">Wallet Ledger</h1>
      
      {loading ? (
        <div className="text-center py-8"><RefreshCw className="animate-spin inline" /></div>
      ) : ledger.length === 0 ? (
        <div className="text-center py-8 text-gray-400">No transactions yet</div>
      ) : (
        <div className="bg-dark-800 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-dark-700">
              <tr>
                <th className="text-left px-4 py-3 text-gray-400">Date</th>
                <th className="text-left px-4 py-3 text-gray-400">Type</th>
                <th className="text-left px-4 py-3 text-gray-400">Reason</th>
                <th className="text-right px-4 py-3 text-gray-400">Amount</th>
                <th className="text-right px-4 py-3 text-gray-400">Balance</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map(entry => (
                <tr key={entry._id} className="border-t border-dark-600">
                  <td className="px-4 py-3 text-sm">{new Date(entry.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${entry.type === 'CREDIT' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      {entry.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">{entry.reason}</td>
                  <td className={`px-4 py-3 text-right ${entry.type === 'CREDIT' ? 'text-green-400' : 'text-red-400'}`}>
                    {entry.type === 'CREDIT' ? '+' : '-'}₹{entry.amount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">₹{entry.balanceAfter.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// Bank Management (Super Admin only)
const BankManagement = () => {
  const { admin } = useAuth();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddBank, setShowAddBank] = useState(false);
  const [showAddUpi, setShowAddUpi] = useState(false);
  const [editingBank, setEditingBank] = useState(null);
  const [editingUpi, setEditingUpi] = useState(null);
  const [formData, setFormData] = useState({});

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data } = await axios.get('/api/admin/bank-settings', {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      setSettings(data);
    } catch (error) {
      console.error('Error fetching bank settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddBank = async (e) => {
    e.preventDefault();
    try {
      const { data } = await axios.post('/api/admin/bank-settings/bank-account', formData, {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      setSettings(data);
      setShowAddBank(false);
      setFormData({});
    } catch (error) {
      alert(error.response?.data?.message || 'Error adding bank account');
    }
  };

  const handleUpdateBank = async (id) => {
    try {
      const { data } = await axios.put(`/api/admin/bank-settings/bank-account/${id}`, formData, {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      setSettings(data);
      setEditingBank(null);
      setFormData({});
    } catch (error) {
      alert(error.response?.data?.message || 'Error updating bank account');
    }
  };

  const handleDeleteBank = async (id) => {
    if (!confirm('Are you sure you want to delete this bank account?')) return;
    try {
      const { data } = await axios.delete(`/api/admin/bank-settings/bank-account/${id}`, {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      setSettings(data);
    } catch (error) {
      alert(error.response?.data?.message || 'Error deleting bank account');
    }
  };

  const handleAddUpi = async (e) => {
    e.preventDefault();
    try {
      const { data } = await axios.post('/api/admin/bank-settings/upi-account', formData, {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      setSettings(data);
      setShowAddUpi(false);
      setFormData({});
    } catch (error) {
      alert(error.response?.data?.message || 'Error adding UPI account');
    }
  };

  const handleUpdateUpi = async (id) => {
    try {
      const { data } = await axios.put(`/api/admin/bank-settings/upi-account/${id}`, formData, {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      setSettings(data);
      setEditingUpi(null);
      setFormData({});
    } catch (error) {
      alert(error.response?.data?.message || 'Error updating UPI account');
    }
  };

  const handleDeleteUpi = async (id) => {
    if (!confirm('Are you sure you want to delete this UPI account?')) return;
    try {
      const { data } = await axios.delete(`/api/admin/bank-settings/upi-account/${id}`, {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      setSettings(data);
    } catch (error) {
      alert(error.response?.data?.message || 'Error deleting UPI account');
    }
  };

  const toggleBankStatus = async (id, isActive) => {
    try {
      const { data } = await axios.put(`/api/admin/bank-settings/bank-account/${id}`, { isActive: !isActive }, {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      setSettings(data);
    } catch (error) {
      alert(error.response?.data?.message || 'Error updating bank status');
    }
  };

  const toggleUpiStatus = async (id, isActive) => {
    try {
      const { data } = await axios.put(`/api/admin/bank-settings/upi-account/${id}`, { isActive: !isActive }, {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      setSettings(data);
    } catch (error) {
      alert(error.response?.data?.message || 'Error updating UPI status');
    }
  };

  const setPrimaryBank = async (id) => {
    try {
      const { data } = await axios.put(`/api/admin/bank-settings/bank-account/${id}`, { isPrimary: true }, {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      setSettings(data);
    } catch (error) {
      alert(error.response?.data?.message || 'Error setting primary bank');
    }
  };

  const setPrimaryUpi = async (id) => {
    try {
      const { data } = await axios.put(`/api/admin/bank-settings/upi-account/${id}`, { isPrimary: true }, {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      setSettings(data);
    } catch (error) {
      alert(error.response?.data?.message || 'Error setting primary UPI');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><RefreshCw className="animate-spin" size={32} /></div>;
  }

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-bold mb-6">Bank Management</h1>

      {/* Bank Accounts Section */}
      <div className="bg-dark-800 rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Building2 size={24} />
            Bank Accounts
          </h2>
          <button
            onClick={() => { setShowAddBank(true); setFormData({}); }}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg flex items-center gap-2"
          >
            <Plus size={18} /> Add Bank
          </button>
        </div>

        {settings?.bankAccounts?.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No bank accounts configured</p>
        ) : (
          <div className="space-y-4">
            {settings?.bankAccounts?.map(bank => (
              <div key={bank._id} className={`bg-dark-700 rounded-lg p-4 border-l-4 ${bank.isPrimary ? 'border-green-500' : 'border-dark-600'}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-lg">{bank.bankName}</h3>
                      {bank.isPrimary && <span className="text-xs bg-green-600 px-2 py-0.5 rounded">PRIMARY</span>}
                      {!bank.isActive && <span className="text-xs bg-red-600 px-2 py-0.5 rounded">INACTIVE</span>}
                    </div>
                    <p className="text-gray-400 text-sm mt-1">{bank.accountName}</p>
                    <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Account Number:</span>
                        <span className="ml-2 font-mono">{bank.accountNumber}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">IFSC:</span>
                        <span className="ml-2 font-mono">{bank.ifscCode}</span>
                      </div>
                      {bank.branch && (
                        <div className="col-span-2">
                          <span className="text-gray-500">Branch:</span>
                          <span className="ml-2">{bank.branch}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!bank.isPrimary && (
                      <button
                        onClick={() => setPrimaryBank(bank._id)}
                        className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 rounded"
                      >
                        Set Primary
                      </button>
                    )}
                    <button
                      onClick={() => toggleBankStatus(bank._id, bank.isActive)}
                      className={`px-3 py-1 text-xs rounded ${bank.isActive ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-green-600 hover:bg-green-700'}`}
                    >
                      {bank.isActive ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      onClick={() => { setEditingBank(bank._id); setFormData(bank); }}
                      className="px-3 py-1 text-xs bg-gray-600 hover:bg-gray-700 rounded"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteBank(bank._id)}
                      className="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 rounded"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* UPI Accounts Section */}
      <div className="bg-dark-800 rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <CreditCard size={24} />
            UPI Accounts
          </h2>
          <button
            onClick={() => { setShowAddUpi(true); setFormData({}); }}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg flex items-center gap-2"
          >
            <Plus size={18} /> Add UPI
          </button>
        </div>

        {settings?.upiAccounts?.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No UPI accounts configured</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {settings?.upiAccounts?.map(upi => (
              <div key={upi._id} className={`bg-dark-700 rounded-lg p-4 border-l-4 ${upi.isPrimary ? 'border-green-500' : 'border-dark-600'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{upi.name}</h3>
                    {upi.isPrimary && <span className="text-xs bg-green-600 px-2 py-0.5 rounded">PRIMARY</span>}
                  </div>
                  {!upi.isActive && <span className="text-xs bg-red-600 px-2 py-0.5 rounded">INACTIVE</span>}
                </div>
                <p className="font-mono text-lg text-green-400">{upi.upiId}</p>
                <p className="text-xs text-gray-500 capitalize mt-1">{upi.provider}</p>
                <div className="flex items-center gap-2 mt-3">
                  {!upi.isPrimary && (
                    <button
                      onClick={() => setPrimaryUpi(upi._id)}
                      className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 rounded"
                    >
                      Primary
                    </button>
                  )}
                  <button
                    onClick={() => toggleUpiStatus(upi._id, upi.isActive)}
                    className={`px-2 py-1 text-xs rounded ${upi.isActive ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-green-600 hover:bg-green-700'}`}
                  >
                    {upi.isActive ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    onClick={() => handleDeleteUpi(upi._id)}
                    className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 rounded"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Bank Modal */}
      {showAddBank && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-dark-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">Add Bank Account</h3>
            <form onSubmit={handleAddBank} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Bank Name *</label>
                <input
                  type="text"
                  value={formData.bankName || ''}
                  onChange={(e) => setFormData({...formData, bankName: e.target.value})}
                  className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Account Name *</label>
                <input
                  type="text"
                  value={formData.accountName || ''}
                  onChange={(e) => setFormData({...formData, accountName: e.target.value})}
                  className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Account Number *</label>
                <input
                  type="text"
                  value={formData.accountNumber || ''}
                  onChange={(e) => setFormData({...formData, accountNumber: e.target.value})}
                  className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">IFSC Code *</label>
                <input
                  type="text"
                  value={formData.ifscCode || ''}
                  onChange={(e) => setFormData({...formData, ifscCode: e.target.value.toUpperCase()})}
                  className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Branch</label>
                <input
                  type="text"
                  value={formData.branch || ''}
                  onChange={(e) => setFormData({...formData, branch: e.target.value})}
                  className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isPrimary"
                  checked={formData.isPrimary || false}
                  onChange={(e) => setFormData({...formData, isPrimary: e.target.checked})}
                />
                <label htmlFor="isPrimary" className="text-sm">Set as primary account</label>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="submit" className="flex-1 py-2 bg-green-600 hover:bg-green-700 rounded font-medium">
                  Add Bank
                </button>
                <button type="button" onClick={() => setShowAddBank(false)} className="flex-1 py-2 bg-gray-600 hover:bg-gray-700 rounded font-medium">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add UPI Modal */}
      {showAddUpi && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-dark-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">Add UPI Account</h3>
            <form onSubmit={handleAddUpi} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">UPI ID *</label>
                <input
                  type="text"
                  value={formData.upiId || ''}
                  onChange={(e) => setFormData({...formData, upiId: e.target.value})}
                  placeholder="example@upi"
                  className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Display Name *</label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Provider</label>
                <select
                  value={formData.provider || 'other'}
                  onChange={(e) => setFormData({...formData, provider: e.target.value})}
                  className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2"
                >
                  <option value="gpay">Google Pay</option>
                  <option value="phonepe">PhonePe</option>
                  <option value="paytm">Paytm</option>
                  <option value="bhim">BHIM</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isPrimaryUpi"
                  checked={formData.isPrimary || false}
                  onChange={(e) => setFormData({...formData, isPrimary: e.target.checked})}
                />
                <label htmlFor="isPrimaryUpi" className="text-sm">Set as primary UPI</label>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="submit" className="flex-1 py-2 bg-green-600 hover:bg-green-700 rounded font-medium">
                  Add UPI
                </button>
                <button type="button" onClick={() => setShowAddUpi(false)} className="flex-1 py-2 bg-gray-600 hover:bg-gray-700 rounded font-medium">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Instrument Management (Super Admin only)
const InstrumentManagement = () => {
  const { admin } = useAuth();
  const [instruments, setInstruments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState({ segment: '', category: '', enabled: '', optionType: '' });
  const [seeding, setSeeding] = useState(false);
  const [marketData, setMarketData] = useState({});
  const [zerodhaStatus, setZerodhaStatus] = useState({ connected: false });
  const [pagination, setPagination] = useState({ page: 1, limit: 100, total: 0, pages: 0 });
  const [stats, setStats] = useState({ total: 0, enabled: 0, disabled: 0, featured: 0 });

  useEffect(() => {
    fetchInstruments();
    fetchZerodhaStatus();
    fetchMarketData();
    
    // Refresh market data every 2 seconds
    const interval = setInterval(fetchMarketData, 2000);
    return () => clearInterval(interval);
  }, [filter, pagination.page]);

  const fetchZerodhaStatus = async () => {
    try {
      const { data } = await axios.get('/api/zerodha/status');
      setZerodhaStatus(data);
    } catch (error) {
      console.error('Error fetching Zerodha status:', error);
    }
  };

  const fetchMarketData = async () => {
    try {
      const { data } = await axios.get('/api/zerodha/market-data');
      if (data && Object.keys(data).length > 0) {
        setMarketData(data);
      }
    } catch (error) {
      // Silent fail
    }
  };

  const fetchInstruments = async () => {
    try {
      let url = '/api/instruments/admin?';
      if (filter.segment) url += `segment=${filter.segment}&`;
      if (filter.category) url += `category=${filter.category}&`;
      if (filter.enabled) url += `enabled=${filter.enabled}&`;
      if (search) url += `search=${search}&`;
      url += `page=${pagination.page}&limit=${pagination.limit}`;
      
      const { data } = await axios.get(url, {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      
      // Handle new paginated response format
      if (data.instruments) {
        setInstruments(data.instruments);
        setPagination(prev => ({ ...prev, ...data.pagination }));
        setStats(data.stats);
      } else {
        // Fallback for old format
        setInstruments(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (id) => {
    try {
      await axios.put(`/api/instruments/admin/${id}/toggle`, {}, {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      fetchInstruments();
    } catch (error) {
      alert(error.response?.data?.message || 'Error toggling instrument');
    }
  };

  const handleBulkToggle = async (isEnabled) => {
    const ids = instruments.filter(i => i.isEnabled !== isEnabled).map(i => i._id);
    if (ids.length === 0) return;
    
    try {
      await axios.put('/api/instruments/admin/bulk-toggle', { ids, isEnabled }, {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      fetchInstruments();
    } catch (error) {
      alert(error.response?.data?.message || 'Error');
    }
  };

  const handleSeedDefaults = async () => {
    setSeeding(true);
    try {
      // If Zerodha is connected, use reset-and-sync to get all instruments
      if (zerodhaStatus?.connected) {
        const { data } = await axios.post('/api/zerodha/reset-and-sync', {}, {
          headers: { Authorization: `Bearer ${admin.token}` }
        });
        alert(`Synced ${data.added} instruments from Zerodha!\n\nNSE: ${data.counts?.nse || 0}\nIndices: ${data.counts?.indices || 0}\nNSE F&O: ${data.counts?.nsefo || 0}\nMCX: ${data.counts?.mcx || 0}\nBSE F&O: ${data.counts?.bsefo || 0}\nCurrency: ${data.counts?.currency || 0}`);
      } else {
        // Fallback to basic seed if not connected
        const { data } = await axios.post('/api/instruments/admin/seed-defaults', {}, {
          headers: { Authorization: `Bearer ${admin.token}` }
        });
        alert(data.message + '\n\nNote: Connect to Zerodha to sync all 9000+ instruments.');
      }
      fetchInstruments();
    } catch (error) {
      alert(error.response?.data?.message || 'Error seeding instruments');
    } finally {
      setSeeding(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchInstruments();
  };

  const categories = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'STOCKS', 'INDICES', 'MCX', 'COMMODITY', 'OTHER'];

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Instrument Management</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={`w-2 h-2 rounded-full ${zerodhaStatus.connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
            <span className="text-sm text-gray-400">
              Zerodha: {zerodhaStatus.connected ? `Connected (${zerodhaStatus.userId})` : 'Not Connected'}
            </span>
            {Object.keys(marketData).length > 0 && (
              <span className="text-sm text-green-400 ml-2">• {Object.keys(marketData).length} live prices</span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleSeedDefaults} disabled={seeding} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded text-sm">
            {seeding ? 'Seeding...' : 'Seed Default Instruments'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-dark-800 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <form onSubmit={handleSearch} className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search symbol or name..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-dark-700 border border-dark-600 rounded pl-10 pr-4 py-2"
              />
            </div>
          </form>
          <select
            value={filter.segment}
            onChange={e => setFilter({ ...filter, segment: e.target.value })}
            className="bg-dark-700 border border-dark-600 rounded px-3 py-2"
          >
            <option value="">All Segments</option>
            <option value="NSEFUT">NSEFUT</option>
            <option value="NSEOPT">NSEOPT</option>
            <option value="MCXFUT">MCXFUT</option>
            <option value="MCXOPT">MCXOPT</option>
            <option value="NSE-EQ">NSE-EQ</option>
            <option value="BSE-FUT">BSE-FUT</option>
            <option value="BSE-OPT">BSE-OPT</option>
            <option value="CRYPTO">CRYPTO</option>
          </select>
          <select
            value={filter.category}
            onChange={e => setFilter({ ...filter, category: e.target.value })}
            className="bg-dark-700 border border-dark-600 rounded px-3 py-2"
          >
            <option value="">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={filter.enabled}
            onChange={e => setFilter({ ...filter, enabled: e.target.value })}
            className="bg-dark-700 border border-dark-600 rounded px-3 py-2"
          >
            <option value="">All Status</option>
            <option value="true">Enabled</option>
            <option value="false">Disabled</option>
          </select>
          <select
            value={filter.optionType}
            onChange={e => setFilter({ ...filter, optionType: e.target.value })}
            className="bg-dark-700 border border-dark-600 rounded px-3 py-2"
          >
            <option value="">All Types</option>
            <option value="CE">Calls (CE)</option>
            <option value="PE">Puts (PE)</option>
            <option value="FUT">Futures</option>
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-dark-800 rounded-lg p-4">
          <div className="text-sm text-gray-400">Total</div>
          <div className="text-2xl font-bold">{stats.total || instruments.length}</div>
        </div>
        <div className="bg-dark-800 rounded-lg p-4">
          <div className="text-sm text-gray-400">Enabled</div>
          <div className="text-2xl font-bold text-green-400">{stats.enabled || instruments.filter(i => i.isEnabled).length}</div>
        </div>
        <div className="bg-dark-800 rounded-lg p-4">
          <div className="text-sm text-gray-400">Disabled</div>
          <div className="text-2xl font-bold text-red-400">{stats.disabled || instruments.filter(i => !i.isEnabled).length}</div>
        </div>
        <div className="bg-dark-800 rounded-lg p-4">
          <div className="text-sm text-gray-400">Featured</div>
          <div className="text-2xl font-bold text-yellow-400">{stats.featured || instruments.filter(i => i.isFeatured).length}</div>
        </div>
      </div>

      {/* Bulk Actions */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => handleBulkToggle(true)} className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm">
          Enable All Visible
        </button>
        <button onClick={() => handleBulkToggle(false)} className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm">
          Disable All Visible
        </button>
        <button onClick={fetchInstruments} className="px-3 py-1 bg-dark-600 hover:bg-dark-500 rounded text-sm flex items-center gap-1">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Instruments Table */}
      {loading ? (
        <div className="text-center py-8"><RefreshCw className="animate-spin inline" /></div>
      ) : instruments.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          No instruments found. Click "Seed Default Instruments" to add popular stocks and indices.
        </div>
      ) : (
        <div className="bg-dark-800 rounded-lg overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-dark-700">
              <tr>
                <th className="text-left px-4 py-3 text-gray-400">Symbol</th>
                <th className="text-left px-4 py-3 text-gray-400">Type</th>
                <th className="text-left px-4 py-3 text-gray-400">Category</th>
                <th className="text-right px-4 py-3 text-gray-400">Strike</th>
                <th className="text-right px-4 py-3 text-gray-400">LTP</th>
                <th className="text-right px-4 py-3 text-gray-400">Change</th>
                <th className="text-center px-4 py-3 text-gray-400">Live</th>
                <th className="text-center px-4 py-3 text-gray-400">Status</th>
              </tr>
            </thead>
            <tbody>
              {instruments.map(inst => {
                const liveData = marketData[inst.token] || {};
                const ltp = liveData.ltp || inst.ltp || 0;
                const change = liveData.change || inst.change || 0;
                const changePercent = liveData.changePercent || inst.changePercent || 0;
                const hasLiveData = !!liveData.ltp;
                
                return (
                  <tr key={inst._id} className="border-t border-dark-600 hover:bg-dark-700/50">
                    <td className="px-4 py-3">
                      <div className="font-medium">{inst.symbol}</div>
                      <div className="text-xs text-gray-500">{inst.exchange} • {inst.expiry || 'Spot'}</div>
                    </td>
                    <td className="px-4 py-3">
                      {inst.optionType ? (
                        <span className={`px-2 py-0.5 rounded text-xs ${inst.optionType === 'CE' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                          {inst.optionType}
                        </span>
                      ) : inst.instrumentType === 'FUTURES' ? (
                        <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs">FUT</span>
                      ) : (
                        <span className="px-2 py-0.5 bg-gray-500/20 text-gray-400 rounded text-xs">{inst.instrumentType}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded text-xs">{inst.category}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-400">
                      {inst.strike ? `₹${inst.strike.toLocaleString()}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {ltp > 0 ? `₹${ltp.toLocaleString()}` : '-'}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {changePercent ? `${change >= 0 ? '+' : ''}${parseFloat(changePercent).toFixed(2)}%` : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {hasLiveData ? (
                        <span className="w-2 h-2 bg-green-500 rounded-full inline-block animate-pulse"></span>
                      ) : (
                        <span className="w-2 h-2 bg-gray-600 rounded-full inline-block"></span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleToggle(inst._id)}
                        className={`relative w-12 h-6 rounded-full transition ${inst.isEnabled ? 'bg-green-600' : 'bg-dark-600'}`}
                      >
                        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition ${inst.isEnabled ? 'left-7' : 'left-1'}`}></span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          
          {/* Pagination Controls */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-dark-600">
              <div className="text-sm text-gray-400">
                Showing {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPagination(p => ({ ...p, page: 1 }))}
                  disabled={pagination.page === 1}
                  className="px-3 py-1 bg-dark-600 hover:bg-dark-500 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  First
                </button>
                <button
                  onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                  disabled={pagination.page === 1}
                  className="px-3 py-1 bg-dark-600 hover:bg-dark-500 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Prev
                </button>
                <span className="px-3 py-1 text-sm">
                  Page {pagination.page} of {pagination.pages}
                </span>
                <button
                  onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                  disabled={pagination.page >= pagination.pages}
                  className="px-3 py-1 bg-dark-600 hover:bg-dark-500 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
                <button
                  onClick={() => setPagination(p => ({ ...p, page: pagination.pages }))}
                  disabled={pagination.page >= pagination.pages}
                  className="px-3 py-1 bg-dark-600 hover:bg-dark-500 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Last
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Market Control (Super Admin only)
const MarketControl = () => {
  const { admin } = useAuth();
  const [marketState, setMarketState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [zerodhaStatus, setZerodhaStatus] = useState(null);
  const [editingSegment, setEditingSegment] = useState(null);
  const [segmentForm, setSegmentForm] = useState({});

  useEffect(() => {
    fetchMarketState();
    fetchBrokerStatus();
    
    // Check URL params for Zerodha callback
    const params = new URLSearchParams(window.location.search);
    const zerodhaResult = params.get('zerodha');
    if (zerodhaResult === 'success') {
      window.history.replaceState({}, '', window.location.pathname);
      // Fetch status multiple times to ensure it's updated
      const refreshStatus = async () => {
        for (let i = 0; i < 3; i++) {
          await fetchBrokerStatus();
          await new Promise(r => setTimeout(r, 1000));
        }
        alert('Zerodha connected successfully!');
      };
      refreshStatus();
    } else if (zerodhaResult === 'error') {
      alert('Zerodha connection failed: ' + (params.get('message') || 'Unknown error'));
      window.history.replaceState({}, '', window.location.pathname);
    } else if (zerodhaResult === 'cancelled') {
      alert('Zerodha login was cancelled');
      window.history.replaceState({}, '', window.location.pathname);
    }
    
    // Refresh broker status every 10 seconds
    const interval = setInterval(fetchBrokerStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchBrokerStatus = async () => {
    try {
      const { data } = await axios.get('/api/zerodha/status');
      setZerodhaStatus(data);
    } catch (error) {
      console.error('Error fetching broker status:', error);
    }
  };

  const fetchMarketState = async () => {
    try {
      const { data } = await axios.get('/api/trade/market-state');
      setMarketState(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleMarket = async () => {
    setUpdating(true);
    try {
      const { data } = await axios.put('/api/trade/market-state', {
        isMarketOpen: !marketState.isMarketOpen
      }, {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      setMarketState(data);
    } catch (error) {
      alert(error.response?.data?.message || 'Error updating market state');
    } finally {
      setUpdating(false);
    }
  };

  const toggleSegment = async (segment) => {
    try {
      const { data } = await axios.put(`/api/trade/market-state/segment/${segment}/toggle`, {}, {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      setMarketState(data);
    } catch (error) {
      alert(error.response?.data?.message || 'Error toggling segment');
    }
  };

  const updateSegmentTimings = async (segment) => {
    try {
      const { data } = await axios.put(`/api/trade/market-state/segment/${segment}`, segmentForm, {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      setMarketState(data);
      setEditingSegment(null);
      setSegmentForm({});
    } catch (error) {
      alert(error.response?.data?.message || 'Error updating segment');
    }
  };

  const openEditModal = (segment) => {
    const seg = marketState.segments[segment];
    setSegmentForm({
      dataStartTime: seg.dataStartTime || '09:00',
      tradingStartTime: seg.tradingStartTime || '09:15',
      tradingEndTime: seg.tradingEndTime || '15:30',
      dataEndTime: seg.dataEndTime || '15:30',
      intradaySquareOffTime: seg.intradaySquareOffTime || '15:15',
      preMarketDataOnly: seg.preMarketDataOnly !== false,
      closedDays: seg.closedDays || [0, 6] // Default: Sunday and Saturday closed
    });
    setEditingSegment(segment);
  };

  const toggleClosedDay = (day) => {
    const currentDays = segmentForm.closedDays || [];
    if (currentDays.includes(day)) {
      setSegmentForm({ ...segmentForm, closedDays: currentDays.filter(d => d !== day) });
    } else {
      setSegmentForm({ ...segmentForm, closedDays: [...currentDays, day].sort() });
    }
  };

  const connectZerodha = async () => {
    try {
      const { data } = await axios.get('/api/zerodha/login-url', {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      window.location.href = data.loginUrl;
    } catch (error) {
      alert(error.response?.data?.message || 'Error getting Zerodha login URL');
    }
  };

  const disconnectZerodha = async () => {
    try {
      await axios.post('/api/zerodha/logout', {}, {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      fetchBrokerStatus();
      alert('Zerodha disconnected');
    } catch (error) {
      alert(error.response?.data?.message || 'Error disconnecting Zerodha');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><RefreshCw className="animate-spin" size={32} /></div>;
  }

  const segments = ['EQUITY', 'FNO', 'MCX', 'CRYPTO'];
  const segmentColors = {
    EQUITY: 'blue',
    FNO: 'purple',
    MCX: 'yellow',
    CRYPTO: 'green'
  };

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-bold mb-6">Market Control</h1>

      {/* Broker Connections */}
      <div className="bg-dark-800 rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Zerodha Kite Connect</h2>
        <p className="text-gray-400 text-sm mb-4">Connect to Zerodha Kite API for live market data feed</p>
        
        <div className="grid md:grid-cols-1 gap-4">
          <div className="bg-dark-700 rounded-lg p-4 border border-dark-600">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <TrendingUp className="text-blue-400" size={20} />
                </div>
                <div>
                  <h3 className="font-semibold">Zerodha Kite</h3>
                  <p className="text-xs text-gray-400">Kite Connect API</p>
                </div>
              </div>
              <div className={`px-2 py-1 rounded text-xs ${zerodhaStatus?.connected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                {zerodhaStatus?.connected ? 'Connected' : 'Disconnected'}
              </div>
            </div>
            {zerodhaStatus?.connected ? (
              <>
                <div className="text-xs text-gray-400 mb-3">User ID: {zerodhaStatus.userId}</div>
                <div className="flex gap-2 mb-2">
                  <button onClick={async () => {
                    if (!confirm('This will DELETE all instruments and resync from Zerodha. Continue?')) return;
                    try {
                      const btn = document.activeElement;
                      btn.disabled = true;
                      btn.textContent = 'Resetting...';
                      const { data } = await axios.post('/api/zerodha/reset-and-sync', {}, { headers: { Authorization: `Bearer ${admin.token}` } });
                      const countsStr = Object.entries(data.counts || {}).map(([k, v]) => `${k}: ${v}`).join('\n');
                      alert(`${data.message}\n\nDeleted: ${data.deleted}\n\n${countsStr}\n\nAdded: ${data.added}\nTotal in DB: ${data.totalInDatabase}\nSubscribed: ${data.subscribedTokens}`);
                      btn.disabled = false;
                      btn.textContent = 'Reset & Sync';
                    } catch (error) { 
                      alert(error.response?.data?.message || 'Error resetting'); 
                      const btn = document.activeElement;
                      if (btn) { btn.disabled = false; btn.textContent = 'Reset & Sync'; }
                    }
                  }} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded text-sm disabled:opacity-50">Reset & Sync</button>
                  <button onClick={async () => {
                    try {
                      const btn = document.activeElement;
                      btn.disabled = true;
                      btn.textContent = 'Syncing...';
                      const { data } = await axios.post('/api/zerodha/sync-all-instruments', {}, { headers: { Authorization: `Bearer ${admin.token}` } });
                      alert(`${data.message}\n\nAdded: ${data.added}\nUpdated: ${data.updated}\nTotal in DB: ${data.totalInDatabase}\nSubscribed: ${data.subscribedTokens}`);
                      btn.disabled = false;
                      btn.textContent = 'Sync Popular';
                    } catch (error) { 
                      alert(error.response?.data?.message || 'Error syncing instruments'); 
                      const btn = document.activeElement;
                      if (btn) { btn.disabled = false; btn.textContent = 'Sync Popular'; }
                    }
                  }} className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 rounded text-sm disabled:opacity-50">Sync Popular</button>
                </div>
                <div className="flex gap-2 mb-2">
                  <button onClick={async () => {
                    try {
                      const btn = document.activeElement;
                      btn.disabled = true;
                      btn.textContent = 'Subscribing...';
                      const { data } = await axios.post('/api/zerodha/subscribe-all', {}, { headers: { Authorization: `Bearer ${admin.token}` } });
                      alert(`${data.message}\n\nSubscribed: ${data.subscribed}\nTotal Active: ${data.total}\nRequested: ${data.requested}`);
                      btn.disabled = false;
                      btn.textContent = 'Subscribe All';
                    } catch (error) { 
                      alert(error.response?.data?.message || 'Error subscribing'); 
                      const btn = document.activeElement;
                      if (btn) { btn.disabled = false; btn.textContent = 'Subscribe All'; }
                    }
                  }} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded text-sm disabled:opacity-50">Subscribe All</button>
                  <button onClick={async () => {
                    try {
                      const btn = document.activeElement;
                      btn.disabled = true;
                      btn.textContent = 'Syncing Lots...';
                      const { data } = await axios.post('/api/zerodha/sync-lot-sizes', {}, { headers: { Authorization: `Bearer ${admin.token}` } });
                      alert(`${data.message}\n\nUpdated: ${data.updated}\nNot Found: ${data.notFound}\nTotal: ${data.total}`);
                      btn.disabled = false;
                      btn.textContent = 'Sync Lot Sizes';
                    } catch (error) { 
                      alert(error.response?.data?.message || 'Error syncing lot sizes'); 
                      const btn = document.activeElement;
                      if (btn) { btn.disabled = false; btn.textContent = 'Sync Lot Sizes'; }
                    }
                  }} className="flex-1 bg-orange-600 hover:bg-orange-700 text-white py-2 rounded text-sm disabled:opacity-50">Sync Lot Sizes</button>
                </div>
                <div className="flex gap-2 mb-2">
                  <button onClick={async () => {
                    try {
                      const { data } = await axios.get('/api/zerodha/subscription-status', { headers: { Authorization: `Bearer ${admin.token}` } });
                      alert(`WebSocket: ${data.connected ? 'Connected' : 'Disconnected'}\nSubscribed Tokens: ${data.subscribedTokens}\nTotal Enabled: ${data.totalEnabledInstruments}\nAll Subscribed: ${data.allSubscribed ? 'Yes' : 'No'}`);
                    } catch (error) { alert(error.response?.data?.message || 'Error fetching status'); }
                  }} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded text-sm">Check Status</button>
                  <button onClick={async () => {
                    try {
                      const btn = document.activeElement;
                      btn.disabled = true;
                      btn.textContent = 'Fetching...';
                      const { data } = await axios.post('/api/zerodha/historical-bulk', { interval: '15minute' }, { headers: { Authorization: `Bearer ${admin.token}` } });
                      alert(`${data.message}\n\nSuccess: ${data.success}\nErrors: ${data.errors}`);
                      btn.disabled = false;
                      btn.textContent = 'Fetch Historical';
                    } catch (error) { 
                      alert(error.response?.data?.message || 'Error fetching historical data'); 
                      const btn = document.activeElement;
                      if (btn) { btn.disabled = false; btn.textContent = 'Fetch Historical'; }
                    }
                  }} className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white py-2 rounded text-sm disabled:opacity-50">Fetch Historical</button>
                </div>
                <button onClick={disconnectZerodha} className="w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded text-sm">Disconnect</button>
              </>
            ) : (
              <button onClick={connectZerodha} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded text-sm">Connect to Kite</button>
            )}
          </div>
        </div>

        <div className="mt-4 p-3 bg-dark-700 rounded-lg border border-dark-600">
          <h4 className="text-sm font-medium mb-2">Kite Connect Redirect URL</h4>
          <p className="text-xs text-gray-400 mb-2">Add this URL in your Kite Connect app settings:</p>
          <code className="block bg-dark-900 p-2 rounded text-xs text-green-400 break-all">
            {window.location.origin.replace(':3000', ':5001')}/api/zerodha/callback
          </code>
        </div>
      </div>

      {/* Main Market Switch */}
      <div className="bg-dark-800 rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Global Market Status</h2>
            <p className="text-gray-400 text-sm mt-1">
              {marketState?.isMarketOpen ? 'Market is OPEN - Trading is allowed' : 'Market is CLOSED - Trading is disabled'}
            </p>
          </div>
          <button
            onClick={toggleMarket}
            disabled={updating}
            className={`px-8 py-4 rounded-lg text-lg font-bold transition ${marketState?.isMarketOpen ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
          >
            {updating ? 'Updating...' : marketState?.isMarketOpen ? 'CLOSE MARKET' : 'OPEN MARKET'}
          </button>
        </div>
        <div className="mt-6 flex items-center gap-4">
          <div className={`w-4 h-4 rounded-full ${marketState?.isMarketOpen ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
          <span className={`text-lg font-bold ${marketState?.isMarketOpen ? 'text-green-400' : 'text-red-400'}`}>
            {marketState?.isMarketOpen ? 'MARKET OPEN' : 'MARKET CLOSED'}
          </span>
        </div>
      </div>

      {/* Segment-wise Timing Controls */}
      <div className="bg-dark-800 rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Segment Timings</h2>
        <p className="text-gray-400 text-sm mb-4">
          Configure market data and trading hours for each segment. Data can start before trading hours (pre-market data only mode).
        </p>
        
        <div className="grid md:grid-cols-2 gap-4">
          {segments.map(segment => {
            const seg = marketState?.segments?.[segment] || {};
            const color = segmentColors[segment];
            return (
              <div key={segment} className={`bg-dark-700 rounded-lg p-4 border ${seg.isOpen ? `border-${color}-500/50` : 'border-dark-600'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`font-bold text-${color}-400`}>{segment}</span>
                    <span className={`px-2 py-0.5 rounded text-xs ${seg.isOpen ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      {seg.isOpen ? 'OPEN' : 'CLOSED'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEditModal(segment)}
                      className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs"
                    >
                      Edit Timings
                    </button>
                    <button
                      onClick={() => toggleSegment(segment)}
                      className={`px-2 py-1 rounded text-xs ${seg.isOpen ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
                    >
                      {seg.isOpen ? 'Close' : 'Open'}
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-dark-800 rounded p-2">
                    <div className="text-gray-500">Data Start</div>
                    <div className="font-mono text-blue-400">{seg.dataStartTime || '09:00'}</div>
                  </div>
                  <div className="bg-dark-800 rounded p-2">
                    <div className="text-gray-500">Trading Start</div>
                    <div className="font-mono text-green-400">{seg.tradingStartTime || '09:15'}</div>
                  </div>
                  <div className="bg-dark-800 rounded p-2">
                    <div className="text-gray-500">Trading End</div>
                    <div className="font-mono text-red-400">{seg.tradingEndTime || '15:30'}</div>
                  </div>
                  <div className="bg-dark-800 rounded p-2">
                    <div className="text-gray-500">Data End</div>
                    <div className="font-mono text-purple-400">{seg.dataEndTime || '15:30'}</div>
                  </div>
                </div>
                
                <div className="mt-2 text-xs text-gray-500">
                  Square-off: {seg.intradaySquareOffTime || '15:15'} | 
                  Pre-market data: {seg.preMarketDataOnly !== false ? 'Yes' : 'No'}
                </div>
                <div className="mt-2 flex items-center gap-1">
                  <span className="text-xs text-gray-500">Closed:</span>
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                    <span
                      key={index}
                      className={`w-5 h-5 flex items-center justify-center rounded text-xs ${
                        (seg.closedDays || [0, 6]).includes(index)
                          ? 'bg-red-600/30 text-red-400'
                          : 'bg-dark-600 text-gray-500'
                      }`}
                    >
                      {day}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div className="bg-dark-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 text-blue-400">Pre-Market Data Mode</h3>
          <ul className="space-y-2 text-sm text-gray-300">
            <li>📊 Market data is visible to users</li>
            <li>❌ Trading is NOT allowed</li>
            <li>⏰ Active between Data Start and Trading Start times</li>
            <li>💡 Users can analyze market before trading begins</li>
          </ul>
        </div>

        <div className="bg-dark-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 text-green-400">Trading Hours</h3>
          <ul className="space-y-2 text-sm text-gray-300">
            <li>✅ Full trading allowed</li>
            <li>📊 Market data visible</li>
            <li>⏰ Active between Trading Start and Trading End</li>
            <li>🔄 Auto square-off at configured time</li>
          </ul>
        </div>
      </div>

      {/* Last Updated */}
      {marketState?.lastUpdatedAt && (
        <div className="text-sm text-gray-500">
          Last updated: {new Date(marketState.lastUpdatedAt).toLocaleString()}
        </div>
      )}

      {/* Edit Segment Modal */}
      {editingSegment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 rounded-lg w-full max-w-md p-6">
            <div className="flex justify-between mb-4">
              <h2 className="text-xl font-bold">Edit {editingSegment} Timings</h2>
              <button onClick={() => setEditingSegment(null)}><X size={24} /></button>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Data Start Time</label>
                  <input
                    type="time"
                    value={segmentForm.dataStartTime}
                    onChange={e => setSegmentForm({...segmentForm, dataStartTime: e.target.value})}
                    className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">When market data becomes visible</p>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Trading Start Time</label>
                  <input
                    type="time"
                    value={segmentForm.tradingStartTime}
                    onChange={e => setSegmentForm({...segmentForm, tradingStartTime: e.target.value})}
                    className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">When trading is allowed</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Trading End Time</label>
                  <input
                    type="time"
                    value={segmentForm.tradingEndTime}
                    onChange={e => setSegmentForm({...segmentForm, tradingEndTime: e.target.value})}
                    className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">When trading stops</p>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Data End Time</label>
                  <input
                    type="time"
                    value={segmentForm.dataEndTime}
                    onChange={e => setSegmentForm({...segmentForm, dataEndTime: e.target.value})}
                    className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">When market data stops</p>
                </div>
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">Intraday Square-off Time</label>
                <input
                  type="time"
                  value={segmentForm.intradaySquareOffTime}
                  onChange={e => setSegmentForm({...segmentForm, intradaySquareOffTime: e.target.value})}
                  className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2"
                />
                <p className="text-xs text-gray-500 mt-1">Auto square-off intraday positions</p>
              </div>
              
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="preMarketDataOnly"
                  checked={segmentForm.preMarketDataOnly}
                  onChange={e => setSegmentForm({...segmentForm, preMarketDataOnly: e.target.checked})}
                  className="w-4 h-4"
                />
                <label htmlFor="preMarketDataOnly" className="text-sm text-gray-400">
                  Enable pre-market data only mode (show data but no trading before trading start)
                </label>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Closed Days (Market closed on these days)</label>
                <div className="flex flex-wrap gap-2">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleClosedDay(index)}
                      className={`px-3 py-1.5 rounded text-sm font-medium transition ${
                        (segmentForm.closedDays || []).includes(index)
                          ? 'bg-red-600 text-white'
                          : 'bg-dark-600 text-gray-400 hover:bg-dark-500'
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">Click to toggle. Red = Market closed on that day</p>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button onClick={() => setEditingSegment(null)} className="flex-1 bg-dark-600 py-2 rounded">Cancel</button>
                <button onClick={() => updateSegmentTimings(editingSegment)} className="flex-1 bg-green-600 hover:bg-green-700 py-2 rounded">Save Timings</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// All Trades (Admin - shows trades for their users with 4 tabs like SuperAdmin)
const AllTrades = () => {
  const { admin } = useAuth();
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('open');
  const [searchTerm, setSearchTerm] = useState('');
  const [editModal, setEditModal] = useState({ show: false, trade: null });
  const [editForm, setEditForm] = useState({ quantity: '', entryPrice: '', exitPrice: '' });
  const [marketData, setMarketData] = useState({});
  const socketRef = useRef(null);

  // Separate trades by status
  const openTrades = trades.filter(t => t.status === 'OPEN');
  const closedTrades = trades.filter(t => t.status === 'CLOSED');
  const pendingTrades = trades.filter(t => t.status === 'PENDING' || t.status === 'TRIGGERED');
  const rejectedTrades = trades.filter(t => t.status === 'CANCELLED' || t.status === 'REJECTED');

  // Calculate totals
  const totalOpenPnL = openTrades.reduce((sum, t) => sum + (t.unrealizedPnL || 0), 0);
  const totalClosedPnL = closedTrades.reduce((sum, t) => sum + (t.netPnL || 0), 0);
  const totalBrokerage = trades.reduce((sum, t) => sum + (t.charges?.brokerage || t.charges?.total || 0), 0);

  // Pagination for active tab
  const currentTrades = activeTab === 'open' ? openTrades 
    : activeTab === 'closed' ? closedTrades 
    : activeTab === 'pending' ? pendingTrades 
    : rejectedTrades;
  const { currentPage, setCurrentPage, totalPages, paginatedData, totalItems } = usePagination(
    currentTrades, 20, searchTerm, ['symbol', 'userId', 'user.username', 'user.fullName', 'tradeId']
  );

  useEffect(() => {
    fetchTrades();
    
    // Connect to Socket.IO for live market data
    const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
    socketRef.current = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });
    
    socketRef.current.on('connect', () => {
      console.log('Admin AllTrades: Connected to Socket.IO for live market data');
    });
    
    // Live ticks
    socketRef.current.on('market_tick', (data) => {
      setMarketData(prev => ({ ...prev, ...data }));
    });
    
    // Auto-refresh when new trades are created or closed
    socketRef.current.on('trade_update', (data) => {
      console.log('Admin AllTrades: Trade update received', data.type);
      fetchTrades();
    });
    
    socketRef.current.on('disconnect', () => {
      console.log('Admin AllTrades: Disconnected from Socket.IO');
    });
    
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);
  
  // Update P&L in real-time when market data changes (use bid/ask per side)
  useEffect(() => {
    if (Object.keys(marketData).length === 0) return;
    
    setTrades(prevTrades => prevTrades.map(trade => {
      if (trade.status !== 'OPEN') return trade;
      
      // Try multiple token formats for matching
      const tokenStr = trade.token?.toString();
      const liveData = marketData[tokenStr] || marketData[trade.token] || marketData[parseInt(trade.token)];
      if (!liveData) return trade;
      
      // Align with user view: BUY uses best bid, SELL uses best ask
      const sidePrice = trade.side === 'BUY'
        ? (liveData.bid ?? liveData.ltp ?? liveData.last_price)
        : (liveData.ask ?? liveData.ltp ?? liveData.last_price);
      if (!sidePrice) return trade;
      
      // Calculate unrealized P&L with side-specific price
      const currentPrice = sidePrice;
      const multiplier = trade.side === 'BUY' ? 1 : -1;
      const priceDiff = (currentPrice - trade.entryPrice) * multiplier;
      const unrealizedPnL = priceDiff * trade.quantity * (trade.lotSize || 1);
      
      return {
        ...trade,
        currentPrice,
        unrealizedPnL
      };
    }));
  }, [marketData]);

  const fetchTrades = async () => {
    try {
      const { data } = await axios.get('/api/trade/admin/trades', {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      setTrades(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = async (trade) => {
    const exitPrice = prompt('Enter exit price:', trade.currentPrice || trade.entryPrice);
    if (!exitPrice) return;
    
    try {
      await axios.post(`/api/trade/admin/trade/${trade._id}/close`, {
        exitPrice: Number(exitPrice)
      }, {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      fetchTrades();
    } catch (error) {
      alert(error.response?.data?.message || 'Error closing trade');
    }
  };

  const handleDelete = async (tradeId) => {
    if (!confirm('Are you sure you want to delete this trade?')) return;
    
    try {
      await axios.delete(`/api/trade/admin/trade/${tradeId}`, {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      fetchTrades();
    } catch (error) {
      alert(error.response?.data?.message || 'Error deleting trade');
    }
  };

  const openEditModal = (trade) => {
    setEditForm({
      quantity: trade.quantity,
      entryPrice: trade.entryPrice,
      exitPrice: trade.exitPrice || ''
    });
    setEditModal({ show: true, trade });
  };

  const handleSaveEdit = async () => {
    try {
      await axios.put(`/api/trade/admin/trade/${editModal.trade._id}`, {
        quantity: Number(editForm.quantity),
        entryPrice: Number(editForm.entryPrice),
        exitPrice: editForm.exitPrice ? Number(editForm.exitPrice) : undefined
      }, {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      setEditModal({ show: false, trade: null });
      fetchTrades();
    } catch (error) {
      alert(error.response?.data?.message || 'Error updating trade');
    }
  };

  const handleReopen = async (trade) => {
    if (!confirm('Reopen this position?')) return;
    
    try {
      await axios.post(`/api/trade/admin/trade/${trade._id}/reopen`, {}, {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      fetchTrades();
    } catch (error) {
      alert(error.response?.data?.message || 'Error reopening trade');
    }
  };

  const formatDuration = (entryTime, exitTime) => {
    if (!entryTime || !exitTime) return '-';
    const diff = new Date(exitTime) - new Date(entryTime);
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${days}d ${hours}h ${mins}m`;
  };

  const formatDateTime = (date) => {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleString('en-IN', { 
      day: '2-digit', month: 'short', year: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: true 
    });
  };

  return (
    <div className="p-4 md:p-6">
      {/* Header with Admin Info and PNL Summary */}
      <div className="bg-dark-800 rounded-lg p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4 md:gap-8">
          <div className="flex items-center gap-2">
            <Shield className="text-purple-400" size={20} />
            <span className="text-lg font-bold text-purple-400">{admin?.username || admin?.name}</span>
            {Object.keys(marketData).length > 0 && (
              <span className="flex items-center gap-1 text-xs text-green-400">
                <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
                Live ({Object.keys(marketData).length})
              </span>
            )}
          </div>
          
          <button
            onClick={() => setActiveTab('open')}
            className={`px-4 py-2 rounded-lg border-2 transition ${
              activeTab === 'open' ? 'border-purple-500 bg-purple-500/10' : 'border-dark-600 hover:border-dark-500'
            }`}
          >
            <div className="text-xs text-gray-400">Open PNL</div>
            <div className={`text-lg font-bold ${totalOpenPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {totalOpenPnL >= 0 ? '+' : ''}₹{totalOpenPnL.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
          </button>
          
          <button
            onClick={() => setActiveTab('closed')}
            className={`px-4 py-2 rounded-lg border-2 transition ${
              activeTab === 'closed' ? 'border-purple-500 bg-purple-500/10' : 'border-dark-600 hover:border-dark-500'
            }`}
          >
            <div className="text-xs text-gray-400">Closed PNL</div>
            <div className={`text-lg font-bold ${totalClosedPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {totalClosedPnL >= 0 ? '+' : ''}₹{totalClosedPnL.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
          </button>

          <div className="px-4 py-2 rounded-lg border-2 border-dark-600">
            <div className="text-xs text-gray-400">Total Brokerage</div>
            <div className="text-lg font-bold text-purple-400">
              ₹{totalBrokerage.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
          </div>

          <button onClick={fetchTrades} className="ml-auto p-2 bg-dark-700 hover:bg-dark-600 rounded-lg" title="Refresh">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Position Tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => { setActiveTab('open'); setCurrentPage(1); }}
          className={`px-4 py-2 rounded-lg font-medium transition text-sm ${
            activeTab === 'open' ? 'bg-purple-600 text-white' : 'bg-dark-700 text-gray-400 hover:bg-dark-600'
          }`}
        >
          Open Position ({openTrades.length})
        </button>
        <button
          onClick={() => { setActiveTab('closed'); setCurrentPage(1); }}
          className={`px-4 py-2 rounded-lg font-medium transition text-sm ${
            activeTab === 'closed' ? 'bg-purple-600 text-white' : 'bg-dark-700 text-gray-400 hover:bg-dark-600'
          }`}
        >
          Closed Position ({closedTrades.length})
        </button>
        <button
          onClick={() => { setActiveTab('pending'); setCurrentPage(1); }}
          className={`px-4 py-2 rounded-lg font-medium transition text-sm ${
            activeTab === 'pending' ? 'bg-purple-600 text-white' : 'bg-dark-700 text-gray-400 hover:bg-dark-600'
          }`}
        >
          Pending Orders ({pendingTrades.length})
        </button>
        <button
          onClick={() => { setActiveTab('rejected'); setCurrentPage(1); }}
          className={`px-4 py-2 rounded-lg font-medium transition text-sm ${
            activeTab === 'rejected' ? 'bg-purple-600 text-white' : 'bg-dark-700 text-gray-400 hover:bg-dark-600'
          }`}
        >
          Rejected Orders ({rejectedTrades.length})
        </button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search by User ID, Script..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-dark-700 border border-dark-600 rounded-lg pl-10 pr-4 py-2"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8"><RefreshCw className="animate-spin inline" /></div>
      ) : totalItems === 0 ? (
        <div className="text-center py-8 text-gray-400">No {activeTab} positions found</div>
      ) : (
        <>
          {/* Open Position Table */}
          {activeTab === 'open' && (
            <div className="bg-dark-800 rounded-lg overflow-hidden overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-dark-700">
                  <tr>
                    <th className="text-left px-3 py-3 text-gray-400">UserID</th>
                    <th className="text-left px-3 py-3 text-gray-400">Script</th>
                    <th className="text-center px-3 py-3 text-gray-400">B/S</th>
                    <th className="text-right px-3 py-3 text-gray-400">Qty</th>
                    <th className="text-left px-3 py-3 text-gray-400">Entry Time</th>
                    <th className="text-right px-3 py-3 text-gray-400">Entry</th>
                    <th className="text-right px-3 py-3 text-gray-400">LTP</th>
                    <th className="text-right px-3 py-3 text-gray-400">PNL</th>
                    <th className="text-center px-3 py-3 text-gray-400">Close</th>
                    <th className="text-center px-3 py-3 text-gray-400">Edit</th>
                    <th className="text-center px-3 py-3 text-gray-400">Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map(trade => {
                    const pnl = trade.unrealizedPnL || 0;
                    return (
                      <tr key={trade._id} className="border-t border-dark-600 hover:bg-dark-700/50">
                        <td className="px-3 py-3">
                          <div className="font-mono text-xs">{trade.userId}</div>
                          <div className="text-xs text-gray-400">{trade.user?.fullName || trade.user?.username || '-'}</div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-medium">{trade.symbol}</div>
                          <div className="text-xs text-gray-500">{trade.segment} • {trade.productType}</div>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${trade.side === 'BUY' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                            {trade.side}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right">{trade.quantity}</td>
                        <td className="px-3 py-3 text-xs">{formatDateTime(trade.openedAt)}</td>
                        <td className="px-3 py-3 text-right">₹{trade.entryPrice?.toFixed(2)}</td>
                        <td className="px-3 py-3 text-right">₹{(trade.currentPrice || trade.entryPrice)?.toFixed(2)}</td>
                        <td className={`px-3 py-3 text-right font-bold ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {pnl >= 0 ? '+' : ''}₹{pnl.toFixed(2)}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <button onClick={() => handleClose(trade)} className="px-2 py-1 bg-orange-600 hover:bg-orange-700 rounded text-xs">Close</button>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <button onClick={() => openEditModal(trade)} className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs">Edit</button>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <button onClick={() => handleDelete(trade._id)} className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs">Delete</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Closed Position Table */}
          {activeTab === 'closed' && (
            <div className="bg-dark-800 rounded-lg overflow-hidden overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-dark-700">
                  <tr>
                    <th className="text-left px-2 py-3 text-gray-400">UserID</th>
                    <th className="text-left px-2 py-3 text-gray-400">Script</th>
                    <th className="text-center px-2 py-3 text-gray-400">B/S</th>
                    <th className="text-right px-2 py-3 text-gray-400">Qty</th>
                    <th className="text-left px-2 py-3 text-gray-400">Entry Time</th>
                    <th className="text-right px-2 py-3 text-gray-400">Entry</th>
                    <th className="text-right px-2 py-3 text-gray-400">Entry BKG</th>
                    <th className="text-left px-2 py-3 text-gray-400">Exit Time</th>
                    <th className="text-right px-2 py-3 text-gray-400">Exit</th>
                    <th className="text-right px-2 py-3 text-gray-400">Exit BKG</th>
                    <th className="text-right px-2 py-3 text-gray-400">Gross PNL</th>
                    <th className="text-right px-2 py-3 text-gray-400">Net PNL</th>
                    <th className="text-right px-2 py-3 text-gray-400">BKG</th>
                    <th className="text-left px-2 py-3 text-gray-400">Duration</th>
                    <th className="text-center px-2 py-3 text-gray-400">Delete</th>
                    <th className="text-center px-2 py-3 text-gray-400">Edit</th>
                    <th className="text-center px-2 py-3 text-gray-400">Reopen</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map(trade => {
                    const grossPnL = trade.realizedPnL || trade.pnl || 0;
                    const totalBkg = trade.charges?.total || trade.charges?.brokerage || 0;
                    const netPnL = trade.netPnL || (grossPnL - totalBkg);
                    const entryBkg = (trade.charges?.brokerage || 0) / 2;
                    const exitBkg = (trade.charges?.brokerage || 0) / 2;
                    return (
                      <tr key={trade._id} className="border-t border-dark-600 hover:bg-dark-700/50">
                        <td className="px-2 py-3">
                          <div className="font-mono text-xs">{trade.userId}</div>
                          <div className="text-xs text-gray-400">{trade.user?.fullName || trade.user?.username || '-'}</div>
                        </td>
                        <td className="px-2 py-3">
                          <div className="font-medium text-xs">{trade.symbol}</div>
                          <div className="text-xs text-gray-500">{trade.segment}</div>
                        </td>
                        <td className="px-2 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${trade.side === 'BUY' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                            {trade.side}
                          </span>
                        </td>
                        <td className="px-2 py-3 text-right text-xs">{trade.quantity}</td>
                        <td className="px-2 py-3 text-xs">{formatDateTime(trade.openedAt)}</td>
                        <td className="px-2 py-3 text-right text-xs">₹{trade.entryPrice?.toFixed(2)}</td>
                        <td className="px-2 py-3 text-right text-xs text-gray-400">₹{entryBkg.toFixed(2)}</td>
                        <td className="px-2 py-3 text-xs">{formatDateTime(trade.closedAt)}</td>
                        <td className="px-2 py-3 text-right text-xs">₹{trade.exitPrice?.toFixed(2)}</td>
                        <td className="px-2 py-3 text-right text-xs text-gray-400">₹{exitBkg.toFixed(2)}</td>
                        <td className={`px-2 py-3 text-right text-xs font-bold ${grossPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {grossPnL >= 0 ? '+' : ''}₹{grossPnL.toFixed(2)}
                        </td>
                        <td className={`px-2 py-3 text-right text-xs font-bold ${netPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {netPnL >= 0 ? '+' : ''}₹{netPnL.toFixed(2)}
                        </td>
                        <td className="px-2 py-3 text-right text-xs text-purple-400">₹{totalBkg.toFixed(2)}</td>
                        <td className="px-2 py-3 text-xs text-gray-400">{formatDuration(trade.openedAt, trade.closedAt)}</td>
                        <td className="px-2 py-3 text-center">
                          <button onClick={() => handleDelete(trade._id)} className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs">Delete</button>
                        </td>
                        <td className="px-2 py-3 text-center">
                          <button onClick={() => openEditModal(trade)} className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs">Edit</button>
                        </td>
                        <td className="px-2 py-3 text-center">
                          <button onClick={() => handleReopen(trade)} className="px-2 py-1 bg-green-600 hover:bg-green-700 rounded text-xs">Reopen</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pending Orders Table */}
          {activeTab === 'pending' && (
            <div className="bg-dark-800 rounded-lg overflow-hidden overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-dark-700">
                  <tr>
                    <th className="text-left px-3 py-3 text-gray-400">UserID</th>
                    <th className="text-left px-3 py-3 text-gray-400">Trade Type</th>
                    <th className="text-left px-3 py-3 text-gray-400">Time</th>
                    <th className="text-left px-3 py-3 text-gray-400">Type</th>
                    <th className="text-left px-3 py-3 text-gray-400">Script</th>
                    <th className="text-right px-3 py-3 text-gray-400">Quantity</th>
                    <th className="text-right px-3 py-3 text-gray-400">Average Price</th>
                    <th className="text-center px-3 py-3 text-gray-400">Edit</th>
                    <th className="text-center px-3 py-3 text-gray-400">Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map(trade => (
                    <tr key={trade._id} className="border-t border-dark-600 hover:bg-dark-700/50">
                      <td className="px-3 py-3">
                        <div className="font-mono text-xs">{trade.userId}</div>
                        <div className="text-xs text-gray-400">{trade.user?.fullName || trade.user?.username || '-'}</div>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${trade.side === 'BUY' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                          {trade.side}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs">{formatDateTime(trade.createdAt || trade.openedAt)}</td>
                      <td className="px-3 py-3">
                        <div className="text-xs">{trade.productType}</div>
                        <div className="text-xs text-gray-500">{trade.orderType}</div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-medium">{trade.symbol}</div>
                        <div className="text-xs text-gray-500">{trade.segment}</div>
                      </td>
                      <td className="px-3 py-3 text-right">{trade.quantity}</td>
                      <td className="px-3 py-3 text-right">₹{(trade.limitPrice || trade.entryPrice)?.toFixed(2)}</td>
                      <td className="px-3 py-3 text-center">
                        <button onClick={() => openEditModal(trade)} className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs">Edit</button>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <button onClick={() => handleDelete(trade._id)} className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Rejected Orders Table */}
          {activeTab === 'rejected' && (
            <div className="bg-dark-800 rounded-lg overflow-hidden overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-dark-700">
                  <tr>
                    <th className="text-left px-3 py-3 text-gray-400">UserID</th>
                    <th className="text-left px-3 py-3 text-gray-400">Trade Type</th>
                    <th className="text-left px-3 py-3 text-gray-400">Time</th>
                    <th className="text-left px-3 py-3 text-gray-400">Type</th>
                    <th className="text-left px-3 py-3 text-gray-400">Script</th>
                    <th className="text-right px-3 py-3 text-gray-400">Quantity</th>
                    <th className="text-right px-3 py-3 text-gray-400">Rate</th>
                    <th className="text-left px-3 py-3 text-gray-400">Reason</th>
                    <th className="text-center px-3 py-3 text-gray-400">Edit</th>
                    <th className="text-center px-3 py-3 text-gray-400">Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map(trade => (
                    <tr key={trade._id} className="border-t border-dark-600 hover:bg-dark-700/50">
                      <td className="px-3 py-3">
                        <div className="font-mono text-xs">{trade.userId}</div>
                        <div className="text-xs text-gray-400">{trade.user?.fullName || trade.user?.username || '-'}</div>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${trade.side === 'BUY' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                          {trade.side}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs">
                        <div>{formatDateTime(trade.createdAt || trade.openedAt)}</div>
                        {trade.closedAt && <div className="text-red-400">{formatDateTime(trade.closedAt)}</div>}
                      </td>
                      <td className="px-3 py-3">
                        <div className="text-xs">{trade.productType}</div>
                        <div className="text-xs text-gray-500">{trade.orderType}</div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-medium">{trade.symbol}</div>
                        <div className="text-xs text-gray-500">{trade.segment}</div>
                      </td>
                      <td className="px-3 py-3 text-right">{trade.quantity}</td>
                      <td className="px-3 py-3 text-right">₹{(trade.limitPrice || trade.entryPrice)?.toFixed(2)}</td>
                      <td className="px-3 py-3 text-xs">
                        <span className={`px-2 py-0.5 rounded ${trade.status === 'CANCELLED' ? 'bg-gray-500/20 text-gray-400' : 'bg-red-500/20 text-red-400'}`}>
                          {trade.closeReason || trade.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <button onClick={() => openEditModal(trade)} className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs">Edit</button>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <button onClick={() => handleDelete(trade._id)} className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalItems={totalItems}
            itemsPerPage={20}
          />
        </>
      )}

      {/* Edit Modal */}
      {editModal.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-dark-800 rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Edit Trade</h3>
              <button onClick={() => setEditModal({ show: false, trade: null })} className="text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Quantity</label>
                <input
                  type="number"
                  value={editForm.quantity}
                  onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
                  className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Entry Price</label>
                <input
                  type="number"
                  step="0.01"
                  value={editForm.entryPrice}
                  onChange={(e) => setEditForm({ ...editForm, entryPrice: e.target.value })}
                  className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2"
                />
              </div>
              {editModal.trade?.status === 'CLOSED' && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Exit Price</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.exitPrice}
                    onChange={(e) => setEditForm({ ...editForm, exitPrice: e.target.value })}
                    className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2"
                  />
                </div>
              )}
            </div>
            
            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditModal({ show: false, trade: null })} className="flex-1 px-4 py-2 bg-dark-600 hover:bg-dark-500 rounded-lg">
                Cancel
              </button>
              <button onClick={handleSaveEdit} className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg">
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Admin Position Management (Admin only - shows trades for their users)
const TradeManagement = () => {
  const { admin } = useAuth();
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('open');
  const [searchTerm, setSearchTerm] = useState('');
  const [editModal, setEditModal] = useState({ show: false, trade: null });
  const [editForm, setEditForm] = useState({ quantity: '', entryPrice: '', exitPrice: '' });
  const [marketData, setMarketData] = useState({});
  const socketRef = useRef(null);

  // Separate trades by status
  const openTrades = trades.filter(t => t.status === 'OPEN');
  const closedTrades = trades.filter(t => t.status === 'CLOSED');
  const pendingTrades = trades.filter(t => t.status === 'PENDING' || t.status === 'TRIGGERED');
  const rejectedTrades = trades.filter(t => t.status === 'CANCELLED' || t.status === 'REJECTED');

  // Calculate totals
  const totalOpenPnL = openTrades.reduce((sum, t) => sum + (t.unrealizedPnL || 0), 0);
  const totalClosedPnL = closedTrades.reduce((sum, t) => sum + (t.netPnL || 0), 0);
  const totalBrokerage = trades.reduce((sum, t) => sum + (t.charges?.brokerage || t.charges?.total || 0), 0);

  // Pagination for active tab
  const currentTrades = activeTab === 'open' ? openTrades 
    : activeTab === 'closed' ? closedTrades 
    : activeTab === 'pending' ? pendingTrades 
    : rejectedTrades;
  const { currentPage, setCurrentPage, totalPages, paginatedData, totalItems } = usePagination(
    currentTrades, 20, searchTerm, ['symbol', 'userId', 'user.username', 'user.fullName', 'tradeId']
  );

  useEffect(() => {
    fetchTrades();
    
    // Connect to Socket.IO for live market data
    const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
    socketRef.current = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });
    
    socketRef.current.on('connect', () => {
      console.log('Admin: Connected to Socket.IO for live market data');
    });
    
    // Live ticks
    socketRef.current.on('market_tick', (data) => {
      setMarketData(prev => ({ ...prev, ...data }));
    });
    
    socketRef.current.on('disconnect', () => {
      console.log('Admin: Disconnected from Socket.IO');
    });
    
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);
  
  // Update P&L in real-time when market data changes (use bid/ask per side)
  useEffect(() => {
    if (Object.keys(marketData).length === 0) return;
    
    setTrades(prevTrades => prevTrades.map(trade => {
      if (trade.status !== 'OPEN') return trade;
      
      // Try multiple token formats for matching
      const tokenStr = trade.token?.toString();
      const liveData = marketData[tokenStr] || marketData[trade.token] || marketData[parseInt(trade.token)];
      if (!liveData) return trade;
      
      // Align with user view: BUY uses best bid, SELL uses best ask
      const sidePrice = trade.side === 'BUY'
        ? (liveData.bid ?? liveData.ltp ?? liveData.last_price)
        : (liveData.ask ?? liveData.ltp ?? liveData.last_price);
      if (!sidePrice) return trade;
      
      // Calculate unrealized P&L with side-specific price
      const currentPrice = sidePrice;
      const multiplier = trade.side === 'BUY' ? 1 : -1;
      const priceDiff = (currentPrice - trade.entryPrice) * multiplier;
      const unrealizedPnL = priceDiff * trade.quantity * (trade.lotSize || 1);
      
      return {
        ...trade,
        currentPrice,
        unrealizedPnL
      };
    }));
  }, [marketData]);

  const fetchTrades = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get('/api/trade/admin/trades', {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      setTrades(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = async (trade) => {
    const exitPrice = prompt('Enter exit price:', trade.currentPrice || trade.entryPrice);
    if (!exitPrice) return;
    
    try {
      await axios.post(`/api/trade/admin/trade/${trade._id}/close`, {
        exitPrice: Number(exitPrice)
      }, {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      fetchTrades();
    } catch (error) {
      alert(error.response?.data?.message || 'Error closing trade');
    }
  };

  const handleDelete = async (tradeId) => {
    if (!confirm('Are you sure you want to delete this trade?')) return;
    
    try {
      await axios.delete(`/api/trade/admin/trade/${tradeId}`, {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      fetchTrades();
    } catch (error) {
      alert(error.response?.data?.message || 'Error deleting trade');
    }
  };

  const openEditModal = (trade) => {
    setEditForm({
      quantity: trade.quantity,
      entryPrice: trade.entryPrice,
      exitPrice: trade.exitPrice || ''
    });
    setEditModal({ show: true, trade });
  };

  const handleSaveEdit = async () => {
    try {
      await axios.put(`/api/trade/admin/trade/${editModal.trade._id}`, {
        quantity: Number(editForm.quantity),
        entryPrice: Number(editForm.entryPrice),
        exitPrice: editForm.exitPrice ? Number(editForm.exitPrice) : undefined
      }, {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      setEditModal({ show: false, trade: null });
      fetchTrades();
    } catch (error) {
      alert(error.response?.data?.message || 'Error updating trade');
    }
  };

  const handleReopen = async (trade) => {
    if (!confirm('Reopen this position?')) return;
    
    try {
      await axios.post(`/api/trade/admin/trade/${trade._id}/reopen`, {}, {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      fetchTrades();
    } catch (error) {
      alert(error.response?.data?.message || 'Error reopening trade');
    }
  };

  const formatDuration = (entryTime, exitTime) => {
    if (!entryTime || !exitTime) return '-';
    const diff = new Date(exitTime) - new Date(entryTime);
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${days}d;${hours}h;${mins}m`;
  };

  const formatDateTime = (date) => {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleString('en-IN', { 
      day: '2-digit', month: 'short', year: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: true 
    });
  };

  return (
    <div className="p-4 md:p-6">
      {/* Header with Admin Info and PNL Summary */}
      <div className="bg-dark-800 rounded-lg p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4 md:gap-8">
          <div className="flex items-center gap-2">
            <Shield className="text-purple-400" size={20} />
            <span className="text-lg font-bold text-purple-400">{admin?.username || admin?.name}</span>
            {Object.keys(marketData).length > 0 && (
              <span className="flex items-center gap-1 text-xs text-green-400">
                <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
                Live ({Object.keys(marketData).length})
              </span>
            )}
          </div>
          
          <button
            onClick={() => setActiveTab('open')}
            className={`px-4 py-2 rounded-lg border-2 transition ${
              activeTab === 'open' ? 'border-purple-500 bg-purple-500/10' : 'border-dark-600 hover:border-dark-500'
            }`}
          >
            <div className="text-xs text-gray-400">Open PNL</div>
            <div className={`text-lg font-bold ${totalOpenPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {totalOpenPnL >= 0 ? '+' : ''}₹{totalOpenPnL.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
          </button>
          
          <button
            onClick={() => setActiveTab('closed')}
            className={`px-4 py-2 rounded-lg border-2 transition ${
              activeTab === 'closed' ? 'border-purple-500 bg-purple-500/10' : 'border-dark-600 hover:border-dark-500'
            }`}
          >
            <div className="text-xs text-gray-400">Closed PNL</div>
            <div className={`text-lg font-bold ${totalClosedPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {totalClosedPnL >= 0 ? '+' : ''}₹{totalClosedPnL.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
          </button>

          <div className="px-4 py-2 rounded-lg border-2 border-dark-600">
            <div className="text-xs text-gray-400">Total Brokerage</div>
            <div className="text-lg font-bold text-purple-400">
              ₹{totalBrokerage.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
          </div>

          <button onClick={fetchTrades} className="ml-auto p-2 bg-dark-700 hover:bg-dark-600 rounded-lg" title="Refresh">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Position Tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => { setActiveTab('open'); setCurrentPage(1); }}
          className={`px-4 py-2 rounded-lg font-medium transition text-sm ${
            activeTab === 'open' ? 'bg-purple-600 text-white' : 'bg-dark-700 text-gray-400 hover:bg-dark-600'
          }`}
        >
          Open Position ({openTrades.length})
        </button>
        <button
          onClick={() => { setActiveTab('closed'); setCurrentPage(1); }}
          className={`px-4 py-2 rounded-lg font-medium transition text-sm ${
            activeTab === 'closed' ? 'bg-purple-600 text-white' : 'bg-dark-700 text-gray-400 hover:bg-dark-600'
          }`}
        >
          Closed Position ({closedTrades.length})
        </button>
        <button
          onClick={() => { setActiveTab('pending'); setCurrentPage(1); }}
          className={`px-4 py-2 rounded-lg font-medium transition text-sm ${
            activeTab === 'pending' ? 'bg-purple-600 text-white' : 'bg-dark-700 text-gray-400 hover:bg-dark-600'
          }`}
        >
          Pending Orders ({pendingTrades.length})
        </button>
        <button
          onClick={() => { setActiveTab('rejected'); setCurrentPage(1); }}
          className={`px-4 py-2 rounded-lg font-medium transition text-sm ${
            activeTab === 'rejected' ? 'bg-purple-600 text-white' : 'bg-dark-700 text-gray-400 hover:bg-dark-600'
          }`}
        >
          Rejected Orders ({rejectedTrades.length})
        </button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search by User ID, Script..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-dark-700 border border-dark-600 rounded-lg pl-10 pr-4 py-2"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8"><RefreshCw className="animate-spin inline" /></div>
      ) : totalItems === 0 ? (
        <div className="text-center py-8 text-gray-400">No {activeTab} positions found</div>
      ) : (
        <>
          {/* Open Position Table */}
          {activeTab === 'open' && (
            <div className="bg-dark-800 rounded-lg overflow-hidden overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-dark-700">
                  <tr>
                    <th className="text-left px-3 py-3 text-gray-400">UserID</th>
                    <th className="text-left px-3 py-3 text-gray-400">Script</th>
                    <th className="text-center px-3 py-3 text-gray-400">B/S</th>
                    <th className="text-right px-3 py-3 text-gray-400">Qty</th>
                    <th className="text-left px-3 py-3 text-gray-400">Entry Time</th>
                    <th className="text-right px-3 py-3 text-gray-400">Entry</th>
                    <th className="text-right px-3 py-3 text-gray-400">LTP</th>
                    <th className="text-right px-3 py-3 text-gray-400">PNL</th>
                    <th className="text-center px-3 py-3 text-gray-400">Close</th>
                    <th className="text-center px-3 py-3 text-gray-400">Edit</th>
                    <th className="text-center px-3 py-3 text-gray-400">Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map(trade => {
                    const pnl = trade.unrealizedPnL || 0;
                    return (
                      <tr key={trade._id} className="border-t border-dark-600 hover:bg-dark-700/50">
                        <td className="px-3 py-3">
                          <div className="font-mono text-xs">{trade.userId}</div>
                          <div className="text-xs text-gray-400">{trade.user?.fullName || trade.user?.username || '-'}</div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-medium">{trade.symbol}</div>
                          <div className="text-xs text-gray-500">{trade.segment} • {trade.productType}</div>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${trade.side === 'BUY' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                            {trade.side}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right">{trade.quantity}</td>
                        <td className="px-3 py-3 text-xs">{formatDateTime(trade.openedAt)}</td>
                        <td className="px-3 py-3 text-right">₹{trade.entryPrice?.toFixed(2)}</td>
                        <td className="px-3 py-3 text-right">₹{(trade.currentPrice || trade.entryPrice)?.toFixed(2)}</td>
                        <td className={`px-3 py-3 text-right font-bold ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {pnl >= 0 ? '+' : ''}₹{pnl.toFixed(2)}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <button onClick={() => handleClose(trade)} className="px-2 py-1 bg-orange-600 hover:bg-orange-700 rounded text-xs">Close</button>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <button onClick={() => openEditModal(trade)} className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs">Edit</button>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <button onClick={() => handleDelete(trade._id)} className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs">Delete</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Closed Position Table */}
          {activeTab === 'closed' && (
            <div className="bg-dark-800 rounded-lg overflow-hidden overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-dark-700">
                  <tr>
                    <th className="text-left px-2 py-3 text-gray-400">UserID</th>
                    <th className="text-left px-2 py-3 text-gray-400">Script</th>
                    <th className="text-center px-2 py-3 text-gray-400">B/S</th>
                    <th className="text-right px-2 py-3 text-gray-400">Qty</th>
                    <th className="text-left px-2 py-3 text-gray-400">Entry Time</th>
                    <th className="text-right px-2 py-3 text-gray-400">Entry</th>
                    <th className="text-right px-2 py-3 text-gray-400">Entry BKG</th>
                    <th className="text-left px-2 py-3 text-gray-400">Exit Time</th>
                    <th className="text-right px-2 py-3 text-gray-400">Exit</th>
                    <th className="text-right px-2 py-3 text-gray-400">Exit BKG</th>
                    <th className="text-right px-2 py-3 text-gray-400">Gross PNL</th>
                    <th className="text-right px-2 py-3 text-gray-400">Net PNL</th>
                    <th className="text-right px-2 py-3 text-gray-400">BKG</th>
                    <th className="text-left px-2 py-3 text-gray-400">Duration</th>
                    <th className="text-center px-2 py-3 text-gray-400">Delete</th>
                    <th className="text-center px-2 py-3 text-gray-400">Edit</th>
                    <th className="text-center px-2 py-3 text-gray-400">Reopen</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map(trade => {
                    const grossPnL = trade.realizedPnL || trade.pnl || 0;
                    const totalBkg = trade.charges?.total || trade.charges?.brokerage || 0;
                    const netPnL = trade.netPnL || (grossPnL - totalBkg);
                    const entryBkg = (trade.charges?.brokerage || 0) / 2;
                    const exitBkg = (trade.charges?.brokerage || 0) / 2;
                    return (
                      <tr key={trade._id} className="border-t border-dark-600 hover:bg-dark-700/50">
                        <td className="px-2 py-3">
                          <div className="font-mono text-xs">{trade.userId}</div>
                          <div className="text-xs text-gray-400">{trade.user?.fullName || trade.user?.username || '-'}</div>
                        </td>
                        <td className="px-2 py-3">
                          <div className="font-medium text-xs">{trade.symbol}</div>
                          <div className="text-xs text-gray-500">{trade.segment}</div>
                        </td>
                        <td className="px-2 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${trade.side === 'BUY' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                            {trade.side}
                          </span>
                        </td>
                        <td className="px-2 py-3 text-right text-xs">{trade.quantity}</td>
                        <td className="px-2 py-3 text-xs">{formatDateTime(trade.openedAt)}</td>
                        <td className="px-2 py-3 text-right text-xs">₹{trade.entryPrice?.toFixed(2)}</td>
                        <td className="px-2 py-3 text-right text-xs text-gray-400">₹{entryBkg.toFixed(2)}</td>
                        <td className="px-2 py-3 text-xs">{formatDateTime(trade.closedAt)}</td>
                        <td className="px-2 py-3 text-right text-xs">₹{trade.exitPrice?.toFixed(2)}</td>
                        <td className="px-2 py-3 text-right text-xs text-gray-400">₹{exitBkg.toFixed(2)}</td>
                        <td className={`px-2 py-3 text-right text-xs font-bold ${grossPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {grossPnL >= 0 ? '+' : ''}₹{grossPnL.toFixed(2)}
                        </td>
                        <td className={`px-2 py-3 text-right text-xs font-bold ${netPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {netPnL >= 0 ? '+' : ''}₹{netPnL.toFixed(2)}
                        </td>
                        <td className="px-2 py-3 text-right text-xs text-purple-400">₹{totalBkg.toFixed(2)}</td>
                        <td className="px-2 py-3 text-xs text-gray-400">{formatDuration(trade.openedAt, trade.closedAt)}</td>
                        <td className="px-2 py-3 text-center">
                          <button onClick={() => handleDelete(trade._id)} className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs">Delete</button>
                        </td>
                        <td className="px-2 py-3 text-center">
                          <button onClick={() => openEditModal(trade)} className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs">Edit</button>
                        </td>
                        <td className="px-2 py-3 text-center">
                          <button onClick={() => handleReopen(trade)} className="px-2 py-1 bg-green-600 hover:bg-green-700 rounded text-xs">Reopen</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pending Orders Table */}
          {activeTab === 'pending' && (
            <div className="bg-dark-800 rounded-lg overflow-hidden overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-dark-700">
                  <tr>
                    <th className="text-left px-3 py-3 text-gray-400">UserID</th>
                    <th className="text-left px-3 py-3 text-gray-400">Trade Type</th>
                    <th className="text-left px-3 py-3 text-gray-400">Time</th>
                    <th className="text-left px-3 py-3 text-gray-400">Type</th>
                    <th className="text-left px-3 py-3 text-gray-400">Script</th>
                    <th className="text-right px-3 py-3 text-gray-400">Quantity</th>
                    <th className="text-right px-3 py-3 text-gray-400">Average Price</th>
                    <th className="text-center px-3 py-3 text-gray-400">Edit</th>
                    <th className="text-center px-3 py-3 text-gray-400">Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map(trade => (
                    <tr key={trade._id} className="border-t border-dark-600 hover:bg-dark-700/50">
                      <td className="px-3 py-3">
                        <div className="font-mono text-xs">{trade.userId}</div>
                        <div className="text-xs text-gray-400">{trade.user?.fullName || trade.user?.username || '-'}</div>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${trade.side === 'BUY' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                          {trade.side}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs">{formatDateTime(trade.createdAt || trade.openedAt)}</td>
                      <td className="px-3 py-3">
                        <div className="text-xs">{trade.productType}</div>
                        <div className="text-xs text-gray-500">{trade.orderType}</div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-medium">{trade.symbol}</div>
                        <div className="text-xs text-gray-500">{trade.segment}</div>
                      </td>
                      <td className="px-3 py-3 text-right">{trade.quantity}</td>
                      <td className="px-3 py-3 text-right">₹{(trade.limitPrice || trade.entryPrice)?.toFixed(2)}</td>
                      <td className="px-3 py-3 text-center">
                        <button onClick={() => openEditModal(trade)} className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs">Edit</button>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <button onClick={() => handleDelete(trade._id)} className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Rejected Orders Table */}
          {activeTab === 'rejected' && (
            <div className="bg-dark-800 rounded-lg overflow-hidden overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-dark-700">
                  <tr>
                    <th className="text-left px-3 py-3 text-gray-400">UserID</th>
                    <th className="text-left px-3 py-3 text-gray-400">Trade Type</th>
                    <th className="text-left px-3 py-3 text-gray-400">Time</th>
                    <th className="text-left px-3 py-3 text-gray-400">Type</th>
                    <th className="text-left px-3 py-3 text-gray-400">Script</th>
                    <th className="text-right px-3 py-3 text-gray-400">Quantity</th>
                    <th className="text-right px-3 py-3 text-gray-400">Rate</th>
                    <th className="text-left px-3 py-3 text-gray-400">Reason</th>
                    <th className="text-center px-3 py-3 text-gray-400">Edit</th>
                    <th className="text-center px-3 py-3 text-gray-400">Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map(trade => (
                    <tr key={trade._id} className="border-t border-dark-600 hover:bg-dark-700/50">
                      <td className="px-3 py-3">
                        <div className="font-mono text-xs">{trade.userId}</div>
                        <div className="text-xs text-gray-400">{trade.user?.fullName || trade.user?.username || '-'}</div>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${trade.side === 'BUY' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                          {trade.side}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs">
                        <div>{formatDateTime(trade.createdAt || trade.openedAt)}</div>
                        {trade.closedAt && <div className="text-red-400">{formatDateTime(trade.closedAt)}</div>}
                      </td>
                      <td className="px-3 py-3">
                        <div className="text-xs">{trade.productType}</div>
                        <div className="text-xs text-gray-500">{trade.orderType}</div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-medium">{trade.symbol}</div>
                        <div className="text-xs text-gray-500">{trade.segment}</div>
                      </td>
                      <td className="px-3 py-3 text-right">{trade.quantity}</td>
                      <td className="px-3 py-3 text-right">₹{(trade.limitPrice || trade.entryPrice)?.toFixed(2)}</td>
                      <td className="px-3 py-3 text-xs">
                        <span className={`px-2 py-0.5 rounded ${trade.status === 'CANCELLED' ? 'bg-gray-500/20 text-gray-400' : 'bg-red-500/20 text-red-400'}`}>
                          {trade.closeReason || trade.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <button onClick={() => openEditModal(trade)} className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs">Edit</button>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <button onClick={() => handleDelete(trade._id)} className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalItems={totalItems}
            itemsPerPage={20}
          />
        </>
      )}

      {/* Edit Modal */}
      {editModal.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-dark-800 rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Edit Trade</h3>
              <button onClick={() => setEditModal({ show: false, trade: null })} className="text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Quantity</label>
                <input
                  type="number"
                  value={editForm.quantity}
                  onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
                  className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Entry Price</label>
                <input
                  type="number"
                  step="0.01"
                  value={editForm.entryPrice}
                  onChange={(e) => setEditForm({ ...editForm, entryPrice: e.target.value })}
                  className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2"
                />
              </div>
              {editModal.trade?.status === 'CLOSED' && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Exit Price</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.exitPrice}
                    onChange={(e) => setEditForm({ ...editForm, exitPrice: e.target.value })}
                    className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2"
                  />
                </div>
              )}
            </div>
            
            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditModal({ show: false, trade: null })} className="flex-1 px-4 py-2 bg-dark-600 hover:bg-dark-500 rounded-lg">
                Cancel
              </button>
              <button onClick={handleSaveEdit} className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg">
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Super Admin Position Management - View all positions across all clients
const SuperAdminAllTrades = () => {
  const { admin } = useAuth();
  const [trades, setTrades] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [selectedAdmin, setSelectedAdmin] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('open'); // 'open' or 'closed'
  const [searchTerm, setSearchTerm] = useState('');
  const [editModal, setEditModal] = useState({ show: false, trade: null });
  const [editForm, setEditForm] = useState({ quantity: '', entryPrice: '', exitPrice: '' });
  const [marketData, setMarketData] = useState({});
  const socketRef = useRef(null);

  // Filter by selected admin
  const filteredTrades = selectedAdmin 
    ? trades.filter(t => t.adminCode === selectedAdmin)
    : trades;

  // Separate trades by status
  const openTrades = filteredTrades.filter(t => t.status === 'OPEN');
  const closedTrades = filteredTrades.filter(t => t.status === 'CLOSED');
  const pendingTrades = filteredTrades.filter(t => t.status === 'PENDING' || t.status === 'TRIGGERED');
  const rejectedTrades = filteredTrades.filter(t => t.status === 'CANCELLED' || t.status === 'REJECTED');

  // Calculate totals
  const totalOpenPnL = openTrades.reduce((sum, t) => sum + (t.unrealizedPnL || 0), 0);
  const totalClosedPnL = closedTrades.reduce((sum, t) => sum + (t.netPnL || 0), 0);
  const totalBrokerage = filteredTrades.reduce((sum, t) => sum + (t.charges?.brokerage || t.charges?.total || 0), 0);

  // Pagination for active tab
  const currentTrades = activeTab === 'open' ? openTrades 
    : activeTab === 'closed' ? closedTrades 
    : activeTab === 'pending' ? pendingTrades 
    : rejectedTrades;
  const { currentPage, setCurrentPage, totalPages, paginatedData, totalItems } = usePagination(
    currentTrades, 20, searchTerm, ['symbol', 'userId', 'user.username', 'user.fullName']
  );

  useEffect(() => {
    fetchAdmins();
    fetchTrades();
    
    // Connect to Socket.IO for live market data
    const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
    socketRef.current = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });
    
    socketRef.current.on('connect', () => {
      console.log('SuperAdmin AllTrades: Connected to Socket.IO for live market data');
    });
    
    // Live ticks
    socketRef.current.on('market_tick', (data) => {
      setMarketData(prev => ({ ...prev, ...data }));
    });
    
    // Auto-refresh when new trades are created or closed
    socketRef.current.on('trade_update', (data) => {
      console.log('SuperAdmin AllTrades: Trade update received', data.type);
      fetchTrades();
    });
    
    socketRef.current.on('disconnect', () => {
      console.log('SuperAdmin AllTrades: Disconnected from Socket.IO');
    });
    
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);
  
  // Update P&L in real-time when market data changes (use bid/ask per side)
  useEffect(() => {
    if (Object.keys(marketData).length === 0) return;
    
    setTrades(prevTrades => prevTrades.map(trade => {
      if (trade.status !== 'OPEN') return trade;
      
      // Try multiple token formats for matching
      const tokenStr = trade.token?.toString();
      const liveData = marketData[tokenStr] || marketData[trade.token] || marketData[parseInt(trade.token)];
      if (!liveData) return trade;
      
      // Align with user view: BUY uses best bid, SELL uses best ask
      const sidePrice = trade.side === 'BUY'
        ? (liveData.bid ?? liveData.ltp ?? liveData.last_price)
        : (liveData.ask ?? liveData.ltp ?? liveData.last_price);
      if (!sidePrice) return trade;
      
      // Calculate unrealized P&L with side-specific price
      const currentPrice = sidePrice;
      const multiplier = trade.side === 'BUY' ? 1 : -1;
      const priceDiff = (currentPrice - trade.entryPrice) * multiplier;
      const unrealizedPnL = priceDiff * trade.quantity * (trade.lotSize || 1);
      
      return {
        ...trade,
        currentPrice,
        unrealizedPnL
      };
    }));
  }, [marketData]);

  const fetchAdmins = async () => {
    try {
      const { data } = await axios.get('/api/admin/manage/admins', {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      setAdmins(data);
    } catch (error) {
      console.error('Error fetching admins:', error);
    }
  };

  const fetchTrades = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get('/api/trade/admin/all-trades', {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      setTrades(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Close trade at current price
  const handleClose = async (trade) => {
    const exitPrice = prompt('Enter exit price:', trade.currentPrice || trade.entryPrice);
    if (!exitPrice) return;
    
    try {
      await axios.post(`/api/trade/admin/trade/${trade._id}/close`, {
        exitPrice: Number(exitPrice)
      }, {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      fetchTrades();
    } catch (error) {
      alert(error.response?.data?.message || 'Error closing trade');
    }
  };

  // Delete trade
  const handleDelete = async (tradeId) => {
    if (!confirm('Are you sure you want to delete this trade? This action cannot be undone.')) return;
    
    try {
      await axios.delete(`/api/trade/admin/trade/${tradeId}`, {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      fetchTrades();
    } catch (error) {
      alert(error.response?.data?.message || 'Error deleting trade');
    }
  };

  // Open edit modal
  const openEditModal = (trade) => {
    setEditForm({
      quantity: trade.quantity,
      entryPrice: trade.entryPrice,
      exitPrice: trade.exitPrice || ''
    });
    setEditModal({ show: true, trade });
  };

  // Save edit
  const handleSaveEdit = async () => {
    try {
      await axios.put(`/api/trade/admin/trade/${editModal.trade._id}`, {
        quantity: Number(editForm.quantity),
        entryPrice: Number(editForm.entryPrice),
        exitPrice: editForm.exitPrice ? Number(editForm.exitPrice) : undefined
      }, {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      setEditModal({ show: false, trade: null });
      fetchTrades();
    } catch (error) {
      alert(error.response?.data?.message || 'Error updating trade');
    }
  };

  // Reopen closed trade
  const handleReopen = async (trade) => {
    if (!confirm('Reopen this position? Exit data will be removed and PNL will be recalculated based on current price.')) return;
    
    try {
      await axios.post(`/api/trade/admin/trade/${trade._id}/reopen`, {}, {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      fetchTrades();
    } catch (error) {
      alert(error.response?.data?.message || 'Error reopening trade');
    }
  };

  // Format duration between entry and exit
  const formatDuration = (entryTime, exitTime) => {
    if (!entryTime || !exitTime) return '-';
    const diff = new Date(exitTime) - new Date(entryTime);
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${days}d;${hours}h;${mins}m`;
  };

  // Format datetime
  const formatDateTime = (date) => {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleString('en-IN', { 
      day: '2-digit', month: 'short', year: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: true 
    });
  };

  return (
    <div className="p-4 md:p-6">
      {/* Header with Admin Info and PNL Summary */}
      <div className="bg-dark-800 rounded-lg p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4 md:gap-8">
          {/* Admin Username */}
          <div className="flex items-center gap-2">
            <Shield className="text-yellow-400" size={20} />
            <span className="text-lg font-bold text-yellow-400">{admin?.username || admin?.name}</span>
          </div>
          
          {/* Open PNL Button */}
          <button
            onClick={() => setActiveTab('open')}
            className={`px-4 py-2 rounded-lg border-2 transition ${
              activeTab === 'open' 
                ? 'border-yellow-500 bg-yellow-500/10' 
                : 'border-dark-600 hover:border-dark-500'
            }`}
          >
            <div className="text-xs text-gray-400">Open PNL</div>
            <div className={`text-lg font-bold ${totalOpenPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {totalOpenPnL >= 0 ? '+' : ''}₹{totalOpenPnL.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
          </button>
          
          {/* Closed PNL Button */}
          <button
            onClick={() => setActiveTab('closed')}
            className={`px-4 py-2 rounded-lg border-2 transition ${
              activeTab === 'closed' 
                ? 'border-yellow-500 bg-yellow-500/10' 
                : 'border-dark-600 hover:border-dark-500'
            }`}
          >
            <div className="text-xs text-gray-400">Closed PNL</div>
            <div className={`text-lg font-bold ${totalClosedPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {totalClosedPnL >= 0 ? '+' : ''}₹{totalClosedPnL.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
          </button>

          {/* Total Brokerage */}
          <div className="px-4 py-2 rounded-lg border-2 border-dark-600">
            <div className="text-xs text-gray-400">Total Brokerage</div>
            <div className="text-lg font-bold text-yellow-400">
              ₹{totalBrokerage.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
          </div>

          {/* Refresh Button */}
          <button
            onClick={fetchTrades}
            className="ml-auto p-2 bg-dark-700 hover:bg-dark-600 rounded-lg"
            title="Refresh"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Position Tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => { setActiveTab('open'); setCurrentPage(1); }}
          className={`px-4 py-2 rounded-lg font-medium transition text-sm ${
            activeTab === 'open'
              ? 'bg-yellow-600 text-white'
              : 'bg-dark-700 text-gray-400 hover:bg-dark-600'
          }`}
        >
          Open Position ({openTrades.length})
        </button>
        <button
          onClick={() => { setActiveTab('closed'); setCurrentPage(1); }}
          className={`px-4 py-2 rounded-lg font-medium transition text-sm ${
            activeTab === 'closed'
              ? 'bg-yellow-600 text-white'
              : 'bg-dark-700 text-gray-400 hover:bg-dark-600'
          }`}
        >
          Closed Position ({closedTrades.length})
        </button>
        <button
          onClick={() => { setActiveTab('pending'); setCurrentPage(1); }}
          className={`px-4 py-2 rounded-lg font-medium transition text-sm ${
            activeTab === 'pending'
              ? 'bg-yellow-600 text-white'
              : 'bg-dark-700 text-gray-400 hover:bg-dark-600'
          }`}
        >
          Pending Orders ({pendingTrades.length})
        </button>
        <button
          onClick={() => { setActiveTab('rejected'); setCurrentPage(1); }}
          className={`px-4 py-2 rounded-lg font-medium transition text-sm ${
            activeTab === 'rejected'
              ? 'bg-yellow-600 text-white'
              : 'bg-dark-700 text-gray-400 hover:bg-dark-600'
          }`}
        >
          Rejected Orders ({rejectedTrades.length})
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-4">
        {/* Admin Filter */}
        <div className="min-w-[200px]">
          <label className="block text-xs text-gray-400 mb-1">Filter by Admin</label>
          <select
            value={selectedAdmin}
            onChange={(e) => setSelectedAdmin(e.target.value)}
            className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2 text-sm"
          >
            <option value="">All Admins</option>
            {admins.map(adm => (
              <option key={adm._id} value={adm.adminCode}>
                {adm.name || adm.username} ({adm.adminCode})
              </option>
            ))}
          </select>
        </div>
        
        {/* Search */}
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-gray-400 mb-1">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search by User ID, Script..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-dark-700 border border-dark-600 rounded-lg pl-10 pr-4 py-2"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8"><RefreshCw className="animate-spin inline" /></div>
      ) : totalItems === 0 ? (
        <div className="text-center py-8 text-gray-400">No {activeTab} positions found</div>
      ) : (
        <>
          {/* Open Position Table */}
          {activeTab === 'open' && (
            <div className="bg-dark-800 rounded-lg overflow-hidden overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-dark-700">
                  <tr>
                    <th className="text-left px-3 py-3 text-gray-400">UserID</th>
                    <th className="text-left px-3 py-3 text-gray-400">Script</th>
                    <th className="text-center px-3 py-3 text-gray-400">B/S</th>
                    <th className="text-right px-3 py-3 text-gray-400">Qty</th>
                    <th className="text-left px-3 py-3 text-gray-400">Entry Time</th>
                    <th className="text-right px-3 py-3 text-gray-400">Entry</th>
                    <th className="text-right px-3 py-3 text-gray-400">LTP</th>
                    <th className="text-right px-3 py-3 text-gray-400">PNL</th>
                    <th className="text-center px-3 py-3 text-gray-400">Close</th>
                    <th className="text-center px-3 py-3 text-gray-400">Edit</th>
                    <th className="text-center px-3 py-3 text-gray-400">Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map(trade => {
                    const pnl = trade.unrealizedPnL || 0;
                    return (
                      <tr key={trade._id} className="border-t border-dark-600 hover:bg-dark-700/50">
                        <td className="px-3 py-3">
                          <div className="font-mono text-xs">{trade.userId}</div>
                          <div className="text-xs text-gray-400">{trade.user?.fullName || trade.user?.username || '-'}</div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-medium">{trade.symbol}</div>
                          <div className="text-xs text-gray-500">{trade.segment} • {trade.productType}</div>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                            trade.side === 'BUY' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                          }`}>
                            {trade.side === 'BUY' ? 'BUY' : 'SELL'}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right">{trade.quantity}</td>
                        <td className="px-3 py-3 text-xs">{formatDateTime(trade.openedAt)}</td>
                        <td className="px-3 py-3 text-right">₹{trade.entryPrice?.toFixed(2)}</td>
                        <td className="px-3 py-3 text-right">₹{(trade.currentPrice || trade.entryPrice)?.toFixed(2)}</td>
                        <td className={`px-3 py-3 text-right font-bold ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {pnl >= 0 ? '+' : ''}₹{pnl.toFixed(2)}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <button
                            onClick={() => handleClose(trade)}
                            className="px-2 py-1 bg-orange-600 hover:bg-orange-700 rounded text-xs"
                          >
                            Close
                          </button>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <button
                            onClick={() => openEditModal(trade)}
                            className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs"
                          >
                            Edit
                          </button>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <button
                            onClick={() => handleDelete(trade._id)}
                            className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Closed Position Table */}
          {activeTab === 'closed' && (
            <div className="bg-dark-800 rounded-lg overflow-hidden overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-dark-700">
                  <tr>
                    <th className="text-left px-2 py-3 text-gray-400">UserID</th>
                    <th className="text-left px-2 py-3 text-gray-400">Script</th>
                    <th className="text-center px-2 py-3 text-gray-400">B/S</th>
                    <th className="text-right px-2 py-3 text-gray-400">Qty</th>
                    <th className="text-left px-2 py-3 text-gray-400">Entry Time</th>
                    <th className="text-right px-2 py-3 text-gray-400">Entry</th>
                    <th className="text-right px-2 py-3 text-gray-400">Entry BKG</th>
                    <th className="text-left px-2 py-3 text-gray-400">Exit Time</th>
                    <th className="text-right px-2 py-3 text-gray-400">Exit</th>
                    <th className="text-right px-2 py-3 text-gray-400">Exit BKG</th>
                    <th className="text-right px-2 py-3 text-gray-400">Gross PNL</th>
                    <th className="text-right px-2 py-3 text-gray-400">Net PNL</th>
                    <th className="text-right px-2 py-3 text-gray-400">BKG</th>
                    <th className="text-left px-2 py-3 text-gray-400">Duration</th>
                    <th className="text-center px-2 py-3 text-gray-400">Delete</th>
                    <th className="text-center px-2 py-3 text-gray-400">Edit</th>
                    <th className="text-center px-2 py-3 text-gray-400">Reopen</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map(trade => {
                    const grossPnL = trade.realizedPnL || trade.pnl || 0;
                    const totalBkg = trade.charges?.total || trade.charges?.brokerage || 0;
                    const netPnL = trade.netPnL || (grossPnL - totalBkg);
                    const entryBkg = (trade.charges?.brokerage || 0) / 2;
                    const exitBkg = (trade.charges?.brokerage || 0) / 2;
                    
                    return (
                      <tr key={trade._id} className="border-t border-dark-600 hover:bg-dark-700/50">
                        <td className="px-2 py-3">
                          <div className="font-mono text-xs">{trade.userId}</div>
                          <div className="text-xs text-gray-400">{trade.user?.fullName || trade.user?.username || '-'}</div>
                        </td>
                        <td className="px-2 py-3">
                          <div className="font-medium text-xs">{trade.symbol}</div>
                          <div className="text-xs text-gray-500">{trade.segment}</div>
                        </td>
                        <td className="px-2 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                            trade.side === 'BUY' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                          }`}>
                            {trade.side === 'BUY' ? 'BUY' : 'SELL'}
                          </span>
                        </td>
                        <td className="px-2 py-3 text-right text-xs">{trade.quantity}</td>
                        <td className="px-2 py-3 text-xs">{formatDateTime(trade.openedAt)}</td>
                        <td className="px-2 py-3 text-right text-xs">₹{trade.entryPrice?.toFixed(2)}</td>
                        <td className="px-2 py-3 text-right text-xs text-gray-400">₹{entryBkg.toFixed(2)}</td>
                        <td className="px-2 py-3 text-xs">{formatDateTime(trade.closedAt)}</td>
                        <td className="px-2 py-3 text-right text-xs">₹{trade.exitPrice?.toFixed(2)}</td>
                        <td className="px-2 py-3 text-right text-xs text-gray-400">₹{exitBkg.toFixed(2)}</td>
                        <td className={`px-2 py-3 text-right text-xs font-bold ${grossPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {grossPnL >= 0 ? '+' : ''}₹{grossPnL.toFixed(2)}
                        </td>
                        <td className={`px-2 py-3 text-right text-xs font-bold ${netPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {netPnL >= 0 ? '+' : ''}₹{netPnL.toFixed(2)}
                        </td>
                        <td className="px-2 py-3 text-right text-xs text-purple-400">₹{totalBkg.toFixed(2)}</td>
                        <td className="px-2 py-3 text-xs text-gray-400">{formatDuration(trade.openedAt, trade.closedAt)}</td>
                        <td className="px-2 py-3 text-center">
                          <button
                            onClick={() => handleDelete(trade._id)}
                            className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs"
                          >
                            Delete
                          </button>
                        </td>
                        <td className="px-2 py-3 text-center">
                          <button
                            onClick={() => openEditModal(trade)}
                            className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs"
                          >
                            Edit
                          </button>
                        </td>
                        <td className="px-2 py-3 text-center">
                          <button
                            onClick={() => handleReopen(trade)}
                            className="px-2 py-1 bg-green-600 hover:bg-green-700 rounded text-xs"
                          >
                            Reopen
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pending Orders Table */}
          {activeTab === 'pending' && (
            <div className="bg-dark-800 rounded-lg overflow-hidden overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-dark-700">
                  <tr>
                    <th className="text-left px-3 py-3 text-gray-400">UserID</th>
                    <th className="text-left px-3 py-3 text-gray-400">Trade Type</th>
                    <th className="text-left px-3 py-3 text-gray-400">Time</th>
                    <th className="text-left px-3 py-3 text-gray-400">Type</th>
                    <th className="text-left px-3 py-3 text-gray-400">Script</th>
                    <th className="text-right px-3 py-3 text-gray-400">Quantity</th>
                    <th className="text-right px-3 py-3 text-gray-400">Average Price</th>
                    <th className="text-center px-3 py-3 text-gray-400">Edit</th>
                    <th className="text-center px-3 py-3 text-gray-400">Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map(trade => (
                    <tr key={trade._id} className="border-t border-dark-600 hover:bg-dark-700/50">
                      <td className="px-3 py-3">
                        <div className="font-mono text-xs">{trade.userId}</div>
                        <div className="text-xs text-gray-400">{trade.user?.fullName || trade.user?.username || '-'}</div>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          trade.side === 'BUY' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                          {trade.side}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs">{formatDateTime(trade.createdAt || trade.openedAt)}</td>
                      <td className="px-3 py-3">
                        <div className="text-xs">{trade.productType}</div>
                        <div className="text-xs text-gray-500">{trade.orderType}</div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-medium">{trade.symbol}</div>
                        <div className="text-xs text-gray-500">{trade.segment}</div>
                      </td>
                      <td className="px-3 py-3 text-right">{trade.quantity}</td>
                      <td className="px-3 py-3 text-right">₹{(trade.limitPrice || trade.entryPrice)?.toFixed(2)}</td>
                      <td className="px-3 py-3 text-center">
                        <button
                          onClick={() => openEditModal(trade)}
                          className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs"
                        >
                          Edit
                        </button>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <button
                          onClick={() => handleDelete(trade._id)}
                          className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Rejected Orders Table */}
          {activeTab === 'rejected' && (
            <div className="bg-dark-800 rounded-lg overflow-hidden overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-dark-700">
                  <tr>
                    <th className="text-left px-3 py-3 text-gray-400">UserID</th>
                    <th className="text-left px-3 py-3 text-gray-400">Trade Type</th>
                    <th className="text-left px-3 py-3 text-gray-400">Time</th>
                    <th className="text-left px-3 py-3 text-gray-400">Type</th>
                    <th className="text-left px-3 py-3 text-gray-400">Script</th>
                    <th className="text-right px-3 py-3 text-gray-400">Quantity</th>
                    <th className="text-right px-3 py-3 text-gray-400">Rate</th>
                    <th className="text-left px-3 py-3 text-gray-400">Reason</th>
                    <th className="text-center px-3 py-3 text-gray-400">Edit</th>
                    <th className="text-center px-3 py-3 text-gray-400">Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map(trade => (
                    <tr key={trade._id} className="border-t border-dark-600 hover:bg-dark-700/50">
                      <td className="px-3 py-3">
                        <div className="font-mono text-xs">{trade.userId}</div>
                        <div className="text-xs text-gray-400">{trade.user?.fullName || trade.user?.username || '-'}</div>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          trade.side === 'BUY' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                          {trade.side}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs">
                        <div>{formatDateTime(trade.createdAt || trade.openedAt)}</div>
                        {trade.closedAt && (
                          <div className="text-red-400">{formatDateTime(trade.closedAt)}</div>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="text-xs">{trade.productType}</div>
                        <div className="text-xs text-gray-500">{trade.orderType}</div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-medium">{trade.symbol}</div>
                        <div className="text-xs text-gray-500">{trade.segment}</div>
                      </td>
                      <td className="px-3 py-3 text-right">{trade.quantity}</td>
                      <td className="px-3 py-3 text-right">₹{(trade.limitPrice || trade.entryPrice)?.toFixed(2)}</td>
                      <td className="px-3 py-3 text-xs">
                        <span className={`px-2 py-0.5 rounded ${
                          trade.status === 'CANCELLED' ? 'bg-gray-500/20 text-gray-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                          {trade.closeReason || trade.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <button
                          onClick={() => openEditModal(trade)}
                          className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs"
                        >
                          Edit
                        </button>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <button
                          onClick={() => handleDelete(trade._id)}
                          className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalItems={totalItems}
            itemsPerPage={20}
          />
        </>
      )}

      {/* Edit Modal */}
      {editModal.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-dark-800 rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Edit Trade</h3>
              <button onClick={() => setEditModal({ show: false, trade: null })} className="text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Quantity</label>
                <input
                  type="number"
                  value={editForm.quantity}
                  onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
                  className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Entry Price</label>
                <input
                  type="number"
                  step="0.01"
                  value={editForm.entryPrice}
                  onChange={(e) => setEditForm({ ...editForm, entryPrice: e.target.value })}
                  className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2"
                />
              </div>
              {editModal.trade?.status === 'CLOSED' && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Exit Price</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.exitPrice}
                    onChange={(e) => setEditForm({ ...editForm, exitPrice: e.target.value })}
                    className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2"
                  />
                </div>
              )}
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditModal({ show: false, trade: null })}
                className="flex-1 px-4 py-2 bg-dark-600 hover:bg-dark-500 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="flex-1 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Super Admin All Fund Requests - View and approve/reject all user fund requests
const SuperAdminAllFundRequests = () => {
  const { admin } = useAuth();
  const [requests, setRequests] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('PENDING');
  const [selectedAdmin, setSelectedAdmin] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const { currentPage, setCurrentPage, totalPages, paginatedData: paginatedRequests, totalItems } = usePagination(
    requests, 20, searchTerm, ['user.username', 'user.fullName', 'user.email', 'adminCode', 'referenceId', 'amount']
  );

  useEffect(() => {
    fetchAdmins();
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [filter, selectedAdmin]);

  const fetchAdmins = async () => {
    try {
      const { data } = await axios.get('/api/admin/manage/admins', {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      setAdmins(data);
    } catch (error) {
      console.error('Error fetching admins:', error);
    }
  };

  const fetchRequests = async () => {
    try {
      setLoading(true);
      let url = '/api/admin/manage/all-fund-requests';
      const params = new URLSearchParams();
      // API expects 'ALL' for no filter, or specific status
      if (filter) {
        params.append('status', filter);
      } else {
        params.append('status', 'ALL');
      }
      if (params.toString()) url += `?${params.toString()}`;
      
      const { data } = await axios.get(url, {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      // Handle both array response and {requests, stats} object response
      const requestsData = Array.isArray(data) ? data : (data.requests || []);
      // Filter by adminCode on frontend if needed (since existing API doesn't support it)
      const filteredRequests = selectedAdmin 
        ? requestsData.filter(r => r.adminCode === selectedAdmin)
        : requestsData;
      setRequests(filteredRequests);
    } catch (error) {
      console.error('Error fetching fund requests:', error);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId) => {
    if (!confirm('Approve this fund request? This will deduct from the admin wallet.')) return;
    
    setActionLoading(requestId);
    try {
      await axios.post(`/api/admin/manage/all-fund-requests/${requestId}/approve`, {}, {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      fetchRequests();
    } catch (error) {
      alert(error.response?.data?.message || 'Error approving request');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (requestId) => {
    const remarks = prompt('Enter rejection reason (optional):');
    if (remarks === null) return;
    
    setActionLoading(requestId);
    try {
      await axios.post(`/api/admin/manage/all-fund-requests/${requestId}/reject`, { remarks }, {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      fetchRequests();
    } catch (error) {
      alert(error.response?.data?.message || 'Error rejecting request');
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      PENDING: 'bg-yellow-500/20 text-yellow-400',
      APPROVED: 'bg-green-500/20 text-green-400',
      REJECTED: 'bg-red-500/20 text-red-400',
      CANCELLED: 'bg-gray-500/20 text-gray-400'
    };
    return <span className={`px-2 py-0.5 rounded text-xs ${styles[status] || styles.PENDING}`}>{status}</span>;
  };

  const getTypeBadge = (type) => {
    return type === 'DEPOSIT' 
      ? <span className="px-2 py-0.5 rounded text-xs bg-green-500/20 text-green-400">DEPOSIT</span>
      : <span className="px-2 py-0.5 rounded text-xs bg-red-500/20 text-red-400">WITHDRAWAL</span>;
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-xl md:text-2xl font-bold">All User Fund Requests</h1>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm text-gray-400 mb-1">Filter by Admin</label>
          <select
            value={selectedAdmin}
            onChange={(e) => setSelectedAdmin(e.target.value)}
            className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2"
          >
            <option value="">All Admins</option>
            {admins.map(adm => (
              <option key={adm._id} value={adm.adminCode}>
                {adm.name || adm.username} ({adm.adminCode})
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm text-gray-400 mb-1">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search by user, admin, reference..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-dark-700 border border-dark-600 rounded-lg pl-10 pr-4 py-2"
            />
          </div>
        </div>
        <div className="flex gap-2 items-end">
          <button onClick={() => setFilter('')} className={`px-4 py-2 rounded ${!filter ? 'bg-purple-600' : 'bg-dark-700'}`}>All</button>
          <button onClick={() => setFilter('PENDING')} className={`px-4 py-2 rounded ${filter === 'PENDING' ? 'bg-yellow-600' : 'bg-dark-700'}`}>Pending</button>
          <button onClick={() => setFilter('APPROVED')} className={`px-4 py-2 rounded ${filter === 'APPROVED' ? 'bg-green-600' : 'bg-dark-700'}`}>Approved</button>
          <button onClick={() => setFilter('REJECTED')} className={`px-4 py-2 rounded ${filter === 'REJECTED' ? 'bg-red-600' : 'bg-dark-700'}`}>Rejected</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-dark-800 rounded-lg p-4">
          <div className="text-sm text-gray-400">Total Requests</div>
          <div className="text-2xl font-bold">{totalItems}</div>
        </div>
        <div className="bg-dark-800 rounded-lg p-4">
          <div className="text-sm text-gray-400">Pending</div>
          <div className="text-2xl font-bold text-yellow-400">{requests.filter(r => r.status === 'PENDING').length}</div>
        </div>
        <div className="bg-dark-800 rounded-lg p-4">
          <div className="text-sm text-gray-400">Total Deposit Requests</div>
          <div className="text-2xl font-bold text-green-400">
            ₹{requests.filter(r => r.type === 'DEPOSIT').reduce((s, r) => s + r.amount, 0).toLocaleString()}
          </div>
        </div>
        <div className="bg-dark-800 rounded-lg p-4">
          <div className="text-sm text-gray-400">Total Withdrawal Requests</div>
          <div className="text-2xl font-bold text-red-400">
            ₹{requests.filter(r => r.type === 'WITHDRAWAL').reduce((s, r) => s + r.amount, 0).toLocaleString()}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8"><RefreshCw className="animate-spin inline" /></div>
      ) : totalItems === 0 ? (
        <div className="text-center py-8 text-gray-400">No fund requests found</div>
      ) : (
        <>
          {/* Mobile Card View */}
          <div className="md:hidden space-y-4">
            {paginatedRequests.map(req => (
              <div key={req._id} className="bg-dark-800 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-bold">{req.user?.fullName || req.user?.username}</div>
                    <div className="text-xs text-gray-400">{req.user?.email}</div>
                  </div>
                  {getStatusBadge(req.status)}
                </div>
                <div className="text-xs mb-2">
                  <span className="text-gray-400">Admin: </span>
                  <span className="font-medium">{req.admin?.name || req.admin?.username || req.adminCode}</span>
                  {req.admin?.role && (
                    <span className={`ml-2 px-1.5 py-0.5 rounded ${
                      req.admin.role === 'ADMIN' ? 'bg-purple-500/20 text-purple-400' :
                      req.admin.role === 'BROKER' ? 'bg-cyan-500/20 text-cyan-400' :
                      req.admin.role === 'SUB_BROKER' ? 'bg-green-500/20 text-green-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {req.admin.role === 'ADMIN' ? 'Admin' : req.admin.role === 'BROKER' ? 'Broker' : req.admin.role === 'SUB_BROKER' ? 'SubBroker' : req.admin.role}
                    </span>
                  )}
                </div>
                <div className="flex justify-between items-center mb-2">
                  {getTypeBadge(req.type)}
                  <div className="text-xl font-bold">₹{req.amount.toLocaleString()}</div>
                </div>
                <div className="text-xs text-gray-500 mb-2">
                  {new Date(req.createdAt).toLocaleString()}
                </div>
                {req.referenceId && (
                  <div className="text-xs text-gray-400 mb-2">Ref: {req.referenceId}</div>
                )}
                {req.paymentMethod && <div className="text-xs text-gray-500">Method: {req.paymentMethod}</div>}
                
                {/* Withdrawal Details */}
                {req.type === 'WITHDRAWAL' && req.withdrawalDetails && (
                  <div className="bg-dark-700 rounded p-2 mt-2 text-xs">
                    <div className="text-gray-400 font-medium mb-1">Withdrawal To:</div>
                    {req.withdrawalDetails.upiId && (
                      <div className="text-green-400">UPI: {req.withdrawalDetails.upiId}</div>
                    )}
                    {req.withdrawalDetails.bankName && (
                      <>
                        <div>Bank: {req.withdrawalDetails.bankName}</div>
                        <div>A/C: {req.withdrawalDetails.accountNumber}</div>
                        <div>IFSC: {req.withdrawalDetails.ifscCode}</div>
                        <div>Name: {req.withdrawalDetails.accountHolderName}</div>
                      </>
                    )}
                  </div>
                )}
                
                {/* Payment Proof */}
                {req.proofUrl && (
                  <div className="mt-2">
                    <div className="text-xs text-gray-400 mb-1">Payment Proof:</div>
                    <img 
                      src={`${import.meta.env.VITE_SOCKET_URL || ''}${req.proofUrl}`} 
                      alt="Payment proof" 
                      className="w-20 h-20 object-cover rounded border border-dark-600 cursor-pointer"
                      onClick={() => window.open(`${import.meta.env.VITE_SOCKET_URL || ''}${req.proofUrl}`, '_blank')}
                    />
                  </div>
                )}
                
                {req.status === 'PENDING' && (
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => handleApprove(req._id)}
                      disabled={actionLoading === req._id}
                      className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 rounded text-sm disabled:opacity-50"
                    >
                      {actionLoading === req._id ? 'Processing...' : 'Approve'}
                    </button>
                    <button
                      onClick={() => handleReject(req._id)}
                      disabled={actionLoading === req._id}
                      className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 rounded text-sm disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block bg-dark-800 rounded-lg overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-dark-700">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-400">Request ID</th>
                  <th className="text-left px-4 py-3 text-gray-400">Admin</th>
                  <th className="text-left px-4 py-3 text-gray-400">User</th>
                  <th className="text-left px-4 py-3 text-gray-400">Type</th>
                  <th className="text-right px-4 py-3 text-gray-400">Amount</th>
                  <th className="text-left px-4 py-3 text-gray-400">Details</th>
                  <th className="text-left px-4 py-3 text-gray-400">Proof</th>
                  <th className="text-left px-4 py-3 text-gray-400">Date</th>
                  <th className="text-center px-4 py-3 text-gray-400">Status</th>
                  <th className="text-center px-4 py-3 text-gray-400">Action</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRequests.map(req => (
                  <tr key={req._id} className="border-t border-dark-600">
                    <td className="px-4 py-3 font-mono text-xs">{req.requestId}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{req.admin?.name || req.admin?.username || '-'}</div>
                      <div className="text-xs text-gray-500">{req.adminCode}</div>
                      {req.admin?.role && (
                        <span className={`px-1.5 py-0.5 rounded text-xs ${
                          req.admin.role === 'ADMIN' ? 'bg-purple-500/20 text-purple-400' :
                          req.admin.role === 'BROKER' ? 'bg-cyan-500/20 text-cyan-400' :
                          req.admin.role === 'SUB_BROKER' ? 'bg-green-500/20 text-green-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {req.admin.role === 'ADMIN' ? 'Admin' : req.admin.role === 'BROKER' ? 'Broker' : req.admin.role === 'SUB_BROKER' ? 'SubBroker' : req.admin.role}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div>{req.user?.fullName || req.user?.username}</div>
                      <div className="text-xs text-gray-500">{req.user?.email}</div>
                    </td>
                    <td className="px-4 py-3">{getTypeBadge(req.type)}</td>
                    <td className="px-4 py-3 text-right font-bold">₹{req.amount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs">
                      {req.referenceId && <div>Ref: {req.referenceId}</div>}
                      {req.paymentMethod && <div className="text-gray-500">Method: {req.paymentMethod}</div>}
                      {req.type === 'WITHDRAWAL' && req.withdrawalDetails && (
                        <div className="mt-1 text-xs">
                          {req.withdrawalDetails.upiId && (
                            <div className="text-green-400">UPI: {req.withdrawalDetails.upiId}</div>
                          )}
                          {req.withdrawalDetails.bankName && (
                            <div>
                              <div>{req.withdrawalDetails.bankName}</div>
                              <div className="text-gray-400">A/C: {req.withdrawalDetails.accountNumber}</div>
                              <div className="text-gray-400">IFSC: {req.withdrawalDetails.ifscCode}</div>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {req.proofUrl ? (
                        <img 
                          src={`${import.meta.env.VITE_SOCKET_URL || ''}${req.proofUrl}`} 
                          alt="Proof" 
                          className="w-12 h-12 object-cover rounded border border-dark-600 cursor-pointer hover:border-yellow-500"
                          onClick={() => window.open(`${import.meta.env.VITE_SOCKET_URL || ''}${req.proofUrl}`, '_blank')}
                        />
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">{new Date(req.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3 text-center">{getStatusBadge(req.status)}</td>
                    <td className="px-4 py-3 text-center">
                      {req.status === 'PENDING' ? (
                        <div className="flex gap-1 justify-center">
                          <button
                            onClick={() => handleApprove(req._id)}
                            disabled={actionLoading === req._id}
                            className="px-2 py-1 bg-green-600 hover:bg-green-700 rounded text-xs disabled:opacity-50"
                          >
                            ✓
                          </button>
                          <button
                            onClick={() => handleReject(req._id)}
                            disabled={actionLoading === req._id}
                            className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs disabled:opacity-50"
                          >
                            ✗
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-500">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalItems={totalItems}
            itemsPerPage={20}
          />
        </>
      )}
    </div>
  );
};

// Market Watch - Trading interface
const TradingPanel = () => {
  const { admin } = useAuth();
  const isSuperAdmin = admin?.role === 'SUPER_ADMIN';
  const [instruments, setInstruments] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSegment, setActiveSegment] = useState('NSEFUT');
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [selectedInstrument, setSelectedInstrument] = useState(null);
  const [selectedAdmin, setSelectedAdmin] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [userSearch, setUserSearch] = useState('');

  const segments = ['NSEFUT', 'NSEOPT', 'MCXFUT', 'MCXOPT', 'NSE-EQ', 'BSE-FUT', 'BSE-OPT', 'CRYPTO'];

  useEffect(() => {
    fetchInstruments(activeSegment);
    fetchUsers();
    if (isSuperAdmin) fetchAdmins();
  }, []);

  useEffect(() => {
    fetchInstruments(activeSegment, searchTerm);
  }, [activeSegment, searchTerm]);

  const fetchInstruments = async (segmentToFetch, term) => {
    setLoading(true);
    try {
      const { data } = await axios.get('/api/instruments/admin', {
        headers: { Authorization: `Bearer ${admin.token}` },
        params: { limit: 5000, displaySegment: segmentToFetch, search: term || undefined }
      });
      const instrumentsArray = data?.instruments || data || [];
      console.log('Fetched instruments:', instrumentsArray.length, 'Sample:', instrumentsArray[0]);
      setInstruments(Array.isArray(instrumentsArray) ? instrumentsArray : []);
    } catch (err) {
      console.error('Error fetching instruments:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAdmins = async () => {
    try {
      const { data } = await axios.get('/api/admin/manage/admins', {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      setAdmins(data);
    } catch (err) {
      console.error('Error fetching admins:', err);
    }
  };

  const fetchUsers = async () => {
    try {
      const url = isSuperAdmin ? '/api/admin/manage/users' : '/api/admin/users';
      const { data } = await axios.get(url, {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      setUsers(data);
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  const fetchUsersByAdmin = async (adminCode) => {
    try {
      const { data } = await axios.get('/api/admin/manage/users', {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      const filtered = adminCode ? data.filter(u => u.adminCode === adminCode) : data;
      setUsers(filtered);
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  // Filter instruments by segment and search - use displaySegment directly
  const filteredInstruments = instruments.filter(i => {
    const displaySeg = (i.displaySegment || '').toUpperCase();
    const exchange = (i.exchange || '').toUpperCase();
    const instType = (i.instrumentType || '').toUpperCase();
    
    // First try to match by displaySegment directly
    let matchesSegment = displaySeg === activeSegment;
    
    // Fallback to exchange + instrumentType matching if displaySegment doesn't match
    if (!matchesSegment) {
      matchesSegment = 
        (activeSegment === 'NSEFUT' && exchange === 'NFO' && instType === 'FUTURES') ||
        (activeSegment === 'NSEOPT' && exchange === 'NFO' && instType === 'OPTIONS') ||
        (activeSegment === 'MCXFUT' && exchange === 'MCX' && instType === 'FUTURES') ||
        (activeSegment === 'MCXOPT' && exchange === 'MCX' && instType === 'OPTIONS') ||
        (activeSegment === 'NSE-EQ' && exchange === 'NSE') ||
        (activeSegment === 'BSE-FUT' && exchange === 'BFO' && instType === 'FUTURES') ||
        (activeSegment === 'BSE-OPT' && exchange === 'BFO' && instType === 'OPTIONS');
    }
    
    if (!searchTerm) return matchesSegment;
    
    const term = searchTerm.toLowerCase();
    return matchesSegment && (
      i.tradingSymbol?.toLowerCase().includes(term) ||
      i.symbol?.toLowerCase().includes(term) ||
      i.name?.toLowerCase().includes(term)
    );
  });

  // Filter users by search
  const filteredUsers = users.filter(u => {
    if (!userSearch) return true;
    const term = userSearch.toLowerCase();
    return (
      u.fullName?.toLowerCase().includes(term) ||
      u.username?.toLowerCase().includes(term) ||
      u.userId?.toLowerCase().includes(term)
    );
  }).slice(0, 15);

  const addToWatchlist = (instrument) => {
    if (!watchlist.find(w => w._id === instrument._id)) {
      setWatchlist([...watchlist, instrument]);
    }
  };

  const removeFromWatchlist = (instrumentId) => {
    setWatchlist(watchlist.filter(w => w._id !== instrumentId));
  };

  const openTradeModal = (instrument) => {
    setSelectedInstrument(instrument);
    setSelectedUser(null);
    setUserSearch('');
    setShowTradeModal(true);
  };

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    setUserSearch(user.fullName || user.username);
  };

  // Display lot size strictly from DB (no hardcoded fallbacks)
  const getDisplayLotSize = (instrument) => instrument.lotSize || 1;

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-xl md:text-2xl font-bold mb-6">Market Watch</h1>

      {/* Segment Tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {segments.map(seg => (
          <button
            key={seg}
            onClick={() => setActiveSegment(seg)}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeSegment === seg 
                ? 'bg-yellow-600 text-white' 
                : 'bg-dark-700 text-gray-400 hover:bg-dark-600'
            }`}
          >
            {seg}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Search & Add Instruments */}
        <div className="bg-dark-800 rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-4">Search Instruments</h2>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder={`Search ${activeSegment} instruments...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-dark-700 border border-dark-600 rounded-lg pl-10 pr-4 py-2"
            />
          </div>

          {loading ? (
            <div className="text-center py-8"><RefreshCw className="animate-spin inline" /></div>
          ) : (
            <div className="max-h-[400px] overflow-y-auto space-y-2">
              {filteredInstruments.slice(0, 50).map(instrument => (
                <div 
                  key={instrument._id}
                  className="flex items-center justify-between bg-dark-700 rounded-lg p-3 hover:bg-dark-600 transition"
                >
                  <div className="flex-1">
                    <div className="font-medium">{instrument.tradingSymbol || instrument.symbol}</div>
                    <div className="text-xs text-gray-400">
                      {instrument.name} • {instrument.displaySegment || instrument.segment}
                      <span className="text-yellow-400 ml-1">(Lot: {getDisplayLotSize(instrument)})</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => addToWatchlist(instrument)}
                      className="p-2 bg-blue-600 hover:bg-blue-700 rounded text-xs"
                      title="Add to Watchlist"
                    >
                      <Plus size={14} />
                    </button>
                    <button
                      onClick={() => openTradeModal(instrument)}
                      className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-xs font-medium"
                    >
                      Trade
                    </button>
                  </div>
                </div>
              ))}
              {filteredInstruments.length === 0 && (
                <div className="text-center py-8 text-gray-400">No instruments found</div>
              )}
              {filteredInstruments.length > 50 && (
                <div className="text-center py-2 text-gray-500 text-sm">
                  Showing 50 of {filteredInstruments.length} results. Refine your search.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Watchlist */}
        <div className="bg-dark-800 rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-4">My Watchlist ({watchlist.length})</h2>
          
          {watchlist.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Eye size={48} className="mx-auto mb-4 opacity-50" />
              <p>Your watchlist is empty</p>
              <p className="text-sm">Search and add instruments to get started</p>
            </div>
          ) : (
            <div className="space-y-2">
              {watchlist.map(instrument => (
                <div 
                  key={instrument._id}
                  className="flex items-center justify-between bg-dark-700 rounded-lg p-3"
                >
                  <div className="flex-1">
                    <div className="font-medium">{instrument.tradingSymbol || instrument.symbol}</div>
                    <div className="text-xs text-gray-400">
                      {instrument.name} • {instrument.displaySegment || instrument.segment}
                      <span className="text-yellow-400 ml-1">(Lot: {getDisplayLotSize(instrument)})</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openTradeModal(instrument)}
                      className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-xs font-medium"
                    >
                      Trade
                    </button>
                    <button
                      onClick={() => removeFromWatchlist(instrument._id)}
                      className="p-2 bg-red-600/20 hover:bg-red-600/40 rounded text-red-400"
                      title="Remove"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Trade Modal */}
      {showTradeModal && selectedInstrument && (
        <TradeModal
          instrument={selectedInstrument}
          isSuperAdmin={isSuperAdmin}
          admins={admins}
          users={users}
          selectedAdmin={selectedAdmin}
          setSelectedAdmin={setSelectedAdmin}
          selectedUser={selectedUser}
          setSelectedUser={handleSelectUser}
          userSearch={userSearch}
          setUserSearch={setUserSearch}
          filteredUsers={filteredUsers}
          token={admin.token}
          onClose={() => { setShowTradeModal(false); setSelectedInstrument(null); }}
          onSuccess={() => { setShowTradeModal(false); setSelectedInstrument(null); }}
          fetchUsersByAdmin={fetchUsersByAdmin}
        />
      )}
    </div>
  );
};

// Trade Modal Component
const TradeModal = ({ 
  instrument, 
  isSuperAdmin, 
  admins, 
  users,
  selectedAdmin,
  setSelectedAdmin,
  selectedUser, 
  setSelectedUser,
  userSearch,
  setUserSearch,
  filteredUsers,
  token, 
  onClose, 
  onSuccess,
  fetchUsersByAdmin
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [priceMode, setPriceMode] = useState('MANUAL'); // MARKET or MANUAL - default to MANUAL since live data may not be available
  const [livePrice, setLivePrice] = useState(instrument.lastPrice || instrument.ltp || 0);
  const [priceLoading, setPriceLoading] = useState(true);
  const [lots, setLots] = useState(1);
  
  // Always use lot size from DB (no hardcoded fallbacks)
  const getLotSizeForInstrument = () => instrument.lotSize || 1;
  
  const lotSize = getLotSizeForInstrument();
  const calculatedQuantity = lots * lotSize;
  
  // Check if this is NSE segment (quantity-based) or other segments (lot-based)
  const segment = instrument.displaySegment || instrument.segment || 'NSE';
  const isNSE = segment === 'NSE' || segment === 'NSE SPOT' || segment.includes('NSE') && !segment.includes('F&O');
  const isLotBased = !isNSE; // MCX, F&O, Currency, etc. are lot-based

  const [formData, setFormData] = useState({
    side: 'BUY',
    productType: 'INTRADAY',
    quantity: lotSize,
    entryPrice: '',
    tradeDate: new Date().toISOString().split('T')[0],
    tradeTime: new Date().toTimeString().slice(0, 5)
  });

  // Fetch live price from market data API
  useEffect(() => {
    const fetchLivePrice = async () => {
      setPriceLoading(true);
      try {
        const { data } = await axios.get('/api/zerodha/market-data', {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        // Find price for this instrument by token
        const instrumentToken = instrument.token?.toString();
        if (instrumentToken && data[instrumentToken]) {
          const price = data[instrumentToken].ltp || data[instrumentToken].last_price || 0;
          setLivePrice(price);
          if (priceMode === 'MARKET' && price > 0) {
            setFormData(prev => ({ ...prev, entryPrice: price }));
          }
        } else {
          // Try to find by any matching token
          const foundPrice = Object.values(data).find(d => 
            d.symbol === instrument.symbol || d.tradingSymbol === instrument.tradingSymbol
          );
          if (foundPrice) {
            const price = foundPrice.ltp || foundPrice.last_price || 0;
            setLivePrice(price);
            if (priceMode === 'MARKET' && price > 0) {
              setFormData(prev => ({ ...prev, entryPrice: price }));
            }
          }
        }
      } catch (err) {
        console.log('Could not fetch live price:', err.message);
      } finally {
        setPriceLoading(false);
      }
    };

    fetchLivePrice();
    
    // Refresh price every 5 seconds if in MARKET mode
    const interval = setInterval(() => {
      if (priceMode === 'MARKET') {
        fetchLivePrice();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [instrument, token]);

  // Update quantity when lots change
  useEffect(() => {
    setFormData(prev => ({ ...prev, quantity: calculatedQuantity }));
  }, [lots, calculatedQuantity]);

  // Update entry price when price mode changes to MARKET
  useEffect(() => {
    if (priceMode === 'MARKET' && livePrice > 0) {
      setFormData(prev => ({ ...prev, entryPrice: livePrice }));
    }
  }, [priceMode, livePrice]);

  const handleAdminChange = (adminCode) => {
    setSelectedAdmin(adminCode);
    setSelectedUser(null);
    setUserSearch('');
    if (adminCode) {
      fetchUsersByAdmin(adminCode);
    }
  };

  const [inputMode, setInputMode] = useState('lots'); // 'lots' or 'quantity'
  const [quantityInput, setQuantityInput] = useState(lotSize);

  const handleLotsChange = (value) => {
    const newLots = Math.max(1, parseInt(value) || 1);
    setLots(newLots);
    setQuantityInput(newLots * lotSize);
    setInputMode('lots');
  };

  const handleQuantityChange = (value) => {
    const newQty = Math.max(1, parseInt(value) || 1);
    setQuantityInput(newQty);
    // Calculate lots (round to nearest lot)
    const calculatedLots = Math.max(1, Math.round(newQty / lotSize));
    setLots(calculatedLots);
    setInputMode('quantity');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedUser) return setError('Please select a user');
    const finalPrice = priceMode === 'MARKET' ? livePrice : Number(formData.entryPrice);
    if (!finalPrice || finalPrice <= 0) return setError('Please enter valid entry price');
    
    // Use quantity based on segment type
    // NSE: always use quantityInput directly
    // MCX/F&O/Currency: use lots calculation or quantityInput based on inputMode
    const finalQuantity = isNSE ? quantityInput : (inputMode === 'lots' ? calculatedQuantity : quantityInput);
    if (!finalQuantity || finalQuantity <= 0) return setError('Please enter valid quantity');

    setLoading(true);
    setError('');
    try {
      await axios.post('/api/trade/admin/create-trade', {
        userId: selectedUser._id,
        symbol: instrument.tradingSymbol || instrument.symbol,
        instrumentToken: instrument.token,
        segment: instrument.displaySegment || instrument.segment || 'NSE',
        side: formData.side,
        productType: formData.productType,
        orderType: priceMode, // MARKET, LIMIT, or MANUAL
        quantity: finalQuantity,
        entryPrice: finalPrice,
        tradeDate: formData.tradeDate,
        tradeTime: formData.tradeTime
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || 'Error creating trade');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-dark-800 p-4 border-b border-dark-600 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">Place Trade</h2>
            <div className="text-sm text-gray-400">
              {instrument.tradingSymbol || instrument.symbol} • {instrument.displaySegment || instrument.segment}
              {lotSize > 1 && <span className="ml-2 text-yellow-400">(Lot: {lotSize})</span>}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={24} /></button>
        </div>

        {/* Live Price Display */}
        <div className="px-4 pt-4">
          <div className="bg-dark-700 rounded-lg p-3 flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-400">Live Price {priceLoading && <RefreshCw size={10} className="inline animate-spin ml-1" />}</div>
              <div className={`text-xl font-bold ${livePrice > 0 ? 'text-green-400' : 'text-gray-500'}`}>
                {livePrice > 0 ? `₹${livePrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : 'Not Available'}
              </div>
              {livePrice === 0 && !priceLoading && (
                <div className="text-xs text-yellow-500">Use Manual mode to enter price</div>
              )}
            </div>
            <div className="text-right">
              {isLotBased ? (
                <>
                  <div className="text-xs text-gray-400">Lot Size</div>
                  <div className="text-lg font-semibold">{lotSize}</div>
                </>
              ) : (
                <>
                  <div className="text-xs text-gray-400">Trade Type</div>
                  <div className="text-sm font-semibold text-blue-400">Quantity Based</div>
                </>
              )}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && <div className="bg-red-500/20 border border-red-500 text-red-400 px-4 py-2 rounded">{error}</div>}

          {/* Super Admin: Select Admin */}
          {isSuperAdmin && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">Select Admin</label>
              <select
                value={selectedAdmin}
                onChange={(e) => handleAdminChange(e.target.value)}
                className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2"
              >
                <option value="">All Admins</option>
                {admins.map(adm => (
                  <option key={adm._id} value={adm.adminCode}>
                    {adm.name || adm.username} ({adm.adminCode})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* User Selection */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Select User *</label>
            <input
              type="text"
              placeholder="Search by name or ID..."
              value={userSearch}
              onChange={(e) => { setUserSearch(e.target.value); if (selectedUser) setSelectedUser(null); }}
              className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2 mb-2"
            />
            {userSearch && !selectedUser && filteredUsers.length > 0 && (
              <div className="bg-dark-700 border border-dark-600 rounded max-h-40 overflow-y-auto">
                {filteredUsers.map(u => (
                  <div
                    key={u._id}
                    onClick={() => setSelectedUser(u)}
                    className="px-3 py-2 hover:bg-dark-600 cursor-pointer"
                  >
                    <div className="font-medium">{u.fullName || u.username}</div>
                    <div className="text-xs text-gray-400">@{u.username} • {u.userId} {isSuperAdmin && `• ${u.adminCode}`}</div>
                  </div>
                ))}
              </div>
            )}
            {selectedUser && (
              <div className="flex items-center justify-between bg-green-500/10 border border-green-500/30 rounded px-3 py-2">
                <div>
                  <span className="text-green-400">{selectedUser.fullName || selectedUser.username}</span>
                  {isSuperAdmin && <span className="text-xs text-gray-400 ml-2">({selectedUser.adminCode})</span>}
                </div>
                <button type="button" onClick={() => { setSelectedUser(null); setUserSearch(''); }} className="text-gray-400 hover:text-white">
                  <X size={16} />
                </button>
              </div>
            )}
          </div>

          {/* Side & Product Type */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Side *</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, side: 'BUY' })}
                  className={`flex-1 py-2 rounded font-medium ${formData.side === 'BUY' ? 'bg-green-600' : 'bg-dark-700'}`}
                >
                  BUY
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, side: 'SELL' })}
                  className={`flex-1 py-2 rounded font-medium ${formData.side === 'SELL' ? 'bg-red-600' : 'bg-dark-700'}`}
                >
                  SELL
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Product Type *</label>
              <select
                value={formData.productType}
                onChange={(e) => setFormData({ ...formData, productType: e.target.value })}
                className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2"
              >
                <option value="INTRADAY">INTRADAY</option>
                <option value="DELIVERY">DELIVERY</option>
                <option value="CARRYFORWARD">CARRYFORWARD</option>
              </select>
            </div>
          </div>

          {/* Price Mode Toggle */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Order Type *</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => livePrice > 0 && setPriceMode('MARKET')}
                disabled={livePrice === 0}
                className={`flex-1 py-2 rounded font-medium text-sm ${priceMode === 'MARKET' ? 'bg-blue-600' : 'bg-dark-700'} ${livePrice === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                MARKET
              </button>
              <button
                type="button"
                onClick={() => setPriceMode('LIMIT')}
                className={`flex-1 py-2 rounded font-medium text-sm ${priceMode === 'LIMIT' ? 'bg-orange-600' : 'bg-dark-700'}`}
              >
                LIMIT
              </button>
              <button
                type="button"
                onClick={() => setPriceMode('MANUAL')}
                className={`flex-1 py-2 rounded font-medium text-sm ${priceMode === 'MANUAL' ? 'bg-purple-600' : 'bg-dark-700'}`}
              >
                MANUAL
              </button>
            </div>
          </div>

          {/* Lots & Quantity - Show based on segment type */}
          {isLotBased ? (
            /* MCX, F&O, Currency - Show Lots and Quantity (bidirectional) */
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Lots * {inputMode === 'lots' && <span className="text-green-400 text-xs">(Active)</span>}
                </label>
                <input
                  type="number"
                  value={lots}
                  onChange={(e) => handleLotsChange(e.target.value)}
                  className={`w-full bg-dark-700 border rounded px-3 py-2 ${inputMode === 'lots' ? 'border-green-500' : 'border-dark-600'}`}
                  min="1"
                />
                {inputMode === 'quantity' && (
                  <div className="text-xs text-gray-500 mt-1">= {lots} lots (rounded)</div>
                )}
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Quantity * {inputMode === 'quantity' && <span className="text-green-400 text-xs">(Active)</span>}
                </label>
                <input
                  type="number"
                  value={inputMode === 'lots' ? calculatedQuantity : quantityInput}
                  onChange={(e) => handleQuantityChange(e.target.value)}
                  className={`w-full bg-dark-700 border rounded px-3 py-2 ${inputMode === 'quantity' ? 'border-green-500' : 'border-dark-600'}`}
                  min="1"
                />
                {inputMode === 'lots' && lotSize > 1 && (
                  <div className="text-xs text-gray-500 mt-1">= {lots} × {lotSize}</div>
                )}
              </div>
            </div>
          ) : (
            /* NSE - Only show Quantity field */
            <div>
              <label className="block text-sm text-gray-400 mb-1">Quantity *</label>
              <input
                type="number"
                value={quantityInput}
                onChange={(e) => handleQuantityChange(e.target.value)}
                className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2"
                min="1"
                placeholder="Enter quantity"
              />
            </div>
          )}

          {/* Entry Price */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Entry Price * 
              {priceMode === 'MARKET' && <span className="text-blue-400 ml-1">(Market Price)</span>}
              {priceMode === 'LIMIT' && <span className="text-orange-400 ml-1">(Limit Price)</span>}
              {priceMode === 'MANUAL' && <span className="text-purple-400 ml-1">(Manual Entry)</span>}
            </label>
            {priceMode === 'MARKET' ? (
              <div className="w-full bg-dark-600 border border-blue-500/50 rounded px-3 py-2 text-green-400 font-medium">
                ₹{livePrice > 0 ? livePrice.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}
              </div>
            ) : (
              <input
                type="number"
                step="0.01"
                value={formData.entryPrice}
                onChange={(e) => setFormData({ ...formData, entryPrice: e.target.value })}
                className={`w-full bg-dark-700 border rounded px-3 py-2 ${priceMode === 'LIMIT' ? 'border-orange-500/50' : 'border-dark-600'}`}
                placeholder={priceMode === 'LIMIT' ? 'Enter limit price' : 'Enter manual price'}
                required
              />
            )}
            {priceMode === 'LIMIT' && livePrice > 0 && (
              <div className="text-xs text-gray-500 mt-1">
                Current market: ₹{livePrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            )}
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Trade Date</label>
              <input
                type="date"
                value={formData.tradeDate}
                onChange={(e) => setFormData({ ...formData, tradeDate: e.target.value })}
                className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Trade Time</label>
              <input
                type="time"
                value={formData.tradeTime}
                onChange={(e) => setFormData({ ...formData, tradeTime: e.target.value })}
                className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2"
              />
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 bg-dark-600 hover:bg-dark-500 py-2 rounded">Cancel</button>
            <button 
              type="submit" 
              disabled={loading || !selectedUser} 
              className={`flex-1 py-2 rounded font-medium disabled:opacity-50 ${formData.side === 'BUY' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
            >
              {loading ? 'Placing...' : `${formData.side} ${instrument.tradingSymbol || instrument.symbol}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// All Transactions (Super Admin only)
const AllTransactions = () => {
  const { admin } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    fetchTransactions();
  }, [filter]);

  const fetchTransactions = async () => {
    try {
      const url = filter 
        ? `/api/admin/manage/all-transactions?ownerType=${filter}&limit=200`
        : '/api/admin/manage/all-transactions?limit=200';
      const { data } = await axios.get(url, {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      setTransactions(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-bold mb-6">All Transactions</h1>
      
      <div className="flex gap-2 mb-6">
        <button onClick={() => setFilter('')} className={`px-4 py-2 rounded ${!filter ? 'bg-yellow-600' : 'bg-dark-700'}`}>All</button>
        <button onClick={() => setFilter('ADMIN')} className={`px-4 py-2 rounded ${filter === 'ADMIN' ? 'bg-yellow-600' : 'bg-dark-700'}`}>Admin</button>
        <button onClick={() => setFilter('USER')} className={`px-4 py-2 rounded ${filter === 'USER' ? 'bg-yellow-600' : 'bg-dark-700'}`}>User</button>
      </div>

      {loading ? (
        <div className="text-center py-8"><RefreshCw className="animate-spin inline" /></div>
      ) : (
        <div className="bg-dark-800 rounded-lg overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-dark-700">
              <tr>
                <th className="text-left px-4 py-3 text-gray-400">Date</th>
                <th className="text-left px-4 py-3 text-gray-400">Owner</th>
                <th className="text-left px-4 py-3 text-gray-400">Type</th>
                <th className="text-left px-4 py-3 text-gray-400">Reason</th>
                <th className="text-right px-4 py-3 text-gray-400">Amount</th>
                <th className="text-right px-4 py-3 text-gray-400">Balance After</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(tx => (
                <tr key={tx._id} className="border-t border-dark-600">
                  <td className="px-4 py-3">{new Date(tx.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${tx.ownerType === 'ADMIN' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-purple-500/20 text-purple-400'}`}>
                      {tx.ownerType}
                    </span>
                    <span className="ml-2 text-gray-400">{tx.adminCode || ''}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${tx.type === 'CREDIT' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      {tx.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400">{tx.reason}</td>
                  <td className={`px-4 py-3 text-right ${tx.type === 'CREDIT' ? 'text-green-400' : 'text-red-400'}`}>
                    {tx.type === 'CREDIT' ? '+' : '-'}₹{tx.amount?.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">₹{tx.balanceAfter?.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// Lot Management (Super Admin only)
const LotManagement = () => {
  const { admin } = useAuth();
  const [admins, setAdmins] = useState([]);
  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const [lotSettings, setLotSettings] = useState({
    niftyMaxLotIntraday: 100,
    niftyMaxLotCarryForward: 50,
    niftyLotSize: 25,
    bankniftyMaxLotIntraday: 100,
    bankniftyMaxLotCarryForward: 50,
    bankniftyLotSize: 15,
    finniftyMaxLotIntraday: 100,
    finniftyMaxLotCarryForward: 50,
    finniftyLotSize: 25,
    midcpniftyMaxLotIntraday: 100,
    midcpniftyMaxLotCarryForward: 50,
    midcpniftyLotSize: 50,
    equityMaxQtyIntraday: 10000,
    equityMaxQtyDelivery: 5000,
    maxOpenPositions: 20,
    maxDailyTrades: 100
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchAdmins();
  }, []);

  useEffect(() => {
    if (selectedAdmin) {
      fetchAdminLotSettings(selectedAdmin);
    }
  }, [selectedAdmin]);

  const fetchAdmins = async () => {
    try {
      const { data } = await axios.get('/api/admin/manage/admins', {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      setAdmins(data);
      if (data.length > 0) {
        setSelectedAdmin(data[0]._id);
      }
    } catch (error) {
      console.error('Error fetching admins:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAdminLotSettings = async (adminId) => {
    try {
      const { data } = await axios.get(`/api/admin/manage/admins/${adminId}`, {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      if (data.lotSettings) {
        setLotSettings(data.lotSettings);
      }
    } catch (error) {
      console.error('Error fetching lot settings:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage({ type: '', text: '' });
    try {
      await axios.put(`/api/admin/manage/admins/${selectedAdmin}/lot-settings`, 
        { 
          lotSettings,
          enabledLeverages: lotSettings.enabledLeverages,
          allowTradingOutsideMarketHours: lotSettings.allowTradingOutsideMarketHours,
          marginCallPercentage: lotSettings.marginCallPercentage
        },
        { headers: { Authorization: `Bearer ${admin.token}` } }
      );
      setMessage({ type: 'success', text: 'All settings saved successfully!' });
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Error saving settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field, value) => {
    setLotSettings(prev => ({ ...prev, [field]: parseInt(value) || 0 }));
  };

  const segments = [
    { 
      name: 'NIFTY', 
      color: 'blue',
      fields: [
        { key: 'niftyLotSize', label: 'Lot Size', desc: 'Qty per lot' },
        { key: 'niftyMaxLotIntraday', label: 'Max Lot (Intraday)', desc: 'MIS orders' },
        { key: 'niftyMaxLotCarryForward', label: 'Max Lot (Carry Forward)', desc: 'NRML orders' }
      ]
    },
    { 
      name: 'BANKNIFTY', 
      color: 'purple',
      fields: [
        { key: 'bankniftyLotSize', label: 'Lot Size', desc: 'Qty per lot' },
        { key: 'bankniftyMaxLotIntraday', label: 'Max Lot (Intraday)', desc: 'MIS orders' },
        { key: 'bankniftyMaxLotCarryForward', label: 'Max Lot (Carry Forward)', desc: 'NRML orders' }
      ]
    },
    { 
      name: 'FINNIFTY', 
      color: 'green',
      fields: [
        { key: 'finniftyLotSize', label: 'Lot Size', desc: 'Qty per lot' },
        { key: 'finniftyMaxLotIntraday', label: 'Max Lot (Intraday)', desc: 'MIS orders' },
        { key: 'finniftyMaxLotCarryForward', label: 'Max Lot (Carry Forward)', desc: 'NRML orders' }
      ]
    },
    { 
      name: 'MIDCPNIFTY', 
      color: 'yellow',
      fields: [
        { key: 'midcpniftyLotSize', label: 'Lot Size', desc: 'Qty per lot' },
        { key: 'midcpniftyMaxLotIntraday', label: 'Max Lot (Intraday)', desc: 'MIS orders' },
        { key: 'midcpniftyMaxLotCarryForward', label: 'Max Lot (Carry Forward)', desc: 'NRML orders' }
      ]
    }
  ];

  if (loading) {
    return <div className="flex items-center justify-center h-64"><RefreshCw className="animate-spin" size={32} /></div>;
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Lot Management</h1>
          <p className="text-gray-400 text-sm mt-1">Configure max lot limits for each admin's users</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-medium disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {message.text && (
        <div className={`mb-4 p-3 rounded-lg ${message.type === 'success' ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
          {message.text}
        </div>
      )}

      {/* Admin Selector */}
      <div className="bg-dark-800 rounded-lg p-4 mb-6">
        <label className="block text-sm text-gray-400 mb-2">Select Admin</label>
        <select
          value={selectedAdmin || ''}
          onChange={(e) => setSelectedAdmin(e.target.value)}
          className="w-full md:w-64 bg-dark-700 border border-dark-600 rounded px-3 py-2"
        >
          {admins.map(a => (
            <option key={a._id} value={a._id}>{a.username} ({a.adminCode})</option>
          ))}
        </select>
      </div>

      {/* F&O Segments */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {segments.map(segment => (
          <div key={segment.name} className="bg-dark-800 rounded-lg p-4">
            <h3 className={`text-lg font-semibold mb-4 text-${segment.color}-400`}>{segment.name}</h3>
            <div className="space-y-4">
              {segment.fields.map(field => (
                <div key={field.key} className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">{field.label}</div>
                    <div className="text-xs text-gray-500">{field.desc}</div>
                  </div>
                  <input
                    type="number"
                    value={lotSettings[field.key]}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                    className="w-24 bg-dark-700 border border-dark-600 rounded px-3 py-2 text-right"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Equity & Global Settings */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-dark-800 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-4 text-orange-400">Equity</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Max Qty (Intraday)</div>
                <div className="text-xs text-gray-500">MIS orders</div>
              </div>
              <input
                type="number"
                value={lotSettings.equityMaxQtyIntraday}
                onChange={(e) => handleChange('equityMaxQtyIntraday', e.target.value)}
                className="w-24 bg-dark-700 border border-dark-600 rounded px-3 py-2 text-right"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Max Qty (Delivery)</div>
                <div className="text-xs text-gray-500">CNC orders</div>
              </div>
              <input
                type="number"
                value={lotSettings.equityMaxQtyDelivery}
                onChange={(e) => handleChange('equityMaxQtyDelivery', e.target.value)}
                className="w-24 bg-dark-700 border border-dark-600 rounded px-3 py-2 text-right"
              />
            </div>
          </div>
        </div>

        <div className="bg-dark-800 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-4 text-gray-400">Global Limits</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Max Open Positions</div>
                <div className="text-xs text-gray-500">Per user</div>
              </div>
              <input
                type="number"
                value={lotSettings.maxOpenPositions}
                onChange={(e) => handleChange('maxOpenPositions', e.target.value)}
                className="w-24 bg-dark-700 border border-dark-600 rounded px-3 py-2 text-right"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Max Daily Trades</div>
                <div className="text-xs text-gray-500">Per user</div>
              </div>
              <input
                type="number"
                value={lotSettings.maxDailyTrades}
                onChange={(e) => handleChange('maxDailyTrades', e.target.value)}
                className="w-24 bg-dark-700 border border-dark-600 rounded px-3 py-2 text-right"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Leverage Settings */}
      <div className="mt-6 bg-dark-800 rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-4 text-purple-400">Leverage Settings</h3>
        <p className="text-sm text-gray-400 mb-4">Select which leverage options to enable for users. Higher leverage = higher risk.</p>
        <div className="flex flex-wrap gap-3">
          {[1, 2, 5, 10, 20, 50, 100, 200, 500, 800, 1000, 1500, 2000].map(lev => {
            const isEnabled = lotSettings.enabledLeverages?.includes(lev);
            return (
              <button
                key={lev}
                onClick={() => {
                  const current = lotSettings.enabledLeverages || [1, 2, 5, 10];
                  const updated = isEnabled 
                    ? current.filter(l => l !== lev)
                    : [...current, lev].sort((a, b) => a - b);
                  setLotSettings(prev => ({ ...prev, enabledLeverages: updated }));
                }}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  isEnabled 
                    ? 'bg-purple-600 text-white' 
                    : 'bg-dark-700 text-gray-400 hover:bg-dark-600'
                }`}
              >
                {lev}x
              </button>
            );
          })}
        </div>
        <div className="mt-4 text-xs text-gray-500">
          Enabled: {(lotSettings.enabledLeverages || [1, 2, 5, 10]).join('x, ')}x
        </div>
      </div>

      {/* Trading Settings */}
      <div className="mt-6 bg-dark-800 rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-4 text-cyan-400">Trading Settings</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Allow Trading Outside Market Hours</div>
              <div className="text-xs text-gray-500">For LIMIT orders only</div>
            </div>
            <button
              onClick={() => setLotSettings(prev => ({ 
                ...prev, 
                allowTradingOutsideMarketHours: !prev.allowTradingOutsideMarketHours 
              }))}
              className={`w-12 h-6 rounded-full transition ${
                lotSettings.allowTradingOutsideMarketHours ? 'bg-green-600' : 'bg-dark-600'
              }`}
            >
              <div className={`w-5 h-5 bg-white rounded-full transition transform ${
                lotSettings.allowTradingOutsideMarketHours ? 'translate-x-6' : 'translate-x-0.5'
              }`} />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Margin Call %</div>
              <div className="text-xs text-gray-500">Auto-close when loss reaches this %</div>
            </div>
            <input
              type="number"
              value={lotSettings.marginCallPercentage || 100}
              onChange={(e) => setLotSettings(prev => ({ ...prev, marginCallPercentage: parseInt(e.target.value) || 100 }))}
              className="w-20 bg-dark-700 border border-dark-600 rounded px-3 py-2 text-right"
            />
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="mt-6 bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
        <h4 className="font-medium text-blue-400 mb-2">How Settings Work</h4>
        <ul className="text-sm text-gray-400 space-y-1">
          <li>• <strong>Leverage</strong>: Higher leverage = more buying power but higher risk</li>
          <li>• <strong>Margin Call</strong>: Trades auto-close when loss reaches wallet balance</li>
          <li>• <strong>Intraday (MIS)</strong>: Orders that must be squared off same day</li>
          <li>• <strong>Carry Forward (NRML)</strong>: Orders that can be held till expiry</li>
        </ul>
      </div>
    </div>
  );
};

// Charge Management - Spread and Commission with multiple charge types
const ChargeManagement = () => {
  const { admin } = useAuth();
  const isSuperAdmin = admin?.role === 'SUPER_ADMIN';
  const [chargeSettings, setChargeSettings] = useState({
    spread: 0,
    commissionType: 'PER_LOT',
    perLotCharge: 0,
    perTradeCharge: 0,
    perCroreCharge: 0
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchChargeSettings();
  }, []);

  const fetchChargeSettings = async () => {
    try {
      const { data } = await axios.get('/api/trading/admin/charge-settings', {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      if (data) {
        setChargeSettings({
          spread: data.spread || 0,
          commissionType: data.commissionType || 'PER_LOT',
          perLotCharge: data.perLotCharge || data.commission || 0,
          perTradeCharge: data.perTradeCharge || 0,
          perCroreCharge: data.perCroreCharge || 0
        });
      }
    } catch (error) {
      console.error('Error fetching charge settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage({ type: '', text: '' });
    try {
      await axios.post('/api/trading/admin/charge-settings', chargeSettings, {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      setMessage({ type: 'success', text: 'Charge settings saved successfully!' });
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Error saving settings' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><RefreshCw className="animate-spin" size={32} /></div>;
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Charge Management</h1>
          <p className="text-sm text-gray-400 mt-1">Configure spread and commission for trades</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 px-6 py-2 rounded-lg transition disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {message.text && (
        <div className={`mb-6 px-4 py-3 rounded-lg ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
          {message.text}
        </div>
      )}

      {/* Charge Settings */}
      <div className="bg-dark-800 rounded-lg p-6 max-w-3xl">
        <div className="space-y-6">
          {/* Spread */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Spread (Points)
            </label>
            <p className="text-xs text-gray-500 mb-3">
              Spread is added to buy price and subtracted from sell price. This is the difference between bid and ask price.
            </p>
            <div className="flex items-center gap-4">
              <input
                type="number"
                step="0.01"
                min="0"
                value={chargeSettings.spread}
                onChange={(e) => setChargeSettings({ ...chargeSettings, spread: parseFloat(e.target.value) || 0 })}
                className="w-48 bg-dark-700 border border-dark-600 rounded-lg px-4 py-3 text-lg font-mono focus:outline-none focus:border-green-500"
              />
              <span className="text-gray-400">points per trade</span>
            </div>
          </div>

          {/* Commission Type */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Commission Type
            </label>
            <p className="text-xs text-gray-500 mb-3">
              Select how commission should be calculated for trades.
            </p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: 'PER_LOT', label: 'Per Lot', desc: 'Charge per lot traded' },
                { value: 'PER_TRADE', label: 'Per Trade', desc: 'Fixed charge per trade' },
                { value: 'PER_CRORE', label: 'Per Crore', desc: 'Charge per ₹1 Cr turnover' }
              ].map(type => (
                <button
                  key={type.value}
                  onClick={() => setChargeSettings({ ...chargeSettings, commissionType: type.value })}
                  className={`p-3 rounded-lg border-2 text-left transition ${
                    chargeSettings.commissionType === type.value
                      ? 'border-green-500 bg-green-500/10'
                      : 'border-dark-600 bg-dark-700 hover:border-dark-500'
                  }`}
                >
                  <div className="font-semibold text-sm">{type.label}</div>
                  <div className="text-xs text-gray-500">{type.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Per Lot Charge */}
          {chargeSettings.commissionType === 'PER_LOT' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Per Lot Charge (₹)
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={chargeSettings.perLotCharge}
                  onChange={(e) => setChargeSettings({ ...chargeSettings, perLotCharge: parseFloat(e.target.value) || 0 })}
                  className="w-48 bg-dark-700 border border-dark-600 rounded-lg px-4 py-3 text-lg font-mono focus:outline-none focus:border-green-500"
                />
                <span className="text-gray-400">₹ per lot</span>
              </div>
              <div className="mt-2 text-sm text-yellow-400">
                Example: If charge is ₹20 and user trades 5 lots, total = ₹100
              </div>
            </div>
          )}

          {/* Per Trade Charge */}
          {chargeSettings.commissionType === 'PER_TRADE' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Per Trade Charge (₹)
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={chargeSettings.perTradeCharge}
                  onChange={(e) => setChargeSettings({ ...chargeSettings, perTradeCharge: parseFloat(e.target.value) || 0 })}
                  className="w-48 bg-dark-700 border border-dark-600 rounded-lg px-4 py-3 text-lg font-mono focus:outline-none focus:border-green-500"
                />
                <span className="text-gray-400">₹ per trade</span>
              </div>
              <div className="mt-2 text-sm text-yellow-400">
                Fixed charge applied to each trade regardless of quantity
              </div>
            </div>
          )}

          {/* Per Crore Charge */}
          {chargeSettings.commissionType === 'PER_CRORE' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Per Crore Charge (₹)
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={chargeSettings.perCroreCharge}
                  onChange={(e) => setChargeSettings({ ...chargeSettings, perCroreCharge: parseFloat(e.target.value) || 0 })}
                  className="w-48 bg-dark-700 border border-dark-600 rounded-lg px-4 py-3 text-lg font-mono focus:outline-none focus:border-green-500"
                />
                <span className="text-gray-400">₹ per crore turnover</span>
              </div>
              <div className="mt-2 text-sm text-yellow-400">
                Example: If charge is ₹500/Cr and trade value is ₹50 Lakhs, commission = ₹250
              </div>
            </div>
          )}
        </div>

        {/* Preview */}
        <div className="mt-8 bg-dark-700 rounded-lg p-4">
          <h3 className="font-medium mb-3 text-gray-300">Trade Charge Preview</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-dark-600 rounded p-3">
              <div className="text-xs text-gray-400 mb-1">Spread</div>
              <div className="text-xl font-bold text-blue-400">{chargeSettings.spread} pts</div>
            </div>
            <div className="bg-dark-600 rounded p-3">
              <div className="text-xs text-gray-400 mb-1">Commission ({chargeSettings.commissionType.replace('_', ' ')})</div>
              <div className="text-xl font-bold text-purple-400">
                ₹{chargeSettings.commissionType === 'PER_LOT' ? chargeSettings.perLotCharge : 
                   chargeSettings.commissionType === 'PER_TRADE' ? chargeSettings.perTradeCharge :
                   chargeSettings.perCroreCharge}
                {chargeSettings.commissionType === 'PER_LOT' ? '/lot' : 
                 chargeSettings.commissionType === 'PER_TRADE' ? '/trade' : '/Cr'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="mt-6 bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 max-w-3xl">
        <h4 className="font-medium text-blue-400 mb-2">How Charges Work</h4>
        <ul className="text-sm text-gray-400 space-y-1">
          <li>• <strong>Spread</strong>: Added to buy price, subtracted from sell price (affects entry/exit price)</li>
          <li>• <strong>Per Lot</strong>: Commission = Charge × Number of Lots</li>
          <li>• <strong>Per Trade</strong>: Fixed commission per trade regardless of size</li>
          <li>• <strong>Per Crore</strong>: Commission = (Trade Value ÷ 1,00,00,000) × Charge</li>
        </ul>
      </div>
    </div>
  );
};

// Profile & Password Settings
const ProfileSettings = () => {
  const { admin, setAdmin } = useAuth();
  const [profileData, setProfileData] = useState({ name: admin?.name || '', email: admin?.email || '', phone: admin?.phone || '' });
  const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [brandingData, setBrandingData] = useState({ brandName: admin?.branding?.brandName || '', logoUrl: admin?.branding?.logoUrl || '', welcomeTitle: admin?.branding?.welcomeTitle || '' });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showPasswords, setShowPasswords] = useState(false);

  const handleBrandingUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const { data } = await axios.put('/api/admin/manage/branding', brandingData, {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      setAdmin({ ...admin, branding: data.branding });
      setMessage({ type: 'success', text: 'Branding updated successfully' });
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Error updating branding' });
    } finally {
      setLoading(false);
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const { data } = await axios.put('/api/admin/manage/update-profile', profileData, {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      setAdmin({ ...admin, ...data });
      setMessage({ type: 'success', text: 'Profile updated successfully' });
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Error updating profile' });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }
    if (passwordData.newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters' });
      return;
    }
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      await axios.put('/api/admin/manage/change-password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      }, {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setMessage({ type: 'success', text: 'Password changed successfully' });
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Error changing password' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-bold mb-6">Profile & Password</h1>

      {message.text && (
        <div className={`mb-6 p-4 rounded ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
          {message.text}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Profile Update */}
        <div className="bg-dark-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Update Profile</h2>
          <form onSubmit={handleProfileUpdate} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Name</label>
              <input
                type="text"
                value={profileData.name}
                onChange={e => setProfileData({ ...profileData, name: e.target.value })}
                className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Email</label>
              <input
                type="email"
                value={profileData.email}
                onChange={e => setProfileData({ ...profileData, email: e.target.value })}
                className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Phone</label>
              <input
                type="text"
                value={profileData.phone}
                onChange={e => setProfileData({ ...profileData, phone: e.target.value })}
                className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2"
              />
            </div>
            <button type="submit" disabled={loading} className="w-full bg-green-600 hover:bg-green-700 py-2 rounded">
              {loading ? 'Saving...' : 'Update Profile'}
            </button>
          </form>
        </div>

        {/* Password Change */}
        <div className="bg-dark-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Change Password</h2>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Current Password</label>
              <div className="relative">
                <input
                  type={showPasswords ? 'text' : 'password'}
                  value={passwordData.currentPassword}
                  onChange={e => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2 pr-10"
                  required
                />
                <button type="button" onClick={() => setShowPasswords(!showPasswords)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showPasswords ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">New Password</label>
              <input
                type={showPasswords ? 'text' : 'password'}
                value={passwordData.newPassword}
                onChange={e => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2"
                required
                minLength={6}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Confirm New Password</label>
              <input
                type={showPasswords ? 'text' : 'password'}
                value={passwordData.confirmPassword}
                onChange={e => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2"
                required
                minLength={6}
              />
            </div>
            <button type="submit" disabled={loading} className="w-full bg-yellow-600 hover:bg-yellow-700 py-2 rounded">
              {loading ? 'Changing...' : 'Change Password'}
            </button>
          </form>
        </div>
      </div>

      {/* Branding Settings - Only for ADMIN role */}
      {admin?.role === 'ADMIN' && (
        <div className="mt-6 bg-dark-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Branding Settings</h2>
          <p className="text-gray-400 text-sm mb-4">
            Customize your login page branding. Users who register via your referral link will see this branding.
          </p>
          <form onSubmit={handleBrandingUpdate} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Brand Name</label>
              <input
                type="text"
                value={brandingData.brandName}
                onChange={e => setBrandingData({ ...brandingData, brandName: e.target.value })}
                className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2"
                placeholder="Your Brand Name (e.g., FKG)"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Welcome Title</label>
              <input
                type="text"
                value={brandingData.welcomeTitle}
                onChange={e => setBrandingData({ ...brandingData, welcomeTitle: e.target.value })}
                className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2 text-lg"
                placeholder="Welcome to FKG Trading"
              />
              <p className="text-xs text-gray-500 mt-1">This title will be displayed prominently on the login page</p>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Logo</label>
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <label className="flex-1 cursor-pointer">
                    <div className="flex items-center justify-center gap-2 bg-dark-700 border border-dark-600 border-dashed rounded px-4 py-3 hover:border-green-500 transition">
                      <Plus size={18} className="text-gray-400" />
                      <span className="text-gray-400">Upload Logo</span>
                    </div>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/svg+xml,image/webp"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files[0];
                        if (!file) return;
                        if (file.size > 5 * 1024 * 1024) {
                          setMessage({ type: 'error', text: 'File size must be less than 5MB' });
                          return;
                        }
                        setLoading(true);
                        setMessage({ type: '', text: '' });
                        try {
                          const formData = new FormData();
                          formData.append('logo', file);
                          const { data } = await axios.post('/api/upload/logo', formData, {
                            headers: { 
                              Authorization: `Bearer ${admin.token}`,
                              'Content-Type': 'multipart/form-data'
                            }
                          });
                          setBrandingData({ ...brandingData, logoUrl: data.logoUrl });
                          setAdmin({ ...admin, branding: data.branding });
                          setMessage({ type: 'success', text: 'Logo uploaded successfully' });
                        } catch (error) {
                          setMessage({ type: 'error', text: error.response?.data?.message || 'Error uploading logo' });
                        } finally {
                          setLoading(false);
                        }
                      }}
                    />
                  </label>
                  {brandingData.logoUrl && (
                    <button
                      type="button"
                      onClick={async () => {
                        setLoading(true);
                        try {
                          await axios.delete('/api/upload/logo', {
                            headers: { Authorization: `Bearer ${admin.token}` }
                          });
                          setBrandingData({ ...brandingData, logoUrl: '' });
                          setAdmin({ ...admin, branding: { ...admin.branding, logoUrl: '' } });
                          setMessage({ type: 'success', text: 'Logo removed' });
                        } catch (error) {
                          setMessage({ type: 'error', text: 'Error removing logo' });
                        } finally {
                          setLoading(false);
                        }
                      }}
                      className="px-3 py-3 bg-red-600/20 text-red-400 rounded hover:bg-red-600/30"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-500">Supported: JPEG, PNG, GIF, SVG, WebP (max 5MB)</p>
              </div>
            </div>
            {brandingData.logoUrl && (
              <div className="p-3 bg-dark-700 rounded">
                <p className="text-sm text-gray-400 mb-2">Preview:</p>
                <img src={brandingData.logoUrl} alt="Logo Preview" className="h-16 object-contain" onError={(e) => e.target.style.display = 'none'} />
              </div>
            )}
            <button type="submit" disabled={loading} className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded">
              {loading ? 'Saving...' : 'Update Branding'}
            </button>
          </form>
          {admin?.referralUrl && (
            <div className="mt-4 p-3 bg-dark-700 rounded">
              <p className="text-sm text-gray-400 mb-1">Your Referral Link:</p>
              <code className="text-green-400 text-sm break-all">{admin.referralUrl}</code>
            </div>
          )}
        </div>
      )}

      {/* Account Info */}
      <div className="mt-6 bg-dark-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Account Information</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="p-3 bg-dark-700 rounded">
            <div className="text-gray-400">Role</div>
            <div className={admin?.role === 'SUPER_ADMIN' ? 'text-yellow-400 font-bold' : 'text-purple-400 font-bold'}>{admin?.role}</div>
          </div>
          <div className="p-3 bg-dark-700 rounded">
            <div className="text-gray-400">Username</div>
            <div>{admin?.username}</div>
          </div>
          {admin?.adminCode && (
            <div className="p-3 bg-dark-700 rounded">
              <div className="text-gray-400">Admin Code</div>
              <div className="font-mono text-purple-400">{admin?.adminCode}</div>
            </div>
          )}
          <div className="p-3 bg-dark-700 rounded">
            <div className="text-gray-400">Status</div>
            <div className="text-green-400">{admin?.status || 'ACTIVE'}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// All Users Management (Super Admin only) - View all users and transfer between admins
const AllUsersManagement = () => {
  const { admin } = useAuth();
  const isSuperAdmin = admin?.role === 'SUPER_ADMIN';
  const [users, setUsers] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [selectedAdminFilter, setSelectedAdminFilter] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [showUserEditModal, setShowUserEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showCryptoWalletModal, setShowCryptoWalletModal] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [targetAdminId, setTargetAdminId] = useState('');
  const [targetUserId, setTargetUserId] = useState('');
  const [transferAdminFilter, setTransferAdminFilter] = useState(''); // Filter admins in transfer modal
  const [transferBrokerFilter, setTransferBrokerFilter] = useState(''); // Filter brokers in transfer modal
  const [filteredBrokers, setFilteredBrokers] = useState([]); // Brokers filtered by admin
  const [filteredSubBrokers, setFilteredSubBrokers] = useState([]); // SubBrokers filtered by broker
  const [transferring, setTransferring] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copying, setCopying] = useState(false);
  const [expandedSegment, setExpandedSegment] = useState(null);
  const [selectedScriptSegment, setSelectedScriptSegment] = useState(null);
  const [selectedScript, setSelectedScript] = useState(null);
  const [editFormData, setEditFormData] = useState(null);
  
  const defaultSegmentOptions = ['MCX', 'NSEINDEX', 'NSESTOCK', 'BSE', 'EQ', 'NSEFUT', 'NSEOPT', 'MCXFUT', 'MCXOPT', 'NSE-EQ', 'BSE-FUT', 'BSE-OPT', 'CRYPTO'];
  
  const defaultSegmentSettings = {
    enabled: false,
    fraction: false,
    maxExchangeLots: 100,
    commissionType: 'PER_LOT',
    commissionLot: 0,
    maxLots: 50,
    minLots: 1,
    orderLots: 10,
    exposureIntraday: 1,
    exposureCarryForward: 1,
    optionBuy: {
      allowed: true,
      fraction: false,
      commissionType: 'PER_LOT',
      commission: 0,
      strikeSelection: 50,
      maxExchangeLots: 100
    },
    optionSell: {
      allowed: true,
      fraction: false,
      commissionType: 'PER_LOT',
      commission: 0,
      strikeSelection: 50,
      maxExchangeLots: 100
    }
  };
  
  const [marketSegments, setMarketSegments] = useState([]);
  
  // Dynamic segment options from market data + CRYPTO always included
  const segmentOptions = [...(marketSegments.length > 0 
    ? marketSegments.map(s => s.id) 
    : defaultSegmentOptions), 'CRYPTO'].filter((v, i, a) => a.indexOf(v) === i);
  const [marketScripts, setMarketScripts] = useState({});
  const [segmentSymbols, setSegmentSymbols] = useState({
    NSEFUT: ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'NIFTYIT'],
    NSEOPT: ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'NIFTYIT'],
    MCXFUT: ['CRUDEOIL', 'CRUDEM', 'GOLD', 'SILVER', 'SILVERMIC', 'NATURALGAS', 'NATGASMINI', 'COPPER', 'ZINC', 'ZINCMINI', 'ALUMINIUM', 'LEAD', 'LEADMINI', 'NICKEL'],
    MCXOPT: ['CRUDEOIL', 'GOLD', 'SILVER', 'NATURALGAS', 'COPPER'],
    'NSE-EQ': ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'SBIN', 'BHARTIARTL', 'ITC', 'KOTAKBANK', 'LT'],
    'BSE-FUT': ['SENSEX', 'BANKEX'],
    'BSE-OPT': ['SENSEX', 'BANKEX'],
    'CRYPTO': ['BTC', 'ETH', 'BNB', 'XRP', 'SOL', 'DOGE', 'ADA', 'MATIC', 'LTC', 'AVAX']
  });

  useEffect(() => {
    fetchAllUsers();
    fetchAdmins();
    fetchMarketData();
  }, []);
  
  // Fetch segments and scripts from market data
  const fetchMarketData = async () => {
    try {
      const { data } = await axios.get('/api/instruments/settings-data', {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      
      setMarketSegments(data.segments || []);
      setMarketScripts(data.scripts || {});
      
      // Build segment symbols from scripts data
      const newSegmentSymbols = {};
      for (const [segKey, scripts] of Object.entries(data.scripts || {})) {
        newSegmentSymbols[segKey] = scripts.map(s => s.baseSymbol);
      }
      if (Object.keys(newSegmentSymbols).length > 0) {
        setSegmentSymbols(newSegmentSymbols);
      }
    } catch (error) {
      console.error('Error fetching market data:', error);
    }
  };

  const fetchAllUsers = async () => {
    try {
      const { data } = await axios.get('/api/admin/manage/all-users', {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      setUsers(data);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAdmins = async () => {
    try {
      const { data } = await axios.get('/api/admin/manage/admins', {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      setAdmins(data);
    } catch (error) {
      console.error('Error fetching admins:', error);
    }
  };

  // Filter brokers when admin filter changes
  useEffect(() => {
    if (transferAdminFilter) {
      const brokers = admins.filter(a => 
        a.role === 'BROKER' && 
        (a.parentId?._id === transferAdminFilter || a.parentId === transferAdminFilter)
      );
      setFilteredBrokers(brokers);
      setTransferBrokerFilter('');
      setFilteredSubBrokers([]);
      // Reset target if not in filtered list
      if (targetAdminId && !brokers.find(b => b._id === targetAdminId)) {
        const selectedAdmin = admins.find(a => a._id === transferAdminFilter);
        if (selectedAdmin && targetAdminId !== transferAdminFilter) {
          setTargetAdminId('');
        }
      }
    } else {
      setFilteredBrokers(admins.filter(a => a.role === 'BROKER'));
      setFilteredSubBrokers(admins.filter(a => a.role === 'SUB_BROKER'));
    }
  }, [transferAdminFilter, admins]);

  // Filter sub-brokers when broker filter changes
  useEffect(() => {
    if (transferBrokerFilter) {
      const subBrokers = admins.filter(a => 
        a.role === 'SUB_BROKER' && 
        (a.parentId?._id === transferBrokerFilter || a.parentId === transferBrokerFilter)
      );
      setFilteredSubBrokers(subBrokers);
      // Reset target if it's a sub-broker not in filtered list
      const currentTarget = admins.find(a => a._id === targetAdminId);
      if (currentTarget?.role === 'SUB_BROKER' && !subBrokers.find(s => s._id === targetAdminId)) {
        setTargetAdminId('');
      }
    } else if (transferAdminFilter) {
      // Show all sub-brokers under brokers of selected admin
      const brokerIds = filteredBrokers.map(b => b._id);
      const subBrokers = admins.filter(a => 
        a.role === 'SUB_BROKER' && 
        brokerIds.includes(a.parentId?._id || a.parentId)
      );
      setFilteredSubBrokers(subBrokers);
    } else {
      setFilteredSubBrokers(admins.filter(a => a.role === 'SUB_BROKER'));
    }
  }, [transferBrokerFilter, transferAdminFilter, filteredBrokers, admins]);

  const handleTransfer = async () => {
    if (!selectedUser || !targetAdminId) return;
    
    setTransferring(true);
    try {
      await axios.post(`/api/admin/manage/users/${selectedUser._id}/transfer`, 
        { targetAdminId },
        { headers: { Authorization: `Bearer ${admin.token}` } }
      );
      alert('User transferred successfully!');
      setShowTransferModal(false);
      setSelectedUser(null);
      setTargetAdminId('');
      setTransferAdminFilter('');
      setTransferBrokerFilter('');
      fetchAllUsers();
    } catch (error) {
      alert(error.response?.data?.message || 'Error transferring user');
    } finally {
      setTransferring(false);
    }
  };

  const handleDeleteUser = async (userId, username) => {
    if (!confirm(`Are you sure you want to delete user "${username}"? This action cannot be undone.`)) {
      return;
    }
    try {
      await axios.delete(`/api/admin/users/${userId}`, {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      alert('User deleted successfully');
      fetchAllUsers();
    } catch (error) {
      alert(error.response?.data?.message || 'Error deleting user');
    }
  };

  const handleForceLogoutUser = async (userId, username) => {
    if (!confirm(`Are you sure you want to force logout user "${username}"? They will be logged out from all devices.`)) {
      return;
    }
    try {
      await axios.post(`/api/admin/users/${userId}/force-logout`, {}, {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      alert('User has been logged out successfully');
      fetchAllUsers();
    } catch (error) {
      alert(error.response?.data?.message || 'Error logging out user');
    }
  };

  const openEditModal = (user) => {
    setSelectedUser(user);
    const userSegmentKeys = Object.keys(user.segmentPermissions || {});
    const allSegments = Array.from(new Set([
      ...segmentOptions,
      ...userSegmentKeys,
      ...defaultSegmentOptions
    ]));

    const normalizedSegments = allSegments.reduce((acc, seg) => {
      acc[seg] = {
        ...defaultSegmentSettings,
        ...(user.segmentPermissions?.[seg] || {})
      };
      return acc;
    }, {});

    setEditFormData({
      segmentPermissions: normalizedSegments,
      scriptSettings: user.scriptSettings || {}
    });
    setExpandedSegment(null);
    setSelectedScriptSegment(null);
    setSelectedScript(null);
    setShowEditModal(true);
  };

  const handleEditSegmentPermissionChange = (segment, field, value) => {
    setEditFormData(prev => ({
      ...prev,
      segmentPermissions: {
        ...prev.segmentPermissions,
        [segment]: {
          ...prev.segmentPermissions[segment],
          [field]: value
        }
      }
    }));
  };

  const handleSaveUserSettings = async () => {
    if (!selectedUser || !editFormData) return;
    
    setSaving(true);
    try {
      await axios.put(`/api/admin/manage/users/${selectedUser._id}/settings`, 
        {
          segmentPermissions: editFormData.segmentPermissions,
          scriptSettings: editFormData.scriptSettings
        },
        { headers: { Authorization: `Bearer ${admin.token}` } }
      );
      alert('User settings updated successfully!');
      setShowEditModal(false);
      setSelectedUser(null);
      setEditFormData(null);
      fetchAllUsers();
    } catch (error) {
      alert(error.response?.data?.message || 'Error updating user settings');
    } finally {
      setSaving(false);
    }
  };

  // Save only a single script's settings (merge with existing)
  const handleSaveScriptSettings = async (symbol) => {
    if (!selectedUser || !editFormData || !editFormData.scriptSettings?.[symbol]) return;
    
    setSaving(true);
    try {
      await axios.put(`/api/admin/manage/users/${selectedUser._id}/script-settings/${encodeURIComponent(symbol)}`, 
        editFormData.scriptSettings[symbol],
        { headers: { Authorization: `Bearer ${admin.token}` } }
      );
      alert(`Script settings for ${symbol} saved successfully!`);
    } catch (error) {
      alert(error.response?.data?.message || 'Error saving script settings');
    } finally {
      setSaving(false);
    }
  };

  const handleCopySettings = async () => {
    if (!selectedUser || !targetUserId) return;
    
    setCopying(true);
    try {
      await axios.post(`/api/admin/manage/users/${targetUserId}/copy-settings`, 
        {
          sourceUserId: selectedUser._id,
          segmentPermissions: selectedUser.segmentPermissions,
          scriptSettings: selectedUser.scriptSettings
        },
        { headers: { Authorization: `Bearer ${admin.token}` } }
      );
      alert('Settings copied successfully!');
      setShowCopyModal(false);
      setSelectedUser(null);
      setTargetUserId('');
      fetchAllUsers();
    } catch (error) {
      alert(error.response?.data?.message || 'Error copying settings');
    } finally {
      setCopying(false);
    }
  };

  // Pre-filter by admin first
  const adminFilteredUsers = useMemo(() => {
    if (!selectedAdminFilter) return users;
    return users.filter(u => u.adminCode === selectedAdminFilter);
  }, [users, selectedAdminFilter]);

  const { currentPage, setCurrentPage, totalPages, paginatedData: paginatedUsers, totalItems } = usePagination(
    adminFilteredUsers, 20, filter, ['username', 'email', 'fullName', 'adminCode', 'phone']
  );

  if (loading) {
    return <div className="flex items-center justify-center h-64"><RefreshCw className="animate-spin" size={32} /></div>;
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">All Users</h1>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowNotificationModal(true)}
            className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg"
          >
            <FileText size={18} />
            Send Notification
          </button>
          <div className="text-sm text-gray-400">
            Total: {users.length} users
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-4">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm text-gray-400 mb-1">Filter by Admin/Broker/SubBroker</label>
          <select
            value={selectedAdminFilter}
            onChange={(e) => setSelectedAdminFilter(e.target.value)}
            className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2"
          >
            <option value="">All Admins/Brokers/SubBrokers</option>
            {admins.map(adm => (
              <option key={adm._id} value={adm.adminCode}>
                [{adm.role === 'ADMIN' ? 'Admin' : adm.role === 'BROKER' ? 'Broker' : 'SubBroker'}] {adm.name || adm.username} ({adm.adminCode})
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm text-gray-400 mb-1">Search</label>
          <input
            type="text"
            placeholder="Search by username, email, name..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2 text-white"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-dark-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-dark-700">
              <tr>
                <th className="px-4 py-3 text-left text-sm">User</th>
                <th className="px-4 py-3 text-left text-sm">Admin</th>
                <th className="px-4 py-3 text-left text-sm">Wallet</th>
                <th className="px-4 py-3 text-left text-sm">Status</th>
                <th className="px-4 py-3 text-left text-sm">Joined</th>
                <th className="px-4 py-3 text-left text-sm">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-700">
              {paginatedUsers.map(user => (
                <tr key={user._id} className="hover:bg-dark-700/50">
                  <td className="px-4 py-3">
                    <div>
                      <div className="font-medium">{user.fullName || user.username}</div>
                      <div className="text-sm text-gray-400">{user.email}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm">
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded text-xs ${
                          user.creatorRole === 'ADMIN' ? 'bg-purple-500/20 text-purple-400' :
                          user.creatorRole === 'BROKER' ? 'bg-blue-500/20 text-blue-400' :
                          user.creatorRole === 'SUB_BROKER' ? 'bg-green-500/20 text-green-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {user.creatorRole === 'ADMIN' ? 'Admin' : user.creatorRole === 'BROKER' ? 'Broker' : user.creatorRole === 'SUB_BROKER' ? 'SubBroker' : 'N/A'}
                        </span>
                        <span className="font-medium">{user.admin?.name || 'N/A'}</span>
                      </div>
                      <div className="text-gray-400">{user.adminCode}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-green-400 font-medium">₹{(user.wallet?.balance || 0).toLocaleString()}</div>
                    <div className="text-xs text-blue-400">Trading: ₹{(user.wallet?.tradingBalance || 0).toLocaleString()}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs ${user.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => { setSelectedUser(user); setShowUserEditModal(true); }}
                        className="p-2 hover:bg-dark-600 rounded transition text-blue-400"
                        title="Edit User"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => { setSelectedUser(user); setShowPasswordModal(true); }}
                        className="p-2 hover:bg-dark-600 rounded transition text-yellow-400"
                        title="Change Password"
                      >
                        <Key size={16} />
                      </button>
                      <button
                        onClick={() => openEditModal(user)}
                        className="p-2 hover:bg-dark-600 rounded transition text-purple-400"
                        title="Edit Settings"
                      >
                        <Settings size={16} />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedUser(user);
                          setShowCopyModal(true);
                        }}
                        className="p-2 hover:bg-dark-600 rounded transition text-cyan-400"
                        title="Copy Settings"
                      >
                        <Copy size={16} />
                      </button>
                      <button
                        onClick={() => { setSelectedUser(user); setShowWalletModal(true); }}
                        className="p-2 hover:bg-dark-600 rounded transition text-green-400"
                        title="Manage INR Wallet"
                      >
                        <Wallet size={16} />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedUser(user);
                          setShowTransferModal(true);
                        }}
                        className="p-2 hover:bg-dark-600 rounded transition text-purple-400"
                        title="Transfer User"
                      >
                        <UserPlus size={16} />
                      </button>
                      {isSuperAdmin && (
                        <button
                          onClick={() => handleForceLogoutUser(user._id, user.fullName || user.username)}
                          className="p-2 hover:bg-dark-600 rounded transition text-orange-400"
                          title="Force Logout User"
                        >
                          <LogOut size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteUser(user._id, user.username)}
                        className="p-2 hover:bg-dark-600 rounded transition text-red-400"
                        title="Delete User"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalItems={totalItems}
          itemsPerPage={20}
        />
      </div>

      {/* Transfer Modal */}
      {showTransferModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-dark-800 rounded-lg p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Transfer User</h2>
            
            <div className="mb-4 p-3 bg-dark-700 rounded-lg">
              <div className="text-sm text-gray-400">User</div>
              <div className="font-medium">{selectedUser.fullName || selectedUser.username}</div>
              <div className="text-sm text-gray-400">{selectedUser.email}</div>
              <div className="text-sm text-gray-400 mt-1">Current Admin: {selectedUser.adminCode}</div>
            </div>

            {/* Step 1: Filter by Admin (Optional) */}
            <div className="mb-3">
              <label className="block text-sm text-gray-400 mb-2">Filter by Admin (Optional)</label>
              <select
                value={transferAdminFilter}
                onChange={(e) => setTransferAdminFilter(e.target.value)}
                className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2 text-white"
              >
                <option value="">-- All Admins --</option>
                {admins.filter(a => a.role === 'ADMIN').map(a => (
                  <option key={a._id} value={a._id}>
                    {a.name || a.username} ({a.adminCode})
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">Select an admin to filter brokers/sub-brokers</p>
            </div>

            {/* Step 2: Filter by Broker (Optional) */}
            {(transferAdminFilter || filteredBrokers.length > 0) && (
              <div className="mb-3">
                <label className="block text-sm text-gray-400 mb-2">Filter by Broker (Optional)</label>
                <select
                  value={transferBrokerFilter}
                  onChange={(e) => setTransferBrokerFilter(e.target.value)}
                  className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2 text-white"
                >
                  <option value="">-- All Brokers --</option>
                  {filteredBrokers.map(b => (
                    <option key={b._id} value={b._id}>
                      {b.name || b.username} ({b.adminCode})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Select a broker to filter sub-brokers</p>
              </div>
            )}

            {/* Step 3: Select Target */}
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Transfer to *</label>
              <select
                value={targetAdminId}
                onChange={(e) => setTargetAdminId(e.target.value)}
                className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2 text-white"
              >
                <option value="">-- Select Target --</option>
                
                {/* Super Admin option */}
                <optgroup label="Super Admin">
                  <option value={admin._id}>
                    Super Admin ({admin.adminCode})
                  </option>
                </optgroup>
                
                {/* Admins - always show all admins */}
                {admins.filter(a => a.role === 'ADMIN' && a.adminCode !== selectedUser.adminCode).length > 0 && (
                  <optgroup label="Admins">
                    {admins
                      .filter(a => a.role === 'ADMIN' && a.adminCode !== selectedUser.adminCode)
                      .map(a => (
                        <option key={a._id} value={a._id}>
                          {a.name || a.username} ({a.adminCode})
                        </option>
                      ))}
                  </optgroup>
                )}
                
                {/* Brokers - filtered */}
                {filteredBrokers.filter(b => b.adminCode !== selectedUser.adminCode).length > 0 && (
                  <optgroup label="Brokers">
                    {filteredBrokers
                      .filter(b => b.adminCode !== selectedUser.adminCode)
                      .map(b => (
                        <option key={b._id} value={b._id}>
                          {b.name || b.username} ({b.adminCode}) {b.parentId?.name ? `- Under ${b.parentId.name}` : ''}
                        </option>
                      ))}
                  </optgroup>
                )}
                
                {/* Sub-Brokers - filtered */}
                {filteredSubBrokers.filter(s => s.adminCode !== selectedUser.adminCode).length > 0 && (
                  <optgroup label="Sub Brokers">
                    {filteredSubBrokers
                      .filter(s => s.adminCode !== selectedUser.adminCode)
                      .map(s => (
                        <option key={s._id} value={s._id}>
                          {s.name || s.username} ({s.adminCode}) {s.parentId?.name ? `- Under ${s.parentId.name}` : ''}
                        </option>
                      ))}
                  </optgroup>
                )}
              </select>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowTransferModal(false);
                  setSelectedUser(null);
                  setTargetAdminId('');
                  setTransferAdminFilter('');
                  setTransferBrokerFilter('');
                }}
                className="flex-1 bg-dark-600 hover:bg-dark-500 text-white py-2 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleTransfer}
                disabled={!targetAdminId || transferring}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2 rounded-lg"
              >
                {transferring ? 'Transferring...' : 'Transfer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Copy Settings Modal */}
      {showCopyModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-dark-800 rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold mb-4">Copy User Settings</h2>
            
            <div className="mb-4 p-3 bg-dark-700 rounded-lg">
              <div className="text-sm text-gray-400">Copy From</div>
              <div className="font-medium">{selectedUser.fullName || selectedUser.username}</div>
              <div className="text-sm text-gray-400">{selectedUser.email}</div>
            </div>

            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Copy To User</label>
              <select
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value)}
                className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2 text-white"
              >
                <option value="">Select User</option>
                {users.filter(u => u._id !== selectedUser._id).map(u => (
                  <option key={u._id} value={u._id}>
                    {u.fullName || u.username} ({u.email}) - {u.adminCode}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-600/50 rounded-lg">
              <div className="text-sm text-yellow-400">
                <strong>Note:</strong> This will copy segment permissions and script settings from the selected user to the target user. The target user's existing settings will be overwritten.
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCopyModal(false);
                  setSelectedUser(null);
                  setTargetUserId('');
                }}
                className="flex-1 bg-dark-600 hover:bg-dark-500 text-white py-2 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleCopySettings}
                disabled={!targetUserId || copying}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white py-2 rounded-lg"
              >
                {copying ? 'Copying...' : 'Copy Settings'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Settings Modal */}
      {showEditModal && selectedUser && editFormData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-dark-800 rounded-lg p-6 w-full max-w-4xl mx-4 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Edit User Settings</h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedUser(null);
                  setEditFormData(null);
                }}
                className="text-gray-400 hover:text-white"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="mb-4 p-3 bg-dark-700 rounded-lg">
              <div className="text-sm text-gray-400">User</div>
              <div className="font-medium">{selectedUser.fullName || selectedUser.username}</div>
              <div className="text-sm text-gray-400">{selectedUser.email}</div>
            </div>

            {/* Segment Permissions */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-blue-400 mb-3">Segment Permissions</h3>
              <div className="flex flex-wrap gap-2 mb-4">
                {segmentOptions.map(segment => (
                  <button
                    key={segment}
                    type="button"
                    onClick={() => setExpandedSegment(expandedSegment === segment ? null : segment)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      expandedSegment === segment
                        ? 'bg-blue-600 text-white'
                        : editFormData.segmentPermissions?.[segment]?.enabled
                          ? 'bg-green-600/20 text-green-400 border border-green-600'
                          : 'bg-dark-600 text-gray-400 hover:bg-dark-500'
                    }`}
                  >
                    {segment}
                  </button>
                ))}
              </div>

              {/* Expanded Segment Settings */}
              {expandedSegment && editFormData.segmentPermissions?.[expandedSegment] && (
                <div className="bg-dark-700 rounded-lg p-4 border border-dark-600">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-md font-semibold text-blue-400">{expandedSegment} Settings</h4>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleEditSegmentPermissionChange(expandedSegment, 'fraction', !editFormData.segmentPermissions[expandedSegment].fraction)}
                        className={`px-3 py-1 rounded text-xs font-medium ${
                          editFormData.segmentPermissions[expandedSegment].fraction
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-600 text-white'
                        }`}
                      >
                        {editFormData.segmentPermissions[expandedSegment].fraction ? 'Fraction On' : 'Fraction Off'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEditSegmentPermissionChange(expandedSegment, 'enabled', !editFormData.segmentPermissions[expandedSegment].enabled)}
                        className={`px-3 py-1 rounded text-xs font-medium ${
                          editFormData.segmentPermissions[expandedSegment].enabled
                            ? 'bg-green-600 text-white'
                            : 'bg-red-600 text-white'
                        }`}
                      >
                        {editFormData.segmentPermissions[expandedSegment].enabled ? 'Enabled' : 'Disabled'}
                      </button>
                    </div>
                  </div>
                  
                  {/* General Settings */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Max Exchange Lots</label>
                      <input
                        type="number"
                        value={editFormData.segmentPermissions[expandedSegment].maxExchangeLots || 100}
                        onChange={(e) => handleEditSegmentPermissionChange(expandedSegment, 'maxExchangeLots', Number(e.target.value))}
                        className="w-full bg-dark-800 border border-dark-600 rounded px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Max Lots</label>
                      <input
                        type="number"
                        value={editFormData.segmentPermissions[expandedSegment].maxLots || 50}
                        onChange={(e) => handleEditSegmentPermissionChange(expandedSegment, 'maxLots', Number(e.target.value))}
                        className="w-full bg-dark-800 border border-dark-600 rounded px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Min Lots</label>
                      <input
                        type="number"
                        value={editFormData.segmentPermissions[expandedSegment].minLots || 1}
                        onChange={(e) => handleEditSegmentPermissionChange(expandedSegment, 'minLots', Number(e.target.value))}
                        className="w-full bg-dark-800 border border-dark-600 rounded px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Order Lots</label>
                      <input
                        type="number"
                        value={editFormData.segmentPermissions[expandedSegment].orderLots || 10}
                        onChange={(e) => handleEditSegmentPermissionChange(expandedSegment, 'orderLots', Number(e.target.value))}
                        className="w-full bg-dark-800 border border-dark-600 rounded px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Commission Type</label>
                      <select
                        value={editFormData.segmentPermissions[expandedSegment].commissionType || 'PER_LOT'}
                        onChange={(e) => handleEditSegmentPermissionChange(expandedSegment, 'commissionType', e.target.value)}
                        className="w-full bg-dark-800 border border-dark-600 rounded px-2 py-1.5 text-sm"
                      >
                        <option value="PER_LOT">Per Lot</option>
                        <option value="PER_TRADE">Per Trade</option>
                        <option value="PER_CRORE">Per Crore</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Commission (₹)</label>
                      <input
                        type="number"
                        value={editFormData.segmentPermissions[expandedSegment].commissionLot || 0}
                        onChange={(e) => handleEditSegmentPermissionChange(expandedSegment, 'commissionLot', Number(e.target.value))}
                        className="w-full bg-dark-800 border border-dark-600 rounded px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Exposure Intraday</label>
                      <input
                        type="number"
                        value={editFormData.segmentPermissions[expandedSegment].exposureIntraday || 1}
                        onChange={(e) => handleEditSegmentPermissionChange(expandedSegment, 'exposureIntraday', Number(e.target.value))}
                        className="w-full bg-dark-800 border border-dark-600 rounded px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Exposure Carry Forward</label>
                      <input
                        type="number"
                        value={editFormData.segmentPermissions[expandedSegment].exposureCarryForward || 1}
                        onChange={(e) => handleEditSegmentPermissionChange(expandedSegment, 'exposureCarryForward', Number(e.target.value))}
                        className="w-full bg-dark-800 border border-dark-600 rounded px-2 py-1.5 text-sm"
                      />
                    </div>
                  </div>

                  {/* Option Buy & Sell Settings */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Option Buy */}
                    <div className="bg-dark-800 rounded-lg p-3 border border-green-900/50">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="text-sm font-medium text-green-400">Option Buy</h5>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleEditSegmentPermissionChange(expandedSegment, 'optionBuy', {
                              ...editFormData.segmentPermissions[expandedSegment].optionBuy,
                              fraction: !editFormData.segmentPermissions[expandedSegment].optionBuy?.fraction
                            })}
                            className={`px-2 py-0.5 rounded text-xs font-medium ${
                              editFormData.segmentPermissions[expandedSegment].optionBuy?.fraction
                                ? 'bg-purple-600 text-white'
                                : 'bg-gray-600 text-white'
                            }`}
                          >
                            {editFormData.segmentPermissions[expandedSegment].optionBuy?.fraction ? 'Fraction On' : 'Fraction Off'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEditSegmentPermissionChange(expandedSegment, 'optionBuy', {
                              ...editFormData.segmentPermissions[expandedSegment].optionBuy,
                              allowed: !editFormData.segmentPermissions[expandedSegment].optionBuy?.allowed
                            })}
                            className={`px-2 py-0.5 rounded text-xs font-medium ${
                              editFormData.segmentPermissions[expandedSegment].optionBuy?.allowed
                                ? 'bg-green-600 text-white'
                                : 'bg-red-600 text-white'
                            }`}
                          >
                            {editFormData.segmentPermissions[expandedSegment].optionBuy?.allowed ? 'Allowed' : 'Blocked'}
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Commission Type</label>
                          <select
                            value={editFormData.segmentPermissions[expandedSegment].optionBuy?.commissionType || 'PER_LOT'}
                            onChange={(e) => handleEditSegmentPermissionChange(expandedSegment, 'optionBuy', {
                              ...editFormData.segmentPermissions[expandedSegment].optionBuy,
                              commissionType: e.target.value
                            })}
                            className="w-full bg-dark-700 border border-dark-600 rounded px-2 py-1 text-xs"
                          >
                            <option value="PER_LOT">Per Lot</option>
                            <option value="PER_TRADE">Per Trade</option>
                            <option value="PER_CRORE">Per Crore</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Commission (₹)</label>
                          <input
                            type="number"
                            value={editFormData.segmentPermissions[expandedSegment].optionBuy?.commission || 0}
                            onChange={(e) => handleEditSegmentPermissionChange(expandedSegment, 'optionBuy', {
                              ...editFormData.segmentPermissions[expandedSegment].optionBuy,
                              commission: Number(e.target.value)
                            })}
                            className="w-full bg-dark-700 border border-dark-600 rounded px-2 py-1 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Strike Selection (±)</label>
                          <input
                            type="number"
                            value={editFormData.segmentPermissions[expandedSegment].optionBuy?.strikeSelection || 50}
                            onChange={(e) => handleEditSegmentPermissionChange(expandedSegment, 'optionBuy', {
                              ...editFormData.segmentPermissions[expandedSegment].optionBuy,
                              strikeSelection: Number(e.target.value)
                            })}
                            className="w-full bg-dark-700 border border-dark-600 rounded px-2 py-1 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Max Exchange Lots</label>
                          <input
                            type="number"
                            value={editFormData.segmentPermissions[expandedSegment].optionBuy?.maxExchangeLots || 100}
                            onChange={(e) => handleEditSegmentPermissionChange(expandedSegment, 'optionBuy', {
                              ...editFormData.segmentPermissions[expandedSegment].optionBuy,
                              maxExchangeLots: Number(e.target.value)
                            })}
                            className="w-full bg-dark-700 border border-dark-600 rounded px-2 py-1 text-xs"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Option Sell */}
                    <div className="bg-dark-800 rounded-lg p-3 border border-red-900/50">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="text-sm font-medium text-red-400">Option Sell</h5>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleEditSegmentPermissionChange(expandedSegment, 'optionSell', {
                              ...editFormData.segmentPermissions[expandedSegment].optionSell,
                              fraction: !editFormData.segmentPermissions[expandedSegment].optionSell?.fraction
                            })}
                            className={`px-2 py-0.5 rounded text-xs font-medium ${
                              editFormData.segmentPermissions[expandedSegment].optionSell?.fraction
                                ? 'bg-purple-600 text-white'
                                : 'bg-gray-600 text-white'
                            }`}
                          >
                            {editFormData.segmentPermissions[expandedSegment].optionSell?.fraction ? 'Fraction On' : 'Fraction Off'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEditSegmentPermissionChange(expandedSegment, 'optionSell', {
                              ...editFormData.segmentPermissions[expandedSegment].optionSell,
                              allowed: !editFormData.segmentPermissions[expandedSegment].optionSell?.allowed
                            })}
                            className={`px-2 py-0.5 rounded text-xs font-medium ${
                              editFormData.segmentPermissions[expandedSegment].optionSell?.allowed
                                ? 'bg-green-600 text-white'
                                : 'bg-red-600 text-white'
                            }`}
                          >
                            {editFormData.segmentPermissions[expandedSegment].optionSell?.allowed ? 'Allowed' : 'Blocked'}
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Commission Type</label>
                          <select
                            value={editFormData.segmentPermissions[expandedSegment].optionSell?.commissionType || 'PER_LOT'}
                            onChange={(e) => handleEditSegmentPermissionChange(expandedSegment, 'optionSell', {
                              ...editFormData.segmentPermissions[expandedSegment].optionSell,
                              commissionType: e.target.value
                            })}
                            className="w-full bg-dark-700 border border-dark-600 rounded px-2 py-1 text-xs"
                          >
                            <option value="PER_LOT">Per Lot</option>
                            <option value="PER_TRADE">Per Trade</option>
                            <option value="PER_CRORE">Per Crore</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Commission (₹)</label>
                          <input
                            type="number"
                            value={editFormData.segmentPermissions[expandedSegment].optionSell?.commission || 0}
                            onChange={(e) => handleEditSegmentPermissionChange(expandedSegment, 'optionSell', {
                              ...editFormData.segmentPermissions[expandedSegment].optionSell,
                              commission: Number(e.target.value)
                            })}
                            className="w-full bg-dark-700 border border-dark-600 rounded px-2 py-1 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Strike Selection (±)</label>
                          <input
                            type="number"
                            value={editFormData.segmentPermissions[expandedSegment].optionSell?.strikeSelection || 50}
                            onChange={(e) => handleEditSegmentPermissionChange(expandedSegment, 'optionSell', {
                              ...editFormData.segmentPermissions[expandedSegment].optionSell,
                              strikeSelection: Number(e.target.value)
                            })}
                            className="w-full bg-dark-700 border border-dark-600 rounded px-2 py-1 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Max Exchange Lots</label>
                          <input
                            type="number"
                            value={editFormData.segmentPermissions[expandedSegment].optionSell?.maxExchangeLots || 100}
                            onChange={(e) => handleEditSegmentPermissionChange(expandedSegment, 'optionSell', {
                              ...editFormData.segmentPermissions[expandedSegment].optionSell,
                              maxExchangeLots: Number(e.target.value)
                            })}
                            className="w-full bg-dark-700 border border-dark-600 rounded px-2 py-1 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Script Settings */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-purple-400 mb-3">Script Settings</h3>
              <div className="flex flex-wrap gap-2 mb-4">
                {segmentOptions.map(segment => (
                  <button
                    key={segment}
                    type="button"
                    onClick={() => {
                      setSelectedScriptSegment(selectedScriptSegment === segment ? null : segment);
                      setSelectedScript(null);
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      selectedScriptSegment === segment
                        ? 'bg-purple-600 text-white'
                        : 'bg-dark-600 text-gray-400 hover:bg-dark-500'
                    }`}
                  >
                    {segment}
                  </button>
                ))}
              </div>

              {/* Symbol List */}
              {selectedScriptSegment && (
                <div className="bg-dark-700 rounded-lg p-4 border border-dark-600">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-yellow-400">{selectedScriptSegment} Symbols</h4>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">
                        {Object.keys(editFormData.scriptSettings || {}).filter(s => 
                          editFormData.scriptSettings[s]?.segment === selectedScriptSegment
                        ).length} customized
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const symbols = segmentSymbols[selectedScriptSegment] || [];
                          const segmentDefaults = editFormData.segmentPermissions?.[selectedScriptSegment] || {};
                          const newScriptSettings = { ...editFormData.scriptSettings };
                          symbols.forEach(symbol => {
                            if (!newScriptSettings[symbol]) {
                              newScriptSettings[symbol] = {
                                segment: selectedScriptSegment,
                                settingType: 'LOT',
                                lotSettings: { 
                                  maxLots: segmentDefaults.maxLots || 50, 
                                  minLots: segmentDefaults.minLots || 1, 
                                  perOrderLots: segmentDefaults.orderLots || 10 
                                },
                                quantitySettings: { maxQuantity: 1000, minQuantity: 1, perOrderQuantity: 100 },
                                fixedMargin: { intradayFuture: 0, carryFuture: 0, optionBuyIntraday: 0, optionBuyCarry: 0, optionSellIntraday: 0, optionSellCarry: 0 },
                                brokerage: { type: segmentDefaults.commissionType || 'PER_LOT', value: segmentDefaults.commissionLot || 0 },
                                spread: { buy: 0, sell: 0 },
                                block: { future: false, option: false }
                              };
                            }
                          });
                          setEditFormData(prev => ({ ...prev, scriptSettings: newScriptSettings }));
                        }}
                        className="px-2 py-1 bg-green-600 hover:bg-green-700 rounded text-xs font-medium"
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const symbols = segmentSymbols[selectedScriptSegment] || [];
                          const newScriptSettings = { ...editFormData.scriptSettings };
                          symbols.forEach(symbol => {
                            delete newScriptSettings[symbol];
                          });
                          setEditFormData(prev => ({ ...prev, scriptSettings: newScriptSettings }));
                          setSelectedScript(null);
                        }}
                        className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs font-medium"
                      >
                        Unselect All
                      </button>
                    </div>
                  </div>
                  
                  {/* Search Filter */}
                  <div className="mb-3">
                    <input
                      type="text"
                      placeholder="Search symbols..."
                      value={editFormData.scriptSearchTerm || ''}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, scriptSearchTerm: e.target.value }))}
                      className="w-full bg-dark-600 border border-dark-500 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                    />
                  </div>
                  
                  {/* Symbol List with Checkboxes */}
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 mb-4 max-h-40 overflow-y-auto">
                    {(segmentSymbols[selectedScriptSegment] || [])
                      .filter(symbol => !editFormData.scriptSearchTerm || symbol.toLowerCase().includes(editFormData.scriptSearchTerm.toLowerCase()))
                      .map(symbol => {
                      const isCustomized = editFormData.scriptSettings?.[symbol];
                      return (
                        <div
                          key={symbol}
                          className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs font-medium transition-all cursor-pointer ${
                            isCustomized
                              ? 'bg-purple-600 text-white'
                              : 'bg-dark-600 text-gray-400 hover:bg-dark-500'
                          } ${selectedScript === symbol ? 'ring-2 ring-yellow-500' : ''}`}
                          onClick={() => {
                            if (isCustomized) {
                              setSelectedScript(symbol);
                            } else {
                              const segmentDefaults = editFormData.segmentPermissions?.[selectedScriptSegment] || {};
                              setEditFormData(prev => ({
                                ...prev,
                                scriptSettings: {
                                  ...prev.scriptSettings,
                                  [symbol]: {
                                    segment: selectedScriptSegment,
                                    settingType: 'LOT',
                                    lotSettings: { maxLots: segmentDefaults.maxLots || 50, minLots: segmentDefaults.minLots || 1, perOrderLots: segmentDefaults.orderLots || 10 },
                                    quantitySettings: { maxQuantity: 1000, minQuantity: 1, perOrderQuantity: 100 },
                                    fixedMargin: { intradayFuture: 0, carryFuture: 0, optionBuyIntraday: 0, optionBuyCarry: 0, optionSellIntraday: 0, optionSellCarry: 0 },
                                    brokerage: { type: segmentDefaults.commissionType || 'PER_LOT', value: segmentDefaults.commissionLot || 0 },
                                    spread: { buy: 0, sell: 0 },
                                    block: { future: false, option: false }
                                  }
                                }
                              }));
                              setSelectedScript(symbol);
                            }
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={!!isCustomized}
                            onChange={(e) => {
                              e.stopPropagation();
                              if (isCustomized) {
                                const updatedScripts = { ...editFormData.scriptSettings };
                                delete updatedScripts[symbol];
                                setEditFormData(prev => ({ 
                                  ...prev, 
                                  scriptSettings: updatedScripts
                                }));
                                if (selectedScript === symbol) setSelectedScript(null);
                              } else {
                                const segmentDefaults = editFormData.segmentPermissions?.[selectedScriptSegment] || {};
                                setEditFormData(prev => ({
                                  ...prev,
                                  scriptSettings: {
                                    ...prev.scriptSettings,
                                    [symbol]: {
                                      segment: selectedScriptSegment,
                                      settingType: 'LOT',
                                      lotSettings: { maxLots: segmentDefaults.maxLots || 50, minLots: segmentDefaults.minLots || 1, perOrderLots: segmentDefaults.orderLots || 10 },
                                      quantitySettings: { maxQuantity: 1000, minQuantity: 1, perOrderQuantity: 100 },
                                      fixedMargin: { intradayFuture: 0, carryFuture: 0, optionBuyIntraday: 0, optionBuyCarry: 0, optionSellIntraday: 0, optionSellCarry: 0 },
                                      brokerage: { type: segmentDefaults.commissionType || 'PER_LOT', value: segmentDefaults.commissionLot || 0 },
                                      spread: { buy: 0, sell: 0 },
                                      block: { future: false, option: false }
                                    }
                                  }
                                }));
                              }
                            }}
                            className="w-3 h-3 accent-purple-500"
                          />
                          <span className="truncate">{symbol}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Selected Symbol Settings */}
                  {selectedScript && editFormData.scriptSettings?.[selectedScript] && (
                    <div className="bg-dark-800 rounded-lg p-4 border border-purple-600">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-yellow-400">{selectedScript} Settings</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleSaveScriptSettings(selectedScript)}
                            disabled={saving}
                            className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-xs font-medium disabled:opacity-50"
                          >
                            {saving ? 'Saving...' : 'Save Script'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const updatedScripts = { ...editFormData.scriptSettings };
                              delete updatedScripts[selectedScript];
                              setEditFormData(prev => ({ ...prev, scriptSettings: updatedScripts }));
                              setSelectedScript(null);
                            }}
                            className="text-red-400 hover:text-red-300 text-xs"
                          >
                            Reset to Default
                          </button>
                        </div>
                      </div>
                      
                      {/* Setting Type Selection */}
                      <div className="mb-4">
                        <label className="block text-xs text-gray-400 font-medium mb-2">Setting Type</label>
                        <div className="flex flex-wrap gap-2">
                          {['LOT', 'QUANTITY', 'FIXED_MARGIN', 'BROKERAGE', 'SPREAD', 'BLOCK'].map(type => (
                            <button
                              key={type}
                              type="button"
                              onClick={() => setEditFormData(prev => ({
                                ...prev,
                                scriptSettings: {
                                  ...prev.scriptSettings,
                                  [selectedScript]: {
                                    ...prev.scriptSettings[selectedScript],
                                    settingType: type
                                  }
                                }
                              }))}
                              className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                                (editFormData.scriptSettings[selectedScript]?.settingType || 'LOT') === type
                                  ? 'bg-purple-600 text-white'
                                  : 'bg-dark-600 text-gray-400 hover:bg-dark-500'
                              }`}
                            >
                              {type === 'LOT' ? 'Lot' : type === 'QUANTITY' ? 'Quantity' : type === 'FIXED_MARGIN' ? 'Fixed Margin' : type === 'BROKERAGE' ? 'Brokerage' : type === 'SPREAD' ? 'Spread' : 'Block'}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      {/* Lot Settings */}
                      {(editFormData.scriptSettings[selectedScript]?.settingType || 'LOT') === 'LOT' && (
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-xs text-gray-500">Max Lots</label>
                            <input
                              type="number"
                              value={editFormData.scriptSettings[selectedScript]?.lotSettings?.maxLots || 50}
                              onChange={(e) => setEditFormData(prev => ({
                                ...prev,
                                scriptSettings: {
                                  ...prev.scriptSettings,
                                  [selectedScript]: {
                                    ...prev.scriptSettings[selectedScript],
                                    lotSettings: { ...prev.scriptSettings[selectedScript]?.lotSettings, maxLots: Number(e.target.value) }
                                  }
                                }
                              }))}
                              className="w-full bg-dark-600 border border-dark-500 rounded px-2 py-1 text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500">Min Lots</label>
                            <input
                              type="number"
                              value={editFormData.scriptSettings[selectedScript]?.lotSettings?.minLots || 1}
                              onChange={(e) => setEditFormData(prev => ({
                                ...prev,
                                scriptSettings: {
                                  ...prev.scriptSettings,
                                  [selectedScript]: {
                                    ...prev.scriptSettings[selectedScript],
                                    lotSettings: { ...prev.scriptSettings[selectedScript]?.lotSettings, minLots: Number(e.target.value) }
                                  }
                                }
                              }))}
                              className="w-full bg-dark-600 border border-dark-500 rounded px-2 py-1 text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500">Per Order</label>
                            <input
                              type="number"
                              value={editFormData.scriptSettings[selectedScript]?.lotSettings?.perOrderLots || 10}
                              onChange={(e) => setEditFormData(prev => ({
                                ...prev,
                                scriptSettings: {
                                  ...prev.scriptSettings,
                                  [selectedScript]: {
                                    ...prev.scriptSettings[selectedScript],
                                    lotSettings: { ...prev.scriptSettings[selectedScript]?.lotSettings, perOrderLots: Number(e.target.value) }
                                  }
                                }
                              }))}
                              className="w-full bg-dark-600 border border-dark-500 rounded px-2 py-1 text-xs"
                            />
                          </div>
                        </div>
                      )}
                      
                      {/* Quantity Settings */}
                      {editFormData.scriptSettings[selectedScript]?.settingType === 'QUANTITY' && (
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-xs text-gray-500">Max Qty</label>
                            <input
                              type="number"
                              value={editFormData.scriptSettings[selectedScript]?.quantitySettings?.maxQuantity || 1000}
                              onChange={(e) => setEditFormData(prev => ({
                                ...prev,
                                scriptSettings: {
                                  ...prev.scriptSettings,
                                  [selectedScript]: {
                                    ...prev.scriptSettings[selectedScript],
                                    quantitySettings: { ...prev.scriptSettings[selectedScript]?.quantitySettings, maxQuantity: Number(e.target.value) }
                                  }
                                }
                              }))}
                              className="w-full bg-dark-600 border border-dark-500 rounded px-2 py-1 text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500">Min Qty</label>
                            <input
                              type="number"
                              value={editFormData.scriptSettings[selectedScript]?.quantitySettings?.minQuantity || 1}
                              onChange={(e) => setEditFormData(prev => ({
                                ...prev,
                                scriptSettings: {
                                  ...prev.scriptSettings,
                                  [selectedScript]: {
                                    ...prev.scriptSettings[selectedScript],
                                    quantitySettings: { ...prev.scriptSettings[selectedScript]?.quantitySettings, minQuantity: Number(e.target.value) }
                                  }
                                }
                              }))}
                              className="w-full bg-dark-600 border border-dark-500 rounded px-2 py-1 text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500">Per Order</label>
                            <input
                              type="number"
                              value={editFormData.scriptSettings[selectedScript]?.quantitySettings?.perOrderQuantity || 100}
                              onChange={(e) => setEditFormData(prev => ({
                                ...prev,
                                scriptSettings: {
                                  ...prev.scriptSettings,
                                  [selectedScript]: {
                                    ...prev.scriptSettings[selectedScript],
                                    quantitySettings: { ...prev.scriptSettings[selectedScript]?.quantitySettings, perOrderQuantity: Number(e.target.value) }
                                  }
                                }
                              }))}
                              className="w-full bg-dark-600 border border-dark-500 rounded px-2 py-1 text-xs"
                            />
                          </div>
                        </div>
                      )}
                      
                      {/* Fixed Margin Settings */}
                      {editFormData.scriptSettings[selectedScript]?.settingType === 'FIXED_MARGIN' && (
                        <div className="space-y-3">
                          <div className="bg-dark-700 rounded p-3">
                            <span className="text-xs text-blue-400 font-medium block mb-2">Future Margins</span>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs text-gray-500">Intraday Future</label>
                                <input
                                  type="number"
                                  value={editFormData.scriptSettings[selectedScript]?.fixedMargin?.intradayFuture || 0}
                                  onChange={(e) => setEditFormData(prev => ({
                                    ...prev,
                                    scriptSettings: {
                                      ...prev.scriptSettings,
                                      [selectedScript]: {
                                        ...prev.scriptSettings[selectedScript],
                                        fixedMargin: { ...prev.scriptSettings[selectedScript]?.fixedMargin, intradayFuture: Number(e.target.value) }
                                      }
                                    }
                                  }))}
                                  className="w-full bg-dark-600 border border-dark-500 rounded px-2 py-1 text-xs"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-500">Carry Future</label>
                                <input
                                  type="number"
                                  value={editFormData.scriptSettings[selectedScript]?.fixedMargin?.carryFuture || 0}
                                  onChange={(e) => setEditFormData(prev => ({
                                    ...prev,
                                    scriptSettings: {
                                      ...prev.scriptSettings,
                                      [selectedScript]: {
                                        ...prev.scriptSettings[selectedScript],
                                        fixedMargin: { ...prev.scriptSettings[selectedScript]?.fixedMargin, carryFuture: Number(e.target.value) }
                                      }
                                    }
                                  }))}
                                  className="w-full bg-dark-600 border border-dark-500 rounded px-2 py-1 text-xs"
                                />
                              </div>
                            </div>
                          </div>
                          <div className="bg-dark-700 rounded p-3">
                            <span className="text-xs text-green-400 font-medium block mb-2">Option Buy Margins</span>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs text-gray-500">Option Buy Intraday</label>
                                <input
                                  type="number"
                                  value={editFormData.scriptSettings[selectedScript]?.fixedMargin?.optionBuyIntraday || 0}
                                  onChange={(e) => setEditFormData(prev => ({
                                    ...prev,
                                    scriptSettings: {
                                      ...prev.scriptSettings,
                                      [selectedScript]: {
                                        ...prev.scriptSettings[selectedScript],
                                        fixedMargin: { ...prev.scriptSettings[selectedScript]?.fixedMargin, optionBuyIntraday: Number(e.target.value) }
                                      }
                                    }
                                  }))}
                                  className="w-full bg-dark-600 border border-dark-500 rounded px-2 py-1 text-xs"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-500">Option Buy Carry</label>
                                <input
                                  type="number"
                                  value={editFormData.scriptSettings[selectedScript]?.fixedMargin?.optionBuyCarry || 0}
                                  onChange={(e) => setEditFormData(prev => ({
                                    ...prev,
                                    scriptSettings: {
                                      ...prev.scriptSettings,
                                      [selectedScript]: {
                                        ...prev.scriptSettings[selectedScript],
                                        fixedMargin: { ...prev.scriptSettings[selectedScript]?.fixedMargin, optionBuyCarry: Number(e.target.value) }
                                      }
                                    }
                                  }))}
                                  className="w-full bg-dark-600 border border-dark-500 rounded px-2 py-1 text-xs"
                                />
                              </div>
                            </div>
                          </div>
                          <div className="bg-dark-700 rounded p-3">
                            <span className="text-xs text-red-400 font-medium block mb-2">Option Sell Margins</span>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs text-gray-500">Option Sell Intraday</label>
                                <input
                                  type="number"
                                  value={editFormData.scriptSettings[selectedScript]?.fixedMargin?.optionSellIntraday || 0}
                                  onChange={(e) => setEditFormData(prev => ({
                                    ...prev,
                                    scriptSettings: {
                                      ...prev.scriptSettings,
                                      [selectedScript]: {
                                        ...prev.scriptSettings[selectedScript],
                                        fixedMargin: { ...prev.scriptSettings[selectedScript]?.fixedMargin, optionSellIntraday: Number(e.target.value) }
                                      }
                                    }
                                  }))}
                                  className="w-full bg-dark-600 border border-dark-500 rounded px-2 py-1 text-xs"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-500">Option Sell Carry</label>
                                <input
                                  type="number"
                                  value={editFormData.scriptSettings[selectedScript]?.fixedMargin?.optionSellCarry || 0}
                                  onChange={(e) => setEditFormData(prev => ({
                                    ...prev,
                                    scriptSettings: {
                                      ...prev.scriptSettings,
                                      [selectedScript]: {
                                        ...prev.scriptSettings[selectedScript],
                                        fixedMargin: { ...prev.scriptSettings[selectedScript]?.fixedMargin, optionSellCarry: Number(e.target.value) }
                                      }
                                    }
                                  }))}
                                  className="w-full bg-dark-600 border border-dark-500 rounded px-2 py-1 text-xs"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Brokerage Settings */}
                      {editFormData.scriptSettings[selectedScript]?.settingType === 'BROKERAGE' && (() => {
                        const segmentKey = editFormData.scriptSettings[selectedScript]?.segment || selectedScriptSegment;
                        const segmentDefaults = editFormData.segmentPermissions?.[segmentKey] || {};
                        return (
                        <div className="bg-dark-700 rounded p-3">
                          <span className="text-xs text-gray-600 block mb-2">(Segment default: {segmentDefaults.commissionType || 'PER_LOT'} - {segmentDefaults.commissionLot || 0})</span>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs text-gray-500">Brokerage Type</label>
                              <select
                                value={editFormData.scriptSettings[selectedScript]?.brokerage?.type || segmentDefaults.commissionType || 'PER_LOT'}
                                onChange={(e) => setEditFormData(prev => ({
                                  ...prev,
                                  scriptSettings: {
                                    ...prev.scriptSettings,
                                    [selectedScript]: {
                                      ...prev.scriptSettings[selectedScript],
                                      brokerage: { ...prev.scriptSettings[selectedScript]?.brokerage, type: e.target.value }
                                    }
                                  }
                                }))}
                                className="w-full bg-dark-600 border border-dark-500 rounded px-2 py-1 text-xs"
                              >
                                <option value="PER_LOT">Per Lot</option>
                                <option value="PER_CRORE">Per Crore</option>
                                <option value="PER_TRADE">Per Trade</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500">Brokerage Value</label>
                              <input
                                type="number"
                                value={editFormData.scriptSettings[selectedScript]?.brokerage?.value ?? segmentDefaults.commissionLot ?? 0}
                                onChange={(e) => setEditFormData(prev => ({
                                  ...prev,
                                  scriptSettings: {
                                    ...prev.scriptSettings,
                                    [selectedScript]: {
                                      ...prev.scriptSettings[selectedScript],
                                      brokerage: { ...prev.scriptSettings[selectedScript]?.brokerage, value: Number(e.target.value) }
                                    }
                                  }
                                }))}
                                className="w-full bg-dark-600 border border-dark-500 rounded px-2 py-1 text-xs"
                              />
                            </div>
                          </div>
                        </div>
                        );
                      })()}
                      
                      {/* Spread Settings */}
                      {editFormData.scriptSettings[selectedScript]?.settingType === 'SPREAD' && (
                        <div className="bg-dark-700 rounded p-3">
                          <div>
                            <label className="block text-xs text-gray-500">Spread Value</label>
                            <input
                              type="number"
                              step="0.01"
                              value={editFormData.scriptSettings[selectedScript]?.spread || 0}
                              onChange={(e) => setEditFormData(prev => ({
                                ...prev,
                                scriptSettings: {
                                  ...prev.scriptSettings,
                                  [selectedScript]: {
                                    ...prev.scriptSettings[selectedScript],
                                    spread: Number(e.target.value)
                                  }
                                }
                              }))}
                              className="w-full bg-dark-600 border border-dark-500 rounded px-2 py-1 text-xs"
                            />
                          </div>
                        </div>
                      )}
                      
                      {/* Block Settings */}
                      {editFormData.scriptSettings[selectedScript]?.settingType === 'BLOCK' && (
                        <div className="bg-dark-700 rounded p-3">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="flex items-center justify-between">
                              <label className="text-xs text-gray-500">Block Future</label>
                              <button
                                type="button"
                                onClick={() => setEditFormData(prev => ({
                                  ...prev,
                                  scriptSettings: {
                                    ...prev.scriptSettings,
                                    [selectedScript]: {
                                      ...prev.scriptSettings[selectedScript],
                                      block: { ...prev.scriptSettings[selectedScript]?.block, future: !prev.scriptSettings[selectedScript]?.block?.future }
                                    }
                                  }
                                }))}
                                className={`px-3 py-1 rounded text-xs font-medium ${
                                  editFormData.scriptSettings[selectedScript]?.block?.future
                                    ? 'bg-red-600 text-white'
                                    : 'bg-green-600 text-white'
                                }`}
                              >
                                {editFormData.scriptSettings[selectedScript]?.block?.future ? 'Yes' : 'No'}
                              </button>
                            </div>
                            <div className="flex items-center justify-between">
                              <label className="text-xs text-gray-500">Block Option</label>
                              <button
                                type="button"
                                onClick={() => setEditFormData(prev => ({
                                  ...prev,
                                  scriptSettings: {
                                    ...prev.scriptSettings,
                                    [selectedScript]: {
                                      ...prev.scriptSettings[selectedScript],
                                      block: { ...prev.scriptSettings[selectedScript]?.block, option: !prev.scriptSettings[selectedScript]?.block?.option }
                                    }
                                  }
                                }))}
                                className={`px-3 py-1 rounded text-xs font-medium ${
                                  editFormData.scriptSettings[selectedScript]?.block?.option
                                    ? 'bg-red-600 text-white'
                                    : 'bg-green-600 text-white'
                                }`}
                              >
                                {editFormData.scriptSettings[selectedScript]?.block?.option ? 'Yes' : 'No'}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Save Button */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedUser(null);
                  setEditFormData(null);
                }}
                className="flex-1 bg-dark-600 hover:bg-dark-500 text-white py-2 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveUserSettings}
                disabled={saving}
                className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white py-2 rounded-lg"
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showUserEditModal && selectedUser && (
        <SuperAdminEditUserModal 
          user={selectedUser}
          onClose={() => { setShowUserEditModal(false); setSelectedUser(null); }}
          onSuccess={() => { setShowUserEditModal(false); setSelectedUser(null); fetchAllUsers(); }}
          token={admin.token}
        />
      )}

      {/* Password Modal */}
      {showPasswordModal && selectedUser && (
        <SuperAdminPasswordModal 
          user={selectedUser}
          onClose={() => { setShowPasswordModal(false); setSelectedUser(null); }}
          token={admin.token}
        />
      )}

      {/* Wallet Modal */}
      {showWalletModal && selectedUser && (
        <SuperAdminWalletModal 
          user={selectedUser}
          onClose={() => { setShowWalletModal(false); setSelectedUser(null); }}
          onSuccess={() => { fetchAllUsers(); }}
          token={admin.token}
        />
      )}

      {/* Crypto Wallet Modal */}
      {showCryptoWalletModal && selectedUser && (
        <CryptoWalletModal 
          user={selectedUser}
          onClose={() => { setShowCryptoWalletModal(false); setSelectedUser(null); }}
          onSuccess={() => { fetchAllUsers(); }}
          token={admin.token}
        />
      )}

      {/* Send Notification Modal */}
      {showNotificationModal && (
        <SendNotificationModal 
          onClose={() => setShowNotificationModal(false)}
          token={admin.token}
          users={users}
          admins={admins}
          isSuperAdmin={true}
        />
      )}
    </div>
  );
};

// Send Notification Modal Component
const SendNotificationModal = ({ onClose, token, users, admins, isSuperAdmin }) => {
  const [formData, setFormData] = useState({
    title: '',
    subject: '',
    description: '',
    targetType: 'ALL_USERS',
    targetUserIds: [],
    targetAdminCode: ''
  });
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const toggleUserSelection = (userId) => {
    setFormData(prev => ({
      ...prev,
      targetUserIds: prev.targetUserIds.includes(userId)
        ? prev.targetUserIds.filter(id => id !== userId)
        : [...prev.targetUserIds, userId]
    }));
  };

  const selectAllFilteredUsers = () => {
    const filteredIds = filteredUsers.map(u => u._id);
    setFormData(prev => ({
      ...prev,
      targetUserIds: [...new Set([...prev.targetUserIds, ...filteredIds])]
    }));
  };

  const clearAllSelections = () => {
    setFormData(prev => ({ ...prev, targetUserIds: [] }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.subject || !formData.description) {
      alert('Please fill in all required fields');
      return;
    }

    if (formData.targetType === 'SELECTED_USERS' && formData.targetUserIds.length === 0) {
      alert('Please select at least one user');
      return;
    }

    setLoading(true);
    try {
      const submitData = new FormData();
      submitData.append('title', formData.title);
      submitData.append('subject', formData.subject);
      submitData.append('description', formData.description);
      submitData.append('targetType', formData.targetType);
      if (formData.targetType === 'SELECTED_USERS') {
        submitData.append('targetUserIds', JSON.stringify(formData.targetUserIds));
      }
      if (formData.targetType === 'ADMIN_USERS') {
        submitData.append('targetAdminCode', formData.targetAdminCode);
      }
      if (image) {
        submitData.append('image', image);
      }

      await axios.post('/api/notifications', submitData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      alert('Notification sent successfully!');
      onClose();
    } catch (error) {
      alert(error.response?.data?.message || 'Error sending notification');
    } finally {
      setLoading(false);
    }
  };

  // Filter users based on search
  const filteredUsers = users.filter(u => 
    (u.fullName || u.username || '').toLowerCase().includes(userSearch.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(userSearch.toLowerCase())
  );

  // Get unique admin codes for dropdown
  const uniqueAdminCodes = [...new Set(users.map(u => u.adminCode))].filter(Boolean);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-dark-800 rounded-lg p-6 w-full max-w-lg mx-4 my-8 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Send Notification</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={24} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2"
              placeholder="Notification title"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Subject *</label>
            <input
              type="text"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2"
              placeholder="Notification subject"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Description *</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2 min-h-[100px]"
              placeholder="Notification description"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Image (Optional)</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2 text-sm"
            />
            {imagePreview && (
              <div className="mt-2 relative">
                <img src={imagePreview} alt="Preview" className="w-full max-h-40 object-cover rounded-lg" />
                <button
                  type="button"
                  onClick={() => { setImage(null); setImagePreview(null); }}
                  className="absolute top-2 right-2 bg-red-600 rounded-full p-1"
                >
                  <X size={16} />
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Send To *</label>
            <select
              value={formData.targetType}
              onChange={(e) => setFormData({ ...formData, targetType: e.target.value, targetUserIds: [], targetAdminCode: '' })}
              className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2"
            >
              {isSuperAdmin && <option value="ALL_ADMINS_USERS">All Users (All Admins)</option>}
              <option value="ALL_USERS">All My Users</option>
              <option value="SELECTED_USERS">Selected Users</option>
              {isSuperAdmin && <option value="ADMIN_USERS">Specific Admin's Users</option>}
            </select>
          </div>

          {formData.targetType === 'SELECTED_USERS' && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Select Users * ({formData.targetUserIds.length} selected)
              </label>
              <input
                type="text"
                placeholder="Search users..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2 mb-2"
              />
              <div className="flex gap-2 mb-2">
                <button
                  type="button"
                  onClick={selectAllFilteredUsers}
                  className="text-xs bg-green-600 hover:bg-green-700 px-2 py-1 rounded"
                >
                  Select All Filtered
                </button>
                <button
                  type="button"
                  onClick={clearAllSelections}
                  className="text-xs bg-red-600 hover:bg-red-700 px-2 py-1 rounded"
                >
                  Clear All
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto bg-dark-700 border border-dark-600 rounded-lg">
                {filteredUsers.map(u => (
                  <label
                    key={u._id}
                    className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-dark-600 ${
                      formData.targetUserIds.includes(u._id) ? 'bg-green-900/30' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={formData.targetUserIds.includes(u._id)}
                      onChange={() => toggleUserSelection(u._id)}
                      className="rounded"
                    />
                    <span className="text-sm">
                      {u.fullName || u.username} <span className="text-gray-500">({u.email})</span>
                    </span>
                  </label>
                ))}
                {filteredUsers.length === 0 && (
                  <div className="px-3 py-4 text-center text-gray-500 text-sm">No users found</div>
                )}
              </div>
            </div>
          )}

          {formData.targetType === 'ADMIN_USERS' && isSuperAdmin && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">Select Admin *</label>
              <select
                value={formData.targetAdminCode}
                onChange={(e) => setFormData({ ...formData, targetAdminCode: e.target.value })}
                className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2"
              >
                <option value="">Select Admin</option>
                {admins && admins.map(a => (
                  <option key={a._id} value={a.adminCode}>
                    {a.fullName || a.username} ({a.adminCode})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 bg-dark-600 hover:bg-dark-500 py-2 rounded-lg">
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={loading}
              className="flex-1 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 py-2 rounded-lg"
            >
              {loading ? 'Sending...' : 'Send Notification'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Super Admin Edit User Modal
const SuperAdminEditUserModal = ({ user, onClose, onSuccess, token }) => {
  const [formData, setFormData] = useState({
    fullName: user.fullName || '',
    phone: user.phone || '',
    isActive: user.isActive
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.put(`/api/admin/manage/users/${user._id}`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      onSuccess();
    } catch (error) {
      alert(error.response?.data?.message || 'Error updating user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-dark-800 rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Edit User</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={24} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Full Name</label>
            <input
              type="text"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Phone</label>
            <input
              type="text"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2"
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Active Status</span>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
              className={`px-4 py-2 rounded-lg ${formData.isActive ? 'bg-green-600' : 'bg-red-600'}`}
            >
              {formData.isActive ? 'Active' : 'Inactive'}
            </button>
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 bg-dark-600 hover:bg-dark-500 py-2 rounded-lg">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 py-2 rounded-lg">
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Super Admin Password Modal
const SuperAdminPasswordModal = ({ user, onClose, token }) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      await axios.put(`/api/admin/manage/users/${user._id}/password`, { password }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Password updated successfully');
      onClose();
    } catch (error) {
      alert(error.response?.data?.message || 'Error updating password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-dark-800 rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Change Password</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={24} /></button>
        </div>
        <div className="mb-4 p-3 bg-dark-700 rounded-lg">
          <div className="text-sm text-gray-400">User</div>
          <div className="font-medium">{user.fullName || user.username}</div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <label className="block text-sm text-gray-400 mb-1">New Password</label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2 pr-10"
              placeholder="Enter new password"
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-8 text-gray-400">
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 bg-dark-600 hover:bg-dark-500 py-2 rounded-lg">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 py-2 rounded-lg">
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Super Admin Wallet Modal
const SuperAdminWalletModal = ({ user, onClose, onSuccess, token }) => {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [action, setAction] = useState('add');
  const [walletType, setWalletType] = useState('main'); // 'main' or 'trading'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    setLoading(true);
    try {
      let endpoint;
      if (walletType === 'trading') {
        endpoint = action === 'add' ? 'add-trading-funds' : 'deduct-trading-funds';
      } else {
        endpoint = action === 'add' ? 'add-funds' : 'deduct-funds';
      }
      await axios.post(`/api/admin/manage/users/${user._id}/${endpoint}`, 
        { amount: parseFloat(amount), description },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const walletName = walletType === 'trading' ? 'Trading Wallet' : 'Main Wallet';
      alert(`${walletName}: Funds ${action === 'add' ? 'added' : 'deducted'} successfully`);
      onSuccess();
      onClose();
    } catch (error) {
      alert(error.response?.data?.message || 'Error processing request');
    } finally {
      setLoading(false);
    }
  };

  const handleResetMargin = async () => {
    if (!confirm('Are you sure you want to reset this user\'s margin to 0? This should only be done if there are no open positions.')) {
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const { data } = await axios.post(`/api/admin/manage/users/${user._id}/reset-margin`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccess(`Margin reset: ₹${data.oldUsedMargin} → ₹0`);
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || 'Error resetting margin');
    } finally {
      setLoading(false);
    }
  };

  const handleReconcileMargin = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const { data } = await axios.post(`/api/admin/manage/users/${user._id}/reconcile-margin`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccess(`Margin reconciled: ₹${data.oldUsedMargin} → ₹${data.newUsedMargin} (${data.openPositionsCount} open positions)`);
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || 'Error reconciling margin');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-dark-800 rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Manage Wallet</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={24} /></button>
        </div>
        <div className="mb-4 p-3 bg-dark-700 rounded-lg">
          <div className="text-sm text-gray-400">User</div>
          <div className="font-medium">{user.fullName || user.username}</div>
          <div className="text-lg font-bold text-green-400 mt-1">₹{user.wallet?.cashBalance?.toLocaleString() || '0'}</div>
          <div className="flex justify-between text-sm text-gray-400 mt-1">
            <span>Trading: ₹{(user.wallet?.tradingBalance || 0).toLocaleString()}</span>
            <span className="text-yellow-400">Margin Used: ₹{(user.wallet?.usedMargin || 0).toLocaleString()}</span>
          </div>
        </div>

        {/* Margin Management */}
        {(user.wallet?.usedMargin > 0) && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-4">
            <p className="text-sm text-yellow-400 font-medium mb-2">Margin Management</p>
            <p className="text-xs text-gray-400 mb-3">If user has stuck margin with no open positions:</p>
            <div className="flex gap-2">
              <button
                onClick={handleReconcileMargin}
                disabled={loading}
                className="flex-1 text-xs bg-blue-600 hover:bg-blue-700 py-2 px-3 rounded disabled:opacity-50"
              >
                Reconcile Margin
              </button>
              <button
                onClick={handleResetMargin}
                disabled={loading}
                className="flex-1 text-xs bg-red-600 hover:bg-red-700 py-2 px-3 rounded disabled:opacity-50"
              >
                Reset to Zero
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-400 px-4 py-2 rounded mb-4 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-500/20 border border-green-500 text-green-400 px-4 py-2 rounded mb-4 text-sm">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Wallet Type Selection */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Select Wallet</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setWalletType('main')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${walletType === 'main' ? 'bg-blue-600 text-white' : 'bg-dark-600 text-gray-400'}`}
              >
                Main Wallet
              </button>
              <button
                type="button"
                onClick={() => setWalletType('trading')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${walletType === 'trading' ? 'bg-purple-600 text-white' : 'bg-dark-600 text-gray-400'}`}
              >
                Trading Wallet
              </button>
            </div>
          </div>

          {/* Action Selection */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAction('add')}
              className={`flex-1 py-2 rounded-lg ${action === 'add' ? 'bg-green-600' : 'bg-dark-600'}`}
            >
              Add Funds
            </button>
            <button
              type="button"
              onClick={() => setAction('deduct')}
              className={`flex-1 py-2 rounded-lg ${action === 'deduct' ? 'bg-red-600' : 'bg-dark-600'}`}
            >
              {walletType === 'trading' ? 'Withdraw' : 'Deduct Funds'}
            </button>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Amount (₹)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2"
              placeholder="Enter amount"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Description (Optional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2"
              placeholder="Enter description"
            />
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 bg-dark-600 hover:bg-dark-500 py-2 rounded-lg">Cancel</button>
            <button 
              type="submit" 
              disabled={loading} 
              className={`flex-1 ${action === 'add' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'} disabled:opacity-50 py-2 rounded-lg`}
            >
              {loading ? 'Processing...' : action === 'add' ? 'Add Funds' : (walletType === 'trading' ? 'Withdraw' : 'Deduct Funds')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Crypto Wallet Modal - For managing user's crypto wallet (USDT)
const CryptoWalletModal = ({ user, onClose, onSuccess, token }) => {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [action, setAction] = useState('add');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    setLoading(true);
    try {
      const endpoint = action === 'add' ? 'add-crypto-funds' : 'deduct-crypto-funds';
      await axios.post(`/api/admin/manage/users/${user._id}/${endpoint}`, 
        { amount: parseFloat(amount), description },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert(`Crypto funds ${action === 'add' ? 'added' : 'deducted'} successfully`);
      onSuccess();
      onClose();
    } catch (error) {
      alert(error.response?.data?.message || 'Error processing request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-dark-800 rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <span className="text-orange-400">₿</span> Manage Crypto Wallet
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={24} /></button>
        </div>
        <div className="mb-4 p-3 bg-gradient-to-r from-orange-900/30 to-dark-700 rounded-lg border border-orange-500/30">
          <div className="text-sm text-gray-400">User</div>
          <div className="font-medium">{user.fullName || user.username}</div>
          <div className="text-lg font-bold text-orange-400 mt-1">
            ${(user.cryptoWallet?.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} USDT
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAction('add')}
              className={`flex-1 py-2 rounded-lg ${action === 'add' ? 'bg-green-600' : 'bg-dark-600'}`}
            >
              Add USDT
            </button>
            <button
              type="button"
              onClick={() => setAction('deduct')}
              className={`flex-1 py-2 rounded-lg ${action === 'deduct' ? 'bg-red-600' : 'bg-dark-600'}`}
            >
              Deduct USDT
            </button>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Amount ($)</label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2"
              placeholder="Enter USDT amount"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Description (Optional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2"
              placeholder="Enter description"
            />
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 bg-dark-600 hover:bg-dark-500 py-2 rounded-lg">Cancel</button>
            <button 
              type="submit" 
              disabled={loading} 
              className={`flex-1 ${action === 'add' ? 'bg-orange-600 hover:bg-orange-700' : 'bg-red-600 hover:bg-red-700'} disabled:opacity-50 py-2 rounded-lg`}
            >
              {loading ? 'Processing...' : action === 'add' ? 'Add USDT' : 'Deduct USDT'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const UserManagement = () => {
  const { admin } = useAuth();
  const isSuperAdmin = admin?.role === 'SUPER_ADMIN';
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showCryptoWalletModal, setShowCryptoWalletModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [saving, setSaving] = useState(false);
  const [copying, setCopying] = useState(false);
  const [targetUserId, setTargetUserId] = useState('');
  const [expandedSegment, setExpandedSegment] = useState(null);
  const [selectedScriptSegment, setSelectedScriptSegment] = useState(null);
  const [selectedScript, setSelectedScript] = useState(null);
  const [editFormData, setEditFormData] = useState(null);

  const { currentPage, setCurrentPage, totalPages, paginatedData: paginatedUsers, totalItems } = usePagination(
    users, 20, searchTerm, ['username', 'fullName', 'email', 'phone']
  );
  
  const defaultSegmentOptions = ['MCX', 'NSEINDEX', 'NSESTOCK', 'BSE', 'EQ', 'NSEFUT', 'NSEOPT', 'MCXFUT', 'MCXOPT', 'NSE-EQ', 'BSE-FUT', 'BSE-OPT'];
  const [marketSegments, setMarketSegments] = useState([]);
  const [marketScripts, setMarketScripts] = useState({});
  
  // Dynamic segment options from market data
  const segmentOptions = marketSegments.length > 0 
    ? marketSegments.map(s => s.id) 
    : defaultSegmentOptions;
  
  const defaultSegmentSettings = {
    enabled: false,
    fraction: false,
    maxExchangeLots: 100,
    commissionType: 'PER_LOT',
    commissionLot: 0,
    maxLots: 50,
    minLots: 1,
    orderLots: 10,
    exposureIntraday: 1,
    exposureCarryForward: 1,
    optionBuy: {
      allowed: true,
      fraction: false,
      commissionType: 'PER_LOT',
      commission: 0,
      strikeSelection: 50,
      maxExchangeLots: 100
    },
    optionSell: {
      allowed: true,
      fraction: false,
      commissionType: 'PER_LOT',
      commission: 0,
      strikeSelection: 50,
      maxExchangeLots: 100
    }
  };
  
  const [segmentSymbols, setSegmentSymbols] = useState({
    NSEFUT: ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'NIFTYIT'],
    NSEOPT: ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'NIFTYIT'],
    MCXFUT: ['CRUDEOIL', 'CRUDEM', 'GOLD', 'SILVER', 'SILVERMIC', 'NATURALGAS', 'NATGASMINI', 'COPPER', 'ZINC', 'ZINCMINI', 'ALUMINIUM', 'LEAD', 'LEADMINI', 'NICKEL'],
    MCXOPT: ['CRUDEOIL', 'GOLD', 'SILVER', 'NATURALGAS', 'COPPER'],
    'NSE-EQ': ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'SBIN', 'BHARTIARTL', 'ITC', 'KOTAKBANK', 'LT'],
    'BSE-FUT': ['SENSEX', 'BANKEX'],
    'BSE-OPT': ['SENSEX', 'BANKEX']
  });
  
  // Fetch segments and scripts from market data
  const fetchMarketData = async () => {
    try {
      const { data } = await axios.get('/api/instruments/settings-data', {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      
      setMarketSegments(data.segments || []);
      setMarketScripts(data.scripts || {});
      
      // Build segment symbols from scripts data
      const newSegmentSymbols = {};
      for (const [segKey, scripts] of Object.entries(data.scripts || {})) {
        newSegmentSymbols[segKey] = scripts.map(s => s.baseSymbol);
      }
      if (Object.keys(newSegmentSymbols).length > 0) {
        setSegmentSymbols(newSegmentSymbols);
      }
    } catch (error) {
      console.error('Error fetching market data:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data } = await axios.get('/api/admin/users', {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      setUsers(data);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchMarketData();
  }, []);

  const filteredUsers = users.filter(user => 
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.fullName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDelete = async (userId) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      await axios.delete(`/api/admin/users/${userId}`, {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      fetchUsers();
    } catch (error) {
      alert(error.response?.data?.message || 'Error deleting user');
    }
  };

  const openSettingsModal = (user) => {
    setSelectedUser(user);
    const userSegmentKeys = Object.keys(user.segmentPermissions || {});
    const allSegments = Array.from(new Set([
      ...segmentOptions,
      ...userSegmentKeys,
      ...defaultSegmentOptions
    ]));

    const normalizedSegments = allSegments.reduce((acc, seg) => {
      acc[seg] = {
        ...defaultSegmentSettings,
        ...(user.segmentPermissions?.[seg] || {})
      };
      return acc;
    }, {});

    setEditFormData({
      segmentPermissions: normalizedSegments,
      scriptSettings: user.scriptSettings || {}
    });
    setSelectedScriptSegment(null);
    setSelectedScript(null);
    setShowSettingsModal(true);
  };

  const handleEditSegmentPermissionChange = (segment, field, value) => {
    setEditFormData(prev => ({
      ...prev,
      segmentPermissions: {
        ...prev.segmentPermissions,
        [segment]: {
          ...prev.segmentPermissions[segment],
          [field]: value
        }
      }
    }));
  };

  const handleSaveUserSettings = async () => {
    if (!selectedUser || !editFormData) return;
    
    setSaving(true);
    try {
      await axios.put(`/api/admin/users/${selectedUser._id}/settings`, 
        {
          segmentPermissions: editFormData.segmentPermissions,
          scriptSettings: editFormData.scriptSettings
        },
        { headers: { Authorization: `Bearer ${admin.token}` } }
      );
      alert('User settings updated successfully!');
      setShowSettingsModal(false);
      setSelectedUser(null);
      setEditFormData(null);
      fetchUsers();
    } catch (error) {
      alert(error.response?.data?.message || 'Error updating user settings');
    } finally {
      setSaving(false);
    }
  };

  // Save only a single script's settings (merge with existing)
  const handleSaveScriptSettings = async (symbol) => {
    if (!selectedUser || !editFormData || !editFormData.scriptSettings?.[symbol]) return;
    
    setSaving(true);
    try {
      await axios.put(`/api/admin/manage/users/${selectedUser._id}/script-settings/${encodeURIComponent(symbol)}`, 
        editFormData.scriptSettings[symbol],
        { headers: { Authorization: `Bearer ${admin.token}` } }
      );
      alert(`Script settings for ${symbol} saved successfully!`);
    } catch (error) {
      alert(error.response?.data?.message || 'Error saving script settings');
    } finally {
      setSaving(false);
    }
  };

  const handleCopySettings = async () => {
    if (!selectedUser || !targetUserId) return;
    
    setCopying(true);
    try {
      await axios.post(`/api/admin/manage/users/${targetUserId}/copy-settings`, 
        {
          sourceUserId: selectedUser._id,
          segmentPermissions: selectedUser.segmentPermissions,
          scriptSettings: selectedUser.scriptSettings
        },
        { headers: { Authorization: `Bearer ${admin.token}` } }
      );
      alert('Settings copied successfully!');
      setShowCopyModal(false);
      setSelectedUser(null);
      setTargetUserId('');
      fetchUsers();
    } catch (error) {
      alert(error.response?.data?.message || 'Error copying settings');
    } finally {
      setCopying(false);
    }
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-xl md:text-2xl font-bold">User Management</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNotificationModal(true)}
            className="flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 px-4 py-2 rounded-lg transition"
          >
            <FileText size={20} />
            <span>Send Notification</span>
          </button>
          <button
            onClick={() => navigate('/admin/create-user')}
            className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg transition"
          >
            <Plus size={20} />
            <span>Create User</span>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Search users..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-dark-700 border border-dark-600 rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:border-purple-500"
        />
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {loading ? (
          <div className="text-center py-8 text-gray-400">
            <RefreshCw className="animate-spin inline mr-2" size={20} />
            Loading...
          </div>
        ) : totalItems === 0 ? (
          <div className="text-center py-8 text-gray-400">No users found</div>
        ) : (
          paginatedUsers.map(user => (
            <div key={user._id} className="bg-dark-800 rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-medium">{user.fullName || user.username}</div>
                  <div className="text-sm text-gray-400">@{user.username}</div>
                </div>
                <span className={`px-2 py-1 rounded text-xs ${
                  user.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                }`}>
                  {user.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="text-sm text-gray-400 mb-1">{user.email}</div>
              <div className="text-sm text-gray-400 mb-3">{user.phone || 'No phone'}</div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-green-400 font-bold">₹{user.wallet?.balance?.toLocaleString() || '0'}</div>
                  <div className="text-xs text-blue-400">Trading: ₹{(user.wallet?.tradingBalance || 0).toLocaleString()}</div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => { setSelectedUser(user); setShowEditModal(true); }} className="p-2 bg-dark-700 rounded text-blue-400"><Edit size={16} /></button>
                  <button onClick={() => { setSelectedUser(user); setShowPasswordModal(true); }} className="p-2 bg-dark-700 rounded text-yellow-400"><Key size={16} /></button>
                  <button onClick={() => openSettingsModal(user)} className="p-2 bg-dark-700 rounded text-purple-400"><Settings size={16} /></button>
                  <button onClick={() => { setSelectedUser(user); setShowCopyModal(true); }} className="p-2 bg-dark-700 rounded text-cyan-400"><Copy size={16} /></button>
                  <button onClick={() => { setSelectedUser(user); setShowWalletModal(true); }} className="p-2 bg-dark-700 rounded text-green-400" title="Manage INR Wallet"><Wallet size={16} /></button>
                  {isSuperAdmin && <button onClick={() => handleForceLogoutUser(user._id, user.fullName || user.username)} className="p-2 bg-dark-700 rounded text-orange-400" title="Force Logout"><LogOut size={16} /></button>}
                  <button onClick={() => handleDelete(user._id)} className="p-2 bg-dark-700 rounded text-red-400"><Trash2 size={16} /></button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-dark-800 rounded-lg overflow-hidden overflow-x-auto">
        <table className="w-full">
          <thead className="bg-dark-700">
            <tr>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">User</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Email</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Phone</th>
              <th className="text-right px-4 py-3 text-gray-400 font-medium">Balance</th>
              <th className="text-center px-4 py-3 text-gray-400 font-medium">Status</th>
              <th className="text-center px-4 py-3 text-gray-400 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" className="text-center py-8 text-gray-400">
                  <RefreshCw className="animate-spin inline mr-2" size={20} />
                  Loading...
                </td>
              </tr>
            ) : totalItems === 0 ? (
              <tr>
                <td colSpan="6" className="text-center py-8 text-gray-400">
                  No users found
                </td>
              </tr>
            ) : (
              paginatedUsers.map(user => (
                <tr key={user._id} className="border-t border-dark-600 hover:bg-dark-700">
                  <td className="px-4 py-3">
                    <div>
                      <div className="font-medium">{user.fullName || user.username}</div>
                      <div className="text-sm text-gray-400">@{user.username}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-300">{user.email}</td>
                  <td className="px-4 py-3 text-gray-300">{user.phone || '-'}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="text-green-400 font-medium">
                      ₹{user.wallet?.balance?.toLocaleString() || '0'}
                    </div>
                    <div className="text-xs text-blue-400">
                      Trading: ₹{(user.wallet?.tradingBalance || 0).toLocaleString()}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded text-xs ${
                      user.isActive 
                        ? 'bg-green-500/20 text-green-400' 
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => { setSelectedUser(user); setShowEditModal(true); }}
                        className="p-2 hover:bg-dark-600 rounded transition text-blue-400"
                        title="Edit User"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => { setSelectedUser(user); setShowPasswordModal(true); }}
                        className="p-2 hover:bg-dark-600 rounded transition text-yellow-400"
                        title="Change Password"
                      >
                        <Key size={16} />
                      </button>
                      <button
                        onClick={() => openSettingsModal(user)}
                        className="p-2 hover:bg-dark-600 rounded transition text-purple-400"
                        title="Edit Settings"
                      >
                        <Settings size={16} />
                      </button>
                      <button
                        onClick={() => { setSelectedUser(user); setShowCopyModal(true); }}
                        className="p-2 hover:bg-dark-600 rounded transition text-cyan-400"
                        title="Copy Settings"
                      >
                        <Copy size={16} />
                      </button>
                      <button
                        onClick={() => { setSelectedUser(user); setShowWalletModal(true); }}
                        className="p-2 hover:bg-dark-600 rounded transition text-green-400"
                        title="Manage INR Wallet"
                      >
                        <Wallet size={16} />
                      </button>
                      {isSuperAdmin && (
                        <button
                          onClick={() => handleForceLogoutUser(user._id, user.fullName || user.username)}
                          className="p-2 hover:bg-dark-600 rounded transition text-orange-400"
                          title="Force Logout User"
                        >
                          <LogOut size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(user._id)}
                        className="p-2 hover:bg-dark-600 rounded transition text-red-400"
                        title="Delete User"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalItems={totalItems}
          itemsPerPage={20}
        />
      </div>

      {/* Modals */}
      {showCreateModal && (
        <CreateUserModal 
          onClose={() => setShowCreateModal(false)} 
          onSuccess={() => { setShowCreateModal(false); fetchUsers(); }}
          token={admin.token}
        />
      )}
      {showEditModal && selectedUser && (
        <EditUserModal 
          user={selectedUser}
          onClose={() => { setShowEditModal(false); setSelectedUser(null); }}
          onSuccess={() => { setShowEditModal(false); setSelectedUser(null); fetchUsers(); }}
          token={admin.token}
        />
      )}
      {showPasswordModal && selectedUser && (
        <PasswordModal 
          user={selectedUser}
          onClose={() => { setShowPasswordModal(false); setSelectedUser(null); }}
          token={admin.token}
        />
      )}
      {showWalletModal && selectedUser && (
        <WalletModal 
          user={selectedUser}
          onClose={() => { setShowWalletModal(false); setSelectedUser(null); }}
          onSuccess={() => { fetchUsers(); }}
          token={admin.token}
        />
      )}
      {showCryptoWalletModal && selectedUser && (
        <CryptoWalletModal 
          user={selectedUser}
          onClose={() => { setShowCryptoWalletModal(false); setSelectedUser(null); }}
          onSuccess={() => { fetchUsers(); }}
          token={admin.token}
        />
      )}

      {/* Copy Settings Modal */}
      {showCopyModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-dark-800 rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold mb-4">Copy User Settings</h2>
            
            <div className="mb-4 p-3 bg-dark-700 rounded-lg">
              <div className="text-sm text-gray-400">Copy From</div>
              <div className="font-medium">{selectedUser.fullName || selectedUser.username}</div>
              <div className="text-sm text-gray-400">{selectedUser.email}</div>
            </div>

            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Copy To User</label>
              <select
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value)}
                className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2 text-white"
              >
                <option value="">Select User</option>
                {users.filter(u => u._id !== selectedUser._id).map(u => (
                  <option key={u._id} value={u._id}>
                    {u.fullName || u.username} ({u.email})
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-600/50 rounded-lg">
              <div className="text-sm text-yellow-400">
                <strong>Note:</strong> This will copy segment permissions and script settings from the selected user to the target user.
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCopyModal(false);
                  setSelectedUser(null);
                  setTargetUserId('');
                }}
                className="flex-1 bg-dark-600 hover:bg-dark-500 text-white py-2 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleCopySettings}
                disabled={!targetUserId || copying}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white py-2 rounded-lg"
              >
                {copying ? 'Copying...' : 'Copy Settings'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Settings Modal */}
      {showSettingsModal && selectedUser && editFormData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-dark-800 rounded-lg p-6 w-full max-w-4xl mx-4 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Edit User Settings</h2>
              <button
                onClick={() => {
                  setShowSettingsModal(false);
                  setSelectedUser(null);
                  setEditFormData(null);
                }}
                className="text-gray-400 hover:text-white"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="mb-4 p-3 bg-dark-700 rounded-lg">
              <div className="text-sm text-gray-400">User</div>
              <div className="font-medium">{selectedUser.fullName || selectedUser.username}</div>
              <div className="text-sm text-gray-400">{selectedUser.email}</div>
            </div>

            {/* Segment Permissions */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-blue-400 mb-3">Segment Permissions</h3>
              <div className="flex flex-wrap gap-2 mb-4">
                {segmentOptions.map(segment => (
                  <button
                    key={segment}
                    type="button"
                    onClick={() => setExpandedSegment(expandedSegment === segment ? null : segment)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      expandedSegment === segment
                        ? 'bg-blue-600 text-white'
                        : editFormData.segmentPermissions?.[segment]?.enabled
                          ? 'bg-green-600/20 text-green-400 border border-green-600'
                          : 'bg-dark-600 text-gray-400 hover:bg-dark-500'
                    }`}
                  >
                    {segment}
                  </button>
                ))}
              </div>

              {/* Expanded Segment Settings */}
              {expandedSegment && editFormData.segmentPermissions?.[expandedSegment] && (
                <div className="bg-dark-700 rounded-lg p-4 border border-dark-600">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-md font-semibold text-blue-400">{expandedSegment} Settings</h4>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleEditSegmentPermissionChange(expandedSegment, 'fraction', !editFormData.segmentPermissions[expandedSegment].fraction)}
                        className={`px-3 py-1 rounded text-xs font-medium ${
                          editFormData.segmentPermissions[expandedSegment].fraction
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-600 text-white'
                        }`}
                      >
                        {editFormData.segmentPermissions[expandedSegment].fraction ? 'Fraction On' : 'Fraction Off'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEditSegmentPermissionChange(expandedSegment, 'enabled', !editFormData.segmentPermissions[expandedSegment].enabled)}
                        className={`px-3 py-1 rounded text-xs font-medium ${
                          editFormData.segmentPermissions[expandedSegment].enabled
                            ? 'bg-green-600 text-white'
                            : 'bg-red-600 text-white'
                        }`}
                      >
                        {editFormData.segmentPermissions[expandedSegment].enabled ? 'Enabled' : 'Disabled'}
                      </button>
                    </div>
                  </div>
                  
                  {/* General Settings */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Max Exchange Lots</label>
                      <input
                        type="number"
                        value={editFormData.segmentPermissions[expandedSegment].maxExchangeLots || 100}
                        onChange={(e) => handleEditSegmentPermissionChange(expandedSegment, 'maxExchangeLots', Number(e.target.value))}
                        className="w-full bg-dark-800 border border-dark-600 rounded px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Max Lots</label>
                      <input
                        type="number"
                        value={editFormData.segmentPermissions[expandedSegment].maxLots || 50}
                        onChange={(e) => handleEditSegmentPermissionChange(expandedSegment, 'maxLots', Number(e.target.value))}
                        className="w-full bg-dark-800 border border-dark-600 rounded px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Min Lots</label>
                      <input
                        type="number"
                        value={editFormData.segmentPermissions[expandedSegment].minLots || 1}
                        onChange={(e) => handleEditSegmentPermissionChange(expandedSegment, 'minLots', Number(e.target.value))}
                        className="w-full bg-dark-800 border border-dark-600 rounded px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Order Lots</label>
                      <input
                        type="number"
                        value={editFormData.segmentPermissions[expandedSegment].orderLots || 10}
                        onChange={(e) => handleEditSegmentPermissionChange(expandedSegment, 'orderLots', Number(e.target.value))}
                        className="w-full bg-dark-800 border border-dark-600 rounded px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Commission Type</label>
                      <select
                        value={editFormData.segmentPermissions[expandedSegment].commissionType || 'PER_LOT'}
                        onChange={(e) => handleEditSegmentPermissionChange(expandedSegment, 'commissionType', e.target.value)}
                        className="w-full bg-dark-800 border border-dark-600 rounded px-2 py-1.5 text-sm"
                      >
                        <option value="PER_LOT">Per Lot</option>
                        <option value="PER_TRADE">Per Trade</option>
                        <option value="PER_CRORE">Per Crore</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Commission (₹)</label>
                      <input
                        type="number"
                        value={editFormData.segmentPermissions[expandedSegment].commissionLot || 0}
                        onChange={(e) => handleEditSegmentPermissionChange(expandedSegment, 'commissionLot', Number(e.target.value))}
                        className="w-full bg-dark-800 border border-dark-600 rounded px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Exposure Intraday</label>
                      <input
                        type="number"
                        value={editFormData.segmentPermissions[expandedSegment].exposureIntraday || 1}
                        onChange={(e) => handleEditSegmentPermissionChange(expandedSegment, 'exposureIntraday', Number(e.target.value))}
                        className="w-full bg-dark-800 border border-dark-600 rounded px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Exposure Carry Forward</label>
                      <input
                        type="number"
                        value={editFormData.segmentPermissions[expandedSegment].exposureCarryForward || 1}
                        onChange={(e) => handleEditSegmentPermissionChange(expandedSegment, 'exposureCarryForward', Number(e.target.value))}
                        className="w-full bg-dark-800 border border-dark-600 rounded px-2 py-1.5 text-sm"
                      />
                    </div>
                  </div>

                  {/* Option Buy & Sell Settings */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Option Buy */}
                    <div className="bg-dark-800 rounded-lg p-3 border border-green-900/50">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="text-sm font-medium text-green-400">Option Buy</h5>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleEditSegmentPermissionChange(expandedSegment, 'optionBuy', {
                              ...editFormData.segmentPermissions[expandedSegment].optionBuy,
                              fraction: !editFormData.segmentPermissions[expandedSegment].optionBuy?.fraction
                            })}
                            className={`px-2 py-0.5 rounded text-xs font-medium ${
                              editFormData.segmentPermissions[expandedSegment].optionBuy?.fraction
                                ? 'bg-purple-600 text-white'
                                : 'bg-gray-600 text-white'
                            }`}
                          >
                            {editFormData.segmentPermissions[expandedSegment].optionBuy?.fraction ? 'Fraction On' : 'Fraction Off'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEditSegmentPermissionChange(expandedSegment, 'optionBuy', {
                              ...editFormData.segmentPermissions[expandedSegment].optionBuy,
                              allowed: !editFormData.segmentPermissions[expandedSegment].optionBuy?.allowed
                            })}
                            className={`px-2 py-0.5 rounded text-xs font-medium ${
                              editFormData.segmentPermissions[expandedSegment].optionBuy?.allowed
                                ? 'bg-green-600 text-white'
                                : 'bg-red-600 text-white'
                            }`}
                          >
                            {editFormData.segmentPermissions[expandedSegment].optionBuy?.allowed ? 'Allowed' : 'Blocked'}
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Commission Type</label>
                          <select
                            value={editFormData.segmentPermissions[expandedSegment].optionBuy?.commissionType || 'PER_LOT'}
                            onChange={(e) => handleEditSegmentPermissionChange(expandedSegment, 'optionBuy', {
                              ...editFormData.segmentPermissions[expandedSegment].optionBuy,
                              commissionType: e.target.value
                            })}
                            className="w-full bg-dark-700 border border-dark-600 rounded px-2 py-1 text-xs"
                          >
                            <option value="PER_LOT">Per Lot</option>
                            <option value="PER_TRADE">Per Trade</option>
                            <option value="PER_CRORE">Per Crore</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Commission (₹)</label>
                          <input
                            type="number"
                            value={editFormData.segmentPermissions[expandedSegment].optionBuy?.commission || 0}
                            onChange={(e) => handleEditSegmentPermissionChange(expandedSegment, 'optionBuy', {
                              ...editFormData.segmentPermissions[expandedSegment].optionBuy,
                              commission: Number(e.target.value)
                            })}
                            className="w-full bg-dark-700 border border-dark-600 rounded px-2 py-1 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Strike Selection (±)</label>
                          <input
                            type="number"
                            value={editFormData.segmentPermissions[expandedSegment].optionBuy?.strikeSelection || 50}
                            onChange={(e) => handleEditSegmentPermissionChange(expandedSegment, 'optionBuy', {
                              ...editFormData.segmentPermissions[expandedSegment].optionBuy,
                              strikeSelection: Number(e.target.value)
                            })}
                            className="w-full bg-dark-700 border border-dark-600 rounded px-2 py-1 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Max Exchange Lots</label>
                          <input
                            type="number"
                            value={editFormData.segmentPermissions[expandedSegment].optionBuy?.maxExchangeLots || 100}
                            onChange={(e) => handleEditSegmentPermissionChange(expandedSegment, 'optionBuy', {
                              ...editFormData.segmentPermissions[expandedSegment].optionBuy,
                              maxExchangeLots: Number(e.target.value)
                            })}
                            className="w-full bg-dark-700 border border-dark-600 rounded px-2 py-1 text-xs"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Option Sell */}
                    <div className="bg-dark-800 rounded-lg p-3 border border-red-900/50">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="text-sm font-medium text-red-400">Option Sell</h5>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleEditSegmentPermissionChange(expandedSegment, 'optionSell', {
                              ...editFormData.segmentPermissions[expandedSegment].optionSell,
                              fraction: !editFormData.segmentPermissions[expandedSegment].optionSell?.fraction
                            })}
                            className={`px-2 py-0.5 rounded text-xs font-medium ${
                              editFormData.segmentPermissions[expandedSegment].optionSell?.fraction
                                ? 'bg-purple-600 text-white'
                                : 'bg-gray-600 text-white'
                            }`}
                          >
                            {editFormData.segmentPermissions[expandedSegment].optionSell?.fraction ? 'Fraction On' : 'Fraction Off'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEditSegmentPermissionChange(expandedSegment, 'optionSell', {
                              ...editFormData.segmentPermissions[expandedSegment].optionSell,
                              allowed: !editFormData.segmentPermissions[expandedSegment].optionSell?.allowed
                            })}
                            className={`px-2 py-0.5 rounded text-xs font-medium ${
                              editFormData.segmentPermissions[expandedSegment].optionSell?.allowed
                                ? 'bg-green-600 text-white'
                                : 'bg-red-600 text-white'
                            }`}
                          >
                            {editFormData.segmentPermissions[expandedSegment].optionSell?.allowed ? 'Allowed' : 'Blocked'}
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Commission Type</label>
                          <select
                            value={editFormData.segmentPermissions[expandedSegment].optionSell?.commissionType || 'PER_LOT'}
                            onChange={(e) => handleEditSegmentPermissionChange(expandedSegment, 'optionSell', {
                              ...editFormData.segmentPermissions[expandedSegment].optionSell,
                              commissionType: e.target.value
                            })}
                            className="w-full bg-dark-700 border border-dark-600 rounded px-2 py-1 text-xs"
                          >
                            <option value="PER_LOT">Per Lot</option>
                            <option value="PER_TRADE">Per Trade</option>
                            <option value="PER_CRORE">Per Crore</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Commission (₹)</label>
                          <input
                            type="number"
                            value={editFormData.segmentPermissions[expandedSegment].optionSell?.commission || 0}
                            onChange={(e) => handleEditSegmentPermissionChange(expandedSegment, 'optionSell', {
                              ...editFormData.segmentPermissions[expandedSegment].optionSell,
                              commission: Number(e.target.value)
                            })}
                            className="w-full bg-dark-700 border border-dark-600 rounded px-2 py-1 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Strike Selection (±)</label>
                          <input
                            type="number"
                            value={editFormData.segmentPermissions[expandedSegment].optionSell?.strikeSelection || 50}
                            onChange={(e) => handleEditSegmentPermissionChange(expandedSegment, 'optionSell', {
                              ...editFormData.segmentPermissions[expandedSegment].optionSell,
                              strikeSelection: Number(e.target.value)
                            })}
                            className="w-full bg-dark-700 border border-dark-600 rounded px-2 py-1 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Max Exchange Lots</label>
                          <input
                            type="number"
                            value={editFormData.segmentPermissions[expandedSegment].optionSell?.maxExchangeLots || 100}
                            onChange={(e) => handleEditSegmentPermissionChange(expandedSegment, 'optionSell', {
                              ...editFormData.segmentPermissions[expandedSegment].optionSell,
                              maxExchangeLots: Number(e.target.value)
                            })}
                            className="w-full bg-dark-700 border border-dark-600 rounded px-2 py-1 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Script Settings */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-purple-400 mb-3">Script Settings</h3>
              <div className="flex flex-wrap gap-2 mb-4">
                {segmentOptions.map(segment => (
                  <button
                    key={segment}
                    type="button"
                    onClick={() => {
                      setSelectedScriptSegment(selectedScriptSegment === segment ? null : segment);
                      setSelectedScript(null);
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      selectedScriptSegment === segment
                        ? 'bg-purple-600 text-white'
                        : 'bg-dark-600 text-gray-400 hover:bg-dark-500'
                    }`}
                  >
                    {segment}
                  </button>
                ))}
              </div>

              {/* Symbol List */}
              {selectedScriptSegment && (
                <div className="bg-dark-700 rounded-lg p-4 border border-dark-600">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-yellow-400">{selectedScriptSegment} Symbols</h4>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">
                        {Object.keys(editFormData.scriptSettings || {}).filter(s => 
                          editFormData.scriptSettings[s]?.segment === selectedScriptSegment
                        ).length} customized
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const symbols = segmentSymbols[selectedScriptSegment] || [];
                          const segmentDefaults = editFormData.segmentPermissions?.[selectedScriptSegment] || {};
                          const newScriptSettings = { ...editFormData.scriptSettings };
                          symbols.forEach(symbol => {
                            if (!newScriptSettings[symbol]) {
                              newScriptSettings[symbol] = {
                                segment: selectedScriptSegment,
                                settingType: 'LOT',
                                lotSettings: { maxLots: segmentDefaults.maxLots || 50, minLots: segmentDefaults.minLots || 1, perOrderLots: segmentDefaults.orderLots || 10 },
                                quantitySettings: { maxQuantity: 1000, minQuantity: 1, perOrderQuantity: 100 },
                                fixedMargin: { intradayFuture: 0, carryFuture: 0, optionBuyIntraday: 0, optionBuyCarry: 0, optionSellIntraday: 0, optionSellCarry: 0 },
                                brokerage: { type: segmentDefaults.commissionType || 'PER_LOT', value: segmentDefaults.commissionLot || 0 },
                                spread: { buy: 0, sell: 0 },
                                block: { future: false, option: false }
                              };
                            }
                          });
                          setEditFormData(prev => ({ ...prev, scriptSettings: newScriptSettings }));
                        }}
                        className="px-2 py-1 bg-green-600 hover:bg-green-700 rounded text-xs font-medium"
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const symbols = segmentSymbols[selectedScriptSegment] || [];
                          const newScriptSettings = { ...editFormData.scriptSettings };
                          symbols.forEach(symbol => {
                            delete newScriptSettings[symbol];
                          });
                          setEditFormData(prev => ({ ...prev, scriptSettings: newScriptSettings }));
                          setSelectedScript(null);
                        }}
                        className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs font-medium"
                      >
                        Unselect All
                      </button>
                    </div>
                  </div>
                  
                  {/* Search Filter */}
                  <div className="mb-3">
                    <input
                      type="text"
                      placeholder="Search symbols..."
                      value={editFormData.scriptSearchTerm || ''}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, scriptSearchTerm: e.target.value }))}
                      className="w-full bg-dark-600 border border-dark-500 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                    />
                  </div>
                  
                  {/* Symbol List with Checkboxes */}
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 mb-4 max-h-40 overflow-y-auto">
                    {(segmentSymbols[selectedScriptSegment] || [])
                      .filter(symbol => !editFormData.scriptSearchTerm || symbol.toLowerCase().includes(editFormData.scriptSearchTerm.toLowerCase()))
                      .map(symbol => {
                      const isCustomized = editFormData.scriptSettings?.[symbol];
                      return (
                        <div
                          key={symbol}
                          className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs font-medium transition-all cursor-pointer ${
                            isCustomized
                              ? 'bg-purple-600 text-white'
                              : 'bg-dark-600 text-gray-400 hover:bg-dark-500'
                          } ${selectedScript === symbol ? 'ring-2 ring-yellow-500' : ''}`}
                          onClick={() => {
                            if (isCustomized) {
                              setSelectedScript(symbol);
                            } else {
                              const segmentDefaults = editFormData.segmentPermissions?.[selectedScriptSegment] || {};
                              setEditFormData(prev => ({
                                ...prev,
                                scriptSettings: {
                                  ...prev.scriptSettings,
                                  [symbol]: {
                                    segment: selectedScriptSegment,
                                    settingType: 'LOT',
                                    lotSettings: { maxLots: segmentDefaults.maxLots || 50, minLots: segmentDefaults.minLots || 1, perOrderLots: segmentDefaults.orderLots || 10 },
                                    quantitySettings: { maxQuantity: 1000, minQuantity: 1, perOrderQuantity: 100 },
                                    fixedMargin: { intradayFuture: 0, carryFuture: 0, optionBuyIntraday: 0, optionBuyCarry: 0, optionSellIntraday: 0, optionSellCarry: 0 },
                                    brokerage: { type: segmentDefaults.commissionType || 'PER_LOT', value: segmentDefaults.commissionLot || 0 },
                                    spread: { buy: 0, sell: 0 },
                                    block: { future: false, option: false }
                                  }
                                }
                              }));
                              setSelectedScript(symbol);
                            }
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={!!isCustomized}
                            onChange={(e) => {
                              e.stopPropagation();
                              if (isCustomized) {
                                const updatedScripts = { ...editFormData.scriptSettings };
                                delete updatedScripts[symbol];
                                setEditFormData(prev => ({ ...prev, scriptSettings: updatedScripts }));
                                if (selectedScript === symbol) setSelectedScript(null);
                              } else {
                                const segmentDefaults = editFormData.segmentPermissions?.[selectedScriptSegment] || {};
                                setEditFormData(prev => ({
                                  ...prev,
                                  scriptSettings: {
                                    ...prev.scriptSettings,
                                    [symbol]: {
                                      segment: selectedScriptSegment,
                                      settingType: 'LOT',
                                      lotSettings: { maxLots: segmentDefaults.maxLots || 50, minLots: segmentDefaults.minLots || 1, perOrderLots: segmentDefaults.orderLots || 10 },
                                      quantitySettings: { maxQuantity: 1000, minQuantity: 1, perOrderQuantity: 100 },
                                      fixedMargin: { intradayFuture: 0, carryFuture: 0, optionBuyIntraday: 0, optionBuyCarry: 0, optionSellIntraday: 0, optionSellCarry: 0 },
                                      brokerage: { type: segmentDefaults.commissionType || 'PER_LOT', value: segmentDefaults.commissionLot || 0 },
                                      spread: { buy: 0, sell: 0 },
                                      block: { future: false, option: false }
                                    }
                                  }
                                }));
                              }
                            }}
                            className="w-3 h-3 accent-purple-500"
                          />
                          <span className="truncate">{symbol}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Selected Symbol Settings */}
                  {selectedScript && editFormData.scriptSettings?.[selectedScript] && (
                    <div className="bg-dark-800 rounded-lg p-4 border border-purple-600">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-yellow-400">{selectedScript} Settings</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleSaveScriptSettings(selectedScript)}
                            disabled={saving}
                            className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-xs font-medium disabled:opacity-50"
                          >
                            {saving ? 'Saving...' : 'Save Script'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const updatedScripts = { ...editFormData.scriptSettings };
                              delete updatedScripts[selectedScript];
                              setEditFormData(prev => ({ ...prev, scriptSettings: updatedScripts }));
                              setSelectedScript(null);
                            }}
                            className="text-red-400 hover:text-red-300 text-xs"
                          >
                            Reset to Default
                          </button>
                        </div>
                      </div>
                      
                      {/* Setting Type Selection */}
                      <div className="mb-4">
                        <label className="block text-xs text-gray-400 font-medium mb-2">Setting Type</label>
                        <div className="flex flex-wrap gap-2">
                          {['LOT', 'QUANTITY', 'FIXED_MARGIN', 'BROKERAGE', 'SPREAD', 'BLOCK'].map(type => (
                            <button
                              key={type}
                              type="button"
                              onClick={() => setEditFormData(prev => ({
                                ...prev,
                                scriptSettings: {
                                  ...prev.scriptSettings,
                                  [selectedScript]: {
                                    ...prev.scriptSettings[selectedScript],
                                    settingType: type
                                  }
                                }
                              }))}
                              className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                                (editFormData.scriptSettings[selectedScript]?.settingType || 'LOT') === type
                                  ? 'bg-purple-600 text-white'
                                  : 'bg-dark-600 text-gray-400 hover:bg-dark-500'
                              }`}
                            >
                              {type === 'LOT' ? 'Lot' : type === 'QUANTITY' ? 'Quantity' : type === 'FIXED_MARGIN' ? 'Fixed Margin' : type === 'BROKERAGE' ? 'Brokerage' : type === 'SPREAD' ? 'Spread' : 'Block'}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      {/* Lot Settings */}
                      {(editFormData.scriptSettings[selectedScript]?.settingType || 'LOT') === 'LOT' && (
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-xs text-gray-500">Max Lots</label>
                            <input
                              type="number"
                              value={editFormData.scriptSettings[selectedScript]?.lotSettings?.maxLots || 50}
                              onChange={(e) => setEditFormData(prev => ({
                                ...prev,
                                scriptSettings: {
                                  ...prev.scriptSettings,
                                  [selectedScript]: {
                                    ...prev.scriptSettings[selectedScript],
                                    lotSettings: { ...prev.scriptSettings[selectedScript]?.lotSettings, maxLots: Number(e.target.value) }
                                  }
                                }
                              }))}
                              className="w-full bg-dark-600 border border-dark-500 rounded px-2 py-1 text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500">Min Lots</label>
                            <input
                              type="number"
                              value={editFormData.scriptSettings[selectedScript]?.lotSettings?.minLots || 1}
                              onChange={(e) => setEditFormData(prev => ({
                                ...prev,
                                scriptSettings: {
                                  ...prev.scriptSettings,
                                  [selectedScript]: {
                                    ...prev.scriptSettings[selectedScript],
                                    lotSettings: { ...prev.scriptSettings[selectedScript]?.lotSettings, minLots: Number(e.target.value) }
                                  }
                                }
                              }))}
                              className="w-full bg-dark-600 border border-dark-500 rounded px-2 py-1 text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500">Per Order</label>
                            <input
                              type="number"
                              value={editFormData.scriptSettings[selectedScript]?.lotSettings?.perOrderLots || 10}
                              onChange={(e) => setEditFormData(prev => ({
                                ...prev,
                                scriptSettings: {
                                  ...prev.scriptSettings,
                                  [selectedScript]: {
                                    ...prev.scriptSettings[selectedScript],
                                    lotSettings: { ...prev.scriptSettings[selectedScript]?.lotSettings, perOrderLots: Number(e.target.value) }
                                  }
                                }
                              }))}
                              className="w-full bg-dark-600 border border-dark-500 rounded px-2 py-1 text-xs"
                            />
                          </div>
                        </div>
                      )}
                      
                      {/* Quantity Settings */}
                      {editFormData.scriptSettings[selectedScript]?.settingType === 'QUANTITY' && (
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-xs text-gray-500">Max Qty</label>
                            <input
                              type="number"
                              value={editFormData.scriptSettings[selectedScript]?.quantitySettings?.maxQuantity || 1000}
                              onChange={(e) => setEditFormData(prev => ({
                                ...prev,
                                scriptSettings: {
                                  ...prev.scriptSettings,
                                  [selectedScript]: {
                                    ...prev.scriptSettings[selectedScript],
                                    quantitySettings: { ...prev.scriptSettings[selectedScript]?.quantitySettings, maxQuantity: Number(e.target.value) }
                                  }
                                }
                              }))}
                              className="w-full bg-dark-600 border border-dark-500 rounded px-2 py-1 text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500">Min Qty</label>
                            <input
                              type="number"
                              value={editFormData.scriptSettings[selectedScript]?.quantitySettings?.minQuantity || 1}
                              onChange={(e) => setEditFormData(prev => ({
                                ...prev,
                                scriptSettings: {
                                  ...prev.scriptSettings,
                                  [selectedScript]: {
                                    ...prev.scriptSettings[selectedScript],
                                    quantitySettings: { ...prev.scriptSettings[selectedScript]?.quantitySettings, minQuantity: Number(e.target.value) }
                                  }
                                }
                              }))}
                              className="w-full bg-dark-600 border border-dark-500 rounded px-2 py-1 text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500">Per Order</label>
                            <input
                              type="number"
                              value={editFormData.scriptSettings[selectedScript]?.quantitySettings?.perOrderQuantity || 100}
                              onChange={(e) => setEditFormData(prev => ({
                                ...prev,
                                scriptSettings: {
                                  ...prev.scriptSettings,
                                  [selectedScript]: {
                                    ...prev.scriptSettings[selectedScript],
                                    quantitySettings: { ...prev.scriptSettings[selectedScript]?.quantitySettings, perOrderQuantity: Number(e.target.value) }
                                  }
                                }
                              }))}
                              className="w-full bg-dark-600 border border-dark-500 rounded px-2 py-1 text-xs"
                            />
                          </div>
                        </div>
                      )}
                      
                      {/* Fixed Margin Settings */}
                      {editFormData.scriptSettings[selectedScript]?.settingType === 'FIXED_MARGIN' && (
                        <div className="space-y-3">
                          <div className="bg-dark-700 rounded p-3">
                            <span className="text-xs text-blue-400 font-medium block mb-2">Future Margins</span>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs text-gray-500">Intraday Future</label>
                                <input
                                  type="number"
                                  value={editFormData.scriptSettings[selectedScript]?.fixedMargin?.intradayFuture || 0}
                                  onChange={(e) => setEditFormData(prev => ({
                                    ...prev,
                                    scriptSettings: {
                                      ...prev.scriptSettings,
                                      [selectedScript]: {
                                        ...prev.scriptSettings[selectedScript],
                                        fixedMargin: { ...prev.scriptSettings[selectedScript]?.fixedMargin, intradayFuture: Number(e.target.value) }
                                      }
                                    }
                                  }))}
                                  className="w-full bg-dark-600 border border-dark-500 rounded px-2 py-1 text-xs"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-500">Carry Future</label>
                                <input
                                  type="number"
                                  value={editFormData.scriptSettings[selectedScript]?.fixedMargin?.carryFuture || 0}
                                  onChange={(e) => setEditFormData(prev => ({
                                    ...prev,
                                    scriptSettings: {
                                      ...prev.scriptSettings,
                                      [selectedScript]: {
                                        ...prev.scriptSettings[selectedScript],
                                        fixedMargin: { ...prev.scriptSettings[selectedScript]?.fixedMargin, carryFuture: Number(e.target.value) }
                                      }
                                    }
                                  }))}
                                  className="w-full bg-dark-600 border border-dark-500 rounded px-2 py-1 text-xs"
                                />
                              </div>
                            </div>
                          </div>
                          <div className="bg-dark-700 rounded p-3">
                            <span className="text-xs text-green-400 font-medium block mb-2">Option Buy Margins</span>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs text-gray-500">Option Buy Intraday</label>
                                <input
                                  type="number"
                                  value={editFormData.scriptSettings[selectedScript]?.fixedMargin?.optionBuyIntraday || 0}
                                  onChange={(e) => setEditFormData(prev => ({
                                    ...prev,
                                    scriptSettings: {
                                      ...prev.scriptSettings,
                                      [selectedScript]: {
                                        ...prev.scriptSettings[selectedScript],
                                        fixedMargin: { ...prev.scriptSettings[selectedScript]?.fixedMargin, optionBuyIntraday: Number(e.target.value) }
                                      }
                                    }
                                  }))}
                                  className="w-full bg-dark-600 border border-dark-500 rounded px-2 py-1 text-xs"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-500">Option Buy Carry</label>
                                <input
                                  type="number"
                                  value={editFormData.scriptSettings[selectedScript]?.fixedMargin?.optionBuyCarry || 0}
                                  onChange={(e) => setEditFormData(prev => ({
                                    ...prev,
                                    scriptSettings: {
                                      ...prev.scriptSettings,
                                      [selectedScript]: {
                                        ...prev.scriptSettings[selectedScript],
                                        fixedMargin: { ...prev.scriptSettings[selectedScript]?.fixedMargin, optionBuyCarry: Number(e.target.value) }
                                      }
                                    }
                                  }))}
                                  className="w-full bg-dark-600 border border-dark-500 rounded px-2 py-1 text-xs"
                                />
                              </div>
                            </div>
                          </div>
                          <div className="bg-dark-700 rounded p-3">
                            <span className="text-xs text-red-400 font-medium block mb-2">Option Sell Margins</span>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs text-gray-500">Option Sell Intraday</label>
                                <input
                                  type="number"
                                  value={editFormData.scriptSettings[selectedScript]?.fixedMargin?.optionSellIntraday || 0}
                                  onChange={(e) => setEditFormData(prev => ({
                                    ...prev,
                                    scriptSettings: {
                                      ...prev.scriptSettings,
                                      [selectedScript]: {
                                        ...prev.scriptSettings[selectedScript],
                                        fixedMargin: { ...prev.scriptSettings[selectedScript]?.fixedMargin, optionSellIntraday: Number(e.target.value) }
                                      }
                                    }
                                  }))}
                                  className="w-full bg-dark-600 border border-dark-500 rounded px-2 py-1 text-xs"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-500">Option Sell Carry</label>
                                <input
                                  type="number"
                                  value={editFormData.scriptSettings[selectedScript]?.fixedMargin?.optionSellCarry || 0}
                                  onChange={(e) => setEditFormData(prev => ({
                                    ...prev,
                                    scriptSettings: {
                                      ...prev.scriptSettings,
                                      [selectedScript]: {
                                        ...prev.scriptSettings[selectedScript],
                                        fixedMargin: { ...prev.scriptSettings[selectedScript]?.fixedMargin, optionSellCarry: Number(e.target.value) }
                                      }
                                    }
                                  }))}
                                  className="w-full bg-dark-600 border border-dark-500 rounded px-2 py-1 text-xs"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Brokerage Settings */}
                      {editFormData.scriptSettings[selectedScript]?.settingType === 'BROKERAGE' && (() => {
                        const segmentKey = editFormData.scriptSettings[selectedScript]?.segment || selectedScriptSegment;
                        const segmentDefaults = editFormData.segmentPermissions?.[segmentKey] || {};
                        return (
                        <div className="bg-dark-700 rounded p-3">
                          <span className="text-xs text-gray-600 block mb-2">(Segment default: {segmentDefaults.commissionType || 'PER_LOT'} - {segmentDefaults.commissionLot || 0})</span>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs text-gray-500">Brokerage Type</label>
                              <select
                                value={editFormData.scriptSettings[selectedScript]?.brokerage?.type || segmentDefaults.commissionType || 'PER_LOT'}
                                onChange={(e) => setEditFormData(prev => ({
                                  ...prev,
                                  scriptSettings: {
                                    ...prev.scriptSettings,
                                    [selectedScript]: {
                                      ...prev.scriptSettings[selectedScript],
                                      brokerage: { ...prev.scriptSettings[selectedScript]?.brokerage, type: e.target.value }
                                    }
                                  }
                                }))}
                                className="w-full bg-dark-600 border border-dark-500 rounded px-2 py-1 text-xs"
                              >
                                <option value="PER_LOT">Per Lot</option>
                                <option value="PER_CRORE">Per Crore</option>
                                <option value="PER_TRADE">Per Trade</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500">Brokerage Value</label>
                              <input
                                type="number"
                                value={editFormData.scriptSettings[selectedScript]?.brokerage?.value ?? segmentDefaults.commissionLot ?? 0}
                                onChange={(e) => setEditFormData(prev => ({
                                  ...prev,
                                  scriptSettings: {
                                    ...prev.scriptSettings,
                                    [selectedScript]: {
                                      ...prev.scriptSettings[selectedScript],
                                      brokerage: { ...prev.scriptSettings[selectedScript]?.brokerage, value: Number(e.target.value) }
                                    }
                                  }
                                }))}
                                className="w-full bg-dark-600 border border-dark-500 rounded px-2 py-1 text-xs"
                              />
                            </div>
                          </div>
                        </div>
                        );
                      })()}
                      
                      {/* Spread Settings */}
                      {editFormData.scriptSettings[selectedScript]?.settingType === 'SPREAD' && (
                        <div className="bg-dark-700 rounded p-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs text-gray-500">Buy Spread</label>
                              <input
                                type="number"
                                step="0.01"
                                value={editFormData.scriptSettings[selectedScript]?.spread?.buy || 0}
                                onChange={(e) => setEditFormData(prev => ({
                                  ...prev,
                                  scriptSettings: {
                                    ...prev.scriptSettings,
                                    [selectedScript]: {
                                      ...prev.scriptSettings[selectedScript],
                                      spread: { ...prev.scriptSettings[selectedScript]?.spread, buy: Number(e.target.value) }
                                    }
                                  }
                                }))}
                                className="w-full bg-dark-600 border border-dark-500 rounded px-2 py-1 text-xs"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500">Sell Spread</label>
                              <input
                                type="number"
                                step="0.01"
                                value={editFormData.scriptSettings[selectedScript]?.spread?.sell || 0}
                                onChange={(e) => setEditFormData(prev => ({
                                  ...prev,
                                  scriptSettings: {
                                    ...prev.scriptSettings,
                                    [selectedScript]: {
                                      ...prev.scriptSettings[selectedScript],
                                      spread: { ...prev.scriptSettings[selectedScript]?.spread, sell: Number(e.target.value) }
                                    }
                                  }
                                }))}
                                className="w-full bg-dark-600 border border-dark-500 rounded px-2 py-1 text-xs"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Block Settings */}
                      {editFormData.scriptSettings[selectedScript]?.settingType === 'BLOCK' && (
                        <div className="bg-dark-700 rounded p-3">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="flex items-center justify-between">
                              <label className="text-xs text-gray-500">Block Future</label>
                              <button
                                type="button"
                                onClick={() => setEditFormData(prev => ({
                                  ...prev,
                                  scriptSettings: {
                                    ...prev.scriptSettings,
                                    [selectedScript]: {
                                      ...prev.scriptSettings[selectedScript],
                                      block: { ...prev.scriptSettings[selectedScript]?.block, future: !prev.scriptSettings[selectedScript]?.block?.future }
                                    }
                                  }
                                }))}
                                className={`px-3 py-1 rounded text-xs font-medium ${
                                  editFormData.scriptSettings[selectedScript]?.block?.future
                                    ? 'bg-red-600 text-white'
                                    : 'bg-green-600 text-white'
                                }`}
                              >
                                {editFormData.scriptSettings[selectedScript]?.block?.future ? 'Yes' : 'No'}
                              </button>
                            </div>
                            <div className="flex items-center justify-between">
                              <label className="text-xs text-gray-500">Block Option</label>
                              <button
                                type="button"
                                onClick={() => setEditFormData(prev => ({
                                  ...prev,
                                  scriptSettings: {
                                    ...prev.scriptSettings,
                                    [selectedScript]: {
                                      ...prev.scriptSettings[selectedScript],
                                      block: { ...prev.scriptSettings[selectedScript]?.block, option: !prev.scriptSettings[selectedScript]?.block?.option }
                                    }
                                  }
                                }))}
                                className={`px-3 py-1 rounded text-xs font-medium ${
                                  editFormData.scriptSettings[selectedScript]?.block?.option
                                    ? 'bg-red-600 text-white'
                                    : 'bg-green-600 text-white'
                                }`}
                              >
                                {editFormData.scriptSettings[selectedScript]?.block?.option ? 'Yes' : 'No'}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Save Button */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowSettingsModal(false);
                  setSelectedUser(null);
                  setEditFormData(null);
                }}
                className="flex-1 bg-dark-600 hover:bg-dark-500 text-white py-2 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveUserSettings}
                disabled={saving}
                className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white py-2 rounded-lg"
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Notification Modal */}
      {showNotificationModal && (
        <SendNotificationModal 
          onClose={() => setShowNotificationModal(false)}
          token={admin.token}
          users={users}
          admins={[]}
          isSuperAdmin={false}
        />
      )}
    </div>
  );
};

const CreateUserModal = ({ onClose, onSuccess, token }) => {
  const [formData, setFormData] = useState({
    username: '', email: '', password: '', fullName: '', phone: '',
    isActive: true, isReadOnly: false
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await axios.post('/api/admin/users', formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || 'Error creating user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-dark-800 rounded-lg w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Create New User</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-400 px-4 py-2 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Username *</label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2 focus:outline-none focus:border-green-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Email *</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2 focus:outline-none focus:border-green-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Password *</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2 pr-10 focus:outline-none focus:border-green-500"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Full Name</label>
              <input
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2 focus:outline-none focus:border-green-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Phone</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2 focus:outline-none focus:border-green-500"
              />
            </div>

            {/* Account Controls */}
            <div className="border-t border-dark-600 pt-4 mt-4">
              <label className="block text-sm text-gray-400 mb-2">Account Controls</label>
              <div className="space-y-3">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="text-sm font-medium">Account Active</span>
                    <p className="text-xs text-gray-500">If disabled, user cannot login</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                    className={`w-12 h-6 rounded-full transition-colors ${formData.isActive ? 'bg-green-600' : 'bg-dark-600'}`}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full transition-transform ${formData.isActive ? 'translate-x-6' : 'translate-x-0.5'}`} />
                  </button>
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="text-sm font-medium">Read Only Mode</span>
                    <p className="text-xs text-gray-500">User can only view & close trades, cannot open new</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, isReadOnly: !formData.isReadOnly })}
                    className={`w-12 h-6 rounded-full transition-colors ${formData.isReadOnly ? 'bg-orange-600' : 'bg-dark-600'}`}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full transition-transform ${formData.isReadOnly ? 'translate-x-6' : 'translate-x-0.5'}`} />
                  </button>
                </label>
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-dark-600 hover:bg-dark-500 py-2 rounded transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-green-600 hover:bg-green-700 py-2 rounded transition disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const EditUserModal = ({ user, onClose, onSuccess, token }) => {
  const [formData, setFormData] = useState({
    username: user.username,
    email: user.email,
    fullName: user.fullName || '',
    phone: user.phone || '',
    isActive: user.isActive,
    isReadOnly: user.isReadOnly || false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await axios.put(`/api/admin/users/${user._id}`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || 'Error updating user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-dark-800 rounded-lg w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Edit User</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-400 px-4 py-2 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Username</label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2 focus:outline-none focus:border-green-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2 focus:outline-none focus:border-green-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Full Name</label>
              <input
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2 focus:outline-none focus:border-green-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Phone</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2 focus:outline-none focus:border-green-500"
              />
            </div>

            {/* Account Controls */}
            <div className="border-t border-dark-600 pt-4 mt-4">
              <label className="block text-sm text-gray-400 mb-2">Account Controls</label>
              <div className="space-y-3">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="text-sm font-medium">Account Active</span>
                    <p className="text-xs text-gray-500">If disabled, user cannot login</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                    className={`w-12 h-6 rounded-full transition-colors ${formData.isActive ? 'bg-green-600' : 'bg-dark-600'}`}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full transition-transform ${formData.isActive ? 'translate-x-6' : 'translate-x-0.5'}`} />
                  </button>
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="text-sm font-medium">Read Only Mode</span>
                    <p className="text-xs text-gray-500">User can only view & close trades, cannot open new</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, isReadOnly: !formData.isReadOnly })}
                    className={`w-12 h-6 rounded-full transition-colors ${formData.isReadOnly ? 'bg-orange-600' : 'bg-dark-600'}`}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full transition-transform ${formData.isReadOnly ? 'translate-x-6' : 'translate-x-0.5'}`} />
                  </button>
                </label>
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-dark-600 hover:bg-dark-500 py-2 rounded transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-green-600 hover:bg-green-700 py-2 rounded transition disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const PasswordModal = ({ user, onClose, token }) => {
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await axios.put(`/api/admin/users/${user._id}/password`, { newPassword }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccess(true);
      setTimeout(onClose, 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Error changing password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-dark-800 rounded-lg w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Change Password</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <p className="text-gray-400 mb-4">
          Changing password for: <span className="text-white">{user.username}</span>
        </p>

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-400 px-4 py-2 rounded mb-4">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-500/20 border border-green-500 text-green-400 px-4 py-2 rounded mb-4">
            Password changed successfully!
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm text-gray-400 mb-1">New Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2 pr-10 focus:outline-none focus:border-green-500"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-dark-600 hover:bg-dark-500 py-2 rounded transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || success}
              className="flex-1 bg-yellow-600 hover:bg-yellow-700 py-2 rounded transition disabled:opacity-50"
            >
              {loading ? 'Changing...' : 'Change Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const WalletModal = ({ user, onClose, onSuccess, token }) => {
  const { admin, updateAdmin } = useAuth();
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [walletData, setWalletData] = useState(null);
  const [adminBalance, setAdminBalance] = useState(admin?.wallet?.balance || 0);
  const [walletType, setWalletType] = useState('main'); // 'main' or 'trading'

  useEffect(() => {
    fetchWallet();
  }, []);

  const fetchWallet = async () => {
    try {
      const { data } = await axios.get(`/api/admin/manage/users/${user._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setWalletData(data);
    } catch (err) {
      console.error('Error fetching wallet:', err);
    }
  };

  const handleResetMargin = async () => {
    if (!confirm('Are you sure you want to reset this user\'s margin to 0? This should only be done if there are no open positions.')) {
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const { data } = await axios.post(`/api/admin/manage/users/${user._id}/reset-margin`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccess(`Margin reset: ${data.oldUsedMargin} → 0`);
      fetchWallet();
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || 'Error resetting margin');
    } finally {
      setLoading(false);
    }
  };

  const handleReconcileMargin = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const { data } = await axios.post(`/api/admin/manage/users/${user._id}/reconcile-margin`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccess(`Margin reconciled: ${data.oldUsedMargin} → ${data.newUsedMargin} (${data.openPositionsCount} open positions)`);
      fetchWallet();
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || 'Error reconciling margin');
    } finally {
      setLoading(false);
    }
  };

  const handleTransaction = async (type) => {
    if (!amount || Number(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    setLoading(true);
    setError('');
    try {
      // Use the correct API that handles admin wallet deduction/credit
      let endpoint;
      if (walletType === 'trading') {
        endpoint = type === 'deposit' 
          ? `/api/admin/manage/users/${user._id}/add-trading-funds`
          : `/api/admin/manage/users/${user._id}/deduct-trading-funds`;
      } else {
        endpoint = type === 'deposit' 
          ? `/api/admin/manage/users/${user._id}/add-funds`
          : `/api/admin/manage/users/${user._id}/deduct-funds`;
      }
      
      const { data } = await axios.post(endpoint, 
        { amount: Number(amount), description },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAmount('');
      setDescription('');
      fetchWallet();
      onSuccess();
      
      // Update admin balance display and context if available
      if (data.adminWallet) {
        setAdminBalance(data.adminWallet.balance);
        // Update admin context so balance is reflected across the app
        updateAdmin({ wallet: data.adminWallet });
      }
    } catch (err) {
      setError(err.response?.data?.message || `Error ${type}ing funds`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-dark-800 rounded-lg w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Manage Wallet</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        {/* Admin Wallet Info */}
        {admin?.role === 'ADMIN' && (
          <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3 mb-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-purple-400">Your Wallet Balance</span>
              <span className="text-lg font-bold text-purple-400">₹{adminBalance.toLocaleString()}</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">Funds will be deducted from your wallet when depositing to user</p>
          </div>
        )}

        {/* User Wallet Info */}
        <div className="bg-dark-700 rounded-lg p-4 mb-4">
          <p className="text-gray-400 text-sm">User: {user.fullName || user.username}</p>
          <p className="text-2xl font-bold text-green-400 mt-1">
            ₹{(walletData?.wallet?.cashBalance || walletData?.wallet?.balance || 0).toLocaleString()}
          </p>
          <div className="flex justify-between text-sm text-gray-400 mt-1">
            <span>Cash Balance: ₹{(walletData?.wallet?.cashBalance || 0).toLocaleString()}</span>
            <span>Trading: ₹{(walletData?.wallet?.tradingBalance || 0).toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm mt-1">
            <span className="text-yellow-400">Margin Used: ₹{(walletData?.wallet?.usedMargin || 0).toLocaleString()}</span>
            <span className="text-gray-400">Available: ₹{((walletData?.wallet?.tradingBalance || 0) - (walletData?.wallet?.usedMargin || 0)).toLocaleString()}</span>
          </div>
        </div>

        {/* Margin Management */}
        {(walletData?.wallet?.usedMargin > 0) && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-4">
            <p className="text-sm text-yellow-400 font-medium mb-2">Margin Management</p>
            <p className="text-xs text-gray-400 mb-3">If user has stuck margin with no open positions, use these options:</p>
            <div className="flex gap-2">
              <button
                onClick={handleReconcileMargin}
                disabled={loading}
                className="flex-1 text-xs bg-blue-600 hover:bg-blue-700 py-2 px-3 rounded disabled:opacity-50"
              >
                Reconcile Margin
              </button>
              <button
                onClick={handleResetMargin}
                disabled={loading}
                className="flex-1 text-xs bg-red-600 hover:bg-red-700 py-2 px-3 rounded disabled:opacity-50"
              >
                Reset to Zero
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-400 px-4 py-2 rounded mb-4">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-500/20 border border-green-500 text-green-400 px-4 py-2 rounded mb-4">
            {success}
          </div>
        )}

        <div className="space-y-4">
          {/* Wallet Type Selection */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Select Wallet</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setWalletType('main')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${walletType === 'main' ? 'bg-blue-600 text-white' : 'bg-dark-600 text-gray-400'}`}
              >
                Main Wallet
              </button>
              <button
                type="button"
                onClick={() => setWalletType('trading')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${walletType === 'trading' ? 'bg-purple-600 text-white' : 'bg-dark-600 text-gray-400'}`}
              >
                Trading Wallet
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Amount (₹)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2 focus:outline-none focus:border-green-500"
              placeholder="Enter amount"
              min="0"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Description (Optional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2 focus:outline-none focus:border-green-500"
              placeholder="Transaction note"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={() => handleTransaction('deposit')}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 py-2 rounded transition disabled:opacity-50"
          >
            <ArrowUpCircle size={18} />
            {walletType === 'trading' ? 'Add to Trading' : 'Deposit'}
          </button>
          <button
            onClick={() => handleTransaction('withdraw')}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 py-2 rounded transition disabled:opacity-50"
          >
            <ArrowDownCircle size={18} />
            {walletType === 'trading' ? 'Withdraw from Trading' : 'Withdraw'}
          </button>
        </div>

        {/* Transaction History */}
        {walletData?.wallet?.transactions?.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-medium text-gray-400 mb-2">Recent Transactions</h3>
            <div className="max-h-40 overflow-y-auto space-y-2">
              {walletData.wallet.transactions.slice(-5).reverse().map((tx, idx) => (
                <div key={idx} className="flex items-center justify-between bg-dark-700 rounded px-3 py-2 text-sm">
                  <div>
                    <span className={tx.type === 'deposit' || tx.type === 'credit' ? 'text-green-400' : 'text-red-400'}>
                      {tx.type.toUpperCase()}
                    </span>
                    <span className="text-gray-400 ml-2">{tx.description}</span>
                  </div>
                  <span className={tx.type === 'deposit' || tx.type === 'credit' ? 'text-green-400' : 'text-red-400'}>
                    {tx.type === 'deposit' || tx.type === 'credit' ? '+' : '-'}₹{tx.amount}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full mt-4 bg-dark-600 hover:bg-dark-500 py-2 rounded transition"
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default AdminDashboard;
