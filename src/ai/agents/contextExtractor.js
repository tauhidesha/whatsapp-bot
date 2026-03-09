// File: src/ai/agents/contextExtractor.js
// Background context extraction agent.
// Mengekstrak fakta penting dari setiap exchange percakapan secara otomatis.
// Non-blocking, fire & forget — tidak mengganggu main response flow.

const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { HumanMessage } = require('@langchain/core/messages');
const { mergeAndSaveContext } = require('../utils/mergeCustomerContext.js');
const { getLangSmithCallbacks } = require('../utils/langsmith.js');

// Model ringan untuk extraction — cepat dan murah
const EXTRACTOR_MODEL = 'gemini-3.1-flash-lite-preview';

const EXTRACTOR_PROMPT = `Kamu adalah data extractor untuk sistem CRM bengkel motor.
Tugasmu HANYA mengekstrak fakta dari percakapan.
Kembalikan JSON saja. Tidak ada teks lain. Tidak ada markdown.

Percakapan:
User: "{userMessage}"
AI: "{aiReply}"

Ekstrak ke format ini (isi null jika tidak disebutkan):
{
  "motor_model": null,
  "motor_year": null,
  "motor_color": null,
  "motor_condition": null,
  "target_service": null,
  "service_detail": null,
  "budget_signal": null,
  "intent_level": null,
  "said_expensive": null,
  "asked_price": null,
  "asked_availability": null,
  "shared_photo": null,
  "preferred_day": null,
  "location_hint": null
}

Aturan ketat:
- Hanya isi field yang BENAR-BENAR ada di percakapan ini
- Jangan inferensi atau mengarang
- intent_level: "hot" jika tanya jadwal/mau datang, 
                "warm" jika tanya harga/detail,
                "cold" jika hanya lihat-lihat
- budget_signal: "ketat" jika bilang mahal/kemahalan,
                 "oke" jika setuju harga,
                 null jika tidak disebut`;

/**
 * Build the prompt with actual conversation data.
 */
function buildPrompt(userMessage, aiReply) {
    return EXTRACTOR_PROMPT
        .replace('{userMessage}', (userMessage || '').replace(/"/g, '\\"'))
        .replace('{aiReply}', (aiReply || '').replace(/"/g, '\\"'));
}

/**
 * Parse JSON from model response, handling potential markdown wrapping.
 */
function parseExtractedJSON(text) {
    if (!text || typeof text !== 'string') return null;

    let cleaned = text.trim();

    // Remove markdown code block if present
    if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }

    try {
        const parsed = JSON.parse(cleaned);
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
            return parsed;
        }
        return null;
    } catch (error) {
        console.warn('[Context] Failed to parse extracted JSON:', error.message);
        console.warn('[Context] Raw response:', text.substring(0, 200));
        return null;
    }
}

/**
 * Extract context from a single user+AI exchange and save to Firestore.
 * This function is designed to be called in a fire-and-forget manner.
 * 
 * @param {string} userMessage - The user's message
 * @param {string} aiReply - The AI's response
 * @param {string} senderNumber - Sender identifier
 */
async function extractAndSaveContext(userMessage, aiReply, senderNumber) {
    if (!userMessage || !senderNumber) return;

    try {
        const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.warn('[Context] No API key available for context extraction');
            return;
        }

        const model = new ChatGoogleGenerativeAI({
            model: EXTRACTOR_MODEL,
            temperature: 0,
            apiKey,
        });

        const prompt = buildPrompt(userMessage, aiReply);

        const callbacks = getLangSmithCallbacks('contextExtractor', {
            metadata: {
                sender_number: senderNumber,
                model: EXTRACTOR_MODEL
            },
            tags: ['context-extractor', EXTRACTOR_MODEL]
        });

        const response = await model.invoke([
            new HumanMessage(prompt),
        ], {
            runName: 'contextExtractor',
            callbacks,
        });

        const responseText = typeof response.content === 'string'
            ? response.content
            : (Array.isArray(response.content)
                ? response.content.map(c => c.text || c).join('')
                : String(response.content));

        const extracted = parseExtractedJSON(responseText);

        if (!extracted) {
            console.warn('[Context] Extraction returned invalid data, skipping save');
            return;
        }

        console.log('[Context] Extracted:', JSON.stringify(extracted));

        await mergeAndSaveContext(senderNumber, extracted);
    } catch (error) {
        console.warn('[Context] Extraction failed:', error.message);
        throw error; // Re-throw so caller's .catch() can log it
    }
}

module.exports = {
    extractAndSaveContext,
    // Exported for testing
    buildPrompt,
    parseExtractedJSON,
    EXTRACTOR_MODEL,
};
