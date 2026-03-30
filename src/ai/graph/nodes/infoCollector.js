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
 * Mendukung multi-service (serviceTypes array).
 */
async function infoCollectorNode(state) {
    console.log('--- [INFO_COLLECTOR_NODE] Starting ---');
    const { messages, context, intent, metadata } = state;
    const prevIntent = metadata?.prevIntent;

    // Siapkan context lokal untuk diolah
    const ctx = { ...context };

    // Backward compat: migrate serviceType → serviceTypes
    if (ctx.serviceType && (!ctx.serviceTypes || ctx.serviceTypes.length === 0)) {
        ctx.serviceTypes = [ctx.serviceType];
        delete ctx.serviceType;
    }
    if (!Array.isArray(ctx.serviceTypes)) {
        ctx.serviceTypes = [];
    }

    // Reset context jika intent berubah (mencegah pertanyaan stale menerus)
    if (prevIntent && prevIntent !== intent) {
        console.log(`[INFO_COLLECTOR_NODE] Intent shifted: ${prevIntent} -> ${intent}. Resetting stale questions but proceeding to extraction.`);
        ctx.missingQuestions = [];
        ctx.isReadyForTools = false;
    }

    // Jika bukan booking, inquiry atau consultation, lewati ekstraksi berat (misal: GREETING)
    if (intent !== 'BOOKING_SERVICE' && intent !== 'GENERAL_INQUIRY' && intent !== 'CONSULTATION') {
        console.log(`[INFO_COLLECTOR_NODE] Skipping extraction for intent: ${intent}`);
        return { context: { ...context, missingQuestions: [] } };
    }

    const systemPrompt = `Kamu adalah Entity Extractor handal untuk Bengkel BosMat Studio.
Tugas: Analisis SELURUH riwayat chat untuk mengekstrak informasi entitas berikut. Meskipun user tidak menyebutkannya di pesan terakhir, periksa pesan-pesan sebelumnya.

DATA YANG HARUS DIEKSTRAK:
1. motor_model: Nama model motor (contoh: NMAX, Nmax Old, Vario 160, Vespa, Scoopy, dll).
2. service_types: ARRAY dari jenis layanan yang diminta user. User bisa minta lebih dari 1 layanan. Contoh: ["Repaint Bodi Halus", "Detailing Mesin"].
   Layanan resmi:
   - 'Repaint Bodi Halus', 'Repaint Bodi Kasar', 'Repaint Velg', 'Repaint Cover CVT', 'Spot Repair',
   - 'Detailing Mesin', 'Cuci Komplit', 'Poles Bodi Glossy', 'Full Detailing Glossy',
   - 'Coating Doff', 'Coating Glossy', 'Complete Service Doff', 'Complete Service Glossy'.
   PENTING: Jika user bilang "repaint" tanpa spesifik, isi "Repaint". Jika "detailing" tanpa spesifik, isi "Detailing".
3. paint_type: 'glossy' atau 'doff'.
4. is_bongkar_total: boolean (apakah user mau layanan bongkar total/hampir seluruh bagian?).
5. detailing_focus: 'baret' (poles bodi), 'mesin' (detailing mesin), 'kerangka' (cuci komplit).
6. color_choice: warna yang diinginkan user untuk Repaint BODI (Halus/Kasar). Ini KHUSUS warna bodi. "Standar" atau "Original" adalah nilai yang valid jika user ingin kembali ke warna asli pabrikan.
7. velg_color_choice: warna yang diinginkan user untuk Repaint VELG. Ini KHUSUS warna velg, TERPISAH dari warna bodi. "Standar" atau "Original" juga valid di sini.
8. is_previously_painted: boolean (khusus velg, apakah sudah pernah cat ulang/bukan ori?).

PANDUAN:
- Jika user bilang "NMAX", itu adalah motor_model.
- Jika user bilang "Coating", itu adalah service_types: ["Coating"] (tapi butuh spesifik glossy/doff nanti).
- Jika user bilang "repaint sama detailing", itu adalah service_types: ["Repaint", "Detailing"].
- Jika ada informasi yang bertentangan, ambil yang paling baru.
- Jika user menerima tawaran combo/tambah layanan, TAMBAHKAN ke service_types (jangan replace).
- Jika user menyebutkan warna dalam konteks velg, isi ke velg_color_choice. Jika dalam konteks bodi, isi ke color_choice.
- Jika user bilang "balik standar", "warna aslinya", atau "original", isi color_choice atau velg_color_choice dengan "standar".

FORMAT JAWABAN (JSON ONLY):
{
  "motor_model": string | null,
  "service_types": string[],
  "paint_type": "glossy" | "doff" | null,
  "is_bongkar_total": boolean | null,
  "detailing_focus": "baret" | "mesin" | "kerangka" | null,
  "color_choice": string | null,
  "velg_color_choice": string | null,
  "is_previously_painted": boolean | null
}`;

    try {
        const response = await model.invoke([
            new SystemMessage(systemPrompt),
            new HumanMessage(messages.map(m => m.content).join('\n'))
        ]);

        console.log(`[INFO_COLLECTOR_NODE] Raw extraction: ${response.content}`);
        const rawResult = response.content.replace(/```json|```/g, '').trim();
        const extracted = JSON.parse(rawResult);

        // Update vehicleType (overwrite with latest if provided)
        if (extracted.motor_model) ctx.vehicleType = extracted.motor_model;

        // Update serviceTypes (smart merge with dedup)
        const extractedServices = Array.isArray(extracted.service_types)
            ? extracted.service_types
            : (extracted.service_type ? [extracted.service_type] : []);
        
        // Generic → Specific mapping for dedup
        const GENERIC_PARENTS = ['repaint', 'detailing', 'coating', 'poles', 'cuci'];
        
        for (const svc of extractedServices) {
            if (!svc) continue;
            const svcLower = svc.toLowerCase();
            
            // Check if this is a generic name AND a specific version already exists
            if (GENERIC_PARENTS.includes(svcLower)) {
                const hasSpecific = ctx.serviceTypes.some(s => s.toLowerCase().includes(svcLower) && s.toLowerCase() !== svcLower);
                if (hasSpecific) {
                    console.log(`[INFO_COLLECTOR_NODE] Skipping generic "${svc}" — specific version already present.`);
                    continue; // Don't add "Repaint" if "Repaint Bodi Halus" exists
                }
            }
            
            // Check if a specific version is being added → remove the generic version
            for (const parent of GENERIC_PARENTS) {
                if (svcLower.includes(parent) && svcLower !== parent) {
                    const genericIdx = ctx.serviceTypes.findIndex(s => s.toLowerCase() === parent);
                    if (genericIdx !== -1) {
                        console.log(`[INFO_COLLECTOR_NODE] Replacing generic "${ctx.serviceTypes[genericIdx]}" with specific "${svc}".`);
                        ctx.serviceTypes.splice(genericIdx, 1);
                    }
                }
            }
            
            // Add if not already present
            if (!ctx.serviceTypes.some(s => s.toLowerCase() === svcLower)) {
                ctx.serviceTypes.push(svc);
            }
        }

        // Update other fields
        if (extracted.paint_type && !ctx.paintType) ctx.paintType = extracted.paint_type;
        if (extracted.is_bongkar_total !== null && ctx.isBongkarTotal === null) ctx.isBongkarTotal = extracted.is_bongkar_total;
        if (extracted.detailing_focus && !ctx.detailingFocus) ctx.detailingFocus = extracted.detailing_focus;
        if (extracted.color_choice && !ctx.colorChoice) ctx.colorChoice = extracted.color_choice;
        if (extracted.velg_color_choice && !ctx.velgColorChoice) ctx.velgColorChoice = extracted.velg_color_choice;
        if (extracted.is_previously_painted !== null && ctx.isPreviouslyPainted === null) ctx.isPreviouslyPainted = extracted.is_previously_painted;

    } catch (error) {
        console.error('[INFO_COLLECTOR_NODE] Extraction failed:', error.message);
    }

    // --- LOGIKA DECISION TREE (MISSING QUESTIONS - PING PONG STYLE) ---
    let missingQuestion = null;

    // Priority 1: Vehicle Type (Mandatory for everything)
    if (!ctx.vehicleType) {
        missingQuestion = "Boleh sebutin tipe motornya? (misal: Scoopy 2021, NMax old, PCX 160)";
    }
    // Priority 2: At least 1 service type
    else if (ctx.serviceTypes.length === 0) {
        missingQuestion = "Rencananya mau pakai layanan apa nih? (Misalnya: Repaint full bodi, Coating, atau Detailing aja?)";
    }
    // Priority 3: Resolve generic service names
    else {
        // Check each service and resolve generic names first
        for (let i = 0; i < ctx.serviceTypes.length; i++) {
            const svc = ctx.serviceTypes[i].toLowerCase();

            // Generic "Repaint" needs sub-category
            if (svc === 'repaint') {
                missingQuestion = "Mau cat bagian mana? Bodi Halus, Bodi Kasar, Velg, atau CVT/Arm?";
                break;
            }
            // Generic "Detailing" needs sub-category
            if (svc === 'detailing') {
                missingQuestion = "Masalah utamanya di mana? Mau ngilangin baret bodi, mesin kotor, atau cuci bongkar total?";
                break;
            }
            // Generic "Coating" needs sub-category
            if (svc === 'coating') {
                missingQuestion = "Cat motornya sekarang jenisnya Glossy (mengkilap) atau Doff/Matte?";
                break;
            }
        }

        // Priority 4: Service-specific questions (per service)
        if (!missingQuestion) {
            for (const svc of ctx.serviceTypes) {
                const svcLower = svc.toLowerCase();

                // Coating & Complete Service specifics
                if (svcLower.includes('coating') || svcLower.includes('complete service')) {
                    if (!ctx.paintType) {
                        missingQuestion = "Cat motor sekarang jenisnya Glossy (mengkilap) atau Doff/Matte?";
                        break;
                    }
                    if (ctx.isBongkarTotal === null && svcLower.includes('coating')) {
                        missingQuestion = "Mau proteksi bodi luarnya aja, atau mau dibongkar total sampai ke rangka dan mesin (Complete Service)?";
                        break;
                    }
                }
                // Detailing specifics
                else if (svcLower.includes('detailing') || svcLower.includes('poles') || svcLower.includes('cuci')) {
                    if (!ctx.detailingFocus) {
                        missingQuestion = "Masalah utamanya di mana? Mau ngilangin baret bodi, mesin kotor, atau cuci bongkar total?";
                        break;
                    }
                    if (!ctx.paintType && (svcLower.includes('poles') || svcLower.includes('full detailing'))) {
                        missingQuestion = "Cat motornya sekarang jenisnya Glossy atau Doff?";
                        break;
                    }
                }
                // Repaint specifics
                else if (svcLower.includes('repaint')) {
                    if (svcLower.includes('halus') && !ctx.colorChoice) {
                        missingQuestion = `Untuk Repaint Bodi Halus ${ctx.vehicleType}-nya, rencana mau ganti warna apa? (misal: Hitam, Putih, Abu-abu)`;
                        break;
                    }
                    if (svcLower.includes('velg') && !ctx.velgColorChoice) {
                        missingQuestion = `Untuk Repaint Velg ${ctx.vehicleType}-nya, rencananya mau warna apa? (misal: Silver, Gold, atau Hitam)`;
                        break;
                    }
                    if (svcLower.includes('velg') && ctx.isPreviouslyPainted === null) {
                        missingQuestion = "Khusus velg, apakah catnya masih ori pabrik atau sudah pernah dicat ulang?";
                        break;
                    }
                }
            }
        }
    }

    // Untuk intent CONSULTATION, jangan paksa missing questions dulu (biar santai)
    if (intent === 'CONSULTATION') {
        ctx.missingQuestions = [];
    } else {
        ctx.missingQuestions = missingQuestion ? [missingQuestion] : [];
    }

    // Tentukan Shifting ke Executor
    const isReady = (intent === 'BOOKING_SERVICE' || intent === 'GENERAL_INQUIRY') && 
                   !!ctx.vehicleType && ctx.serviceTypes.length > 0 && ctx.missingQuestions.length === 0;
    
    ctx.isReadyForTools = Boolean(isReady);

    console.log(`[INFO_COLLECTOR_NODE] Extracted: ${JSON.stringify(ctx)}`);
    console.log(`[INFO_COLLECTOR_NODE] Missing Question: ${missingQuestion || 'NONE'}`);
    console.log(`[INFO_COLLECTOR_NODE] Ready for Tools: ${ctx.isReadyForTools}`);
    
    // Tentukan mode balasan (replyMode)
    let replyMode = 'inform';
    if (intent === 'GREETING') replyMode = 'greet';
    else if (intent === 'CONSULTATION') replyMode = 'consult';
    else if (ctx.missingQuestions.length > 0) replyMode = 'ask';

    return {
        intent,
        context: ctx,
        metadata: {
            ...metadata,
            replyMode
        }
    };
}

module.exports = { infoCollectorNode };
