// File: src/ai/utils/followupPersonalizer.js
const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const admin = require('firebase-admin');

let personalizerModel = null;

function getModel() {
    if (!personalizerModel) {
        const API_KEY = process.env.GOOGLE_API_KEY;
        const MODEL_NAME = process.env.AI_MODEL || 'gemini-2.0-flash';

        if (!API_KEY) {
            throw new Error('GOOGLE_API_KEY is not set in environment variables');
        }

        personalizerModel = new ChatGoogleGenerativeAI({
            apiKey: API_KEY,
            model: MODEL_NAME,
            temperature: 0.7,
        });
    }
    return personalizerModel;
}

/**
 * Generate 1-sentence personalized follow-up draft based on chat history.
 */
async function generatePersonalizedDraft(name, label, chatHistory) {
    const historyText = chatHistory
        .map(m => `${m.sender === 'user' ? 'Customer' : 'AI'}: ${m.text}`)
        .join('\n');

    const prompt = `
Context: Anda adalah Zoya, asisten AI dari Bosmat Repaint & Detailing Studio.
Tugas: Buat 1 kalimat sapaan follow-up yang sangat personal dan pendek (maks 20 kata) untuk pelanggan bernama "${name}".
Label Pelanggan: ${label}

Riwayat Chat Terakhir:
${historyText || '(Tidak ada riwayat chat)'}

Aturan:
1. Gunakan bahasa santai (panggil "Mas/Mbak", gunakan "Zoya").
2. Hubungkan dengan konteks pembicaraan terakhir jika ada (misal: "Gimana jadi repaint velgnya?").
3. Jika tidak ada konteks, berikan sapaan hangat sesuai labelnya.
4. JANGAN gunakan placeholder seperti [Nama]. Langsung teks pesan.
5. Hanya hasilkan 1 kalimat.

Hasilkan draft pesan WA:`.trim();

    try {
        const model = getModel();
        const response = await model.invoke(prompt);
        return response.content.trim().replace(/^"(.*)"$/, '$1'); // Remove accidental quotes
    } catch (error) {
        console.error(`[followupPersonalizer] Error for ${name}:`, error.message);
        // Fallback template
        if (label.includes('Hot')) return `Halo ${name}! Kemarin sempat nanya soal treatment motor ya mas? Slot buat besok masih ada nih, mau dipesenin sekalian?`;
        return `Halo ${name}, cuma mau sapa nih. Ada yang bisa Zoya bantu lagi buat motornya?`;
    }
}

/**
 * Fetch last N messages for a customer.
 */
async function getCustomerChatHistory(db, docId, limit = 5) {
    try {
        const snapshot = await db.collection('directMessages')
            .doc(docId)
            .collection('messages')
            .orderBy('timestamp', 'desc')
            .limit(limit)
            .get();

        const messages = [];
        snapshot.forEach(doc => messages.push(doc.data()));
        return messages.reverse(); // Chronological order
    } catch (error) {
        console.error(`[followupPersonalizer] Failed to fetch history for ${docId}:`, error);
        return [];
    }
}

module.exports = { generatePersonalizedDraft, getCustomerChatHistory };
