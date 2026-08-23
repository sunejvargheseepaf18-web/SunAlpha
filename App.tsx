
import React, { useState } from 'react';
import { AppMode, AppView, RebalanceSuggestion, ExecutionMode, UserProfile } from './types';
import { Layout } from './components/Layout';
import { Landing } from './views/Landing';
import { UnifiedDashboard } from './views/UnifiedDashboard';
import { AnalyzeDashboard } from './views/AnalyzeDashboard';
import { AssetWorkspace } from './views/AssetWorkspace';
import { Explore } from './views/Explore';
import { TaxDashboard } from './views/TaxDashboard';
import { Onboarding } from './views/Onboarding';

const App: React.FC = () => {
  // Main app state for Mode. Defaults to LANDING.
  const [mode, setMode] = useState<AppMode>(AppMode.LANDING);
  // View state for navigation within a mode (e.g., Dashboard, Explore)
  const [view, setView] = useState<AppView>(AppView.DEFAULT);
  
  // GLOBAL EXECUTION MODE (Live vs Paper)
  const [executionMode, setExecutionMode] = useState<ExecutionMode>('LIVE');
  
  // Specific asset focus
  const [activeAsset, setActiveAsset] = useState<string | null>(null);
  
  // Rebalance Navigation Context (Explore -> Analyze)
  const [rebalanceIntent, setRebalanceIntent] = useState<RebalanceSuggestion | null>(null);

  // User Profile State
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  // Reset view to dashboard when switching modes
  const handleModeSwitch = (newMode: AppMode) => {
    setMode(newMode);
    setView(AppView.DEFAULT);
    setActiveAsset(null);
    if (newMode !== AppMode.ANALYZE) {
        setRebalanceIntent(null);
    }
  };

  const handleNavigateToAsset = (symbol: string) => {
      setActiveAsset(symbol);
      setMode(AppMode.ASSET);
  };

  const handleBackFromAsset = () => {
      setMode(AppMode.DASHBOARD);
      setActiveAsset(null);
  };

  const handleInitiateRebalance = (suggestion: RebalanceSuggestion) => {
      setRebalanceIntent(suggestion);
      setMode(AppMode.ANALYZE);
  };

  const handleOnboardingComplete = (profile: UserProfile) => {
      setUserProfile(profile);
      // Auto-set Paper mode for beginners
      if (profile.stage === 'EXPLORER' || profile.stage === 'LEARNER') {
          setExecutionMode('PAPER');
      }
      setMode(AppMode.DASHBOARD);
      setView(AppView.DEFAULT); 
  };

  // Main content router
  const renderContent = () => {
    if (view === AppView.TAX) {
        return <TaxDashboard />;
    }

    switch (mode) {
        case AppMode.DASHBOARD:
            return <UnifiedDashboard 
              onNavigateToAsset={handleNavigateToAsset} 
              userProfile={userProfile} 
              onSwitchMode={handleModeSwitch}
              executionMode={executionMode}
            />;
        case AppMode.EXPLORE:
            return <Explore mode={mode} onInitiateRebalance={handleInitiateRebalance} />;
        case AppMode.ANALYZE:
            return <AnalyzeDashboard initialRebalanceIntent={rebalanceIntent} />;
        case AppMode.ASSET:
            return <AssetWorkspace 
              symbol={activeAsset || 'RELIANCE'} 
              onBack={handleBackFromAsset}
              executionMode={executionMode}
            />;
        default:
            return null;
    }
  };

  // 1. Onboarding Screen (Modal-like full takeover) — must be checked BEFORE
  //    the landing branch: entering from Landing without a profile keeps
  //    mode === LANDING, and checking landing first made this unreachable
  //    (first click on a workspace card did nothing).
  if (view === AppView.ONBOARDING) {
      return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  // 2. Landing Screen
  if (mode === AppMode.LANDING) {
    return <Landing onEnter={(m) => {
        // If no user profile, hijack flow to onboarding
        if (!userProfile) {
            setView(AppView.ONBOARDING);
        } else {
            handleModeSwitch(m);
        }
    }} />;
  }

  // 3. Main App Layout
  return (
    <Layout 
      mode={mode} 
      currentView={view}
      executionMode={executionMode}
      onSwitchMode={handleModeSwitch} 
      onSwitchView={setView}
      onToggleExecutionMode={setExecutionMode}
    >
      {renderContent()}
    </Layout>
  );
};

export default App;
