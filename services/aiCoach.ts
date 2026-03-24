
import { CoachMessage, LifecycleStage } from '../types';
import { generateJSON, generateText } from './ai/llm';
import { CRITIC_PROMPT_TEMPLATE, EXPLAINER_PROMPT_TEMPLATE } from './ai/prompts';
import { Type } from "@google/genai";

/**
 * The AI Coach acts as a behavioral guardrail.
 * It uses LLMs (Gemini) to analyze context, but falls back to
 * deterministic rules if the API is offline or fails.
 */

// Helper: Generates a random realistic delay to simulate "Thinking" if purely mocking, 
// but since we are calling an API, the network latency provides this naturally.
const thinkingDelay = () => new Promise(resolve => setTimeout(resolve, 600));

// Schema for Coach Message
const coachResponseSchema = {
    type: Type.OBJECT,
    properties: {
        shouldNudge: { type: Type.BOOLEAN },
        type: { type: Type.STRING, enum: ['GUIDANCE', 'WARNING', 'PRAISE', 'EXPLAINER'] },
        title: { type: Type.STRING },
        message: { type: Type.STRING },
        actionLabel: { type: Type.STRING }
    },
    required: ['shouldNudge', 'type', 'title', 'message']
};

export const getContextualNudge = async (
    context: 'TRADE_ENTRY' | 'DASHBOARD_REVIEW' | 'LOSS_ANALYSIS',
    lifecycleStage: LifecycleStage,
    metaData?: any
): Promise<CoachMessage | null> => {
    
    // 1. Try LLM Path
    const prompt = CRITIC_PROMPT_TEMPLATE(context, lifecycleStage, metaData?.intent || {}, metaData?.assetData || {});
    const aiResult = await generateJSON<any>(prompt, coachResponseSchema);

    if (aiResult.success && aiResult.data?.shouldNudge) {
        return {
            id: `ai-nudge-${Date.now()}`,
            type: aiResult.data.type,
            title: aiResult.data.title,
            message: aiResult.data.message,
            actionLabel: aiResult.data.actionLabel
        };
    }

    // 2. Fallback: Deterministic Rules (Offline Mode)
    await thinkingDelay();

    // FALLBACK A: PAPER TRADING ENTRY
    if (context === 'TRADE_ENTRY' && metaData?.mode === 'PAPER') {
        if (lifecycleStage === LifecycleStage.EXPLORER || lifecycleStage === LifecycleStage.LEARNER) {
            return {
                id: 'coach-paper-entry',
                type: 'GUIDANCE',
                title: 'Training Mode Active',
                message: "You are in Paper Mode. Treat this ₹10L as real money. Don't YOLO it all on one trade. Aim for consistent small gains."
            };
        }
    }

    // FALLBACK B: LIVE TRADE WARNING
    if (context === 'TRADE_ENTRY' && metaData?.mode === 'LIVE') {
        // If technicals are weak but user is buying
        if (metaData?.intent === 'BUY' && metaData?.assetScore < 40) {
            return {
                id: 'coach-warn-trend',
                type: 'WARNING',
                title: 'Counter-Trend Trade',
                message: "Technicals are weak (Score < 40). You are catching a falling knife. Ensure you have a strict Stop Loss."
            };
        }
        
        // If F&O for beginner
        if (metaData?.isDerivative && lifecycleStage !== LifecycleStage.OPTIMIZER) {
             return {
                id: 'coach-warn-fno',
                type: 'WARNING',
                title: 'High Risk Instrument',
                message: "F&O carries unlimited risk. As a Builder, focus on Equity delivery first. Only trade with < 5% of capital."
            };
        }
    }

    return null;
};

export const getAssetExplanation = async (symbol: string, score: number, regime?: any): Promise<string> => {
    // 1. Try LLM Path
    const prompt = EXPLAINER_PROMPT_TEMPLATE(symbol, { technical: score, fundamental: score }, regime);
    const text = await generateText(prompt);
    
    if (text) return text;

    // 2. Fallback
    if (score > 70) return `${symbol} shows strength. High institutional interest likely driving price. Good for momentum.`;
    if (score < 40) return `${symbol} is struggling. Sellers are dominant at higher levels. Wait for a reversal pattern.`;
    return `${symbol} is consolidating. No clear trend. Good for range-bound strategies or accumulation.`;
};
