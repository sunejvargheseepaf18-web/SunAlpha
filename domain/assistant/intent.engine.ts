
// Assistant intent engine (pure domain logic).
//
// The open-Jarvis pattern (Open.Jarvis's "local routing, AI fallback",
// rezaulhreza/jarvis): route what can be routed DETERMINISTICALLY to local
// commands first, and only hand the unmatched remainder to an LLM. Command
// answers come from the app's real engines with exact numbers; the AI lane
// is advisory color, never the router. Same text in, same intent out.

export type IntentKind =
  | 'PORTFOLIO' // holdings, value, P&L
  | 'ADVICE' // what should I do / rebalance
  | 'QUOTE' // price of a symbol
  | 'SCANS' // market setups
  | 'ALERTS' // active alerts
  | 'TAX' // tax / harvest
  | 'REGIME' // market mood
  | 'HELP'
  | 'ASK_AI'; // free-form fallback

export interface AssistantIntent {
  kind: IntentKind;
  symbol?: string; // matched known symbol, when present
}

const RULES: Array<{ kind: IntentKind; pattern: RegExp }> = [
  { kind: 'HELP', pattern: /\b(help|what can you do|commands?)\b/i },
  { kind: 'TAX', pattern: /\b(tax|harvest|stcg|ltcg|capital gains?)\b/i },
  { kind: 'ALERTS', pattern: /\balerts?\b/i },
  { kind: 'SCANS', pattern: /\b(scans?|screener?|breakouts?|setups?|opportunit\w*)\b/i },
  { kind: 'REGIME', pattern: /\b(market (mood|regime|state|condition)|regime|market today|how('?s| is) the market)\b/i },
  { kind: 'ADVICE', pattern: /\b(advice|advise|recommend\w*|rebalance|what should i|buy or sell|trim|sell|hold\?)\b/i },
  { kind: 'QUOTE', pattern: /\b(price|quote|ltp|cmp|trading at|worth)\b/i },
  { kind: 'PORTFOLIO', pattern: /\b(portfolio|holdings?|net ?worth|invested|p&l|pnl|profit|returns?)\b/i }
];

/** Normalize a token for symbol matching: uppercase, strip punctuation noise. */
const normalizeToken = (t: string): string => t.toUpperCase().replace(/[?.,!:;'"()]/g, '');

/**
 * Find a known symbol mentioned in the text. Known symbols win over free
 * text; multi-word names (NIFTY 50) are matched as phrases first.
 */
export const extractSymbol = (text: string, knownSymbols: string[]): string | undefined => {
  const upper = ` ${text.toUpperCase().replace(/[?.,!:;'"()]/g, ' ')} `;
  // Longest symbols first so 'NIFTY 50' beats 'NIFTY'
  const ranked = [...knownSymbols].sort((a, b) => b.length - a.length);
  for (const symbol of ranked) {
    const needle = ` ${symbol.toUpperCase()} `;
    if (upper.includes(needle)) return symbol;
  }
  // Token-by-token fallback (handles M&M etc. where spacing already split)
  const tokens = text.split(/\s+/).map(normalizeToken);
  for (const symbol of ranked) {
    if (tokens.includes(symbol.toUpperCase())) return symbol;
  }
  return undefined;
};

/**
 * Deterministic router: first matching rule wins (rules are ordered from
 * most to least specific). A bare known symbol with no other match reads
 * as a quote request. Everything else goes to the AI lane.
 */
export const parseIntent = (text: string, knownSymbols: string[] = []): AssistantIntent => {
  const trimmed = text.trim();
  if (!trimmed) return { kind: 'HELP' };

  const symbol = extractSymbol(trimmed, knownSymbols);

  for (const rule of RULES) {
    if (rule.pattern.test(trimmed)) return { kind: rule.kind, symbol };
  }

  // "RELIANCE" or "reliance?" alone → quote
  if (symbol && trimmed.split(/\s+/).length <= 3) return { kind: 'QUOTE', symbol };

  return { kind: 'ASK_AI', symbol };
};
