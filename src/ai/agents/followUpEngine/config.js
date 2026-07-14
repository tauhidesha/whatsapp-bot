// File: src/ai/agents/followUpEngine/config.js
// Centralized configuration for follow-up strategies and rules.

/**
 * Strategy Config: Defines the behavior for each customer label.
 *
 * Timing logic:
 *   - waitDays    = jeda sebelum FU pertama (dari last message)
 *   - intervalDays = jeda antara FU berikutnya (dari last follow-up)
 *   - maxFollowUps = total max follow-up yang dikirim
 *
 * Skema umum (semua label):
 *   FU 1 → waitDays setelah last message
 *   FU 2 → intervalDays (3 hari) setelah FU 1
 *   FU 3 → intervalDays (7 hari) setelah FU 2  ← pakai secondIntervalDays
 */
const STRATEGY_CONFIG = {
    // Brand new customer (first message, no context)
    stranger: {
        action: 'follow_up',
        waitDays: 1,
        intervalDays: 3,
        secondIntervalDays: 7,
        maxFollowUps: 3,
        angle: 'value',
    },
    // Fresh lead: chatted but no strong purchase signal yet
    lead: {
        action: 'follow_up',
        waitDays: 1,
        intervalDays: 3,
        secondIntervalDays: 7,
        maxFollowUps: 3,
        angle: 'value',
    },
    hot_lead: {
        action: 'follow_up',
        waitDays: 1,
        intervalDays: 3,
        secondIntervalDays: 7,
        maxFollowUps: 3,
        angle: 'urgency',
    },
    warm_lead: {
        action: 'follow_up',
        waitDays: 1,
        intervalDays: 3,
        secondIntervalDays: 7,
        maxFollowUps: 3,
        angle: 'value',
    },
    window_shopper: {
        action: 'follow_up',
        waitDays: 1,
        intervalDays: 3,
        secondIntervalDays: 7,
        maxFollowUps: 3,
        angle: 'promo',
    },
    existing_customer: {
        action: 'follow_up',
        waitDays: 45,
        intervalDays: 30,
        secondIntervalDays: 60,
        maxFollowUps: 3,
        angle: 'maintenance',
    },
    loyal_customer: {
        action: 'follow_up',
        waitDays: 60,
        intervalDays: 30,
        secondIntervalDays: 60,
        maxFollowUps: 3,
        angle: 'exclusive',
    },
    churned: {
        action: 'follow_up',
        waitDays: 1,
        intervalDays: 7,
        secondIntervalDays: 14,
        maxFollowUps: 3,
        angle: 'winback',
    },
    dormant_lead: { action: 'stop' },
};

module.exports = { STRATEGY_CONFIG };
