const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixSpam() {
    console.log("Mencari data yang sudah lama tapi followUpCount masih 0...");
    
    // Kita anggap orang yang terakhir contact (lastMessageAt / createdAt) lebih dari 2 hari yang lalu
    // sebagai pelanggan lama yang sudah kena spam sebelumnya
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const contexts = await prisma.customerContext.findMany({
        where: {
            followUpCount: { lt: 3 }
        },
        include: {
            customer: true
        }
    });

    let updated = 0;
    for (const ctx of contexts) {
        // Cek jika lastMessageAt lebih tua dari 2 hari yang lalu
        let isOld = false;
        if (ctx.customer && ctx.customer.lastMessageAt) {
            isOld = new Date(ctx.customer.lastMessageAt) < twoDaysAgo;
        } else {
            isOld = new Date(ctx.createdAt) < twoDaysAgo;
        }

        if (isOld) {
            await prisma.customerContext.update({
                where: { id: ctx.id },
                data: { followUpCount: 3, lastFollowUpAt: new Date() }
            });
            updated++;
        }
    }
    
    console.log(`✅ Berhasil mengupdate ${updated} pelanggan agar AI menganggap follow-up mereka sudah MAX (selesai), jadi tidak akan di-spam lagi.`);
}

fixSpam().catch(console.error).finally(() => prisma.$disconnect());
