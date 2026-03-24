
import { AppMode } from './types';

export const APP_NAME = "SunAlpha";
export const APP_VERSION = "v0.1 MVP";

export const MODE_CONFIG = {
  [AppMode.DASHBOARD]: {
    theme: 'invest', // Default theme
    primaryColor: 'text-emerald-600',
    bgPrimary: 'bg-emerald-600',
    bgLight: 'bg-emerald-50',
    border: 'border-emerald-200',
    label: 'Dashboard',
    tagline: 'Your Wealth Command Center'
  },
  [AppMode.EXPLORE]: {
    theme: 'explore',
    primaryColor: 'text-indigo-600',
    bgPrimary: 'bg-indigo-600',
    bgLight: 'bg-indigo-50',
    border: 'border-indigo-200',
    label: 'Explore',
    tagline: 'Market Intelligence & Discovery'
  },
  [AppMode.ANALYZE]: {
    theme: 'analyze',
    primaryColor: 'text-blue-600',
    bgPrimary: 'bg-blue-600',
    bgLight: 'bg-blue-50',
    border: 'border-blue-200',
    label: 'Analyze',
    tagline: 'Deep Portfolio Analytics'
  },
  [AppMode.ASSET]: {
    theme: 'trade',
    primaryColor: 'text-slate-900',
    bgPrimary: 'bg-slate-900',
    bgLight: 'bg-slate-50',
    border: 'border-slate-200',
    label: 'Workspace',
    tagline: 'Asset Intelligence'
  }
};

export const MOCK_HOLDINGS_DATA = [
  { symbol: "AAPL", name: "Apple Inc.", qty: 15, avg: 145.20 },
  { symbol: "MSFT", name: "Microsoft Corp", qty: 10, avg: 280.50 },
  { symbol: "VTI", name: "Vanguard Total Stock", qty: 50, avg: 210.00 },
  { symbol: "RELIANCE", name: "Reliance Ind.", qty: 100, avg: 2400.00 },
];

export const MOCK_USER_PROGRESS = {
  level: 3,
  title: "Consistent Compounder",
  currentPoints: 2450,
  nextLevelPoints: 3000,
  sipStreakMonths: 6,
  badges: [
    { id: '1', name: 'Diversified', icon: 'PieChart', earned: true },
    { id: '2', name: 'SIP Master', icon: 'Repeat', earned: true },
    { id: '3', name: 'Risk Aware', icon: 'Shield', earned: false }
  ]
};

export const EXPLORE_DATA = [
  {
    id: '1',
    category: 'TREND',
    title: 'IT Sector Rally',
    subtitle: 'Technology stocks up 2.3% this week due to rupee depreciation.',
    tags: ['Sector Rotation', 'Market News'],
    relevance: [AppMode.DASHBOARD]
  },
  {
    id: '2',
    category: 'LEARN',
    title: 'What is XIRR?',
    subtitle: 'Why simple returns fail to measure SIP performance.',
    tags: ['Education', 'Basics'],
    relevance: [AppMode.ANALYZE]
  },
  {
    id: '3',
    category: 'INSIGHT',
    title: 'Hidden Gems',
    subtitle: '3 Funds with falling expense ratios and consistent alpha.',
    tags: ['Mutual Funds', 'Opportunity'],
    relevance: [AppMode.DASHBOARD]
  },
  {
    id: '4',
    category: 'TOP',
    title: 'Volume Shockers',
    subtitle: 'Stocks with >500% volume spike in the last hour.',
    tags: ['Technical', 'Momentum'],
    relevance: [AppMode.EXPLORE]
  },
  {
    id: '5',
    category: 'LEARN',
    title: 'RSI Divergence',
    subtitle: 'How to spot trend reversals using the Relative Strength Index.',
    tags: ['Technical Analysis', 'Advanced'],
    relevance: [AppMode.EXPLORE]
  }
];
