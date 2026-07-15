const { z } = require('zod');
const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { extractTextFromContent } = require('../graph/utils/sanitizeMessages');

/**
 * Memory Extractor for Zoya V2
 * Uses Gemini to extract Identity, Relationship, and Sales memory from messages.
 */

const MemorySchema = z.object({
    motor: z.string().optional().describe("Merek atau model motor yang disebut kustomer (misal: NMax, Beat, PCX). Jika tidak ada, kosongi."),
    color: z.string().optional().describe("Warna yang disebut kustomer. Jika tidak ada, kosongi."),
    objection: z.string().optional().describe("Keberatan atau komplain yang disebut kustomer (misal: 'belum gajian', 'mahal', 'jauh'). Jika tidak ada, kosongi.")
});

async function extractMemory(state) {
    console.log('[Memory Extractor] Extracting memory features with LLM...');
    
    const messages = state.messages || [];
    const lastUserMessageObj = [...messages].reverse().find(m => {
        const type = m._getType ? m._getType() : (m.type || m.role);
        return type === 'human' || type === 'user';
    });
    const lastUserMessage = lastUserMessageObj ? extractTextFromContent(lastUserMessageObj.content) : '';

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
            if (extraction.motor) updates.vehicle.brand = extraction.motor; // Simplify logic: just map motor to brand for now
            if (extraction.color) updates.vehicle.paintType = extraction.color;
        }

        if (extraction.objection) {
            updates.consultation = { ...state.consultation };
            updates.consultation.knownFacts = {
                ...(updates.consultation.knownFacts || {}),
                commonObjection: extraction.objection
            };
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
