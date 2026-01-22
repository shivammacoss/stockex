import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
// Legacy Admin Login (redirects based on role)
import AdminLoginLegacy from './pages/AdminLogin';
// Separate Login Pages
import SuperAdminLogin from './pages/admin/SuperAdminLogin';
import AdminLogin from './pages/admin/AdminLogin';
import BrokerLogin from './pages/admin/BrokerLogin';
import SubBrokerLogin from './pages/admin/SubBrokerLogin';
// Dashboards
import AdminDashboard from './pages/AdminDashboard';
import UserLogin from './pages/UserLogin';
import UserDashboardNew from './pages/UserDashboardNew';
import UserDashboard from './pages/UserDashboard';
import UserOrders from './pages/UserOrders';
import UserTransactions from './pages/UserTransactions';
import UserGames from './pages/UserGames';
import LandingPage from './pages/LandingPage';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('React Error:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', color: 'white', background: '#1a1a1a', minHeight: '100vh' }}>
          <h1>Something went wrong</h1>
          <pre style={{ color: 'red' }}>{this.state.error?.toString()}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const ProtectedAdminRoute = ({ children }) => {
  const { admin, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen bg-dark-900">Loading...</div>;
  if (!admin) {
    // Redirect to appropriate login based on current path
    const path = window.location.pathname;
    if (path.startsWith('/superadmin')) return <Navigate to="/superadmin/login" />;
    if (path.startsWith('/broker')) return <Navigate to="/broker/login" />;
    if (path.startsWith('/subbroker')) return <Navigate to="/subbroker/login" />;
    return <Navigate to="/admin/login" />;
  }
  return children;
};

const ProtectedUserRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen bg-dark-900">Loading...</div>;
  return user ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<UserLogin />} />
            
            {/* Separate Login Pages for each role */}
            <Route path="/superadmin/login" element={<SuperAdminLogin />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/broker/login" element={<BrokerLogin />} />
            <Route path="/subbroker/login" element={<SubBrokerLogin />} />
            
            {/* Legacy admin login - redirects based on role */}
            <Route path="/panel/login" element={<AdminLoginLegacy />} />
            
            {/* All admin dashboards use the same component for now (role-based rendering) */}
            <Route path="/superadmin/*" element={
              <ProtectedAdminRoute>
                <AdminDashboard />
              </ProtectedAdminRoute>
            } />
            <Route path="/admin/*" element={
              <ProtectedAdminRoute>
                <AdminDashboard />
              </ProtectedAdminRoute>
            } />
            <Route path="/broker/*" element={
              <ProtectedAdminRoute>
                <AdminDashboard />
              </ProtectedAdminRoute>
            } />
            <Route path="/subbroker/*" element={
              <ProtectedAdminRoute>
                <AdminDashboard />
              </ProtectedAdminRoute>
            } />
            {/* Trader Room - Separate page without sidebar */}
            <Route path="/user/trader-room" element={
              <ProtectedUserRoute>
                <UserDashboard />
              </ProtectedUserRoute>
            } />
            {/* Orders Page - Full page orders history */}
            <Route path="/user/orders" element={
              <ProtectedUserRoute>
                <UserOrders />
              </ProtectedUserRoute>
            } />
            {/* Transactions Page - All wallet and fund transactions */}
            <Route path="/user/transactions" element={
              <ProtectedUserRoute>
                <UserTransactions />
              </ProtectedUserRoute>
            } />
            {/* Games Page - Fantasy trading games */}
            <Route path="/user/games" element={
              <ProtectedUserRoute>
                <UserGames />
              </ProtectedUserRoute>
            } />
            {/* User CRM Dashboard with sidebar */}
            <Route path="/user/*" element={
              <ProtectedUserRoute>
                <UserDashboardNew />
              </ProtectedUserRoute>
            } />
            <Route path="/dashboard" element={<Navigate to="/user/home" replace />} />
            <Route path="/dashboard/*" element={<Navigate to="/user/home" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
