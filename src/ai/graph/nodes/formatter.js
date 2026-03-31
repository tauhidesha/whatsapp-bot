const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { SystemMessage, HumanMessage, AIMessage } = require('@langchain/core/messages');
const { z } = require('zod');

const model = new ChatGoogleGenerativeAI({
    model: process.env.AI_MODEL || 'gemini-1.5-flash-lite-latest',
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
        'repaint': 'Cuci Komplit / Detailing',
        'detailing': 'Coating Ceramic',
        'coating': 'Full Detailing',
        'cuci': 'Coating Ceramic',
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
    const systemPrompt = `[ROLE]
Kamu adalah Zoya, Automotive Consultant & Studio Assistant di BosMat Studio. 
Vibes-mu adalah penasihat otomotif yang "asik", friend-like (seperti teman lama), punya selera bagus, tapi tetap profesional dan bisa diandalkan.

[AUDIENCE]
Pecinta motor (Mas/Kak) yang sangat peduli dengan tampilan motor mereka agar tampil "pangling" dan "klimis" di jalan. Mereka tidak suka bahasa kaku sales, mereka lebih suka saran tulus dari teman hobi.

[CONTEXT]
Status User saat ini:
${contextInfo}

Hasil Cek Teknis/Tool:
${JSON.stringify(toolResult || 'Tidak ada data tambahan')}

Riwayat Chat Terakhir:
"${lastUserMessage.content}"

[EXPECTATION - WHATSAPP STYLE]
1. Sapaan: Panggil Mas/Kak sesuai sapaan yang ditentukan. JANGAN panggil "Mbak".
2. Gaya Bahasa: Gunakan "aku" atau "saya" untuk diri sendiri. JANGAN sebut namamu sendiri "Zoya ...".
3. Layout: WAJIB gunakan DOUBLE NEWLINE (2x enter) di antara setiap poin/kalimat baru agar chat lega di HP.
4. Simbol: Gunakan SINGLE-ASTERISK untuk *tebal* (jangan double **).
5. Kepribadian: Luwes, santai, gunakan emoji secukupnya (😄, ✨, 🎨, 🏍️). 

[STRATEGI MODE: ${replyMode.toUpperCase()}]
${modeInstructions[replyMode]}

[ATURAN EMAS]
- Selalu akhiri dengan satu Call-to-Action (CTA) yang jelas.
- Jika mode ASK: Parafrasa pertanyaan "${missingQ}" menjadi sangat natural tapi tetap eksplisit.
- JIKA mode INFORM: Sampaikan breakdown harga dengan jujur, jangan menutup-nutupi biaya ekstra (seperti bongkar/pengerjaan sebulan).
- Pastikan emosimu "excited" saat user mau bikin motornya keren!`;

    console.log(`[FORMATTER_NODE] missingQ detected: "${missingQ}"`);

    try {
        const structuredModel = model.withStructuredOutput(
            z.object({
                greeting: z.string().optional().describe("Sapaan ramah pembuka (max 1 kalimat). Wajib di pesan pertama, OPSIONAL/KOSONGKAN jika ini lanjutan diskusi agar tidak kaku."),
                main_content: z.string().describe("Isi pesan utama. Jika mode ASK, WAJIB diisi dengan pertanyaan verbatim: " + (missingQ || "N/A")),
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

        // Force check: Jika mode ASK tapi model 'lupa' masukin pertanyaan di main_content
        if (replyMode === 'ask' && missingQ && !response.main_content.toLowerCase().includes(missingQ.substring(0, 5).toLowerCase())) {
            console.log("[FORMATTER_NODE] Adherence failure detected. Forcing missingQ into reply.");
            const intro = (response.greeting && response.greeting.trim()) ? response.greeting.trim() + "\n\n" : "";
            finalReply = intro + missingQ;
        }

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
