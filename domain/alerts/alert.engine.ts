
// Alert evaluation engine (pure domain logic) — TradingView-style semantics.
//
// Condition types:
// - ABOVE / BELOW: level alerts — true while price is beyond the target.
//   Re-fire is limited by a cooldown so a price sitting at the level doesn't
//   spam a notification every poll.
// - CROSS_ABOVE / CROSS_BELOW: transition alerts — fire only on the tick
//   where price moves through the target (previous price required; without
//   one there is no cross to detect).
// - PCT_MOVE: fires when the day's move exceeds a threshold in either
//   direction.
// `triggerOnce` retires an alert after its first fire (TradingView's
// "Only Once"); otherwise the cooldown governs repeats.

export type AlertCondition = 'ABOVE' | 'BELOW' | 'CROSS_ABOVE' | 'CROSS_BELOW' | 'PCT_MOVE';

export interface EvaluableAlert {
  id: string;
  symbol: string;
  condition: AlertCondition;
  targetPrice?: number; // required for price/cross conditions
  pctThreshold?: number; // required for PCT_MOVE, e.g. 3 for ±3%
  triggerOnce?: boolean;
  cooldownMinutes?: number; // default 60 for repeating alerts
  lastTriggeredAt?: string; // ISO
}

export interface QuoteSnapshot {
  price: number;
  prevPrice?: number; // previous observation (for cross detection)
  changePercent?: number; // day move (for PCT_MOVE)
}

export interface TriggeredAlert<T extends EvaluableAlert = EvaluableAlert> {
  alert: T;
  price: number;
  message: string;
}

export interface AlertEvaluation<T extends EvaluableAlert = EvaluableAlert> {
  triggered: TriggeredAlert<T>[];
  // Full next alert list: fired one-shots removed, cooldown stamps updated.
  nextAlerts: T[];
}

const DEFAULT_COOLDOWN_MIN = 60;

const inCooldown = (alert: EvaluableAlert, nowIso: string): boolean => {
  if (!alert.lastTriggeredAt) return false;
  const minutes = (new Date(nowIso).getTime() - new Date(alert.lastTriggeredAt).getTime()) / 60000;
  return minutes < (alert.cooldownMinutes ?? DEFAULT_COOLDOWN_MIN);
};

const conditionMet = (alert: EvaluableAlert, quote: QuoteSnapshot): boolean => {
  const t = alert.targetPrice;
  switch (alert.condition) {
    case 'ABOVE':
      return t !== undefined && quote.price > t;
    case 'BELOW':
      return t !== undefined && quote.price < t;
    case 'CROSS_ABOVE':
      return t !== undefined && quote.prevPrice !== undefined && quote.prevPrice <= t && quote.price > t;
    case 'CROSS_BELOW':
      return t !== undefined && quote.prevPrice !== undefined && quote.prevPrice >= t && quote.price < t;
    case 'PCT_MOVE':
      return (
        alert.pctThreshold !== undefined &&
        quote.changePercent !== undefined &&
        Math.abs(quote.changePercent) >= alert.pctThreshold
      );
  }
};

const describe = (alert: EvaluableAlert, quote: QuoteSnapshot): string => {
  const price = `₹${quote.price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  const target = alert.targetPrice !== undefined
    ? `₹${alert.targetPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
    : '';
  switch (alert.condition) {
    case 'ABOVE':
      return `${alert.symbol} is trading at ${price}, above your ${target} alert level.`;
    case 'BELOW':
      return `${alert.symbol} is trading at ${price}, below your ${target} alert level.`;
    case 'CROSS_ABOVE':
      return `${alert.symbol} crossed above ${target} — now ${price}.`;
    case 'CROSS_BELOW':
      return `${alert.symbol} crossed below ${target} — now ${price}.`;
    case 'PCT_MOVE':
      return `${alert.symbol} moved ${quote.changePercent! >= 0 ? '+' : ''}${quote.changePercent!.toFixed(1)}% today (alert at ±${alert.pctThreshold}%) — now ${price}.`;
  }
};

export const evaluateAlerts = <T extends EvaluableAlert>(
  alerts: T[],
  quotes: Record<string, QuoteSnapshot>,
  nowIso: string
): AlertEvaluation<T> => {
  const triggered: TriggeredAlert<T>[] = [];
  const nextAlerts: T[] = [];

  for (const alert of alerts) {
    const quote = quotes[alert.symbol];
    if (!quote || quote.price <= 0 || inCooldown(alert, nowIso) || !conditionMet(alert, quote)) {
      nextAlerts.push(alert);
      continue;
    }

    triggered.push({ alert, price: quote.price, message: describe(alert, quote) });
    if (!alert.triggerOnce) {
      nextAlerts.push({ ...alert, lastTriggeredAt: nowIso });
    }
    // triggerOnce alerts are retired (not carried into nextAlerts)
  }

  return { triggered, nextAlerts };
};
