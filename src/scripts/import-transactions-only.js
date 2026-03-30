/**
 * import-transactions-only.js
 * 
 * Standalone import for Transactions from Firestore
 */

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

function detectAndSuffix(rawPhone) {
    if (!rawPhone) return null;
    let str = String(rawPhone).trim();

    // 1. If already has suffix, keep it
    if (str.endsWith('@lid')) {
        return { phone: str };
    }
    if (str.endsWith('@c.us')) {
        return { phone: str };
    }

    // 2. Clear to digits only for suffixing logic
    let clean = str.replace(/\D/g, '');
    if (!clean) return null;

    // Handle initial zero (convert to 62)
    if (clean.startsWith('0')) clean = '62' + clean.slice(1);

    // 3. Logic based on user instructions:
    // Indonesian phone: start 62 + length 10-14
    if (clean.startsWith('62') && clean.length >= 10 && clean.length <= 15) {
        return { phone: `${clean}@c.us` };
    }

    // Default to LID (@lid) for others
    return { phone: `${clean}@lid` };
}

async function main() {
    console.log('🚀 Importing Transactions Only...');
    const startTime = Date.now();

    try {
        const txSnapshot = await db.collection('transactions').get();
        console.log(`   Firestore 'transactions' collection: ${txSnapshot.docs.length} docs`);

        let imported = 0;
        let skipped = 0;
        let errors = 0;

        for (const doc of txSnapshot.docs) {
            try {
                const data = doc.data();
                const rawPhone = data.customerNumber || data.customerId;
                if (!rawPhone) { 
                    console.log(`   🔸 Doc ${doc.id} has no phone: ${JSON.stringify(data)}`);
                    skipped++; 
                    continue; 
                }

                const detected = detectAndSuffix(rawPhone);
                if (!detected) { 
                    console.log(`   🔸 Doc ${doc.id} could not detect phone: ${rawPhone}`);
                    skipped++; 
                    continue; 
                }

                // Find customer in Prisma
                const customer = await prisma.customer.findUnique({
                    where: { phone: detected.phone }
                });

                if (!customer) { 
                    console.log(`   ⚠️ Customer not found: ${detected.phone} (Source: ${rawPhone})`);
                    skipped++; 
                    continue; 
                }

                // Check if transaction already exists (optional, but good for idempotency)
                // Since Transaction doesn't have a direct Firestore ID field, we can't easily check.
                // But we can check by description/amount/date combo if needed.
                
                await prisma.transaction.create({
                    data: {
                        customerId: customer.id,
                        amount: Number(data.amount) || 0,
                        type: (data.type || 'income').toLowerCase(),
                        status: (data.status || 'SUCCESS').toUpperCase(),
                        description: data.description || data.serviceType || 'Historical Import',
                        paymentMethod: data.paymentMode || data.paymentMethod || 'CASH',
                        category: data.category || data.serviceType || 'GENERAL',
                        createdAt: data.createdAt?.toDate?.() || new Date(),
                        paymentDate: data.paymentDate?.toDate?.() || data.createdAt?.toDate?.() || new Date()
                    }
                });

                imported++;
                if (imported % 100 === 0) {
                    process.stdout.write(`   📦 ${imported} transactions imported...\n`);
                }
            } catch (e) {
                if (e.message.includes('Unique constraint')) {
                    skipped++;
                } else {
                    console.error(`   ❌ Error for doc ${doc.id}: ${e.message}`);
                    errors++;
                }
            }
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`\n✅ Done! Imported: ${imported}, Skipped: ${skipped}, Errors: ${errors}`);
        console.log(`⏱️ Duration: ${duration}s`);

    } catch (error) {
        console.error('\n❌ Import failed:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
