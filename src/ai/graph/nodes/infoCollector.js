const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { SystemMessage, HumanMessage } = require('@langchain/core/messages');
const studioMetadata = require('../../constants/studioMetadata');
const { withRetry } = require('../../utils/retry');
const { sanitizeMessagesForGemini, extractTextFromContent } = require('../utils/sanitizeMessages');

const model = new ChatGoogleGenerativeAI({
    model: process.env.VISION_MODEL || process.env.AI_MODEL || "gemini-1.5-flash",
    maxOutputTokens: 2048,
    temperature: 0,
    responseMimeType: "application/json",
});

// extractTextMessage removed - now using extractTextFromContent from shared utility

/**
 * Node: infoCollector (MERGED with classifier)
 * Single LLM call that handles BOTH intent classification AND entity extraction.
 * Eliminates one full LLM round-trip for ~600-1000ms latency reduction.
 */
async function infoCollectorNode(state) {
    console.log('--- [INFO_COLLECTOR_NODE] Starting (merged classifier+extractor) ---');
    const startTime = Date.now();
    const { context, metadata } = state;
    const sanitizedMessages = sanitizeMessagesForGemini(state.messages);
    const prevIntent = state.intent;
    const lastMessage = sanitizedMessages[sanitizedMessages.length - 1];
    const lastMessageText = extractTextFromContent(lastMessage.content);
    console.log(`[INFO_COLLECTOR_NODE] User Input: "${lastMessageText}"`);

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
    const chatTranscript = sanitizedMessages.slice(-10).map(m => {
        const role = (m.type === 'human' || m.role === 'user') ? '[USER]' : '[AI]';
        return `${role}: ${extractTextFromContent(m.content)}`;
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
- **GENERAL_INQUIRY**: Tanya lokasi, jam buka, kontak studio, atau kebingungan mencari lokasi. (PENTING: Jika pesan berisi "Shareloc" atau template iklan seperti "Bosmat Studio berlokasi di area Depok", MASUKKAN KE SINI, JANGAN HUMAN_HANDOVER).
- **HUMAN_HANDOVER**: Minta bicara dengan admin manusia, konsultasi konsep motor/warna custom, atau meminta warna spesial (Bunglon, Chrome, Hologram). (Kecuali pesan dari template iklan).
- **OTHER**: Di luar kategori di atas.

# EXTRACTION RULES
Ekstrak data ke dalam format JSON dengan field berikut:
1. **intent**: Satu keyword intent dari daftar di atas (UPPERCASE).
2. **internal_thought**: (Chain-of-Thought) Analisis singkat: Apa yang user mau? Apa yang kamu lihat di foto? Data apa yang baru didapat?
3. **motor_model**: Jenis motor (Nmax, Scoopy, dll). Jika user menyebut *Mobil*, masukkan "Mobil".
4. **service_types**: Array layanan (Repaint, Detailing, Coating, Cuci).
5. **paint_type**: (JANGAN TEBAK! Wajib diisi HANYA JIKA user secara eksplisit menyebut "glossy", "doff", atau "matte" di teks. Jika tidak disebut, biarkan null).
6. **is_bongkar_total**: (Boolean/null) Jika user sebut "bongkar total", "bongkar mesin", "sampai rangka", atau "full" (untuk detailing).
7. **detailing_focus**: Fokus area (Bodi Halus, Bodi Kasar, Velg, Mesin). (JANGAN TEBAK! Hanya isi jika user secara eksplisit menyebutkannya. Jika user bilang "full detailing", biarkan null dan set is_bongkar_total = true. TAPI jika user bilang "full bodi" untuk repaint, isi dengan "full bodi").
8. **color_choice**: Warna bodi yang diinginkan.
9. **velg_color_choice**: Warna velg (SERINGKALI berbeda dengan bodi).
10. **is_previously_painted**: (Boolean/null) Jika motor/velg sudah pernah dicat ulang (terlihat di foto atau disebut user).
11. **package_choice**: Pilihan paket layanan yang user pilih (contoh: "Premium", "Standar", "Basic", "Ekonomis", "Complete Service"). Wajib diisi jika user secara eksplisit memilih salah satu dari opsi paket yang ditawarkan. Jika belum pilih, biarkan null.
12. **is_confirming_visit**: (Boolean/null) Jika user secara eksplisit setuju untuk datang, booking, atau mengonfirmasi kedatangan (misal: "iya", "boleh dibooking", "nanti sore saya ke sana", "otw").
13. **visual_summary**: Deskripsi singkat apa yang terlihat di gambar.

# INTENT RULES
- JIKA user hanya menyapa (Halo, P, Assalamualaikum), WAJIB intent = "GREETING".
- JIKA user menjawab pertanyaan AI tentang motor/layanan, intent = "BOOKING_SERVICE".

# EXTRACTION STRATEGY
- **Multi-Motor Constraint**: JIKA user menyebutkan lebih dari 1 motor (misal: "mau repaint aerox dan coating nmax"), FOKUS HANYA pada motor PERTAMA yang disebut. Abaikan data motor kedua sampai motor pertama selesai diproses.
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
            // Filter out 'thinking' blocks to prevent Gemini API errors
            const filteredContent = lastMessage.content.filter(c => c.type !== 'thinking');
            visionContent.push(...filteredContent);
        } else {
            visionContent.push({ type: 'text', text: lastMessage.content || '[Tanpa Teks]' });
        }

        // Log vision content types for debugging
        const visionDebug = visionContent.map(c => ({
            type: c.type,
            data_sample: (c.text || '').substring(0, 50) || (c.image_url ? c.image_url.substring(0, 50) + '...' : 'no_data')
        }));
        console.log(`[INFO_COLLECTOR_NODE] Vision Payload:`, JSON.stringify(visionDebug));

        const response = await withRetry(() => model.invoke([
            new SystemMessage(systemPrompt),
            new HumanMessage({ content: visionContent })
        ]), { maxRetries: 3, baseDelayMs: 1500 });


        const rawResponse = extractTextFromContent(response.content);
        const cleanedContent = cleanJson(rawResponse);
        extracted = JSON.parse(cleanedContent);
        console.log(`[INFO_COLLECTOR_NODE] Raw Extracted Data:`, JSON.stringify(extracted));
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
        if (extracted.detailing_focus) {
            const focusStr = typeof extracted.detailing_focus === 'string' ? extracted.detailing_focus.toLowerCase() : '';
            if (focusStr === 'full' || focusStr === 'full detailing') {
                ctx.isBongkarTotal = true;
                ctx.detailingFocus = null;
            } else {
                ctx.detailingFocus = extracted.detailing_focus;
            }
        }
        if (extracted.color_choice) ctx.colorChoice = extracted.color_choice;
        if (extracted.velg_color_choice) ctx.velgColorChoice = extracted.velg_color_choice;
        if (extracted.package_choice) ctx.packageChoice = extracted.package_choice;
        if (extracted.is_previously_painted !== null && extracted.is_previously_painted !== undefined) {
            ctx.isPreviouslyPainted = extracted.is_previously_painted;
        }
        if (extracted.is_confirming_visit === true) {
            ctx.isConfirmingVisit = true;
        }
        if (extracted.booking_date) ctx.bookingDate = extracted.booking_date;
        if (extracted.booking_time) ctx.bookingTime = extracted.booking_time;

        // --- AUTO-RESOLVE generic "Repaint" using detailing_focus ---
        const genericRepaintIdx = ctx.serviceTypes.findIndex(s => s.toLowerCase() === 'repaint');
        const hasRepaintKeyword = ctx.serviceTypes.some(s => s.toLowerCase().includes('repaint')) || extractedServices.some(s => s.toLowerCase().includes('repaint'));
        const focusRaw = ctx.detailingFocus;
        const focusStr = typeof focusRaw === 'string' ? focusRaw : (Array.isArray(focusRaw) ? focusRaw.join(' ') : String(focusRaw || ''));
        
        if (hasRepaintKeyword && focusStr) {
            const focus = focusStr.toLowerCase();
            const resolvedServices = [];

            const hasHalus = focus.includes('halus');
            const hasKasar = focus.includes('kasar');
            const hasFull = focus.includes('full');
            const hasBodi = focus.includes('bodi') || focus.includes('body');

            if (hasFull) {
                if (!resolvedServices.includes('Repaint Bodi Halus')) resolvedServices.push('Repaint Bodi Halus');
                if (!resolvedServices.includes('Repaint Bodi Kasar')) resolvedServices.push('Repaint Bodi Kasar');
            } else {
                if (hasHalus || (hasBodi && !hasKasar)) {
                    resolvedServices.push('Repaint Bodi Halus');
                }
                if (hasKasar) {
                    resolvedServices.push('Repaint Bodi Kasar');
                }
            }
            if (focus.includes('velg') || focus.includes('pelek')) {
                resolvedServices.push('Repaint Velg');
            }
            if (focus.includes('cvt')) {
                resolvedServices.push('Repaint CVT');
            }

            if (resolvedServices.length > 0) {
                if (genericRepaintIdx !== -1) {
                    ctx.serviceTypes.splice(genericRepaintIdx, 1, ...resolvedServices);
                } else {
                    ctx.serviceTypes.push(...resolvedServices);
                }
                ctx.serviceTypes = [...new Set(ctx.serviceTypes)];
                console.log(`[INFO_COLLECTOR_NODE] Resolved "Repaint" focus → [${resolvedServices.join(', ')}] from detailing_focus="${ctx.detailingFocus}"`);
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

    // --- AUTO-RESOLVE CONFLICT (Repaint + Poles/Coating) ---
    const hasRepaintHalus = ctx.serviceTypes.some(s => s.toLowerCase().includes('repaint bodi halus'));
    if (hasRepaintHalus) {
        const conflictServices = ctx.serviceTypes.filter(s => {
            const low = s.toLowerCase();
            return low.includes('poles') || low.includes('coating') || (low.includes('detailing') && !low.includes('mesin') && !low.includes('velg')) || low.includes('complete service');
        });
        if (conflictServices.length > 0) {
            console.log(`[INFO_COLLECTOR_NODE] Conflict detected: Repaint Halus + ${conflictServices.join(', ')}. Removing conflicts and adding Cuci Komplit.`);
            ctx.serviceTypes = ctx.serviceTypes.filter(s => !conflictServices.includes(s));
            if (!ctx.serviceTypes.some(s => s.toLowerCase() === 'cuci komplit')) {
                ctx.serviceTypes.push('Cuci Komplit');
            }
            ctx.curingWarning = true;
            ctx.conflictServices = conflictServices;
        }
    }

    // --- DECISION TREE (MISSING QUESTIONS) ---
    let missingQuestion = null;
    const lastMsgLower = lastMessageText.toLowerCase();
    const studioKeywords = /lokasi|alamat|dimana|buka|tutup|istirahat|jam berapa|kontak|wa|map|maps|koordinat/i.test(lastMsgLower);

    // Only force motor model if we are in booking flow and don't have it
    const needsMotorModel = (classifiedIntent === 'BOOKING_SERVICE');

    if (needsMotorModel && !ctx.vehicleType) {
        missingQuestion = "Tanyakan tipe motor user (contoh: Nmax, Scoopy, Vario)";
    } else if (needsMotorModel && ctx.serviceTypes.length === 0) {
        missingQuestion = "Tanyakan rencana layanan yang diinginkan (Repaint, Coating, atau Detailing)";
    } else if (classifiedIntent === 'BOOKING_SERVICE') {
        // Resolve generic service names first
        for (let i = 0; i < ctx.serviceTypes.length; i++) {
            const svc = ctx.serviceTypes[i].toLowerCase();
            if (svc === 'repaint') {
                missingQuestion = "Tanyakan detail bagian yang mau di-repaint (Bodi Halus, Kasar, Velg, atau CVT)";
                break;
            }
            // Detailing generic check
            if (svc === 'detailing' || svc === 'full detailing') {
                if (ctx.isBongkarTotal) {
                    if (ctx.paintType) {
                        const isDoff = ctx.paintType.toLowerCase() === 'doff' || ctx.paintType.toLowerCase() === 'matte';
                        // Doff bongkar total -> Cuci Komplit. Glossy bongkar total -> Full Detailing Glossy.
                        if (isDoff) {
                            ctx.serviceTypes[i] = "Cuci Komplit";
                        } else {
                            ctx.serviceTypes[i] = "Full Detailing Glossy";
                        }
                        continue; // Skip generic missing question
                    } else {
                        // Keep as detailing but missingQuestion will catch it below
                        ctx.serviceTypes[i] = "Full Detailing";
                    }
                } else if (ctx.detailingFocus) {
                    const focusLower = (Array.isArray(ctx.detailingFocus) ? ctx.detailingFocus.join(' ') : String(ctx.detailingFocus)).toLowerCase();
                    if (focusLower.includes('mesin')) {
                        ctx.serviceTypes[i] = "Detailing Mesin";
                        continue;
                    } else if (focusLower.includes('bodi')) {
                        // Bodi-only detailing maps to Poles Bodi Glossy or Coating Doff (no bongkar)
                        ctx.isBongkarTotal = false;
                        if (ctx.paintType && (ctx.paintType.toLowerCase() === 'doff' || ctx.paintType.toLowerCase() === 'matte')) {
                            ctx.serviceTypes[i] = "Coating Motor Doff";
                        } else {
                            ctx.serviceTypes[i] = "Poles Bodi Glossy";
                        }
                        continue;
                    } else {
                        ctx.serviceTypes[i] = `Detailing ${ctx.detailingFocus}`;
                        continue;
                    }
                } else if (ctx.isBongkarTotal === false) {
                    if (ctx.paintType && (ctx.paintType.toLowerCase() === 'doff' || ctx.paintType.toLowerCase() === 'matte')) {
                        ctx.serviceTypes[i] = "Coating Motor Doff";
                    } else {
                        ctx.serviceTypes[i] = "Poles Bodi Glossy";
                    }
                    continue;
                } else {
                    missingQuestion = "Tanya secara santai: 'detailingnya mau sampai rangka apa nggak kak? atau cuma bodi dan kaki-kaki aja?'";
                    break;
                }
            }
            if (svc === 'complete service') {
                if (ctx.paintType) {
                    const isDoff = ctx.paintType.toLowerCase() === 'doff' || ctx.paintType.toLowerCase() === 'matte';
                    ctx.serviceTypes[i] = isDoff ? "Complete Service Doff" : "Complete Service Glossy";
                    continue; // Skip generic missing question
                } else {
                    missingQuestion = "Tanya secara santai: 'motornya catnya glossy apa doff kak?'";
                    break;
                }
            }
            if (svc === 'coating') {
                if (ctx.paintType) {
                    ctx.serviceTypes[i] = `Coating Ceramic ${ctx.paintType}`;
                    continue; // Skip generic missing question since we auto-resolved it
                } else {
                    missingQuestion = "Tanya secara santai: 'motornya catnya glossy apa doff kak?'";
                    break;
                }
            }
        }

        // Service-specific questions
        if (!missingQuestion && classifiedIntent === 'BOOKING_SERVICE') {
            for (const svc of ctx.serviceTypes) {
                const svcLower = svc.toLowerCase();
                
                // Repaint Flow
                if (svcLower.includes('repaint')) {
                    if (svcLower.includes('halus') && !ctx.colorChoice) { missingQuestion = "Tanyakan rencana warna baru untuk bodi halusnya (Info: Beritahu santai kalau warna spesial seperti Candy/Stabilo ada tambahan biaya)"; break; }
                    if (svcLower.includes('velg') && !ctx.velgColorChoice) { missingQuestion = "Tanyakan pilihan warna untuk repaint velgnya (Info: Beritahu santai kalau warna Two-Tone/Polish ada tambahan biaya)"; break; }
                    if (svcLower.includes('velg') && ctx.isPreviouslyPainted === null) { missingQuestion = "Tanyakan apakah velg masih cat ori pabrik atau sudah pernah repaint (Info: Kasih tahu ada biaya remover 50-100rb kalau velg udah pernah dicat)"; break; }
                }
                
                // Detailing / Coating Flow
                else if (svcLower.includes('detailing') || svcLower.includes('poles') || svcLower.includes('cuci') || svcLower.includes('coating') || svcLower.includes('complete service')) {
                    
                    if (ctx.isBongkarTotal === null && !ctx.detailingFocus) {
                        missingQuestion = "Tanyakan detail pengerjaan: apakah mau sampai rangka (bongkar total), hanya bodi dan kaki-kaki saja, atau hanya mesin saja?";
                        break;
                    }

                    // Jika user pilih mesin saja, kita biarkan lolos dulu (Formatter nanti akan tawarin bodi juga).
                    const focusStrForMesin = String(ctx.detailingFocus || '').toLowerCase();
                    const isMesinSaja = !ctx.isBongkarTotal && focusStrForMesin.includes('mesin') && !focusStrForMesin.includes('bodi') && !focusStrForMesin.includes('rangka');
                    
                    const isRepainting = ctx.serviceTypes.some(s => s.toLowerCase().includes('repaint'));
                    if (!isMesinSaja && !ctx.paintType && !isRepainting) {
                         missingQuestion = "Tanyakan jenis cat motornya saat ini, apakah Glossy atau Doff? (Karena paket treatment-nya berbeda)";
                         break;
                    }
                }
            }
        }
    }

    // For CONSULTATION or GENERAL_INQUIRY, keep relaxed (no forced questions unless specifically needed)
    if (classifiedIntent === 'CONSULTATION' || (classifiedIntent === 'GENERAL_INQUIRY' && !needsMotorModel)) {
        ctx.missingQuestions = missingQuestion ? [missingQuestion] : [];
    } else {
        ctx.missingQuestions = missingQuestion ? [missingQuestion] : [];
    }

    // Determine readiness for tool execution
    const hasGenericService = ctx.serviceTypes.some(s => ['repaint', 'detailing', 'coating', 'poles', 'cuci'].includes(s.toLowerCase()));
    const isHumanHandoff = classifiedIntent === 'HUMAN_HANDOVER' || ctx.vehicleType === 'Mobil';

    // We want to force the user to answer missing questions before fetching tools,
    // EXCEPT if they are responding to a combo promo offer (in which case it's fine to show prices)
    const forceAskBeforeTools = !context.comboOffered && (ctx.missingQuestions.length > 0);

    // Ready if:
    // 1. Human handoff
    // 2. Booking flow has enough data (even if there are missing questions, we can fetch base prices!) -> EXCEPT on first turn!
    // 3. General inquiry (Location/Studio info)
    const isReady = !forceAskBeforeTools && (isHumanHandoff ||
        (classifiedIntent === 'GENERAL_INQUIRY' || studioKeywords) ||
        (classifiedIntent === 'BOOKING_SERVICE' && !!ctx.vehicleType && ctx.serviceTypes.length > 0 && !hasGenericService));

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
    console.log(`[INFO_COLLECTOR_NODE] Final Context State:`, JSON.stringify(ctx, null, 2));

    return {
        intent: classifiedIntent,
        context: ctx,
        metadata: newMetadata
    };
}

module.exports = { infoCollectorNode };