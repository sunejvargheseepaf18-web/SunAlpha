
import { BrokerProfile, TradeOrder, TradeIntent, BrokerCapabilities, ExecutionMode } from '../types';
import { executeVirtualTrade } from './paper/virtualExecutionEngine';
import { getPaperCash, getPaperOrders } from './paper/paperStore';

// Mock Broker Capabilities
const CAPABILITIES_ZERODHA: BrokerCapabilities = {
    equity: true,
    derivatives: true,
    commodity: true,
    marginFunding: false,
    bracketOrders: true
};

// Mock Broker Data
let MOCK_BROKER: BrokerProfile = {
  id: 'zerodha',
  name: 'Zerodha',
  logo: 'https://kite.zerodha.com/static/images/kite-logo.svg', 
  connected: false,
  funds: 150000.00,
  capabilities: CAPABILITIES_ZERODHA
};

let LIVE_ORDERS: TradeOrder[] = [];

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const connectBroker = async (brokerId: string): Promise<BrokerProfile> => {
  await delay(1500); // Simulate login redirect
  MOCK_BROKER.connected = true;
  return { ...MOCK_BROKER };
};

// Gateway: Get Profile based on Mode
export const getBrokerProfile = async (mode: ExecutionMode = 'LIVE'): Promise<BrokerProfile> => {
  await delay(200);
  
  if (mode === 'PAPER') {
      return {
          id: 'sunalpha-paper',
          name: 'Paper Trading',
          logo: '',
          connected: true,
          funds: getPaperCash(),
          capabilities: { ...CAPABILITIES_ZERODHA, marginFunding: true }
      };
  }

  return { ...MOCK_BROKER };
};

// Validates if the broker can actually execute this trade
export const validateTradeIntent = (intent: TradeIntent, broker: BrokerProfile): string | null => {
    if (!broker.connected) return "Broker not connected.";
    if (intent.isDerivative && !broker.capabilities.derivatives) return "Derivatives trading is not enabled on this broker.";
    
    // Estimate margin (Mock)
    const estimatedValue = intent.quantity * (intent.price || 0);
    const marginReq = intent.isDerivative 
        ? estimatedValue * 0.2 
        : intent.product === 'MIS' ? estimatedValue * 0.2 : estimatedValue;

    if (intent.side === 'BUY' && broker.funds < marginReq) {
        return `Insufficient funds. Req: ₹${marginReq.toFixed(2)}, Avail: ₹${broker.funds.toFixed(2)}`;
    }

    return null; // Valid
};

// Gateway: Execute based on Mode
export const executeTradeIntent = async (intent: TradeIntent, mode: ExecutionMode = 'LIVE'): Promise<TradeOrder> => {
  
  // 1. Redirect to Paper Engine if needed
  if (mode === 'PAPER') {
      return await executeVirtualTrade(intent);
  }

  // 2. LIVE Execution Logic
  await delay(800); // Simulate network latency

  const validationError = validateTradeIntent(intent, MOCK_BROKER);
  if (validationError) {
      throw new Error(validationError);
  }

  // Margin Calculation for deduction
  const estimatedValue = intent.quantity * (intent.price || 0);
  const marginReq = intent.isDerivative 
        ? estimatedValue * 0.2 
        : intent.product === 'MIS' ? estimatedValue * 0.2 : estimatedValue;

  const newOrder: TradeOrder = {
    id: `ORD-${Date.now()}`,
    symbol: intent.symbol,
    side: intent.side,
    product: intent.product,
    type: intent.type,
    quantity: intent.quantity,
    price: intent.price || 0,
    status: 'EXECUTED', // Auto-execute for demo
    timestamp: new Date().toISOString()
  };

  LIVE_ORDERS.unshift(newOrder);
  
  // Deduct funds if buy
  if (intent.side === 'BUY') {
    MOCK_BROKER.funds -= marginReq;
  } else {
    MOCK_BROKER.funds += estimatedValue; // Simplified sell credit
  }

  return newOrder;
};

export const getOrders = async (mode: ExecutionMode = 'LIVE'): Promise<TradeOrder[]> => {
  await delay(300);
  if (mode === 'PAPER') {
      return getPaperOrders();
  }
  return [...LIVE_ORDERS];
};
