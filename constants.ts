
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

// Dummy holdings mirroring a real portfolio snapshot (21-08-2026).
// `avg` is the purchase price; `last` is the latest traded price for equities.
// MF holdings have no `last` — they are priced from the live AMFI NAV feed at
// runtime (falling back to `avg` when the feed is unreachable).
export const MOCK_HOLDINGS_DATA: Array<{
  symbol: string;
  name: string;
  assetType: 'STOCK' | 'MF' | 'CRYPTO';
  qty: number;
  avg: number;
  last?: number;
  buyDate: string; // acquisition date (single-lot approximation) for tax terms
}> = [
  { symbol: "RELIANCE", name: "Reliance Industries", assetType: 'STOCK', qty: 46, avg: 1310.10, last: 1318.39, buyDate: '2024-10-15' },
  { symbol: "M&M", name: "Mahindra & Mahindra", assetType: 'STOCK', qty: 125, avg: 3420.32, last: 3420.32, buyDate: '2026-04-10' },
  { symbol: "QUANT-ELSS", name: "Quant ELSS Tax Saver Growth Option Direct Growth", assetType: 'MF', qty: 164.83, avg: 407.69, buyDate: '2023-08-05' },
  { symbol: "MIRAE-ELSS", name: "Mirae Asset ELSS Tax Saver", assetType: 'MF', qty: 802.41, avg: 55.85, buyDate: '2025-01-10' },
  { symbol: "AXIS-ELSS", name: "Axis ELSS Tax Saver", assetType: 'MF', qty: 484.93, avg: 109.29, buyDate: '2026-01-15' },
  { symbol: "SBI-CONTRA", name: "SBI Contra Fund Regular", assetType: 'MF', qty: 11.84, avg: 380.18, buyDate: '2025-11-20' },
  { symbol: "NIPPON-ELSS", name: "Nippon India ELSS", assetType: 'MF', qty: 33.03, avg: 144.26, buyDate: '2024-06-01' },
  { symbol: "NIPPON-MULTI", name: "Nippon India Multi Cap Grpwth", assetType: 'MF', qty: 39.26, avg: 305.66, buyDate: '2026-02-14' },
  // Crypto sleeve (dummy) — priced live via CoinGecko in INR
  { symbol: "BTC", name: "Bitcoin", assetType: 'CRYPTO', qty: 0.015, avg: 7800000, buyDate: '2025-03-10' },
  { symbol: "ETH", name: "Ethereum", assetType: 'CRYPTO', qty: 0.4, avg: 260000, buyDate: '2025-09-18' },
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
