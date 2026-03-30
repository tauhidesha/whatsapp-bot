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
    const { messages } = state;
    const lastMessage = messages[messages.length - 1];

    const systemPrompt = `Kamu adalah AI Classifier untuk Bengkel BosMat Studio.
Tugas: Tentukan INTENT dari pesan user terakhir.

JAWAB HANYA DENGAN SATU KATA KUNCI BERIKUT:
- BOOKING_SERVICE: User ingin pesan jadwal, servis, cat, repaint, atau detailing.
- GENERAL_INQUIRY: User tanya harga, lokasi, jam buka, atau konsultasi umum.
- HUMAN_HANDOVER: User minta bicara dengan orang/admin atau terlihat marah/frustasi.
- OTHER: Tidak masuk kategori di atas.

Chat Terakhir:
"${lastMessage.content}"`;

    try {
        const response = await model.invoke([
            new SystemMessage(systemPrompt),
            new HumanMessage(lastMessage.content)
        ]);

        const intent = response.content.trim().toUpperCase();
        
        // Validasi intent
        const validIntents = ['BOOKING_SERVICE', 'GENERAL_INQUIRY', 'HUMAN_HANDOVER', 'OTHER'];
        const finalIntent = validIntents.includes(intent) ? intent : 'GENERAL_INQUIRY';

        return { intent: finalIntent };

    } catch (error) {
        console.error('[classifierNode] Error:', error);
        return { intent: 'GENERAL_INQUIRY' };
    }
}

module.exports = { classifierNode };
