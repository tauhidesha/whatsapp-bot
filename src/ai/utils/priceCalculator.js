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
    const str = raw.toString().toLowerCase();
    return str
        .replace(/yamaha|honda|suzuki|kawasaki|vespa|polytron|selis|smoot|united|viar|bmw|harley/gi, '')
        .replace(/[^a-z0-9\s\-]/g, '')
        .trim();
}

/**
 * Normalize nama layanan untuk fuzzy matching.
 */
function normalizeService(raw) {
    if (!raw) return '';
    const str = raw.toString().toLowerCase();
    return str
        .replace(/full\s*body/gi, 'bodi')
        .replace(/full\s*bodi/gi, 'bodi')
        .trim();
}

/**
 * Cari motor di database berdasarkan model name.
 */
async function findMotorSize(motorModel) {
    if (!motorModel) return null;
    const norm = normalizeModel(motorModel.toString());
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
    if (!targetService) return { service: null, isAmbiguous: false };
    const norm = normalizeService(targetService.toString());
    if (!norm) return { service: null, isAmbiguous: false };

    const allServices = await prisma.service.findMany({
        include: { prices: true }
    });

    const broadKeywords = ['detailing', 'coating', 'repaint', 'cuci'];
    const isBroad = broadKeywords.includes(norm);

    for (const svc of allServices) {
        if (!svc.name) continue;
        const svcNorm = svc.name.toLowerCase();
        
        // Exact match ALWAYS wins
        if (svcNorm === norm) return { service: svc, isAmbiguous: false };

        // Partial match: only if it's NOT a lone broad keyword
        if (!isBroad && (norm.includes(svcNorm) || svcNorm.includes(norm))) {
            return { service: svc, isAmbiguous: false };
        }
    }

    // Fallback keywords — HANYA jika sangat spesifik
    // Jangan paksa pilih layanan untuk kategori umum (detailing, coating)
    // biarkan AI bertanya dulu user mau paket apa
    if (norm.includes('repaint') && (norm.includes('halus') || norm.includes('full'))) {
        return { service: allServices.find(s => s.subcategory === 'bodi_halus') || null, isAmbiguous: false };
    }
    if (norm.includes('repaint') && norm.includes('kasar')) {
        return { service: allServices.find(s => s.subcategory === 'bodi_kasar') || null, isAmbiguous: false };
    }
    if (norm.includes('repaint') && norm.includes('velg')) {
        return { service: allServices.find(s => s.subcategory === 'velg') || null, isAmbiguous: false };
    }

    return { service: null, isAmbiguous: isBroad };
}

/**
 * Main function: Hitung harga spesifik untuk motor + layanan.
 */
async function getSpecificPriceContext(motorModel, targetServicesStr, extraContext = {}) {
    if (!motorModel || !targetServicesStr) return { prompt: null, isAmbiguous: false };

    const motor = await findMotorSize(motorModel);
    const parts = targetServicesStr.split(/,|\bdan\b|\band\b|&|\+/i).map(s => s.trim()).filter(Boolean);

    let combinedResult = "";
    const calculatedNames = new Set();
    let totalCalculated = 0;
    let anyAmbiguity = false;

    // Load Surcharges for color mapping
    const surcharges = await prisma.surcharge.findMany();

    for (const part of parts) {
        const { service, isAmbiguous } = await findService(part);
        if (isAmbiguous) anyAmbiguity = true;
        if (!service) continue;
        
        if (calculatedNames.has(service.name)) continue;
        calculatedNames.add(service.name);

        let price = null;
        let pricingNote = service.summary || '';
        let serviceSurcharge = 0;
        let serviceBreakdown = "";

        // 1. Model-based (Repaint Bodi Halus / Velg specific)
        if (service.usesModelPricing && motor) {
            const priceEntry = await prisma.servicePrice.findFirst({
                where: { serviceId: service.id, vehicleModelId: motor.id }
            });
            if (priceEntry) price = priceEntry.price;
        }
        
        // 2. Size-based (Detailing / Coating / Repaint Kasar)
        if (price === null && motor) {
            const size = service.category === 'repaint' ? motor.repaintSize : motor.serviceSize;
            const priceEntry = await prisma.servicePrice.findFirst({
                where: { serviceId: service.id, size: size }
            });
            if (priceEntry) price = priceEntry.price;
        }

        // 3. Fixed price
        if (price === null) {
            const priceEntry = await prisma.servicePrice.findFirst({
                where: { serviceId: service.id, size: null, vehicleModelId: null }
            });
            if (priceEntry) price = priceEntry.price;
        }

        if (price !== null) {
            serviceBreakdown = `*Rp${price.toLocaleString('id-ID')}*`;

            // --- ULTRA DETAIL SURCHARGES ---
            
            // A. Color Surcharge (Repaint only)
            if (service.category === 'repaint' && extraContext.colorChoice) {
                const normColor = extraContext.colorChoice.toLowerCase();
                const match = surcharges.find(s => 
                    normColor.includes(s.name.toLowerCase()) || 
                    s.aliases.some(a => normColor.includes(a.toLowerCase()))
                );
                if (match) {
                    serviceSurcharge += match.amount;
                    serviceBreakdown += ` + Rp${match.amount.toLocaleString('id-ID')} (Warna ${match.name})`;
                }
            }

            // B. Remover Fee (Repaint Velg only)
            if (service.subcategory === 'velg' && extraContext.isPreviouslyPainted === true) {
                const removerFee = 75000; // Standar remover fee
                serviceSurcharge += removerFee;
                serviceBreakdown += ` + Rp${removerFee.toLocaleString('id-ID')} (Jasa Remover)`;
            }

            combinedResult += `- ${service.name} (${motorModel.toUpperCase()}): ${serviceBreakdown}\n`;
            totalCalculated += (price + serviceSurcharge);
        }
    }

    if (!combinedResult) return { prompt: null, isAmbiguous: anyAmbiguity };

    let finalPrompt = `\n\n[HARGA SPESIFIK - SUDAH DIHITUNG OTOMATIS]\n`;
    finalPrompt += combinedResult.trim() + `\n`;
    if (calculatedNames.size > 1 || totalCalculated > 0) {
        finalPrompt += `Total Estimasi: *Rp${totalCalculated.toLocaleString('id-ID')}*\n`;
    }
    finalPrompt += `\n⚠️ INSTRUKSI: Langsung sebutkan rincian harga di atas.`;

    return { prompt: finalPrompt, isAmbiguous: anyAmbiguity };
}

module.exports = { getSpecificPriceContext, findMotorSize, findService };
