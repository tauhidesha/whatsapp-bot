const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const MANUAL_MATCHES = {
  "vario 110": ["honda vario 110", "vario karbu"],
  "vario 125/150/160": ["honda vario", "vario 125", "vario 150", "vario 160"],
  "vespa": ["vespa lx", "vespa s", "vespa sprint", "vespa primavera"],
  "cbr": ["honda cbr", "cbr 150r", "cbr 250rr"],
  "ninja": ["kawasaki ninja", "ninja 250"],
  "tiger": ["honda tiger"],
  "f1zr": ["yamaha f1zr"],
  "cb 100": ["honda cb"],
  "win 100": ["honda win"]
};

// Based on repaintPrices.js base prices for these models
const BASE_PRICES = {
  "vario 110": 800000,
  "vario 125/150/160": 900000,
  "vespa": 1500000,
  "cbr": 1200000,
  "ninja": 1500000,
  "tiger": 1200000,
  "f1zr": 2125000,
  "cb 100": 1700000,
  "win 100": 1500000
};

async function main() {
  const services = await prisma.service.findMany({
    where: {
      category: 'repaint',
      subcategory: {
        in: [
          'bodi_halus_paket_ekonomis', 
          'bodi_halus_paket_basic', 
          'bodi_halus_paket_standar', 
          'bodi_halus_paket_premium'
        ]
      }
    }
  });

  const serviceMap = {};
  for (const s of services) {
    serviceMap[s.subcategory] = s.id;
  }

  const vehicleModels = await prisma.vehicleModel.findMany();
  let updateCount = 0;

  for (const [key, aliases] of Object.entries(MANUAL_MATCHES)) {
    const basePrice = BASE_PRICES[key];
    const prices = {
      bodi_halus_paket_ekonomis: basePrice,
      bodi_halus_paket_basic: basePrice * 1.2,
      bodi_halus_paket_standar: basePrice * 1.3,
      bodi_halus_paket_premium: basePrice * 1.5,
    };

    // Find all models matching the aliases
    const matchedModels = vehicleModels.filter(v => 
      aliases.some(alias => v.modelName.toLowerCase().includes(alias) || v.aliases.includes(alias))
    );

    for (const model of matchedModels) {
      for (const [subcat, price] of Object.entries(prices)) {
        const serviceId = serviceMap[subcat];
        if (!serviceId) continue;

        const existingPrice = await prisma.servicePrice.findFirst({
          where: { serviceId, vehicleModelId: model.id }
        });

        if (existingPrice) {
          if (existingPrice.price !== price) {
            await prisma.servicePrice.update({
              where: { id: existingPrice.id },
              data: { price }
            });
            updateCount++;
          }
        } else {
          await prisma.servicePrice.create({
            data: { serviceId, vehicleModelId: model.id, price }
          });
          updateCount++;
        }
      }
    }
  }

  console.log(`Selesai manual update: ${updateCount} harga.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
