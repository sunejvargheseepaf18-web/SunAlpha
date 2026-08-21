
import { GoogleGenAI, Type } from "@google/genai";
import { SYSTEM_INSTRUCTION } from './prompts';

const API_KEY = process.env.API_KEY;

// Initialize GenAI
let ai: GoogleGenAI | null = null;
if (API_KEY) {
    try {
        ai = new GoogleGenAI({ apiKey: API_KEY });
    } catch (e) {
        console.error("Failed to initialize GenAI", e);
    }
}

const MODEL_FAST = "gemini-3-flash-preview";
const MODEL_SMART = "gemini-3-pro-preview";

/**
 * Tiered orchestration: expensive tokens plan, cheap tokens type.
 * - PLANNER (smart model): decompose goals, write specs, judge worker output.
 *   It reads digests and one-page worker results, never raw payloads.
 * - WORKER (fast model): draft, classify, summarize, explain — the bulk work.
 * Every call defaults to WORKER; escalate to PLANNER only for decomposition
 * or judging. Output is capped per role so results stay one page.
 */
export type AIRole = 'PLANNER' | 'WORKER';

const MODEL_BY_ROLE: Record<AIRole, string> = {
    PLANNER: MODEL_SMART,
    WORKER: MODEL_FAST
};

const OUTPUT_TOKEN_BUDGET: Record<AIRole, number> = {
    PLANNER: 2048,
    WORKER: 1024 // one-page result contract
};

export interface AIResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}

/**
 * Generic JSON generator using Gemini
 */
export async function generateJSON<T>(
    prompt: string,
    responseSchema?: any,
    role: AIRole = 'WORKER'
): Promise<AIResponse<T>> {
    if (!ai) return { success: false, error: "AI_OFFLINE" };

    try {
        const response = await ai.models.generateContent({
            model: MODEL_BY_ROLE[role],
            contents: prompt,
            config: {
                systemInstruction: SYSTEM_INSTRUCTION,
                responseMimeType: "application/json",
                responseSchema: responseSchema,
                temperature: 0.2, // Low temp for deterministic logic
                maxOutputTokens: OUTPUT_TOKEN_BUDGET[role],
            }
        });

        const text = response.text;
        if (!text) throw new Error("Empty response");

        const data = JSON.parse(text) as T;
        return { success: true, data };

    } catch (e: any) {
        console.error("LLM JSON Error:", e);
        return { success: false, error: e.message };
    }
}

/**
 * Text generator for explanations
 */
export async function generateText(prompt: string, role: AIRole = 'WORKER'): Promise<string | null> {
    if (!ai) return null;

    try {
        const response = await ai.models.generateContent({
            model: MODEL_BY_ROLE[role],
            contents: prompt,
            config: {
                systemInstruction: SYSTEM_INSTRUCTION,
                temperature: 0.7, // Higher temp for creative explanation
                maxOutputTokens: OUTPUT_TOKEN_BUDGET[role],
            }
        });
        return response.text || null;
    } catch (e) {
        console.error("LLM Text Error:", e);
        return null;
    }
}

/**
 * Spec-first delegation: a worker never receives a free-form dump. It gets a
 * brief a cheap model can't misread — role, one-line task, acceptance
 * criteria, and pre-digested context — and returns one page, not one thread.
 */
export interface WorkerBrief {
    role: string; // e.g. "Trade Critic"
    task: string; // one-line intent
    acceptanceCriteria: string[]; // what a correct answer must satisfy
    context: Record<string, string>; // values already passed through digest()
}

export async function runWorkerBrief<T>(
    brief: WorkerBrief,
    responseSchema?: any
): Promise<AIResponse<T>> {
    const prompt = [
        `ROLE: ${brief.role}`,
        `TASK: ${brief.task}`,
        `ACCEPTANCE CRITERIA:`,
        ...brief.acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`),
        `CONTEXT (digested):`,
        ...Object.entries(brief.context).map(([k, v]) => `- ${k}: ${v}`),
        `Return only what the schema asks for. Keep the result to one page.`
    ].join('\n');
    return generateJSON<T>(prompt, responseSchema, 'WORKER');
}
