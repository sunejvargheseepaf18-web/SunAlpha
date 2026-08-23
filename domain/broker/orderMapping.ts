
// Broker order payload mapping (pure domain logic) — the OpenAlgo/ccxt idea:
// one internal TradeIntent, translated per broker into the exact payload its
// API expects. Translation is pure and unit-tested; transport lives in the
// adapter services. Field values follow each broker's public API docs
// (Kite Connect v3, Upstox v2, Angel One SmartAPI).

import { TradeIntent } from '../../types';

export interface OrderValidationError {
  field: string;
  message: string;
}

/** Broker-agnostic sanity checks every payload mapping runs first. */
export const validateIntentForBroker = (intent: TradeIntent): OrderValidationError | null => {
  if (!intent.symbol || !intent.symbol.trim()) return { field: 'symbol', message: 'Symbol is required.' };
  if (!Number.isFinite(intent.quantity) || intent.quantity <= 0)
    return { field: 'quantity', message: 'Quantity must be a positive number.' };
  if (intent.type === 'LIMIT' && (!intent.price || intent.price <= 0))
    return { field: 'price', message: 'LIMIT orders need a positive price.' };
  if ((intent.type === 'SL' || intent.type === 'SL-M') && (!intent.triggerPrice || intent.triggerPrice <= 0))
    return { field: 'triggerPrice', message: 'Stop orders need a positive trigger price.' };
  return null;
};

const exchangeFor = (intent: TradeIntent): 'NSE' | 'NFO' => (intent.isDerivative ? 'NFO' : 'NSE');

// --- Zerodha Kite Connect (POST /orders/regular, form-encoded) --------------

export interface KiteOrderPayload {
  exchange: 'NSE' | 'NFO';
  tradingsymbol: string;
  transaction_type: 'BUY' | 'SELL';
  order_type: 'MARKET' | 'LIMIT' | 'SL' | 'SL-M';
  quantity: number;
  product: 'CNC' | 'MIS' | 'NRML';
  validity: 'DAY';
  price?: number;
  trigger_price?: number;
}

export const toKitePayload = (intent: TradeIntent): KiteOrderPayload => {
  const payload: KiteOrderPayload = {
    exchange: exchangeFor(intent),
    tradingsymbol: intent.symbol.toUpperCase(),
    transaction_type: intent.side,
    order_type: intent.type,
    quantity: intent.quantity,
    product: intent.product,
    validity: 'DAY'
  };
  if (intent.type === 'LIMIT' || intent.type === 'SL') payload.price = intent.price;
  if (intent.type === 'SL' || intent.type === 'SL-M') payload.trigger_price = intent.triggerPrice;
  return payload;
};

// --- Upstox v2 (POST /v2/order/place, JSON) ---------------------------------

export interface UpstoxOrderPayload {
  instrument_token: string; // e.g. "NSE_EQ|RELIANCE"
  transaction_type: 'BUY' | 'SELL';
  order_type: 'MARKET' | 'LIMIT' | 'SL' | 'SL-M';
  quantity: number;
  product: 'D' | 'I'; // Delivery / Intraday
  validity: 'DAY';
  price: number;
  trigger_price: number;
  disclosed_quantity: 0;
  is_amo: false;
}

export const toUpstoxPayload = (intent: TradeIntent): UpstoxOrderPayload => ({
  instrument_token: `${intent.isDerivative ? 'NSE_FO' : 'NSE_EQ'}|${intent.symbol.toUpperCase()}`,
  transaction_type: intent.side,
  order_type: intent.type,
  quantity: intent.quantity,
  product: intent.product === 'MIS' ? 'I' : 'D',
  validity: 'DAY',
  price: intent.type === 'LIMIT' || intent.type === 'SL' ? intent.price ?? 0 : 0,
  trigger_price: intent.type === 'SL' || intent.type === 'SL-M' ? intent.triggerPrice ?? 0 : 0,
  disclosed_quantity: 0,
  is_amo: false
});

// --- Angel One SmartAPI (POST /rest/secure/angelbroking/order/v1/placeOrder) -

export interface AngelOrderPayload {
  variety: 'NORMAL' | 'STOPLOSS';
  tradingsymbol: string;
  symboltoken: string; // Angel requires its numeric token — resolved upstream
  transactiontype: 'BUY' | 'SELL';
  exchange: 'NSE' | 'NFO';
  ordertype: 'MARKET' | 'LIMIT' | 'STOPLOSS_LIMIT' | 'STOPLOSS_MARKET';
  producttype: 'DELIVERY' | 'INTRADAY' | 'CARRYFORWARD';
  duration: 'DAY';
  quantity: string; // SmartAPI takes strings
  price: string;
  triggerprice: string;
}

export const toAngelPayload = (intent: TradeIntent, symbolToken: string): AngelOrderPayload => ({
  variety: intent.type === 'SL' || intent.type === 'SL-M' ? 'STOPLOSS' : 'NORMAL',
  tradingsymbol: intent.symbol.toUpperCase(),
  symboltoken: symbolToken,
  transactiontype: intent.side,
  exchange: exchangeFor(intent),
  ordertype:
    intent.type === 'SL' ? 'STOPLOSS_LIMIT' : intent.type === 'SL-M' ? 'STOPLOSS_MARKET' : intent.type,
  producttype:
    intent.product === 'MIS' ? 'INTRADAY' : intent.product === 'NRML' ? 'CARRYFORWARD' : 'DELIVERY',
  duration: 'DAY',
  quantity: String(intent.quantity),
  price: intent.type === 'LIMIT' || intent.type === 'SL' ? String(intent.price ?? 0) : '0',
  triggerprice: intent.type === 'SL' || intent.type === 'SL-M' ? String(intent.triggerPrice ?? 0) : '0'
});
