const prisma = require('./src/lib/prisma');
async function test() {
  const services = await prisma.service.findMany({
    where: { subcategory: { startsWith: 'bodi_halus_paket' } },
    select: { id: true, name: true, subcategory: true, summary: true }
  });
  console.log(JSON.stringify(services, null, 2));
  process.exit(0);
}
test();
