// File: src/ai/agents/followUpEngine/stopCondition.js
// Stop logic untuk follow-up: hard stops & soft stops.

const admin = require('firebase-admin');

/**
 * Cek apakah customer harus di-stop dari follow up.
 * @returns {{ stop: boolean, reason?: string, action?: string }}
 */
function shouldStop(context) {
    // Lazy require to avoid circular dependency with scheduler.js
    const { STRATEGY_CONFIG } = require('./scheduler.js');

    // ─── Hard stops — tidak pernah kirim ───
    if (context.explicitly_rejected) {
        return { stop: true, reason: 'explicitly_rejected' };
    }
    if (context.blocked) {
        return { stop: true, reason: 'blocked' };
    }
    if (context.customer_label === 'dormant_lead') {
        return { stop: true, reason: 'dormant_lead' };
    }
    if (context.follow_up_strategy === 'stop') {
        return { stop: true, reason: 'strategy_stop' };
    }

    // ─── Soft stops — ghost setelah max follow up ───
    const followupCount = context.followup_count || 0;
    const repliedAfter = context.replied_after_followup || false;
    const strategy = STRATEGY_CONFIG[context.customer_label];

    if (
        strategy &&
        strategy.maxFollowUps &&
        followupCount >= strategy.maxFollowUps &&
        !repliedAfter
    ) {
        return {
            stop: true,
            reason: `ghost_${followupCount}x`,
            action: 'downgrade_to_dormant',
        };
    }

    return { stop: false };
}

/**
 * Execute stop action (e.g. downgrade ke dormant).
 */
async function handleStopAction(docId, stopResult, currentLabel) {
    if (!stopResult.stop) return;

    if (stopResult.action === 'downgrade_to_dormant') {
        const db = admin.firestore();
        await db.collection('customerContext').doc(docId).update({
            customer_label: 'dormant_lead',
            follow_up_strategy: 'stop',
            label_reason: stopResult.reason,
            previous_label: currentLabel || 'unknown',
            labeled_by: 'stop_condition',
            label_updated_at: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`[StopCondition] ${docId} downgraded to dormant_lead (${stopResult.reason})`);
    }
}

module.exports = { shouldStop, handleStopAction };
