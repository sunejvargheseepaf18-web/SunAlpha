
import { describe, it, expect } from 'vitest';
import { toSpeakable } from './voice.engine';

describe('toSpeakable', () => {
  it('speaks rupees after the amount and percents naturally', () => {
    expect(toSpeakable('Portfolio: ₹6,74,080 (up 4.2%)')).toBe(
      'Portfolio: 6,74,080 rupees (up 4.2 percent)'
    );
  });

  it('expands finance shorthand the TTS would mangle', () => {
    const out = toSpeakable('P&L +₹381 · LTP 1318 · OI Δ +45K · PCR 0.92');
    expect(out).toContain('profit and loss');
    expect(out).toContain('last traded price');
    expect(out).toContain('open interest');
    expect(out).toContain('change');
    expect(out).toContain('put call ratio');
    expect(out).not.toContain('·');
  });

  it('strips bullets and turns newlines into sentence pauses', () => {
    const out = toSpeakable('Strongest setups:\n• RELIANCE — BREAKOUT\n• M&M — NR7');
    expect(out).not.toContain('•');
    expect(out).toContain('Strongest setups. RELIANCE');
    expect(out).toContain('M and M');
  });

  it('SELL 90 × ₹3,420.32 reads as a sentence', () => {
    const out = toSpeakable('SELL 90 × ₹3,420.32 = ₹3,07,829');
    expect(out).toContain('90 times 3,420.32 rupees');
    expect(out).toContain('3,07,829 rupees');
  });

  it('truncates long replies at a sentence boundary, never mid-number', () => {
    const long = Array.from({ length: 30 }, (_, i) => `Sentence number ${i} says something useful.`).join(' ');
    const out = toSpeakable(long, 200);
    expect(out.length).toBeLessThanOrEqual(200);
    expect(out.endsWith('.')).toBe(true);
    expect(out).toContain('Sentence number 0');
  });

  it('is deterministic and idempotent-safe on plain text', () => {
    expect(toSpeakable('All quiet today.')).toBe('All quiet today.');
    expect(toSpeakable(toSpeakable('All quiet today.'))).toBe('All quiet today.');
  });
});
