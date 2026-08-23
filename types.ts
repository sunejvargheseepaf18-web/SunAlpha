
export enum AppMode {
  LANDING = 'LANDING',
  DASHBOARD = 'DASHBOARD', // Unified Home
  EXPLORE = 'EXPLORE',
  ANALYZE = 'ANALYZE',
  ASSET = 'ASSET' // Unified Asset Workspace
}

export enum AppView {
  DEFAULT = 'DEFAULT',
  PORTFOLIO = 'PORTFOLIO',
  WATCHLIST = 'WATCHLIST',
  TAX = 'TAX',
  REPORT_VIEWER = 'REPORT_VIEWER',
  ONBOARDING = 'ONBOARDING' // New View
}

export type ExecutionMode = 'LIVE' | 'PAPER';

// --- NEW: INVESTMENT LIFECYCLE TYPES ---

export enum LifecycleStage {
  EXPLORER = 'EXPLORER',   // Complete beginner, needs terminology & safety
  LEARNER = 'LEARNER',     // Paper trading phase, learning mechanics
  BUILDER = 'BUILDER',     // Small capital, starting SIPs, building habits
  OPTIMIZER = 'OPTIMIZER', // Larger capital, tax harvesting, rebalancing
  PROTECTOR = 'PROTECTOR'  // Wealth preservation, hedging
}

export interface UserProfile {
  id: string;
  name: string;
  stage: LifecycleStage;
  riskTolerance: 'LOW' | 'MEDIUM' | 'HIGH';
  goals: string[];
  capital: number;
  onboardingComplete: boolean;
}

export interface CoachMessage {
  id: string;
  type: 'GUIDANCE' | 'WARNING' | 'PRAISE' | 'EXPLAINER';
  title: string;
  message: string;
  actionLabel?: string;
  action?: () => void;
}

// ... (Existing types below) ...

export type InstrumentType = 'STOCK' | 'MUTUAL_FUND' | 'ETF' | 'DERIVATIVE';

export interface StockData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: string;
  peRatio: number;
  sector: string;
  history: { date: string; open: number; close: number; high: number; low: number; volume: number }[];
}

export interface MutualFundData {
  schemeCode: string;
  fundName: string;
  nav: number;
  change: number;
  changePercent: number;
  category: string;
  risk: string;
  expenseRatio: number;
  aum: string;
  minSip: number;
  returns: {
    '1Y': number;
    '3Y': number;
    '5Y': number;
  };
  history: { date: string; value: number }[]; // NAV history (Line chart only)
}

export interface FundamentalData {
  symbol: string;
  roe: number;
  roce: number;
  npm: number; // Net Profit Margin
  revenueGrowth3Y: number;
  profitGrowth3Y: number;
  debtToEquity: number;
  interestCoverage: number;
  currentRatio: number;
  freeCashFlowConversion: number; // FCF / Net Profit
  peHistory: number; // 5Y Avg PE
  currentPe: number;
  pegRatio: number;
  promoterHolding: number;
  pledgedShares: number;
}

export interface PortfolioPosition {
  id: string;
  assetType: 'STOCK' | 'MF' | 'GOLD' | 'CRYPTO';
  symbol: string;
  name: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  investedValue: number;
  currentValue: number;
  pnl: number;
  pnlPercent: number;
  // Pricing provenance — lets the UI show "NAV as of <date>" vs stale/fallback
  priceSource?: 'LIVE_NAV' | 'LIVE_QUOTE' | 'MOCK';
  priceAsOf?: string; // ISO date of the price/NAV used
  // Capital Intelligence
  marginUsed?: number; // How much margin this position consumes
  leverage?: number; // 1x = Cash, >1x = Margin
}

export interface PortfolioHistoryPoint {
  date: string;
  portfolioValue: number;
  benchmarkValue: number; // Normalized to portfolio start value for comparison
}

export interface Insight {
  id: string;
  type: 'RISK' | 'OPPORTUNITY' | 'INFO';
  title: string;
  description: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface MarketIndex {
  name: string;
  value: number;
  change: number;
  percentChange: number;
}

export interface UserProgress {
  level: number;
  title: string;
  currentPoints: number;
  nextLevelPoints: number;
  sipStreakMonths: number;
  badges: Array<{ id: string; name: string; icon: string; earned: boolean }>;
}

export interface ExploreItem {
  id: string;
  category: 'TREND' | 'TOP' | 'INSIGHT' | 'LEARN';
  title: string;
  subtitle: string;
  tags: string[];
  relevance: AppMode[];
  instrumentType?: InstrumentType;
}

// --- Watchlist Types ---

export interface Watchlist {
  id: string;
  name: string;
  symbols: string[];
}

export interface MarketQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  exchange: string;
}

// --- Alerts ---

export interface PriceAlert {
  id: string;
  symbol: string;
  targetPrice: number; // 0 for PCT_MOVE alerts
  // ABOVE/BELOW: level alerts (cooldown-limited); CROSS_*: fire on the
  // transition through the level; PCT_MOVE: day move beyond ±pctThreshold
  condition: 'ABOVE' | 'BELOW' | 'CROSS_ABOVE' | 'CROSS_BELOW' | 'PCT_MOVE';
  createdAt: string;
  pctThreshold?: number;
  triggerOnce?: boolean;
  cooldownMinutes?: number;
  lastTriggeredAt?: string;
}

// --- Regime Types ---

export type VolatilityRegime = 'LOW_COMPRESSION' | 'NORMAL' | 'HIGH_EXPANSION';
export type TrendRegime = 'STRONG_BULL' | 'WEAK_BULL' | 'SIDEWAYS' | 'WEAK_BEAR' | 'STRONG_BEAR';

export interface MarketRegime {
  symbol: string;
  volatility: VolatilityRegime;
  trend: TrendRegime;
  summary: string;
  confidence: number; // 0-1
}

// --- Scanner Types ---

export type ScanType = 'BULLISH_MOMENTUM' | 'BEARISH_MOMENTUM' | 'VOLUME_SHOCKER' | 'NARROW_CPR' | 'OVERSOLD' | 'OVERBOUGHT';

export interface ScannerResult {
  id: string;
  symbol: string;
  type: ScanType;
  signalStrength: number; // 0-100
  description: string;
  timestamp: string;
  tags: string[]; // e.g., ["Swing", "Risk:High"]
  timeframe: '15m' | '1H' | '1D' | '1W';
}

// --- Basket Types ---

export interface Basket {
  id: string;
  name: string;
  description: string;
  cagr: number;
  minAmount: number;
  volatility: 'LOW' | 'MEDIUM' | 'HIGH';
  stocks: { symbol: string; weight: number }[];
}

// --- Technical Analysis Types ---

export type SignalDirection = 'BULLISH' | 'BEARISH' | 'NEUTRAL';
export type FundamentalDirection = 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';

export interface TechnicalIndicator {
  name: string;
  value: number | string;
  signal: SignalDirection;
}

export interface TABucket {
  id: string;
  name: string;
  score: number; // 0-100
  direction: SignalDirection;
  summary: string;
  indicators: TechnicalIndicator[];
}

export type CPRWidth = 'NARROW' | 'AVERAGE' | 'WIDE';
export type CPRRelationship = 'HIGHER_VALUE' | 'LOWER_VALUE' | 'OVERLAPPING_HIGHER' | 'OVERLAPPING_LOWER' | 'INSIDE_VALUE' | 'OUTSIDE_VALUE' | 'UNCHANGED';

export interface CPRLevels {
  pivot: number;
  tc: number;
  bc: number;
  width: CPRWidth;
  relationship?: CPRRelationship; // Relationship to previous day
}

export interface TAReport {
  symbol: string;
  overallScore: number;
  overallDirection: SignalDirection;
  summary: string;
  cpr: CPRLevels | null;
  buckets: {
    trend: TABucket;
    momentum: TABucket;
    volatility: TABucket;
    supportResistance: TABucket;
    marketStructure: TABucket;
    volume: TABucket;
  };
  timestamp: string;
}

// --- Fundamental Analysis Types ---

export interface FundamentalMetric {
  name: string;
  value: string;
  benchmark?: string;
  status: FundamentalDirection;
}

export interface FABucket {
  id: string;
  name: string;
  score: number;
  direction: FundamentalDirection;
  summary: string;
  metrics: FundamentalMetric[];
}

export interface FAReport {
  symbol: string;
  overallScore: number; // 0-100
  overallDirection: FundamentalDirection;
  summary: string;
  buckets: {
    profitability: FABucket;
    growth: FABucket;
    financialHealth: FABucket;
    cashFlow: FABucket;
    valuation: FABucket;
    capitalAllocation: FABucket;
    businessQuality: FABucket;
    risk: FABucket;
  };
}

export interface ConvictionReport {
  symbol: string;
  technicalScore: number;
  fundamentalScore: number;
  convictionScore: number; // Weighted Average
  verdict: 'STRONG BUY' | 'BUY' | 'ACCUMULATE' | 'HOLD' | 'REDUCE' | 'SELL' | 'AVOID';
  action: string;
  reasoning: string[];
  regime: MarketRegime;
}

// --- Intelligence Context Types (Situation Awareness) ---

export interface MarketPulse {
  regime: MarketRegime;
  advanceDeclineRatio: number; // e.g., 1.5
  topSector: string;
  laggardSector: string;
  vix: number;
}

export interface OptionRadarItem {
  id: string;
  symbol: string;
  insight: string; // "High IV", "Long Buildup"
  value: string; // "IV 45%", "OI +12%"
  sentiment: 'BULLISH' | 'BEARISH';
}

export interface FailedSignal {
  id: string;
  symbol: string;
  signal: string;
  failureReason: string;
}

export interface PortfolioChange {
  id: string;
  symbol: string;
  type: 'TECHNICAL' | 'FUNDAMENTAL' | 'RISK';
  description: string;
  impact: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
}

export interface ExploreIntelligence {
    pulse: MarketPulse;
    scans: ScannerResult[];
    baskets: Basket[];
    optionsRadar: OptionRadarItem[];
    failedSignals: FailedSignal[];
}

// --- Asset Intelligence (Orchestrator Output) ---

import type { DebateVerdict } from './domain/advice/advice.types';
import type { AggregateSentiment } from './domain/sentiment/sentiment.engine';
import type { QualityReport } from './domain/fundamentals/quality.engine';

// --- ESG (Sustainalytics via Yahoo esgScores) ---

export interface EsgScores {
  totalEsg: number; // ESG *risk* score — LOWER is better
  environmentScore: number;
  socialScore: number;
  governanceScore: number;
  controversyLevel: number; // 0-5
  performance?: string; // e.g. 'AVG_PERF'
}

// --- News & Sentiment ---

export interface NewsHeadline {
  title: string;
  link: string;
  source: string;
  publishedAt: string; // ISO ('' when the feed gave no date)
  sentimentScore: number; // -1..1 from the lexicon engine
}

export interface SymbolNewsSentiment {
  symbol: string;
  items: NewsHeadline[];
  sentiment: AggregateSentiment;
  fetchedAt: string;
}

export interface AssetIntelligence {
  symbol: string;
  type: InstrumentType; // Added to distinguish asset classes
  price: number;
  
  // Instrument Specific Data
  stockData?: StockData;
  mfData?: MutualFundData; 
  
  // Analysis Engines (Optional based on type)
  technical?: TAReport;
  fundamental?: FAReport;
  conviction?: ConvictionReport;
  regime?: MarketRegime;
  // AI adversarial debate verdict (advisory; absent when AI is offline)
  debate?: DebateVerdict;
  // Headlines + lexicon sentiment (absent when the news feed is unreachable)
  news?: SymbolNewsSentiment;
  // Piotroski-style 9-point quality checklist over the fundamentals snapshot
  quality?: QualityReport;
  // Sustainalytics ESG risk scores (absent when Yahoo has no coverage)
  esg?: EsgScores;

  lastUpdated: string;
}

// --- Rebalancing Types ---

export interface TargetAllocation {
    equity: number;
    debt: number;
    gold: number;
    cash: number;
}

export interface DriftMetric {
    assetClass: keyof TargetAllocation;
    current: number;
    target: number;
    drift: number; // Percentage points deviation
    severity: 'LOW' | 'MODERATE' | 'HIGH';
}

export interface ActionAlternative {
    symbol: string;
    name: string;
    reason: string;
}

export interface RebalanceAction {
    id: string;
    type: 'BUY' | 'SELL';
    symbol: string;
    assetClass: string;
    amount: number;
    quantity?: number; // Exact shares/units to trade (SELLs of held assets)
    rate?: number; // Price/NAV the quantity was computed at
    reason: string;
    taxImpact?: number;
    alternatives?: ActionAlternative[]; // New: Suggestions for substitution
    isManual?: boolean; // New: Flag for manually added rows
}

export interface RebalanceSimulation {
    id: string;
    profileName: string;
    totalDriftScore: number; // 0-100
    metrics: DriftMetric[];
    actions: RebalanceAction[];
    projectedTaxImpact: number;
    volatilityReduction: number; // % reduction in portfolio beta/volatility
    status: 'BALANCED' | 'DRIFTING' | 'CRITICAL';
}

// --- EXPLORE REBALANCE TYPES (NEW) ---

export type RebalanceSuggestionType = 'SWITCH' | 'BUY' | 'SELL';

export interface RebalanceSuggestion {
    id: string;
    type: RebalanceSuggestionType;
    assetClass: string;
    
    // Switch specific
    fromSymbol?: string;
    toSymbol?: string;
    
    // Buy/Sell specific
    symbol?: string;
    
    amount: number;
    confidenceScore: number;
    reason: string;
    impact: {
        riskDelta: number; // % Change in portfolio beta/risk
        taxEst: number;
    };
    tags: string[];
}

export type ExploreContextMode = 'MARKET' | 'PORTFOLIO';

// **NEW**: Intent to carry from Explore -> Analyze
export interface RebalanceIntent {
    source: 'EXPLORE';
    suggestion: RebalanceSuggestion;
}

// --- Trading & Broker Types ---

export type OrderSide = 'BUY' | 'SELL';
export type OrderProduct = 'CNC' | 'MIS' | 'NRML'; // CNC=Delivery, MIS=Intraday, NRML=F&O Carry
export type OrderType = 'MARKET' | 'LIMIT' | 'SL' | 'SL-M';
export type OrderStatus = 'PENDING' | 'EXECUTED' | 'REJECTED' | 'CANCELLED';

export interface BrokerCapabilities {
  equity: boolean;
  derivatives: boolean; // F&O
  commodity: boolean;
  marginFunding: boolean;
  bracketOrders: boolean; // GTT/CO/BO
}

export interface BrokerProfile {
  id: string;
  name: string;
  logo: string;
  connected: boolean;
  funds: number;
  capabilities: BrokerCapabilities;
}

// Abstracted Trade Intent - Decouples UI from Broker API
export interface TradeIntent {
  symbol: string;
  side: OrderSide;
  product: OrderProduct;
  type: OrderType;
  quantity: number;
  price?: number;
  triggerPrice?: number;
  isDerivative: boolean;
}

export interface TradeOrder {
  id: string;
  symbol: string;
  side: OrderSide;
  product: OrderProduct;
  type: OrderType;
  quantity: number;
  price: number;
  triggerPrice?: number;
  status: OrderStatus;
  timestamp: string;
}

// --- NEW: Unified Execution Types ---

export type ExecutionPanelMode = 'ORDER' | 'RATE' | 'AMOUNT';

export interface BasketItem {
    id: string;
    symbol: string;
    type: InstrumentType;
    price: number;
    weight: number; // Percentage 0-100 (for Amount mode)
    locked?: boolean; // If true, weight is fixed
}

export interface ExecutionPreview {
    items: {
        symbol: string;
        action: OrderSide;
        quantity: number;
        estimatedPrice: number;
        estimatedTotal: number;
    }[];
    totalValue: number;
    estimatedCharges: number;
    marginRequired: number;
    projectedImpact?: {
        equityExposureDelta: number; // % change
        cashBalanceDelta: number;
    }
}

// --- PERIOD & TIME TYPES ---

export type PeriodType = 'FY' | 'QTR' | 'MONTH' | 'CUSTOM';

export interface PeriodContext {
  type: PeriodType;
  label: string; // e.g., "FY 2023-24" or "Q1 FY24"
  startDate: string; // ISO Date YYYY-MM-DD
  endDate: string; // ISO Date YYYY-MM-DD
  fyLabel?: string; // Optional: The FY context this period belongs to (e.g., '2023-24')
}

// --- F&O Analytics Types ---

export interface Greeks {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
}

export interface OptionContract {
  strike: number;
  type: 'CE' | 'PE';
  price: number;
  change: number;
  oi: number; // Open Interest
  oiChange: number;
  volume: number;
  iv: number; // Implied Volatility
  greeks: Greeks;
}

export interface OptionChainRow {
  strike: number;
  ce: OptionContract;
  pe: OptionContract;
}

// --- Tax Types ---

export type TaxAssetClass = 'EQUITY' | 'DEBT' | 'FNO';
export type TaxTerm = 'STCG' | 'LTCG' | 'BUSINESS'; // Short Term, Long Term, Business Income

export interface TaxHarvestOpportunity {
  symbol: string;
  quantity: number;
  unrealizedLoss: number;
  potentialTaxSave: number;
  term: TaxTerm;
  expiryDate?: string; // Date by which to sell
  detail?: string; // full instruction: exact qty, rate, amount, offsets
}

// Gain harvesting: realize LTCG inside the annual exemption at 0% tax
export interface TaxGainHarvestOpportunity {
  symbol: string;
  quantity: number;
  rate: number;
  amount: number;
  gainRealized: number;
  taxSaved: number;
  detail: string;
}

export interface CapitalGainEntry {
  id: string;
  symbol: string;
  buyDate: string;
  sellDate: string;
  quantity: number;
  buyPrice: number;
  sellPrice: number;
  pnl: number;
  assetClass: TaxAssetClass;
  term: TaxTerm;
}

export interface TaxSummary {
  period: PeriodContext; // Updated from simple financialYear string
  estimatedTotalTax: number;
  
  realizedSTCG: number;
  realizedLTCG: number;
  businessIncome: number; // F&O
  
  taxLiabilitySTCG: number;
  taxLiabilityLTCG: number;
  taxLiabilityBusiness: number;

  lossCarryForward: {
    stcg: number;
    ltcg: number;
    business: number;
  };

  harvestingOpportunities: TaxHarvestOpportunity[];
  gainHarvestingOpportunities?: TaxGainHarvestOpportunity[];
  history: CapitalGainEntry[];
}

// --- REPORT SYSTEM TYPES ---

export type ReportType = 'MARKET_SCAN' | 'ASSET_DEEP_DIVE' | 'PORTFOLIO_HEALTH';

export interface ReportMetric {
  label: string;
  value: string | number;
  delta?: string | number; // Change from last run
  status: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
}

export interface ReportSection {
  title: string;
  content: string; // Summary text
  items?: any[]; // Dynamic list (Scans, Holdings, etc.)
}

export interface AnalysisReport {
  id: string;
  type: ReportType;
  title: string;
  generatedAt: string;
  confidenceScore: number; // 0-100
  summary: string;
  metrics: ReportMetric[];
  sections: ReportSection[];
  tags: string[];
}

// --- CAPITAL & RISK TYPES ---

export interface MarginScenario {
  dropPercentage: number;
  projectedEquity: number;
  marginCallRisk: 'NONE' | 'POSSIBLE' | 'LIKELY';
  marginUtilisation: number;
}

export interface ExposureBreakdown {
  equityCash: number;
  equityMargin: number;
  fnoMargin: number;
  debtCash: number;
}

export interface CapitalSnapshot {
  ownCash: number; // Free cash in broker
  investedOwnCapital: number; // Cash used in positions
  marginUsed: number; // Borrowed/Leveaged amount
  totalExposure: number; // Total market value of positions
  leverageRatio: number; // Total Exposure / (Own Cash + Invested Own)
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  buyingPower: number;
  scenarios: MarginScenario[];
  breakdown: ExposureBreakdown;
}
