const prisma = require('./src/lib/prisma');
async function fix() {
  // Find stale services (the ones with ALL CAPS 'BASIC' and 'STANDAR' that were replaced)
  const staleNames = ['Repaint Bodi Halus - Paket BASIC', 'Repaint Bodi Halus - Paket STANDAR'];
  for (const name of staleNames) {
    const svc = await prisma.service.findFirst({ where: { name } });
    if (svc) {
      console.log(`Deleting stale service: ${name} (${svc.id})`);
      // Delete prices first
      await prisma.servicePrice.deleteMany({ where: { serviceId: svc.id } });
      await prisma.service.delete({ where: { id: svc.id } });
    }
  }
  console.log('Cleanup done.');
  process.exit(0);
}
fix();
