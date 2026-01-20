import { Link } from 'react-router-dom';
import { Zap, ArrowRight, BarChart3, LineChart, Shield } from 'lucide-react';

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-dark-900 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-dark-600 bg-dark-800/50 backdrop-blur-sm fixed w-full z-50">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold">stockex</span>
        </div>
        <div className="flex gap-4">
          <Link to="/login" className="px-4 py-2 text-gray-300 hover:text-white transition">
            Login
          </Link>
          <Link to="/login?register=true" className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition">
            Create Account
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 pt-20">
        <div className="relative overflow-hidden">
          {/* Background Effects */}
          <div className="absolute inset-0">
            <div className="absolute top-20 left-1/4 w-96 h-96 bg-green-500/10 rounded-full blur-3xl" />
            <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
          </div>

          <div className="relative z-10 flex flex-col items-center justify-center px-8 py-20">
                        <h1 className="text-5xl md:text-6xl font-bold mb-6 text-center bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              Professional Trading Platform
            </h1>
            <p className="text-xl text-gray-400 mb-10 text-center max-w-2xl">
              Trade NSE, BSE, MCX with advanced charting, real-time data, and powerful tools
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 mb-16">
              <Link 
                to="/login?register=true" 
                className="flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 rounded-xl font-semibold transition shadow-lg shadow-green-500/25"
              >
                Create Account
                <ArrowRight size={18} />
              </Link>
              <Link 
                to="/login" 
                className="flex items-center justify-center gap-2 px-8 py-4 bg-dark-700 hover:bg-dark-600 border border-dark-500 rounded-xl font-semibold transition"
              >
                Already have an account? Login
              </Link>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl w-full">
              <div className="bg-dark-800/50 backdrop-blur-sm border border-dark-600 p-6 rounded-xl hover:border-green-500/50 transition">
                <Zap className="w-10 h-10 text-yellow-500 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Fast Execution</h3>
                <p className="text-gray-400 text-sm">Lightning fast order execution with minimal latency</p>
              </div>
              <div className="bg-dark-800/50 backdrop-blur-sm border border-dark-600 p-6 rounded-xl hover:border-green-500/50 transition">
                <LineChart className="w-10 h-10 text-green-500 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Advanced Charts</h3>
                <p className="text-gray-400 text-sm">TradingView powered charts with all indicators</p>
              </div>
              <div className="bg-dark-800/50 backdrop-blur-sm border border-dark-600 p-6 rounded-xl hover:border-green-500/50 transition">
                <Shield className="w-10 h-10 text-blue-500 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Secure Trading</h3>
                <p className="text-gray-400 text-sm">Bank-grade security for your funds and data</p>
              </div>
              <div className="bg-dark-800/50 backdrop-blur-sm border border-dark-600 p-6 rounded-xl hover:border-green-500/50 transition">
                <BarChart3 className="w-10 h-10 text-purple-500 mb-4" />
                <h3 className="text-lg font-semibold mb-2">All Segments</h3>
                <p className="text-gray-400 text-sm">NSE, BSE, MCX - Equity, F&O, Commodities</p>
              </div>
            </div>

            {/* Market Segments */}
            <div className="mt-16 text-center">
              <p className="text-gray-500 mb-4">Supported Exchanges</p>
              <div className="flex flex-wrap justify-center gap-6">
                {['NSE Equity', 'BSE Equity', 'NSE F&O', 'BSE F&O', 'MCX'].map(segment => (
                  <span key={segment} className="px-4 py-2 bg-dark-700 rounded-lg text-sm text-gray-300">
                    {segment}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-6 text-gray-500 border-t border-dark-600 bg-dark-800/50">
        <p>© 2024 stockex. All rights reserved.</p>
        <div className="flex justify-center gap-6 mt-2 text-sm">
          <Link to="/login" className="hover:text-green-400 transition">Login</Link>
          <span className="hover:text-gray-400 transition cursor-default">Terms</span>
          <span className="hover:text-gray-400 transition cursor-default">Privacy</span>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
