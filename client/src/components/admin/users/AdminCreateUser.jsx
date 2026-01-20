import { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import axios from 'axios';

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

          <div>
            <label className="block text-sm text-gray-400 mb-2">Full Name</label>
            <input
              type="text"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2"
            />
          </div>

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

          <div>
            <label className="block text-sm text-gray-400 mb-2">Phone</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2"
            />
          </div>

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

export default AdminCreateUser;
