// scripts/disable-firestore-followup.js
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

async function disableFollowUp() {
    const isDryRun = process.argv.includes('--dry-run');
    console.log(`🚀 [Disable FollowUp] Memulai proses... ${isDryRun ? '(DRY RUN)' : ''}`);

    try {
        // Ambil semua konv dari directMessages
        const conversationsSnapshot = await db.collection('directMessages').get();
        console.log(`📊 [Firestore] Ditemukan ${conversationsSnapshot.size} data percakapan backfill (directMessages).`);

        let totalProcessed = 0;
        let totalUpdated = 0;
        let missingContext = 0;
        let missingCustomer = 0;

        for (const convDoc of conversationsSnapshot.docs) {
            const rawId = convDoc.id;
            const phone = normalizePhone(rawId);
            if (!phone) continue;

            totalProcessed++;

            // Cari Customer di Prisma
            const customer = await prisma.customer.findUnique({
                where: { phone },
                include: { customerContext: true }
            });

            if (!customer) {
                missingCustomer++;
                continue;
            }

            if (!customer.customerContext) {
                missingContext++;
                
                // Buat context dengan label dormant_lead untuk block follow-up
                if (!isDryRun) {
                    await prisma.customerContext.create({
                        data: {
                            phone: customer.phone,
                            id: customer.phone,
                            customerLabel: 'dormant_lead',
                            followUpStrategy: 'stop',
                            labelReason: 'Ignored Firestore Backfill'
                        }
                    });
                }
                totalUpdated++;
                continue;
            }

            // Update existing context
            if (!isDryRun) {
                await prisma.customerContext.update({
                    where: { phone: customer.phone },
                    data: {
                        customerLabel: 'dormant_lead',
                        followUpStrategy: 'stop',
                        labelReason: 'Ignored Firestore Backfill'
                    }
                });
            }
            totalUpdated++;
        }

        console.log('\n--- RINGKASAN ---');
        console.log(`🔹 Total data dari Firestore diproses : ${totalProcessed}`);
        console.log(`🔹 Total Customer tidak ditemukan (sudah terhapus) : ${missingCustomer}`);
        console.log(`🔹 Total Context yang akan/telah diupdate : ${totalUpdated}`);
        
        if (isDryRun) {
            console.log('\n✅ Dry run selesai. Tidak ada data yang diubah di database.');
            console.log('👉 Jalankan script tanpa "--dry-run" untuk mengeksekusi secara nyata.');
        } else {
            console.log('\n🎉 Proses disable follow-up berhasil dieksekusi secara permanen!');
        }

    } catch (error) {
        console.error('❌ [Disable FollowUp] Gagal:', error);
    } finally {
        await prisma.$disconnect();
    }
}

disableFollowUp();
