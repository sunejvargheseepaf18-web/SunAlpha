import React from 'react';
import { ConvictionReport } from '../types';
import { CheckCircle, AlertTriangle, XCircle, Gauge } from 'lucide-react';

export const ConvictionBadge: React.FC<{ report: ConvictionReport }> = ({ report }) => {
  const { convictionScore, technicalScore, fundamentalScore, verdict, action } = report;

  let colorClass = 'bg-gray-100 text-gray-800';
  let Icon = CheckCircle;
  
  if (convictionScore >= 70) {
    colorClass = 'bg-emerald-100 text-emerald-800 border-emerald-200';
    Icon = CheckCircle;
  } else if (convictionScore <= 40) {
    colorClass = 'bg-red-100 text-red-800 border-red-200';
    Icon = XCircle;
  } else {
    colorClass = 'bg-yellow-100 text-yellow-800 border-yellow-200';
    Icon = AlertTriangle;
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-4">
        <h3 className="text-lg font-bold text-gray-900 flex items-center">
            <Gauge className="mr-2 text-indigo-600" size={20} />
            SunAlpha Conviction
        </h3>
        <div className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center ${colorClass}`}>
            <Icon size={12} className="mr-1" />
            {verdict}
        </div>
      </div>
      
      <div className="flex items-center justify-center space-x-8 mb-6">
        <div className="text-center">
            <div className={`text-2xl font-bold ${technicalScore > 60 ? 'text-emerald-600' : 'text-orange-600'}`}>{technicalScore}</div>
            <div className="text-xs text-gray-500 uppercase font-semibold">Technical</div>
        </div>
        <div className="h-10 w-px bg-gray-200"></div>
        <div className="text-center">
             <div className="text-4xl font-black text-indigo-600">{convictionScore}</div>
             <div className="text-xs text-indigo-600 uppercase font-bold tracking-wider">Overall</div>
        </div>
        <div className="h-10 w-px bg-gray-200"></div>
        <div className="text-center">
            <div className={`text-2xl font-bold ${fundamentalScore > 60 ? 'text-emerald-600' : 'text-blue-600'}`}>{fundamentalScore}</div>
            <div className="text-xs text-gray-500 uppercase font-semibold">Fundamental</div>
        </div>
      </div>

      <div className="bg-indigo-50 rounded-lg p-3 text-center border border-indigo-100">
        <span className="text-xs text-indigo-400 font-bold uppercase tracking-wide mr-2">Action Insight</span>
        <span className="text-indigo-900 font-medium text-sm">{action}</span>
      </div>
    </div>
  );
};
