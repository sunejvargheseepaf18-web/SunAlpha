
import { AssetIntelligence, ExploreIntelligence, InstrumentType } from '../types';
import { fetchStockDetails, fetchFundamentalDetails, fetchMarketPulse, fetchOptionRadar, fetchFailedSignals, fetchMutualFundDetails } from './marketData';
import { detectRegime } from './regimeEngine';
import { generateTechnicalReport } from './technicalAnalysis';
import { generateFundamentalReport } from './fundamentalAnalysis';
import { generateConviction } from './convictionEngine';
import { runMarketScans } from './scannerEngine';
import { fetchBaskets } from './basketEngine';
import { runBullBearDebate } from './ai/debateEngine';
import { getSymbolLessonsText } from './lessonMemory';
import { getSymbolNews } from './newsService';
import { getEsgScores } from './fundamentalsFeed';
import { computeQualityScore } from '../domain/fundamentals/quality.engine';

// Helper to determine instrument type from symbol (Mock Logic)
const identifyInstrument = (symbol: string): InstrumentType => {
    const upper = symbol.toUpperCase();
    if (upper.includes('-CAP') || upper.includes('FUND') || upper.includes('DIRECT') || upper.includes('PARAG')) return 'MUTUAL_FUND';
    if (upper.includes('ETF') || upper.includes('BEES')) return 'ETF';
    if (upper.includes(' CE') || upper.includes(' PE') || upper.includes(' FUT')) return 'DERIVATIVE';
    return 'STOCK';
};

/**
 * The Orchestrator is the ONLY way the UI should consume intelligence.
 * It combines data fetching, analysis engines, and synthesis logic.
 */
export const getAssetIntelligence = async (symbol: string): Promise<AssetIntelligence> => {
    const type = identifyInstrument(symbol);
    
    // A. MUTUAL FUND PATH
    if (type === 'MUTUAL_FUND') {
        const mfData = await fetchMutualFundDetails(symbol);
        
        // MFs don't need Regime/TA/FA in the same way. 
        // We return specific MF intelligence.
        return {
            symbol: symbol,
            type: 'MUTUAL_FUND',
            price: mfData.nav,
            mfData,
            lastUpdated: new Date().toISOString()
        };
    }

    // B. DERIVATIVE PATH (Simplified for now)
    if (type === 'DERIVATIVE') {
        // Fetch underlying price etc. (Mock)
        return {
            symbol,
            type: 'DERIVATIVE',
            price: 150.25, // Mock option price
            lastUpdated: new Date().toISOString()
        };
    }

    // C. STOCK / ETF PATH (Standard Intelligence)
    
    // 1. Parallel Fetching of Raw Data (news and ESG are best-effort — null offline)
    const [stockData, fundamentalData, news, esg] = await Promise.all([
        fetchStockDetails(symbol),
        fetchFundamentalDetails(symbol),
        getSymbolNews(symbol),
        getEsgScores(symbol)
    ]);

    // 2. Run Intelligence Engines
    const regime = detectRegime(stockData);
    const taReport = generateTechnicalReport(stockData);
    const faReport = generateFundamentalReport(fundamentalData);
    const quality = computeQualityScore(fundamentalData);

    // 3. Synthesize Conviction (The Brain)
    const conviction = generateConviction(taReport, faReport, regime);

    // 4. Adversarial AI debate over the same evidence (advisory).
    //    The reflection loop feeds in the deterministic track record of past
    //    advice on this symbol. Null when the AI is offline — the
    //    deterministic conviction stands.
    const debate = await runBullBearDebate(
        symbol,
        {
            price: { last: stockData.price, changePercent: stockData.changePercent },
            technical: { score: taReport.overallScore, direction: taReport.overallDirection, summary: taReport.summary },
            fundamental: { score: faReport.overallScore, direction: faReport.overallDirection, summary: faReport.summary },
            regime,
            deterministicVerdict: conviction.verdict,
            // Sentiment analyst lane: lexicon-scored headlines as evidence
            newsSentiment: news
                ? {
                      label: news.sentiment.label,
                      score: news.sentiment.score,
                      headlines: news.items.slice(0, 6).map(i => i.title)
                  }
                : 'unavailable'
        },
        getSymbolLessonsText(symbol, stockData.price)
    );

    // 5. Return Unified Intelligence Object
    return {
        symbol: stockData.symbol,
        type: type,
        price: stockData.price,
        stockData,
        technical: taReport,
        fundamental: faReport,
        conviction,
        regime,
        debate: debate ?? undefined,
        news: news ?? undefined,
        quality,
        esg: esg ?? undefined,
        lastUpdated: new Date().toISOString()
    };
};

/**
 * Orchestrator for the Explore Mode (Market-wide Intelligence)
 */
export const getExploreIntelligence = async (): Promise<ExploreIntelligence> => {
    // Parallel Fetching of All Market Context
    const [pulse, scans, baskets, optionsRadar, failedSignals] = await Promise.all([
        fetchMarketPulse(),
        runMarketScans(),
        fetchBaskets(),
        fetchOptionRadar(),
        fetchFailedSignals()
    ]);

    return {
        pulse,
        scans,
        baskets,
        optionsRadar,
        failedSignals
    };
};
