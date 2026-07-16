/**
 * Analytics Tracker for Zoya V2
 * Calculates metrics and determines the Buyer Stage.
 */

function trackAnalytics(state) {
    console.log('[Analytics Tracker] Tracking metrics and buyer stage...');

    const { conversation, memory, sales } = state;
    let newBuyerStage = sales?.buyerStage || 'Exploring';

    // Heuristics for Buyer Stage
    if (memory?.salesMemory?.common_objection) {
        newBuyerStage = 'Hesitating';
    } else if (state.tool?.lastCapability === 'pricing') {
        newBuyerStage = 'Comparing';
    } else if (state.planner?.nextAction === 'BOOK') {
        newBuyerStage = 'Ready to Buy';
    } else if (state.planner?.strategy === 'WAIT' && newBuyerStage === 'Hesitating') {
        newBuyerStage = 'Cooling Down';
    }

    return {
        buyerStage: newBuyerStage,
        interactionCount: (state.analytics?.interactionCount || 0) + 1,
        lastUpdated: new Date().toISOString()
    };
}

module.exports = {
    trackAnalytics
};
