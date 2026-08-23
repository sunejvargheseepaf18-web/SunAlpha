
// Curriculum + glossary (pure data). Every lesson teaches a concept the app
// itself surfaces — the Holdings advice, the journal's R-multiples, the tax
// harvesting cards, the Analyze metrics — so learning and using converge.

import { LifecycleStage } from '../../types';
import { LessonDef } from './education.engine';

export const LESSON_CATALOG: LessonDef[] = [
  // --- EXPLORER: what am I even looking at ---
  {
    id: 'exp-stocks-mf',
    stage: LifecycleStage.EXPLORER,
    topic: 'Basics',
    title: 'Stocks, Mutual Funds & NAV',
    summary: 'What you actually own, and how each is priced.',
    body:
      'A stock is a share of one company, priced continuously while the market is open. ' +
      'A mutual fund pools money across many holdings; you own units priced once a day at the ' +
      'Net Asset Value (NAV) declared after market close. That is why your fund values in ' +
      'SunAlpha update once daily ("NAV as of...") while stocks tick live.',
    quiz: [
      {
        question: 'How often is a mutual fund NAV declared?',
        options: ['Every second', 'Once a day, after market close', 'Once a week', 'Only when you sell'],
        answerIndex: 1,
        explanation: 'NAV is computed once per trading day after close — funds do not tick intraday.'
      },
      {
        question: 'Owning a mutual fund unit means you own…',
        options: ['One company', 'A slice of a pooled portfolio', 'A bond', 'Nothing until you redeem'],
        answerIndex: 1,
        explanation: 'A unit is a proportional slice of everything the fund holds.'
      }
    ]
  },
  {
    id: 'exp-sip',
    stage: LifecycleStage.EXPLORER,
    topic: 'Basics',
    title: 'SIPs & Compounding',
    summary: 'Why boring monthly investing wins.',
    body:
      'A SIP invests a fixed amount every month regardless of price — you automatically buy more ' +
      'units when markets are cheap and fewer when expensive (rupee-cost averaging). Returns then ' +
      'compound: gains earn gains. Time in the market beats timing the market for most investors.',
    quiz: [
      {
        question: 'In a SIP, when do you automatically buy MORE units?',
        options: ['When prices are high', 'When prices are low', 'The same amount always', 'Only in bull markets'],
        answerIndex: 1,
        explanation: 'A fixed rupee amount buys more units at lower NAVs — that is rupee-cost averaging.'
      },
      {
        question: 'Compounding means…',
        options: ['Adding money monthly', 'Gains earning further gains', 'Diversifying', 'Lower fees'],
        answerIndex: 1,
        explanation: 'Reinvested gains themselves grow — the curve steepens with time.'
      }
    ]
  },
  // --- LEARNER: mechanics & risk ---
  {
    id: 'lrn-risk-sizing',
    stage: LifecycleStage.LEARNER,
    topic: 'Risk',
    title: 'Position Sizing & Stops',
    summary: 'Decide your loss before your entry.',
    body:
      'Professionals size positions from risk, not conviction: risk a fixed slice of capital ' +
      '(say 1%) per trade, with a stop placed a volatility-scaled distance away (SunAlpha uses ' +
      '2x ATR). If the stop is hit you lose exactly the planned 1R. Wild stocks get smaller ' +
      'positions automatically — that is the whole trick.',
    quiz: [
      {
        question: 'With ₹10,00,000 capital, 1% risk and a ₹20 stop distance, position size is…',
        options: ['50 shares', '500 shares', '5,000 shares', '10,000 shares'],
        answerIndex: 1,
        explanation: '₹10,000 risk budget ÷ ₹20 per-share risk = 500 shares.'
      },
      {
        question: 'If a stock becomes twice as volatile (ATR doubles), your position should…',
        options: ['Double', 'Stay the same', 'Halve', 'Go to zero'],
        answerIndex: 2,
        explanation: 'Same risk budget over twice the stop distance means half the shares.'
      }
    ]
  },
  {
    id: 'lrn-journal',
    stage: LifecycleStage.LEARNER,
    topic: 'Discipline',
    title: 'The Journal: Expectancy & R-Multiples',
    summary: 'Measure behavior, not just P&L.',
    body:
      'An R-multiple states a trade’s result in units of what you planned to risk: +2R doubled ' +
      'your risk, -1R hit the stop. Expectancy is the average outcome per trade — a 40% win rate is ' +
      'excellent if wins average +2R and losses -1R. SunAlpha’s journal auto-records paper sells; ' +
      'tag your setups and mistakes to see which behavior pays.',
    quiz: [
      {
        question: 'You risked ₹5,000 and made ₹10,000. The trade was…',
        options: ['+0.5R', '+1R', '+2R', '+10R'],
        answerIndex: 2,
        explanation: 'Profit ÷ planned risk = 10,000 / 5,000 = +2R.'
      },
      {
        question: 'A 40% win rate can still be profitable when…',
        options: ['Never', 'Average win is much larger than average loss', 'Fees are zero', 'You trade more often'],
        answerIndex: 1,
        explanation: 'Expectancy = winRate x avgWin - lossRate x avgLoss. Payoff size can carry a low hit rate.'
      }
    ]
  },
  // --- BUILDER: portfolio construction & tax ---
  {
    id: 'bld-diversify',
    stage: LifecycleStage.BUILDER,
    topic: 'Portfolio',
    title: 'Concentration & Rebalancing',
    summary: 'Why one stock at 63% of your portfolio is a problem.',
    body:
      'Diversification is the only free lunch: uncorrelated holdings smooth the ride without ' +
      'proportionally cutting returns. A single holding above ~20-25% of the portfolio dominates ' +
      'your outcome — SunAlpha flags this and computes the exact trim. Rebalancing back to targets ' +
      'systematically sells high and buys low.',
    quiz: [
      {
        question: 'A single stock is 63% of your portfolio. The main issue is…',
        options: ['Taxes', 'One company drives most of your outcome', 'Brokerage costs', 'Nothing, if it is a good company'],
        answerIndex: 1,
        explanation: 'Concentration risk: whatever the company does, your portfolio does.'
      },
      {
        question: 'Mechanical rebalancing tends to…',
        options: ['Buy high, sell low', 'Sell high, buy low', 'Increase concentration', 'Avoid all losses'],
        answerIndex: 1,
        explanation: 'Trimming what grew and topping up what lagged is systematic sell-high/buy-low.'
      }
    ]
  },
  {
    id: 'bld-tax',
    stage: LifecycleStage.BUILDER,
    topic: 'Tax',
    title: 'STCG, LTCG & Harvesting',
    summary: 'Hold 12 months, use the ₹1.25L exemption.',
    body:
      'Equity gains within 12 months are short-term (20% tax); beyond 12 months they are long-term ' +
      '(12.5%, with the first ₹1.25 lakh each FY tax-free). Loss harvesting books losses to offset ' +
      'gains; gain harvesting realizes long-term profits inside the exemption at 0% tax and rebuys ' +
      'to step up your cost basis. SunAlpha’s Tax view computes both with exact quantities.',
    quiz: [
      {
        question: 'Listed equity held 14 months and sold at a gain is taxed as…',
        options: ['STCG at 20%', 'LTCG at 12.5% above the ₹1.25L exemption', 'Business income', 'Tax-free always'],
        answerIndex: 1,
        explanation: 'Beyond 12 months it is LTCG; the annual ₹1.25L exemption applies first.'
      },
      {
        question: 'Short-term capital losses can offset…',
        options: ['Nothing', 'Only STCG', 'Both STCG and LTCG', 'Salary income'],
        answerIndex: 2,
        explanation: 'STCL sets off against both gain types; LTCL only against LTCG.'
      }
    ]
  },
  // --- OPTIMIZER: reading the analytics ---
  {
    id: 'opt-metrics',
    stage: LifecycleStage.OPTIMIZER,
    topic: 'Analytics',
    title: 'Sharpe, Drawdown & VaR',
    summary: 'Read the Performance & Risk strip like a pro.',
    body:
      'Return alone is meaningless without the risk taken. Sharpe divides excess return by ' +
      'volatility (above ~1 is good); Sortino penalizes only downside. Max drawdown is the worst ' +
      'peak-to-trough fall — the pain you must sit through. VaR(95) is the daily loss your worst ' +
      '5% of days exceed; CVaR averages those worst days. SunAlpha computes all of these from ' +
      'your real feed history on the Analyze tab.',
    quiz: [
      {
        question: 'Two funds return 12%. Fund A has volatility 10%, Fund B 25%. Better risk-adjusted?',
        options: ['Fund A', 'Fund B', 'Identical', 'Cannot say'],
        answerIndex: 0,
        explanation: 'Same return over less volatility = higher Sharpe.'
      },
      {
        question: 'Daily VaR(95) of -2% means…',
        options: [
          'You lose 2% every day',
          'On the worst 5% of days, losses exceed 2%',
          'Maximum possible loss is 2%',
          'Average daily loss is 2%'
        ],
        answerIndex: 1,
        explanation: 'VaR is a tail threshold, not a guarantee — CVaR tells you how bad the tail averages.'
      }
    ]
  }
];

// --- Glossary — terms the app's UI actually shows ---

export const GLOSSARY: Record<string, string> = {
  NAV: 'Net Asset Value — a mutual fund’s per-unit price, declared once per trading day after close.',
  SIP: 'Systematic Investment Plan — investing a fixed amount monthly, buying more units when prices are low.',
  STCG: 'Short-term capital gains — equity held ≤ 12 months, taxed at 20%.',
  LTCG: 'Long-term capital gains — equity held > 12 months, taxed at 12.5% above the ₹1.25 lakh annual exemption.',
  CAGR: 'Compound annual growth rate — the smoothed yearly return that turns start value into end value.',
  Volatility: 'Annualized standard deviation of daily returns — how bumpy the ride is.',
  Sharpe: 'Excess return per unit of volatility. Above ~1 is good; below 0 means cash beat you.',
  Sortino: 'Like Sharpe, but only downside volatility counts — upside swings are not punished.',
  'Max Drawdown': 'Worst peak-to-trough fall of the portfolio — the loss you had to sit through.',
  Beta: 'Sensitivity to the benchmark: 1 moves with NIFTY, >1 amplifies it, <1 dampens it.',
  VaR: 'Value at Risk (95%): the daily loss your worst 5% of days exceed.',
  CVaR: 'Conditional VaR / expected shortfall: the average loss across those worst 5% of days.',
  'R-multiple': 'A trade’s P&L in units of the risk you planned: -1R = stop hit, +2R = twice the risk earned.',
  Expectancy: 'Average P&L per trade over many trades — the number that decides if a method makes money.',
  ATR: 'Average True Range — the typical daily price movement; SunAlpha places stops at 2x ATR.',
  OI: 'Open Interest — outstanding derivative contracts at a strike; where positions are concentrated.',
  IV: 'Implied Volatility — the market’s priced-in expectation of future movement, per option.',
  CPR: 'Central Pivot Range — pivot levels from the prior session used as intraday support/resistance.'
};
