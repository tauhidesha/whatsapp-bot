const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixRealSpam() {
    console.log("Menganalisa riwayat chat ASLI dari pelanggan (mengabaikan pesan dari AI)...");
    
    // Batas waktu: 2 Hari yang lalu
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const contexts = await prisma.customerContext.findMany({
        include: {
            customer: true
        }
    });

    let lockedCount = 0;
    
    for (const ctx of contexts) {
        if (!ctx.customer) continue;

        // Cari riwayat pesan terakhir BENAR-BENAR dari pelanggan ('user')
        const lastUserMsg = await prisma.directMessage.findFirst({
            where: {
                customerId: ctx.customer.id,
                role: 'user'
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        // Waktu pesan terakhir pelanggan masuk (atau saat ia pertama dibuat)
        const realLastActive = lastUserMsg ? new Date(lastUserMsg.createdAt) : new Date(ctx.createdAt);

        // Jika pelanggan pasif / pesan dia sudah lewat dari 2 hari yang lalu: LOCK
        if (realLastActive < twoDaysAgo) {
            // Hanya update jika belum di-lock
            if (ctx.followUpCount < 3) {
                await prisma.customerContext.update({
                    where: { id: ctx.id },
                    data: { followUpCount: 3, lastFollowUpAt: new Date() }
                });
                lockedCount++;
            }
        } else {
            // Jika dia masih balas pesan dalam 2 hari ini: BUKA LOCK
            if (ctx.followUpCount >= 3) {
                await prisma.customerContext.update({
                    where: { id: ctx.id },
                    data: { followUpCount: 0, lastFollowUpAt: null }
                });
            }
        }
    }
    
    console.log(`✅ Koreksi Berhasil! ${lockedCount} data di-lock karena terdeteksi sebagai spam (pesan asli user sudah lama).`);
    console.log('Orang yang memang balas hari ini/kemarin otomatis berada di antrean yang aman.');
}

fixRealSpam().catch(console.error).finally(() => prisma.$disconnect());
