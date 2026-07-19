const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { AIMessage } = require('@langchain/core/messages');
const { buildComposerPrompt } = require('../../prompts/promptBuilder');
const { prioritizeInformation } = require('../../response/prioritizer');

/**
 * Response Composer Node for Zoya V2
 * Uses Gemini to compose a natural language response based on the planner strategy and tool results.
 */

async function composerNode(state) {
    console.log('[Composer Node] Composing natural response with LLM...');
    
    // Pass the state through the Prioritizer middleware
    const prioritizedData = prioritizeInformation(state);
    
    const promptText = buildComposerPrompt(state, state.planner || {}, prioritizedData);
    
    // Inisialisasi model
    const llm = new ChatGoogleGenerativeAI({
        model: process.env.AI_MODEL || 'gemini-flash-latest',
        temperature: 0.7,
        maxOutputTokens: 512,
        apiKey: process.env.GOOGLE_API_KEY
    });

    try {
        const systemInstruction = `Anda adalah Zoya, konsultan sales dari Bosmat Garage. Anda ramah, profesional, menggunakan bahasa Indonesia santai (mas/kak), dan penuh empati. Jangan pernah terdengar seperti bot.

=== DECISION LOCK (STRICT COMPLIANCE) ===
Anda beroperasi sebagai COMPOSER dalam arsitektur sistem. Planner pusat sudah mengambil keputusan. 
Tugas mutlak Anda HANYA menyusun dan merender pesan natural berdasarkan instruksi Planner.

Anda DILARANG KERAS:
1. Mengambil keputusan sepihak (mengubah Goal, Strategy, atau Buyer Stage).
2. Menambahkan pertanyaan baru di luar array "Missing Facts" yang diberikan oleh Planner.
3. Mengarang/halusinasi harga, promo, atau spesifikasi layanan.
4. Melakukan hard-selling jika Planner menginstruksikan empati atau edukasi.

Fokuslah pada merangkai data yang disuapkan ke Anda menjadi satu pesan WhatsApp yang singkat, nyaman dibaca, dan tidak tumpang tindih.`;

        let responseText = '';
        let retryCount = 0;
        const maxRetries = 1;
        const priceRegex = /(Rp\s*[\d.,]+)|(\d+\s*(juta|ribu|jt|rb)an?)/i;
        
        const toolIntent = state.planner?.execution?.toolIntent || 'NONE';
        const hasPrioritizedData = !!prioritizedData;
        const hasToolResult = !!state.tool?.lastResult;
        const isPriceForbidden = toolIntent === 'NONE' || (!hasPrioritizedData && !hasToolResult);

        while (retryCount <= maxRetries) {
            let currentPrompt = promptText;
            if (retryCount > 0) {
                currentPrompt += `\n\nSISTEM WARNING: Pesan Anda sebelumnya menyebutkan angka/estimasi harga padahal Tool Result KOSONG! Anda DILARANG menyebutkan harga. Harap buat ulang pesan tanpa menyebutkan harga.`;
                console.log(`[Composer Node] Retrying due to price hallucination (Attempt ${retryCount})...`);
            }

            const response = await llm.invoke([
                ['system', systemInstruction],
                ['human', currentPrompt]
            ]);
            
            responseText = response.content.replace(/^["']|["']$/g, '');

            if (isPriceForbidden && priceRegex.test(responseText)) {
                retryCount++;
                if (retryCount <= maxRetries) {
                    continue;
                } else {
                    console.log('[Composer Node] Max retries reached for price hallucination. Applying fallback.');
                    responseText = "Untuk harga pastinya, aku cek dulu ya kak 🙏";
                    break;
                }
            }
            
            // Valid response or price is allowed
            break;
        }

        console.log('[Composer Node] Generated text:', responseText);

        const result = {
            messages: [new AIMessage(responseText)],
            analytics: {
                responseCount: (state.analytics?.responseCount || 0) + 1
            }
        };
        console.log('[Composer Node] Output:', JSON.stringify(result, null, 2));
        return result;
    } catch (error) {
        console.error('[Composer Node] LLM Error:', error);
        const fallbackText = 'Aduh maaf mas, sistem saya lagi gangguan sedikit 🙏. Boleh ditunggu sebentar ya.';
        return {
            messages: [new AIMessage(fallbackText)],
            analytics: {
                responseCount: (state.analytics?.responseCount || 0) + 1
            }
        };
    }
}

module.exports = {
    composerNode
};
