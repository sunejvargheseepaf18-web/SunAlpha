
import React, { useState, useEffect } from 'react';
import { PeriodContext, PeriodType } from '../types';
import { getAvailableFYs, getQuartersForFY, getCurrentFY } from '../services/dateUtils';
import { Calendar, ChevronDown } from 'lucide-react';

interface PeriodSelectorProps {
  onPeriodChange: (period: PeriodContext) => void;
  className?: string;
}

export const PeriodSelector: React.FC<PeriodSelectorProps> = ({ onPeriodChange, className = '' }) => {
  const [activeType, setActiveType] = useState<PeriodType>('FY');
  const [availableFYs] = useState(getAvailableFYs(3)); // Current + 2 prev
  const [selectedFY, setSelectedFY] = useState<PeriodContext>(availableFYs[0]);
  
  // Initialize
  useEffect(() => {
      onPeriodChange(availableFYs[0]);
  }, []);

  const handleTypeChange = (type: PeriodType) => {
      setActiveType(type);
      if (type === 'FY') {
          onPeriodChange(selectedFY);
      } else if (type === 'QTR') {
          // Default to Q1 of selected FY
          const quarters = getQuartersForFY(selectedFY.fyLabel!);
          onPeriodChange(quarters[0]);
      }
  };

  const handleFYSelect = (fyLabel: string) => {
      const found = availableFYs.find(f => f.label === fyLabel);
      if (found) {
          setSelectedFY(found);
          if (activeType === 'FY') onPeriodChange(found);
          // If in QTR mode, we should probably reset to Q1 of new FY
          if (activeType === 'QTR') {
              const quarters = getQuartersForFY(found.fyLabel!);
              onPeriodChange(quarters[0]);
          }
      }
  };

  const handleQuarterSelect = (qtrLabel: string) => {
      if (!selectedFY.fyLabel) return;
      const quarters = getQuartersForFY(selectedFY.fyLabel);
      const found = quarters.find(q => q.label === qtrLabel);
      if (found) onPeriodChange(found);
  };

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-1 flex items-center space-x-2 shadow-sm ${className}`}>
        <div className="flex items-center px-2 text-gray-400">
            <Calendar size={16} />
        </div>
        
        {/* Type Switcher */}
        <div className="flex bg-gray-100 rounded-md p-0.5">
            <button 
                onClick={() => handleTypeChange('FY')}
                className={`px-3 py-1 text-xs font-bold rounded transition-all ${activeType === 'FY' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
                FY
            </button>
            <button 
                onClick={() => handleTypeChange('QTR')}
                className={`px-3 py-1 text-xs font-bold rounded transition-all ${activeType === 'QTR' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
                QTR
            </button>
        </div>

        <div className="h-4 w-px bg-gray-200"></div>

        {/* FY Selector */}
        <div className="relative group">
            <button className="flex items-center space-x-1 text-sm font-bold text-gray-700 hover:bg-gray-50 px-2 py-1 rounded">
                <span>{selectedFY.label}</span>
                <ChevronDown size={12} className="text-gray-400" />
            </button>
            <div className="absolute top-full left-0 mt-1 w-32 bg-white border border-gray-200 rounded-lg shadow-lg hidden group-hover:block z-20">
                {availableFYs.map(fy => (
                    <div 
                        key={fy.label} 
                        onClick={() => handleFYSelect(fy.label)}
                        className={`px-3 py-2 text-xs font-medium cursor-pointer hover:bg-gray-50 ${selectedFY.label === fy.label ? 'text-indigo-600 bg-indigo-50' : 'text-gray-700'}`}
                    >
                        {fy.label}
                    </div>
                ))}
            </div>
        </div>

        {/* Quarter Selector (Conditional) */}
        {activeType === 'QTR' && (
            <>
                <div className="text-gray-300">/</div>
                <div className="relative group">
                    <button className="flex items-center space-x-1 text-sm font-bold text-gray-700 hover:bg-gray-50 px-2 py-1 rounded">
                        <span>Select Qtr</span>
                        <ChevronDown size={12} className="text-gray-400" />
                    </button>
                    <div className="absolute top-full left-0 mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg hidden group-hover:block z-20">
                        {selectedFY.fyLabel && getQuartersForFY(selectedFY.fyLabel).map(q => (
                            <div 
                                key={q.label}
                                onClick={() => handleQuarterSelect(q.label)}
                                className="px-3 py-2 text-xs font-medium cursor-pointer hover:bg-gray-50 text-gray-700"
                            >
                                {q.label}
                            </div>
                        ))}
                    </div>
                </div>
            </>
        )}
    </div>
  );
};
