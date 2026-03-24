
import React, { useState, useEffect } from 'react';
import { RebalanceSimulation, DriftMetric, RebalanceAction } from '../types';
import { RefreshCcw, AlertTriangle, CheckCircle, TrendingDown, DollarSign, ChevronDown, Plus, Trash2, Edit2, RotateCw, ArrowRight, Shuffle } from 'lucide-react';

interface RebalancePanelProps {
  simulation: RebalanceSimulation;
  onSimulate?: () => void;
}

const MetricRow: React.FC<{ metric: DriftMetric }> = ({ metric }) => {
    const isOver = metric.drift > 0;
    const color = metric.severity === 'HIGH' ? 'text-red-500' : metric.severity === 'MODERATE' ? 'text-yellow-600' : 'text-gray-400';
    
    return (
        <div className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
            <div className="flex items-center space-x-3">
                <div className={`w-2 h-2 rounded-full ${
                    metric.assetClass === 'equity' ? 'bg-blue-500' :
                    metric.assetClass === 'debt' ? 'bg-emerald-500' :
                    metric.assetClass === 'gold' ? 'bg-yellow-500' : 'bg-gray-400'
                }`} />
                <span className="capitalize text-sm font-medium text-gray-700">{metric.assetClass}</span>
            </div>
            
            <div className="flex items-center space-x-6">
                <div className="text-right">
                    <p className="text-xs text-gray-400">Target</p>
                    <p className="text-sm font-bold text-gray-800">{metric.target}%</p>
                </div>
                <div className="text-right">
                    <p className="text-xs text-gray-400">Current</p>
                    <p className={`text-sm font-bold ${isOver ? 'text-orange-600' : 'text-blue-600'}`}>
                        {metric.current.toFixed(1)}%
                    </p>
                </div>
                <div className={`w-16 text-right font-mono text-xs font-bold ${color}`}>
                    {metric.drift > 0 ? '+' : ''}{metric.drift.toFixed(1)}%
                </div>
            </div>
        </div>
    );
};

export const RebalancePanel: React.FC<RebalancePanelProps> = ({ simulation, onSimulate }) => {
  // Local state for interactive editing
  const [actions, setActions] = useState<RebalanceAction[]>(simulation.actions);
  
  // Recalculated Summaries based on local actions
  const totalBuy = actions.filter(a => a.type === 'BUY').reduce((acc, a) => acc + a.amount, 0);
  const totalSell = actions.filter(a => a.type === 'SELL').reduce((acc, a) => acc + a.amount, 0);
  const estTax = actions.reduce((acc, a) => acc + (a.taxImpact || 0), 0);
  
  // Logic to swap instruments
  const handleSwap = (actionId: string, newSymbol: string, newReason: string) => {
      setActions(prev => prev.map(a => {
          if (a.id === actionId) {
              return { ...a, symbol: newSymbol, reason: `Switched to ${newSymbol}: ${newReason}` };
          }
          return a;
      }));
  };

  // Logic to update amount
  const handleAmountChange = (actionId: string, newAmount: number) => {
      setActions(prev => prev.map(a => {
          if (a.id === actionId) {
              return { ...a, amount: newAmount };
          }
          return a;
      }));
  };

  // Logic to delete an action
  const handleDelete = (actionId: string) => {
      setActions(prev => prev.filter(a => a.id !== actionId));
  };

  // Logic to add a manual transaction
  const handleAddManual = () => {
      const newAction: RebalanceAction = {
          id: `manual-${Date.now()}`,
          type: 'BUY',
          symbol: 'INFY',
          assetClass: 'equity',
          amount: 10000,
          reason: 'Manual Adjustment',
          isManual: true,
          alternatives: [
              { symbol: 'TCS', name: 'Tata Consultancy', reason: 'Peer' },
              { symbol: 'HCLTECH', name: 'HCL Tech', reason: 'Peer' }
          ]
      };
      setActions([...actions, newAction]);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full">
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
            <div>
                <h3 className="text-lg font-bold text-gray-800 flex items-center">
                    <RefreshCcw className="mr-2 text-indigo-600" size={20} />
                    Smart Rebalance
                </h3>
                <p className="text-xs text-gray-500">Target Profile: <span className="font-bold text-gray-700">{simulation.profileName}</span></p>
            </div>
            <div className={`px-3 py-1 rounded-full text-xs font-bold flex items-center ${
                simulation.status === 'CRITICAL' ? 'bg-red-100 text-red-700 border border-red-200' :
                simulation.status === 'DRIFTING' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' :
                'bg-emerald-100 text-emerald-700 border border-emerald-200'
            }`}>
                {simulation.status === 'CRITICAL' && <AlertTriangle size={12} className="mr-1" />}
                {simulation.status === 'BALANCED' && <CheckCircle size={12} className="mr-1" />}
                {simulation.status}
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 flex-1">
            {/* Left: Drift Metrics (Read-only context) */}
            <div className="p-5 border-r border-gray-100">
                <h4 className="text-xs font-bold text-gray-400 uppercase mb-4">Allocation Drift</h4>
                <div>
                    {simulation.metrics.map(m => <MetricRow key={m.assetClass} metric={m} />)}
                </div>
                
                <div className="mt-8 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                     <p className="text-xs font-bold text-indigo-800 uppercase mb-2">Rebalance Impact</p>
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-[10px] text-gray-500 uppercase">Est. Tax</p>
                            <p className="text-sm font-bold text-gray-800 flex items-center">
                                <DollarSign size={12} className="text-gray-400 mr-1" />
                                ₹{estTax.toFixed(0)}
                            </p>
                        </div>
                        <div>
                            <p className="text-[10px] text-gray-500 uppercase">Risk Reduction</p>
                            <p className="text-sm font-bold text-emerald-600 flex items-center">
                                <TrendingDown size={12} className="mr-1" />
                                {simulation.volatilityReduction}%
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right: Interactive Actions */}
            <div className="p-5 bg-indigo-50/30 flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h4 className="text-xs font-bold text-indigo-400 uppercase">Proposed Actions</h4>
                    <button 
                        onClick={handleAddManual}
                        className="text-xs bg-white border border-dashed border-indigo-300 text-indigo-600 px-2 py-1 rounded-md hover:bg-indigo-50 flex items-center"
                    >
                        <Plus size={12} className="mr-1"/> Add Txn
                    </button>
                </div>
                
                <div className="space-y-3 flex-1 overflow-y-auto max-h-[400px] pr-1 scrollbar-hide">
                    {actions.length === 0 ? (
                        <div className="text-center py-8 text-gray-400 text-sm">
                            <CheckCircle size={32} className="mx-auto mb-2 text-emerald-400" />
                            Portfolio is balanced.
                        </div>
                    ) : (
                        actions.map(action => (
                            <div key={action.id} className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm relative group transition-all hover:border-indigo-300">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center space-x-2">
                                        <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${action.type === 'SELL' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                            {action.type}
                                        </div>
                                        
                                        {/* Symbol Display */}
                                        <div className="font-bold text-gray-800 text-sm flex items-center">
                                            {action.symbol}
                                        </div>

                                        {/* Swap Action Trigger */}
                                        {action.alternatives && action.alternatives.length > 0 && (
                                            <div className="relative group/menu">
                                                <button className="text-[10px] flex items-center text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded hover:bg-indigo-100 ml-1">
                                                    <Shuffle size={10} className="mr-1" /> Swap
                                                </button>
                                                
                                                {/* Hover Menu for Alternatives */}
                                                <div className="absolute left-0 top-full mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-xl z-20 hidden group-hover/menu:block">
                                                    <div className="p-2 text-[10px] text-gray-400 uppercase font-bold border-b border-gray-100 bg-gray-50 rounded-t-lg">
                                                        Available Alternatives
                                                    </div>
                                                    {action.alternatives.map(alt => (
                                                        <div 
                                                            key={alt.symbol} 
                                                            onClick={() => handleSwap(action.id, alt.symbol, alt.reason)}
                                                            className="p-3 hover:bg-indigo-50 cursor-pointer border-b border-gray-50 last:border-0"
                                                        >
                                                            <div className="flex justify-between items-center mb-1">
                                                                <span className="font-bold text-gray-800 text-xs">{alt.symbol}</span>
                                                                {/* <span className="text-[10px] text-gray-400">{action.type}</span> */}
                                                            </div>
                                                            <div className="text-[10px] text-gray-500 leading-tight">{alt.reason}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* Amount Editor */}
                                    <div className="flex items-center">
                                        <span className="text-gray-400 text-xs mr-1">₹</span>
                                        <input 
                                            type="number" 
                                            value={action.amount}
                                            onChange={(e) => handleAmountChange(action.id, Number(e.target.value))}
                                            className="w-20 text-right text-sm font-bold font-mono border-b border-transparent hover:border-gray-300 focus:border-indigo-500 outline-none bg-transparent"
                                        />
                                    </div>
                                </div>
                                
                                <div className="flex justify-between items-center">
                                    <p className="text-[10px] text-gray-500 italic max-w-[80%] truncate">
                                        {action.reason}
                                    </p>
                                    <button 
                                        onClick={() => handleDelete(action.id)}
                                        className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="mt-4 pt-4 border-t border-indigo-200/50 flex justify-between text-xs font-bold text-gray-600">
                    <div>Sell: ₹{Math.round(totalSell).toLocaleString()}</div>
                    <div>Buy: ₹{Math.round(totalBuy).toLocaleString()}</div>
                </div>
            </div>
        </div>
        
        {/* Footer Action */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 text-center flex justify-between items-center">
             <p className="text-xs text-gray-400">Review all trades before executing.</p>
             <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg text-sm font-bold shadow-md transition-colors flex items-center">
                 Execute Plan <ArrowRight size={16} className="ml-2" />
             </button>
        </div>
    </div>
  );
};
