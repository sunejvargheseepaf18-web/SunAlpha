import React, { useEffect, useRef, useState } from 'react';
import { addHolding, ImportedHolding } from '../services/portfolioIoService';
import { searchSchemes, getLatestNav, SchemeSearchHit } from '../services/mfNavService';
import { getLiveQuote } from '../services/marketFeed';
import { X, Search, Loader2, PlusCircle, CheckCircle2 } from 'lucide-react';

// Add a holding manually — a buy trade in all but name (qty @ rate on a
// date; adding to an existing symbol merges as an additional buy at
// weighted-average cost).
//
// The MF path is a REAL scheme dropdown: debounced AMFI search, the user
// picks the exact scheme name — which is what makes the NAV link correct,
// since the stored name round-trips through the same matcher the NAV feed
// uses. Free-typed fund names are how wrong NAVs happen.

interface AddHoldingModalProps {
  onClose: () => void;
  onAdded: () => void;
}

type AssetTab = 'MF' | 'STOCK' | 'CRYPTO';

export const AddHoldingModal: React.FC<AddHoldingModalProps> = ({ onClose, onAdded }) => {
  const [tab, setTab] = useState<AssetTab>('MF');

  // MF scheme picker
  const [schemeQuery, setSchemeQuery] = useState('');
  const [schemeHits, setSchemeHits] = useState<SchemeSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [pickedScheme, setPickedScheme] = useState<SchemeSearchHit | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Stock / crypto symbol
  const [symbol, setSymbol] = useState('');

  // Trade fields
  const [qty, setQty] = useState('');
  const [avg, setAvg] = useState('');
  const [buyDate, setBuyDate] = useState(new Date().toISOString().split('T')[0]);
  const [error, setError] = useState<string | null>(null);
  const [fetchingPrice, setFetchingPrice] = useState(false);

  // Debounced AMFI search — the dropdown lists real scheme names.
  useEffect(() => {
    if (tab !== 'MF') return;
    if (pickedScheme && schemeQuery === pickedScheme.schemeName) return; // selection, not a new query
    clearTimeout(debounceRef.current);
    if (schemeQuery.trim().length < 3) {
      setSchemeHits([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      setSchemeHits(await searchSchemes(schemeQuery));
      setSearching(false);
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [schemeQuery, tab, pickedScheme]);

  const pickScheme = async (hit: SchemeSearchHit) => {
    setPickedScheme(hit);
    setSchemeQuery(hit.schemeName);
    setSchemeHits([]);
    // Prefill rate with the latest NAV so "bought today" needs no lookup.
    if (!avg) {
      const nav = await getLatestNav(hit.schemeCode);
      if (nav) setAvg(String(nav.nav));
    }
  };

  const prefillQuote = async () => {
    if (!symbol.trim()) return;
    setFetchingPrice(true);
    const quote = await getLiveQuote(symbol.trim().toUpperCase());
    setFetchingPrice(false);
    if (quote) setAvg(String(quote.price));
    else setError(`No live quote for ${symbol.trim().toUpperCase()} — enter the rate manually.`);
  };

  const handleSave = () => {
    setError(null);
    const nQty = parseFloat(qty);
    const nAvg = parseFloat(avg);
    if (!isFinite(nQty) || nQty <= 0) return setError('Quantity must be a positive number.');
    if (!isFinite(nAvg) || nAvg <= 0) return setError('Buy rate must be a positive number.');

    let holding: ImportedHolding;
    if (tab === 'MF') {
      if (!pickedScheme) return setError('Pick the exact scheme from the dropdown — that is what links the right NAV.');
      holding = {
        // Scheme-code symbol is unique; the full scheme name drives NAV linking.
        symbol: `MF-${pickedScheme.schemeCode}`,
        name: pickedScheme.schemeName,
        assetType: 'MF',
        qty: nQty,
        avg: nAvg,
        buyDate
      };
    } else {
      const sym = symbol.trim().toUpperCase();
      if (!sym) return setError('Enter a symbol.');
      holding = { symbol: sym, name: sym, assetType: tab, qty: nQty, avg: nAvg, buyDate };
    }

    addHolding(holding); // merges as an additional buy when the symbol exists
    onAdded();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="bg-gray-50 p-4 border-b border-gray-100 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <div className="bg-emerald-100 p-2 rounded-lg text-emerald-600">
              <PlusCircle size={20} />
            </div>
            <div>
              <h3 className="font-bold text-gray-800">Add Holding / Buy Trade</h3>
              <p className="text-xs text-gray-500">Adding to an existing symbol averages the cost like a real buy.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Asset type */}
          <div className="flex bg-gray-100 p-1 rounded-lg">
            {(['MF', 'STOCK', 'CRYPTO'] as AssetTab[]).map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(null); }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-md ${tab === t ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
              >
                {t === 'MF' ? 'Mutual Fund' : t === 'STOCK' ? 'Stock' : 'Crypto'}
              </button>
            ))}
          </div>

          {/* Instrument */}
          {tab === 'MF' ? (
            <div className="relative">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Scheme</label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={schemeQuery}
                  onChange={e => { setSchemeQuery(e.target.value); setPickedScheme(null); }}
                  placeholder="Type 3+ letters, e.g. quant elss"
                  className="w-full pl-9 pr-8 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-emerald-400"
                />
                {searching && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />}
                {pickedScheme && <CheckCircle2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500" />}
              </div>

              {schemeHits.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-56 overflow-y-auto">
                  {schemeHits.map(hit => (
                    <button
                      key={hit.schemeCode}
                      onClick={() => void pickScheme(hit)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-emerald-50 border-b border-gray-50 last:border-0"
                    >
                      <span className="text-gray-800">{hit.schemeName}</span>
                      <span className="ml-2 text-[10px] text-gray-400 font-mono">#{hit.schemeCode}</span>
                    </button>
                  ))}
                </div>
              )}
              {!searching && schemeQuery.trim().length >= 3 && schemeHits.length === 0 && !pickedScheme && (
                <p className="text-[10px] text-gray-400 mt-1">No schemes found (or AMFI feed unreachable) — refine the search.</p>
              )}
            </div>
          ) : (
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Symbol</label>
              <div className="flex space-x-2">
                <input
                  value={symbol}
                  onChange={e => setSymbol(e.target.value)}
                  placeholder={tab === 'STOCK' ? 'e.g. RELIANCE' : 'e.g. BTC'}
                  className="flex-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono uppercase outline-none focus:border-emerald-400"
                />
                <button
                  onClick={() => void prefillQuote()}
                  disabled={fetchingPrice || !symbol.trim()}
                  className="px-3 py-2 text-xs font-bold bg-gray-100 rounded-xl text-gray-600 hover:bg-gray-200 disabled:opacity-50"
                  title="Prefill rate with the live price"
                >
                  {fetchingPrice ? <Loader2 size={13} className="animate-spin" /> : 'Live ₹'}
                </button>
              </div>
            </div>
          )}

          {/* Trade fields */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Qty / Units</label>
              <input
                type="number" min="0" step="any" value={qty} onChange={e => setQty(e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono outline-none focus:border-emerald-400"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Buy Rate ₹</label>
              <input
                type="number" min="0" step="any" value={avg} onChange={e => setAvg(e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono outline-none focus:border-emerald-400"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Buy Date</label>
              <input
                type="date" value={buyDate} onChange={e => setBuyDate(e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:border-emerald-400"
              />
            </div>
          </div>

          {qty && avg && isFinite(parseFloat(qty)) && isFinite(parseFloat(avg)) && (
            <p className="text-xs text-gray-500">
              Trade value: <span className="font-mono font-bold text-gray-700">₹{(parseFloat(qty) * parseFloat(avg)).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
            </p>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button
            onClick={handleSave}
            className="w-full py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-black flex items-center justify-center space-x-2"
          >
            <PlusCircle size={16} />
            <span>Add to Holdings</span>
          </button>
        </div>
      </div>
    </div>
  );
};
