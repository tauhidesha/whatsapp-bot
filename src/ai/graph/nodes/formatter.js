const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { SystemMessage, HumanMessage, AIMessage } = require('@langchain/core/messages');
const { z } = require('zod');
const studioMetadata = require('../../constants/studioMetadata');

const model = new ChatGoogleGenerativeAI({
    model: process.env.AI_MODEL || 'gemini-flash-lite-latest',
    maxOutputTokens: 2048,
    temperature: 0,
    responseMimeType: "application/json",
});

/**
 * Node: formatter
 * Mengkonversi state menjadi pesan balasan WhatsApp yang sesuai kepribadian Zoya.
 * Menggunakan Structured Output untuk menjamin format dan kepatuhan aturan.
 */
async function formatterNode(state) {
    console.log('--- [FORMATTER_NODE] Starting ---');
    const { messages, customer, intent, context, metadata } = state;
    const lastUserMessage = messages[messages.length - 1];
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

    // Build combo result display for multi-service
    let comboResultInstruction = '';
    if (replyMode === 'inform' && toolResult?.combo?.applied) {
        comboResultInstruction = `
HASIL COMBO (WAJIB ditampilkan sebagai breakdown):
Tampilkan daftar layanan + harga masing-masing, lalu diskon combo, lalu total final.
Data combo: ${JSON.stringify(toolResult.combo)}
Format contoh:
*Paket Combo ${customerName}:*

• Layanan 1: Rp...
• Layanan 2: Rp...

💰 Diskon ${toolResult.combo.discount_percent}%: -${toolResult.combo.discount_formatted}

✅ *TOTAL: ${toolResult.combo.total_after_formatted}*

Mau langsung dibooking jadwalnya?`;
    }

    const dateInfo = state.metadata?.currentDateTime
        ? `Tanggal Sekarang: ${state.metadata.currentDateTime.dayName}, ${state.metadata.currentDateTime.formatted}`
        : `Tanggal Sekarang: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`;

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
Kamu adalah Zoya, Automotive Consultant & Studio Assistant di ${studioMetadata.name}.
Persona: "The Cool Expert Friend". Penasihat yang asik, paham hobi otomotif, jujur, dan hangat.

# CONTEXT & DATA
- Data Motor & Layanan:
${contextInfo}
- Hasil Teknis/Tool:
${JSON.stringify(toolResult || 'Tidak ada data tambahan')}

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
1. **GREET**: Sapaan awal yang hangat + kenalin diri + nanya motor/kendala.
2. **ASK**: Gunakan "${missingQ}" hanya sebagai CONTEKAN/INSTRUKSI. Tanyakan hal tersebut dengan gaya bahasa kamu sendiri yang santai dan asik (seperti teman nongkrong yang ahli motor).
3. **INFORM**: Sampaikan harga/estimasi secara transparan. ${comboOfferInstruction} ${comboResultInstruction}
4. **CONSULT**: Berikan saran ahli (misal: warna cat yang lagi tren atau perawatan coating).

# FEW-SHOT EXAMPLES (RACE) — perhatikan spacing antar paragraf!
- **Mode GREET**: "pagi juga kak! kenalin aku zoya, siap bantu bikin motor kakak jadi makin kece dan fresh lagi. 🎨✨\n\nbiar aku bisa kasih estimasi harga yang pas, boleh tau motornya tipe apa ya kak? terus rencana mau repaint full bodi atau ada bagian tertentu aja nih?"
- **Mode ASK (missing: motor_model)**: "wah, seru nih mau repaint! 🔥\n\nbtw motornya apa mas? biar aku pas-in harganya nih. 😄"
- **Mode INFORM (repaint nmax)**: "siapp mas! untuk *nmax bodi halus* repaint harganya *rp1.200.000* ya. sudah termasuk pengerjaan detail sampai klimis. ✨\n\nrencana mau warna apa nih mas?"

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

        const response = await structuredModel.invoke([
            new SystemMessage(systemPrompt),
            ...messages.slice(-6)
        ]);

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
