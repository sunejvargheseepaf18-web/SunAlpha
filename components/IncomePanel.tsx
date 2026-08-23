
import React from 'react';
import { Coins } from 'lucide-react';
import { IncomeReport } from '../services/incomeService';

// Rendering only — the Ghostfolio-style dividend income view: TTM income,
// portfolio yield, yield-on-cost per holding, and a 12-month timeline.

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

export const IncomePanel: React.FC<{ report: IncomeReport }> = ({ report }) => {
  const maxMonthly = Math.max(1, ...report.monthly.map(m => m.income));

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-amber-100">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Coins size={18} className="text-amber-600" />
          <h4 className="font-bold text-gray-800">Dividend Income</h4>
          <span className="text-xs text-gray-400">trailing 12 months</span>
        </div>
        <div className="text-right">
          <span className="font-mono font-bold text-gray-800">{inr(report.totalTtmIncome)}</span>
          <span className="text-xs text-gray-400 ml-2">
            {report.portfolioYieldPct.toFixed(2)}% portfolio yield
          </span>
        </div>
      </div>

      {/* 12-month income timeline */}
      <div className="flex items-end gap-1 h-16 mb-1">
        {report.monthly.map(m => (
          <div
            key={m.month}
            className="flex-1 bg-amber-200 rounded-t"
            style={{ height: `${Math.max(m.income > 0 ? 8 : 2, (m.income / maxMonthly) * 100)}%` }}
            title={`${m.month}: ${inr(m.income)}`}
          />
        ))}
      </div>
      <div className="flex justify-between text-[9px] text-gray-400 mb-4">
        <span>{report.monthly[0]?.month}</span>
        <span>{report.monthly[report.monthly.length - 1]?.month}</span>
      </div>

      <div className="divide-y divide-gray-50">
        {report.holdings.map(h => (
          <div key={h.symbol} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold text-gray-700">{h.name}</p>
              <p className="text-[10px] text-gray-400 font-mono">
                ₹{h.ttmDividendPerShare}/share · {h.payoutsTtm} payout{h.payoutsTtm > 1 ? 's' : ''}
                {h.lastPayout && ` · last ${h.lastPayout.date}`}
              </p>
            </div>
            <div className="text-right font-mono text-xs">
              <p className="font-bold text-gray-800">{inr(h.ttmIncome)}</p>
              <p className="text-gray-400">
                yield {h.yieldPct.toFixed(2)}% · on cost {h.yieldOnCostPct.toFixed(2)}%
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
