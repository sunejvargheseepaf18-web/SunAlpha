import React, { useState } from 'react';
import { BrokerProfile } from '../types';
import { connectBroker } from '../services/brokerService';
import { Link2, CheckCircle, Wallet, AlertTriangle } from 'lucide-react';

interface BrokerConnectProps {
  broker: BrokerProfile;
  onUpdate: (b: BrokerProfile) => void;
}

export const BrokerConnect: React.FC<BrokerConnectProps> = ({ broker, onUpdate }) => {
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    setLoading(true);
    try {
      const updated = await connectBroker(broker.id);
      onUpdate(updated);
    } catch (e) {
      alert("Failed to connect broker");
    } finally {
      setLoading(false);
    }
  };

  if (broker.connected) {
    return (
      <div className="bg-white rounded-xl p-4 border border-emerald-100 shadow-sm">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center font-bold text-gray-600">
               {broker.name[0]}
            </div>
            <div>
              <p className="text-sm font-bold text-gray-800">{broker.name}</p>
              <div className="flex items-center text-xs text-emerald-600">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1 animate-pulse" />
                Connected
              </div>
            </div>
          </div>
          <button className="text-xs text-gray-400 hover:text-red-500">Disconnect</button>
        </div>
        
        <div className="mt-3 p-3 bg-gray-50 rounded-lg flex justify-between items-center">
          <div className="flex items-center text-gray-600">
            <Wallet size={16} className="mr-2" />
            <span className="text-xs font-medium">Funds</span>
          </div>
          <span className="font-mono font-bold text-gray-900">₹{broker.funds.toLocaleString()}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-orange-50 rounded-xl p-4 border border-orange-100 text-center">
      <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm text-orange-500">
        <Link2 size={20} />
      </div>
      <h4 className="font-bold text-gray-800 text-sm mb-1">Connect Broker</h4>
      <p className="text-xs text-gray-500 mb-4">Link your Zerodha/Fyers account to execute trades directly.</p>
      
      <button 
        onClick={handleConnect}
        disabled={loading}
        className="w-full py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
      >
        {loading ? 'Connecting...' : `Link ${broker.name}`}
      </button>
      
      <p className="text-[10px] text-gray-400 mt-2 flex items-center justify-center">
        <AlertTriangle size={10} className="mr-1" />
        Trades routed via secure API
      </p>
    </div>
  );
};
