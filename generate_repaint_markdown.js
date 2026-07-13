const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const models = await prisma.vehicleModel.findMany({
    orderBy: { modelName: 'asc' }
  });

  const services = await prisma.service.findMany({
    where: {
      name: {
        in: [
          'Repaint Bodi Halus - Paket Ekonomis',
          'Repaint Bodi Halus - Paket Basic',
          'Repaint Bodi Halus - Paket Standar',
          'Repaint Bodi Halus - Paket Premium'
        ]
      }
    },
    include: {
      prices: true
    }
  });

  // Reorder services
  const order = ['Ekonomis', 'Basic', 'Standar', 'Premium'];
  const orderedServices = order.map(pkgName => services.find(s => s.name.includes(pkgName))).filter(Boolean);

  let md = `# DAFTAR HARGA & PAKET REPAINT BODI HALUS\n\n`;

  md += `## PENJELASAN PAKET\n`;
  for (const s of orderedServices) {
    let waktu = "3-4 hari kerja";
    if (s.name.includes('Premium')) waktu = "5-6 hari kerja";
    
    md += `### ${s.name}\n`;
    md += `${s.description}\n`;
    md += `- **Estimasi Pengerjaan:** ${waktu}\n\n`;
  }

  md += `## HARGA BERDASARKAN MODEL MOTOR\n`;
  md += `*(Cari nama motor atau aliasnya untuk memberikan harga yang tepat kepada pelanggan. Semua harga sudah dihitung berdasarkan harga dasar (Ekonomis) x persentase per paket)*\n\n`;

  for (const model of models) {
    const aliasText = model.aliases ? model.aliases.join(', ') : '';
    let hasPrice = false;
    
    let modelPricesMd = `- **Motor:** ${model.brand.toUpperCase()} ${model.modelName.toUpperCase()} (Alias: ${aliasText})\n`;
    
    for (const s of orderedServices) {
      const priceEntry = s.prices.find(p => p.vehicleModelId === model.id);
      if (priceEntry) {
        hasPrice = true;
        const shortName = s.name.replace('Repaint Bodi Halus - Paket ', '');
        const formattedPrice = 'Rp ' + priceEntry.price.toLocaleString('id-ID').replace(/,/g, '.');
        modelPricesMd += `  - Paket ${shortName}: ${formattedPrice}\n`;
      }
    }
    
    if (hasPrice) {
      md += modelPricesMd + '\n';
    }
  }

  fs.writeFileSync('meta_ai_harga_paket_repaint.md', md);
  console.log('File meta_ai_harga_paket_repaint.md has been generated.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
