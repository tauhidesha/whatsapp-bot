// File: src/ai/agents/followUpEngine/config.js
// Centralized configuration for follow-up strategies and rules.

/**
 * Strategy Config: Defines the behavior for each customer label.
 */
const STRATEGY_CONFIG = {
    hot_lead: {
        action: 'follow_up',
        waitDays: 1,
        intervalDays: 3,
        maxFollowUps: 2,
        angle: 'urgency',
    },
    warm_lead: {
        action: 'follow_up',
        waitDays: 2,
        intervalDays: 7,
        maxFollowUps: 2,
        angle: 'value',
    },
    lead: {
        action: 'follow_up',
        waitDays: 3,
        intervalDays: 10,
        maxFollowUps: 2,
        angle: 'value',
    },
    window_shopper: {
        action: 'follow_up',
        waitDays: 7,
        intervalDays: 14,
        maxFollowUps: 1,
        angle: 'promo',
    },
    existing_customer: {
        action: 'follow_up',
        waitDays: 45,
        intervalDays: 30,
        maxFollowUps: 3,
        angle: 'maintenance',
    },
    loyal_customer: {
        action: 'follow_up',
        waitDays: 60,
        intervalDays: 30,
        maxFollowUps: 2,
        angle: 'exclusive',
    },
    churned: {
        action: 'follow_up',
        waitDays: 0,
        intervalDays: 30,
        maxFollowUps: 2,
        angle: 'winback',
    },
    dormant_lead: { action: 'stop' },
};

module.exports = { STRATEGY_CONFIG };
