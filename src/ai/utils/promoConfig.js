// File: src/ai/utils/promoConfig.js
// Promo config with 5-minute cache. Fetch dari Firestore settings/promo_config.

const admin = require('firebase-admin');

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
        const db = admin.firestore();
        const doc = await db.collection('settings').doc('promo_config').get();

        const data = doc.exists ? doc.data() : null;
        promoCache = (data?.isActive && data?.promoText)
            ? data.promoText
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
