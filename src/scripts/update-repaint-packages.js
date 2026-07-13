const { PrismaClient } = require('@prisma/client');
const { repaintBodiHalus } = require('../data/repaintPrices.js');

const prisma = new PrismaClient();

async function main() {
  console.log("Mulai update harga paket repaint bodi halus...");

  // Dapatkan ID service untuk masing-masing paket
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

  // Dapatkan semua model kendaraan di DB
  const vehicleModels = await prisma.vehicleModel.findMany();

  let updateCount = 0;

  for (const item of repaintBodiHalus) {
    const basePrice = item.price;
    // Cari vehicle model berdasarkan nama model (atau case insensitive match)
    const dbModel = vehicleModels.find(v => v.modelName.toLowerCase() === item.model.toLowerCase());
    
    if (!dbModel) {
      // Coba match dengan aliases jika nama model tidak pas exact
      const altMatch = vehicleModels.find(v => v.aliases.includes(item.model.toLowerCase()));
      if (!altMatch) {
          console.log(`⚠️ Model ${item.model} tidak ditemukan di DB. Skip.`);
          continue;
      }
    }

    const targetModel = dbModel || vehicleModels.find(v => v.aliases.includes(item.model.toLowerCase()));

    // Hitung harga paket
    const prices = {
      bodi_halus_paket_ekonomis: basePrice,
      bodi_halus_paket_basic: basePrice * 1.2,
      bodi_halus_paket_standar: basePrice * 1.3,
      bodi_halus_paket_premium: basePrice * 1.5,
    };

    // Update DB untuk setiap paket
    for (const [subcat, price] of Object.entries(prices)) {
      const serviceId = serviceMap[subcat];
      if (!serviceId) continue;

      // Cari atau buat service price
      const existingPrice = await prisma.servicePrice.findFirst({
        where: {
          serviceId: serviceId,
          vehicleModelId: targetModel.id
        }
      });

      if (existingPrice) {
        if (existingPrice.price !== price) {
          await prisma.servicePrice.update({
            where: { id: existingPrice.id },
            data: { price: price }
          });
          updateCount++;
        }
      } else {
        await prisma.servicePrice.create({
          data: {
            serviceId: serviceId,
            vehicleModelId: targetModel.id,
            price: price
          }
        });
        updateCount++;
      }
    }
  }

  console.log(`Selesai! Berhasil mengupdate/membuat ${updateCount} harga paket repaint.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
