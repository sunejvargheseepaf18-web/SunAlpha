
// Live Mutual Fund NAV linking.
//
// Source: api.mfapi.in — a free, CORS-enabled JSON mirror of AMFI's daily NAV feed.
//   GET https://api.mfapi.in/mf/search?q=<text>   -> [{ schemeCode, schemeName }]
//   GET https://api.mfapi.in/mf/<code>/latest     -> { meta, data: [{ date: "dd-MM-yyyy", nav: "123.4567" }] }
//   GET https://api.mfapi.in/mf/<code>            -> same shape, full history (newest first)
//
// The hard part is LINKING: user holdings carry free-text names like
// "QUANT ELSS TAX SAVER GROWTH OPTION DIRECT GROWTH" which must resolve to the
// one AMFI scheme code for "quant ELSS Tax Saver Fund - Direct Plan - Growth".
// Resolution result is cached (memory + localStorage) so a holding stays linked
// to the same scheme code once matched.

const API_BASE = 'https://api.mfapi.in/mf';

const SCHEME_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // scheme codes are stable; 30 days
const NAV_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // NAV updates once per trading day

export interface ResolvedScheme {
  schemeCode: number;
  schemeName: string;
  confidence: number; // 0..1
}

export interface LatestNav {
  schemeCode: number;
  schemeName: string;
  nav: number;
  date: string; // ISO yyyy-MM-dd
}

export interface NavHistoryPoint {
  date: string; // ISO yyyy-MM-dd
  value: number;
}

// ---------------------------------------------------------------------------
// Name normalization & matching (pure, unit-testable)
// ---------------------------------------------------------------------------

// Tokens that add no discriminating power between schemes of the same fund.
const NOISE_TOKENS = new Set(['FUND', 'PLAN', 'OPTION', 'SCHEME', 'THE', 'OF', 'AND', '&']);

// Common broker-statement abbreviations -> AMFI spelling.
const TOKEN_SYNONYMS: Record<string, string> = {
  GRWTH: 'GROWTH',
  GRPWTH: 'GROWTH',
  GRTH: 'GROWTH',
  GR: 'GROWTH',
  DIR: 'DIRECT',
  REG: 'REGULAR',
  DIV: 'DIVIDEND',
  OPPS: 'OPPORTUNITIES',
  OPP: 'OPPORTUNITIES',
  BLUECHIP: 'BLUE CHIP'
};

export const normalizeFundName = (raw: string): string =>
  raw
    .toUpperCase()
    .replace(/[^A-Z0-9&\s]/g, ' ') // strip punctuation, hyphens, brackets
    .split(/\s+/)
    .filter(Boolean)
    .map(t => TOKEN_SYNONYMS[t] ?? t)
    .join(' ');

export interface FundNameParts {
  coreTokens: string[]; // identifies the fund itself (AMC + strategy)
  wantsDirect: boolean | null; // null = unspecified
  wantsGrowth: boolean | null;
}

export const parseFundName = (raw: string): FundNameParts => {
  const normalized = normalizeFundName(raw);
  const tokens = normalized.split(' ');

  const wantsDirect = tokens.includes('DIRECT') ? true : tokens.includes('REGULAR') ? false : null;
  const wantsGrowth = tokens.includes('GROWTH')
    ? true
    : tokens.some(t => ['IDCW', 'DIVIDEND', 'PAYOUT', 'REINVESTMENT'].includes(t))
      ? false
      : null;

  const coreTokens = tokens.filter(
    t =>
      !NOISE_TOKENS.has(t) &&
      !['DIRECT', 'REGULAR', 'GROWTH', 'IDCW', 'DIVIDEND', 'PAYOUT', 'REINVESTMENT'].includes(t)
  );
  // Dedupe while preserving order ("GROWTH OPTION DIRECT GROWTH" style inputs)
  return { coreTokens: [...new Set(coreTokens)], wantsDirect, wantsGrowth };
};

// Score a candidate AMFI scheme name against the parsed holding name. 0..1.
export const scoreSchemeMatch = (holding: FundNameParts, schemeName: string): number => {
  const scheme = parseFundName(schemeName);
  const schemeSet = new Set(scheme.coreTokens);

  if (holding.coreTokens.length === 0) return 0;

  const hit = holding.coreTokens.filter(t => schemeSet.has(t)).length;
  const coverage = hit / holding.coreTokens.length; // how much of the holding name the scheme explains
  const precision = hit / Math.max(schemeSet.size, 1); // penalize schemes with lots of extra tokens
  // Base maxes at 0.85 so plan/option bonuses below can still break ties
  // between sibling schemes (Direct vs Regular, Growth vs IDCW).
  let score = coverage * 0.65 + precision * 0.2;

  // Plan (Direct/Regular) — a mismatch links to the WRONG NAV series, so penalize hard.
  if (holding.wantsDirect !== null && scheme.wantsDirect !== null) {
    score += holding.wantsDirect === scheme.wantsDirect ? 0.12 : -0.35;
  }
  // Option (Growth/IDCW) — same reasoning.
  if (holding.wantsGrowth !== null && scheme.wantsGrowth !== null) {
    score += holding.wantsGrowth === scheme.wantsGrowth ? 0.12 : -0.35;
  } else if (holding.wantsGrowth === null && scheme.wantsGrowth === true) {
    score += 0.04; // unspecified holdings are overwhelmingly Growth
  }

  return Math.max(0, Math.min(1, score));
};

// Below this confidence the link is refused rather than risking a wrong NAV.
export const MIN_LINK_CONFIDENCE = 0.55;

// ---------------------------------------------------------------------------
// Caching (memory first, localStorage as persistence across reloads)
// ---------------------------------------------------------------------------

const memCache = new Map<string, { value: unknown; ts: number }>();

const cacheGet = <T>(key: string, ttlMs: number): T | null => {
  const hit = memCache.get(key);
  if (hit && Date.now() - hit.ts < ttlMs) return hit.value as T;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { value: T; ts: number };
    if (Date.now() - parsed.ts >= ttlMs) return null;
    memCache.set(key, parsed);
    return parsed.value;
  } catch {
    return null;
  }
};

const cacheSet = (key: string, value: unknown): void => {
  const entry = { value, ts: Date.now() };
  memCache.set(key, entry);
  try {
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // storage full / unavailable — memory cache still applies
  }
};

// ---------------------------------------------------------------------------
// API access
// ---------------------------------------------------------------------------

const fetchJson = async <T>(url: string): Promise<T> => {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`mfapi ${res.status} for ${url}`);
  return res.json() as Promise<T>;
};

// AMFI feed dates are dd-MM-yyyy.
const toIsoDate = (amfiDate: string): string => {
  const [dd, mm, yyyy] = amfiDate.split('-');
  return `${yyyy}-${mm}-${dd}`;
};

interface ApiSearchResult {
  schemeCode: number;
  schemeName: string;
}

interface ApiNavResponse {
  meta: { scheme_code: number; scheme_name: string; scheme_category?: string; fund_house?: string };
  data: { date: string; nav: string }[];
  status: string;
}

/**
 * Resolve a free-text holding name to an AMFI scheme code.
 * Returns null when no candidate clears MIN_LINK_CONFIDENCE — callers must
 * treat that as "unlinked" and fall back, never guess.
 */
export const resolveScheme = async (holdingName: string): Promise<ResolvedScheme | null> => {
  const parts = parseFundName(holdingName);
  if (parts.coreTokens.length === 0) return null;

  const cacheKey = `sunalpha.mf.scheme:${parts.coreTokens.join('_')}:${parts.wantsDirect}:${parts.wantsGrowth}`;
  const cached = cacheGet<ResolvedScheme>(cacheKey, SCHEME_CACHE_TTL_MS);
  if (cached) return cached;

  // Query with the leading core tokens (AMC + strategy). Too many tokens
  // over-constrains mfapi's substring search and returns nothing.
  const query = parts.coreTokens.slice(0, 4).join(' ');
  const candidates = await fetchJson<ApiSearchResult[]>(
    `${API_BASE}/search?q=${encodeURIComponent(query)}`
  );
  if (!Array.isArray(candidates) || candidates.length === 0) return null;

  let best: ResolvedScheme | null = null;
  for (const c of candidates) {
    const confidence = scoreSchemeMatch(parts, c.schemeName);
    if (!best || confidence > best.confidence) {
      best = { schemeCode: c.schemeCode, schemeName: c.schemeName, confidence };
    }
  }
  if (!best || best.confidence < MIN_LINK_CONFIDENCE) return null;

  cacheSet(cacheKey, best);
  return best;
};

/** Latest declared NAV for a scheme code, cached for the trading day. */
export interface SchemeSearchHit {
  schemeCode: number;
  schemeName: string;
  confidence: number; // relevance vs the typed query, for ordering only
}

/**
 * User-facing scheme search for pickers/dropdowns: returns the top AMFI
 * matches for free text, best first. Unlike resolveScheme there is NO
 * confidence floor — the user makes the final choice from real scheme
 * names, which is exactly what makes the link correct.
 */
export const searchSchemes = async (query: string, limit = 8): Promise<SchemeSearchHit[]> => {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];
  try {
    const parts = parseFundName(trimmed);
    const q = parts.coreTokens.slice(0, 4).join(' ') || trimmed;
    const candidates = await fetchJson<ApiSearchResult[]>(
      `${API_BASE}/search?q=${encodeURIComponent(q)}`
    );
    if (!Array.isArray(candidates)) return [];
    return candidates
      .map(c => ({
        schemeCode: c.schemeCode,
        schemeName: c.schemeName,
        confidence: scoreSchemeMatch(parts, c.schemeName)
      }))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, limit);
  } catch {
    return []; // feed unreachable — the picker shows an empty-state message
  }
};

export const getLatestNav = async (schemeCode: number): Promise<LatestNav | null> => {
  const cacheKey = `sunalpha.mf.nav:${schemeCode}`;
  const cached = cacheGet<LatestNav>(cacheKey, NAV_CACHE_TTL_MS);
  if (cached) return cached;

  const res = await fetchJson<ApiNavResponse>(`${API_BASE}/${schemeCode}/latest`);
  const point = res?.data?.[0];
  const nav = point ? parseFloat(point.nav) : NaN;
  if (!point || !isFinite(nav) || nav <= 0) return null;

  const latest: LatestNav = {
    schemeCode,
    schemeName: res.meta?.scheme_name ?? String(schemeCode),
    nav,
    date: toIsoDate(point.date)
  };
  cacheSet(cacheKey, latest);
  return latest;
};

/** Full NAV history (ascending by date) plus scheme meta. */
export const getNavHistory = async (
  schemeCode: number,
  days = 365
): Promise<{ meta: ApiNavResponse['meta']; history: NavHistoryPoint[] } | null> => {
  const res = await fetchJson<ApiNavResponse>(`${API_BASE}/${schemeCode}`);
  if (!res?.data?.length) return null;
  const history = res.data
    .slice(0, days)
    .map(d => ({ date: toIsoDate(d.date), value: parseFloat(d.nav) }))
    .filter(p => isFinite(p.value) && p.value > 0)
    .reverse();
  return { meta: res.meta, history };
};

/**
 * One-shot convenience: free-text holding name -> latest NAV.
 * Null means the holding could not be linked (or the feed is unreachable);
 * callers keep their previous/fallback price.
 */
export const getLatestNavByName = async (holdingName: string): Promise<LatestNav | null> => {
  try {
    const scheme = await resolveScheme(holdingName);
    if (!scheme) return null;
    return await getLatestNav(scheme.schemeCode);
  } catch {
    return null; // offline / feed down — never break portfolio rendering
  }
};
