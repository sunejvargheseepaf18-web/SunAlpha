
import React, { useState } from 'react';
import { PortfolioPosition } from '../types';
import { HoldingAdvice, RedeploymentPlan } from '../domain/advice/advice.types';
import { JournalScorecard } from '../domain/advice/journal.engine';
import { removeHolding } from '../services/portfolioIoService';
import { AddHoldingModal } from './AddHoldingModal';
import { Target, TrendingDown, TrendingUp, Wallet, PlusCircle, Trash2 } from 'lucide-react';

// Rendering only — advice objects come in fully formed from the advice
// engine (via portfolioEngine.getHoldingAdvices). This component never
// derives its own verdicts, so every surface shows the same recommendation.

interface HoldingsPanelProps {
  positions: PortfolioPosition[];
  advices: HoldingAdvice[];
  redeployment: RedeploymentPlan | null;
  scorecard?: JournalScorecard | null; // feedback loop: how past advice fared
  onNavigateToAsset: (symbol: string) => void;
  /** Reload hook after a manual add/remove changes the holdings source. */
  onHoldingsChanged?: () => void;
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

const chipClasses: Record<HoldingAdvice['chip'], string> = {
  HOLD: 'bg-gray-100 text-gray-700 border-gray-200',
  SELL: 'bg-red-50 text-red-700 border-red-200',
  BUY: 'bg-emerald-50 text-emerald-700 border-emerald-200'
};

export const HoldingsPanel: React.FC<HoldingsPanelProps> = ({
  positions,
  advices,
  redeployment,
  scorecard,
  onNavigateToAsset,
  onHoldingsChanged
}) => {
  const adviceBySymbol = new Map<string, HoldingAdvice>(advices.map(a => [a.symbol, a]));
  const totalValue = positions.reduce((s, p) => s + p.currentValue, 0);
  const [showAddModal, setShowAddModal] = useState(false);

  const handleRemove = (symbol: string) => {
    removeHolding(symbol);
    onHoldingsChanged?.();
  };

  return (
    <div className="space-y-6">
      {/* Holdings list */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex justify-between items-center mb-4">
          <h4 className="font-bold text-gray-800">Holdings</h4>
          <div className="flex items-center gap-3">
            {scorecard && scorecard.graded > 0 && (
              <span
                className="flex items-center gap-1 text-xs text-gray-500 font-medium"
                title={`${scorecard.correct}/${scorecard.graded} past advices pointed the right way`}
              >
                <Target size={13} className="text-indigo-500" />
                Advice hit rate {scorecard.hitRatePct}% ({scorecard.graded} graded)
              </span>
            )}
            <span className="text-xs text-gray-400 font-medium">{positions.length} positions</span>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center px-3 py-1.5 bg-gray-900 text-white text-xs font-bold rounded-lg hover:bg-black"
            >
              <PlusCircle size={13} className="mr-1.5" /> Add
            </button>
          </div>
        </div>

        {showAddModal && (
          <AddHoldingModal
            onClose={() => setShowAddModal(false)}
            onAdded={() => onHoldingsChanged?.()}
          />
        )}

        {/* Column header (md+) — broker-style: Avg, LTP, Day, Invested, P&L, Weight, Value */}
        <div className="hidden md:grid grid-cols-12 gap-2 pb-2 border-b border-gray-200 text-[10px] font-bold uppercase tracking-wide text-gray-400">
          <div className="col-span-4">Instrument</div>
          <div className="col-span-1 text-right">Qty</div>
          <div className="col-span-1 text-right">Avg</div>
          <div className="col-span-1 text-right">LTP</div>
          <div className="col-span-1 text-right" title="Today's P&L (quantity × day change)">Day</div>
          <div className="col-span-1 text-right">Invested</div>
          <div className="col-span-1 text-right">P&L</div>
          <div className="col-span-1 text-right" title="Share of portfolio value">Wt%</div>
          <div className="col-span-1 text-right">Value</div>
        </div>

        <div className="divide-y divide-gray-100">
          {positions.map(pos => {
            const advice = adviceBySymbol.get(pos.symbol);
            const weightPct = totalValue > 0 ? (pos.currentValue / totalValue) * 100 : 0;
            return (
              <div key={pos.id} className="py-3">
                <div className="grid grid-cols-2 md:grid-cols-12 gap-2 items-center">
                  <div
                    className="col-span-2 md:col-span-4 cursor-pointer min-w-0 group/name"
                    onClick={() => onNavigateToAsset(pos.symbol)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-800 text-sm truncate">{pos.name}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border border-gray-200 text-gray-500 shrink-0">
                        {pos.assetType === 'MF' ? 'MF' : pos.assetType === 'CRYPTO' ? 'Crypto' : 'Equity'}
                      </span>
                    </div>
                    <div className="text-[10px] text-gray-400 mt-0.5">
                      {pos.priceSource === 'LIVE_NAV' && pos.priceAsOf && (
                        <span className="text-emerald-500">NAV as of {pos.priceAsOf}</span>
                      )}
                      {pos.priceSource === 'LIVE_QUOTE' && (
                        <span className="text-emerald-500">
                          quote {pos.priceAsOf
                            ? new Date(pos.priceAsOf).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                            : 'live'}
                        </span>
                      )}
                      {!pos.priceSource && <span>last known price</span>}
                    </div>
                  </div>

                  <div className="hidden md:block md:col-span-1 text-right font-mono text-xs text-gray-600">
                    {pos.quantity}
                  </div>
                  <div className="hidden md:block md:col-span-1 text-right font-mono text-xs text-gray-600">
                    {pos.avgPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </div>
                  <div className="hidden md:block md:col-span-1 text-right font-mono text-xs text-gray-800 font-medium">
                    {pos.currentPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </div>
                  <div className="hidden md:block md:col-span-1 text-right font-mono text-xs">
                    {pos.dayPnl !== undefined ? (
                      <span className={pos.dayPnl >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                        {pos.dayPnl >= 0 ? '+' : ''}{inr(pos.dayPnl).replace('₹', '')}
                      </span>
                    ) : (
                      <span className="text-gray-300" title="No intraday mark for this asset (MF NAVs are daily)">—</span>
                    )}
                  </div>
                  <div className="hidden md:block md:col-span-1 text-right font-mono text-xs text-gray-500">
                    {inr(pos.investedValue)}
                  </div>
                  <div className="hidden md:block md:col-span-1 text-right font-mono text-xs">
                    <span className={pos.pnl >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                      {pos.pnl >= 0 ? '+' : ''}{pos.pnlPercent.toFixed(1)}%
                    </span>
                  </div>
                  <div className="hidden md:block md:col-span-1 text-right font-mono text-xs text-gray-500">
                    {weightPct.toFixed(1)}
                  </div>
                  <div className="col-span-2 md:col-span-1 flex md:block items-center justify-between text-right">
                    <span className="md:hidden text-xs text-gray-400 font-mono">
                      {pos.quantity} × ₹{pos.currentPrice.toLocaleString('en-IN')}
                    </span>
                    <div>
                      <div className="font-mono font-bold text-gray-800 text-sm">{inr(pos.currentValue)}</div>
                      <div className={`md:hidden text-xs font-mono ${pos.pnl >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {pos.pnl >= 0 ? '+' : ''}{pos.pnlPercent.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>

                {advice && (
                  <div className="flex items-start gap-2 mt-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded border shrink-0 ${chipClasses[advice.chip]}`}
                    >
                      {advice.chip}
                    </span>
                    <p className="text-xs text-gray-600 leading-relaxed flex-1">{advice.detail}</p>
                    <button
                      onClick={() => handleRemove(pos.symbol)}
                      className="p-1 text-gray-300 hover:text-red-500 shrink-0"
                      title="Remove this holding (Revert in Import/Export restores the sample book)"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Redeployment of trim/exit proceeds */}
      {redeployment && redeployment.freedCash > 0 && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-emerald-100">
          <div className="flex items-center gap-2 mb-1">
            <Wallet size={18} className="text-emerald-600" />
            <h4 className="font-bold text-gray-800">Redeploy Sale Proceeds</h4>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            The advised sells free <span className="font-bold text-gray-700">{inr(redeployment.freedCash)}</span>.
            Suggested destinations (advisory only — all orders route through the rebalance and risk engines):
          </p>

          <div className="space-y-3">
            {redeployment.suggestions.map(s => (
              <div
                key={s.symbol}
                className="flex items-start gap-3 p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl"
              >
                {s.kind === 'DERIVATIVE_HEDGE' ? (
                  <TrendingDown size={16} className="text-amber-600 mt-0.5 shrink-0" />
                ) : (
                  <TrendingUp size={16} className="text-emerald-600 mt-0.5 shrink-0" />
                )}
                <div>
                  <div className="text-xs font-bold text-gray-700">
                    {s.symbol}
                    <span className="ml-2 font-mono font-normal text-gray-500">{inr(s.amount)}</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{s.detail}</p>
                </div>
              </div>
            ))}
          </div>

          {redeployment.residualCash > 0 && (
            <p className="text-[11px] text-gray-400 mt-3">
              {inr(redeployment.residualCash)} remains as cash (below one unit/lot of the suggestions).
            </p>
          )}
        </div>
      )}
    </div>
  );
};
