
// Webhook automation engine (pure domain logic).
//
// The delivery semantics open TradingView-webhook bots converge on
// (fabston/TradingView-Webhook-Bot, Ark0N/webhook-tradingview-bot,
// ndywicki/tradingview-webhooks-bot):
// - PAYLOAD TEMPLATES with {{placeholder}} substitution, TradingView-style:
//   known placeholders are replaced, unknown ones are left visible so a
//   typo shows up in the destination instead of vanishing silently.
// - RETRY WITH EXPONENTIAL BACKOFF on transient failures only — network
//   errors, 408/429 and 5xx retry; other 4xx are permanent (a bad URL or
//   rejected payload never fixes itself by retrying).
// - DELIVERY LOG so every attempt is auditable.
// This module decides WHAT to send and WHETHER/WHEN to retry; the service
// layer does the actual fetch/storage.

export interface WebhookDestination {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  /** Optional payload template; DEFAULT_PAYLOAD_TEMPLATE when absent. */
  template?: string;
  /** Optional shared-secret sent as X-Webhook-Token (frostybot-style key). */
  secretToken?: string;
}

export interface AlertWebhookContext {
  symbol: string;
  price: number;
  condition: string;
  target: number | '';
  message: string;
  time: string; // ISO
}

/** TradingView-style default payload. */
export const DEFAULT_PAYLOAD_TEMPLATE =
  '{"source":"sunalpha","symbol":"{{symbol}}","price":{{price}},"condition":"{{condition}}","target":"{{target}}","message":"{{message}}","time":"{{time}}"}';

const escapeJsonString = (value: string): string =>
  value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');

/**
 * Replace {{key}} placeholders from the context. String values are
 * JSON-escaped so a message containing quotes cannot break the payload.
 * Unknown placeholders stay in place (visible, debuggable).
 */
export const renderTemplate = (
  template: string,
  context: Record<string, string | number>
): string =>
  template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (whole, key: string) => {
    if (!(key in context)) return whole;
    const value = context[key];
    return typeof value === 'number' ? String(value) : escapeJsonString(value);
  });

export const buildAlertPayload = (
  context: AlertWebhookContext,
  template: string = DEFAULT_PAYLOAD_TEMPLATE
): string =>
  renderTemplate(template, {
    symbol: context.symbol,
    price: context.price,
    condition: context.condition,
    target: context.target === '' ? '' : context.target,
    message: context.message,
    time: context.time
  });

/**
 * Only https URLs (or http on localhost for development) are deliverable,
 * and credentials embedded in the URL are rejected outright.
 */
export const validateWebhookUrl = (url: string): { ok: boolean; reason?: string } => {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reason: 'Not a valid URL.' };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, reason: 'Credentials in the URL are not allowed.' };
  }
  const isLocalhost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  if (parsed.protocol === 'https:') return { ok: true };
  if (parsed.protocol === 'http:' && isLocalhost) return { ok: true };
  return { ok: false, reason: 'Only https URLs (or http on localhost) are allowed.' };
};

// --- Retry policy -------------------------------------------------------------

export const MAX_DELIVERY_ATTEMPTS = 4;

/**
 * Retry only what can succeed on retry: network failures (null status),
 * timeouts (408), rate limits (429) and server errors (5xx) — while
 * attempts remain. Every other status is a permanent verdict.
 */
export const shouldRetry = (
  httpStatus: number | null,
  attempt: number,
  maxAttempts: number = MAX_DELIVERY_ATTEMPTS
): boolean => {
  if (attempt >= maxAttempts) return false;
  if (httpStatus === null) return true; // network error / no response
  if (httpStatus === 408 || httpStatus === 429) return true;
  return httpStatus >= 500 && httpStatus <= 599;
};

/** Exponential backoff: base x 2^(attempt-1), capped. attempt is 1-based. */
export const computeBackoffMs = (
  attempt: number,
  baseMs = 2000,
  capMs = 60000
): number => Math.min(capMs, baseMs * Math.pow(2, Math.max(0, attempt - 1)));

export type DeliveryStatus = 'DELIVERED' | 'FAILED';

export interface DeliveryRecord {
  id: string;
  destinationId: string;
  destinationName: string;
  symbol: string;
  status: DeliveryStatus;
  attempts: number;
  httpStatus: number | null; // last response status; null = network error
  at: string; // ISO of the final attempt
}

/** Is an HTTP status a success for webhook purposes? */
export const isDeliverySuccess = (httpStatus: number | null): boolean =>
  httpStatus !== null && httpStatus >= 200 && httpStatus < 300;
