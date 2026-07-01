const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { SystemMessage, HumanMessage } = require('@langchain/core/messages');
const studioMetadata = require('../../constants/studioMetadata');
const { withRetry } = require('../../utils/retry');
const { sanitizeMessagesForGemini, extractTextFromContent } = require('../utils/sanitizeMessages');

const model = new ChatGoogleGenerativeAI({
    model: 'gemini-flash-lite-latest',
    maxOutputTokens: 2048,
    temperature: 0,
    responseMimeType: "application/json",
});

async function infoCollectorNode(state) {
    console.log('--- [INFO_COLLECTOR_NODE] Starting (Merged Classifier + Extractor) ---');
    const startTime = Date.now();
    const { context, metadata } = state;
    const sanitizedMessages = sanitizeMessagesForGemini(state.messages);
    const prevIntent = state.intent || metadata?.prevIntent;
    const lastMessage = sanitizedMessages[sanitizedMessages.length - 1];
    const lastMessageText = extractTextFromContent(lastMessage.content);

    const cleanJson = (str) => str.replace(/```json\n?|```/g, '').trim();
    const ctx = { ...context };

    if (ctx.serviceType && (!ctx.serviceTypes || ctx.serviceTypes.length === 0)) {
        ctx.serviceTypes = [ctx.serviceType];
        delete ctx.serviceType;
    }
    if (!Array.isArray(ctx.serviceTypes)) ctx.serviceTypes = [];

    if (prevIntent && prevIntent !== state.intent) {
        ctx.missingQuestions = [];
        ctx.isReadyForTools = false;
    }

    const chatTranscript = sanitizedMessages.slice(-10).map(m => {
        const role = (m.type === 'human' || m.role === 'user') ? '[USER]' : '[AI]';
        return `${role}: ${extractTextFromContent(m.content)}`;
    }).join('\n');

    const systemPrompt = `# ROLE
Kamu adalah AI Classifier & Data Extractor untuk ${studioMetadata.name}. 
Ekstrak intent dan entities secara akurat dari riwayat percakapan dan gambar.

# INTENT CATEGORIES
- GREETING, CONSULTATION, BOOKING_SERVICE, GENERAL_INQUIRY, HUMAN_HANDOVER, OTHER

# OUTPUT FORMAT RULES
Wajib menghasilkan skema JSON murni dengan properti: intent, internal_thought, motor_model, service_types, paint_type, is_bongkar_total, detailing_focus, color_choice, velg_color_choice, is_previously_painted, booking_date, booking_time, visual_summary.`;

    let classifiedIntent = 'GENERAL_INQUIRY';
    let extracted = {};

    try {
        const visionContent = [{ type: 'text', text: `KONTEKS PERCAKAPAN:\n\n${chatTranscript}\n\nPESAN TERAKHIR USER:\n` }];
        if (Array.isArray(lastMessage.content)) {
            const filteredContent = lastMessage.content.filter(c => c.type !== 'thinking');
            visionContent.push(...filteredContent);
        } else {
            visionContent.push({ type: 'text', text: lastMessage.content || '[Tanpa Teks]' });
        }

        const response = await withRetry(() => model.invoke([
            new SystemMessage(systemPrompt),
            new HumanMessage({ content: visionContent })
        ]), { maxRetries: 3, baseDelayMs: 1500 });

        extracted = JSON.parse(cleanJson(extractTextFromContent(response.content)));
        classifiedIntent = (extracted.intent || 'GENERAL_INQUIRY').trim().toUpperCase();

        // Intent Recovery Logic untuk menjaga kontinuitas diskusi harga
        const isShortReply = lastMessageText.split(' ').length <= 15;
        const containsBookingKeywords = /warna|cat|nmax|scoopy|pcx|vespa|vario|repaint|detailing/i.test(lastMessageText);
        if (
            (prevIntent === 'BOOKING_SERVICE' || metadata?.flow === 'pricing') && 
            (isShortReply || containsBookingKeywords)
        ) {
            if (classifiedIntent !== 'GENERAL_INQUIRY' || !/lokasi|alamat|dimana/i.test(lastMessageText)) {
                classifiedIntent = 'BOOKING_SERVICE';
            }
        }

        // Deteksi Komplain & Layanan Out-of-Scope -> Overriding ke Handover
        if (/mahal|kecewa|jelek|komplain|nipu/i.test(lastMessageText) || /\b(ppf|wrapping|airbrush|decal)\b/i.test(lastMessageText)) {
            classifiedIntent = 'HUMAN_HANDOVER';
        }

        if (classifiedIntent !== 'BOOKING_SERVICE' && classifiedIntent !== 'GENERAL_INQUIRY' && classifiedIntent !== 'CONSULTATION') {
            return {
                intent: classifiedIntent,
                context: { ...context, missingQuestions: [] },
                metadata: { ...metadata, prevIntent: classifiedIntent, replyMode: classifiedIntent === 'GREETING' ? 'greet' : 'inform' }
            };
        }

        // PERBAIKAN CONTEXT BLEED: Reset data jika tipe kendaraan berubah total
        if (extracted.motor_model) {
            const currentVehicle = ctx.vehicleType || '';
            if (currentVehicle && extracted.motor_model.toLowerCase() !== currentVehicle.toLowerCase()) {
                ctx.serviceTypes = [];
                ctx.paintType = null;
                ctx.detailingFocus = null;
                ctx.colorChoice = null;
                ctx.velgColorChoice = null;
                ctx.isBongkarTotal = null;
                ctx.isPreviouslyPainted = null;
            }
            ctx.vehicleType = extracted.motor_model;
        }

        // Tarik Layanan Baru
        const extractedServices = Array.isArray(extracted.service_types) ? extracted.service_types : (extracted.service_type ? [extracted.service_type] : []);
        for (const svc of extractedServices) {
            if (svc && !ctx.serviceTypes.some(s => s.toLowerCase() === svc.toLowerCase())) {
                ctx.serviceTypes.push(svc);
            }
        }

        if (extracted.paint_type) ctx.paintType = extracted.paint_type;
        if (extracted.is_bongkar_total !== null) ctx.isBongkarTotal = extracted.is_bongkar_total;
        if (extracted.detailing_focus) ctx.detailingFocus = extracted.detailing_focus;
        if (extracted.color_choice) ctx.colorChoice = extracted.color_choice;
        if (extracted.velg_color_choice) ctx.velgColorChoice = extracted.velg_color_choice;
        if (extracted.is_previously_painted !== null) ctx.isPreviouslyPainted = extracted.is_previously_painted;

        // Auto-resolve kata kunci generik "Repaint" menjadi spesifik berdasarkan fokus bodi/velg
        const genericRepaintIdx = ctx.serviceTypes.findIndex(s => s.toLowerCase() === 'repaint');
        if (genericRepaintIdx !== -1 && ctx.detailingFocus) {
            
            // 🌟 PERBAIKAN 1: Konversi aman ke lowercase, tidak peduli LLM kasih Array atau String
            const focusStr = Array.isArray(ctx.detailingFocus) 
                ? ctx.detailingFocus.join(' ').toLowerCase() 
                : String(ctx.detailingFocus).toLowerCase();

            const resolved = [];
            
            // 🌟 PERBAIKAN 2: Tambahkan regex "boli" untuk toleransi typo user
            if (/halus|bodi|body|boli/.test(focusStr)) resolved.push('Repaint Bodi Halus');
            if (/kasar/.test(focusStr)) resolved.push('Repaint Bodi Kasar');
            if (/velg|pelek/.test(focusStr)) resolved.push('Repaint Velg');
            if (/cvt/.test(focusStr)) resolved.push('Repaint CVT');

            if (resolved.length > 0) {
                ctx.serviceTypes.splice(genericRepaintIdx, 1, ...resolved);
                ctx.serviceTypes = [...new Set(ctx.serviceTypes)];
                console.log(`[INFO_COLLECTOR_NODE] Auto-resolved "Repaint" to [${resolved.join(', ')}]`);
            }
        }

    } catch (error) {
        console.error('[INFO_COLLECTOR_NODE] Error:', error.message);
        return { intent: 'GENERAL_INQUIRY', context: context, metadata: { ...metadata, replyMode: 'inform' } };
    }

    // Pohon Keputusan Pertanyaan yang Kurang (Missing Questions)
    let missingQuestion = null;
    const needsMotorModel = (classifiedIntent === 'BOOKING_SERVICE' || classifiedIntent === 'CONSULTATION');

    if (needsMotorModel && !ctx.vehicleType) {
        missingQuestion = "Tanyakan tipe motor user (contoh: Nmax, Scoopy, Vario)";
    } else if (needsMotorModel && ctx.serviceTypes.length === 0) {
        missingQuestion = "Tanyakan rencana layanan yang diinginkan (Repaint, Coating, atau Detailing)";
    } else {
        const hasGenericRepaint = ctx.serviceTypes.some(s => s.toLowerCase() === 'repaint');
        const hasGenericDetailing = ctx.serviceTypes.some(s => s.toLowerCase() === 'detailing');
        const hasGenericCoating = ctx.serviceTypes.some(s => s.toLowerCase() === 'coating');

        if (hasGenericRepaint) {
            missingQuestion = "Tanyakan detail bagian yang mau di-repaint (Bodi Halus, Kasar, Velg, atau CVT)";
        } else if (hasGenericDetailing) {
            missingQuestion = "Tanyakan paket detailing apa yang diinginkan (contoh: Detailing Bodi, Mesin, atau Full)";
        } else if (hasGenericCoating) {
            missingQuestion = "Tanyakan bagian apa yang ingin di-coating";
        } else if (classifiedIntent === 'BOOKING_SERVICE') {
            for (const svc of ctx.serviceTypes) {
                const sLower = svc.toLowerCase();
                if (sLower.includes('halus') && !ctx.colorChoice) {
                    missingQuestion = "Tanyakan rencana warna baru untuk bodi halusnya";
                    break;
                }
                // Skenario Utama Gagal Cari Harga Velg: Kita butuh warna velg-nya dulu agar pencarian database akurat
                if (sLower.includes('velg') && !ctx.velgColorChoice) {
                    missingQuestion = "Tanyakan pilihan warna untuk repaint velgnya";
                    break;
                }
                if (sLower.includes('velg') && ctx.isPreviouslyPainted === null) {
                    missingQuestion = "Tanyakan apakah velg masih cat ori pabrik atau sudah pernah repaint";
                    break;
                }
            }
        }
    }

    ctx.missingQuestions = missingQuestion ? [missingQuestion] : [];
    
    // Prevent tool execution if there are generic services
    const hasGenericService = ctx.serviceTypes.some(s => ['repaint', 'detailing', 'coating'].includes(s.toLowerCase()));
    
    // Izinkan eksekusi tool jika intent berupa BOOKING_SERVICE atau CONSULTATION selama data valid
    const isBookingOrConsult = classifiedIntent === 'BOOKING_SERVICE' || classifiedIntent === 'CONSULTATION';
    
    ctx.isReadyForTools = Boolean(
        classifiedIntent === 'GENERAL_INQUIRY' || 
        (isBookingOrConsult && !!ctx.vehicleType && ctx.serviceTypes.length > 0 && !hasGenericService && ctx.missingQuestions.length === 0)
    );

    let replyMode = 'inform';
    if (classifiedIntent === 'GREETING') {
        replyMode = 'greet';
    } else if (ctx.missingQuestions.length > 0) {
        replyMode = 'ask';
    } else if (classifiedIntent === 'CONSULTATION') {
        replyMode = 'consult';
    }

    // Track conversation flow (pricing vs general) to preserve context
    const userAskedPrice = /harga|biaya|tarif|berapa|price|cost|estimasi|ongkos|bayar/i.test(lastMessageText);
    let currentFlow = metadata?.flow || 'general';
    if (
        userAskedPrice || 
        classifiedIntent === 'BOOKING_SERVICE' ||
        metadata?.flow === 'pricing'
    ) {
        currentFlow = 'pricing';
    } else if (classifiedIntent === 'GREETING') {
        currentFlow = 'general';
    }

    return {
        intent: classifiedIntent,
        context: ctx,
        metadata: { 
            ...metadata, 
            prevIntent: classifiedIntent, 
            replyMode, 
            flow: currentFlow,
            visualSummary: extracted.visual_summary || null 
        }
    };
}

module.exports = { infoCollectorNode };
