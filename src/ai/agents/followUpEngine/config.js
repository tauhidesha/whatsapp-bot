// File: src/ai/agents/followUpEngine/config.js
// Centralized configuration for follow-up strategies and rules.

/**
 * Strategy Config: Defines the behavior for each customer label.
 *
 * Timing logic:
 *   - waitDays        = jeda sebelum FU pertama (dari last message)
 *   - intervalDays    = jeda antara FU 1 → FU 2
 *   - secondIntervalDays = jeda antara FU 2 → FU 3
 *   - maxFollowUps    = total max follow-up yang dikirim
 *
 * angles: array of angle per followUpCount index (angles[0] = FU1, angles[1] = FU2, dst).
 * Kalau followUpCount >= angles.length, pakai angle terakhir sebagai fallback.
 * (messageGenerator.js perlu diupdate: `strategy.angles[followUpCount] || strategy.angles.at(-1)`)
 *
 * PENTING — cadence di sini harus selesai (semua FU kejalanin) SEBELUM threshold
 * downgrade rule di scheduler.js kena, atau FU terakhir ga akan pernah jalan.
 * Cross-check tiap kali ubah salah satu:
 *   - hot_lead   → downgrade ke warm_lead kalau >7 hari ga reply
 *   - warm_lead  → downgrade ke window_shopper kalau ghosted & >14 hari
 */
const STRATEGY_CONFIG = {
    // Brand new customer (first message, no context)
    stranger: {
        action: 'follow_up',
        waitDays: 1,
        intervalDays: 3,
        secondIntervalDays: 7,
        maxFollowUps: 3,
        angles: ['value', 'value', 'value'],
    },

    // Fresh lead: chatted but no strong purchase signal yet
    lead: {
        action: 'follow_up',
        waitDays: 1,
        intervalDays: 3,
        secondIntervalDays: 7,
        maxFollowUps: 3,
        angles: ['value', 'social_proof', 'value'],
    },

    // Hot: sudah nanya detail/harga, belum booking. Push cepat selagi masih inget.
    // Cadence dipercepat (FU1@1, FU2@3, FU3@6) supaya semua 3 FU selesai
    // SEBELUM downgrade rule (>7 hari) menurunkan label ini ke warm_lead.
    hot_lead: {
        action: 'follow_up',
        waitDays: 1,
        intervalDays: 2,
        secondIntervalDays: 3,
        maxFollowUps: 3,
        angles: ['clarify', 'social_proof', 'urgency'],
    },

    // Warm: udah nanya-nanya tapi lebih pasif. Downgrade ke window_shopper
    // baru kena di >14 hari (dan harus ghosted), jadi cadence lebih longgar
    // dari hot_lead tapi tetap harus selesai sebelum hari 14.
    warm_lead: {
        action: 'follow_up',
        waitDays: 2,
        intervalDays: 5,
        secondIntervalDays: 6,
        maxFollowUps: 3,
        angles: ['clarify', 'social_proof', 'promo'],
    },

    // Window shopper: cuma survey harga, belum niat. Volume rendah biar ga
    // kerasa spam, dan angle-nya educational dulu — promo terlalu awal di sini
    // justru cheapen positioning. Promo cuma di FU terakhir kalau memang perlu.
    window_shopper: {
        action: 'follow_up',
        waitDays: 3,
        intervalDays: 10,
        secondIntervalDays: 14,
        maxFollowUps: 2,
        angles: ['education', 'light_promo'],
    },

    // Existing customer: reminder maintenance berbasis waktu generik.
    // NOTE: REBOOKING_INTERVALS di scheduler.js (30/90/180 hari by service type)
    // punya priority lebih tinggi dan biasanya "menang" duluan untuk customer
    // yang punya lastServiceType tercatat. Config ini jadi fallback untuk yang
    // service type-nya ga ke-track. Worth disatukan ke satu jalur suatu saat.
    existing_customer: {
        action: 'follow_up',
        waitDays: 45,
        intervalDays: 30,
        secondIntervalDays: 60,
        maxFollowUps: 3,
        angles: ['maintenance', 'checkin', 'maintenance'],
    },

    loyal_customer: {
        action: 'follow_up',
        waitDays: 60,
        intervalDays: 30,
        secondIntervalDays: 60,
        maxFollowUps: 3,
        angles: ['exclusive', 'exclusive', 'exclusive'],
    },

    // Churned: satu percobaan win-back yang lebih besar insentifnya, bukan
    // nurture berulang. Kalau ga respon di FU pertama, stop — jangan diulang
    // terus tanpa akhir (maxFollowUps diturunkan dari 3 → 1).
    churned: {
        action: 'follow_up',
        waitDays: 1,
        intervalDays: 7,
        secondIntervalDays: 14,
        maxFollowUps: 1,
        angles: ['winback'],
    },

    dormant_lead: { action: 'stop' },
};

module.exports = { STRATEGY_CONFIG };