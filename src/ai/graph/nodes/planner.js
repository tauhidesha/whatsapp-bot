const { z } = require('zod');
const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { buildPlannerPrompt } = require('../../prompts/promptBuilder');

/**
 * Planner Node for Zoya V2
 * Uses Gemini to evaluate the state and output a structured JSON decision.
 */

const PlannerSchema = z.object({
    decision: z.object({
        goal: z.enum(['COLLECT_INFO', 'PRICE_ESTIMATION', 'BOOKING', 'UPSELL', 'ESCALATION', 'GENERAL_SUPPORT', 'HANDLE_OBJECTION']).describe("Tujuan utama percakapan saat ini dari sisi customer."),
        strategy: z.enum(['EDUCATE', 'BUILD_TRUST', 'EMPATHIZE', 'CLARIFY', 'URGENCY', 'CROSS_SELL']).describe("Strategi komunikasi untuk composer."),
        buyerStage: z.enum(['Exploring', 'Comparing', 'Interested', 'Ready', 'Booking']).describe("Stage pembeli saat ini.")
    }),
    execution: z.object({
        nextAction: z.object({
            type: z.enum(['ASK_MISSING_FACTS', 'EXECUTE_TOOL', 'PROVIDE_INFO', 'CLOSING', 'UPSELL']),
            priority: z.number().optional()
        }).describe("Aksi berikutnya yang harus diambil."),
        toolIntent: z.enum(['NONE', 'GET_PRICE', 'BOOK', 'CHECK_BOOKING', 'ESCALATE', 'NOTIFY', 'ANSWER']).describe("Intent untuk memanggil external tools. Isi dengan 'NONE' jika tidak butuh."),
        parameters: z.record(z.any()).optional().describe("Parameter untuk tool (jika toolIntent != NONE). Misalnya motor, scope, paintColor, dll.")
    }),
    conversation: z.object({
        responseLength: z.enum(['SHORT', 'MEDIUM', 'LONG']).describe("Panjang balasan yang diinstruksikan ke Composer."),
        informationPriority: z.array(z.object({
            type: z.enum(['summary', 'price', 'education', 'question', 'empathy', 'upsell']),
            priority: z.number()
        })).describe("Urutan informasi yang harus disampaikan Composer.")
    }),
    reasoning: z.object({
        reason: z.string().describe("Alasan kenapa planner mengambil keputusan ini."),
        confidence: z.object({
            buyerStage: z.number().min(0).max(1),
            goal: z.number().min(0).max(1),
            nextAction: z.number().min(0).max(1)
        }).describe("Tingkat keyakinan Planner terhadap keputusannya."),
        goalStatus: z.object({
            completedFacts: z.array(z.string()).describe("Fakta/syarat yang sudah berhasil dikumpulkan."),
            remainingFacts: z.array(z.object({
                field: z.string().describe("Nama field/fakta yang hilang (misal: 'wheelCondition', 'paintType', 'bookingDate')."),
                priority: z.number().describe("Prioritas (1 = paling utama, makin besar makin tidak prioritas)."),
                reason: z.string().describe("Alasan logis kenapa fakta ini dibutuhkan sekarang.")
            })).describe("Daftar fakta yang belum diketahui (belum ada di knownFacts) yang HARUS ditanyakan ke user.")
        }).describe("Status progres dari goal saat ini, dihitung dengan membandingkan knownFacts vs requiredFacts."),
        decisionTrace: z.object({
            goal: z.string(),
            usedFacts: z.array(z.string())
        }).describe("Trace keputusan untuk keperluan debugging engineer.")
    })
});

const { derivePlannerContext } = require('../../utils/plannerContext');

async function plannerNode(state) {
    console.log('[Planner Node] Analyzing State with LLM...');
    
    const promptText = buildPlannerPrompt(state);
    
    // Inisialisasi model
    const llm = new ChatGoogleGenerativeAI({
        model: process.env.AI_MODEL || 'gemini-flash-latest',
        temperature: 0,
        maxOutputTokens: 1024,
        apiKey: process.env.GOOGLE_API_KEY
    }).withStructuredOutput(PlannerSchema);

    try {
        const decision = await llm.invoke([
            ['system', 'Anda adalah Zoya V2 Planner, otak dari sistem AI assistant Bosmat. Anda HARUS mengembalikan format JSON.'],
            ['human', promptText]
        ]);
        
        // Deterministik context kalkulasi
        decision.plannerContext = derivePlannerContext({ ...state, planner: decision });

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
        const fallbackDecision = {
            decision: {
                goal: 'GENERAL_SUPPORT',
                strategy: 'CLARIFY',
                buyerStage: 'Exploring'
            },
            execution: {
                nextAction: {
                    type: 'ASK_MISSING_FACTS',
                    priority: 1
                },
                toolIntent: 'NONE',
                parameters: {}
            },
            conversation: {
                responseLength: 'MEDIUM',
                informationPriority: [
                    { type: 'summary', priority: 1 },
                    { type: 'question', priority: 2 }
                ]
            },
            reasoning: {
                reason: error.message,
                confidence: { buyerStage: 0, goal: 0, nextAction: 0 },
                goalStatus: {
                    completedFacts: [],
                    remainingFacts: []
                },
                decisionTrace: {
                    goal: 'Fallback',
                    usedFacts: []
                }
            }
        };
        
        fallbackDecision.plannerContext = derivePlannerContext({ ...state, planner: fallbackDecision });

        return {
            planner: fallbackDecision
        };
    }
}

module.exports = {
    plannerNode
};
