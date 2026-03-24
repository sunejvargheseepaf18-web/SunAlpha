
import React, { useState, useEffect } from 'react';
import { BrokerProfile, OrderSide, OrderProduct, OrderType, TradeIntent, BrokerCapabilities } from '../types';
import { executeTradeIntent, validateTradeIntent } from '../services/brokerService';
import { Zap, Lock, AlertCircle, RefreshCw, Ban } from 'lucide-react';

interface OrderPanelProps {
  symbol: string; 
  price: number;
  broker: BrokerProfile;
  isDerivative?: boolean;
  onOrderPlaced?: () => void;
}

export const OrderPanel: React.FC<OrderPanelProps> = ({ symbol, price, broker, isDerivative = false, onOrderPlaced }) => {
  const [side, setSide] = useState<OrderSide>('BUY');
  const [product, setProduct] = useState<OrderProduct>(isDerivative ? 'NRML' : 'CNC');
  const [type, setType] = useState<OrderType>('LIMIT');
  const [qty, setQty] = useState(isDerivative ? 50 : 1); 
  const [limitPrice, setLimitPrice] = useState(price);
  const [loading, setLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Broker Capability Gating
  const canTradeDerivatives = broker.connected && broker.capabilities.derivatives;
  const showDerivativesWarning = isDerivative && !canTradeDerivatives;

  useEffect(() => {
    setLimitPrice(price);
    // Reset product if switching modes
    if (isDerivative) {
        setProduct('NRML');
        setQty(50);
    } else {
        setProduct('CNC');
        setQty(1);
    }
  }, [symbol, price, isDerivative]);

  // Real-time validation
  useEffect(() => {
    const intent: TradeIntent = {
        symbol, side, product, type, quantity: qty, price: limitPrice, isDerivative
    };
    // Don't validate funds in real-time to avoid spammy errors, just structural checks
    if (showDerivativesWarning) {
        setValidationError("Broker does not support Derivatives.");
    } else {
        setValidationError(null);
    }
  }, [symbol, side, product, type, qty, limitPrice, isDerivative, broker]);

  const marginReq = isDerivative 
    ? (limitPrice * qty * 0.2) 
    : product === 'MIS' ? (limitPrice * qty * 0.2) : (limitPrice * qty);

  const handleSubmit = async () => {
    if (!broker.connected) return;
    setLoading(true);
    setValidationError(null);

    const intent: TradeIntent = {
        symbol,
        side,
        product,
        type,
        quantity: qty,
        price: limitPrice,
        isDerivative
    };

    try {
      await executeTradeIntent(intent);
      if (onOrderPlaced) onOrderPlaced();
    } catch (e: any) {
      setValidationError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col h-full transition-all">
      {/* Header Info */}
      <div className="mb-4 pb-3 border-b border-gray-100">
         <div className="flex justify-between items-start">
            <div>
               <h3 className="font-bold text-gray-800 text-sm truncate w-48" title={symbol}>{symbol}</h3>
               <p className={`text-[10px] font-medium inline-block px-1 rounded mt-0.5 ${isDerivative ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'}`}>
                 {isDerivative ? 'DERIVATIVES' : 'EQUITY'}
               </p>
            </div>
            <div className="text-right">
                <p className="text-lg font-mono font-bold text-gray-900">₹{price.toFixed(2)}</p>
            </div>
         </div>
      </div>

      {showDerivativesWarning ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-4 bg-gray-50 rounded-xl border border-dashed border-gray-300">
              <Ban className="text-red-400 mb-2" size={24} />
              <p className="text-sm font-bold text-gray-600">Trading Disabled</p>
              <p className="text-xs text-gray-500 mt-1">
                  {broker.name} does not support F&O trading through SunAlpha.
              </p>
          </div>
      ) : (
        <>
            {/* Side Toggle */}
            <div className="flex rounded-lg bg-gray-100 p-1 mb-4">
                <button 
                onClick={() => setSide('BUY')}
                className={`flex-1 py-2 text-xs font-bold rounded-md shadow-sm transition-all ${side === 'BUY' ? 'bg-emerald-600 text-white' : 'text-gray-500 hover:text-gray-900'}`}
                >
                BUY
                </button>
                <button 
                onClick={() => setSide('SELL')}
                className={`flex-1 py-2 text-xs font-bold rounded-md shadow-sm transition-all ${side === 'SELL' ? 'bg-red-600 text-white' : 'text-gray-500 hover:text-gray-900'}`}
                >
                SELL
                </button>
            </div>

            {/* Product & Type */}
            <div className="flex space-x-2 mb-4">
                <div className="flex-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Product</label>
                    <select 
                    value={product} 
                    onChange={(e) => setProduct(e.target.value as OrderProduct)}
                    className="w-full mt-1 p-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium focus:ring-1 focus:ring-blue-500 outline-none"
                    >
                        {isDerivative ? (
                            <>
                                <option value="NRML">NRML (Carry)</option>
                                <option value="MIS">MIS (Intraday)</option>
                            </>
                        ) : (
                            <>
                                <option value="CNC">CNC (Delivery)</option>
                                <option value="MIS">MIS (Intraday)</option>
                            </>
                        )}
                    </select>
                </div>
                <div className="flex-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Order Type</label>
                    <select 
                    value={type} 
                    onChange={(e) => setType(e.target.value as OrderType)}
                    className="w-full mt-1 p-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium focus:ring-1 focus:ring-blue-500 outline-none"
                    >
                        <option value="LIMIT">Limit</option>
                        <option value="MARKET">Market</option>
                        <option value="SL">SL Limit</option>
                    </select>
                </div>
            </div>
            
            {/* Inputs */}
            <div className="space-y-3 mb-6 bg-gray-50/50 p-3 rounded-lg border border-gray-100">
                <div>
                <label className="text-xs text-gray-500 font-semibold flex justify-between">
                    <span>Quantity {isDerivative && '(Lots)'}</span>
                    <span className="text-[10px] text-blue-500 cursor-pointer hover:underline">Max</span>
                </label>
                <input 
                    type="number" 
                    value={qty} 
                    onChange={(e) => setQty(Number(e.target.value))}
                    className="w-full mt-1 p-2 border border-gray-300 rounded-lg text-right font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" 
                />
                </div>
                <div>
                <label className="text-xs text-gray-500 font-semibold">Price</label>
                <input 
                    type="number" 
                    value={limitPrice} 
                    onChange={(e) => setLimitPrice(Number(e.target.value))}
                    disabled={type === 'MARKET'}
                    className="w-full mt-1 p-2 border border-gray-300 rounded-lg text-right font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-gray-100 disabled:text-gray-400" 
                />
                </div>
                
                <div className="pt-2 border-t border-gray-200 mt-2">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Margin Req.</span>
                        <span className="font-bold text-gray-700">₹{marginReq.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                        <span>Available</span>
                        <span className={`font-bold ${broker.funds < marginReq ? 'text-red-500' : 'text-gray-800'}`}>
                            ₹{broker.funds.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </span>
                    </div>
                </div>
            </div>
        </>
      )}

      <div className="mt-auto">
        {validationError && (
             <div className="flex items-start p-2 mb-3 bg-red-50 text-red-600 rounded-lg text-xs border border-red-100">
                <AlertCircle size={14} className="mr-2 mt-0.5 flex-shrink-0" />
                {validationError}
            </div>
        )}

        {!broker.connected ? (
           <div className="p-4 bg-gray-100 rounded-xl text-center border border-dashed border-gray-300">
               <Lock size={20} className="mx-auto text-gray-400 mb-2" />
               <p className="text-xs text-gray-500 font-medium">Connect broker to trade</p>
           </div>
        ) : (
            <button 
                onClick={handleSubmit}
                disabled={loading || showDerivativesWarning || (side === 'BUY' && broker.funds < marginReq)}
                className={`w-full py-3.5 font-bold rounded-xl shadow-lg flex items-center justify-center transition-all active:scale-95 text-white text-sm ${
                    side === 'BUY' 
                    ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 shadow-emerald-200' 
                    : 'bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 shadow-red-200'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
                {loading ? (
                    <>
                        <RefreshCw size={16} className="mr-2 animate-spin" /> Processing
                    </>
                ) : (
                    <>
                        <Zap size={16} className="mr-2 fill-current" /> 
                        {side} {symbol}
                    </>
                )}
            </button>
        )}
        
        <p className="text-[10px] text-gray-400 text-center mt-3 leading-tight">
            Order placement indicates acceptance of <span className="underline cursor-pointer hover:text-gray-600">Terms</span> & Risk Disclosure.
        </p>
      </div>
    </div>
  );
};
