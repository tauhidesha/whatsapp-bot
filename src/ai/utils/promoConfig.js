// File: src/ai/utils/promoConfig.js
// Promo config with 5-minute cache. Fetch dari Prisma KeyValueStore.

const prisma = require('../../lib/prisma');

let promoCache = null;
let promoCacheAt = 0;
const PROMO_CACHE_TTL = 5 * 60 * 1000; // 5 menit

async function getActivePromo() {
    const now = Date.now();

    // Return cache kalau masih fresh
    if (promoCache !== null && (now - promoCacheAt) < PROMO_CACHE_TTL) {
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

        promoCache = (kv?.value?.isActive && kv?.value?.promoText)
            ? kv.value.promoText
            : null;
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