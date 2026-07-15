const { z } = require('zod');
const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { buildPlannerPrompt } = require('../../prompts/promptBuilder');

/**
 * Planner Node for Zoya V2
 * Uses Gemini to evaluate the state and output a structured JSON decision.
 */

const PlannerSchema = z.object({
    goal: z.string().describe("Tujuan utama percakapan saat ini dari sisi customer."),
    reason: z.string().describe("Alasan kenapa planner mengambil keputusan ini."),
    nextAction: z.string().describe("Aksi berikutnya yang harus diambil. Harus salah satu dari: 'ASK', 'RECOMMEND', 'GET_INFORMATION', 'SHOW_PRICE', 'CREATE_BOOKING', 'UPDATE_BOOKING', 'ESCALATE', 'WAIT', 'FINISH'."),
    capability: z.string().optional().describe("Nama capability tool (misalnya 'pricing', 'booking_availability') jika dibutuhkan, atau kosongi jika tidak perlu tool."),
    strategy: z.string().describe("Strategi komunikasi untuk composer. Harus salah satu dari: 'EDUCATE', 'BUILD_TRUST', 'EMPATHIZE', 'CLARIFY', 'URGENCY', 'CROSS_SELL'."),
    confidence: z.number().min(0).max(1).describe("Tingkat keyakinan Planner terhadap keputusannya (0.0 - 1.0).")
});

async function plannerNode(state) {
    console.log('[Planner Node] Analyzing State with LLM...');
    
    const promptText = buildPlannerPrompt(state);
    
    // Inisialisasi model
    const llm = new ChatGoogleGenerativeAI({
        model: 'gemini-2.5-flash',
        temperature: 0,
        maxOutputTokens: 1024,
        apiKey: process.env.GOOGLE_API_KEY
    }).withStructuredOutput(PlannerSchema);

    try {
        const decision = await llm.invoke([
            ['system', 'Anda adalah Zoya V2 Planner, otak dari sistem AI assistant Bosmat. Anda HARUS mengembalikan format JSON.'],
            ['human', promptText]
        ]);
        
        console.log('[Planner Node] Decision:', decision);
        
        return {
            planner: decision,
            analytics: {
                plannerRuns: (state.analytics?.plannerRuns || 0) + 1
            }
        };
    } catch (error) {
        console.error('[Planner Node] LLM Error:', error);
        // Fallback behavior if LLM fails
        return {
            planner: {
                goal: 'Fallback due to LLM error',
                reason: error.message,
                nextAction: 'ASK',
                capability: null,
                strategy: 'CLARIFY',
                confidence: 0
            }
        };
    }
}

module.exports = {
    plannerNode
};
