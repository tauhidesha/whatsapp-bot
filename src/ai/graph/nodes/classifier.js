const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { SystemMessage, HumanMessage } = require('@langchain/core/messages');

const model = new ChatGoogleGenerativeAI({
    model: process.env.AI_MODEL || 'gemini-1.5-flash',
    maxOutputTokens: 1024,
    temperature: 0,
});

/**
 * Node: classifier
 * Menganalisis pesan terakhir untuk menentukan intent.
 */
async function classifierNode(state) {
    console.log('--- [CLASSIFIER_NODE] Starting ---');
    const { messages } = state;
    const lastMessage = messages[messages.length - 1];

    const systemPrompt = `Kamu adalah AI Classifier untuk Bengkel BosMat Studio.
Tugas: Tentukan INTENT dari pesan user terakhir.

JAWAB HANYA DENGAN SATU KATA KUNCI BERIKUT:
- GREETING: User menyapa (Halo, P, Hai, Assalamualaikum, dll).
- CONSULTATION: User membuka percakapan untuk bertanya-tanya secara umum, tanya promo, atau minta konsultasi tanpa detail teknis (misal: "mau tanya-tanya", "konsultasi dong", "ada promo ga?").
- BOOKING_SERVICE: User ingin pesan jadwal, servis, cat, repaint, atau detailing. Termasuk pertanyaan harga yang disertai niat servis.
- GENERAL_INQUIRY: User tanya harga spesifik, lokasi, jam buka, atau konsultasi teknis yang jelas pertanyaannya (misal: "cat Nmax berapa?", "lokasi di mana?").
- HUMAN_HANDOVER: User minta bicara dengan orang/admin atau terlihat marah/frustasi.
- OTHER: Tidak masuk kategori di atas.

CONTOH KLASIFIKASI:
"Halo Zoya!" → GREETING
"malam kak mau tanya tanya kak" → CONSULTATION
"Mau repaint NMax bodi kasar, berapa?" → BOOKING_SERVICE
"pagi kak mau konsultasi" → CONSULTATION
"ada promo ga kak?" → CONSULTATION
"Apa bedanya coating glossy sama doff?" → GENERAL_INQUIRY
"Bisa langsung besok?" → BOOKING_SERVICE
"Lokasi bengkel di mana ya?" → GENERAL_INQUIRY
"panggil admin" → HUMAN_HANDOVER
"warna standar aja" → BOOKING_SERVICE
"nggak ngerti kak" → BOOKING_SERVICE

Chat Terakhir:
"${lastMessage.content}"`;

    try {
        const response = await model.invoke([
            new SystemMessage(systemPrompt),
            new HumanMessage(lastMessage.content)
        ]);

        let intent = response.content.trim().toUpperCase();
        
        // --- LOGIKA CONTINUATION INTENT ---
        // Jika sedang dalam flow booking dan user membalas pendek (jawaban), tetap di BOOKING_SERVICE
        const prevIntent = state.intent;
        const isShortReply = lastMessage.content.split(' ').length <= 15;
        const containsBookingKeywords = /warna|cat|nmax|scoopy|pcx|vespa|vario|repaint|detailing|coating|poles/i.test(lastMessage.content);

        if (prevIntent === 'BOOKING_SERVICE' && (isShortReply || containsBookingKeywords)) {
             // Cek jika model salah klasifikasi ke OTHER, GREETING, atau GENERAL_INQUIRY padahal ini flow booking
             if (['OTHER', 'GREETING', 'GENERAL_INQUIRY'].includes(intent)) {
                 console.log(`[CLASSIFIER_NODE] Intent recovery: Overriding ${intent} to BOOKING_SERVICE due to flow continuation.`);
                 intent = 'BOOKING_SERVICE';
             }
        }

        // Validasi intent
        const validIntents = ['GREETING', 'CONSULTATION', 'BOOKING_SERVICE', 'GENERAL_INQUIRY', 'HUMAN_HANDOVER', 'OTHER'];
        const finalIntent = validIntents.includes(intent) ? intent : 'GENERAL_INQUIRY';

        console.log(`[CLASSIFIER_NODE] Intent detected: ${finalIntent} (Prev: ${prevIntent})`);
        return { 
            intent: finalIntent,
            metadata: { ...state.metadata, prevIntent }
        };

    } catch (error) {
        console.error('[classifierNode] Error:', error);
        return { intent: 'GENERAL_INQUIRY' };
    }
}

module.exports = { classifierNode };
