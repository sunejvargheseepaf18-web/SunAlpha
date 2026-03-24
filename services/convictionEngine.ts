
import { ConvictionReport, FAReport, TAReport, MarketRegime } from '../types';

export const generateConviction = (
  ta: TAReport,
  fa: FAReport,
  regime: MarketRegime
): ConvictionReport => {
  
  const reasoning: string[] = [];

  // 1. Determine Weights based on Regime
  let taWeight = 0.4;
  let faWeight = 0.4;
  let regimeBias = 0; // -10 to +10 adjustment

  // Logic: In high volatility, Fundamentals matter less short-term, Technicals matter more for survival.
  // In sideways market, Fundamentals matter more for accumulation.
  if (regime.volatility === 'HIGH_EXPANSION') {
    taWeight = 0.6;
    faWeight = 0.4; // Normalized later
    reasoning.push("High volatility detected: Technicals weighted higher.");
  } else if (regime.trend === 'SIDEWAYS') {
    faWeight = 0.6;
    taWeight = 0.4;
    reasoning.push("Range-bound market: Fundamentals weighted higher for accumulation.");
  }

  // 2. Regime Bias
  if (regime.trend.includes('BULL')) regimeBias += 5;
  if (regime.trend.includes('BEAR')) regimeBias -= 5;

  // 3. CPR Context (KSG Logic)
  if (ta.cpr) {
    if (ta.cpr.relationship === 'HIGHER_VALUE') {
        regimeBias += 5;
        reasoning.push("Higher Value CPR confirms bullish structure.");
    } else if (ta.cpr.relationship === 'LOWER_VALUE') {
        regimeBias -= 5;
        reasoning.push("Lower Value CPR confirms bearish structure.");
    }
    
    if (ta.cpr.width === 'NARROW') {
        reasoning.push("Narrow CPR: Expect trending move.");
    }
  }

  // 4. Calculate Final Score
  const rawScore = (ta.overallScore * taWeight) + (fa.overallScore * faWeight);
  const normalizedWeight = taWeight + faWeight;
  let finalScore = (rawScore / normalizedWeight) + regimeBias;
  
  // Clamp
  finalScore = Math.max(0, Math.min(100, finalScore));
  finalScore = Math.round(finalScore);

  // 5. Verdict Generation
  let verdict: ConvictionReport['verdict'] = 'HOLD';
  let action = 'Wait for clarity.';

  if (finalScore >= 80) {
    verdict = 'STRONG BUY';
    action = 'Aggressive entry allowed. All engines aligned.';
  } else if (finalScore >= 65) {
    verdict = 'BUY';
    action = 'Good levels to enter. Maintain stop loss.';
  } else if (finalScore >= 50) {
    verdict = 'ACCUMULATE';
    action = 'Buy in dips. Fundamentals are good but trend is weak.';
  } else if (finalScore >= 35) {
    verdict = 'REDUCE';
    action = 'Trim positions on rallies.';
  } else {
    verdict = 'SELL';
    action = 'Exit immediately. Structure broken.';
  }

  // Add specific engine reasons
  if (fa.overallScore > 70) reasoning.push("Fundamentals are strong (High Quality).");
  if (ta.overallScore < 40) reasoning.push("Technical trend is currently weak.");

  return {
    symbol: ta.symbol,
    technicalScore: ta.overallScore,
    fundamentalScore: fa.overallScore,
    convictionScore: finalScore,
    verdict,
    action,
    reasoning,
    regime
  };
};
