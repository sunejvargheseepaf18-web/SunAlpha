
import React, { useEffect, useState } from 'react';
import { AppMode, ExploreIntelligence, ScannerResult, Basket, OptionRadarItem, FailedSignal, AnalysisReport, ExploreContextMode, RebalanceSuggestion } from '../types';
import { getExploreIntelligence } from '../services/orchestrator';
import { runReport, getReports } from '../services/reports/reportService';
import { runMarketScans } from '../services/scannerEngine';
import { calculatePortfolio } from '../services/portfolioEngine';
import { generateTacticalSuggestions } from '../services/rebalanceEngine';
import { Compass, ScanSearch, TrendingUp, ArrowRight, Zap, Target, Activity, Layers, PlayCircle, AlertOctagon, Flame, FileText, Loader2, Clock, PieChart, CandlestickChart, Percent, Briefcase, ChevronDown } from 'lucide-react';
import { ContextPanel } from '../components/ContextPanel';
import { MarketStateCard } from '../components/SituationPanels';
import { RebalanceSuggestionCard } from '../components/RebalanceSuggestionCard';

interface ExploreProps {
  mode: AppMode;
  onInitiateRebalance: (suggestion: RebalanceSuggestion) => void;
}

// --- Cards ---

const ScannerCard: React.FC<{ scan: ScannerResult }> = ({ scan }) => (
    <div className="bg-white p-4 rounded-xl border border-gray-200 hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer group flex flex-col h-full">
        <div className="flex justify-between items-start mb-3">
            <div className="bg-indigo-50 text-indigo-700 p-2 rounded-lg">
                <ScanSearch size={20} />
            </div>
            <div className="flex space-x-1">
                 <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-2 py-1 rounded">
                    {scan.timeframe}
                </span>
                <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-2 py-1 rounded">
                    Risk:{scan.tags.find(t => t.includes('Risk'))?.split(':')[1] || 'N/A'}
                </span>
            </div>
        </div>
        <div className="mb-2">
            <h4 className="font-bold text-gray-800 text-lg">{scan.symbol}</h4>
            <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">{scan.type.replace('_', ' ')}</p>
        </div>
        <p className="text-sm text-gray-500 leading-snug flex-1">{scan.description}</p>
        
        <div className="mt-4 pt-3 border-t border-gray-50 flex justify-between items-center">
            <div className="w-24 bg-gray-100 rounded-full h-1.5">
                <div className={`h-1.5 rounded-full ${scan.signalStrength > 80 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${scan.signalStrength}%` }} />
            </div>
            <span className="text-xs font-bold text-gray-400">{scan.signalStrength}% Str.</span>
        </div>
    </div>
);

const BasketCard: React.FC<{ basket: Basket }> = ({ basket }) => (
    <div className="bg-white p-5 rounded-xl border border-gray-200 hover:border-indigo-200 hover:shadow-md transition-all cursor-pointer">
        <div className="flex justify-between items-start mb-4">
            <div className="bg-emerald-50 text-emerald-600 p-2 rounded-lg">
                <Layers size={20} />
            </div>
            <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                basket.volatility === 'HIGH' ? 'bg-red-50 text-red-600' :
                basket.volatility === 'MEDIUM' ? 'bg-yellow-50 text-yellow-600' :
                'bg-emerald-50 text-emerald-600'
            }`}>
                {basket.volatility} VOL
            </div>
        </div>
        <h4 className="font-bold text-gray-800 text-lg mb-1">{basket.name}</h4>
        <p className="text-sm text-gray-500 mb-4 h-10 line-clamp-2">{basket.description}</p>
        
        <div className="flex items-center justify-between border-t border-gray-50 pt-4">
            <div>
                <p className="text-xs text-gray-400">3Y CAGR</p>
                <p className="text-lg font-bold text-emerald-600">{basket.cagr}%</p>
            </div>
            <div>
                <p className="text-xs text-gray-400">Min. Amt</p>
                <p className="text-sm font-bold text-gray-800">₹{basket.minAmount.toLocaleString()}</p>
            </div>
        </div>
    </div>
);

const RadarCard: React.FC<{ item: OptionRadarItem }> = ({ item }) => (
    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex items-center justify-between">
        <div>
            <h5 className="font-bold text-gray-800 text-sm">{item.symbol}</h5>
            <p className="text-xs text-gray-500">{item.insight}</p>
        </div>
        <div className="text-right">
            <p className={`font-mono font-bold text-sm ${item.sentiment === 'BULLISH' ? 'text-emerald-600' : 'text-red-500'}`}>{item.value}</p>
            <p className={`text-[10px] font-bold ${item.sentiment === 'BULLISH' ? 'text-emerald-600' : 'text-red-500'}`}>{item.sentiment}</p>
        </div>
    </div>
);

// --- Mutual Fund Specific Cards (New) ---
const MutualFundCard: React.FC<{ title: string, subtitle: string, returns: string, risk: string, type: string }> = ({ title, subtitle, returns, risk, type }) => (
    <div className="bg-white p-4 rounded-xl border border-gray-200 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between">
        <div>
            <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-bold uppercase">{type}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${risk === 'High' ? 'bg-orange-50 text-orange-600' : 'bg-green-50 text-green-600'}`}>{risk} Risk</span>
            </div>
            <h4 className="font-bold text-gray-800 text-sm leading-snug">{title}</h4>
            <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-gray-50 pt-3">
            <div>
                <p className="text-[10px] text-gray-400 uppercase">3Y Returns</p>
                <p className="text-lg font-bold text-emerald-600">{returns}</p>
            </div>
            <button className="p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-emerald-600 hover:text-white transition-colors">
                <ArrowRight size={16} />
            </button>
        </div>
    </div>
);

// --- Main Component ---

export const Explore: React.FC<ExploreProps> = ({ mode, onInitiateRebalance }) => {
  const [activeTab, setActiveTab] = useState<'STOCKS' | 'MF' | 'FNO' | 'ETF'>('STOCKS');
  const [data, setData] = useState<ExploreIntelligence | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningScan, setRunningScan] = useState(false);
  
  // New Context Toggle State
  const [exploreContext, setExploreContext] = useState<ExploreContextMode>('MARKET');
  const [selectedStrategy, setSelectedStrategy] = useState<string>('BALANCED');
  const [rebalanceSuggestions, setRebalanceSuggestions] = useState<RebalanceSuggestion[]>([]);

  useEffect(() => {
    const load = async () => {
        if (mode === AppMode.EXPLORE) {
             const [intel, portfolio] = await Promise.all([
                 getExploreIntelligence(),
                 calculatePortfolio() // Needed for context aware view
             ]);
             
             setData(intel);
             
             // Generate tactical suggestions immediately if user switches context
             if (portfolio.positions.length > 0) {
                 const suggestions = generateTacticalSuggestions(
                     portfolio.positions, 
                     intel.scans, 
                     selectedStrategy
                 );
                 setRebalanceSuggestions(suggestions);
             }

             setLoading(false);
        }
    };
    load();
  }, [mode, selectedStrategy]); // Re-run if strategy changes

  const handleRunScan = async () => {
      setRunningScan(true);
      // Run the scan engine
      const newScans = await runMarketScans();
      
      // Update local data state with new scans
      if (data) {
          setData({
              ...data,
              scans: newScans // Refresh visual cards
          });
      }
      
      // Generate report in background (optional)
      runReport('MARKET_SCAN');
      
      setRunningScan(false);
  };

  const handleReviewRebalance = (suggestion: RebalanceSuggestion) => {
      // Navigate to Analyze Mode via Parent Prop
      onInitiateRebalance(suggestion);
  };

  if (loading) return <div className="p-8 animate-pulse text-indigo-500">Scanning market intelligence...</div>;
  if (!data) return null;

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* 1. Market Pulse Banner (Universal) */}
      <MarketStateCard pulse={data.pulse} />

      {/* 2. CONTEXT TOGGLE BAR (NEW) */}
      <div className="flex flex-col md:flex-row items-center justify-between bg-white p-2 rounded-xl border border-gray-200 shadow-sm gap-3">
          <div className="flex bg-gray-100 p-1 rounded-lg w-full md:w-auto">
              <button 
                onClick={() => setExploreContext('MARKET')}
                className={`flex-1 md:flex-none px-4 py-2 text-xs font-bold rounded-md transition-all flex items-center justify-center ${exploreContext === 'MARKET' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}
              >
                  <Compass size={14} className="mr-2"/> Market View
              </button>
              <button 
                onClick={() => setExploreContext('PORTFOLIO')}
                className={`flex-1 md:flex-none px-4 py-2 text-xs font-bold rounded-md transition-all flex items-center justify-center ${exploreContext === 'PORTFOLIO' ? 'bg-white shadow text-emerald-600' : 'text-gray-500'}`}
              >
                  <Briefcase size={14} className="mr-2"/> My Portfolio
              </button>
          </div>

          {exploreContext === 'PORTFOLIO' && (
              <div className="flex items-center space-x-2 w-full md:w-auto">
                  <span className="text-xs text-gray-500 font-medium whitespace-nowrap">Strategy:</span>
                  <div className="relative flex-1 md:flex-none">
                      <select 
                        value={selectedStrategy}
                        onChange={(e) => setSelectedStrategy(e.target.value)}
                        className="w-full md:w-40 appearance-none bg-indigo-50 text-indigo-700 text-xs font-bold py-2 pl-3 pr-8 rounded-lg outline-none cursor-pointer hover:bg-indigo-100"
                      >
                          <option value="AGGRESSIVE">Aggressive Growth</option>
                          <option value="BALANCED">Balanced</option>
                          <option value="CONSERVATIVE">Conservative</option>
                      </select>
                      <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-indigo-500 pointer-events-none" />
                  </div>
              </div>
          )}
      </div>

      {/* 3. Instrument Tabs (Only relevant in Market View) */}
      {exploreContext === 'MARKET' && (
        <div className="flex border-b border-gray-200">
            {[
                { id: 'STOCKS', label: 'Stocks', icon: CandlestickChart },
                { id: 'MF', label: 'Mutual Funds', icon: PieChart },
                { id: 'FNO', label: 'F&O', icon: Zap },
                { id: 'ETF', label: 'ETFs', icon: Layers }
            ].map(tab => (
                <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex-1 py-3 text-sm font-bold flex items-center justify-center space-x-2 border-b-2 transition-all ${
                        activeTab === tab.id 
                        ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50' 
                        : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                    }`}
                >
                    <tab.icon size={16} />
                    <span>{tab.label}</span>
                </button>
            ))}
        </div>
      )}

      {/* 4. CONTENT RENDERER */}
      <div className="min-h-[400px]">
          
          {/* A. PORTFOLIO CONTEXT VIEW (NEW) */}
          {exploreContext === 'PORTFOLIO' && (
              <div className="space-y-8 animate-in fade-in zoom-in-95 duration-300">
                  <ContextPanel title="Holdings-Aware Intelligence" type="TIP">
                      Showing opportunities tailored to your current portfolio composition and the <strong>{selectedStrategy}</strong> strategy.
                  </ContextPanel>

                  <section>
                      <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                          <Zap className="mr-2 text-orange-500" size={24}/> Tactical Rebalance Opportunities
                      </h3>
                      {rebalanceSuggestions.length > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                              {rebalanceSuggestions.map(sugg => (
                                  <RebalanceSuggestionCard 
                                    key={sugg.id} 
                                    suggestion={sugg} 
                                    onReview={() => handleReviewRebalance(sugg)} 
                                  />
                              ))}
                          </div>
                      ) : (
                          <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                              <p className="text-gray-500">Your portfolio is well-aligned with the {selectedStrategy} strategy.</p>
                              <p className="text-xs text-gray-400 mt-1">No tactical switches recommended at this time.</p>
                          </div>
                      )}
                  </section>
              </div>
          )}

          {/* B. MARKET CONTEXT VIEW (EXISTING) */}
          {exploreContext === 'MARKET' && activeTab === 'STOCKS' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-300">
                  <section>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-bold text-gray-800 flex items-center"><Target className="mr-2 text-indigo-600" size={24}/> High Conviction Scans</h3>
                        <button 
                            onClick={handleRunScan}
                            disabled={runningScan}
                            className="flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-200 disabled:opacity-70"
                        >
                            {runningScan ? <Loader2 size={16} className="mr-2 animate-spin"/> : <PlayCircle size={16} className="mr-2"/>}
                            {runningScan ? 'Scanning...' : 'Run New Scan'}
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {data.scans.map(scan => <ScannerCard key={scan.id} scan={scan} />)}
                    </div>
                  </section>

                  <section>
                    <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center"><TrendingUp className="mr-2 text-emerald-600" size={24}/> Thematic Baskets</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {data.baskets.map(basket => <BasketCard key={basket.id} basket={basket} />)}
                    </div>
                  </section>
                  
                  <section>
                     <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center"><AlertOctagon className="mr-2 text-slate-500" size={24}/> Failed Signals</h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {data.failedSignals.map(sig => (
                            <div key={sig.id} className="bg-slate-50 rounded-xl p-3 border border-slate-200 flex items-center">
                                <div className="w-2 h-2 rounded-full bg-slate-400 mr-3" />
                                <div>
                                    <p className="font-bold text-slate-700 text-sm">{sig.symbol}</p>
                                    <p className="text-xs text-slate-500">{sig.failureReason}</p>
                                </div>
                            </div>
                        ))}
                     </div>
                  </section>
              </div>
          )}

          {/* ... (Other Tabs remain same) ... */}
          {exploreContext === 'MARKET' && activeTab === 'MF' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                  <section>
                      <h3 className="text-xl font-bold text-gray-800 mb-4">Top Rated Funds</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <MutualFundCard title="Quant Small Cap Fund" subtitle="Direct Plan • Growth" returns="34.2%" risk="High" type="Small Cap" />
                          <MutualFundCard title="Parag Parikh Flexi Cap" subtitle="Direct Plan • Growth" returns="18.5%" risk="Moderate" type="Flexi Cap" />
                          <MutualFundCard title="HDFC Balanced Advantage" subtitle="Direct Plan • Growth" returns="14.8%" risk="Low" type="Hybrid" />
                      </div>
                  </section>
                  {/* ... Collections ... */}
              </div>
          )}

          {/* --- F&O VIEW --- */}
          {exploreContext === 'MARKET' && activeTab === 'FNO' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                  <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div>
                            <div className="flex items-center space-x-2 mb-4">
                                <Flame className="text-orange-500" size={24} />
                                <h3 className="text-xl font-bold text-gray-800">Options Radar</h3>
                            </div>
                            <div className="space-y-3">
                                {data.optionsRadar.map(item => <RadarCard key={item.id} item={item} />)}
                            </div>
                        </div>
                        <div className="bg-white border border-gray-200 rounded-xl p-5">
                            <h4 className="font-bold text-gray-800 mb-3">Sector Heatmap (OI Based)</h4>
                            <div className="grid grid-cols-2 gap-2 text-center">
                                <div className="bg-emerald-100 p-4 rounded text-emerald-800 font-bold">Auto (+12%)</div>
                                <div className="bg-emerald-50 p-4 rounded text-emerald-700 font-bold">Pharma (+4%)</div>
                                <div className="bg-red-50 p-4 rounded text-red-700 font-bold">IT (-2%)</div>
                                <div className="bg-red-100 p-4 rounded text-red-800 font-bold">Metals (-5%)</div>
                            </div>
                        </div>
                  </section>
              </div>
          )}
          
          {exploreContext === 'MARKET' && activeTab === 'ETF' && (
              <div className="flex flex-col items-center justify-center py-20 bg-gray-50 border border-dashed border-gray-200 rounded-xl">
                  <Layers size={48} className="text-gray-300 mb-4" />
                  <h3 className="text-lg font-bold text-gray-600">ETF Discovery Engine</h3>
                  <p className="text-sm text-gray-400">Coming soon: Liquidity tracking and Theme based ETFs.</p>
              </div>
          )}
      </div>
    </div>
  );
};
