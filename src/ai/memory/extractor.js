const { z } = require('zod');
const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { extractTextFromContent, getMessageType } = require('../graph/utils/sanitizeMessages');
/**
 * Memory Extractor for Zoya V2
 * Uses Gemini to extract Identity, Relationship, and Sales memory from messages.
 */

const FactState = z.enum(['KNOWN', 'UNDECIDED', 'NOT_APPLICABLE']);

const FactSchema = (description) => z.object({
    value: z.string().optional().describe("Nilai fakta (jika diketahui), atau hilangkan field ini jika null/tidak tahu."),
    state: FactState.describe("Status: KNOWN jika nilai eksplisit, UNDECIDED jika kustomer bilang belum tau/bingung, NOT_APPLICABLE jika tidak relevan.")
}).optional().describe(description);

const MemorySchema = z.object({
    motor: FactSchema("Merek/model motor (misal: NMax, Beat)."),
    color: FactSchema("Warna cat (misal: merah candy). JIKA bilang 'asli', isi value 'Standar Pabrik/Original' (KNOWN)."),
    part: FactSchema("Bagian motor yang dikerjakan (misal: full bodi, bodi halus, velg)."),
    objection: FactSchema("Keberatan/komplain kustomer (misal: 'mahal', 'jauh')."),
    services: z.array(z.string()).optional().describe("Daftar layanan (misal: 'Repaint Bodi Halus')."),
    velgCondition: FactSchema("Kondisi cat velg sebelumnya (misal: 'masih ori pabrik', 'udah pernah dicat/repaint', 'belum pernah'). JANGAN isi ini dengan baret/lecet, fokus HANYA pada status cat asli/repaint."),
    hasDamage: z.boolean().nullable().optional().describe("Apakah customer menyebutkan ada kerusakan (retak, patah, baret dalam)? Pengecualian disengaja: tidak menggunakan format {value, status} karena fact yes/no tidak memiliki state UNDECIDED."),
    visualSummary: z.string().optional().describe("Ringkasan visual 1-2 kalimat mengenai apa yang terlihat di gambar/foto yang dikirim user. HANYA isi jika user mengirim foto.")
});

async function extractMemory(state) {
    console.log('[Memory Extractor] Extracting memory features with LLM...');
    
    const messages = state.messages || [];
    const lastUserMessageObj = [...messages].reverse().find(m => {
        const type = getMessageType(m) || 'user';
        return type === 'human' || type === 'user';
    });
    const lastUserContent = lastUserMessageObj ? (lastUserMessageObj.kwargs?.content || lastUserMessageObj.content) : null;
    const lastUserMessageText = lastUserContent ? extractTextFromContent(lastUserContent) : '';

    if (!lastUserContent) {
        return {};
    }

    // LangChain JS has a bug where it checks if the modelName includes "1.5" or "vision" to allow images.
    // User requested to use .env
    const llm = new ChatGoogleGenerativeAI({
        model: process.env.VISION_MODEL || process.env.AI_MODEL || 'gemini-1.5-flash-latest',
        temperature: 0,
        maxOutputTokens: 512,
        apiKey: process.env.GOOGLE_API_KEY,
        responseMimeType: "application/json"
    });

    try {
        const { SystemMessage, HumanMessage } = require('@langchain/core/messages');
        const systemPrompt = `Anda adalah sistem ekstraksi memori. Ekstrak data relevan dari pesan (dan gambar/foto jika ada) kustomer terakhir.
ATURAN UPDATE STATE: HANYA ekstrak dan output field yang SECARA EKSPLISIT dibahas di pesan atau terlihat jelas di gambar terakhir kustomer. JIKA ada foto, WAJIB isi visualSummary.
Jika suatu informasi TIDAK DIBAHAS, JANGAN masukkan field tersebut ke dalam output JSON.
Format JSON output yang diharapkan:
{
  "motor": "Merek/model motor",
  "color": "Warna cat",
  "part": "Bagian motor",
  "objection": "Keberatan kustomer",
  "services": ["layanan 1"],
  "velgCondition": "Kondisi velg",
  "hasDamage": true/false,
  "visualSummary": "Ringkasan visual 1-2 kalimat (jika ada gambar)"
}
Field yang bernilai string (kecuali visualSummary, services, hasDamage) bisa berupa objek: { "value": "...", "state": "KNOWN|UNDECIDED|NOT_APPLICABLE" }`;

        const response = await llm.invoke([
            new SystemMessage(systemPrompt),
            new HumanMessage({ content: lastUserContent })
        ]);
        
        const rawResponseText = response.content;
        const cleanedJson = rawResponseText.replace(/```json\n?|```/g, '').trim();
        const extraction = JSON.parse(cleanedJson);
        console.log('[Memory Extractor] Extracted Data:', JSON.stringify(extraction));
        
        const updates = {};

        if (extraction.motor || extraction.color) {
            updates.vehicle = { ...state.vehicle };
            if (extraction.motor) updates.vehicle.model = extraction.motor;
            if (extraction.color) updates.vehicle.paintType = extraction.color;
        }

        if (extraction.objection || extraction.part || (extraction.services && extraction.services.length > 0) || extraction.velgCondition || extraction.hasDamage !== undefined) {
            updates.consultation = { ...state.consultation };
            updates.consultation.knownFacts = { ...(updates.consultation.knownFacts || {}) };
            
            if (extraction.objection) {
                updates.consultation.knownFacts.commonObjection = extraction.objection;
            }
            if (extraction.velgCondition) {
                updates.consultation.knownFacts.velgCondition = extraction.velgCondition;
            }
            if (extraction.hasDamage !== undefined && extraction.hasDamage !== null) {
                updates.consultation.knownFacts.hasDamage = extraction.hasDamage;
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

        if (extraction.visualSummary) {
            updates.metadata = { ...(state.metadata || {}) };
            updates.metadata.visualSummary = extraction.visualSummary;
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
