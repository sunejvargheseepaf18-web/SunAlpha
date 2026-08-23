
import { describe, it, expect } from 'vitest';
import {
  renderTemplate,
  buildAlertPayload,
  validateWebhookUrl,
  shouldRetry,
  computeBackoffMs,
  isDeliverySuccess,
  DEFAULT_PAYLOAD_TEMPLATE
} from './webhook.engine';

describe('renderTemplate', () => {
  it('substitutes known placeholders, numbers unquoted', () => {
    const out = renderTemplate('{"s":"{{symbol}}","p":{{price}}}', {
      symbol: 'RELIANCE',
      price: 1310.1
    });
    expect(out).toBe('{"s":"RELIANCE","p":1310.1}');
    expect(JSON.parse(out)).toEqual({ s: 'RELIANCE', p: 1310.1 });
  });

  it('leaves unknown placeholders visible instead of vanishing them', () => {
    expect(renderTemplate('x={{typo}}', { symbol: 'A' })).toBe('x={{typo}}');
  });

  it('JSON-escapes string values so quotes cannot break the payload', () => {
    const out = renderTemplate('{"m":"{{message}}"}', { message: 'hit "target"\nnow' });
    expect(JSON.parse(out)).toEqual({ m: 'hit "target"\nnow' });
  });

  it('tolerates whitespace inside braces', () => {
    expect(renderTemplate('{{ symbol }}', { symbol: 'M&M' })).toBe('M&M');
  });
});

describe('buildAlertPayload', () => {
  it('the default template renders to valid JSON with all alert fields', () => {
    const payload = buildAlertPayload({
      symbol: 'RELIANCE',
      price: 1310.1,
      condition: 'CROSS_ABOVE',
      target: 1300,
      message: 'RELIANCE crossed above ₹1,300',
      time: '2026-08-23T10:00:00.000Z'
    });
    const parsed = JSON.parse(payload);
    expect(parsed.source).toBe('sunalpha');
    expect(parsed.symbol).toBe('RELIANCE');
    expect(parsed.price).toBe(1310.1);
    expect(parsed.condition).toBe('CROSS_ABOVE');
    expect(parsed.time).toContain('2026-08-23');
  });

  it('a custom template overrides the default', () => {
    const payload = buildAlertPayload(
      { symbol: 'BTC', price: 1, condition: 'ABOVE', target: '', message: 'm', time: 't' },
      '{"content":"{{symbol}} alert: {{message}}"}'
    );
    expect(JSON.parse(payload)).toEqual({ content: 'BTC alert: m' });
  });

  it('default template survives a PCT_MOVE alert with no target', () => {
    const payload = buildAlertPayload({
      symbol: 'M&M',
      price: 3420,
      condition: 'PCT_MOVE',
      target: '',
      message: 'moved 3%',
      time: 't'
    });
    expect(JSON.parse(payload).target).toBe('');
  });
});

describe('validateWebhookUrl', () => {
  it('accepts https and http on localhost only', () => {
    expect(validateWebhookUrl('https://discord.com/api/webhooks/1/abc').ok).toBe(true);
    expect(validateWebhookUrl('http://localhost:9000/hook').ok).toBe(true);
    expect(validateWebhookUrl('http://127.0.0.1/hook').ok).toBe(true);
    expect(validateWebhookUrl('http://example.com/hook').ok).toBe(false);
  });

  it('rejects garbage and embedded credentials', () => {
    expect(validateWebhookUrl('not a url').ok).toBe(false);
    expect(validateWebhookUrl('https://user:pass@example.com/hook').ok).toBe(false);
  });
});

describe('shouldRetry / computeBackoffMs', () => {
  it('retries network errors, 408, 429 and 5xx', () => {
    expect(shouldRetry(null, 1)).toBe(true);
    expect(shouldRetry(408, 1)).toBe(true);
    expect(shouldRetry(429, 1)).toBe(true);
    expect(shouldRetry(500, 1)).toBe(true);
    expect(shouldRetry(503, 2)).toBe(true);
  });

  it('never retries permanent 4xx or success codes', () => {
    expect(shouldRetry(400, 1)).toBe(false);
    expect(shouldRetry(401, 1)).toBe(false);
    expect(shouldRetry(404, 1)).toBe(false);
    expect(shouldRetry(200, 1)).toBe(false);
  });

  it('stops at the attempt cap', () => {
    expect(shouldRetry(500, 4)).toBe(false);
    expect(shouldRetry(null, 4)).toBe(false);
    expect(shouldRetry(500, 3, 4)).toBe(true);
  });

  it('backoff doubles per attempt and caps', () => {
    expect(computeBackoffMs(1)).toBe(2000);
    expect(computeBackoffMs(2)).toBe(4000);
    expect(computeBackoffMs(3)).toBe(8000);
    expect(computeBackoffMs(10)).toBe(60000); // cap
  });
});

describe('isDeliverySuccess', () => {
  it('2xx is success, everything else is not', () => {
    expect(isDeliverySuccess(200)).toBe(true);
    expect(isDeliverySuccess(204)).toBe(true);
    expect(isDeliverySuccess(301)).toBe(false);
    expect(isDeliverySuccess(500)).toBe(false);
    expect(isDeliverySuccess(null)).toBe(false);
  });
});

describe('DEFAULT_PAYLOAD_TEMPLATE', () => {
  it('is itself renderable to valid JSON with a full context', () => {
    const out = renderTemplate(DEFAULT_PAYLOAD_TEMPLATE, {
      symbol: 's', price: 1, condition: 'c', target: 2, message: 'm', time: 't'
    });
    expect(() => JSON.parse(out)).not.toThrow();
  });
});
