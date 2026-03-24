import React from 'react';
import { UserProgress } from '../types';
import { Award, Flame, Target } from 'lucide-react';
import { calculateProgressPercentage } from '../services/gamification';

interface GamificationWidgetProps {
  progress: UserProgress;
  compact?: boolean;
}

export const GamificationWidget: React.FC<GamificationWidgetProps> = ({ progress, compact = false }) => {
  const percent = calculateProgressPercentage(progress.currentPoints, progress.nextLevelPoints);

  if (compact) {
    return (
      <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl p-4 text-white shadow-lg flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-white/20 rounded-lg">
            <Award size={20} className="text-white" />
          </div>
          <div>
            <p className="text-xs text-emerald-100 font-semibold uppercase tracking-wider">Level {progress.level}</p>
            <p className="font-bold">{progress.title}</p>
          </div>
        </div>
        <div className="text-right">
            <div className="flex items-center text-xs text-emerald-100 mb-1">
                <Flame size={12} className="mr-1" />
                {progress.sipStreakMonths} Month Streak
            </div>
            <div className="w-24 bg-black/20 rounded-full h-1.5">
                <div 
                    className="bg-white h-1.5 rounded-full transition-all duration-500" 
                    style={{ width: `${percent}%` }}
                />
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <div>
           <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Investor Level {progress.level}</p>
           <h3 className="text-xl font-bold text-gray-800">{progress.title}</h3>
        </div>
        <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-600">
           <Award size={24} />
        </div>
      </div>
      
      <div className="mb-4">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>{progress.currentPoints} XP</span>
            <span>{progress.nextLevelPoints} XP</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
            <div 
                className="bg-emerald-500 h-2.5 rounded-full transition-all duration-1000 ease-out" 
                style={{ width: `${percent}%` }}
            />
        </div>
        <p className="text-xs text-gray-400 mt-2">
            Earn points by maintaining your SIP streak and diversifying.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-6">
        <div className="bg-orange-50 p-3 rounded-xl border border-orange-100 flex items-center space-x-3">
             <Flame className="text-orange-500" size={20} />
             <div>
                 <p className="text-xs text-gray-500 font-semibold">SIP Streak</p>
                 <p className="font-bold text-gray-800">{progress.sipStreakMonths} Months</p>
             </div>
        </div>
        <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 flex items-center space-x-3">
             <Target className="text-blue-500" size={20} />
             <div>
                 <p className="text-xs text-gray-500 font-semibold">Goals</p>
                 <p className="font-bold text-gray-800">2 On Track</p>
             </div>
        </div>
      </div>
    </div>
  );
};
