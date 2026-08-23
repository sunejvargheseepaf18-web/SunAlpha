
// Band-triggered & cash-flow rebalancing (pure domain logic).
//
// Two ideas the open rebalancing tools converge on:
// 1. The Bogleheads 5/25 rule: act only when a class drifts more than 5
//    percentage points absolute OR 25% of its own target (the relative band
//    catches small allocations: gold at 6.5% vs a 5% target is only +1.5pp
//    but 30% over — triggered). Everything inside the bands is noise.
// 2. Cash-flow rebalancing: direct NEW money at underweight classes —
//    largest deficit first, then proportional to targets — so the portfolio
//    converges on target without selling anything or realizing any tax.

export interface AllocationClass {
  key: string; // e.g. 'equity', 'debt', 'gold', 'cash'
  currentValue: number;
  targetPct: number; // 0-100
}

export interface BandOptions {
  absBandPp?: number; // default 5 percentage points
  relBandPct?: number; // default 25% of the target
}

export interface BandRow {
  key: string;
  currentPct: number;
  targetPct: number;
  driftPp: number; // current - target, percentage points
  relDriftPct: number; // drift as % of target (0 when target is 0)
  absTriggered: boolean;
  relTriggered: boolean;
  triggered: boolean;
}

export interface BandEvaluation {
  rows: BandRow[];
  shouldRebalance: boolean;
}

export const evaluateBands = (
  classes: AllocationClass[],
  options: BandOptions = {}
): BandEvaluation => {
  const absBand = options.absBandPp ?? 5;
  const relBand = options.relBandPct ?? 25;
  const total = classes.reduce((s, c) => s + c.currentValue, 0);

  const rows: BandRow[] = classes.map(c => {
    const currentPct = total > 0 ? (c.currentValue / total) * 100 : 0;
    const driftPp = currentPct - c.targetPct;
    const relDriftPct = c.targetPct > 0 ? (driftPp / c.targetPct) * 100 : 0;
    const absTriggered = Math.abs(driftPp) >= absBand;
    const relTriggered = c.targetPct > 0 && Math.abs(relDriftPct) >= relBand;
    return {
      key: c.key,
      currentPct: parseFloat(currentPct.toFixed(2)),
      targetPct: c.targetPct,
      driftPp: parseFloat(driftPp.toFixed(2)),
      relDriftPct: parseFloat(relDriftPct.toFixed(1)),
      absTriggered,
      relTriggered,
      triggered: absTriggered || relTriggered
    };
  });

  return { rows, shouldRebalance: rows.some(r => r.triggered) };
};

export interface ContributionAllocation {
  key: string;
  amount: number; // new money directed at this class, >= 0 (never a sell)
  beforePct: number;
  afterPct: number;
  targetPct: number;
}

export interface ContributionPlan {
  contribution: number;
  allocations: ContributionAllocation[];
  // Mean absolute drift (pp) before and after — proof the plan helps
  driftBeforePp: number;
  driftAfterPp: number;
}

export const cashFlowRebalance = (
  classes: AllocationClass[],
  contribution: number
): ContributionPlan | null => {
  if (contribution <= 0 || classes.length === 0) return null;
  const totalBefore = classes.reduce((s, c) => s + c.currentValue, 0);
  const totalAfter = totalBefore + contribution;

  // Deficits vs target measured on the POST-contribution total: buying to
  // these targets is exactly what makes the final weights land on target.
  const deficits = classes.map(c => ({
    key: c.key,
    deficit: Math.max(0, (c.targetPct / 100) * totalAfter - c.currentValue)
  }));
  const totalDeficit = deficits.reduce((s, d) => s + d.deficit, 0);

  const amounts = new Map<string, number>();
  let remaining = contribution;

  if (totalDeficit <= contribution) {
    // Enough cash to fully close every gap: fill them, spread the surplus
    // by target weight so nothing is diluted.
    for (const d of deficits) amounts.set(d.key, d.deficit);
    remaining = contribution - totalDeficit;
    const targetSum = classes.reduce((s, c) => s + c.targetPct, 0) || 1;
    for (const c of classes) {
      amounts.set(c.key, (amounts.get(c.key) ?? 0) + remaining * (c.targetPct / targetSum));
    }
  } else {
    // Not enough to close all gaps: waterfall — worst deficit first.
    const ordered = [...deficits].sort((a, b) => b.deficit - a.deficit);
    for (const d of ordered) {
      const give = Math.min(remaining, d.deficit);
      amounts.set(d.key, give);
      remaining -= give;
      if (remaining <= 0) break;
    }
  }

  const meanAbsDrift = (values: Map<string, number> | null): number => {
    const drifts = classes.map(c => {
      const value = c.currentValue + (values?.get(c.key) ?? 0);
      const total = values ? totalAfter : totalBefore;
      return Math.abs((value / total) * 100 - c.targetPct);
    });
    return parseFloat((drifts.reduce((s, x) => s + x, 0) / classes.length).toFixed(2));
  };

  return {
    contribution,
    allocations: classes.map(c => {
      const amount = parseFloat((amounts.get(c.key) ?? 0).toFixed(2));
      return {
        key: c.key,
        amount,
        beforePct: parseFloat(((c.currentValue / totalBefore) * 100).toFixed(2)),
        afterPct: parseFloat((((c.currentValue + amount) / totalAfter) * 100).toFixed(2)),
        targetPct: c.targetPct
      };
    }),
    driftBeforePp: meanAbsDrift(null),
    driftAfterPp: meanAbsDrift(amounts)
  };
};
