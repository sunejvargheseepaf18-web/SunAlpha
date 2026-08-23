
// Alert service — persistent alerts evaluated against LIVE quotes, with
// browser push delivery (Notification API) plus an in-app subscriber
// channel. Evaluation semantics live in the pure alert engine; this file
// only stores, polls and delivers.

import { PriceAlert } from '../types';
import { evaluateAlerts, TriggeredAlert } from '../domain/alerts/alert.engine';
import { getLiveQuotes } from './marketFeed';

const STORAGE_KEY = 'sunalpha.alerts';
const POLL_INTERVAL_MS = 60 * 1000;

// --- Storage ---------------------------------------------------------------

const load = (): PriceAlert[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PriceAlert[]) : [];
  } catch {
    return [];
  }
};

const save = (alerts: PriceAlert[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
  } catch {
    // storage unavailable — alerts stay in-memory for the session
  }
};

let ALERTS: PriceAlert[] = load();

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const getAlerts = async (symbol?: string): Promise<PriceAlert[]> => {
  await delay(50);
  return symbol ? ALERTS.filter(a => a.symbol === symbol) : [...ALERTS];
};

export const createAlert = async (
  symbol: string,
  targetPrice: number,
  condition: PriceAlert['condition'],
  options: { pctThreshold?: number; triggerOnce?: boolean; cooldownMinutes?: number } = {}
): Promise<PriceAlert> => {
  const newAlert: PriceAlert = {
    id: Date.now().toString(),
    symbol,
    targetPrice,
    condition,
    createdAt: new Date().toISOString(),
    ...options
  };
  ALERTS = [newAlert, ...ALERTS];
  save(ALERTS);
  return newAlert;
};

export const deleteAlert = async (id: string): Promise<void> => {
  ALERTS = ALERTS.filter(a => a.id !== id);
  save(ALERTS);
};

// --- Delivery channels -----------------------------------------------------

type AlertListener = (event: TriggeredAlert) => void;
const listeners = new Set<AlertListener>();

/** Subscribe in-app UI to alert firings. Returns an unsubscribe function. */
export const onAlertTriggered = (listener: AlertListener): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Ask for browser notification permission (no-op where unsupported). */
export const requestNotificationPermission = async (): Promise<boolean> => {
  try {
    if (typeof Notification === 'undefined') return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    return (await Notification.requestPermission()) === 'granted';
  } catch {
    return false;
  }
};

const deliver = (event: TriggeredAlert): void => {
  // Channel 1: browser push
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(`SunAlpha · ${event.alert.symbol}`, {
        body: event.message,
        tag: event.alert.id // replaces rather than stacks repeats
      });
    }
  } catch {
    // notification failure never breaks evaluation
  }
  // Channel 2: in-app subscribers
  listeners.forEach(l => {
    try {
      l(event);
    } catch {
      // one bad listener shouldn't stop the rest
    }
  });
};

// --- Evaluation loop -------------------------------------------------------

// Previous prices per symbol, for cross detection between polls.
const prevPrices = new Map<string, number>();

/** Evaluate all alerts against live quotes once. Returns what fired. */
export const checkAlertsNow = async (): Promise<TriggeredAlert[]> => {
  if (ALERTS.length === 0) return [];
  const symbols = [...new Set(ALERTS.map(a => a.symbol))];
  const quotes = await getLiveQuotes(symbols);
  if (quotes.size === 0) return []; // feed unreachable — try next poll

  const snapshots: Record<string, { price: number; prevPrice?: number; changePercent?: number }> = {};
  for (const [symbol, quote] of quotes) {
    snapshots[symbol] = {
      price: quote.price,
      prevPrice: prevPrices.get(symbol),
      changePercent: quote.changePercent
    };
    prevPrices.set(symbol, quote.price);
  }

  const { triggered, nextAlerts } = evaluateAlerts(ALERTS, snapshots, new Date().toISOString());
  ALERTS = nextAlerts;
  save(ALERTS);
  triggered.forEach(deliver);
  return triggered;
};

let monitorHandle: ReturnType<typeof setInterval> | null = null;

/** Start the polling monitor (idempotent). Returns a stop function. */
export const startAlertMonitor = (intervalMs: number = POLL_INTERVAL_MS): (() => void) => {
  if (!monitorHandle) {
    void checkAlertsNow(); // immediate first pass
    monitorHandle = setInterval(() => void checkAlertsNow(), intervalMs);
  }
  return () => {
    if (monitorHandle) {
      clearInterval(monitorHandle);
      monitorHandle = null;
    }
  };
};
