
import React, { useEffect, useState } from 'react';
import { SimpleAreaChart } from '../components/Charts';
import { calculatePortfolio } from '../services/portfolioEngine';
import { fetchMarketPulse } from '../services/marketData';
import { fetchUserProgress } from '../services/gamification';
import { calculateDrift } from '../services/rebalanceEngine';
import { ArrowUpRight, PiggyBank, Target, ArrowRight, PlayCircle, AlertTriangle, GraduationCap } from 'lucide-react';
import { GamificationWidget } from '../components/Gamification';
import { UserProgress, MarketPulse, PortfolioChange, LifecycleStage } from '../types';
import { MarketStateCard, ChangeLogPanel, EmptyState } from '../components/SituationPanels';
import { ContextPanel } from '../components/ContextPanel';

export const InvestDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [portfolio, setPortfolio] = useState<any>(null);
  const [pulse, setPulse] = useState<MarketPulse | null>(null);
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [changes, setChanges] = useState<PortfolioChange[]>([]);
  const [driftStatus, setDriftStatus] = useState<string>('BALANCED');
  
  // Mock User Stage (In real app, this comes from Context/Store)
  const userStage = LifecycleStage.LEARNER; 

  useEffect(() => {
    const loadData = async () => {
      const [portData, pulseData, progData] = await Promise.all([
        calculatePortfolio(),
        fetchMarketPulse(),
        fetchUserProgress()
      ]);
      setPortfolio(portData);
      setPulse(pulseData);
      setProgress(progData);
      
      // Calculate Drift
      if (portData.positions.length > 0) {
          const sim = calculateDrift(portData.positions, 'AGGRESSIVE');
          setDriftStatus(sim.status);
          
          setChanges([
              { id: '1', symbol: 'INFY', type: 'TECHNICAL', description: 'Crossed above 50 DMA.', impact: 'POSITIVE' },
              { id: '2', symbol: 'Portfolio', type: 'RISK', description: 'Tech sector exposure increased to 65%.', impact: 'NEUTRAL' }
          ]);
      } else {
          setChanges([]);
      }

      setLoading(false);
    };
    loadData();
  }, []);

  const handleStartSIP = (fundName: string) => {
    if(confirm(`Start a ₹1,000 SIP in ${fundName}?`)) {
        alert("SIP Registered! First installment deduction on next Monday.");
    }
  };

  // Mock historical data for the main chart
  const historyData = [
    { date: '2024-01-01', close: 45000 },
    { date: '2024-02-01', close: 46200 },
    { date: '2024-03-01', close: 45800 },
    { date: '2024-04-01', close: 47500 },
    { date: '2024-05-01', close: 49200 },
  ];

  if (loading) return <div className="p-8 text-emerald-600 animate-pulse">Loading investments...</div>;

  // --- COLD START STATE ---
  if (!portfolio || portfolio.positions.length === 0) {
      return (
        <div className="space-y-6">
             <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800">Welcome to SunAlpha</h2>
                <div className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold uppercase">
                    Stage: {userStage}
                </div>
             </div>
             
             {/* LEARNER SPECIFIC ONBOARDING */}
             {userStage === LifecycleStage.LEARNER && (
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
                             <button className="mt-4 bg-white text-indigo-600 px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-indigo-50">
                                 Start Paper Trading Challenge
                             </button>
                         </div>
                     </div>
                 </div>
             )}

             <EmptyState onExplore={() => alert("Redirect to Explore tab (simulated)")} />
             {pulse && <MarketStateCard pulse={pulse} />}
        </div>
      );
  }

  // --- ACTIVE INVESTOR STATE ---
  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* 1. Header & Context */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-2xl font-bold text-gray-800">Hello, Investor</h2>
            <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded font-bold uppercase">{userStage}</span>
          </div>
          <p className="text-gray-500">Your wealth is growing steadily.</p>
        </div>
        {progress && <GamificationWidget progress={progress} compact={true} />}
      </div>

      {/* 2. Drift Alert (New) */}
      {(driftStatus === 'DRIFTING' || driftStatus === 'CRITICAL') && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                  <div className="bg-orange-100 p-2 rounded-lg text-orange-600">
                      <AlertTriangle size={20} />
                  </div>
                  <div>
                      <p className="font-bold text-orange-800 text-sm">Portfolio Drift Detected</p>
                      <p className="text-xs text-orange-600">Your allocation has deviated from the target.</p>
                  </div>
              </div>
              <button className="text-xs bg-white border border-orange-200 text-orange-700 px-3 py-1.5 rounded-lg font-bold shadow-sm hover:bg-orange-50">
                  Review Rebalance
              </button>
          </div>
      )}

      {/* 3. Market Context (Situation Awareness) */}
      {pulse && <MarketStateCard pulse={pulse} />}

      {/* 4. Main Portfolio & Change Log */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Net Worth Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-emerald-100">
          <div className="flex justify-between items-start mb-6">
            <div>
              <p className="text-sm text-gray-500 font-medium uppercase tracking-wide">Total Portfolio Value</p>
              <h3 className="text-4xl font-bold text-gray-900 mt-1">
                ₹{portfolio.totalValue.toLocaleString()}
              </h3>
              <div className="flex items-center mt-2 space-x-2">
                <span className="flex items-center text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded text-sm font-semibold">
                  <ArrowUpRight size={16} className="mr-1" />
                  +{(portfolio.totalPnl / portfolio.totalInvested * 100).toFixed(2)}%
                </span>
                <span className="text-gray-400 text-sm">All time returns</span>
              </div>
            </div>
            <div className="bg-emerald-50 p-3 rounded-xl">
              <PiggyBank className="text-emerald-600" size={24} />
            </div>
          </div>
          <div className="h-64">
            <SimpleAreaChart data={historyData} color="#10b981" />
          </div>
        </div>

        {/* Right: Situation Context */}
        <div className="space-y-6">
          <ChangeLogPanel changes={changes} />
          
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h4 className="font-semibold text-gray-800 mb-4 flex items-center">
              <Target className="mr-2 text-emerald-500" size={18} />
              Goals Progress
            </h4>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Retirement</span>
                  <span className="font-medium text-gray-900">₹4.2L / ₹2Cr</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className="bg-emerald-500 h-2 rounded-full" style={{ width: '4%' }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Watch Next / Recommended */}
      <div>
        <h3 className="text-lg font-bold text-gray-800 mb-4">Top Rated Mutual Funds</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
              { name: 'Quant Small Cap Fund', type: 'Equity • Small Cap', return: '34.5%' },
              { name: 'Parag Parikh Flexi Cap', type: 'Equity • Flexi Cap', return: '18.2%' },
              { name: 'HDFC Balanced Advantage', type: 'Hybrid • Dynamic', return: '14.8%' }
          ].map((fund, i) => (
            <div key={i} className="bg-white p-5 rounded-xl border border-gray-100 hover:shadow-md transition-shadow cursor-pointer group">
              <div className="flex items-center justify-between mb-3">
                <div className="bg-yellow-100 text-yellow-700 text-xs font-bold px-2 py-1 rounded">5 ★ Rated</div>
                <button onClick={() => handleStartSIP(fund.name)} className="text-emerald-600 text-sm font-bold flex items-center hover:bg-emerald-50 px-2 py-1 rounded transition-colors">
                    Start SIP <PlayCircle size={14} className="ml-1" />
                </button>
              </div>
              <h4 className="font-bold text-gray-800">{fund.name}</h4>
              <p className="text-sm text-gray-500 mt-1">{fund.type}</p>
              <div className="mt-4 pt-4 border-t border-gray-50 flex justify-between items-center">
                <div>
                  <p className="text-xs text-gray-400">3Y Returns</p>
                  <p className="font-bold text-emerald-600 text-lg">{fund.return}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Min SIP</p>
                  <p className="font-bold text-gray-800">₹1,000</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
