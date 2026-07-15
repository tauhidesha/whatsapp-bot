const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkCustomer() {
    const lid = '97332716642419@lid';
    const customers = await prisma.customer.findMany({
        where: { OR: [{ whatsappLid: lid }, { phone: lid }, { phone: { contains: '97332716642419' } }] }
    });
    for (const c of customers) {
        console.log(`Phone: ${c.phone} | CreatedAt: ${c.createdAt} | UpdatedAt: ${c.updatedAt}`);
    }
}
checkCustomer().catch(console.error).finally(() => prisma.$disconnect());
