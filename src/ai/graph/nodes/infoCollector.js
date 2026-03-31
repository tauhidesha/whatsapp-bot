const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { SystemMessage, HumanMessage } = require('@langchain/core/messages');

const model = new ChatGoogleGenerativeAI({
    model: process.env.AI_MODEL || 'gemini-flash-lite-latest',
    maxOutputTokens: 2048,
    temperature: 0,
    responseMimeType: "application/json",
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

    // Helper to clean JSON string from potential markdown code blocks
    const cleanJson = (str) => {
        try {
            // Remove markdown code blocks if present
            const cleaned = str.replace(/```json\n?|```/g, '').trim();
            return cleaned;
        } catch (e) {
            return str;
        }
    };

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

    const systemPrompt = `# ROLE
Kamu adalah Expert Data Extractor untuk Bengkel BosMat Studio. 
Tugasmu adalah menganalisis percakapan dan mengekstrak informasi teknis kendaraan serta layanan.

# EXTRACTION RULES
Ekstrak data ke dalam format JSON dengan field berikut:
1. **internal_thought**: (Chain-of-Thought) Analisis singkat: Apa yang user mau? Data apa yang baru didapat? Apa data yang masih kurang?
2. **motor_model**: Jenis motor (Nmax, Scoopy, dll).
3. **service_types**: Array layanan (Repaint, Detailing, Coating, Cuci).
4. **paint_type**: Jenis cat (Glossy / Doff).
5. **is_bongkar_total**: (Boolean/null) Jika user sebut "bongkar total" atau "bongkar mesin".
6. **detailing_focus**: Fokus area (Bodi Halus, Bodi Kasar, Velg, Mesin).
7. **color_choice**: Warna bodi yang diinginkan.
8. **velg_color_choice**: Warna velg (SERINGKALI berbeda dengan bodi).
9. **is_previously_painted**: (Boolean/null) Jika motor sudah pernah dicat ulang sebelumnya (bukan cat pabrik).

# EXTRACTION STRATEGY
- **Bodi Halus vs Kasar**: Jika user sebut "bodi kasar", masukkan ke \`detailing_focus\`.
- **Warna**: Bedakan dengan teliti antara warna bodi dan warna velg.
- **Negative Constraint**: JANGAN menebak data yang tidak ada. Jika ragu, berikan \`null\`.
- **Context Awareness**: Gunakan riwayat untuk melengkapi data yang sebelumnya sudah disebutkan.

# EXAMPLE
User: "repaint nmax glossy warna merah candy, velgnya silver"
Output: {
  "internal_thought": "User ingin repaint Nmax warna merah candy glossy dengan velg silver.",
  "motor_model": "Nmax",
  "service_types": ["Repaint"],
  "paint_type": "Glossy",
  "detailing_focus": "Bodi Halus & Velg",
  "color_choice": "Merah Candy",
  "velg_color_choice": "Silver"
}`;

    try {
        // Process limited chat history with speaker labels (max 10 messages)
        const chatTranscript = messages.slice(-10).map(m => {
            const role = (m.type === 'human' || m.role === 'user') ? '[USER]' : '[AI]';
            return `${role}: ${m.content}`;
        }).join('\n');

        const response = await model.invoke([
            new SystemMessage(systemPrompt),
            new HumanMessage(chatTranscript)
        ]);

        console.log(`[INFO_COLLECTOR_NODE] Raw extraction: ${response.content}`);
        const cleanedContent = cleanJson(response.content);
        const extracted = JSON.parse(cleanedContent);
        console.log(`[INFO_COLLECTOR_NODE] Thread Analysis: ${extracted.internal_thought}`);

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
        if (extracted.paint_type) ctx.paintType = extracted.paint_type;
        if (extracted.is_bongkar_total !== null) ctx.isBongkarTotal = extracted.is_bongkar_total;
        if (extracted.detailing_focus) ctx.detailingFocus = extracted.detailing_focus;
        if (extracted.color_choice) ctx.colorChoice = extracted.color_choice;
        if (extracted.velg_color_choice) ctx.velgColorChoice = extracted.velg_color_choice;
        if (extracted.is_previously_painted !== null) ctx.isPreviouslyPainted = extracted.is_previously_painted;
        if (extracted.booking_date) ctx.bookingDate = extracted.booking_date;
        if (extracted.booking_time) ctx.bookingTime = extracted.booking_time;

    } catch (error) {
        console.error('[INFO_COLLECTOR_NODE] Extraction failed:', error.message);
    }

    // --- LOGIKA DECISION TREE (MISSING QUESTIONS - PING PONG STYLE) ---
    let missingQuestion = null;

    // Priority 1: Vehicle Type (Mandatory for everything)
    if (!ctx.vehicleType) {
        missingQuestion = "Tanyakan tipe motor user (contoh: Nmax, Scoopy, Vario)";
    }
    // Priority 2: At least 1 service type
    else if (ctx.serviceTypes.length === 0) {
        missingQuestion = "Tanyakan rencana layanan yang diinginkan (Repaint, Coating, atau Detailing)";
    }
    // Priority 3: Resolve generic service names
    else {
        // Check each service and resolve generic names first
        for (let i = 0; i < ctx.serviceTypes.length; i++) {
            const svc = ctx.serviceTypes[i].toLowerCase();

            // Generic "Repaint" needs sub-category
            if (svc === 'repaint') {
                missingQuestion = "Tanyakan detail bagian yang mau di-repaint (Bodi Halus, Kasar, Velg, atau CVT)";
                break;
            }
            // Generic "Detailing" needs sub-category
            if (svc === 'detailing') {
                missingQuestion = "Tanyakan fokus detailingnya (Hilangkan baret bodi, bersihkan mesin, atau cuci bongkar total)";
                break;
            }
            // Generic "Coating" needs sub-category
            if (svc === 'coating') {
                missingQuestion = "Tanyakan jenis cat saat ini (Glossy atau Doff/Matte)";
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
                        missingQuestion = "Cari tahu jenis cat motor (Glossy atau Doff)";
                        break;
                    }
                    if (ctx.isBongkarTotal === null && svcLower.includes('coating')) {
                        missingQuestion = "Tanyakan apakah mau proteksi bodi saja atau bongkar total (Complete Service)";
                        break;
                    }
                }
                // Detailing specifics
                else if (svcLower.includes('detailing') || svcLower.includes('poles') || svcLower.includes('cuci')) {
                    if (!ctx.detailingFocus) {
                        missingQuestion = "Tanyakan fokus pembersihan (Bodi, Mesin, atau Kolong)";
                        break;
                    }
                    if (!ctx.paintType && (svcLower.includes('poles') || svcLower.includes('full detailing'))) {
                        missingQuestion = "Pastikan jenis catnya Glossy atau Doff";
                        break;
                    }
                }
                // Repaint specifics
                else if (svcLower.includes('repaint')) {
                    if (svcLower.includes('halus') && !ctx.colorChoice) {
                        missingQuestion = "Tanyakan rencana warna baru untuk bodi halusnya";
                        break;
                    }
                    if (svcLower.includes('velg') && !ctx.velgColorChoice) {
                        missingQuestion = "Tanyakan pilihan warna untuk repaint velgnya";
                        break;
                    }
                    if (svcLower.includes('velg') && ctx.isPreviouslyPainted === null) {
                        missingQuestion = "Tanyakan apakah velg masih cat ori pabrik atau sudah pernah repaint";
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
