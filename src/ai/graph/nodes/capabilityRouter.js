/**
 * Capability Router Node for Zoya V2
 * Routes the planner's capability request to the appropriate tool execution logic.
 */

async function capabilityRouterNode(state) {
    console.log('[Capability Router Node] Routing Capability...');
    
    const capability = state.planner?.capability;
    
    if (!capability) {
        // If no capability is needed, we don't update the tool state
        // The edge routing will handle jumping to composer.
        return {};
    }

    // In Sprint 1, we simulate routing to specific tools.
    // In full implementation, this will dynamically call tools from src/ai/tools based on capability.
    
    let resultData = null;

    if (capability === 'pricing') {
        resultData = {
            service: 'Repaint Body Halus',
            price: 800000,
            currency: 'IDR'
        };
    } else if (capability === 'booking') {
        resultData = {
            bookingId: 'BK-' + Date.now(),
            status: 'confirmed'
        };
    } else {
        resultData = {
            message: 'Capability not implemented yet.'
        };
    }

    const toolUpdate = {
        lastCapability: capability,
        lastTool: `${capability}_tool`,
        lastResult: resultData,
        executionHistory: [...(state.tool?.executionHistory || []), { capability, result: resultData, time: new Date().toISOString() }]
    };

    return {
        tool: toolUpdate,
        analytics: {
            toolCalls: (state.analytics?.toolCalls || 0) + 1
        }
    };
}

module.exports = {
    capabilityRouterNode
};
