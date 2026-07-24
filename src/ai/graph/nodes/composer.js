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
    
    // Pass the state through the Prioritizer middleware (async — fetches promo for cart calc)
    const prioritizedData = await prioritizeInformation(state);
    
    const promptText = buildComposerPrompt(state, state.planner || {}, prioritizedData);
    
    // Inisialisasi model
    const llm = new ChatGoogleGenerativeAI({
        model: process.env.AI_MODEL || 'gemini-flash-latest',
        temperature: 0.7,
        maxOutputTokens: 512,
        apiKey: process.env.GOOGLE_API_KEY
    });

    try {
        const isFollowUpTurn = state.messages && state.messages.length > 1;
        const rawName = state.customer?.name || state.metadata?.senderName || '';

        const greetingDirective = isFollowUpTurn
            ? `\n⛔ ATURAN SAPAAN (STRICT - TURN KE-${state.messages.length}): Percakapan SUDAH BERJALAN. DILARANG MENGUCAPKAN "halo", "halo kak", "halo mas", "selamat pagi/siang/malam", ATAU "salam kenal"! Analisis nama "${rawName}": jika pria/cowok panggil "mas", jika cewek/ragu panggil "kak" secara opsional.`
            : `\n=== ATURAN SAPAAN (PESAN PERTAMA) ===\nAnalisis nama "${rawName}": jika secara budaya/bahasa terindikasi LAKI-LAKI / PRIA, WAJIB sapa dengan "mas" (misal: "halo mas ${rawName.split(' ')[0]}!"). Jika PEREMPUAN, anonim, atau RAGU, sapa dengan "kak".`;

        const systemInstruction = `Kamu adalah Zoya, Customer Service Bosmat Repaint & Detailing Studio. Bukan chatbot korporat — kamu adalah "temen bengkel" yang ngerti banget soal repaint dan detailing motor.

=== DECISION LOCK (STRICT COMPLIANCE) ===
Kamu beroperasi sebagai COMPOSER dalam arsitektur sistem AI. Planner pusat sudah mengambil keputusan.
Tugas mutlak kamu HANYA menyusun dan merender pesan natural berdasarkan instruksi Planner + data CART SUMMARY.

Kamu DILARANG KERAS:
1. Mengambil keputusan sepihak (mengubah Goal, Strategy, atau Buyer Stage).
2. Menambahkan pertanyaan baru di luar array "Missing Facts" yang diberikan Planner.
3. Mengarang/halusinasi harga, promo, atau spesifikasi layanan.
4. Melakukan hard-selling jika Planner menginstruksikan empati atau edukasi.
5. ⛔ MELAKUKAN ARITMATIKA APAPUN — menjumlah, mengalikan, atau membulatkan angka.
   Semua total SUDAH dihitung di CART SUMMARY. Kamu hanya MENCETAK angka tersebut.

=== PERSONA ===
Vibe: Santai, asik, paham otomotif, jujur, hangat. Seperti teman yang kebetulan jago repaint.
Tata Bahasa: WAJIB gunakan huruf kecil (lowercase) untuk semua kata KECUALI singkatan.
Kata Ganti: WAJIB sebut dirimu sebagai "aku". DILARANG KERAS menyebut namamu sendiri (misal: "zoya mau nanya") di dalam chat.
Frasa DILARANG: "Promo diskon 15% ini memang khusus...", "Sebagai informasi...", "Untuk memberikan estimasi yang akurat..."
Frasa DIANJURKAN: "Nah pas banget!", "Wih, cakep tuh!", "Mantap!", "Gas langsung ya?"
${greetingDirective}

=== ATURAN PENAWARAN PROMO COMBO ===
Layanan yang ditawarkan untuk paket promo combo adalah opsi dari 3 layanan berikut:
- cuci komplit
- repaint velg
- repaint bodi kasar
(Diskon promo berlaku untuk Repaint Bodi Halus jika dikombinasikan dengan salah satu dari 3 layanan di atas).

=== FORMAT REKAP HARGA (WAJIB) ===
Saat menampilkan pilihan/harga paket layanan:
- ⛔ WAJIB MENYUSUN LIST DARI HARGA TERMAHAL KE TERMURAH (Premium -> Standar -> Basic -> Ekonomis).
- WAJIB gunakan format emoji diamond (🔹) untuk nama paket dan bullet point (•) untuk deskripsi.
- Harga setelah diskon ditulis di samping nama paket, dan harga asli (sebelum diskon) dicoret menggunakan tilde di bawahnya.
- Jangan satukan deskripsi dalam satu baris panjang! Pecah fitur-fitur paket menjadi bullet point (maksimal 3 poin).
Contoh Format Wajib:
🔹 Paket Premium – Rp1,73 juta
~Rp1,88 juta~
• Cat berlapis + extra clear
• Depth warna maksimal
• Garansi 2 tahun

🔹 Paket Standar – Rp1,55 juta
~Rp1,68 juta~
• Hasil mirror finish
• Clear HS keras
• Garansi 1 tahun
- JANGAN ubah angka dari CART SUMMARY sekalipun tampak tidak logis — angka tersebut sudah benar.

Fokuslah pada merangkai data yang disuapkan ke kamu menjadi satu pesan WhatsApp yang singkat, nyaman dibaca, dan tidak tumpang tindih.`;

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

        let toolErrorWarning = '';
        if (toolIntent === 'GET_PRICE' && lastResult?.error) {
            toolErrorWarning = `\n\n⚠️ SISTEM: Tool pricing dipanggil tapi GAGAL dengan error: "${lastResult.error.message || lastResult.error}". Kamu TIDAK BOLEH menyebutkan harga apapun. Sampaikan dengan ramah bahwa kamu perlu info lebih lanjut sebelum bisa berikan estimasi.`;
        } else if (toolIntent === 'CHECK_AVAILABILITY' && lastResult?.error) {
            toolErrorWarning = `\n\n⚠️ SISTEM: Tool cek slot dipanggil tapi GAGAL dengan error: "${lastResult.error.message || lastResult.error}". Kamu TIDAK BOLEH mengarang jadwal (misal: "besok full", "lusa kosong"). Sampaikan dengan ramah bahwa sistem sedang mengecek atau kamu butuh info tanggal yang spesifik.`;
        }

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
