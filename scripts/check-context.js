require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    console.log('--- ALL CUSTOMERS ---');
    const customers = await prisma.customer.findMany({
        where: { name: { contains: 'izaldi', mode: 'insensitive' } },
        include: { customerContext: true }
    });
    console.dir(customers, { depth: null });

    // Also check if there are orphan contexts left behind with the old phone number
    const oldContext = await prisma.customerContext.findFirst({
        where: { phone: '149460634063025' }
    });
    console.log('\n--- ORPHAN CONTEXT (OLD PHONE) ---');
    console.dir(oldContext, { depth: null });
}

check().catch(console.error).finally(() => prisma.$disconnect());
