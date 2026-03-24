
import React from 'react';
import { Info, HelpCircle } from 'lucide-react';

interface ContextPanelProps {
  title: string;
  children: React.ReactNode;
  type?: 'INFO' | 'TIP' | 'WARNING';
}

export const ContextPanel: React.FC<ContextPanelProps> = ({ title, children, type = 'INFO' }) => {
  const styles = {
    'INFO': 'bg-blue-50 border-blue-100 text-blue-900',
    'TIP': 'bg-emerald-50 border-emerald-100 text-emerald-900',
    'WARNING': 'bg-yellow-50 border-yellow-100 text-yellow-900'
  };

  const icons = {
    'INFO': <Info size={16} className="text-blue-500" />,
    'TIP': <HelpCircle size={16} className="text-emerald-500" />,
    'WARNING': <Info size={16} className="text-yellow-500" />
  };

  return (
    <div className={`p-4 rounded-xl border ${styles[type]} text-sm leading-relaxed`}>
      <div className="flex items-center space-x-2 mb-2 font-bold opacity-80">
        {icons[type]}
        <span>{title}</span>
      </div>
      <div className="opacity-90">
        {children}
      </div>
    </div>
  );
};
