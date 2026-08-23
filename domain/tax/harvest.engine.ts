
// Tax optimization engine (pure domain logic) — Indian listed-equity rules.
//
// Rules encoded (FY 2026-27, post Budget-2024 regime):
// - Holding > 12 months  -> LTCG taxed 12.5% above a Rs 1.25 lakh/FY exemption
// - Holding <= 12 months -> STCG taxed 20%
// - FIFO lot matching is mandated
// - Offsets: short-term capital losses offset BOTH gain types;
//   long-term capital losses offset LTCG only
//
// Two harvesting plays, both emitted with exact quantities:
// - LOSS harvesting: realize unrealized losses to offset realized gains
// - GAIN harvesting: realize LTCG up to the unused exemption each FY at 0%
//   tax, stepping up the cost basis (rebuy after a day; same-day buyback
//   would be matched FIFO against the sale)

export interface EquityTaxRules {
  stcgRatePct: number;
  ltcgRatePct: number;
  ltcgExemption: number; // per FY
  ltcgHoldingDays: number;
}

export const EQUITY_TAX_RULES: EquityTaxRules = {
  stcgRatePct: 20,
  ltcgRatePct: 12.5,
  ltcgExemption: 125000,
  ltcgHoldingDays: 365
};

export type GainTerm = 'STCG' | 'LTCG';

const dayDiff = (from: string, to: string): number =>
  Math.floor((new Date(to).getTime() - new Date(from).getTime()) / 86400000);

export const classifyHolding = (
  buyDate: string,
  asOf: string,
  rules: EquityTaxRules = EQUITY_TAX_RULES
): { term: GainTerm; holdingDays: number; daysToLtcg: number } => {
  const holdingDays = Math.max(0, dayDiff(buyDate, asOf));
  const isLtcg = holdingDays > rules.ltcgHoldingDays;
  return {
    term: isLtcg ? 'LTCG' : 'STCG',
    holdingDays,
    daysToLtcg: isLtcg ? 0 : rules.ltcgHoldingDays + 1 - holdingDays
  };
};

// --- FIFO realization ------------------------------------------------------

export interface TaxLot {
  quantity: number;
  buyPrice: number;
  buyDate: string;
}

export interface RealizedPiece {
  quantity: number;
  gain: number;
  term: GainTerm;
  holdingDays: number;
}

export interface FifoResult {
  pieces: RealizedPiece[];
  stcgGain: number;
  ltcgGain: number;
  remainingLots: TaxLot[];
}

/** Realize `sellQuantity` at `sellPrice` against lots in FIFO order. */
export const fifoRealize = (
  lots: TaxLot[],
  sellQuantity: number,
  sellPrice: number,
  sellDate: string,
  rules: EquityTaxRules = EQUITY_TAX_RULES
): FifoResult | null => {
  const totalHeld = lots.reduce((s, l) => s + l.quantity, 0);
  if (sellQuantity <= 0 || sellQuantity > totalHeld + 1e-9) return null;

  const ordered = [...lots].sort((a, b) => a.buyDate.localeCompare(b.buyDate));
  const pieces: RealizedPiece[] = [];
  const remainingLots: TaxLot[] = [];
  let toSell = sellQuantity;
  let stcgGain = 0;
  let ltcgGain = 0;

  for (const lot of ordered) {
    if (toSell <= 0) {
      remainingLots.push({ ...lot });
      continue;
    }
    const qty = Math.min(lot.quantity, toSell);
    const { term, holdingDays } = classifyHolding(lot.buyDate, sellDate, rules);
    const gain = parseFloat(((sellPrice - lot.buyPrice) * qty).toFixed(2));
    pieces.push({ quantity: qty, gain, term, holdingDays });
    if (term === 'STCG') stcgGain += gain;
    else ltcgGain += gain;
    toSell -= qty;
    if (lot.quantity > qty) remainingLots.push({ ...lot, quantity: lot.quantity - qty });
  }

  return {
    pieces,
    stcgGain: parseFloat(stcgGain.toFixed(2)),
    ltcgGain: parseFloat(ltcgGain.toFixed(2)),
    remainingLots
  };
};

// --- Offsets & tax ---------------------------------------------------------

export interface OffsetResult {
  netSTCG: number; // >= 0 after offsets
  netLTCG: number;
  carryForward: { stcl: number; ltcl: number };
}

/** STCL offsets STCG first, then LTCG. LTCL offsets LTCG only. */
export const applyLossOffsets = (stcg: number, ltcg: number): OffsetResult => {
  let netSTCG = stcg;
  let netLTCG = ltcg;
  let stclLeft = 0;
  let ltclLeft = 0;

  if (netLTCG < 0) {
    ltclLeft = -netLTCG;
    netLTCG = 0;
  }
  if (netSTCG < 0) {
    stclLeft = -netSTCG;
    netSTCG = 0;
    const usedOnLtcg = Math.min(stclLeft, netLTCG);
    netLTCG -= usedOnLtcg;
    stclLeft -= usedOnLtcg;
  }
  // LTCL cannot touch STCG — it only carries forward once LTCG is exhausted.
  const ltclUsed = 0; // already netted inside ltcg if both were signed inputs
  void ltclUsed;

  return {
    netSTCG: parseFloat(netSTCG.toFixed(2)),
    netLTCG: parseFloat(netLTCG.toFixed(2)),
    carryForward: {
      stcl: parseFloat(stclLeft.toFixed(2)),
      ltcl: parseFloat(ltclLeft.toFixed(2))
    }
  };
};

export const computeEquityTax = (
  netSTCG: number,
  netLTCG: number,
  ltcgExemptionUsed = 0,
  rules: EquityTaxRules = EQUITY_TAX_RULES
): { stcgTax: number; taxableLTCG: number; ltcgTax: number; totalTax: number } => {
  const stcgTax = Math.max(0, netSTCG) * (rules.stcgRatePct / 100);
  const exemptionLeft = Math.max(0, rules.ltcgExemption - ltcgExemptionUsed);
  const taxableLTCG = Math.max(0, netLTCG - exemptionLeft);
  const ltcgTax = taxableLTCG * (rules.ltcgRatePct / 100);
  return {
    stcgTax: parseFloat(stcgTax.toFixed(2)),
    taxableLTCG: parseFloat(taxableLTCG.toFixed(2)),
    ltcgTax: parseFloat(ltcgTax.toFixed(2)),
    totalTax: parseFloat((stcgTax + ltcgTax).toFixed(2))
  };
};

// --- Harvesting ------------------------------------------------------------

export interface HarvestHolding {
  symbol: string;
  assetType: 'STOCK' | 'MF';
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  buyDate: string;
}

export interface LossHarvest {
  symbol: string;
  term: GainTerm;
  quantity: number;
  rate: number;
  amount: number; // sale proceeds
  loss: number; // > 0
  taxSaved: number; // from offsetting current realized gains
  carryForwardLoss: number; // portion with no gain left to offset this FY
  detail: string;
}

export interface GainHarvest {
  symbol: string;
  quantity: number;
  rate: number;
  amount: number;
  gainRealized: number; // <= remaining exemption
  taxSaved: number; // gainRealized x LTCG rate (what stepping up the basis avoids later)
  detail: string;
}

const inr = (n: number): string => `₹${Math.round(n).toLocaleString('en-IN')}`;

const fmtQty = (q: number, assetType: HarvestHolding['assetType']): string =>
  assetType === 'MF' ? q.toFixed(2) : String(q);

/**
 * Loss harvesting against this FY's realized gains. Greedy by biggest loss;
 * remaining gains are consumed across opportunities per the offset rules.
 */
export const findLossHarvests = (
  holdings: HarvestHolding[],
  realized: { stcg: number; ltcg: number },
  asOf: string,
  rules: EquityTaxRules = EQUITY_TAX_RULES
): LossHarvest[] => {
  let stcgLeft = Math.max(0, realized.stcg);
  let ltcgLeft = Math.max(0, realized.ltcg);

  const losers = holdings
    .filter(h => h.currentPrice < h.avgPrice && h.quantity > 0)
    .map(h => ({
      h,
      loss: (h.avgPrice - h.currentPrice) * h.quantity,
      term: classifyHolding(h.buyDate, asOf, rules).term
    }))
    .filter(x => x.loss >= 100) // ignore dust
    .sort((a, b) => b.loss - a.loss);

  const results: LossHarvest[] = [];
  for (const { h, loss, term } of losers) {
    let taxSaved = 0;
    let remainingLoss = loss;

    if (term === 'STCG') {
      const vsStcg = Math.min(remainingLoss, stcgLeft);
      taxSaved += vsStcg * (rules.stcgRatePct / 100);
      stcgLeft -= vsStcg;
      remainingLoss -= vsStcg;
      const vsLtcg = Math.min(remainingLoss, ltcgLeft);
      taxSaved += vsLtcg * (rules.ltcgRatePct / 100);
      ltcgLeft -= vsLtcg;
      remainingLoss -= vsLtcg;
    } else {
      const vsLtcg = Math.min(remainingLoss, ltcgLeft);
      taxSaved += vsLtcg * (rules.ltcgRatePct / 100);
      ltcgLeft -= vsLtcg;
      remainingLoss -= vsLtcg;
    }

    const amount = h.quantity * h.currentPrice;
    results.push({
      symbol: h.symbol,
      term,
      quantity: h.quantity,
      rate: h.currentPrice,
      amount: parseFloat(amount.toFixed(2)),
      loss: parseFloat(loss.toFixed(2)),
      taxSaved: parseFloat(taxSaved.toFixed(2)),
      carryForwardLoss: parseFloat(remainingLoss.toFixed(2)),
      detail:
        `Sell ${fmtQty(h.quantity, h.assetType)} ${h.symbol} @ ${fmtRate(h.currentPrice)} ` +
        `(≈ ${inr(amount)}) to book a ${term} loss of ${inr(loss)}` +
        (taxSaved > 0 ? `, saving ${inr(taxSaved)} against this FY's gains` : '') +
        (remainingLoss > 0 ? `; ${inr(remainingLoss)} carries forward (8 years)` : '') +
        `. Rebuy after a day if you want to keep the position.`
    });
  }
  return results;
};

const fmtRate = (n: number): string =>
  `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Gain harvesting: use the unused Rs 1.25L LTCG exemption. Sells just enough
 * of long-term winners to realize tax-free gains, largest gain-per-unit first.
 */
export const findGainHarvests = (
  holdings: HarvestHolding[],
  ltcgRealizedThisFy: number,
  asOf: string,
  rules: EquityTaxRules = EQUITY_TAX_RULES
): GainHarvest[] => {
  let exemptionLeft = Math.max(0, rules.ltcgExemption - Math.max(0, ltcgRealizedThisFy));
  if (exemptionLeft <= 0) return [];

  const winners = holdings
    .filter(
      h =>
        h.currentPrice > h.avgPrice &&
        h.quantity > 0 &&
        classifyHolding(h.buyDate, asOf, rules).term === 'LTCG'
    )
    .map(h => ({ h, gainPerUnit: h.currentPrice - h.avgPrice }))
    .sort((a, b) => b.gainPerUnit - a.gainPerUnit);

  const results: GainHarvest[] = [];
  for (const { h, gainPerUnit } of winners) {
    if (exemptionLeft < gainPerUnit * (h.assetType === 'MF' ? 0.01 : 1)) continue;
    const rawQty = Math.min(h.quantity, exemptionLeft / gainPerUnit);
    const quantity = h.assetType === 'MF' ? Math.floor(rawQty * 100) / 100 : Math.floor(rawQty);
    if (quantity <= 0) continue;

    const gainRealized = parseFloat((quantity * gainPerUnit).toFixed(2));
    const amount = parseFloat((quantity * h.currentPrice).toFixed(2));
    exemptionLeft -= gainRealized;

    results.push({
      symbol: h.symbol,
      quantity,
      rate: h.currentPrice,
      amount,
      gainRealized,
      taxSaved: parseFloat((gainRealized * (rules.ltcgRatePct / 100)).toFixed(2)),
      detail:
        `Sell ${fmtQty(quantity, h.assetType)} ${h.symbol} @ ${fmtRate(h.currentPrice)} ` +
        `(≈ ${inr(amount)}), realizing ${inr(gainRealized)} LTCG inside the ` +
        `${inr(rules.ltcgExemption)} exemption — ₹0 tax now, stepping up the cost basis ` +
        `saves ~${inr(gainRealized * (rules.ltcgRatePct / 100))} later. Rebuy after a day.`
    });
  }
  return results;
};
