
import React, { useEffect, useState } from 'react';
import { Layers3 } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, CartesianGrid
} from 'recharts';
import {
  buildLiveStrategy,
  BuiltStrategy,
  STRATEGY_TEMPLATES,
  StrategyTemplate
} from '../services/optionsStrategyService';

// Options strategy builder over the live chain: pick a template, see legs
// with real premiums, the expiry payoff curve, breakevens, max P/L, greeks
// and probability of profit. Educational analysis — not an order ticket.

const inr = (n: number) => `${n < 0 ? '-' : ''}₹${Math.abs(Math.round(n)).toLocaleString('en-IN')}`;
const plOrInf = (v: number | 'UNLIMITED') => (v === 'UNLIMITED' ? 'Unlimited' : inr(v));

const Stat: React.FC<{ label: string; value: string; tone?: 'pos' | 'neg' | 'neutral' }> = ({
  label, value, tone = 'neutral'
}) => (
  <div className="text-center">
    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wide">{label}</p>
    <p className={`font-bold font-mono text-sm mt-0.5 ${tone === 'pos' ? 'text-emerald-600' : tone === 'neg' ? 'text-red-600' : 'text-gray-800'}`}>
      {value}
    </p>
  </div>
);

export const StrategyBuilderPanel: React.FC<{ symbol?: string }> = ({ symbol = 'NIFTY' }) => {
  const [templateId, setTemplateId] = useState<StrategyTemplate['id']>('BULL_CALL_SPREAD');
  const [built, setBuilt] = useState<BuiltStrategy | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    buildLiveStrategy(symbol, templateId).then(result => {
      if (!cancelled) {
        setBuilt(result);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [symbol, templateId]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <div className="flex items-center gap-2">
          <Layers3 size={18} className="text-violet-600" />
          <h4 className="font-bold text-gray-800">Options Strategy Lab</h4>
          <span className="text-xs text-gray-400">{symbol} · live chain · expiry payoff</span>
        </div>
        <select
          className="text-xs font-bold border border-gray-200 rounded-lg px-2 py-1.5 text-violet-700 bg-white"
          value={templateId}
          onChange={e => setTemplateId(e.target.value as StrategyTemplate['id'])}
        >
          {STRATEGY_TEMPLATES.map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      {loading && <p className="text-xs text-violet-500 animate-pulse">Building from the live chain…</p>}

      {!loading && !built && (
        <p className="text-xs text-gray-400">
          Option chain unavailable for {symbol} — strategies appear when the NSE feed is reachable.
        </p>
      )}

      {!loading && built && (
        <>
          <p className="text-xs text-gray-500 mb-2">{built.template.outlook}</p>

          <div className="space-y-1 mb-3">
            {built.legs.map((leg, i) => (
              <p key={i} className="text-xs font-mono text-gray-600">
                <span className={`font-bold ${leg.side === 'BUY' ? 'text-emerald-600' : 'text-red-600'}`}>
                  {leg.side}
                </span>{' '}
                {leg.lots} lot × {leg.strike} {leg.type} @ ₹{leg.premium.toFixed(2)}
              </p>
            ))}
          </div>

          <div className="h-44">
            <ResponsiveContainer>
              <LineChart data={built.analysis.payoffCurve} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="spot"
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={v => String(Math.round(v))}
                  minTickGap={40}
                />
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                <Tooltip
                  formatter={(v: number) => [inr(v), 'P&L at expiry']}
                  labelFormatter={l => `Spot ${Math.round(Number(l))}`}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: 12 }}
                />
                <ReferenceLine y={0} stroke="#94a3b8" />
                <ReferenceLine x={built.spot} stroke="#a78bfa" strokeDasharray="4 4" />
                <Line type="monotone" dataKey="pnl" stroke="#7c3aed" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-3 md:grid-cols-6 gap-3 py-3 border-t border-gray-100 mt-2">
            <Stat
              label="Max Profit"
              value={plOrInf(built.analysis.maxProfit)}
              tone={built.analysis.maxProfit === 'UNLIMITED' ? 'pos' : 'neutral'}
            />
            <Stat
              label="Max Loss"
              value={plOrInf(built.analysis.maxLoss)}
              tone={built.analysis.maxLoss === 'UNLIMITED' ? 'neg' : 'neutral'}
            />
            <Stat
              label={built.analysis.netPremium >= 0 ? 'Net Credit' : 'Net Debit'}
              value={inr(Math.abs(built.analysis.netPremium))}
            />
            <Stat
              label="Breakevens"
              value={built.analysis.breakevens.map(b => Math.round(b)).join(' / ') || '—'}
            />
            <Stat
              label="PoP"
              value={built.analysis.popPct !== null ? `${built.analysis.popPct}%` : '—'}
            />
            <Stat label="Position Δ" value={built.analysis.greeks.delta.toFixed(1)} />
          </div>

          <p className="text-[10px] text-gray-400 mt-2">
            Lot size {built.lotSize} · greeks from NSE IV via Black-Scholes · PoP assumes a lognormal
            terminal distribution. Educational analysis — not an order.
          </p>
        </>
      )}
    </div>
  );
};
