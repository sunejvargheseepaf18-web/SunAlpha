
import React, { useState } from 'react';
import { LifecycleStage, UserProfile, AppMode } from '../types';
import { ArrowRight, CheckCircle, Shield, TrendingUp, BookOpen, Zap } from 'lucide-react';

interface OnboardingProps {
  onComplete: (profile: UserProfile) => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [experience, setExperience] = useState<'NONE' | 'LITTLE' | 'PRO'>('NONE');
  const [goal, setGoal] = useState<'LEARN' | 'WEALTH' | 'INCOME'>('WEALTH');
  const [reaction, setReaction] = useState<'PANIC' | 'HOLD' | 'BUY'>('HOLD');

  const handleNext = () => setStep(step + 1);

  const calculateProfile = (): UserProfile => {
    let stage = LifecycleStage.EXPLORER;
    let risk = 'MEDIUM';

    // Logic to classify user
    if (experience === 'NONE') stage = LifecycleStage.EXPLORER;
    else if (experience === 'LITTLE') stage = LifecycleStage.BUILDER;
    else if (experience === 'PRO') stage = LifecycleStage.OPTIMIZER;

    // Adjust based on reaction (Behavioral check)
    if (reaction === 'PANIC') {
        risk = 'LOW';
        // Downgrade stage if panic prone to ensure safety
        if (stage === LifecycleStage.OPTIMIZER) stage = LifecycleStage.BUILDER; 
    } else if (reaction === 'BUY') {
        risk = 'HIGH';
    }

    return {
        id: 'user-1',
        name: name || 'Investor',
        stage: stage,
        riskTolerance: risk as any,
        goals: [goal],
        capital: 0,
        onboardingComplete: true
    };
  };

  const finish = () => {
      const profile = calculateProfile();
      onComplete(profile);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-white">
      <div className="max-w-lg w-full bg-slate-800 rounded-2xl p-8 border border-slate-700 shadow-2xl">
        
        {/* Progress Bar */}
        <div className="w-full bg-slate-700 h-1 rounded-full mb-8 overflow-hidden">
            <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${(step/4)*100}%` }} />
        </div>

        {/* STEP 1: Intro */}
        {step === 1 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                <h1 className="text-3xl font-bold mb-4">Welcome to SunAlpha</h1>
                <p className="text-slate-400 mb-6">Let's build your personalized investment roadmap. First, what should we call you?</p>
                <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your Name"
                    className="w-full bg-slate-900 border border-slate-600 rounded-xl p-4 text-lg focus:ring-2 focus:ring-emerald-500 outline-none mb-6"
                    autoFocus
                />
                <button onClick={handleNext} disabled={!name} className="w-full py-3 bg-emerald-600 rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-700 transition-colors">
                    Let's Start
                </button>
            </div>
        )}

        {/* STEP 2: Experience */}
        {step === 2 && (
            <div className="animate-in fade-in slide-in-from-right-8 duration-300">
                <h2 className="text-2xl font-bold mb-2">How much investing experience do you have?</h2>
                <p className="text-slate-400 mb-6 text-sm">Be honest, this helps us tailor the difficulty.</p>
                
                <div className="space-y-3">
                    <button onClick={() => { setExperience('NONE'); handleNext(); }} className="w-full p-4 bg-slate-700 hover:bg-slate-600 rounded-xl flex items-center text-left transition-colors border border-transparent hover:border-emerald-500/50">
                        <div className="bg-slate-800 p-2 rounded-lg mr-4"><BookOpen size={20} className="text-blue-400"/></div>
                        <div>
                            <p className="font-bold">I'm a complete beginner</p>
                            <p className="text-xs text-slate-400">I want to learn the basics first.</p>
                        </div>
                    </button>
                    <button onClick={() => { setExperience('LITTLE'); handleNext(); }} className="w-full p-4 bg-slate-700 hover:bg-slate-600 rounded-xl flex items-center text-left transition-colors border border-transparent hover:border-emerald-500/50">
                        <div className="bg-slate-800 p-2 rounded-lg mr-4"><TrendingUp size={20} className="text-emerald-400"/></div>
                        <div>
                            <p className="font-bold">I've done a few SIPs</p>
                            <p className="text-xs text-slate-400">I know mutual funds, but not stocks.</p>
                        </div>
                    </button>
                    <button onClick={() => { setExperience('PRO'); handleNext(); }} className="w-full p-4 bg-slate-700 hover:bg-slate-600 rounded-xl flex items-center text-left transition-colors border border-transparent hover:border-emerald-500/50">
                        <div className="bg-slate-800 p-2 rounded-lg mr-4"><Zap size={20} className="text-orange-400"/></div>
                        <div>
                            <p className="font-bold">I trade stocks/F&O</p>
                            <p className="text-xs text-slate-400">I understand charts and risks.</p>
                        </div>
                    </button>
                </div>
            </div>
        )}

        {/* STEP 3: Behavioral Check */}
        {step === 3 && (
            <div className="animate-in fade-in slide-in-from-right-8 duration-300">
                <h2 className="text-2xl font-bold mb-2">Scenario: Market Crashes 20%</h2>
                <p className="text-slate-400 mb-6 text-sm">Your portfolio is in deep red. What is your first instinct?</p>
                
                <div className="space-y-3">
                    <button onClick={() => { setReaction('PANIC'); handleNext(); }} className="w-full p-4 bg-slate-700 hover:bg-slate-600 rounded-xl flex items-center text-left transition-colors border border-transparent hover:border-emerald-500/50">
                        <div className="bg-slate-800 p-2 rounded-lg mr-4 text-red-400">😰</div>
                        <div>
                            <p className="font-bold">Sell everything to save cash</p>
                            <p className="text-xs text-slate-400">I can't handle losing hard-earned money.</p>
                        </div>
                    </button>
                    <button onClick={() => { setReaction('HOLD'); handleNext(); }} className="w-full p-4 bg-slate-700 hover:bg-slate-600 rounded-xl flex items-center text-left transition-colors border border-transparent hover:border-emerald-500/50">
                        <div className="bg-slate-800 p-2 rounded-lg mr-4 text-yellow-400">😐</div>
                        <div>
                            <p className="font-bold">Do nothing & wait</p>
                            <p className="text-xs text-slate-400">It usually recovers eventually.</p>
                        </div>
                    </button>
                    <button onClick={() => { setReaction('BUY'); handleNext(); }} className="w-full p-4 bg-slate-700 hover:bg-slate-600 rounded-xl flex items-center text-left transition-colors border border-transparent hover:border-emerald-500/50">
                        <div className="bg-slate-800 p-2 rounded-lg mr-4 text-emerald-400">🤑</div>
                        <div>
                            <p className="font-bold">Buy more (Average down)</p>
                            <p className="text-xs text-slate-400">It's a discount sale!</p>
                        </div>
                    </button>
                </div>
            </div>
        )}

        {/* STEP 4: Reveal Persona */}
        {step === 4 && (
            <div className="text-center animate-in zoom-in-95 duration-500">
                <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-400">
                    <Shield size={40} />
                </div>
                <h2 className="text-3xl font-bold mb-2">You are a {calculateProfile().stage}</h2>
                <p className="text-slate-400 mb-8 max-w-sm mx-auto">
                    We've customized SunAlpha to help you {calculateProfile().stage === 'EXPLORER' ? 'learn the ropes safely' : 'optimize your growth'}.
                </p>
                
                <div className="bg-slate-700/50 rounded-xl p-4 text-left mb-8 space-y-2 text-sm text-slate-300">
                    <div className="flex items-center"><CheckCircle size={16} className="text-emerald-500 mr-2"/> Paper Trading Mode Unlocked</div>
                    <div className="flex items-center"><CheckCircle size={16} className="text-emerald-500 mr-2"/> AI Investment Coach Activated</div>
                    <div className="flex items-center"><CheckCircle size={16} className="text-emerald-500 mr-2"/> Risk Guardrails Enabled</div>
                </div>

                <button onClick={finish} className="w-full py-4 bg-emerald-600 rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-900/20">
                    Enter Dashboard
                </button>
            </div>
        )}

      </div>
    </div>
  );
};
