<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1YQTGKbWMXS2JIjKNumqPTCTQVXrxYA7M

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Market Data Feeds

SunAlpha prices holdings from live feeds, falling back to simulated data when a feed is unreachable:

| Data | Source | Notes |
|------|--------|-------|
| Mutual fund NAVs | [api.mfapi.in](https://www.mfapi.in/) (AMFI mirror) | Free, CORS-enabled, no key. Scheme linking in `services/mfNavService.ts`. |
| Equity/index quotes & OHLCV | Yahoo Finance v8 chart API | Free, no key. NSE via `.NS`, indices via `^NSEI`/`^BSESN`. No browser CORS, so the Vite dev server proxies it at `/yahoo-api` (see `vite.config.ts`). For production, set `MARKET_FEED_BASE` in `.env.local` to your own relay. |

Upgrade path for production-grade Indian market data (implement as additional
providers behind `services/marketFeed.ts`):
- **Upstox trading API** — free, includes market data (needs an Upstox account)
- **Zerodha Kite Connect** — ₹500/month, official live ticks + 10y historical
- **TrueData / NSE-authorized vendors** — paid, exchange-licensed real-time feeds
