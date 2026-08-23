
import React, { useEffect, useState } from 'react';
import { Target } from 'lucide-react';
import { GoalAssessment } from '../services/goalService';
import { getGoalPlans, updateGoalSip } from '../services/goalService';

// Rendering + light orchestration — goal cards with inflation-adjusted
// targets, scenario bands, and the headline number: the SIP change needed.

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const lakh = (n: number) =>
  n >= 10000000 ? `₹${(n / 10000000).toFixed(2)} Cr` : n >= 100000 ? `₹${(n / 100000).toFixed(1)} L` : inr(n);

export const GoalsPanel: React.FC<{ portfolioValue: number }> = ({ portfolioValue }) => {
  const [plans, setPlans] = useState<GoalAssessment[]>([]);

  const refresh = () => setPlans(getGoalPlans(portfolioValue));
  useEffect(refresh, [portfolioValue]);

  if (plans.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-teal-100 shadow-sm p-6">
      <div className="flex items-center gap-2 mb-4">
        <Target size={18} className="text-teal-600" />
        <h4 className="font-bold text-gray-800">Goals</h4>
        <span className="text-xs text-gray-400">inflation-adjusted · 12% expected, ±3% bands</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {plans.map(plan => (
          <div key={plan.goal.id} className="border border-gray-100 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-gray-800">{plan.goal.name}</p>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                  plan.onTrack
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}
              >
                {plan.onTrack ? 'ON TRACK' : 'NEEDS ATTENTION'}
              </span>
            </div>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {lakh(plan.goal.targetAmount)} today → {lakh(plan.inflatedTarget)} in {plan.goal.targetYears}y
              (at {plan.goal.inflationPct}% inflation)
            </p>

            {/* Funding progress vs inflated target */}
            <div className="mt-3 bg-gray-100 rounded-full h-2 overflow-hidden">
              <div
                className={`h-2 rounded-full ${plan.onTrack ? 'bg-emerald-400' : 'bg-amber-400'}`}
                style={{ width: `${Math.min(100, plan.fundedPct)}%` }}
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-1 font-mono">
              projected {lakh(plan.projected.expected)} ({plan.fundedPct}%) · band{' '}
              {lakh(plan.projected.pessimistic)}–{lakh(plan.projected.optimistic)}
            </p>

            <div className="flex items-center justify-between mt-3 gap-2">
              <label className="text-[11px] text-gray-500">
                SIP ₹/mo
                <input
                  type="number"
                  className="ml-1.5 w-24 border border-gray-200 rounded px-1.5 py-0.5 text-xs font-mono"
                  value={plan.goal.monthlySip}
                  min={0}
                  step={500}
                  onChange={e => {
                    updateGoalSip(plan.goal.id, Number(e.target.value) || 0);
                    refresh();
                  }}
                />
              </label>
              <p className="text-[11px] font-medium text-right">
                {plan.sipDelta > 0 ? (
                  <span className="text-amber-700">
                    increase SIP by {inr(plan.sipDelta)}/mo to stay on track
                  </span>
                ) : (
                  <span className="text-emerald-600">funded — no extra SIP needed</span>
                )}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
