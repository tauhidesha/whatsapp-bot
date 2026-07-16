const { trackAnalytics } = require('../../analytics/tracker');

/**
 * Analytics Node for Zoya V2
 */
async function analyticsNode(state) {
    console.log('[Analytics Node] Updating metrics...');

    const newAnalytics = trackAnalytics(state);
    
    // We update conversation status if needed, but mainly update analytics
    const result = {
        analytics: newAnalytics,
        conversation: {
            ...state.conversation,
            buyerStage: newAnalytics.buyerStage
        }
    };
    console.log('[Analytics Node] Output:', JSON.stringify(result, null, 2));
    return result;
}

module.exports = {
    analyticsNode
};
