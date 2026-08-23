
import React, { useEffect, useState } from 'react';
import { TradingViewChart } from '../components/TradingViewChart';
import { calculateEMASeries, calculateSMASeries, calculateBollingerSeries } from '../services/technicalAnalysis';
import { pickOverlays, OverlayPick } from '../domain/indicators/autoOverlay.engine';
import { getBrokerProfile } from '../services/brokerService';
import { fetchOptionChainView, OptionChainView } from '../services/foAnalytics';
import { getAssetIntelligence } from '../services/orchestrator';
import { AssetIntelligence, BrokerProfile, OptionContract } from '../types';
import { 
    Bell, BellRing, Activity, Layers, Eye, EyeOff, LayoutTemplate, CandlestickChart,
    BarChart2, Table, Maximize2
} from 'lucide-react';
import { ConvictionBadge } from '../components/ConvictionBadge';
import { BrokerConnect } from '../components/BrokerConnect';
import { UnifiedExecutionPanel } from '../components/UnifiedExecutionPanel'; // UPDATED IMPORT
import { OptionChain } from '../components/OptionChain';
import { AlertManager } from '../components/AlertManager';
import { getAlerts } from '../services/alertService';
import { ContextPanel } from '../components/ContextPanel';
import { getIntradayHistory, IntradayBar } from '../services/marketFeed';

export const TradeDashboard = () => {
  const [selectedSymbol, setSelectedSymbol] = useState('RELIANCE');
  const [intelligence, setIntelligence] = useState<AssetIntelligence | null>(null);
  const [emaData, setEmaData] = useState<any[]>([]);
  const [broker, setBroker] = useState<BrokerProfile | null>(null);
  const [optionChain, setOptionChain] = useState<OptionChainView | null>(null);
  
  // View Controls
  const [tradeMode, setTradeMode] = useState<'EQUITY' | 'FNO'>('EQUITY');
  const [showChart, setShowChart] = useState(true);
  
  // Order Panel Context
  const [orderInstrument, setOrderInstrument] = useState<{symbol: string, price: number, isDerivative: boolean} | null>(null);

  const [showEMA, setShowEMA] = useState(true);
  const [showCPR, setShowCPR] = useState(true);
  const [showVolume, setShowVolume] = useState(true);
  const [showSMA50, setShowSMA50] = useState(false);
  const [showBB, setShowBB] = useState(false);

  // Auto indicator selection: the regime decides which overlays earn their
  // place (trend -> MAs, range -> levels+bands, squeeze -> bands). Touching
  // any manual toggle hands control back to the user.
  const [autoOverlays, setAutoOverlays] = useState(true);
  const [overlayPick, setOverlayPick] = useState<OverlayPick | null>(null);

  useEffect(() => {
    if (!autoOverlays || !intelligence?.regime) return;
    const pick = pickOverlays({
      trend: intelligence.regime.trend,
      volatility: intelligence.regime.volatility,
      cprWidth: intelligence.technical?.cpr?.width
    });
    setOverlayPick(pick);
    setShowEMA(pick.ema20);
    setShowSMA50(pick.sma50);
    setShowBB(pick.bollinger);
    setShowCPR(pick.cpr);
    setShowVolume(pick.volume);
  }, [autoOverlays, intelligence]);

  const manualToggle = (setter: React.Dispatch<React.SetStateAction<boolean>>) => () => {
    setAutoOverlays(false);
    setter(v => !v);
  };

  // Chart timeframe: intraday (5m/15m bars from the live feed) or daily.
  const [timeframe, setTimeframe] = useState<'1D' | '1W' | '3M'>('3M');
  const [intradayBars, setIntradayBars] = useState<IntradayBar[]>([]);

  useEffect(() => {
    if (timeframe === '3M') {
      setIntradayBars([]);
      return;
    }
    let cancelled = false;
    getIntradayHistory(selectedSymbol, timeframe === '1D' ? '1d' : '5d').then(bars => {
      if (!cancelled) setIntradayBars(bars);
    });
    return () => {
      cancelled = true;
    };
  }, [timeframe, selectedSymbol]);
  
  // Alert State
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [hasActiveAlerts, setHasActiveAlerts] = useState(false);

  // --- Initial Data Loading ---
  useEffect(() => {
    getBrokerProfile().then(setBroker);
  }, []);

  // --- Main Orchestrator Call ---
  useEffect(() => {
    const fetchData = async () => {
      setIntelligence(null);
      setOptionChain(null);
      setHasActiveAlerts(false);
      
      try {
        const intel = await getAssetIntelligence(selectedSymbol);
        setIntelligence(intel);

        setOrderInstrument({
            symbol: intel.symbol,
            price: intel.price,
            isDerivative: tradeMode === 'FNO'
        });

        const alerts = await getAlerts(selectedSymbol);
        setHasActiveAlerts(alerts.length > 0);

        if (intel.stockData.history.length > 0) {
           const ema = calculateEMASeries(intel.stockData.history, 20);
           setEmaData(ema);
        }

        if (tradeMode === 'FNO') {
            const chain = await fetchOptionChainView(selectedSymbol, intel.price);
            setOptionChain(chain);
        }

      } catch (e) {
        console.error("Orchestration failed", e);
      }
    };
    fetchData();
  }, [selectedSymbol, tradeMode]); 

  const handleOptionSelect = (contract: OptionContract, symbol: string) => {
    setOrderInstrument({
        symbol: symbol,
        price: contract.price,
        isDerivative: true
    });
    // Don't switch mode, just set instrument
  };

  if (!intelligence || !broker) return <div className="p-8 text-orange-500 animate-pulse">Loading market intelligence...</div>;

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-100px)] min-h-[800px]">
      {showAlertModal && (
        <AlertManager 
            symbol={selectedSymbol} 
            currentPrice={intelligence.price} 
            onClose={() => {
                setShowAlertModal(false);
                getAlerts(selectedSymbol).then(a => setHasActiveAlerts(a.length > 0));
            }} 
        />
      )}

      {/* Top Control Bar */}
      <div className="bg-white p-3 rounded-xl border border-gray-200 flex justify-between items-center shadow-sm shrink-0">
         <div className="flex items-center space-x-4">
            <div className="flex bg-gray-100 p-1 rounded-lg">
                <button 
                    onClick={() => setTradeMode('EQUITY')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-md flex items-center transition-all ${tradeMode === 'EQUITY' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <CandlestickChart size={14} className="mr-2" /> Equity
                </button>
                <button 
                    onClick={() => setTradeMode('FNO')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-md flex items-center transition-all ${tradeMode === 'FNO' ? 'bg-white shadow text-purple-700' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <LayoutTemplate size={14} className="mr-2" /> F&O
                </button>
            </div>
            <div className="h-6 w-px bg-gray-200"></div>
            <div>
                 <h2 className="text-lg font-bold text-gray-900">{intelligence.symbol}</h2>
                 <p className="text-xs text-gray-500">{intelligence.stockData.name}</p>
            </div>
            <div>
                 <p className={`text-lg font-mono font-bold ${intelligence.price >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    ₹{intelligence.price.toFixed(2)}
                 </p>
                 <p className={`text-xs font-bold ${intelligence.stockData.change >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {intelligence.stockData.change >= 0 ? '+' : ''}{intelligence.stockData.change} ({intelligence.stockData.changePercent}%)
                 </p>
            </div>
         </div>

         <div className="flex items-center space-x-3">
             <button 
                 onClick={() => setShowAlertModal(true)}
                 className={`p-2 rounded-lg relative transition-colors ${hasActiveAlerts ? 'bg-orange-100 text-orange-600' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'}`}
             >
                 {hasActiveAlerts ? <BellRing size={18} /> : <Bell size={18} />}
             </button>
             <BrokerConnect broker={broker} onUpdate={setBroker} />
         </div>
      </div>

      {/* Main Grid Layout */}
      <div className="flex-1 grid grid-cols-12 gap-4 min-h-0">
          
          {/* LEFT COLUMN: Chart (60%) */}
          <div className="col-span-12 lg:col-span-8 flex flex-col gap-4 min-h-0">
              {/* Chart Panel */}
              <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col min-h-[400px]">
                  <div className="p-2 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                      <div className="flex space-x-2">
                        <div className="flex bg-white border border-gray-200 rounded overflow-hidden mr-1">
                            {(['1D', '1W', '3M'] as const).map(tf => (
                                <button
                                    key={tf}
                                    onClick={() => setTimeframe(tf)}
                                    className={`px-2 py-1 text-[10px] font-bold ${timeframe === tf ? 'bg-slate-900 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                                    title={tf === '1D' ? '5-minute bars' : tf === '1W' ? '15-minute bars' : 'Daily bars'}
                                >
                                    {tf}
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={() => setAutoOverlays(a => !a)}
                            className={`px-2 py-1 text-[10px] font-bold rounded border ${autoOverlays ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'text-gray-500 bg-white border-gray-200'}`}
                            title={autoOverlays && overlayPick ? overlayPick.reasons.join('\n') : 'Let the market regime pick the indicators'}
                        >
                            ✨ AUTO
                        </button>
                        <button
                            onClick={manualToggle(setShowCPR)}
                            className={`px-2 py-1 text-[10px] font-bold rounded border ${showCPR ? 'bg-purple-100 text-purple-700 border-purple-200' : 'text-gray-500 bg-white border-gray-200'}`}
                        >
                            <Layers size={10} className="mr-1 inline"/> CPR
                        </button>
                        <button
                            onClick={manualToggle(setShowEMA)}
                            className={`px-2 py-1 text-[10px] font-bold rounded border ${showEMA ? 'bg-orange-100 text-orange-700 border-orange-200' : 'text-gray-500 bg-white border-gray-200'}`}
                        >
                            <Activity size={10} className="mr-1 inline"/> EMA
                        </button>
                        <button
                            onClick={manualToggle(setShowSMA50)}
                            className={`px-2 py-1 text-[10px] font-bold rounded border ${showSMA50 ? 'bg-sky-100 text-sky-700 border-sky-200' : 'text-gray-500 bg-white border-gray-200'}`}
                        >
                            SMA50
                        </button>
                        <button
                            onClick={manualToggle(setShowBB)}
                            className={`px-2 py-1 text-[10px] font-bold rounded border ${showBB ? 'bg-slate-200 text-slate-700 border-slate-300' : 'text-gray-500 bg-white border-gray-200'}`}
                        >
                            BB
                        </button>
                      </div>
                      <div className="flex items-center text-xs text-gray-400">
                          <BarChart2 size={12} className="mr-1"/> TradingView
                      </div>
                  </div>
                  <div className="flex-1 bg-slate-900 relative">
                       {/* Intraday timeframes render 5m/15m bars from the live
                           feed; EMA/CPR overlays are daily-derived, so they
                           only show on the daily view. */}
                       {timeframe !== '3M' && intradayBars.length === 0 ? (
                          <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-400">
                              No intraday bars available (feed unreachable or market closed too long).
                          </div>
                       ) : (
                          <TradingViewChart
                             key={`${timeframe}-${intradayBars.length}-${showSMA50}-${showBB}`}
                             data={timeframe === '3M' ? intelligence.stockData.history : intradayBars}
                             cpr={intelligence.technical.cpr}
                             showCPR={showCPR && timeframe === '3M'}
                             showEMA={showEMA && timeframe === '3M'}
                             showVolume={showVolume}
                             emaData={emaData}
                             smaData={
                                showSMA50 && timeframe === '3M'
                                  ? calculateSMASeries(intelligence.stockData.history, 50)
                                  : undefined
                             }
                             bollingerData={
                                showBB && timeframe === '3M'
                                  ? calculateBollingerSeries(intelligence.stockData.history)
                                  : undefined
                             }
                          />
                       )}
                       {autoOverlays && overlayPick && timeframe === '3M' && (
                          <div className="absolute bottom-1 left-2 right-2 text-[10px] text-slate-400 bg-slate-900/80 rounded px-2 py-1 pointer-events-none">
                             ✨ {overlayPick.reasons[0]}
                          </div>
                       )}
                  </div>
              </div>

              {/* Bottom Panel: Option Chain OR Context */}
              <div className="h-64 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                   {tradeMode === 'FNO' ? (
                       <OptionChain
                          data={optionChain?.rows ?? []}
                          spotPrice={intelligence.price}
                          symbol={intelligence.symbol}
                          onSelectContract={handleOptionSelect}
                          expiry={optionChain?.expiry}
                          asOf={optionChain?.asOf}
                          source={optionChain?.source}
                       />
                   ) : (
                       <div className="p-6">
                           <h3 className="font-bold text-gray-800 mb-4">Technical Context</h3>
                           <div className="grid grid-cols-3 gap-4">
                               <ContextPanel title="Market Structure" type="INFO">
                                  {intelligence.technical.buckets.marketStructure.summary}
                               </ContextPanel>
                               <ContextPanel title="Trend Analysis" type={intelligence.technical.buckets.trend.score > 60 ? 'TIP' : 'WARNING'}>
                                  {intelligence.technical.buckets.trend.summary}
                               </ContextPanel>
                               <ContextPanel title="Momentum" type="INFO">
                                  {intelligence.technical.buckets.momentum.summary}
                               </ContextPanel>
                           </div>
                       </div>
                   )}
              </div>
          </div>

          {/* RIGHT COLUMN: Intelligence & Execution (40%) */}
          <div className="col-span-12 lg:col-span-4 flex flex-col gap-4 min-h-0 overflow-y-auto scrollbar-hide">
              {/* Intelligence Badge */}
              <ConvictionBadge report={intelligence.conviction} />
              
              {/* UPDATED: Unified Execution Panel */}
              <div className="flex-1 min-h-[450px]">
                 <UnifiedExecutionPanel 
                    initialSymbol={orderInstrument?.symbol || intelligence.symbol}
                    initialPrice={orderInstrument?.price || intelligence.price}
                    broker={broker} 
                 />
              </div>

              {/* Quick Strategy / Key Levels */}
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Key Levels</h4>
                  <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                          <span className="text-gray-500">Resistance (R1)</span>
                          <span className="font-mono font-medium">{(intelligence.price * 1.02).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                          <span className="text-gray-500">Pivot</span>
                          <span className="font-mono font-medium text-purple-600">{intelligence.technical.cpr?.pivot.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                          <span className="text-gray-500">Support (S1)</span>
                          <span className="font-mono font-medium">{(intelligence.price * 0.98).toFixed(2)}</span>
                      </div>
                  </div>
              </div>
          </div>

      </div>
    </div>
  );
};
