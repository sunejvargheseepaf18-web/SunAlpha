
import React from 'react';
import { CoachMessage } from '../types';
import { Sparkles, AlertTriangle, ShieldCheck, Info } from 'lucide-react';

interface CoachNudgeProps {
  message: CoachMessage;
  onDismiss?: () => void;
}

export const CoachNudge: React.FC<CoachNudgeProps> = ({ message, onDismiss }) => {
  const styles = {
    'GUIDANCE': { bg: 'bg-indigo-50', border: 'border-indigo-100', text: 'text-indigo-900', icon: Sparkles, iconColor: 'text-indigo-500' },
    'WARNING': { bg: 'bg-orange-50', border: 'border-orange-100', text: 'text-orange-900', icon: AlertTriangle, iconColor: 'text-orange-500' },
    'PRAISE': { bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-900', icon: ShieldCheck, iconColor: 'text-emerald-500' },
    'EXPLAINER': { bg: 'bg-blue-50', border: 'border-blue-100', text: 'text-blue-900', icon: Info, iconColor: 'text-blue-500' }
  };

  const style = styles[message.type];
  const Icon = style.icon;

  return (
    <div className={`p-4 rounded-xl border ${style.bg} ${style.border} shadow-sm animate-in slide-in-from-top-2 duration-300`}>
      <div className="flex items-start">
        <div className={`p-2 rounded-lg bg-white/60 ${style.iconColor} mr-3 mt-0.5`}>
          <Icon size={18} />
        </div>
        <div className="flex-1">
          <h4 className={`text-sm font-bold ${style.text} mb-1 flex items-center`}>
            {message.type === 'GUIDANCE' && "SunAlpha Coach"}
            {message.type === 'WARNING' && "Risk Check"}
            {message.type === 'PRAISE' && "Milestone"}
            {message.type === 'EXPLAINER' && "Quick Insight"}
            <span className="mx-2 text-xs font-normal opacity-50">•</span>
            <span>{message.title}</span>
          </h4>
          <p className={`text-xs ${style.text} opacity-90 leading-relaxed`}>
            {message.message}
          </p>
          {message.actionLabel && (
            <button 
                onClick={message.action}
                className="mt-2 text-xs font-bold underline opacity-80 hover:opacity-100 transition-opacity"
            >
                {message.actionLabel}
            </button>
          )}
        </div>
        {onDismiss && (
            <button onClick={onDismiss} className={`text-xs font-bold ${style.text} opacity-40 hover:opacity-100 ml-2`}>
                Dismiss
            </button>
        )}
      </div>
    </div>
  );
};
