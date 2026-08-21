
import React from 'react';
import { PortfolioPosition } from '../types';
import { HoldingAdvice, RedeploymentPlan } from '../domain/advice/advice.types';
import { TrendingDown, TrendingUp, Wallet } from 'lucide-react';

// Rendering only — advice objects come in fully formed from the advice
// engine (via portfolioEngine.getHoldingAdvices). This component never
// derives its own verdicts, so every surface shows the same recommendation.

interface HoldingsPanelProps {
  positions: PortfolioPosition[];
  advices: HoldingAdvice[];
  redeployment: RedeploymentPlan | null;
  onNavigateToAsset: (symbol: string) => void;
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
  onNavigateToAsset
}) => {
  const adviceBySymbol = new Map<string, HoldingAdvice>(advices.map(a => [a.symbol, a]));

  return (
    <div className="space-y-6">
      {/* Holdings list */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex justify-between items-center mb-4">
          <h4 className="font-bold text-gray-800">Holdings</h4>
          <span className="text-xs text-gray-400 font-medium">{positions.length} positions</span>
        </div>

        <div className="divide-y divide-gray-100">
          {positions.map(pos => {
            const advice = adviceBySymbol.get(pos.symbol);
            return (
              <div key={pos.id} className="py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div
                    className="cursor-pointer"
                    onClick={() => onNavigateToAsset(pos.symbol)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-800">{pos.name}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border border-gray-200 text-gray-500">
                        {pos.assetType === 'MF' ? 'MF' : 'Equity'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5 font-mono">
                      {pos.quantity} × ₹{pos.currentPrice.toLocaleString('en-IN')}
                      {pos.priceSource === 'LIVE_NAV' && pos.priceAsOf && (
                        <span className="ml-2 text-emerald-500">NAV as of {pos.priceAsOf}</span>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-mono font-bold text-gray-800">{inr(pos.currentValue)}</div>
                    <div
                      className={`text-xs font-mono ${pos.pnl >= 0 ? 'text-emerald-600' : 'text-red-600'}`}
                    >
                      {pos.pnl >= 0 ? '+' : ''}
                      {pos.pnlPercent.toFixed(1)}%
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
                    <p className="text-xs text-gray-600 leading-relaxed">{advice.detail}</p>
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
