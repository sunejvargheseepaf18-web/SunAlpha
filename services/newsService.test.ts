
import { describe, it, expect } from 'vitest';
import { parseRssItems } from './newsService';

const RSS_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>Google News</title>
  <item>
    <title>Reliance Industries beats estimates as profit surges - Economic Times</title>
    <link>https://news.example.com/a</link>
    <pubDate>Fri, 22 Aug 2026 09:30:00 GMT</pubDate>
    <source url="https://economictimes.com">Economic Times</source>
  </item>
  <item>
    <title><![CDATA[M&amp;M shares plunge after weak numbers - Moneycontrol]]></title>
    <link>https://news.example.com/b</link>
    <pubDate>not-a-date</pubDate>
  </item>
  <item><description>no title here</description></item>
</channel></rss>`;

describe('parseRssItems', () => {
  it('extracts titles, links, sources and ISO dates', () => {
    const items = parseRssItems(RSS_FIXTURE);
    expect(items).toHaveLength(2); // titleless item skipped
    expect(items[0].title).toBe('Reliance Industries beats estimates as profit surges');
    expect(items[0].source).toBe('Economic Times');
    expect(items[0].link).toBe('https://news.example.com/a');
    expect(items[0].publishedAt).toContain('2026-08-22');
  });

  it('handles CDATA, entities and unparseable dates', () => {
    const items = parseRssItems(RSS_FIXTURE);
    expect(items[1].title).toContain('M&M shares plunge');
    expect(items[1].publishedAt).toBe(''); // bad date -> empty, never Invalid Date
  });

  it('respects the item limit and tolerates garbage input', () => {
    expect(parseRssItems(RSS_FIXTURE, 1)).toHaveLength(1);
    expect(parseRssItems('not xml at all')).toHaveLength(0);
  });
});
