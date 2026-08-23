
import React from 'react';
import { AppMode, AppView, ExecutionMode } from '../types';
import { MODE_CONFIG } from '../constants';
import { requestNotificationPermission, startAlertMonitor } from '../services/alertService';
import { JarvisPanel } from './JarvisPanel';
import { 
  LayoutDashboard, 
  PieChart, 
  TrendingUp, 
  Settings, 
  BookOpen, 
  LogOut,
  Search,
  Bell,
  Menu,
  Compass,
  Calculator,
  ScanSearch,
  Layers,
  FlaskConical,
  Zap
} from 'lucide-react';

interface LayoutProps {
  mode: AppMode;
  currentView: AppView;
  executionMode: ExecutionMode;
  onSwitchMode: (mode: AppMode) => void;
  onSwitchView: (view: AppView) => void;
  onToggleExecutionMode: (mode: ExecutionMode) => void;
  children: React.ReactNode;
}

const NavItem = ({ icon: Icon, label, active, onClick }: any) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${
      active 
        ? 'bg-white/10 text-white font-medium shadow-sm' 
        : 'text-white/70 hover:bg-white/5 hover:text-white'
    }`}
  >
    <Icon size={20} />
    <span>{label}</span>
  </button>
);

export const Layout: React.FC<LayoutProps> = ({ 
    mode, currentView, executionMode, children, 
    onSwitchMode, onSwitchView, onToggleExecutionMode 
}) => {
  const config = MODE_CONFIG[mode] || MODE_CONFIG[AppMode.DASHBOARD];
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  // Background alert monitor: polls live quotes and delivers browser/in-app
  // notifications while the app is open (Layout is always mounted).
  React.useEffect(() => {
    void requestNotificationPermission();
    const stop = startAlertMonitor();
    return stop;
  }, []);

  // Dynamic sidebar styles based on mode
  const sidebarClass = {
    [AppMode.EXPLORE]: 'bg-indigo-900',
    [AppMode.DASHBOARD]: 'bg-slate-900',
    [AppMode.ANALYZE]: 'bg-blue-900',
    [AppMode.ASSET]: 'bg-black',
  }[mode] || 'bg-slate-900'; // Default fallback

  const isPaper = executionMode === 'PAPER';

  return (
    <div className={`flex h-screen bg-gray-50 overflow-hidden ${isPaper ? 'border-4 border-amber-400' : ''}`}>
      {/* Sidebar - Desktop */}
      <aside className={`hidden md:flex flex-col w-64 ${sidebarClass} text-white transition-colors duration-500`}>
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center space-x-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              mode === AppMode.ASSET ? 'bg-orange-500' : 
              mode === AppMode.ANALYZE ? 'bg-blue-500' : 
              mode === AppMode.EXPLORE ? 'bg-indigo-500' : 'bg-emerald-500'
            }`}>
              <span className="font-bold text-lg">S</span>
            </div>
            <span className="text-xl font-bold tracking-tight">SunAlpha</span>
          </div>
          <p className="mt-2 text-xs text-white/50 uppercase tracking-wider font-semibold">
            {config.label}
          </p>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {/* Global Navigation - Always available */}
          <NavItem 
            icon={LayoutDashboard} 
            label="Dashboard" 
            active={mode === AppMode.DASHBOARD} 
            onClick={() => onSwitchMode(AppMode.DASHBOARD)}
          />
          <NavItem 
            icon={Compass} 
            label="Explore" 
            active={mode === AppMode.EXPLORE} 
            onClick={() => onSwitchMode(AppMode.EXPLORE)}
          />
          <NavItem 
            icon={PieChart} 
            label="Analyze" 
            active={mode === AppMode.ANALYZE} 
            onClick={() => onSwitchMode(AppMode.ANALYZE)}
          />

          <div className="my-2 border-t border-white/10" />

          {/* Contextual Nav based on mode */}
          {mode === AppMode.EXPLORE && (
             <>
                <NavItem icon={ScanSearch} label="Smart Scans" />
                <NavItem icon={TrendingUp} label="Trending Baskets" />
             </>
          )}

          {mode === AppMode.ASSET && (
             <>
                <NavItem icon={Layers} label="Option Chain" />
                <NavItem icon={BookOpen} label="Fundamentals" />
             </>
          )}
          
          <NavItem 
            icon={Calculator} 
            label="Tax Center" 
            active={currentView === AppView.TAX}
            onClick={() => onSwitchView(AppView.TAX)}
          />
          
          <div className="pt-8 pb-2">
            <p className="px-4 text-xs font-semibold text-white/40 uppercase">System</p>
          </div>
          <NavItem icon={Settings} label="Settings" />
        </nav>

        {/* MODE SWITCHER */}
        <div className="p-4 bg-black/20 mx-4 rounded-xl mb-4">
            <p className="text-[10px] text-white/50 uppercase font-bold mb-2">Execution Mode</p>
            <div className="flex bg-black/40 p-1 rounded-lg">
                <button 
                    onClick={() => onToggleExecutionMode('LIVE')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded flex items-center justify-center transition-all ${
                        !isPaper ? 'bg-emerald-600 text-white shadow-sm' : 'text-white/50 hover:text-white'
                    }`}
                >
                    <Zap size={12} className="mr-1" /> Live
                </button>
                <button 
                    onClick={() => onToggleExecutionMode('PAPER')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded flex items-center justify-center transition-all ${
                        isPaper ? 'bg-amber-500 text-white shadow-sm' : 'text-white/50 hover:text-white'
                    }`}
                >
                    <FlaskConical size={12} className="mr-1" /> Paper
                </button>
            </div>
        </div>

        <div className="p-4 border-t border-white/10">
          <button 
             onClick={() => onSwitchMode(AppMode.LANDING)}
             className="flex items-center space-x-2 text-white/60 hover:text-white text-sm"
          >
            <LogOut size={16} />
            <span>Exit App</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full w-full relative">
        {/* Paper Mode Warning Banner */}
        {isPaper && (
            <div className="bg-amber-400 text-amber-900 text-xs font-bold text-center py-1 flex items-center justify-center">
                <FlaskConical size={14} className="mr-2" />
                SIMULATION MODE ACTIVE - TRADES ARE NOT REAL
            </div>
        )}

        {/* Top Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm z-10">
          <div className="flex items-center md:hidden">
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 -ml-2">
              <Menu className="text-gray-600" />
            </button>
            <span className="ml-2 font-bold text-gray-800">SunAlpha</span>
          </div>

          <div className="hidden md:flex flex-1 max-w-xl mx-4">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text" 
                placeholder={mode === AppMode.EXPLORE ? "Search scanners, baskets, stocks..." : "Search stocks, ETFs, MFs..."}
                className="w-full pl-10 pr-4 py-2 bg-gray-100 border-none rounded-lg text-sm focus:ring-2 focus:ring-opacity-50 focus:outline-none transition-all"
              />
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <button className="relative p-2 text-gray-500 hover:bg-gray-100 rounded-full">
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-gray-700 to-gray-900 text-white flex items-center justify-center text-xs font-bold border-2 border-white shadow-sm">
              JD
            </div>
          </div>
        </header>

        {/* Scrollable Content Area */}
        <main className={`flex-1 overflow-y-auto overflow-x-hidden bg-gray-50 scrollbar-hide ${isPaper ? 'bg-amber-50/30' : ''}`}>
          <div className="max-w-7xl mx-auto p-4 md:p-6 pb-20">
            {children}
          </div>
          
          <footer className="py-6 text-center text-xs text-gray-400 border-t border-gray-200 mt-auto">
            <p>SunAlpha provides analytics only. No investment advice.</p>
            <p className="mt-1">Market data powered by Yahoo Finance • v0.1 MVP</p>
          </footer>
        </main>

        {/* Jarvis assistant — global, Ctrl+K */}
        <JarvisPanel />
      </div>
    </div>
  );
};
