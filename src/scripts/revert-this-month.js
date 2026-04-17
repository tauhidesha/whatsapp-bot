const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function revertThisMonth() {
    console.log("Mengembalikan status follow up untuk pelanggan bulan ini...");
    
    // Tanggal 1 bulan ini
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const contexts = await prisma.customerContext.findMany({
        where: {
            followUpCount: 3 // Yang tadi di-lock
        },
        include: {
            customer: true
        }
    });

    let restored = 0;
    for (const ctx of contexts) {
        if (!ctx.customer) continue;
        
        const lastMsg = ctx.customer.lastMessageAt ? new Date(ctx.customer.lastMessageAt) : new Date(ctx.createdAt);
        
        // Jika pelanggan masih masuk di bulan ini (tapi sempat kena skrip 2 hari lalu)
        if (lastMsg >= startOfMonth) {
            await prisma.customerContext.update({
                where: { id: ctx.id },
                data: { followUpCount: 0, lastFollowUpAt: null }
            });
            restored++;
        }
    }
    
    console.log(`✅ Berhasil mereset (mengembalikan) ${restored} pelanggan bulan ini ke dalam antrean follow-up aktif.`);
}

revertThisMonth().catch(console.error).finally(() => prisma.$disconnect());
