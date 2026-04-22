const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { repaintBodiHalus, VELG_PRICE_MAP, warnaSpesial } = require('../src/data/repaintPrices');

function isMatch(dbModel, item) {
    const dbNames = [dbModel.modelName.toLowerCase(), ...dbModel.aliases.map(a => a.toLowerCase())];
    const itemNames = [item.model.toLowerCase(), ...(item.aliases || []).map(a => a.toLowerCase())];

    // Check for exact matches between any of the names/aliases
    for (const d of dbNames) {
        if (itemNames.includes(d)) return true;
    }

    // Check for fuzzy match (if DB name contains the item model, e.g. "cbr 150" contains "cbr")
    for (const d of dbNames) {
        if (d.includes(item.model.toLowerCase())) return true;
    }
    
    // Check if item alias contains dbName (e.g. "cbr 150r" contains "cbr 150")
    for (const d of dbNames) {
        for (const i of itemNames) {
            if (i.includes(d) || d.includes(i)) return true;
        }
    }

    return false;
}

function getVelgPrice(dbModel) {
    const dbNames = [dbModel.modelName.toLowerCase(), ...dbModel.aliases.map(a => a.toLowerCase())];
    
    for (const [key, price] of Object.entries(VELG_PRICE_MAP)) {
        const k = key.toLowerCase();
        for (const d of dbNames) {
            if (d === k || d.includes(k) || k.includes(d)) {
                return price;
            }
        }
    }
    return null;
}

async function main() {
  console.log('Fetching master data...');
  const services = await prisma.service.findMany();
  let models = await prisma.vehicleModel.findMany();

  const bodyService = services.find(s => s.name.toLowerCase() === 'repaint bodi halus');
  const velgService = services.find(s => s.name.toLowerCase() === 'repaint velg');

  if (!bodyService || !velgService) {
      console.log('Error: Pastikan Master Service "Repaint Bodi Halus" dan "Repaint Velg" sudah ada di database.');
      return;
  }

  console.log('\n=== STEP 1: UPSERT MISSING VEHICLE MODELS ===');
  let modelsCreated = 0;

  for (const item of repaintBodiHalus) {
      let matched = false;
      for (const model of models) {
          if (isMatch(model, item)) {
              matched = true;
              break;
          }
      }

      if (!matched) {
          let size = 'Medium';
          if (item.price <= 800000) size = 'Small';
          else if (item.price >= 1500000) size = 'Large';

          const newModel = await prisma.vehicleModel.create({
              data: {
                  brand: item.brand ? item.brand.charAt(0).toUpperCase() + item.brand.slice(1) : 'Unknown',
                  modelName: item.model.toLowerCase(),
                  serviceSize: size,
                  repaintSize: size,
                  aliases: item.aliases || []
              }
          });
          console.log(`Created model: ${newModel.modelName} (${newModel.brand})`);
          modelsCreated++;
          models.push(newModel);
      }
  }

  console.log(`\n=== STEP 2: BACKFILL REPAINT BODI HALUS UNTUK SEMUA MODEL ===`);
  let bodiFilled = 0;
  for (const model of models) {
      // Find matching price from repaintPrices
      let bestMatchItem = null;
      for (const item of repaintBodiHalus) {
          if (isMatch(model, item)) {
              // we take the first match.
              // For "cbr 150", it will match "cbr".
              bestMatchItem = item;
              break;
          }
      }

      if (bestMatchItem) {
          const existing = await prisma.servicePrice.findFirst({
              where: { serviceId: bodyService.id, vehicleModelId: model.id }
          });

          if (!existing) {
              await prisma.servicePrice.create({
                  data: { serviceId: bodyService.id, vehicleModelId: model.id, price: bestMatchItem.price }
              });
              console.log(`[BODY] Set price ${model.modelName} = ${bestMatchItem.price}`);
              bodiFilled++;
          } else if (existing.price !== bestMatchItem.price) {
              await prisma.servicePrice.update({
                  where: { id: existing.id },
                  data: { price: bestMatchItem.price }
              });
              console.log(`[BODY] Updated price ${model.modelName} = ${bestMatchItem.price} (was ${existing.price})`);
              bodiFilled++;
          }
      } else {
          // console.log(`[BODY] No price mapped for ${model.modelName}`);
      }
  }

  console.log(`\n=== STEP 3: BACKFILL REPAINT VELG UNTUK SEMUA MODEL ===`);
  let velgFilled = 0;
  for (const model of models) {
      const price = getVelgPrice(model);
      if (price !== null) {
          const existing = await prisma.servicePrice.findFirst({
              where: { serviceId: velgService.id, vehicleModelId: model.id }
          });

          if (!existing) {
              await prisma.servicePrice.create({
                  data: { serviceId: velgService.id, vehicleModelId: model.id, price: price }
              });
              console.log(`[VELG] Set price ${model.modelName} = ${price}`);
              velgFilled++;
          } else if (existing.price !== price) {
              await prisma.servicePrice.update({
                  where: { id: existing.id },
                  data: { price: price }
              });
              console.log(`[VELG] Updated price ${model.modelName} = ${price} (was ${existing.price})`);
              velgFilled++;
          }
      }
  }
  
  console.log(`\n=== STEP 4: UPSERT SURCHARGES (WARNA SPESIAL) ===`);
  let surchargesUpserted = 0;
  for (const w of warnaSpesial) {
      const existing = await prisma.surcharge.findFirst({
          where: { name: w.type }
      });
      
      if (!existing) {
          await prisma.surcharge.create({
              data: {
                  name: w.type,
                  amount: w.surcharge,
                  isPercentage: false,
                  aliases: w.aliases
              }
          });
          console.log(`[SURCHARGE] Created ${w.type} (+${w.surcharge})`);
          surchargesUpserted++;
      } else {
          // Always update amount and aliases to stay in sync with seed data
          const aliasesChanged = JSON.stringify(existing.aliases?.sort()) !== JSON.stringify(w.aliases.sort());
          const amountChanged = existing.amount !== w.surcharge;
          if (amountChanged || aliasesChanged) {
              await prisma.surcharge.update({
                  where: { id: existing.id },
                  data: {
                      amount: w.surcharge,
                      aliases: w.aliases
                  }
              });
              console.log(`[SURCHARGE] Updated ${w.type} (amount=${amountChanged ? w.surcharge : 'same'}, aliases=${aliasesChanged ? 'updated' : 'same'})`);
              surchargesUpserted++;
          }
      }
  }

  console.log('\n=======================================');
  console.log(`✅ Models Created: ${modelsCreated}`);
  console.log(`✅ Bodi Halus Pricing Updated: ${bodiFilled}`);
  console.log(`✅ Velg Pricing Updated: ${velgFilled}`);
  console.log(`✅ Surcharges (Warna Spesial) Updated: ${surchargesUpserted}`);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
