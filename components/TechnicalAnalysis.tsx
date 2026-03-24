import React from 'react';
import { TAReport, TABucket, SignalDirection } from '../types';
import { TrendingUp, Activity, BarChart2, Layers, Anchor, AlertCircle, Box } from 'lucide-react';

interface TechnicalAnalysisProps {
  report: TAReport;
  compact?: boolean;
}

const DirectionBadge = ({ direction }: { direction: SignalDirection }) => {
  const colors = {
    'BULLISH': 'bg-emerald-100 text-emerald-700 border-emerald-200',
    'BEARISH': 'bg-red-100 text-red-700 border-red-200',
    'NEUTRAL': 'bg-gray-100 text-gray-700 border-gray-200'
  };
  return (
    <span className={`px-2 py-0.5 text-xs font-bold rounded border ${colors[direction]}`}>
      {direction}
    </span>
  );
};

const BucketCard = ({ bucket, icon: Icon }: { bucket: TABucket, icon: any }) => (
  <div className="bg-white p-4 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors">
    <div className="flex justify-between items-start mb-2">
      <div className="flex items-center space-x-2">
        <div className={`p-1.5 rounded-lg ${bucket.score > 50 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
          <Icon size={18} />
        </div>
        <h4 className="font-bold text-gray-800 text-sm">{bucket.name}</h4>
      </div>
      <DirectionBadge direction={bucket.direction} />
    </div>
    
    <div className="mb-3">
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>Score</span>
        <span className="font-mono">{bucket.score}/100</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-1.5">
        <div 
          className={`h-1.5 rounded-full ${bucket.score > 60 ? 'bg-emerald-500' : bucket.score < 40 ? 'bg-red-500' : 'bg-yellow-500'}`} 
          style={{ width: `${bucket.score}%` }} 
        />
      </div>
    </div>

    <p className="text-xs text-gray-500 leading-snug min-h-[40px] border-t border-gray-50 pt-2">
      {bucket.summary}
    </p>

    <div className="mt-3 grid grid-cols-2 gap-2">
      {bucket.indicators.slice(0, 2).map((ind, idx) => (
        <div key={idx} className="bg-gray-50 p-1.5 rounded text-[10px] flex justify-between">
          <span className="text-gray-500">{ind.name}</span>
          <span className="font-mono font-medium">{ind.value}</span>
        </div>
      ))}
    </div>
  </div>
);

export const TechnicalAnalysis: React.FC<TechnicalAnalysisProps> = ({ report }) => {
  return (
    <div className="space-y-6">
      {/* Overall Score Header */}
      <div className="bg-slate-900 rounded-xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="flex justify-between items-center relative z-10">
          <div>
            <h3 className="text-lg font-bold flex items-center">
              <Activity className="mr-2 text-blue-400" size={20}/> 
              Technical Analysis Engine
            </h3>
            <p className="text-slate-400 text-sm mt-1">{report.summary}</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold font-mono text-blue-400">{report.overallScore}</div>
            <div className="text-xs text-slate-500 uppercase font-semibold">Overall Score</div>
          </div>
        </div>
        
        {/* CPR Overlay Info */}
        {report.cpr && (
          <div className="mt-6 pt-4 border-t border-slate-700 flex space-x-6 relative z-10">
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">CPR Width</p>
              <p className={`text-sm font-bold ${report.cpr.width === 'NARROW' ? 'text-emerald-400' : 'text-slate-300'}`}>
                {report.cpr.width}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Pivot</p>
              <p className="text-sm font-mono text-purple-400">
                {report.cpr.pivot.toFixed(1)}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Warning Banner */}
      <div className="flex items-start p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-800">
        <AlertCircle size={14} className="mr-2 mt-0.5 flex-shrink-0" />
        <p>Technical signals are probabilistic, not predictive. Scores are based on historical price action.</p>
      </div>

      {/* Buckets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <BucketCard bucket={report.buckets.marketStructure} icon={Box} />
        <BucketCard bucket={report.buckets.trend} icon={TrendingUp} />
        <BucketCard bucket={report.buckets.volatility} icon={Layers} />
        <BucketCard bucket={report.buckets.momentum} icon={Activity} />
        <BucketCard bucket={report.buckets.supportResistance} icon={Anchor} />
        <BucketCard bucket={report.buckets.volume} icon={BarChart2} />
      </div>
    </div>
  );
};
