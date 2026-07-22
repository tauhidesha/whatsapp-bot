/**
 * WhatsApp AI Chatbot dengan LangChain dan Gemini
 * Arsitektur JavaScript yang konsisten
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { DateTime } = require('luxon');
const { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, downloadMediaMessage } = require('@whiskeysockets/baileys');
const pino = require('pino');
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
const { extractTextFromContent } = require('./src/ai/graph/utils/sanitizeMessages.js');
const { classifyAndSaveCustomer } = require('./src/ai/agents/customerClassifier.js');
const { getCustomerContext, normalizePhone, syncGraphStateToCRM } = require('./src/ai/utils/mergeCustomerContext.js');
const masterLayanan = require('./src/data/masterLayanan.js');
const daftarUkuranMotor = require('./src/data/daftarUkuranMotor.js');
const { repaintBodiHalus } = require('./src/data/repaintPrices.js');
const { getActivePromo } = require('./src/ai/utils/promoConfig.js');
const { getSpecificPriceContext } = require('./src/ai/utils/priceCalculator.js');
const browserUtils = require('./src/ai/utils/browser.js');

// --- LangGraph Integration ---
const { zoyaAgent, checkpointer } = require('./src/ai/graph/index.js');
const { autoLabelCustomers } = require('./src/ai/agents/customerAudit.js');

// --- Global Constants ---
const ACTIVE_AI_MODEL = process.env.AI_MODEL || 'gemini-flash-lite-latest';
const DEBOUNCE_DELAY_MS = parseInt(process.env.DEBOUNCE_DELAY_MS, 10) || 10000;
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
    'https://admin-ui-bosmat.vercel.app',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173',
    'http://localhost:5174',
    process.env.LANDING_PAGE_ORIGIN,
].filter(Boolean);
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

// Trust proxy: app runs behind a reverse proxy (nginx/GCP LB).
// Required for express-rate-limit to correctly read X-Forwarded-For.
// '1' = trust exactly one hop upstream (the direct proxy).
app.set('trust proxy', 1);

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

    // Public endpoints: stricter rate limit (30 req/min per IP)
    const publicLimiter = rateLimit({ windowMs: 60 * 1000, max: 30 });
    app.use('/public', publicLimiter);

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
Kamu adalah Zoya, asisten Customer Service dan Konsultan Otomotif AI untuk Bosmat Repaint Detailing Studio. Gaya bicaramu sangat ramah, asik, luwes, selayaknya teman ngobrol, dan tidak kaku. 

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
const ADMIN_MESSAGE_REWRITE_STYLE_PROMPT = `Kamu adalah Zoya, asisten Bosmat Repaint Detailing Studio yang ramah dan profesional.Tugasmu adalah menulis ulang pesan admin berikut agar gaya bahasa konsisten dengan gaya Zoya:
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
        'Anda adalah Zoya, asisten Bosmat Repaint Detailing Studio.',
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
        classifyAndSaveCustomer(senderNumber).catch(err => console.warn('[Classifier] Failed:', err.message));
        updateSignalsOnIncomingMessage(senderNumber, combinedMessage).catch(err => console.warn('[SignalTracker] Failed:', err.message));
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

        
        const isAiCustomerReplyEnabled = process.env.AI_CUSTOMER_REPLY_ENABLED !== 'false';
        if (!isAdmin && !isAiCustomerReplyEnabled) {
            console.log(`[DEBOUNCED] 🤖 AI customer reply disabled via ENV. Skipping AI generation for ${senderNumber}.`);
            // Still classify customer so follow-up engine can pick them up later
            classifyAndSaveCustomer(senderNumber).catch(err => console.warn('[Classifier] Failed:', err.message));
            await client.stopTyping(senderNumber);
            return;
        }

        // --- PENTING: Ekstrak Context SEBELUM Minta AI Merespons ---
        let systemInstruction = '';

        // LANGGRAPH UNIFIED PIPELINE (Admin & Customer)
        try {
            console.log(`[LangGraph] Invoking ZoyaAgent for ${senderNumber} (${isAdmin ? 'ADMIN' : 'CUSTOMER'})...`);
            
            const { HumanMessage, AIMessage } = require('@langchain/core/messages');
            
            const config = { configurable: { thread_id: senderNumber } };
            const currentState = await zoyaAgent.getState(config);
            
            let messageList = [];
            let hydratedVehicle = null;
            let hydratedConsultation = null;
            
            // Hydrate memory if server restarted (MemorySaver is empty)
            if (!currentState?.values?.messages || currentState.values.messages.length === 0) {
                console.log(`[LangGraph] State is empty for ${senderNumber}. Hydrating from DB...`);
                try {
                    const prisma = require('./src/lib/prisma');
                    
                    const { normalizedAddress } = parseSenderIdentity(senderNumber);
                    
                    const existingCustomer = await prisma.customer.findFirst({
                        where: {
                            OR: [
                                { phone: senderNumber },
                                { whatsappLid: senderNumber },
                                { phone: normalizedAddress },
                                { whatsappLid: normalizedAddress }
                            ]
                        }
                    });
                    
                    if (existingCustomer) {
                        const history = await prisma.directMessage.findMany({
                            where: { customerId: existingCustomer.id },
                            orderBy: { createdAt: 'desc' },
                            take: 10
                        });
                        history.reverse().forEach(msg => {
                            if (msg.role === 'user') messageList.push(new HumanMessage({ content: msg.content }));
                            if (msg.role === 'ai' || msg.role === 'system') messageList.push(new AIMessage({ content: msg.content }));
                        });
                        console.log(`[LangGraph] Hydrated ${history.length} messages.`);
                    }

                    // Hydrate V2 State from CustomerContext
                    const { getCustomerContext } = require('./src/ai/utils/mergeCustomerContext.js');
                    const crmContext = await getCustomerContext(senderNumber);
                    if (crmContext) {
                        hydratedVehicle = {
                            brand: crmContext.motor_model || null,
                            paintType: crmContext.paint_type || crmContext.motor_color || null
                        };
                        hydratedConsultation = {
                            requestedServices: crmContext.target_services || [],
                            knownFacts: {
                                commonObjection: crmContext.budget_signal || crmContext.said_expensive ? 'mahal' : null
                            }
                        };
                        console.log(`[LangGraph] Hydrated vehicle & consultation state from CRM.`);
                    }
                } catch (e) {
                    console.error('[LangGraph] Failed to hydrate messages/context:', e);
                }
            }
            
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

            messageList.push(new HumanMessage({ content: messageContent }));

            const input = {
                messages: messageList,
                metadata: {
                    phoneReal: senderNumber,
                    senderName: senderName,
                    mediaItems: mediaItems,
                    isAdmin: isAdmin // Extra flag for safety
                }
            };

            if (hydratedVehicle) input.vehicle = hydratedVehicle;
            if (hydratedConsultation) input.consultation = hydratedConsultation;

            // Jalankan Graph dengan thread_id (senderNumber) secara streaming (Asynchronous WhatsApp Send)
            let aiResponse = null;
            let result = null;
            let hasSentWA = false;
            let finalReply = null;

            const stream = await zoyaAgent.stream(input, {
                configurable: { thread_id: senderNumber },
                streamMode: "updates"
            });

            for await (const chunk of stream) {
                const nodeName = Object.keys(chunk)[0];
                const nodeState = chunk[nodeName];

                if (nodeName === 'composerNode' && nodeState.messages && nodeState.messages.length > 0) {
                    const lastMessage = nodeState.messages[nodeState.messages.length - 1];
                    aiResponse = lastMessage ? extractTextFromContent(lastMessage.content ?? lastMessage.kwargs?.content) : null;

                    if (aiResponse && nodeState.intent !== 'HUMAN_HANDOVER' && !hasSentWA) {
                        hasSentWA = true;
                        
                        let responseText = '';
                        if (typeof aiResponse === 'string') {
                            responseText = aiResponse;
                        } else if (Array.isArray(aiResponse)) {
                            responseText = aiResponse
                                .map(c => typeof c === 'string' ? c : (c.text || ''))
                                .filter(Boolean)
                                .join('\n');
                        } else {
                            responseText = String(aiResponse || '');
                        }
                        
                        finalReply = responseText.trim();
                        const targetNumber = toSenderNumberWithSuffix(senderNumber);
                        
                        // Kirim balasan AI SECARA ASINKRON secepat mungkin! (AnalyticsNode akan jalan di background)
                        markBotMessage(targetNumber, finalReply);
                        client.sendText(targetNumber, finalReply).then(() => {
                            console.log(`⚡ [PERF] WA Message sent at ${Date.now() - pipelineStart}ms for ${senderNumber} (Before Analytics)`);
                            client.stopTyping(senderNumber).catch(() => {});
                        }).catch(err => console.error('[LangGraph WA Send] Error:', err));
                    }
                }
            }

            // Dapatkan state final yang terakumulasi
            const finalStateWrapper = await zoyaAgent.getState({ configurable: { thread_id: senderNumber } });
            result = finalStateWrapper.values;

            // Pastikan aiResponse tertangkap walau stream terlewat (misal cache)
            if (!aiResponse && result.messages && result.messages.length > 0) {
                const lastMessage = result.messages[result.messages.length - 1];
                aiResponse = lastMessage ? extractTextFromContent(lastMessage.content ?? lastMessage.kwargs?.content) : null;
            }



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
                
                // Pastikan format teks (fallback kalau stream tidak menangkap)
                let responseText = '';
                if (typeof aiResponse === 'string') {
                    responseText = aiResponse;
                } else if (Array.isArray(aiResponse)) {
                    responseText = aiResponse
                        .map(c => typeof c === 'string' ? c : (c.text || ''))
                        .filter(Boolean)
                        .join('\n');
                } else {
                    responseText = String(aiResponse || '');
                }
                
                finalReply = finalReply || responseText.trim();
                
                // Jika belum terkirim via stream, kirim sekarang
                if (!hasSentWA && result.intent !== 'HUMAN_HANDOVER') {
                    markBotMessage(targetNumber, finalReply);
                    await client.sendText(targetNumber, finalReply);
                    console.log(`⚡ [PERF] Pipeline took ${Date.now() - pipelineStart}ms for ${senderNumber}`);
                    hasSentWA = true;
                }

                // Fire & Forget: Save history + metadata AFTER sending
                if (prisma) {
                    Promise.all([
                        saveMessageToPrisma(senderNumber, combinedMessage, isAdmin ? 'admin' : 'user'),
                        saveMessageToPrisma(senderNumber, finalReply, 'ai')
                    ]).catch(err => console.warn('[SaveMessage] Failed:', err.message));
                }

                if (!isAdmin) {
                    // Sync state to CRM BEFORE running classifier (so classifier sees extraction results)
                    await syncGraphStateToCRM(senderNumber, result).catch(err => console.warn(`[CRM-Bridge] Failed: ${err.message}`));
                    classifyAndSaveCustomer(senderNumber).catch(err => console.warn('[Classifier] Failed:', err.message));
                    updateSignalsOnIncomingMessage(senderNumber, combinedMessage).catch(err => console.warn('[SignalTracker] Failed:', err.message));
                }
            }

            if (!hasSentWA) {
                await client.stopTyping(senderNumber);
            }
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

// --- WhatsApp Event Handlers ---
function start(client) {
    // 🛡️ ENHANCED SAFEGUARD FOR UI INTERACTIONS
    const wrapSafe = (originalMethod) => async (to, ...args) => {
        try {
            if (originalMethod) return await originalMethod(to, ...args);
        } catch (e) {
            if (to?.toString().endsWith('@lid')) {
                console.warn(`[Safeguard] UI Interaction Failed for @lid (${to}): ${e.message}`);
            } else {
                throw e;
            }
        }
    };

    // Polyfill for Baileys
    client.sendSeen = wrapSafe(async (to) => {
        // Usually handled automatically or via readMessages elsewhere
    });
    client.startTyping = wrapSafe(async (to) => {
        await client.sendPresenceUpdate('composing', to);
    });
    client.stopTyping = wrapSafe(async (to) => {
        await client.sendPresenceUpdate('paused', to);
    });
    client.sendText = wrapSafe(async (to, text) => {
        return await client.sendMessage(to, { text: text });
    });
    client.sendFile = wrapSafe(async (to, dataUri, filename, caption) => {
        let buffer;
        let mimetype;

        if (typeof dataUri === 'string' && dataUri.startsWith('data:')) {
            const match = dataUri.match(/^data:(.*?);base64,(.*)$/);
            if (!match) throw new Error('Invalid data URI format');
            mimetype = match[1];
            buffer = Buffer.from(match[2], 'base64');
        } else {
            // Assume it's a file path
            const fs = require('fs');
            const path = require('path');
            if (!fs.existsSync(dataUri)) {
                throw new Error('File not found or invalid data URI: ' + dataUri);
            }
            buffer = fs.readFileSync(dataUri);
            const ext = path.extname(dataUri).toLowerCase();
            if (ext === '.jpg' || ext === '.jpeg') mimetype = 'image/jpeg';
            else if (ext === '.png') mimetype = 'image/png';
            else if (ext === '.mp4') mimetype = 'video/mp4';
            else if (ext === '.pdf') mimetype = 'application/pdf';
            else mimetype = 'application/octet-stream';
        }

        const isImage = mimetype.startsWith('image/');
        const isVideo = mimetype.startsWith('video/');

        let msgPayload = { mimetype, fileName: filename };
        if (isImage) {
            msgPayload.image = buffer;
            if (caption) msgPayload.caption = caption;
        } else if (isVideo) {
            msgPayload.video = buffer;
            if (caption) msgPayload.caption = caption;
        } else {
            msgPayload.document = buffer;
            if (caption) msgPayload.caption = caption;
        }
        return await client.sendMessage(to, msgPayload);
    });
    client.close = () => {
        if (client.ws) client.ws.close();
    };

    // Background Schedulers (Nurturing & Follow-up)
    const { startFollowUpScheduler } = require('./src/ai/agents/followUpEngine/index');
    startFollowUpScheduler();

    const debounceQueue = new DebounceQueue(DEBOUNCE_DELAY_MS, async (senderNumber) => {
        await processBufferedMessages(senderNumber, client);
    });
    client.__debounceQueue = debounceQueue;

    // Baileys Message Event
    client.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const rawMsg of messages) {
            if (!rawMsg.message) continue;

            // Map Baileys msg to WPPConnect msg format
            const senderJid = rawMsg.key.remoteJid;
            const fromMe = rawMsg.key.fromMe;

            let msgType = 'chat';
            let body = rawMsg.message?.conversation || rawMsg.message?.extendedTextMessage?.text || '';
            let caption = '';
            let lat, lng, loc, address;

            if (rawMsg.message?.imageMessage) {
                msgType = 'image';
                caption = rawMsg.message.imageMessage.caption || '';
            } else if (rawMsg.message?.videoMessage) {
                msgType = 'video';
                caption = rawMsg.message.videoMessage.caption || '';
            } else if (rawMsg.message?.documentMessage) {
                msgType = 'document';
            } else if (rawMsg.message?.locationMessage) {
                msgType = 'location';
                lat = rawMsg.message.locationMessage.degreesLatitude;
                lng = rawMsg.message.locationMessage.degreesLongitude;
                loc = rawMsg.message.locationMessage.name;
                address = rawMsg.message.locationMessage.address;
            } else if (rawMsg.message?.templateButtonReplyMessage) {
                msgType = 'chat';
            }

            let quotedMsgObj = null;
            if (rawMsg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
                const quoted = rawMsg.message.extendedTextMessage.contextInfo.quotedMessage;
                quotedMsgObj = {
                    body: quoted.conversation || quoted.extendedTextMessage?.text || quoted.imageMessage?.caption || '',
                    fromMe: rawMsg.message.extendedTextMessage.contextInfo.participant === client.user?.id
                };
            }

            const contextInfo = rawMsg.message?.extendedTextMessage?.contextInfo || rawMsg.message?.imageMessage?.contextInfo || rawMsg.message?.videoMessage?.contextInfo || rawMsg.message?.contextInfo;
            const externalAdReply = contextInfo?.externalAdReply;
            let ctwaClid = externalAdReply?.ctwaClid || contextInfo?.ctwaClid || externalAdReply?.sourceId;

            if (!ctwaClid && contextInfo?.conversionData) {
                try {
                    ctwaClid = Buffer.isBuffer(contextInfo.conversionData) 
                        ? contextInfo.conversionData.toString('utf-8') 
                        : String(contextInfo.conversionData);
                } catch (e) {
                    console.error('[CTWA] Failed to parse conversionData', e);
                }
            }

            const msg = {
                from: senderJid,
                to: fromMe ? senderJid : 'me',
                fromMe: fromMe,
                type: msgType,
                body: body || caption,
                caption: caption,
                isMedia: ['image', 'video', 'document'].includes(msgType),
                lat: lat,
                lng: lng,
                loc: loc,
                address: address,
                sender: {
                    pushname: rawMsg.pushName || senderJid,
                    name: rawMsg.pushName || senderJid,
                    pnJid: senderJid
                },
                quotedMsgObj: quotedMsgObj,
                ctwaClid: ctwaClid || null,
                ctwaContext: externalAdReply ? {
                    sourceUrl: externalAdReply.sourceUrl,
                    displayText: externalAdReply.title || externalAdReply.body
                } : null,
                _raw: rawMsg // Save raw message for media decryption
            };

            await handleAdminHpMessage(msg);

            if (msg.from === 'status@broadcast' || msg.fromMe) {
                continue;
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

            // --- CAPTURE IG AD / QUOTED CONTEXT ---
            // When user clicks an IG Boost ad and sends a message via WhatsApp,
            // the ad context (post text, link) appears in quotedMsg/title/description
            // but msg.body only contains the user's typed text (e.g. "Halo! Bisakah saya...")
            // IMPORTANT: Filter out bot's own replies — when user uses WA "reply" feature,
            // quotedMsg contains the bot's previous message, NOT ad context.
            const quotedParts = [];

            // WPPConnect: quoted message body — only if NOT from bot itself
            const quotedMsg = msg.quotedMsg || msg.quotedMsgObj;
            if (quotedMsg?.body && !quotedMsg.fromMe) {
                quotedParts.push(quotedMsg.body);
            }

            // WPPConnect: link preview / external ad context (these are never bot replies)
            if (msg.title) quotedParts.push(msg.title);
            if (msg.description) quotedParts.push(msg.description);
            if (msg.matchedText) quotedParts.push(msg.matchedText);

            // Click-to-WhatsApp Ad context (ctwa) — definitive IG ad indicator
            if (msg.ctwaContext?.sourceUrl) {
                quotedParts.push(`[Ad Link: ${msg.ctwaContext.sourceUrl}]`);
            }
            if (msg.ctwaContext?.displayText) {
                quotedParts.push(msg.ctwaContext.displayText);
            }

            if (quotedParts.length > 0) {
                const quotedContext = [...new Set(quotedParts)].join('\n');
                console.log(`[BUFFER] 📢 IG/Ad context detected for ${senderName}: "${quotedContext.substring(0, 100)}..."`);
                messageContent = `[Konteks Iklan/Postingan yang dikutip user]\n${quotedContext}\n\n[Pesan User]\n${messageContent}`;
            }

            if (!messageContent && !isMedia && !isLocation) return;

            // Log different types of messages
            if (isLocation) {
                console.log(`[BUFFER] 📍 Location received from ${senderName}. Lat: ${msg.lat || msg.latitude}, Lng: ${msg.lng || msg.longitude}`);
            } else if (isImage || isVideo) {
                console.log(`[BUFFER] 📸/🎥 Media (${isImage ? 'Image' : 'Video'}) received from ${senderName}. Caption: "${msg.caption || 'No caption'}"`);
            } else if (isMedia) {
                console.log(`[BUFFER] 📎 Media received from ${senderName}. Type: ${msg.type}`);
            } else {
                console.log(`[BUFFER] 💬 Text received from ${senderName}: "${messageContent.substring(0, 120)}"`);
            }

            // Save sender metadata
            await saveSenderMeta(senderNumber, senderName, client, msg.ctwaClid);

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
                classifyAndSaveCustomer(senderNumber).catch(err => console.warn('[Classifier] Failed:', err.message));
                updateSignalsOnIncomingMessage(senderNumber, storedContent).catch(err => console.warn('[SignalTracker] Failed:', err.message));
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
                    const { downloadMediaMessage } = require('@whiskeysockets/baileys');
                    const pino = require('pino');
                    const mediaBuffer = await downloadMediaMessage(msg._raw, 'buffer', {}, { logger: pino({ level: 'silent' }) });
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

            // --- INSTANT SAVE ---
            const adminNumbers = [
                process.env.BOSMAT_ADMIN_NUMBER,
                process.env.ADMIN_WHATSAPP_NUMBER
            ].filter(Boolean);

            /* normalize replaced by normalizePhone in mergeCustomerContext.js */
            const senderNormalized = normalizePhone(senderNumber);
            const isAdmin = adminNumbers.some(num => normalizePhone(num) === senderNormalized);

            if (prisma) {
                const userRole = isAdmin ? 'admin' : 'user';
                // Fire & forget to save incoming message instantly so UI is updated realtime
                saveMessageToPrisma(senderNumber, messageEntry.content, userRole).catch(err => console.warn('[InstantSave] Failed:', err.message));
            }
            // --------------------

            entry.messages.push(messageEntry);
            pendingMessages.set(senderNumber, entry);

            if (isAdmin) {
                console.log(`[BUFFER] ⚡ Admin detected (${senderNumber}), skipping debounce buffer.`);
                await processBufferedMessages(senderNumber, client);
            } else {
                debounceQueue.schedule(senderNumber, messageEntry);
            }
        } // End of for (const rawMsg of messages)
    }); // End of client.ev.on('messages.upsert')

    // --- Handle Incoming Calls ---
    client.ev.on('call', async (calls) => {
        for (const call of calls) {
            if (call.status === 'offer') {
                console.log(`[CALL] Panggilan masuk dari ${call.from}`);
                try {
                    const message = "Waduh, maaf ya Mas, Zoya nggak bisa angkat telepon 😅.\n\nKetik aja pertanyaannya di sini, nanti Zoya bantu jawab kok! 👇";
                    markBotMessage(call.from, message);
                    await client.sendMessage(call.from, { text: message });
                } catch (e) {
                    console.error('[CALL] Error handling incoming call:', e);
                }
            }
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

        // Lookup: whatsappLid first, then phone
        const customer = await prisma.customer.findFirst({
            where: {
                OR: [
                    { whatsappLid: senderNumber },  // LID lookup first
                    { phone: docId },
                    { phone: senderNumber },
                ]
            }
        });

        // Ensure message is a string (filter out thinking/JSON blocks)
        let messageText = '';
        if (typeof message === 'string') {
            messageText = message;
        } else if (Array.isArray(message)) {
            // Only keep text content for DB/UI consistency
            messageText = message
                .map(c => typeof c === 'string' ? c : (c.text || ''))
                .filter(Boolean)
                .join('\n');
        } else if (typeof message === 'object' && message !== null) {
            // New: Handle object-based messages (e.g. from structured AI output)
            if (message.text && typeof message.text === 'string') {
                messageText = message.text;
            } else if (message.message && typeof message.message === 'string') {
                messageText = message.message;
            } else {
                // Safeguard against stringifying large media buffers or assigning nested objects
                messageText = JSON.stringify(message, (key, value) => {
                    if (value && value.type === 'Buffer') return '[Buffer]';
                    // also handle raw baileys message structure if accidentally passed
                    if (key === 'imageMessage' || key === 'videoMessage' || key === 'documentMessage') return '[Media]';
                    return value;
                });
            }
        } else {
            messageText = String(message || '');
        }

        if (customer) {
            const msgRole = roleMap[senderType] || 'user';
            await prisma.directMessage.create({
                data: {
                    customerId: customer.id,
                    senderId: senderNumber,
                    role: msgRole,
                    content: messageText,
                }
            });

            // Send Web Push Notification to Admins if it's from a user
            if (msgRole === 'user' && process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
                try {
                    const subscriptions = await prisma.pushSubscription.findMany();
                    const payload = JSON.stringify({
                        title: customer.name || senderNumber,
                        body: messageText,
                        url: '/conversations'
                    });
                    
                    const pushPromises = subscriptions.map(sub => {
                        const pushSub = {
                            endpoint: sub.endpoint,
                            keys: {
                                p256dh: sub.p256dh,
                                auth: sub.auth
                            }
                        };
                        return webpush.sendNotification(pushSub, payload).catch(err => {
                            if (err.statusCode === 404 || err.statusCode === 410) {
                                // Subscription has expired or is no longer valid
                                return prisma.pushSubscription.delete({ where: { id: sub.id } });
                            } else {
                                console.error('Push notification error:', err);
                            }
                        });
                    });
                    await Promise.all(pushPromises);
                } catch (pushErr) {
                    console.error('Error in sending web push:', pushErr);
                }
            }

            // Update customer data
            const updateData = {
                lastMessage: messageText,
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

// Export functions for other modules (like scheduler.js)
// Moved to the end of the file for unification (Line 4002+)

const fetchedProfilePics = new Set(); // Keep track of numbers we already fetched DP for

async function saveSenderMeta(senderNumber, displayName, client = null, ctwaClid = null) {
    const prisma = require('./src/lib/prisma');

    const { docId, channel, isLid, originalId } = parseSenderIdentity(senderNumber);
    if (!docId) return;

    // NEW: Jika @lid, cek apakah sudah ter-mapping ke customer existing
    if (isLid) {
        const existingByLid = await prisma.customer.findFirst({
            where: { whatsappLid: senderNumber }
        });
        if (existingByLid) {
            // Sudah ada mapping, update metadata saja tanpa buat customer baru
            await prisma.customer.update({
                where: { id: existingByLid.id },
                data: {
                    name: displayName || existingByLid.name,
                    lastMessageAt: new Date(),
                    ...(ctwaClid ? { ctwaClid } : {}),
                }
            });
            console.log(`[saveSenderMeta] LID ${senderNumber} matched existing customer ${existingByLid.phone}`);
            return;
        }
    }

    let profilePicUrl = null;
    if (client && channel === 'whatsapp' && !isLid && !fetchedProfilePics.has(senderNumber)) {
        try {
            const picResult = await client.profilePictureUrl(senderNumber, 'image');
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
            ...(ctwaClid ? { ctwaClid } : {}),
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
                ...(ctwaClid ? { ctwaClid } : {}),
                aiPaused: snoozeInfo.active || false,
                aiPausedUntil: snoozeInfo.expiresAt ? new Date(snoozeInfo.expiresAt) : null,
                aiPauseReason: snoozeInfo.reason,
            }
        });

        console.log(`[Prisma] Sender meta saved for ${docId}:`, customer.id, ctwaClid ? `(CTWA: ${ctwaClid})` : '');
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
// --- Admin Utility Routes ---
app.get('/trigger-scheduler-manual', async (req, res) => {
    // Basic secret key check via query param for safety
    const secret = req.query.secret;
    if (secret !== 'zoya-trigger-2024') {
        return res.status(401).send('Unauthorized. Please provide ?secret=...');
    }

    if (!global.whatsappClient) {
        return res.status(500).send('WhatsApp client is not ready yet.');
    }

    try {
        const { runDailyFollowUp } = require('./src/ai/agents/followUpEngine/scheduler.js');
        const limit = req.query.limit ? parseInt(req.query.limit) : 0; // Default limit 0 means all

        console.log(`[Manual-Trigger] Triggering scheduler for ${limit || 'ALL'} customers...`);

        // Run in background so request doesn't timeout
        runDailyFollowUp(false, limit).catch(err => console.error('[Manual-Trigger] Error:', err));

        res.json({
            status: 'success',
            message: 'Scheduler triggered in background',
            limitApplied: limit || 'ALL',
            note: 'Cek PM2 logs untuk melihat progres pengiriman.'
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// --- Health Check ---
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

// ─── PUBLIC API ENDPOINTS (Landing Page) ────────────────────────────
// No auth required. Rate limited (30 req/min per IP).
// In-memory cache to minimize DB hits.

const _publicCache = { vehicleModels: null, vehicleModelsAt: 0, services: null, servicesAt: 0 };
const PUBLIC_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// GET /public/vehicle-models?search=nmax
// Returns list of vehicle models for autocomplete
app.get('/public/vehicle-models', async (req, res) => {
    try {
        const now = Date.now();
        // Refresh cache if stale
        if (!_publicCache.vehicleModels || now - _publicCache.vehicleModelsAt > PUBLIC_CACHE_TTL) {
            _publicCache.vehicleModels = await prisma.vehicleModel.findMany({
                select: { id: true, brand: true, modelName: true, serviceSize: true, repaintSize: true, aliases: true },
                orderBy: { modelName: 'asc' },
            });
            _publicCache.vehicleModelsAt = now;
        }

        const search = (req.query.search || '').toString().trim().toLowerCase();
        let results = _publicCache.vehicleModels;

        if (search.length >= 2) {
            results = results.filter(m => {
                const nameMatch = m.modelName.toLowerCase().includes(search);
                const aliasMatch = (m.aliases || []).some(a => a.toLowerCase().includes(search));
                const brandMatch = m.brand.toLowerCase().includes(search);
                return nameMatch || aliasMatch || brandMatch;
            });
        }

        res.json({ success: true, models: results.slice(0, 20) });
    } catch (err) {
        console.error('[PUBLIC] vehicle-models error:', err.message);
        res.status(500).json({ success: false, error: 'Internal error' });
    }
});

// GET /public/pricing?motor=NMax&service=Complete+Service+Glossy
// Returns price for a specific motor + service combo
app.get('/public/pricing', async (req, res) => {
    try {
        const motorQuery = (req.query.motor || '').toString().trim();
        const serviceQuery = (req.query.service || '').toString().trim();

        if (!motorQuery || !serviceQuery) {
            return res.status(400).json({ success: false, error: 'motor and service params required' });
        }

        // Use the existing getServiceDetails tool implementation (reuse, don't duplicate)
        const result = await getServiceDetailsTool.implementation({
            service_name: serviceQuery,
            motor_model: motorQuery,
        });

        // Sanitize: only return pricing data, not internal details
        if (result.success && result.results) {
            // Multi-service response
            const sanitized = result.results.map(r => ({
                success: r.success,
                service_name: r.service_name || r.category,
                price: r.price,
                price_formatted: r.price_formatted,
                motor_model: r.motor_model,
                motor_size: r.motor_size,
                estimated_duration: r.estimated_duration,
                candidates: r.candidates,
                needs_clarification: r.needs_clarification,
                message: r.message,
            }));
            return res.json({ success: true, results: sanitized });
        }

        // Single service response
        return res.json({
            success: result.success,
            service_name: result.service_name,
            price: result.price,
            price_formatted: result.price_formatted,
            motor_model: result.motor_model,
            motor_size: result.motor_size,
            estimated_duration: result.estimated_duration,
            candidates: result.candidates,
            needs_clarification: result.needs_clarification,
            message: result.message,
        });
    } catch (err) {
        console.error('[PUBLIC] pricing error:', err.message);
        res.status(500).json({ success: false, error: 'Internal error' });
    }
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
            realPhone,
            motorDetails,
            items,
            totalAmount,
            amountPaid: bodyAmountPaid,
            paymentMethod,
            notes,
            serviceType,
            subtotal: bodySubtotal,
            discount: bodyDiscount,
            downPayment: bodyDownPayment,
        } = req.body;

        if (!customerName || !customerPhone) {
            return res.status(400).json({ error: 'customerName and customerPhone are required.' });
        }

        // Normalize customer phone to WA format - preserve @lid suffix if present
        let recipientNumber = customerPhone;

        // Fetch customer + latest booking dari DB sekaligus
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

        // ── Auto-fetch payment data dari booking terbaru ──
        let amountPaid = bodyAmountPaid || 0;
        let downPayment = bodyDownPayment || 0;
        let subtotal = bodySubtotal || 0;
        let discount = bodyDiscount || 0;

        if (amountPaid === 0 || downPayment === 0) {
            try {
                const latestBooking = await prisma.booking.findFirst({
                    where: {
                        OR: [
                            { customerPhone: normalizedPhone },
                            { customer: { phone: normalizedPhone } },
                        ]
                    },
                    orderBy: { bookingDate: 'desc' },
                    select: {
                        amountPaid: true,
                        downPayment: true,
                        subtotal: true,
                        discount: true,
                        totalAmount: true,
                    }
                });

                if (latestBooking) {
                    if (amountPaid === 0) amountPaid = latestBooking.amountPaid || 0;
                    if (downPayment === 0) downPayment = latestBooking.downPayment || 0;
                    if (subtotal === 0) subtotal = latestBooking.subtotal || latestBooking.totalAmount || 0;
                    if (discount === 0) discount = latestBooking.discount || 0;
                    console.log(`[API] Auto-fetched payment data: amountPaid=${amountPaid}, downPayment=${downPayment}, subtotal=${subtotal}, discount=${discount}`);
                }
            } catch (dbErr) {
                console.warn('[API] Failed to auto-fetch booking payment data:', dbErr.message);
            }
        }

        if (customer && customer.whatsappLid) {
            recipientNumber = customer.whatsappLid;
            console.log(`[API] Using stored whatsappLid: ${recipientNumber}`);
        } else if (recipientNumber.endsWith('@lid')) {
            console.log(`[API] Using customer LID: ${recipientNumber}`);
        } else if (recipientNumber.endsWith('@c.us')) {
            console.log(`[API] Using customer phone: ${recipientNumber}`);
        } else {
            recipientNumber = recipientNumber.replace(/\D/g, '');
            if (recipientNumber.length >= 14 && ['1', '2'].includes(recipientNumber[0])) {
                recipientNumber = `${recipientNumber}@lid`;
            } else if (recipientNumber.length > 0) {
                recipientNumber = `${recipientNumber}@c.us`;
            }
            console.log(`[API] Formatted customer phone: ${recipientNumber}`);
        }

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
            amountPaid,
            downPayment,
            paymentMethod: paymentMethod || '-',
            notes: notes || '',
            senderNumber: adminSender,
            recipientNumber,
            realPhone: realPhone || '',
            serviceType: serviceType || items || '-',
            subtotal,
            discount,
        });

        if (result.success) {
            console.log(`[API] Invoice (${documentType}) sent to customer: ${recipientNumber}`);

            // NEW: Fix 1 - Link LID to customer existing if applicable
            if (recipientNumber.endsWith('@lid')) {
                try {
                    const cleanPhone = (customerPhone || '').replace(/\D/g, '');
                    
                    // Cek apakah LID ini sudah dipakai di DB
                    const existingLid = await prisma.customer.findUnique({
                        where: { whatsappLid: recipientNumber }
                    });

                    if (!existingLid) {
                        const targetCustomer = await prisma.customer.findFirst({
                            where: {
                                OR: [
                                    { phone: cleanPhone },
                                    { phone: `${cleanPhone}@c.us` },
                                    { phone: customerPhone }
                                ],
                                whatsappLid: null
                            },
                            orderBy: { createdAt: 'desc' }
                        });

                        if (targetCustomer) {
                            await prisma.customer.update({
                                where: { id: targetCustomer.id },
                                data: { whatsappLid: recipientNumber }
                            });
                            console.log(`[API] Linked LID ${recipientNumber} → ${customerPhone}`);
                        }
                    }
                } catch (e) {
                    console.warn('[API] Failed to link LID:', e.message);
                }
            }

            return res.status(200).json({ success: true, message: result.message });
        } else {
            console.error(`[API] Document generation failed (${documentType}):`, result.message);
            return res.status(400).json({ error: result.message });
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

                // NEW: Fix 1 - Link LID to customer if send was successful
                if (targetNumber.endsWith('@lid')) {
                    try {
                        const prisma = require('./src/lib/prisma');
                        const cleanPhone = (number || '').replace(/\D/g, '');
                        const updated = await prisma.customer.updateMany({
                            where: {
                                OR: [
                                    { phone: cleanPhone },
                                    { phone: `${cleanPhone}@c.us` },
                                    { phone: number }
                                ],
                                whatsappLid: null
                            },
                            data: { whatsappLid: targetNumber }
                        });
                        if (updated.count > 0) {
                            console.log(`[API] Linked LID ${targetNumber} → ${number}`);
                        }
                    } catch (e) {
                        console.warn('[API] Failed to link LID:', e.message);
                    }
                }
            } catch (sendError) {
                // If error with resolved number, try with DB fallback
                if (sendError.message && sendError.message.includes('No LID')) {
                    console.log(`[API] Send failed with No LID for: ${targetNumber}`);
                    const cleanPhone = targetNumber.replace(/@c\.us$|@lid$/, '');

                    const prisma = require('./src/lib/prisma');
                    const customerFallback = await prisma.customer.findFirst({
                        where: {
                            OR: [
                                { whatsappLid: targetNumber },
                                { whatsappLid: cleanPhone },
                                { phone: targetNumber },
                                { phone: cleanPhone }
                            ]
                        },
                        select: { phone: true, whatsappLid: true }
                    });

                    let fallbackTarget = null;
                    if (targetNumber.endsWith('@c.us') && customerFallback?.whatsappLid) {
                        fallbackTarget = customerFallback.whatsappLid;
                    } else if (targetNumber.endsWith('@lid') && customerFallback?.phone) {
                        fallbackTarget = customerFallback.phone.includes('@') ? customerFallback.phone : `${customerFallback.phone}@c.us`;
                    }

                    // Brute-force flip if DB had no distinct alternative
                    if (!fallbackTarget || fallbackTarget === targetNumber) {
                        const rawDigits = cleanPhone.replace(/\D/g, '');
                        if (targetNumber.endsWith('@c.us')) {
                            fallbackTarget = `${rawDigits}@lid`;
                        } else if (targetNumber.endsWith('@lid')) {
                            fallbackTarget = `${rawDigits}@c.us`;
                        }
                        console.log(`[API] DB had no distinct alt, brute-force flip: ${fallbackTarget}`);
                    }

                    if (fallbackTarget && fallbackTarget !== targetNumber) {
                        console.log(`[API] Retrying with fallback: ${fallbackTarget}`);
                        try {
                            await global.whatsappClient.sendText(fallbackTarget, finalMessage);
                            targetNumber = fallbackTarget;
                            console.log(`[API] Success with fallback target`);

                            // NEW: Fix 1 - Link LID to customer if fallback success
                            if (targetNumber.endsWith('@lid')) {
                                try {
                                    const cleanPhone = (number || '').replace(/\D/g, '');
                                    await prisma.customer.updateMany({
                                        where: {
                                            OR: [
                                                { phone: cleanPhone },
                                                { phone: `${cleanPhone}@c.us` },
                                                { phone: number }
                                            ],
                                            whatsappLid: null
                                        },
                                        data: { whatsappLid: targetNumber }
                                    });
                                } catch (e) { /* ignore fallback link error */ }
                            }
                        } catch (e2) {
                            throw sendError; // Throw original if fallback also fails
                        }
                    } else {
                        throw sendError;
                    }
                } else {
                    throw sendError;
                }
            }

            await saveMessageToPrisma(targetNumber, finalMessage, 'admin');
            return res.status(200).json({ success: true, channel: 'whatsapp', rewritten });
        }

        throw new Error(`Channel ${channel} is no longer supported.`);
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

        // Auto-detect if it's a @lid from database to avoid sending to wrong JID
        let targetNumber = number;
        const prisma = require('./src/lib/prisma');
        const cleanNumber = number.replace(/\D/g, '');
        const customer = await prisma.customer.findFirst({
            where: {
                OR: [
                    { phone: cleanNumber },
                    { whatsappLid: number },
                    { whatsappLid: { endsWith: number } }
                ]
            },
            select: { whatsappLid: true }
        });

        if (customer && customer.whatsappLid) {
            targetNumber = customer.whatsappLid;
        } else {
            const { toSenderNumberWithSuffix } = require('./src/lib/utils'); // fallback if somehow needed
            // Actually, we can just use the existing function if no customer found
            targetNumber = number.includes('@') ? number : (number.length >= 14 && ['1', '2'].includes(number[0])) ? `${number}@lid` : `${number}@c.us`;
        }

        const dataUri = `data:${mimetype};base64,${base64}`;
        await global.whatsappClient.sendFile(targetNumber, dataUri, filename || 'file', caption || '');
        console.log(`[API] Successfully sent media to ${targetNumber} (original: ${number})`);
        res.status(200).json({ success: true });
    } catch (e) {
        console.error('[API] Error sending media:', e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/test-ai', requireAuth, async (req, res) => {
    try {
        const { message, senderNumber, senderName, mode, model_override, history, media } = req.body;
        const testMessage = message || "Hello, test message";

        // Convert base64 media to Buffer format
        let mediaItems = [];
        if (media && Array.isArray(media)) {
            mediaItems = media.map(item => ({
                type: item.type, // 'image' or 'video'
                mimetype: item.mimetype,
                buffer: Buffer.from(item.base64, 'base64')
            }));
        }

        // If mode is 'admin', force the admin sender number
        let effectiveSenderNumber = senderNumber || null;
        let effectiveSenderName = senderName || "Test User";
        let isAdmin = false;
        if (mode === 'admin') {
            // Only force the sender number if it's already set somehow, otherwise we still want it to be null to use local memory if applicable
            if (effectiveSenderNumber) {
                effectiveSenderNumber = process.env.BOSMAT_ADMIN_NUMBER || process.env.ADMIN_WHATSAPP_NUMBER || effectiveSenderNumber;
            }
            effectiveSenderName = "Admin (Playground)";
            isAdmin = true;
        }

        const { HumanMessage } = require('@langchain/core/messages');
        const messageContent = [];
        if (testMessage) {
            messageContent.push({ type: 'text', text: testMessage });
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

        const customThreadId = req.body?.thread_id || req.query?.thread_id;
        const finalThreadId = effectiveSenderNumber || customThreadId || "test_user_playground";

        const input = {
            messages: [new HumanMessage({ content: messageContent })],
            metadata: {
                phoneReal: finalThreadId,
                senderName: effectiveSenderName,
                mediaItems: mediaItems,
                isAdmin: isAdmin 
            }
        };

        const aiResult = await zoyaAgent.invoke(input, {
            configurable: { thread_id: finalThreadId }
        });

        const lastMessage = aiResult.messages[aiResult.messages.length - 1];
        const response = lastMessage ? extractTextFromContent(lastMessage.content ?? lastMessage.kwargs?.content) : "No response";
        const runId = aiResult.runId || null;

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

app.delete('/test-ai/clear', requireAuth, async (req, res) => {
    try {
        const mode = req.body?.mode || req.query?.mode || 'customer';
        const customThreadId = req.body?.thread_id || req.query?.thread_id;
        let thread_id = customThreadId || "test_user_playground";
        
        if (mode === 'admin') {
            thread_id = process.env.BOSMAT_ADMIN_NUMBER || process.env.ADMIN_WHATSAPP_NUMBER || thread_id;
        }
        
        // Clear LangGraph memory for test user
        if (checkpointer) {
            // If using PrismaCheckpointer, delete from keyValueStore
            if (prisma) {
                await prisma.keyValueStore.deleteMany({
                    where: {
                        collection: 'langgraph_checkpoints',
                        key: thread_id
                    }
                }).catch(e => console.log('Checkpointer clear error:', e.message));
            }
            // Fallback for MemorySaver just in case
            if (checkpointer.storage && checkpointer.storage[thread_id]) {
                delete checkpointer.storage[thread_id];
            }
            if (checkpointer.writes && checkpointer.writes[thread_id]) {
                delete checkpointer.writes[thread_id];
            }
        }

        // Clear Prisma history for test user
        if (prisma) {
            await prisma.customerContext.deleteMany({ where: { phone: thread_id } }).catch(() => {});
            
            const customer = await prisma.customer.findUnique({ where: { phone: thread_id } }).catch(() => null);
            if (customer) {
                await prisma.directMessage.deleteMany({ where: { customerId: customer.id } }).catch(() => {});
                await prisma.customer.delete({ where: { id: customer.id } }).catch(() => {});
            }
        }

        res.json({ success: true, message: `Playground memory cleared for ${thread_id}` });
    } catch (e) {
        console.error('[API] Error clearing test-ai memory:', e);
        res.status(500).json({ error: e.message });
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
                totalAmount: b.totalAmount || b.subtotal || 0,
                discount: b.discount || 0,
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


// ─── Follow-Up Queue Review Endpoints ────────────────────────────────────────

/**
 * GET /follow-up-queue
 * Returns a dry-run preview of all outbound messages.
 */
app.get('/follow-up-queue', requireAuth, async (req, res) => {
    try {
        const { _buildDryRunQueue, isSchedulerBusy } = require('./src/ai/agents/followUpEngine/scheduler.js');

        // ⚠️ Guard: block if the cron job is currently running to prevent double-send
        if (isSchedulerBusy()) {
            return res.status(409).json({
                success: false,
                error: 'Scheduler sedang berjalan (cronjob aktif). Tunggu beberapa menit dan coba lagi.',
            });
        }

        const { processCoatingReminders } = require('./src/ai/utils/coatingReminders.js');
        const { sendBookingReminders } = require('./src/ai/utils/bookingReminders.js');

        // Run all three sources in parallel
        const [nurtureItems, coatingItems, bookingItems] = await Promise.all([
            _buildDryRunQueue(new Date(), null),
            processCoatingReminders(null, true),
            sendBookingReminders(true, true),
        ]);

        const queue = [
            ...(nurtureItems || []),
            ...(coatingItems || []),
            ...(bookingItems || []),
        ];

        res.json({
            success: true,
            total: queue.length,
            generatedAt: new Date().toISOString(),
            queue,
        });
    } catch (err) {
        console.error('[API] GET /follow-up-queue error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /follow-up-queue/saved
 * Returns the saved queue from KeyValueStore (if any).
 * Used by UI on page load to auto-restore pre-9AM saved queue.
 */
app.get('/follow-up-queue/saved', requireAuth, async (req, res) => {
    try {
        const prisma = require('./src/lib/prisma.js');
        const record = await prisma.keyValueStore.findUnique({
            where: { collection_key: { collection: 'follow_up_queue', key: 'saved' } }
        });

        if (!record) {
            return res.json({ success: true, exists: false, queue: [], delayMs: 300000, savedAt: null });
        }

        const data = record.value;
        res.json({
            success: true,
            exists: true,
            queue: data.queue || [],
            delayMs: data.delayMs || 300000,
            savedAt: record.updatedAt,
        });
    } catch (err) {
        console.error('[API] GET /follow-up-queue/saved error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /follow-up-queue/save
 * Saves the current approved queue to KeyValueStore for execution at 9 AM.
 * Body: { items: [...], delayMs: number }
 */
app.post('/follow-up-queue/save', requireAuth, async (req, res) => {
    try {
        const { items = [], delayMs = 300000 } = req.body;
        const prisma = require('./src/lib/prisma.js');

        await prisma.keyValueStore.upsert({
            where: { collection_key: { collection: 'follow_up_queue', key: 'saved' } },
            create: {
                collection: 'follow_up_queue',
                key: 'saved',
                value: { queue: items, delayMs },
            },
            update: {
                value: { queue: items, delayMs },
            }
        });

        console.log(`[API] Saved follow-up queue: ${items.length} items, delay=${delayMs}ms`);
        res.json({ success: true, saved: items.length });
    } catch (err) {
        console.error('[API] POST /follow-up-queue/save error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * DELETE /follow-up-queue/saved
 * Clears the saved queue from KeyValueStore.
 */
app.delete('/follow-up-queue/saved', requireAuth, async (req, res) => {
    try {
        const prisma = require('./src/lib/prisma.js');
        await prisma.keyValueStore.deleteMany({
            where: { collection: 'follow_up_queue', key: 'saved' }
        });
        console.log('[API] Cleared saved follow-up queue');
        res.json({ success: true });
    } catch (err) {
        console.error('[API] DELETE /follow-up-queue/saved error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ─── Execute Status (in-memory, per process) ─────────────────────────────────
const _executeStatus = {
    running: false,
    total: 0,
    sent: 0,
    errors: 0,
    current: null,   // { senderNumber, type }
    startedAt: null,
    finishedAt: null,
    results: [],
};

/**
 * GET /follow-up-queue/execute-status
 * Returns current background execute progress.
 */
app.get('/follow-up-queue/execute-status', requireAuth, (req, res) => {
    res.json({ success: true, ..._executeStatus });
});

/**
 * POST /follow-up-queue/execute
 * Fire-and-forget: responds 202 immediately, processes queue in background with delayMs between sends.
 * Body: { items: [{ docId, senderNumber, type, message, approved }], delayMs? }
 */
app.post('/follow-up-queue/execute', requireAuth, async (req, res) => {
    try {
        const { items = [], delayMs = 300000 } = req.body; // default 5 menit

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, error: 'items array is required and must not be empty' });
        }

        const approved = items.filter(item => item.approved === true);

        if (approved.length === 0) {
            return res.json({ success: true, sent: 0, message: 'No approved items to send.' });
        }

        if (!global.whatsappClient) {
            return res.status(503).json({ success: false, error: 'WhatsApp client is not ready' });
        }

        if (_executeStatus.running) {
            return res.status(409).json({
                success: false,
                error: `Pengiriman sedang berjalan (${_executeStatus.sent}/${_executeStatus.total} terkirim). Tunggu selesai.`
            });
        }

        // Respond 202 immediately — do not await the background job
        res.status(202).json({
            success: true,
            accepted: approved.length,
            delayMs,
            message: `${approved.length} pesan diantrekan. Cek status via /follow-up-queue/execute-status`,
        });

        // ── Background execution ──────────────────────────────────────────────
        const { sendTextDirect } = require('./src/ai/utils/whatsappHelper.js');
        const prisma = require('./src/lib/prisma.js');
        const { markBotMessage } = require('./src/ai/utils/adminMessageSync.js');
        const sleep = (ms) => new Promise(r => setTimeout(r, ms));

        Object.assign(_executeStatus, {
            running: true,
            total: approved.length,
            sent: 0,
            errors: 0,
            current: null,
            startedAt: new Date().toISOString(),
            finishedAt: null,
            results: [],
        });

        (async () => {
            for (const item of approved) {
                const { docId, senderNumber, type, message } = item;
                _executeStatus.current = { senderNumber, type };

                try {
                    if (type === 'coating_reminder') {
                        await sendTextDirect(global.whatsappClient, senderNumber, message);
                        const record = await prisma.coatingMaintenance.findUnique({ where: { id: docId } });
                        const nextStatus = record?.status === 'pending' ? 'reminded_h7'
                            : record?.status === 'reminded_h7' ? 'reminded_h3'
                                : 'reminded_h1';
                        await prisma.coatingMaintenance.update({
                            where: { id: docId },
                            data: { status: nextStatus, reminderSent: true, reminderSentAt: new Date() }
                        });

                    } else if (type === 'booking_reminder') {
                        await sendTextDirect(global.whatsappClient, senderNumber, message);
                        await prisma.booking.update({
                            where: { id: docId },
                            data: { reminderSent: true, reminderSentAt: new Date() }
                        });

                    } else {
                        // nurturing / review / rebooking
                        markBotMessage(senderNumber, message);
                        await sendTextDirect(global.whatsappClient, senderNumber, message);

                        const cleanPhone = senderNumber.replace(/@c\.us$|@lid$/, '');
                        const customer = await prisma.customer.findFirst({
                            where: {
                                OR: [
                                    { phone: cleanPhone },
                                    { phone: senderNumber },
                                    { whatsappLid: senderNumber },
                                ]
                            }
                        });
                        if (customer) {
                            await prisma.directMessage.create({
                                data: { customerId: customer.id, senderId: senderNumber, role: 'assistant', content: message }
                            }).catch(() => { });
                            await prisma.customer.update({
                                where: { id: customer.id },
                                data: { lastMessage: message, lastMessageAt: new Date() }
                            }).catch(() => { });
                        }

                        const ctx = await prisma.customerContext.findUnique({ where: { id: docId } }).catch(() => null);
                        if (ctx) {
                            const updateData = {
                                followUpCount: (ctx.followUpCount || 0) + 1,
                                lastFollowUpAt: new Date(),
                                lastFollowUpStrategy: type,
                            };
                            if (type === 'review') updateData.reviewFollowUpSent = true;

                            await prisma.customerContext.update({
                                where: { id: docId },
                                data: updateData,
                            }).catch(err => console.warn(`[QueueExecute] Context update failed for ${docId}:`, err.message));

                            console.log(`[QueueExecute] Context updated for ${docId} (followUpCount => ${updateData.followUpCount})`);
                        } else {
                            console.warn(`[QueueExecute] Warning: Context not found for ${docId}, followUpCount not updated.`);
                        }
                    }

                    _executeStatus.sent++;
                    _executeStatus.results.push({ docId, senderNumber, type, status: 'sent' });
                    console.log(`[QueueExecute] Sent ${type} to ${senderNumber}`);

                } catch (err) {
                    console.error(`[QueueExecute] Failed to send ${type} to ${senderNumber}:`, err.message);
                    _executeStatus.errors++;
                    _executeStatus.results.push({ docId, senderNumber, type, status: 'error', error: err.message });
                }

                // Delay between messages (skip after last item)
                if (item !== approved[approved.length - 1] && delayMs > 0) {
                    console.log(`[QueueExecute] Waiting ${Math.round(delayMs / 60000)} menit before next message...`);
                    await sleep(delayMs);
                }
            }

            // Mark today as done → cronjob will skip
            const { setLastDailyRunDate } = require('./src/ai/agents/followUpEngine/scheduler.js');
            const { DateTime } = require('luxon');
            const todayStr = DateTime.now().setZone(process.env.APP_TIMEZONE || 'Asia/Jakarta').toFormat('yyyy-MM-dd');
            setLastDailyRunDate(todayStr);

            // Clear saved queue after execute
            await prisma.keyValueStore.deleteMany({
                where: { collection: 'follow_up_queue', key: 'saved' }
            }).catch(() => { });

            _executeStatus.running = false;
            _executeStatus.current = null;
            _executeStatus.finishedAt = new Date().toISOString();
            console.log(`[QueueExecute] Done — sent: ${_executeStatus.sent}, errors: ${_executeStatus.errors}`);
        })().catch(err => {
            console.error('[QueueExecute] Background job crashed:', err);
            _executeStatus.running = false;
            _executeStatus.finishedAt = new Date().toISOString();
        });

    } catch (err) {
        console.error('[API] POST /follow-up-queue/execute error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────

// --- Server Startup ---

server.listen(PORT, '0.0.0.0', async () => {
    console.log(`🚀 WhatsApp AI Chatbot listening on http://0.0.0.0:${PORT}`);
    
    // Background Job: Run auto-label script every hour to fill missing customer labels
    setInterval(() => {
        console.log('[AutoLabel Job] Running autoLabelCustomers...');
        autoLabelCustomers().catch(err => console.error('[AutoLabel Job] Failed:', err.message));
    }, 60 * 60 * 1000); // 1 hour

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


});

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

async function connectToWhatsApp() {
    console.log('🤖 [STARTUP] Initializing Baileys WhatsApp Connection...');
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info_baileys');
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`using WA v${version.join('.')}, isLatest: ${isLatest}`);

    const client = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
        },
        generateHighQualityLinkPreview: true,
        getMessage: async (key) => {
            return { conversation: 'hello' }
        }
    });

    client.ev.on('creds.update', saveCreds);

    client.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log('\n=========================================');
            console.log('📱 SCAN THIS QR CODE DARI WHATSAPP:');
            qrcode.generate(qr, { small: true });
            console.log('\nAtau copy Raw QR String ini ke QR Generator online:');
            console.log(qr);
            console.log('=========================================\n');
        }

        if (connection === 'close') {
            const errorMsg = lastDisconnect.error?.message || lastDisconnect.error?.toString() || '';
            const isQrRefsEnded = errorMsg.includes('QR refs attempts ended');
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut && !isQrRefsEnded;
            
            console.log('connection closed due to ', lastDisconnect.error, ', reconnecting ', shouldReconnect);
            // reconnect if not logged out
            if (shouldReconnect) {
                setTimeout(connectToWhatsApp, 5000);
            } else if (isQrRefsEnded) {
                console.log('⚠️ [Baileys] QR refs attempts ended. Tolong restart server dan scan QR code baru jika ingin login.');
            }
        } else if (connection === 'open') {
            console.log('opened connection');
            global.whatsappClient = client;

            // start functionality after connect
            start(client);
            startKeepAlive();
        }
    });
}

if (process.env.DISABLE_WA !== 'true') {
    connectToWhatsApp().catch(err => console.log("unexpected error: " + err));
} else {
    console.log('⚠️ [STARTUP] WhatsApp connection disabled by DISABLE_WA=true');
}

module.exports = { 
    saveMessageToPrisma, 
    saveMessageToFirestore 
};