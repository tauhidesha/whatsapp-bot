const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    
    // cari semua direct message yang user kirim setelah tanggal 1
    const dms = await prisma.directMessage.findMany({
        where: {
            role: 'user',
            createdAt: { gte: startOfMonth }
        },
        select: { customerId: true },
        distinct: ['customerId']
    });
    
    const trueActiveCustomers = new Set(dms.map(d => d.customerId));
    console.log("Customer yg beneran balas bulan ini:", trueActiveCustomers.size);

    const activeContexts = await prisma.customerContext.findMany({
        where: { followUpCount: 0 }
    });
    
    console.log("Total context yg sekarang followUpCount 0:", activeContexts.length);
}
check().then(() => prisma.$disconnect());
