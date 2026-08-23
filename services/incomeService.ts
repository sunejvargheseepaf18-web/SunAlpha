
// Income service — fetches real dividend events (Yahoo chart events=div via
// the existing feed proxy) for equity holdings and runs the pure income
// engine. Null when nothing could be fetched — the UI shows no income
// section rather than zeros pretending to be data.

import { PortfolioPosition } from '../types';
import { getDividendHistory } from './marketFeed';
import { computeIncomeReport, IncomeReport } from '../domain/income/income.engine';

export type { IncomeReport };

export const buildIncomeReport = async (
  positions: PortfolioPosition[]
): Promise<IncomeReport | null> => {
  const equities = positions.filter(p => p.assetType === 'STOCK');
  if (equities.length === 0) return null;

  const histories = await Promise.all(equities.map(p => getDividendHistory(p.symbol, 365)));
  if (histories.every(h => h.length === 0)) return null; // feed unreachable or no data

  const dividendsBySymbol = Object.fromEntries(
    equities.map((p, i) => [p.symbol, histories[i]])
  );

  return computeIncomeReport(
    equities.map(p => ({
      symbol: p.symbol,
      name: p.name,
      quantity: p.quantity,
      avgPrice: p.avgPrice,
      currentPrice: p.currentPrice
    })),
    dividendsBySymbol,
    new Date().toISOString().split('T')[0]
  );
};
