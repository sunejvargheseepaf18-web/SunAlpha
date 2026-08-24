import React from 'react';
import { KgsPlusPlan } from '../services/kgsPlusService';
import { Crosshair, ShieldAlert, CheckCircle2 } from 'lucide-react';

// KGS++ day plan: CPR (by KGS) x OI x market regime, fully specified —
// entry zone, stop, targets, and every confluence AND conflict shown.

const BIAS_STYLE: Record<KgsPlusPlan['bias'], string> = {
  LONG: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  SHORT: 'bg-red-100 text-red-700 border-red-300',
  NEUTRAL: 'bg-gray-100 text-gray-600 border-gray-300'
};

export const KgsPlusPanel: React.FC<{ plan: KgsPlusPlan }> = ({ plan }) => (
  <div className="p-4 h-full overflow-y-auto">
    <div className="flex items-center justify-between mb-3">
      <h3 className="font-bold text-gray-800 text-sm flex items-center">
        <Crosshair size={15} className="mr-1.5 text-indigo-600" />
        KGS++ Day Plan
        <span className="ml-2 text-[10px] font-normal text-gray-400">CPR × OI × Regime</span>
      </h3>
      <div className="flex items-center space-x-2">
        <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
          {plan.dayType.replace(/_/g, ' ')}
        </span>
        <span className={`text-xs font-bold px-2.5 py-0.5 rounded border ${BIAS_STYLE[plan.bias]}`}>
          {plan.bias} · {plan.confidence}%
        </span>
      </div>
    </div>

    {plan.bias !== 'NEUTRAL' && plan.entryZone && (
      <div className="grid grid-cols-3 gap-2 mb-3 text-center">
        <div className="bg-indigo-50 border border-indigo-100 rounded-lg py-1.5">
          <p className="text-[10px] text-indigo-500 font-bold uppercase">Entry Zone</p>
          <p className="text-xs font-mono font-bold text-gray-800">
            {plan.entryZone.low.toLocaleString('en-IN')}–{plan.entryZone.high.toLocaleString('en-IN')}
          </p>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-lg py-1.5">
          <p className="text-[10px] text-red-500 font-bold uppercase">Stop</p>
          <p className="text-xs font-mono font-bold text-gray-800">{plan.stop?.toLocaleString('en-IN')}</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-lg py-1.5">
          <p className="text-[10px] text-emerald-600 font-bold uppercase">Targets</p>
          <p className="text-xs font-mono font-bold text-gray-800">
            {plan.targets.length > 0 ? plan.targets.map(t => t.toLocaleString('en-IN')).join(' → ') : '—'}
          </p>
        </div>
      </div>
    )}

    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Confluence</p>
        <ul className="space-y-1">
          {plan.confluences.map((c, i) => (
            <li key={i} className="text-[11px] text-gray-600 flex items-start">
              <CheckCircle2 size={11} className="mr-1.5 mt-0.5 text-emerald-500 shrink-0" /> {c}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Conflicts</p>
        {plan.conflicts.length === 0 ? (
          <p className="text-[11px] text-gray-400">None — all factors agree.</p>
        ) : (
          <ul className="space-y-1">
            {plan.conflicts.map((c, i) => (
              <li key={i} className="text-[11px] text-amber-700 flex items-start">
                <ShieldAlert size={11} className="mr-1.5 mt-0.5 text-amber-500 shrink-0" /> {c}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
    <p className="text-[10px] text-gray-400 mt-2">Advisory only — no orders are placed from this plan.</p>
  </div>
);
