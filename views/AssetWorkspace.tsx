
import React, { useEffect, useState } from 'react';
import { SimpleAreaChart } from '../components/Charts';
import { TradingViewChart } from '../components/TradingViewChart';
import { TechnicalAnalysis } from '../components/TechnicalAnalysis';
import { FundamentalAnalysis } from '../components/FundamentalAnalysis';
import { ActionPanel } from '../components/ActionPanel';
import { getAssetIntelligence } from '../services/orchestrator';
import { getBrokerProfile } from '../services/brokerService';
import { calculateEMASeries } from '../services/technicalAnalysis';
import { AssetIntelligence, BrokerProfile, ExecutionMode } from '../types';
import { Layers, Activity, FileText, ArrowLeft, Maximize2, Info, PieChart } from 'lucide-react';
import { ConvictionBadge } from '../components/ConvictionBadge';
import { DebatePanel } from '../components/DebatePanel';
import { BacktestPanel } from '../components/BacktestPanel';

interface AssetWorkspaceProps {
  symbol?: string;
  onBack?: () => void;
  executionMode: ExecutionMode;
}

export const AssetWorkspace: React.FC<AssetWorkspaceProps> = ({ symbol = 'RELIANCE', onBack, executionMode }) => {
  const [intelligence, setIntelligence] = useState<AssetIntelligence | null>(null);
  const [broker, setBroker] = useState<BrokerProfile | null>(null);
  const [emaData, setEmaData] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'CHART' | 'FUNDAMENTAL' | 'TECHNICAL'>('CHART');

  useEffect(() => {
    const init = async () => {
      // Fetch broker corresponding to the ACTIVE execution mode
      const [intel, brk] = await Promise.all([
        getAssetIntelligence(symbol),
        getBrokerProfile(executionMode)
      ]);
      setIntelligence(intel);
      setBroker(brk);

      if (intel.stockData && intel.stockData.history.length > 0) {
        setEmaData(calculateEMASeries(intel.stockData.history, 20));
      }
    };
    init();
  }, [symbol, executionMode]);

  if (!intelligence || !broker) return <div className="p-8 text-indigo-500 animate-pulse">Loading workspace for {symbol}...</div>;

  const isMF = intelligence.type === 'MUTUAL_FUND';

  return (
    <div className="flex flex-col h-full space-y-4 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center space-x-4">
           {onBack && (
               <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
                   <ArrowLeft size={20} />
               </button>
           )}
           <div>
               <div className="flex items-center space-x-2">
                   <h1 className="text-2xl font-bold text-gray-900">{intelligence.symbol}</h1>
                   {isMF && <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded">MF</span>}
                   {executionMode === 'PAPER' && <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded border border-amber-200">PAPER</span>}
               </div>
               <p className="text-xs text-gray-500">
                   {isMF ? intelligence.mfData?.fundName : intelligence.stockData?.name}
               </p>
           </div>
           <div className="h-8 w-px bg-gray-200"></div>
           <div>
               <p className={`text-xl font-mono font-bold ${intelligence.price >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                  ₹{intelligence.price.toFixed(2)}
               </p>
               {intelligence.stockData && (
                   <p className={`text-xs font-bold ${intelligence.stockData.change >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {intelligence.stockData.change >= 0 ? '+' : ''}{intelligence.stockData.change} ({intelligence.stockData.changePercent}%)
                   </p>
               )}
               {intelligence.mfData && (
                   <p className={`text-xs font-bold ${intelligence.mfData.change >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {intelligence.mfData.change >= 0 ? '+' : ''}{intelligence.mfData.change} ({intelligence.mfData.changePercent}%)
                   </p>
               )}
           </div>
        </div>
        
        {!isMF && (
            <div className="flex space-x-2">
                <button 
                    onClick={() => setActiveTab('CHART')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-bold flex items-center ${activeTab === 'CHART' ? 'bg-slate-900 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                >
                    <Activity size={16} className="mr-2"/> Chart
                </button>
                <button 
                    onClick={() => setActiveTab('TECHNICAL')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-bold flex items-center ${activeTab === 'TECHNICAL' ? 'bg-slate-900 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                >
                    <Layers size={16} className="mr-2"/> Technicals
                </button>
                <button 
                    onClick={() => setActiveTab('FUNDAMENTAL')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-bold flex items-center ${activeTab === 'FUNDAMENTAL' ? 'bg-slate-900 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                >
                    <FileText size={16} className="mr-2"/> Fundamentals
                </button>
            </div>
        )}
      </div>

      {/* Main Grid */}
      <div className="flex-1 grid grid-cols-12 gap-6 min-h-0">
         
         {/* Left Column: Analysis (8 cols) */}
         <div className="col-span-12 lg:col-span-8 flex flex-col gap-4 overflow-y-auto scrollbar-hide">
            
            {/* A. STOCK / ETF RENDERER */}
            {!isMF && (
                <>
                    {activeTab === 'CHART' && intelligence.stockData && (
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden min-h-[500px]">
                            <TradingViewChart 
                                data={intelligence.stockData.history}
                                cpr={intelligence.technical?.cpr}
                                emaData={emaData}
                            />
                        </div>
                    )}
                    
                    {activeTab === 'TECHNICAL' && intelligence.technical && (
                        <>
                            <TechnicalAnalysis report={intelligence.technical} />
                            <BacktestPanel symbol={intelligence.symbol} />
                        </>
                    )}

                    {activeTab === 'FUNDAMENTAL' && intelligence.fundamental && (
                        <FundamentalAnalysis report={intelligence.fundamental} />
                    )}

                    {activeTab === 'CHART' && intelligence.conviction && (
                        <ConvictionBadge report={intelligence.conviction} />
                    )}

                    {activeTab === 'CHART' && intelligence.debate && (
                        <DebatePanel verdict={intelligence.debate} />
                    )}
                </>
            )}

            {/* B. MUTUAL FUND RENDERER */}
            {isMF && intelligence.mfData && (
                <div className="space-y-6">
                    {/* NAV Chart (Simplified) */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                        <h4 className="font-bold text-gray-800 mb-4">NAV Performance (1 Year)</h4>
                        <div className="h-64">
                            <SimpleAreaChart 
                                data={intelligence.mfData.history.map(h => ({ date: h.date, close: h.value }))} 
                                color="#3b82f6" 
                            />
                        </div>
                    </div>

                    {/* Fund Fundamentals Grid */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm text-center">
                            <p className="text-xs text-gray-500 uppercase font-bold">Category</p>
                            <p className="font-bold text-gray-800 mt-1">{intelligence.mfData.category}</p>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm text-center">
                            <p className="text-xs text-gray-500 uppercase font-bold">Risk Profile</p>
                            <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-bold ${intelligence.mfData.risk === 'High' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                {intelligence.mfData.risk}
                            </span>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm text-center">
                            <p className="text-xs text-gray-500 uppercase font-bold">Expense Ratio</p>
                            <p className="font-bold text-gray-800 mt-1">{intelligence.mfData.expenseRatio}%</p>
                        </div>
                    </div>

                    {/* Returns Table */}
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                        <div className="p-4 border-b border-gray-100 bg-gray-50">
                            <h4 className="font-bold text-gray-800 flex items-center">
                                <PieChart size={16} className="mr-2 text-blue-600"/> Fund Returns vs Category
                            </h4>
                        </div>
                        <table className="w-full text-sm text-center">
                            <thead className="text-gray-500 font-medium bg-white">
                                <tr>
                                    <th className="py-3">Period</th>
                                    <th className="py-3">Fund Returns</th>
                                    <th className="py-3">Category Avg</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                <tr>
                                    <td className="py-3 text-gray-600">1 Year</td>
                                    <td className="py-3 font-bold text-emerald-600">{intelligence.mfData.returns['1Y']}%</td>
                                    <td className="py-3 text-gray-500">{intelligence.mfData.returns['1Y'] - 2.5}%</td>
                                </tr>
                                <tr>
                                    <td className="py-3 text-gray-600">3 Years</td>
                                    <td className="py-3 font-bold text-emerald-600">{intelligence.mfData.returns['3Y']}%</td>
                                    <td className="py-3 text-gray-500">{intelligence.mfData.returns['3Y'] - 1.2}%</td>
                                </tr>
                                <tr>
                                    <td className="py-3 text-gray-600">5 Years</td>
                                    <td className="py-3 font-bold text-emerald-600">{intelligence.mfData.returns['5Y']}%</td>
                                    <td className="py-3 text-gray-500">{intelligence.mfData.returns['5Y'] - 0.8}%</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

         </div>

         {/* Right Column: Action Panel (4 cols) */}
         <div className="col-span-12 lg:col-span-4 h-full min-h-[500px]">
             <ActionPanel intelligence={intelligence} broker={broker} />
         </div>

      </div>
    </div>
  );
};
