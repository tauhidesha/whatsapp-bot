const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const vario = await prisma.vehicleModel.findFirst({
    where: { modelName: 'vario' }
  });

  if (vario) {
    // Rename to vario 125
    await prisma.vehicleModel.update({
      where: { id: vario.id },
      data: {
        modelName: 'vario 125',
        aliases: ['honda vario', 'vario 125', 'honda vario 125']
      }
    });
    console.log("Updated vario -> vario 125");

    // Create vario 150/160
    await prisma.vehicleModel.create({
      data: {
        brand: 'honda',
        modelName: 'vario 150/160',
        aliases: ['vario 150', 'vario 160', 'honda vario 150', 'honda vario 160'],
        serviceSize: 'M',
        repaintSize: 'M'
      }
    });
    console.log("Created vario 150/160");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
