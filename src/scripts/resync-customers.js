require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Init Firebase Admin
const serviceAccount = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8'));
initializeApp({ credential: cert(serviceAccount) });
const firestore = getFirestore();

const prisma = new PrismaClient();

async function resyncCustomers() {
    console.log('═══════════════════════════════════════════════════');
    console.log('🔄 RESYNC CUSTOMERS - Recalculate Stats');
    console.log('═══════════════════════════════════════════════════\n');

    // 1. Get all customers from Firestore
    console.log('📥 Fetching customers from Firestore...');
    const firestoreCustomers = await firestore.collection('customers').get();
    console.log(`   Found ${firestoreCustomers.size} customers\n`);

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const doc of firestoreCustomers.docs) {
        const data = doc.data();
        const waJid = data.waJid || data.phone || doc.id;
        
        if (!waJid) {
            skipped++;
            continue;
        }

        try {
            // Fetch customer's bookings from Firestore
            const bookingsSnap = await firestore
                .collection('customers')
                .doc(doc.id)
                .collection('bookings')
                .orderBy('createdAt', 'desc')
                .get();

            const bookings = bookingsSnap.docs.map(b => b.data());
            const lastBooking = bookings.length > 0 ? bookings[0] : null;
            const lastVisit = lastBooking?.date || lastBooking?.createdAt || null;

            // Calculate total spending from transactions
            let totalSpending = 0;
            const transactionsSnap = await firestore
                .collection('customers')
                .doc(doc.id)
                .collection('transactions')
                .get();
            
            transactionsSnap.forEach(t => {
                const tx = t.data();
                if (tx.amount) totalSpending += Number(tx.amount);
            });

            // Upsert customer using phone as unique key
            await prisma.customer.upsert({
                where: { phone: waJid },
                update: {
                    name: data.name || data.pushName || null,
                    whatsappLid: waJid,
                    totalSpending,
                    lastService: lastVisit ? new Date(lastVisit) : null,
                    lastMessage: lastBooking?.coatingType || null,
                    lastMessageAt: lastVisit ? new Date(lastVisit) : null,
                },
                create: {
                    phone: waJid,
                    whatsappLid: waJid,
                    name: data.name || data.pushName || null,
                    totalSpending,
                    lastService: lastVisit ? new Date(lastVisit) : null,
                    lastMessage: lastBooking?.coatingType || null,
                    lastMessageAt: lastVisit ? new Date(lastVisit) : null,
                    firstSeenAt: data.firstSeenAt ? new Date(data.firstSeenAt) : new Date(),
                },
            });

            created++;
            if (created % 10 === 0 || created === firestoreCustomers.size) {
                console.log(`   ✅ Processed ${created}/${firestoreCustomers.size} customers...`);
            }

        } catch (err) {
            console.log(`   ❌ Error ${waJid}: ${err.message}`);
            skipped++;
        }
    }

    // Summary
    console.log('\n═══════════════════════════════════════════════════');
    console.log('✅ RESYNC COMPLETE');
    console.log('═══════════════════════════════════════════════════');
    console.log(`   Created/Updated: ${created}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Total customers in DB: ${await prisma.customer.count()}`);
    console.log('\n   Next step: firestore-to-postgres.js (import messages)\n');
}

resyncCustomers()
    .catch(e => { console.error('❌ Resync failed:', e); process.exit(1); })
    .finally(() => prisma.$disconnect());
