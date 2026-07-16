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
    capability: z.string().describe("Nama capability tool. HARUS DIPILIH DARI: 'pricing', 'booking_availability', 'create_booking', 'update_booking', 'studio_info', 'promo', 'notification', 'calculate_home_service_fee'. Isi dengan 'NONE' jika tidak butuh."),
    strategy: z.string().describe("Strategi komunikasi untuk composer. Harus salah satu dari: 'EDUCATE', 'BUILD_TRUST', 'EMPATHIZE', 'CLARIFY', 'URGENCY', 'CROSS_SELL'."),
    responseLength: z.enum(['SHORT', 'MEDIUM', 'LONG']).describe("Panjang balasan yang diinstruksikan ke Composer."),
    confidence: z.number().min(0).max(1).describe("Tingkat keyakinan Planner terhadap keputusannya (0.0 - 1.0)."),
    missingFacts: z.array(z.object({
        field: z.string().describe("Nama field/fakta yang hilang (misal: 'wheelCondition', 'paintShade', 'bookingDate')."),
        reason: z.string().describe("Alasan logis kenapa fakta ini dibutuhkan sekarang."),
        priority: z.number().describe("Prioritas (1 = paling utama, makin besar makin tidak prioritas).")
    })).describe("Daftar fakta yang belum diketahui (belum ada di knownFacts) yang HARUS ditanyakan ke user."),
    decisionTrace: z.object({
        goal: z.string(),
        usedFacts: z.array(z.string()),
        missingFacts: z.array(z.string())
    }).describe("Trace keputudan untuk keperluan debugging engineer (bukan untuk user).")
});

async function plannerNode(state) {
    console.log('[Planner Node] Analyzing State with LLM...');
    
    const promptText = buildPlannerPrompt(state);
    
    // Inisialisasi model
    const llm = new ChatGoogleGenerativeAI({
        model: process.env.AI_MODEL || 'gemini-2.5-flash-lite',
        temperature: 0,
        maxOutputTokens: 1024,
        apiKey: process.env.GOOGLE_API_KEY
    }).withStructuredOutput(PlannerSchema);

    try {
        const decision = await llm.invoke([
            ['system', 'Anda adalah Zoya V2 Planner, otak dari sistem AI assistant Bosmat. Anda HARUS mengembalikan format JSON.'],
            ['human', promptText]
        ]);
        
        const result = {
            planner: decision,
            analytics: {
                plannerRuns: (state.analytics?.plannerRuns || 0) + 1
            }
        };
        console.log('[Planner Node] Output:', JSON.stringify(result, null, 2));
        return result;
    } catch (error) {
        console.error('[Planner Node] LLM Error:', error);
        // Fallback behavior if LLM fails
        return {
            planner: {
                goal: 'Fallback due to LLM error',
                reason: error.message,
                nextAction: 'ASK',
                capability: 'NONE',
                strategy: 'CLARIFY',
                responseLength: 'MEDIUM',
                confidence: 0,
                missingFacts: [],
                decisionTrace: {
                    goal: 'Fallback',
                    usedFacts: [],
                    missingFacts: []
                }
            }
        };
    }
}

module.exports = {
    plannerNode
};
