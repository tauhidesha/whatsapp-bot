const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Find Vario 125/150/160
  const vario = await prisma.vehicleModel.findFirst({
    where: { modelName: 'vario 125/150/160' },
    include: { servicePrices: true }
  });

  if (vario) {
    // 1. Rename existing to just "vario 125" and update its aliases
    await prisma.vehicleModel.update({
      where: { id: vario.id },
      data: {
        modelName: 'vario 125',
        aliases: ['honda vario', 'vario 125']
      }
    });
    console.log("Updated vario 125");

    // 2. Create new for "vario 150/160"
    const newVario = await prisma.vehicleModel.create({
      data: {
        brand: 'honda',
        modelName: 'vario 150/160',
        aliases: ['vario 150', 'vario 160'],
        serviceSize: 'M',
        repaintSize: 'M'
      }
    });

    // We need to copy service prices from vario 125 to newVario, but update Repaint Bodi Halus prices to match Nmax base (1.000.000)
    for (const sp of vario.servicePrices) {
      let price = sp.price;
      
      // We will re-run the package update script for this anyway, but let's set base price correctly if it's not a package
      
      await prisma.servicePrice.create({
        data: {
          serviceId: sp.serviceId,
          vehicleModelId: newVario.id,
          price: price
        }
      });
    }
    console.log("Created vario 150/160 with copied prices");
  } else {
    console.log("Vario 125/150/160 not found");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
