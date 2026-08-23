
import React, { useEffect, useState } from 'react';
import { NotebookPen } from 'lucide-react';
import { GroupStats, JournalStats } from '../domain/journal/tradeJournal.engine';
import { getJournalStats } from '../services/tradeJournalService';

// Rendering only — the trading-journal scorecard (expectancy, R, profit
// factor, streaks, setup breakdown) computed by the pure journal engine.

const inr = (n: number) => `${n < 0 ? '-' : ''}₹${Math.abs(Math.round(n)).toLocaleString('en-IN')}`;

const Stat: React.FC<{ label: string; value: string; tone?: 'pos' | 'neg' | 'neutral' }> = ({
  label,
  value,
  tone = 'neutral'
}) => (
  <div className="text-center">
    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wide">{label}</p>
    <p
      className={`font-bold font-mono text-sm mt-0.5 ${
        tone === 'pos' ? 'text-emerald-600' : tone === 'neg' ? 'text-red-600' : 'text-gray-800'
      }`}
    >
      {value}
    </p>
  </div>
);

export const TradeJournalPanel: React.FC = () => {
  const [stats, setStats] = useState<JournalStats | null>(null);

  useEffect(() => {
    setStats(getJournalStats());
  }, []);

  if (!stats) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <div className="flex items-center gap-2 mb-1">
        <NotebookPen size={18} className="text-amber-600" />
        <h4 className="font-bold text-gray-800">Trade Journal</h4>
        <span className="text-xs text-gray-400">{stats.trades} closed trades · paper sells auto-journal</span>
      </div>

      {stats.trades === 0 ? (
        <p className="text-xs text-gray-400 mt-2">
          No closed trades yet — sell a paper position and it lands here automatically.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3 py-3 border-y border-gray-100 mt-2">
            <Stat label="Net P&L" value={inr(stats.netPnl)} tone={stats.netPnl >= 0 ? 'pos' : 'neg'} />
            <Stat
              label="Expectancy / trade"
              value={inr(stats.expectancy)}
              tone={stats.expectancy >= 0 ? 'pos' : 'neg'}
            />
            <Stat label="Win Rate" value={`${stats.winRatePct.toFixed(0)}%`} />
            <Stat
              label="Profit Factor"
              value={stats.profitFactor !== null ? stats.profitFactor.toFixed(2) : '—'}
              tone={(stats.profitFactor ?? 0) >= 1.5 ? 'pos' : 'neutral'}
            />
            <Stat
              label="Avg R"
              value={stats.expectancyR !== null ? `${stats.expectancyR.toFixed(2)}R` : '—'}
            />
            <Stat
              label="Streak"
              value={`${stats.currentStreak > 0 ? 'W' : 'L'}${Math.abs(stats.currentStreak)} (max W${stats.maxWinStreak}/L${stats.maxLossStreak})`}
              tone={stats.currentStreak > 0 ? 'pos' : 'neg'}
            />
          </div>

          {stats.mistakePnl !== 0 && (
            <p className="text-[11px] text-red-500 mt-2">
              Trades tagged with mistakes cost {inr(stats.mistakePnl)} — your rules are cheaper than your impulses.
            </p>
          )}

          {Object.keys(stats.bySetup).length > 0 && (
            <div className="mt-4">
              <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wide mb-2">By Setup</p>
              <div className="space-y-1">
                {(Object.entries(stats.bySetup) as [string, GroupStats][])
                  .sort((a, b) => b[1].netPnl - a[1].netPnl)
                  .map(([setup, g]) => (
                    <div key={setup} className="flex justify-between text-xs font-mono">
                      <span className="text-gray-600">
                        {setup} <span className="text-gray-400">({g.trades} trades, {g.winRatePct}% win)</span>
                      </span>
                      <span className={g.netPnl >= 0 ? 'text-emerald-600' : 'text-red-600'}>{inr(g.netPnl)}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          <div className="mt-4">
            <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wide mb-2">Recent Trades</p>
            <div className="space-y-1">
              {stats.entries.slice(-5).reverse().map(e => (
                <div key={e.id} className="flex justify-between text-xs font-mono">
                  <span className="text-gray-600">
                    {e.exitDate} · {e.symbol} × {e.quantity}
                    {e.setup && <span className="text-gray-400"> · {e.setup}</span>}
                  </span>
                  <span className={e.pnl >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                    {inr(e.pnl)} ({e.returnPct >= 0 ? '+' : ''}{e.returnPct.toFixed(1)}%
                    {e.rMultiple !== null ? `, ${e.rMultiple}R` : ''})
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
