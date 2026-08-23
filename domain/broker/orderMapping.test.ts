
import { describe, it, expect } from 'vitest';
import {
  validateIntentForBroker,
  toKitePayload,
  toUpstoxPayload,
  toAngelPayload
} from './orderMapping';
import { TradeIntent } from '../../types';

const intent = (over: Partial<TradeIntent>): TradeIntent => ({
  symbol: 'RELIANCE',
  side: 'BUY',
  product: 'CNC',
  type: 'MARKET',
  quantity: 10,
  isDerivative: false,
  ...over
});

describe('validateIntentForBroker', () => {
  it('accepts a sane market order', () => {
    expect(validateIntentForBroker(intent({}))).toBeNull();
  });

  it('rejects non-positive quantity, priceless LIMIT and triggerless SL', () => {
    expect(validateIntentForBroker(intent({ quantity: 0 }))!.field).toBe('quantity');
    expect(validateIntentForBroker(intent({ type: 'LIMIT' }))!.field).toBe('price');
    expect(validateIntentForBroker(intent({ type: 'SL-M' }))!.field).toBe('triggerPrice');
    expect(validateIntentForBroker(intent({ symbol: ' ' }))!.field).toBe('symbol');
  });
});

describe('toKitePayload', () => {
  it('maps a delivery market buy to Kite fields', () => {
    const p = toKitePayload(intent({}));
    expect(p).toMatchObject({
      exchange: 'NSE',
      tradingsymbol: 'RELIANCE',
      transaction_type: 'BUY',
      order_type: 'MARKET',
      quantity: 10,
      product: 'CNC',
      validity: 'DAY'
    });
    expect(p.price).toBeUndefined(); // market orders carry no price
  });

  it('includes price for LIMIT and trigger for SL, and NFO for derivatives', () => {
    const sl = toKitePayload(intent({ type: 'SL', price: 100, triggerPrice: 99, isDerivative: true, product: 'NRML' }));
    expect(sl.exchange).toBe('NFO');
    expect(sl.price).toBe(100);
    expect(sl.trigger_price).toBe(99);
    expect(sl.product).toBe('NRML');
  });
});

describe('toUpstoxPayload', () => {
  it('maps to instrument_token segments and D/I products', () => {
    const p = toUpstoxPayload(intent({ product: 'MIS' }));
    expect(p.instrument_token).toBe('NSE_EQ|RELIANCE');
    expect(p.product).toBe('I');
    expect(p.price).toBe(0); // market order
    expect(p.is_amo).toBe(false);
  });

  it('carries limit price and stop trigger', () => {
    const p = toUpstoxPayload(intent({ type: 'SL', price: 105, triggerPrice: 104 }));
    expect(p.price).toBe(105);
    expect(p.trigger_price).toBe(104);
  });
});

describe('toAngelPayload', () => {
  it('maps products, stop varieties and stringly-typed numbers', () => {
    const p = toAngelPayload(intent({ type: 'SL-M', triggerPrice: 98, product: 'MIS' }), '2885');
    expect(p.variety).toBe('STOPLOSS');
    expect(p.ordertype).toBe('STOPLOSS_MARKET');
    expect(p.producttype).toBe('INTRADAY');
    expect(p.symboltoken).toBe('2885');
    expect(p.quantity).toBe('10');
    expect(p.triggerprice).toBe('98');
  });
});
