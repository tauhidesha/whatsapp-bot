const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const surcharges = await prisma.surcharge.findMany();
    console.log(JSON.stringify(surcharges, null, 2));
}

main().catch(console.error);
