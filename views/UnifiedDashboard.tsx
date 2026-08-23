
import React, { useEffect, useState } from 'react';
import { MarketStateCard, ChangeLogPanel, EmptyState } from '../components/SituationPanels';
import { CapitalMonitor } from '../components/CapitalMonitor';
import { fetchMarketPulse } from '../services/marketData';
import { calculatePortfolio, getHoldingAdvices, getRedeploymentPlan } from '../services/portfolioEngine';
import { calculateCapitalSnapshot } from '../services/capitalEngine';
import { getBrokerProfile } from '../services/brokerService';
import { HoldingsPanel } from '../components/HoldingsPanel';
import { recordAdvices, gradeJournal } from '../services/adviceJournal';
import { JournalScorecard } from '../domain/advice/journal.engine';
import { HoldingAdvice, RedeploymentPlan } from '../domain/advice/advice.types';
import { MarketPulse, CapitalSnapshot, UserProfile, LifecycleStage, AppMode, ExecutionMode } from '../types';
import { ArrowUpRight, PiggyBank, GraduationCap } from 'lucide-react';

interface UnifiedDashboardProps {
  onNavigateToAsset: (symbol: string) => void;
  onSwitchMode: (mode: AppMode) => void;
  userProfile: UserProfile | null;
  executionMode: ExecutionMode;
}

export const UnifiedDashboard: React.FC<UnifiedDashboardProps> = ({ 
    onNavigateToAsset, 
    onSwitchMode, 
    userProfile,
    executionMode 
}) => {
  const [pulse, setPulse] = useState<MarketPulse | null>(null);
  const [portfolio, setPortfolio] = useState<any>(null);
  const [capitalSnapshot, setCapitalSnapshot] = useState<CapitalSnapshot | null>(null);
  const [advices, setAdvices] = useState<HoldingAdvice[]>([]);
  const [redeployment, setRedeployment] = useState<RedeploymentPlan | null>(null);
  const [scorecard, setScorecard] = useState<JournalScorecard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      // Fetch portfolio and broker based on current Execution Mode
      const [p, port, broker] = await Promise.all([
        fetchMarketPulse(),
        calculatePortfolio(executionMode),
        getBrokerProfile(executionMode)
      ]);
      setPulse(p);
      setPortfolio(port);

      if (port.positions.length > 0 || executionMode === 'PAPER') {
          const cap = await calculateCapitalSnapshot(port.positions, broker);
          setCapitalSnapshot(cap);
      }

      // Single source of truth for per-holding recommendations, plus where
      // any freed sale proceeds should go. Market signals would come from the
      // conviction engine; none are passed here, so allocation rules decide.
      const holdingAdvices = getHoldingAdvices(port.positions);
      setAdvices(holdingAdvices);
      setRedeployment(getRedeploymentPlan(holdingAdvices, port.positions));

      // Feedback loop: grade past advice against current prices, then
      // journal today's advices for future grading (best-effort).
      setScorecard(gradeJournal(port.positions));
      recordAdvices(holdingAdvices, port.positions);

      setLoading(false);
    };
    init();
  }, [executionMode]); // Re-run when mode changes

  if (loading) return <div className="p-8 text-emerald-600 animate-pulse">Loading {executionMode === 'PAPER' ? 'Simulation' : 'Portfolio'}...</div>;

  const isBeginner = userProfile?.stage === LifecycleStage.EXPLORER || userProfile?.stage === LifecycleStage.LEARNER;

  // --- COLD START STATE ---
  if (!portfolio || portfolio.positions.length === 0) {
      return (
        <div className="space-y-6">
             <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800">Welcome to SunAlpha</h2>
                <div className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold uppercase">
                    Stage: {userProfile?.stage || 'EXPLORER'}
                </div>
             </div>
             
             {/* LEARNER SPECIFIC ONBOARDING */}
             {isBeginner && (
                 <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
                     <div className="flex items-start">
                         <div className="bg-white/20 p-3 rounded-lg mr-4">
                             <GraduationCap size={24} />
                         </div>
                         <div>
                             <h3 className="font-bold text-lg">Your Learning Journey Begins</h3>
                             <p className="text-indigo-100 text-sm mt-1 max-w-xl">
                                 You are in the <strong>Learner</strong> stage. We've enabled Paper Trading so you can practice with ₹10 Lakh virtual capital without risking real money.
                             </p>
                             <button 
                                onClick={() => onSwitchMode(AppMode.EXPLORE)}
                                className="mt-4 bg-white text-indigo-600 px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-indigo-50"
                             >
                                 Start Paper Trading Challenge
                             </button>
                         </div>
                     </div>
                 </div>
             )}

             <EmptyState onExplore={() => onSwitchMode(AppMode.EXPLORE)} />
             {pulse && <MarketStateCard pulse={pulse} />}
        </div>
      );
  }

  // --- ACTIVE INVESTOR STATE ---
  return (
    <div className="space-y-6 animate-fade-in-up">
      
      {/* 0. Welcome & Lifecycle Header */}
      <div className="flex justify-between items-end">
          <div>
              <h2 className="text-2xl font-bold text-gray-800">
                  Welcome, {userProfile?.name?.split(' ')[0] || 'Investor'}
              </h2>
              <p className="text-gray-500 text-sm mt-1">
                  Lifecycle Stage: <span className="font-bold text-emerald-600 uppercase">{userProfile?.stage || 'EXPLORER'}</span>
              </p>
          </div>
          {executionMode === 'PAPER' && (
              <div className="bg-amber-100 border border-amber-200 text-amber-800 px-4 py-2 rounded-xl flex items-center text-sm font-bold">
                  <GraduationCap size={18} className="mr-2" />
                  <span>Paper Trading Active</span>
              </div>
          )}
      </div>

      {/* 1. Market Context Banner */}
      {pulse && <MarketStateCard pulse={pulse} />}

      {/* 2. Portfolio Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         <div className="lg:col-span-2 flex flex-col gap-6">
             {/* Main Net Worth Card */}
             <div className="bg-white rounded-2xl p-6 shadow-sm border border-emerald-100 flex flex-col justify-between">
                <div>
                <p className="text-sm text-gray-500 font-medium uppercase tracking-wide">Net Worth ({executionMode === 'PAPER' ? 'Virtual' : 'Real'})</p>
                <h3 className="text-4xl font-bold text-gray-900 mt-2">
                    ₹{portfolio?.totalValue?.toLocaleString() || '0'}
                </h3>
                <div className="flex items-center mt-2 space-x-2">
                    <span className={`flex items-center px-2 py-0.5 rounded text-sm font-semibold ${portfolio.totalPnl >= 0 ? 'text-emerald-600 bg-emerald-50' : 'text-red-600 bg-red-50'}`}>
                    <ArrowUpRight size={16} className="mr-1" />
                    {portfolio.totalPnl >= 0 ? '+' : ''}{((portfolio.totalPnl / (portfolio.totalInvested || 1)) * 100).toFixed(2)}%
                    </span>
                    <span className="text-gray-400 text-sm">All time returns</span>
                </div>
                </div>
                
                <div className="mt-8 pt-6 border-t border-gray-100 flex space-x-4">
                    <button 
                        onClick={() => onNavigateToAsset('RELIANCE')}
                        className="flex-1 py-3 bg-gray-900 text-white rounded-xl font-bold text-sm shadow-md hover:bg-black transition-colors"
                    >
                        Trade
                    </button>
                    <button className="flex-1 py-3 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl font-bold text-sm hover:bg-emerald-100 transition-colors">
                        Add Funds
                    </button>
                </div>
             </div>
             
             {/* Capital Monitor (Risk Intelligence) */}
             {capitalSnapshot && <CapitalMonitor snapshot={capitalSnapshot} />}
         </div>

         <div className="flex flex-col gap-6">
             <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex-1">
                <h4 className="font-bold text-gray-800 mb-4">Assets in Focus</h4>
                <div className="space-y-3">
                    {['RELIANCE', 'INFY', 'HDFCBANK'].map(sym => (
                        <div 
                            key={sym} 
                            onClick={() => onNavigateToAsset(sym)}
                            className="flex justify-between items-center p-3 hover:bg-gray-50 rounded-lg cursor-pointer border border-transparent hover:border-gray-100 transition-all"
                        >
                            <span className="font-bold text-gray-700">{sym}</span>
                            <span className="text-emerald-600 text-sm font-mono font-medium">+1.2%</span>
                        </div>
                    ))}
                </div>
                <button className="w-full mt-4 py-2 text-xs text-gray-500 border border-dashed border-gray-300 rounded-lg hover:text-gray-800 hover:border-gray-400">
                    + Add to Watchlist
                </button>
            </div>
         </div>
      </div>

      {/* 3. Holdings with fully-specified advice + proceeds redeployment */}
      <HoldingsPanel
        positions={portfolio.positions}
        advices={advices}
        redeployment={redeployment}
        scorecard={scorecard}
        onNavigateToAsset={onNavigateToAsset}
      />
    </div>
  );
};
