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
        angles: ['standard', 'promo', 'soft_closure'],
    },
    warm_lead: {
        action: 'follow_up',
        waitDays: 2,
        intervalDays: 7,
        maxFollowUps: 3,
        angles: ['standard', 'educational', 'humor', 'soft_closure'],
    },
    lead: {
        action: 'follow_up',
        waitDays: 3,
        intervalDays: 10,
        maxFollowUps: 3,
        angles: ['standard', 'comparison', 'humor', 'soft_closure'],
    },
    window_shopper: {
        action: 'follow_up',
        waitDays: 7,
        intervalDays: 14,
        maxFollowUps: 2,
        angles: ['promo', 'humor', 'soft_closure'],
    },
    existing_customer: {
        action: 'follow_up',
        waitDays: 45,
        intervalDays: 30,
        maxFollowUps: 3,
        angles: ['rebooking_detailing', 'educational', 'promo'],
    },
    loyal_customer: {
        action: 'follow_up',
        waitDays: 60,
        intervalDays: 30,
        maxFollowUps: 2,
        angles: ['followup_ghost', 'promo'],
    },
    churned: {
        action: 'follow_up',
        waitDays: 0,
        intervalDays: 30,
        maxFollowUps: 2,
        angles: ['followup_ghost', 'promo'],
    },
    dormant_lead: { action: 'stop' },
};

module.exports = { STRATEGY_CONFIG };
