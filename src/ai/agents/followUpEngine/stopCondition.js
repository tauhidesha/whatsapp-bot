// File: src/ai/agents/followUpEngine/stopCondition.js
// Stop logic untuk follow-up: hard stops & soft stops.

const prisma = require('../../../lib/prisma');

/**
 * Cek apakah customer harus di-stop dari follow up.
 * @returns {{ stop: boolean, reason?: string, action?: string }}
 */
function shouldStop(context) {
    // Lazy require to avoid circular dependency with scheduler.js
    const { STRATEGY_CONFIG } = require('./scheduler.js');

    // ─── Hard stops — tidak pernah kirim ───
    if (context.explicitlyRejected) {
        return { stop: true, reason: 'explicitly_rejected' };
    }
    if (context.blocked) {
        return { stop: true, reason: 'blocked' };
    }
    if (context.customerLabel === 'dormant_lead') {
        return { stop: true, reason: 'dormant_lead' };
    }
    if (context.followUpStrategy === 'stop') {
        return { stop: true, reason: 'strategy_stop' };
    }

    // ─── Soft stops — ghost setelah max follow up ───
    const followUpCount = context.followUpCount || 0;
    const repliedAfter = context.repliedAfterFollowup || false;
    const strategy = STRATEGY_CONFIG[context.customerLabel];

    if (
        strategy &&
        strategy.maxFollowUps &&
        followUpCount >= strategy.maxFollowUps &&
        !repliedAfter
    ) {
        return {
            stop: true,
            reason: `ghost_${followUpCount}x`,
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
        await prisma.customerContext.update({
            where: { id: docId },
            data: {
                customerLabel: 'dormant_lead',
                followUpStrategy: 'stop',
                labelReason: stopResult.reason,
                labelScores: {
                    previousLabel: currentLabel || 'unknown',
                    labeledBy: 'stop_condition'
                }
            }
        });
        console.log(`[StopCondition] ${docId} downgraded to dormant_lead (${stopResult.reason})`);
    }
}

module.exports = { shouldStop, handleStopAction };