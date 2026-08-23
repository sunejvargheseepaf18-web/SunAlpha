
// Webhook delivery service — user-defined destinations, alert fan-out,
// retry with backoff, and an auditable delivery log. All decisions
// (templating, retry policy, backoff, success criteria) live in the pure
// webhook engine; this file stores, fetches and waits.

import { TriggeredAlert } from '../domain/alerts/alert.engine';
import {
  WebhookDestination,
  DeliveryRecord,
  buildAlertPayload,
  validateWebhookUrl,
  shouldRetry,
  computeBackoffMs,
  isDeliverySuccess,
  MAX_DELIVERY_ATTEMPTS
} from '../domain/alerts/webhook.engine';

export type { WebhookDestination, DeliveryRecord };
export { validateWebhookUrl, DEFAULT_PAYLOAD_TEMPLATE } from '../domain/alerts/webhook.engine';

const DEST_KEY = 'sunalpha.webhooks';
const LOG_KEY = 'sunalpha.webhookLog';
const LOG_LIMIT = 50;

// --- Storage -----------------------------------------------------------------

const loadJson = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const saveJson = (key: string, value: unknown): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable — state stays in-memory for the session
  }
};

let DESTINATIONS: WebhookDestination[] = loadJson<WebhookDestination[]>(DEST_KEY, []);
let LOG: DeliveryRecord[] = loadJson<DeliveryRecord[]>(LOG_KEY, []);

export const getWebhookDestinations = (): WebhookDestination[] => [...DESTINATIONS];

export const addWebhookDestination = (
  input: Omit<WebhookDestination, 'id' | 'enabled'>
): { destination?: WebhookDestination; error?: string } => {
  const check = validateWebhookUrl(input.url);
  if (!check.ok) return { error: check.reason };
  const destination: WebhookDestination = {
    id: Date.now().toString(),
    enabled: true,
    ...input
  };
  DESTINATIONS = [destination, ...DESTINATIONS];
  saveJson(DEST_KEY, DESTINATIONS);
  return { destination };
};

export const setWebhookEnabled = (id: string, enabled: boolean): void => {
  DESTINATIONS = DESTINATIONS.map(d => (d.id === id ? { ...d, enabled } : d));
  saveJson(DEST_KEY, DESTINATIONS);
};

export const deleteWebhookDestination = (id: string): void => {
  DESTINATIONS = DESTINATIONS.filter(d => d.id !== id);
  saveJson(DEST_KEY, DESTINATIONS);
};

export const getDeliveryLog = (): DeliveryRecord[] => [...LOG];

const recordDelivery = (record: DeliveryRecord): void => {
  LOG = [record, ...LOG].slice(0, LOG_LIMIT);
  saveJson(LOG_KEY, LOG);
};

// --- Delivery ----------------------------------------------------------------

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const postOnce = async (dest: WebhookDestination, payload: string): Promise<number | null> => {
  try {
    const res = await fetch(dest.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(dest.secretToken ? { 'X-Webhook-Token': dest.secretToken } : {})
      },
      body: payload
    });
    return res.status;
  } catch {
    return null; // network error / CORS block — retryable
  }
};

/** POST with the engine's retry policy; returns the delivery record. */
const deliverTo = async (
  dest: WebhookDestination,
  payload: string,
  symbol: string
): Promise<DeliveryRecord> => {
  let attempt = 0;
  let status: number | null = null;
  for (;;) {
    attempt++;
    status = await postOnce(dest, payload);
    if (isDeliverySuccess(status) || !shouldRetry(status, attempt, MAX_DELIVERY_ATTEMPTS)) break;
    await wait(computeBackoffMs(attempt));
  }
  const record: DeliveryRecord = {
    id: `${Date.now()}-${dest.id}`,
    destinationId: dest.id,
    destinationName: dest.name,
    symbol,
    status: isDeliverySuccess(status) ? 'DELIVERED' : 'FAILED',
    attempts: attempt,
    httpStatus: status,
    at: new Date().toISOString()
  };
  recordDelivery(record);
  return record;
};

/** Fan a triggered alert out to every enabled destination. Never throws. */
export const dispatchAlertWebhooks = async (event: TriggeredAlert): Promise<DeliveryRecord[]> => {
  const enabled = DESTINATIONS.filter(d => d.enabled);
  if (enabled.length === 0) return [];
  const context = {
    symbol: event.alert.symbol,
    price: event.price,
    condition: event.alert.condition,
    target: event.alert.targetPrice ?? ('' as const),
    message: event.message,
    time: new Date().toISOString()
  };
  return Promise.all(
    enabled.map(dest => deliverTo(dest, buildAlertPayload(context, dest.template), event.alert.symbol))
  );
};

/** Fire a synthetic test alert at one destination so users can verify wiring. */
export const sendTestWebhook = async (id: string): Promise<DeliveryRecord | null> => {
  const dest = DESTINATIONS.find(d => d.id === id);
  if (!dest) return null;
  const payload = buildAlertPayload(
    {
      symbol: 'TEST',
      price: 100,
      condition: 'ABOVE',
      target: 99,
      message: 'SunAlpha webhook test — wiring OK',
      time: new Date().toISOString()
    },
    dest.template
  );
  return deliverTo(dest, payload, 'TEST');
};
