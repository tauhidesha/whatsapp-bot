// File: src/ai/utils/promoConfig.js
// Promo config with 5-minute cache. Fetch dari Prisma KeyValueStore.
// Returns structured object with combo discount info.

const prisma = require('../../lib/prisma');

let promoCache = null;
let promoCacheAt = 0;
const PROMO_CACHE_TTL = 5 * 60 * 1000; // 5 menit

/**
 * Returns structured promo object or null.
 * Shape: { promoText, comboDiscount, comboMinServices }
 */
async function getActivePromo() {
    const now = Date.now();

    if (promoCache !== undefined && promoCache !== null && (now - promoCacheAt) < PROMO_CACHE_TTL) {
        return promoCache;
    }

    try {
        const kv = await prisma.keyValueStore.findUnique({
            where: {
                collection_key: {
                    collection: 'settings',
                    key: 'promo_config'
                }
            }
        });

        if (kv?.value?.isActive) {
            promoCache = {
                promoText: kv.value.promoText || null,
                comboDiscount: kv.value.comboDiscount || 0, // 0.15 = 15%
                comboMinServices: kv.value.comboMinServices || 2,
            };
        } else {
            promoCache = null;
        }
        promoCacheAt = now;

        return promoCache;
    } catch (error) {
        console.warn('[PromoConfig] Gagal fetch promo:', error.message);
        return promoCache; // Return cache lama kalau gagal
    }
}

function invalidatePromoCache() {
    promoCache = null;
    promoCacheAt = 0;
    console.log('[PromoConfig] Cache invalidated.');
}

module.exports = { getActivePromo, invalidatePromoCache };