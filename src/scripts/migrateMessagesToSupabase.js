require('dotenv').config();
const admin = require('firebase-admin');
const { PrismaClient } = require('@prisma/client');

// Initialize Firebase
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
}

const db = admin.firestore();
const prisma = new PrismaClient();

function normalizePhone(phone) {
    if (!phone) return null;
    let clean = String(phone).replace(/\D/g, '');
    if (clean.startsWith('0')) clean = '62' + clean.slice(1);
    else if (clean.length > 8 && !clean.startsWith('62')) clean = '62' + clean;
    return clean;
}

async function migrateMessages() {
    console.log('🚀 Starting ETL: Firebase Chat History to Supabase...');
    
    // 1. Map Supabase Customers
    const customers = await prisma.customer.findMany({ select: { id: true, phone: true } });
    const customerMap = new Map();
    for (const c of customers) customerMap.set(c.phone, c.id);

    console.log(`✅ Loaded ${customers.length} Supabase customers for foreign key mapping.`);

    // 2. Extract Firebase Messages
    const dmSnapshot = await db.collection('directMessages').get();
    let totalMessages = 0;
    let ignoredDocs = 0;

    for (const doc of dmSnapshot.docs) {
        const docId = doc.id;
        const normalized = normalizePhone(docId);
        if (!normalized) {
            ignoredDocs++;
            continue;
        }
        
        const customerId = customerMap.get(normalized);
        if (!customerId) {
            ignoredDocs++;
            continue; // Skip if no linked customer (should not happen if previous ETL ran)
        }

        // Fetch messages subcollection
        const msgSnap = await doc.ref.collection('messages').get();
        if (msgSnap.empty) continue;

        const messagesToInsert = [];
        msgSnap.forEach(msgDoc => {
            const m = msgDoc.data();
            
            let rawContent = m.content || m.text || m.body || m.message;
            let contentTxt = '';
            
            if (rawContent !== undefined && rawContent !== null) {
                contentTxt = typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent);
            } else if (m.mediaUrl || m.imageUrl) {
                contentTxt = '[Media attached]';
            } else {
                contentTxt = '[Empty Message]';
            }

            messagesToInsert.push({
                customerId: customerId,
                senderId: docId, 
                role: m.role || 'user',
                content: contentTxt,
                mediaUrl: m.mediaUrl || null,
                createdAt: m.timestamp ? m.timestamp.toDate() : new Date()
            });
            totalMessages++;
        });

        // Batch insert or createMany
        if (messagesToInsert.length > 0) {
            await prisma.directMessage.createMany({
                data: messagesToInsert,
                skipDuplicates: true
            });
            process.stdout.write(`.`);
        }
    }
    console.log(`\n🎉 Migrated ${totalMessages} historical chat records to Supabase! (${ignoredDocs} unmapped threads)`);
}

migrateMessages().catch(console.error).finally(() => prisma.$disconnect());
