import React, { useEffect, useState } from 'react';
import {
  getStrategyLeaderboard,
  planCopy,
  LeaderboardEntry,
  CopyPlan
} from '../services/socialTradingService';
import { Users, Copy, Loader2, ShieldAlert, TrendingUp, Info } from 'lucide-react';

// Copy-trading marketplace, honest edition: the "traders" on this
// leaderboard are the app's own strategies with real backtested track
// records on live price history — not invented star traders.

const riskStyle = (risk: number): string =>
  risk <= 3
    ? 'bg-emerald-100 text-emerald-700'
    : risk <= 6
      ? 'bg-amber-100 text-amber-700'
      : 'bg-red-100 text-red-700';

const LeaderRow: React.FC<{
  entry: LeaderboardEntry;
  selected: boolean;
  onSelect: () => void;
}> = ({ entry, selected, onSelect }) => (
  <button
    onClick={onSelect}
    className={`w-full text-left p-3 rounded-lg border transition-colors ${
      selected ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 bg-white hover:border-indigo-200'
    }`}
  >
    <div className="flex justify-between items-center mb-1">
      <span className="font-bold text-gray-800 text-sm">{entry.name}</span>
      <div className="flex items-center space-x-2">
        {entry.lowConfidence && (
          <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded" title="Fewer than 3 closed trades — thin track record">
            THIN RECORD
          </span>
        )}
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${riskStyle(entry.riskScore)}`}>
          RISK {entry.riskScore}/10
        </span>
        <span className="text-sm font-mono font-bold text-indigo-600">{entry.score.toFixed(0)}</span>
      </div>
    </div>
    <div className="flex items-center space-x-4 text-xs text-gray-500">
      <span className={entry.returnPct >= 0 ? 'text-emerald-600 font-medium' : 'text-red-500 font-medium'}>
        {entry.returnPct >= 0 ? '+' : ''}{entry.returnPct.toFixed(1)}% return
      </span>
      <span>{entry.maxDrawdownPct.toFixed(1)}% max DD</span>
      <span>{entry.winRatePct.toFixed(0)}% wins</span>
      <span>{entry.tradesCount} trades</span>
    </div>
  </button>
);

export const CopyTradingPanel: React.FC = () => {
  const [board, setBoard] = useState<LeaderboardEntry[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [allocation, setAllocation] = useState<string>('50000');
  const [plan, setPlan] = useState<CopyPlan | null>(null);
  const [planning, setPlanning] = useState(false);

  useEffect(() => {
    getStrategyLeaderboard().then(setBoard);
  }, []);

  const handlePlan = async () => {
    if (!selected) return;
    const amount = parseFloat(allocation);
    if (!isFinite(amount) || amount <= 0) return;
    setPlanning(true);
    setPlan(await planCopy(selected, amount));
    setPlanning(false);
  };

  return (
    <div className="bg-white p-5 rounded-xl border border-gray-200">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-bold text-gray-800 flex items-center">
          <Users size={18} className="mr-2 text-indigo-600" />
          Strategy Copy Leaderboard
        </h3>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        Ranked by real backtested track records on live price history (costs included) — pick a
        leader, allocate capital, and get exact mirror orders. Advisory only.
      </p>

      {board === null ? (
        <div className="flex items-center text-sm text-gray-400 py-8 justify-center">
          <Loader2 size={16} className="mr-2 animate-spin" /> Building track records…
        </div>
      ) : board.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <p className="text-sm text-gray-500">No price history reachable — leaderboard unavailable offline.</p>
        </div>
      ) : (
        <>
          <div className="space-y-2 mb-4">
            {board.map(entry => (
              <LeaderRow
                key={entry.id}
                entry={entry}
                selected={selected === entry.id}
                onSelect={() => { setSelected(entry.id); setPlan(null); }}
              />
            ))}
          </div>

          {selected && (
            <div className="border-t border-gray-100 pt-4">
              <div className="flex items-center space-x-2 mb-3">
                <span className="text-xs font-medium text-gray-600 whitespace-nowrap">Allocate ₹</span>
                <input
                  type="number"
                  value={allocation}
                  onChange={e => setAllocation(e.target.value)}
                  className="w-32 px-2 py-1.5 text-sm border border-gray-200 rounded-lg font-mono"
                  min={1000}
                  step={1000}
                />
                <button
                  onClick={handlePlan}
                  disabled={planning}
                  className="flex items-center px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-60"
                >
                  {planning ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Copy size={14} className="mr-1.5" />}
                  Plan Copy
                </button>
              </div>

              {plan && (
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-700 flex items-center">
                      <TrendingUp size={14} className="mr-1.5 text-indigo-500" />
                      {plan.stance === 'INVESTED' ? 'Leader is invested' : 'Leader is in cash'}
                    </span>
                    <span className="text-[10px] font-bold bg-red-50 text-red-600 px-2 py-0.5 rounded flex items-center">
                      <ShieldAlert size={11} className="mr-1" /> COPY STOP-LOSS {plan.copyStopLossPct}%
                    </span>
                  </div>

                  {plan.orders.map((order, idx) => (
                    <div key={idx} className="flex justify-between items-center text-sm bg-white rounded-lg px-3 py-2 border border-gray-100 mb-2">
                      <span className={`font-bold ${order.side === 'BUY' ? 'text-emerald-600' : 'text-red-500'}`}>
                        {order.side} {order.quantity} × {order.symbol}
                      </span>
                      <span className="font-mono text-gray-700">
                        @ ₹{order.rate.toLocaleString('en-IN')} = ₹{order.amount.toLocaleString('en-IN')}
                      </span>
                    </div>
                  ))}

                  <p className="text-xs text-gray-500 flex items-start">
                    <Info size={12} className="mr-1.5 mt-0.5 flex-shrink-0" />
                    {plan.note}
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
