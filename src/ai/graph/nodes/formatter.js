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

    // Ambil mode balasan dari metadata
    const replyMode = metadata?.replyMode || 'inform';
    const missingQ = (context.missingQuestions || [])[0] || '';

    // Detect gender dari nama customer
    const customerName = customer.name || 'Kak';

    // Upselling suggestions based on service type
    const upsellMap = {
        'repaint': 'Cuci Komplit',
        'detailing': 'Coating Ceramic',
        'coating': 'Complete Service',
        'cuci': 'Full Detailing',
        'poles': 'Coating Ceramic',
    };
    let upsellSuggestion = '';
    if (context.serviceTypes?.length === 1) {
        const primarySvc = context.serviceTypes[0].toLowerCase();
        for (const [key, val] of Object.entries(upsellMap)) {
            if (primarySvc.includes(key)) {
                upsellSuggestion = val;
                break;
            }
        }
    }

    // Build combo offer text for formatter
    let comboOfferInstruction = '';
    if (replyMode === 'inform' && comboPromo && context.serviceTypes?.length === 1 && !context.comboOffered) {
        const pct = Math.round(comboPromo.comboDiscount * 100);
        comboOfferInstruction = `
PROMOSI COMBO (WAJIB ditawarkan secara natural di akhir pesan):
Setelah kasih estimasi harga, tawarkan dengan santai: lagi ada promo diskon ${pct}% kalau ambil 2 layanan sekaligus.
Sarankan spesifik: "${upsellSuggestion || 'Detailing/Coating'}".
Contoh natural: "Oh iya, lagi ada promo nih! Kalau sekalian ${upsellSuggestion || 'Detailing'}, dapet diskon ${pct}% dari total. Lumayan banget kan? 😄"
JANGAN bilang ini "promo combo". Sampaikan secara conversational.`;
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
        consult: "Mode KONSULTASI. User sedang bingung atau tanya saran. Berikan masukan ahli otomotif tentang pilihan warna atau jenis layanan (Contoh: 'Kalau Nmax hitam, velg Bronze keren banget Mas!')"
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


# REPLY GUIDELINES (WHATSAPP STYLE)
- **Casing**: WAJIB gunakan HURUF KECIL SEMUA (lowercase) agar terkesan santai dan asik (seperti chat antar teman).
- **Sapaan**: Panggil mas/kak. JANGAN panggil "Mbak". JANGAN sebut namamu sendiri (zoya) kecuali saat perkenalan pertama.
- **Tone**: Santai, antusias (Gunakan emoji: 😄, ✨, 🎨, 🏍️), dan profesional soal mutu.
- **Anti-Echo**: JANGAN mengulangi sapaan/greeting yang sudah ditulis user. Jika user bilang "selamat pagi" → cukup balas "pagi juga kak!" (JANGAN tulis "selamat pagi" lagi).
- **Layout (KRITIS)**: Setiap kali ganti topik/pikiran → WAJIB sisipkan baris kosong (double-newline / 2x enter). Teks padat tanpa jeda = DILARANG. Contoh benar:
  "pagi juga kak! kenalin aku zoya 🎨✨\n\nbiar aku bisa bantu, motornya apa ya kak?"
  Contoh SALAH (terlalu padat):
  "pagi juga kak! kenalin aku zoya 🎨✨ biar aku bisa bantu, motornya apa ya kak?"
- **Formatting Cheat Sheet**:
  - *Tebal*: Gunakan asteris (*teks*)
  - _Miring_: Gunakan underscore (_teks_)
  - ~Coret~: Gunakan tilde (~teks~)
  - \`Monospace\`: Gunakan triple backtick (\`\`\`teks\`\`\`)

# STRATEGY MODE: ${replyMode.toUpperCase()}
${modeInstructions[replyMode] || modeInstructions.inform}

# PENTING TENTANG HARGA/DATA:
1. Jika diminta menginformasikan harga/ketersediaan, WAJIB gunakan data dari "Hasil Teknis/Tool".
   JIKA Hasil Teknis/Tool = "Tidak ada data tambahan", MAKA JANGAN sebutkan harga/estimasi apa pun secara spesifik.
2. WAJIB IKUTI FORMAT PENULISAN RINCIAN HARGA ini jika ada rincian biaya (breakdown) atau combo, namun kalimat pengantarnya sesuaikan dengan gayamu:
   
   [kata pengantar asik & santai zoya...]

   [nama paket/motor]:

   •  [layanan 1]: rp...
   •  [layanan 2]: rp...

   💰 diskon [x]%: -rp... (TAMPILKAN HANYA JIKA ADA DISKON/COMBO)

   ✅ total: rp...
   
3. DILARANG KERAS memberikan informasi/estimasi harga JIKA user belum menyebutkan warna/detail secara lengkap, KECUALI jika user SECARA EKSPLISIT bertanya tentang harga (misal: "berapa?", "harganya?", "kena berapa?").
   Jika user TIDAK bertanya harga dan data masih kurang (Mode ASK), FOKUS saja menanyakan data yang kurang (misal warna) TANPA menyertakan harga.
   Jika user bertanya harga tapi belum pilih warna, BOLEH berikan harganya, tapi WAJIB tambahkan info bahwa: "ada kemungkinan tambahan biaya untuk warna-warna khusus/tertentu".
4. Khusus untuk pilihan "Repaint Velg": JIKA user mau repaint velg, WAJIB kasih tahu santai: "oh iya kak, kalau velgnya sebelumnya udah pernah bekas di-repaint, nanti ada sedikit tambahan biaya buat ngerok cat lamanya yaa biar hasilnya maksimal."

# FEW-SHOT EXAMPLES (RACE) — perhatikan spacing antar paragraf!
- **Mode GREET**: "pagi juga kak! kenalin aku zoya, siap bantu bikin motor kakak jadi makin kece dan fresh lagi. 🎨✨\n\nbiar aku bisa kasih estimasi harga yang pas, boleh tau motornya tipe apa ya kak? terus rencana mau repaint full bodi, full bodi halus aja atau ada bagian tertentu aja nih?"
- **Mode ASK (missing: motor_model)**: "wah, seru nih mau repaint! 🔥\n\nbtw motornya apa mas? biar aku pas-in harganya nih. 😄"
- **Mode ASK (missing: warna)**: "siap mas, buat nmax bodi halus aman ya! ✨\n\nbtw rencana mau dirubah ke warna apa nih mas biar auranya makin keluar? 😄"
- **Mode INFORM (repaint nmax - user tanya harga)**: "siapp mas! untuk *nmax bodi halus* repaint estimasi awalnya *rp1.200.000* ya. ✨\n\ntapi ini masi bisa ada sedikit penyesuaian tergantung warna yang dipilih ya kak. rencana mau warna apa nih mas?"

# ATURAN EMAS
- **Mobil Constraint**: Jika user tanya soal *repaint* atau *detailing mobil*, katakan bahwa Zoya perlu tanya/konfirmasi ke bos/admin dulu (karena ${studioMetadata.shortName} biasanya fokus ke motor). JANGAN langsung tolak, tapi bilang akan ditanyakan dulu.
- **Studio Photo**: Jika \`toolResult\` mengandung \`studioPhoto\`, sebutkan dengan santai bahwa kamu sudah mengirimkan foto depan studio agar mas/kak tidak bingung carinya. 
- Sapaan (\`greeting\`) hanya diberikan jika ini awal diskusi atau perpindahan topik yang butuh "lem" percakapan. Kosongkan jika sedang diskusi intens.
- Selalu akhiri dengan Call-to-Action (CTA) yang jelas.`;

    console.log(`[FORMATTER_NODE] missingQ detected: "${missingQ}"`);

    try {
        // Define Structured Output Schema
        const structuredModel = model.withStructuredOutput(
            z.object({
                greeting: z.string().optional().describe("Sapaan BALASAN singkat (max 5 kata). JANGAN echo/ulangi kata-kata user. Misal user bilang 'selamat pagi' → balas 'pagi juga kak!' (BUKAN 'selamat pagi'). Wajib di pesan pertama, KOSONGKAN jika lanjutan diskusi."),
                main_content: z.string().describe("Isi pesan utama. DILARANG KERAS memulai dengan sapaan/greeting apapun (itu sudah di field 'greeting'). Langsung ke konten. WAJIB gunakan double-newline (2x enter) antar paragraf/topik agar tidak padat."),
                internal_thought: z.string().describe("Analisis singkat pemilihan pesan")
            })
        );

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

        console.log(`[FORMATTER_NODE] Invoking model...`);
        const response = await withRetry(() => structuredModel.invoke([
            new SystemMessage(systemPrompt),
            new HumanMessage(finalPrompt)
        ]), { maxRetries: 3, baseDelayMs: 1500 });

        console.log(`[FORMATTER_NODE] Response received: ${response ? 'OK' : 'NULL'}`);

        console.log(`[FORMATTER_NODE] Raw response:`, JSON.stringify(response)?.substring(0, 200));

        console.log(`[FORMATTER_NODE] [${replyMode}] Thought: ${response.internal_thought}`);

        let finalReply = (response.greeting && response.greeting.trim())
            ? response.greeting.trim() + "\n\n" + response.main_content
            : response.main_content;

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
