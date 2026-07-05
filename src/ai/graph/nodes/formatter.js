const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { SystemMessage, HumanMessage, AIMessage } = require('@langchain/core/messages');
const { z } = require('zod');
const studioMetadata = require('../../constants/studioMetadata');
const { withRetry } = require('../../utils/retry');
const { sanitizeMessagesForGemini, extractTextFromContent, getMessageType } = require('../utils/sanitizeMessages');

const model = new ChatGoogleGenerativeAI({
    model: process.env.AI_MODEL || 'gemini-flash-lite-latest',
    maxOutputTokens: 2048,
    temperature: 0,
});

/**
 * Node: formatter
 * Mengkonversi state menjadi pesan balasan WhatsApp yang sesuai kepribadian Zoya.
 * Menggunakan Structured Output untuk menjamin format dan kepatuhan aturan.
 */
async function formatterNode(state) {
    console.log('--- [FORMATTER_NODE] Starting ---');
    const { customer, intent, context, metadata } = state;
    const sanitizedMessages = sanitizeMessagesForGemini(state.messages);
    const lastUserMessage = sanitizedMessages[sanitizedMessages.length - 1];
    const toolResult = metadata?.toolResult;
    const comboPromo = metadata?.comboPromo; // Structured: { promoText, comboDiscount, comboMinServices }
    const activePromo = metadata?.activePromo;

    // Ambil mode balasan dari metadata
    const replyMode = metadata?.replyMode || 'inform';
    const missingQ = (context.missingQuestions || [])[0] || '';

    // Detect gender dari nama customer
    const customerName = customer.name || 'Kak';

    // Detailing & Repaint Package Suggester (Decision Tree)
    let upsellSuggestion = '';
    let packageExplanation = '';
    if (context.serviceTypes?.length === 1) {
        const primarySvc = context.serviceTypes[0].toLowerCase();
        const paint = (context.paintType || '').toLowerCase();
        const focus = (context.detailingFocus || '').toLowerCase();
        const bongkar = context.isBongkarTotal;

        if (primarySvc.includes('detailing') || primarySvc.includes('poles') || primarySvc.includes('cuci')) {
            if (bongkar) {
                if (paint === 'doff') {
                    upsellSuggestion = 'Cuci Komplit';
                    packageExplanation = '(Jelaskan singkat: Cuci komplit ini bongkar total, sangat cocok buat cat doff biar bersih sampai ke rangka).';
                } else {
                    upsellSuggestion = 'Full Detailing';
                    packageExplanation = '(Jelaskan singkat: Full detailing bongkar total, bikin bodi glossy kilap lagi dan rangka bersih dari kotoran).';
                }
            } else if (focus.includes('mesin')) {
                upsellSuggestion = 'Detailing Bodi juga';
                packageExplanation = '(Tawarkan sekalian detailing bodi karena mesin sudah bersih, sayang kalau bodinya masih kusam).';
            } else {
                // Bodi & Kaki-kaki
                if (paint === 'doff') {
                    upsellSuggestion = 'Coating Doff';
                    packageExplanation = '(Jelaskan singkat: Coating doff bikin cat awet, anti kusam, dan udah termasuk bersihin kaki-kaki juga).';
                } else {
                    upsellSuggestion = 'Coating Glossy atau Poles Bodi';
                    packageExplanation = '(Jelaskan singkat: Poles bodi bikin kilap, kalau mau yang proteksinya lebih tahan lama bisa ambil Coating Glossy).';
                }
            }
        } else if (primarySvc.includes('repaint')) {
            if (primarySvc.includes('halus')) {
                upsellSuggestion = 'Cuci Komplit';
                packageExplanation = '(Tawarkan cuci komplit saja. Jelaskan singkat: Repaint bodi sudah otomatis dapat poles bodi. Cat baru belum bisa dicoating, harus nunggu 1 bulan biar cat matang).';
            }
        }
    }

    // Build combo offer text for formatter
    let comboOfferInstruction = '';
    if (replyMode === 'inform' && comboPromo && context.serviceTypes?.length === 1 && !context.comboOffered) {
        const pct = Math.round(comboPromo.comboDiscount * 100);
        const promoMsg = comboPromo.promoText ? comboPromo.promoText : `Lagi ada promo diskon ${pct}% nih kalau ambil ${comboPromo.comboMinServices} layanan sekaligus`;
        comboOfferInstruction = `
PROMOSI COMBO (WAJIB ditawarkan secara natural di akhir pesan):
Setelah kasih estimasi harga, tawarkan layanan tambahan ini secara santai: "${upsellSuggestion || 'Coating Ceramic'}".
Catatan Paket: ${packageExplanation || 'Jelaskan benefit intinya secara ringkas.'}
Info Promo: "${promoMsg}"
Contoh natural: "Oiya, biar sekalian maksimal, mau ditambah ${upsellSuggestion || 'Coating Ceramic'} juga nggak kak? ${promoMsg}"
JANGAN bilang ini "promo combo" secara kaku. Sampaikan secara conversational.`;
    }

    // Pass combo data without hardcoding visual display rules
    let comboResultInstruction = '';
    if (replyMode === 'inform' && toolResult?.combo?.applied) {
        comboResultInstruction = `
HASIL COMBO DATA (Terapkan pada rincian harga sesuai Aturan Emas #2):
${JSON.stringify(toolResult.combo)}`;
    }

    const dateInfo = state.metadata?.currentDateTime
        ? `Tanggal & Waktu Sekarang: ${state.metadata.currentDateTime.dayName}, ${state.metadata.currentDateTime.formatted} (Waktu Indonesia Barat)`
        : `Tanggal & Waktu Sekarang: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB`;

    // Build context summary for the model
    const contextInfo = `
${dateInfo}
- Motor: ${context.vehicleType || 'Belum diketahui'}
- Layanan yang dipilih: ${context.serviceTypes?.join(', ') || 'Belum ada'}
- Detail/Fokus: ${context.detailingFocus || 'General'}
- Bongkar Total: ${context.isBongkarTotal ? 'Ya' : 'Tidak'}
- Warna Body: ${context.colorChoice || 'Belum ditentukan'}
- Warna Velg: ${context.velgColorChoice || 'Belum ditentukan'}
`.trim();


    const modeInstructions = {
        greet: "Mode PERKENALAN. Sapa user dengan sangat ramah, kenalkan dirimu sebagai Zoya, dan tanyakan apa yang bisa dibantu hari ini.",
        ask: `Mode TANYA DATA. Zoya sedang mengumpulkan info. Fokus utama: Tanyakan soal "${missingQ}" secara sangat santai tapi jelas. JANGAN tanya data lain dulu.`,
        inform: `Mode INFO HARGA/JADWAL. Sampaikan detail biaya atau ketersediaan jadwal dari Tool Result secara transparan. ${comboOfferInstruction} ${comboResultInstruction}`,
        consult: "Mode KONSULTASI. User sedang bingung atau minta saran. Berikan masukan ahli otomotif. PENTING: Jika visual_summary menunjukkan user datang dari iklan/postingan IG, referensikan konten iklan tersebut secara natural (misal: 'Oh tertarik sama hasil Vario Mazda Red di postingan kita ya? Cakep emang 🔥'). Lalu langsung tanyakan tipe motor user-nya."
    };

    // --- PROMPT FRAMEWORK: RACE (Role, Audience, Context, Expectation) ---
    const systemPrompt = `# ROLE
Kamu adalah Zoya, Automotive Consultant & Studio Assistant (Vision-Enabled) di ${studioMetadata.name}.
Persona: "The Cool Expert Friend". Penasihat yang asik, paham hobi otomotif, jujur, dan hangat.
Kamu punya kemampuan untuk melihat foto/video yang dikirim user untuk memberikan saran yang lebih akurat.

# CONTEXT & DATA
- Studio Info (Alamat & Jam Buka):
  Alamat: ${studioMetadata.location.address}
  Landmark: ${studioMetadata.location.landmark}
  Google Maps: ${studioMetadata.location.googleMaps}
  Jam Buka: Senin-Kamis & Sabtu-Minggu (${studioMetadata.hours.senin}), Jumat (Tutup).
- Data Motor & Layanan (Hasil Ekstraksi):
${contextInfo}
${activePromo && activePromo.promoText ? `- Promo Aktif Saat Ini: ${activePromo.promoText}` : ''}
- Hasil Teknis/Tool:
${JSON.stringify(toolResult || 'Tidak ada data tambahan')}

# VISION AWARENESS (PENTING)
Gunakan foto yang dikirim user untuk membuat percakapan jadi lebih personal dan nyata:
- Jika user kirim foto motor bagus → puji motornya (misal: "wah nmax mas cakep bener, velgnya udah ganti ya?").
- Jika user kirim foto baret/lecet → tunjukkan empati (misal: "waduh, baretnya lumayan ya mas di bodi samping, tapi tenang nanti kita kasih detailing biar mulus lagi").
- **DILARANG** bilang "saya tidak bisa lihat foto" atau "saya asisten virtual teks". Kamu BISA lihat foto mas/kak!

# VISUAL OBSERVATION (BASED ON INFO_COLLECTOR)
Informasi visual dari pesan terakhir user:
${state.metadata.visualSummary || 'Tidak ada gambar yang terdeteksi.'}


# STRATEGY MODE: ${replyMode.toUpperCase()}
${modeInstructions[replyMode] || modeInstructions.inform}

# PENTING (HARGA & DATA):
1. Hasil Teknis/Tool WAJIB jadi dasar info harga. Jika kosong, JANGAN beri harga spesifik.
2. Ada biaya tambahan untuk warna khusus/tertentu.
3. Gunakan format rincian berikut jika ada breakdown biaya:
   [kalimat pengantar...]
   • [layanan]: rp...
   ✅ total: rp...

# EXAMPLE
Mode GREET: "pagi juga kak! kenalin aku zoya 🎨✨\n\nbiar aku bisa bantu, motornya apa ya kak?"
Mode INFORM: "siapp mas! untuk *nmax bodi halus* estimasi harganya *rp1.200.000* ya. ✨"

# ATURAN EMAS
- **Multi-Motor**: Jika user menyebutkan 2 motor berbeda di satu pesan (misal: "mau repaint aerox dan coating nmax"), sampaikan bahwa kita bahas SATU per SATU. Gunakan kalimat santai seperti: "Wah dua motor nih, kita bahas yang [Sebut Motor 1] dulu ya kak biar gak pusing 😆".
- **Alamat & Booking**: Jika user menanyakan alamat/lokasi, BERIKAN informasinya, TAPI pastikan selalu MENYARANKAN untuk booking jadwal terlebih dahulu atau kabari jika ingin datang langsung hari ini.
- **Tanya Bosmat (Harga Kosong/Mobil/Datang Sekarang)**: Jika \`toolResult.needBosmat\` bernilai true, ATAU user tanya layanan mobil, ATAU user bilang mau datang sekarang, katakan: "Sebentar ya kak, Zoya tanyakan Bosmat dulu 🙏", dan chat ini akan diserahkan ke admin (JANGAN ngarang harga sendiri).
- **Studio Photo**: Jika \`toolResult\` mengandung \`studioPhoto\`, sebutkan dengan santai bahwa kamu sudah mengirimkan foto depan studio agar mas/kak tidak bingung carinya. 
- Sapaan (\`greeting\`) hanya diberikan jika ini awal diskusi atau perpindahan topik yang butuh "lem" percakapan. Kosongkan jika sedang diskusi intens.
- Selalu akhiri dengan Call-to-Action (CTA) yang jelas.

# ANTI-YAPPING (WAJIB)
- **Max 3 kalimat** untuk first response / sapaan awal. JANGAN tulis essay.
- **JANGAN beri info yang tidak diminta** (jam buka, alamat, promo) kecuali user memintanya atau replyMode === 'inform'.
- **JANGAN minta foto** di pesan pertama. Terlalu agresif. Cukup tanya motor apa.
- **Satu pertanyaan per pesan**. Jangan tumpuk 3 pertanyaan sekaligus.
- Contoh BURUK: "Kenalin aku Zoya 🎨✨ Biar aku bisa kasih info yang pas... boleh kasih tahu motornya apa? Atau mungkin ada bagian tertentu? Kalau ada foto boleh kirim juga ya! Oh ya kita buka jam 08.00-17.00..."
- Contoh BAGUS: "Halo kak! Aku Zoya dari Bosmat 🎨 Tertarik sama hasil repaint Vario yang di postingan ya? Motornya apa nih kak?"
174: 
175: # OUTPUT FORMAT
176: Kamu WAJIB membalas DALAM FORMAT JSON MURNI (tanpa markdown blocks, tanpa teks pembuka/penutup).
177: Struktur JSON yang diwajibkan:
178: {
179:   "greeting": "sapaan pendek (max 5 kata) jika di awal/pindah topik, kosongkan jika diskusi intens",
180:   "main_content": "isi pesan utama, gunakan double-newline antar paragraf",
181:   "internal_thought": "analisis singkat pemilihan pesan"
182: }`;

    console.log(`[FORMATTER_NODE] missingQ detected: "${missingQ}"`);

    try {
        // --- Step 2: Build transcript ---

        // 3. Build a text transcript from message history to avoid Gemini strict conversational history issues
        const transcript = sanitizedMessages
            .filter(m => {
                const type = getMessageType(m);
                return type === 'human' || type === 'ai';
            })
            .map(m => {
                const type = getMessageType(m);
                const text = extractTextFromContent(m.content);
                if (!text.trim()) return null;
                return `[${type === 'human' ? 'USER' : 'AI'}]: ${text.trim()}`;
            })
            .filter(Boolean)
            .join('\n\n');

        console.log(`[FORMATTER_NODE] replyMode: "${replyMode}", toolResult: ${JSON.stringify(toolResult)?.substring(0, 100)}`);
        console.log(`[FORMATTER_NODE] transcript length: ${transcript?.length || 0}`);

        const finalPrompt = `TRANSKIP PERCAKAPAN TERAKHIR:\n\n${transcript}\n\n(Tuliskan balasan AI selanjutnya sesuai arahan sistem)`;

        console.log(`[FORMATTER_NODE] Invoking model (manual parse mode)...`);
        
        // Timeout wrapper for safety
        const invokePromise = withRetry(() => model.invoke([
            new SystemMessage(systemPrompt),
            new HumanMessage(finalPrompt)
        ]), { maxRetries: 3, baseDelayMs: 1500 });

        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Formatter timeout after 120s')), 120000)
        );

        const response = await Promise.race([invokePromise, timeoutPromise]);
        
        console.log(`[FORMATTER_NODE] Response received: ${response ? 'OK' : 'NULL'}`);

        // Handle manual JSON parsing
        const rawText = extractTextFromContent(response.content);
        console.log(`[FORMATTER_NODE] Raw response (first 100 char):`, rawText.substring(0, 100).replace(/\n/g, ' '));

        let parsed = { greeting: '', main_content: rawText, internal_thought: 'manual_fallback' };
        try {
            // Clean markdown if model still provides it despite instructions
            const cleaned = rawText.replace(/```json\n?|```/g, '').trim();
            parsed = JSON.parse(cleaned);
        } catch (e) {
            console.warn(`[FORMATTER_NODE] JSON parse failed, falling back to raw text. Error: ${e.message}`);
            // Fallback: If not JSON, use the raw text as main_content
            parsed.main_content = rawText;
        }

        console.log(`[FORMATTER_NODE] [${replyMode}] Thought: ${parsed.internal_thought || 'N/A'}`);

        let finalReply = (parsed.greeting && parsed.greeting.trim())
            ? parsed.greeting.trim() + "\n\n" + parsed.main_content
            : parsed.main_content;

        console.log(`[FORMATTER_NODE] Reply formulated: "${finalReply.substring(0, 50).replace(/\n/g, ' ')}..."`);

        // Track combo offered state
        const contextUpdate = {};
        if (replyMode === 'inform' && comboPromo && context.serviceTypes?.length === 1) {
            contextUpdate.comboOffered = true;
        }

        return {
            messages: [new AIMessage(finalReply)],
            ...(Object.keys(contextUpdate).length > 0 ? { context: contextUpdate } : {})
        };

    } catch (error) {
        console.error('[formatterNode] Error:', error);
        return {
            messages: [new AIMessage('Aduh, maaf ya lagi ada kendala teknis dikit. Bisa tanya lagi atau hubungi admin?')]
        };
    }
}

module.exports = { formatterNode };
