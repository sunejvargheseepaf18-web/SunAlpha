
import { ScannerResult, ScanType } from '../types';

const MOCK_SCANS: ScannerResult[] = [
    {
        id: 'scan-1',
        symbol: 'RELIANCE',
        type: 'NARROW_CPR',
        signalStrength: 85,
        description: 'Narrow CPR detected. Expecting trending move.',
        timestamp: new Date().toISOString(),
        tags: ['Trend', 'Risk:Med'],
        timeframe: '1D'
    },
    {
        id: 'scan-2',
        symbol: 'TATASTEEL',
        type: 'BULLISH_MOMENTUM',
        signalStrength: 78,
        description: 'RSI crossing 60 with rising volume.',
        timestamp: new Date().toISOString(),
        tags: ['Momentum', 'Risk:Low'],
        timeframe: '1H'
    },
    {
        id: 'scan-3',
        symbol: 'HDFCBANK',
        type: 'OVERSOLD',
        signalStrength: 90,
        description: 'RSI below 30 on hourly chart. Potential bounce.',
        timestamp: new Date().toISOString(),
        tags: ['Mean Reversion', 'Risk:High'],
        timeframe: '1H'
    },
    {
        id: 'scan-4',
        symbol: 'ADANIENT',
        type: 'VOLUME_SHOCKER',
        signalStrength: 95,
        description: 'Volume > 500% of 10-day average.',
        timestamp: new Date().toISOString(),
        tags: ['Volume', 'Risk:High'],
        timeframe: '15m'
    },
    {
        id: 'scan-5',
        symbol: 'INFY',
        type: 'BEARISH_MOMENTUM',
        signalStrength: 65,
        description: 'Price rejected from daily resistance.',
        timestamp: new Date().toISOString(),
        tags: ['Reversal', 'Risk:Med'],
        timeframe: '1D'
    }
];

export const runMarketScans = async (): Promise<ScannerResult[]> => {
    // In a real app, this would query a Python backend or database
    await new Promise(r => setTimeout(r, 600)); 
    return MOCK_SCANS;
};

export const getScansForSymbol = async (symbol: string): Promise<ScannerResult[]> => {
    return MOCK_SCANS.filter(s => s.symbol === symbol);
};
