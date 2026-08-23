
// Jarvis assistant service — executes routed intents against the app's REAL
// engines and formats concise answers with exact numbers. The pure intent
// engine decides WHERE a query goes; this file gathers the data. Free-form
// questions go to the AI lane with a digested portfolio context; offline,
// every structured command still works and the AI lane says so honestly.

import { parseIntent, IntentKind } from '../domain/assistant/intent.engine';
import { reviewPortfolio } from '../domain/advisor/advisor.engine';
import { calculatePortfolio, getHoldingAdvices } from './portfolioEngine';
import { getLiveQuote } from './marketFeed';
import { runMarketScans } from './scannerEngine';
import { getAlerts } from './alertService';
import { fetchMarketPulse } from './marketData';
import { generateText } from './ai/llm';
import { digest } from './ai/contextDigest';
import { getActiveHoldingsData } from './portfolioIoService';

export interface AssistantReply {
  kind: IntentKind;
  text: string; // plain text with line breaks — the panel renders it verbatim
}

const inr = (v: number): string =>
  `₹${Math.round(v).toLocaleString('en-IN')}`;

// Computed per query so freshly imported holdings are recognized immediately.
const knownSymbols = (): string[] => [
  ...new Set([
    ...getActiveHoldingsData().map(h => h.symbol),
    'NIFTY 50', 'NIFTY', 'SENSEX', 'BANKNIFTY',
    'RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK', 'SBIN',
    'TATAMOTORS', 'TATASTEEL', 'ADANIENT', 'LT', 'ITC', 'NIFTYBEES'
  ])
];

const HELP_TEXT = [
  'I answer from SunAlpha\'s own engines. Try:',
  '• "portfolio" — value, P&L, best and worst holding',
  '• "advice" or "should I sell M&M" — exact-quantity recommendations',
  '• "price of RELIANCE" — live quote',
  '• "scans" — strongest market setups right now',
  '• "market" — regime read on NIFTY',
  '• "tax" — loss-harvest candidates',
  '• "alerts" — your active price alerts',
  'Anything else goes to the AI adviser (when online).'
].join('\n');

const answerPortfolio = async (): Promise<string> => {
  const p = await calculatePortfolio();
  if (p.positions.length === 0) return 'No positions found.';
  const best = [...p.positions].sort((a, b) => b.pnlPercent - a.pnlPercent)[0];
  const worst = [...p.positions].sort((a, b) => a.pnlPercent - b.pnlPercent)[0];
  const pnlPct = p.totalInvested > 0 ? (p.totalPnl / p.totalInvested) * 100 : 0;
  return [
    `Portfolio: ${inr(p.totalValue)} (invested ${inr(p.totalInvested)}).`,
    `P&L: ${p.totalPnl >= 0 ? '+' : ''}${inr(p.totalPnl)} (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(1)}%).`,
    `Best: ${best.symbol} ${best.pnlPercent >= 0 ? '+' : ''}${best.pnlPercent.toFixed(1)}% · Worst: ${worst.symbol} ${worst.pnlPercent.toFixed(1)}%.`
  ].join('\n');
};

const answerAdvice = async (symbol?: string): Promise<string> => {
  const p = await calculatePortfolio();
  const advices = getHoldingAdvices(p.positions);
  const relevant = symbol ? advices.filter(a => a.symbol === symbol) : advices;
  if (relevant.length === 0) {
    return symbol
      ? `${symbol} is not in the portfolio, so there is no holding advice for it.`
      : 'No holdings to advise on.';
  }
  const actionable = relevant.filter(a => a.action !== 'HOLD');
  const lines = (actionable.length > 0 ? actionable : relevant)
    .slice(0, 5)
    .map(a => `• ${a.symbol}: ${a.detail}`);
  if (!symbol && actionable.length === 0) lines.unshift('Everything reads HOLD right now.');
  return lines.join('\n');
};

const answerQuote = async (symbol?: string): Promise<string> => {
  if (!symbol) return 'Which symbol? e.g. "price of RELIANCE".';
  const q = await getLiveQuote(symbol);
  if (!q) return `No live quote for ${symbol} right now (feed unreachable or unknown symbol).`;
  return `${symbol}: ₹${q.price.toLocaleString('en-IN')} (${q.change >= 0 ? '+' : ''}${q.change} / ${q.changePercent >= 0 ? '+' : ''}${q.changePercent}%), as of ${new Date(q.asOf).toLocaleTimeString('en-IN')}.`;
};

const answerScans = async (): Promise<string> => {
  const scans = await runMarketScans();
  if (scans.length === 0) return 'No scan hits right now.';
  return [
    'Strongest setups:',
    ...scans.slice(0, 4).map(s => `• ${s.symbol} — ${s.type.replace(/_/g, ' ')} (${s.signalStrength}): ${s.description}`)
  ].join('\n');
};

const answerAlerts = async (): Promise<string> => {
  const alerts = await getAlerts();
  if (alerts.length === 0) return 'No active alerts. Set one from any chart\'s bell icon.';
  return [
    `${alerts.length} active alert${alerts.length > 1 ? 's' : ''}:`,
    ...alerts.slice(0, 6).map(a => `• ${a.symbol} ${a.condition} ${a.targetPrice ? `₹${a.targetPrice}` : ''}`)
  ].join('\n');
};

const answerTax = async (): Promise<string> => {
  const p = await calculatePortfolio();
  const review = reviewPortfolio(
    p.positions.map(pos => ({
      symbol: pos.symbol,
      name: pos.name,
      assetType: pos.assetType,
      investedValue: pos.investedValue,
      currentValue: pos.currentValue,
      pnl: pos.pnl,
      pnlPercent: pos.pnlPercent
    }))
  );
  const harvests = review.findings.filter(f => f.id.startsWith('harvest-'));
  if (harvests.length === 0) {
    return 'No meaningful loss-harvest candidates right now. The Tax Center has the full STCG/LTCG picture.';
  }
  return [
    'Loss-harvest candidates:',
    ...harvests.map(h => `• ${h.title}`),
    'Exact quantities and offsets are in the Tax Center.'
  ].join('\n');
};

const answerRegime = async (): Promise<string> => {
  const pulse = await fetchMarketPulse();
  const r = pulse.regime;
  return `NIFTY regime: ${r.trend.replace(/_/g, ' ')} / ${r.volatility.replace(/_/g, ' ')} (confidence ${(r.confidence * 100).toFixed(0)}%). ${r.summary}`;
};

const answerAi = async (question: string): Promise<string> => {
  const p = await calculatePortfolio();
  const context = digest(
    {
      totalValue: p.totalValue,
      totalPnl: p.totalPnl,
      positions: p.positions.map(pos => ({
        symbol: pos.symbol,
        value: pos.currentValue,
        pnlPct: pos.pnlPercent
      }))
    },
    800
  );
  const answer = await generateText(
    `You are SunAlpha's assistant. The user's portfolio (digested): ${context}\n` +
      `Question: ${question}\n` +
      `Answer in under 100 words. Only use numbers from the context; never invent holdings or prices. Advisory only — no orders.`
  );
  return answer ?? 'The AI adviser is offline. Structured commands still work — type "help" to see them.';
};

/** Route one user query to the right engine and format the answer. */
export const askAssistant = async (query: string): Promise<AssistantReply> => {
  const intent = parseIntent(query, knownSymbols());
  try {
    switch (intent.kind) {
      case 'HELP': return { kind: intent.kind, text: HELP_TEXT };
      case 'PORTFOLIO': return { kind: intent.kind, text: await answerPortfolio() };
      case 'ADVICE': return { kind: intent.kind, text: await answerAdvice(intent.symbol) };
      case 'QUOTE': return { kind: intent.kind, text: await answerQuote(intent.symbol) };
      case 'SCANS': return { kind: intent.kind, text: await answerScans() };
      case 'ALERTS': return { kind: intent.kind, text: await answerAlerts() };
      case 'TAX': return { kind: intent.kind, text: await answerTax() };
      case 'REGIME': return { kind: intent.kind, text: await answerRegime() };
      case 'ASK_AI': return { kind: intent.kind, text: await answerAi(query) };
    }
  } catch {
    return { kind: intent.kind, text: 'That lookup failed — feeds may be unreachable. Try again or type "help".' };
  }
};
