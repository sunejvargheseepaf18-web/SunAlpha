
import React from 'react';
import { DebateVerdict } from '../domain/advice/advice.types';
import { Scale, TrendingUp, TrendingDown } from 'lucide-react';

// Rendering only — displays the judge's verdict from the bull-vs-bear
// debate. Advisory context; execution always routes through the engines.

const signalClasses = (signal: DebateVerdict['signal']): string => {
  if (['STRONG BUY', 'BUY', 'ACCUMULATE'].includes(signal))
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (['REDUCE', 'SELL', 'AVOID'].includes(signal))
    return 'bg-red-50 text-red-700 border-red-200';
  return 'bg-gray-100 text-gray-700 border-gray-200';
};

export const DebatePanel: React.FC<{ verdict: DebateVerdict }> = ({ verdict }) => (
  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <Scale size={18} className="text-indigo-600" />
        <h4 className="font-bold text-gray-800">Bull vs Bear Debate</h4>
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${signalClasses(verdict.signal)}`}>
          {verdict.signal}
        </span>
        <span className="text-xs text-gray-400 font-mono">{Math.round(verdict.confidence)}% conf.</span>
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
        <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-bold uppercase tracking-wide mb-2">
          <TrendingUp size={14} /> Bull Case
        </div>
        <ul className="space-y-1.5">
          {verdict.bullPoints.map((p, i) => (
            <li key={i} className="text-xs text-gray-600 leading-relaxed">• {p}</li>
          ))}
        </ul>
      </div>
      <div className="rounded-xl border border-red-100 bg-red-50/40 p-4">
        <div className="flex items-center gap-1.5 text-red-700 text-xs font-bold uppercase tracking-wide mb-2">
          <TrendingDown size={14} /> Bear Case
        </div>
        <ul className="space-y-1.5">
          {verdict.bearPoints.map((p, i) => (
            <li key={i} className="text-xs text-gray-600 leading-relaxed">• {p}</li>
          ))}
        </ul>
      </div>
    </div>

    <p className="text-xs text-gray-500 mt-4 leading-relaxed">
      <span className="font-bold text-gray-600">Judge:</span> {verdict.reasoning}
    </p>

    {verdict.riskNote && (
      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mt-2 leading-relaxed">
        <span className="font-bold">Risk officer:</span> {verdict.riskNote}
      </p>
    )}
  </div>
);
