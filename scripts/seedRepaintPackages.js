/**
 * File: scripts/seedRepaintPackages.js
 * Seeds 4 "Repaint Bodi Halus - Paket X" Service entries ke DB.
 * Masing-masing Service punya ServicePrice per model motor (pre-calculated: base × multiplier).
 *
 * Usage:
 *   node scripts/seedRepaintPackages.js
 *
 * Idempotent — aman dijalankan berulang (upsert).
 */

require('dotenv').config();
const prisma = require('../src/lib/prisma');
const { repaintBodiHalus, repaintBodiHalusPackages } = require('../src/data/repaintPrices');

// Map nama paket ke subcategory untuk konsistensi query
const PACKAGE_SUBCATEGORY_PREFIX = 'bodi_halus_paket';

async function main() {
    console.log('🚀 Seeding Repaint Bodi Halus Packages...\n');

    // 1. Fetch semua VehicleModel dari DB untuk matching
    const vehicleModels = await prisma.vehicleModel.findMany();
    console.log(`📦 Loaded ${vehicleModels.length} vehicle models from DB`);

    // 2. Build model lookup map: modelName.toLowerCase() → id
    const modelLookup = new Map();
    for (const vm of vehicleModels) {
        modelLookup.set(vm.modelName.toLowerCase(), vm.id);
        for (const alias of (vm.aliases || [])) {
            if (!modelLookup.has(alias.toLowerCase())) {
                modelLookup.set(alias.toLowerCase(), vm.id);
            }
        }
    }

    let totalServicesUpserted = 0;
    let totalPricesUpserted = 0;
    let totalPricesSkipped = 0;

    // 3. Loop setiap paket
    for (const pkg of repaintBodiHalusPackages) {
        const serviceName = `Repaint Bodi Halus - ${pkg.name}`;
        const subcategory = `${PACKAGE_SUBCATEGORY_PREFIX}_${pkg.id}`;

        console.log(`\n── Processing: "${serviceName}" (${pkg.multiplier}x) ──`);

        // Upsert Service entry
        const service = await prisma.service.upsert({
            where: { name: serviceName },
            update: {
                category: 'repaint',
                subcategory,
                summary: buildSummary(pkg),
                description: buildDescription(pkg),
                note: buildNote(pkg),
                estimatedDuration: 1920, // 4 hari kerja (sama dengan base)
                usesModelPricing: true,
            },
            create: {
                name: serviceName,
                category: 'repaint',
                subcategory,
                summary: buildSummary(pkg),
                description: buildDescription(pkg),
                note: buildNote(pkg),
                estimatedDuration: 1920,
                usesModelPricing: true,
            },
        });
        totalServicesUpserted++;
        console.log(`  ✅ Service upserted: ${service.id}`);

        // 4. Seed ServicePrice per model
        let pkgPricesUpserted = 0;
        let pkgPricesSkipped = 0;

        for (const item of repaintBodiHalus) {
            // Find vehicleModelId via lookup
            const vehicleModelId = findModelId(item, modelLookup);

            if (!vehicleModelId) {
                console.log(`  ⚠️  No DB model found for "${item.model}" — skipping`);
                pkgPricesSkipped++;
                continue;
            }

            // Calculate pre-multiplied price (rounded to nearest 1000)
            const basePrice = item.price;
            const calculatedPrice = Math.round((basePrice * pkg.multiplier) / 1000) * 1000;

            // Upsert ServicePrice
            const existing = await prisma.servicePrice.findFirst({
                where: { serviceId: service.id, vehicleModelId },
            });

            if (existing) {
                if (existing.price !== calculatedPrice) {
                    await prisma.servicePrice.update({
                        where: { id: existing.id },
                        data: { price: calculatedPrice },
                    });
                    console.log(`  📝 Updated: ${item.model} ${basePrice} × ${pkg.multiplier} = ${calculatedPrice}`);
                    pkgPricesUpserted++;
                }
                // Else: price unchanged, skip silently
            } else {
                await prisma.servicePrice.create({
                    data: { serviceId: service.id, vehicleModelId, price: calculatedPrice },
                });
                console.log(`  ➕ Created: ${item.model} ${basePrice} × ${pkg.multiplier} = ${calculatedPrice}`);
                pkgPricesUpserted++;
            }
        }

        console.log(`  📊 Prices: ${pkgPricesUpserted} upserted, ${pkgPricesSkipped} skipped`);
        totalPricesUpserted += pkgPricesUpserted;
        totalPricesSkipped += pkgPricesSkipped;
    }

    console.log('\n=======================================');
    console.log(`✅ Services upserted  : ${totalServicesUpserted}`);
    console.log(`✅ Prices upserted    : ${totalPricesUpserted}`);
    console.log(`⚠️  Prices skipped     : ${totalPricesSkipped} (model tidak ada di DB)`);
    console.log('=======================================');
    console.log('\n🎉 Done! Jalankan seed selesai.');
}

// ─── Helpers ───────────────────────────────────────────────────────

function findModelId(item, modelLookup) {
    // Try exact model name
    const byModel = modelLookup.get(item.model.toLowerCase());
    if (byModel) return byModel;

    // Try aliases
    for (const alias of (item.aliases || [])) {
        const byAlias = modelLookup.get(alias.toLowerCase());
        if (byAlias) return byAlias;
    }

    return null;
}

function buildSummary(pkg) {
    const summaries = {
        ekonomis: 'Repaint bodi halus harga dasar. Cocok untuk motor harian dan ganti warna budget.',
        standar:  'Repaint bodi halus dengan Clear HS untuk gloss lebih tinggi dan hasil lebih tahan baret.',
        basic:    'Repaint bodi halus dengan polishing & orange peel removal untuk finish mirror look.',
        premium:  'Repaint bodi halus level tertinggi: extra lapisan clear, depth warna dalam, durability maksimal.',
    };
    return summaries[pkg.id] || pkg.description;
}

function buildDescription(pkg) {
    const specList = pkg.spec.map(s => `- ${s}`).join('\n');
    return [
        pkg.description,
        '',
        'Spesifikasi:',
        specList,
        '',
        `Cocok untuk: ${pkg.targetCustomer}`,
        '',
        'Estimasi pengerjaan: 3–4 hari kerja tergantung kondisi dan antrian.',
        'Harga bervariasi per model motor.',
    ].join('\n');
}

function buildNote(pkg) {
    const extras = {
        ekonomis: null,
        standar:  'Harga dasar +20%. Clear HS memberikan daya tahan lebih baik dari Clear MS.',
        basic:    'Harga dasar +40%. Termasuk proses polishing setelah curing untuk menghilangkan orange peel.',
        premium:  'Harga dasar +60%. Lapisan cat dan clear lebih tebal untuk depth warna dan durability terbaik.',
    };
    return extras[pkg.id] || null;
}

// ─── Run ────────────────────────────────────────────────────────────

main()
    .catch(e => {
        console.error('❌ Seed error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
