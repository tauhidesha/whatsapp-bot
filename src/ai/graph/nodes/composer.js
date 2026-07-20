const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { AIMessage } = require('@langchain/core/messages');
const { buildComposerPrompt } = require('../../prompts/promptBuilder');
const { prioritizeInformation } = require('../../response/prioritizer');
const masterLayanan = require('../../../data/masterLayanan');

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
        const lastResult = state.tool?.lastResult;
        // Tool result hanya dianggap valid jika ada DAN tidak mengandung error
        const hasValidToolResult = !!lastResult && !lastResult.error && !lastResult.formattedText?.includes('Gagal');
        const hasPrioritizedData = !!prioritizedData;
        const isPriceForbidden = !hasPrioritizedData && !hasValidToolResult;

        // Jika tool dipanggil untuk pricing tapi hasilnya error, inject warning ke prompt
        const toolErrorWarning = (toolIntent === 'GET_PRICE' && lastResult?.error)
            ? `\n\n⚠️ SISTEM: Tool pricing dipanggil tapi GAGAL dengan error: "${lastResult.error}". Kamu TIDAK BOLEH menyebutkan harga apapun. Sampaikan dengan ramah bahwa kamu perlu info lebih lanjut sebelum bisa berikan estimasi.`
            : '';

        while (retryCount <= maxRetries) {
            let currentPrompt = promptText + toolErrorWarning;
            if (retryCount > 0) {
                currentPrompt += `\n\nSISTEM WARNING: Pesan Anda sebelumnya menyebutkan angka/estimasi harga padahal Tool Result KOSONG atau ERROR! Anda DILARANG menyebutkan harga. Harap buat ulang pesan tanpa menyebutkan harga.`;
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
                    
                    // Alert Admin
                    try {
                        const { sendWhatsappNotification } = require('../../utils/humanHandover.js');
                        sendWhatsappNotification(`🚨 *AI HALLUCINATION ALERT* 🚨\n\nAI mencoba menyebutkan harga tanpa Tool Result valid.\nFallback pesan diterapkan.\n\nNomor: ${state.metadata?.phoneReal || 'Unknown'}\nPesan Asli AI: ${responseText}`);
                    } catch (err) {
                        console.error('[Composer Node] Gagal mengirim alert ke admin:', err.message);
                    }

                    responseText = "Untuk harga pastinya, aku cek dulu ya kak 🙏";
                    break;
                }
            }
            
            // Valid response or price is allowed
            break;
        }

        console.log('[Composer Node] Generated text:', responseText);

        // Track last offered services for coreference resolution
        const lowerResponse = responseText.toLowerCase();
        const offeredServices = [];
        masterLayanan.forEach(svc => {
            if (lowerResponse.includes(svc.name.toLowerCase())) {
                offeredServices.push(svc.name);
            } else if (svc.keywords) {
                for (const keyword of svc.keywords) {
                    if (lowerResponse.includes(keyword.toLowerCase())) {
                        offeredServices.push(svc.name);
                        break;
                    }
                }
            }
        });

        const result = {
            messages: [new AIMessage(responseText)],
            consultation: {
                last_offered_services: offeredServices
            },
            analytics: {
                responseCount: (state.analytics?.responseCount || 0) + 1
            }
        };
        console.log('[Composer Node] Output:', JSON.stringify(result, null, 2));
        return result;
    } catch (error) {
        console.error('[Composer Node] LLM Error:', error);
        
        // Alert Admin
        try {
            const { sendWhatsappNotification } = require('../../utils/humanHandover.js');
            sendWhatsappNotification(`🚨 *AI SYSTEM ERROR* 🚨\n\nComposer Node mengalami kegagalan/LLM Error.\n\nError: ${error.message}\nNomor: ${state.metadata?.phoneReal || 'Unknown'}`);
        } catch (err) {
            console.error('[Composer Node] Gagal mengirim alert error ke admin:', err.message);
        }

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
