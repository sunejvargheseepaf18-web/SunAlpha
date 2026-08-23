import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          // Live equity/index quotes (services/marketFeed.ts). Yahoo's v8
          // chart API has no browser CORS, so the dev server relays it.
          '/yahoo-api': {
            target: 'https://query1.finance.yahoo.com',
            changeOrigin: true,
            rewrite: (p) => p.replace(/^\/yahoo-api/, ''),
          },
          // News headlines (services/newsService.ts). Google News RSS sends
          // no CORS headers, so the dev server relays it.
          '/gnews-api': {
            target: 'https://news.google.com',
            changeOrigin: true,
            rewrite: (p) => p.replace(/^\/gnews-api/, ''),
          },
          // Live option chains (services/derivativesFeed.ts). NSE requires
          // browser-like headers + a cookie session and has no CORS.
          '/nse-api': {
            target: 'https://www.nseindia.com',
            changeOrigin: true,
            rewrite: (p) => p.replace(/^\/nse-api/, ''),
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
              'Accept-Language': 'en-US,en;q=0.9',
              Referer: 'https://www.nseindia.com/option-chain',
            },
          },
        },
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        // Optional override for the market feed relay (defaults to the
        // /yahoo-api dev proxy above; set for production deployments).
        'process.env.MARKET_FEED_BASE': JSON.stringify(env.MARKET_FEED_BASE || '')
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
