
// Broker gateway — routes through the adapter registry (OpenAlgo pattern):
// PAPER -> virtual engine, LIVE -> first configured real broker (Kite,
// Upstox) or the simulated demo broker. The public API is unchanged so the
// existing UI keeps working; real brokers activate the moment credentials
// are stored via configureBrokerCredentials.

import { BrokerProfile, TradeOrder, TradeIntent, ExecutionMode } from '../types';
import {
  getLiveAdapter,
  paperAdapter,
  simAdapter,
  configureBrokerCredentials,
  loadBrokerCredentials
} from './brokers/brokerAdapters';

export { configureBrokerCredentials, loadBrokerCredentials };

const adapterFor = (mode: ExecutionMode) => (mode === 'PAPER' ? paperAdapter : getLiveAdapter());

export const connectBroker = async (_brokerId: string): Promise<BrokerProfile> => {
  const adapter = getLiveAdapter();
  if (adapter.id === 'sim') simAdapter.connect(); // demo login
  return adapter.getProfile();
};

export const getBrokerProfile = async (mode: ExecutionMode = 'LIVE'): Promise<BrokerProfile> => {
  try {
    return await adapterFor(mode).getProfile();
  } catch {
    // Real broker configured but unreachable/expired — fall back to demo
    // so the app renders; the profile shows the simulated broker honestly.
    return simAdapter.getProfile();
  }
};

// Validates if the broker can actually execute this trade (pre-flight UX
// check; the adapter and the risk engine both re-validate on execution).
export const validateTradeIntent = (intent: TradeIntent, broker: BrokerProfile): string | null => {
  if (!broker.connected) return 'Broker not connected.';
  if (intent.isDerivative && !broker.capabilities.derivatives)
    return 'Derivatives trading is not enabled on this broker.';

  const estimatedValue = intent.quantity * (intent.price || 0);
  const marginReq =
    intent.isDerivative || intent.product === 'MIS' ? estimatedValue * 0.2 : estimatedValue;

  if (intent.side === 'BUY' && broker.funds < marginReq) {
    return `Insufficient funds. Req: ₹${marginReq.toFixed(2)}, Avail: ₹${broker.funds.toFixed(2)}`;
  }
  return null;
};

export const executeTradeIntent = async (
  intent: TradeIntent,
  mode: ExecutionMode = 'LIVE'
): Promise<TradeOrder> => adapterFor(mode).placeOrder(intent);

export const getOrders = async (mode: ExecutionMode = 'LIVE'): Promise<TradeOrder[]> =>
  adapterFor(mode).getOrders();
