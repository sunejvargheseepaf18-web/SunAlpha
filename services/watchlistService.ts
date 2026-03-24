import { Watchlist } from '../types';

let MOCK_WATCHLISTS: Watchlist[] = [
    { id: '1', name: 'Nifty 50 Favorites', symbols: ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK'] },
    { id: '2', name: 'Auto Sector', symbols: ['TATAMOTORS', 'M&M', 'MARUTI', 'EICHERMOT'] },
    { id: '3', name: 'Momentum Trades', symbols: ['ADANIENT', 'PAYTM', 'ZOMATO'] }
];

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const getWatchlists = async (): Promise<Watchlist[]> => {
  await delay(300);
  return [...MOCK_WATCHLISTS];
};

export const createWatchlist = async (name: string): Promise<Watchlist[]> => {
  await delay(200);
  const newId = (MOCK_WATCHLISTS.length + 1).toString();
  const newList: Watchlist = { id: newId, name, symbols: [] };
  MOCK_WATCHLISTS = [...MOCK_WATCHLISTS, newList];
  return MOCK_WATCHLISTS;
};

export const deleteWatchlist = async (id: string): Promise<Watchlist[]> => {
  await delay(200);
  MOCK_WATCHLISTS = MOCK_WATCHLISTS.filter(w => w.id !== id);
  return MOCK_WATCHLISTS;
};

export const addSymbolToWatchlist = async (id: string, symbol: string): Promise<Watchlist[]> => {
  await delay(200);
  const cleanSymbol = symbol.toUpperCase().trim();
  MOCK_WATCHLISTS = MOCK_WATCHLISTS.map(w => {
    if (w.id === id && !w.symbols.includes(cleanSymbol)) {
      return { ...w, symbols: [...w.symbols, cleanSymbol] };
    }
    return w;
  });
  return MOCK_WATCHLISTS;
};

export const removeSymbolFromWatchlist = async (id: string, symbol: string): Promise<Watchlist[]> => {
  await delay(200);
  MOCK_WATCHLISTS = MOCK_WATCHLISTS.map(w => {
    if (w.id === id) {
      return { ...w, symbols: w.symbols.filter(s => s !== symbol) };
    }
    return w;
  });
  return MOCK_WATCHLISTS;
};

export const reorderWatchlist = async (id: string, oldIndex: number, newIndex: number): Promise<Watchlist[]> => {
    // Simple array move
    MOCK_WATCHLISTS = MOCK_WATCHLISTS.map(w => {
        if (w.id === id) {
            const result = [...w.symbols];
            const [removed] = result.splice(oldIndex, 1);
            result.splice(newIndex, 0, removed);
            return { ...w, symbols: result };
        }
        return w;
    });
    return MOCK_WATCHLISTS;
};
