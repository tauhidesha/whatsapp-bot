// File: src/ai/utils/priceCalculator.js
// Backend price calculator — menghitung harga spesifik berdasarkan motor + layanan
// agar AI tidak perlu panggil tool getServiceDetails.

const masterLayanan = require('../../data/masterLayanan.js');
const daftarUkuranMotor = require('../../data/daftarUkuranMotor.js');
const { repaintBodiHalus, repaintBodiKasar, repaintVelg, VELG_PRICE_MAP, warnaSpesial } = require('../../data/repaintPrices.js');

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
 * "repaint full body halus" → cocok ke "repaint bodi halus"
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
 * Cari motor di daftarUkuranMotor berdasarkan model name.
 * Return: { model, service_size, repaint_size } atau null.
 */
function findMotorSize(motorModel) {
    const norm = normalizeModel(motorModel);
    if (!norm) return null;

    for (const m of daftarUkuranMotor) {
        if (m.model === norm) return m;
        // Cek aliases
        if (m.aliases && m.aliases.some(a => a.toLowerCase().includes(norm) || norm.includes(a.toLowerCase()))) {
            return m;
        }
        // Partial match: "nmax" di dalam "yamaha nmax"
        if (norm.includes(m.model) || m.model.includes(norm)) {
            return m;
        }
    }
    return null;
}

/**
 * Cari layanan di masterLayanan berdasarkan nama/keyword.
 * Return: layanan object atau null.
 */
function findService(targetService) {
    const norm = normalizeService(targetService);
    if (!norm) return null;

    for (const svc of masterLayanan) {
        const svcNorm = svc.name.toLowerCase();
        // Exact match
        if (svcNorm === norm) return svc;
        // Partial: "repaint bodi halus" matches "repaint bodi halus"
        if (norm.includes(svcNorm) || svcNorm.includes(norm)) return svc;
        // Keyword match: "repaint halus" → "Repaint Bodi Halus"
        const normTokens = norm.split(/\s+/);
        const svcTokens = svcNorm.split(/\s+/);
        const overlap = normTokens.filter(t => svcTokens.includes(t));
        if (overlap.length >= 2) return svc;
    }

    // Fallback: cek keyword umum
    if (norm.includes('repaint') && (norm.includes('halus') || norm.includes('full'))) {
        return masterLayanan.find(s => s.subcategory === 'bodi_halus');
    }
    if (norm.includes('repaint') && norm.includes('kasar')) {
        return masterLayanan.find(s => s.subcategory === 'bodi_kasar');
    }
    if (norm.includes('repaint') && norm.includes('velg')) {
        return masterLayanan.find(s => s.subcategory === 'velg');
    }
    if (norm.includes('coating') && norm.includes('glossy')) {
        return masterLayanan.find(s => s.name.toLowerCase().includes('coating motor glossy'));
    }
    if (norm.includes('coating') && norm.includes('doff')) {
        return masterLayanan.find(s => s.name.toLowerCase().includes('coating motor doff'));
    }
    if (norm.includes('complete') && norm.includes('glossy')) {
        return masterLayanan.find(s => s.name.toLowerCase().includes('complete service glossy'));
    }
    if (norm.includes('complete') && norm.includes('doff')) {
        return masterLayanan.find(s => s.name.toLowerCase().includes('complete service doff'));
    }
    if (norm.includes('full detailing')) {
        return masterLayanan.find(s => s.name.toLowerCase().includes('full detailing'));
    }
    if (norm.includes('cuci komplit') || norm.includes('cuci lengkap')) {
        return masterLayanan.find(s => s.name.toLowerCase().includes('cuci komplit'));
    }
    if (norm.includes('poles')) {
        return masterLayanan.find(s => s.name.toLowerCase().includes('poles bodi'));
    }
    if (norm.includes('detailing mesin') || norm.includes('mesin')) {
        return masterLayanan.find(s => s.name.toLowerCase().includes('detailing mesin'));
    }

    return null;
}

/**
 * Cari harga repaint bodi halus untuk model motor tertentu.
 */
function findRepaintBodiHalusPrice(motorModel) {
    const norm = normalizeModel(motorModel);
    if (!norm) return null;

    for (const entry of repaintBodiHalus) {
        if (entry.model === norm) return entry;
        if (entry.aliases && entry.aliases.some(a => {
            const aNorm = a.toLowerCase();
            return aNorm.includes(norm) || norm.includes(aNorm);
        })) return entry;
        if (norm.includes(entry.model) || entry.model.includes(norm)) return entry;
    }
    return null;
}

/**
 * Main function: Hitung harga spesifik untuk motor + layanan.
 * Return string prompt injection atau null jika tidak bisa dihitung.
 */
function getSpecificPriceContext(motorModel, targetServicesStr) {
    if (!motorModel || !targetServicesStr) return null;

    const motorSize = findMotorSize(motorModel);
    // Split by comma, 'dan', 'and', '&', '+'
    const parts = targetServicesStr.split(/,|\bdan\b|\band\b|&|\+/i).map(s => s.trim()).filter(Boolean);

    let combinedResult = "";
    const calculatedNames = new Set();
    let totalCalculated = 0;

    for (const part of parts) {
        const service = findService(part);
        if (!service) continue;
        
        // Hindari duplikasi layanan yang sama
        if (calculatedNames.has(service.name)) continue;
        calculatedNames.add(service.name);

        let price = null;
        let sizeLabel = '';
        let pricingNote = '';

        // === CASE 1: Repaint Velg (check FIRST before generic repaint) ===
        if (service.subcategory === 'velg') {
            const normMotor = normalizeModel(motorModel);
            for (const [key, velgPrice] of Object.entries(VELG_PRICE_MAP)) {
                if (normMotor.includes(key) || key.includes(normMotor)) {
                    price = velgPrice;
                    pricingNote = 'Sepasang velg (termasuk bongkar pasang ban)';
                    break;
                }
            }
        }
        // === CASE 2: Repaint Bodi Kasar ===
        else if (service.subcategory === 'bodi_kasar') {
            if (motorSize) {
                const sizeMap = { S: 0, M: 1, L: 2, XL: 3 };
                const idx = sizeMap[motorSize.repaint_size] ?? null;
                if (idx !== null && repaintBodiKasar[idx]) {
                    price = repaintBodiKasar[idx].price;
                    sizeLabel = motorSize.repaint_size;
                    pricingNote = `Kategori: ${repaintBodiKasar[idx].category}`;
                }
            }
        }
        // === CASE 3: Repaint Bodi Halus ===
        else if (service.subcategory === 'bodi_halus' || (service.usesModelPricing && service.category === 'repaint')) {
            const repaintEntry = findRepaintBodiHalusPrice(motorModel);
            if (repaintEntry) {
                price = repaintEntry.price;
                pricingNote = repaintEntry.note || 'Full Body Halus';
            }
        }
        // === CASE 4: Layanan berbasis SIZE ===
        else if (service.variants && service.variants.length > 0 && motorSize) {
            const size = service.category === 'repaint' ? motorSize.repaint_size : motorSize.service_size;
            const variant = service.variants.find(v => v.name === size);
            if (variant) {
                price = variant.price;
                sizeLabel = size;
            }
        }
        // === CASE 5: Harga flat ===
        else if (service.price > 0) {
            price = service.price;
        }

        // Jika berhasil dihitung, tambahkan ke string gabungan
        if (price !== null) {
            combinedResult += buildPriceLine(motorModel, service.name, price, pricingNote, sizeLabel) + "\n";
            totalCalculated += price;
        }
    }

    if (!combinedResult) return null;

    // Build the final prompt block
    let finalPrompt = `\n\n[HARGA SPESIFIK - SUDAH DIHITUNG OTOMATIS]\n`;
    finalPrompt += combinedResult.trim() + `\n`;
    if (calculatedNames.size > 1) {
        finalPrompt += `Total Sementara: *Rp${totalCalculated.toLocaleString('id-ID')}*\n`;
    }
    finalPrompt += `\n⚠️ INSTRUKSI: Langsung sebutkan harga otomatis di atas ke pelanggan. JANGAN panggil tool getServiceDetails lagi!`;

    return finalPrompt;
}

/**
 * Helper terpisah hanya untuk formatting satu baris harga
 */
function buildPriceLine(motor, serviceName, price, note, size) {
    const formattedPrice = `*Rp${price.toLocaleString('id-ID')}*`;
    let line = `- ${serviceName} (${motor.toUpperCase()}`;
    if (size) line += ` ukuran ${size}`;
    line += `): ${formattedPrice}`;
    if (note) line += ` [Catatan: ${note}]`;
    return line;
}

/**
 * Format string harga untuk disuntikkan ke System Prompt.
 */
function buildPriceString(motor, serviceName, price, note, size) {
    const formattedPrice = `Rp${price.toLocaleString('id-ID')}`;
    let result = `\n\n[HARGA SPESIFIK - SUDAH DIHITUNG OTOMATIS]`;
    result += `\nMotor: ${motor.toUpperCase()}`;
    if (size) result += ` (Ukuran: ${size})`;
    result += `\nLayanan: ${serviceName}`;
    result += `\nHarga: *${formattedPrice}*`;
    if (note) result += `\nCatatan: ${note}`;
    result += `\n\n⚠️ INSTRUKSI: Langsung sebutkan harga *${formattedPrice}* ini ke pelanggan. JANGAN panggil tool getServiceDetails lagi karena harga sudah dihitung otomatis oleh sistem!`;
    return result;
}

module.exports = { getSpecificPriceContext, findMotorSize, findService, findRepaintBodiHalusPrice };
