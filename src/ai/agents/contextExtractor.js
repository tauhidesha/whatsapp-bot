// File: src/ai/agents/contextExtractor.js
// Background context extraction agent.
// Mengekstrak fakta penting dari setiap exchange percakapan secara otomatis.
// Non-blocking, fire & forget — tidak mengganggu main response flow.

const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { HumanMessage } = require('@langchain/core/messages');
const { mergeAndSaveContext, getCustomerContext } = require('../utils/mergeCustomerContext.js');
const { getLangSmithCallbacks } = require('../utils/langsmith.js');

// Model ringan untuk extraction — cepat dan murah
const EXTRACTOR_MODEL = 'gemini-3.1-flash-lite-preview';

const EXTRACTOR_PROMPT = `Kamu adalah data extractor untuk sistem CRM bengkel motor.
Tugasmu ada dua:
1. Mengekstrak fakta dari percakapan, termasuk harga yang dikutip oleh AI ke pelanggan.
2. Membuat/memperbarui ringkasan obrolan (conversation_summary).

Kembalikan JSON saja. Tidak ada teks lain. Tidak ada markdown.

Waktu Sekarang: {timestamp}
Ringkasan Obrolan Sebelumnya:
{currentSummary}

Percakapan Saat Ini:
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
  "location_hint": null,
  "quoted_services": [],
  "quoted_total_normal": null,
  "quoted_total_bundling": null,
  "quoted_at": null,
  "conversation_stage": null,
  "last_ai_action": null,
  "upsell_offered": null,
  "upsell_accepted": null,
  "conversation_summary": "Ringkasan SINGKAT dan PADAT tentang apa yang diobrolkan sejauh ini, gabungan dari ringkasan sebelumnya dan percakapan saat ini."
}

Aturan ketat:
- Hanya isi field fakta yang BENAR-BENAR ada di percakapan ini
- Jangan inferensi atau mengarang fakta
- conversation_stage: 
    "greeting"     → baru mulai
    "qualifying"   → AI sedang tanya motor/kebutuhan
    "consulting"   → AI sudah kasih info layanan/harga
    "upselling"    → AI sedang tawarkan layanan tambahan
    "booking"      → sedang proses jadwal
    "closing"      → user sudah setuju, tinggal konfirmasi
    "done"         → booking terkonfirmasi
- last_ai_action: apa yang terakhir dilakukan AI ("asked_motor_type", "quoted_price", "offered_upsell", "offered_booking", etc)
- upsell_offered: true jika AI sudah tawarkan upsell di conversation ini
- upsell_accepted: true/false/null
- quoted_services: Hanya isi jika AI memberikan penawaran harga spesifik di "AI: {aiReply}". Format: [{"name": "Nama Layanan", "price": 1200000}]
- quoted_total_normal: Total harga sebelum diskon.
- quoted_total_bundling: Harga paket/bundling jika ditawarkan oleh AI.
- quoted_at: Isi dengan "{timestamp}" jika ada quoted_services yang baru diberikan.
- intent_level: "hot" jika tanya jadwal/mau datang, 
                "warm" jika tanya harga/detail,
                "cold" jika hanya lihat-lihat
- budget_signal: "ketat" jika bilang mahal/kemahalan,
                 "oke" jika setuju harga,
                 null jika tidak disebut
- conversation_summary: WAJIB diisi. Gabungkan intisari "Ringkasan Obrolan Sebelumnya" (jika ada) dengan "Percakapan Saat Ini" menjadi 1-2 kalimat padat. Fokus pada apa yang diinginkan/ditanyakan customer.`;

/**
 * Build the prompt with actual conversation data.
 */
function buildPrompt(userMessage, aiReply, currentSummary = '', timestamp = '') {
    return EXTRACTOR_PROMPT
        .replace('{timestamp}', timestamp || new Date().toISOString())
        .replace(/\{timestamp\}/g, timestamp || new Date().toISOString())
        .replace('{currentSummary}', currentSummary || '(Belum ada ringkasan)')
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

        const currentCtx = await getCustomerContext(senderNumber);
        const currentSummary = currentCtx?.conversation_summary || '';
        const timestamp = new Date().toISOString();

        const prompt = buildPrompt(userMessage, aiReply, currentSummary, timestamp);

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
