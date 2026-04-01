const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { SystemMessage, HumanMessage } = require('@langchain/core/messages');
const studioMetadata = require('../../constants/studioMetadata');

const model = new ChatGoogleGenerativeAI({
    model: process.env.AI_MODEL || 'gemini-flash-lite-latest',
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

    const systemPrompt = `# ROLE
Kamu adalah AI Intent Classifier untuk ${studioMetadata.name}.

# TASK
Tentukan SATU intent yang paling sesuai dari pesan terakhir user.

# CONSTRAINTS
- JAWAB HANYA DENGAN SATU KATA KUNCI kategori intent.
- JANGAN berikan penjelasan, tanda baca, atau karakter tambahan.
- JIKA user hanya menyapa (Halo, P, Assalamualaikum), WAJIB klasifikasikan sebagai **GREETING**.

# INTENT CATEGORIES
- **GREETING**: Sapaan awal (Halo, P, Assalamualaikum).
- **CONSULTATION**: Tanya promo atau tanya saran umum tanpa detail motor.
- **BOOKING_SERVICE**: Niat servis, tanya harga layanan tertentu, atau menjawab pertanyaan teknis AI.
- **GENERAL_INQUIRY**: Tanya lokasi, jam buka, kontak studio, atau **kebingungan mencari lokasi** (misal: "saya sudah di depan", "patokannya apa?", "sebelah mana?", "nyasar").
- **HUMAN_HANDOVER**: Minta bicara dengan admin manusia.
- **OTHER**: Di luar kategori di atas.

# INPUT DATA
Pesan Terakhir User: "${lastMessage.content}"`;

    try {
        // Process limited chat history with speaker labels (max 10 messages)
        const chatTranscript = messages.slice(-10).map(m => {
            const role = (m.type === 'human' || m.role === 'user') ? '[USER]' : '[AI]';
            return `${role}: ${m.content}`;
        }).join('\n');

        const response = await model.invoke([
            new SystemMessage(systemPrompt),
            new HumanMessage(`Berikut riwayat chat terakhir untuk konteks:\n${chatTranscript}\n\nPESAN TERAKHIR USER: "${lastMessage.content}"`)
        ]);

        let intent = response.content.trim().toUpperCase();
        
        // --- LOGIKA CONTINUATION INTENT ---
        // Jika sedang dalam flow booking dan user membalas pendek (jawaban), tetap di BOOKING_SERVICE
        const prevIntent = state.intent;
        const isShortReply = lastMessage.content.split(' ').length <= 15;
        const containsBookingKeywords = /warna|cat|nmax|scoopy|pcx|vespa|vario|repaint|detailing|coating|poles/i.test(lastMessage.content);

        if (prevIntent === 'BOOKING_SERVICE' && (isShortReply || containsBookingKeywords)) {
             // Cek jika model sudah klasifikasi ke GENERAL_INQUIRY tapi ini tanya studio info (lokasi/jam buka)
             // Jangan override jika user tanya spesifik tentang studio
             const studioKeywords = /lokasi|alamat|dimana|buka|tutup|istirahat|jam berapa|kontak|wa|map|maps|koordinat/i.test(lastMessage.content);
             
             if (['OTHER', 'GREETING', 'GENERAL_INQUIRY'].includes(intent)) {
                 if (intent === 'GENERAL_INQUIRY' && studioKeywords) {
                     console.log(`[CLASSIFIER_NODE] Keeping GENERAL_INQUIRY for studio info request.`);
                 } else {
                     console.log(`[CLASSIFIER_NODE] Intent recovery: Overriding ${intent} to BOOKING_SERVICE due to flow continuation.`);
                     intent = 'BOOKING_SERVICE';
                 }
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
