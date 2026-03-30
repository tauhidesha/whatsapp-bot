const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { SystemMessage, HumanMessage, AIMessage } = require('@langchain/core/messages');
const { z } = require('zod');

const model = new ChatGoogleGenerativeAI({
    model: process.env.AI_MODEL || 'gemini-1.5-flash',
    maxOutputTokens: 1024,
    temperature: 0,
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

    // Instruksi spesifik berdasarkan mode
    const modeInstructions = {
        greet: `ATURAN KETAT GREETING:
1. Balas sapaan user dengan ramah (max 2 kalimat).
2. DILARANG menyebut tipe motor, harga, atau layanan apapun.
3. Cukup balas salam dan tanya ada yang bisa dibantu.`,

        consult: `ATURAN KONSULTASI:
1. Jelaskan layanan BosMat Studio secara singkat & menarik (Repaint, Detailing, Coating).
2. Sebutkan bahwa kita spesialis bikin motor "pangling" seperti baru.
3. Tutup dengan SATU pertanyaan ringan: "Kira-kira motornya mau diapain dulu nih?"`,

        ask: `ATURAN PING-PONG KETAT:
1. Kamu WAJIB menanyakan pertanyaan ini: "${missingQ}".
2. DILARANG mengevaluasi apakah pertanyaan sebelumnya sudah dijawab atau belum.
3. DILARANG 'catch-up' atau menggabungkan beberapa pertanyaan yang terlewat.
4. Setiap giliran adalah satu pertanyaan baru. Itu saja.
5. Pertanyaan yang harus ditanyakan sekarang adalah PERSIS ini: "${missingQ}"
6. Parafrasa boleh, tapi hanya 1 pertanyaan ini.
7. DILARANG memberikan estimasi, list layanan, atau informasi tambahan apapun sebelum pertanyaan ini dijawab user.`,

        inform: `ATURAN INFORMASI:
1. Berikan informasi/estimasi harga berdasarkan data hasil tool: ${JSON.stringify(toolResult || {})}.
2. JIKA hasil tool berisi data AVAILABILITY (ketersediaan booking), WAJIB sampaikan hasilnya ke user (contoh: "Slot tersedia jam..." atau "Maaf jam itu penuh, adanya jam...").
3. JANGAN pernah menyebutkan kata "promo" (termasuk "tidak ada promo") jika tidak ada instruksi PROMOSI COMBO di bawah.
4. WAJIB Akhiri dengan 1 CTA: ajak booking jadwal atau tanya hal lain.
5. JIKA LECET PARAH (lebih dari 2 panel): WAJIB sarankan *Repaint Full Bodi Halus* ketimbang spot repair karena hasil lebih rata dan jatuhnya lebih murah dibanding ngecer per spot.
${comboOfferInstruction}
${comboResultInstruction}`
    };

    const contextInfo = replyMode === 'greet' 
        ? `- Nama: ${customerName}\n- Intent: ${intent}\n- Mode: ${replyMode}`
        : `- Nama: ${customerName}
- Intent: ${intent}
- Mode: ${replyMode}
- Motor: ${context.vehicleType || 'Belum diketahui'}
- Layanan: ${context.serviceTypes?.join(', ') || 'Belum diketahui'}
- Specs: ${JSON.stringify(context || {})}
`;

    const systemPrompt = `Kamu adalah Zoya, asisten Customer Service dan Konsultan Otomotif AI untuk BosMat Repainting & Detailing Studio.

KEPRIBADIAN & SAPAAN:
- Gaya bicaramu sangat ramah, asik, luwes, selayaknya teman ngobrol, dan tidak kaku.
- Gunakan kata ganti "aku" atau "saya" untuk menyebut diri sendiri. JANGAN menyebut namamu sendiri (seperti "Zoya bantu cek ya") karena itu terasa kaku.
- Tebak gender pelanggan dari namanya.
- Panggil dengan "Mas" untuk pelanggan pria.
- Panggil dengan "Kak" untuk pelanggan wanita atau jika kamu ragu/tidak yakin gendernya.
- JANGAN gunakan panggilan "Mbak". Gunakan "Kak" sebagai gantinya.

FORMATTING WHATSAPP (SANGAT PENTING):
1. JANGAN gunakan double-asterisk (**tebal**) atau triple-asterisk. Gunakan SINGLE-ASTERISK untuk tebal: *tebal*.
2. JANGAN gunakan underscore ganda (__miring__). Gunakan SINGLE-UNDERSCORE untuk miring: _miring_.
3. JANGAN gunakan Markdown heading (# Judul). Gunakan HURUF KAPITAL saja untuk penekanan judul/poin.
4. WAJIB gunakan DOUBLE NEWLINE (jarak dua baris) di antara SETIAP kalimat atau poin pemikiran baru agar chat terasa lega dan mudah dibaca di layar HP yang sempit.
5. JANGAN menulis teks dalam satu paragraf gumpalan panjang. Pecah menjadi kalimat-kalimat pendek yang terpisah jarak.

KONTEKS SAAT INI:
${contextInfo}

HASIL CEK HARGA (TOOL LATEST):
${JSON.stringify(toolResult || 'Tidak ada data tambahan')}

PELAJARI CHAT TERAKHIR USER:
"${lastUserMessage.content}"

--------------------------------------------------
INSTRUKSI KHUSUS MODE (${replyMode.toUpperCase()}) - WAJIB PATUH:
${modeInstructions[replyMode]}
--------------------------------------------------

ATURAN EMAS (TIDAK BOLEH DILANGGAR):
1. Jika mode adalah "ASK", boleh sapa balik max 1 kalimat, lalu LANGSUNG tulis pertanyaan ini verbatim (boleh parafrasa ringan tapi isinya jangan diubah): "${missingQ}"
2. DILARANG KERAS memberikan informasi estimasi jika mode bukan "INFORM".
3. JANGAN mengulangi pertanyaan yang baru saja ditanyakan di chat history jika user sudah menjawabnya (tapi di mode ASK, abaikan ini dan tanyakan yang diperintahkan).
4. Gunakan format WhatsApp (SINGLE *tebal*, DOUBLE NEWLINE).
5. Keputusan akhir kamu WAJIB didasarkan pada INSTRUKSI KHUSUS MODE di atas.`;

    console.log(`[FORMATTER_NODE] missingQ detected: "${missingQ}"`);

    try {
        const structuredModel = model.withStructuredOutput(
            z.object({
                greeting: z.string().describe("Sapaan ramah pembuka (max 1 kalimat). Gunakan Mas/Kak sesuai gender."),
                main_content: z.string().describe("Isi pesan utama. Jika mode ASK, WAJIB diisi dengan pertanyaan verbatim: " + (missingQ || "N/A")),
                internal_thought: z.string().describe("Analisis singkat pemilihan pesan")
            })
        );

        const response = await structuredModel.invoke([
            new SystemMessage(systemPrompt),
            ...messages.slice(-6)
        ]);

        console.log(`[FORMATTER_NODE] [${replyMode}] Thought: ${response.internal_thought}`);
        
        let finalReply = response.greeting + "\n\n" + response.main_content;

        // Force check: Jika mode ASK tapi model 'lupa' masukin pertanyaan di main_content
        if (replyMode === 'ask' && missingQ && !response.main_content.toLowerCase().includes(missingQ.substring(0, 5).toLowerCase())) {
            console.log("[FORMATTER_NODE] Adherence failure detected. Forcing missingQ into reply.");
            finalReply = response.greeting + "\n\n" + missingQ;
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
