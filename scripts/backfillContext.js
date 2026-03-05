#!/usr/bin/env node
// File: scripts/backfillContext.js
// One-time script untuk proses conversation history yang sudah ada di Firestore.
// Jalankan: node scripts/backfillContext.js [--dry-run] [--limit N]
//
// Opsi:
//   --dry-run    Hanya tampilkan hasil extraction tanpa menyimpan ke Firestore
//   --limit N    Batasi jumlah conversations yang diproses (default: semua)

require('dotenv').config();
const admin = require('firebase-admin');

// Initialize Firebase — same logic as app.js
if (!admin.apps.length) {
    const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
    if (serviceAccountBase64) {
        const serviceAccountJson = Buffer.from(serviceAccountBase64, 'base64').toString('utf-8');
        const serviceAccount = JSON.parse(serviceAccountJson);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
    } else {
        const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
        if (serviceAccountJson) {
            const serviceAccount = JSON.parse(serviceAccountJson);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
            });
        }
    }

    // Fallback: Application Default Credentials
    if (admin.apps.length === 0) {
        console.log('⚠️ Trying Application Default Credentials...');
        admin.initializeApp();
    }
}

const db = admin.firestore();

// Parse CLI args
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const limitIndex = args.indexOf('--limit');
const limit = limitIndex !== -1 ? parseInt(args[limitIndex + 1], 10) : null;

// Dynamically import the extractor (ESM-compat)
const { extractAndSaveContext, buildPrompt, parseExtractedJSON, EXTRACTOR_MODEL } = require('../src/ai/agents/contextExtractor.js');
const { mergeAndSaveContext } = require('../src/ai/utils/mergeCustomerContext.js');
const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { HumanMessage } = require('@langchain/core/messages');

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Pair consecutive user + ai messages into turns.
 */
function pairMessages(messageDocs) {
    const turns = [];
    let pendingUser = null;

    for (const doc of messageDocs) {
        const data = doc.data();
        const sender = data.sender;
        const text = data.text || '';

        if (sender === 'user') {
            pendingUser = text;
        } else if ((sender === 'ai') && pendingUser) {
            turns.push({
                userMessage: pendingUser,
                aiReply: text,
            });
            pendingUser = null;
        }
    }

    return turns;
}

async function backfillAllConversations() {
    console.log('🔄 Backfill Context Extractor');
    console.log(`   Mode: ${isDryRun ? 'DRY RUN (no writes)' : 'LIVE'}`);
    console.log(`   Limit: ${limit || 'all'}`);
    console.log(`   Model: ${EXTRACTOR_MODEL}`);
    console.log('');

    const conversationsSnap = await db.collection('directMessages').get();
    let docs = conversationsSnap.docs;

    if (limit && limit > 0) {
        docs = docs.slice(0, limit);
    }

    console.log(`📋 Found ${conversationsSnap.size} conversations, processing ${docs.length}`);
    console.log('');

    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('❌ No API key found (GOOGLE_API_KEY or GEMINI_API_KEY)');
        process.exit(1);
    }

    const model = new ChatGoogleGenerativeAI({
        model: EXTRACTOR_MODEL,
        temperature: 0,
        apiKey,
    });

    let totalProcessed = 0;
    let totalTurns = 0;
    let totalErrors = 0;

    for (let i = 0; i < docs.length; i++) {
        const conv = docs[i];
        const convId = conv.id;
        const convData = conv.data() || {};
        const displayName = convData.name || convId;

        console.log(`\n[${i + 1}/${docs.length}] Processing: ${displayName} (${convId})`);

        try {
            const messagesSnap = await conv.ref
                .collection('messages')
                .orderBy('timestamp', 'asc')
                .get();

            if (messagesSnap.empty) {
                console.log('   ⏭️  No messages, skipping');
                continue;
            }

            const turns = pairMessages(messagesSnap.docs);
            console.log(`   📨 ${messagesSnap.size} messages → ${turns.length} turns`);

            if (turns.length === 0) {
                console.log('   ⏭️  No valid user+ai pairs, skipping');
                continue;
            }

            // Process each turn
            for (let t = 0; t < turns.length; t++) {
                const turn = turns[t];

                try {
                    const prompt = buildPrompt(turn.userMessage, turn.aiReply);
                    const response = await model.invoke([new HumanMessage(prompt)]);

                    const responseText = typeof response.content === 'string'
                        ? response.content
                        : (Array.isArray(response.content)
                            ? response.content.map(c => c.text || c).join('')
                            : String(response.content));

                    const extracted = parseExtractedJSON(responseText);

                    if (extracted) {
                        // Count non-null fields
                        const filledFields = Object.entries(extracted)
                            .filter(([_, v]) => v !== null && v !== undefined && v !== '')
                            .map(([k]) => k);

                        if (filledFields.length > 0) {
                            console.log(`   Turn ${t + 1}/${turns.length}: ${filledFields.join(', ')}`);

                            if (!isDryRun) {
                                const senderNumber = convData.fullSenderId || `${convId}@c.us`;
                                await mergeAndSaveContext(senderNumber, extracted);
                            }
                        } else {
                            console.log(`   Turn ${t + 1}/${turns.length}: (no data extracted)`);
                        }

                        totalTurns++;
                    } else {
                        console.log(`   Turn ${t + 1}/${turns.length}: ⚠️ Invalid JSON response`);
                    }

                    // Rate limit delay
                    await delay(500);
                } catch (turnError) {
                    console.error(`   Turn ${t + 1}/${turns.length}: ❌ ${turnError.message}`);
                    totalErrors++;
                    await delay(1000); // Longer delay on error
                }
            }

            totalProcessed++;
            console.log(`   ✅ Done`);
        } catch (convError) {
            console.error(`   ❌ Error processing conversation: ${convError.message}`);
            totalErrors++;
        }
    }

    console.log('\n' + '='.repeat(50));
    console.log(`✅ Backfill complete!`);
    console.log(`   Conversations processed: ${totalProcessed}`);
    console.log(`   Turns processed: ${totalTurns}`);
    console.log(`   Errors: ${totalErrors}`);
    if (isDryRun) {
        console.log(`   ⚠️  DRY RUN — no data was written to Firestore`);
    }
}

backfillAllConversations()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('❌ Fatal error:', err);
        process.exit(1);
    });
