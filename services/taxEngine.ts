
import { TaxSummary, CapitalGainEntry, TaxHarvestOpportunity, PortfolioPosition, PeriodContext } from '../types';
import { MOCK_HOLDINGS_DATA } from '../constants';
import {
  applyLossOffsets,
  computeEquityTax,
  findLossHarvests,
  findGainHarvests,
  HarvestHolding
} from '../domain/tax/harvest.engine';

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
  
  // Offsets per the statutory rules (pure domain): STCL offsets both gain
  // types; LTCL offsets LTCG only. Rates/exemption from EQUITY_TAX_RULES
  // (20% STCG, 12.5% LTCG above the Rs 1.25L exemption).
  const offsets = applyLossOffsets(realizedSTCG, realizedLTCG);
  const netSTCG = realizedSTCG < 0 ? realizedSTCG : offsets.netSTCG;
  const netLTCG = realizedLTCG < 0 ? realizedLTCG : offsets.netLTCG;

  const equityTax = computeEquityTax(offsets.netSTCG, offsets.netLTCG);
  const taxLiabilitySTCG = equityTax.stcgTax;
  const taxableLTCG = equityTax.taxableLTCG;
  const taxLiabilityLTCG = equityTax.ltcgTax;

  const taxLiabilityBusiness = Math.max(0, businessIncome * 0.30); // Assumed 30% slab

  // 4. Identify Tax Harvesting Opportunities (Unrealized)
  // These are based on CURRENT holdings, unrelated to selected period history
  // But strictly speaking, you harvest to offset gains in the SELECTED period.
  // Terms come from real buy dates (joined from the holdings data), offsets
  // and rates from the pure tax domain engine — no randomness.
  const buyDateBySymbol = new Map(MOCK_HOLDINGS_DATA.map(h => [h.symbol, h.buyDate]));
  const asOf = new Date().toISOString().split('T')[0];
  const harvestable: HarvestHolding[] = positions
    .filter(p => (p.assetType === 'STOCK' || p.assetType === 'MF') && buyDateBySymbol.has(p.symbol))
    .map(p => ({
      symbol: p.symbol,
      assetType: p.assetType as 'STOCK' | 'MF',
      quantity: p.quantity,
      avgPrice: p.avgPrice,
      currentPrice: p.currentPrice,
      buyDate: buyDateBySymbol.get(p.symbol)!
    }));

  const lossHarvests = findLossHarvests(
    harvestable,
    { stcg: offsets.netSTCG, ltcg: offsets.netLTCG },
    asOf
  );
  const harvestingOpportunities: TaxHarvestOpportunity[] = lossHarvests.map(l => ({
    symbol: l.symbol,
    quantity: l.quantity,
    unrealizedLoss: -l.loss,
    potentialTaxSave: l.taxSaved > 0 ? l.taxSaved : parseFloat((l.carryForwardLoss * 0.125).toFixed(2)),
    term: l.term,
    detail: l.detail
  }));

  const gainHarvestingOpportunities = findGainHarvests(harvestable, Math.max(0, netLTCG), asOf);

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
    gainHarvestingOpportunities,
    history: periodHistory
  };
};
