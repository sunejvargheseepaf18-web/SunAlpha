
import React from 'react';
import { Newspaper } from 'lucide-react';
import { SymbolNewsSentiment } from '../types';

// Rendering only — headlines with per-headline lexicon sentiment and the
// aggregate read. Sentiment here is a signal input, not advice.

const labelClasses: Record<string, string> = {
  BULLISH: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  BEARISH: 'bg-red-50 text-red-700 border-red-200',
  NEUTRAL: 'bg-gray-100 text-gray-700 border-gray-200'
};

const dot = (score: number): string =>
  score > 0.15 ? 'bg-emerald-500' : score < -0.15 ? 'bg-red-500' : 'bg-gray-300';

export const NewsPanel: React.FC<{ news: SymbolNewsSentiment }> = ({ news }) => (
  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
    <div className="flex items-center justify-between mb-1">
      <div className="flex items-center gap-2">
        <Newspaper size={18} className="text-sky-600" />
        <h4 className="font-bold text-gray-800">News & Sentiment</h4>
        <span className="text-xs text-gray-400">
          {news.sentiment.scored}/{news.sentiment.total} headlines scored
        </span>
      </div>
      <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${labelClasses[news.sentiment.label]}`}>
        {news.sentiment.label}
        <span className="font-mono font-normal ml-1">
          {news.sentiment.score >= 0 ? '+' : ''}
          {news.sentiment.score.toFixed(2)}
        </span>
      </span>
    </div>

    {(news.sentiment.topPositives.length > 0 || news.sentiment.topNegatives.length > 0) && (
      <p className="text-[11px] text-gray-400 mb-3">
        {news.sentiment.topPositives.length > 0 && (
          <>driving positive: <span className="text-emerald-600">{news.sentiment.topPositives.join(', ')}</span></>
        )}
        {news.sentiment.topPositives.length > 0 && news.sentiment.topNegatives.length > 0 && ' · '}
        {news.sentiment.topNegatives.length > 0 && (
          <>negative: <span className="text-red-600">{news.sentiment.topNegatives.join(', ')}</span></>
        )}
      </p>
    )}

    <div className="divide-y divide-gray-50">
      {news.items.slice(0, 8).map((item, i) => (
        <a
          key={i}
          href={item.link || undefined}
          target="_blank"
          rel="noreferrer"
          className="flex items-start gap-2.5 py-2 group"
        >
          <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${dot(item.sentimentScore)}`} />
          <div className="min-w-0">
            <p className="text-xs text-gray-700 leading-snug group-hover:text-sky-700">{item.title}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">
              {item.source}
              {item.publishedAt && ` · ${new Date(item.publishedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
            </p>
          </div>
        </a>
      ))}
    </div>
  </div>
);
