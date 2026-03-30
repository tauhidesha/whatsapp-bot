/**
 * File: scripts/seedPrismaPricing.js
 * Migrates static pricing data from JS files to Prisma Database.
 */

require('dotenv').config();
const prisma = require('../src/lib/prisma');
const masterLayanan = require('../src/data/masterLayanan');
const { 
  repaintBodiHalus, repaintBodiKasar, repaintVelg, 
  warnaSpesial, VELG_PRICE_MAP 
} = require('../src/data/repaintPrices');
const motorDatabase = require('../src/data/daftarUkuranMotor');

async function main() {
  console.log('🚀 Starting Data Migration to Prisma...');

  // 1. Seed Vehicle Models
  console.log('--- Seeding VehicleModels ---');
  const modelMap = new Map(); // To track ID by model name
  
  for (const motor of motorDatabase) {
    const created = await prisma.vehicleModel.upsert({
      where: { modelName: motor.model },
      update: {
        serviceSize: motor.service_size,
        repaintSize: motor.repaint_size,
        aliases: motor.aliases,
        brand: motor.aliases[0]?.split(' ')[0].toLowerCase() || 'unknown'
      },
      create: {
        modelName: motor.model,
        serviceSize: motor.service_size,
        repaintSize: motor.repaint_size,
        aliases: motor.aliases,
        brand: motor.aliases[0]?.split(' ')[0].toLowerCase() || 'unknown'
      }
    });
    modelMap.set(motor.model.toLowerCase(), created.id);
  }
  console.log(`✅ Seeded ${motorDatabase.length} vehicle models.`);

  // 2. Seed Services
  console.log('--- Seeding Services ---');
  for (const service of masterLayanan) {
    const createdService = await prisma.service.upsert({
      where: { name: service.name },
      update: {
        category: service.category,
        subcategory: service.subcategory || null,
        summary: service.summary || null,
        description: service.description || null,
        note: service.note || null,
        estimatedDuration: parseInt(service.estimatedDuration) || 0,
        usesModelPricing: !!service.usesModelPricing,
      },
      create: {
        name: service.name,
        category: service.category,
        subcategory: service.subcategory || null,
        summary: service.summary || null,
        description: service.description || null,
        note: service.note || null,
        estimatedDuration: parseInt(service.estimatedDuration) || 0,
        usesModelPricing: !!service.usesModelPricing,
      }
    });

    // 3. Clear existing prices for this service to ensure clean seed
    await prisma.servicePrice.deleteMany({ where: { serviceId: createdService.id } });

    if (service.variants) {
      // Size-based prices (Detailing/Coating)
      for (const variant of service.variants) {
        await prisma.servicePrice.create({
          data: {
            serviceId: createdService.id,
            size: variant.name,
            price: variant.price
          }
        });
      }
    } else if (service.price > 0 && !service.usesModelPricing) {
      // Fixed global price
      await prisma.servicePrice.create({
        data: {
          serviceId: createdService.id,
          price: service.price
        }
      });
    }

    // Special handling for Repaint Bodi Halus
    if (service.name === "Repaint Bodi Halus") {
      console.log('   - Seeding prices for Repaint Bodi Halus (Model-based)...');
      for (const item of repaintBodiHalus) {
        const vehicleModelId = modelMap.get(item.model.toLowerCase());
        if (vehicleModelId) {
          await prisma.servicePrice.create({
            data: {
              serviceId: createdService.id,
              vehicleModelId: vehicleModelId,
              price: item.price
            }
          });
        }
      }
    }

    // Special handling for Repaint Bodi Kasar (Size-based mapping)
    if (service.name === "Repaint Bodi Kasar") {
        console.log('   - Seeding prices for Repaint Bodi Kasar (Size-based)...');
        const sizeMap = {
            "Small Matic / Bebek": "S",
            "Medium Matic": "M",
            "Big Matic": "L",
            "Extra Big Matic": "XL"
        };
        for (const item of repaintBodiKasar) {
            const size = sizeMap[item.category];
            if (size) {
                await prisma.servicePrice.create({
                    data: {
                        serviceId: createdService.id,
                        size: size,
                        price: item.price
                    }
                });
            }
        }
    }

    // Special handling for Repaint Velg
    if (service.name === "Repaint Velg") {
        console.log('   - Seeding prices for Repaint Velg (Mixed)...');
        const velgSizeMap = {
            "Matic Kecil / Bebek": "S",
            "Big Matic / Super Bebek": "M",
            "Sport 150cc - 250cc": "L"
        };
        for (const item of repaintVelg) {
            const size = velgSizeMap[item.category];
            if (size) {
                await prisma.servicePrice.create({
                    data: {
                        serviceId: createdService.id,
                        size: size,
                        price: item.price
                    }
                });
            }
        }
        for (const [model, price] of Object.entries(VELG_PRICE_MAP)) {
            const vehicleModelId = modelMap.get(model.toLowerCase());
            if (vehicleModelId) {
                await prisma.servicePrice.create({
                    data: {
                        serviceId: createdService.id,
                        vehicleModelId: vehicleModelId,
                        price: price
                    }
                });
            }
        }
    }
  }

  // 4. Seed Surcharges
  console.log('--- Seeding Surcharges ---');
  for (const item of warnaSpesial) {
    await prisma.surcharge.upsert({
      where: { name: item.type },
      update: {
        aliases: item.aliases,
        amount: item.surcharge
      },
      create: {
        name: item.type,
        aliases: item.aliases,
        amount: item.surcharge
      }
    });
  }

  console.log('✅ Migration Finished Successfully!');
}

main()
  .catch(e => {
    console.error('❌ Migration Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
