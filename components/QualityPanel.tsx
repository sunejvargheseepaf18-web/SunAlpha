import React from 'react';
import { EsgScores } from '../types';
import { QualityReport, classifyEsgRisk, EsgRiskBand } from '../domain/fundamentals/quality.engine';
import { CheckCircle2, XCircle, ListChecks, Leaf } from 'lucide-react';

interface QualityPanelProps {
  quality: QualityReport;
  esg?: EsgScores;
}

const GRADE_STYLES: Record<QualityReport['grade'], string> = {
  STRONG: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  AVERAGE: 'bg-amber-100 text-amber-700 border-amber-200',
  WEAK: 'bg-red-100 text-red-700 border-red-200'
};

const ESG_BAND_STYLES: Record<EsgRiskBand, string> = {
  NEGLIGIBLE: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  LOW: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  MEDIUM: 'bg-amber-100 text-amber-700 border-amber-200',
  HIGH: 'bg-orange-100 text-orange-700 border-orange-200',
  SEVERE: 'bg-red-100 text-red-700 border-red-200'
};

const EsgPillar = ({ label, value }: { label: string; value: number }) => (
  <div className="text-center">
    <div className="text-lg font-bold font-mono text-gray-800">{value.toFixed(1)}</div>
    <div className="text-[10px] text-gray-500 uppercase font-semibold">{label}</div>
  </div>
);

/**
 * Piotroski-style 9-point quality checklist + Sustainalytics ESG risk card.
 * Renders the transparent pass/fail rows behind the quality grade — no
 * black-box scores.
 */
export const QualityPanel: React.FC<QualityPanelProps> = ({ quality, esg }) => {
  const esgBand = esg ? classifyEsgRisk(esg.totalEsg) : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Quality checklist */}
      <div className="lg:col-span-2 bg-white p-4 rounded-xl border border-gray-200">
        <div className="flex justify-between items-center mb-1">
          <h4 className="font-bold text-gray-800 text-sm flex items-center">
            <ListChecks size={16} className="mr-2 text-blue-600" />
            Quality Checklist (Piotroski-style)
          </h4>
          <div className="flex items-center space-x-2">
            <span className="text-sm font-mono font-bold text-gray-700">
              {quality.score}/{quality.maxScore}
            </span>
            <span className={`px-2 py-0.5 text-xs font-bold rounded border ${GRADE_STYLES[quality.grade]}`}>
              {quality.grade}
            </span>
          </div>
        </div>
        <p className="text-xs text-gray-500 mb-3">{quality.summary}</p>

        <div className="space-y-1">
          {quality.checks.map(check => (
            <div key={check.id} className="flex items-center justify-between text-xs border-t border-gray-50 pt-1.5">
              <div className="flex items-center min-w-0">
                {check.pass ? (
                  <CheckCircle2 size={14} className="mr-2 text-emerald-500 flex-shrink-0" />
                ) : (
                  <XCircle size={14} className="mr-2 text-red-400 flex-shrink-0" />
                )}
                <span className="text-gray-600 truncate">{check.label}</span>
              </div>
              <div className="flex items-center space-x-3 flex-shrink-0">
                <span className="text-[10px] text-gray-400">{check.threshold}</span>
                <span className={`font-mono font-medium ${check.pass ? 'text-emerald-600' : 'text-red-500'}`}>
                  {check.actual}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ESG risk card */}
      <div className="bg-white p-4 rounded-xl border border-gray-200">
        <h4 className="font-bold text-gray-800 text-sm flex items-center mb-3">
          <Leaf size={16} className="mr-2 text-emerald-600" />
          ESG Risk (Sustainalytics)
        </h4>
        {esg && esgBand ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-3xl font-bold font-mono text-gray-800">{esg.totalEsg.toFixed(1)}</div>
                <div className="text-[10px] text-gray-500 uppercase font-semibold">Risk score — lower is better</div>
              </div>
              <span className={`px-2 py-0.5 text-xs font-bold rounded border ${ESG_BAND_STYLES[esgBand]}`}>
                {esgBand} RISK
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 border-t border-gray-100 pt-3 mb-3">
              <EsgPillar label="Environment" value={esg.environmentScore} />
              <EsgPillar label="Social" value={esg.socialScore} />
              <EsgPillar label="Governance" value={esg.governanceScore} />
            </div>
            <div className="flex justify-between text-xs border-t border-gray-100 pt-2">
              <span className="text-gray-500">Controversy level</span>
              <span className={`font-mono font-medium ${esg.controversyLevel >= 3 ? 'text-red-500' : 'text-gray-700'}`}>
                {esg.controversyLevel}/5
              </span>
            </div>
          </>
        ) : (
          <p className="text-xs text-gray-400">
            No ESG coverage available for this symbol from the live feed.
          </p>
        )}
      </div>
    </div>
  );
};
