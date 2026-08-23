
import React, { useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { OptimizationResult, OptimizedProposal } from '../services/optimizerService';

// Rendering only — displays optimizer proposals computed from real return
// history, each with the exact whole-unit trades to get there. Advisory:
// execution routes through the rebalance/risk engines.

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

const WeightBar: React.FC<{ symbol: string; current: number; target: number }> = ({
  symbol,
  current,
  target
}) => (
  <div className="flex items-center gap-2 text-xs">
    <span className="w-28 truncate font-medium text-gray-600">{symbol}</span>
    <div className="flex-1 bg-gray-100 rounded h-3 relative overflow-hidden">
      <div className="absolute inset-y-0 left-0 bg-blue-200 rounded" style={{ width: `${Math.min(100, target * 100)}%` }} />
      <div className="absolute inset-y-0 w-0.5 bg-gray-700" style={{ left: `${Math.min(100, current * 100)}%` }} />
    </div>
    <span className="w-24 text-right font-mono text-gray-500">
      {(current * 100).toFixed(1)}% → {(target * 100).toFixed(1)}%
    </span>
  </div>
);

export const OptimizerPanel: React.FC<{ result: OptimizationResult }> = ({ result }) => {
  const [activeId, setActiveId] = useState<OptimizedProposal['id']>(result.proposals[0].id);
  const proposal = result.proposals.find(p => p.id === activeId)!;

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-blue-100">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={18} className="text-blue-600" />
          <h4 className="font-bold text-gray-800">Portfolio Optimizer</h4>
          <span className="text-xs text-gray-400">
            {result.windowDays}d history · max {Math.round(result.maxWeightCap * 100)}%/holding
          </span>
        </div>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {result.proposals.map(p => (
            <button
              key={p.id}
              onClick={() => setActiveId(p.id)}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                p.id === activeId ? 'bg-white shadow text-blue-700' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-gray-500 mb-4">
        Expected return <span className="font-bold text-gray-700">{proposal.expectedReturnPct.toFixed(1)}%</span>
        {' · '}volatility <span className="font-bold text-gray-700">{proposal.volatilityPct.toFixed(1)}%</span>
        {' · '}Sharpe <span className="font-bold text-gray-700">{proposal.sharpe.toFixed(2)}</span>
        <span className="text-gray-400"> (historical estimates, not forecasts)</span>
      </p>

      <div className="space-y-2 mb-5">
        {result.symbols.map(s => (
          <WeightBar
            key={s}
            symbol={s}
            current={result.currentWeights[s] ?? 0}
            target={proposal.weightBySymbol[s] ?? 0}
          />
        ))}
      </div>

      {proposal.trades.length > 0 ? (
        <div>
          <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wide mb-2">
            Trades to reach {proposal.name} (whole units @ current prices)
          </p>
          <div className="space-y-1.5">
            {proposal.trades.map(t => (
              <div key={t.symbol} className="flex items-center justify-between text-xs font-mono">
                <span>
                  <span className={`font-bold ${t.side === 'BUY' ? 'text-emerald-600' : 'text-red-600'}`}>
                    {t.side}
                  </span>{' '}
                  {t.quantity} × {t.symbol} @ ₹{t.rate.toLocaleString('en-IN')}
                </span>
                <span className="text-gray-500">{inr(t.amount)}</span>
              </div>
            ))}
          </div>
          {proposal.leftoverCash > 0 && (
            <p className="text-[11px] text-gray-400 mt-2">
              {inr(proposal.leftoverCash)} stays as cash (below one unit of anything).
            </p>
          )}
        </div>
      ) : (
        <p className="text-xs text-gray-400">Portfolio already matches this allocation.</p>
      )}
    </div>
  );
};
