const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { SystemMessage, HumanMessage } = require('@langchain/core/messages');
const studioMetadata = require('../../constants/studioMetadata');

const model = new ChatGoogleGenerativeAI({
    model: process.env.AI_MODEL || 'gemini-flash-lite-latest',
    maxOutputTokens: 2048,
    temperature: 0,
    responseMimeType: "application/json",
});

/**
 * Mencegah error jika content berupa Array Object (fitur Vision LangGraph)
 */
function extractTextMessage(content) {
    if (!content) return '';
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
        return content.filter(c => c.type === 'text').map(c => c.text).join(' ');
    }
    return String(content);
}

/**
 * Node: infoCollector (MERGED with classifier)
 * Single LLM call that handles BOTH intent classification AND entity extraction.
 * Eliminates one full LLM round-trip for ~600-1000ms latency reduction.
 */
async function infoCollectorNode(state) {
    console.log('--- [INFO_COLLECTOR_NODE] Starting (merged classifier+extractor) ---');
    const startTime = Date.now();
    const { messages, context, metadata } = state;
    const prevIntent = state.intent;
    const lastMessage = messages[messages.length - 1];
    const lastMessageText = extractTextMessage(lastMessage.content);

    // Helper to clean JSON string from potential markdown code blocks
    const cleanJson = (str) => {
        try {
            return str.replace(/```json\n?|```/g, '').trim();
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

    // Reset context jika intent berubah
    if (prevIntent && prevIntent !== state.intent) {
        ctx.missingQuestions = [];
        ctx.isReadyForTools = false;
    }

    // Build chat transcript (max 10 messages)
    const chatTranscript = messages.slice(-10).map(m => {
        const role = (m.type === 'human' || m.role === 'user') ? '[USER]' : '[AI]';
        return `${role}: ${extractTextMessage(m.content)}`;
    }).join('\n');

    const systemPrompt = `# ROLE
Kamu adalah AI Classifier & Data Extractor (Vision-Enabled) untuk ${studioMetadata.name}.
Tugasmu ada DUA dalam SATU kali analisis:
1. Tentukan INTENT (niat) dari pesan terakhir user.
2. Ekstrak informasi teknis kendaraan & layanan dari riwayat chat DAN GAMBAR/FOTO yang dikirim user.

# VISION EXTRACTION (NEW)
Dukung penuh analisis gambar! Jika user mengirim foto motor/mobil:
- **Analisis Motor**: Tentukan model motor (Nmax, Vespa, dll) dan warna aslinya dari foto.
- **Analisis Kondisi**: Perhatikan apakah velg sudah pernah dicat (tidak ori), ada lecet bodi, atau bagian yang kusam.
- **Warna**: Gunakan foto untuk mengonfirmasi "color_choice" jika user bilang "warna kayak gini".
- **Visual Summary**: Wajib isi field "visual_summary" dengan deskripsi singkat (1-2 kalimat) tentang apa yang kamu lihat dalam foto.

# INTENT CATEGORIES (Pilih SATU)
- **GREETING**: Sapaan awal (Halo, P, Assalamualaikum).
- **CONSULTATION**: Tanya promo atau tanya saran umum tanpa detail motor.
- **BOOKING_SERVICE**: Niat servis, tanya harga layanan tertentu, atau menjawab pertanyaan teknis AI.
- **GENERAL_INQUIRY**: Tanya lokasi, jam buka, kontak studio, atau kebingungan mencari lokasi (misal: "saya sudah di depan", "patokannya apa?", "sebelah mana?", "nyasar").
- **HUMAN_HANDOVER**: Minta bicara dengan admin manusia.
- **OTHER**: Di luar kategori di atas.

# EXTRACTION RULES
Ekstrak data ke dalam format JSON dengan field berikut:
1. **intent**: Satu keyword intent dari daftar di atas (UPPERCASE).
2. **internal_thought**: (Chain-of-Thought) Analisis singkat: Apa yang user mau? Apa yang kamu lihat di foto? Data apa yang baru didapat?
3. **motor_model**: Jenis motor (Nmax, Scoopy, dll). Jika user menyebut *Mobil*, masukkan "Mobil".
4. **service_types**: Array layanan (Repaint, Detailing, Coating, Cuci).
5. **paint_type**: Jenis cat (Glossy / Doff).
6. **is_bongkar_total**: (Boolean/null) Jika user sebut "bongkar total" atau "bongkar mesin".
7. **detailing_focus**: Fokus area (Bodi Halus, Bodi Kasar, Velg, Mesin).
8. **color_choice**: Warna bodi yang diinginkan.
9. **velg_color_choice**: Warna velg (SERINGKALI berbeda dengan bodi).
10. **is_previously_painted**: (Boolean/null) Jika motor/velg sudah pernah dicat ulang (terlihat di foto atau disebut user).
11. **visual_summary**: Deskripsi singkat apa yang terlihat di gambar.

# INTENT RULES
- JIKA user hanya menyapa (Halo, P, Assalamualaikum), WAJIB intent = "GREETING".
- JIKA user menjawab pertanyaan AI tentang motor/layanan, intent = "BOOKING_SERVICE".

# EXTRACTION STRATEGY
- **Bodi Halus vs Kasar**: Jika user sebut "bodi kasar", masukkan ke \`detailing_focus\`.
- **Warna**: Bedakan dengan teliti antara warna bodi dan warna velg.
- **Visual Summary**: Wajib isi field "visual_summary" dengan deskripsi singkat (1-2 kalimat) tentang apa yang kamu lihat dalam foto.
- **Negative Constraint**: JANGAN menebak data yang tidak ada. Jika ragu, berikan \`null\`.
- **Context Awareness**: Gunakan riwayat untuk melengkapi data yang sebelumnya sudah disebutkan.

# EXAMPLE
User: (Mengirim foto Nmax Merah) "repaint ini glossy kena berapa?"
Output: {
  "intent": "BOOKING_SERVICE",
  "internal_thought": "User mengirim foto Yamaha Nmax warna merah. Ingin estimasi harga repaint glossy.",
  "motor_model": "Nmax",
  "service_types": ["Repaint"],
  "paint_type": "Glossy",
  "detailing_focus": "Bodi Halus",
  "color_choice": "Merah",
  "visual_summary": "Foto menampakkan Yamaha Nmax warna merah glossy standar dengan bodi yang masih cukup mulus."
}`;

    // --- SINGLE LLM CALL: classify + extract ---
    let classifiedIntent = 'GENERAL_INQUIRY';
    let extracted = {};

    try {
        const visionContent = [
            { 
                type: 'text', 
                text: `BERIKUT ADALAH KONTEKS PERCAKAPAN:\n\n${chatTranscript}\n\nPESAN TERAKHIR USER (Mungkin disertai gambar/foto):\n` 
            }
        ];

        // Masukkan content pesan terakhir (bisa berupa Array [text, image_url] atau string)
        if (Array.isArray(lastMessage.content)) {
            visionContent.push(...lastMessage.content);
        } else {
            visionContent.push({ type: 'text', text: lastMessage.content || '[Tanpa Teks]' });
        }

        const response = await model.invoke([
            new SystemMessage(systemPrompt),
            new HumanMessage({ content: visionContent })
        ]);

        const cleanedContent = cleanJson(response.content);
        extracted = JSON.parse(cleanedContent);
        console.log(`[INFO_COLLECTOR_NODE] Thread Analysis: ${extracted.internal_thought}`);

        // --- INTENT PROCESSING ---
        classifiedIntent = (extracted.intent || 'GENERAL_INQUIRY').trim().toUpperCase();

        // Continuation logic (from old classifier): keep BOOKING_SERVICE for short replies
        const isShortReply = lastMessageText.split(' ').length <= 15;
        const containsBookingKeywords = /warna|cat|nmax|scoopy|pcx|vespa|vario|repaint|detailing|coating|poles/i.test(lastMessageText);

        if (prevIntent === 'BOOKING_SERVICE' && (isShortReply || containsBookingKeywords)) {
            const studioKeywords = /lokasi|alamat|dimana|buka|tutup|istirahat|jam berapa|kontak|wa|map|maps|koordinat/i.test(lastMessageText);
            
            if (['OTHER', 'GREETING', 'GENERAL_INQUIRY'].includes(classifiedIntent)) {
                if (classifiedIntent === 'GENERAL_INQUIRY' && studioKeywords) {
                    console.log(`[INFO_COLLECTOR_NODE] Keeping GENERAL_INQUIRY for studio info request.`);
                } else {
                    console.log(`[INFO_COLLECTOR_NODE] Intent recovery: ${classifiedIntent} → BOOKING_SERVICE (flow continuation).`);
                    classifiedIntent = 'BOOKING_SERVICE';
                }
            }
        }

        // Validate intent
        const validIntents = ['GREETING', 'CONSULTATION', 'BOOKING_SERVICE', 'GENERAL_INQUIRY', 'HUMAN_HANDOVER', 'OTHER'];
        if (!validIntents.includes(classifiedIntent)) classifiedIntent = 'GENERAL_INQUIRY';
        console.log(`[INFO_COLLECTOR_NODE] Intent: ${classifiedIntent} (Prev: ${prevIntent})`);

        // --- SKIP EXTRACTION for non-relevant intents ---
        if (classifiedIntent !== 'BOOKING_SERVICE' && classifiedIntent !== 'GENERAL_INQUIRY' && classifiedIntent !== 'CONSULTATION') {
            const elapsed = Date.now() - startTime;
            console.log(`[INFO_COLLECTOR_NODE] Skipping extraction for ${classifiedIntent}. Done in ${elapsed}ms`);
            return {
                intent: classifiedIntent,
                context: { ...context, missingQuestions: [] },
                metadata: {
                    ...metadata,
                    prevIntent: classifiedIntent,
                    replyMode: classifiedIntent === 'GREETING' ? 'greet' : 'inform',
                    visualSummary: extracted.visual_summary || metadata.visualSummary || null
                }
            };
        }

        // --- ENTITY EXTRACTION ---
        if (extracted.motor_model) ctx.vehicleType = extracted.motor_model;

        // Smart merge serviceTypes with dedup
        const extractedServices = Array.isArray(extracted.service_types)
            ? extracted.service_types
            : (extracted.service_type ? [extracted.service_type] : []);
        
        const GENERIC_PARENTS = ['repaint', 'detailing', 'coating', 'poles', 'cuci'];
        
        for (const svc of extractedServices) {
            if (!svc) continue;
            const svcLower = svc.toLowerCase();
            
            if (GENERIC_PARENTS.includes(svcLower)) {
                const hasSpecific = ctx.serviceTypes.some(s => s.toLowerCase().includes(svcLower) && s.toLowerCase() !== svcLower);
                if (hasSpecific) {
                    console.log(`[INFO_COLLECTOR_NODE] Skipping generic "${svc}" — specific already present.`);
                    continue;
                }
            }
            
            for (const parent of GENERIC_PARENTS) {
                if (svcLower.includes(parent) && svcLower !== parent) {
                    const genericIdx = ctx.serviceTypes.findIndex(s => s.toLowerCase() === parent);
                    if (genericIdx !== -1) {
                        console.log(`[INFO_COLLECTOR_NODE] Replacing generic "${ctx.serviceTypes[genericIdx]}" with "${svc}".`);
                        ctx.serviceTypes.splice(genericIdx, 1);
                    }
                }
            }
            
            if (!ctx.serviceTypes.some(s => s.toLowerCase() === svcLower)) {
                ctx.serviceTypes.push(svc);
            }
        }

        // Update other fields (only if not null)
        if (extracted.paint_type) ctx.paintType = extracted.paint_type;
        if (extracted.is_bongkar_total !== null && extracted.is_bongkar_total !== undefined) ctx.isBongkarTotal = extracted.is_bongkar_total;
        if (extracted.detailing_focus) ctx.detailingFocus = extracted.detailing_focus;
        if (extracted.color_choice) ctx.colorChoice = extracted.color_choice;
        if (extracted.velg_color_choice) ctx.velgColorChoice = extracted.velg_color_choice;
        if (extracted.is_previously_painted !== null && extracted.is_previously_painted !== undefined) ctx.isPreviouslyPainted = extracted.is_previously_painted;
        if (extracted.booking_date) ctx.bookingDate = extracted.booking_date;
        if (extracted.booking_time) ctx.bookingTime = extracted.booking_time;

        // --- AUTO-RESOLVE generic "Repaint" using detailing_focus ---
        const genericRepaintIdx = ctx.serviceTypes.findIndex(s => s.toLowerCase() === 'repaint');
        const focusRaw = ctx.detailingFocus;
        const focusStr = typeof focusRaw === 'string' ? focusRaw : (Array.isArray(focusRaw) ? focusRaw.join(' ') : String(focusRaw || ''));
        if (genericRepaintIdx !== -1 && focusStr) {
            const focus = focusStr.toLowerCase();
            const resolvedServices = [];

            if (focus.includes('halus') || focus.includes('bodi') || focus.includes('body')) {
                resolvedServices.push('Repaint Bodi Halus');
            }
            if (focus.includes('kasar')) {
                resolvedServices.push('Repaint Bodi Kasar');
            }
            if (focus.includes('full')) {
                if (!resolvedServices.includes('Repaint Bodi Halus')) resolvedServices.push('Repaint Bodi Halus');
                if (!resolvedServices.includes('Repaint Bodi Kasar')) resolvedServices.push('Repaint Bodi Kasar');
            }
            if (focus.includes('velg') || focus.includes('pelek')) {
                resolvedServices.push('Repaint Velg');
            }
            if (focus.includes('cvt')) {
                resolvedServices.push('Repaint CVT');
            }

            if (resolvedServices.length > 0) {
                ctx.serviceTypes.splice(genericRepaintIdx, 1, ...resolvedServices);
                ctx.serviceTypes = [...new Set(ctx.serviceTypes)];
                console.log(`[INFO_COLLECTOR_NODE] Resolved "Repaint" → [${resolvedServices.join(', ')}] from detailing_focus="${ctx.detailingFocus}"`);
            }
        }

    } catch (error) {
        console.error('[INFO_COLLECTOR_NODE] Extraction failed:', error.message);
        const elapsed = Date.now() - startTime;
        console.log(`[INFO_COLLECTOR_NODE] ⚡ Completed (error fallback) in ${elapsed}ms`);
        return {
            intent: 'GENERAL_INQUIRY',
            context: { ...context, missingQuestions: [] },
            metadata: { ...metadata, prevIntent, replyMode: 'inform' }
        };
    }

    // --- DECISION TREE (MISSING QUESTIONS) ---
    let missingQuestion = null;

    if (!ctx.vehicleType) {
        missingQuestion = "Tanyakan tipe motor user (contoh: Nmax, Scoopy, Vario)";
    } else if (ctx.serviceTypes.length === 0) {
        missingQuestion = "Tanyakan rencana layanan yang diinginkan (Repaint, Coating, atau Detailing)";
    } else {
        // Resolve generic service names first
        for (let i = 0; i < ctx.serviceTypes.length; i++) {
            const svc = ctx.serviceTypes[i].toLowerCase();
            if (svc === 'repaint') {
                missingQuestion = "Tanyakan detail bagian yang mau di-repaint (Bodi Halus, Kasar, Velg, atau CVT)";
                break;
            }
            if (svc === 'detailing') {
                missingQuestion = "Tanyakan fokus detailingnya (Hilangkan baret bodi, bersihkan mesin, atau cuci bongkar total)";
                break;
            }
            if (svc === 'coating') {
                missingQuestion = "Tanyakan jenis cat saat ini (Glossy atau Doff/Matte)";
                break;
            }
        }

        // Service-specific questions
        if (!missingQuestion) {
            for (const svc of ctx.serviceTypes) {
                const svcLower = svc.toLowerCase();
                if (svcLower.includes('coating') || svcLower.includes('complete service')) {
                    if (!ctx.paintType) { missingQuestion = "Cari tahu jenis cat motor (Glossy atau Doff)"; break; }
                    if (ctx.isBongkarTotal === null && svcLower.includes('coating')) { missingQuestion = "Tanyakan apakah mau proteksi bodi saja atau bongkar total (Complete Service)"; break; }
                } else if (svcLower.includes('detailing') || svcLower.includes('poles') || svcLower.includes('cuci')) {
                    if (!ctx.detailingFocus) { missingQuestion = "Tanyakan fokus pembersihan (Bodi, Mesin, atau Kolong)"; break; }
                    if (!ctx.paintType && (svcLower.includes('poles') || svcLower.includes('full detailing'))) { missingQuestion = "Pastikan jenis catnya Glossy atau Doff"; break; }
                } else if (svcLower.includes('repaint')) {
                    if (svcLower.includes('halus') && !ctx.colorChoice) { missingQuestion = "Tanyakan rencana warna baru untuk bodi halusnya"; break; }
                    if (svcLower.includes('velg') && !ctx.velgColorChoice) { missingQuestion = "Tanyakan pilihan warna untuk repaint velgnya"; break; }
                    if (svcLower.includes('velg') && ctx.isPreviouslyPainted === null) { missingQuestion = "Tanyakan apakah velg masih cat ori pabrik atau sudah pernah repaint"; break; }
                }
            }
        }
    }

    // For CONSULTATION, keep relaxed (no forced questions)
    if (classifiedIntent === 'CONSULTATION') {
        ctx.missingQuestions = [];
    } else {
        ctx.missingQuestions = missingQuestion ? [missingQuestion] : [];
    }

    // Determine readiness for tool execution
    const hasGenericService = ctx.serviceTypes.some(s => ['repaint', 'detailing', 'coating'].includes(s.toLowerCase()));
    const isHumanHandoff = classifiedIntent === 'HUMAN_HANDOVER' || ctx.vehicleType === 'Mobil';
    const isReady = isHumanHandoff || 
                   ((classifiedIntent === 'BOOKING_SERVICE' || classifiedIntent === 'GENERAL_INQUIRY') && 
                   !!ctx.vehicleType && ctx.serviceTypes.length > 0 && !hasGenericService);
                   
    ctx.isReadyForTools = Boolean(isReady);

    // Determine reply mode
    let replyMode = 'inform';
    if (classifiedIntent === 'GREETING') replyMode = 'greet';
    else if (classifiedIntent === 'CONSULTATION') replyMode = 'consult';
    else if (ctx.missingQuestions.length > 0) replyMode = 'ask';

    const elapsed = Date.now() - startTime;
    console.log(`[INFO_COLLECTOR_NODE] Ready: ${ctx.isReadyForTools} | Missing: ${missingQuestion || 'NONE'} | ${elapsed}ms`);

    // --- UPDATE METADATA ---
    const newMetadata = { 
        ...metadata, 
        prevIntent: classifiedIntent,
        replyMode,
        visualSummary: extracted.visual_summary || metadata.visualSummary || null
    };

    console.log(`[INFO_COLLECTOR_NODE] Visual Summary: ${newMetadata.visualSummary || 'None'}`);

    return {
        intent: classifiedIntent,
        context: ctx,
        metadata: newMetadata
    };
}

module.exports = { infoCollectorNode };
