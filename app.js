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
const { requireAuth } = require('./src/middleware/auth.js');
const prisma = require('./src/lib/prisma');
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
const { startFollowUpScheduler, updateSignalsOnIncomingMessage } = require('./src/ai/agents/followUpEngine/index.js');
const { isSnoozeActive, setSnoozeMode, clearSnoozeMode, getSnoozeInfo } = require('./src/ai/utils/humanHandover.js');
const { handleAdminHpMessage, markBotMessage } = require('./src/ai/utils/adminMessageSync.js');
const { backfillAdminMessages } = require('./scripts/backfillAdminMessages.js');
const { backfillProfilePics } = require('./scripts/backfillProfilePics.js');
const { getLangSmithCallbacks } = require('./src/ai/utils/langsmith.js');
const { saveCustomerLocation } = require('./src/ai/utils/customerLocations.js');
const { parseSenderIdentity } = require('./src/lib/utils.js');
const { getState } = require('./src/ai/utils/conversationState.js');
const { extractAndSaveContext } = require('./src/ai/agents/contextExtractor.js');
const { classifyAndSaveCustomer } = require('./src/ai/agents/customerClassifier.js');
const { startAudit, handleAuditResponse, handleResumeAudit, hasActiveSession } = require('./src/ai/agents/customerAudit.js');
const { getCustomerContext, normalizePhone, syncGraphStateToCRM } = require('./src/ai/utils/mergeCustomerContext.js');
const masterLayanan = require('./src/data/masterLayanan.js');
const daftarUkuranMotor = require('./src/data/daftarUkuranMotor.js');
const { repaintBodiHalus } = require('./src/data/repaintPrices.js');
const { getActivePromo } = require('./src/ai/utils/promoConfig.js');
const { getSpecificPriceContext } = require('./src/ai/utils/priceCalculator.js');
const browserUtils = require('./src/ai/utils/browser.js');

// --- LangGraph Integration ---
const { zoyaAgent } = require('./src/ai/graph/index.js');

// --- Global Constants ---
const ACTIVE_AI_MODEL = process.env.AI_MODEL || 'gemini-flash-lite-latest';
const DEBOUNCE_DELAY_MS = 10000;
const ACTIVE_VISION_MODEL = process.env.VISION_MODEL || 'gemini-1.5-flash';
const MEMORY_CONFIG = {
    maxMessages: parseInt(process.env.MEMORY_MAX_MESSAGES) || 20,
    maxAgeHours: parseInt(process.env.MEMORY_MAX_AGE_HOURS) || 24,
};

// Centralized Browser Config
const CHROMIUM_PATH = browserUtils.getChromiumPath();
const PUPPETEER_CHROME_ARGS = browserUtils.DEFAULT_CHROME_ARGS;
const PUPPETEER_VIEWPORT = { width: 1280, height: 800 };

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 4000;

// Enable HTTP keep-alive untuk mencegah connection timeout
server.keepAliveTimeout = 65000; // 65 detik (default 5 detik terlalu pendek)
server.headersTimeout = 66000; // Harus lebih besar dari keepAliveTimeout
server.maxConnections = 1000;

// Middleware
app.use(helmet());

// CORS: Restrict to known origins (was: wildcard *)
const allowedOrigins = [
    'https://bosmatstudioadmin.vercel.app',
    'http://localhost:3000',
    'http://localhost:3001',
];
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, webhooks)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        console.warn(`[CORS] Blocked origin: ${origin}`);
        return callback(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
}));

app.use(morgan('combined'));
app.use(express.json({ limit: '50mb' }));

// Rate Limiting: Protect sensitive endpoints from abuse
let rateLimit;
try {
    rateLimit = require('express-rate-limit');
} catch (e) {
    console.warn('⚠️ [SECURITY] express-rate-limit not installed. Run: npm install express-rate-limit');
    rateLimit = null;
}

if (rateLimit) {
    // General API rate limit: 100 requests per minute
    const generalLimiter = rateLimit({ windowMs: 60 * 1000, max: 100 });
    // Strict limit for message-sending: 20 per minute
    const messageLimiter = rateLimit({ windowMs: 60 * 1000, max: 20 });
    // Very strict limit for AI test endpoint: 10 per minute
    const aiLimiter = rateLimit({ windowMs: 60 * 1000, max: 10 });

    app.use('/conversations', generalLimiter);
    app.use('/bookings', generalLimiter);
    app.use('/conversation-history', generalLimiter);
    app.use('/send-message', messageLimiter);
    app.use('/send-media', messageLimiter);
    app.use('/generate-invoice', messageLimiter);
    app.use('/test-ai', aiLimiter);
    console.log('🛡️ [SECURITY] Rate limiting enabled on sensitive endpoints');
}

// --- Utility Functions ---
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Database already initialized in src/lib/prisma
// const db = null; // Mark as null to find any remaining legacy usages

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

console.log(`🤖 [STARTUP] Model: ${process.env.AI_MODEL || 'gemini-flash-lite-latest'}`);
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

// ACTIVE_VISION_MODEL is defined at the top as a global constant
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

const SYSTEM_PROMPT = `[Role]
Kamu adalah Zoya, asisten Customer Service dan Konsultan Otomotif AI untuk Bosmat Repainting & Detailing Studio. Gaya bicaramu sangat ramah, asik, luwes, selayaknya teman ngobrol, dan tidak kaku. 

[Sapaan Penting]
- Gunakan kata ganti "aku" atau "saya" untuk menyebut diri sendiri. JANGAN menyebut namamu sendiri (seperti "Zoya bantu cek ya") karena itu terasa kaku.
- Tebak gender pelanggan dari namanya.
- Panggil dengan "Mas" untuk pelanggan pria.
- Panggil dengan "Kak" untuk pelanggan wanita atau jika kamu ragu/tidak yakin gendernya.
- JANGAN gunakan panggialn "Mbak" lagi. Gunakan "Kak" sebagai gantinya.

[Context & Goal]
Tujuanmu adalah membantu pelanggan menemukan layanan (repaint/detailing) yang pas, memberikan estimasi harga, dan membantu booking. Lakukan secara natural tanpa terkesan menginterogasi. 

[Formatting Rules - SANGAT PENTING]
WhatsApp tidak mendukung Markdown standar. Kamu WAJIB mengikuti aturan ini:
1. JANGAN gunakan double-asterisk (**tebal**) atau triple-asterisk. Gunakan SINGLE-ASTRERISK untuk tebal: *tebal*.
2. JANGAN gunakan underscore ganda (__miring__). Gunakan SINGLE-UNDERSCORE untuk miring: _miring_.
3. JANGAN gunakan Markdown heading (# Judul). Gunakan HURUF KAPITAL saja untuk penekanan judul/poin.
4. WAJIB gunakan DOUBLE NEWLINE (jarak dua baris) di antara SETIAP kalimat atau poin pemikiran baru agar chat terasa lega dan mudah dibaca di layar HP yang sempit.
5. JANGAN menulis teks dalam satu paragraf gumpalan panjang. Pecah menjadi kalimat-kalimat pendek yang terpisah jarak.

[Guidelines & Flow]
Ajak ngobrol pelanggan (gaya "ping pong") untuk menggali informasi: Kategori, Tipe Motor, dan Detail teknis.

[CRITICAL: Tool Usage]
Kamu HARUS sangat proaktif dalam menggunakan tool!
- Panggil \`getServiceDetails\` kapan pun pelanggan butuh estimasi biaya/harga. JANGAN menebak harga sendiri.
- Gunakan \`checkBookingAvailability\` jika ada indikasi pelanggan ingin jadwal.

[PROMOSI & UPSELLING - WAJIB!]
Tawarkan promo aktif secara natural. Jika Repaint, tawarkan Cuci Komplit. Jika Detailing, tawarkan Coating Ceramic.
  3. JIKA LECET PARAH (lebih dari 2 panel): WAJIB sarankan *Repaint Full Bodi Halus* ketimbang spot repair karena hasil lebih rata dan jatuhnya lebih murah dibanding ngecer per spot.

[Specifics]
- Analisis Foto Baret (Spot Repair): Jelaskan kerusakan yang kamu lihat. Infokan "Harga *spot repair* mulai dari *Rp75.000 - Rp150.000 per titik*".
- Tulis nominal harga dari tool dengan jelas, gunakan simbol bintang (*harga*) jika perlu penekanan tebal ala WhatsApp.
- Balas singkat, gaul, natural ala teman chat (jangan yapping kepanjangan).
- Escalation: Jika pelanggan marah/komplain berat, gunakan tool \`triggerBosMat\`.

[CRITICAL: Broad vs Specific Services]
- JANGAN langsung panggil \`getServiceDetails\` jika pelanggan hanya menyebutkan kategori umum (seperti 'Detailing', 'Coating', 'Repaint') tanpa menyebutkan paket spesifiknya.
- Kamu WAJIB bertanya dulu: "Mau paket [Kategori] mana yang Mas cari?" (contoh: "Mau Detailing Mesin atau Full Detailing bodi?") atau tanyakan kondisi motornya (kusam, banyak jamur, atau kerak oli).
- Hanya panggil tool jika nama layanan sudah spesifik.

[CONTEKAN PRODUK (CHEAT SHEET) - Gunakan untuk menjawab pertanyaan teknis secara singkat]
* REPAINT BODI HALUS: Cat ulang bodi utama motor pakai bahan premium (PU & HS) hasil mulus pabrikan. Bisa request warna standar atau spesial (Candy/Bunglon ada tambahan harga).
* REPAINT BODI KASAR: Hitamkan lagi dek/bodi kasar yang kusam pakai cat khusus tekstur (PP Primer).
* REPAINT VELG: Cat ulang sepasang velg (bebas request warna). Udah termasuk jasa bongkar pasang ban.
* REPAINT COVER CVT/ARM: Segarkan area mesin/arm pakai cat baru, harga flat Rp150.000.
* SPOT REPAIR: Solusi hemat buat baret ringan di 1-2 titik kecil. (Mulai Rp75rb-150rb/titik).
* DETAILING MESIN: Bersihin kerak oli dan kotoran membandel di mesin/crankcase. Roda belakang dilepas biar bersih maksimal.
* CUCI KOMPLIT: Cuci 'telanjang'. Bodi dilepas semua buat bersihin rangka terdalam dan mesin. Motor berasa baru keluar dealer.
* POLES BODI GLOSSY: Hilangin baret halus (jaring laba-laba) & kusam di bodi biar kilap aslinya balik, plus dilapis wax.
* FULL DETAILING (Glossy): Paket restorasi! Gabungan Cuci Komplit (sampai rangka) + Poles Bodi Glossy. Luar-dalam kinclong.
* COATING MOTOR (Doff/Glossy): Baju pelindung dari keramik (nano ceramic). Bikin cat anti-jamur, efek daun talas, dan awet tahunan. (Doff jadi pekat, Glossy jadi wet-look).
* COMPLETE SERVICE (Doff/Glossy): Paket Sultan! Gabungan Cuci Komplit + Coating Ceramic. Motor dibongkar total, dibersihkan sampai rangka, lalu dilapis keramik pelindung. Perawatan paling dewa!

[Examples]
User: "Halo Min, mau tanya repaint vespa lecet dikit berapa?"
Zoya: "Halo Mas! 

Kalau lecet dikit, bisa banget dibenerin pakai metode *spot repair* nih. 

Boleh kirim foto lecetnya dulu Mas, biar Zoya bisa cek estimasi harganya yang paling pas?"
`;

// --- Dynamic System Prompt Logic ---
let currentSystemPrompt = SYSTEM_PROMPT;

async function loadSystemPrompt() {
    try {
        const row = await prisma.keyValueStore.findUnique({
             where: { collection_key: { collection: 'settings', key: 'ai_config' } }
        });
        
        if (row && row.value && row.value.systemPrompt) {
            currentSystemPrompt = row.value.systemPrompt;
            console.log('✅ [CONFIG] Loaded custom System Prompt from SQL (KeyValueStore).');
        } else {
            console.log('ℹ️ [CONFIG] Using default hardcoded System Prompt.');
        }
    } catch (error) {
        console.error('❌ [CONFIG] Failed to load system prompt from SQL:', error.message);
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
4. Finance Integration:
   - Gunakan \`addTransaction\` untuk mencatat setiap pemasukan atau pengeluaran. Pastikan untuk menyertakan \`customerName\` jika transaksi terkait pelanggan agar otomatis terhubung ke CRM.
   - Gunakan \`getTransactionHistory\` untuk melihat riwayat transaksi.
   - Gunakan \`calculateFinances\` untuk mendapatkan laporan laba rugi atau analisis keuangan lainnya.
</instructions>

<tools>
\`readDirectMessages\`: Baca atau list chat.
\`sendMessage\`: Kirim pesan ke customer.
\`addTransaction\`: Catat pemasukan/pengeluaran. (Tips: Sertakan \`customerName\` agar otomatis link ke CRM).
\`getTransactionHistory\`: Cek riwayat keuangan.
\`calculateFinances\`: Laporan laba rugi.
\`generateDocument\`: Bikin PDF (Invoice, Tanda Terima).
\`crmManagement\`: Toolbox CRM (Summary, Profil, Follow-up, Notes).
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
const metaDebounceQueue = new DebounceQueue(DEBOUNCE_DELAY_MS, async (normalizedSenderId, queue) => {
    await processBufferedMetaMessages(normalizedSenderId, queue);
});

const pendingMessages = new Map();
const { getChromiumPath, DEFAULT_CHROME_ARGS } = require('./src/ai/utils/browser');

// PUPPETEER_VIEWPORT is handled by the browser utility at the top of the file.

// CHROMIUM_PATH and getChromiumPath are now handled by the browser utility at the top of the file.

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

// MEMORY_CONFIG is defined at the top as a global constant

// --- Memory Functions ---
async function getConversationHistory(senderNumber, limit = MEMORY_CONFIG.maxMessages) {
    const { docId } = parseSenderIdentity(senderNumber);
    if (!docId) return [];

    try {
        // Find canonical phone from database (handles @c.us vs @lid vs numeric)
        const customer = await prisma.customer.findFirst({
            where: {
                OR: [
                    { phone: docId },
                    { phone: { startsWith: senderNumber.toString().replace(/\D/g, '') } }
                ]
            },
            select: { phone: true }
        });

        const targetPhone = customer ? customer.phone : docId;

        // Fetch from DirectMessage table
        const messages = await prisma.directMessage.findMany({
            where: {
                customer: { phone: targetPhone }
            },
            take: limit,
            orderBy: { createdAt: 'desc' }
        });

        // Map to expected internal AI format
        const formatted = messages.map(m => ({
            text: m.content,
            sender: m.role === 'assistant' ? 'ai' : m.role,
            timestamp: m.createdAt
        }));

        // Return in chronological order (oldest first)
        return formatted.reverse();
    } catch (error) {
        console.error('[Memory] Error fetching SQL conversation history:', error.message);
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


        // Cek apakah pengirim adalah admin (Untuk penentuan history & prompt)
        const adminNumbers = [
            process.env.BOSMAT_ADMIN_NUMBER,
            process.env.ADMIN_WHATSAPP_NUMBER
        ].filter(Boolean);

        /* normalize replaced by normalizePhone in mergeCustomerContext.js */
        const senderNormalized = normalizePhone(senderNumber);
        const isAdmin = adminNumbers.some(num => normalizePhone(num) === senderNormalized);

        // --- 4. FULL CONVERSATION HISTORY ---
        let conversationHistoryMessages = [];

        if (senderNumber && prisma) {
            console.log(`🧠 [AI_PROCESSING] Memuat histori percakapan lengkap...`);
            try {
                // Ambil 6 pesan untuk Admin, 10 pesan untuk Customer
                const historyLimit = isAdmin ? 6 : 10;
                const history = await getConversationHistory(senderNumber, historyLimit);

                if (history && history.length > 0) {
                    conversationHistoryMessages = buildLangChainHistory(history);
                    console.log(`🧠 [AI_PROCESSING] Berhasil memuat ${history.length} pesan terakhir untuk konteks`);
                }
            } catch (err) {
                console.warn(`⚠️ [AI_PROCESSING] Gagal mengambil history: ${err.message}`);
            }
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

        // isAdmin sudah dicek di awal fungsi

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

                // --- FAST IN-FLIGHT EXTRACTOR ---
                // Mengekstrak motor dan layanan langsung dari pesan saat ini secara instan (0 ms)
                // untuk mengatasi delay background context extractor (1-2s).
                customerCtx = customerCtx || {};
                customerCtx.target_services = customerCtx.target_services || [];
                try {
                    const { findMotorSize, findService } = require('./src/ai/utils/priceCalculator.js');
                    
                    // Pastikan input ke extractor adalah string
                    const extractInput = Array.isArray(humanMessageContent) 
                        ? humanMessageContent.find(c => c.type === 'text')?.text || ''
                        : humanMessageContent;

                    if (!customerCtx.motor_model && extractInput) {
                        const foundMotor = await findMotorSize(extractInput.toString());
                        if (foundMotor && foundMotor.modelName) {
                            customerCtx.motor_model = foundMotor.modelName;
                            console.log(`⚡ [FAST_EXTRACT] Motor terdeteksi saat ini: ${foundMotor.modelName}`);
                        }
                    }

                    // Multi-service fast extract
                    if (extractInput) {
                        const foundService = await findService(extractInput.toString());
                        if (foundService && foundService.name && !customerCtx.target_services.includes(foundService.name)) {
                            customerCtx.target_services.push(foundService.name);
                            console.log(`⚡ [FAST_EXTRACT] Layanan baru ditambahkan ke cart: ${foundService.name}`);
                        }
                    }
                } catch (err) {
                    console.warn('[FAST_EXTRACT] Failed:', err.message);
                }

                const parts = [];

                // Prioritas 1: customerContext (dari background extractor, lebih reliable)
                if (Object.keys(customerCtx).length > 0) {
                    if (customerCtx.conversation_summary) {
                        parts.push(`[RINGKASAN OBROLAN SEBELUMNYA]`);
                        parts.push(customerCtx.conversation_summary);
                        parts.push(`---------------------------`);
                    }

                    // Motor identity (with plate number)
                    if (customerCtx.motor_model) {
                        let motorInfo = `- Motor: ${customerCtx.motor_model}`;
                        if (customerCtx.motor_plate) {
                            motorInfo += ` (Plat: ${customerCtx.motor_plate})`;
                        }
                        parts.push(motorInfo);
                    }
                    if (customerCtx.motor_plate && !customerCtx.motor_model) {
                        parts.push(`- Plat Nomor: ${customerCtx.motor_plate}`);
                    }
                    if (customerCtx.motor_year) parts.push(`- Tahun motor: ${customerCtx.motor_year}`);
                    if (customerCtx.motor_color) parts.push(`- Warna motor: ${customerCtx.motor_color}`);
                    if (customerCtx.motor_condition) parts.push(`- Kondisi: ${customerCtx.motor_condition}`);

                    // Service needs
                    if (customerCtx.target_services?.length > 0) parts.push(`- Layanan diminati (Cart): ${customerCtx.target_services.join(', ')}`);
                    else if (customerCtx.target_service) parts.push(`- Layanan diminati: ${customerCtx.target_service}`);
                    if (customerCtx.service_detail) parts.push(`- Detail layanan: ${customerCtx.service_detail}`);
                    if (customerCtx.budget_signal) parts.push(`- Sinyal budget: ${customerCtx.budget_signal}`);

                    // Intent signals
                    if (customerCtx.detected_intents?.length > 0) parts.push(`- Intents terdeteksi: ${customerCtx.detected_intents.join(', ')}`);
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
                    const intents = customerCtx.detected_intents || [];
                    let actionDirective = "";
                    const m_model = customerCtx.motor_model || (state && state.motor_model);
                    const m_plate = customerCtx.motor_plate;
                    const t_services = (customerCtx.target_services?.length > 0) ? customerCtx.target_services : (customerCtx.target_service ? [customerCtx.target_service] : (state && state.target_service ? [state.target_service] : []));
                    const t_service_display = t_services.join(', ');

                    const m_cond = customerCtx.motor_condition;
                    const m_color = customerCtx.motor_color;
                    const isRepaint = t_services.some(s => s.toLowerCase().includes('repaint'));
                    const isRepaintVelg = t_services.some(s => s.toLowerCase().includes('velg'));
                    const isDetailing = t_services.some(s => s.toLowerCase().includes('detailing') || s.toLowerCase().includes('cuci'));

                    if (!m_model) {
                        actionDirective = `\n🎯 TARGET SAAT INI (KUALIFIKASI): Kamu belum tahu *jenis/tipe motor* user. Tanyakan tipe motornya secara natural, termasuk plat nomornya jika memungkinkan. JANGAN bahas harga atau jadwal dulu.`;
                    } else if (t_services.length === 0) {
                        actionDirective = `\n🎯 TARGET SAAT INI (KUALIFIKASI): Kamu sudah tahu motornya (${m_model}), tapi belum tahu *layanan yang dibutuhkan* (Repaint/Detailing/Coating). Tanyakan kebutuhannya apa.`;
                    } else if (isRepaint && !m_color) {
                        actionDirective = `\n🎯 TARGET SAAT INI (KONSULTASI WARNA): User butuh Repaint untuk ${m_model}. Tanyakan *warna yang diinginkan* (Standar/Candy/Stabilo/Bunglon/Chrome) karena ada biaya tambahan (surcharge) untuk warna spesial.`;
                    } else if (isRepaint && !m_cond) {
                        actionDirective = `\n🎯 TARGET SAAT INI (KONSULTASI KONDISI BODI): User butuh Repaint. Tanyakan *kondisi bodi saat ini* (apakah ada lecet parah, pecah, atau butuh repair bodi kasar) karena bisa ada biaya tambahan perbaikan.`;
                    } else if (isRepaintVelg && !customerCtx.upsell_offered && !customerCtx.quoted_services?.length) {
                        actionDirective = `\n🎯 TARGET SAAT INI (KONSULTASI KONDISI VELG): User butuh Repaint Velg. Tanyakan apakah velg *pernah dicat ulang* atau *banyak jamur/kerak*, karena ada biaya tambahan remover (+50rb s/d 100rb). Boleh juga tawarkan sekalian cat Behel/Arm (+50rb) atau CVT (+100rb).`;
                    } else if (isDetailing && !m_cond) {
                        actionDirective = `\n🎯 TARGET SAAT INI (KONSULTASI KONDISI MOTOR): User butuh Detailing/Cuci untuk ${m_model}. Tanyakan dulu *kondisi motornya saat ini* (apakah banyak kerak oli, jamur, kusam, atau sekadar kotor debu) supaya kamu bisa merekomendasikan paket Detailing yang paling pas.`;
                    } else if (intents.includes('tanya_teknis')) {
                        actionDirective = `\n🎯 TARGET SAAT INI (KONSULTASI TEKNIS): User bertanya seputar hal teknis otomotif/perawatan. Jawab pertanyaannya dengan luwes dan asik (seperti Sales Advisor). Selipkan promosi atau rekomendasi layanan Bosmat yang relevan dengan pertanyaannya jika memungkinkan.`;
                    } else if (!customerCtx.quoted_services || customerCtx.quoted_services.length === 0) {
                        actionDirective = `\n🎯 TARGET SAAT INI (KONSULTASI HARGA): Sebutkan rincian harga dari [HARGA SPESIFIK] secara TO THE POINT. Gunakan Bullet Points. JANGAN nulis paragraf panjang. Tanya ke user: "Mau pakai warna apa untuk repaint-nya?" dan "Ada lecet parah di bagian mana?"`;
                    } else if (!customerCtx.upsell_offered && !(customerCtx.detected_intents || []).includes('mulai_booking')) {
                        actionDirective = `\n🎯 TARGET SAAT INI (EDUKASI & UPSELL): Kamu sudah mengutip harga. Jelaskan kelebihan layanan ini dengan santai, lalu tawarkan *upsell ringan 1x* (misal: "sekalian cuci komplit rangka mumpung dibongkar mas?").`;
                    } else if (!customerCtx.preferred_day && !customerCtx.asked_availability) {
                        actionDirective = `\n🎯 TARGET SAAT INI (CLOSING): User sudah setuju dengan harga/promo. Giring perlahan untuk booking dengan bertanya "Rencana mau dikerjakan hari apa Mas/Kak?". JANGAN menanyakan nama lengkap, karena sudah ada di [USER IDENTITY]!`;
                    } else if (customerCtx.conversation_stage === 'closing') {
                        actionDirective = `\n🎯 TARGET SAAT INI (CLOSING FINAL): User sudah setuju jadwal. LANGSUNG panggil \`checkBookingAvailability\` atau \`createBooking\`. STOP tanya hal lain dan JANGAN tanya nama.`;
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

        // STEP 2: Hitung harga otomatis dari context pelanggan (CART-BASED)
        let specificPriceInjection = "";
        let cartServices = customerCtx?.target_services || (customerCtx?.target_service ? [customerCtx.target_service] : []);

        if (customerCtx && customerCtx.motor_model && cartServices.length > 0) {
            try {
                // --- 1. AUTO-CONVERT BUSINESS RULE ---
                // Pastikan semua layanan adalah string dan ada nilainya
                cartServices = cartServices.filter(s => typeof s === 'string' && s.length > 0);

                // Jika ada 'Repaint' di keranjang, OTOMATIS tambahkan/ubah Detailing jadi 'Cuci Komplit'
                const hasRepaint = cartServices.some(s => s.toLowerCase().includes('repaint'));
                if (hasRepaint) {
                    // Hapus 'Detailing' umum atau 'Detailing Mesin' agar tidak dobel
                    cartServices = cartServices.filter(s => !s.toLowerCase().includes('detailing'));

                    // Paksa masukkan 'Cuci Komplit'
                    if (!cartServices.includes('Cuci Komplit')) {
                        cartServices.push('Cuci Komplit');
                        console.log('🛠️ [BUSINESS RULE] Repaint detected, auto-adding Cuci Komplit');
                    }
                }

                // --- 2. DEDUPLIKASI & CLEANUP ---
                cartServices = [...new Set(cartServices)];

                // --- 3. HARGA & INSTRUKSI SINGKAT ---
                const { prompt: exactPricePrompt, isAmbiguous } = await getSpecificPriceContext(customerCtx.motor_model, cartServices.join(', '));
                
                // Save ambiguity state for tool routing later
                customerCtx._isPriceAmbiguous = isAmbiguous;

                if (exactPricePrompt) {
                    // Kita tambahkan instruksi 'SINGKAT' langsung di sini agar Agent 2 nggak cerewet
                    specificPriceInjection = `\n[HARGA SPESIFIK]:\n${exactPricePrompt}\n\n` +
                        `⚠️ INSTRUKSI PENTING: Balas dengan SINGKAT & PADAT (Max 3-4 kalimat). ` +
                        `Jangan yapping soal promo kepanjangan. Fokus beri tahu harga dan tanya konfirmasi warna/kondisi bodi.`;

                    console.log(`💰[PRICE_CALC] Harga otomatis dihitung (with business rules).`);
                } else if (isAmbiguous) {
                    console.log(`💰[PRICE_CALC] Ambigu (Kategori Umum) untuk: ${customerCtx.motor_model} + ${cartServices.join(', ')}. Menunggu klarifikasi.`);
                } else {
                    console.log(`💰[PRICE_CALC] Gagal hitung otomatis untuk: ${customerCtx.motor_model} + ${cartServices.join(', ')} → fallback ke tool`);
                }
            } catch (err) {
                console.warn('[PRICE_CALC] Error:', err.message);
            }
        }

        // Inject tanggal & waktu langsung ke prompt (hemat 1 tool call)
        const now = DateTime.now().setZone('Asia/Jakarta').setLocale('id');
        let dateTimePart = `\n\n[TIME_CONTEXT]\nSekarang adalah: ${now.toFormat("cccc, dd MMMM yyyy HH:mm")} WIB. Gunakan ini untuk memahami "hari ini", "besok", atau "minggu depan" secara akurat dalam percakapan.`;

        // Inject User Identity
        const identityPart = `\n\n[USER IDENTITY]\n- Nama Pengirim: ${senderName || 'Tidak Diketahui'}\n- Nomor WhatsApp: ${senderNumber || 'Tidak Diketahui'}\n(Sapa pelanggan dengan nama ini jika tersedia dan terlihat natural untuk sapaan awal).`;

        // Mengubah masterLayanan menjadi string katalog harga dasar untuk konteks AI
        let catalogContext = "";
        try {
            // Ambil promo aktif dari Firestore secara dinamis (satu-satunya sumber promo)
            const activePromo = await getActivePromo();
            if (activePromo) {
                // Sanitize: ganti **double asterisk** Markdown → *single asterisk* WhatsApp
                const sanitizedPromo = activePromo.replace(/\*\*([^*]+)\*\*/g, '*$1*');
                catalogContext = `\n\n[PROMO BULAN INI]\n${sanitizedPromo}\n(Tawarkan promo ini secara natural jika relevan).`;
            }
        } catch (err) {
            console.warn('[AI_PROCESSING] Gagal render catalogContext:', err.message);
        }

        // Optimasi: Hanya gunakan prompt sistem, konteks dari extractor (termasuk ringkasan terbaru),
        // CONDITIONAL HISTORY (hanya jika pesan pendek), dan pesan user saat ini.
        const messages = [
            new SystemMessage(effectiveSystemPrompt + dateTimePart + identityPart + memoryPart + catalogContext + specificPriceInjection),
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
                const intents = ctx?.detected_intents || [];

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
                // Deteksi intent tanya harga diperlebar
                const isAskingPrice =
                    msgLower.includes('harga') || msgLower.includes('biaya') ||
                    msgLower.includes('berapa') || msgLower.includes('brp') ||
                    msgLower.includes('kisaran') || msgLower.includes('ongkos') ||
                    msgLower.includes('budget') || (ctx && ctx.asked_price === true);

                const isAskingService =
                    msgLower.includes('jasa') || msgLower.includes('layanan') ||
                    msgLower.includes('repaint') || msgLower.includes('coating') || msgLower.includes('detailing');

                // Hanya bind getServiceDetails jika harga BELUM dihitung otomatis DAN TIDAK AMBIGU
                if (intents.length === 0 || intents.includes('tanya_harga') || intents.includes('tanya_layanan') || isAskingPrice || isAskingService) {
                    if (!specificPriceInjection && !ctx?._isPriceAmbiguous) {
                        routedTools.push(getServiceDetailsTool);
                    }
                }

                // 4. Onsite Service
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
        if (prisma) await saveMessageToPrisma(senderNumber, combinedMessage, 'user');
        return;
    }

    try {
        // Mark as read + start typing immediately (no artificial pre-delay)
        await client.sendSeen(senderNumber);
        await client.startTyping(senderNumber);
        const pipelineStart = Date.now();

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
                if (prisma) {
                    await saveMessageToPrisma(senderNumber, combinedMessage, 'user');
                    await saveMessageToPrisma(senderNumber, auditResponse, 'ai');
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
                if (prisma) {
                    await saveMessageToPrisma(senderNumber, combinedMessage, 'user');
                    await saveMessageToPrisma(senderNumber, auditResponse, 'ai');
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
                    if (prisma) {
                        await saveMessageToPrisma(senderNumber, combinedMessage, 'user');
                        await saveMessageToPrisma(senderNumber, auditResponse, 'ai');
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
        // --- PENTING: Ekstrak Context SEBELUM Minta AI Merespons ---
        let systemInstruction = '';

        // LANGGRAPH UNIFIED PIPELINE (Admin & Customer)
        try {
            console.log(`[LangGraph] Invoking ZoyaAgent for ${senderNumber} (${isAdmin ? 'ADMIN' : 'CUSTOMER'})...`);
            
            const { HumanMessage } = require('@langchain/core/messages');
            
            // Format input untuk Graph (Dukung Gambar/Media lewat content array)
            const messageContent = [];
            if (combinedMessage) {
                messageContent.push({ type: 'text', text: combinedMessage });
            }
            if (mediaItems && mediaItems.length > 0) {
                mediaItems.forEach(media => {
                    if (media.mimetype && media.buffer) {
                        messageContent.push({
                            type: 'image_url',
                            image_url: `data:${media.mimetype};base64,${media.buffer.toString('base64')}`
                        });
                    }
                });
            }
            if (messageContent.length === 0) {
                messageContent.push({ type: 'text', text: '[Pesan Kosong]' });
            }

            const input = {
                messages: [new HumanMessage({ content: messageContent })],
                metadata: {
                    phoneReal: senderNumber,
                    senderName: senderName,
                    mediaItems: mediaItems,
                    isAdmin: isAdmin // Extra flag for safety
                }
            };

            // Jalankan Graph dengan thread_id (senderNumber) untuk manajemen state persisten
            const result = await zoyaAgent.invoke(input, {
                configurable: { thread_id: senderNumber }
            });

            const lastMessage = result.messages[result.messages.length - 1];
            const aiResponse = lastMessage ? lastMessage.content : null;



            // Handle HUMAN_HANDOVER intent
            if (result.intent === 'HUMAN_HANDOVER') {
                console.log(`🚨 [LangGraph] Escalation detected for ${senderNumber}. Triggering Human Handover.`);
                await setSnoozeMode(senderNumber, 60, { reason: 'eskalasi_otomatis' });
                // Ensure CRM reflects latest state before handover
                if (!isAdmin) await syncGraphStateToCRM(senderNumber, result).catch(() => {});
                await triggerBosMatTool.implementation({
                    senderNumber: senderNumber,
                    reason: 'User meminta bantuan admin atau terdeteksi emosi tinggi.',
                    customerQuestion: combinedMessage
                });
                
                const finalReply = aiResponse || "Wah, pertanyaan Mas/Kak cukup teknis nih. Zoya panggilin Admin dulu ya biar dibantu langsung! 🙏";
                const targetNumber = toSenderNumberWithSuffix(senderNumber);
                markBotMessage(targetNumber, finalReply);
                await client.sendText(targetNumber, finalReply);
                
                if (prisma) {
                    await saveMessageToPrisma(senderNumber, combinedMessage, isAdmin ? 'admin' : 'user');
                    await saveMessageToPrisma(senderNumber, finalReply, 'ai');
                }
                await client.stopTyping(senderNumber);
                return;
            }

            // Normal Flow: Kirim balasan AI (OPTIMIZED: send first, save later)
            if (aiResponse) {
                const targetNumber = toSenderNumberWithSuffix(senderNumber);
                
                // Send to WhatsApp IMMEDIATELY (no artificial delay)
                markBotMessage(targetNumber, aiResponse.trim());
                await client.sendText(targetNumber, aiResponse.trim());
                console.log(`⚡ [PERF] Pipeline took ${Date.now() - pipelineStart}ms for ${senderNumber}`);

                // Fire & Forget: Save history + metadata AFTER sending
                if (prisma) {
                    Promise.all([
                        saveMessageToPrisma(senderNumber, combinedMessage, isAdmin ? 'admin' : 'user'),
                        saveMessageToPrisma(senderNumber, aiResponse, 'ai')
                    ]).catch(err => console.warn('[SaveMessage] Failed:', err.message));
                }

                if (!isAdmin) {
                    // Sync state to CRM BEFORE running classifier (so classifier sees extraction results)
                    await syncGraphStateToCRM(senderNumber, result).catch(err => console.warn(`[CRM-Bridge] Failed: ${err.message}`));
                    classifyAndSaveCustomer(senderNumber).catch(err => console.warn('[Classifier] Failed:', err.message));
                    updateSignalsOnIncomingMessage(senderNumber, combinedMessage).catch(err => console.warn('[SignalTracker] Failed:', err.message));
                }
            }

            await client.stopTyping(senderNumber);
            return; // Finished processing via LangGraph

        } catch (err) {
            console.error('[LangGraph] Error during agent execution:', err);
            await client.sendText(senderNumber, "Aduh Kak, Zoya lagi agak pusing dengerinnya. Bisa diulang pelan-pelan? 🙏");
            await client.stopTyping(senderNumber);
            return;
        }
    } catch (err) {
        console.error(`[ERROR] Handler error for ${senderNumber}:`, err);
        await client.stopTyping(senderNumber);
    }
}

/**
 * Process aggregated messages from Meta Messenger/Instagram
 * @param {string} normalizedSenderId - e.g. "instagram:123"
 * @param {Array} queue - Array of message objects from DebounceQueue
 */
async function processBufferedMetaMessages(normalizedSenderId, queue) {
    if (!queue || queue.length === 0) return;

    try {
        const firstEntry = queue[0];
        const { displayName, channel, senderId } = firstEntry;

        const messageParts = queue
            .map(m => (m.text || '').trim())
            .filter(part => part.length > 0);

        const combinedMessage = messageParts.join('\n').trim();
        if (!combinedMessage) return;

        console.log(`[MetaDebounce] 📥 Buffered message for ${displayName}: "${combinedMessage}"`);

        // Check for Snooze/Handover using normalized address
        if (await isSnoozeActive(normalizedSenderId)) {
            console.log(`[MetaDebounce] 👋 AI skipped for ${normalizedSenderId} (handover active).`);
            return;
        }

        // Invoke AI (which now uses LangGraph)
        const aiResult = await getAIResponse(combinedMessage, displayName, normalizedSenderId);
        const aiResponse = aiResult.content;

        if (aiResponse) {
            const { sendMetaMessage } = require('./src/server/metaClient.js');
            console.log(`[MetaDebounce] 📤 Outbound to ${channel}: "${aiResponse.substring(0, 50)}..."`);
            
            await sendMetaMessage(channel, senderId, aiResponse);
            
            if (typeof saveMessageToFirestore === 'function') {
                await saveMessageToFirestore(normalizedSenderId, aiResponse, 'ai');
            }
        }
    } catch (error) {
        console.error(`❌ [MetaDebounce] Error processing ${normalizedSenderId}:`, error);
    }
}

// --- WhatsApp Event Handlers ---
function start(client) {
    // 🛡️ ENHANCED SAFEGUARD FOR UI INTERACTIONS
    // Many @lid identifiers are now standard for WA Business.
    // We wrap these methods to prevent library-level crashes while attempting to interact.
    const wrapSafe = (originalMethod) => async (to, ...args) => {
        try {
            return await originalMethod(to, ...args);
        } catch (e) {
            if (to?.toString().endsWith('@lid')) {
                // Silently log and ignore failures for @lid to prevent cascading crashes
                console.warn(`[Safeguard] UI Interaction Failed for @lid (${to}): ${e.message}`);
            } else {
                throw e; // Rethrow for normal @c.us numbers
            }
        }
    };

    client.sendSeen = wrapSafe(client.sendSeen.bind(client));
    client.startTyping = wrapSafe(client.startTyping.bind(client));
    client.stopTyping = wrapSafe(client.stopTyping.bind(client));

    // Background Schedulers (Nurturing & Follow-up)
    const { startFollowUpScheduler } = require('./src/ai/agents/followUpEngine/index');
    startFollowUpScheduler();

    const debounceQueue = new DebounceQueue(DEBOUNCE_DELAY_MS, async (senderNumber) => {
        await processBufferedMessages(senderNumber, client);
    });
    client.__debounceQueue = debounceQueue;

    // --- META DEBOUNCE QUEUE ALREADY INITIALIZED AT TOP LEVEL ---

    client.onAnyMessage(async (msg) => {
        await handleAdminHpMessage(msg);
    });

    client.onMessage(async (msg) => {
        if (msg.from === 'status@broadcast' || msg.fromMe) {
            return;
        }

        let senderNumber = msg.from;
        let originalLid = senderNumber.endsWith('@lid') ? senderNumber : null;
        let realPhoneFallback = '';

        // Handle @lid (Linked Identity)
        if (senderNumber.endsWith('@lid')) {
            // LAYER 1 ONLY: Check from message object (passive, harmless)
            if (msg.sender && msg.sender.pnJid) {
                senderNumber = msg.sender.pnJid;
                console.log(`[LID] Resolved via pnJid: ${senderNumber}`);
            } else {
                console.log(`[LID] Unresolved LID accepted: ${senderNumber}. Proceeding with masked identity.`);
            }
        }

        // Standardize to 62...
        const { normalizePhone } = require('./src/ai/utils/mergeCustomerContext.js');
        const normalized = normalizePhone(senderNumber);
        
        if (normalized) {
            // Keep suffix only if normalized doesn't already have one
            senderNumber = normalized.includes('@') 
                ? normalized 
                : (senderNumber.includes('@') ? `${normalized}${senderNumber.substring(senderNumber.indexOf('@'))}` : `${normalized}@c.us`);
        } else if (originalLid) {
            // Unresolved lid, set fallback empty so AI can ask
            realPhoneFallback = '';
        }

        const senderName = msg.sender?.pushname || msg.sender?.name || msg.notifyName || senderNumber;
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

        // Mark coating reminders as replied
        const { markCoatingReminderAsReplied } = require('./src/ai/utils/coatingReminders');
        markCoatingReminderAsReplied(senderNumber).catch(e => console.error('[ReminderAck]', e.message));

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

            await saveMessageToPrisma(senderNumber, storedContent, 'user');
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

        /* normalize replaced by normalizePhone in mergeCustomerContext.js */
        const senderNormalized = normalizePhone(senderNumber);
        const isAdmin = adminNumbers.some(num => normalizePhone(num) === senderNormalized);

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

// --- Prisma Message Saving ---
async function saveMessageToPrisma(senderNumber, message, senderType) {
    const prisma = require('./src/lib/prisma');
    
    const { docId, channel, platformId, isLid } = parseSenderIdentity(senderNumber);
    if (!docId) return;

    try {
        const snoozeInfo = await getSnoozeInfo(senderNumber);

        const roleMap = {
            'user': 'user',
            'ai': 'assistant',
            'admin': 'admin',
        };

        // Try by phone first, then fallback to whatsappLid for @lid senders
        let customer = await prisma.customer.findUnique({
            where: { phone: docId }
        });

        if (!customer && isLid) {
            customer = await prisma.customer.findFirst({
                where: { whatsappLid: senderNumber }
            });
        }

        if (customer) {
            await prisma.directMessage.create({
                data: {
                    customerId: customer.id,
                    senderId: senderNumber,
                    role: roleMap[senderType] || 'user',
                    content: message,
                }
            });

            // Update customer data
            const updateData = {
                lastMessage: message,
                lastMessageAt: new Date(),
                aiPaused: snoozeInfo.active || false,
                aiPausedUntil: snoozeInfo.expiresAt ? new Date(snoozeInfo.expiresAt) : null,
                aiPauseReason: snoozeInfo.reason,
            };
            
            // If sender uses @lid format, save it to whatsappLid field
            if (senderNumber.endsWith('@lid')) {
                updateData.whatsappLid = senderNumber;
            }
            
            await prisma.customer.update({
                where: { id: customer.id },
                data: updateData
            });
        } else {
            console.warn(`[saveMessageToPrisma] ⚠️ Customer not found for ${docId}${isLid ? ` (LID: ${senderNumber})` : ''}. Message NOT saved.`);
        }
    } catch (error) {
        console.error('Error saving message to Prisma:', error);
    }
}

// Alias for backward compatibility
async function saveMessageToFirestore(senderNumber, message, senderType) {
    return saveMessageToPrisma(senderNumber, message, senderType);
}

const fetchedProfilePics = new Set(); // Keep track of numbers we already fetched DP for

async function saveSenderMeta(senderNumber, displayName, client = null) {
    const prisma = require('./src/lib/prisma');

    const { docId, channel, isLid, originalId } = parseSenderIdentity(senderNumber);
    if (!docId) return;

    let profilePicUrl = null;
    if (client && channel === 'whatsapp' && !isLid && !fetchedProfilePics.has(senderNumber)) {
        try {
            const picResult = await client.getProfilePicFromServer(senderNumber);
            // Extract URL string from the object returned by WhatsApp
            if (typeof picResult === 'string') {
                profilePicUrl = picResult;
            } else if (picResult && typeof picResult === 'object') {
                profilePicUrl = picResult.eurl || picResult.imgFull || picResult.img || null;
            }
            fetchedProfilePics.add(senderNumber);
        } catch (error) {
            console.warn(`[ProfilePic] Gagal mengambil foto profil untuk ${senderNumber}:`, error.message);
        }
    }

    try {
        const snoozeInfo = await getSnoozeInfo(senderNumber);

        const customerData = {
            phone: docId,
            name: displayName || docId,
            profilePicUrl: profilePicUrl,
            aiPaused: snoozeInfo.active || false,
            aiPausedUntil: snoozeInfo.expiresAt ? new Date(snoozeInfo.expiresAt) : null,
            aiPauseReason: snoozeInfo.reason,
        };
        
        if (isLid) {
            customerData.whatsappLid = originalId;
        }

        const customer = await prisma.customer.upsert({
            where: { phone: docId },
            create: customerData,
            update: {
                name: displayName,
                profilePicUrl: profilePicUrl || undefined,
                whatsappLid: isLid ? originalId : undefined,
                aiPaused: snoozeInfo.active || false,
                aiPausedUntil: snoozeInfo.expiresAt ? new Date(snoozeInfo.expiresAt) : null,
                aiPauseReason: snoozeInfo.reason,
            }
        });

        console.log(`[Prisma] Sender meta saved for ${docId}:`, customer.id);
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
    try {
        const customers = await prisma.customer.findMany({
            take: limit,
            orderBy: { updatedAt: 'desc' },
            include: {
                messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 1
                },
                bookings: {
                    orderBy: { bookingDate: 'desc' },
                    take: 1,
                    select: {
                        id: true,
                        bookingDate: true,
                        serviceType: true,
                        status: true
                    }
                },
                customerContext: true,
                _count: { select: { bookings: true, messages: true } }
            }
        });

        const conversations = await Promise.all(customers.map(async (c) => {
            const lastMessage = c.messages[0];
            const lastBooking = c.bookings[0];
            const snoozeInfo = await getSnoozeInfo(c.phone);
            const context = c.customerContext;

            return {
                id: c.id,
                senderNumber: c.phone, // Already has suffix from DB
                name: c.name || null,
                lastMessage: lastMessage?.content || null,
                lastMessageSender: lastMessage?.role || null,
                lastMessageAt: lastMessage?.createdAt?.toISOString() || c.lastMessageAt?.toISOString() || c.updatedAt.toISOString(),
                updatedAt: c.updatedAt.toISOString(),
                messageCount: c._count.messages,
                channel: 'whatsapp',
                platformId: c.phone,
                aiPaused: c.aiPaused || snoozeInfo.active,

                aiPausedUntil: c.aiPausedUntil?.toISOString() || snoozeInfo.expiresAt,
                aiPausedManual: snoozeInfo.manual,
                aiPausedReason: snoozeInfo.reason,
                label: context?.customerLabel || null,
                labelReason: context?.labelReason || null,
                labelUpdatedAt: context?.updatedAt?.toISOString() || null,
                profilePicUrl: c.profilePicUrl || null,
            };
        }));

        conversations.sort((a, b) => {
            const timeA = a.lastMessageAt ? Date.parse(a.lastMessageAt) : (a.updatedAt ? Date.parse(a.updatedAt) : 0);
            const timeB = b.lastMessageAt ? Date.parse(b.lastMessageAt) : (b.updatedAt ? Date.parse(b.updatedAt) : 0);
            return timeB - timeA;
        });

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
    debounceQueue: metaDebounceQueue,
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
        model: process.env.AI_MODEL || 'gemini-flash-lite-latest',
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

app.get('/conversations', requireAuth, async (req, res) => {
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

// --- Invoice Generation & Send to Customer WA ---
app.post('/generate-invoice', requireAuth, async (req, res) => {
    try {
        const {
            documentType = 'invoice',
            customerName,
            customerPhone,
            motorDetails,
            items,
            totalAmount,
            amountPaid,
            paymentMethod,
            notes,
        } = req.body;

        if (!customerName || !customerPhone) {
            return res.status(400).json({ error: 'customerName and customerPhone are required.' });
        }

        // Normalize customer phone to WA format - preserve @lid suffix if present
        let recipientNumber = customerPhone;
        
        // Check if customer has whatsappLid in database
        const prisma = require('./src/lib/prisma');
        const normalizedPhone = customerPhone.replace(/[^0-9]/g, '');
        const customer = await prisma.customer.findFirst({
            where: {
                OR: [
                    { phone: normalizedPhone },
                    { whatsappLid: customerPhone },
                    { whatsappLid: { endsWith: customerPhone } }
                ]
            },
            select: { whatsappLid: true, phone: true }
        });
        
        if (customer && customer.whatsappLid) {
            // Use the stored LID format
            recipientNumber = customer.whatsappLid;
            console.log(`[API] Using stored whatsappLid: ${recipientNumber}`);
        } else if (recipientNumber.endsWith('@lid')) {
            // Keep LID format as-is
            console.log(`[API] Using customer LID: ${recipientNumber}`);
        } else if (recipientNumber.endsWith('@c.us')) {
            // Keep c.us format
            console.log(`[API] Using customer phone: ${recipientNumber}`);
        } else {
            // Extract digits and add @c.us
            recipientNumber = recipientNumber.replace(/\D/g, '');
            if (recipientNumber.length > 0) {
                recipientNumber = `${recipientNumber}@c.us`;
            }
            console.log(`[API] Formatted customer phone: ${recipientNumber}`);
        }

        // Use admin number as senderNumber (for auth check)
        const adminNumber = process.env.BOSMAT_ADMIN_NUMBER || process.env.ADMIN_WHATSAPP_NUMBER || process.env.ADMIN_NUMBER || '628179481010';
        let adminSender = adminNumber.replace(/\D/g, '');
        if (!adminSender.endsWith('@c.us')) {
            adminSender = `${adminSender}@c.us`;
        }

        const result = await generateDocumentTool.implementation({
            documentType,
            customerName,
            motorDetails: motorDetails || '-',
            items: items || '-',
            totalAmount: totalAmount || 0,
            amountPaid: amountPaid || 0,
            paymentMethod: paymentMethod || '-',
            notes: notes || '',
            senderNumber: adminSender,
            recipientNumber,
        });

        if (result.success) {
            console.log(`[API] Invoice (${documentType}) sent to customer: ${recipientNumber}`);
            return res.status(200).json({ success: true, message: result.message });
        }
    } catch (error) {
        console.error('[API] Error generating invoice:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/send-message', requireAuth, async (req, res) => {
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

            let targetNumber = identity.normalizedAddress || toSenderNumberWithSuffix(number);
            
            // Active LID resolution has been disabled here to prevent mobile unpairing.
            if (targetNumber && targetNumber.endsWith('@lid')) {
                console.log(`[API] LID targeted for sending: ${targetNumber} (Resolution disabled)`);
            }
            
            // Ensure proper suffix for non-suffixed numbers (fallback)
            if (targetNumber && !targetNumber.includes('@')) {
                targetNumber = targetNumber + '@c.us';
            }

            
            console.log(`[API] Sending to: ${targetNumber}`);
            markBotMessage(targetNumber, finalMessage);
            
            try {
                await global.whatsappClient.sendText(targetNumber, finalMessage);
                console.log(`[API] Successfully sent WhatsApp message to ${targetNumber}`);
            } catch (sendError) {
                // If error with resolved number, try with original LID format
                if (sendError.message && sendError.message.includes('No LID')) {
                    const originalLid = number.includes('@lid') ? number : `${number.replace(/[^0-9]/g, '')}@lid`;
                    console.log(`[API] Send failed, trying original LID: ${originalLid}`);
                    try {
                        await global.whatsappClient.sendText(originalLid, finalMessage);
                        targetNumber = originalLid;
                        console.log(`[API] Success with original LID`);
                    } catch (e2) {
                        throw sendError;
                    }
                } else {
                    throw sendError;
                }
            }
            
            await saveMessageToPrisma(targetNumber, finalMessage, 'admin');
            return res.status(200).json({ success: true, channel: 'whatsapp', rewritten });
        }

        if (!platformId) {
            throw new Error(`Platform ID is required to send ${channel} messages.`);
        }

        await sendMetaMessage(channel, platformId, finalMessage, console);
        await saveMessageToPrisma(identity.docId, finalMessage, 'admin');
        console.log(`[API] Successfully sent ${channel} message to ${platformId}`);
        return res.status(200).json({ success: true, channel, rewritten });
    } catch (e) {
        console.error('[API] Error sending message:', e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/send-media', requireAuth, async (req, res) => {
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

app.post('/test-ai', requireAuth, async (req, res) => {
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
        if (effectiveSenderNumber && prisma) {
            await saveMessageToPrisma(effectiveSenderNumber, testMessage, 'user');
            if (response) {
                await saveMessageToPrisma(effectiveSenderNumber, response, 'ai');
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

app.get('/conversation-history/:number', requireAuth, async (req, res) => {
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

app.post('/conversation/:number/ai-state', requireAuth, async (req, res) => {
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

app.get('/bookings', requireAuth, async (req, res) => {
    try {
        const { start, end } = req.query;

        const where = {};
        if (start) {
            where.bookingDate = { ...where.bookingDate, gte: new Date(start) };
        }
        if (end) {
            where.bookingDate = { ...where.bookingDate, lte: new Date(end) };
        }

        const bookings = await prisma.booking.findMany({
            where,
            orderBy: { bookingDate: 'asc' },
            include: {
                customer: { select: { name: true, phone: true } },
                vehicle: { select: { modelName: true, plateNumber: true, color: true } }
            }
        });

        const transformedBookings = bookings.map(b => {
            let maxDurationMinutes = 0;
            let isRepaint = false;
            const serviceList = [b.serviceType];

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

            const durationDays = Math.ceil(maxDurationMinutes / 480) || 1;
            const { parseDateTime } = require('../utils/dateTime');
            let finalDate = b.bookingDate.toISOString().split('T')[0];
            let finalTime = b.bookingDate.toISOString().slice(11, 16);

            // Parse natural language if needed
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            const timeRegex = /^\d{2}:\d{2}$/;
            if (!dateRegex.test(finalDate) || !timeRegex.test(finalTime)) {
                const parsed = parseDateTime(`${finalDate} ${finalTime}`);
                if (parsed.date) finalDate = parsed.date;
                if (parsed.time) finalTime = parsed.time;
            }

            const dateTimeString = `${finalDate}T${finalTime}:00`;
            const bookingDateTime = new Date(dateTimeString);
            const startDate = new Date(b.bookingDate);
            const endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + (durationDays - 1));
            const estimatedEndDate = endDate.toISOString().split('T')[0];

            return {
                id: b.id,
                customerName: b.customerName || b.customer?.name,
                customerPhone: b.customerPhone || b.customer?.phone,
                vehicleInfo: b.vehicleModel ? `${b.vehicleModel}${b.plateNumber ? ' - ' + b.plateNumber : ''}` : b.vehicle?.modelName,
                services: [b.serviceType],
                serviceName: b.serviceType,
                bookingDate: b.bookingDate.toISOString().split('T')[0],
                bookingTime: b.bookingDate.toISOString().slice(11, 16),
                bookingDateTime: b.bookingDate,
                status: b.status.toLowerCase(),
                subtotal: b.subtotal,
                downPayment: b.downPayment,
                paymentMethod: b.paymentMethod,
                homeService: b.homeService,
                notes: b.notes,
                isRepaint,
                estimatedDurationDays: durationDays,
                estimatedEndDate,
                createdAt: b.createdAt.toISOString(),
                updatedAt: b.updatedAt.toISOString()
            };
        });

        res.json({ bookings: transformedBookings, status: 'success' });
    } catch (error) {
        console.error('[API] Error fetching bookings:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create manual booking
app.post('/bookings', requireAuth, async (req, res) => {
    try {
        const { createBookingTool } = require('./src/ai/tools/createBookingTool.js');
        const result = await createBookingTool.implementation(req.body);
        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        console.error('[API] Error creating manual booking:', error);
        res.status(500).json({ error: error.message });
    }
});


app.patch('/bookings/:id/status', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, notes } = req.body;

        if (!status) {
            return res.status(400).json({ error: 'Status is required' });
        }

        const booking = await prisma.booking.findUnique({ where: { id } });
        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        const updateData = {
            status: status.toUpperCase(),
            adminNotes: notes || booking.adminNotes,
        };

        const updated = await prisma.booking.update({
            where: { id },
            data: updateData,
            include: { customer: true }
        });

        // Update customer lastService if completed
        if (status.toUpperCase() === 'COMPLETED' && booking.status !== 'COMPLETED') {
            await prisma.customer.update({
                where: { id: booking.customerId },
                data: { lastService: booking.bookingDate }
            });
        }

        res.json({ success: true, id, status: updated.status.toLowerCase() });
    } catch (error) {
        console.error('[API] Error updating booking status:', error);
        res.status(500).json({ error: error.message });
    }
});

// --- Server Startup ---
server.listen(PORT, '0.0.0.0', async () => {
    console.log(`🚀 WhatsApp AI Chatbot listening on http://0.0.0.0:${PORT}`);
    
    // SQL triggers handled in-app via customerSync utility.

    console.log(`🤖 AI Provider: Google Gemini`);
    console.log(`🤖 AI Model: ${process.env.AI_MODEL || 'gemini-flash-lite-latest'}`);
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
        authTimeout: 300000, // Perpanjang ke 5 menit untuk VPS
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
            userDataDir: sessionDataPath,
            executablePath: CHROMIUM_PATH,
            args: PUPPETEER_CHROME_ARGS,
            ignoreHTTPSErrors: true,
            defaultViewport: PUPPETEER_VIEWPORT,
            timeout: 180000,
            protocolTimeout: 360000,
        },
        headless: whatsappHeadless,
        logQR: false,
        autoClose: shouldAutoClose ? 60000 : 0, // 0 to disable auto close
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

            if (process.env.RUN_PROFILE_PIC_BACKFILL === 'true') {
                console.log('🖼️  [Backfill] Starting profile picture backfill...');
                backfillProfilePics(client)
                    .then(() => console.log('✅ [Backfill] Profile picture backfill complete'))
                    .catch(err => console.error('❌ [Backfill] Profile pic backfill failed:', err.message))
                    .finally(() => {
                        console.log('💡 [Backfill] Set RUN_PROFILE_PIC_BACKFILL=false to disable');
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
                executablePath: CHROMIUM_PATH,
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
    const KEEP_ALIVE_URL = process.env.KEEP_ALIVE_URL || `http://127.0.0.1:${PORT}/ping`;

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