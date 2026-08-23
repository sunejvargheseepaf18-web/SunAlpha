
import { RebalanceSimulation, TargetAllocation, PortfolioPosition, DriftMetric, RebalanceAction, ActionAlternative, RebalanceSuggestion, ScannerResult } from '../types';
import {
    evaluateBands,
    cashFlowRebalance,
    ContributionPlan
} from '../domain/rebalance/bandRebalance.engine';

const TARGET_PROFILES: Record<string, TargetAllocation> = {
    'AGGRESSIVE': { equity: 75, debt: 15, gold: 5, cash: 5 },
    'BALANCED': { equity: 50, debt: 35, gold: 10, cash: 5 },
    'CONSERVATIVE': { equity: 30, debt: 55, gold: 10, cash: 5 }
};

// Helper to classify assets
const getAssetClass = (pos: PortfolioPosition): keyof TargetAllocation => {
    if (pos.assetType === 'GOLD') return 'gold';
    if (pos.assetType === 'MF' && pos.name.includes('Debt')) return 'debt';
    if (pos.assetType === 'MF' && pos.name.includes('Liquid')) return 'cash';
    return 'equity'; // Default to equity
};

// Helper to find alternatives for SELL (Find other holdings in same class)
// and BUY (Find substitutes)
const getSuggestions = (
    assetClass: string, 
    type: 'BUY' | 'SELL', 
    currentSymbol: string,
    positions: PortfolioPosition[]
): { symbol: string, alternatives: ActionAlternative[] } => {
    
    // Default recommendations if no specific logic applies
    let primary = currentSymbol;
    let alts: ActionAlternative[] = [];

    if (type === 'BUY') {
        if (assetClass === 'equity') {
            primary = 'NIFTYBEES';
            alts = [
                { symbol: 'JUNIORBEES', name: 'Nifty Next 50', reason: 'Higher Beta / Growth' },
                { symbol: 'ICICIPRULI', name: 'ICICI Prudential', reason: 'Sector Leader' },
                { symbol: 'AXISBANK', name: 'Axis Bank', reason: 'Valuation Comfort' }
            ];
        } else if (assetClass === 'debt') {
            primary = 'LIQUIDBEES';
            alts = [
                { symbol: 'HDFC-LIQUID', name: 'HDFC Liquid Fund', reason: 'Higher Yield' },
                { symbol: 'SBI-MAGNUM', name: 'SBI Magnum', reason: 'Safety' }
            ];
        } else if (assetClass === 'gold') {
            primary = 'GOLDBEES';
            alts = [
                { symbol: 'SGB-AUG28', name: 'Sovereign Gold Bond', reason: '2.5% Interest Benefit' }
            ];
        }
    } else {
        // SELL Logic: Find other assets in the portfolio that match the asset class
        // Example: If system says SELL RELIANCE, maybe user wants to SELL INFY instead.
        const candidates = positions
            .filter(p => getAssetClass(p) === assetClass && p.symbol !== currentSymbol)
            .map(p => ({
                symbol: p.symbol,
                name: p.name,
                reason: p.pnl < 0 ? 'Tax Harvesting (Loss)' : 'Reduces Concentration'
            }));
        
        // If we found candidates, use them
        if (candidates.length > 0) {
            alts = candidates.slice(0, 3);
        } else {
            // Fallback if only 1 asset exists in that class
            alts = [{ symbol: 'PARTIAL', name: 'Partial Sell', reason: 'Reduce quantity only' }];
        }
    }

    return { symbol: primary, alternatives: alts };
};

export const calculateDrift = (positions: PortfolioPosition[], profileKey: string = 'BALANCED'): RebalanceSimulation => {
    const target = TARGET_PROFILES[profileKey];
    const totalValue = positions.reduce((sum, p) => sum + p.currentValue, 0);

    // 1. Calculate Current Allocation
    const currentAlloc: Record<string, number> = { equity: 0, debt: 0, gold: 0, cash: 0 };
    positions.forEach(p => {
        const cls = getAssetClass(p);
        currentAlloc[cls] += p.currentValue;
    });

    // 2. Calculate Drift — severity from the Bogleheads 5/25 bands: the
    // absolute band (5pp) marks HIGH, the relative band (25% of target)
    // catches drifted small allocations as MODERATE, inside both is LOW.
    const bands = evaluateBands(
        (Object.keys(target) as Array<keyof TargetAllocation>).map(key => ({
            key,
            currentValue: currentAlloc[key],
            targetPct: target[key]
        }))
    );

    const metrics: DriftMetric[] = [];
    let totalDriftScore = 0;

    for (const row of bands.rows) {
        const severity: 'LOW' | 'MODERATE' | 'HIGH' = row.absTriggered
            ? 'HIGH'
            : row.relTriggered
              ? 'MODERATE'
              : 'LOW';

        if (severity === 'HIGH') totalDriftScore += 30;
        else if (severity === 'MODERATE') totalDriftScore += 10;

        metrics.push({
            assetClass: row.key as keyof TargetAllocation,
            current: row.currentPct,
            target: row.targetPct,
            drift: row.driftPp,
            severity
        });
    }

    // 3. Generate Actions (Simulation)
    const actions: RebalanceAction[] = [];
    let projectedTaxImpact = 0;
    
    metrics.forEach(m => {
        if (m.severity === 'LOW') return; // inside both bands — noise, not drift

        const amount = (Math.abs(m.drift) / 100) * totalValue;
        
        if (m.drift > 0) {
            // REDUCE (SELL) - Find the heaviest asset in this class to sell
            const candidates = positions
                .filter(p => getAssetClass(p) === m.assetClass)
                .sort((a, b) => b.currentValue - a.currentValue);
            
            const candidate = candidates[0];
            const suggestion = getSuggestions(m.assetClass, 'SELL', candidate?.symbol ?? 'GENERIC', positions);

            // Translate the rupee amount into an executable order: exact
            // quantity at the holding's current price/NAV.
            const rate = candidate?.currentPrice;
            const isMf = candidate?.assetType === 'MF';
            const rawQty = rate ? amount / rate : undefined;
            const quantity = rawQty !== undefined && candidate
                ? Math.min(candidate.quantity, isMf ? Math.ceil(rawQty * 100) / 100 : Math.ceil(rawQty))
                : undefined;

            const orderDetail = quantity !== undefined && rate !== undefined
                ? ` Sell ${isMf ? quantity.toFixed(2) : quantity} ${isMf ? 'units' : 'shares'} of ${candidate.symbol} @ ₹${rate.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (≈ ₹${Math.round(amount).toLocaleString('en-IN')}).`
                : '';
            const reason = `${m.assetClass.toUpperCase()} overweight by ${m.drift.toFixed(1)}%. Selling heaviest holding.${orderDetail}`;
            const tax = amount * 0.1; // Mock tax calculation (10% LTCG approx)
            projectedTaxImpact += tax;

            actions.push({
                id: `act-${m.assetClass}`,
                type: 'SELL',
                symbol: candidate?.symbol ?? 'GENERIC',
                assetClass: m.assetClass,
                amount,
                quantity,
                rate,
                reason,
                taxImpact: tax,
                alternatives: suggestion.alternatives
            });
        } else {
            // ADD (BUY)
            const reason = `${m.assetClass.toUpperCase()} underweight. Buying standard ETF.`;
            const suggestion = getSuggestions(m.assetClass, 'BUY', '', positions);

            actions.push({
                id: `act-${m.assetClass}`,
                type: 'BUY',
                symbol: suggestion.symbol, 
                assetClass: m.assetClass,
                amount,
                reason,
                alternatives: suggestion.alternatives
            });
        }
    });

    return {
        id: 'sim-1',
        profileName: profileKey,
        totalDriftScore: Math.min(100, totalDriftScore),
        metrics,
        actions,
        projectedTaxImpact,
        volatilityReduction: totalDriftScore > 20 ? 12.5 : 2.0, // Mock impact
        status: totalDriftScore > 50 ? 'CRITICAL' : totalDriftScore > 20 ? 'DRIFTING' : 'BALANCED'
    };
};

export interface ContributionInvestmentPlan extends ContributionPlan {
    instruments: { assetClass: string; symbol: string; name: string; amount: number }[];
}

/**
 * Cash-flow rebalancing: direct a new contribution at underweight classes
 * (never selling anything), mapped to a concrete instrument per class.
 */
export const planContribution = (
    positions: PortfolioPosition[],
    amount: number,
    profileKey: string = 'BALANCED'
): ContributionInvestmentPlan | null => {
    const target = TARGET_PROFILES[profileKey] ?? TARGET_PROFILES['BALANCED'];
    const currentAlloc: Record<string, number> = { equity: 0, debt: 0, gold: 0, cash: 0 };
    positions.forEach(p => {
        currentAlloc[getAssetClass(p)] += p.currentValue;
    });

    const plan = cashFlowRebalance(
        (Object.keys(target) as Array<keyof TargetAllocation>).map(key => ({
            key,
            currentValue: currentAlloc[key],
            targetPct: target[key]
        })),
        amount
    );
    if (!plan) return null;

    const INSTRUMENT_BY_CLASS: Record<string, { symbol: string; name: string }> = {
        equity: { symbol: 'NIFTYBEES', name: 'Nifty 50 BeES ETF' },
        debt: { symbol: 'LIQUIDBEES', name: 'Liquid BeES ETF' },
        gold: { symbol: 'GOLDBEES', name: 'Gold BeES ETF' },
        cash: { symbol: 'CASH', name: 'Hold as cash' }
    };

    return {
        ...plan,
        instruments: plan.allocations
            .filter(a => a.amount > 0)
            .map(a => ({
                assetClass: a.key,
                symbol: INSTRUMENT_BY_CLASS[a.key]?.symbol ?? a.key.toUpperCase(),
                name: INSTRUMENT_BY_CLASS[a.key]?.name ?? a.key,
                amount: a.amount
            }))
    };
};

/**
 * Calculates a confidence score (0-100) for a rebalance suggestion.
 * Logic factors in: 
 * 1. Technical alignment (Momentum/Trend matches direction)
 * 2. Risk/Reward ratio (Scanning tags)
 * 3. Portfolio fit (Does it solve an allocation problem?)
 */
const calculateConfidenceScore = (type: 'BUY' | 'SELL' | 'SWITCH', signalStrength: number, tags: string[]): number => {
    let score = 50;

    // Base score from scanner strength
    score += (signalStrength - 50) * 0.8;

    // Adjust for tags
    if (tags.includes('Risk:Low') && type === 'BUY') score += 10;
    if (tags.includes('Risk:High') && type === 'BUY') score -= 5;
    if (tags.includes('Momentum') && type === 'SWITCH') score += 10;
    
    // Cap at 95
    return Math.min(95, Math.max(20, Math.round(score)));
};

/**
 * Generates specific TACTICAL moves (Switch/Buy/Sell) for the Explore View.
 * Combines Structural Drift (Strategy) with Technical Scans (Tactical).
 */
export const generateTacticalSuggestions = (
    positions: PortfolioPosition[], 
    scans: ScannerResult[], 
    profileKey: string = 'BALANCED'
): RebalanceSuggestion[] => {
    
    const suggestions: RebalanceSuggestion[] = [];
    const driftSim = calculateDrift(positions, profileKey);
    const overweightClasses = driftSim.metrics.filter(m => m.drift > 0).map(m => m.assetClass);
    const underweightClasses = driftSim.metrics.filter(m => m.drift < 0).map(m => m.assetClass);

    // 1. SWITCH Logic: (Overweight Asset + Bearish Scan) -> (Underweight Class + Bullish Scan)
    
    // Find risky holdings in overweight classes
    const sellCandidates = positions.filter(p => {
        const assetClass = getAssetClass(p);
        if (!overweightClasses.includes(assetClass)) return false;
        
        // Is there a bearish scan or high valuation?
        const hasBearishScan = scans.some(s => s.symbol === p.symbol && s.type.includes('BEARISH'));
        return hasBearishScan || p.pnlPercent > 50; // Or profit booking
    });

    // Find buy candidates (Scanner based)
    const bullishScans = scans.filter(s => s.type.includes('BULLISH') || s.type.includes('OVERSOLD'));

    sellCandidates.forEach(sellPos => {
        // Find a matching buy candidate in an UNDERWEIGHT class
        const buyCand = bullishScans.find(scan => {
            // Mock logic: assume scanner result has some sector info or we infer class
            // For now, assume most scans are Equity
            return underweightClasses.includes('equity'); 
        });

        if (buyCand) {
            const amount = Math.min(sellPos.currentValue * 0.5, 50000); // Partial switch
            const confidence = calculateConfidenceScore('SWITCH', buyCand.signalStrength, buyCand.tags);
            
            suggestions.push({
                id: `switch-${sellPos.symbol}-${buyCand.symbol}`,
                type: 'SWITCH',
                assetClass: 'equity',
                fromSymbol: sellPos.symbol,
                toSymbol: buyCand.symbol,
                amount: amount,
                confidenceScore: confidence,
                reason: `Switch ${sellPos.symbol} (Weak Momentum) to ${buyCand.symbol} (Strong Uptrend). Rebalances Equity allocation.`,
                impact: {
                    riskDelta: -1.5,
                    taxEst: amount * 0.1 // 10% tax est
                },
                tags: ['Rebalance', 'Momentum Shift', ...buyCand.tags]
            });
        }
    });

    // 2. BUY Logic: Underweight + Bullish Scan (Independent)
    if (underweightClasses.includes('equity')) {
        const topPick = bullishScans[0];
        if (topPick) {
             const confidence = calculateConfidenceScore('BUY', topPick.signalStrength, topPick.tags);
             suggestions.push({
                id: `buy-${topPick.symbol}`,
                type: 'BUY',
                assetClass: 'equity',
                symbol: topPick.symbol,
                amount: 25000,
                confidenceScore: confidence,
                reason: `${topPick.symbol} showing ${topPick.type.replace('_', ' ').toLowerCase()}. Helps reduce equity underweight.`,
                impact: {
                    riskDelta: 0.5,
                    taxEst: 0
                },
                tags: ['High Conviction', 'Entry', ...topPick.tags]
            });
        }
    }

    // 3. SELL Logic: Overweight + Bearish Scan
    const bearishScans = scans.filter(s => s.type.includes('BEARISH'));
    positions.forEach(pos => {
        const scan = bearishScans.find(s => s.symbol === pos.symbol);
        if (scan) {
             const confidence = calculateConfidenceScore('SELL', scan.signalStrength, scan.tags);
             suggestions.push({
                id: `sell-${pos.symbol}`,
                type: 'SELL',
                assetClass: 'equity',
                symbol: pos.symbol,
                amount: pos.currentValue * 0.5,
                confidenceScore: confidence,
                reason: `${pos.symbol} facing technical breakdown. Trim exposure to protect gains.`,
                impact: {
                    riskDelta: -2.0,
                    taxEst: (pos.pnl > 0 ? pos.currentValue * 0.1 : 0)
                },
                tags: ['Risk Reduction', 'Profit Booking', ...scan.tags]
            });
        }
    });

    return suggestions;
};
