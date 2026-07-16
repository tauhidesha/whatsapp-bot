const { z } = require('zod');
const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { extractTextFromContent, getMessageType } = require('../graph/utils/sanitizeMessages');
/**
 * Memory Extractor for Zoya V2
 * Uses Gemini to extract Identity, Relationship, and Sales memory from messages.
 */

const MemorySchema = z.object({
    motor: z.string().optional().describe("Merek atau model motor yang disebut kustomer (misal: NMax, Beat, PCX). Jika tidak ada, kosongi."),
    color: z.string().optional().describe("Warna atau jenis cat yang disebut kustomer (misal: merah candy, polos, mutiara). JIKA kustomer bilang 'asli', 'aslinya', 'standar', WAJIB isi dengan 'Standar Pabrik/Original'. Jika tidak ada warna, kosongi."),
    part: z.string().optional().describe("Bagian motor yang ingin dikerjakan (misal: full bodi, bodi halus, bodi kasar, velg). Jika tidak ada, kosongi."),
    objection: z.string().optional().describe("Keberatan atau komplain yang disebut kustomer (misal: 'belum gajian', 'mahal', 'jauh'). Jika tidak ada, kosongi."),
    services: z.array(z.string()).optional().describe("Daftar layanan yang di-request kustomer (misal: 'Repaint Bodi Halus', 'Repaint Velg', 'Detailing'). Jika tidak ada, kosongi.")
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
            ['system', 'Anda adalah sistem ekstraksi memori. Ekstrak data relevan dari pesan kustomer terakhir.'],
            ['human', lastUserMessage]
        ]);
        
        const updates = {};

        if (extraction.motor || extraction.color) {
            updates.vehicle = { ...state.vehicle };
            if (extraction.motor) updates.vehicle.model = extraction.motor;
            if (extraction.color) updates.vehicle.paintType = extraction.color;
        }

        if (extraction.objection || extraction.part || (extraction.services && extraction.services.length > 0)) {
            updates.consultation = { ...state.consultation };
            updates.consultation.knownFacts = { ...(updates.consultation.knownFacts || {}) };
            
            if (extraction.objection) {
                updates.consultation.knownFacts.commonObjection = extraction.objection;
            }
            if (extraction.part) {
                updates.consultation.knownFacts.partToRepaint = extraction.part;
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
