
import React from 'react';
import { RebalanceSuggestion } from '../types';
import { ArrowRight, ArrowRightLeft, TrendingDown, DollarSign, Zap, AlertTriangle } from 'lucide-react';

interface RebalanceSuggestionCardProps {
  suggestion: RebalanceSuggestion;
  onReview: () => void;
}

export const RebalanceSuggestionCard: React.FC<RebalanceSuggestionCardProps> = ({ suggestion, onReview }) => {
  const isSwitch = suggestion.type === 'SWITCH';
  
  return (
    <div className="bg-white p-5 rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer group flex flex-col h-full relative overflow-hidden">
      {/* Type Badge */}
      <div className="flex justify-between items-start mb-4">
          <div className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase flex items-center ${
              isSwitch ? 'bg-purple-100 text-purple-700' : 
              suggestion.type === 'BUY' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
          }`}>
              {isSwitch ? <ArrowRightLeft size={12} className="mr-1"/> : <Zap size={12} className="mr-1"/>}
              {suggestion.type}
          </div>
          <div className="flex space-x-1">
              {suggestion.tags.map(tag => (
                  <span key={tag} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded border border-gray-200">
                      {tag}
                  </span>
              ))}
          </div>
      </div>

      {/* Main Action Visual */}
      <div className="flex-1 mb-4">
          {isSwitch ? (
              <div className="flex items-center space-x-3">
                  <div className="flex-1 p-2 bg-red-50 rounded-lg border border-red-100 text-center">
                      <p className="text-[10px] text-red-500 font-bold uppercase">Sell</p>
                      <p className="font-bold text-gray-800 text-sm">{suggestion.fromSymbol}</p>
                  </div>
                  <div className="text-gray-400">
                      <ArrowRight size={16} />
                  </div>
                  <div className="flex-1 p-2 bg-emerald-50 rounded-lg border border-emerald-100 text-center">
                      <p className="text-[10px] text-emerald-500 font-bold uppercase">Buy</p>
                      <p className="font-bold text-gray-800 text-sm">{suggestion.toSymbol}</p>
                  </div>
              </div>
          ) : (
              <div className="flex items-center space-x-3">
                  <div className={`flex-1 p-2 rounded-lg border text-center ${
                      suggestion.type === 'BUY' ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'
                  }`}>
                      <p className={`text-[10px] font-bold uppercase ${
                          suggestion.type === 'BUY' ? 'text-emerald-500' : 'text-red-500'
                      }`}>{suggestion.type}</p>
                      <p className="font-bold text-gray-800 text-lg">{suggestion.symbol}</p>
                  </div>
              </div>
          )}
          
          <p className="text-xs text-gray-500 mt-3 leading-snug">
              {suggestion.reason}
          </p>
      </div>

      {/* Impact Stats */}
      <div className="border-t border-gray-100 pt-3 flex justify-between items-center text-xs">
          <div className="flex space-x-3">
              <span className="flex items-center text-gray-500" title="Est. Tax Impact">
                  <DollarSign size={12} className="mr-1"/> 
                  <span className="font-medium">₹{Math.round(suggestion.impact.taxEst)}</span>
              </span>
              <span className={`flex items-center ${suggestion.impact.riskDelta < 0 ? 'text-emerald-600' : 'text-orange-600'}`} title="Risk Impact">
                  <TrendingDown size={12} className="mr-1"/> 
                  <span className="font-medium">{Math.abs(suggestion.impact.riskDelta)}% Risk</span>
              </span>
          </div>
      </div>

      {/* CTA Overlay (visible on hover/always on mobile) */}
      <div className="mt-4">
          <button 
            onClick={(e) => { e.stopPropagation(); onReview(); }}
            className="w-full py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg shadow-md hover:bg-indigo-700 transition-colors flex items-center justify-center"
          >
              Review & Rebalance <ArrowRight size={14} className="ml-1" />
          </button>
      </div>
    </div>
  );
};
