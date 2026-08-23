
// News feed + sentiment — infrastructure.
//
// Source: Google News RSS (free, no key, India edition) queried per symbol,
// proxied at /gnews-api (vite.config.ts) since news.google.com sends no CORS
// headers. Headlines are scored by the pure Loughran-McDonald-style
// sentiment engine; nothing here decides anything.

import { scoreText, scoreHeadlines } from '../domain/sentiment/sentiment.engine';
import { NewsHeadline, SymbolNewsSentiment } from '../types';

const NEWS_BASE: string =
  (typeof process !== 'undefined' && (process.env as any)?.NEWS_FEED_BASE) || '/gnews-api';

const CACHE_TTL_MS = 15 * 60 * 1000; // news staleness tolerance

export type { NewsHeadline, SymbolNewsSentiment };

// --- RSS parsing (pure, exported for tests) --------------------------------

const pick = (xml: string, tag: string): string => {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return m ? m[1].trim() : '';
};

const unescapeXml = (s: string): string =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");

export const parseRssItems = (xml: string, limit = 12): Omit<NewsHeadline, 'sentimentScore'>[] => {
  const items: Omit<NewsHeadline, 'sentimentScore'>[] = [];
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
  for (const block of blocks.slice(0, limit)) {
    const title = unescapeXml(pick(block, 'title'));
    if (!title) continue;
    const pubDate = pick(block, 'pubDate');
    const parsed = pubDate ? new Date(pubDate) : null;
    items.push({
      // Google News appends " - Source" to titles; keep both parts.
      title: title.replace(/\s+-\s+[^-]+$/, '').trim() || title,
      link: unescapeXml(pick(block, 'link')),
      source: unescapeXml(pick(block, 'source')) || title.match(/\s-\s([^-]+)$/)?.[1]?.trim() || '',
      publishedAt: parsed && !isNaN(parsed.getTime()) ? parsed.toISOString() : ''
    });
  }
  return items;
};

// --- Fetching ---------------------------------------------------------------

const cache = new Map<string, { news: SymbolNewsSentiment; ts: number }>();

/**
 * Headlines + aggregate sentiment for a symbol. Query uses the company name
 * when given (better recall than a ticker). Null when the feed is
 * unreachable — callers simply show no news, never fabricated sentiment.
 */
export const getSymbolNews = async (symbol: string, companyName?: string): Promise<SymbolNewsSentiment | null> => {
  const cached = cache.get(symbol);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.news;

  try {
    const query = encodeURIComponent(`${companyName || symbol} stock`);
    const url = `${NEWS_BASE}/rss/search?q=${query}&hl=en-IN&gl=IN&ceid=IN:en`;
    const res = await fetch(url, { headers: { Accept: 'application/rss+xml, text/xml, */*' } });
    if (!res.ok) throw new Error(`news feed ${res.status}`);

    const parsed = parseRssItems(await res.text());
    if (parsed.length === 0) return null;

    const items: NewsHeadline[] = parsed.map(item => ({
      ...item,
      sentimentScore: scoreText(item.title).score
    }));

    const news: SymbolNewsSentiment = {
      symbol,
      items,
      sentiment: scoreHeadlines(items.map(i => i.title)),
      fetchedAt: new Date().toISOString()
    };
    cache.set(symbol, { news, ts: Date.now() });
    return news;
  } catch {
    return null;
  }
};
