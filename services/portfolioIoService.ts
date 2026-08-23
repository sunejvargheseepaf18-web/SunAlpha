
// Portfolio import/export service — persistence and file plumbing around
// the pure import/export engine. Imported holdings REPLACE the bundled
// sample data everywhere (portfolio, screener, assistant) until reverted.

import { MOCK_HOLDINGS_DATA } from '../constants';
import {
  ImportedHolding,
  ImportResult,
  parseHoldingsCsv,
  holdingsToCsv,
  toGhostfolioExport
} from '../domain/portfolio/importExport.engine';

export type { ImportedHolding, ImportResult };

const STORAGE_KEY = 'sunalpha.importedHoldings';

let cached: ImportedHolding[] | null | undefined;

const load = (): ImportedHolding[] | null => {
  if (cached !== undefined) return cached;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    cached = raw ? (JSON.parse(raw) as ImportedHolding[]) : null;
  } catch {
    cached = null;
  }
  return cached;
};

/** True when the app is running on user-imported holdings. */
export const hasImportedHoldings = (): boolean => (load()?.length ?? 0) > 0;

export interface HoldingRecord {
  symbol: string;
  name: string;
  assetType: 'STOCK' | 'MF' | 'CRYPTO';
  qty: number;
  avg: number;
  last?: number;
  buyDate: string;
}

/**
 * The holdings the whole app runs on: user-imported when present, the
 * bundled sample book otherwise. A missing buy date defaults to today —
 * the conservative choice for tax terms (everything reads short-term).
 */
export const getActiveHoldingsData = (): HoldingRecord[] => {
  const imported = load();
  if (imported && imported.length > 0) {
    const today = new Date().toISOString().split('T')[0];
    return imported.map(h => ({
      symbol: h.symbol,
      name: h.name,
      assetType: h.assetType,
      qty: h.qty,
      avg: h.avg,
      buyDate: h.buyDate ?? today
    }));
  }
  return MOCK_HOLDINGS_DATA;
};

/** Parse a CSV and, when it yields at least one valid holding, persist it. */
export const importHoldingsCsv = (text: string): ImportResult & { applied: boolean } => {
  const result = parseHoldingsCsv(text);
  const applied = result.holdings.length > 0;
  if (applied) {
    cached = result.holdings;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(result.holdings));
    } catch {
      // storage unavailable — the import still applies for this session
    }
  }
  return { ...result, applied };
};

const persist = (holdings: ImportedHolding[]): void => {
  cached = holdings;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(holdings));
  } catch {
    // storage unavailable — the change still applies for this session
  }
};

// Editable base: the imported set when present, else a copy of whatever the
// app is currently showing (sample book) — so a manual add/remove keeps the
// rest of the visible portfolio instead of wiping it.
const editableBase = (): ImportedHolding[] =>
  (load() ?? getActiveHoldingsData()).map(h => ({
    symbol: h.symbol,
    name: h.name,
    assetType: h.assetType,
    qty: h.qty,
    avg: h.avg,
    buyDate: h.buyDate
  }));

/**
 * Add one holding manually. When the symbol already exists and
 * `mergeAsTrade` is true (default), the entry is treated as an ADDITIONAL
 * BUY: quantities add and the average cost becomes the weighted average —
 * exactly what executing the trade would do. The earlier buy date is kept
 * (conservative for tax terms). With mergeAsTrade false the row is
 * replaced outright.
 */
export const addHolding = (holding: ImportedHolding, mergeAsTrade = true): void => {
  const base = editableBase();
  const idx = base.findIndex(h => h.symbol === holding.symbol);
  if (idx === -1) {
    base.push(holding);
  } else if (mergeAsTrade) {
    const existing = base[idx];
    const qty = parseFloat((existing.qty + holding.qty).toFixed(4));
    const avg = parseFloat(((existing.qty * existing.avg + holding.qty * holding.avg) / qty).toFixed(4));
    base[idx] = { ...existing, qty, avg };
  } else {
    base[idx] = holding;
  }
  persist(base);
};

/** Remove one holding (recoverable via Revert, which restores the sample book). */
export const removeHolding = (symbol: string): void => {
  persist(editableBase().filter(h => h.symbol !== symbol));
};

/** Back to the bundled sample book. */
export const clearImportedHoldings = (): void => {
  cached = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
};

// --- File downloads -----------------------------------------------------------

const download = (filename: string, content: string, mime: string): void => {
  try {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    // download blocked — nothing to clean up
  }
};

const activeAsImported = (): ImportedHolding[] =>
  getActiveHoldingsData().map(h => ({
    symbol: h.symbol,
    name: h.name,
    assetType: h.assetType,
    qty: h.qty,
    avg: h.avg,
    buyDate: h.buyDate
  }));

/** Download the current holdings as canonical CSV (re-importable). */
export const exportHoldingsCsv = (): void => {
  const stamp = new Date().toISOString().split('T')[0];
  download(`sunalpha-holdings-${stamp}.csv`, holdingsToCsv(activeAsImported()), 'text/csv');
};

/** Download the current holdings as Ghostfolio activities JSON. */
export const exportGhostfolioJson = (): void => {
  const stamp = new Date().toISOString().split('T')[0];
  download(
    `sunalpha-ghostfolio-${stamp}.json`,
    toGhostfolioExport(activeAsImported(), stamp),
    'application/json'
  );
};
