// scripts/backfill-from-firestore.js
require('dotenv').config();
const admin = require('firebase-admin');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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

function normalizePhone(raw) {
    if (!raw) return null;
    return raw.split('@')[0].replace(/[^0-9]/g, '');
}

async function backfill() {
    console.log('🚀 [Backfill] Memulai migrasi dari Firestore ke Prisma...');

    try {
        // 1. Ambil semua konv dari directMessages
        const conversationsSnapshot = await db.collection('directMessages').get();
        console.log(`📊 [Firestore] Ditemukan ${conversationsSnapshot.size} percakapan.`);

        let totalMessagesSynced = 0;

        for (const convDoc of conversationsSnapshot.docs) {
            const rawId = convDoc.id; // Usually the phone number
            const phone = normalizePhone(rawId);
            if (!phone) continue;

            const convData = convDoc.data();
            console.log(`\n👤 Processing: ${phone} (${convData.name || 'No Name'})`);

            // 2. Ensure Customer exists in Prisma
            const customer = await prisma.customer.upsert({
                where: { phone },
                create: {
                    phone,
                    name: convData.name || null,
                    whatsappLid: rawId.endsWith('@lid') ? rawId : null
                },
                update: {
                    whatsappLid: rawId.endsWith('@lid') ? rawId : undefined
                }
            });

            // 3. Ambil sub-collection 'messages'
            const messagesSnapshot = await db.collection('directMessages').doc(rawId).collection('messages').orderBy('timestamp', 'asc').get();
            console.log(`   📨 Ditemukan ${messagesSnapshot.size} pesan.`);

            for (const msgDoc of messagesSnapshot.docs) {
                const msgData = msgDoc.data();
                
                // Map Firestore role to Prisma role
                let role = 'user';
                if (msgData.sender === 'admin' || msgData.sender === 'bot' || msgData.sender === 'ai' || msgData.sender === 'assistant') {
                    role = 'assistant';
                }

                const content = msgData.text || msgData.content || '';
                const createdAt = msgData.timestamp ? msgData.timestamp.toDate() : new Date();

                // 4. Cek apakah pesan sudah ada (Simple dedup by content + timestamp + customerId)
                const existing = await prisma.directMessage.findFirst({
                    where: {
                        customerId: customer.id,
                        content,
                        role
                    }
                });

                if (existing) {
                    // Skip if already exists
                    continue;
                }

                // 5. Insert to Prisma
                await prisma.directMessage.create({
                    data: {
                        customerId: customer.id,
                        senderId: role === 'assistant' ? 'assistant' : rawId,
                        role,
                        content,
                        createdAt
                    }
                });

                totalMessagesSynced++;
            }
            console.log(`   ✅ Synced messages for ${phone}`);
        }

        console.log(`\n🎉 [Backfill] SELESAI! Total pesan bermigrasi: ${totalMessagesSynced}`);

    } catch (error) {
        console.error('❌ [Backfill] Gagal:', error);
    } finally {
        await prisma.$disconnect();
    }
}

backfill();
