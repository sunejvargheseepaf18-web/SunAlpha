
import React from 'react';
import { AppMode } from '../types';
import { ShieldCheck, TrendingUp, BarChart2, Zap, Compass, LayoutDashboard } from 'lucide-react';

interface LandingProps {
  onEnter: (mode: AppMode) => void;
}

export const Landing: React.FC<LandingProps> = ({ onEnter }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
      <div className="max-w-6xl w-full">
        <div className="text-center mb-16">
          <div className="flex items-center justify-center mb-6">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-500/20">
              <span className="text-4xl font-bold text-slate-900">S</span>
            </div>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 tracking-tight">
            SunAlpha
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto font-light">
            Unified Investing, Analytics & Trading Intelligence Platform.
            <br />
            Select your workspace to begin.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {/* Dashboard (Home) */}
          <div 
            onClick={() => onEnter(AppMode.DASHBOARD)}
            className="group relative bg-white/5 hover:bg-white/10 border border-white/10 hover:border-emerald-500/50 rounded-2xl p-8 cursor-pointer transition-all duration-300 hover:-translate-y-2"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/0 to-emerald-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="w-14 h-14 bg-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center mb-6">
              <LayoutDashboard size={32} />
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">Dashboard</h3>
            <p className="text-slate-400 mb-6 text-sm leading-relaxed">
              Your centralized command center. Portfolio health, market pulse, and wealth tracking.
            </p>
            <span className="text-emerald-400 text-xs font-bold uppercase tracking-widest flex items-center group-hover:translate-x-2 transition-transform">
              Enter Home &rarr;
            </span>
          </div>

          {/* Explore (Discovery) */}
          <div 
            onClick={() => onEnter(AppMode.EXPLORE)}
            className="group relative bg-white/5 hover:bg-white/10 border border-white/10 hover:border-indigo-500/50 rounded-2xl p-8 cursor-pointer transition-all duration-300 hover:-translate-y-2"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/0 to-indigo-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="w-14 h-14 bg-indigo-500/20 text-indigo-400 rounded-xl flex items-center justify-center mb-6">
              <Compass size={32} />
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">Explore</h3>
            <p className="text-slate-400 mb-6 text-sm leading-relaxed">
              Market intelligence map. Regimes, scanners, and thematic baskets.
            </p>
            <span className="text-indigo-400 text-xs font-bold uppercase tracking-widest flex items-center group-hover:translate-x-2 transition-transform">
              Start Discovery &rarr;
            </span>
          </div>

          {/* Analyze (Deep Dive) */}
          <div 
            onClick={() => onEnter(AppMode.ANALYZE)}
            className="group relative bg-white/5 hover:bg-white/10 border border-white/10 hover:border-blue-500/50 rounded-2xl p-8 cursor-pointer transition-all duration-300 hover:-translate-y-2"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-blue-500/0 to-blue-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="w-14 h-14 bg-blue-500/20 text-blue-400 rounded-xl flex items-center justify-center mb-6">
              <BarChart2 size={32} />
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">Analyze</h3>
            <p className="text-slate-400 mb-6 text-sm leading-relaxed">
              Advanced portfolio x-ray. Risk metrics, tax harvesting, and rebalancing simulations.
            </p>
            <span className="text-blue-400 text-xs font-bold uppercase tracking-widest flex items-center group-hover:translate-x-2 transition-transform">
              Deep Dive &rarr;
            </span>
          </div>
        </div>

        <div className="mt-20 text-center border-t border-white/5 pt-8">
          <p className="text-slate-500 text-xs uppercase tracking-widest">
            SunAlpha &copy; 2024 • Powered by React & Tailwind • Market Data by Yahoo Finance
          </p>
        </div>
      </div>
    </div>
  );
};
