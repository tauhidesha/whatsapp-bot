const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const services = await prisma.service.findMany({
    where: { name: { contains: 'Repaint Bodi Halus - Paket' } },
    select: { name: true, description: true }
  });
  
  services.forEach(s => {
    console.log(`=== ${s.name} ===`);
    console.log(s.description);
    console.log('');
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
