require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    const counts = await prisma.customerContext.groupBy({
        by: ['customerLabel'],
        _count: { _all: true }
    });
    console.log('--- Customer Labels ---');
    console.table(counts);

    // Let's get a few samples of customers that we think should be queued
    const sampleContexts = await prisma.customerContext.findMany({
        where: { customerLabel: { not: null } },
        take: 3,
        include: {
            customer: true
        }
    });

    console.log('\n--- Sample Contexts ---');
    for (const c of sampleContexts) {
        console.log(`Phone: ${c.phone}, Label: ${c.customerLabel}, LastFollowUp: ${c.lastFollowUpAt}, LastMsg: ${c.customer?.lastMessageAt}`);
    }
}

check().catch(console.error).finally(() => prisma.$disconnect());
