const { trackAnalytics } = require('../../analytics/tracker');

/**
 * Analytics Node for Zoya V2
 */
async function analyticsNode(state) {
    console.log('[Analytics Node] Updating metrics...');

    const newAnalytics = trackAnalytics(state);
    
    const result = {
        analytics: newAnalytics,
        sales: {
            buyerStage: newAnalytics.buyerStage
        }
    };
    console.log('[Analytics Node] Output:', JSON.stringify(result, null, 2));
    return result;
}

module.exports = {
    analyticsNode
};
