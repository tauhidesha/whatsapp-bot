/**
 * WhatsApp AI Chatbot dengan LangChain dan Gemini
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
const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { HumanMessage, SystemMessage, ToolMessage, AIMessage } = require('@langchain/core/messages');
const { getMotorSizeDetailsTool } = require('./src/ai/tools/getMotorSizeDetailsTool.js');
const { getSpecificServicePriceTool } = require('./src/ai/tools/getSpecificServicePriceTool.js');
const { listServicesByCategoryTool } = require('./src/ai/tools/listServicesByCategoryTool.js');
const { getStudioInfoTool } = require('./src/ai/tools/getStudioInfoTool.js');
const { checkBookingAvailabilityTool } = require('./src/ai/tools/checkBookingAvailabilityTool.js');
const { createBookingTool } = require('./src/ai/tools/createBookingTool.js');
const { getCurrentDateTimeTool } = require('./src/ai/tools/getCurrentDateTimeTool.js');
const { updateBookingTool } = require('./src/ai/tools/updateBookingTool.js');
const { triggerBosMatTool } = require('./src/ai/tools/triggerBosMatTool.js');
const { calculateHomeServiceFeeTool } = require('./src/ai/tools/calculateHomeServiceFeeTool.js');
const { sendStudioPhotoTool } = require('./src/ai/tools/sendStudioPhotoTool.js');
const { notifyVisitIntentTool } = require('./src/ai/tools/notifyVisitIntentTool.js');
const { createMetaWebhookRouter } = require('./src/server/metaWebhook.js');
const { sendMetaMessage } = require('./src/server/metaClient.js');
const { startBookingReminderScheduler } = require('./src/ai/utils/bookingReminders.js');
const { isSnoozeActive, setSnoozeMode, clearSnoozeMode, getSnoozeInfo } = require('./src/ai/utils/humanHandover.js');
const { getLangSmithCallbacks } = require('./src/ai/utils/langsmith.js');
const { generateVisionAnalysis } = require('./src/ai/vision/geminiVision.js');
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
    getStudioInfo: getStudioInfoTool.implementation,
    checkBookingAvailability: checkBookingAvailabilityTool.implementation,
    createBooking: createBookingTool.implementation,
    getCurrentDateTime: getCurrentDateTimeTool.implementation,
    updateBooking: updateBookingTool.implementation,
    triggerBosMatTool: triggerBosMatTool.implementation,
    calculateHomeServiceFee: calculateHomeServiceFeeTool.implementation,
    sendStudioPhoto: sendStudioPhotoTool.implementation,
    notifyVisitIntent: notifyVisitIntentTool.implementation,
};

const toolDefinitions = [
    getMotorSizeDetailsTool.toolDefinition,
    getSpecificServicePriceTool.toolDefinition,
    listServicesByCategoryTool.toolDefinition,
    getStudioInfoTool.toolDefinition,
    checkBookingAvailabilityTool.toolDefinition,
    createBookingTool.toolDefinition,
    getCurrentDateTimeTool.toolDefinition,
    updateBookingTool.toolDefinition,
    triggerBosMatTool.toolDefinition,
    calculateHomeServiceFeeTool.toolDefinition,
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
console.log(`🤖 [STARTUP] Model: ${process.env.AI_MODEL || 'gemini-1.5-flash'}`);
console.log(`🤖 [STARTUP] Temperature: ${parseFloat(process.env.AI_TEMPERATURE) || 0.7}`);
console.log(`🤖 [STARTUP] Tools available: ${toolDefinitions.length} tools`);

const ACTIVE_AI_MODEL = process.env.AI_MODEL || 'gemini-2.5-pro';
// Vision default: gunakan Gemini 2.5 Pro (multimodal). Bisa override via VISION_MODEL/IMAGE_MODEL.
const ACTIVE_VISION_MODEL = process.env.VISION_MODEL || process.env.IMAGE_MODEL || 'gemini-2.5-pro';
const FALLBACK_VISION_MODEL = process.env.VISION_FALLBACK_MODEL || 'gemini-2.5-flash';

const baseModel = new ChatGoogleGenerativeAI({
    model: ACTIVE_AI_MODEL,
    temperature: parseFloat(process.env.AI_TEMPERATURE) || 0.7,
    apiKey: process.env.GOOGLE_API_KEY
});

const geminiToolSpecifications = toolDefinitions.map(tool => {
    if (tool.function) {
        return {
            name: tool.function.name,
            description: tool.function.description,
            parameters: tool.function.parameters
        };
    }

    return tool;
});

const aiModel = baseModel.bindTools(geminiToolSpecifications);

console.log('✅ [STARTUP] AI Model initialized with native tool calling support');
console.log(`🤖 [STARTUP] Active AI model: ${ACTIVE_AI_MODEL}`);

console.log(`🖼️ [STARTUP] Vision analysis target models: ${[ACTIVE_VISION_MODEL, FALLBACK_VISION_MODEL].filter(Boolean).join(', ')}`);

const SYSTEM_PROMPT = `Anda adalah **Zoya**, asisten AI Bosmat Repainting and Detailing Studio. Responsif, ramah, profesional.
Bosmat Studio berlokasi di bukit cengkeh 1, cimanggis - depok
⚠️ **ATURAN MUTLAK**: Untuk pertanyaan lokasi, jam buka, garansi, kontak → HARUS gunakan searchKnowledgeBase tool.
⚙️ **Tool Calling**: Gunakan tools LangChain yang tersedia (function calling) sebelum memberi jawaban akhir saat butuh data spesifik. Jangan pernah menebak data; panggil tool lalu rangkum hasilnya.

## Gaya Bahasa
- WhatsApp natural: *tebal*, _miring_, • bullet
- Panggil "mas", maksimal 2-6 kalimat
- Format tanpa quote (>) atau markdown berlebihan

## Workflow Internal (Tidak Tampil ke Pelanggan)

1. **Analisa**: Identifikasi kebutuhan (detailing/coating/repaint/promo/booking)
2. **Data Motor**: Gunakan getMotorSizeDetails (wajib panggil tool sebelum menyebut ukuran).
3. **Info Layanan**:
   - Daftar layanan kategori tertentu: listServicesByCategory ({"category"})
   - Harga layanan spesifik: getSpecificServicePrice ({"service_name","size"}) — selalu cek ukuran motor dahulu.
   - Deskripsi umum: getServiceDescription
4. **Info Umum Studio**: getStudioInfo untuk alamat/jam/kontak/booking policy (patokan rumah hijau No. B3/2 dekat portal Jl. Medan). Jika pelanggan sudah dekat dan masih bingung, kirim foto studio dengan sendStudioPhoto. Jika data kurang, gunakan searchKnowledgeBase.
5. **Promo**: getPromoBundleDetails (KHUSUS REPAINT: tawarkan bundling dulu)
6. **Repaint**: updateRepaintDetailsTool untuk warna/bagian
7. **Booking**: checkBookingAvailability → findNextAvailableSlot → createBooking
8. **Edit Booking**: updateBooking jika user ingin mengganti jadwal/layanan/status booking yang sudah ada.
9. **Home Service**: calculateHomeServiceFee untuk menghitung jarak & biaya tambahan jika pelanggan minta servis ke lokasi (butuh share location).
10. **Tanggal/Waktu**: getCurrentDateTime jika butuh informasi waktu aktual.
11. **Ragu**: triggerBosMatTool untuk eskalasi ke BosMat (handover manual).

## Layanan Utama
**Repaint**: Bodi Halus/Kasar, Velg, Cover CVT/Arm
**Detailing/Coating**: Detailing Mesin, Cuci Komplit, Poles Bodi Glossy, Full Detailing Glossy, Coating Motor Doff/Glossy, Complete Service Doff/Glossy (selalu gali kondisi motor: tanyakan area yang bermasalah, apakah cat doff/glossy, dan minta foto terbaru jika user ragu)
**Layanan Tambahan**:
- Inspeksi gratis ke rumah (semua layanan)
- Home service on-site khusus detailing/coating/cuci (repaint wajib ke workshop)
- Layanan jemput-antar motor tersedia untuk detailing dan repaint (jelaskan syarat/biaya tambahan)

## Booking Requirements
Nama, No HP, Motor, Tanggal, Jam, Layanan

## Studio Visit Policy
- Semua pengerjaan layanan Bosmat wajib melalui booking resmi sebelum eksekusi.
- Jika pelanggan hanya mau konsultasi di studio tanpa booking, jelaskan bahwa harus kabari jadwal kedatangannya terlebih dahulu karena BosMat bisa saja tidak ada di tempat.
- Kumpulkan estimasi hari/jam kedatangan dan tujuan konsultasi. Setelah pelanggan mengonfirmasi, panggil notifyVisitIntent tool (sertakan detail waktu/tujuan) untuk mengirim notifikasi ke BosMat agar bisa standby.
- Bila konsultasi butuh tindak lanjut manual atau ada hal di luar template, gunakan triggerBosMatTool setelah notifikasi dikirim.

## Rules
- Hanya bahas topik Bosmat
- Repaint: tawarkan promo bundling dulu. Tekankan bahwa pengerjaan repaint wajib di workshop (tidak ada home service) tetapi tersedia layanan jemput-antar. Saat user bingung memilih paket, gali kondisi motor (cat kusam, baret, jamur, dsb), minta kirim foto jika memungkinkan, lalu bandingkan opsi berdasarkan kondisi tersebut. Selalu sebutkan pilihan jemput-antar jika user tidak bisa datang sendiri.
- Jika jenis motor belum diketahui, tanyakan terlebih dahulu jenis motornya.
- Ada perbedaan layanan untuk jenis cat motor, jadi baiknya tanyakan motornya cat doff atau glossy.
- Saat pelanggan bilang masih bingung, bantu analisis: tanya gejala/kondisi motor atau minta foto. Jika masih ragu, tawarkan inspeksi gratis (datang ke workshop atau home visit jika area tercover) sebelum menawarkan konsultasi tim Bosmat.
- Saat pelanggan butuh konsultasi atau penjadwalan, tawarkan inspeksi gratis (workshop/home visit), home service (detailing/coating/cuci), serta jemput-antar (detailing & repaint). Jelaskan syarat atau biaya tambahan jika ada (gunakan calculateHomeServiceFee bila perlu).
- Pertanyaan di luar konteks → triggerBosMatTool
- Bingung pilih warna: tawarkan konsultasi Bosmat atau pilih di studio
- TIDAK mengarang info, gunakan tools
- Pertanyaan lokasi/jam/kontak/booking → panggil getStudioInfo (tambahkan searchKnowledgeBase bila butuh verifikasi tambahan). Saat pelanggan sudah dekat lokasi, jelaskan ciri rumah hijau No. B3/2 dekat portal Jl. Medan dan tawarkan kirim foto via sendStudioPhoto.
- Jika user meminta harga/ukuran layanan, WAJIB gunakan getMotorSizeDetails lalu getSpecificServicePrice sebelum menjawab.
- Jangan menunda dengan kalimat seperti "sebentar". Setelah tool pertama memberikan data (mis. ukuran motor), langsung panggil tool lanjutan yang dibutuhkan (mis. harga) pada iterasi yang sama sebelum memberi jawaban akhir.
- Jika user minta jadwal/booking slot, cek dengan checkBookingAvailability sebelum menawarkan waktu.
- Setelah user setuju dengan jadwal, panggil createBooking untuk mencatat detail booking.
- Jika butuh tanggal/hari/jam saat ini, panggil getCurrentDateTime.
- Jika user ingin mengubah booking, verifikasi ID booking dan gunakan updateBooking sesuai permintaan.
- Sebelum menjalankan createBooking, updateBooking, atau triggerBosMatTool, konfirmasi detail dan minta persetujuan eksplisit dari user.
- Sebelum menjalankan createBooking atau updateBooking, konfirmasi ulang ke user bahwa detail sudah benar dan tunggu persetujuan eksplisit.
- Setelah tool dipanggil dan hasil diterima, baru berikan jawaban akhir ringkas.

Output: Pesan WhatsApp natural hasil reasoning (reasoning tidak ditampilkan). Jika tool dibutuhkan, panggil tool dulu, tunggu hasil, lalu beri jawaban final berdasarkan data tool.`;

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
    maxMessages: parseInt(process.env.MEMORY_MAX_MESSAGES) || 10,
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
            if (metadata.senderNumber && !preparedArgs.senderNumber) {
                preparedArgs.senderNumber = metadata.senderNumber;
            }
            if (metadata.senderName && !preparedArgs.senderName) {
                preparedArgs.senderName = metadata.senderName;
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
    return text.replace(/tool_code[\s\S]*$/i, '').trim();
}

async function analyzeImageWithGemini(imageBuffer, mimeType = 'image/jpeg', caption = '', senderName = 'User') {
    const base64Image = imageBuffer.toString('base64');
    const systemPrompt = 'Anda adalah Zoya, asisten Bosmat. Analisis foto motor pengguna, jelaskan kondisi, kerusakan, kebersihan, dan rekomendasi perawatan secara singkat dalam bahasa Indonesia. Fokus pada hal yang benar-benar terlihat dan hindari asumsi. ## Layanan Utama Repaint**: Bodi Halus/Kasar, Velg, Cover CVT/Arm Detailing/Coating**: Detailing Mesin, Cuci Komplit, Poles Bodi Glossy, Full Detailing Glossy, Coating Motor Doff/Glossy, Complete Service Doff/Glossy';
    const textPrompt = `Analisis foto motor dari ${senderName}. ${caption ? `Caption pengguna: ${caption}.` : ''} Sebutkan poin penting dalam 2-3 kalimat. Jika ada noda/baret/kerusakan, jelaskan singkat dan rekomendasikan treatment Bosmat yang relevan.`;

    const fallbackChain = ['gemini-2.5-flash', 'gemini-1.5-flash-vision'];
    const modelsToTry = Array.from(
        new Set([
            ACTIVE_VISION_MODEL,
            FALLBACK_VISION_MODEL,
            ...fallbackChain
        ].filter(Boolean))
    );

    for (const modelName of modelsToTry) {
        try {
            console.log(`[VISION] 🔍 Analysing image using ${modelName}...`);
            const { text } = await generateVisionAnalysis({
                model: modelName,
                apiKey: process.env.GOOGLE_API_KEY,
                base64Image,
                mimeType,
                systemPrompt,
                userPrompt: textPrompt,
            });

            if (text) {
                console.log(`[VISION] ✅ Analysis complete with ${modelName}`);
                return text;
            }
        } catch (error) {
            console.error(`[VISION] ❌ ${modelName} failed:`, error?.message || error);
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
            response = await aiModel.invoke(messages, getTracingConfig(traceLabel));

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

        const response = await baseModel.invoke([
            new SystemMessage(ADMIN_MESSAGE_REWRITE_STYLE_PROMPT),
            new HumanMessage(prompt),
        ], getTracingConfig('admin-message-rewrite'));

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
        model: process.env.AI_MODEL || 'gemini-1.5-flash',
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
    console.log(`🤖 AI Model: ${process.env.AI_MODEL || 'gemini-1.5-flash'}`);
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
    wppconnect.create({
        session: sessionName,
        catchQR: (base64Qr, asciiQR) => { 
            console.log('📱 WhatsApp QR Code:');
            console.log(asciiQR); 
            console.log('Base64 QR:', base64Qr); 
        },
        statusFind: (statusSession, session) => {
            console.log('📱 WhatsApp Status:', statusSession, 'Session:', session);
        },
        headless: process.env.WHATSAPP_HEADLESS === 'true',
        logQR: true,
        autoClose: process.env.WHATSAPP_AUTO_CLOSE === 'true',
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
