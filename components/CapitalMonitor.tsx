
import React, { useState } from 'react';
import { CapitalSnapshot } from '../types';
import { ShieldCheck, AlertTriangle, TrendingDown, Layers, Wallet, Gauge } from 'lucide-react';

interface CapitalMonitorProps {
  snapshot: CapitalSnapshot;
  compact?: boolean;
}

export const CapitalMonitor: React.FC<CapitalMonitorProps> = ({ snapshot, compact = false }) => {
  const [activeScenario, setActiveScenario] = useState<number>(0); // Index of scenario

  // Risk Colors
  const riskColor = {
    'LOW': 'text-emerald-600 bg-emerald-50 border-emerald-200',
    'MODERATE': 'text-yellow-600 bg-yellow-50 border-yellow-200',
    'HIGH': 'text-orange-600 bg-orange-50 border-orange-200',
    'CRITICAL': 'text-red-600 bg-red-50 border-red-200',
  }[snapshot.riskLevel];

  if (compact) {
      return (
          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm flex items-center justify-between">
              <div>
                  <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Capital Health</p>
                  <div className="flex items-center space-x-2">
                      <h3 className="text-lg font-bold text-gray-900">{(snapshot.leverageRatio).toFixed(2)}x <span className="text-xs font-normal text-gray-500">Lev</span></h3>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${riskColor}`}>
                          {snapshot.riskLevel}
                      </span>
                  </div>
              </div>
              <div className="text-right">
                  <p className="text-xs text-gray-400 mb-1">Margin Used</p>
                  <p className="font-mono text-sm font-bold text-gray-800">₹{(snapshot.marginUsed/1000).toFixed(1)}k</p>
              </div>
          </div>
      );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
            <h3 className="font-bold text-gray-800 flex items-center">
                <Gauge className="mr-2 text-indigo-600" size={20} />
                Capital & Margin Monitor
            </h3>
            <div className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center ${riskColor}`}>
                {snapshot.riskLevel === 'LOW' ? <ShieldCheck size={14} className="mr-1"/> : <AlertTriangle size={14} className="mr-1"/>}
                RISK: {snapshot.riskLevel}
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2">
            {/* Left: Composition */}
            <div className="p-5 border-r border-gray-100">
                <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold text-gray-400 uppercase">Capital Split</span>
                    {/* The parts below are Cash + Invested + Margin — the total
                        must be their sum (own capital), not bare exposure,
                        or the row visibly fails to add up. */}
                    <span className="text-xs text-gray-500">Total: <span className="font-bold text-gray-900">₹{((snapshot.ownCash + snapshot.investedOwnCapital + snapshot.marginUsed)/100000).toFixed(2)}L</span></span>
                </div>
                
                {/* Visual Bar */}
                <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden flex mb-4">
                    <div className="bg-emerald-500 h-full" style={{ width: `${(snapshot.ownCash / (snapshot.totalExposure + snapshot.ownCash)) * 100}%` }} title="Cash" />
                    <div className="bg-blue-500 h-full" style={{ width: `${(snapshot.investedOwnCapital / (snapshot.totalExposure + snapshot.ownCash)) * 100}%` }} title="Invested Capital" />
                    <div className="bg-orange-500 h-full" style={{ width: `${(snapshot.marginUsed / (snapshot.totalExposure + snapshot.ownCash)) * 100}%` }} title="Margin" />
                </div>
                
                <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="flex flex-col">
                        <span className="text-emerald-600 font-bold">Cash</span>
                        <span className="text-gray-600">₹{(snapshot.ownCash/1000).toFixed(0)}k</span>
                    </div>
                    <div className="flex flex-col text-center">
                        <span className="text-blue-600 font-bold">Invested</span>
                        <span className="text-gray-600">₹{(snapshot.investedOwnCapital/1000).toFixed(0)}k</span>
                    </div>
                    <div className="flex flex-col text-right">
                        <span className="text-orange-600 font-bold">Margin</span>
                        <span className="text-gray-600">₹{(snapshot.marginUsed/1000).toFixed(0)}k</span>
                    </div>
                </div>
            </div>

            {/* Right: Stress Test Scenario */}
            <div className="p-5 bg-indigo-50/20">
                <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold text-indigo-400 uppercase flex items-center">
                        <TrendingDown size={14} className="mr-1" /> Stress Test
                    </span>
                    <div className="flex space-x-1">
                        {snapshot.scenarios.map((s, i) => (
                            <button 
                                key={i}
                                onClick={() => setActiveScenario(i)}
                                className={`px-2 py-0.5 text-[10px] font-bold rounded border ${activeScenario === i ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-200'}`}
                            >
                                -{s.dropPercentage}%
                            </button>
                        ))}
                    </div>
                </div>

                <div className="bg-white rounded-lg p-3 border border-indigo-100 shadow-sm">
                    <div className="flex justify-between items-center mb-2">
                         <span className="text-xs text-gray-500">Projected Equity</span>
                         <span className="text-sm font-bold text-gray-800">₹{(snapshot.scenarios[activeScenario].projectedEquity/1000).toFixed(1)}k</span>
                    </div>
                    <div className="flex justify-between items-center">
                         <span className="text-xs text-gray-500">Margin Call Risk</span>
                         <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                             snapshot.scenarios[activeScenario].marginCallRisk === 'NONE' ? 'bg-gray-100 text-gray-600' :
                             snapshot.scenarios[activeScenario].marginCallRisk === 'POSSIBLE' ? 'bg-yellow-100 text-yellow-700' :
                             'bg-red-100 text-red-700 animate-pulse'
                         }`}>
                             {snapshot.scenarios[activeScenario].marginCallRisk}
                         </span>
                    </div>
                </div>
                <p className="text-[10px] text-gray-400 mt-2 text-center">
                    Estimated impact of a {snapshot.scenarios[activeScenario].dropPercentage}% market correction.
                </p>
            </div>
        </div>
    </div>
  );
};
