const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { repaintBodiHalus, VELG_PRICE_MAP } = require('../src/data/repaintPrices');

async function main() {
  const services = await prisma.service.findMany();
  
  const models = await prisma.vehicleModel.findMany();
  
  // We want to insert to ServicePrice for 'Repaint Bodi Halus'
  const bodyService = services.find(s => s.name.toLowerCase() === 'repaint bodi halus');
  const velgService = services.find(s => s.name.toLowerCase() === 'repaint velg');
  
  let filledCount = 0;

  if (bodyService) {
      console.log(`\n=== BACKFILLING REPAINT BODI HALUS ===`);
      for (const item of repaintBodiHalus) {
          // Find the corresponding model
          let model = models.find(m => m.modelName.toLowerCase() === item.model.toLowerCase());
          if (!model) model = models.find(m => m.aliases.some(a => a.toLowerCase() === item.model.toLowerCase()));
          if (!model) model = models.find(m => item.aliases.some(a => m.aliases.includes(a.toLowerCase())));

          if (model) {
              const existing = await prisma.servicePrice.findFirst({
                  where: { serviceId: bodyService.id, vehicleModelId: model.id }
              });

              if (!existing) {
                  await prisma.servicePrice.create({
                      data: { serviceId: bodyService.id, vehicleModelId: model.id, price: item.price }
                  });
                  console.log(`[BODY] Added price for ${model.modelName} = ${item.price}`);
                  filledCount++;
              } else if (existing.price !== item.price) {
                  await prisma.servicePrice.update({
                      where: { id: existing.id },
                      data: { price: item.price }
                  });
                  console.log(`[BODY] Updated price for ${model.modelName} = ${item.price}`);
                  filledCount++;
              }
          } else {
              console.log(`[BODY] Warning: Could not find DB model for '${item.model}' from repaintPrices`);
          }
      }
  }

  if (velgService) {
      console.log(`\n=== BACKFILLING REPAINT VELG ===`);
      for (const [key, price] of Object.entries(VELG_PRICE_MAP)) {
          let model = models.find(m => m.modelName.toLowerCase() === key.toLowerCase() || m.aliases.includes(key.toLowerCase()));
          if (!model) {
              // try a more fuzzy match
              model = models.find(m => m.modelName.toLowerCase().includes(key.toLowerCase()) || m.aliases.some(a => a.toLowerCase().includes(key.toLowerCase())));
          }

          if (model) {
              const existing = await prisma.servicePrice.findFirst({
                  where: { serviceId: velgService.id, vehicleModelId: model.id }
              });

              if (!existing) {
                  await prisma.servicePrice.create({
                      data: { serviceId: velgService.id, vehicleModelId: model.id, price: price }
                  });
                  console.log(`[VELG] Added price for ${model.modelName} = ${price}`);
                  filledCount++;
              } else if (existing.price !== price) {
                  await prisma.servicePrice.update({
                      where: { id: existing.id },
                      data: { price: price }
                  });
                  console.log(`[VELG] Updated price for ${model.modelName} = ${price}`);
                  filledCount++;
              }
          } else {
              console.log(`[VELG] Warning: Could not find DB model for '${key}'`);
          }
      }
  }

  console.log(`\nBackfill completed. Total processed/updated: ${filledCount}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
