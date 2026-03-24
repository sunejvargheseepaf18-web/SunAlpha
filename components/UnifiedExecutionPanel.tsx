
import React, { useState, useEffect } from 'react';
import { BrokerProfile, ExecutionPanelMode, BasketItem, OrderSide, OrderProduct, OrderType, ExecutionPreview, LifecycleStage, CoachMessage } from '../types';
import { calculateAllocationPreview } from '../services/executionEngine';
import { executeTradeIntent } from '../services/brokerService'; 
import { getContextualNudge } from '../services/aiCoach';
import { Zap, ShoppingBag, Plus, Trash2, TrendingUp, AlertCircle, Lock, RefreshCw, CheckCircle, FlaskConical } from 'lucide-react';
import { CoachNudge } from './CoachNudge';

interface UnifiedExecutionPanelProps {
  initialSymbol?: string;
  initialPrice?: number;
  broker: BrokerProfile;
  strategyContext?: string; 
  onExecute?: () => void;
}

export const UnifiedExecutionPanel: React.FC<UnifiedExecutionPanelProps> = ({ 
    initialSymbol = 'RELIANCE', 
    initialPrice = 2500, 
    broker,
    strategyContext,
    onExecute
}) => {
  // --- CORE STATE ---
  const [mode, setMode] = useState<ExecutionPanelMode>('ORDER');
  const [side, setSide] = useState<OrderSide>('BUY');
  
  // Mode A: Order Based
  const [qty, setQty] = useState(1);
  const [orderType, setOrderType] = useState<OrderType>('LIMIT');
  const [limitPrice, setLimitPrice] = useState(initialPrice);
  const [product, setProduct] = useState<OrderProduct>('CNC');

  // Mode B: Rate Based
  const [targetPrice, setTargetPrice] = useState(initialPrice);

  // Mode C: Amount Based
  const [amount, setAmount] = useState(100000);
  const [basket, setBasket] = useState<BasketItem[]>([
      { id: '1', symbol: initialSymbol, price: initialPrice, type: 'STOCK', weight: 100 }
  ]);
  const [preview, setPreview] = useState<ExecutionPreview | null>(null);

  // --- DERIVED STATE ---
  const [loading, setLoading] = useState(false);
  const [isAddingAsset, setIsAddingAsset] = useState(false); 
  const [nudge, setNudge] = useState<CoachMessage | null>(null);

  const isPaper = broker.id === 'sunalpha-paper';

  // --- EFFECT: AI NUDGE TRIGGER ---
  useEffect(() => {
      // Trigger nudge when critical params change in Paper Mode
      const checkNudge = async () => {
          if (isPaper && side === 'BUY') {
              const msg = await getContextualNudge(
                  'TRADE_ENTRY', 
                  LifecycleStage.LEARNER, 
                  { mode: 'PAPER', intent: side }
              );
              setNudge(msg);
          } else {
              setNudge(null);
          }
      };
      // Debounce logic ideally, but simple here
      const timeout = setTimeout(checkNudge, 1000);
      return () => clearTimeout(timeout);
  }, [side, isPaper]);

  // Refresh Preview
  useEffect(() => {
      if (mode === 'AMOUNT') {
          const p = calculateAllocationPreview(amount, side, basket);
          setPreview(p);
      }
  }, [amount, basket, side, mode]);

  // --- HANDLERS ---

  const handleExecute = async () => {
      setLoading(true);
      
      try {
          const execMode = isPaper ? 'PAPER' : 'LIVE';
          await executeTradeIntent({
              symbol: initialSymbol,
              side,
              product,
              type: orderType,
              quantity: qty,
              price: limitPrice,
              isDerivative: false 
          }, execMode);

          if (onExecute) onExecute();
          alert(isPaper ? "Virtual Order Executed!" : "Live Order Placed Successfully");
      } catch (e: any) {
          alert(`Execution Failed: ${e.message}`);
      } finally {
          setLoading(false);
      }
  };

  const addAssetToBasket = (symbol: string, price: number) => {
      const newCount = basket.length + 1;
      const newWeight = Math.floor(100 / newCount);
      const updatedBasket = basket.map(b => ({ ...b, weight: newWeight }));
      updatedBasket.push({ 
          id: Date.now().toString(), 
          symbol, 
          price, 
          type: 'STOCK', 
          weight: 100 - (newWeight * basket.length)
      });
      setBasket(updatedBasket);
      setIsAddingAsset(false);
  };

  const removeAsset = (id: string) => {
      if (basket.length === 1) return;
      const updated = basket.filter(b => b.id !== id);
      const factor = 100 / updated.reduce((sum, b) => sum + b.weight, 0);
      setBasket(updated.map(b => ({ ...b, weight: Math.round(b.weight * factor) })));
  };

  const updateWeight = (id: string, newWeight: number) => {
      setBasket(basket.map(b => b.id === id ? { ...b, weight: newWeight } : b));
  };

  return (
    <div className={`bg-white rounded-xl shadow-sm border overflow-hidden flex flex-col h-full ${isPaper ? 'border-amber-300 ring-4 ring-amber-50' : 'border-gray-200'}`}>
      {/* 1. TOP STRATEGY BANNER */}
      {strategyContext && (
          <div className="bg-indigo-50 border-b border-indigo-100 p-3 flex items-center justify-between">
              <div className="flex items-center text-xs font-bold text-indigo-700">
                  <TrendingUp size={14} className="mr-2" />
                  Context: {strategyContext}
              </div>
              <span className="text-[10px] bg-white text-indigo-500 px-2 py-0.5 rounded border border-indigo-100 uppercase font-bold">Smart Execution</span>
          </div>
      )}

      {/* 2. MODE SWITCHER */}
      <div className="flex border-b border-gray-100 bg-gray-50/50">
          <button 
            onClick={() => setMode('ORDER')}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wide transition-all ${mode === 'ORDER' ? 'bg-white text-gray-800 border-b-2 border-emerald-500' : 'text-gray-400 hover:text-gray-600'}`}
          >
              Order Mode
          </button>
          <button 
            onClick={() => setMode('RATE')}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wide transition-all ${mode === 'RATE' ? 'bg-white text-gray-800 border-b-2 border-emerald-500' : 'text-gray-400 hover:text-gray-600'}`}
          >
              Rate Limit
          </button>
          <button 
            onClick={() => setMode('AMOUNT')}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wide transition-all ${mode === 'AMOUNT' ? 'bg-white text-gray-800 border-b-2 border-emerald-500' : 'text-gray-400 hover:text-gray-600'}`}
          >
              Basket / Amt
          </button>
      </div>

      <div className="p-4 flex-1 flex flex-col overflow-y-auto">
         
         {/* 3. SIDE TOGGLE */}
         <div className="flex rounded-lg bg-gray-100 p-1 mb-5">
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

         {/* AI COACH NUDGE (Behavioral Guardrail) */}
         {nudge && (
             <div className="mb-4">
                 <CoachNudge message={nudge} onDismiss={() => setNudge(null)} />
             </div>
         )}

         {/* 4. MODE SPECIFIC INPUTS */}
         {mode === 'ORDER' && (
             <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                 <div>
                    <label className="text-xs font-bold text-gray-500 uppercase">Quantity</label>
                    <input 
                        type="number" 
                        value={qty}
                        onChange={(e) => setQty(Number(e.target.value))}
                        className="w-full mt-1 p-3 border border-gray-200 rounded-xl font-mono text-lg font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">Type</label>
                        <select 
                            value={orderType}
                            onChange={(e) => setOrderType(e.target.value as OrderType)}
                            className="w-full mt-1 p-3 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                        >
                            <option value="LIMIT">Limit</option>
                            <option value="MARKET">Market</option>
                        </select>
                     </div>
                     <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">Product</label>
                        <select 
                            value={product}
                            onChange={(e) => setProduct(e.target.value as OrderProduct)}
                            className="w-full mt-1 p-3 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                        >
                            <option value="CNC">Delivery</option>
                            <option value="MIS">Intraday</option>
                        </select>
                     </div>
                 </div>
                 {orderType === 'LIMIT' && (
                     <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">Limit Price</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₹</span>
                            <input 
                                type="number" 
                                value={limitPrice}
                                onChange={(e) => setLimitPrice(Number(e.target.value))}
                                className="w-full mt-1 pl-8 p-3 border border-gray-200 rounded-xl font-mono text-lg font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                            />
                        </div>
                     </div>
                 )}
                 <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex justify-between items-center text-sm mt-4">
                     <span className="text-gray-500">Margin Required</span>
                     <span className="font-bold text-gray-800">₹{(limitPrice * qty).toLocaleString()}</span>
                 </div>
             </div>
         )}

         {/* --- MODE B: RATE BASED --- */}
         {mode === 'RATE' && (
             <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                 <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-800 leading-relaxed mb-4">
                     <strong className="block mb-1">Smart Entry Mode</strong>
                     System will place a Limit Order. If price is not reached today, do you want to carry forward?
                 </div>

                 <div>
                    <label className="text-xs font-bold text-gray-500 uppercase">Target Price</label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₹</span>
                        <input 
                            type="number" 
                            value={targetPrice}
                            onChange={(e) => setTargetPrice(Number(e.target.value))}
                            className="w-full mt-1 pl-8 p-3 border border-gray-200 rounded-xl font-mono text-lg font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                    </div>
                 </div>

                 <div>
                    <label className="text-xs font-bold text-gray-500 uppercase">Quantity</label>
                    <input 
                        type="number" 
                        value={qty}
                        onChange={(e) => setQty(Number(e.target.value))}
                        className="w-full mt-1 p-3 border border-gray-200 rounded-xl font-mono text-lg font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                 </div>
                 
                 <div className="flex items-center space-x-2 mt-2">
                     <input type="checkbox" id="gtt" className="rounded text-emerald-600 focus:ring-emerald-500" />
                     <label htmlFor="gtt" className="text-xs text-gray-600">Keep order active for 365 days (GTT)</label>
                 </div>
             </div>
         )}

         {/* --- MODE C: AMOUNT / BASKET BASED --- */}
         {mode === 'AMOUNT' && (
             <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200 flex-1 flex flex-col min-h-0">
                 
                 {/* 1. Amount Input */}
                 <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Total Deployment</label>
                    <div className="relative mt-1">
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xl">₹</span>
                        <input 
                            type="number" 
                            value={amount}
                            onChange={(e) => setAmount(Number(e.target.value))}
                            className="w-full pl-6 bg-transparent border-none text-2xl font-bold font-mono text-gray-900 focus:ring-0 outline-none placeholder-gray-300"
                            placeholder="0"
                        />
                    </div>
                 </div>

                 {/* 2. Basket Editor */}
                 <div className="flex-1 overflow-y-auto min-h-[150px]">
                     <div className="flex justify-between items-center mb-2">
                         <span className="text-xs font-bold text-gray-400 uppercase">Allocation Weights</span>
                         <button 
                            onClick={() => setIsAddingAsset(!isAddingAsset)}
                            className="text-[10px] bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded flex items-center"
                         >
                             <Plus size={10} className="mr-1"/> Add Asset
                         </button>
                     </div>

                     {isAddingAsset && (
                         <div className="mb-2 p-2 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                             <p className="text-xs text-gray-400 mb-2">Mock: Add Top Assets</p>
                             <div className="flex gap-2">
                                 <button onClick={() => addAssetToBasket('INFY', 1450)} className="px-2 py-1 bg-white border rounded text-xs">INFY</button>
                                 <button onClick={() => addAssetToBasket('HDFCBANK', 1600)} className="px-2 py-1 bg-white border rounded text-xs">HDFC</button>
                                 <button onClick={() => addAssetToBasket('NIFTYBEES', 230)} className="px-2 py-1 bg-white border rounded text-xs">NIFTY ETF</button>
                             </div>
                         </div>
                     )}
                     
                     <div className="space-y-2">
                         {basket.map((item) => (
                             <div key={item.id} className="flex items-center space-x-2 bg-white border border-gray-100 p-2 rounded-lg shadow-sm">
                                 <div className="flex-1">
                                     <p className="font-bold text-xs text-gray-800">{item.symbol}</p>
                                     <p className="text-[10px] text-gray-400">₹{item.price}</p>
                                 </div>
                                 <div className="flex items-center bg-gray-50 rounded px-2 py-1">
                                     <input 
                                        type="number" 
                                        value={item.weight}
                                        onChange={(e) => updateWeight(item.id, Number(e.target.value))}
                                        className="w-8 bg-transparent text-right text-xs font-bold outline-none"
                                     />
                                     <span className="text-[10px] text-gray-400 ml-0.5">%</span>
                                 </div>
                                 <button onClick={() => removeAsset(item.id)} className="text-gray-300 hover:text-red-500 p-1">
                                     <Trash2 size={12} />
                                 </button>
                             </div>
                         ))}
                     </div>
                 </div>

                 {/* 3. Preview Card */}
                 {preview && (
                     <div className="bg-indigo-50 rounded-xl p-3 border border-indigo-100">
                         <div className="flex justify-between items-center mb-2">
                             <span className="text-[10px] font-bold text-indigo-400 uppercase">Preview</span>
                             <span className="text-[10px] font-bold text-indigo-700">
                                 {preview.items.length} Orders
                             </span>
                         </div>
                         <div className="space-y-1 mb-2">
                             {preview.items.slice(0, 3).map((ord, idx) => (
                                 <div key={idx} className="flex justify-between text-[10px] text-indigo-900">
                                     <span>{ord.quantity}x {ord.symbol}</span>
                                     <span className="font-mono">₹{Math.round(ord.estimatedTotal).toLocaleString()}</span>
                                 </div>
                             ))}
                             {preview.items.length > 3 && <div className="text-[10px] text-indigo-400 text-center italic">...and {preview.items.length - 3} more</div>}
                         </div>
                         <div className="border-t border-indigo-200 pt-1 mt-1 flex justify-between text-xs font-bold text-indigo-800">
                             <span>Total Est.</span>
                             <span>₹{Math.round(preview.totalValue).toLocaleString()}</span>
                         </div>
                     </div>
                 )}
             </div>
         )}
      </div>

      {/* 5. ACTION BUTTON */}
      <div className={`p-4 border-t ${isPaper ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}>
          {!broker.connected ? (
            <div className="p-3 bg-gray-200 rounded-xl text-center text-xs text-gray-500 font-bold flex items-center justify-center">
                <Lock size={14} className="mr-2"/> Broker Not Connected
            </div>
          ) : (
            <button 
                onClick={handleExecute}
                disabled={loading}
                className={`w-full py-4 font-bold rounded-xl shadow-lg flex items-center justify-center transition-all active:scale-95 text-white text-sm ${
                    side === 'BUY' 
                    ? isPaper ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-200' : 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 shadow-emerald-200' 
                    : 'bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 shadow-red-200'
                } disabled:opacity-70`}
            >
                {loading ? <RefreshCw size={18} className="animate-spin mr-2" /> : (
                    mode === 'AMOUNT' ? <ShoppingBag size={18} className="mr-2"/> : <Zap size={18} className="mr-2"/>
                )}
                
                {loading ? 'Processing...' : (
                    mode === 'AMOUNT' 
                    ? `Execute ${isPaper ? 'Paper' : ''} ${side} Basket (₹${(amount/1000).toFixed(0)}k)`
                    : `${isPaper ? 'Paper ' : ''}${side} ${initialSymbol}`
                )}
            </button>
          )}
          
          <div className="mt-3 flex justify-center items-center space-x-4 text-[10px] text-gray-400">
             {isPaper ? (
                 <span className="flex items-center text-amber-600 font-bold"><FlaskConical size={10} className="mr-1"/> VIRTUAL EXECUTION</span>
             ) : (
                 <span className="flex items-center"><Lock size={10} className="mr-1"/> SSL Encrypted</span>
             )}
          </div>
      </div>
    </div>
  );
};
