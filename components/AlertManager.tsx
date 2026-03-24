import React, { useState, useEffect } from 'react';
import { PriceAlert } from '../types';
import { getAlerts, createAlert, deleteAlert } from '../services/alertService';
import { Bell, BellRing, X, Trash2, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';

interface AlertManagerProps {
  symbol: string;
  currentPrice: number;
  onClose: () => void;
}

export const AlertManager: React.FC<AlertManagerProps> = ({ symbol, currentPrice, onClose }) => {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [targetPrice, setTargetPrice] = useState<string>('');
  const [condition, setCondition] = useState<'ABOVE' | 'BELOW'>('ABOVE');

  useEffect(() => {
    fetchAlerts();
    // Default logic: Set target slightly above current price
    setTargetPrice((currentPrice * 1.02).toFixed(2));
    setCondition('ABOVE');
  }, [symbol]);

  const fetchAlerts = async () => {
    setLoading(true);
    const data = await getAlerts(symbol);
    setAlerts(data);
    setLoading(false);
  };

  const handleAddAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetPrice) return;
    
    await createAlert(symbol, parseFloat(targetPrice), condition);
    await fetchAlerts();
    setTargetPrice('');
  };

  const handleDeleteAlert = async (id: string) => {
    await deleteAlert(id);
    await fetchAlerts();
  };

  // Auto-switch condition based on input relative to current price
  const handlePriceChange = (val: string) => {
    setTargetPrice(val);
    const num = parseFloat(val);
    if (!isNaN(num)) {
      if (num > currentPrice) setCondition('ABOVE');
      else setCondition('BELOW');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gray-50 p-4 border-b border-gray-100 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <div className="bg-orange-100 p-2 rounded-lg text-orange-600">
              <BellRing size={20} />
            </div>
            <div>
              <h3 className="font-bold text-gray-800">Set Price Alert</h3>
              <p className="text-xs text-gray-500">for {symbol} (CMP: <span className="font-mono font-medium text-gray-900">{currentPrice.toFixed(2)}</span>)</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Create Form */}
          <form onSubmit={handleAddAlert} className="mb-8">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 block">Alert Condition</label>
            
            <div className="flex items-center space-x-4 mb-4">
              <div className="flex-1 relative">
                 <input 
                    type="number" 
                    step="0.05"
                    value={targetPrice}
                    onChange={(e) => handlePriceChange(e.target.value)}
                    placeholder="Target Price"
                    className="w-full pl-8 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-mono text-lg font-bold focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                    autoFocus
                 />
                 <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₹</span>
              </div>
              
              <div className={`flex items-center space-x-2 px-4 py-3 rounded-xl border font-bold text-sm ${condition === 'ABOVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                 {condition === 'ABOVE' ? <TrendingUp size={18}/> : <TrendingDown size={18}/>}
                 <span>{condition === 'ABOVE' ? 'Crossing Up' : 'Crossing Down'}</span>
              </div>
            </div>

            <button 
                type="submit"
                className="w-full py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-black transition-all flex items-center justify-center space-x-2 shadow-lg shadow-gray-200"
            >
                <Bell size={18} />
                <span>Create Alert</span>
            </button>
          </form>

          {/* List */}
          <div>
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3 flex items-center">
                Active Alerts <span className="ml-2 bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-[10px]">{alerts.length}</span>
            </h4>
            
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1 scrollbar-hide">
              {loading ? (
                  <div className="text-center py-4 text-gray-400 text-xs">Loading alerts...</div>
              ) : alerts.length === 0 ? (
                  <div className="text-center py-6 border-2 border-dashed border-gray-100 rounded-xl">
                      <Bell size={24} className="mx-auto text-gray-300 mb-2" />
                      <p className="text-sm text-gray-400">No active alerts for {symbol}</p>
                  </div>
              ) : (
                  alerts.map(alert => (
                      <div key={alert.id} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl hover:shadow-sm transition-shadow group">
                          <div className="flex items-center space-x-3">
                              <div className={`p-2 rounded-lg ${alert.condition === 'ABOVE' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                                  {alert.condition === 'ABOVE' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                              </div>
                              <div>
                                  <p className="font-bold text-gray-800 text-sm">₹{alert.targetPrice.toLocaleString()}</p>
                                  <p className="text-[10px] text-gray-400">Created {new Date(alert.createdAt).toLocaleDateString()}</p>
                              </div>
                          </div>
                          <button 
                             onClick={() => handleDeleteAlert(alert.id)}
                             className="text-gray-300 hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition-all"
                          >
                             <Trash2 size={16} />
                          </button>
                      </div>
                  ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
