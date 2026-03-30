// File: src/ai/utils/priceCalculator.js
// Backend price calculator — menghitung harga spesifik berdasarkan motor + layanan
// agar AI tidak perlu panggil tool getServiceDetails.

const prisma = require('../../lib/prisma');

/**
 * Normalize string motor model untuk fuzzy matching.
 * "Yamaha NMAX" → "nmax", "Honda PCX 160" → "pcx 160"
 */
function normalizeModel(raw) {
    if (!raw) return '';
    return raw
        .toLowerCase()
        .replace(/yamaha|honda|suzuki|kawasaki|vespa|polytron|selis|smoot|united|viar|bmw|harley/gi, '')
        .replace(/[^a-z0-9\s\-]/g, '')
        .trim();
}

/**
 * Normalize nama layanan untuk fuzzy matching.
 */
function normalizeService(raw) {
    if (!raw) return '';
    return raw
        .toLowerCase()
        .replace(/full\s*body/gi, 'bodi')
        .replace(/full\s*bodi/gi, 'bodi')
        .trim();
}

/**
 * Cari motor di database berdasarkan model name.
 */
async function findMotorSize(motorModel) {
    const norm = normalizeModel(motorModel);
    if (!norm) return null;

    const motor = await prisma.vehicleModel.findFirst({
        where: {
            OR: [
                { modelName: { equals: norm, mode: 'insensitive' } },
                { aliases: { has: norm } }
            ]
        }
    });

    if (motor) return motor;

    // Fallback: Partial match
    const all = await prisma.vehicleModel.findMany();
    return all.find(m => 
        norm.includes(m.modelName.toLowerCase()) || 
        m.modelName.toLowerCase().includes(norm) ||
        m.aliases.some(a => a.toLowerCase().includes(norm) || norm.includes(a.toLowerCase()))
    );
}

/**
 * Cari layanan di database berdasarkan nama/keyword.
 */
async function findService(targetService) {
    const norm = normalizeService(targetService);
    if (!norm) return null;

    const allServices = await prisma.service.findMany({
        include: { prices: true }
    });

    for (const svc of allServices) {
        const svcNorm = svc.name.toLowerCase();
        if (svcNorm === norm) return svc;
        if (norm.includes(svcNorm) || svcNorm.includes(norm)) return svc;
    }

    // Fallback keywords
    if (norm.includes('repaint') && (norm.includes('halus') || norm.includes('full'))) {
        return allServices.find(s => s.subcategory === 'bodi_halus');
    }
    if (norm.includes('repaint') && norm.includes('kasar')) {
        return allServices.find(s => s.subcategory === 'bodi_kasar');
    }
    if (norm.includes('repaint') && norm.includes('velg')) {
        return allServices.find(s => s.subcategory === 'velg');
    }
    if (norm.includes('coating')) {
        return allServices.find(s => s.name.toLowerCase().includes('coating motor glossy'));
    }
    if (norm.includes('detailing')) {
        return allServices.find(s => s.category === 'detailing');
    }

    return null;
}

/**
 * Main function: Hitung harga spesifik untuk motor + layanan.
 */
async function getSpecificPriceContext(motorModel, targetServicesStr) {
    if (!motorModel || !targetServicesStr) return null;

    const motor = await findMotorSize(motorModel);
    const parts = targetServicesStr.split(/,|\bdan\b|\band\b|&|\+/i).map(s => s.trim()).filter(Boolean);

    let combinedResult = "";
    const calculatedNames = new Set();
    let totalCalculated = 0;

    for (const part of parts) {
        const service = await findService(part);
        if (!service) continue;
        
        if (calculatedNames.has(service.name)) continue;
        calculatedNames.add(service.name);

        let price = null;
        let pricingNote = service.summary || '';

        // 1. Model-based (Repaint Bodi Halus / Velg specific)
        if (service.usesModelPricing && motor) {
            const priceEntry = await prisma.servicePrice.findFirst({
                where: { serviceId: service.id, vehicleModelId: motor.id }
            });
            if (priceEntry) {
                price = priceEntry.price;
            }
        }
        
        // 2. Size-based (Detailing / Coating / Repaint Kasar)
        if (price === null && motor) {
            const size = service.category === 'repaint' ? motor.repaintSize : motor.serviceSize;
            const priceEntry = await prisma.servicePrice.findFirst({
                where: { serviceId: service.id, size: size }
            });
            if (priceEntry) {
                price = priceEntry.price;
            }
        }

        // 3. Fixed price
        if (price === null) {
            const priceEntry = await prisma.servicePrice.findFirst({
                where: { serviceId: service.id, size: null, vehicleModelId: null }
            });
            if (priceEntry) {
                price = priceEntry.price;
            }
        }

        if (price !== null) {
            combinedResult += `- ${service.name} (${motorModel.toUpperCase()}): *Rp${price.toLocaleString('id-ID')}*\n`;
            totalCalculated += price;
        }
    }

    if (!combinedResult) return null;

    let finalPrompt = `\n\n[HARGA SPESIFIK - SUDAH DIHITUNG OTOMATIS]\n`;
    finalPrompt += combinedResult.trim() + `\n`;
    if (calculatedNames.size > 1) {
        finalPrompt += `Total Sementara: *Rp${totalCalculated.toLocaleString('id-ID')}*\n`;
    }
    finalPrompt += `\n⚠️ INSTRUKSI: Langsung sebutkan harga otomatis di atas ke pelanggan. JANGAN panggil tool getServiceDetails lagi!`;

    return finalPrompt;
}

module.exports = { getSpecificPriceContext, findMotorSize, findService };
