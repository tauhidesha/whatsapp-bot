const prisma = require('./src/lib/prisma');
async function run() {
    const s = await prisma.service.findMany({ where: { name: { contains: 'Repaint Bodi Halus' } } });
    console.log(s);
    await prisma.$disconnect();
}
run();
