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
