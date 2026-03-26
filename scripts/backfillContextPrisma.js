#!/usr/bin/env node
/**
 * Backfill script for CustomerContext in Prisma (PostgreSQL).
 * Analyzes conversation history for each customer and extracts CRM facts.
 */

require('dotenv').config();
const prisma = require('../src/lib/prisma');
const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { HumanMessage } = require('@langchain/core/messages');
const { mergeAndSaveContext } = require('../src/ai/utils/mergeCustomerContext.js');

const MODEL_NAME = 'gemini-flash-lite-latest';

const BULK_EXTRACTOR_PROMPT = `Kamu adalah data extractor untuk sistem CRM bengkel motor Bosmat.
Tugasmu adalah menganalisis riwayat percakapan antara pelanggan dan AI (Zoya) untuk mengekstrak fakta penting ke dalam database CRM.

RIWAYAT PERCAKAPAN:
{messages}

TUGAS:
Ekstrak informasi berikut ke dalam format JSON (isi null atau array kosong jika tidak ditemukan):
{
  "motor_model": "Contoh: Yamaha NMAX",
  "motor_plate": "Contoh: B 1234 ABC",
  "motor_year": "Tahun motor jika ada",
  "motor_color": "Warna motor",
  "motor_condition": "Kondisi motor (lecet, kusam, baret, dll)",
  "target_services": ["Layanan yang diminati user"],
  "service_detail": "Detail tambahan layanan",
  "budget_signal": "oke/ketat/null",
  "detected_intents": ["tanya_harga", "tanya_lokasi", "mulai_booking", "tanya_teknis", "tanya_layanan", "lainnya"],
  "is_changing_topic": false,
  "said_expensive": null,
  "asked_price": null,
  "asked_availability": null,
  "shared_photo": null,
  "preferred_day": null,
  "preferred_time": null,
  "location_hint": null,
  "quoted_services": [],
  "quoted_total_normal": null,
  "quoted_total_bundling": null,
  "quoted_at": null,
  "conversation_stage": "greeting/qualifying/consulting/upselling/booking/closing/done",
  "last_ai_action": "Aksi terakhir AI",
  "upsell_offered": null,
  "upsell_accepted": null,
  "butuh_bantuan_admin": false,
  "conversation_summary": "Ringkasan percakapan dalam 1-2 kalimat padat."
}

PETUNJUK:
1. Analisis seluruh chat untuk mendapatkan gambaran lengkap.
2. Identifikasi mana yang User dan mana yang AI (Zoya). Zoya biasanya menyapa ramah, menyebut nama user, dan menawarkan layanan Bosmat.
3. Untuk quoted_services, ambil harga terakhir yang diberikan AI.
4. target_services: Gabungkan semua layanan yang pernah diminati user dalam satu array.
5. Jangan mengarang informasi.
6. Kembalikan JSON saja. Tidak ada teks lain.`;

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanFloat(val) {
    if (val === null || val === undefined || val === '') return null;
    if (typeof val === 'number') return val;
    // Remove currency and commas if string
    const cleaned = String(val).replace(/[^0-9.]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
}

function parseExtractedJSON(text) {
    if (!text || typeof text !== 'string') return null;
    let cleaned = text.trim();
    if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }
    try {
        const parsed = JSON.parse(cleaned);
        // Sanitize numeric fields
        if (parsed) {
            parsed.quoted_total_normal = cleanFloat(parsed.quoted_total_normal);
            parsed.quoted_total_bundling = cleanFloat(parsed.quoted_total_bundling);
            // Ensure quoted_services price is also float if it's an array of objects
            if (Array.isArray(parsed.quoted_services)) {
                parsed.quoted_services = parsed.quoted_services.map(s => {
                    if (s && typeof s === 'object') {
                        return { ...s, price: cleanFloat(s.price) };
                    }
                    return s;
                });
            }
        }
        return parsed;
    } catch (e) {
        console.warn('Failed to parse JSON:', e.message);
        return null;
    }
}

async function backfill() {
    console.log('🔄 Starting CustomerContext Backfill (Prisma)');
    
    // Parse arguments
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const limitArg = args.find(a => a.startsWith('--limit='));
    const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 1000;
    const phoneArg = args.find(a => a.startsWith('--phone='));
    const phoneFilter = phoneArg ? phoneArg.split('=')[1] : null;

    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('❌ Missing GOOGLE_API_KEY');
        process.exit(1);
    }

    const model = new ChatGoogleGenerativeAI({
        model: MODEL_NAME,
        temperature: 0,
        apiKey
    });

    // 1. Get customers
    const where = phoneFilter ? { phone: phoneFilter } : {};
    const customers = await prisma.customer.findMany({
        where,
        take: limit,
        orderBy: { updatedAt: 'desc' }
    });

    console.log(`📋 Found ${customers.length} customers to process.`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < customers.length; i++) {
        const customer = customers[i];
        console.log(`\n[${i + 1}/${customers.length}] Processing ${customer.phone} (${customer.name || 'No Name'})...`);

        try {
            // 2. Get messages
            const messages = await prisma.directMessage.findMany({
                where: { customerId: customer.id },
                orderBy: { createdAt: 'asc' },
                take: 100 // Last 100 messages should be enough for context
            });

            if (messages.length === 0) {
                console.log(`   ⏭️  No messages found, skipping.`);
                continue;
            }

            console.log(`   📨 Found ${messages.length} messages.`);

            // 3. Format messages for prompt
            const formattedMessages = messages.map(m => {
                const ts = m.createdAt.toISOString();
                return `[${ts}] ${m.role === 'assistant' ? 'AI (Zoya)' : 'Message'}: ${m.content}`;
            }).join('\n');

            // 4. Extract context
            const prompt = BULK_EXTRACTOR_PROMPT.replace('{messages}', formattedMessages);
            const response = await model.invoke([new HumanMessage(prompt)]);
            const extracted = parseExtractedJSON(response.content);

            if (extracted) {
                console.log(`   ✨ Extracted facts for: ${extracted.motor_model || 'Unknown Motor'}, Summary: ${extracted.conversation_summary}`);
                
                if (!dryRun) {
                    await mergeAndSaveContext(customer.phone, extracted);
                    successCount++;
                } else {
                    console.log(`   🧪 [DRY RUN] Would save context for ${customer.phone}`);
                }
            } else {
                console.warn(`   ⚠️  Failed to extract valid JSON.`);
                errorCount++;
            }

            // Rate limit delay
            await delay(1000);
        } catch (error) {
            console.error(`   ❌ Error: ${error.message}`);
            errorCount++;
        }
    }

    console.log(`\n✅ Backfill completed.`);
    console.log(`   Success: ${successCount}`);
    console.log(`   Errors: ${errorCount}`);
    if (dryRun) console.log(`   ⚠️  Initial dry run mode — no data saved.`);
}

backfill()
    .then(() => prisma.$disconnect())
    .catch(err => {
        console.error('Fatal error:', err);
        prisma.$disconnect();
        process.exit(1);
    });
