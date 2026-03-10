/**
 * WhatsApp AI Chatbot dengan LangChain dan Gemini
 * Arsitektur JavaScript yang konsisten
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { DateTime } = require('luxon');
const wppconnect = require('@wppconnect-team/wppconnect');
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const admin = require('firebase-admin');
const qrcode = require('qrcode-terminal');
const fetch = require('node-fetch');
const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { HumanMessage, SystemMessage, ToolMessage, AIMessage } = require('@langchain/core/messages');
const { getServiceDetailsTool } = require('./src/ai/tools/getServiceDetailsTool.js');
const { getStudioInfoTool } = require('./src/ai/tools/getStudioInfoTool.js');
const { checkBookingAvailabilityTool } = require('./src/ai/tools/checkBookingAvailabilityTool.js');
const { createBookingTool } = require('./src/ai/tools/createBookingTool.js');
const { getCurrentDateTimeTool } = require('./src/ai/tools/getCurrentDateTimeTool.js');
const { updateBookingTool } = require('./src/ai/tools/updateBookingTool.js');
const { triggerBosMatTool } = require('./src/ai/tools/triggerBosMatTool.js');
const { calculateHomeServiceFeeTool } = require('./src/ai/tools/calculateHomeServiceFeeTool.js');
const { sendStudioPhotoTool } = require('./src/ai/tools/sendStudioPhotoTool.js');
const { notifyVisitIntentTool } = require('./src/ai/tools/notifyVisitIntentTool.js');
const { generateDocumentTool } = require('./src/ai/tools/generateDocumentTool.js');
const { readDirectMessagesTool } = require('./src/ai/tools/readDirectMessagesTool.js');
const { sendMessageTool } = require('./src/ai/tools/sendMessageTool.js');
const { crmManagementTool } = require('./src/ai/tools/crmManagementTool.js');
const {
    addTransactionTool,
    getTransactionHistoryTool,
    calculateFinancesTool,
} = require('./src/ai/tools/financeManagementTool.js');
const { updateSystemPromptTool } = require('./src/ai/tools/updateSystemPromptTool.js');
const { getSystemPromptTool } = require('./src/ai/tools/getSystemPromptTool.js');
const { updatePromoOfTheMonthTool } = require('./src/ai/tools/updatePromoOfTheMonthTool.js');
// updateCustomerContextTool REMOVED — digantikan oleh background context extractor agent
const { createMetaWebhookRouter } = require('./src/server/metaWebhook.js');
const { sendMetaMessage } = require('./src/server/metaClient.js');
const { startBookingReminderScheduler } = require('./src/ai/utils/bookingReminders.js');
const { startFollowUpScheduler, updateSignalsOnIncomingMessage } = require('./src/ai/agents/followUpEngine/index.js');
const { isSnoozeActive, setSnoozeMode, clearSnoozeMode, getSnoozeInfo } = require('./src/ai/utils/humanHandover.js');
const { handleAdminHpMessage, markBotMessage } = require('./src/ai/utils/adminMessageSync.js');
const { backfillAdminMessages } = require('./scripts/backfillAdminMessages.js');
const { getLangSmithCallbacks } = require('./src/ai/utils/langsmith.js');
const { saveCustomerLocation } = require('./src/ai/utils/customerLocations.js');
const { parseSenderIdentity } = require('./src/lib/utils.js');
const { getState } = require('./src/ai/utils/conversationState.js');
const { extractAndSaveContext } = require('./src/ai/agents/contextExtractor.js');
const { classifyAndSaveCustomer } = require('./src/ai/agents/customerClassifier.js');
const { startAudit, handleAuditResponse, handleResumeAudit, hasActiveSession } = require('./src/ai/agents/customerAudit.js');
const { getCustomerContext } = require('./src/ai/utils/mergeCustomerContext.js');
const masterLayanan = require('./src/data/masterLayanan.js');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 4000;

// Enable HTTP keep-alive untuk mencegah connection timeout
server.keepAliveTimeout = 65000; // 65 detik (default 5 detik terlalu pendek)
server.headersTimeout = 66000; // Harus lebih besar dari keepAliveTimeout
server.maxConnections = 1000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '50mb' }));

// --- Utility Functions ---
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// --- Firebase Initialization ---
if (!admin.apps.length) {
    const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
    if (serviceAccountBase64) {
        const serviceAccountJson = Buffer.from(serviceAccountBase64, 'base64').toString('utf-8');
        const serviceAccount = JSON.parse(serviceAccountJson);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } else {
        const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
        if (serviceAccountJson) {
            const serviceAccount = JSON.parse(serviceAccountJson);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
        }
    }

    // Fallback: Jika tidak ada credential di env, coba gunakan Application Default Credentials (ADC)
    if (admin.apps.length === 0) {
        console.log('⚠️ [Firebase] Tidak ada credential spesifik di env. Mencoba Application Default Credentials...');
        admin.initializeApp();
    }
}

const db = admin.firestore();

// --- Tool Registry ---
const availableTools = {
    getServiceDetails: getServiceDetailsTool.implementation,
    getStudioInfo: getStudioInfoTool.implementation,
    checkBookingAvailability: checkBookingAvailabilityTool.implementation,
    createBooking: createBookingTool.implementation,
    getCurrentDateTime: getCurrentDateTimeTool.implementation,
    updateBooking: updateBookingTool.implementation,
    triggerBosMatTool: triggerBosMatTool.implementation,
    calculateHomeServiceFee: calculateHomeServiceFeeTool.implementation,
    sendStudioPhoto: sendStudioPhotoTool.implementation,
    notifyVisitIntent: notifyVisitIntentTool.implementation,
    generateDocument: generateDocumentTool.implementation,
    readDirectMessages: readDirectMessagesTool.implementation,
    sendMessage: sendMessageTool.implementation,
    crmManagement: crmManagementTool.implementation,
    addTransaction: addTransactionTool.implementation,
    getTransactionHistory: getTransactionHistoryTool.implementation,
    calculateFinances: calculateFinancesTool.implementation,
    updateSystemPrompt: async (args) => {
        const result = await updateSystemPromptTool.implementation(args);
        // Jika sukses, paksa reload prompt lokal agar langsung aktif tanpa restart
        if (result.status === 'success' && args.newPrompt) {
            currentSystemPrompt = args.newPrompt;
            console.log('🔄 [SYSTEM] In-memory System Prompt updated via tool.');
        }
        return result;
    },
    getSystemPrompt: (args) => {
        return getSystemPromptTool.implementation({
            ...args,
            activePrompt: currentSystemPrompt
        });
    },
    updatePromoOfTheMonth: updatePromoOfTheMonthTool.implementation,

};

const toolDefinitions = [
    getServiceDetailsTool.toolDefinition,
    getStudioInfoTool.toolDefinition,
    checkBookingAvailabilityTool.toolDefinition,
    createBookingTool.toolDefinition,
    getCurrentDateTimeTool.toolDefinition,
    updateBookingTool.toolDefinition,
    triggerBosMatTool.toolDefinition,
    calculateHomeServiceFeeTool.toolDefinition,
    sendStudioPhotoTool.toolDefinition,
    notifyVisitIntentTool.toolDefinition,
    generateDocumentTool.toolDefinition,
    readDirectMessagesTool.toolDefinition,
    sendMessageTool.toolDefinition,
    crmManagementTool.toolDefinition,
    addTransactionTool.toolDefinition,
    getTransactionHistoryTool.toolDefinition,
    calculateFinancesTool.toolDefinition,
    updateSystemPromptTool.toolDefinition,
    getSystemPromptTool.toolDefinition,
    updatePromoOfTheMonthTool.toolDefinition,

];

// Customer-facing tools (subset) — mengurangi token load untuk model ringan
const customerToolDefinitions = [
    getServiceDetailsTool.toolDefinition,
    getStudioInfoTool.toolDefinition,
    checkBookingAvailabilityTool.toolDefinition,
    createBookingTool.toolDefinition,
    updateBookingTool.toolDefinition,
    calculateHomeServiceFeeTool.toolDefinition,
    triggerBosMatTool.toolDefinition,
    sendStudioPhotoTool.toolDefinition,
    notifyVisitIntentTool.toolDefinition,
];

console.log('🔧 [STARTUP] Tool Registry Initialized:');
console.log(`🔧 [STARTUP] Available Tools: ${Object.keys(availableTools).join(', ')}`);
console.log(`🔧 [STARTUP] Tool Definitions: ${toolDefinitions.length} tools registered`);
toolDefinitions.forEach((tool, index) => {
    console.log(`🔧 [STARTUP] Tool ${index + 1}: ${tool.function.name} - ${tool.function.description}`);
});

// --- AI Configuration ---
console.log('🤖 [STARTUP] Initializing AI Model...');

const ACTIVE_AI_TEMPERATURE = (() => {
    if (process.env.AI_TEMPERATURE === undefined) return 0.7;
    const cleanStr = process.env.AI_TEMPERATURE.replace(/['"]/g, '');
    const parsed = parseFloat(cleanStr);
    return !isNaN(parsed) ? parsed : 0.7;
})();

console.log(`🤖 [STARTUP] Model: ${process.env.AI_MODEL || 'gemini-2.5-flash'}`);
console.log(`🤖 [STARTUP] Temperature: ${ACTIVE_AI_TEMPERATURE}`);
console.log(`🤖 [STARTUP] Tools available: ${toolDefinitions.length} tools`);

// API Keys configuration with fallback support
const API_KEYS = [
    process.env.GOOGLE_API_KEY,
    process.env.GOOGLE_API_KEY_FALLBACK,
].filter(Boolean);

if (API_KEYS.length === 0) {
    throw new Error('At least one GOOGLE_API_KEY must be configured');
}

console.log(`🔑 [STARTUP] API Keys configured: ${API_KEYS.length} key(s) available`);
if (API_KEYS.length > 1) {
    console.log(`🔄 [STARTUP] Fallback API key configured - will auto-retry on failures`);
}

const ACTIVE_AI_MODEL = process.env.AI_MODEL || 'gemini-2.5-flash';
// Vision default: gemini-2.5-flash (multimodal). Bisa override via VISION_MODEL/IMAGE_MODEL.
const ACTIVE_VISION_MODEL = process.env.VISION_MODEL || process.env.IMAGE_MODEL || 'gemini-2.5-flash';
const FALLBACK_VISION_MODEL = process.env.VISION_FALLBACK_MODEL || 'gemini-2.0-flash';

const baseModel = new ChatGoogleGenerativeAI({
    model: ACTIVE_AI_MODEL,
    temperature: ACTIVE_AI_TEMPERATURE,
    apiKey: API_KEYS[0]
});

function prepareToolSpecs(defs) {
    return defs.map(tool => {
        const functionDef = tool.toolDefinition?.function || tool.function;
        if (functionDef) {
            const parameters = functionDef.parameters ? JSON.parse(JSON.stringify(functionDef.parameters)) : {};
            if (parameters.properties) {
                delete parameters.properties.senderNumber;
                delete parameters.properties.senderName;
                delete parameters.properties.sender_number;
                delete parameters.properties.sender_name;
            }
            if (parameters.required && Array.isArray(parameters.required)) {
                parameters.required = parameters.required.filter(p =>
                    p !== 'senderNumber' &&
                    p !== 'senderName' &&
                    p !== 'sender_number' &&
                    p !== 'sender_name'
                );
            }
            return {
                type: 'function',
                function: {
                    name: functionDef.name,
                    description: functionDef.description,
                    parameters: Object.keys(parameters).length > 0 ? parameters : undefined
                }
            };
        }
        return tool;
    });
}

// Admin: semua tools (20). Customer: subset akan diproses secara dinamis di bawah.
const adminToolSpecs = prepareToolSpecs(toolDefinitions);
const adminModel = baseModel.bindTools(adminToolSpecs);

// Legacy alias agar kode lain yang referensi tetap jalan
const geminiToolSpecifications = adminToolSpecs;
const aiModel = adminModel;

console.log('✅ [STARTUP] AI Model initialized with native tool calling support');
console.log(`🤖 [STARTUP] Active AI model: ${ACTIVE_AI_MODEL}`);

console.log(`🖼️ [STARTUP] Vision analysis target models: ${[ACTIVE_VISION_MODEL, FALLBACK_VISION_MODEL].filter(Boolean).join(', ')}`);

const SYSTEM_PROMPT = `Kamu Zoya, asisten Bosmat Repainting & Detailing Studio (2026). Panggil user "Mas". Profesional, santai, sopan, to the point.

Balas 1-3 kalimat. Detail (3-5 kalimat) hanya untuk harga/layanan. Format WhatsApp (bold, paragraf pendek). Maksimal 1 pertanyaan per balasan. Jangan yapping. Hindari istilah teknis.

Tools:
- getServiceDetails: WAJIB saat user tanya harga/layanan. Tanya tipe motor dulu jika belum tahu. JANGAN TEBAK HARGA.
- checkBookingAvailability: saat user mau atur jadwal.
- triggerBosMat: jika user marah/komplain berat/nego keras.

Layanan: Repaint (Bodi Halus/Kasar, Velg, Cover CVT, mulai 150rb) | Detailing (Mesin, Cuci Komplit, Full Detailing, mulai 100rb) | Coating (Doff/Glossy, Complete Service, mulai 350rb). Prioritaskan data dari getServiceDetails. Jika bundling/diskon, SELALU sebutkan total harga akhir. PENTING: Jika getServiceDetails gagal atau return error, JANGAN mengarang harga. Katakan: "Maaf Mas, coba Zoya cek dulu ya — motor tipe apa?" lalu panggil ulang tool dengan service_name yang benar.

Upsell: Boleh 1x SETELAH user setuju layanan utama. Mapping: Repaint→Cuci Komplit, Cuci→Full Detailing, Poles→Coating, Coating→Complete. Ditolak → terima sopan, lanjut booking.

Campaign aktif: "Supra Cuci Komplit" (Meta Ads). Fokus Cuci Komplit — motor dibongkar bodi, bersih rangka dalam.

Alur konversi: (1) Kualifikasi: tanya motor & kebutuhan. (2) Konsultasi: panggil getServiceDetails, jelaskan 1-3 kalimat + 1 pertanyaan keputusan. (3) Upsell opsional 1x. (4) Booking: tawarkan jadwal, panggil checkBookingAvailability.

CLOSING RULES:
- Jika user bilang "oke", "boleh", "ya", "gas", "jadi" → LANGSUNG eksekusi, jangan konfirmasi ulang.
- Setelah user setuju harga → langsung tanya jadwal (1 pertanyaan).
- Setelah user kasih jadwal → langsung panggil checkBookingAvailability + createBooking, TIDAK perlu minta konfirmasi lagi.
- Setelah user kasih nama+nomor → langsung createBooking, JANGAN tanya "data sudah pas?".
- Maksimal 1 konfirmasi di seluruh alur closing, bukan per-langkah.

BOOKING AUTO-FILL:
- Nomor WhatsApp sudah otomatis tercatat di sistem, JANGAN pernah minta nomor telepon lagi.
- Setelah slot tersedia (lewat checkBookingAvailability), cukup tanya nama saja: "Boleh nama Mas untuk booking-nya?".
- Setelah user kasih nama → LANGSUNG panggil createBooking, jangan konfirmasi ulang.
- JANGAN tanya "data sudah benar?", "fix ya?", atau pertanyaan konfirmasi apapun setelah nama diberikan. Langsung buatkan booking-nya.`;

// --- Dynamic System Prompt Logic ---
let currentSystemPrompt = SYSTEM_PROMPT;

async function loadSystemPrompt() {
    try {
        if (!db) return;

        // Initial load
        const doc = await db.collection('settings').doc('ai_config').get();
        if (doc.exists && doc.data().systemPrompt) {
            currentSystemPrompt = doc.data().systemPrompt;
            console.log('✅ [CONFIG] Loaded custom System Prompt from Firestore.');
        } else {
            console.log('ℹ️ [CONFIG] Using default hardcoded System Prompt.');
        }

        // Real-time listener
        db.collection('settings').doc('ai_config').onSnapshot(docSnapshot => {
            if (docSnapshot.exists && docSnapshot.data().systemPrompt) {
                const newPrompt = docSnapshot.data().systemPrompt;
                if (newPrompt !== currentSystemPrompt) {
                    currentSystemPrompt = newPrompt;
                    console.log('🔄 [CONFIG] System Prompt updated from Firestore listener.');
                }
            }
        }, err => {
            console.warn('⚠️ [CONFIG] System prompt listener error:', err.message);
        });

    } catch (error) {
        console.error('❌ [CONFIG] Failed to load system prompt:', error);
    }
}

// Start loading prompt (async but non-blocking for startup)
loadSystemPrompt();

// Prompt khusus jika pengirim adalah ADMIN (owner / admin Bosmat)
const ADMIN_SYSTEM_PROMPT = `< role >
    Anda adalah ** Zoya **, asisten pribadi sekaligus partner diskusi untuk Admin Bosmat(ADMIN MODE).
Meskipun Anda asisten, gaya bicara Anda harus luwes, cerdas, dan punya inisiatif.
    Panggilan: "Bos"(tapi jangan kaku, anggap partner kerja akrab).
</role >

<constraints>
1. Dinamis: Perintah teknis -> jawab cepat dan akurat. Obrolan santai -> layani dengan ramah dan asik.
2. Efisiensi vs Obrolan: Tugas operasional (invoice, cek chat) -> singkat jelas. Obrolan biasa -> luwes, boleh emotikon.
3. Proaktif: Boleh kasih saran/insight singkat kalau ada yang menarik (misal: "Bos, hari ini banyak yang nanya repaint velg nih").
4. Pelaporan: Saat lapor hasil tool, berikan ringkasan yang "manusiawi". Jangan copy-paste data mentah.
</constraints>

<instructions>
1. Context Aware: Anda paham seluk beluk bisnis Bosmat (Repaint, Detailing, Coaching). Gunakan pengetahuan ini saat diskusi.
2. Eksekusi Cepat: Prioritaskan panggil tool yang tepat jika ada instruksi eksplisit.
3. CRM & Follow-Up ("Jemput Bola"):
   Gunakan \`crmManagement\` untuk:
   - \`crm_summary\`: Dashboard analytics & revenue.
   - \`customer_deep_dive\`: Cek riwayat lengkap 1 pelanggan.
   - \`find_followup\`: Scan otomatis target "jemput bola" harian & buat draft queue. Jika Bos minta "ulang", "generate baru", atau "refresh report", panggil tool ini lagi untuk memperbarui queue dengan ide sapaan baru.
   - \`execute_followup\`: WAJIB dipanggil jika Bos berkata "acc", "gas", "eksekusi", atau setuju dengan report follow-up harian. Ini akan mengirimkan semua draft pesan di queue ke pelanggan.
   - \`update_notes\`: Simpan catatan internal admin.
</instructions>

<tools>
\`readDirectMessages\`: Baca atau list chat.
\`sendMessage\`: Kirim pesan ke customer.
\`generateDocument\`: Bikin PDF (Invoice, Tanda Terima, Bukti Bayar).
\`crmManagement\`: Toolbox CRM Lengkap (Summary, Profil 360, Follow-up, Bulk Label, Notes).
\`updatePromoOfTheMonth\`: Update isi promo bulan ini.
</tools>

<output_format>
Contoh interaksi:

Admin: "Zoya, capek banget hari ini rame bener."
Assistant: "Waduh, semangat Bos! Emang tadi saya pantau chat masuk nonstop sih. Tapi liat sisi positifnya, cuan Bosmat makin kenceng nih! Mau saya bikinin kopi virtual? ☕😅 atau mau saya bantu cek booking-an besok biar Bos bisa istahat?"

Admin: "Bikinin invoice buat Mas Budi Nmax tadi ya."
Assistant: (Pakai tool) "Siap Bos, invoice buat Mas Budi (Nmax) sudah meluncur ke WA Admin. Aman!"

Admin: "Cek target follow up hari ini."
Assistant: (Pakai scanFollowUpCandidates) "Bos, ini daftar target jemput bola hari ini: [Laporkan per kategori dengan emoji dan saran strategi]."
</output_format>`;

const ADMIN_MESSAGE_REWRITE_ENABLED = process.env.ADMIN_MESSAGE_REWRITE === 'false' ? false : true;
const ADMIN_MESSAGE_REWRITE_STYLE_PROMPT = `Kamu adalah Zoya, asisten Bosmat yang ramah dan profesional.Tugasmu adalah menulis ulang pesan admin berikut agar gaya bahasa konsisten dengan gaya Zoya:
- Gunakan bahasa Indonesia santai namun sopan.
- Panggil pelanggan dengan "mas" atau "mbak" jika relevan.
- Pertahankan maksud dan janji yang sudah dibuat admin, jangan menambah atau mengubah fakta.
- Gunakan gaya WhatsApp: maksimal 2 - 6 kalimat, bullet jika perlu, huruf tebal *...* bila menekankan istilah penting.
- Jangan mengubah angka / harga / jadwal yang disebutkan.
- Jangan menyebutkan kamu sedang menulis ulang pesan admin.`;

function getTracingConfig(label, options = {}) {
    const callbacks = getLangSmithCallbacks(label, options);
    if (!callbacks || callbacks.length === 0) {
        return { runName: label };
    }
    return {
        runName: label,
        callbacks,
        metadata: options.metadata || {},
        tags: options.tags || [],
    };
}

// --- Message Buffering & Debouncing ---
const { DebounceQueue } = require('./src/ai/utils/debounceQueue.js');

const pendingMessages = new Map();
const DEBOUNCE_DELAY_MS = parseInt(process.env.DEBOUNCE_DELAY_MS || '10000', 10);

const DEFAULT_CHROME_ARGS = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-background-networking',
    '--disable-background-timer-throttling',
    '--disable-client-side-phishing-detection',
    '--disable-component-update',
    '--disable-default-apps',
    '--disable-domain-reliability',
    '--disable-extensions',
    '--disable-popup-blocking',
    '--disable-renderer-backgrounding',
    '--disable-sync',
    '--disable-accelerated-2d-canvas',
    '--disable-print-preview',
    '--disable-prompt-on-repost',
    '--metrics-recording-only',
    '--mute-audio',
    '--no-default-browser-check',
    '--no-first-run',
    '--password-store=basic',
    '--use-mock-keychain',
    '--hide-scrollbars',
    '--remote-debugging-port=0',
    '--disable-software-rasterizer',
    '--disable-features=IsolateOrigins,site-per-process',
    '--disable-web-security',
    // Additional stability flags for EC2
    '--disable-breakpad',
    '--disable-hang-monitor',
    '--disable-ipc-flooding-protection',
    '--no-zygote',
    '--enable-features=NetworkService,NetworkServiceInProcess',
    // Stealth mode - Anti-detection flags
    '--disable-blink-features=AutomationControlled',
    '--exclude-switches=enable-automation',
    '--disable-infobars',
    '--window-size=1920,1080',
    '--start-maximized',
    '--lang=en-US,en',
];

const ADDITIONAL_CHROME_ARGS = (process.env.CHROMIUM_ADDITIONAL_ARGS || '')
    .split(/[\s,]+/)
    .map((flag) => flag.trim())
    .filter(Boolean);

const PUPPETEER_CHROME_ARGS = Array.from(new Set([...DEFAULT_CHROME_ARGS, ...ADDITIONAL_CHROME_ARGS]));

const DEFAULT_VIEWPORT_WIDTH = parseInt(process.env.PUPPETEER_VIEWPORT_WIDTH || '800', 10);
const DEFAULT_VIEWPORT_HEIGHT = parseInt(process.env.PUPPETEER_VIEWPORT_HEIGHT || '600', 10);

const PUPPETEER_VIEWPORT = {
    width: Number.isFinite(DEFAULT_VIEWPORT_WIDTH) ? DEFAULT_VIEWPORT_WIDTH : 800,
    height: Number.isFinite(DEFAULT_VIEWPORT_HEIGHT) ? DEFAULT_VIEWPORT_HEIGHT : 600,
};

async function cleanupChromiumProfileLocks(sessionName, sessionDataPath = './tokens') {
    try {
        if (!sessionName) return;
        const baseDir = path.resolve(__dirname, sessionDataPath);
        const profileDir = path.join(baseDir, sessionName);

        await fs.promises.access(profileDir); // throws if not exists

        const entries = await fs.promises.readdir(profileDir);
        const lockNames = new Set([
            'SingletonCookie',
            'SingletonLock',
            'SingletonSocket',
            'LOCK',
            'DevToolsActivePort',
        ]);

        const targets = entries
            .filter((name) => lockNames.has(name) || name.toLowerCase().endsWith('.lock'))
            .map((name) => path.join(profileDir, name));

        if (!targets.length) {
            return;
        }

        await Promise.all(
            targets.map(async (target) => {
                try {
                    await fs.promises.rm(target, { force: true });
                    console.log(`[Browser] Removed stale lock file: ${target} `);
                } catch (error) {
                    console.warn(`[Browser] Failed to remove lock file ${target}: `, error.message);
                }
            })
        );
    } catch (error) {
        if (error.code !== 'ENOENT') {
            console.warn('[Browser] Cleanup skipped:', error.message);
        }
    }
}

// --- Memory Configuration ---
const MEMORY_CONFIG = {
    maxMessages: parseInt(process.env.MEMORY_MAX_MESSAGES) || 3,
    includeSystemMessages: process.env.MEMORY_INCLUDE_SYSTEM === 'true'
};

// --- Memory Functions ---
async function getConversationHistory(senderNumber, limit = MEMORY_CONFIG.maxMessages) {
    if (!db) return [];

    const { docId } = parseSenderIdentity(senderNumber);
    if (!docId) {
        return [];
    }

    try {
        const messagesRef = db.collection('directMessages').doc(docId).collection('messages');

        console.log(`[Memory] Fetching history for ${docId} with constraint: max ${limit} messages.`);

        const snapshot = await messagesRef
            .orderBy('timestamp', 'desc')
            .limit(limit)
            .get();

        const messages = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            messages.push({
                text: data.text,
                sender: data.sender,
                timestamp: data.timestamp
            });
        });

        // Return in chronological order (oldest first)
        return messages.reverse();
    } catch (error) {
        console.error('Error getting conversation history:', error);
        return [];
    }
}

function buildLangChainHistory(history) {
    if (!history || history.length === 0) return [];

    const formatted = [];
    history.forEach(entry => {
        const text = (entry.text || '').trim();
        if (!text) return;

        if (entry.sender === 'ai' || entry.sender === 'admin') {
            formatted.push(new AIMessage(text));
        } else {
            formatted.push(new HumanMessage(text));
        }
    });

    return formatted;
}

function toSenderNumberWithSuffix(id) {
    return parseSenderIdentity(id).normalizedAddress;
}

async function executeToolCall(toolName, args, metadata = {}) {
    console.log(`\n⚡[TOOL_CALL] ===== EXECUTING TOOL ===== `);
    console.log(`⚡[TOOL_CALL] Tool Name: ${toolName} `);
    console.log(`⚡[TOOL_CALL] Arguments: ${JSON.stringify(args, null, 2)} `);
    console.log(`⚡[TOOL_CALL] Available tools: ${Object.keys(availableTools).join(', ')} `);

    if (!availableTools[toolName]) {
        console.error(`❌[TOOL_CALL] Tool ${toolName} not found in available tools`);
        console.error(`❌[TOOL_CALL] Available tools: ${Object.keys(availableTools)} `);
        return { error: `Tool ${toolName} tidak tersedia` };
    }

    console.log(`✅[TOOL_CALL] Tool ${toolName} found, executing...`);

    try {
        let preparedArgs = args;
        if (typeof preparedArgs === 'string') {
            try {
                preparedArgs = JSON.parse(preparedArgs);
            } catch (error) {
                console.warn(`[TOOL_CALL] Tidak dapat parse argumen string untuk ${toolName}: `, error.message);
            }
        }

        if (preparedArgs && typeof preparedArgs === 'object') {
            // Force overwrite metadata to prevent hallucinations like "nomor mas"
            if (metadata.senderNumber) {
                preparedArgs.senderNumber = metadata.senderNumber;
                preparedArgs.sender_number = metadata.senderNumber; // Support snake_case tools
            }
            if (metadata.senderName) {
                preparedArgs.senderName = metadata.senderName;
                preparedArgs.sender_name = metadata.senderName; // Support snake_case tools
            }
        }

        const startTime = Date.now();
        const result = await availableTools[toolName](preparedArgs);
        const executionTime = Date.now() - startTime;

        console.log(`✅[TOOL_CALL] Tool ${toolName} executed successfully in ${executionTime} ms`);
        console.log(`📊[TOOL_CALL] Tool result: ${JSON.stringify(result, null, 2)} `);
        console.log(`⚡[TOOL_CALL] ===== TOOL EXECUTION COMPLETED =====\n`);

        return result;
    } catch (error) {
        console.error(`❌[TOOL_CALL] Error executing ${toolName}: `, error);
        console.error(`❌[TOOL_CALL] Error stack: `, error.stack);
        console.error(`❌[TOOL_CALL] ===== TOOL EXECUTION FAILED =====\n`);
        return { error: `Kesalahan saat menjalankan ${toolName}: ${error.message} ` };
    }
}

function extractTextFromAIContent(content) {
    if (typeof content === 'string') {
        return content;
    }

    if (Array.isArray(content)) {
        return content
            .map(part => {
                if (typeof part === 'string') return part;
                if (part?.text) return part.text;
                if (part?.message) return part.message;
                return '';
            })
            .filter(Boolean)
            .join('\n');
    }

    if (content && typeof content === 'object' && content.text) {
        return content.text;
    }

    return '';
}

function getToolCallsFromResponse(response) {
    if (response?.tool_calls && Array.isArray(response.tool_calls) && response.tool_calls.length > 0) {
        return response.tool_calls;
    }

    const additional = response?.additional_kwargs?.tool_calls;
    if (Array.isArray(additional) && additional.length > 0) {
        return additional;
    }

    return [];
}

function parseToolDirectiveFromText(text) {
    if (!text) return null;
    const trimmed = text.trim();

    // 1. Check for XML-style tag: <function=toolName>jsonArgs</function>
    // This handles cases where the model outputs raw tags instead of native tool calls
    const xmlMatch = text.match(/<function=(\w+)>(.*?)<\/function>/s);
    if (xmlMatch) {
        const toolName = xmlMatch[1];
        const jsonContent = xmlMatch[2];
        try {
            // Clean up potential HTML entities or newlines in JSON
            const cleanJson = jsonContent.replace(/&quot;/g, '"').trim();
            const args = JSON.parse(cleanJson);
            return { toolName, args };
        } catch (error) {
            console.warn('[AI_PROCESSING] Failed to parse JSON from XML tool directive:', error.message);
        }
    }

    // 2. Check for Python-style: tool_code print(...)
    if (!trimmed.toLowerCase().startsWith('tool_code')) {
        return null;
    }

    const directiveMatch = trimmed.match(/tool_code\s*print\((\w+)\(([\s\S]*?)\)\)\s*$/i);
    if (!directiveMatch) {
        return null;
    }

    const toolName = directiveMatch[1];
    const argsSegment = directiveMatch[2] || '';
    const args = {};

    const argRegex = /(\w+)\s*=\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g;
    let argMatch;
    while ((argMatch = argRegex.exec(argsSegment)) !== null) {
        const key = argMatch[1];
        let value = argMatch[2];
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        value = value
            .replace(/\\n/g, '\n')
            .replace(/\\t/g, '\t')
            .replace(/\\"/g, '"')
            .replace(/\\'/g, "'");
        args[key] = value;
    }

    if (!Object.keys(args).length) {
        const jsonCandidate = argsSegment.trim();
        if (jsonCandidate) {
            try {
                const parsed = JSON.parse(jsonCandidate);
                if (parsed && typeof parsed === 'object') {
                    return { toolName, args: parsed };
                }
            } catch (error) {
                console.warn('[AI_PROCESSING] Failed to parse tool_code directive JSON segment:', error.message);
            }
        }
    }

    return { toolName, args };
}

function sanitizeToolDirectiveOutput(text) {
    if (!text) return '';
    let clean = text.replace(/tool_code[\s\S]*$/i, '');
    clean = clean.replace(/<function=\w+>[\s\S]*?<\/function>/gi, '');
    return clean.trim();
}

async function analyzeMediaWithGemini(mediaBuffer, mimeType, caption = '', senderName = 'User', previousContext = '') {
    const base64Data = mediaBuffer.toString('base64');
    const VISION_TIMEOUT_MS = parseInt(process.env.VISION_TIMEOUT_MS || '60000', 10); // Increase timeout for video

    const isVideo = mimeType.startsWith('video/');
    const mediaTypeLabel = isVideo ? 'Video' : 'Foto';

    const systemPrompt = [
        'Anda adalah Zoya, asisten Bosmat Repainting and Detailing Studio.',
        `Tugas: Analisis ${mediaTypeLabel} motor pengguna secara akurat.`,
        '',
        'Fokus analisis:',
        '- Kondisi cat (kusam, baret, mengelupas, jamur)',
        '- Kebersihan (kerak mesin, debu tebal, noda)',
        '- Kerusakan fisik yang terlihat',
        ...(isVideo ? ['- Suara mesin (jika ada dan terdengar aneh)', '- Gerakan atau demonstrasi masalah yang ditunjukkan'] : []),
        '',
        'Aturan:',
        `- Hanya deskripsikan apa yang BENAR - BENAR terlihat / terdengar di ${mediaTypeLabel}.`,
        '- Jangan berasumsi atau mengarang kerusakan.',
        '- Jawab dalam bahasa Indonesia, singkat 2-4 kalimat.',
        '- Rekomendasikan treatment Bosmat yang relevan.',
        '',
        'Layanan Bosmat:',
        '- Repaint: Bodi Halus, Bodi Kasar, Velg, Cover CVT/Arm, Spot Repair',
        '- Detailing: Detailing Mesin, Cuci Komplit, Poles Bodi Glossy, Full Detailing Glossy',
        '- Coating: Coating Motor Doff/Glossy, Complete Service Doff/Glossy',
    ].join('\n');

    const textPrompt = `Analisis ${mediaTypeLabel} motor dari ${senderName}. ${caption ? `Caption pengguna: ${caption}.` : ''} ${previousContext ? `Konteks chat sebelumnya: "${previousContext}".` : ''} Sebutkan poin penting dalam 2 - 4 kalimat.Jika ada noda / baret / kerusakan, jelaskan singkat dan rekomendasikan treatment Bosmat yang relevan.`;

    const fallbackChain = ['gemini-2.0-flash', 'gemini-1.5-flash-latest'];
    const modelsToTry = Array.from(
        new Set([
            ACTIVE_VISION_MODEL,
            FALLBACK_VISION_MODEL,
            ...fallbackChain
        ].filter(Boolean))
    );

    // Try each model with each API key
    for (const modelName of modelsToTry) {
        for (let apiKeyIndex = 0; apiKeyIndex < API_KEYS.length; apiKeyIndex++) {
            const currentApiKey = API_KEYS[apiKeyIndex];
            const apiKeyLabel = apiKeyIndex === 0 ? 'primary' : `fallback #${apiKeyIndex} `;

            try {
                const logPrefix = apiKeyIndex === 0
                    ? `[VISION] 🔍 Analysing ${mediaTypeLabel} using ${modelName}...`
                    : `[VISION] 🔄 Trying ${modelName} with ${apiKeyLabel} API key...`;
                console.log(logPrefix);

                const visionModel = new ChatGoogleGenerativeAI({
                    model: modelName,
                    apiKey: currentApiKey,
                    temperature: 0.3,
                    maxOutputTokens: 2048,
                });

                // Construct message content based on media type
                const messageContent = [
                    { type: "text", text: textPrompt }
                ];

                if (isVideo) {
                    messageContent.push({
                        type: "media",
                        mimeType: mimeType, // CamelCase required for video
                        data: base64Data
                    });
                } else {
                    messageContent.push({
                        type: "image_url",
                        image_url: `data:${mimeType}; base64, ${base64Data} `
                    });
                }

                // Timeout wrapper: abort jika Gemini tidak respond dalam batas waktu
                const invokePromise = visionModel.invoke([
                    new SystemMessage(systemPrompt),
                    new HumanMessage({
                        content: messageContent
                    })
                ]);

                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error(`Vision analysis timeout after ${VISION_TIMEOUT_MS} ms`)), VISION_TIMEOUT_MS)
                );

                const response = await Promise.race([invokePromise, timeoutPromise]);

                const text = extractTextFromAIContent(response.content);

                if (text) {
                    const successMsg = apiKeyIndex === 0
                        ? `[VISION] ✅ Analysis complete with ${modelName} `
                        : `[VISION] ✅ Analysis complete with ${modelName} using ${apiKeyLabel} API key`;
                    console.log(successMsg);
                    return text;
                }
            } catch (error) {
                const isQuotaError = error?.message?.includes('Quota exceeded') ||
                    error?.message?.includes('429') ||
                    error?.message?.includes('quota') ||
                    error?.message?.includes('RESOURCE_EXHAUSTED');

                const isTimeoutError = error?.message?.includes('timeout');

                const errorLabel = apiKeyIndex === 0
                    ? `[VISION] ❌ ${modelName} failed`
                    : `[VISION] ❌ ${modelName} with ${apiKeyLabel} API key failed`;
                console.error(`${errorLabel}: `, error?.message || error);

                // If timeout, skip remaining API keys for this model and try next model
                if (isTimeoutError) {
                    console.warn(`[VISION] ⏱️ ${modelName} timed out, trying next model...`);
                    break;
                }

                // If quota error and more API keys available, try next key with same model
                if (isQuotaError && apiKeyIndex < API_KEYS.length - 1) {
                    continue;
                }
                // Otherwise try next model
                break;
            }
        }
    }

    return `${mediaTypeLabel} diterima, namun analisis otomatis gagal dilakukan.`;
}

async function getAIResponse(userMessage, senderName = "User", senderNumber = null, context = "", mediaItems = [], modelOverride = null, providedHistory = []) {
    try {
        console.log('\n🤖 [AI_PROCESSING] ===== STARTING AI PROCESSING =====');
        console.log(`📝[AI_PROCESSING] User Message: "${userMessage}"`);
        console.log(`👤[AI_PROCESSING] Sender: ${senderName} `);
        console.log(`📱[AI_PROCESSING] Sender Number: ${senderNumber || 'N/A'} `);


        // --- 4. CONDITIONAL HISTORY (HEMAT TOKEN & LUWES) ---
        let conversationHistoryMessages = [];
        
        // Cek apakah pesan user pendek (< 8 kata) atau mengandung kata ambigu yang butuh konteks
        const wordCount = userMessage.split(/\s+/).length;
        const isShortOrAmbiguous = wordCount < 8 || 
                                   /^(oke|iya|gas|terus|jadi|boleh|harganya|kapan|jam berapa|besok|y|ok|sip|siap|mantap)$/i.test(userMessage.trim());

        if (isShortOrAmbiguous && senderNumber && db) {
            console.log(`🧠 [AI_PROCESSING] Pesan pendek (${wordCount} kata) terdeteksi. Mengambil 4 pesan terakhir...`);
            try {
                // Ambil maksimal 4 pesan terakhir saja (2 turn)
                const history = await getConversationHistory(senderNumber, 4);
                if (history && history.length > 0) {
                    conversationHistoryMessages = buildLangChainHistory(history);
                    console.log(`🧠 [AI_PROCESSING] Berhasil memuat ${history.length} pesan terakhir untuk konteks`);
                }
            } catch (err) {
                console.warn(`⚠️ [AI_PROCESSING] Gagal mengambil history: ${err.message}`);
            }
        } else {
            console.log(`🧠 [AI_PROCESSING] Pesan cukup jelas (${wordCount} kata) atau history tidak di-trigger. Token diselamatkan!`);
        }

        const userTextContent = context
            ? `${userMessage} \n\n[Context Internal]\n${context} `
            : userMessage;

        let humanMessageContent;

        if (mediaItems && mediaItems.length > 0) {
            console.log(`🖼️[AI_PROCESSING] Using multimodal input with ${mediaItems.length} media items`);
            humanMessageContent = [
                { type: "text", text: userTextContent }
            ];

            for (const item of mediaItems) {
                if (item.type === 'image') {
                    humanMessageContent.push({
                        type: "media",
                        mimeType: item.mimetype,
                        data: item.buffer.toString('base64')
                    });
                } else if (item.type === 'video') {
                    humanMessageContent.push({
                        type: "media",
                        mimeType: item.mimetype,
                        data: item.buffer.toString('base64')
                    });
                }
            }
        } else {
            humanMessageContent = userTextContent;
        }

        // Cek apakah pengirim adalah admin
        const adminNumbers = [
            process.env.BOSMAT_ADMIN_NUMBER,
            process.env.ADMIN_WHATSAPP_NUMBER
        ].filter(Boolean);

        const normalize = (n) => n ? n.toString().replace(/\D/g, '') : '';
        const senderNormalized = normalize(senderNumber);
        const isAdmin = adminNumbers.some(num => normalize(num) === senderNormalized);

        let effectiveSystemPrompt = currentSystemPrompt;
        if (isAdmin) {
            console.log(`👮[AI_PROCESSING] Admin detected: ${senderNumber}. Using ADMIN_SYSTEM_PROMPT.`);
            effectiveSystemPrompt = ADMIN_SYSTEM_PROMPT;
        }

        // Persistent Memory Injection (getState + customerContext)
        let memoryPart = "";
        let customerCtx = null; // Declare at block scope to pass to router later
        let state = null;
        if (senderNumber) {
            try {
                // Gunakan destructuring array karena Promise.all membalas dalam array
                [state, customerCtx] = await Promise.all([
                    getState(senderNumber),
                    getCustomerContext(senderNumber),
                ]);

                const parts = [];

                // Prioritas 1: customerContext (dari background extractor, lebih reliable)
                if (customerCtx) {
                    if (customerCtx.conversation_summary) {
                        parts.push(`[RINGKASAN OBROLAN SEBELUMNYA]`);
                        parts.push(customerCtx.conversation_summary);
                        parts.push(`---------------------------`);
                    }

                    // Motor identity
                    if (customerCtx.motor_model) parts.push(`- Motor: ${customerCtx.motor_model}`);
                    if (customerCtx.motor_year) parts.push(`- Tahun motor: ${customerCtx.motor_year}`);
                    if (customerCtx.motor_color) parts.push(`- Warna motor: ${customerCtx.motor_color}`);
                    if (customerCtx.motor_condition) parts.push(`- Kondisi: ${customerCtx.motor_condition}`);

                    // Service needs
                    if (customerCtx.target_service) parts.push(`- Layanan diminati: ${customerCtx.target_service}`);
                    if (customerCtx.service_detail) parts.push(`- Detail layanan: ${customerCtx.service_detail}`);
                    if (customerCtx.budget_signal) parts.push(`- Sinyal budget: ${customerCtx.budget_signal}`);

                    // Intent signals
                    if (customerCtx.intent_level) parts.push(`- Level intent: ${customerCtx.intent_level}`);
                    if (customerCtx.said_expensive === true) parts.push(`- ⚠️ Pernah bilang mahal`);
                    if (customerCtx.asked_price === true) parts.push(`- Sudah tanya harga`);
                    if (customerCtx.asked_availability === true) parts.push(`- Sudah tanya jadwal`);
                    if (customerCtx.shared_photo === true) parts.push(`- Sudah kirim foto motor`);

                    // Logistics
                    if (customerCtx.preferred_day) parts.push(`- Preferensi hari: ${customerCtx.preferred_day}`);
                    if (customerCtx.location_hint) parts.push(`- Lokasi: ${customerCtx.location_hint}`);

                    // Price memory
                    if (customerCtx.quoted_services?.length > 0) {
                        const serviceList = customerCtx.quoted_services
                            .map(s => `${s.name}: Rp${s.price?.toLocaleString('id-ID') || '?'}`)
                            .join(', ');
                        parts.push(`- Harga sudah dikutip: ${serviceList}`);
                    }
                    if (customerCtx.quoted_total_bundling) {
                        parts.push(`- Total bundling (diskon): Rp${customerCtx.quoted_total_bundling.toLocaleString('id-ID')}`);
                    }
                    if (customerCtx.quoted_at) {
                        parts.push(`- Penawaran terakhir: ${customerCtx.quoted_at}`);
                    }

                    // Stage signals
                    if (customerCtx.conversation_stage) {
                        parts.push(`- Stage percakapan: ${customerCtx.conversation_stage}`);
                    }
                    if (customerCtx.last_ai_action) {
                        parts.push(`- Aksi AI terakhir: ${customerCtx.last_ai_action}`);
                    }
                    if (customerCtx.upsell_offered === true) {
                        parts.push(`- ⚠️ Upsell sudah ditawarkan, JANGAN tawarkan lagi`);
                    }

                    // --- DYNAMIC FLOW CONTROLLER (Tanpa Token Bengkak) ---
                    // Mengarahkan AI sesuai alur obrolan: Kualifikasi -> Konsultasi -> Upsell -> Booking
                    let actionDirective = "";
                    const m_model = customerCtx.motor_model || (state && state.motor_model);
                    const t_service = customerCtx.target_service || (state && state.target_service);
                    const m_cond = customerCtx.motor_condition;
                    const m_color = customerCtx.motor_color;
                    const isRepaint = t_service && t_service.toLowerCase().includes('repaint');
                    const isRepaintVelg = t_service && t_service.toLowerCase().includes('velg');
                    const isDetailing = t_service && (t_service.toLowerCase().includes('detailing') || t_service.toLowerCase().includes('cuci'));

                    if (!m_model) {
                        actionDirective = `\n🎯 TARGET SAAT INI (KUALIFIKASI): Kamu belum tahu *jenis/tipe motor* user. Tanyakan tipe motornya secara natural. JANGAN bahas harga atau jadwal dulu.`;
                    } else if (!t_service) {
                        actionDirective = `\n🎯 TARGET SAAT INI (KUALIFIKASI): Kamu sudah tahu motornya (${m_model}), tapi belum tahu *layanan yang dibutuhkan* (Repaint/Detailing/Coating). Tanyakan kebutuhannya apa.`;
                    } else if (isRepaint && !m_color) {
                        actionDirective = `\n🎯 TARGET SAAT INI (KONSULTASI WARNA): User butuh Repaint untuk ${m_model}. Tanyakan *warna yang diinginkan* (Standar/Candy/Stabilo/Bunglon/Chrome) karena ada biaya tambahan (surcharge) untuk warna spesial.`;
                    } else if (isRepaint && !m_cond) {
                        actionDirective = `\n🎯 TARGET SAAT INI (KONSULTASI KONDISI BODI): User butuh Repaint. Tanyakan *kondisi bodi saat ini* (apakah ada lecet parah, pecah, atau butuh repair bodi kasar) karena bisa ada biaya tambahan perbaikan.`;
                    } else if (isRepaintVelg && !customerCtx.upsell_offered && !customerCtx.quoted_services?.length) {
                        actionDirective = `\n🎯 TARGET SAAT INI (KONSULTASI KONDISI VELG): User butuh Repaint Velg. Tanyakan apakah velg *pernah dicat ulang* atau *banyak jamur/kerak*, karena ada biaya tambahan remover (+50rb s/d 100rb). Boleh juga tawarkan sekalian cat Behel/Arm (+50rb) atau CVT (+100rb).`;
                    } else if (isDetailing && !m_cond) {
                        actionDirective = `\n🎯 TARGET SAAT INI (KONSULTASI KONDISI MOTOR): User butuh Detailing/Cuci untuk ${m_model}. Tanyakan dulu *kondisi motornya saat ini* (apakah banyak kerak oli, jamur, kusam, atau sekadar kotor debu) supaya kamu bisa merekomendasikan paket Detailing yang paling pas.`;
                    } else if (!customerCtx.quoted_services || customerCtx.quoted_services.length === 0) {
                        actionDirective = `\n🎯 TARGET SAAT INI (KONSULTASI HARGA): Informasi sudah cukup (${m_model}, ${t_service}, Warna/Kondisi sudah dikonfirmasi). SEGERA panggil tool \`getServiceDetails\` untuk mengecek harga (termasuk surcharge jika ada) dan jelaskan ke user secara singkat.`;
                    } else if (!customerCtx.upsell_offered && customerCtx.intent_level !== 'hot') {
                        actionDirective = `\n🎯 TARGET SAAT INI (EDUKASI & UPSELL): Kamu sudah mengutip harga. Jelaskan kelebihan layanan ini dengan santai, lalu tawarkan *upsell ringan 1x* (misal: "sekalian cuci komplit rangka mumpung dibongkar mas?").`;
                    } else if (!customerCtx.preferred_day && !customerCtx.asked_availability) {
                        actionDirective = `\n🎯 TARGET SAAT INI (CLOSING): User sudah tahu harga dan layanannya. Giring perlahan untuk booking dengan bertanya "Rencana mau dikerjakan hari apa Mas?" atau "Mau Zoya cek jadwal kosongnya?".`;
                    } else if (customerCtx.conversation_stage === 'closing') {
                        actionDirective = `\n🎯 TARGET SAAT INI (CLOSING FINAL): User sudah setuju. LANGSUNG panggil \`checkBookingAvailability\` dan buat bookingnya. STOP tanya hal lain.`;
                    }

                    if (actionDirective) {
                        parts.push(actionDirective);
                    }
                }

                // Prioritas 2: Legacy state (fallback, hanya jika customerCtx belum punya)
                if (state) {
                    if (state.motor_model && !customerCtx?.motor_model) parts.push(`- Motor: ${state.motor_model}`);
                    if (state.target_service && !customerCtx?.target_service) parts.push(`- Layanan dituju: ${state.target_service}`);
                    if (state.important_notes) parts.push(`- Catatan: ${state.important_notes}`);
                }

                if (parts.length > 0) {
                    memoryPart = `\n\n[PERSISTENT CONTEXT]\nInformasi yang sudah diketahui tentang pelanggan ini:\n${parts.join('\n')}\n(Gunakan informasi ini jika relevan, jangan tanya ulang hal yang sudah diketahui).`;
                }
            } catch (error) {
                console.warn('[AI_PROCESSING] Gagal mengambil persistent state:', error.message);
            }
        }

        // Inject tanggal & waktu langsung ke prompt (hemat 1 tool call)
        const now = DateTime.now().setZone('Asia/Jakarta').setLocale('id');
        let dateTimePart = `\nSekarang: ${now.toFormat("cccc, d LLLL yyyy HH:mm")} WIB.`;

        // Fetch and inject Promo Config
        try {
            if (db) {
                const promoDoc = await db.collection('settings').doc('promo_config').get();
                if (promoDoc.exists && promoDoc.data().isActive) {
                    const promoText = promoDoc.data().promoText;
                    if (promoText) {
                        dateTimePart += `\n\n[PROMO AKTIF SAAT INI]\n${promoText}\n(Gunakan layanan promo ini sebagai penawaran diskon/upsell jika cocok dengan kebutuhan pelanggan, cukup gunakan informasi seperlunya tanpa mengorbankan token).`;
                    }
                }
            }
        } catch (error) {
            console.warn('[AI_PROCESSING] Gagal mengambil promo config:', error.message);
        }

        // Optimasi: Hanya gunakan prompt sistem, konteks dari extractor (termasuk ringkasan terbaru),
        // CONDITIONAL HISTORY (hanya jika pesan pendek), dan pesan user saat ini.
        const messages = [
            new SystemMessage(effectiveSystemPrompt + dateTimePart + memoryPart),
            ...conversationHistoryMessages,
            new HumanMessage(humanMessageContent)
        ].filter(msg => !!msg); // Filter out null/undefined messages

        // --- DYNAMIC INTENT ROUTER ---
        let activeModel;
        let activeToolDefs;

        if (isAdmin) {
            activeModel = adminModel;
            activeToolDefs = toolDefinitions;
        } else {
            // Function to route tools dynamically based on context and user message
            const routeCustomerTools = (ctx, userMsg) => {
                const routedTools = [];
                // Handle if userMsg is an array (multimodal content)
                const msgText = Array.isArray(userMsg)
                    ? (userMsg.find(p => p.type === 'text')?.text || '')
                    : (userMsg || '');
                const msgLower = msgText.toLowerCase();
                const intent = ctx?.intent_level || 'null';

                // 1. Always included baseline tools
                routedTools.push(notifyVisitIntentTool);

                // 2. Info Studio (Only when asked about location/hours)
                if (msgLower.includes('alamat') || msgLower.includes('lokasi') ||
                    msgLower.includes('dimana') || msgLower.includes('jam') ||
                    msgLower.includes('buka') || msgLower.includes('tutup') ||
                    msgLower.includes('maps')) {
                    routedTools.push(getStudioInfoTool);
                }

                // 3. Pricing & Service Info
                // Include if feeling out (cold/null) OR they explicitly ask about price/service
                if (intent === 'cold' || intent === 'null' || !ctx ||
                    msgLower.includes('harga') || msgLower.includes('biaya') || msgLower.includes('berapa') ||
                    msgLower.includes('jasa') || msgLower.includes('layanan') || msgLower.includes('repaint') || msgLower.includes('coating') || msgLower.includes('detailing')) {
                    routedTools.push(getServiceDetailsTool);
                }

                // 4. Booking & Scheduling
                // Include if warming up (warm/hot) OR they explicitly ask about booking/dates
                if (intent === 'warm' || intent === 'hot' ||
                    msgLower.includes('booking') || msgLower.includes('jadwal') || msgLower.includes('kapan') ||
                    msgLower.includes('kosong') || msgLower.includes('besok') || msgLower.includes('hari ini')) {
                    routedTools.push(checkBookingAvailabilityTool);
                    routedTools.push(createBookingTool);
                    routedTools.push(updateBookingTool);
                }

                // 5. Onsite Service
                // Include if location data exists or explicitly mentioned
                if ((ctx && ctx.location_hint) || msgLower.includes('home service') || msgLower.includes('rumah') || msgLower.includes('jemput')) {
                    routedTools.push(calculateHomeServiceFeeTool);
                }

                // 6. Visual Analysis
                if (msgLower.includes('foto') || msgLower.includes('lihat') || msgLower.includes('gambar')) {
                    routedTools.push(sendStudioPhotoTool);
                }

                return routedTools;
            };

            const routedCustomerTools = routeCustomerTools(customerCtx, humanMessageContent);
            activeToolDefs = routedCustomerTools;
            const routedToolSpecs = prepareToolSpecs(routedCustomerTools);
            activeModel = baseModel.bindTools(routedToolSpecs);
        }

        console.log(`🔧[AI_PROCESSING] Tools routed (${isAdmin ? 'ADMIN' : 'CUSTOMER'}, ${activeToolDefs.length} tools): ${activeToolDefs.map(t => t.toolDefinition?.function?.name || t.name || t.function?.name || 'UnknownTool').join(', ')} `);
        let iteration = 0;
        const MAX_ITERATIONS = 8;

        let response;
        while (iteration < MAX_ITERATIONS) {
            iteration++;
            console.log(`\n⏳ Iteration ${iteration} of ${MAX_ITERATIONS}...`);

            try {
                let lastError = null;
                let responseReceived = false;

                // Try each API key in sequence
                for (let apiKeyIndex = 0; apiKeyIndex < API_KEYS.length; apiKeyIndex++) {
                    const currentApiKey = API_KEYS[apiKeyIndex];
                    const isFirstKey = apiKeyIndex === 0;
                    const apiKeyLabel = isFirstKey ? 'primary' : `fallback #${apiKeyIndex}`;

                    try {
                        if (!isFirstKey) {
                            console.log(`🔄[AI_PROCESSING] Trying ${apiKeyLabel} API key...`);
                        }

                        // Create model instance with current API key
                        const targetModel = modelOverride || ACTIVE_AI_MODEL;
                        const currentModel = new ChatGoogleGenerativeAI({
                            model: targetModel,
                            temperature: ACTIVE_AI_TEMPERATURE,
                            apiKey: currentApiKey
                        });

                        // Bind the active tools to the current model
                        const currentBoundModel = currentModel.bindTools(isAdmin ? adminToolSpecs : prepareToolSpecs(activeToolDefs));
                        // Set runName explicitly for tracking
                        response = await currentBoundModel.invoke(messages, getTracingConfig(isAdmin ? 'AdminResponse' : 'CustomerResponse', {
                            runName: isAdmin ? 'AdminResponse' : 'CustomerResponse',
                            metadata: {
                                sender_number: senderNumber || 'anonymous',
                                sender_name: senderName || 'User',
                                iteration,
                                model: targetModel,
                                api_key_index: apiKeyIndex
                            },
                            tags: [isAdmin ? 'admin' : 'customer', targetModel]
                        }));

                        // Validate response
                        const hasToolCalls = getToolCallsFromResponse(response).length > 0;
                        if (!response || ((response.content === null || response.content === undefined) && !hasToolCalls)) {
                            console.error('❌ [AI_PROCESSING] Invalid response structure:', response ? Object.keys(response) : 'null');
                            throw new Error('Invalid response from AI model: empty or undefined content');
                        }

                        if (!isFirstKey) {
                            console.log(`✅[AI_PROCESSING] ${apiKeyLabel} API key succeeded!`);
                        }

                        responseReceived = true;
                        break; // Success - exit API key retry loop

                    } catch (error) {
                        lastError = error;

                        // Check if this is a retryable error
                        const isQuotaError = error?.message?.includes('Quota exceeded') ||
                            error?.message?.includes('429') ||
                            error?.message?.includes('quota') ||
                            error?.message?.includes('RESOURCE_EXHAUSTED');

                        const isAuthError = error?.message?.includes('API key not valid') ||
                            error?.message?.includes('authentication') ||
                            error?.message?.includes('401');

                        const isResponseError = error?.message?.includes('Cannot read properties') ||
                            error?.message?.includes('undefined');

                        const isRetryableError = isQuotaError || isResponseError || isAuthError;

                        console.error(`❌[AI_PROCESSING] Error with ${apiKeyLabel} API key: `, error.message);

                        // If this is the last API key or non-retryable error, try model fallback
                        if (apiKeyIndex === API_KEYS.length - 1 || !isRetryableError) {
                            if (isRetryableError && (isQuotaError || isResponseError)) {
                                console.error(`❌[AI_PROCESSING] All API keys exhausted, trying model fallback...`);
                                const fallbackModel = 'gemini-2.0-flash';

                                if (fallbackModel === ACTIVE_AI_MODEL) {
                                    break; // No point in model fallback
                                }

                                try {
                                    console.log(`🔄[AI_PROCESSING] Trying fallback model: ${fallbackModel} with primary API key`);
                                    const fallbackModelInstance = new ChatGoogleGenerativeAI({
                                        model: fallbackModel,
                                        temperature: ACTIVE_AI_TEMPERATURE,
                                        apiKey: API_KEYS[0]
                                    });

                                    response = await fallbackModelInstance.invoke(messages, getTracingConfig(isAdmin ? 'AdminResponse' : 'CustomerResponse'));

                                    // Validate fallback response
                                    const hasFallbackToolCalls = getToolCallsFromResponse(response).length > 0;
                                    // Relaxed validation: Allow empty string content. Only fail if strictly null/undefined.
                                    if (!response || ((response.content === null || response.content === undefined) && !hasFallbackToolCalls)) {
                                        console.error('❌ [AI_PROCESSING] Invalid fallback response structure:', response ? Object.keys(response) : 'null');
                                        throw new Error('Invalid response from fallback model');
                                    }

                                    console.log(`✅[AI_PROCESSING] Fallback model ${fallbackModel} succeeded!`);
                                    responseReceived = true;
                                    break;
                                } catch (fallbackError) {
                                    console.error(`❌[AI_PROCESSING] Fallback model ${fallbackModel} also failed: `, fallbackError.message);
                                    lastError = fallbackError;
                                }
                            }
                            break; // Exit API key retry loop
                        }

                        // Continue to next API key
                        continue;
                    }
                }

                // If we still don't have a response after trying all options, throw error
                if (!responseReceived) {
                    console.error(`❌[AI_PROCESSING] All retry attempts failed`);
                    throw lastError || new Error('Failed to get AI response after all retry attempts');
                }

                const toolCalls = getToolCallsFromResponse(response);

                if (toolCalls.length === 0) {
                    const finalTextRaw = extractTextFromAIContent(response.content);
                    const finalText = typeof finalTextRaw === 'string' ? finalTextRaw.trim() : '';

                    console.log(`📥[AI_PROCESSING] AI Response received`);
                    console.log(`📥[AI_PROCESSING] Response type: ${typeof response.content} `);
                    console.log(`📥[AI_PROCESSING] Response content: "${finalText}"`);

                    const directive = parseToolDirectiveFromText(finalText);
                    if (directive) {
                        const { toolName, args } = directive;
                        console.log(`[AI_PROCESSING] Detected textual tool directive: ${toolName} `);

                        if (!availableTools[toolName]) {
                            const safeText = sanitizeToolDirectiveOutput(finalText);
                            console.log(`🎯[AI_PROCESSING] ===== AI PROCESSING COMPLETED =====\n`);
                            return {
                                content: safeText || 'Baik mas, Zoya akan bantu cek ke tim Bosmat.',
                                id: response.id
                            };
                        }

                        messages.push(response);

                        const enrichedArgs = { ...args };
                        if (senderNumber && !enrichedArgs.senderNumber) {
                            enrichedArgs.senderNumber = senderNumber;
                        }
                        if (senderName && !enrichedArgs.senderName) {
                            enrichedArgs.senderName = senderName;
                        }

                        const toolCallId = `${toolName} -directive - ${Date.now()} `;
                        console.log(`⚡[AI_PROCESSING] Executing directive tool ${toolName} dengan args: ${JSON.stringify(enrichedArgs, null, 2)} `);
                        const toolResult = await executeToolCall(toolName, enrichedArgs, {
                            senderNumber,
                            senderName,
                        });
                        console.log(`✅[AI_PROCESSING] Directive tool ${toolName} completed`);
                        console.log(`📊[AI_PROCESSING] Directive tool result: ${JSON.stringify(toolResult, null, 2)} `);

                        messages.push(new ToolMessage({
                            tool_call_id: toolCallId,
                            content: JSON.stringify(toolResult),
                        }));

                        iteration += 1;
                        continue;
                    }

                    console.log(`🎯[AI_PROCESSING] ===== AI PROCESSING COMPLETED =====\n`);
                    return {
                        content: finalText || 'Maaf, saya belum bisa memberikan jawaban.',
                        id: response.id
                    };
                }

                iteration += 1;
                console.log(`🔧[AI_PROCESSING] ===== TOOL CALLS DETECTED(iteration ${iteration}) ===== `);
                console.log(`🔧[AI_PROCESSING] Number of tool calls: ${toolCalls.length} `);

                messages.push(response);

                for (let i = 0; i < toolCalls.length; i++) {
                    const toolCall = toolCalls[i];
                    const toolName = toolCall.name;
                    let toolArgs = toolCall.args || {};
                    if (typeof toolArgs === 'string') {
                        try {
                            toolArgs = JSON.parse(toolArgs);
                        } catch (err) {
                            console.warn(`⚠️[AI_PROCESSING] Failed to parse tool args string for ${toolName}: `, err.message);
                            toolArgs = {};
                        }
                    }
                    const toolCallId = toolCall.id || toolCall.tool_call_id || `${toolName} -${Date.now()} -${i} `;

                    console.log(`⚡[AI_PROCESSING] Executing tool ${i + 1}/${toolCalls.length}: ${toolName}`);
                    console.log(`   📝 Args: ${JSON.stringify(toolArgs, null, 2)}`);

                    const toolResult = await executeToolCall(toolName, toolArgs, {
                        senderNumber,
                        senderName,
                    });

                    console.log(`✅ [AI_PROCESSING] Tool ${toolName} completed`);
                    console.log(`📊 [AI_PROCESSING] Tool result: ${JSON.stringify(toolResult, null, 2)}`);

                    messages.push(new ToolMessage({
                        tool_call_id: toolCallId,
                        content: JSON.stringify(toolResult)
                    }));
                } // End of tool calls loop
            } catch (error) {
                console.error(`❌[AI_PROCESSING] Error parsing tool arguments: `, error);
                throw error;
            }
        } // End of while loop

        console.warn('⚠️ [AI_PROCESSING] Maximum iteration reached without final response.');
        return { content: 'Maaf, saya belum bisa memberikan jawaban.', id: null };
    } catch (error) {
        console.error('❌ [AI_PROCESSING] Error getting AI response:', error);
        console.error('❌ [AI_PROCESSING] Error stack:', error.stack);
        return { content: "Maaf, terjadi kesalahan. Silakan coba lagi.", id: null };
    }
}

async function rewriteAdminMessage(originalMessage, senderNumber) {
    if (!ADMIN_MESSAGE_REWRITE_ENABLED) {
        return {
            text: originalMessage,
            rewritten: false,
        };
    }

    const trimmed = (originalMessage || '').trim();
    if (!trimmed) {
        return {
            text: originalMessage,
            rewritten: false,
        };
    }

    try {
        const history = senderNumber ? await getConversationHistory(senderNumber, 6) : [];
        const recentDialogue = history
            .map((entry) => {
                const speaker = entry.sender === 'ai' ? 'Zoya' : entry.sender === 'admin' ? 'Admin' : 'User';
                return `${speaker}: ${entry.text}`;
            })
            .join('\n');

        const prompt = `Riwayat percakapan terbaru (paling lama di atas):\n${recentDialogue || '(belum ada riwayat)'}\n\nPesan admin yang perlu ditulis ulang:\n"""${trimmed}"""\n`;

        let response = null;
        let lastError = null;

        // Try each API key for admin message rewrite
        for (let apiKeyIndex = 0; apiKeyIndex < API_KEYS.length; apiKeyIndex++) {
            try {
                const modelInstance = apiKeyIndex === 0 ? baseModel : new ChatGoogleGenerativeAI({
                    model: ACTIVE_AI_MODEL,
                    temperature: ACTIVE_AI_TEMPERATURE,
                    apiKey: API_KEYS[apiKeyIndex]
                });

                response = await modelInstance.invoke([
                    new SystemMessage(ADMIN_MESSAGE_REWRITE_STYLE_PROMPT),
                    new HumanMessage(prompt),
                ], getTracingConfig('admin-message-rewrite'));

                break; // Success
            } catch (error) {
                lastError = error;
                if (apiKeyIndex < API_KEYS.length - 1) {
                    console.warn(`[Rewrite] API key #${apiKeyIndex + 1} failed, trying next...`);
                    continue;
                }
            }
        }

        if (!response) {
            throw lastError || new Error('Failed to rewrite admin message');
        }

        const rewrittenRaw = extractTextFromAIContent(response.content);
        const rewritten = typeof rewrittenRaw === 'string' ? rewrittenRaw.trim() : '';
        if (rewritten) {
            return {
                text: rewritten,
                rewritten: rewritten !== trimmed,
            };
        }
    } catch (error) {
        console.error('[Rewrite] Gagal menulis ulang pesan admin:', error);
    }

    return {
        text: originalMessage,
        rewritten: false,
    };
}

async function processBufferedMessages(senderNumber, client) {
    const bufferEntry = pendingMessages.get(senderNumber);
    if (!bufferEntry) return;

    pendingMessages.delete(senderNumber);

    const senderName = bufferEntry.senderName;

    const messageParts = bufferEntry.messages
        .map(m => (m.content || '').trim())
        .filter(part => part.length > 0);

    let combinedMessage = messageParts.join('\n').trim();
    if (!combinedMessage) {
        const hasImage = bufferEntry.messages.some(m => m.isImage);
        combinedMessage = hasImage ? '[Gambar diterima]' : '[Pesan tidak tersedia]';
    }

    const mediaItems = bufferEntry.messages
        .filter(m => m.mediaData)
        .map(m => m.mediaData);

    console.log(`[DEBOUNCED] Processing buffered message for ${senderName}: "${combinedMessage}"`);
    if (mediaItems.length > 0) {
        console.log(`[DEBOUNCED] ✓ ${mediaItems.length} media items available for multimodal processing`);
    }

    // Cek status AI (Snooze/Handover) sekali lagi sebelum memproses
    const { normalizedAddress } = parseSenderIdentity(senderNumber);
    if (await isSnoozeActive(normalizedAddress)) {
        console.log(`[DEBOUNCED] AI skipped for ${senderNumber} (handover active). Saving message only.`);
        if (db) await saveMessageToFirestore(senderNumber, combinedMessage, 'user');
        return;
    }

    try {
        // Simulasi perilaku manusia: Baca dulu (mark as read)
        await client.sendSeen(senderNumber);

        const typingDelay = 500 + Math.random() * 1000;
        await delay(typingDelay);
        await client.startTyping(senderNumber);

        // Check for Admin Model Override (#pro or !pro)
        let modelOverride = null;
        const adminNumbers = [
            process.env.BOSMAT_ADMIN_NUMBER,
            process.env.ADMIN_WHATSAPP_NUMBER
        ].filter(Boolean);

        const isAdmin = adminNumbers.some(num => {
            const cleanNum = num.toString().replace(/\D/g, '');
            return normalizedAddress && normalizedAddress.includes(cleanNum);
        });

        if (isAdmin) {
            const lowerMsg = combinedMessage.toLowerCase().trim();

            // ─── Audit Customer Trigger ─────────────────────────────────
            const AUDIT_TRIGGERS = ['audit customer', 'mulai audit', 'audit'];
            const RESUME_TRIGGERS = ['lanjut audit', 'resume audit'];
            const NEW_AUDIT_TRIGGER = 'audit baru';

            if (lowerMsg === NEW_AUDIT_TRIGGER || AUDIT_TRIGGERS.includes(lowerMsg)) {
                console.log(`[ADMIN] 📋 Audit trigger detected: "${lowerMsg}"`);
                const targetNumber = toSenderNumberWithSuffix(senderNumber);
                const auditResponse = await startAudit(normalizedAddress);
                markBotMessage(targetNumber, auditResponse);
                await client.sendText(targetNumber, auditResponse);
                if (db) {
                    await saveMessageToFirestore(senderNumber, combinedMessage, 'user');
                    await saveMessageToFirestore(senderNumber, auditResponse, 'ai');
                }
                await client.stopTyping(senderNumber);
                return;
            }

            if (RESUME_TRIGGERS.includes(lowerMsg)) {
                console.log(`[ADMIN] 📋 Audit resume trigger detected`);
                const targetNumber = toSenderNumberWithSuffix(senderNumber);
                const auditResponse = await handleResumeAudit(normalizedAddress);
                markBotMessage(targetNumber, auditResponse);
                await client.sendText(targetNumber, auditResponse);
                if (db) {
                    await saveMessageToFirestore(senderNumber, combinedMessage, 'user');
                    await saveMessageToFirestore(senderNumber, auditResponse, 'ai');
                }
                await client.stopTyping(senderNumber);
                return;
            }

            // Check if admin has active audit session
            if (await hasActiveSession(normalizedAddress)) {
                console.log(`[ADMIN] 📋 Active audit session, routing to audit handler`);
                const auditResponse = await handleAuditResponse(normalizedAddress, combinedMessage);
                if (auditResponse !== null) {
                    // Audit handled the message
                    const targetNumber = toSenderNumberWithSuffix(senderNumber);
                    markBotMessage(targetNumber, auditResponse);
                    await client.sendText(targetNumber, auditResponse);
                    if (db) {
                        await saveMessageToFirestore(senderNumber, combinedMessage, 'user');
                        await saveMessageToFirestore(senderNumber, auditResponse, 'ai');
                    }
                    await client.stopTyping(senderNumber);
                    return;
                }
                // auditResponse === null → escape hatch, proceed to getAIResponse
                console.log(`[ADMIN] 📋 Audit escape hatch triggered, forwarding to AI`);
            }

            // ─── Model Override (#pro / !pro) ───────────────────────────
            if (lowerMsg.startsWith('#pro ') || lowerMsg.startsWith('!pro ')) {
                modelOverride = 'gemini-3-pro-preview';
                combinedMessage = combinedMessage.substring(5).trim();
                console.log(`[ADMIN] 🚀 Model Override Triggered: ${modelOverride}`);
            }
        }

        const aiResponseResult = await getAIResponse(combinedMessage, senderName, senderNumber, '', mediaItems, modelOverride);
        const aiResponse = aiResponseResult.content;

        // Fire and forget — extract context THEN classify (chained, not parallel)
        extractAndSaveContext(combinedMessage, aiResponse, senderNumber)
            .then(() => classifyAndSaveCustomer(senderNumber))
            .catch(err => console.warn('[Pipeline] Context/Classifier failed:', err.message));

        // Fire and forget — track follow-up signals
        updateSignalsOnIncomingMessage(senderNumber, combinedMessage)
            .catch(err => console.warn('[SignalTracker] Failed:', err.message));

        // Save to Firebase if available
        if (db) {
            await saveMessageToFirestore(senderNumber, combinedMessage, 'user');
            await saveMessageToFirestore(senderNumber, aiResponse, 'ai');
        }

        // Send response back to user
        if (aiResponse) {
            const targetNumber = toSenderNumberWithSuffix(senderNumber);

            // Delay dinamis tambahan berdasarkan panjang teks agar typing indicator terlihat cukup lama untuk pesan panjang
            const dynamicDelay = Math.min(Math.max(aiResponse.length * 10, 1000), 4000);
            await delay(dynamicDelay);

            markBotMessage(targetNumber, aiResponse.trim());
            await client.sendText(targetNumber, aiResponse.trim());
        }

        await client.stopTyping(senderNumber);
    } catch (err) {
        console.error(`[ERROR] Handler error for ${senderNumber}:`, err);
        await client.stopTyping(senderNumber);
    }
}

// --- WhatsApp Event Handlers ---
function start(client) {
    const debounceQueue = new DebounceQueue(DEBOUNCE_DELAY_MS, async (senderNumber) => {
        await processBufferedMessages(senderNumber, client);
    });
    client.__debounceQueue = debounceQueue;

    client.onAnyMessage(async (msg) => {
        await handleAdminHpMessage(msg);
    });

    client.onMessage(async (msg) => {
        if (msg.from === 'status@broadcast' || msg.fromMe) {
            return;
        }

        let senderNumber = msg.from;

        // Resolve @lid (Linked Devices / Meta Business) ke nomor asli
        if (senderNumber.endsWith('@lid')) {
            try {
                // Coba ambil pnJid dari payload message (lazy load)
                if (msg.sender && msg.sender.pnJid) {
                    senderNumber = msg.sender.pnJid;
                } else {
                    // Fallback: minta nomor aslinya ke WPPConnect
                    const realPhone = await client.requestPhoneNumber(senderNumber);
                    if (realPhone) {
                        senderNumber = realPhone;
                    }
                }
            } catch (err) {
                console.warn(`[WPP] Warning: Gagal resolve nomor asli dari LID ${msg.from}:`, err.message);
            }
        }
        const senderName = msg.sender.pushname || msg.notifyName || senderNumber;
        let messageContent = msg.body;
        const isMedia = msg.isMedia || msg.type === 'image' || msg.type === 'video' || msg.type === 'tv' || msg.type === 'document';
        const isImage = msg.type === 'image';
        const isVideo = msg.type === 'video' || msg.type === 'tv';
        const isLocation = msg.type === 'location';

        if (!messageContent && !isMedia && !isLocation) return;

        // Log different types of messages
        if (isLocation) {
            console.log(`[BUFFER] 📍 Location received from ${senderName}. Lat: ${msg.lat || msg.latitude}, Lng: ${msg.lng || msg.longitude}`);
        } else if (isImage || isVideo) {
            console.log(`[BUFFER] 📸/🎥 Media (${isImage ? 'Image' : 'Video'}) received from ${senderName}. Caption: "${msg.caption || 'No caption'}"`);
        } else if (isMedia) {
            console.log(`[BUFFER] 📎 Media received from ${senderName}. Type: ${msg.type}`);
        } else {
            console.log(`[BUFFER] 💬 Text received from ${senderName}: "${messageContent}"`);
        }

        // Save sender metadata
        await saveSenderMeta(senderNumber, senderName, client);

        let locationContext = null;

        if (isLocation) {
            const latitude = typeof msg.lat === 'number' ? msg.lat : parseFloat(msg.lat || msg.latitude);
            const longitude = typeof msg.lng === 'number' ? msg.lng : parseFloat(msg.lng || msg.longitude);
            const label = msg.loc || msg.address || msg.description || null;
            const address = msg.address || null;

            if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
                locationContext = {
                    latitude,
                    longitude,
                    label,
                    address,
                };

                const locationTextParts = [
                    '📍 Lokasi dibagikan pelanggan:',
                    label || 'Tanpa label',
                    `Koordinat: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
                ];
                if (address) {
                    locationTextParts.push(`Alamat: ${address}`);
                }
                messageContent = locationTextParts.join('\n');

                try {
                    await saveCustomerLocation(senderNumber, {
                        latitude,
                        longitude,
                        address,
                        label,
                        raw: {
                            latitude,
                            longitude,
                            address,
                            label,
                            from: 'whatsapp-share-location',
                        },
                        source: 'whatsapp-share-location',
                    });
                } catch (error) {
                    console.warn('[Location] Gagal menyimpan lokasi pelanggan:', error);
                }
            } else {
                messageContent = '📍 Lokasi dibagikan, namun koordinat tidak terbaca.';
            }
        }

        const { normalizedAddress } = parseSenderIdentity(senderNumber);
        if (await isSnoozeActive(normalizedAddress)) {
            const storedContent = (() => {
                if (messageContent && messageContent.trim()) {
                    return messageContent.trim();
                }
                if (isImage || isVideo) {
                    const captionText = (msg.caption || '').trim();
                    return captionText || `[${isImage ? 'Foto' : 'Video'} diterima]`;
                }
                if (isMedia) {
                    return `[${msg.type}]`;
                }
                return '[Pesan kosong]';
            })();

            await saveMessageToFirestore(senderNumber, storedContent, 'user');
            console.log(`[SNOOZE] Pesan dari ${senderName} disimpan tanpa respons AI (handover aktif).`);
            return;
        }

        const entry = pendingMessages.get(senderNumber) || { senderName, messages: [] };
        entry.senderName = senderName;

        let analysisResult = null;

        const messageEntry = {
            content: '',
            isMedia,
            isImage,
            isVideo,
            originalMsg: msg,
        };

        if (isImage || isVideo) {
            const captionText = (msg.caption || '').trim();

            try {
                console.log(`[MULTIMODAL] 🔄 Mengunduh media (${isImage ? 'Image' : 'Video'}) dari ${senderName}...`);
                const mediaBuffer = await client.decryptFile(msg);
                console.log(`[MULTIMODAL] ✅ Media terunduh (${mediaBuffer.length} bytes)`);

                // Store media info for multimodal processing
                messageEntry.mediaData = {
                    buffer: mediaBuffer,
                    mimetype: msg.mimetype || (isImage ? 'image/jpeg' : 'video/mp4'),
                    type: isImage ? 'image' : 'video'
                };
            } catch (error) {
                console.error(`[MULTIMODAL] ❌ Gagal mengunduh media dari ${senderName}:`, error);
            }

            messageContent = captionText || `[${isImage ? 'Foto' : 'Video'} diterima]`;
            messageEntry.content = messageContent;
        } else {
            messageEntry.content = messageContent || (isLocation ? '[Lokasi diterima]' : `[${msg.type}]`);
        }

        if (analysisResult) {
            messageEntry.analysis = analysisResult;
        }

        if (locationContext) {
            messageEntry.location = locationContext;
        }

        entry.messages.push(messageEntry);
        pendingMessages.set(senderNumber, entry);

        // Cek apakah pengirim adalah admin untuk bypass buffer time
        const adminNumbers = [
            process.env.BOSMAT_ADMIN_NUMBER,
            process.env.ADMIN_WHATSAPP_NUMBER
        ].filter(Boolean);

        const normalize = (n) => n ? n.toString().replace(/\D/g, '') : '';
        const senderNormalized = normalize(senderNumber);
        const isAdmin = adminNumbers.some(num => normalize(num) === senderNormalized);

        if (isAdmin) {
            console.log(`[BUFFER] ⚡ Admin detected (${senderNumber}), skipping debounce buffer.`);
            await processBufferedMessages(senderNumber, client);
        } else {
            debounceQueue.schedule(senderNumber, messageEntry);
        }
    });

    // --- Handle Incoming Calls ---
    client.onIncomingCall(async (call) => {
        console.log(`[CALL] Panggilan masuk dari ${call.peerJid}`);
        try {
            // Zoya tidak bisa angkat telepon, kirim pesan otomatis yang ramah
            const message = "Waduh, maaf ya Mas, Zoya nggak bisa angkat telepon 😅.\n\nKetik aja pertanyaannya di sini, nanti Zoya bantu jawab kok! 👇";
            markBotMessage(call.peerJid, message);
            await client.sendText(call.peerJid, message);
        } catch (e) {
            console.error('[CALL] Error handling incoming call:', e);
        }
    });

    client.onStateChange(async (state) => {
        console.log('📱 [WhatsApp] State changed:', state);

        if (state.includes('CONFLICT')) {
            console.log('⚠️ [WhatsApp] Conflict detected, using current session...');
            try {
                await client.useHere();
                console.log('✅ [WhatsApp] Conflict resolved');
            } catch (e) {
                console.error('❌ [WhatsApp] Failed to resolve conflict:', e.message);
            }
        }

        // Handle SYNCING state - jangan trigger reconnect saat masih syncing
        if (state.includes('SYNCING')) {
            console.log('⏳ [WhatsApp] Syncing connection... (TUNGGU, jangan logout dari mobile!)');
            // Jangan trigger reconnect saat masih syncing, biarkan proses selesai
            return;
        }

        if (state.includes('UNPAIRED') || state.includes('LOGOUT')) {
            console.error('❌ [WhatsApp] Logged out / Unpaired detected!');
            console.warn('⚠️ [WhatsApp] Kemungkinan penyebab:');
            console.warn('   1. WhatsApp logout dari mobile device');
            console.warn('   2. WhatsApp Multi-Device tidak aktif');
            console.warn('   3. Session expired atau invalid');
            console.warn('   4. WhatsApp Web di-unlink dari mobile');
            console.log('🔄 [WhatsApp] Attempting to reconnect in 15 seconds...');

            // Set flag untuk trigger reconnect
            global.whatsappClient = null;

            // Reconnect setelah delay lebih lama untuk pastikan state sudah stabil
            setTimeout(async () => {
                await reconnectWhatsApp();
            }, 15000);
        }

        if (state.includes('DISCONNECTED') || state.includes('disconnectedMobile')) {
            console.warn('⚠️ [WhatsApp] Disconnected / disconnectedMobile detected');
            console.warn('💡 [WhatsApp] INSTRUKSI PENTING:');
            console.warn('   1. Buka WhatsApp di HP Anda');
            console.warn('   2. Settings → Linked Devices');
            console.warn('   3. Pastikan "Multi-device beta" atau "Link a Device" AKTIF');
            console.warn('   4. JANGAN logout dari WhatsApp di HP saat bot running');
            console.log('🔄 [WhatsApp] Attempting to reconnect in 10 seconds...');
            setTimeout(async () => {
                await reconnectWhatsApp();
            }, 10000);
        }
    });
}

// --- Firebase Functions ---
async function saveMessageToFirestore(senderNumber, message, senderType) {
    if (!db) return;

    const { docId, channel, platformId } = parseSenderIdentity(senderNumber);
    if (!docId) {
        return;
    }

    try {
        const messagesRef = db.collection('directMessages').doc(docId).collection('messages');
        const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();

        await messagesRef.add({
            text: message,
            timestamp: serverTimestamp,
            sender: senderType,
        });

        await db.collection('directMessages').doc(docId).set({
            lastMessage: message,
            lastMessageSender: senderType,
            lastMessageAt: serverTimestamp,
            updatedAt: serverTimestamp,
            messageCount: admin.firestore.FieldValue.increment(1),
            channel,
            platform: channel,
            platformId: platformId || docId,
            fullSenderId: senderNumber,
        }, { merge: true });
    } catch (error) {
        console.error('Error saving to Firestore:', error);
    }
}

const fetchedProfilePics = new Set(); // Keep track of numbers we already fetched DP for

async function saveSenderMeta(senderNumber, displayName, client = null) {
    if (!db) return;

    const { docId, channel, platformId } = parseSenderIdentity(senderNumber);
    if (!docId) {
        return;
    }

    let profilePicUrl = null;
    if (client && channel === 'whatsapp' && !fetchedProfilePics.has(senderNumber)) {
        try {
            profilePicUrl = await client.getProfilePicFromServer(senderNumber);
            fetchedProfilePics.add(senderNumber); // Mark as fetched for this session
        } catch (error) {
            console.warn(`[ProfilePic] Gagal mengambil foto profil untuk ${senderNumber}:`, error.message);
        }
    }

    try {
        const metaRef = db.collection('directMessages').doc(docId);
        
        const updateData = {
            name: displayName,
            channel,
            platform: channel,
            platformId: platformId || docId,
            fullSenderId: senderNumber,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        if (profilePicUrl) {
            updateData.profilePicUrl = profilePicUrl;
        }

        await metaRef.set(updateData, { merge: true });
    } catch (error) {
        console.error('Error saving sender meta:', error);
    }
}

function serializeTimestamp(timestamp) {
    if (!timestamp) return null;
    if (typeof timestamp.toDate === 'function') {
        return timestamp.toDate().toISOString();
    }
    if (timestamp instanceof Date) {
        return timestamp.toISOString();
    }
    return null;
}

async function listConversations(limit = 100) {
    if (!db) return [];

    try {
        const snapshot = await db.collection('directMessages').get();
        const conversations = await Promise.all(snapshot.docs.map(async (doc) => {
            const data = doc.data() || {};
            const senderNumberFull = data.fullSenderId || toSenderNumberWithSuffix(doc.id);
            const snoozeInfo = await getSnoozeInfo(senderNumberFull);

            const identity = parseSenderIdentity(senderNumberFull);
            const storedChannel = typeof data.channel === 'string' ? data.channel.toLowerCase() : null;
            const effectiveChannel = storedChannel && storedChannel !== 'unknown'
                ? storedChannel
                : identity.channel || 'whatsapp';

            return {
                id: doc.id,
                senderNumber: senderNumberFull,
                name: data.name || null,
                lastMessage: data.lastMessage || null,
                lastMessageSender: data.lastMessageSender || null,
                lastMessageAt: serializeTimestamp(data.lastMessageAt),
                updatedAt: serializeTimestamp(data.updatedAt),
                messageCount: typeof data.messageCount === 'number' ? data.messageCount : null,
                channel: effectiveChannel,
                platformId: data.platformId || identity.platformId || doc.id,
                aiPaused: snoozeInfo.active,
                aiPausedUntil: snoozeInfo.expiresAt,
                aiPausedManual: snoozeInfo.manual,
                aiPausedReason: snoozeInfo.reason,
                label: data.customerLabel || null,
                labelReason: data.labelReason || null,
                labelUpdatedAt: serializeTimestamp(data.labelUpdatedAt),
            };
        }));

        conversations.sort((a, b) => {
            const timeA = a.updatedAt ? Date.parse(a.updatedAt) : 0;
            const timeB = b.updatedAt ? Date.parse(b.updatedAt) : 0;
            return timeB - timeA;
        });

        if (limit && conversations.length > limit) {
            return conversations.slice(0, limit);
        }

        return conversations;
    } catch (error) {
        console.error('Error listing conversations:', error);
        return [];
    }
}

// --- API Endpoints ---
const metaWebhookRouter = createMetaWebhookRouter({
    getAIResponse,
    saveMessageToFirestore,
    saveSenderMeta,
    logger: console,
});

// Explicitly handle Meta Webhook Verification (GET)
// Ini memastikan verifikasi berjalan lancar terlepas dari logika di dalam router
app.get('/webhooks/meta', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN;

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('[Meta Webhook] Verified successfully!');
            res.status(200).send(challenge);
        } else {
            console.error(`[Meta Webhook] Verification failed. Token mismatch. Expected: ${VERIFY_TOKEN}, Got: ${token}`);
            res.sendStatus(403);
        }
    } else {
        res.status(200).send('Meta Webhook is active');
    }
});

app.use('/webhooks/meta', metaWebhookRouter);

app.get('/health', (req, res) => {
    const whatsappStatus = global.whatsappClient ? 'connected' : 'disconnected';
    res.json({
        status: 'healthy',
        service: 'WhatsApp AI Chatbot',
        provider: 'Google Gemini',
        model: process.env.AI_MODEL || 'gemini-1.5-flash-latest',
        visionModel: ACTIVE_VISION_MODEL,
        whatsappStatus,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
    const { Client: LSClient } = require('./src/ai/utils/langsmith.js');

    app.post('/langsmith/feedback', async (req, res) => {
        try {
            const { runId, key, score, comment, value } = req.body;
            if (!runId || !key) {
                return res.status(400).json({ error: 'runId and key are required' });
            }

            const client = new LSClient();
            await client.createFeedback(runId, key, {
                score,
                comment,
                value
            });

            res.json({ success: true });
        } catch (error) {
            console.error('❌ [LANGSMITH] Failed to log feedback:', error);
            res.status(500).json({ error: error.message });
        }
    });
});

// Lightweight ping endpoint untuk keep-alive
app.get('/ping', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/conversations', async (req, res) => {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit, 10) : 100;
        const conversations = await listConversations(limit);

        // DEBUG: Log first conversation to check label mapping
        if (conversations.length > 0) {
            console.log('[DEBUG API] /conversations first item:', JSON.stringify({
                id: conversations[0].id,
                label: conversations[0].label,
                customerLabel: conversations[0].customerLabel // Check original field too
            }));
        }

        res.set('Cache-Control', 'no-store');
        res.json({
            conversations,
            count: conversations.length,
            status: 'success',
        });
    } catch (error) {
        console.error('[API] Error fetching conversations:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/send-message', async (req, res) => {
    const { number, message, channel: channelOverride, platformId: platformOverride } = req.body || {};
    if (!number || !message) {
        return res.status(400).json({ error: 'Number and message are required.' });
    }

    try {
        const identity = parseSenderIdentity(number);
        const channel = (channelOverride || identity.channel || 'whatsapp').toLowerCase();
        const platformId = platformOverride || identity.platformId;

        const { text: finalMessage, rewritten } = await rewriteAdminMessage(message, identity.normalizedAddress || number);
        if (rewritten) {
            console.log('[API] Admin message rewritten for consistent tone.');
        }

        if (channel === 'whatsapp' || channel === 'wa') {
            if (!global.whatsappClient) {
                throw new Error('WhatsApp client not initialized.');
            }

            const targetNumber = identity.normalizedAddress || toSenderNumberWithSuffix(number);
            markBotMessage(targetNumber, finalMessage);
            await global.whatsappClient.sendText(targetNumber, finalMessage);
            await saveMessageToFirestore(targetNumber, finalMessage, 'admin');
            console.log(`[API] Successfully sent WhatsApp message to ${targetNumber}`);
            return res.status(200).json({ success: true, channel: 'whatsapp', rewritten });
        }

        if (!platformId) {
            throw new Error(`Platform ID is required to send ${channel} messages.`);
        }

        await sendMetaMessage(channel, platformId, finalMessage, console);
        await saveMessageToFirestore(identity.docId, finalMessage, 'admin');
        console.log(`[API] Successfully sent ${channel} message to ${platformId}`);
        return res.status(200).json({ success: true, channel, rewritten });
    } catch (e) {
        console.error('[API] Error sending message:', e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/send-media', async (req, res) => {
    const { number, base64, mimetype, filename, caption } = req.body;
    if (!number || !base64 || !mimetype) {
        return res.status(400).json({ error: 'Number, base64, and mimetype are required.' });
    }

    try {
        if (!global.whatsappClient) {
            throw new Error('WhatsApp client not initialized.');
        }

        const targetNumber = toSenderNumberWithSuffix(number);
        const dataUri = `data:${mimetype};base64,${base64}`;
        await global.whatsappClient.sendFile(targetNumber, dataUri, filename || 'file', caption || '');
        console.log(`[API] Successfully sent media to ${number}`);
        res.status(200).json({ success: true });
    } catch (e) {
        console.error('[API] Error sending media:', e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/test-ai', async (req, res) => {
    try {
        const { message, senderNumber, mode, model_override, history, media } = req.body;
        const testMessage = message || "Hello, test message";

        // Convert base64 media to Buffer format for getAIResponse
        let mediaItems = [];
        if (media && Array.isArray(media)) {
            mediaItems = media.map(item => ({
                type: item.type, // 'image' or 'video'
                mimetype: item.mimetype,
                buffer: Buffer.from(item.base64, 'base64')
            }));
        }

        // If mode is 'admin', use the admin number so getAIResponse picks up the ADMIN_SYSTEM_PROMPT
        let effectiveSenderNumber = senderNumber || null;
        let senderName = "Test User";
        if (mode === 'admin') {
            // Only force the sender number if it's already set somehow, otherwise we still want it to be null to use local memory if applicable
            if (effectiveSenderNumber) {
                effectiveSenderNumber = process.env.BOSMAT_ADMIN_NUMBER || process.env.ADMIN_WHATSAPP_NUMBER || effectiveSenderNumber;
            }
            senderName = "Admin (Playground)";
        }

        const aiResult = await getAIResponse(testMessage, senderName, effectiveSenderNumber, "", mediaItems, model_override, history);
        const response = aiResult.content;
        const runId = aiResult.id;

        // Save messages to history AFTER processing to avoid doubling in history
        if (effectiveSenderNumber && db) {
            await saveMessageToFirestore(effectiveSenderNumber, testMessage, 'user');
            if (response) {
                await saveMessageToFirestore(effectiveSenderNumber, response, 'ai');
            }

            // Fire and forget — extract context THEN classify (same as WhatsApp flow)
            extractAndSaveContext(testMessage, response, effectiveSenderNumber)
                .then(() => classifyAndSaveCustomer(effectiveSenderNumber))
                .catch(err => console.warn('[Playground] Context/Classifier failed:', err.message));
        }

        res.json({
            input: testMessage,
            ai_response: response,
            run_id: runId,
            memory_enabled: !!effectiveSenderNumber,
            mode: mode || 'customer',
            status: 'success'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/conversation-history/:number', async (req, res) => {
    try {
        const { number } = req.params;
        const { limit } = req.query;

        if (!number) {
            return res.status(400).json({ error: 'Number is required.' });
        }

        const identity = parseSenderIdentity(number);
        if (!identity.docId) {
            return res.status(404).json({ error: 'Conversation not found.' });
        }

        const senderKey = identity.normalizedAddress || number;
        const historyLimit = limit ? parseInt(limit) : 200; // Updated default for Admin UI to 200

        const history = await getConversationHistory(senderKey, historyLimit);
        const snoozeInfo = await getSnoozeInfo(senderKey);

        res.json({
            senderNumber: identity.docId,
            channel: identity.channel,
            platformId: identity.platformId || identity.docId,
            messageCount: history.length,
            history: history,
            memoryConfig: MEMORY_CONFIG,
            aiPaused: snoozeInfo.active,
            aiPauseInfo: snoozeInfo,
            status: 'success'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/memory-config', (req, res) => {
    res.json({
        memoryConfig: MEMORY_CONFIG,
        status: 'success'
    });
});

app.post('/conversation/:number/ai-state', async (req, res) => {
    try {
        const { number } = req.params;
        const { enabled, durationMinutes, reason } = req.body || {};

        if (!number) {
            return res.status(400).json({ error: 'Number is required.' });
        }

        if (typeof enabled !== 'boolean') {
            return res.status(400).json({ error: 'enabled (boolean) is required.' });
        }

        const identity = parseSenderIdentity(number);
        const senderNumber = identity.normalizedAddress;

        if (!senderNumber) {
            return res.status(400).json({ error: 'Number is invalid.' });
        }

        if (enabled) {
            await clearSnoozeMode(senderNumber);
        } else {
            const hasDuration = typeof durationMinutes === 'number' && durationMinutes > 0;
            const manual = !hasDuration;
            // Jika manual (toggle via UI), set durasi sangat panjang (1 tahun) agar tidak auto-ON dalam 60 menit
            const effectiveDuration = hasDuration ? durationMinutes : (365 * 24 * 60);

            await setSnoozeMode(senderNumber, effectiveDuration, {
                manual,
                reason: reason || (manual ? 'manual-toggle' : 'timed-toggle'),
            });
        }

        const info = await getSnoozeInfo(senderNumber);

        res.json({
            senderNumber,
            aiEnabled: !info.active,
            aiPaused: info.active,
            aiPauseInfo: info,
            status: 'success',
        });
    } catch (error) {
        console.error('[API] Error updating AI state:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/bookings', async (req, res) => {
    try {
        const { start, end } = req.query;
        let query = db.collection('bookings');

        // Filter sederhana berdasarkan tanggal jika disediakan
        if (start) query = query.where('bookingDate', '>=', start);
        if (end) query = query.where('bookingDate', '<=', end);

        const snapshot = await query.orderBy('bookingDate', 'asc').get();
        const bookings = [];

        snapshot.forEach(doc => {
            const data = doc.data();

            // Hitung Estimasi Durasi & Cek Kategori Repaint
            let maxDurationMinutes = 0;
            let isRepaint = false;

            const serviceList = data.services || (data.serviceName ? [data.serviceName] : []);

            serviceList.forEach(sName => {
                const cleanName = sName.toLowerCase();
                const svc = masterLayanan.find(m =>
                    cleanName.includes(m.name.toLowerCase()) ||
                    m.name.toLowerCase().includes(cleanName)
                );

                if (svc) {
                    if (svc.category === 'repaint') isRepaint = true;
                    const dur = parseInt(svc.estimatedDuration || '0', 10);
                    if (dur > maxDurationMinutes) maxDurationMinutes = dur;
                }
            });

            // Konversi menit ke hari kerja (asumsi 8 jam/hari = 480 menit)
            const durationDays = Math.ceil(maxDurationMinutes / 480) || 1;

            // Hitung Tanggal Selesai
            let estimatedEndDate = data.bookingDate;
            if (data.bookingDate) {
                const startDate = new Date(data.bookingDate);
                const endDate = new Date(startDate);
                endDate.setDate(startDate.getDate() + (durationDays - 1));
                estimatedEndDate = endDate.toISOString().split('T')[0];
            }

            bookings.push({
                id: doc.id,
                ...data,
                isRepaint,
                estimatedDurationDays: durationDays,
                estimatedEndDate,
                // Pastikan timestamp diserialisasi
                createdAt: serializeTimestamp(data.createdAt),
                updatedAt: serializeTimestamp(data.updatedAt)
            });
        });

        res.json({ bookings, status: 'success' });
    } catch (error) {
        console.error('[API] Error fetching bookings:', error);
        res.status(500).json({ error: error.message });
    }
});

app.patch('/bookings/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, notes } = req.body;

        if (!status) {
            return res.status(400).json({ error: 'Status is required' });
        }

        const updateData = {
            status,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        if (notes) {
            updateData.adminNotes = notes;
        }

        await db.collection('bookings').doc(id).update(updateData);

        res.json({ success: true, id, status });
    } catch (error) {
        console.error('[API] Error updating booking status:', error);
        res.status(500).json({ error: error.message });
    }
});

// --- Server Startup ---
server.listen(PORT, '0.0.0.0', async () => {
    console.log(`🚀 WhatsApp AI Chatbot listening on http://0.0.0.0:${PORT}`);
    console.log(`🤖 AI Provider: Google Gemini`);
    console.log(`🤖 AI Model: ${process.env.AI_MODEL || 'gemini-1.5-flash-latest'}`);
    console.log(`🖼️  Vision Model: ${ACTIVE_VISION_MODEL}`);
    console.log(`⏱️  Debounce Delay: ${DEBOUNCE_DELAY_MS}ms`);
    console.log(`🧠 Memory Config: Max ${MEMORY_CONFIG.maxMessages} messages, ${MEMORY_CONFIG.maxAgeHours}h retention`);
    console.log(`🖥️  Chromium launch args: ${PUPPETEER_CHROME_ARGS.join(' ')}`);
    console.log(`🖥️  Chromium viewport: ${PUPPETEER_VIEWPORT.width}x${PUPPETEER_VIEWPORT.height}`);

    const sessionName = process.env.WHATSAPP_SESSION || 'ai-chatbot';
    const sessionDataPath = './tokens';

    await cleanupChromiumProfileLocks(sessionName, sessionDataPath).catch((error) => {
        console.warn('[Browser] Failed to clean up Chromium profile locks:', error.message);
    });

    // Initialize WhatsApp connection
    // ⚠️ PENTING: Set autoClose ke false secara eksplisit untuk production
    const whatsappAutoClose = process.env.WHATSAPP_AUTO_CLOSE !== 'false'; // Default false jika tidak di-set
    const whatsappHeadless = process.env.WHATSAPP_HEADLESS !== 'false'; // Default true (headless) agar jalan di Railway/Docker

    // Force false untuk production (jika env tidak di-set atau bukan 'true', maka false)
    const shouldAutoClose = process.env.WHATSAPP_AUTO_CLOSE === 'true';

    console.log(`🔧 WhatsApp Config: AUTO_CLOSE=${shouldAutoClose} (env: "${process.env.WHATSAPP_AUTO_CLOSE}"), HEADLESS=${whatsappHeadless}`);

    console.log(`🔧 Puppeteer Config: Headless=${whatsappHeadless}, Executable=${process.env.PUPPETEER_EXECUTABLE_PATH || 'System Default'}`);

    wppconnect.create({
        session: sessionName,
        // 🛠️ FIX: Set User Agent di awal config agar lolos deteksi saat loading/syncing
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        authTimeout: 120000, // Perpanjang ke 2 menit untuk toleransi Syncing
        blockCrashLogs: true,
        disableGoogleAnalytics: true,
        catchQR: (base64Qr, asciiQR, attempt, urlCode) => {
            console.log('📱 WhatsApp QR Code (Small Mode):');
            if (urlCode) {
                qrcode.generate(urlCode, { small: true });
                console.log('\n🎫 Pairing Code (Raw):', urlCode);
                console.log('💡 Jika QR terpotong, copy kode di atas ke https://www.the-qrcode-generator.com/');
                console.log('💡 Jika scan gagal, coba perbesar terminal atau copy kode di atas.');
            } else {
                console.log(asciiQR);
            }
        },
        statusFind: (statusSession, session) => {
            console.log('📱 WhatsApp Status:', statusSession, 'Session:', session);
            if (statusSession === 'isLogged') {
                console.log('✅ WhatsApp sudah login, tidak perlu QR code');
            } else if (statusSession === 'notLogged') {
                console.log('⚠️ WhatsApp belum login, menunggu QR code...');
            } else if (statusSession === 'qrReadSuccess') {
                console.log('✅ QR code berhasil di-scan!');
            } else if (statusSession === 'autocloseCalled') {
                console.error('❌ ERROR: Auto close dipanggil! Pastikan WHATSAPP_AUTO_CLOSE=false');
                console.error('⚠️ Mencoba reconnect...');
                // Jangan throw error, biarkan retry
            } else if (statusSession === 'disconnectedMobile' || statusSession.includes('disconnectedMobile')) {
                console.error('❌ [WhatsApp] Session Unpaired - WhatsApp terdeteksi login di mobile device');
                console.error('⚠️ [WhatsApp] ============================================');
                console.error('⚠️ [WhatsApp] MASALAH: WhatsApp Web di-unpair oleh mobile');
                console.error('⚠️ [WhatsApp] ============================================');
                console.warn('💡 [WhatsApp] SOLUSI (WAJIB DILAKUKAN):');
                console.warn('   1. Buka WhatsApp di HP Anda');
                console.warn('   2. Masuk ke: Settings → Linked Devices');
                console.warn('   3. Pastikan "Multi-device beta" atau "Link a Device" AKTIF');
                console.warn('   4. Jika belum aktif, AKTIFKAN sekarang');
                console.warn('   5. JANGAN logout dari WhatsApp di HP saat bot running');
                console.warn('   6. Bot akan auto-reconnect, scan QR code yang muncul');
                console.warn('💡 [WhatsApp] Setelah Multi-Device aktif, bot tidak akan unpair lagi');
                // Trigger reconnect setelah delay lebih lama
                setTimeout(async () => {
                    if (global.whatsappClient) {
                        global.whatsappClient = null;
                        await reconnectWhatsApp();
                    }
                }, 15000);
            } else if (statusSession === 'SYNCING' || statusSession.includes('SYNCING')) {
                console.log('⏳ [WhatsApp] Syncing connection... (TUNGGU, jangan logout dari mobile!)');
                console.log('⏳ [WhatsApp] State: SYNCING - Proses normal, tunggu selesai...');
            }
        },
        puppeteerOptions: {
            userDataDir: sessionDataPath, // Pastikan path session konsisten
            args: [
                ...PUPPETEER_CHROME_ARGS,
                '--disable-gpu', // Pastikan GPU mati untuk hemat memori
                '--disable-web-security', // Membantu meloloskan beberapa resource WA Web
            ]
        },
        headless: whatsappHeadless,
        logQR: false,
        autoClose: shouldAutoClose, // Hanya true jika env var eksplisit 'true'
        disableWelcome: true, // Disable welcome message
        sessionDataPath,
    })
        .then(async (client) => {
            global.whatsappClient = client;

            // Inject stealth mode setelah client ready
            try {
                if (client.page) {
                    const page = client.page;
                    // Bypass webdriver detection
                    await page.evaluateOnNewDocument(() => {
                        // Override navigator.webdriver
                        Object.defineProperty(navigator, 'webdriver', {
                            get: () => false,
                        });

                        // Override chrome object
                        window.chrome = {
                            runtime: {},
                            loadTimes: function () { },
                            csi: function () { },
                            app: {}
                        };

                        // Override permissions
                        const originalQuery = window.navigator.permissions.query;
                        window.navigator.permissions.query = (parameters) => (
                            parameters.name === 'notifications' ?
                                Promise.resolve({ state: Notification.permission }) :
                                originalQuery(parameters)
                        );

                        // Override plugins
                        Object.defineProperty(navigator, 'plugins', {
                            get: () => [1, 2, 3, 4, 5],
                        });

                        // Override languages
                        Object.defineProperty(navigator, 'languages', {
                            get: () => ['en-US', 'en'],
                        });
                    });

                    // Set realistic user agent
                    await page.setUserAgent(
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
                    );

                    console.log('🕵️ [Stealth] Anti-detection scripts injected successfully');
                }
            } catch (stealthError) {
                console.warn('[Stealth] Failed to inject anti-detection (non-critical):', stealthError.message);
            }

            start(client);
            startBookingReminderScheduler();
            startFollowUpScheduler();
            console.log('✅ WhatsApp client initialized successfully!');

            if (process.env.RUN_ADMIN_BACKFILL === 'true') {
                console.log('🔄 [Backfill] Starting admin message backfill...');
                backfillAdminMessages(client)
                    .then(() => console.log('✅ [Backfill] Admin message backfill complete'))
                    .catch(err => console.error('❌ [Backfill] Backfill failed:', err.message))
                    .finally(() => {
                        console.log('💡 [Backfill] Set RUN_ADMIN_BACKFILL=false to disable');
                    });
            }

            // Start keep-alive mechanism untuk mencegah server idle timeout
            startKeepAlive();

            // Start WhatsApp connection keep-alive
            startWhatsAppKeepAlive(client);
        })
        .catch((error) => {
            console.error('❌ WhatsApp initialization error:', error);
            // Tetap start keep-alive meskipun WhatsApp belum connect
            startKeepAlive();

            // Retry connection setelah delay
            setTimeout(async () => {
                await reconnectWhatsApp();
            }, 30000);
        });
});

// Reconnect WhatsApp function
async function reconnectWhatsApp() {
    if (global.whatsappReconnecting) {
        console.log('⏳ [WhatsApp] Reconnection already in progress, skipping...');
        return;
    }

    global.whatsappReconnecting = true;
    console.log('🔄 [WhatsApp] Starting reconnection process...');

    try {
        const sessionName = process.env.WHATSAPP_SESSION || 'ai-chatbot';
        const sessionDataPath = './tokens';
        const whatsappHeadless = process.env.WHATSAPP_HEADLESS === 'true';
        const shouldAutoClose = process.env.WHATSAPP_AUTO_CLOSE === 'true';

        // Cleanup old client jika ada
        if (global.whatsappClient) {
            try {
                await global.whatsappClient.close();
            } catch (e) {
                console.warn('[WhatsApp] Error closing old client:', e.message);
            }
            global.whatsappClient = null;
        }

        // Cleanup locks
        await cleanupChromiumProfileLocks(sessionName, sessionDataPath).catch((error) => {
            console.warn('[Browser] Failed to clean up Chromium profile locks:', error.message);
        });

        // Recreate connection
        console.log(`🔄 [WhatsApp] Reconnecting...`);

        const client = await wppconnect.create({
            session: sessionName,
            // 🛠️ FIX: Terapkan config yang sama saat reconnect
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
            authTimeout: 120000,
            blockCrashLogs: true,
            catchQR: (base64Qr, asciiQR, attempt, urlCode) => {
                console.log('📱 [WhatsApp] QR Code (Reconnect):');
                if (urlCode) {
                    qrcode.generate(urlCode, { small: true });
                    console.log('\n🎫 Pairing Code (Raw):', urlCode);
                } else {
                    console.log(asciiQR);
                }
                console.log('💡 [WhatsApp] SCAN QR CODE INI dengan WhatsApp di HP Anda');
                console.log('💡 [WhatsApp] Pastikan Multi-Device sudah aktif sebelum scan!');
            },
            // Stealth mode untuk reconnect juga
            browserArgs: PUPPETEER_CHROME_ARGS,
            puppeteerOptions: {
                timeout: 180000,
                protocolTimeout: 360000,
                args: PUPPETEER_CHROME_ARGS,
                defaultViewport: PUPPETEER_VIEWPORT,
                ignoreHTTPSErrors: true,
                headless: whatsappHeadless,
                executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
            },
            onLoadingScreen: async (page) => {
                try {
                    await page.evaluateOnNewDocument(() => {
                        Object.defineProperty(navigator, 'webdriver', { get: () => false });
                        window.chrome = { runtime: {}, loadTimes: function () { }, csi: function () { }, app: {} };
                    });
                    await page.setUserAgent(
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    );
                } catch (e) {
                    console.warn('[Stealth] Reconnect injection failed:', e.message);
                }
            },
            statusFind: (statusSession, session) => {
                console.log('📱 [WhatsApp] Status (Reconnect):', statusSession);
                if (statusSession === 'disconnectedMobile' || statusSession.includes('disconnectedMobile')) {
                    console.error('❌ [WhatsApp] Masih terdeteksi disconnectedMobile');
                    console.error('⚠️ [WhatsApp] INSTRUKSI: Aktifkan Multi-Device di HP SEBELUM scan QR!');
                } else if (statusSession === 'isLogged') {
                    console.log('✅ [WhatsApp] Reconnected successfully!');
                } else if (statusSession === 'qrReadSuccess') {
                    console.log('✅ [WhatsApp] QR code scanned! Connecting...');
                }
            },
            headless: whatsappHeadless,
            logQR: true,
            autoClose: shouldAutoClose,
            disableWelcome: true,
            sessionDataPath,
        });

        global.whatsappClient = client;

        // Inject stealth mode untuk reconnect juga
        try {
            if (client.page) {
                const page = client.page;
                await page.evaluateOnNewDocument(() => {
                    Object.defineProperty(navigator, 'webdriver', { get: () => false });
                    window.chrome = { runtime: {}, loadTimes: function () { }, csi: function () { }, app: {} };
                });
                await page.setUserAgent(
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
                );
                console.log('🕵️ [Stealth] Anti-detection injected on reconnect');
            }
        } catch (stealthError) {
            console.warn('[Stealth] Reconnect injection failed (non-critical):', stealthError.message);
        }

        start(client);
        startWhatsAppKeepAlive(client);
        console.log('✅ [WhatsApp] Reconnected successfully!');

    } catch (error) {
        console.error('❌ [WhatsApp] Reconnection failed:', error.message);
        console.log('🔄 [WhatsApp] Will retry in 60 seconds...');
        setTimeout(async () => {
            global.whatsappReconnecting = false;
            await reconnectWhatsApp();
        }, 60000);
        return;
    }

    global.whatsappReconnecting = false;
}

// WhatsApp connection keep-alive: periodic check untuk memastikan connection tetap aktif
function startWhatsAppKeepAlive(client) {
    const KEEP_ALIVE_INTERVAL_MS = parseInt(process.env.WHATSAPP_KEEP_ALIVE_INTERVAL_MS || '300000', 10); // Default 5 menit

    console.log(`💚 [WhatsApp Keep-Alive] Starting (interval: ${KEEP_ALIVE_INTERVAL_MS}ms)`);

    const keepAliveInterval = setInterval(async () => {
        try {
            if (!global.whatsappClient || !client) {
                console.warn('⚠️ [WhatsApp Keep-Alive] Client tidak tersedia, skip ping');
                return;
            }

            // Cek state connection
            if (client.getState) {
                const state = await client.getState();
                if (state === 'UNPAIRED' || state === 'LOGOUT' || state === 'DISCONNECTED') {
                    console.warn(`⚠️ [WhatsApp Keep-Alive] State tidak sehat: ${state}, trigger reconnect...`);
                    clearInterval(keepAliveInterval);
                    await reconnectWhatsApp();
                    return;
                }
            }

            // Ping sederhana: coba get profile picture atau check connection
            if (client.getHostDevice) {
                await client.getHostDevice();
                console.log('💚 [WhatsApp Keep-Alive] Connection active');
            } else if (client.getConnectionState) {
                const connState = await client.getConnectionState();
                if (connState === 'close' || connState === 'close') {
                    console.warn('⚠️ [WhatsApp Keep-Alive] Connection closed, trigger reconnect...');
                    clearInterval(keepAliveInterval);
                    await reconnectWhatsApp();
                }
            }

        } catch (error) {
            console.warn(`⚠️ [WhatsApp Keep-Alive] Error: ${error.message}`);
            // Jika error karena disconnected, trigger reconnect
            if (error.message && (error.message.includes('not connected') || error.message.includes('closed'))) {
                console.warn('🔄 [WhatsApp Keep-Alive] Connection lost, trigger reconnect...');
                clearInterval(keepAliveInterval);
                await reconnectWhatsApp();
            }
        }
    }, KEEP_ALIVE_INTERVAL_MS);

    // Cleanup saat shutdown
    process.on('SIGINT', () => {
        clearInterval(keepAliveInterval);
    });

    process.on('SIGTERM', () => {
        clearInterval(keepAliveInterval);
    });
}

// Keep-alive mechanism: periodic ping ke health endpoint sendiri
// Mencegah server idle timeout saat tidak ada aktivitas
function startKeepAlive() {
    const KEEP_ALIVE_INTERVAL_MS = parseInt(process.env.KEEP_ALIVE_INTERVAL_MS || '300000', 10); // Default 5 menit
    const KEEP_ALIVE_URL = process.env.KEEP_ALIVE_URL || `http://localhost:${PORT}/ping`;

    console.log(`🔄 [Keep-Alive] Starting keep-alive mechanism (interval: ${KEEP_ALIVE_INTERVAL_MS}ms)`);

    // Helper untuk fetch dengan timeout
    const fetchWithTimeout = (url, timeoutMs = 5000) => {
        return Promise.race([
            fetch(url),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
            )
        ]);
    };

    const keepAliveInterval = setInterval(async () => {
        try {
            const response = await fetchWithTimeout(KEEP_ALIVE_URL, 5000);

            if (response.ok) {
                const data = await response.json();
                console.log(`💚 [Keep-Alive] Server active - ${new Date().toISOString()}`);
            } else {
                console.warn(`⚠️ [Keep-Alive] Health check returned status ${response.status}`);
            }
        } catch (error) {
            // Jangan log error terlalu sering, bisa spam log
            const now = Date.now();
            if (!keepAliveInterval.lastErrorTime || (now - keepAliveInterval.lastErrorTime) > 60000) {
                console.warn(`⚠️ [Keep-Alive] Failed to ping server: ${error.message}`);
                keepAliveInterval.lastErrorTime = now;
            }
        }
    }, KEEP_ALIVE_INTERVAL_MS);

    // Cleanup saat shutdown
    process.on('SIGINT', () => {
        clearInterval(keepAliveInterval);
    });

    process.on('SIGTERM', () => {
        clearInterval(keepAliveInterval);
    });

    // Ping pertama langsung setelah startup
    setTimeout(async () => {
        try {
            await fetchWithTimeout(KEEP_ALIVE_URL, 5000);
            console.log(`💚 [Keep-Alive] Initial ping successful`);
        } catch (error) {
            console.warn(`⚠️ [Keep-Alive] Initial ping failed: ${error.message}`);
        }
    }, 10000); // Tunggu 10 detik setelah startup
}

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('👋 Shutting down gracefully...');
    if (global.whatsappClient) {
        if (typeof global.whatsappClient.__debounceQueue?.flushAll === 'function') {
            global.whatsappClient.__debounceQueue.flushAll().catch(err => {
                console.error('[Shutdown] Gagal flush debounce queue:', err);
            });
        }
        global.whatsappClient.close();
    }
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('👋 Shutting down gracefully...');
    if (global.whatsappClient) {
        if (typeof global.whatsappClient.__debounceQueue?.flushAll === 'function') {
            global.whatsappClient.__debounceQueue.flushAll().catch(err => {
                console.error('[Shutdown] Gagal flush debounce queue:', err);
            });
        }
        global.whatsappClient.close();
    }
    process.exit(0);
});

module.exports = { getAIResponse };