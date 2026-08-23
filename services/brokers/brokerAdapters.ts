
// Broker adapters — the OpenAlgo/ccxt architecture: one interface, many
// brokers. PAPER wraps the virtual engine; SIM reproduces the old demo
// behavior; KITE and UPSTOX are real REST implementations that activate
// when credentials are stored (configureBrokerCredentials) and route
// through dev proxies (/kite-api, /upstox-api) since neither API sends
// browser CORS headers. Order payloads come from the pure domain mapper.
// AGENT_RULES: no decision logic here — validation happened upstream.

import { BrokerCapabilities, BrokerProfile, TradeIntent, TradeOrder } from '../../types';
import {
  toKitePayload,
  toUpstoxPayload,
  validateIntentForBroker
} from '../../domain/broker/orderMapping';
import { executeVirtualTrade } from '../paper/virtualExecutionEngine';
import { getPaperCash, getPaperOrders } from '../paper/paperStore';

export interface BrokerAdapter {
  id: string;
  name: string;
  isConfigured(): boolean;
  getProfile(): Promise<BrokerProfile>;
  placeOrder(intent: TradeIntent): Promise<TradeOrder>;
  getOrders(): Promise<TradeOrder[]>;
}

const FULL_CAPS: BrokerCapabilities = {
  equity: true,
  derivatives: true,
  commodity: false,
  marginFunding: false,
  bracketOrders: true
};

const guard = (intent: TradeIntent): void => {
  const error = validateIntentForBroker(intent);
  if (error) throw new Error(`Order rejected (${error.field}): ${error.message}`);
};

// --- Credentials (localStorage) ---------------------------------------------

export interface BrokerCredentials {
  kite?: { apiKey: string; accessToken: string };
  upstox?: { accessToken: string };
}

const CRED_KEY = 'sunalpha.broker.credentials';

export const loadBrokerCredentials = (): BrokerCredentials => {
  try {
    const raw = localStorage.getItem(CRED_KEY);
    return raw ? (JSON.parse(raw) as BrokerCredentials) : {};
  } catch {
    return {};
  }
};

export const configureBrokerCredentials = (credentials: BrokerCredentials): void => {
  try {
    localStorage.setItem(CRED_KEY, JSON.stringify({ ...loadBrokerCredentials(), ...credentials }));
  } catch {
    // storage unavailable — session-only config not supported
  }
};

// --- PAPER: fully working virtual broker -------------------------------------

export const paperAdapter: BrokerAdapter = {
  id: 'sunalpha-paper',
  name: 'Paper Trading',
  isConfigured: () => true,
  getProfile: async () => ({
    id: 'sunalpha-paper',
    name: 'Paper Trading',
    logo: '',
    connected: true,
    funds: getPaperCash(),
    capabilities: { ...FULL_CAPS, marginFunding: true }
  }),
  placeOrder: async intent => {
    guard(intent);
    return executeVirtualTrade(intent);
  },
  getOrders: async () => getPaperOrders()
};

// --- SIM: the demo 'live' broker (previous mock behavior) --------------------

let simFunds = 150000;
let simConnected = false;
const simOrders: TradeOrder[] = [];

export const simAdapter: BrokerAdapter & { connect(): void } = {
  id: 'sim',
  name: 'Demo Broker (Simulated)',
  isConfigured: () => true,
  connect: () => {
    simConnected = true;
  },
  getProfile: async () => ({
    id: 'sim',
    name: 'Demo Broker (Simulated)',
    logo: '',
    connected: simConnected,
    funds: simFunds,
    capabilities: { ...FULL_CAPS, commodity: true }
  }),
  placeOrder: async intent => {
    guard(intent);
    const value = intent.quantity * (intent.price || 0);
    const margin = intent.isDerivative || intent.product === 'MIS' ? value * 0.2 : value;
    if (intent.side === 'BUY' && simFunds < margin) {
      throw new Error(`Insufficient funds. Req: ₹${margin.toFixed(2)}, Avail: ₹${simFunds.toFixed(2)}`);
    }
    simFunds += intent.side === 'BUY' ? -margin : value;
    const order: TradeOrder = {
      id: `SIM-${Date.now()}`,
      symbol: intent.symbol,
      side: intent.side,
      product: intent.product,
      type: intent.type,
      quantity: intent.quantity,
      price: intent.price || 0,
      status: 'EXECUTED',
      timestamp: new Date().toISOString()
    };
    simOrders.unshift(order);
    return order;
  },
  getOrders: async () => [...simOrders]
};

// --- KITE: Zerodha Kite Connect v3 -------------------------------------------

const KITE_BASE = '/kite-api';

export const kiteAdapter: BrokerAdapter = {
  id: 'kite',
  name: 'Zerodha (Kite Connect)',
  isConfigured: () => Boolean(loadBrokerCredentials().kite?.accessToken),
  getProfile: async () => {
    const creds = loadBrokerCredentials().kite!;
    const res = await fetch(`${KITE_BASE}/user/margins/equity`, {
      headers: { Authorization: `token ${creds.apiKey}:${creds.accessToken}`, 'X-Kite-Version': '3' }
    });
    if (!res.ok) throw new Error(`Kite profile failed (${res.status}) — token expired?`);
    const data = await res.json();
    return {
      id: 'kite',
      name: 'Zerodha',
      logo: '',
      connected: true,
      funds: data?.data?.available?.live_balance ?? 0,
      capabilities: { ...FULL_CAPS, commodity: true }
    };
  },
  placeOrder: async intent => {
    guard(intent);
    const creds = loadBrokerCredentials().kite!;
    const payload = toKitePayload(intent);
    const body = new URLSearchParams(
      Object.entries(payload).map(([k, v]) => [k, String(v)]) as [string, string][]
    );
    const res = await fetch(`${KITE_BASE}/orders/regular`, {
      method: 'POST',
      headers: {
        Authorization: `token ${creds.apiKey}:${creds.accessToken}`,
        'X-Kite-Version': '3',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.message ?? `Kite order failed (${res.status})`);
    return {
      id: data?.data?.order_id ?? `KITE-${Date.now()}`,
      symbol: intent.symbol,
      side: intent.side,
      product: intent.product,
      type: intent.type,
      quantity: intent.quantity,
      price: intent.price || 0,
      status: 'PENDING', // real orders are async — status comes from the order book
      timestamp: new Date().toISOString()
    };
  },
  getOrders: async () => {
    const creds = loadBrokerCredentials().kite!;
    const res = await fetch(`${KITE_BASE}/orders`, {
      headers: { Authorization: `token ${creds.apiKey}:${creds.accessToken}`, 'X-Kite-Version': '3' }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.data ?? []).map((o: any) => ({
      id: o.order_id,
      symbol: o.tradingsymbol,
      side: o.transaction_type,
      product: o.product,
      type: o.order_type,
      quantity: o.quantity,
      price: o.average_price || o.price || 0,
      status: o.status === 'COMPLETE' ? 'EXECUTED' : o.status === 'REJECTED' ? 'REJECTED' : 'PENDING',
      timestamp: o.order_timestamp ?? new Date().toISOString()
    }));
  }
};

// --- UPSTOX: Upstox API v2 ---------------------------------------------------

const UPSTOX_BASE = '/upstox-api';

export const upstoxAdapter: BrokerAdapter = {
  id: 'upstox',
  name: 'Upstox',
  isConfigured: () => Boolean(loadBrokerCredentials().upstox?.accessToken),
  getProfile: async () => {
    const creds = loadBrokerCredentials().upstox!;
    const res = await fetch(`${UPSTOX_BASE}/v2/user/get-funds-and-margin?segment=SEC`, {
      headers: { Authorization: `Bearer ${creds.accessToken}`, Accept: 'application/json' }
    });
    if (!res.ok) throw new Error(`Upstox profile failed (${res.status}) — token expired?`);
    const data = await res.json();
    return {
      id: 'upstox',
      name: 'Upstox',
      logo: '',
      connected: true,
      funds: data?.data?.equity?.available_margin ?? 0,
      capabilities: FULL_CAPS
    };
  },
  placeOrder: async intent => {
    guard(intent);
    const creds = loadBrokerCredentials().upstox!;
    const res = await fetch(`${UPSTOX_BASE}/v2/order/place`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creds.accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(toUpstoxPayload(intent))
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.errors?.[0]?.message ?? `Upstox order failed (${res.status})`);
    return {
      id: data?.data?.order_id ?? `UPSTOX-${Date.now()}`,
      symbol: intent.symbol,
      side: intent.side,
      product: intent.product,
      type: intent.type,
      quantity: intent.quantity,
      price: intent.price || 0,
      status: 'PENDING',
      timestamp: new Date().toISOString()
    };
  },
  getOrders: async () => []
};

// --- Registry ----------------------------------------------------------------

const REAL_ADAPTERS = [kiteAdapter, upstoxAdapter];

/** LIVE resolution: first configured real broker, else the simulated demo. */
export const getLiveAdapter = (): BrokerAdapter =>
  REAL_ADAPTERS.find(a => a.isConfigured()) ?? simAdapter;
