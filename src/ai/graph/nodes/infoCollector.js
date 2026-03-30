const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { SystemMessage, HumanMessage } = require('@langchain/core/messages');

const model = new ChatGoogleGenerativeAI({
    model: process.env.AI_MODEL || 'gemini-1.5-flash',
    maxOutputTokens: 1024,
    temperature: 0,
});

/**
 * Node: infoCollector
 * Mengekstrak informasi entitas (Motor, Layanan) dari chat.
 */
async function infoCollectorNode(state) {
    const { messages, context, intent } = state;

    // Jika bukan booking, lewati ekstraksi berat
    if (intent !== 'BOOKING_SERVICE' && intent !== 'GENERAL_INQUIRY') {
        return { context };
    }

    const systemPrompt = `Kamu adalah Entity Extractor untuk Bengkel BosMat Studio.
Tugas: Ekstrak informasi berikut dari riwayat chat (terutama pesan terakhir).

1. motor_model: Nama model motor (contoh: NMAX, Vario 160, Vespa LX).
2. service_type: Jenis layanan resmi:
   - 'Repaint Bodi Halus', 'Repaint Bodi Kasar', 'Repaint Velg', 'Repaint Cover CVT', 'Spot Repair',
   - 'Detailing Mesin', 'Cuci Komplit', 'Poles Bodi Glossy', 'Full Detailing Glossy',
   - 'Coating Doff', 'Coating Glossy', 'Complete Service Doff', 'Complete Service Glossy'.
3. paint_type: 'glossy' atau 'doff'.
4. is_bongkar_total: boolean (apakah user mau layanan bongkar total/hampir seluruh bagian?).
5. detailing_focus: 'baret' (poles bodi), 'mesin' (detailing mesin), 'kerangka' (cuci komplit).
6. color_choice: warna yang diinginkan user untuk Repaint.
7. is_previously_painted: boolean (khusus velg, apakah sudah pernah cat ulang/bukan ori?).

FORMAT JAWABAN (JSON ONLY):
{
  "motor_model": string | null,
  "service_type": string | null,
  "paint_type": "glossy" | "doff" | null,
  "is_bongkar_total": boolean | null,
  "detailing_focus": "baret" | "mesin" | "kerangka" | null,
  "color_choice": string | null,
  "is_previously_painted": boolean | null
}`;

    try {
        const response = await model.invoke([
            new SystemMessage(systemPrompt),
            new HumanMessage(messages.map(m => m.content).join('\n'))
        ]);

        const rawResult = response.content.replace(/```json|```/g, '').trim();
        const extracted = JSON.parse(rawResult);

        // Update context dengan data baru
        const ctx = { ...context };
        if (extracted.motor_model) ctx.vehicleType = extracted.motor_model;
        if (extracted.service_type) ctx.serviceType = extracted.service_type;
        if (extracted.paint_type) ctx.paintType = extracted.paint_type;
        if (extracted.is_bongkar_total !== null) ctx.isBongkarTotal = extracted.is_bongkar_total;
        if (extracted.detailing_focus) ctx.detailingFocus = extracted.detailing_focus;
        if (extracted.color_choice) ctx.colorChoice = extracted.color_choice;
        if (extracted.is_previously_painted !== null) ctx.isPreviouslyPainted = extracted.is_previously_painted;

        // --- LOGIKA DECISION TREE (MISSING QUESTIONS) ---
        const missing = [];
        const svc = (ctx.serviceType || '').toLowerCase();

        // 1. Coating & Complete Service
        if (svc.includes('coating') || svc.includes('complete service')) {
            if (!ctx.paintType) missing.push("Cat motor Kakak jenisnya Glossy atau Doff?");
            if (ctx.isBongkarTotal === null) missing.push("Mau proteksi bodi luar aja, atau bongkar total sampai rangka (Complete Service)?");
        }

        // 2. Detailing
        if (svc.includes('detailing') || svc.includes('poles') || svc.includes('cuci')) {
            if (!ctx.detailingFocus) missing.push("Masalah utamanya di mana Kak? Mau ngilangin baret bodi, mesin kotor, atau cuci bongkar total?");
            if (!ctx.paintType && (svc.includes('poles') || svc.includes('full detailing'))) {
                missing.push("Cat motornya Doff atau Glossy?");
            }
        }

        // 3. Repaint
        if (svc.includes('repaint')) {
            if (!ctx.serviceType || svc === 'repaint') {
                missing.push("Mau cat bagian mana Kak? Bodi Halus, Bodi Kasar, Velg, atau CVT/Arm?");
            }
            if (svc.includes('halus') || svc.includes('velg')) {
                if (!ctx.colorChoice) missing.push("Rencana mau warna apa Kak?");
            }
            if (svc.includes('velg') && ctx.isPreviouslyPainted === null) {
                missing.push("Khusus velg, apakah catnya masih ori pabrik atau sudah pernah dicat ulang?");
            }
        }

        // Motor Model is mandatory for all
        if (!ctx.vehicleType) {
            missing.push("Boleh sebutin tipe motornya Kak? (misal: Scoopy 2021, NMax old, PCX 160)");
        }

        ctx.missingQuestions = missing;

        // Tentukan Shifting ke Executor
        // Siap eksekusi jika tidak ada pertanyaan kritis yang tersisa
        ctx.isReadyForTools = (intent === 'BOOKING_SERVICE' || intent === 'GENERAL_INQUIRY') && 
                             ctx.vehicleType && ctx.serviceType && missing.length === 0;

        return { context: ctx };

    } catch (error) {
        console.error('[infoCollectorNode] Error:', error);
        return { context };
    }
}

module.exports = { infoCollectorNode };
