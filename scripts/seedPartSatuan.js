/**
 * File: scripts/seedPartSatuan.js
 * Adds individual repaint part services:
 * - Repaint Cover CVT: 200rb
 * - Repaint Arm: 150rb
 * - Repaint Bottom Shock Depan: 150rb
 * - Repaint Behel: 150rb
 *
 * Usage:
 *   node scripts/seedPartSatuan.js
 */

require('dotenv').config();
const prisma = require('../src/lib/prisma');

const newServices = [
  {
    name: "Repaint Cover CVT",
    category: "repaint",
    summary: "Cat ulang cover CVT motor agar kembali bersih dan segar.",
    description: "Pengecatan ulang cover CVT motor. Estimasi pengerjaan: 1-2 hari kerja.",
    price: 200000,
    estimatedDuration: 480
  },
  {
    name: "Repaint Arm",
    category: "repaint",
    summary: "Cat ulang swing arm motor agar terbebas dari kusam dan karat.",
    description: "Pengecatan ulang swing arm motor. Estimasi pengerjaan: 1-2 hari kerja.",
    price: 150000,
    estimatedDuration: 480
  },
  {
    name: "Repaint Bottom Shock Depan",
    category: "repaint",
    summary: "Cat ulang bottom shock depan (sepasang) agar kaki-kaki kembali mulus.",
    description: "Pengecatan ulang sepasang bottom shock depan motor. Estimasi pengerjaan: 1-2 hari kerja.",
    price: 150000,
    estimatedDuration: 480
  },
  {
    name: "Repaint Behel",
    category: "repaint",
    summary: "Cat ulang behel/planger belakang motor.",
    description: "Pengecatan ulang behel/planger belakang motor. Estimasi pengerjaan: 1-2 hari kerja.",
    price: 150000,
    estimatedDuration: 480
  }
];

async function main() {
  console.log('🚀 Seeding Repaint Part Satuan to Database...\n');

  for (const s of newServices) {
    console.log(`Processing service: "${s.name}" with price ${s.price}`);

    // 1. Upsert Service
    const service = await prisma.service.upsert({
      where: { name: s.name },
      update: {
        category: s.category,
        summary: s.summary,
        description: s.description,
        estimatedDuration: s.estimatedDuration,
        usesModelPricing: false,
      },
      create: {
        name: s.name,
        category: s.category,
        summary: s.summary,
        description: s.description,
        estimatedDuration: s.estimatedDuration,
        usesModelPricing: false,
      }
    });

    // 2. Clear existing prices for this service to ensure clean seed
    await prisma.servicePrice.deleteMany({
      where: { serviceId: service.id }
    });

    // 3. Insert flat price
    await prisma.servicePrice.create({
      data: {
        serviceId: service.id,
        price: s.price
      }
    });

    console.log(`  ✅ Done: ${s.name} (price: ${s.price})`);
  }

  console.log('\n🎉 Finished seeding Repaint Part Satuan!');
}

main()
  .catch(e => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
