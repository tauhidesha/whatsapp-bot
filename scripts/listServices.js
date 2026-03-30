const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    const svcs = await prisma.service.findMany({
        select: { id: true, name: true, category: true, subcategory: true }
    });
    console.log(JSON.stringify(svcs, null, 2));
}

check().then(() => prisma.$disconnect());
