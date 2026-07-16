/**
 * Analytics Tracker for Zoya V2
 * Calculates metrics and determines the Buyer Stage.
 */

function trackAnalytics(state) {
    console.log('[Analytics Tracker] Tracking metrics and buyer stage...');

    const { conversation, memory, sales } = state;
    // Read Buyer Stage from Planner Decision (Single Source of Truth)
    // with fallback to previous state or Exploring
    let newBuyerStage = state.planner?.decision?.buyerStage || sales?.buyerStage || 'Exploring';

    return {
        buyerStage: newBuyerStage,
        interactionCount: (state.analytics?.interactionCount || 0) + 1,
        lastUpdated: new Date().toISOString()
    };
}

module.exports = {
    trackAnalytics
};
