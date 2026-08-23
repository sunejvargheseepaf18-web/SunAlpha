
import React, { useMemo, useState } from 'react';
import { HandCoins } from 'lucide-react';
import { PortfolioPosition } from '../types';
import { planContribution } from '../services/rebalanceEngine';

// Cash-flow rebalancing UI: type a contribution, see exactly where the new
// money goes to pull the portfolio toward target — with no sells, no tax.

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

export const ContributionPlanner: React.FC<{ positions: PortfolioPosition[] }> = ({ positions }) => {
  const [amount, setAmount] = useState(25000);
  const plan = useMemo(
    () => (amount > 0 ? planContribution(positions, amount, 'BALANCED') : null),
    [positions, amount]
  );

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-emerald-100">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <div className="flex items-center gap-2">
          <HandCoins size={18} className="text-emerald-600" />
          <h4 className="font-bold text-gray-800">Invest New Money</h4>
          <span className="text-xs text-gray-400">cash-flow rebalancing — no sells, no tax</span>
        </div>
        <label className="text-xs text-gray-500">
          Contribution ₹
          <input
            type="number"
            className="ml-1.5 w-28 border border-gray-200 rounded px-1.5 py-1 text-xs font-mono"
            value={amount}
            min={0}
            step={5000}
            onChange={e => setAmount(Number(e.target.value) || 0)}
          />
        </label>
      </div>

      {!plan ? (
        <p className="text-xs text-gray-400 mt-2">Enter a contribution amount to see the allocation.</p>
      ) : (
        <>
          <p className="text-xs text-gray-500 mb-3">
            Directing new money at underweight classes takes mean drift from{' '}
            <span className="font-bold text-gray-700">{plan.driftBeforePp}pp</span> to{' '}
            <span className="font-bold text-emerald-600">{plan.driftAfterPp}pp</span> — without selling
            anything.
          </p>

          <div className="space-y-2 mb-4">
            {plan.allocations.map(a => (
              <div key={a.key} className="flex items-center gap-2 text-xs">
                <span className="w-14 font-medium text-gray-600 capitalize">{a.key}</span>
                <div className="flex-1 bg-gray-100 rounded h-3 relative overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-emerald-200 rounded"
                    style={{ width: `${Math.min(100, a.afterPct)}%` }}
                  />
                  <div
                    className="absolute inset-y-0 w-0.5 bg-gray-700"
                    style={{ left: `${Math.min(100, a.targetPct)}%` }}
                  />
                </div>
                <span className="w-32 text-right font-mono text-gray-500">
                  {a.beforePct.toFixed(1)}% → {a.afterPct.toFixed(1)}% (t {a.targetPct}%)
                </span>
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            {plan.instruments.map(i => (
              <div key={i.assetClass} className="flex justify-between text-xs font-mono">
                <span>
                  <span className="font-bold text-emerald-600">BUY</span> {i.symbol}
                  <span className="text-gray-400"> · {i.name}</span>
                </span>
                <span className="text-gray-600">{inr(i.amount)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
