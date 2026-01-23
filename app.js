/**
 * WhatsApp AI Chatbot dengan LangChain dan Groq
 * Arsitektur JavaScript yang konsisten
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const wppconnect = require('@wppconnect-team/wppconnect');
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const admin = require('firebase-admin');
const fetch = require('node-fetch');
const { ChatGroq } = require('@langchain/groq');
const { HumanMessage, SystemMessage, ToolMessage, AIMessage } = require('@langchain/core/messages');
const { getMotorSizeDetailsTool } = require('./src/ai/tools/getMotorSizeDetailsTool.js');
const { getSpecificServicePriceTool } = require('./src/ai/tools/getSpecificServicePriceTool.js');
const { listServicesByCategoryTool } = require('./src/ai/tools/listServicesByCategoryTool.js');
const { getServiceDescriptionTool } = require('./src/ai/tools/getServiceDescriptionTool.js');
const { getStudioInfoTool } = require('./src/ai/tools/getStudioInfoTool.js');
const { checkBookingAvailabilityTool } = require('./src/ai/tools/checkBookingAvailabilityTool.js');
const { createBookingTool } = require('./src/ai/tools/createBookingTool.js');
const { getCurrentDateTimeTool } = require('./src/ai/tools/getCurrentDateTimeTool.js');
const { updateBookingTool } = require('./src/ai/tools/updateBookingTool.js');
const { triggerBosMatTool } = require('./src/ai/tools/triggerBosMatTool.js');
const { calculateHomeServiceFeeTool } = require('./src/ai/tools/calculateHomeServiceFeeTool.js');
const { sendStudioPhotoTool } = require('./src/ai/tools/sendStudioPhotoTool.js');
const { getRepaintColorSurchargeTool } = require('./src/ai/tools/getRepaintColorSurchargeTool.js');
const { notifyVisitIntentTool } = require('./src/ai/tools/notifyVisitIntentTool.js');
const { createMetaWebhookRouter } = require('./src/server/metaWebhook.js');
const { sendMetaMessage } = require('./src/server/metaClient.js');
const { startBookingReminderScheduler } = require('./src/ai/utils/bookingReminders.js');
const { isSnoozeActive, setSnoozeMode, clearSnoozeMode, getSnoozeInfo } = require('./src/ai/utils/humanHandover.js');
const { getLangSmithCallbacks } = require('./src/ai/utils/langsmith.js');
const { saveCustomerLocation } = require('./src/ai/utils/customerLocations.js');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 4000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '50mb' }));

// --- Utility Functions ---
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// --- Firebase Initialization ---
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
const db = admin.firestore();

// --- Tool Registry ---
const availableTools = {
    getMotorSizeDetails: getMotorSizeDetailsTool.implementation,
    getSpecificServicePrice: getSpecificServicePriceTool.implementation,
    listServicesByCategory: listServicesByCategoryTool.implementation,
    getServiceDescription: getServiceDescriptionTool.implementation,
    getStudioInfo: getStudioInfoTool.implementation,
    checkBookingAvailability: checkBookingAvailabilityTool.implementation,
    createBooking: createBookingTool.implementation,
    getCurrentDateTime: getCurrentDateTimeTool.implementation,
    updateBooking: updateBookingTool.implementation,
    triggerBosMatTool: triggerBosMatTool.implementation,
    calculateHomeServiceFee: calculateHomeServiceFeeTool.implementation,
    sendStudioPhoto: sendStudioPhotoTool.implementation,
    getRepaintColorSurcharge: getRepaintColorSurchargeTool.implementation,
    notifyVisitIntent: notifyVisitIntentTool.implementation,
};

const toolDefinitions = [
    getMotorSizeDetailsTool.toolDefinition,
    getSpecificServicePriceTool.toolDefinition,
    listServicesByCategoryTool.toolDefinition,
    getServiceDescriptionTool.toolDefinition,
    getStudioInfoTool.toolDefinition,
    checkBookingAvailabilityTool.toolDefinition,
    createBookingTool.toolDefinition,
    getCurrentDateTimeTool.toolDefinition,
    updateBookingTool.toolDefinition,
    triggerBosMatTool.toolDefinition,
    calculateHomeServiceFeeTool.toolDefinition,
    sendStudioPhotoTool.toolDefinition,
    getRepaintColorSurchargeTool.toolDefinition,
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
console.log(`🤖 [STARTUP] Model: ${process.env.AI_MODEL || 'llama-3.3-70b-versatile'}`);
console.log(`🤖 [STARTUP] Temperature: ${parseFloat(process.env.AI_TEMPERATURE) || 0.7}`);
console.log(`🤖 [STARTUP] Tools available: ${toolDefinitions.length} tools`);

// API Keys configuration with fallback support
const API_KEYS = [
    process.env.GROQ_API_KEY,
    process.env.GROQ_API_KEY_FALLBACK,
].filter(Boolean);

if (API_KEYS.length === 0) {
    throw new Error('At least one GROQ_API_KEY must be configured');
}

console.log(`🔑 [STARTUP] API Keys configured: ${API_KEYS.length} key(s) available`);
if (API_KEYS.length > 1) {
    console.log(`🔄 [STARTUP] Fallback API key configured - will auto-retry on failures`);
}

const ACTIVE_AI_MODEL = process.env.AI_MODEL || 'llama-3.3-70b-versatile';
// Vision default: llama-3.2-90b-vision-preview (multimodal). Bisa override via VISION_MODEL/IMAGE_MODEL.
const ACTIVE_VISION_MODEL = process.env.VISION_MODEL || process.env.IMAGE_MODEL || 'llama-3.2-90b-vision-preview';
const FALLBACK_VISION_MODEL = process.env.VISION_FALLBACK_MODEL || 'llama-3.2-11b-vision-preview';

const baseModel = new ChatGroq({
    model: ACTIVE_AI_MODEL,
    temperature: parseFloat(process.env.AI_TEMPERATURE) || 0.7,
    apiKey: API_KEYS[0]
});

const groqToolSpecifications = toolDefinitions.map(tool => {
    if (tool.function) {
        // Clone parameters to avoid mutating original
        const parameters = tool.function.parameters ? JSON.parse(JSON.stringify(tool.function.parameters)) : {};

        // Remove system-injected parameters from the schema sent to AI
        // This prevents the AI from hallucinating null/invalid values for these fields
        if (parameters.properties) {
            delete parameters.properties.senderNumber;
            delete parameters.properties.senderName;
            // Also remove snake_case versions which seem to be causing the issue
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
                name: tool.function.name,
                description: tool.function.description,
                parameters: parameters
            }
        };
    }

    return tool;
});

const aiModel = baseModel.bindTools(groqToolSpecifications);

console.log('✅ [STARTUP] AI Model initialized with native tool calling support');
console.log(`🤖 [STARTUP] Active AI model: ${ACTIVE_AI_MODEL}`);

console.log(`🖼️ [STARTUP] Vision analysis target models: ${[ACTIVE_VISION_MODEL, FALLBACK_VISION_MODEL].filter(Boolean).join(', ')}`);

const SYSTEM_PROMPT = `# Identity & Persona
Anda adalah **Zoya**, asisten AI dari **Bosmat Repainting and Detailing Studio**.
Lokasi: Bukit Cengkeh 1, Jl. Medan No.B3/2, Depok, Jawa Barat 16451.
Karakter: Responsif, ramah, profesional, tapi santai seperti admin WhatsApp.
Panggilan ke User: "Mas".

# Style & Communication Rules (Crucial)
1.  **Format Uang Natural**: Jangan tulis Rp 1.250.000. Manusia di WA nulisnya **"1,25 juta"** atau **"1.250rb"**.
2.  **Anti-Jargon**: DILARANG KERAS menggunakan istilah teknis tool ke user. Terjemahkan!
    * Surcharge -> Ganti jadi **"Biaya tambahan bahan"** atau **"Nambah dikit buat..."**
    * SpecificServicePrice -> Ganti jadi **"Harganya"**.
3.  **Jangan Seperti Struk Belanja**: Hindari list bullet point kaku saat menyebut harga. Masukkan dalam kalimat.
    * *Salah:* "- Repaint: Rp 1jt \n - Bongkar: Rp 50rb"
    * *Benar:* "Buat repaint-nya kena **1 juta** Mas, terus ada ongkos bongkar dikit **50rb** ya."
4.  **Pacing (Tempo Chat)**: Jangan menumpuk info harga + form booking dalam satu chat. Kasih harga dulu, tanya pendapat user, baru kalau deal kirim format booking.

# Style & Formatting Rules (WhatsApp Standard)
1.  **WAJIB Format WhatsApp**:
    * Untuk **BOLD (Tebal)**: Gunakan **SATU bintang** (*).
        * ❌ Salah: **Harga 500rb** (Ini markdown web)
        * ✅ Benar: *Harga 500rb* (Ini format WA)
    * Untuk *Italic (Miring)*: Gunakan **Underscore** (_).
        * ❌ Salah: *estimasi*
        * ✅ Benar: _estimasi_
2.  **Minimalisir Simbol**:
    * Jangan men-bold seluruh kalimat. Cukup angka penting atau kata kuncinya saja.
    * ❌ Salah: *Repaint Bodi Halus 1,2 Juta*
    * ✅ Benar: Repaint bodi halus: *1,2 juta*
3.  **List**: Gunakan simbol bulat (•) atau strip (-) agar rapi.

# Core Rules (Strict)
1.  **Tool First**: Jangan menebak data. Panggil tool yang relevan.
2.  **MANDATORY Tool Calls (PENTING SEKALI)**:
    *   **Untuk HARGA**: Alur `getMotorSizeDetails` -> `getSpecificServicePrice` adalah **WAJIB**. Jangan pernah sebut harga tanpa memanggil tool ini.
    *   **Untuk DESKRIPSI**: Pertanyaan seperti "diapain aja?", "apa itu X?", atau "jelaskan Y" **WAJIB** dijawab menggunakan tool `getServiceDescription`. **DILARANG KERAS** menulis penjelasan layanan dari ingatanmu. Jawabanmu harus 100% berdasarkan output tool.
3.  **No Hallucination**: Jika tool error atau data tidak ada, jujur bilang tidak tahu. Jangan mengarang.

# Business Logic & Service Policy
- **Repaint**: WAJIB pengerjaan di Workshop. Tersedia layanan jemput-antar.
- **Detailing/Coating**: Bisa Home Service (cek biaya via tool) atau Workshop.
- **Konsultasi**: Jika user ingin datang tanpa booking, catat estimasi waktu dan panggil notifyVisitIntent.
- **Booking**: Wajib ada Nama, No HP, Motor, Tanggal, Jam, Layanan. Gunakan createBooking hanya setelah user setuju eksplisit.

# Standard Operating Procedure (Workflow)

## A. Cek Harga & Layanan
1. User tanya harga/layanan.
2. **WAJIB**: Panggil getMotorSizeDetails (input: nama motor) dulu untuk tahu ukuran (Small/Medium/Large).
3. Setelah tahu ukuran, panggil getSpecificServicePrice atau listServicesByCategory.
4. Sajikan harga ke user dengan ramah.

## B. Booking Flow
1. Cek ketersediaan: checkBookingAvailability.
2. Jika kosong, tawarkan slot. Jika penuh, cari alternatif: findNextAvailableSlot.
3. Deal jadwal? Panggil createBooking.
4. User mau ubah? Panggil updateBooking.

## C. Lokasi & Info
1. Tanya alamat/jam? Panggil getStudioInfo.
2. Masih bingung/sudah dekat? Panggil sendStudioPhoto.
3. Tanya garansi/detail teknis ribet? Panggil searchKnowledgeBase.

# Tools Capabilities
- getMotorSizeDetails: Cek kategori ukuran motor (Wajib sebelum cek harga).
- getSpecificServicePrice: Cek harga fix berdasarkan ukuran.
- calculateHomeServiceFee: Hitung biaya transport (butuh lokasi user).
- getRepaintColorSurcharge: Cek biaya tambahan warna khusus (candy/bunglon/dll).
- triggerBosMatTool: Handover ke manusia (kasus rumit/komplain).

## LOGIKA KONSULTASI & DIAGNOSA (CRITICAL)

⚠️ **ATURAN UTAMA**: Jangan langsung memberi harga total jika detail belum lengkap. Kamu adalah Service Advisor, tugasmu memetakan masalah motor user dulu.

## FASE 1: DIAGNOSA & EDUKASI
Jika user bertanya layanan tapi belum menyebut jenis motor:

1.  **Cek Context**: Apakah user tanya "Harga" atau tanya "Penjelasan/Menu"?
2.  **Action**:
    * Jika tanya **"Apa itu X?"** atau **"Ada paket apa aja?"**:
        * Panggil getServiceDescription atau listServicesByCategory dulu.
        * Jelaskan ke user, LALU akhiri dengan: "Nah, untuk harga pasnya, motor Mas jenisnya apa ya?"
    * Jika tanya **"Harganya berapa?"** (langsung tembak harga):
        * JANGAN panggil tool harga.
        * Langsung tanya: "Boleh tau dulu motornya apa Mas? Soalnya beda ukuran beda harga."

**Contoh Logic:**
* User: "Mas detailing itu diapain aja?" -> AI: Call getServiceDescription("Detailing") -> Jawab penjelasan -> Tanya motor.
* User: "Repaint kena berapa?" -> AI: Tanya motor (Stop process).

    ### 🛠️ Jika User Tanya REPAINT:
    Tanyakan 3 hal ini secara bertahap (jangan dibombardir sekaligus):
    * **Scope Area**: "Rencana mau repaint **Full Body** (Halus + Kasar), **Body Halus** aja, atau cuma **Velg** Mas?"
    * **Kondisi Cat Lama**: "Kondisi cat sekarang gimana Mas? Masih ori, sudah pernah repaint, atau ada yang pecah/baret parah?" (Penting untuk tahu perlu *stripping*/kerok total atau tidak).
    * **Warna**: "Mau balikin ke warna standar pabrik atau mau ganti konsep warna lain Mas?"

    ### ✨ Jika User Tanya DETAILING / COATING:
    Tanyakan tingkat kebersihan yang diinginkan:
    * **Masalah Utama**: "Kondisi motornya sekarang gimana Mas? Cuma kotor debu, atau ada jamur/kerak membandel di mesin/bodi?"
    * **Tujuan**: "Pengennya sekadar bersih kinclong (Cuci/Poles) atau mau yang proteksinya awet tahunan (Coating)?"
    * **Finishing**: "Cat motornya Glossy atau Doff/Matte Mas?" (Penting karena obatnya beda).

## FASE 2: PRESENTASI HARGA & SOLUSI
Setelah dapat data harga dari tool, SAJIKAN DENGAN MANUSIAWI:

1.  **Jelaskan Value Dulu**: Sebelum sebut angka, jelaskan apa yang didapat.
    * *Contoh:* "Karena Mas mau warna Candy, nanti kita pakai bahan khusus ya Mas biar warnanya deep dan kinclong."
2.  **Sebut Harga Total + Rincian Santai**:
    * Gabungkan harga pokok dan tambahan dalam kalimat yang enak dibaca.
    * JANGAN gunakan kata "Surcharge". Gunakan kalimat: "Nah, untuk warna Candy ini ada tambahan bahan **X rupiah** ya Mas."
3.  **Cek Ombak (Closing Ringan)**:
    * Jangan langsung minta data diri!
    * Tanya dulu: "Gimana Mas kira-kira, harganya masuk di budget?" atau "Mau diambil paket yang ini Mas?"

**Contoh Output Harga yang BENAR:**
"Oke Mas, saya hitungin ya.
Buat Nmax (Medium) repaint bodi halus warna Candy, totalnya jadi **1,7 jutaan** Mas.
Rinciannya: Repaint bodi **1,25 juta**, terus ada tambahan bahan cat Candy **250rb**, sama cuci komplitnya **275rb**.
Gimana Mas, bungkus yang ini?"

## FASE 3: CALL TO ACTION
Selalu akhiri penjelasan dengan pertanyaan pancingan:
* "Kira-kira mau dijadwalan kapan Mas buat pengerjaannya?"
* "Mau saya hitungkan total estimasinya Mas?"

# Tone & Style Examples (Few-Shot)

User: "Mas, paket repaint ada apa aja?"
Assistant: (Call listServicesByCategory -> input: "repaint")
"Buat repaint kita ada beberapa opsi Mas:
• *Repaint Body Halus*: Fokus di bodi yang berwarna aja.
• *Full Body*: Udah termasuk bodi kasar (kulit jeruk) & velg.
• *Repaint Velg*: Khusus kaki-kaki.

Ngomong-ngomong motornya apa nih Mas? Biar saya cek harganya."

User: "Mas, cat velg nmax berapa?"
Assistant: (Call getMotorSizeDetails -> NMAX is Medium -> Call getSpecificServicePrice)
"Untuk Nmax (Medium) repaint velg polos kena **Rp 350.000** Mas. Pengerjaan estimasi 1 hari ya. Mau warna apa Mas?"

User: "Bisa dipanggil ke rumah gak?"
Assistant: "Kalau repaint harus di workshop Mas, biar hasilnya maksimal dan steril debu. Tapi kita ada layanan **jemput-antar** kok. Mas tinggal di daerah mana?"

User: "Lokasi dmn?"
Assistant: (Call getStudioInfo)
"Kita di **Bukit Cengkeh 1, Depok** Mas. Patokannya Jl. Medan No.B3/2. Mau saya kirimin foto depan studionya biar gampang cari?"

User: "Mahal banget 500rb"
Assistant: "Ada harga ada rupa Mas hehe. Kita pakai bahan premium dan garansi lho. Boleh kirim foto kondisi motornya sekarang Mas? Biar saya cek promonya.

User: "Jadi berapa totalnya Mas buat Vario saya?"
Assistant: (Tool returns: {service: 800000, surcharge_candy: 150000, total: 950000})
"Totalnya jadi **950rb** aja Mas. Itu udah repaint full body **800rb**, sama nambah **150rb** buat bahan warna Candynya ya biar glowing. Gimana, aman di kantong Mas?"

User: "Mahal amat surcharge-nya."
Assistant: "Itu bukan biaya admin kok Mas, hehe. Itu murni buat beli bahan cat Candynya, soalnya cat Candy butuh base coat silver dan pigmen khusus biar warnanya keluar. Hasilnya beda jauh sama cat biasa Mas!"`;

const ADMIN_MESSAGE_REWRITE_ENABLED = process.env.ADMIN_MESSAGE_REWRITE === 'false' ? false : true;
const ADMIN_MESSAGE_REWRITE_STYLE_PROMPT = `Kamu adalah Zoya, asisten Bosmat yang ramah dan profesional. Tugasmu adalah menulis ulang pesan admin berikut agar gaya bahasa konsisten dengan gaya Zoya:
- Gunakan bahasa Indonesia santai namun sopan.
- Panggil pelanggan dengan "mas" atau "mbak" jika relevan.
- Pertahankan maksud dan janji yang sudah dibuat admin, jangan menambah atau mengubah fakta.
- Gunakan gaya WhatsApp: maksimal 2-6 kalimat, bullet jika perlu, huruf tebal *...* bila menekankan istilah penting.
- Jangan mengubah angka/harga/jadwal yang disebutkan.
- Jangan menyebutkan kamu sedang menulis ulang pesan admin.`;

function getTracingConfig(label) {
    const callbacks = getLangSmithCallbacks(label);
    if (!callbacks || callbacks.length === 0) {
        return undefined;
    }
    return {
        runName: label,
        callbacks,
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
                    console.log(`[Browser] Removed stale lock file: ${target}`);
                } catch (error) {
                    console.warn(`[Browser] Failed to remove lock file ${target}:`, error.message);
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
    maxMessages: parseInt(process.env.MEMORY_MAX_MESSAGES) || 20,
    maxAgeHours: parseInt(process.env.MEMORY_MAX_AGE_HOURS) || 24,
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
        
        // Calculate cutoff time for memory
        const cutoffTime = new Date();
        cutoffTime.setHours(cutoffTime.getHours() - MEMORY_CONFIG.maxAgeHours);
        
        const snapshot = await messagesRef
            .where('timestamp', '>=', cutoffTime)
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

const WHATSAPP_SUFFIX = '@c.us';

function parseSenderIdentity(rawValue) {
    const trimmed = (rawValue || '').trim();
    if (!trimmed) {
        return {
            docId: '',
            channel: 'unknown',
            platformId: null,
            normalizedAddress: '',
        };
    }

    const hasWhatsappSuffix = trimmed.endsWith(WHATSAPP_SUFFIX);
    const baseId = hasWhatsappSuffix ? trimmed.slice(0, -WHATSAPP_SUFFIX.length) : trimmed;

    let channel = 'whatsapp';
    let platformId = baseId;

    if (baseId.includes(':')) {
        const [channelPart, ...rest] = baseId.split(':');
        channel = channelPart || 'unknown';
        platformId = rest.length ? rest.join(':') : null;
    }

    const normalizedAddress = channel === 'whatsapp'
        ? `${baseId}${WHATSAPP_SUFFIX}`
        : baseId;

    return {
        docId: baseId,
        channel,
        platformId,
        normalizedAddress,
    };
}

function toSenderNumberWithSuffix(id) {
    return parseSenderIdentity(id).normalizedAddress;
}

async function executeToolCall(toolName, args, metadata = {}) {
    console.log(`\n⚡ [TOOL_CALL] ===== EXECUTING TOOL =====`);
    console.log(`⚡ [TOOL_CALL] Tool Name: ${toolName}`);
    console.log(`⚡ [TOOL_CALL] Arguments: ${JSON.stringify(args, null, 2)}`);
    console.log(`⚡ [TOOL_CALL] Available tools: ${Object.keys(availableTools).join(', ')}`);
    
    if (!availableTools[toolName]) {
        console.error(`❌ [TOOL_CALL] Tool ${toolName} not found in available tools`);
        console.error(`❌ [TOOL_CALL] Available tools: ${Object.keys(availableTools)}`);
        return { error: `Tool ${toolName} tidak tersedia` };
    }
    
    console.log(`✅ [TOOL_CALL] Tool ${toolName} found, executing...`);
    
    try {
        let preparedArgs = args;
        if (typeof preparedArgs === 'string') {
            try {
                preparedArgs = JSON.parse(preparedArgs);
            } catch (error) {
                console.warn(`[TOOL_CALL] Tidak dapat parse argumen string untuk ${toolName}:`, error.message);
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
        
        console.log(`✅ [TOOL_CALL] Tool ${toolName} executed successfully in ${executionTime}ms`);
        console.log(`📊 [TOOL_CALL] Tool result: ${JSON.stringify(result, null, 2)}`);
        console.log(`⚡ [TOOL_CALL] ===== TOOL EXECUTION COMPLETED =====\n`);
        
        return result;
    } catch (error) {
        console.error(`❌ [TOOL_CALL] Error executing ${toolName}:`, error);
        console.error(`❌ [TOOL_CALL] Error stack:`, error.stack);
        console.error(`❌ [TOOL_CALL] ===== TOOL EXECUTION FAILED =====\n`);
        return { error: `Kesalahan saat menjalankan ${toolName}: ${error.message}` };
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

async function analyzeImageWithGemini(imageBuffer, mimeType = 'image/jpeg', caption = '', senderName = 'User') {
    const base64Image = imageBuffer.toString('base64');
    const systemPrompt = 'Anda adalah Zoya, asisten Bosmat. Analisis foto motor pengguna, jelaskan kondisi, kerusakan, kebersihan, dan rekomendasi perawatan secara singkat dalam bahasa Indonesia. Fokus pada hal yang benar-benar terlihat dan hindari asumsi. ## Layanan Utama Repaint**: Bodi Halus/Kasar, Velg, Cover CVT/Arm Detailing/Coating**: Detailing Mesin, Cuci Komplit, Poles Bodi Glossy, Full Detailing Glossy, Coating Motor Doff/Glossy, Complete Service Doff/Glossy';
    const textPrompt = `Analisis foto motor dari ${senderName}. ${caption ? `Caption pengguna: ${caption}.` : ''} Sebutkan poin penting dalam 2-3 kalimat. Jika ada noda/baret/kerusakan, jelaskan singkat dan rekomendasikan treatment Bosmat yang relevan.`;

    const fallbackChain = ['llama-3.2-11b-vision-preview'];
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
            const apiKeyLabel = apiKeyIndex === 0 ? 'primary' : `fallback #${apiKeyIndex}`;
            
            try {
                const logPrefix = apiKeyIndex === 0 
                    ? `[VISION] 🔍 Analysing image using ${modelName}...`
                    : `[VISION] 🔄 Trying ${modelName} with ${apiKeyLabel} API key...`;
                console.log(logPrefix);

                // Direct API Call to Groq to bypass LangChain "Non string message content" error
                const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${currentApiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: modelName,
                        messages: [
                            {
                                role: "system",
                                content: systemPrompt
                            },
                            {
                                role: "user",
                                content: [
                                    {
                                        type: "text",
                                        text: textPrompt
                                    },
                                    {
                                        type: "image_url",
                                        image_url: {
                                            url: `data:${mimeType};base64,${base64Image}`
                                        }
                                    }
                                ]
                            }
                        ],
                        temperature: 0.5,
                        max_tokens: 1024
                    })
                });

                if (!response.ok) {
                    const errorBody = await response.text();
                    throw new Error(`Groq API Error (${response.status}): ${errorBody}`);
                }

                const data = await response.json();
                const text = data.choices?.[0]?.message?.content;

                if (text) {
                    const successMsg = apiKeyIndex === 0
                        ? `[VISION] ✅ Analysis complete with ${modelName}`
                        : `[VISION] ✅ Analysis complete with ${modelName} using ${apiKeyLabel} API key`;
                    console.log(successMsg);
                    return text;
                }
            } catch (error) {
                const isQuotaError = error?.message?.includes('Quota exceeded') || 
                                   error?.message?.includes('429') ||
                                   error?.message?.includes('quota') ||
                                   error?.message?.includes('RESOURCE_EXHAUSTED');
                
                const errorLabel = apiKeyIndex === 0 
                    ? `[VISION] ❌ ${modelName} failed`
                    : `[VISION] ❌ ${modelName} with ${apiKeyLabel} API key failed`;
                console.error(`${errorLabel}:`, error?.message || error);
                
                // If quota error and more API keys available, try next key with same model
                if (isQuotaError && apiKeyIndex < API_KEYS.length - 1) {
                    continue;
                }
                // Otherwise try next model
                break;
            }
        }
    }

    return 'Gambar diterima, namun analisis otomatis gagal dilakukan.';
}

async function getAIResponse(userMessage, senderName = "User", senderNumber = null, context = "") {
    try {
        console.log('\n🤖 [AI_PROCESSING] ===== STARTING AI PROCESSING =====');
        console.log(`📝 [AI_PROCESSING] User Message: "${userMessage}"`);
        console.log(`👤 [AI_PROCESSING] Sender: ${senderName}`);
        console.log(`📱 [AI_PROCESSING] Sender Number: ${senderNumber || 'N/A'}`);

        let conversationHistoryMessages = [];

        if (senderNumber && db) {
            console.log(`🧠 [AI_PROCESSING] Fetching conversation history for ${senderNumber}...`);
            const history = await getConversationHistory(senderNumber);
            conversationHistoryMessages = buildLangChainHistory(history);
            console.log(`🧠 [AI_PROCESSING] Found ${history.length} previous messages`);
            if (history.length > 0) {
                console.log(`🧠 [AI_PROCESSING] Last message: "${history[history.length - 1]?.text?.substring(0, 50)}..."`);
            }
        } else {
            console.log(`🧠 [AI_PROCESSING] No conversation history (new user or no DB)`);
        }

        const userContent = context
            ? `${userMessage}\n\n[Context Internal]\n${context}`
            : userMessage;

        const messages = [
            new SystemMessage(SYSTEM_PROMPT),
            ...conversationHistoryMessages,
            new HumanMessage(userContent)
        ];

        console.log(`🔧 [AI_PROCESSING] Tools registered: ${toolDefinitions.map(t => t.function.name).join(', ')}`);
        let iteration = 0;
        const MAX_ITERATIONS = 8;

        let response;

        while (iteration < MAX_ITERATIONS) {
            const traceLabel = iteration === 0 ? 'chat-response-initial' : `chat-response-iteration-${iteration}`;
            console.log(`🚀 [AI_PROCESSING] Sending request to AI model... (iteration ${iteration + 1})`);
            
            let lastError = null;
            let responseReceived = false;
            
            // Try each API key in sequence
            for (let apiKeyIndex = 0; apiKeyIndex < API_KEYS.length; apiKeyIndex++) {
                const currentApiKey = API_KEYS[apiKeyIndex];
                const isFirstKey = apiKeyIndex === 0;
                const apiKeyLabel = isFirstKey ? 'primary' : `fallback #${apiKeyIndex}`;
                
                try {
                    if (!isFirstKey) {
                        console.log(`🔄 [AI_PROCESSING] Trying ${apiKeyLabel} API key...`);
                    }
                    
                    // Create model instance with current API key
                    const modelInstance = apiKeyIndex === 0 ? aiModel : new ChatGroq({
                        model: ACTIVE_AI_MODEL,
                        temperature: parseFloat(process.env.AI_TEMPERATURE) || 0.7,
                        apiKey: currentApiKey
                    }).bindTools(groqToolSpecifications);
                    
                    response = await modelInstance.invoke(messages, getTracingConfig(traceLabel));
                    
                    // Validate response
                    const hasToolCalls = getToolCallsFromResponse(response).length > 0;
                    // Relaxed validation: Allow empty string content. Only fail if strictly null/undefined.
                    if (!response || ((response.content === null || response.content === undefined) && !hasToolCalls)) {
                        console.error('❌ [AI_PROCESSING] Invalid response structure:', response ? Object.keys(response) : 'null');
                        throw new Error('Invalid response from AI model: empty or undefined content');
                    }
                    
                    if (!isFirstKey) {
                        console.log(`✅ [AI_PROCESSING] ${apiKeyLabel} API key succeeded!`);
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
                    
                    console.error(`❌ [AI_PROCESSING] Error with ${apiKeyLabel} API key:`, error.message);
                    
                    // If this is the last API key or non-retryable error, try model fallback
                    if (apiKeyIndex === API_KEYS.length - 1 || !isRetryableError) {
                        if (isRetryableError && (isQuotaError || isResponseError)) {
                            console.error(`❌ [AI_PROCESSING] All API keys exhausted, trying model fallback...`);
                            const fallbackModel = 'llama-3.1-8b-instant';
                            
                            if (fallbackModel === ACTIVE_AI_MODEL) {
                                break; // No point in model fallback
                            }
                            
                            try {
                                console.log(`🔄 [AI_PROCESSING] Trying fallback model: ${fallbackModel} with primary API key`);
                                const fallbackModelInstance = new ChatGroq({
                                    model: fallbackModel,
                                    temperature: parseFloat(process.env.AI_TEMPERATURE) || 0.7,
                                    apiKey: API_KEYS[0]
                                });
                                
                                response = await fallbackModelInstance.invoke(messages, getTracingConfig(traceLabel));
                                
                                // Validate fallback response
                                const hasFallbackToolCalls = getToolCallsFromResponse(response).length > 0;
                                // Relaxed validation: Allow empty string content. Only fail if strictly null/undefined.
                                if (!response || ((response.content === null || response.content === undefined) && !hasFallbackToolCalls)) {
                                    console.error('❌ [AI_PROCESSING] Invalid fallback response structure:', response ? Object.keys(response) : 'null');
                                    throw new Error('Invalid response from fallback model');
                                }
                                
                                console.log(`✅ [AI_PROCESSING] Fallback model ${fallbackModel} succeeded!`);
                                responseReceived = true;
                                break;
                            } catch (fallbackError) {
                                console.error(`❌ [AI_PROCESSING] Fallback model ${fallbackModel} also failed:`, fallbackError.message);
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
                console.error(`❌ [AI_PROCESSING] All retry attempts failed`);
                throw lastError || new Error('Failed to get AI response after all retry attempts');
            }

            const toolCalls = getToolCallsFromResponse(response);

            if (toolCalls.length === 0) {
                const finalTextRaw = extractTextFromAIContent(response.content);
                const finalText = typeof finalTextRaw === 'string' ? finalTextRaw.trim() : '';

                console.log(`📥 [AI_PROCESSING] AI Response received`);
                console.log(`📥 [AI_PROCESSING] Response type: ${typeof response.content}`);
                console.log(`📥 [AI_PROCESSING] Response content: "${finalText}"`);

                const directive = parseToolDirectiveFromText(finalText);
                if (directive) {
                    const { toolName, args } = directive;
                    console.log(`[AI_PROCESSING] Detected textual tool directive: ${toolName}`);

                    if (!availableTools[toolName]) {
                        console.warn(`[AI_PROCESSING] Tool ${toolName} from textual directive not found. Returning sanitized output.`);
                        const safeText = sanitizeToolDirectiveOutput(finalText);
                        console.log(`🎯 [AI_PROCESSING] ===== AI PROCESSING COMPLETED =====\n`);
                        return safeText || 'Baik mas, Zoya akan bantu cek ke tim Bosmat.';
                    }

                    messages.push(response);

                    const enrichedArgs = { ...args };
                    if (senderNumber && !enrichedArgs.senderNumber) {
                        enrichedArgs.senderNumber = senderNumber;
                    }
                    if (senderName && !enrichedArgs.senderName) {
                        enrichedArgs.senderName = senderName;
                    }

                    const toolCallId = `${toolName}-directive-${Date.now()}`;
                    console.log(`⚡ [AI_PROCESSING] Executing directive tool ${toolName} dengan args: ${JSON.stringify(enrichedArgs, null, 2)}`);
                    const toolResult = await executeToolCall(toolName, enrichedArgs, {
                        senderNumber,
                        senderName,
                    });
                    console.log(`✅ [AI_PROCESSING] Directive tool ${toolName} completed`);
                    console.log(`📊 [AI_PROCESSING] Directive tool result: ${JSON.stringify(toolResult, null, 2)}`);

                    messages.push(new ToolMessage({
                        tool_call_id: toolCallId,
                        content: JSON.stringify(toolResult),
                    }));

                    iteration += 1;
                    continue;
                }

                console.log(`🎯 [AI_PROCESSING] ===== AI PROCESSING COMPLETED =====\n`);
                return finalText || 'Maaf, saya belum bisa memberikan jawaban.';
            }

            iteration += 1;
            console.log(`🔧 [AI_PROCESSING] ===== TOOL CALLS DETECTED (iteration ${iteration}) =====`);
            console.log(`🔧 [AI_PROCESSING] Number of tool calls: ${toolCalls.length}`);

            messages.push(response);

            for (let i = 0; i < toolCalls.length; i++) {
                const toolCall = toolCalls[i];
                const toolName = toolCall.name;
                let toolArgs = toolCall.args || {};
                if (typeof toolArgs === 'string') {
                    try {
                        toolArgs = JSON.parse(toolArgs);
                    } catch (err) {
                        console.warn(`⚠️ [AI_PROCESSING] Failed to parse tool args string for ${toolName}:`, err.message);
                        toolArgs = {};
                    }
                }
                const toolCallId = toolCall.id || toolCall.tool_call_id || `${toolName}-${Date.now()}-${i}`;

                console.log(`⚡ [AI_PROCESSING] Executing tool ${i + 1}/${toolCalls.length}: ${toolName}`);
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
            }
        }

        console.warn('⚠️ [AI_PROCESSING] Maximum iteration reached without final response.');
        return 'Maaf, saya belum bisa memberikan jawaban.';
    } catch (error) {
        console.error('❌ [AI_PROCESSING] Error getting AI response:', error);
        console.error('❌ [AI_PROCESSING] Error stack:', error.stack);
        return "Maaf, terjadi kesalahan. Silakan coba lagi.";
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
                const modelInstance = apiKeyIndex === 0 ? baseModel : new ChatGroq({
                    model: ACTIVE_AI_MODEL,
                    temperature: parseFloat(process.env.AI_TEMPERATURE) || 0.7,
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

    const analysisNotes = bufferEntry.messages
        .map(m => (m.analysis || '').trim())
        .filter(note => note.length > 0);

    const analysisContext = analysisNotes.length > 0
        ? analysisNotes.map((note, index) => {
            const label = analysisNotes.length > 1 ? `Analisis Gambar ${index + 1}` : 'Analisis Gambar';
            return `${label}:\n${note}`;
        }).join('\n\n')
        : '';

    console.log(`[DEBOUNCED] Processing buffered message for ${senderName}: "${combinedMessage}"`);
    if (analysisContext) {
        console.log(`[DEBOUNCED] ✓ Analisis gambar tersedia untuk ${senderName}`);
        console.log(`[DEBOUNCED] Analisis (internal):\n${analysisContext}`);
    }

    try {
        const typingDelay = 500 + Math.random() * 1000;
        await delay(typingDelay);
        await client.startTyping(senderNumber);

        // Get AI response with memory
        const aiContext = analysisContext
            ? `Informasi internal dari analisis gambar (jangan sebutkan proses analisis). Gunakan poin-poin ini sebagai referensi:
${analysisContext}`
            : '';

        const aiResponse = await getAIResponse(combinedMessage, senderName, senderNumber, aiContext);
        
        // Save to Firebase if available
        if (db) {
            await saveMessageToFirestore(senderNumber, combinedMessage, 'user');
            await saveMessageToFirestore(senderNumber, aiResponse, 'ai');
        }

        // Send response back to user
        if (aiResponse) {
            const chunks = aiResponse.split('\n\n');
            for (const chunk of chunks) {
                if (chunk.trim()) {
                    await delay(1500 + Math.random() * 1000);
                    await client.sendText(senderNumber, chunk.trim());
                }
            }
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

    client.onMessage(async (msg) => {
        if (msg.from === 'status@broadcast' || msg.fromMe) {
            return;
        }

        const senderNumber = msg.from;
        const senderName = msg.sender.pushname || msg.notifyName || senderNumber;
        let messageContent = msg.body;
        const isMedia = msg.isMedia || msg.type === 'image' || msg.type === 'document';
        const isImage = msg.type === 'image';
        const isLocation = msg.type === 'location';

        if (!messageContent && !isMedia && !isLocation) return;

        // Log different types of messages
        if (isLocation) {
            console.log(`[BUFFER] 📍 Location received from ${senderName}. Lat: ${msg.lat || msg.latitude}, Lng: ${msg.lng || msg.longitude}`);
        } else if (isImage) {
            console.log(`[BUFFER] 📸 Image received from ${senderName}. Caption: "${msg.caption || 'No caption'}"`);
        } else if (isMedia) {
            console.log(`[BUFFER] 📎 Media received from ${senderName}. Type: ${msg.type}`);
        } else {
            console.log(`[BUFFER] 💬 Text received from ${senderName}: "${messageContent}"`);
        }
        
        // Save sender metadata
        await saveSenderMeta(senderNumber, senderName);

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

        if (await isSnoozeActive(senderNumber)) {
            const storedContent = (() => {
                if (messageContent && messageContent.trim()) {
                    return messageContent.trim();
                }
                if (isImage) {
                    const captionText = (msg.caption || '').trim();
                    return captionText || '[Gambar diterima]';
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

        if (isImage) {
            const captionText = (msg.caption || '').trim();

            try {
                console.log(`[VISION] 🔄 Mengunduh gambar dari ${senderName}...`);
                const imageBuffer = await client.decryptFile(msg);
                console.log(`[VISION] ✅ Gambar terunduh (${imageBuffer.length} bytes, mimetype: ${msg.mimetype || 'unknown'})`);

                analysisResult = await analyzeImageWithGemini(
                    imageBuffer,
                    msg.mimetype || 'image/jpeg',
                    captionText,
                    senderName
                );
            } catch (error) {
                console.error(`[VISION] ❌ Gagal memproses gambar dari ${senderName}:`, error);
                analysisResult = 'Analisis gambar otomatis gagal.';
            }

            messageContent = captionText || '[Gambar diterima]';
        }

        const messageEntry = {
            content: messageContent || (isImage ? '[Gambar diterima]' : `[${msg.type}]`),
            isMedia,
            isImage,
            originalMsg: msg,
        };

        if (analysisResult) {
            messageEntry.analysis = analysisResult;
        }

        if (locationContext) {
            messageEntry.location = locationContext;
        }

        entry.messages.push(messageEntry);
        pendingMessages.set(senderNumber, entry);

        debounceQueue.schedule(senderNumber, messageEntry);
    });

    client.onStateChange((state) => {
        console.log('WhatsApp State changed:', state);
        if ('CONFLICT'.includes(state)) client.useHere();
        if ('UNPAIRED'.includes(state)) console.log('WhatsApp logged out');
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
        }, { merge: true });
    } catch (error) {
        console.error('Error saving to Firestore:', error);
    }
}

async function saveSenderMeta(senderNumber, displayName) {
    if (!db) return;
    
    const { docId, channel, platformId } = parseSenderIdentity(senderNumber);
    if (!docId) {
        return;
    }

    try {
        const metaRef = db.collection('directMessages').doc(docId);
        await metaRef.set({
            name: displayName,
            channel,
            platform: channel,
            platformId: platformId || docId,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
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
            const identity = parseSenderIdentity(doc.id);
            const senderNumberFull = identity.normalizedAddress;
            const snoozeInfo = await getSnoozeInfo(senderNumberFull);

            const storedChannel = typeof data.channel === 'string' ? data.channel.toLowerCase() : null;
            const effectiveChannel = storedChannel && storedChannel !== 'unknown'
                ? storedChannel
                : identity.channel || 'whatsapp';

            return {
                id: doc.id,
                senderNumber: doc.id,
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

app.use('/webhooks/meta', metaWebhookRouter);

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'WhatsApp AI Chatbot',
        provider: 'Groq',
        model: process.env.AI_MODEL || 'llama-3.3-70b-versatile',
        visionModel: ACTIVE_VISION_MODEL,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

app.get('/conversations', async (req, res) => {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit, 10) : 100;
        const conversations = await listConversations(limit);
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
        
        const dataUri = `data:${mimetype};base64,${base64}`;
        await global.whatsappClient.sendFile(`${number}@c.us`, dataUri, filename || 'file', caption || '');
        console.log(`[API] Successfully sent media to ${number}`);
        res.status(200).json({ success: true });
    } catch (e) {
        console.error('[API] Error sending media:', e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/test-ai', async (req, res) => {
    try {
        const { message, senderNumber } = req.body;
        const testMessage = message || "Hello, test message";
        const testSenderNumber = senderNumber || null;
        
        const response = await getAIResponse(testMessage, "Test User", testSenderNumber);
        
        res.json({
            input: testMessage,
            ai_response: response,
            memory_enabled: !!testSenderNumber,
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
        const historyLimit = limit ? parseInt(limit) : MEMORY_CONFIG.maxMessages;

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

        const numeric = number.replace(/[^0-9]/g, '');
        if (!numeric) {
            return res.status(400).json({ error: 'Number is invalid.' });
        }
        const senderNumber = `${numeric}@c.us`;

        if (enabled) {
            await clearSnoozeMode(senderNumber);
        } else {
            const hasDuration = typeof durationMinutes === 'number' && durationMinutes > 0;
            const manual = !hasDuration;
            const effectiveDuration = hasDuration ? durationMinutes : 60;
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

// --- Server Startup ---
server.listen(PORT, '0.0.0.0', async () => {
    console.log(`🚀 WhatsApp AI Chatbot listening on http://0.0.0.0:${PORT}`);
    console.log(`🤖 AI Provider: Groq`);
    console.log(`🤖 AI Model: ${process.env.AI_MODEL || 'llama-3.3-70b-versatile'}`);
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
    const whatsappHeadless = process.env.WHATSAPP_HEADLESS === 'true';
    
    // Force false untuk production (jika env tidak di-set atau bukan 'true', maka false)
    const shouldAutoClose = process.env.WHATSAPP_AUTO_CLOSE === 'true';
    
    console.log(`🔧 WhatsApp Config: AUTO_CLOSE=${shouldAutoClose} (env: "${process.env.WHATSAPP_AUTO_CLOSE}"), HEADLESS=${whatsappHeadless}`);
    
    wppconnect.create({
        session: sessionName,
        catchQR: (base64Qr, asciiQR) => { 
            console.log('📱 WhatsApp QR Code:');
            console.log(asciiQR); 
            console.log('Base64 QR:', base64Qr); 
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
            }
        },
        headless: whatsappHeadless,
        logQR: true,
        autoClose: shouldAutoClose, // Hanya true jika env var eksplisit 'true'
        disableWelcome: true, // Disable welcome message
        sessionDataPath,
        puppeteerOptions: {
            timeout: 120000,
            args: PUPPETEER_CHROME_ARGS,
            defaultViewport: PUPPETEER_VIEWPORT,
        },
    })
    .then((client) => {
        global.whatsappClient = client;
        start(client);
        startBookingReminderScheduler();
        console.log('✅ WhatsApp client initialized successfully!');
    })
    .catch((error) => {
        console.error('❌ WhatsApp initialization error:', error);
    });
});

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
