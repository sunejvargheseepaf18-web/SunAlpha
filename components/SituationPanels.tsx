
import React from 'react';
import { MarketPulse, PortfolioChange } from '../types';
import { Activity, TrendingUp, TrendingDown, AlertTriangle, ArrowRight, Zap, Target } from 'lucide-react';

// --- Market State Card ---
// Answers: "What is the market doing today?"
export const MarketStateCard: React.FC<{ pulse: MarketPulse }> = ({ pulse }) => (
  <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
    <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-6">
        <div>
            <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-1">Regime</p>
            <h3 className="text-xl font-bold">{pulse.regime.trend.replace('_', ' ')}</h3>
            <p className="text-xs text-slate-400 mt-1">{pulse.regime.summary}</p>
        </div>
        
        <div>
            <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-1">Breadth (A/D)</p>
            <div className="flex items-center">
                <span className={`text-xl font-bold ${pulse.advanceDeclineRatio > 1 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {pulse.advanceDeclineRatio}:1
                </span>
                <span className="text-xs text-slate-400 ml-2">{pulse.advanceDeclineRatio > 1 ? 'Bulls leading' : 'Bears leading'}</span>
            </div>
        </div>

        <div>
            <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-1">India VIX</p>
            <div className="flex items-center">
                <span className={`text-xl font-bold ${pulse.vix > 20 ? 'text-red-400' : 'text-slate-200'}`}>
                    {pulse.vix.toFixed(1)}
                </span>
                <span className="text-xs text-slate-400 ml-2">
                    {pulse.vix > 15 ? 'High Volatility' : 'Stable'}
                </span>
            </div>
        </div>

        <div>
            <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-1">Rotation</p>
            <div className="flex flex-col">
                <span className="text-xs text-emerald-400 flex items-center"><TrendingUp size={10} className="mr-1"/> {pulse.topSector}</span>
                <span className="text-xs text-red-400 flex items-center"><TrendingDown size={10} className="mr-1"/> {pulse.laggardSector}</span>
            </div>
        </div>
    </div>
    {/* Decorative BG */}
    <Activity className="absolute right-4 top-1/2 -translate-y-1/2 text-white/5" size={120} />
  </div>
);

// --- Change Log Panel ---
// Answers: "What changed since yesterday?"
export const ChangeLogPanel: React.FC<{ changes: PortfolioChange[] }> = ({ changes }) => (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <h4 className="font-bold text-gray-800 mb-4 flex items-center">
            <Zap className="mr-2 text-orange-500" size={18} />
            What Changed Today
        </h4>
        <div className="space-y-3">
            {changes.map(change => (
                <div key={change.id} className="flex items-start p-3 bg-gray-50 rounded-lg">
                    <div className={`mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0 mr-3 ${
                        change.impact === 'POSITIVE' ? 'bg-emerald-500' : 
                        change.impact === 'NEGATIVE' ? 'bg-red-500' : 'bg-blue-500'
                    }`} />
                    <div>
                        <p className="text-sm font-semibold text-gray-800 flex items-center">
                            {change.symbol}
                            <span className="ml-2 text-[10px] uppercase text-gray-400 border px-1 rounded">{change.type}</span>
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">{change.description}</p>
                    </div>
                </div>
            ))}
            {changes.length === 0 && (
                <p className="text-sm text-gray-400 italic text-center py-4">No significant changes detected in your portfolio.</p>
            )}
        </div>
    </div>
);

// --- Conflict Panel ---
// Answers: "Are signals contradicting each other?"
export const ConflictPanel: React.FC = () => (
    <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-5">
        <h4 className="font-bold text-yellow-900 mb-3 flex items-center">
            <AlertTriangle className="mr-2 text-yellow-600" size={18} />
            Signal Conflict Detected
        </h4>
        <div className="bg-white/60 rounded-lg p-3 text-sm text-yellow-800 mb-2">
            <strong>INFY:</strong> Fundamentals Strong (Score 82) but Momentum Weakening (RSI 42).
        </div>
        <div className="flex items-center text-xs text-yellow-700 font-medium">
            <ArrowRight size={12} className="mr-1" />
            Insight: Good for long-term accumulation, bad for breakout trading.
        </div>
    </div>
);

// --- Empty State ---
// Handles Cold Start
export const EmptyState: React.FC<{ onExplore: () => void }> = ({ onExplore }) => (
    <div className="bg-white rounded-2xl p-8 border border-dashed border-gray-300 text-center flex flex-col items-center justify-center h-[400px]">
        <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-500 mb-4">
            <Target size={32} />
        </div>
        <h3 className="text-xl font-bold text-gray-800 mb-2">Your Intelligence Hub is Ready</h3>
        <p className="text-gray-500 max-w-md mb-6">
            You don't have any holdings yet. Start by exploring high-conviction scanners or model baskets to build your portfolio.
        </p>
        <button 
            onClick={onExplore}
            className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-colors flex items-center"
        >
            Explore Market <ArrowRight size={18} className="ml-2" />
        </button>
    </div>
);
