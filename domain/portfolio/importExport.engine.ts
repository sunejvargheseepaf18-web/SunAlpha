
// Portfolio import/export engine (pure domain logic).
//
// The Ghostfolio-ecosystem lesson (ghostfolio/ghostfolio, dickwolff/
// Export-To-Ghostfolio, which maintains converters for 26 brokers): broker
// CSVs never share one schema, so a robust importer maps HEADER SYNONYMS
// (Zerodha's "Instrument"/"Qty."/"Avg. cost" and friends) onto a canonical
// shape, validates row by row, and reports every rejected row with its
// reason instead of failing the whole file.
//
// Exports: canonical CSV (round-trips through this parser) and a
// Ghostfolio activities JSON so holdings can move to other open trackers.

export interface ImportedHolding {
  symbol: string;
  name: string;
  assetType: 'STOCK' | 'MF' | 'CRYPTO';
  qty: number;
  avg: number;
  buyDate?: string; // yyyy-MM-dd
}

export interface ImportResult {
  holdings: ImportedHolding[];
  errors: string[]; // one line per rejected row, with the reason
}

// --- CSV primitives -----------------------------------------------------------

/** RFC-4180-ish parser: quoted fields, escaped quotes, CR/LF endings. */
export const parseCsv = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some(f => f.trim() !== '')) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.some(f => f.trim() !== '')) rows.push(row);
  return rows;
};

const csvEscape = (value: string | number): string => {
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const toCsv = (headers: string[], rows: Array<Array<string | number>>): string =>
  [headers.map(csvEscape).join(','), ...rows.map(r => r.map(csvEscape).join(','))].join('\n');

// --- Header mapping -----------------------------------------------------------

const normalizeHeader = (h: string): string =>
  h.toLowerCase().replace(/[._\-]/g, ' ').replace(/\s+/g, ' ').trim();

const HEADER_SYNONYMS: Record<string, string[]> = {
  symbol: ['symbol', 'instrument', 'tradingsymbol', 'trading symbol', 'ticker', 'scheme code'],
  name: ['name', 'scheme name', 'company', 'company name', 'description', 'fund name'],
  qty: ['qty', 'quantity', 'units', 'shares', 'balance units'],
  avg: [
    'avg', 'avg cost', 'avg price', 'average price', 'average cost', 'buy price',
    'purchase price', 'buy avg', 'avg nav', 'purchase nav', 'cost price'
  ],
  assetType: ['asset type', 'type', 'asset', 'category', 'instrument type'],
  buyDate: ['buy date', 'purchase date', 'date', 'acquired', 'acquisition date', 'buy day']
};

const findColumn = (headers: string[], field: keyof typeof HEADER_SYNONYMS): number => {
  const synonyms = HEADER_SYNONYMS[field];
  return headers.findIndex(h => synonyms.includes(normalizeHeader(h)));
};

// --- Value parsing ------------------------------------------------------------

/** "1,310.10", "₹1310.1", " 46 " → number; null when not a number. */
export const parseAmount = (raw: string): number | null => {
  const cleaned = raw.replace(/[₹,\s]/g, '');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return isFinite(n) ? n : null;
};

/** yyyy-MM-dd or dd-MM-yyyy / dd/MM/yyyy → yyyy-MM-dd; undefined otherwise. */
export const parseDate = (raw: string): string | undefined => {
  const t = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const dmy = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const dd = d.padStart(2, '0');
    const mm = m.padStart(2, '0');
    if (Number(mm) >= 1 && Number(mm) <= 12 && Number(dd) >= 1 && Number(dd) <= 31) {
      return `${y}-${mm}-${dd}`;
    }
  }
  return undefined;
};

const MF_HINTS = /\b(FUND|ELSS|FLEXI|MULTI ?CAP|SMALL ?CAP|MID ?CAP|LARGE ?CAP|CONTRA|SAVER|GROWTH|DIRECT|REGULAR|NAV|LIQUID|DEBT|HYBRID)\b/i;
const CRYPTO_HINTS = /^(BTC|ETH|SOL|XRP|ADA|DOGE|MATIC|BNB)$|\b(BITCOIN|ETHEREUM|CRYPTO|COIN)\b/i;

/** Infer the asset class when the file doesn't carry one. */
export const inferAssetType = (symbol: string, name: string): ImportedHolding['assetType'] => {
  if (CRYPTO_HINTS.test(symbol.trim()) || CRYPTO_HINTS.test(name)) return 'CRYPTO';
  if (MF_HINTS.test(name) || MF_HINTS.test(symbol)) return 'MF';
  return 'STOCK';
};

const coerceAssetType = (raw: string | undefined, symbol: string, name: string): ImportedHolding['assetType'] => {
  const t = raw?.trim().toUpperCase();
  if (t === 'STOCK' || t === 'EQUITY' || t === 'EQ') return 'STOCK';
  if (t === 'MF' || t === 'MUTUAL FUND' || t === 'FUND') return 'MF';
  if (t === 'CRYPTO' || t === 'CRYPTOCURRENCY') return 'CRYPTO';
  return inferAssetType(symbol, name);
};

// --- Import -------------------------------------------------------------------

/**
 * Parse a holdings CSV (canonical or broker-style headers). Bad rows are
 * skipped and reported; a file with no usable header or no valid rows
 * returns holdings: [] with the reason in errors.
 */
export const parseHoldingsCsv = (text: string): ImportResult => {
  const rows = parseCsv(text);
  if (rows.length < 2) {
    return { holdings: [], errors: ['File needs a header row and at least one data row.'] };
  }

  const headers = rows[0];
  const col = {
    symbol: findColumn(headers, 'symbol'),
    name: findColumn(headers, 'name'),
    qty: findColumn(headers, 'qty'),
    avg: findColumn(headers, 'avg'),
    assetType: findColumn(headers, 'assetType'),
    buyDate: findColumn(headers, 'buyDate')
  };
  if (col.symbol === -1 || col.qty === -1 || col.avg === -1) {
    const missing = [
      col.symbol === -1 ? 'symbol/instrument' : null,
      col.qty === -1 ? 'quantity/qty/units' : null,
      col.avg === -1 ? 'avg cost/buy price' : null
    ].filter(Boolean);
    return { holdings: [], errors: [`Missing required column(s): ${missing.join(', ')}.`] };
  }

  const holdings: ImportedHolding[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const line = i + 1;
    const symbol = (row[col.symbol] ?? '').trim().toUpperCase();
    if (!symbol) {
      errors.push(`Row ${line}: empty symbol — skipped.`);
      continue;
    }
    const qty = parseAmount(row[col.qty] ?? '');
    const avg = parseAmount(row[col.avg] ?? '');
    if (qty === null || qty <= 0) {
      errors.push(`Row ${line} (${symbol}): quantity "${row[col.qty]}" is not a positive number — skipped.`);
      continue;
    }
    if (avg === null || avg <= 0) {
      errors.push(`Row ${line} (${symbol}): avg price "${row[col.avg]}" is not a positive number — skipped.`);
      continue;
    }
    if (seen.has(symbol)) {
      errors.push(`Row ${line} (${symbol}): duplicate symbol — first row kept, this one skipped.`);
      continue;
    }
    seen.add(symbol);

    const name = col.name !== -1 ? (row[col.name] ?? '').trim() || symbol : symbol;
    holdings.push({
      symbol,
      name,
      assetType: coerceAssetType(col.assetType !== -1 ? row[col.assetType] : undefined, symbol, name),
      qty,
      avg,
      buyDate: col.buyDate !== -1 ? parseDate(row[col.buyDate] ?? '') : undefined
    });
  }

  if (holdings.length === 0 && errors.length === 0) {
    errors.push('No data rows found.');
  }
  return { holdings, errors };
};

// --- Export -------------------------------------------------------------------

export const HOLDINGS_CSV_HEADERS = ['Symbol', 'Name', 'Asset Type', 'Quantity', 'Avg Price', 'Buy Date'];

/** Canonical CSV — round-trips through parseHoldingsCsv. */
export const holdingsToCsv = (holdings: ImportedHolding[]): string =>
  toCsv(
    HOLDINGS_CSV_HEADERS,
    holdings.map(h => [h.symbol, h.name, h.assetType, h.qty, h.avg, h.buyDate ?? ''])
  );

/**
 * Ghostfolio activities JSON: each holding becomes one BUY activity at its
 * average price, so the snapshot imports into Ghostfolio (INR, Yahoo data
 * source) and other tools that speak its format.
 */
export const toGhostfolioExport = (holdings: ImportedHolding[], fallbackDate: string): string =>
  JSON.stringify(
    {
      meta: { source: 'sunalpha' },
      activities: holdings.map(h => ({
        currency: 'INR',
        dataSource: 'YAHOO',
        date: h.buyDate ?? fallbackDate,
        fee: 0,
        quantity: h.qty,
        symbol: h.symbol,
        type: 'BUY',
        unitPrice: h.avg
      }))
    },
    null,
    2
  );
