
import { AnalysisReport, ReportType, ReportMetric, ReportSection, ScannerResult } from '../../types';
import { runMarketScans } from '../scannerEngine';
import { calculatePortfolio } from '../portfolioEngine';
import { calculateDrift } from '../rebalanceEngine';
import { fetchMarketPulse } from '../marketData';

// --- In-Memory Report Store (Mock Database) ---
let REPORT_STORE: AnalysisReport[] = [];

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- Helpers ---

const generateId = () => `rpt-${Date.now()}`;

const formatDelta = (curr: number, prev: number, isPct: boolean = false) => {
    const diff = curr - prev;
    const sign = diff > 0 ? '+' : '';
    return `${sign}${diff.toFixed(2)}${isPct ? '%' : ''}`;
};

// --- Generators ---

const generateScanReport = async (): Promise<AnalysisReport> => {
    const [scans, pulse] = await Promise.all([runMarketScans(), fetchMarketPulse()]);
    
    // Logic to summarize scans
    const bullishCount = scans.filter(s => s.type.includes('BULLISH')).length;
    const bearishCount = scans.filter(s => s.type.includes('BEARISH')).length;
    const topPick = scans.sort((a,b) => b.signalStrength - a.signalStrength)[0];

    const metrics: ReportMetric[] = [
        { label: 'Bullish Signals', value: bullishCount, status: 'POSITIVE' },
        { label: 'Bearish Signals', value: bearishCount, status: 'NEGATIVE' },
        { label: 'Market VIX', value: pulse.vix, status: pulse.vix > 15 ? 'NEGATIVE' : 'POSITIVE' }
    ];

    const sections: ReportSection[] = [
        {
            title: 'Executive Summary',
            content: `Market regime is ${pulse.regime.trend.replace('_', ' ')}. ${bullishCount} bullish opportunities detected against ${bearishCount} bearish setups. VIX is at ${pulse.vix}.`
        },
        {
            title: 'Top Conviction Setup',
            content: `${topPick.symbol} showing ${topPick.type.replace('_', ' ')} with ${topPick.signalStrength}% signal strength.`,
            items: [topPick]
        }
    ];

    return {
        id: generateId(),
        type: 'MARKET_SCAN',
        title: `Market Scan: ${new Date().toLocaleTimeString()}`,
        generatedAt: new Date().toISOString(),
        confidenceScore: 85,
        summary: 'Bullish momentum detected in Midcaps.',
        metrics,
        sections,
        tags: ['Daily Scan', pulse.regime.volatility]
    };
};

const generatePortfolioReport = async (): Promise<AnalysisReport> => {
    const pf = await calculatePortfolio();
    const drift = calculateDrift(pf.positions, 'AGGRESSIVE');
    
    // Simulate previous run data for delta
    const prevNetWorth = pf.totalValue * 0.98; 
    
    const metrics: ReportMetric[] = [
        { label: 'Net Worth', value: `₹${(pf.totalValue/100000).toFixed(2)}L`, delta: '+2.0%', status: 'POSITIVE' },
        { label: 'Drift Score', value: drift.totalDriftScore, status: drift.totalDriftScore > 20 ? 'NEGATIVE' : 'POSITIVE' },
        { label: 'Health Score', value: 85, delta: '+5', status: 'POSITIVE' }
    ];

    const sections: ReportSection[] = [
        {
            title: 'Portfolio Health',
            content: `Portfolio is currently ${drift.status}. Tech sector concentration has increased slightly.`
        },
        {
            title: 'Rebalance Simulation',
            content: `Drift detected in ${drift.metrics.filter(m => m.drift > 5).map(m => m.assetClass).join(', ')}. Est tax impact: ₹${drift.projectedTaxImpact}.`,
            items: drift.actions
        }
    ];

    return {
        id: generateId(),
        type: 'PORTFOLIO_HEALTH',
        title: `Portfolio Checkup: ${new Date().toLocaleDateString()}`,
        generatedAt: new Date().toISOString(),
        confidenceScore: 92,
        summary: 'Portfolio healthy but drifting in Asset Allocation.',
        metrics,
        sections,
        tags: ['Rebalance', 'Risk Check']
    };
};

// --- Public API ---

export const runReport = async (type: ReportType): Promise<AnalysisReport> => {
    await delay(1000); // Simulate processing
    
    let report: AnalysisReport;
    
    switch (type) {
        case 'MARKET_SCAN':
            report = await generateScanReport();
            break;
        case 'PORTFOLIO_HEALTH':
            report = await generatePortfolioReport();
            break;
        default:
            throw new Error("Unknown report type");
    }

    REPORT_STORE.unshift(report); // Add to history
    return report;
};

export const getReports = async (type?: ReportType): Promise<AnalysisReport[]> => {
    await delay(200);
    if (type) return REPORT_STORE.filter(r => r.type === type);
    return [...REPORT_STORE];
};

export const getReportById = async (id: string): Promise<AnalysisReport | undefined> => {
    await delay(100);
    return REPORT_STORE.find(r => r.id === id);
};
