import React from 'react';
import { FAReport, FABucket, FundamentalDirection } from '../types';
import { TrendingUp, DollarSign, ShieldCheck, Activity, Scale, Briefcase, AlertTriangle, PieChart } from 'lucide-react';

interface FundamentalAnalysisProps {
  report: FAReport;
}

const DirectionBadge = ({ direction }: { direction: FundamentalDirection }) => {
  const colors = {
    'POSITIVE': 'bg-emerald-100 text-emerald-700 border-emerald-200',
    'NEGATIVE': 'bg-red-100 text-red-700 border-red-200',
    'NEUTRAL': 'bg-gray-100 text-gray-700 border-gray-200'
  };
  return (
    <span className={`px-2 py-0.5 text-xs font-bold rounded border ${colors[direction]}`}>
      {direction}
    </span>
  );
};

const BucketCard = ({ bucket, icon: Icon }: { bucket: FABucket, icon: any }) => (
  <div className="bg-white p-4 rounded-xl border border-gray-200 hover:border-blue-200 transition-colors">
    <div className="flex justify-between items-start mb-2">
      <div className="flex items-center space-x-2">
        <div className={`p-1.5 rounded-lg ${bucket.score >= 70 ? 'bg-emerald-50 text-emerald-600' : bucket.score <= 40 ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
          <Icon size={18} />
        </div>
        <h4 className="font-bold text-gray-800 text-sm">{bucket.name}</h4>
      </div>
      <div className={`text-xs font-bold ${bucket.score >= 70 ? 'text-emerald-600' : bucket.score <= 40 ? 'text-red-500' : 'text-blue-500'}`}>
        {bucket.score}/100
      </div>
    </div>
    
    <p className="text-xs text-gray-500 leading-snug min-h-[32px] mb-3">
      {bucket.summary}
    </p>

    <div className="space-y-1">
      {bucket.metrics.map((metric, idx) => (
        <div key={idx} className="flex justify-between text-xs border-t border-gray-50 pt-1">
          <span className="text-gray-500">{metric.name}</span>
          <div className="flex items-center space-x-2">
             {metric.benchmark && <span className="text-[10px] text-gray-400">vs {metric.benchmark}</span>}
             <span className={`font-mono font-medium ${metric.status === 'POSITIVE' ? 'text-emerald-600' : metric.status === 'NEGATIVE' ? 'text-red-500' : 'text-gray-700'}`}>
               {metric.value}
             </span>
          </div>
        </div>
      ))}
    </div>
  </div>
);

export const FundamentalAnalysis: React.FC<FundamentalAnalysisProps> = ({ report }) => {
  return (
    <div className="space-y-6">
       {/* Overall Score Header */}
      <div className="bg-gradient-to-r from-blue-900 to-slate-900 rounded-xl p-6 text-white shadow-lg">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold flex items-center">
              <ShieldCheck className="mr-2 text-emerald-400" size={20}/> 
              Fundamental Engine
            </h3>
            <p className="text-blue-200 text-sm mt-1">{report.summary}</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold font-mono text-emerald-400">{report.overallScore}</div>
            <div className="text-xs text-blue-300 uppercase font-semibold">Quality Score</div>
          </div>
        </div>
      </div>

      <div className="flex items-start p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
        <Briefcase size={14} className="mr-2 mt-0.5 flex-shrink-0" />
        <p>Fundamental analysis reflects historical and reported data; it does not guarantee future performance.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <BucketCard bucket={report.buckets.profitability} icon={DollarSign} />
        <BucketCard bucket={report.buckets.growth} icon={TrendingUp} />
        <BucketCard bucket={report.buckets.financialHealth} icon={ShieldCheck} />
        <BucketCard bucket={report.buckets.cashFlow} icon={Activity} />
        <BucketCard bucket={report.buckets.valuation} icon={Scale} />
        <BucketCard bucket={report.buckets.capitalAllocation} icon={PieChart} />
        <BucketCard bucket={report.buckets.businessQuality} icon={Briefcase} />
        <BucketCard bucket={report.buckets.risk} icon={AlertTriangle} />
      </div>
    </div>
  );
};
