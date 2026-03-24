
import { TaxSummary, CapitalGainEntry, TaxHarvestOpportunity, PortfolioPosition, PeriodContext } from '../types';
import { MOCK_HOLDINGS_DATA } from '../constants';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Generate extensive mock history spanning multiple FYs
const generateFullHistory = (): CapitalGainEntry[] => {
  return [
    // FY 2024-25 Transactions
    {
      id: 'tx-24-1',
      symbol: 'TATASTEEL',
      buyDate: '2023-01-10',
      sellDate: '2024-05-15',
      quantity: 100,
      buyPrice: 110,
      sellPrice: 145, // Profit
      pnl: 3500,
      assetClass: 'EQUITY',
      term: 'LTCG'
    },
    {
      id: 'tx-24-2',
      symbol: 'PAYTM',
      buyDate: '2024-02-15',
      sellDate: '2024-06-20',
      quantity: 200,
      buyPrice: 850,
      sellPrice: 450, // Loss
      pnl: -80000,
      assetClass: 'EQUITY',
      term: 'STCG'
    },
    {
      id: 'tx-24-3',
      symbol: 'NIFTY 24MAY FUT',
      buyDate: '2024-05-01',
      sellDate: '2024-05-25',
      quantity: 50,
      buyPrice: 22200,
      sellPrice: 22500, // Profit
      pnl: 15000,
      assetClass: 'FNO',
      term: 'BUSINESS'
    },
    // FY 2023-24 Transactions
    {
      id: 'tx-23-1',
      symbol: 'INFY',
      buyDate: '2022-05-20',
      sellDate: '2023-09-10',
      quantity: 50,
      buyPrice: 1400,
      sellPrice: 1550,
      pnl: 7500,
      assetClass: 'EQUITY',
      term: 'LTCG'
    },
    {
      id: 'tx-23-2',
      symbol: 'ADANIENT',
      buyDate: '2023-01-01',
      sellDate: '2023-02-05', // Falls in FY22-23 actually? No, Feb 2023 is FY22-23. Wait.
      // FY23-24 is Apr 1 2023 to Mar 31 2024.
      // Feb 2023 is FY22-23.
      // Let's adjust dates to ensure they land in correct buckets.
      quantity: 100,
      buyPrice: 2000,
      sellPrice: 1500,
      pnl: -50000,
      assetClass: 'EQUITY',
      term: 'STCG'
    },
    {
        id: 'tx-23-3',
        symbol: 'RELIANCE',
        buyDate: '2023-06-01',
        sellDate: '2023-12-15', // FY 23-24
        quantity: 20,
        buyPrice: 2400,
        sellPrice: 2600,
        pnl: 4000,
        assetClass: 'EQUITY',
        term: 'STCG'
    }
  ];
};

export const calculateTaxReport = async (positions: PortfolioPosition[], period: PeriodContext): Promise<TaxSummary> => {
  await delay(600); // Simulate processing

  const fullHistory = generateFullHistory();
  
  // 1. Filter Transactions by Period
  const periodHistory = fullHistory.filter(tx => {
      return tx.sellDate >= period.startDate && tx.sellDate <= period.endDate;
  });

  // 2. Aggregate Realized Gains/Losses
  let realizedSTCG = 0;
  let realizedLTCG = 0;
  let businessIncome = 0;

  periodHistory.forEach(tx => {
    if (tx.assetClass === 'EQUITY') {
        if (tx.term === 'STCG') realizedSTCG += tx.pnl;
        else if (tx.term === 'LTCG') realizedLTCG += tx.pnl;
    } else if (tx.assetClass === 'FNO') {
        businessIncome += tx.pnl;
    }
  });

  // 3. Calculate Tax Liability
  // Simple logic: If loss, liability is 0. If gain, apply rate.
  // Real world logic handles set-off (STCL against LTCG etc).
  
  // Set-off Logic (Simplified):
  // STCL can set off STCG and LTCG.
  // LTCL can only set off LTCG.
  
  let netSTCG = realizedSTCG;
  let netLTCG = realizedLTCG;

  // If STCG is negative, try to offset LTCG? No, usually STCL offsets STCG and LTCG.
  // If LTCG is negative, it carries forward, cannot offset STCG.
  
  // Implementation for MVP: Pure liability on positive numbers
  const taxLiabilitySTCG = Math.max(0, netSTCG * 0.15);
  
  const ltcgExemption = 100000;
  // Exemption only applies if total LTCG > 1L in a year.
  // If period is QTR, we should ideally project, but here we just calc strictly on realized.
  const taxableLTCG = Math.max(0, netLTCG - ltcgExemption);
  const taxLiabilityLTCG = taxableLTCG * 0.10;

  const taxLiabilityBusiness = Math.max(0, businessIncome * 0.30); // Assumed 30% slab

  // 4. Identify Tax Harvesting Opportunities (Unrealized)
  // These are based on CURRENT holdings, unrelated to selected period history
  // But strictly speaking, you harvest to offset gains in the SELECTED period.
  const harvestingOpportunities: TaxHarvestOpportunity[] = [];

  positions.forEach(pos => {
    if (pos.pnl < 0) {
        if (Math.abs(pos.pnl) > 1000) {
            const isLongTerm = Math.random() > 0.7; 
            const term = isLongTerm ? 'LTCG' : 'STCG';
            
            // Tax saving calculation
            // Only valuable if we have realized gains in the current scope
            let save = 0;
            if (term === 'STCG' && netSTCG > 0) {
                save = Math.abs(pos.pnl) * 0.15;
            } else if (term === 'LTCG' && taxableLTCG > 0) {
                save = Math.abs(pos.pnl) * 0.10;
            }

            // Even if no current gains, valid for carry forward
            if (save === 0) save = Math.abs(pos.pnl) * 0.10; // Potential future save

            if (save > 0) {
                harvestingOpportunities.push({
                    symbol: pos.symbol,
                    quantity: pos.quantity,
                    unrealizedLoss: pos.pnl,
                    potentialTaxSave: save,
                    term
                });
            }
        }
    }
  });

  return {
    period,
    estimatedTotalTax: taxLiabilitySTCG + taxLiabilityLTCG + taxLiabilityBusiness,
    realizedSTCG,
    realizedLTCG,
    businessIncome,
    taxLiabilitySTCG,
    taxLiabilityLTCG,
    taxLiabilityBusiness,
    lossCarryForward: {
        stcg: netSTCG < 0 ? Math.abs(netSTCG) : 0,
        ltcg: netLTCG < 0 ? Math.abs(netLTCG) : 0,
        business: businessIncome < 0 ? Math.abs(businessIncome) : 0
    },
    harvestingOpportunities,
    history: periodHistory
  };
};
