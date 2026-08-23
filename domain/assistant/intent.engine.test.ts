
import { describe, it, expect } from 'vitest';
import { parseIntent, extractSymbol } from './intent.engine';

const KNOWN = ['RELIANCE', 'M&M', 'NIFTY 50', 'NIFTY', 'BTC', 'QUANT-ELSS'];

describe('extractSymbol', () => {
  it('finds known symbols case-insensitively with punctuation noise', () => {
    expect(extractSymbol('price of reliance?', KNOWN)).toBe('RELIANCE');
    expect(extractSymbol('how is m&m doing', KNOWN)).toBe('M&M');
    expect(extractSymbol('btc.', KNOWN)).toBe('BTC');
  });

  it('prefers the longest match: NIFTY 50 beats NIFTY', () => {
    expect(extractSymbol('quote for nifty 50 today', KNOWN)).toBe('NIFTY 50');
    expect(extractSymbol('nifty please', KNOWN)).toBe('NIFTY');
  });

  it('returns undefined when nothing known is mentioned', () => {
    expect(extractSymbol('what is the meaning of life', KNOWN)).toBeUndefined();
  });
});

describe('parseIntent', () => {
  it('routes portfolio, advice, scans, alerts, tax, regime, help', () => {
    expect(parseIntent('show my portfolio', KNOWN).kind).toBe('PORTFOLIO');
    expect(parseIntent('what should I do with my holdings', KNOWN).kind).toBe('ADVICE');
    expect(parseIntent('any breakouts today?', KNOWN).kind).toBe('SCANS');
    expect(parseIntent('list my alerts', KNOWN).kind).toBe('ALERTS');
    expect(parseIntent('can I harvest losses for tax', KNOWN).kind).toBe('TAX');
    expect(parseIntent('how is the market today', KNOWN).kind).toBe('REGIME');
    expect(parseIntent('help', KNOWN).kind).toBe('HELP');
  });

  it('quote intent carries the extracted symbol', () => {
    const intent = parseIntent('what is the price of reliance', KNOWN);
    expect(intent.kind).toBe('QUOTE');
    expect(intent.symbol).toBe('RELIANCE');
  });

  it('a bare known symbol reads as a quote request', () => {
    expect(parseIntent('reliance', KNOWN)).toEqual({ kind: 'QUOTE', symbol: 'RELIANCE' });
    expect(parseIntent('m&m?', KNOWN)).toEqual({ kind: 'QUOTE', symbol: 'M&M' });
  });

  it('advice about one symbol keeps the symbol', () => {
    const intent = parseIntent('should I sell m&m', KNOWN);
    expect(intent.kind).toBe('ADVICE');
    expect(intent.symbol).toBe('M&M');
  });

  it('specific rules outrank generic word overlap', () => {
    // 'tax' outranks 'portfolio' mention
    expect(parseIntent('tax impact on my portfolio', KNOWN).kind).toBe('TAX');
    // 'alerts' outranks the quote-y word 'price'
    expect(parseIntent('alerts on price levels', KNOWN).kind).toBe('ALERTS');
  });

  it('free text falls through to the AI lane; empty text asks for help', () => {
    expect(parseIntent('write me a haiku about compounding', KNOWN).kind).toBe('ASK_AI');
    expect(parseIntent('   ', KNOWN).kind).toBe('HELP');
  });

  it('is deterministic: same text, same intent', () => {
    const a = parseIntent('should I sell m&m', KNOWN);
    const b = parseIntent('should I sell m&m', KNOWN);
    expect(a).toEqual(b);
  });
});
