const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function setFollowUpBasedOnMonth() {
    console.log("Menyelaraskan data: Hanya yang chat BULAN INI (April) yang tetap aktif follow-up...");
    
    // Awal bulan ini (1 April dari tahun & bulan saat ini)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const contexts = await prisma.customerContext.findMany({
        include: {
            customer: true
        }
    });

    let lockedCount = 0;
    let unlockedCount = 0;
    
    for (const ctx of contexts) {
        if (!ctx.customer) continue;

        // Cari pesan terakhir ALSI dari pelanggan tersebut
        const lastUserMsg = await prisma.directMessage.findFirst({
            where: {
                customerId: ctx.customer.id,
                role: 'user'
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        // Waktu pesan terakhir pelanggan (atau tanggal dibuat kalau dia sama sekali belum membalas)
        const realLastActive = lastUserMsg ? new Date(lastUserMsg.createdAt) : new Date(ctx.createdAt);

        // Jika dia chat di bulan INI -> SET AKTIF (0)
        if (realLastActive >= startOfMonth) {
            if (ctx.followUpCount !== 0) {
                await prisma.customerContext.update({
                    where: { id: ctx.id },
                    data: { followUpCount: 0, lastFollowUpAt: null }
                });
                unlockedCount++;
            }
        } 
        // Jika HANYA chat di bulan LALU (atau lebih tua) -> SET LOCK (3)
        else {
            if (ctx.followUpCount < 3) {
                await prisma.customerContext.update({
                    where: { id: ctx.id },
                    data: { followUpCount: 3, lastFollowUpAt: new Date() }
                });
                lockedCount++;
            }
        }
    }
    
    console.log(`✅ ${unlockedCount} Pelanggan dari BULAN INI dipastikan statusnya AKTIF.`);
    console.log(`✅ ${lockedCount} Pelanggan dari BULAN LALU (dan sebelumnya) telah di-LOCK.`);
}

setFollowUpBasedOnMonth().catch(console.error).finally(() => prisma.$disconnect());
