const { trackAnalytics } = require('../../analytics/tracker');

/**
 * Analytics Node for Zoya V2
 */
async function analyticsNode(state) {
    console.log('[Analytics Node] Updating metrics...');

    const newAnalytics = trackAnalytics(state);
    
    // We update conversation status if needed, but mainly update analytics
    return {
        analytics: newAnalytics,
        conversation: {
            ...state.conversation,
            buyerStage: newAnalytics.buyerStage
        }
    };
}

module.exports = {
    analyticsNode
};
