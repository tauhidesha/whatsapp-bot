// scripts/backfillAdminMessages.js
// One-time script: sync semua chat history admin dari HP ke Firestore
// Usage:
//   node scripts/backfillAdminMessages.js --dry-run
//   node scripts/backfillAdminMessages.js --limit 20
//   node scripts/backfillAdminMessages.js

require('dotenv').config();
const admin = require('firebase-admin');

// Firebase init
if (!admin.apps.length) {
    const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
    if (serviceAccountBase64) {
        const serviceAccount = JSON.parse(
            Buffer.from(serviceAccountBase64, 'base64').toString('utf-8')
        );
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    } else {
        admin.initializeApp();
    }
}

const db = admin.firestore();

const isDryRun = process.argv.includes('--dry-run');
const limitArg = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1]) : null;
const DELAY_MS = 300; // Delay antar request untuk hindari rate limit

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function backfillAdminMessages(whatsappClient) {
    console.log(`\n🔄 [Backfill] Starting admin message sync...`);
    console.log(`📋 [Backfill] Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}`);
    if (LIMIT) console.log(`📋 [Backfill] Limit: ${LIMIT} conversations`);

    // 1. Ambil semua conversations dari Firestore
    const snapshot = await db.collection('directMessages').get();
    let conversations = snapshot.docs;

    if (LIMIT) {
        conversations = conversations.slice(0, LIMIT);
    }

    console.log(`📊 [Backfill] Found ${conversations.length} conversations to process\n`);

    let totalSynced = 0;
    let totalSkipped = 0;
    let totalError = 0;

    for (const convDoc of conversations) {
        const docId = convDoc.id;
        const data = convDoc.data();
        const fullSenderId = data.fullSenderId || docId;

        try {
            console.log(`\n👤 Processing: ${data.name || docId} (${fullSenderId})`);

            // 2. Ambil semua pesan di chat ini dari WPPConnect
            const chatMessages = await whatsappClient.getAllMessagesInChat(
                fullSenderId,
                true,  // includeMe — ambil pesan dari admin juga
                false  // includeNotifications — skip system messages
            );

            if (!chatMessages || chatMessages.length === 0) {
                console.log(`   ⏭️  No messages found, skipping`);
                totalSkipped++;
                continue;
            }

            // 3. Filter hanya pesan dari admin (fromMe)
            const adminMessages = chatMessages.filter(msg => {
                if (!msg.fromMe) return false;
                const text = (msg.body || msg.caption || '').trim();
                return text.length > 0; // Teks saja, skip media tanpa caption
            });

            console.log(`   📨 Found ${adminMessages.length} admin messages out of ${chatMessages.length} total`);

            if (adminMessages.length === 0) {
                totalSkipped++;
                continue;
            }

            // 4. Cek existing messages di Firestore untuk hindari duplicate
            const existingRef = db
                .collection('directMessages')
                .doc(docId)
                .collection('messages');

            const existingSnapshot = await existingRef
                .where('sender', '==', 'admin')
                .get();

            const existingTexts = new Set();
            existingSnapshot.forEach(doc => {
                existingTexts.add(doc.data().text?.trim());
            });

            console.log(`   📁 Existing admin messages in Firestore: ${existingTexts.size}`);

            // 5. Simpan pesan yang belum ada
            let syncedCount = 0;

            for (const msg of adminMessages) {
                const text = (msg.body || msg.caption || '').trim();

                // Skip kalau sudah ada (simple dedup by text)
                if (existingTexts.has(text)) {
                    continue;
                }

                if (isDryRun) {
                    console.log(`   [DRY RUN] Would sync: "${text.substring(0, 60)}"`);
                    syncedCount++;
                    continue;
                }

                // Konversi timestamp WPP ke Firestore timestamp
                const msgTimestamp = msg.timestamp
                    ? admin.firestore.Timestamp.fromMillis(msg.timestamp * 1000)
                    : admin.firestore.FieldValue.serverTimestamp();

                await existingRef.add({
                    text,
                    sender: 'admin',
                    timestamp: msgTimestamp,
                    syncedAt: admin.firestore.FieldValue.serverTimestamp(),
                    source: 'backfill-hp',
                });

                syncedCount++;
                await delay(50); // Micro delay antar write
            }

            console.log(`   ✅ Synced: ${syncedCount} new admin messages`);
            totalSynced += syncedCount;

        } catch (error) {
            console.error(`   ❌ Error processing ${docId}:`, error.message);
            totalError++;
        }

        await delay(DELAY_MS); // Delay antar conversation
    }

    console.log(`\n📊 [Backfill] Summary:`);
    console.log(`   ✅ Synced  : ${totalSynced} messages`);
    console.log(`   ⏭️  Skipped : ${totalSkipped} conversations`);
    console.log(`   ❌ Errors  : ${totalError} conversations`);
    console.log(`   Mode      : ${isDryRun ? 'DRY RUN (nothing saved)' : 'LIVE'}`);
    console.log(`\n✅ [Backfill] Done!\n`);
}

module.exports = { backfillAdminMessages };
