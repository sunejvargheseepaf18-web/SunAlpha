
import React, { useEffect, useState } from 'react';
import { FlaskConical } from 'lucide-react';
import {
  runStrategyBacktest,
  STRATEGY_CATALOG,
  BacktestResult
} from '../services/backtestService';

// Runs the built-in strategies over the symbol's real 1-year feed history
// and reports results next to a cost-aware buy & hold benchmark. Educational
// only — a backtest is a hypothesis check, not a promise of returns.

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

export const BacktestPanel: React.FC<{ symbol: string; isMf?: boolean }> = ({ symbol, isMf }) => {
  const [strategyId, setStrategyId] = useState(STRATEGY_CATALOG[0].id);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    runStrategyBacktest(symbol, strategyId, { isMf }).then(r => {
      if (!cancelled) {
        setResult(r);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [symbol, strategyId, isMf]);

  const strategy = STRATEGY_CATALOG.find(s => s.id === strategyId)!;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <div className="flex items-center gap-2">
          <FlaskConical size={18} className="text-purple-600" />
          <h4 className="font-bold text-gray-800">Strategy Backtest</h4>
          <span className="text-xs text-gray-400">1Y · next-open fills · 0.05% commission + slippage/side</span>
        </div>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {STRATEGY_CATALOG.map(s => (
            <button
              key={s.id}
              onClick={() => setStrategyId(s.id)}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                s.id === strategyId ? 'bg-white shadow text-purple-700' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-gray-500 mb-4">{strategy.description}</p>

      {loading && <p className="text-xs text-purple-500 animate-pulse">Running backtest on live history…</p>}

      {!loading && !result && (
        <p className="text-xs text-gray-400">
          Not enough feed history to backtest {symbol} — results appear once the market feed is reachable.
        </p>
      )}

      {!loading && result && (
        <>
          <div className="grid grid-cols-3 md:grid-cols-7 gap-3 py-3 border-y border-gray-100">
            <Stat
              label="Strategy Return"
              value={`${result.stats.totalReturnPct >= 0 ? '+' : ''}${result.stats.totalReturnPct.toFixed(1)}%`}
              tone={result.stats.totalReturnPct >= 0 ? 'pos' : 'neg'}
            />
            <Stat
              label="Buy & Hold"
              value={`${result.stats.buyHoldReturnPct >= 0 ? '+' : ''}${result.stats.buyHoldReturnPct.toFixed(1)}%`}
              tone={result.stats.buyHoldReturnPct >= 0 ? 'pos' : 'neg'}
            />
            <Stat label="Max Drawdown" value={`${result.stats.maxDrawdownPct.toFixed(1)}%`} tone="neg" />
            <Stat label="Trades" value={String(result.stats.tradesCount)} />
            <Stat label="Win Rate" value={`${result.stats.winRatePct.toFixed(0)}%`} />
            <Stat
              label="Profit Factor"
              value={result.stats.profitFactor !== null ? result.stats.profitFactor.toFixed(2) : '—'}
            />
            <Stat label="Exposure" value={`${result.stats.exposurePct.toFixed(0)}%`} />
          </div>

          <p className="text-[11px] text-gray-400 mt-3">
            {result.stats.totalReturnPct > result.stats.buyHoldReturnPct
              ? `${strategy.name} beat buy & hold by ${(result.stats.totalReturnPct - result.stats.buyHoldReturnPct).toFixed(1)} points over this window — past performance does not guarantee future results.`
              : `Buy & hold beat ${strategy.name} by ${(result.stats.buyHoldReturnPct - result.stats.totalReturnPct).toFixed(1)} points over this window — most timing strategies lose to holding after costs.`}
          </p>
        </>
      )}
    </div>
  );
};
