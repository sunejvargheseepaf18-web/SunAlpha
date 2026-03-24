
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
    responseSchema?: any
): Promise<AIResponse<T>> {
    if (!ai) return { success: false, error: "AI_OFFLINE" };

    try {
        const response = await ai.models.generateContent({
            model: MODEL_FAST,
            contents: prompt,
            config: {
                systemInstruction: SYSTEM_INSTRUCTION,
                responseMimeType: "application/json",
                responseSchema: responseSchema,
                temperature: 0.2, // Low temp for deterministic logic
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
export async function generateText(prompt: string): Promise<string | null> {
    if (!ai) return null;

    try {
        const response = await ai.models.generateContent({
            model: MODEL_FAST,
            contents: prompt,
            config: {
                systemInstruction: SYSTEM_INSTRUCTION,
                temperature: 0.7, // Higher temp for creative explanation
            }
        });
        return response.text || null;
    } catch (e) {
        console.error("LLM Text Error:", e);
        return null;
    }
}
