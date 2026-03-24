
import { CapitalSnapshot, PortfolioPosition, BrokerProfile, MarginScenario, ExposureBreakdown } from '../types';

const calculateExposureBreakdown = (positions: PortfolioPosition[]): ExposureBreakdown => {
    let equityCash = 0;
    let equityMargin = 0;
    let fnoMargin = 0;
    let debtCash = 0;

    positions.forEach(pos => {
        const val = pos.currentValue;
        // Mock classification logic
        if (pos.assetType === 'MF' && pos.name.includes('Debt')) {
            debtCash += val;
        } else if (pos.assetType === 'STOCK') {
            // Assume 20% of stocks are on margin for demo purposes if leveraged
            if (pos.leverage && pos.leverage > 1) {
                equityMargin += val;
            } else {
                equityCash += val;
            }
        } else {
            // Derivatives or others
             if (pos.assetType === 'GOLD') debtCash += val;
             else fnoMargin += val;
        }
    });

    return { equityCash, equityMargin, fnoMargin, debtCash };
};

export const calculateCapitalSnapshot = async (
    positions: PortfolioPosition[], 
    broker: BrokerProfile
): Promise<CapitalSnapshot> => {
    
    // 1. Calculate Core Numbers
    const breakdown = calculateExposureBreakdown(positions);
    
    // Simulate that some portion of 'equityMargin' is funded by broker
    // For demo: Assume 30% of 'equityMargin' positions value is borrowed
    const marginBorrowing = breakdown.equityMargin * 0.3; 
    
    // F&O "Margin" is collateral, not necessarily borrowing, but effectively leverage
    // We treat F&O notional as exposure, but margin used as risk capital.
    // For simplicity in this risk view:
    // Own Capital = Broker Free Cash + (Total Pos Value - Borrowed)
    const totalExposure = positions.reduce((acc, p) => acc + p.currentValue, 0);
    const investedOwnCapital = totalExposure - marginBorrowing;
    
    const ownCash = broker.funds;
    const totalOwnCapital = ownCash + investedOwnCapital;
    
    const leverageRatio = totalOwnCapital > 0 ? (totalExposure + ownCash) / totalOwnCapital : 0;
    const marginUsed = marginBorrowing;

    // 2. Risk Assessment
    let riskLevel: CapitalSnapshot['riskLevel'] = 'LOW';
    if (leverageRatio > 2.0) riskLevel = 'CRITICAL';
    else if (leverageRatio > 1.5) riskLevel = 'HIGH';
    else if (leverageRatio > 1.1) riskLevel = 'MODERATE';

    // 3. Scenario Simulation
    // What happens if market drops X%?
    const scenarios: MarginScenario[] = [2, 5, 10].map(dropPct => {
        // Assume beta of 1.2 for leveraged portfolio
        const dropMultiplier = 1.2;
        const portfolioDrop = (dropPct / 100) * dropMultiplier * totalExposure;
        const newEquity = totalOwnCapital - portfolioDrop;
        
        // Margin Call Logic (Mock): If Equity < 110% of Borrowed Margin
        const marginUtilisation = marginUsed > 0 ? (marginUsed / newEquity) * 100 : 0;
        
        let marginCallRisk: MarginScenario['marginCallRisk'] = 'NONE';
        if (newEquity < marginUsed * 1.1) marginCallRisk = 'LIKELY';
        else if (newEquity < marginUsed * 1.3) marginCallRisk = 'POSSIBLE';

        return {
            dropPercentage: dropPct,
            projectedEquity: newEquity,
            marginCallRisk,
            marginUtilisation
        };
    });

    return {
        ownCash,
        investedOwnCapital,
        marginUsed,
        totalExposure,
        leverageRatio,
        riskLevel,
        buyingPower: ownCash * 4, // 4x intraday leverage assumption
        scenarios,
        breakdown
    };
};
