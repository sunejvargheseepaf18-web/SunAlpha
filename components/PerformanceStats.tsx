
import React from 'react';
import { PerformanceMetrics } from '../domain/analytics/performance.engine';
import { Gauge } from 'lucide-react';

// Rendering only — the QuantStats-style metric strip computed by the pure
// performance engine from real feed history.

const Tile: React.FC<{ label: string; value: string; tone?: 'pos' | 'neg' | 'neutral' }> = ({
  label,
  value,
  tone = 'neutral'
}) => (
  <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm text-center">
    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wide">{label}</p>
    <p
      className={`font-bold mt-1 font-mono ${
        tone === 'pos' ? 'text-emerald-600' : tone === 'neg' ? 'text-red-600' : 'text-gray-800'
      }`}
    >
      {value}
    </p>
  </div>
);

export const PerformanceStats: React.FC<{ metrics: PerformanceMetrics; benchmarkName: string }> = ({
  metrics,
  benchmarkName
}) => (
  <div>
    <div className="flex items-center gap-2 mb-3">
      <Gauge size={16} className="text-blue-600" />
      <h4 className="font-bold text-gray-800 text-sm">
        Performance & Risk
        <span className="text-gray-400 font-normal ml-2 text-xs">
          {metrics.days} days · vs {benchmarkName}
        </span>
      </h4>
    </div>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Tile
        label={metrics.cagrPct !== null ? 'CAGR' : 'Total Return'}
        value={`${(metrics.cagrPct ?? metrics.totalReturnPct) >= 0 ? '+' : ''}${(metrics.cagrPct ?? metrics.totalReturnPct).toFixed(1)}%`}
        tone={(metrics.cagrPct ?? metrics.totalReturnPct) >= 0 ? 'pos' : 'neg'}
      />
      <Tile label="Volatility (ann.)" value={`${metrics.annualVolatilityPct.toFixed(1)}%`} />
      <Tile
        label="Sharpe"
        value={metrics.sharpe.toFixed(2)}
        tone={metrics.sharpe >= 1 ? 'pos' : metrics.sharpe < 0 ? 'neg' : 'neutral'}
      />
      <Tile
        label="Sortino"
        value={metrics.sortino.toFixed(2)}
        tone={metrics.sortino >= 1 ? 'pos' : metrics.sortino < 0 ? 'neg' : 'neutral'}
      />
      <Tile label="Max Drawdown" value={`${metrics.maxDrawdownPct.toFixed(1)}%`} tone="neg" />
      <Tile label={`Beta vs ${benchmarkName}`} value={metrics.beta !== null ? metrics.beta.toFixed(2) : '—'} />
      <Tile label="Daily VaR (95%)" value={`${metrics.dailyVar95Pct.toFixed(2)}%`} tone="neg" />
      <Tile
        label="Total Return"
        value={`${metrics.totalReturnPct >= 0 ? '+' : ''}${metrics.totalReturnPct.toFixed(1)}%`}
        tone={metrics.totalReturnPct >= 0 ? 'pos' : 'neg'}
      />
    </div>
  </div>
);
