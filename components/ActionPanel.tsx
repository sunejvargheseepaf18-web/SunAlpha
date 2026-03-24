
import React, { useState } from 'react';
import { BrokerProfile, AssetIntelligence } from '../types';
import { UnifiedExecutionPanel } from './UnifiedExecutionPanel';
import { PiggyBank, Zap, TrendingUp, AlertTriangle, PlayCircle, CalendarClock } from 'lucide-react';

interface ActionPanelProps {
  intelligence: AssetIntelligence;
  broker: BrokerProfile;
  onTrade?: () => void;
}

export const ActionPanel: React.FC<ActionPanelProps> = ({ intelligence, broker, onTrade }) => {
  const [activeTab, setActiveTab] = useState<'INVEST' | 'TRADE'>('INVEST');
  const [sipAmount, setSipAmount] = useState(5000);
  const [sipDate, setSipDate] = useState('1st');

  // Logic to determine tabs based on instrument
  const isMF = intelligence.type === 'MUTUAL_FUND';
  const isDerivative = intelligence.type === 'DERIVATIVE';

  // MUTUAL FUND ACTION PANEL
  if (isMF) {
      return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full">
            <div className="p-4 bg-blue-50 border-b border-blue-100">
                <h3 className="font-bold text-blue-900 flex items-center">
                    <PiggyBank size={18} className="mr-2" /> Start Investment
                </h3>
            </div>
            
            <div className="p-5 flex-1 flex flex-col space-y-6">
                {/* SIP vs Lumpsum Toggle */}
                <div className="flex rounded-lg bg-gray-100 p-1">
                    <button 
                        onClick={() => setActiveTab('INVEST')} 
                        className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${activeTab === 'INVEST' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
                    >
                        SIP
                    </button>
                    <button 
                        onClick={() => setActiveTab('TRADE')} 
                        className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${activeTab === 'TRADE' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
                    >
                        One-Time
                    </button>
                </div>

                {/* Amount Input */}
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                        {activeTab === 'INVEST' ? 'Monthly SIP Amount' : 'Investment Amount'}
                    </label>
                    <div className="flex items-center mt-2 relative">
                        <span className="absolute left-4 text-gray-400 font-bold">₹</span>
                        <input 
                            type="number" 
                            value={sipAmount}
                            onChange={(e) => setSipAmount(Number(e.target.value))}
                            className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-xl font-mono font-bold text-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">Min. Amount: ₹{intelligence.mfData?.minSip || 500}</p>
                </div>

                {/* Date Selector (Only for SIP) */}
                {activeTab === 'INVEST' && (
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center">
                            <CalendarClock size={12} className="mr-1"/> SIP Date
                        </label>
                        <div className="flex space-x-2 mt-2">
                            {['1st', '5th', '10th', '15th'].map(date => (
                                <button 
                                    key={date}
                                    onClick={() => setSipDate(date)}
                                    className={`flex-1 py-2 text-xs font-bold rounded-lg border ${sipDate === date ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'}`}
                                >
                                    {date}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="mt-auto">
                    <button className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all flex items-center justify-center">
                        <PlayCircle size={20} className="mr-2" />
                        {activeTab === 'INVEST' ? 'Start SIP' : 'Invest Now'}
                    </button>
                    <p className="text-[10px] text-center text-gray-400 mt-3">
                        Orders processed via BSE Star MF / NSE NMF II.
                    </p>
                </div>
            </div>
        </div>
      );
  }

  // STANDARD EQUITY / DERIVATIVE PANEL
  const isInvestSuitable = intelligence.fundamental && intelligence.fundamental.overallScore > 60;
  const isTradeSuitable = intelligence.technical && intelligence.technical.overallScore > 60;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full">
      {/* Tabs */}
      <div className="flex border-b border-gray-100">
        <button
          onClick={() => setActiveTab('INVEST')}
          className={`flex-1 py-3 text-sm font-bold flex items-center justify-center space-x-2 transition-colors ${
            activeTab === 'INVEST' ? 'bg-emerald-50 text-emerald-700 border-b-2 border-emerald-500' : 'text-gray-500 hover:bg-gray-50'
          }`}
        >
          <PiggyBank size={16} />
          <span>Long Term</span>
        </button>
        <button
          onClick={() => setActiveTab('TRADE')}
          className={`flex-1 py-3 text-sm font-bold flex items-center justify-center space-x-2 transition-colors ${
            activeTab === 'TRADE' ? 'bg-orange-50 text-orange-700 border-b-2 border-orange-500' : 'text-gray-500 hover:bg-gray-50'
          }`}
        >
          <Zap size={16} />
          <span>Trading</span>
        </button>
      </div>

      <div className="p-4 flex-1 flex flex-col">
        {activeTab === 'INVEST' ? (
          <div className="space-y-6">
            {/* Invest Logic */}
            <div className={`p-3 rounded-lg text-sm ${isInvestSuitable ? 'bg-emerald-50 text-emerald-800' : 'bg-yellow-50 text-yellow-800'}`}>
                {isInvestSuitable ? (
                    <div className="flex items-start">
                        <TrendingUp size={16} className="mr-2 mt-0.5" />
                        <span><strong>Good for Accumulation:</strong> Fundamentals are strong (Score {intelligence.fundamental?.overallScore}).</span>
                    </div>
                ) : (
                    <div className="flex items-start">
                        <AlertTriangle size={16} className="mr-2 mt-0.5" />
                        <span><strong>Caution:</strong> Fundamental score is low ({intelligence.fundamental?.overallScore}). High risk for long-term hold.</span>
                    </div>
                )}
            </div>

            <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Monthly SIP Amount</label>
                <div className="flex items-center mt-2">
                    <span className="bg-gray-100 p-3 rounded-l-lg border border-r-0 border-gray-200 font-bold text-gray-500">₹</span>
                    <input 
                        type="number" 
                        value={sipAmount}
                        onChange={(e) => setSipAmount(Number(e.target.value))}
                        className="w-full p-3 border border-gray-200 rounded-r-lg font-mono font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                </div>
            </div>

            {/* Portfolio Impact Simulation */}
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Portfolio Impact</h4>
                <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Sector Exposure</span>
                    <span className="font-bold text-gray-800">12% &rarr; <span className="text-emerald-600">14%</span></span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Diversification</span>
                    <span className="font-bold text-gray-800">Good</span>
                </div>
            </div>

            <button className="w-full py-4 bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all flex items-center justify-center">
                <PlayCircle size={20} className="mr-2" />
                Start SIP in {intelligence.symbol}
            </button>
            <p className="text-[10px] text-center text-gray-400">Powered by Broker API. Orders executed on exchange.</p>
          </div>
        ) : (
          <div className="h-full flex flex-col">
            {/* Trade Logic */}
            {!isTradeSuitable && !isDerivative && (
                 <div className="mb-4 p-2 bg-red-50 text-red-700 text-xs rounded border border-red-100 flex items-center">
                     <AlertTriangle size={12} className="mr-2" />
                     Technicals are weak. Counter-trend trading carries high risk.
                 </div>
            )}
            
            <div className="flex-1">
                {/* UPGRADED TO UNIFIED EXECUTION PANEL */}
                <UnifiedExecutionPanel 
                    initialSymbol={intelligence.symbol} 
                    initialPrice={intelligence.price} 
                    broker={broker} 
                    onExecute={onTrade}
                />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
