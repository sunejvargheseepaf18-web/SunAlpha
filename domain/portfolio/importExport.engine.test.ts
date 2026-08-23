
import { describe, it, expect } from 'vitest';
import {
  parseCsv,
  toCsv,
  parseAmount,
  parseDate,
  inferAssetType,
  parseHoldingsCsv,
  holdingsToCsv,
  toGhostfolioExport,
  ImportedHolding
} from './importExport.engine';

describe('parseCsv', () => {
  it('handles quoted fields, escaped quotes and CRLF', () => {
    const rows = parseCsv('a,"b,c","say ""hi"""\r\n1,2,3\n');
    expect(rows).toEqual([
      ['a', 'b,c', 'say "hi"'],
      ['1', '2', '3']
    ]);
  });

  it('skips blank lines', () => {
    expect(parseCsv('a,b\n\n1,2\n\n')).toEqual([['a', 'b'], ['1', '2']]);
  });
});

describe('parseAmount / parseDate', () => {
  it('strips rupee signs, commas and spaces', () => {
    expect(parseAmount('₹1,310.10')).toBe(1310.1);
    expect(parseAmount(' 46 ')).toBe(46);
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('')).toBeNull();
  });

  it('normalizes dd-MM-yyyy and dd/MM/yyyy to ISO', () => {
    expect(parseDate('2024-10-15')).toBe('2024-10-15');
    expect(parseDate('15-10-2024')).toBe('2024-10-15');
    expect(parseDate('5/3/2025')).toBe('2025-03-05');
    expect(parseDate('not a date')).toBeUndefined();
    expect(parseDate('45-13-2024')).toBeUndefined();
  });
});

describe('inferAssetType', () => {
  it('classifies MFs by name hints, crypto by symbol, stocks otherwise', () => {
    expect(inferAssetType('QUANT-ELSS', 'Quant ELSS Tax Saver Direct Growth')).toBe('MF');
    expect(inferAssetType('BTC', 'Bitcoin')).toBe('CRYPTO');
    expect(inferAssetType('RELIANCE', 'Reliance Industries')).toBe('STOCK');
  });
});

describe('parseHoldingsCsv', () => {
  it('parses the canonical export format (round-trip)', () => {
    const holdings: ImportedHolding[] = [
      { symbol: 'RELIANCE', name: 'Reliance Industries', assetType: 'STOCK', qty: 46, avg: 1310.1, buyDate: '2024-10-15' },
      { symbol: 'QUANT-ELSS', name: 'Quant ELSS Tax Saver, Direct', assetType: 'MF', qty: 164.83, avg: 407.69 }
    ];
    const result = parseHoldingsCsv(holdingsToCsv(holdings));
    expect(result.errors).toEqual([]);
    expect(result.holdings).toEqual(holdings);
  });

  it('understands Zerodha-style broker headers', () => {
    const csv = [
      'Instrument,Qty.,Avg. cost,LTP,Cur. val,P&L',
      'RELIANCE,46,"1,310.10",1318.39,60645.94,381.34',
      'M&M,125,"3,420.32",3400.00,425000.00,-2540.00'
    ].join('\n');
    const result = parseHoldingsCsv(csv);
    expect(result.errors).toEqual([]);
    expect(result.holdings).toHaveLength(2);
    expect(result.holdings[0]).toMatchObject({ symbol: 'RELIANCE', qty: 46, avg: 1310.1, assetType: 'STOCK' });
    expect(result.holdings[1].symbol).toBe('M&M');
  });

  it('rejects bad rows individually with reasons, keeps good ones', () => {
    const csv = [
      'Symbol,Quantity,Avg Price',
      'RELIANCE,46,1310.10',
      ',10,100',
      'BADQTY,zero,100',
      'BADAVG,10,-5',
      'RELIANCE,1,1' // duplicate
    ].join('\n');
    const result = parseHoldingsCsv(csv);
    expect(result.holdings).toHaveLength(1);
    expect(result.errors).toHaveLength(4);
    expect(result.errors[0]).toContain('empty symbol');
    expect(result.errors[1]).toContain('not a positive number');
    expect(result.errors[2]).toContain('not a positive number');
    expect(result.errors[3]).toContain('duplicate');
  });

  it('reports missing required columns by name', () => {
    const result = parseHoldingsCsv('Name,Price\nX,1');
    expect(result.holdings).toEqual([]);
    expect(result.errors[0]).toContain('symbol/instrument');
    expect(result.errors[0]).toContain('quantity');
  });

  it('respects an explicit asset type column over inference', () => {
    const csv = 'Symbol,Qty,Avg,Type\nGOLDFUND,5,100,EQUITY';
    const result = parseHoldingsCsv(csv);
    expect(result.holdings[0].assetType).toBe('STOCK'); // explicit EQUITY wins over FUND hint
  });

  it('an empty file is an error, not a silent empty portfolio', () => {
    expect(parseHoldingsCsv('').errors.length).toBeGreaterThan(0);
    expect(parseHoldingsCsv('Symbol,Qty,Avg').errors.length).toBeGreaterThan(0);
  });
});

describe('exports', () => {
  it('CSV export escapes commas and quotes', () => {
    const csv = toCsv(['a', 'b'], [['x,y', 'he said "hi"']]);
    expect(csv).toBe('a,b\n"x,y","he said ""hi"""');
  });

  it('Ghostfolio export emits BUY activities with INR/Yahoo and fallback date', () => {
    const json = JSON.parse(
      toGhostfolioExport(
        [{ symbol: 'RELIANCE', name: 'R', assetType: 'STOCK', qty: 46, avg: 1310.1 }],
        '2026-08-23'
      )
    );
    expect(json.activities).toHaveLength(1);
    expect(json.activities[0]).toEqual({
      currency: 'INR',
      dataSource: 'YAHOO',
      date: '2026-08-23',
      fee: 0,
      quantity: 46,
      symbol: 'RELIANCE',
      type: 'BUY',
      unitPrice: 1310.1
    });
  });
});
