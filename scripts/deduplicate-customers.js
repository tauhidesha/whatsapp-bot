// scripts/deduplicate-customers.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deduplicate() {
    console.log('🔍 [Deduplication] Memulai scan pelanggan duplikat...');

    try {
        // 1. Temukan nomor HP yang muncul lebih dari sekali
        const duplicates = await prisma.$queryRaw`
            SELECT phone FROM "Customer"
            GROUP BY phone
            HAVING COUNT(*) > 1
        `;

        if (duplicates.length === 0) {
            console.log('✅ [Deduplication] Tidak ada nomor duplikat ditemukan.');
            return;
        }

        console.log(`📊 [Deduplication] Ditemukan ${duplicates.length} nomor duplikat.`);

        for (const { phone } of duplicates) {
            console.log(`\n🔄 Processing Phone: ${phone}`);

            // 2. Ambil semua records untuk nomor ini
            const records = await prisma.customer.findMany({
                where: { phone },
                orderBy: { updatedAt: 'desc' }
            });

            // Strategi: Record pertama (terbaru/punya LID) jadi Master
            // Cari yang punya whatsappLid kalau ada
            let master = records.find(r => r.whatsappLid) || records[0];
            const others = records.filter(r => r.id !== master.id);

            console.log(`   🏆 Master ID: ${master.id} (whatsappLid: ${master.whatsappLid || 'N/A'})`);

            for (const other of others) {
                console.log(`   🔗 Merging ${other.id} into Master...`);

                // A. Re-bind DirectMessages
                const msgSync = await prisma.directMessage.updateMany({
                    where: { customerId: other.id },
                    data: { customerId: master.id }
                });
                console.log(`      - Merged ${msgSync.count} messages`);

                // B. Re-bind Bookings
                const bookingSync = await prisma.booking.updateMany({
                    where: { customerId: other.id },
                    data: { customerId: master.id }
                });
                console.log(`      - Merged ${bookingSync.count} bookings`);

                // C. Re-bind Transactions
                const txSync = await prisma.transaction.updateMany({
                    where: { customerId: other.id },
                    data: { customerId: master.id }
                });
                console.log(`      - Merged ${txSync.count} transactions`);

                // D. Re-bind Vehicles
                const vehicleSync = await prisma.vehicle.updateMany({
                    where: { customerId: other.id },
                    data: { customerId: master.id }
                });
                console.log(`      - Merged ${vehicleSync.count} vehicles`);

                // E. Sync metadata if Master is missing it
                if (!master.profilePicUrl && other.profilePicUrl) {
                    await prisma.customer.update({
                        where: { id: master.id },
                        data: { profilePicUrl: other.profilePicUrl }
                    });
                    master.profilePicUrl = other.profilePicUrl;
                }

                if (!master.whatsappLid && other.whatsappLid) {
                    await prisma.customer.update({
                        where: { id: master.id },
                        data: { whatsappLid: other.whatsappLid }
                    });
                    master.whatsappLid = other.whatsappLid;
                }

                // F. Delete the duplicate
                await prisma.customer.delete({
                    where: { id: other.id }
                });
                console.log(`      🗑️  Deleted duplicate ID: ${other.id}`);
            }
        }

        console.log('\n✅ [Deduplication] SELESAI!');
    } catch (error) {
        console.error('❌ [Deduplication] Gagal:', error);
    } finally {
        await prisma.$disconnect();
    }
}

deduplicate();
