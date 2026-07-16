const { z } = require('zod');
const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { extractTextFromContent, getMessageType } = require('../graph/utils/sanitizeMessages');
/**
 * Memory Extractor for Zoya V2
 * Uses Gemini to extract Identity, Relationship, and Sales memory from messages.
 */

const FactState = z.enum(['KNOWN', 'UNDECIDED', 'NOT_APPLICABLE']);

const FactSchema = (description) => z.object({
    value: z.string().nullable().describe("Nilai fakta (jika diketahui), atau null."),
    state: FactState.describe("Status: KNOWN jika nilai eksplisit, UNDECIDED jika kustomer bilang belum tau/bingung, NOT_APPLICABLE jika tidak relevan.")
}).optional().describe(description);

const MemorySchema = z.object({
    motor: FactSchema("Merek/model motor (misal: NMax, Beat)."),
    color: FactSchema("Warna cat (misal: merah candy). JIKA bilang 'asli', isi value 'Standar Pabrik/Original' (KNOWN)."),
    part: FactSchema("Bagian motor yang dikerjakan (misal: full bodi, bodi halus, velg)."),
    objection: FactSchema("Keberatan/komplain kustomer (misal: 'mahal', 'jauh')."),
    services: z.array(z.string()).optional().describe("Daftar layanan (misal: 'Repaint Bodi Halus')."),
    velgCondition: FactSchema("Kondisi velg (misal: 'masih ori', 'grepes').")
});

async function extractMemory(state) {
    console.log('[Memory Extractor] Extracting memory features with LLM...');
    
    const messages = state.messages || [];
    const lastUserMessageObj = [...messages].reverse().find(m => {
        const type = getMessageType(m) || 'user';
        return type === 'human' || type === 'user';
    });
    const lastUserContent = lastUserMessageObj ? (lastUserMessageObj.kwargs?.content || lastUserMessageObj.content) : null;
    const lastUserMessage = lastUserContent ? extractTextFromContent(lastUserContent) : '';

    if (!lastUserMessage) {
        return {};
    }

    const llm = new ChatGoogleGenerativeAI({
        model: process.env.AI_MODEL || 'gemini-2.5-flash-lite',
        temperature: 0,
        maxOutputTokens: 256,
        apiKey: process.env.GOOGLE_API_KEY
    }).withStructuredOutput(MemorySchema);

    try {
        const extraction = await llm.invoke([
            ['system', 'Anda adalah sistem ekstraksi memori. Ekstrak data relevan dari pesan kustomer terakhir. Jika informasi tidak ada sama sekali, jangan output field tersebut (biarkan undefined). Jika kustomer spesifik bilang belum tau/bingung, output state UNDECIDED.'],
            ['human', lastUserMessage]
        ]);
        
        const updates = {};

        if (extraction.motor || extraction.color) {
            updates.vehicle = { ...state.vehicle };
            if (extraction.motor) updates.vehicle.model = extraction.motor;
            if (extraction.color) updates.vehicle.paintType = extraction.color;
        }

        if (extraction.objection || extraction.part || (extraction.services && extraction.services.length > 0) || extraction.velgCondition) {
            updates.consultation = { ...state.consultation };
            updates.consultation.knownFacts = { ...(updates.consultation.knownFacts || {}) };
            
            if (extraction.objection) {
                updates.consultation.knownFacts.commonObjection = extraction.objection;
            }
            if (extraction.velgCondition) {
                updates.consultation.knownFacts.velgCondition = extraction.velgCondition;
            }
            if (extraction.part) {
                updates.consultation.knownFacts.partToRepaint = extraction.part;
                
                // Regex fallback to ensure requestedServices captures the specific repaint flow
                const partLower = extraction.part.value ? extraction.part.value.toLowerCase() : '';
                let specificService = null;
                if (partLower.includes('halus')) specificService = 'Repaint Bodi Halus';
                else if (partLower.includes('kasar')) specificService = 'Repaint Bodi Kasar';
                else if (partLower.includes('velg') || partLower.includes('pelg')) specificService = 'Repaint Velg';
                else if (partLower.includes('full')) specificService = 'Repaint Full Bodi';

                if (specificService) {
                    extraction.services = extraction.services || [];
                    if (!extraction.services.includes(specificService)) {
                        extraction.services.push(specificService);
                    }
                }
            }
            
            if (extraction.services && extraction.services.length > 0) {
                const existingServices = state.consultation?.requestedServices || [];
                const newServices = [...new Set([...existingServices, ...extraction.services])];
                updates.consultation.requestedServices = newServices;
            }
        }

        return updates;
    } catch (error) {
        console.error('[Memory Extractor] LLM Error:', error);
        return {};
    }
}

module.exports = {
    extractMemory
};
